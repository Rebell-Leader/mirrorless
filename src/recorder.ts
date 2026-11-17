/**
 * Headset letter recorder (development tool).
 *
 * Walks through the ASL letters. For each take it waits until the chosen hand
 * holds a steady shape, captures the last ~0.5 s of joint poses (motion
 * letters J/Z: a 1.6 s trajectory), and POSTs the take to the dev server,
 * which saves it under data/recordings/. When the dev server can't be reached
 * (hosted site, or a Wi-Fi that blocks device-to-device traffic) takes are kept
 * in this browser instead (take-store.ts) and downloaded later from the 2D
 * page. Between takes the learner must relax the hand, so takes are
 * independent rather than duplicates.
 *
 * Hands-only: capture is automatic; buttons are pressed with the other hand.
 * Word mode records whole words fingerspelled continuously (transitions,
 * bounce, rhythm), started by holding the first letter still.
 *
 * URL params: ?letters=ABC&words=MAYA,ANNA&takes=3&hand=left&stable=0.012
 * (words without letters records words only)
 */

import {
  createSystem,
  Quaternion,
  UIKitMLAsset,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { ASL_LETTERS, LETTER_INDEX } from './asl-letters.js';
import { checkFingers, type GateResult } from './finger-gate.js';
import { F, FEATURE_COUNT, type Handedness, JOINT_COUNT } from './hand-features.js';
import { handState } from './hand-state.js';
import type { TextElement } from './probe.js';
import {
  RECORDING_SCHEMA,
  type RecordedFrame,
  type RecordingTake,
  type TakeKind,
  takeFileName,
  validateTake,
  WORD_RE,
} from './recording-schema.js';
import { countTakes, deleteTake, putTake, requestPersistentStorage } from './take-store.js';
import { isRecorderUrl } from './trainer.js';

type Phase = 'waiting' | 'holding' | 'recording' | 'saving' | 'release' | 'paused' | 'done';
/** Where takes go: the laptop's dev server, or this browser's IndexedDB. */
type Storage = 'laptop' | 'headset';

interface SavedTake {
  file: string;
  where: Storage;
}

const RING = 1200; // ~13 s at 90 fps (long words)
const SHAPE_DIMS = 20; // 5 curls + 15 fingertip coordinates
const HOLD_S = 0.8; // steady time before a static capture
const CAPTURE_MS = 500; // static window saved
const MOTION_LEAD_S = 0.5; // steady start pose before a motion recording
const MOTION_MS = 1600; // J/Z window saved
const WORD_MS_PER_LETTER = 700;
const WORD_EXTRA_MS = 1200;
const RELEASE_DIST = 0.12; // shape change that counts as "relaxed"
const RELEASE_LOST_MS = 300; // or the hand leaves tracking this long
const DEFAULT_STABLE = 0.012; // EMA of mean |Δshape| per frame
const OVERRIDE_S = 3; // hold this long to record despite a failed gate
const CONSISTENT_DIST = 0.1; // takes 2+ must be this close to earlier takes

const STATUS_COLORS: Record<string, string> = {
  idle: '#3a3d44',
  hold: '#8a6d00',
  ok: '#137a52',
  rec: '#a3402a',
  warn: '#8f2d2d',
};

interface Item {
  kind: TakeKind;
  label: string;
  shape: string;
  meta: string;
  motion: boolean;
  /** Recording window for motion items, ms. */
  durationMs: number;
  /** Finger pattern the steady (start) shape must roughly match. */
  fingers: string;
}

interface Config {
  items: Item[];
  takes: number;
  hand: Handedness;
  stable: number;
}

function readConfig(): Config {
  const p = new URLSearchParams(window.location.search);
  const wanted = (p.get('letters') ?? '').toUpperCase().replace(/[^A-Z]/gu, '');
  const words = (p.get('words') ?? '')
    .toUpperCase()
    .split(/[^A-Z]+/u)
    .filter((w) => WORD_RE.test(w));
  const letterList =
    wanted.length > 0
      ? [...new Set(wanted.split(''))].map((l) => LETTER_INDEX[l]).filter(Boolean)
      : words.length > 0
        ? []
        : ASL_LETTERS;
  const items: Item[] = letterList.map((l) => ({
    kind: 'letter',
    label: l.letter,
    shape: l.shape,
    meta: `Palm ${l.palm}${l.motion ? ' | movement letter' : ''} | expected tracking difficulty: ${l.risk}`,
    motion: l.motion,
    durationMs: MOTION_MS,
    fingers: l.fingers,
  }));
  for (const w of words) {
    items.push({
      kind: 'word',
      label: w,
      shape: 'Fingerspell the whole word smoothly, at a comfortable pace, without bouncing each letter.',
      meta: `Hold the first letter (${w[0]}) still to start | ${((w.length * WORD_MS_PER_LETTER + WORD_EXTRA_MS) / 1000).toFixed(1)} s window`,
      motion: true,
      durationMs: w.length * WORD_MS_PER_LETTER + WORD_EXTRA_MS,
      fingers: LETTER_INDEX[w[0]]?.fingers ?? '.....',
    });
  }
  const takes = Math.min(10, Math.max(1, Number.parseInt(p.get('takes') ?? '3', 10) || 3));
  const hand: Handedness = p.get('hand') === 'left' ? 'left' : 'right';
  const stable = Number.parseFloat(p.get('stable') ?? '') || DEFAULT_STABLE;
  return { items, takes, hand, stable };
}

function makeSessionId(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `s${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

const round5 = (x: number) => Math.round(x * 1e5) / 1e5;

export class RecorderSystem extends createSystem({}) {
  private active = false;
  private cfg!: Config;
  private sessionId = '';
  private phase: Phase = 'waiting';
  private pausedFrom: Phase = 'waiting';
  private letterIdx = 0;
  private take = 1;

  // Ring buffer of recent frames for the target hand.
  private ringT!: Float64Array;
  private ringJoints!: Float32Array;
  private ringRadii!: Float32Array;
  private ringHead!: Float32Array;
  private ringFeatures!: Float32Array;
  private ringHead_ = 0; // next write index
  private ringCount = 0;

  private prevShape!: Float32Array;
  private capturedShape!: Float32Array;
  private hasPrev = false;
  private motionEma = 1;
  private steadyS = 0;
  private recordStart = 0;
  private lostSince = 0;
  private gate: GateResult = { pass: true, problems: [] };
  private consistent = true;
  private gateMessage = '';
  private takeShapes = new Map<string, Float32Array[]>();
  private lastShapeLabel: string[] = [];

  private savedFiles: SavedTake[] = [];
  private savedCount = 0;
  private failedCount = 0;
  private lastError = '';
  private storage: Storage | null = null;
  private storageReady: Promise<void> = Promise.resolve();
  /** Takes in the current storage (laptop disk or this headset), all sessions. */
  private storedTotal = 0;

  private text: Record<string, TextElement | undefined> = {};
  private uiTimer = 0;
  private needsPlacement = false;
  private audio: AudioContext | null = null;
  private tmpPos!: Vector3;
  private tmpQuat!: Quaternion;
  private yAxis!: Vector3;

  init(): void {
    this.active = isRecorderUrl();
    if (!this.active) return;
    this.cfg = readConfig();
    this.sessionId = makeSessionId();
    this.ringT = new Float64Array(RING);
    this.ringJoints = new Float32Array(RING * JOINT_COUNT * 16);
    this.ringRadii = new Float32Array(RING * JOINT_COUNT);
    this.ringHead = new Float32Array(RING * 16);
    this.ringFeatures = new Float32Array(RING * FEATURE_COUNT);
    this.prevShape = new Float32Array(SHAPE_DIMS);
    this.capturedShape = new Float32Array(SHAPE_DIMS);
    this.tmpPos = new Vector3();
    this.tmpQuat = new Quaternion();
    this.yAxis = new Vector3(0, 1, 0);

    const panel = this.world.getSceneObject<UIKitMLAsset>('recorder-panel');
    for (const id of ['letter', 'shape', 'meta', 'take', 'status', 'hold-bar', 'saved', 'connection', 'btn-hand-label']) {
      this.text[id] = panel?.getElementById(id) as TextElement | undefined;
    }
    const bind = (id: string, fn: () => void) => {
      const el = panel?.getElementById(id) as
        | {
            name: string;
            addEventListener(t: string, f: () => void): void;
            removeEventListener(t: string, f: () => void): void;
          }
        | undefined;
      if (!el) return;
      el.name = id; // addressable runtime name (for CLI/emulator targeting)
      el.addEventListener('click', fn);
      this.cleanupFuncs.push(() => el.removeEventListener('click', fn));
    };
    bind('btn-redo', () => void this.redo());
    bind('btn-skip', () => this.skip());
    bind('btn-pause', () => this.togglePause());
    bind('btn-hand', () => this.toggleHand());
    bind('btn-recenter', () => {
      this.needsPlacement = true;
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'r') void this.redo();
      else if (e.key === 's') this.skip();
      else if (e.key === ' ') this.togglePause();
      else if (e.key === 'h') this.toggleHand();
    };
    window.addEventListener('keydown', onKey);
    this.cleanupFuncs.push(() => window.removeEventListener('keydown', onKey));

    this.cleanupFuncs.push(
      this.world.visibilityState.subscribe((state) => {
        if (state === VisibilityState.Visible) {
          this.needsPlacement = true;
          this.ensureAudio();
        }
      }),
    );

    (window as unknown as { __recorder?: unknown }).__recorder = {
      state: () => ({
        phase: this.phase,
        label: this.currentLetter()?.label ?? null,
        take: this.take,
        hand: this.cfg.hand,
        motion: this.motionEma,
        steady: this.steadyS,
        saved: this.savedCount,
        failed: this.failedCount,
        lastError: this.lastError,
        files: this.savedFiles.map((f) => f.file),
        storage: this.storage,
        storedTotal: this.storedTotal,
        sessionId: this.sessionId,
      }),
    };

    this.storageReady = this.detectStorage();
    this.renderAll();
  }

  update(delta: number): void {
    if (!this.active) return;
    if (this.needsPlacement && handState.headValid) this.placePanels();

    const visible = this.world.visibilityState.peek() === VisibilityState.Visible;
    const h = handState[this.cfg.hand];
    const now = handState.time;

    if (visible && h.valid) {
      this.pushFrame(now);
      this.lostSince = 0;
    } else if (this.lostSince === 0) {
      this.lostSince = now;
    }

    if (visible) this.step(delta, now, h.valid);

    this.uiTimer += delta;
    if (this.uiTimer >= 0.1) {
      this.uiTimer = 0;
      this.renderAll();
    }
  }

  // ---------------------------------------------------------------- state

  private currentLetter(): Item | undefined {
    return this.cfg.items[this.letterIdx];
  }

  private step(delta: number, now: number, valid: boolean): void {
    const letter = this.currentLetter();
    switch (this.phase) {
      case 'waiting':
      case 'holding': {
        if (!letter) {
          this.phase = 'done';
          break;
        }
        const steady = valid && this.motionEma < this.cfg.stable;
        this.steadyS = steady ? this.steadyS + delta : 0;
        this.phase = this.steadyS > 0 ? 'holding' : 'waiting';
        if (this.steadyS === 0) this.gateMessage = '';
        const need = letter.motion ? MOTION_LEAD_S : HOLD_S;
        if (this.steadyS >= need) {
          this.gate = checkFingers(letter.fingers, handState[this.cfg.hand].features);
          this.consistent = letter.kind === 'word' || this.isConsistent(letter.label);
          const ok = this.gate.pass && this.consistent;
          if (!ok && this.steadyS < OVERRIDE_S) {
            this.gateMessage = !this.gate.pass
              ? `Check: ${this.gate.problems[0]}`
              : 'Looks different from your earlier takes - form the same shape';
            break;
          }
          this.gateMessage = '';
          if (letter.motion) {
            this.phase = 'recording';
            this.recordStart = now;
            this.beep(660, 0.12);
          } else {
            void this.capture(now - CAPTURE_MS, now);
          }
        }
        break;
      }
      case 'recording':
        if (now - this.recordStart >= (this.currentLetter()?.durationMs ?? MOTION_MS)) {
          void this.capture(this.recordStart - 150, now);
        }
        break;
      case 'release': {
        const lost = !valid && this.lostSince > 0 && now - this.lostSince >= RELEASE_LOST_MS;
        if (lost || (valid && this.shapeDistance(this.capturedShape) > RELEASE_DIST)) {
          this.phase = this.currentLetter() ? 'waiting' : 'done';
          this.steadyS = 0;
        }
        break;
      }
      default:
        break;
    }
  }

  private isConsistent(label: string): boolean {
    const prev = this.takeShapes.get(label);
    if (!prev || prev.length === 0) return true;
    let sum = 0;
    for (let k = 0; k < SHAPE_DIMS; k++) {
      let mean = 0;
      for (const v of prev) mean += v[k] / prev.length;
      sum += Math.abs(this.prevShape[k] - mean);
    }
    return sum / SHAPE_DIMS < CONSISTENT_DIST;
  }

  private advanceTake(): void {
    if (this.take < this.cfg.takes) {
      this.take++;
    } else {
      this.take = 1;
      this.letterIdx++;
    }
  }

  private skip(): void {
    if (this.phase === 'saving') return;
    this.take = 1;
    this.letterIdx = Math.min(this.letterIdx + 1, this.cfg.items.length);
    this.phase = this.currentLetter() ? 'waiting' : 'done';
    this.steadyS = 0;
    this.renderAll();
  }

  private togglePause(): void {
    if (this.phase === 'paused') {
      this.phase = this.pausedFrom === 'done' ? 'done' : 'waiting';
      this.steadyS = 0;
    } else {
      this.pausedFrom = this.phase === 'saving' ? 'release' : this.phase;
      this.phase = 'paused';
    }
    this.renderAll();
  }

  private toggleHand(): void {
    if (this.phase === 'saving') return;
    this.cfg.hand = this.cfg.hand === 'right' ? 'left' : 'right';
    this.take = 1;
    this.takeShapes.clear();
    this.lastShapeLabel = [];
    this.ringCount = 0;
    this.hasPrev = false;
    this.steadyS = 0;
    if (this.phase !== 'paused' && this.phase !== 'done') this.phase = 'waiting';
    this.renderAll();
  }

  private async redo(): Promise<void> {
    if (this.phase === 'saving') return;
    const saved = this.savedFiles.pop();
    if (!saved) return;
    const { file } = saved;
    const m = /\/([A-Z]{1,16})-(left|right)-t(\d+)-/u.exec(file);
    try {
      if (saved.where === 'laptop') {
        const res = await fetch(`/api/recordings?file=${encodeURIComponent(file)}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } else {
        await deleteTake(file);
      }
      this.savedCount = Math.max(0, this.savedCount - 1);
      if (saved.where === this.storage) this.storedTotal = Math.max(0, this.storedTotal - 1);
      const lbl = this.lastShapeLabel.pop();
      if (lbl) this.takeShapes.get(lbl)?.pop();
    } catch (err) {
      this.lastError = `Redo failed: ${err instanceof Error ? err.message : String(err)}`;
      this.savedFiles.push(saved);
      this.renderAll();
      return;
    }
    if (m) {
      const idx = this.cfg.items.findIndex((l) => l.label === m[1]);
      if (idx >= 0) {
        this.letterIdx = idx;
        this.take = Number.parseInt(m[3], 10);
      }
    }
    this.phase = 'release';
    this.beep(330, 0.15);
    this.renderAll();
  }

  // ---------------------------------------------------------------- frames

  private pushFrame(now: number): void {
    const h = handState[this.cfg.hand];
    const i = this.ringHead_;
    this.ringT[i] = now;
    this.ringJoints.set(h.poses, i * JOINT_COUNT * 16);
    this.ringRadii.set(h.radii, i * JOINT_COUNT);
    this.ringHead.set(handState.head, i * 16);
    this.ringFeatures.set(h.features, i * FEATURE_COUNT);
    this.ringHead_ = (i + 1) % RING;
    this.ringCount = Math.min(this.ringCount + 1, RING);

    // Shape motion: mean |Δ| over curls + fingertips, smoothed.
    const f = h.features;
    let sum = 0;
    for (let k = 0; k < 5; k++) {
      const v = f[F.curl + k];
      if (this.hasPrev) sum += Math.abs(v - this.prevShape[k]);
      this.prevShape[k] = v;
    }
    for (let k = 0; k < 15; k++) {
      const v = f[F.tips + k];
      if (this.hasPrev) sum += Math.abs(v - this.prevShape[5 + k]);
      this.prevShape[5 + k] = v;
    }
    const motion = this.hasPrev ? sum / SHAPE_DIMS : 1;
    this.motionEma = this.hasPrev ? this.motionEma * 0.8 + motion * 0.2 : 1;
    this.hasPrev = true;
  }

  private shapeDistance(ref: Float32Array): number {
    let sum = 0;
    for (let k = 0; k < SHAPE_DIMS; k++) sum += Math.abs(this.prevShape[k] - ref[k]);
    return sum / SHAPE_DIMS;
  }

  private collect(fromMs: number, toMs: number): RecordedFrame[] {
    const frames: RecordedFrame[] = [];
    const start = (this.ringHead_ - this.ringCount + RING) % RING;
    let t0 = -1;
    for (let n = 0; n < this.ringCount; n++) {
      const i = (start + n) % RING;
      const t = this.ringT[i];
      if (t < fromMs || t > toMs) continue;
      if (t0 < 0) t0 = t;
      const j = this.ringJoints.subarray(i * JOINT_COUNT * 16, (i + 1) * JOINT_COUNT * 16);
      const r = this.ringRadii.subarray(i * JOINT_COUNT, (i + 1) * JOINT_COUNT);
      const hd = this.ringHead.subarray(i * 16, (i + 1) * 16);
      const ft = this.ringFeatures.subarray(i * FEATURE_COUNT, (i + 1) * FEATURE_COUNT);
      frames.push({
        t: Math.round((t - t0) * 10) / 10,
        joints: Array.from(j, round5),
        radii: Array.from(r, round5),
        head: Array.from(hd, round5),
        features: Array.from(ft, round5),
      });
    }
    return frames;
  }

  // ---------------------------------------------------------------- saving

  private async capture(fromMs: number, toMs: number): Promise<void> {
    const letter = this.currentLetter();
    if (!letter) return;
    this.phase = 'saving';
    this.capturedShape.set(this.prevShape);
    const frames = this.collect(fromMs, toMs);
    const take: RecordingTake = {
      schema: RECORDING_SCHEMA,
      sessionId: this.sessionId,
      kind: letter.kind,
      label: letter.label,
      hand: this.cfg.hand,
      take: this.take,
      motion: letter.motion,
      recordedAt: new Date().toISOString(),
      durationMs: frames.length ? frames[frames.length - 1].t : 0,
      fps: handState.fps,
      userAgent: navigator.userAgent,
      gate: {
        pass: this.gate.pass,
        problems: [...this.gate.problems],
        consistent: this.consistent,
        override: !(this.gate.pass && this.consistent),
      },
      frames,
    };
    this.beep(880, 0.08);
    try {
      if (frames.length < 5) throw new Error(`only ${frames.length} frames captured`);
      await this.storageReady;
      const saved = await this.saveTake(take);
      this.savedFiles.push(saved);
      const shapes = this.takeShapes.get(letter.label) ?? [];
      shapes.push(Float32Array.from(this.capturedShape));
      this.takeShapes.set(letter.label, shapes);
      this.lastShapeLabel.push(letter.label);
      this.savedCount++;
      this.storedTotal++;
      this.lastError = '';
      this.beep(1320, 0.12, 0.09);
      this.advanceTake();
    } catch (err) {
      this.failedCount++;
      this.lastError = `Not saved: ${err instanceof Error ? err.message : String(err)}`;
      this.beep(220, 0.25);
    }
    // Only move on if nothing (pause, skip, hand toggle) changed the phase meanwhile.
    if (this.phase === 'saving') this.phase = 'release';
    this.steadyS = 0;
    this.renderAll();
  }

  /** Saves one take where it can, falling back to the headset if the laptop disappears. */
  private async saveTake(take: RecordingTake): Promise<SavedTake> {
    if (this.storage === 'laptop') {
      let res: Response;
      try {
        res = await fetch('/api/recordings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(take),
        });
      } catch {
        // Network failure (Wi-Fi drop, server stopped): keep the take in the headset.
        await this.useHeadsetStorage();
        return this.saveTake(take);
      }
      const body = (await res.json()) as { ok: boolean; file?: string; error?: string };
      if (!res.ok || !body.ok || !body.file) throw new Error(body.error ?? `HTTP ${res.status}`);
      return { file: body.file, where: 'laptop' };
    }
    // Same validation and file naming the dev server uses, so the import is lossless.
    const error = validateTake(take);
    if (error) throw new Error(error);
    const file = takeFileName(take, Date.now());
    await putTake(file, take);
    return { file, where: 'headset' };
  }

  /** The laptop's recordings API if it answers, otherwise this browser's storage. */
  private async detectStorage(): Promise<void> {
    try {
      const res = await fetch('/api/recordings/summary');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { total?: unknown };
      if (typeof body.total !== 'number') throw new Error('not the recordings API');
      this.storage = 'laptop';
      this.storedTotal = body.total;
    } catch {
      await this.useHeadsetStorage();
    }
    this.renderAll();
  }

  private async useHeadsetStorage(): Promise<void> {
    this.storage = 'headset';
    void requestPersistentStorage();
    try {
      this.storedTotal = await countTakes();
    } catch (err) {
      this.storedTotal = 0;
      this.lastError = `Headset storage unavailable: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  // ---------------------------------------------------------------- output

  private placePanels(): void {
    this.needsPlacement = false;
    const m = handState.head;
    const hx = m[12], hy = m[13], hz = m[14];
    let fx = -m[8], fz = -m[10];
    const len = Math.hypot(fx, fz) || 1;
    fx /= len;
    fz /= len;
    // Recorder ~31° wide at 1 m, slightly below eye level, behind where the hand is held.
    this.place('recorder-panel', hx + fx * 1.0, hy - 0.15, hz + fz * 1.0, hx, hz);
    const a = (55 * Math.PI) / 180; // dev probe panel well to the left, out of the main view
    const px = fx * Math.cos(a) + fz * Math.sin(a);
    const pz = -fx * Math.sin(a) + fz * Math.cos(a);
    this.place('probe-panel', hx + px * 1.25, hy - 0.05, hz + pz * 1.25, hx, hz);
  }

  private place(id: string, x: number, y: number, z: number, lookX: number, lookZ: number): void {
    const obj = this.world.getSceneEntity(id)?.object3D;
    if (!obj) return;
    obj.position.set(x, y, z);
    const yaw = Math.atan2(lookX - x, lookZ - z);
    this.tmpQuat.setFromAxisAngle(this.yAxis, yaw);
    obj.quaternion.copy(this.tmpQuat);
    this.tmpPos.set(x, y, z);
  }

  private setText(id: string, props: Record<string, unknown>): void {
    this.text[id]?.setProperties(props);
  }

  private status(text: string, color: keyof typeof STATUS_COLORS): void {
    this.setText('status', { text, backgroundColor: STATUS_COLORS[color] });
  }

  private renderAll(): void {
    const letter = this.currentLetter();
    const total = this.cfg.items.length;
    if (letter) {
      const n = letter.label.length;
      this.setText('letter', {
        text: letter.label,
        fontSize: n === 1 ? 120 : n <= 4 ? 60 : n <= 8 ? 36 : 26,
      });
      this.setText('shape', { text: letter.shape });
      this.setText('meta', { text: letter.meta });
      this.setText('take', {
        text: `Take ${this.take} of ${this.cfg.takes} | item ${this.letterIdx + 1} of ${total} | ${this.cfg.hand} hand`,
      });
    } else {
      this.setText('letter', { text: 'OK', fontSize: 120 });
      this.setText('shape', { text: 'All letters recorded for this session. Thank you!' });
      this.setText('meta', {
        text:
          this.storage === 'headset'
            ? 'Takes are stored in this headset. Exit XR and press "Download takes" on the page.'
            : 'Reload the page to start another session.',
      });
      this.setText('take', { text: `${this.savedCount} takes saved this session` });
    }

    const visible = this.world.visibilityState.peek() === VisibilityState.Visible;
    const h = handState[this.cfg.hand];
    const need = letter?.motion ? MOTION_LEAD_S : HOLD_S;
    let bar = 0;
    if (!visible) {
      this.status('Enter XR to start', 'idle');
    } else {
      switch (this.phase) {
        case 'paused':
          this.status('Paused - press Pause to continue', 'idle');
          break;
        case 'done':
          this.status('Session complete', 'ok');
          bar = 1;
          break;
        case 'saving':
          this.status('Captured - saving...', 'ok');
          bar = 1;
          break;
        case 'recording':
          this.status(letter?.kind === 'word' ? 'Recording - spell the word now' : 'Recording movement - draw the letter now', 'rec');
          bar = Math.min(1, (handState.time - this.recordStart) / (letter?.durationMs ?? MOTION_MS));
          break;
        case 'release':
          this.status(this.lastError || 'Saved. Relax your hand, then form it again', this.lastError ? 'warn' : 'ok');
          bar = 1;
          break;
        default:
          if (!h.tracked) this.status(`Show your ${this.cfg.hand} hand`, 'idle');
          else if (this.phase === 'holding' && this.gateMessage) {
            this.status(`${this.gateMessage} (or hold 3 s to record anyway)`, 'warn');
            bar = Math.min(1, this.steadyS / OVERRIDE_S);
            break;
          } else if (this.phase === 'holding') this.status('Hold still...', 'hold');
          else this.status(letter?.motion ? 'Form the start shape and hold' : 'Form the letter and hold still', 'idle');
          bar = Math.min(1, this.steadyS / need);
      }
    }
    this.setText('hold-bar', { width: `${Math.round(bar * 100)}%` });
    this.setText('btn-hand-label', { text: `Hand: ${this.cfg.hand}` });
    this.setText('saved', {
      text: `${this.savedCount} saved this session${this.failedCount ? ` | ${this.failedCount} failed` : ''} | steadiness ${this.motionEma.toFixed(3)} (need < ${this.cfg.stable})`,
    });
    this.setText('connection', {
      text:
        this.storage === null
          ? 'Checking connection to the laptop...'
          : this.storage === 'laptop'
            ? `Connected to laptop | ${this.storedTotal} takes on disk | session ${this.sessionId}`
            : `Saving in this headset | ${this.storedTotal} takes stored | exit XR to download them`,
    });
  }

  private ensureAudio(): void {
    if (this.audio) return;
    try {
      this.audio = new AudioContext();
    } catch {
      this.audio = null;
    }
  }

  private beep(freq: number, dur: number, delay = 0): void {
    const ctx = this.audio;
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.15, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
}

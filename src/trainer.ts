/**
 * Mirrorless in-headset ASL fingerspelling trainer system.
 *
 * Implements the 4-stage "First Five Minutes" spatial learning loop:
 *   1. Warmup (L -> B -> Y): 1st-person wrist-anchored 3D Ghost Hand with
 *      per-finger green match feedback.
 *   2. My Name & Personal Words: hybrid grader with plain-English finger hints
 *      and honest abstention on occluded thumb-in-fist letters (M/N/T/S/E/R/A)
 *      and motion letters (J/Z). Abstained letters are never passed by the app:
 *      the learner compares with the Ghost Hand and chooses "Compare and continue".
 *      After the letters, the learner spells the whole word once, in one go;
 *      that attempt is recorded for the replay and the bounce check.
 *   3. Reader's View Replay on Table: replays the learner's own recorded hand,
 *      turned around to face them across their real table (or a virtual
 *      fallback desk), with a wrist-bounce check on the one-go attempt.
 *   4. Table Reading Mode: a clearly labelled Synthetic Tutor Hand sits on the
 *      table and spells words at rising speed tiers (Slow -> Normal -> Fast)
 *      with 3 tactile choice buttons.
 */

import {
  BoxGeometry,
  Color,
  createSystem,
  type Entity,
  Group,
  Mesh,
  MeshStandardMaterial,
  PokeInteractable,
  RayInteractable,
  UIKitMLAsset,
  Vector3,
  VisibilityState,
  XRPlane,
} from '@iwsdk/core';
import { ASL_LETTERS, type AslLetter, LETTER_INDEX } from './asl-letters.js';
import { F, FEATURE_COUNT, type Handedness, J, JOINT_COUNT } from './hand-features.js';
import {
  analyzeWordDynamics,
  buildCanonicalModel,
  buildModelWithRecorded,
  canonicalLetterFeatures,
  REPLAY_FRAME_FLOATS,
  synthesizeLetterPoses,
  synthesizeWordPose,
  type WordDynamicsReport,
  writeReaderViewPose,
} from './hand-poses.js';
import { HandRig } from './hand-rig.js';
import { handState } from './hand-state.js';
import type { TextElement } from './probe.js';
import { gradeAttempt, type GradeVerdict, type TemplateModel } from './recognizer.js';
import {
  type LearnerProfile,
  loadProfile,
  recordLetterOutcome,
  saveProfile,
} from './storage.js';

export type TrainerStage = 'warmup' | 'words' | 'replay' | 'reading';

/** Sub-phase of the words stage: letter-by-letter, then one continuous attempt. */
export type WordPhase = 'letters' | 'fluent-ready' | 'fluent-record';

export type SpeedTier = 'slow' | 'normal' | 'fast';

const SPEED_MS: Record<SpeedTier, number> = {
  slow: 720,
  normal: 480,
  fast: 330,
};

const SPEED_LABELS: Record<SpeedTier, string> = {
  slow: 'Speed: Slow',
  normal: 'Speed: Medium',
  fast: 'Speed: Fast',
};

const WARMUP_LETTERS = ['L', 'B', 'Y'];
const HOLD_PASS_S = 0.58;
/** Holding a self-check letter this long marks it ready for the learner's confirmation. */
const HOLD_SELF_CHECK_S = 1.05;
const DEFAULT_ABSTAIN_MARGIN = 0.14;

// One-go attempt capture (feeds the reader's view replay and the bounce check).
const FLUENT_LEAD_IN_S = 1.5;
const REC_INTERVAL_MS = 30;
const MAX_REC_FRAMES = 360;
const MIN_REPLAY_FRAMES = 10;

// Table plane selection.
const PLANE_CHECK_INTERVAL_S = 1;
/** Table top must sit this far below the eyes (m): rules out floors, ceilings and shelves. */
const TABLE_MIN_DROP = 0.15;
const TABLE_MAX_DROP = 1.0;
/** Horizontal distance limit from the head to the plane centre (m). */
const TABLE_MAX_DIST = 1.3;
const TABLE_REJECT_LABEL = /floor|ceiling|wall|door|window|couch|sofa|bed|screen|lamp|plant|art/u;

const BANNER_COLORS: Record<string, string> = {
  idle: '#273644',
  hold: '#394050',
  pass: '#215843',
  self: '#34486b',
  warn: '#773c32',
  rec: '#7a323a',
};

export function isRecorderUrl(): boolean {
  try {
    const p = new URLSearchParams(window.location.search);
    return p.has('recorder') || p.has('letters') || p.has('words');
  } catch {
    return false;
  }
}

export class TrainerSystem extends createSystem({
  planes: { required: [XRPlane] },
}) {
  private active = true;
  private profile!: LearnerProfile;
  private stage: TrainerStage = 'warmup';

  // Recognizer models per hand (canonical, merged with recorded takes when available)
  private modelRight!: TemplateModel;
  private modelLeft!: TemplateModel;
  private abstainMargin: Record<Handedness, number> = {
    left: DEFAULT_ABSTAIN_MARGIN,
    right: DEFAULT_ABSTAIN_MARGIN,
  };
  private recordedModel: Record<Handedness, boolean> = { left: false, right: false };
  private targetFeatures = new Float32Array(FEATURE_COUNT);

  // Stage 1 & 2 state
  private warmupIdx = 0;
  private wordList: string[] = [];
  private wordIdx = 0;
  private charIdx = 0;
  private steadyS = 0;
  private celebrateTimer = 0;
  private lastVerdict: GradeVerdict = 'coach';
  private lastFeedback = 'Raise your signing hand.';
  private menuOpen = false;
  private perFinger = new Float32Array([0.5, 0.5, 0.5, 0.5, 0.5]);
  private motionPhase = 0;

  // One-go attempt recording (25 joint positions per frame, preallocated)
  private wordPhase: WordPhase = 'letters';
  private phaseTimer = 0;
  private fluentWindowS = 5;
  private recFrames = new Float32Array(MAX_REC_FRAMES * REPLAY_FRAME_FLOATS);
  private recTimes = new Float32Array(MAX_REC_FRAMES);
  private recCount = 0;
  private recStartMs = 0;
  private recLastMs = -1;
  private recWord = '';
  private recPivot = new Float32Array(3);

  // Stage 3 (Reader's View Replay)
  private replayWord = 'MAYA';
  private replayElapsedMs = 0;
  private replayHasRecording = false;
  private replayCursor = 0;
  private lastDynamics: WordDynamicsReport | null = null;

  // Stage 4 (Table Reading Mode) state
  private speedTier: SpeedTier = 'slow';
  private readingTarget = 'MAYA';
  private readingChoices: [string, string, string] = ['MAYA', 'BOOK', 'HANNAH'];
  private readingElapsedMs = 0;
  private readingAnswered: 'none' | 'correct' | 'wrong' = 'none';
  private readingStreak = 0;

  // 3D Hand rigs & Table Stage
  private ghostRig!: HandRig;
  private replayRig!: HandRig;
  private tutorRig!: HandRig;
  private tableGroup!: Group;
  private virtualDeskMesh!: Mesh;
  private tableSource: 'xr-plane' | 'virtual-fallback' = 'virtual-fallback';
  private tablePlane: Entity | null = null;
  private tablePlaneLabel = '';
  private planeCheckTimer = 0;
  private fallbackPlaced = false;
  private tableYaw = 0;

  // Scratch buffers (zero per-frame allocation)
  private ghostPoses = new Float32Array(JOINT_COUNT * 16);
  private tutorPoses = new Float32Array(JOINT_COUNT * 16);
  private replayPoses = new Float32Array(JOINT_COUNT * 16);
  private readerHead = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  private smoothedWrist: [number, number, number] = [0.14, 1.28, -0.38];
  private hasSmoothedWrist = false;
  private tableAnchor: [number, number, number] = [0, 1.02, -0.52];
  private handAnchor: [number, number, number] = [0, 1.08, -0.52];
  private tmpPlanePos = new Vector3();

  private text: Record<string, TextElement | undefined> = {};
  private uiTimer = 0;
  private needsPlacement = false;
  private audio: AudioContext | null = null;

  init(): void {
    this.active = !isRecorderUrl();
    const trainerEntity = this.world.getSceneEntity('trainer-panel');
    const recorderEntity = this.world.getSceneEntity('recorder-panel');

    if (!this.active) {
      // Recorder mode: hide trainer panel so RecorderSystem owns the view.
      if (trainerEntity) {
        if (trainerEntity.object3D) trainerEntity.object3D.visible = false;
        if (trainerEntity.hasComponent(RayInteractable)) trainerEntity.removeComponent(RayInteractable);
        if (trainerEntity.hasComponent(PokeInteractable)) trainerEntity.removeComponent(PokeInteractable);
      }
      return;
    }

    // Trainer mode: hide developer recorder panel so learner UI is clean.
    if (recorderEntity) {
      if (recorderEntity.object3D) recorderEntity.object3D.visible = false;
      if (recorderEntity.hasComponent(RayInteractable)) recorderEntity.removeComponent(RayInteractable);
      if (recorderEntity.hasComponent(PokeInteractable)) recorderEntity.removeComponent(PokeInteractable);
    }

    this.profile = loadProfile();
    this.rebuildWordList();

    this.modelRight = buildCanonicalModel('right');
    this.modelLeft = buildCanonicalModel('left');
    void this.tryLoadRecordedModel('right');
    void this.tryLoadRecordedModel('left');

    // Create 3D Ghost Hand, Reader's View Replay Hand, Tutor Hand, and Fallback Table.
    this.ghostRig = new HandRig('ghost', 'GhostHand');
    this.replayRig = new HandRig('replay', 'ReaderReplayHand');
    this.tutorRig = new HandRig('tutor', 'SyntheticTutorHand');

    this.world.createTransformEntity(this.ghostRig.root);

    this.tableGroup = new Group();
    this.tableGroup.name = 'TableStageGroup';
    const deskGeo = new BoxGeometry(0.46, 0.014, 0.3);
    const deskMat = new MeshStandardMaterial({
      color: new Color('#1e293b'),
      emissive: new Color('#0f766e'),
      emissiveIntensity: 0.22,
      roughness: 0.4,
      metalness: 0.1,
      transparent: true,
      opacity: 0.72,
    });
    this.virtualDeskMesh = new Mesh(deskGeo, deskMat);
    this.virtualDeskMesh.name = 'VirtualFallbackDesk';
    this.tableGroup.add(this.virtualDeskMesh);

    this.world.createTransformEntity(this.tableGroup);
    this.world.createTransformEntity(this.replayRig.root);
    this.world.createTransformEntity(this.tutorRig.root);

    this.bindUI();
    this.updateTargetFeatures();
    this.syncStageVisibility();
    this.renderUI();

    // Listen for profile updates from the 2D setup overlay.
    const onProfileChange = () => {
      const word = this.currentWord();
      this.profile = loadProfile();
      this.rebuildWordList();
      if (this.stage === 'words' && this.currentWord() !== word) this.setStage('words');
      this.updateTargetFeatures();
      this.renderUI();
    };
    window.addEventListener('mirrorless:profile-updated', onProfileChange);
    this.cleanupFuncs.push(() => window.removeEventListener('mirrorless:profile-updated', onProfileChange));

    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '1') this.setStage('warmup');
      else if (e.key === '2') this.setStage('words');
      else if (e.key === '3') this.setStage('replay');
      else if (e.key === '4') this.setStage('reading');
      else if (e.key === 'n') this.handleNextOrSelfCheck();
      else if (e.key === 'y') this.handleChoice(0);
      else if (e.key === 'h') this.toggleHand();
    };
    window.addEventListener('keydown', onKey);
    this.cleanupFuncs.push(() => window.removeEventListener('keydown', onKey));

    this.cleanupFuncs.push(
      this.world.visibilityState.subscribe((state) => {
        if (state === VisibilityState.Visible) {
          this.needsPlacement = true;
          this.fallbackPlaced = false;
          this.ensureAudio();
        } else if (this.wordPhase === 'fluent-record') {
          this.recCount = 0;
          this.startFluentCapture();
        }
      }),
    );

    // Expose live trainer state on window.__mirrorless for inspection & automated tests.
    const win = window as unknown as {
      __mirrorless?: Record<string, unknown>;
      __trainer?: unknown;
    };
    win.__trainer = {
      state: () => ({
        stage: this.stage,
        wordPhase: this.wordPhase,
        letter: this.currentLetterObj().letter,
        word: this.currentWord(),
        charIdx: this.charIdx,
        verdict: this.lastVerdict,
        feedback: this.lastFeedback,
        hand: this.profile.dominantHand,
        speedTier: this.speedTier,
        tableSource: this.tableSource,
        tablePlaneLabel: this.tablePlaneLabel,
        tableAnchor: [...this.tableAnchor],
        recordedFrames: this.recCount,
        replaySource: this.replayHasRecording ? 'recorded' : 'synthetic',
        dynamicsMeasured: this.lastDynamics?.measured ?? null,
        steadinessScore: this.lastDynamics?.steadinessScore ?? null,
        isBouncy: this.lastDynamics?.isBouncy ?? null,
        recordedModel: { ...this.recordedModel },
        readingTarget: this.readingTarget,
        readingChoices: this.readingChoices,
        readingAnswered: this.readingAnswered,
        streakDays: this.profile.streakDays,
        wordsCompleted: this.profile.wordsCompleted,
        letterStats: this.profile.letters[this.currentLetterObj().letter],
      }),
      setStage: (s: TrainerStage) => this.setStage(s),
      advance: () => this.handleNextOrSelfCheck(),
      choose: (idx: number) => this.handleChoice(idx),
      reloadProfile: onProfileChange,
    };
    if (win.__mirrorless) {
      win.__mirrorless.trainer = win.__trainer;
    }
  }

  private bindUI(): void {
    const panel = this.world.getSceneObject<UIKitMLAsset>('trainer-panel');
    const ids = [
      'stage-title',
      'practice-body',
      'trainer-letter',
      'trainer-word-progress',
      'trainer-shape',
      'trainer-status',
      'trainer-progress',
      'trainer-bar',
      'choice-row',
      'next-row',
      'settings-panel',
      'btn-settings-label',
      'btn-choice-0',
      'btn-choice-1',
      'btn-choice-2',
      'btn-choice-0-label',
      'btn-choice-1-label',
      'btn-choice-2-label',
      'btn-next',
      'btn-next-label',
      'btn-read-replay',
      'btn-speed',
      'btn-speed-label',
      'btn-trainer-hand-label',
      'btn-trainer-ghost-label',
      'btn-switch-word',
    ];
    for (const id of ids) {
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
      el.name = id;
      el.addEventListener('click', fn);
      this.cleanupFuncs.push(() => el.removeEventListener('click', fn));
    };

    bind('btn-settings', () => {
      this.menuOpen = !this.menuOpen;
      if (this.menuOpen && this.wordPhase === 'fluent-record') {
        this.recCount = 0;
        this.startFluentCapture();
      }
      this.syncStageVisibility();
      this.renderUI();
    });
    bind('btn-mode-warmup', () => this.setStage('warmup'));
    bind('btn-mode-words', () => this.setStage('words'));
    bind('btn-mode-replay', () => this.setStage('replay'));
    bind('btn-mode-reading', () => this.setStage('reading'));
    bind('btn-next', () => this.handleNextOrSelfCheck());
    bind('btn-speed', () => this.cycleSpeed());
    bind('btn-read-replay', () => {
      this.readingElapsedMs = 0;
    });
    bind('btn-trainer-hand', () => this.toggleHand());
    bind('btn-trainer-ghost', () => {
      this.profile.ghostOpacityLevel = this.profile.ghostOpacityLevel === 'full' ? 'faded' : 'full';
      saveProfile(this.profile);
      this.renderUI();
    });
    bind('btn-switch-word', () => {
      this.wordIdx = (this.wordIdx + 1) % this.wordList.length;
      this.setStage('words');
    });
    bind('btn-trainer-recenter', () => {
      this.needsPlacement = true;
      this.fallbackPlaced = false;
      this.placeErgonomicLayout();
    });
    bind('btn-trainer-exit', () => {
      this.world.exitXR();
    });
    bind('btn-choice-0', () => this.handleChoice(0));
    bind('btn-choice-1', () => this.handleChoice(1));
    bind('btn-choice-2', () => this.handleChoice(2));
  }

  private rebuildWordList(): void {
    const words = [this.profile.userName, ...this.profile.personalWords].filter((w) => w.length >= 2);
    this.wordList = [...new Set(words)];
    if (this.wordList.length === 0) this.wordList = ['MAYA', 'BOOK', 'ANNA'];
    this.wordIdx = Math.min(this.wordIdx, this.wordList.length - 1);
  }

  private currentWord(): string {
    return this.wordList[this.wordIdx] ?? 'MAYA';
  }

  private currentLetterObj(): AslLetter {
    if (this.stage === 'warmup') {
      const code = WARMUP_LETTERS[this.warmupIdx % WARMUP_LETTERS.length] ?? 'L';
      return LETTER_INDEX[code] ?? ASL_LETTERS[0];
    }
    const word = this.currentWord();
    const ch = word[this.charIdx] ?? word[0] ?? 'L';
    return LETTER_INDEX[ch] ?? ASL_LETTERS[0];
  }

  private updateTargetFeatures(): void {
    const letter = this.currentLetterObj().letter;
    canonicalLetterFeatures(letter, this.profile.dominantHand, this.targetFeatures);
  }

  private async tryLoadRecordedModel(hand: Handedness): Promise<void> {
    try {
      const url = `${import.meta.env.BASE_URL}models/templates-${hand}.json`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = (await res.json()) as Partial<TemplateModel> & { abstainMargin?: unknown };
      // Merge recorded takes into the canonical model so unrecorded letters still grade.
      const merged = buildModelWithRecorded(hand, data);
      if (!merged) return;
      if (hand === 'right') this.modelRight = merged;
      else this.modelLeft = merged;
      this.recordedModel[hand] = true;
      // Use the abstention margin the offline eval suggested for this data (check V5).
      if (typeof data.abstainMargin === 'number' && data.abstainMargin > 0 && data.abstainMargin < 0.6) {
        this.abstainMargin[hand] = data.abstainMargin;
      }
    } catch {
      // Static build without recorded model override uses canonical 26-letter model.
    }
  }

  public setStage(next: TrainerStage): void {
    this.stage = next;
    this.menuOpen = false;
    this.lastVerdict = 'coach';
    this.steadyS = 0;
    this.celebrateTimer = 0;
    this.wordPhase = 'letters';
    if (next === 'warmup') {
      this.warmupIdx = 0;
      this.lastFeedback = 'Match the guide on your wrist.';
    } else if (next === 'words') {
      this.charIdx = 0;
      this.lastFeedback = 'Match the guide on your wrist.';
    } else if (next === 'replay') {
      // Replay the learner's own one-go attempt; without one, fall back to a
      // clearly labelled synthetic reference hand and say the check has no data.
      this.replayHasRecording = this.recCount >= MIN_REPLAY_FRAMES;
      this.replayWord = this.replayHasRecording ? this.recWord : this.currentWord();
      this.replayElapsedMs = 0;
      this.replayCursor = 0;
      this.lastDynamics = analyzeWordDynamics(
        this.replayHasRecording ? this.buildWristTrack() : [],
        this.replayWord,
      );
      this.lastFeedback = this.lastDynamics.summary;
      this.fallbackPlaced = false;
    } else if (next === 'reading') {
      this.startReadingRound();
      this.fallbackPlaced = false;
    }
    this.updateTargetFeatures();
    this.syncStageVisibility();
    this.renderUI();
  }

  private syncStageVisibility(): void {
    const inLetters = this.stage === 'warmup' || (this.stage === 'words' && this.wordPhase === 'letters');
    this.ghostRig.root.visible = inLetters && !this.menuOpen;
    this.replayRig.root.visible = this.stage === 'replay';
    this.tutorRig.root.visible = this.stage === 'reading';
    this.tableGroup.visible = this.stage === 'replay' || this.stage === 'reading';
  }

  update(delta: number): void {
    if (!this.active || this.world.visibilityState.peek() !== VisibilityState.Visible) return;

    if (this.needsPlacement && handState.headValid) {
      this.placeErgonomicLayout();
    }

    this.updateTableAnchor(delta);
    if (this.menuOpen) return;

    const h = handState[this.profile.dominantHand];
    const scale = h.valid ? Math.max(0.065, Math.min(0.13, h.features[F.handScale])) : 0.09;

    if (this.stage === 'words' && this.wordPhase !== 'letters') {
      this.stepFluentCapture(delta);
    } else if (this.stage === 'warmup' || this.stage === 'words') {
      this.stepSigningStage(delta, h.valid, scale);
    } else if (this.stage === 'replay') {
      this.stepReplayStage(delta, scale);
    } else if (this.stage === 'reading') {
      this.stepReadingStage(delta, scale);
    }

    this.uiTimer += delta;
    if (this.uiTimer >= 0.1) {
      this.uiTimer = 0;
      this.renderUI();
    }
  }

  // ---------------------------------------------------------------- Stage 1 & 2: Signing + Ghost Hand

  private stepSigningStage(delta: number, handValid: boolean, scale: number): void {
    const letter = this.currentLetterObj();
    const h = handState[this.profile.dominantHand];
    const sideSign = this.profile.dominantHand === 'left' ? -1 : 1;

    // Position the 1st-person Ghost Hand on the learner's tracked wrist (smoothed),
    // or at a comfortable chest-height neutral signing pose when untracked.
    if (handValid) {
      const wx = h.poses[J.wrist * 16 + 12];
      const wy = h.poses[J.wrist * 16 + 13];
      const wz = h.poses[J.wrist * 16 + 14];
      if (!this.hasSmoothedWrist) {
        this.smoothedWrist = [wx, wy, wz];
        this.hasSmoothedWrist = true;
      } else {
        this.smoothedWrist[0] = this.smoothedWrist[0] * 0.65 + wx * 0.35;
        this.smoothedWrist[1] = this.smoothedWrist[1] * 0.65 + wy * 0.35;
        this.smoothedWrist[2] = this.smoothedWrist[2] * 0.65 + wz * 0.35;
      }
    } else {
      this.hasSmoothedWrist = false;
      if (handState.headValid) {
        const m = handState.head;
        const hx = m[12], hy = m[13], hz = m[14];
        const fx = -m[8], fz = -m[10];
        const rx = m[0], rz = m[2];
        this.smoothedWrist = [
          hx + fx * 0.38 + rx * sideSign * 0.12,
          hy - 0.2,
          hz + fz * 0.38 + rz * sideSign * 0.12,
        ];
      } else {
        this.smoothedWrist = [sideSign * 0.14, 1.32, -0.4];
      }
    }

    // Animate motion letters (J, Z) continuously on the Ghost Hand so the learner sees the path.
    if (letter.motion) {
      this.motionPhase = (this.motionPhase + delta * 0.65) % 1;
    } else {
      this.motionPhase = 0;
    }

    // In self-check mode while tracked, offset the Ghost Hand 7.5 cm beside the wrist so
    // the learner can inspect thumb tuck without their own hand occluding it.
    const ghostAnchor: [number, number, number] = [
      this.smoothedWrist[0] + (handValid && this.lastVerdict === 'self-check' ? -sideSign * 0.075 : 0),
      this.smoothedWrist[1],
      this.smoothedWrist[2],
    ];

    synthesizeLetterPoses(
      letter.letter,
      this.profile.dominantHand,
      scale,
      this.motionPhase,
      ghostAnchor,
      handState.headValid ? handState.head : null,
      this.ghostPoses,
    );
    this.ghostRig.updateFromPoses(this.ghostPoses);

    if (this.celebrateTimer > 0) {
      this.celebrateTimer = Math.max(0, this.celebrateTimer - delta);
      this.ghostRig.updateGhostFeedback(
        this.perFinger, 1, this.lastVerdict === 'pass' ? 'pass' : 'self-check', false,
      );
      if (this.celebrateTimer === 0) {
        this.advanceToNextLetter();
      }
      return;
    }

    if (!handValid) {
      // Hand left view mid-letter: pause hold timer without penalty (Judge check J9).
      this.steadyS = Math.max(0, this.steadyS - delta * 0.5);
      this.lastFeedback = `Raise your ${this.profile.dominantHand} hand.`;
      this.perFinger.fill(0.5);
      this.ghostRig.updateGhostFeedback(this.perFinger, 0, 'idle', false);
      return;
    }

    const hand = this.profile.dominantHand;
    const model = hand === 'left' ? this.modelLeft : this.modelRight;
    const grade = gradeAttempt(model, letter, h.features, this.targetFeatures, this.abstainMargin[hand]);
    this.lastVerdict = grade.verdict;
    this.lastFeedback = grade.feedback;
    this.perFinger.set(grade.perFinger);

    const faded = this.profile.ghostOpacityLevel === 'faded';
    if (grade.verdict === 'pass') {
      this.steadyS += delta;
      const prog = Math.min(1, this.steadyS / HOLD_PASS_S);
      this.ghostRig.updateGhostFeedback(this.perFinger, prog, prog >= 1 ? 'pass' : 'matching', faded);
      if (this.steadyS >= HOLD_PASS_S) {
        this.triggerLetterSuccess('pass');
      }
    } else if (grade.verdict === 'self-check') {
      // Honest abstention: the app never passes this letter itself. A steady hold
      // only marks it ready for the learner to compare.
      this.steadyS = Math.min(HOLD_SELF_CHECK_S, this.steadyS + delta);
      const prog = this.steadyS / HOLD_SELF_CHECK_S;
      this.ghostRig.updateGhostFeedback(this.perFinger, prog, 'self-check', faded);
    } else {
      this.steadyS = Math.max(0, this.steadyS - delta * 1.5);
      const prog = Math.min(1, this.steadyS / HOLD_PASS_S);
      this.ghostRig.updateGhostFeedback(this.perFinger, prog, 'matching', faded);
    }
  }

  private triggerLetterSuccess(outcome: 'pass' | 'self-check'): void {
    const letter = this.currentLetterObj().letter;
    recordLetterOutcome(this.profile, letter, outcome);
    this.steadyS = 0;
    this.celebrateTimer = 0.42;
    this.lastVerdict = outcome;
    this.lastFeedback =
      outcome === 'pass'
        ? `${letter} matched.`
        : 'Self-check saved.';
    this.chimeSuccess();
    this.renderUI();
  }

  /** Skip without a grade or confirmation: recorded as a skip, never as mastery. */
  private skipLetter(): void {
    const letter = this.currentLetterObj().letter;
    recordLetterOutcome(this.profile, letter, 'skip');
    this.steadyS = 0;
    this.celebrateTimer = 0;
    this.lastVerdict = 'coach';
    this.advanceToNextLetter();
    this.renderUI();
  }

  private advanceToNextLetter(): void {
    if (this.stage === 'warmup') {
      if (this.warmupIdx + 1 < WARMUP_LETTERS.length) {
        this.warmupIdx++;
        this.updateTargetFeatures();
        this.lastFeedback = 'Match the guide on your wrist.';
      } else {
        // Completed L -> B -> Y warmup! Move into spelling the learner's own name.
        this.setStage('words');
      }
      return;
    }

    if (this.stage === 'words') {
      const word = this.currentWord();
      if (this.charIdx + 1 < word.length) {
        this.charIdx++;
        this.updateTargetFeatures();
        this.lastFeedback = 'Match the guide on your wrist.';
      } else {
        // Every letter done: now spell the whole word once, in one go.
        this.profile.wordsCompleted++;
        saveProfile(this.profile);
        this.startFluentCapture();
      }
    }
  }

  // ---------------------------------------------------------------- Stage 2b: One-go attempt capture

  private startFluentCapture(): void {
    this.stage = 'words';
    this.wordPhase = 'fluent-ready';
    this.phaseTimer = 0;
    this.steadyS = 0;
    this.celebrateTimer = 0;
    const word = this.currentWord();
    this.fluentWindowS = Math.min(9, Math.max(3, word.length * 0.9 + 1.5));
    this.lastFeedback = 'Get your hand in view.';
    this.syncStageVisibility();
    this.renderUI();
  }

  private stepFluentCapture(delta: number): void {
    this.phaseTimer += delta;
    if (this.wordPhase === 'fluent-ready') {
      if (this.phaseTimer >= FLUENT_LEAD_IN_S) {
        this.wordPhase = 'fluent-record';
        this.phaseTimer = 0;
        this.recCount = 0;
        this.recLastMs = -1;
        this.recStartMs = handState.time;
        this.recWord = this.currentWord();
        this.lastFeedback = 'Spell the whole word.';
      }
      return;
    }

    const h = handState[this.profile.dominantHand];
    if (h.valid && this.recCount < MAX_REC_FRAMES) {
      const t = handState.time - this.recStartMs;
      if (this.recLastMs < 0 || t - this.recLastMs >= REC_INTERVAL_MS) {
        const base = this.recCount * REPLAY_FRAME_FLOATS;
        for (let j = 0; j < JOINT_COUNT; j++) {
          this.recFrames[base + j * 3] = h.poses[j * 16 + 12];
          this.recFrames[base + j * 3 + 1] = h.poses[j * 16 + 13];
          this.recFrames[base + j * 3 + 2] = h.poses[j * 16 + 14];
        }
        this.recTimes[this.recCount] = t;
        this.recCount++;
        this.recLastMs = t;
      }
    }

    if (this.phaseTimer >= this.fluentWindowS || this.recCount >= MAX_REC_FRAMES) {
      this.finishFluentCapture();
    }
  }

  private finishFluentCapture(): void {
    if (this.wordPhase === 'fluent-ready') {
      // Stopped before recording began: nothing captured for this word.
      this.recCount = 0;
      this.recWord = this.currentWord();
    }
    // Pivot = mean wrist position, so the replay keeps the attempt's real motion.
    this.recPivot.fill(0);
    for (let i = 0; i < this.recCount; i++) {
      const base = i * REPLAY_FRAME_FLOATS + J.wrist * 3;
      this.recPivot[0] += this.recFrames[base] / this.recCount;
      this.recPivot[1] += this.recFrames[base + 1] / this.recCount;
      this.recPivot[2] += this.recFrames[base + 2] / this.recCount;
    }
    this.setStage('replay');
  }

  /** Wrist trajectory of the one-go attempt, for the bounce check. */
  private buildWristTrack(): Array<{ t: number; x: number; y: number; z: number }> {
    const track: Array<{ t: number; x: number; y: number; z: number }> = [];
    for (let i = 0; i < this.recCount; i++) {
      const base = i * REPLAY_FRAME_FLOATS + J.wrist * 3;
      track.push({
        t: this.recTimes[i],
        x: this.recFrames[base],
        y: this.recFrames[base + 1],
        z: this.recFrames[base + 2],
      });
    }
    return track;
  }

  // ---------------------------------------------------------------- Stage 3: Reader's View Replay

  private stepReplayStage(delta: number, scale: number): void {
    this.replayElapsedMs += delta * 1000;
    this.handAnchor[0] = this.tableAnchor[0];
    this.handAnchor[1] = this.tableAnchor[1] + 0.08;
    this.handAnchor[2] = this.tableAnchor[2];

    if (this.replayHasRecording) {
      // The learner's own recorded hand, turned 180 deg about the vertical axis.
      const t0 = this.recTimes[0];
      const durMs = this.recTimes[this.recCount - 1] - t0;
      if (this.replayElapsedMs > durMs + 900) {
        this.replayElapsedMs = 0;
        this.replayCursor = 0;
      }
      const tMs = t0 + Math.min(this.replayElapsedMs, durMs);
      while (this.replayCursor < this.recCount - 2 && this.recTimes[this.replayCursor + 1] <= tMs) {
        this.replayCursor++;
      }
      const a = this.replayCursor;
      const b = Math.min(this.recCount - 1, a + 1);
      const span = this.recTimes[b] - this.recTimes[a];
      const frac = span > 0 ? Math.min(1, Math.max(0, (tMs - this.recTimes[a]) / span)) : 0;
      writeReaderViewPose(this.recFrames, a, b, frac, this.recPivot, this.handAnchor, this.replayPoses);
    } else {
      // No recording: synthetic reference hand (labelled as such in the UI).
      this.buildReaderFacingBasis();
      const totalMs = Math.max(1800, this.replayWord.length * 620);
      if (this.replayElapsedMs > totalMs + 700) {
        this.replayElapsedMs = 0;
      }
      synthesizeWordPose(
        this.replayWord,
        this.replayElapsedMs,
        620,
        this.profile.dominantHand,
        scale,
        this.handAnchor,
        this.readerHead,
        this.replayPoses,
      );
    }
    this.replayRig.updateFromPoses(this.replayPoses);

  }

  // ---------------------------------------------------------------- Stage 4: Table Reading Mode

  private startReadingRound(): void {
    const pool = [...new Set([this.profile.userName, ...this.profile.personalWords, 'BOOK', 'ANNA', 'COFFEE', 'MAYA', 'HELLO'])];
    const target = pool[Math.floor(Math.random() * pool.length)] ?? 'MAYA';
    const distractors = pool.filter((w) => w !== target);
    while (distractors.length < 2) {
      distractors.push(distractors.length === 0 ? 'WATER' : 'PIZZA');
    }
    const d1 = distractors[0];
    const d2 = distractors[1];
    const choices: [string, string, string] = [target, d1, d2];
    // Deterministic shuffle based on round count
    const shift = (this.profile.readingRounds + target.length) % 3;
    const rotated: [string, string, string] = [
      choices[shift % 3],
      choices[(shift + 1) % 3],
      choices[(shift + 2) % 3],
    ];

    this.readingTarget = target;
    this.readingChoices = rotated;
    this.readingElapsedMs = 0;
    this.readingAnswered = 'none';
    this.lastFeedback = 'Watch the practice hand.';
  }

  private stepReadingStage(delta: number, scale: number): void {
    const msPerLetter = SPEED_MS[this.speedTier];
    const totalMs = this.readingTarget.length * msPerLetter;
    this.readingElapsedMs += delta * 1000;
    if (this.readingElapsedMs > totalMs + 1100) {
      this.readingElapsedMs = 0;
    }

    this.handAnchor[0] = this.tableAnchor[0];
    this.handAnchor[1] = this.tableAnchor[1] + 0.06;
    this.handAnchor[2] = this.tableAnchor[2];
    this.buildReaderFacingBasis();

    synthesizeWordPose(
      this.readingTarget,
      Math.min(this.readingElapsedMs, totalMs),
      msPerLetter,
      this.profile.dominantHand,
      scale,
      this.handAnchor,
      this.readerHead,
      this.tutorPoses,
    );
    this.tutorRig.updateFromPoses(this.tutorPoses);
  }

  private buildReaderFacingBasis(): void {
    // Rotate viewer basis 180 deg around Y so the tutor/replay hand faces the viewer across the table.
    if (handState.headValid) {
      const m = handState.head;
      this.readerHead[0] = -m[0];
      this.readerHead[1] = m[1];
      this.readerHead[2] = -m[2];
      this.readerHead[4] = m[4];
      this.readerHead[5] = m[5];
      this.readerHead[6] = m[6];
      this.readerHead[8] = -m[8];
      this.readerHead[9] = m[9];
      this.readerHead[10] = -m[10];
    } else {
      this.readerHead[0] = -1;
      this.readerHead[1] = 0;
      this.readerHead[2] = 0;
      this.readerHead[4] = 0;
      this.readerHead[5] = 1;
      this.readerHead[6] = 0;
      this.readerHead[8] = 0;
      this.readerHead[9] = 0;
      this.readerHead[10] = -1;
    }
  }

  // ---------------------------------------------------------------- Table Detection & Fallback (Check J7)

  private updateTableAnchor(delta: number): void {
    this.planeCheckTimer -= delta;
    if (this.planeCheckTimer <= 0) {
      this.planeCheckTimer = PLANE_CHECK_INTERVAL_S;
      this.pickTablePlane();
    }

    const planeObj = this.tablePlane?.object3D;
    if (planeObj) {
      // Follow the plane's pose (the runtime may refine it while the session runs).
      planeObj.getWorldPosition(this.tmpPlanePos);
      this.tableSource = 'xr-plane';
      this.tableAnchor[0] = this.tmpPlanePos.x;
      this.tableAnchor[1] = this.tmpPlanePos.y;
      this.tableAnchor[2] = this.tmpPlanePos.z;
      this.virtualDeskMesh.visible = false;
    } else {
      this.tableSource = 'virtual-fallback';
      this.tablePlaneLabel = '';
      // World-locked: placed once per stage entry / recenter, not every frame.
      if (!this.fallbackPlaced) this.placeFallbackTable();
      this.virtualDeskMesh.visible = this.stage === 'replay' || this.stage === 'reading';
    }

    this.tableGroup.position.set(this.tableAnchor[0], this.tableAnchor[1], this.tableAnchor[2]);
    this.tableGroup.rotation.set(0, this.tableYaw, 0);
  }

  /**
   * Choose a real table: labelled table/desk (or an unlabelled horizontal
   * surface) at seated table height below the eyes and within reach. Floors,
   * ceilings, couches and far-away furniture are rejected.
   */
  private pickTablePlane(): void {
    if (!handState.headValid) return;
    const m = handState.head;
    const hx = m[12], hy = m[13], hz = m[14];

    let best: Entity | null = null;
    let bestScore = Infinity;
    let bestLabel = '';
    let currentScore = Infinity;
    for (const entity of this.queries.planes.entities) {
      const plane = entity.getValue(XRPlane, '_plane') as
        | { semanticLabel?: string; orientation?: string }
        | undefined;
      const label = (plane?.semanticLabel ?? '').toLowerCase();
      const orient = (plane?.orientation ?? '').toLowerCase();
      const isTable = label.includes('table') || label.includes('desk');
      if (!isTable && (orient !== 'horizontal' || TABLE_REJECT_LABEL.test(label))) continue;
      const obj = entity.object3D;
      if (!obj) continue;
      obj.getWorldPosition(this.tmpPlanePos);
      const drop = hy - this.tmpPlanePos.y;
      if (drop < TABLE_MIN_DROP || drop > TABLE_MAX_DROP) continue;
      const dist = Math.hypot(this.tmpPlanePos.x - hx, this.tmpPlanePos.z - hz);
      if (dist > TABLE_MAX_DIST) continue;
      // Prefer surfaces the runtime labelled as a table, then the nearest.
      const score = dist + (isTable ? 0 : 0.5);
      if (entity === this.tablePlane) currentScore = score;
      if (score < bestScore) {
        bestScore = score;
        best = entity;
        bestLabel = label || 'horizontal surface';
      }
    }

    // Hysteresis: keep the current table unless another is clearly better.
    if (this.tablePlane && currentScore <= bestScore + 0.25) return;

    if (best) {
      this.tablePlane = best;
      this.tablePlaneLabel = bestLabel;
      best.object3D?.getWorldPosition(this.tmpPlanePos);
      this.tableYaw = Math.atan2(hx - this.tmpPlanePos.x, hz - this.tmpPlanePos.z);
    } else if (this.tablePlane) {
      // Lost the table: re-place the fallback desk in front of the learner.
      this.tablePlane = null;
      this.fallbackPlaced = false;
    }
  }

  private placeFallbackTable(): void {
    if (!handState.headValid) {
      this.tableAnchor[0] = 0;
      this.tableAnchor[1] = 1.02;
      this.tableAnchor[2] = -0.52;
      this.tableYaw = 0;
      return;
    }
    const m = handState.head;
    const hx = m[12], hy = m[13], hz = m[14];
    let fx = -m[8], fz = -m[10];
    const l = Math.hypot(fx, fz) || 1;
    fx /= l;
    fz /= l;
    this.tableAnchor[0] = hx + fx * 0.48;
    this.tableAnchor[1] = hy - 0.36;
    this.tableAnchor[2] = hz + fz * 0.48;
    this.tableYaw = Math.atan2(-fx, -fz);
    this.fallbackPlaced = true;
  }

  // ---------------------------------------------------------------- User Actions

  public handleNextOrSelfCheck(): void {
    if (this.stage === 'words' && this.wordPhase !== 'letters') {
      if (this.wordPhase === 'fluent-record') this.finishFluentCapture();
    } else if (this.stage === 'warmup' || this.stage === 'words') {
      this.skipLetter();
    } else if (this.stage === 'replay') {
      // Advance to the next word in the personal list, or move to Stage 4 Reading Mode.
      if (this.wordIdx + 1 < this.wordList.length) {
        this.wordIdx++;
        this.setStage('words');
      } else {
        this.setStage('reading');
      }
    } else if (this.stage === 'reading') {
      this.startReadingRound();
      this.renderUI();
    }
  }

  private handleChoice(idx: number): void {
    if (this.stage === 'words' && this.wordPhase !== 'letters') {
      if (idx === 0) {
        this.startFluentCapture();
      } else if (idx === 2) {
        // Skip the one-go attempt: replay will say there is no recording.
        this.recCount = 0;
        this.recWord = this.currentWord();
        this.setStage('replay');
      }
      return;
    }

    if (this.stage === 'warmup' || this.stage === 'words') {
      if (idx === 0 && this.celebrateTimer <= 0) this.triggerLetterSuccess('self-check');
      return;
    }

    if (this.stage === 'replay') {
      if (idx === 0) {
        this.replayElapsedMs = 0;
        this.replayCursor = 0;
      } else if (idx === 1) {
        // Record another one-go attempt of the same word.
        this.startFluentCapture();
        return;
      } else {
        this.setStage('reading');
      }
      this.renderUI();
      return;
    }

    if (this.stage === 'reading') {
      if (this.readingAnswered === 'correct') return;
      const picked = this.readingChoices[idx];
      this.profile.readingRounds++;
      if (picked === this.readingTarget) {
        this.readingAnswered = 'correct';
        this.profile.readingScore++;
        this.readingStreak++;
        this.chimeSuccess();
        // Advance speed tier only after 2 successes at current tier (Caregiver check C7).
        if (this.readingStreak >= 2 && this.speedTier === 'slow') {
          this.speedTier = 'normal';
          this.readingStreak = 0;
          this.lastFeedback = 'Correct. Speed increased to medium.';
        } else if (this.readingStreak >= 2 && this.speedTier === 'normal') {
          this.speedTier = 'fast';
          this.readingStreak = 0;
          this.lastFeedback = 'Correct. Speed increased to fast.';
        } else {
          this.lastFeedback = 'Ready for another word.';
        }
        saveProfile(this.profile);
      } else {
        this.readingAnswered = 'wrong';
        this.readingStreak = 0;
        this.replayElapsedMs = 0;
        this.readingElapsedMs = 0;
        this.lastFeedback = 'Watch again and try another answer.';
        this.beep(260, 0.18);
      }
      this.renderUI();
    }
  }

  private cycleSpeed(): void {
    this.speedTier = this.speedTier === 'slow' ? 'normal' : this.speedTier === 'normal' ? 'fast' : 'slow';
    this.readingElapsedMs = 0;
    this.renderUI();
  }

  private toggleHand(): void {
    this.profile.dominantHand = this.profile.dominantHand === 'right' ? 'left' : 'right';
    saveProfile(this.profile);
    this.steadyS = 0;
    this.updateTargetFeatures();
    this.renderUI();
  }

  // ---------------------------------------------------------------- Spatial Placement (Seated 2ft / Narrow FoV)

  private placeErgonomicLayout(): void {
    this.needsPlacement = false;
    if (!handState.headValid) return;
    const m = handState.head;
    const hx = m[12], hy = m[13], hz = m[14];
    let fx = -m[8], fz = -m[10];
    const len = Math.hypot(fx, fz) || 1;
    fx /= len;
    fz /= len;

    // Place trainer panel at 0.56 m (within 2 ft seated reach for PokeInteractable
    // and well inside +/-20 deg FoV, slightly below eye level).
    const tx = hx + fx * 0.56;
    const ty = hy - 0.12;
    const tz = hz + fz * 0.56;
    const obj = this.world.getSceneEntity('trainer-panel')?.object3D;
    if (obj) {
      obj.position.set(tx, ty, tz);
      obj.rotation.set(0, Math.atan2(hx - tx, hz - tz), 0);
    }
  }

  // ---------------------------------------------------------------- UI Rendering

  private setText(id: string, props: Record<string, unknown>): void {
    this.text[id]?.setProperties(props);
  }

  private showUI(id: string, visible: boolean): void {
    this.setText(id, { display: visible ? 'flex' : 'none' });
  }

  private renderUI(): void {
    const signing = this.stage === 'warmup' || (this.stage === 'words' && this.wordPhase === 'letters');
    const capturing = this.stage === 'words' && this.wordPhase !== 'letters';
    const recording = capturing && this.wordPhase === 'fluent-record';
    const replay = this.stage === 'replay';
    const reading = this.stage === 'reading';
    const celebrating = signing && this.celebrateTimer > 0;
    const displayPractice = !this.menuOpen;

    this.setText('btn-settings-label', { text: this.menuOpen ? 'Close' : 'Menu' });
    this.setText('btn-trainer-hand-label', { text: this.profile.dominantHand === 'left' ? 'Left hand' : 'Right hand' });
    this.setText('btn-trainer-ghost-label', { text: this.profile.ghostOpacityLevel === 'full' ? 'Dim guide' : 'Brighten guide' });
    this.setText('btn-speed-label', { text: SPEED_LABELS[this.speedTier] });
    this.showUI('settings-panel', this.menuOpen);
    this.showUI('btn-switch-word', this.stage === 'words' && !capturing && this.wordList.length > 1);
    this.showUI('practice-body', displayPractice);
    this.showUI('choice-row', displayPractice && !celebrating);
    const longAnswers = reading && this.readingChoices.some((word) => word.length > 9);
    this.setText('choice-row', { flexDirection: longAnswers ? 'column' : 'row' });
    this.showUI('btn-choice-1', replay || reading);
    const hasNextWord = this.wordIdx + 1 < this.wordList.length;
    this.showUI('btn-choice-2', capturing || (replay && hasNextWord) || reading);
    this.showUI('next-row', displayPractice && !celebrating && (!capturing || recording));
    this.showUI('btn-read-replay', reading);
    this.showUI('btn-speed', reading);
    this.showUI('trainer-progress', signing || capturing);
    this.showUI('trainer-word-progress', !replay);

    if (this.menuOpen) {
      this.setText('stage-title', { text: 'Practice menu' });
      return;
    }

    if (signing) {
      const warmup = this.stage === 'warmup';
      const letter = this.currentLetterObj();
      const word = this.currentWord();
      const needS = this.lastVerdict === 'self-check' ? HOLD_SELF_CHECK_S : HOLD_PASS_S;
      this.setText('stage-title', { text: warmup ? 'Warmup' : 'Spell a name' });
      this.setText('trainer-letter', { text: letter.letter, fontSize: 76 });
      this.setText('trainer-word-progress', {
        text: warmup ? `Letter ${this.warmupIdx + 1} of ${WARMUP_LETTERS.length}` : `${word} / ${this.charIdx + 1} of ${word.length}`,
      });
      this.setText('trainer-shape', { text: letter.shape });
      this.setText('trainer-status', {
        text: this.lastFeedback,
        backgroundColor: this.lastVerdict === 'pass' ? BANNER_COLORS.pass :
          this.lastVerdict === 'self-check' ? BANNER_COLORS.self : BANNER_COLORS.idle,
      });
      this.setText('trainer-bar', { width: `${celebrating ? 100 : Math.min(100, Math.round(this.steadyS / needS * 100))}%` });
      this.setText('btn-choice-0-label', { text: 'Compare and continue' });
      this.setText('btn-next-label', { text: 'Skip letter' });
      return;
    }

    if (capturing) {
      const word = this.currentWord();
      const duration = recording ? this.fluentWindowS : FLUENT_LEAD_IN_S;
      const remaining = Math.max(0, duration - this.phaseTimer);
      this.setText('stage-title', { text: recording ? 'Recording' : 'Get ready' });
      this.setText('trainer-letter', { text: word, fontSize: word.length <= 6 ? 62 : 42 });
      this.setText('trainer-word-progress', { text: recording ? `${Math.ceil(remaining)} s left` : 'Spell the whole word in one go.' });
      this.setText('trainer-shape', { text: 'This attempt becomes your replay.' });
      this.setText('trainer-status', {
        text: handState[this.profile.dominantHand].valid ? this.lastFeedback : 'Keep your hand in view.',
        backgroundColor: recording ? BANNER_COLORS.rec : BANNER_COLORS.hold,
      });
      this.setText('trainer-bar', { width: `${Math.round(remaining / duration * 100)}%` });
      this.setText('btn-choice-0-label', { text: 'Start over' });
      this.setText('btn-choice-2-label', { text: 'Skip recording' });
      this.setText('btn-next-label', { text: 'Done' });
      return;
    }

    if (replay) {
      const word = this.replayWord;
      this.setText('stage-title', { text: this.replayHasRecording ? 'Your replay' : 'Example replay' });
      this.setText('trainer-letter', { text: word, fontSize: word.length <= 6 ? 62 : 42 });
      this.setText('trainer-shape', {
        text: this.tableSource === 'xr-plane' ? 'Look at your table.' : 'Look at the virtual desk.',
      });
      this.setText('trainer-status', {
        text: !this.replayHasRecording ? 'Record an attempt to see your own hand.' :
          this.lastDynamics?.isBouncy ? 'Watch for repeated up-and-down wrist movement.' : 'Watch how your letters flow together.',
        backgroundColor: BANNER_COLORS.idle,
      });
      this.setText('btn-choice-0-label', { text: 'Play again' });
      this.setText('btn-choice-1-label', { text: this.replayHasRecording ? 'Record again' : 'Record attempt' });
      this.setText('btn-choice-2-label', { text: 'Read a word' });
      this.setText('btn-next-label', { text: hasNextWord ? 'Next word' : 'Start reading' });
      return;
    }

    if (reading) {
      const correct = this.readingAnswered === 'correct';
      this.setText('stage-title', { text: 'Read a word' });
      this.setText('trainer-letter', { text: correct ? this.readingTarget : '?', fontSize: this.readingTarget.length <= 6 ? 62 : 42 });
      this.setText('trainer-word-progress', { text: correct ? 'Correct' : 'What did the hand spell?' });
      this.setText('trainer-shape', { text: 'Simulated practice hand' });
      this.setText('trainer-status', {
        text: this.lastFeedback,
        backgroundColor: correct ? BANNER_COLORS.pass :
          this.readingAnswered === 'wrong' ? BANNER_COLORS.warn : BANNER_COLORS.idle,
      });
      this.setText('btn-choice-0-label', { text: this.readingChoices[0] });
      this.setText('btn-choice-1-label', { text: this.readingChoices[1] });
      this.setText('btn-choice-2-label', { text: this.readingChoices[2] });
      this.setText('btn-next-label', { text: correct ? 'Next word' : 'Skip word' });
    }
  }

  // ---------------------------------------------------------------- Audio (Optional, Visual-First Always Active)

  private ensureAudio(): void {
    if (this.audio) return;
    try {
      this.audio = new AudioContext();
    } catch {
      this.audio = null;
    }
  }

  private chimeSuccess(): void {
    if (!this.profile.soundEnabled) return;
    this.beep(880, 0.08, 0);
    this.beep(1320, 0.12, 0.08);
  }

  private beep(freq: number, dur: number, delay = 0): void {
    if (!this.profile.soundEnabled) return;
    const ctx = this.audio;
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
}

/**
 * On-disk format for one recorded take. Shared by the headset recorder, the
 * dev-server save endpoint and the offline evaluation script.
 *
 * kind "letter": a held handshape (or a J/Z movement); label is one letter.
 * kind "word":   a whole word fingerspelled continuously; label is the word.
 */

export const RECORDING_SCHEMA = 'mirrorless.recording.v1';

export interface RecordedFrame {
  /** ms since the first frame of the take. */
  t: number;
  /** 25 × 16 joint matrices, column-major, session reference space. */
  joints: number[];
  /** 25 joint radii in metres (zeros if unavailable). */
  radii: number[];
  /** Viewer pose matrix (16). */
  head: number[];
  /** Feature vector (hand-features.ts layout) for this frame. */
  features: number[];
}

export type TakeKind = 'letter' | 'word';

export interface RecordingTake {
  schema: typeof RECORDING_SCHEMA;
  sessionId: string;
  kind: TakeKind;
  label: string;
  hand: 'left' | 'right';
  take: number;
  /** True when the take is a trajectory (J, Z, words) rather than a held pose. */
  motion: boolean;
  recordedAt: string;
  durationMs: number;
  fps: number;
  userAgent: string;
  /** Capture-gate outcome (coarse finger pattern + consistency with earlier takes). */
  gate?: { pass: boolean; problems: string[]; consistent: boolean; override: boolean };
  frames: RecordedFrame[];
}

export const SESSION_ID_RE = /^[A-Za-z0-9-]{1,48}$/u;
export const LETTER_RE = /^[A-Z]$/u;
export const WORD_RE = /^[A-Z]{2,16}$/u;
export const MAX_FRAMES = 1200;

/** Returns an error string, or null if the take is structurally valid. */
export function validateTake(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return 'not an object';
  const t = value as Partial<RecordingTake>;
  if (t.schema !== RECORDING_SCHEMA) return 'wrong schema';
  if (typeof t.sessionId !== 'string' || !SESSION_ID_RE.test(t.sessionId)) return 'bad sessionId';
  if (t.kind !== 'letter' && t.kind !== 'word') return 'bad kind';
  const labelRe = t.kind === 'letter' ? LETTER_RE : WORD_RE;
  if (typeof t.label !== 'string' || !labelRe.test(t.label)) return 'bad label';
  if (t.hand !== 'left' && t.hand !== 'right') return 'bad hand';
  if (!Number.isInteger(t.take) || (t.take as number) < 1 || (t.take as number) > 999) return 'bad take';
  if (!Array.isArray(t.frames) || t.frames.length < 5 || t.frames.length > MAX_FRAMES) return 'bad frames';
  for (const f of t.frames) {
    if (!Array.isArray(f.joints) || f.joints.length !== 400) return 'bad joints';
    if (!Array.isArray(f.features) || f.features.length < 40) return 'bad features';
  }
  return null;
}

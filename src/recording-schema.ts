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

/** Path of one take under data/recordings: `<session>/<LABEL>-<hand>-t<take>-<ms>.json`. */
export const TAKE_FILE_RE = /^[A-Za-z0-9-]{1,48}\/[A-Z]{1,16}-(left|right)-t\d{1,3}-\d{10,16}\.json$/u;

export function takeFileName(
  take: Pick<RecordingTake, 'sessionId' | 'label' | 'hand' | 'take'>,
  nowMs: number,
): string {
  return `${take.sessionId}/${take.label}-${take.hand}-t${take.take}-${Math.round(nowMs)}.json`;
}

/**
 * Takes saved in the headset's browser (hosted site, no laptop) are downloaded
 * as one bundle file and imported on the laptop with `pnpm import:takes`.
 */
export const TAKE_BUNDLE_SCHEMA = 'mirrorless.take-bundle.v1';

export interface StoredTake {
  /** Same relative path the dev server would have written. */
  file: string;
  take: RecordingTake;
}

export interface TakeBundle {
  schema: typeof TAKE_BUNDLE_SCHEMA;
  exportedAt: string;
  takes: StoredTake[];
}

/** Validates a downloaded bundle; bad entries are reported, never written. */
export function parseTakeBundle(value: unknown): { takes: StoredTake[]; errors: string[] } {
  const takes: StoredTake[] = [];
  const errors: string[] = [];
  const b = value as Partial<TakeBundle> | null;
  if (typeof b !== 'object' || b === null || b.schema !== TAKE_BUNDLE_SCHEMA) {
    return { takes, errors: ['not a Mirrorless take bundle'] };
  }
  if (!Array.isArray(b.takes)) return { takes, errors: ['bundle has no takes list'] };
  b.takes.forEach((entry, i) => {
    const file = (entry as Partial<StoredTake> | null)?.file;
    const take = (entry as Partial<StoredTake> | null)?.take;
    const where = typeof file === 'string' ? file : `entry ${i + 1}`;
    if (typeof file !== 'string' || !TAKE_FILE_RE.test(file)) {
      errors.push(`${where}: bad file name`);
      return;
    }
    const error = validateTake(take);
    if (error) {
      errors.push(`${where}: ${error}`);
      return;
    }
    const t = take as RecordingTake;
    if (!file.startsWith(`${t.sessionId}/${t.label}-${t.hand}-t${t.take}-`)) {
      errors.push(`${where}: file name does not match the take`);
      return;
    }
    takes.push({ file, take: t });
  });
  return { takes, errors };
}

/**
 * Coarse finger-pattern check against a letter's `fingers` code, plus palm
 * orientation and per-finger match scoring for the 3D Ghost Hand.
 * Thresholds are deliberately loose: this is a sanity prior and coaching guide.
 */

import type { AslLetter, PalmFacing } from './asl-letters.js';
import { F } from './hand-features.js';

const NAMES = ['index', 'middle', 'ring', 'pinky'];
const STRAIGHT_MAX = 0.42;
const CURLED_MIN = 0.52; // a loosely relaxed hand sits around 0.2-0.45
const HOOKED_MIN = 0.32; // open-E variant has MCP straightish, PIP/DIP hooked
const HALF_MIN = 0.18;
const HALF_MAX = 0.82;
const THUMB_ACROSS_MAX = 0.65; // thumb tip to ring/pinky knuckle, ÷ hand scale
const THUMB_OUT_MIN = 0.68; // thumb tip to index knuckle, ÷ hand scale

export interface GateResult {
  pass: boolean;
  /** Plain-language problems, e.g. "index looks curled, should be straight". */
  problems: string[];
}

export function checkFingers(pattern: string, f: ArrayLike<number>): GateResult {
  const problems: string[] = [];
  for (let i = 0; i < 4; i++) {
    const want = pattern[i] ?? '.';
    const curl = f[F.curl + 1 + i];
    if (want === 'U' && curl > STRAIGHT_MAX) problems.push(`${NAMES[i]} looks bent, should be straight`);
    else if (want === 'C' && curl < CURLED_MIN) problems.push(`${NAMES[i]} looks straight, should be curled`);
    else if (want === 'E' && curl < HOOKED_MIN) problems.push(`${NAMES[i]} should curl or hook down`);
    else if (want === 'H' && (curl < HALF_MIN || curl > HALF_MAX)) problems.push(`${NAMES[i]} should be curved (half-bent)`);
  }
  const thumb = pattern[4] ?? '.';
  if (thumb === 'A' && Math.min(f[F.thumbTo + 4], f[F.thumbTo + 5]) > THUMB_ACROSS_MAX) {
    problems.push('thumb should fold across the palm');
  } else if (thumb === 'O' && f[F.thumbTo + 2] < THUMB_OUT_MIN) {
    problems.push('thumb should stick out to the side');
  }
  return { pass: problems.length === 0, problems };
}

/**
 * Checks whether the palm/hand direction roughly matches the letter's required
 * orientation. Tolerates natural ergonomic angles (e.g. 30-45 deg angled C,
 * thumb-up G/H). Returns a plain-English coaching tip or null if acceptable.
 */
export function checkPalm(want: PalmFacing, f: ArrayLike<number>): string | null {
  const nx = f[F.palmNormal];
  const ny = f[F.palmNormal + 1];
  const nz = f[F.palmNormal + 2];
  const py = f[F.pointing + 1];
  // If head orientation was not available, skip check.
  if (nx === 0 && ny === 0 && nz === 0) return null;

  switch (want) {
    case 'forward':
      // Palm away from viewer means nz < 0 (or angled slightly inward/sideways).
      if (nz > 0.35) return 'turn your palm forward (away from you)';
      return null;
    case 'in':
      // G and H: palm faces toward the signer (nz > -0.25) or inward/downward.
      if (nz < -0.45) return 'turn your palm toward yourself';
      return null;
    case 'down':
      // P and Q: palm faces down (ny < 0.25) or fingers point downward/forward.
      if (ny > 0.35 && py > 0.35) return 'tilt your wrist so your fingers point down';
      return null;
    case 'side':
      if (nz > 0.4) return 'angle your palm forward or to the side';
      return null;
  }
}

/**
 * Computes a [0..1] match score for each of the 5 fingers (0=thumb..4=pinky)
 * to drive real-time per-finger green/amber visual feedback on the Ghost Hand.
 */
export function scoreFingers(
  letter: AslLetter,
  f: ArrayLike<number>,
  targetFeatures?: ArrayLike<number>,
  out = new Float32Array(5),
): Float32Array {
  const pattern = letter.fingers;
  // Thumb score (index 0)
  const thumbRule = pattern[4] ?? '.';
  let thumbScore = 0.85;
  if (thumbRule === 'A') {
    const d = Math.min(f[F.thumbTo + 4], f[F.thumbTo + 5]);
    thumbScore = Math.max(0, Math.min(1, 1 - (d - 0.35) / 0.55));
  } else if (thumbRule === 'O') {
    const d = f[F.thumbTo + 2];
    thumbScore = Math.max(0, Math.min(1, (d - 0.35) / 0.45));
  } else if (targetFeatures) {
    const diff =
      Math.abs(f[F.curl] - targetFeatures[F.curl]) * 0.5 +
      Math.abs(f[F.thumbTo] - targetFeatures[F.thumbTo]) * 0.35 +
      Math.abs(f[F.thumbTo + 2] - targetFeatures[F.thumbTo + 2]) * 0.35;
    thumbScore = Math.max(0, Math.min(1, 1 - diff * 1.4));
  }
  out[0] = thumbScore;

  // Index..pinky scores (indices 1..4)
  for (let i = 0; i < 4; i++) {
    const want = pattern[i] ?? '.';
    const curl = f[F.curl + 1 + i];
    let s = 0.85;
    if (want === 'U') {
      s = Math.max(0, Math.min(1, 1 - Math.max(0, curl - 0.15) / 0.5));
    } else if (want === 'C') {
      s = Math.max(0, Math.min(1, (curl - 0.2) / 0.5));
    } else if (want === 'E') {
      s = Math.max(0, Math.min(1, (curl - 0.15) / 0.35));
    } else if (want === 'H') {
      const distFromMid = Math.abs(curl - 0.5);
      s = Math.max(0, Math.min(1, 1 - Math.max(0, distFromMid - 0.15) / 0.45));
    } else if (targetFeatures) {
      const diff = Math.abs(curl - targetFeatures[F.curl + 1 + i]);
      s = Math.max(0, Math.min(1, 1 - diff * 1.8));
    }
    if (targetFeatures) {
      const targetCurl = targetFeatures[F.curl + 1 + i];
      const curlMatch = Math.max(0, Math.min(1, 1 - Math.abs(curl - targetCurl) * 1.5));
      s = s * 0.65 + curlMatch * 0.35;
    }
    out[1 + i] = s;
  }

  // Special letter refinements (V spread, R cross, F circle, O pinch)
  if (letter.letter === 'V') {
    const spreadOk = Math.max(0, Math.min(1, (f[F.spread] - 0.04) / 0.16));
    out[1] = Math.min(out[1], spreadOk);
    out[2] = Math.min(out[2], spreadOk);
  } else if (letter.letter === 'U') {
    const togetherOk = Math.max(0, Math.min(1, 1 - Math.max(0, f[F.spread] - 0.12) / 0.2));
    out[1] = Math.min(out[1], togetherOk);
    out[2] = Math.min(out[2], togetherOk);
  } else if (letter.letter === 'F') {
    const pinchOk = Math.max(0, Math.min(1, 1 - Math.max(0, f[F.thumbTo] - 0.32) / 0.4));
    out[0] = Math.min(out[0], pinchOk);
    out[1] = Math.min(out[1], pinchOk);
  }
  return out;
}

/**
 * Template recognizer for static handshapes. Pure math, shared by the offline
 * evaluation script and (later) the in-headset grader.
 *
 * A take becomes one vector: the per-dimension median of its frames' shape
 * features (scale excluded), standardized by the training set's mean/std and
 * weighted per feature group. Classification = nearest template per label;
 * the margin between the best and second-best label drives abstention
 * ("can't see well enough to grade") instead of guessing.
 */

import type { AslLetter } from './asl-letters.js';
import { checkFingers, checkPalm, scoreFingers } from './finger-gate.js';
import { F } from './hand-features.js';

/** Feature groups used for recognition: [offset, length, weight, minStd]. */
const GROUPS: Array<[number, number, number, number]> = [
  [F.curl, 5, 1.2, 0.14],
  [F.flex, 15, 0.5, 0.25],
  [F.tips, 15, 1.0, 0.22],
  [F.spread, 3, 1.0, 0.12],
  [F.thumbTo, 6, 1.5, 0.18],
  [F.cross, 1, 1.2, 0.12],
  [F.palmNormal, 3, 1.1, 0.35],
  [F.pointing, 3, 1.1, 0.35],
];

export const SHAPE_VECTOR_DIMS = GROUPS.reduce((n, [, len]) => n + len, 0);

export const GROUP_WEIGHTS: number[] = GROUPS.flatMap(([, len, w]) => new Array<number>(len).fill(w));
export const GROUP_MIN_STD: number[] = GROUPS.flatMap(([, len, , minStd]) => new Array<number>(len).fill(minStd));

/** Copy the recognition dimensions out of a full feature vector. */
export function shapeVector(features: ArrayLike<number>, out = new Float64Array(SHAPE_VECTOR_DIMS)): Float64Array {
  let k = 0;
  for (const [offset, len] of GROUPS) {
    for (let i = 0; i < len; i++) out[k++] = features[offset + i];
  }
  return out;
}

/** Per-dimension median of many frames' shape vectors (robust to jitter and blips). */
export function medianVector(frames: ArrayLike<number>[]): Float64Array {
  const out = new Float64Array(SHAPE_VECTOR_DIMS);
  const vecs = frames.map((f) => shapeVector(f));
  const col = new Float64Array(vecs.length);
  for (let d = 0; d < SHAPE_VECTOR_DIMS; d++) {
    for (let i = 0; i < vecs.length; i++) col[i] = vecs[i][d];
    col.sort();
    const m = col.length >> 1;
    out[d] = col.length % 2 ? col[m] : (col[m - 1] + col[m]) / 2;
  }
  return out;
}

export interface LabeledVector {
  label: string;
  vec: ArrayLike<number>;
}

export interface TemplateModel {
  version: 1;
  dims: number;
  mean: number[];
  std: number[];
  weights: number[];
  templates: Array<{ label: string; vec: number[] }>;
}

export function trainModel(samples: LabeledVector[]): TemplateModel {
  const n = samples.length;
  const mean = new Array<number>(SHAPE_VECTOR_DIMS).fill(0);
  const std = new Array<number>(SHAPE_VECTOR_DIMS).fill(0);
  for (const s of samples) for (let d = 0; d < SHAPE_VECTOR_DIMS; d++) mean[d] += s.vec[d] / n;
  for (const s of samples) for (let d = 0; d < SHAPE_VECTOR_DIMS; d++) std[d] += (s.vec[d] - mean[d]) ** 2 / n;
  for (let d = 0; d < SHAPE_VECTOR_DIMS; d++) {
    std[d] = Math.max(Math.sqrt(std[d]), GROUP_MIN_STD[d] ?? 1e-2);
  }
  const templates = samples.map((s) => ({
    label: s.label,
    vec: Array.from({ length: SHAPE_VECTOR_DIMS }, (_, d) => (s.vec[d] - mean[d]) / std[d]),
  }));
  return { version: 1, dims: SHAPE_VECTOR_DIMS, mean, std, weights: [...GROUP_WEIGHTS], templates };
}

export interface Classification {
  label: string;
  distance: number;
  runnerUp: string | null;
  runnerUpDistance: number;
  /** (runnerUpDistance − distance) / runnerUpDistance, in [0, 1]; low = ambiguous. */
  margin: number;
  /** Nearest distance per label. */
  perLabel: Record<string, number>;
}

export function classify(model: TemplateModel, vec: ArrayLike<number>): Classification {
  const z = new Float64Array(model.dims);
  for (let d = 0; d < model.dims; d++) z[d] = (vec[d] - model.mean[d]) / model.std[d];
  const perLabel: Record<string, number> = {};
  for (const t of model.templates) {
    let sum = 0;
    for (let d = 0; d < model.dims; d++) {
      const diff = z[d] - t.vec[d];
      sum += model.weights[d] * diff * diff;
    }
    const dist = Math.sqrt(sum);
    if (!(t.label in perLabel) || dist < perLabel[t.label]) perLabel[t.label] = dist;
  }
  const ranked = Object.entries(perLabel).sort((a, b) => a[1] - b[1]);
  const [label, distance] = ranked[0] ?? ['', Infinity];
  const [runnerUp, runnerUpDistance] = ranked[1] ?? [null, Infinity];
  const margin = Number.isFinite(runnerUpDistance) && runnerUpDistance > 0
    ? (runnerUpDistance - distance) / runnerUpDistance
    : 1;
  return { label, distance, runnerUp, runnerUpDistance, margin, perLabel };
}

/**
 * Letters where Quest headset cameras suffer self-occlusion (thumb tucked
 * inside/behind/across the fingers, or crossed fingers). The tracker fills in
 * a hidden thumb with a plausible guess, so a confident template margin does
 * not prove the shape is right. These letters are never auto-graded: the
 * learner always compares against the Ghost Hand and confirms explicitly.
 * Revisit per letter only once held-out Quest recordings show they are reliable.
 */
export const HIGH_OCCLUSION_LETTERS = new Set(['M', 'N', 'T', 'S', 'E', 'R', 'A']);

export type GradeVerdict = 'pass' | 'coach' | 'self-check';

export interface GradeResult {
  verdict: GradeVerdict;
  /** Plain-English coaching hint or honest abstention explanation. */
  feedback: string;
  /** Per-finger match scores [thumb, index, middle, ring, pinky] in [0, 1]. */
  perFinger: Float32Array;
  classification: Classification;
}

/**
 * Hybrid grader combining:
 * 1. Coarse finger-curl & thumb gate (`checkFingers`) + palm facing (`checkPalm`)
 * 2. Template distance & confidence margin (`classify`)
 * 3. Honest abstention for self-occluded shapes (M/N/T/S/E/R/A) or motion letters (J/Z)
 *
 * A 'self-check' verdict is never a pass: the caller must wait for the learner
 * to confirm the shape against the Ghost Hand.
 */
export function gradeAttempt(
  model: TemplateModel,
  letter: AslLetter,
  features: ArrayLike<number>,
  targetFeatures?: ArrayLike<number>,
  abstainMargin = 0.14,
  maxPassDistance = 9.5,
): GradeResult {
  const occluded = HIGH_OCCLUSION_LETTERS.has(letter.letter);
  // For occluded letters only the four finger curls are visible enough to coach;
  // the thumb rule is dropped so a hidden thumb never produces a false "fix".
  const pattern = occluded ? `${letter.fingers.slice(0, 4)}.` : letter.fingers;
  const gate = checkFingers(pattern, features);
  const palmHint = checkPalm(letter.palm, features);
  const perFinger = scoreFingers(letter, features, targetFeatures);
  const vec = shapeVector(features);
  const classification = classify(model, vec);

  // 1. If coarse finger posture or palm orientation is clearly off, give a specific fix first.
  if (!gate.pass) {
    return {
      verdict: 'coach',
      feedback: `${gate.problems[0][0].toUpperCase()}${gate.problems[0].slice(1)}.`,
      perFinger,
      classification,
    };
  }
  if (palmHint) {
    return {
      verdict: 'coach',
      feedback: `${palmHint[0].toUpperCase()}${palmHint.slice(1)}.`,
      perFinger,
      classification,
    };
  }

  // 2. Occluded thumb-in-fist / crossed letters: honest abstention, always.
  if (occluded) {
    return {
      verdict: 'self-check',
      feedback: 'Use the guide hand to check this shape.',
      perFinger,
      classification,
    };
  }

  // 3. Specific disambiguation coaching for known close pairs (U vs V, L vs G, F vs D).
  if (letter.letter === 'V' && features[F.spread] < 0.09) {
    return {
      verdict: 'coach',
      feedback: 'Spread your index and middle fingers.',
      perFinger,
      classification,
    };
  }
  if (letter.letter === 'U' && features[F.spread] > 0.18) {
    return {
      verdict: 'coach',
      feedback: 'Keep your index and middle fingers together.',
      perFinger,
      classification,
    };
  }
  if (letter.letter === 'F' && features[F.thumbTo] > 0.42) {
    return {
      verdict: 'coach',
      feedback: 'Touch your thumb and index fingertip together.',
      perFinger,
      classification,
    };
  }
  // 4. Motion letters (J, Z): the path is not graded.
  if (letter.motion) {
    return {
      verdict: 'self-check',
      feedback: 'Follow the movement of the guide hand.',
      perFinger,
      classification,
    };
  }

  const targetDist = classification.perLabel[letter.letter] ?? classification.distance;
  const isTopMatch = classification.label === letter.letter;
  const isConfusableMatch = letter.confusable.includes(classification.label);

  // 5. Standard trackable letters (L, B, Y, C, I, U, V, W, F, D, O, G, H, K, P, Q, X).
  if (isTopMatch && classification.margin >= abstainMargin && targetDist <= maxPassDistance) {
    return {
      verdict: 'pass',
      feedback: 'Hold that shape.',
      perFinger,
      classification,
    };
  }

  // If finger gate passed and target distance is very close, check if margin is just low vs a confusable letter.
  if ((isTopMatch || isConfusableMatch) && targetDist <= maxPassDistance) {
    if (classification.margin < abstainMargin) {
      return {
        verdict: 'self-check',
        feedback: 'Tracking is uncertain. Compare with the guide hand.',
        perFinger,
        classification,
      };
    }
  }

  // 6. Fallback coaching hint based on weakest finger match.
  let weakestIdx = 0;
  for (let i = 1; i < 5; i++) {
    if (perFinger[i] < perFinger[weakestIdx]) weakestIdx = i;
  }
  const fingerNames = ['thumb', 'index finger', 'middle finger', 'ring finger', 'pinky'];
  return {
    verdict: 'coach',
    feedback: `Adjust your ${fingerNames[weakestIdx]}.`,
    perFinger,
    classification,
  };
}

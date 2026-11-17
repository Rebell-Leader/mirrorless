/**
 * Canonical 25-joint WebXR hand pose synthesizer, baseline 26-letter template
 * generator, and whole-word trajectory analyzer (bounce, rhythm, double-letter
 * slide).
 *
 * Pure math (no DOM or Three.js dependencies) so it can be unit-tested in Node
 * and shared by the 1st-person Ghost Hand, the Table Tutor Hand, the Reader's
 * View Replay, and the fallback TemplateModel.
 */

import { ASL_LETTERS, LETTER_INDEX } from './asl-letters.js';
import {
  computeHandFeatures,
  F,
  FEATURE_COUNT,
  type Handedness,
  J,
  JOINT_COUNT,
} from './hand-features.js';
import {
  type LabeledVector,
  SHAPE_VECTOR_DIMS,
  shapeVector,
  type TemplateModel,
  trainModel,
} from './recognizer.js';

const DEG = Math.PI / 180;

export interface LetterPoseSpec {
  /** Index, middle, ring, pinky flexion [mcp, pip, dip] in degrees. */
  flex: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ];
  /** Splay angle (deg) of index, middle, ring, pinky in palm plane (+ = toward thumb). */
  splay: [number, number, number, number];
  /**
   * Thumb joint targets in palm-scale units (wrist = [0,0,0], +x = thumb side,
   * +y = toward fingers, +z = out of palm): [prox, dist, tip].
   */
  thumb: [[number, number, number], [number, number, number], [number, number, number]];
  /**
   * Palm orientation relative to viewer (right=+X, up=+Y, back=+Z):
   * palmNormal [nx, ny, nz] and finger pointing direction [px, py, pz].
   */
  palmNormal: [number, number, number];
  pointing: [number, number, number];
}

const FIST: [number, number, number] = [88, 95, 75];
const STRAIGHT: [number, number, number] = [4, 4, 2];
const HOOK: [number, number, number] = [28, 78, 65];
const CURVE_C: [number, number, number] = [38, 48, 35];
const CURVE_O: [number, number, number] = [52, 58, 45];
const TOUCH_THUMB: [number, number, number] = [62, 58, 40];

/**
 * Anatomically checked canonical pose specs for all 26 ASL letters (right hand;
 * left hand is mirrored across X automatically).
 */
export const CANONICAL_POSES: Record<string, LetterPoseSpec> = {
  A: {
    flex: [FIST, FIST, FIST, FIST],
    splay: [0, 0, 0, 0],
    // Thumb rests flat against the radial (+x) side of the index finger, tip level with fist top.
    thumb: [
      [0.36, 0.48, 0.12],
      [0.35, 0.76, 0.18],
      [0.33, 1.0, 0.2],
    ],
    palmNormal: [0, 0.05, -0.99],
    pointing: [0, 0.99, 0.05],
  },
  B: {
    flex: [STRAIGHT, STRAIGHT, STRAIGHT, STRAIGHT],
    splay: [2, 0, -2, -4],
    // Thumb folded across the palm toward ring/pinky metacarpal (-x).
    thumb: [
      [0.18, 0.44, 0.22],
      [-0.04, 0.62, 0.26],
      [-0.24, 0.72, 0.24],
    ],
    palmNormal: [0, 0.05, -0.99],
    pointing: [0, 0.99, 0.05],
  },
  C: {
    flex: [CURVE_C, CURVE_C, CURVE_C, CURVE_C],
    splay: [3, 1, -1, -3],
    // Thumb curved out in front below fingers forming a C.
    thumb: [
      [0.3, 0.42, 0.35],
      [0.24, 0.62, 0.62],
      [0.18, 0.76, 0.82],
    ],
    palmNormal: [-0.25, 0.05, -0.96],
    pointing: [0, 0.99, 0.05],
  },
  D: {
    flex: [STRAIGHT, TOUCH_THUMB, TOUCH_THUMB, TOUCH_THUMB],
    splay: [2, 0, -2, -4],
    // Thumb tip meets middle fingertip (near x = 0).
    thumb: [
      [0.24, 0.46, 0.35],
      [0.1, 0.68, 0.58],
      [0.0, 0.82, 0.72],
    ],
    palmNormal: [0, 0.05, -0.99],
    pointing: [0, 0.99, 0.05],
  },
  E: {
    flex: [HOOK, HOOK, HOOK, HOOK],
    splay: [1, 0, -1, -2],
    // Thumb tucked across the palm below hooked fingertips (toward -x).
    thumb: [
      [0.18, 0.42, 0.25],
      [-0.04, 0.58, 0.3],
      [-0.24, 0.66, 0.28],
    ],
    palmNormal: [0, 0.05, -0.99],
    pointing: [0, 0.99, 0.05],
  },
  F: {
    flex: [TOUCH_THUMB, STRAIGHT, STRAIGHT, STRAIGHT],
    splay: [2, 6, 0, -8],
    // Thumb tip touches index fingertip (near x = +0.22) in a circle.
    thumb: [
      [0.28, 0.5, 0.35],
      [0.25, 0.72, 0.56],
      [0.22, 0.85, 0.71],
    ],
    palmNormal: [0, 0.05, -0.99],
    pointing: [0, 0.99, 0.05],
  },
  G: {
    flex: [STRAIGHT, FIST, FIST, FIST],
    splay: [0, 0, 0, 0],
    // Thumb parallel to index, pointing sideways (palm facing signer).
    thumb: [
      [0.34, 0.52, 0.25],
      [0.32, 0.86, 0.34],
      [0.3, 1.18, 0.38],
    ],
    palmNormal: [0.1, 0.05, 0.99],
    pointing: [-0.98, 0.15, 0.1],
  },
  H: {
    flex: [STRAIGHT, STRAIGHT, FIST, FIST],
    splay: [2, 0, 0, 0],
    // Thumb holds ring and pinky down; index & middle point sideways.
    thumb: [
      [0.2, 0.44, 0.28],
      [-0.04, 0.58, 0.38],
      [-0.2, 0.68, 0.36],
    ],
    palmNormal: [0.1, 0.05, 0.99],
    pointing: [-0.98, 0.15, 0.1],
  },
  I: {
    flex: [FIST, FIST, FIST, STRAIGHT],
    splay: [0, 0, 0, -4],
    // Thumb folded across curled index/middle/ring.
    thumb: [
      [0.22, 0.46, 0.28],
      [0.02, 0.64, 0.42],
      [-0.18, 0.72, 0.42],
    ],
    palmNormal: [0, 0.05, -0.99],
    pointing: [0, 0.99, 0.05],
  },
  J: {
    flex: [FIST, FIST, FIST, STRAIGHT],
    splay: [0, 0, 0, -4],
    thumb: [
      [0.22, 0.46, 0.28],
      [0.02, 0.64, 0.42],
      [-0.18, 0.72, 0.42],
    ],
    palmNormal: [0, 0.05, -0.99],
    pointing: [0, 0.99, 0.05],
  },
  K: {
    flex: [STRAIGHT, [38, 8, 4], FIST, FIST],
    splay: [5, -3, 0, 0],
    // Thumb tip sits between index (+0.22) and middle (0) proximal phalanges.
    thumb: [
      [0.24, 0.5, 0.28],
      [0.14, 0.8, 0.38],
      [0.08, 1.06, 0.42],
    ],
    palmNormal: [0, 0.05, -0.99],
    pointing: [0, 0.99, 0.05],
  },
  L: {
    flex: [STRAIGHT, FIST, FIST, FIST],
    splay: [2, 0, 0, 0],
    // Thumb extended straight out to the radial (+x) side.
    thumb: [
      [0.48, 0.42, 0.06],
      [0.78, 0.54, 0.08],
      [1.08, 0.62, 0.08],
    ],
    palmNormal: [0, 0.05, -0.99],
    pointing: [0, 0.99, 0.05],
  },
  M: {
    flex: [
      [82, 88, 65],
      [82, 88, 65],
      [82, 88, 65],
      FIST,
    ],
    splay: [0, 0, 0, 0],
    // Thumb tucked under index, middle, ring; tip between ring (-0.22) & pinky (-0.44).
    thumb: [
      [0.18, 0.44, 0.22],
      [-0.08, 0.62, 0.28],
      [-0.32, 0.74, 0.28],
    ],
    palmNormal: [0, 0.05, -0.99],
    pointing: [0, 0.99, 0.05],
  },
  N: {
    flex: [
      [82, 88, 65],
      [82, 88, 65],
      FIST,
      FIST,
    ],
    splay: [0, 0, 0, 0],
    // Thumb tucked under index & middle; tip between middle (0) & ring (-0.22).
    thumb: [
      [0.2, 0.46, 0.22],
      [0.02, 0.64, 0.28],
      [-0.14, 0.76, 0.28],
    ],
    palmNormal: [0, 0.05, -0.99],
    pointing: [0, 0.99, 0.05],
  },
  O: {
    flex: [CURVE_O, CURVE_O, CURVE_O, CURVE_O],
    splay: [2, 0, -2, -4],
    // Thumb tip meets curved fingertips in an O.
    thumb: [
      [0.26, 0.46, 0.36],
      [0.16, 0.68, 0.62],
      [0.08, 0.82, 0.74],
    ],
    palmNormal: [-0.15, 0.05, -0.98],
    pointing: [0, 0.99, 0.05],
  },
  P: {
    flex: [STRAIGHT, [42, 8, 4], FIST, FIST],
    splay: [5, -3, 0, 0],
    thumb: [
      [0.24, 0.5, 0.28],
      [0.14, 0.8, 0.38],
      [0.08, 1.06, 0.42],
    ],
    // K handshape tilted downward.
    palmNormal: [0, -0.88, -0.47],
    pointing: [-0.1, -0.47, -0.88],
  },
  Q: {
    flex: [STRAIGHT, FIST, FIST, FIST],
    splay: [0, 0, 0, 0],
    thumb: [
      [0.32, 0.5, 0.26],
      [0.28, 0.84, 0.38],
      [0.24, 1.15, 0.44],
    ],
    // G handshape tilted downward.
    palmNormal: [0, -0.85, -0.52],
    pointing: [-0.1, -0.52, -0.85],
  },
  R: {
    // Index and middle straight up and crossed (middle crosses to +x side behind index).
    flex: [STRAIGHT, [10, 8, 4], FIST, FIST],
    splay: [-10, 12, 0, 0],
    thumb: [
      [0.2, 0.46, 0.28],
      [-0.04, 0.62, 0.38],
      [-0.22, 0.68, 0.36],
    ],
    palmNormal: [0, 0.05, -0.99],
    pointing: [0, 0.99, 0.05],
  },
  S: {
    flex: [FIST, FIST, FIST, FIST],
    splay: [0, 0, 0, 0],
    // Thumb wrapped across the front of the curled fingers toward ring/pinky (-x).
    thumb: [
      [0.24, 0.46, 0.32],
      [0.02, 0.68, 0.48],
      [-0.18, 0.74, 0.46],
    ],
    palmNormal: [0, 0.05, -0.99],
    pointing: [0, 0.99, 0.05],
  },
  T: {
    flex: [
      [82, 88, 65],
      FIST,
      FIST,
      FIST,
    ],
    splay: [0, 0, 0, 0],
    // Thumb tucked under index finger (+0.22), tip between index (+0.22) and middle (0).
    thumb: [
      [0.26, 0.48, 0.22],
      [0.16, 0.68, 0.28],
      [0.09, 0.82, 0.3],
    ],
    palmNormal: [0, 0.05, -0.99],
    pointing: [0, 0.99, 0.05],
  },
  U: {
    flex: [STRAIGHT, STRAIGHT, FIST, FIST],
    splay: [1, -1, 0, 0],
    thumb: [
      [0.2, 0.46, 0.28],
      [-0.04, 0.62, 0.38],
      [-0.22, 0.68, 0.36],
    ],
    palmNormal: [0, 0.05, -0.99],
    pointing: [0, 0.99, 0.05],
  },
  V: {
    flex: [STRAIGHT, STRAIGHT, FIST, FIST],
    splay: [12, -12, 0, 0],
    thumb: [
      [0.2, 0.46, 0.28],
      [-0.04, 0.62, 0.38],
      [-0.22, 0.68, 0.36],
    ],
    palmNormal: [0, 0.05, -0.99],
    pointing: [0, 0.99, 0.05],
  },
  W: {
    flex: [STRAIGHT, STRAIGHT, STRAIGHT, FIST],
    splay: [10, 0, -10, 0],
    thumb: [
      [0.2, 0.46, 0.28],
      [-0.06, 0.62, 0.38],
      [-0.28, 0.68, 0.38],
    ],
    palmNormal: [0, 0.05, -0.99],
    pointing: [0, 0.99, 0.05],
  },
  X: {
    // Index finger hooked (MCP 16 deg, PIP 72 deg, DIP 52 deg -> curl ~0.52 = 'H').
    flex: [[16, 72, 52], FIST, FIST, FIST],
    splay: [0, 0, 0, 0],
    thumb: [
      [0.22, 0.46, 0.28],
      [0.02, 0.64, 0.42],
      [-0.16, 0.7, 0.42],
    ],
    palmNormal: [0, 0.05, -0.99],
    pointing: [0, 0.99, 0.05],
  },
  Y: {
    flex: [FIST, FIST, FIST, STRAIGHT],
    splay: [0, 0, 0, -10],
    // Thumb extended out (+x) and pinky extended out (-x).
    thumb: [
      [0.48, 0.42, 0.08],
      [0.78, 0.56, 0.1],
      [1.06, 0.66, 0.1],
    ],
    palmNormal: [0, 0.05, -0.99],
    pointing: [0, 0.99, 0.05],
  },
  Z: {
    flex: [STRAIGHT, FIST, FIST, FIST],
    splay: [0, 0, 0, 0],
    thumb: [
      [0.22, 0.46, 0.28],
      [0.02, 0.64, 0.42],
      [-0.16, 0.7, 0.42],
    ],
    palmNormal: [0, 0.05, -0.99],
    pointing: [0, 0.99, 0.05],
  },
};

/** Finger knuckle X offsets in palm-scale units (index..pinky). */
const KNUCKLE_X = [-0.22, 0, 0.22, 0.44];
const KNUCKLE_Y = [0.98, 1.0, 0.94, 0.86];
/** Phalanx bone lengths [proximal, intermediate, distal] in palm-scale units. */
const BONE_LEN: Array<[number, number, number]> = [
  [0.5, 0.28, 0.22],
  [0.54, 0.31, 0.23],
  [0.5, 0.28, 0.22],
  [0.4, 0.23, 0.19],
];

const METAS = [J.indexMeta, J.middleMeta, J.ringMeta, J.pinkyMeta];

function normalize3(v: [number, number, number]): [number, number, number] {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function cross3(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Computes the 25 joint positions in the viewer/world frame for a given letter.
 *
 * @param letter Uppercase letter A..Z
 * @param hand 'left' | 'right'
 * @param scale Hand scale in metres (wrist -> middle knuckle, default 0.09)
 * @param phase01 Motion progress in [0, 1] (used for J and Z animations)
 * @param wristWorld Wrist position [x, y, z] in world space
 * @param headMatrix 16-float column-major viewer matrix (or null for default identity viewer)
 * @param outPoses Output 25 × 16 Float32Array of joint matrices
 */
export function synthesizeLetterPoses(
  letter: string,
  hand: Handedness,
  scale = 0.09,
  phase01 = 0,
  wristWorld: [number, number, number] = [0, 0, 0],
  headMatrix: ArrayLike<number> | null = null,
  outPoses = new Float32Array(JOINT_COUNT * 16),
): Float32Array {
  const spec = CANONICAL_POSES[letter] ?? CANONICAL_POSES.B;
  const mirror = hand === 'left' ? -1 : 1;

  // Motion trajectory offsets for J and Z.
  let offsetX = 0;
  let offsetY = 0;
  let offsetZ = 0;
  let palmNormal = [...spec.palmNormal] as [number, number, number];
  const pointing = [...spec.pointing] as [number, number, number];

  if (letter === 'J' && phase01 > 0) {
    // J: pinky traces down, then hooks inward as forearm rotates palm toward signer.
    const t = Math.min(1, Math.max(0, phase01));
    const down = Math.sin(Math.min(1, t * 1.4) * (Math.PI * 0.5));
    const hook = t > 0.45 ? Math.sin(((t - 0.45) / 0.55) * (Math.PI * 0.5)) : 0;
    offsetY = -0.055 * down;
    offsetX = -mirror * 0.04 * hook;
    offsetZ = 0.02 * hook;
    palmNormal = normalize3([
      lerp(0, -0.45, hook),
      0.05,
      lerp(-0.99, 0.75, t),
    ]);
  } else if (letter === 'Z' && phase01 > 0) {
    // Z: index draws across (outward), diagonal down-inward, across (outward).
    const t = Math.min(1, Math.max(0, phase01));
    if (t < 0.33) {
      const u = t / 0.33;
      offsetX = mirror * lerp(-0.035, 0.035, u);
      offsetY = 0.025;
    } else if (t < 0.67) {
      const u = (t - 0.33) / 0.34;
      offsetX = mirror * lerp(0.035, -0.035, u);
      offsetY = lerp(0.025, -0.025, u);
    } else {
      const u = (t - 0.67) / 0.33;
      offsetX = mirror * lerp(-0.035, 0.035, u);
      offsetY = -0.025;
    }
  }

  // Build palm basis (ax, ay, az) in viewer frame, where:
  //   ay = pointing direction (wrist -> middle knuckle)
  //   az = mirror * palmNormal (so az = ax × ay * mirror in hand-features.ts!)
  // Wait: in hand-features.ts:
  //   out[F.palmNormal] = mirror * (az · headRight), az · headUp, az · headBack
  //   out[F.pointing]   = mirror * (ay · headRight), ay · headUp, ay · headBack
  // And for right hand (mirror = +1): az = ax × ay, so ax = ay × az.
  // For left hand (mirror = -1): az = -(ax × ay), and ax points toward thumb (+X for left, -X for right).
  const ayView = normalize3([mirror * pointing[0], pointing[1], pointing[2]]);
  const azRaw: [number, number, number] = [mirror * palmNormal[0], palmNormal[1], palmNormal[2]];
  // Orthogonalize az against ay.
  const dotYZ = ayView[0] * azRaw[0] + ayView[1] * azRaw[1] + ayView[2] * azRaw[2];
  const azView = normalize3([
    azRaw[0] - dotYZ * ayView[0],
    azRaw[1] - dotYZ * ayView[1],
    azRaw[2] - dotYZ * ayView[2],
  ]);
  //Since az = mirror * (ax × ay), we have ax = mirror * (ay × az).
  const yCrossZ = cross3(ayView, azView);
  const axView: [number, number, number] = [
    mirror * yCrossZ[0],
    mirror * yCrossZ[1],
    mirror * yCrossZ[2],
  ];

  // Transform palm-frame basis from viewer space into world space using headMatrix.
  const rx = headMatrix ? headMatrix[0] : 1;
  const ry = headMatrix ? headMatrix[1] : 0;
  const rz = headMatrix ? headMatrix[2] : 0;
  const ux = headMatrix ? headMatrix[4] : 0;
  const uy = headMatrix ? headMatrix[5] : 1;
  const uz = headMatrix ? headMatrix[6] : 0;
  const bx = headMatrix ? headMatrix[8] : 0;
  const by = headMatrix ? headMatrix[9] : 0;
  const bz = headMatrix ? headMatrix[10] : 1;

  const toWorldVec = (v: [number, number, number]): [number, number, number] => [
    v[0] * rx + v[1] * ux + v[2] * bx,
    v[0] * ry + v[1] * uy + v[2] * by,
    v[0] * rz + v[1] * uz + v[2] * bz,
  ];

  const ax = toWorldVec(axView);
  const ay = toWorldVec(ayView);
  const az = toWorldVec(azView);
  const dWorld = toWorldVec([offsetX, offsetY, offsetZ]);
  const wx = wristWorld[0] + dWorld[0];
  const wy = wristWorld[1] + dWorld[1];
  const wz = wristWorld[2] + dWorld[2];

  const setJoint = (j: number, px: number, py: number, pz: number) => {
    const m = j * 16;
    outPoses[m] = ax[0];
    outPoses[m + 1] = ax[1];
    outPoses[m + 2] = ax[2];
    outPoses[m + 3] = 0;
    outPoses[m + 4] = ay[0];
    outPoses[m + 5] = ay[1];
    outPoses[m + 6] = ay[2];
    outPoses[m + 7] = 0;
    outPoses[m + 8] = az[0];
    outPoses[m + 9] = az[1];
    outPoses[m + 10] = az[2];
    outPoses[m + 11] = 0;
    outPoses[m + 12] = wx + (px * ax[0] + py * ay[0] + pz * az[0]) * scale;
    outPoses[m + 13] = wy + (px * ax[1] + py * ay[1] + pz * az[1]) * scale;
    outPoses[m + 14] = wz + (px * ax[2] + py * ay[2] + pz * az[2]) * scale;
    outPoses[m + 15] = 1;
  };

  // Wrist & Thumb (+x is radial/thumb side, -x is ulnar/pinky side)
  setJoint(J.wrist, 0, 0, 0);
  setJoint(J.thumbMeta, 0.24, 0.22, 0.04);
  setJoint(J.thumbProx, spec.thumb[0][0], spec.thumb[0][1], spec.thumb[0][2]);
  setJoint(J.thumbDist, spec.thumb[1][0], spec.thumb[1][1], spec.thumb[1][2]);
  setJoint(J.thumbTip, spec.thumb[2][0], spec.thumb[2][1], spec.thumb[2][2]);

  // Four fingers (index..pinky)
  // Recall hand-features.ts:
  //   ax points from pinkyProx to indexProx (+ax = toward thumb side!).
  //   So indexProx has POSITIVE x (+0.22), and pinkyProx has NEGATIVE x (-0.44)!
  const PALM_X = [0.22, 0, -0.22, -0.44];
  for (let f = 0; f < 4; f++) {
    const m = METAS[f];
    const kx = PALM_X[f];
    const ky = KNUCKLE_Y[f];
    setJoint(m, kx * 0.55, 0.18, 0);
    setJoint(m + 1, kx, ky, 0);

    const [mcpDeg, pipDeg, dipDeg] = spec.flex[f];
    const splayRad = spec.splay[f] * DEG;
    const lengths = BONE_LEN[f];

    // Forward kinematics in the finger flexion plane (+y, +z), rotated by splay in (+x, +y).
    const sinS = Math.sin(splayRad);
    const cosS = Math.cos(splayRad);

    let curX = kx;
    let curY = ky;
    // Slight z-offset for crossed R so middle finger sits cleanly behind index finger.
    let curZ = letter === 'R' && f === 1 ? -0.06 : 0;
    let accumFlex = 0;
    const angles = [mcpDeg * DEG, pipDeg * DEG, dipDeg * DEG];

    for (let seg = 0; seg < 3; seg++) {
      accumFlex += angles[seg];
      const lenSeg = lengths[seg];
      const forward = Math.cos(accumFlex) * lenSeg;
      const palmward = Math.sin(accumFlex) * lenSeg;
      curX += forward * sinS;
      curY += forward * cosS;
      curZ += palmward;
      setJoint(m + 2 + seg, curX, curY, curZ);
    }
  }

  return outPoses;
}

const DEFAULT_HEAD = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

/**
 * Computes the canonical 52-float feature vector for a letter.
 */
export function canonicalLetterFeatures(
  letter: string,
  hand: Handedness = 'right',
  out = new Float32Array(FEATURE_COUNT),
): Float32Array {
  const poses = synthesizeLetterPoses(letter, hand, 0.09, 0, [0, 0, 0], DEFAULT_HEAD);
  computeHandFeatures(poses, hand, DEFAULT_HEAD, out);
  return out;
}

/**
 * Builds a complete 26-letter TemplateModel from synthesized canonical poses
 * (with small natural posture perturbations so every letter has realistic spread
 * in template space), optionally merged with recorded takes.
 */
export function buildCanonicalModel(
  hand: Handedness = 'right',
  extraSamples: LabeledVector[] = [],
): TemplateModel {
  const samples: LabeledVector[] = [...extraSamples];
  const feat = new Float32Array(FEATURE_COUNT);
  const poses = new Float32Array(JOINT_COUNT * 16);

  for (const item of ASL_LETTERS) {
    const l = item.letter;
    // Base canonical sample + two gentle orientation variations.
    for (const yawDeg of [-8, 0, 8]) {
      const rad = yawDeg * DEG;
      const c = Math.cos(rad);
      const s = Math.sin(rad);
      const head = new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
      synthesizeLetterPoses(l, hand, 0.09, 0, [0, 0, 0], null, poses);
      if (computeHandFeatures(poses, hand, head, feat)) {
        samples.push({ label: l, vec: Array.from(shapeVector(feat)) });
      }
    }
  }
  return trainModel(samples);
}

/**
 * Interpolates two 25-joint pose arrays (smooth coarticulation between letters
 * in Reading Mode).
 */
export function blendLetterPoses(
  posesA: Float32Array,
  posesB: Float32Array,
  alpha: number,
  outPoses: Float32Array,
): Float32Array {
  const t = Math.max(0, Math.min(1, alpha));
  const s = t * t * (3 - 2 * t); // smoothstep
  for (let i = 0; i < outPoses.length; i++) {
    outPoses[i] = posesA[i] + (posesB[i] - posesA[i]) * s;
  }
  return outPoses;
}

const tmpPoseA = new Float32Array(JOINT_COUNT * 16);
const tmpPoseB = new Float32Array(JOINT_COUNT * 16);

/**
 * Synthesizes an animated word frame for the Table Tutor Hand, including
 * smooth coarticulation transitions between letters and a slight lateral slide
 * on consecutive double letters (e.g. BOOK, ANNA, COFFEE, PIZZA).
 */
export function synthesizeWordPose(
  word: string,
  elapsedMs: number,
  msPerLetter: number,
  hand: Handedness,
  scale: number,
  anchorPos: [number, number, number],
  headMatrix: ArrayLike<number> | null,
  outPoses: Float32Array,
): { letterIndex: number; currentLetter: string; finished: boolean } {
  const clean = word.toUpperCase().replace(/[^A-Z]/gu, '') || 'LBY';
  const totalIndex = elapsedMs / Math.max(200, msPerLetter);
  const idx = Math.min(clean.length - 1, Math.max(0, Math.floor(totalIndex)));
  const frac = Math.min(1, Math.max(0, totalIndex - idx));
  const finished = totalIndex >= clean.length;

  const curr = clean[idx];
  const next = clean[Math.min(clean.length - 1, idx + 1)];
  const prev = idx > 0 ? clean[idx - 1] : '';
  const mirror = hand === 'left' ? -1 : 1;

  // Double-letter lateral slide (e.g. second O in BOOK slides ~2.8 cm outward).
  let slideX = 0;
  let reopenDip = 0;
  if (curr === prev) {
    slideX = mirror * 0.028 * Math.min(1, frac * 2.5);
    reopenDip = Math.sin(Math.min(1, frac * 2) * Math.PI) * 0.01;
  }

  const posCurr: [number, number, number] = [
    anchorPos[0] + slideX,
    anchorPos[1] + reopenDip,
    anchorPos[2],
  ];

  const isMotion = LETTER_INDEX[curr]?.motion ?? false;
  const motionPhase = isMotion ? Math.min(1, frac * 1.25) : 0;

  synthesizeLetterPoses(curr, hand, scale, motionPhase, posCurr, headMatrix, tmpPoseA);

  // Coarticulate smoothly during the last 28% of the letter slot if moving to a new letter.
  if (!finished && idx + 1 < clean.length && curr !== next && frac > 0.72) {
    const blend = (frac - 0.72) / 0.28;
    synthesizeLetterPoses(next, hand, scale, 0, anchorPos, headMatrix, tmpPoseB);
    blendLetterPoses(tmpPoseA, tmpPoseB, blend, outPoses);
  } else {
    outPoses.set(tmpPoseA);
  }

  return { letterIndex: idx, currentLetter: curr, finished };
}

// ---------------------------------------------------------------- Reader's view replay of recorded frames

/** Floats per recorded frame: 25 joints × xyz. */
export const REPLAY_FRAME_FLOATS = JOINT_COUNT * 3;

/**
 * Writes one reader's-view frame from recorded joint positions.
 *
 * `frames` holds n recorded frames of 25 × xyz world positions. Frames `a` and
 * `b` are blended by `t`, rotated 180° about the world vertical axis through
 * `pivot`, and moved so the pivot lands on `anchor`. A rotation (not a mirror)
 * keeps the hand's handedness, so this is exactly what a person facing the
 * signer sees: the learner's own hand, turned around. Only joint translations
 * are written; HandRig reads positions only.
 */
export function writeReaderViewPose(
  frames: Float32Array,
  a: number,
  b: number,
  t: number,
  pivot: ArrayLike<number>,
  anchor: ArrayLike<number>,
  outPoses: Float32Array,
): void {
  const oa = a * REPLAY_FRAME_FLOATS;
  const ob = b * REPLAY_FRAME_FLOATS;
  for (let j = 0; j < JOINT_COUNT; j++) {
    const k = j * 3;
    const x = frames[oa + k] + (frames[ob + k] - frames[oa + k]) * t;
    const y = frames[oa + k + 1] + (frames[ob + k + 1] - frames[oa + k + 1]) * t;
    const z = frames[oa + k + 2] + (frames[ob + k + 2] - frames[oa + k + 2]) * t;
    const m = j * 16;
    outPoses[m + 12] = anchor[0] - (x - pivot[0]);
    outPoses[m + 13] = anchor[1] + (y - pivot[1]);
    outPoses[m + 14] = anchor[2] - (z - pivot[2]);
    outPoses[m + 15] = 1;
  }
}

// ---------------------------------------------------------------- Recorded model merge

/**
 * Merges a recorded TemplateModel (as written by `pnpm eval:recordings`) into
 * the canonical 26-letter model instead of replacing it, so letters missing
 * from the recordings can still be graded. Returns null when the file is not a
 * usable model.
 */
export function buildModelWithRecorded(
  hand: Handedness,
  recorded: Partial<TemplateModel>,
): TemplateModel | null {
  const { mean, std, templates } = recorded;
  if (
    recorded.version !== 1 ||
    recorded.dims !== SHAPE_VECTOR_DIMS ||
    !Array.isArray(mean) ||
    !Array.isArray(std) ||
    !Array.isArray(templates) ||
    mean.length !== SHAPE_VECTOR_DIMS ||
    std.length !== SHAPE_VECTOR_DIMS
  ) {
    return null;
  }
  const extra: LabeledVector[] = [];
  for (const t of templates) {
    if (!t || typeof t.label !== 'string' || !LETTER_INDEX[t.label]) continue;
    if (!Array.isArray(t.vec) || t.vec.length !== SHAPE_VECTOR_DIMS) continue;
    // Templates are stored standardized; undo that to get raw feature vectors.
    extra.push({ label: t.label, vec: t.vec.map((z, d) => z * std[d] + mean[d]) });
  }
  return extra.length > 0 ? buildCanonicalModel(hand, extra) : null;
}

// ---------------------------------------------------------------- Whole-word dynamics (bounce check)

export interface WordDynamicsReport {
  /** False when the one-go attempt had too little tracked hand data to judge. */
  measured: boolean;
  /** Typical vertical wrist swing in cm (10th-90th percentile) after removing jitter and slow drift. */
  bounceCm: number;
  /** Number of up or down wrist swings of at least BIG_SWING_CM. */
  bigSwings: number;
  /** True when the wrist pumped up and down repeatedly (stamping each letter). */
  isBouncy: boolean;
  /** True when the word contains consecutive identical letters (BOOK, ANNA, etc.). */
  hasDoubleLetters: boolean;
  /** Double-letter pair found (e.g. 'OO' in BOOK), or null. */
  doublePair: string | null;
  /** Sideways wrist travel during the attempt in cm (informational, not graded). */
  sidewaysCm: number;
  /** 0..100 wrist steadiness, or null when not measured. */
  steadinessScore: number | null;
  /** Plain-English summary shown in Reader's View Replay. */
  summary: string;
}

/** A swing at least this big (cm) counts as a bounce. */
export const BIG_SWING_CM = 2.5;
const MIN_SAMPLES = 10;
const MIN_DURATION_MS = 800;
const SMOOTH_HALF_WINDOW_MS = 75;
const SWING_HYSTERESIS_M = 0.008;

function percentile(sorted: Float64Array, p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[idx];
}

/**
 * Wrist steadiness on ONE continuous attempt at a word (not the letter-by-letter
 * practice, where pauses and repositioning dominate).
 *
 * Tracker jitter is removed with a short moving average and slow height drift
 * with a linear detrend, so a still hand scores as still no matter how long
 * the attempt is. Bounce = repeated up/down swings of at least BIG_SWING_CM.
 * Double letters are detected from the spelling and explained, not graded.
 */
export function analyzeWordDynamics(
  wristTrajectory: Array<{ t: number; x: number; y: number; z: number }>,
  word: string,
): WordDynamicsReport {
  const clean = word.toUpperCase().replace(/[^A-Z]/gu, '');
  let doublePair: string | null = null;
  for (let i = 1; i < clean.length; i++) {
    if (clean[i] === clean[i - 1]) {
      doublePair = `${clean[i]}${clean[i]}`;
      break;
    }
  }
  const hasDoubleLetters = doublePair !== null;
  const doubleTip = hasDoubleLetters
    ? ` Double ${doublePair}: a small sideways slide (or a gentle re-articulation) shows the double; this check does not grade it yet.`
    : '';

  const n = wristTrajectory.length;
  const durationMs = n > 1 ? wristTrajectory[n - 1].t - wristTrajectory[0].t : 0;
  if (n < MIN_SAMPLES || durationMs < MIN_DURATION_MS) {
    return {
      measured: false,
      bounceCm: 0,
      bigSwings: 0,
      isBouncy: false,
      hasDoubleLetters,
      doublePair,
      sidewaysCm: 0,
      steadinessScore: null,
      summary: 'Not enough tracked hand data from your one-go attempt to check bounce. Keep your hand in view and tap "Try again".',
    };
  }

  // 1. Moving average (time window) to remove tracker jitter.
  const ys = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const ti = wristTrajectory[i].t;
    let sum = 0;
    let count = 0;
    for (let j = i; j >= 0 && ti - wristTrajectory[j].t <= SMOOTH_HALF_WINDOW_MS; j--) {
      sum += wristTrajectory[j].y;
      count++;
    }
    for (let j = i + 1; j < n && wristTrajectory[j].t - ti <= SMOOTH_HALF_WINDOW_MS; j++) {
      sum += wristTrajectory[j].y;
      count++;
    }
    ys[i] = sum / count;
  }

  // 2. Linear detrend so a slow drift in height is not counted as bounce.
  let st = 0;
  let sy = 0;
  let stt = 0;
  let sty = 0;
  for (let i = 0; i < n; i++) {
    const t = (wristTrajectory[i].t - wristTrajectory[0].t) / 1000;
    st += t;
    sy += ys[i];
    stt += t * t;
    sty += t * ys[i];
  }
  const denom = n * stt - st * st;
  const slope = Math.abs(denom) > 1e-12 ? (n * sty - st * sy) / denom : 0;
  const intercept = (sy - slope * st) / n;
  const resid = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = (wristTrajectory[i].t - wristTrajectory[0].t) / 1000;
    resid[i] = ys[i] - (intercept + slope * t);
  }

  // 3. Zig-zag swing detection with hysteresis.
  let swings = 0;
  let pivot = resid[0];
  let extreme = resid[0];
  let dir = 0;
  const bigM = BIG_SWING_CM / 100;
  for (let i = 1; i < n; i++) {
    const v = resid[i];
    if (dir === 0) {
      if (v - pivot >= SWING_HYSTERESIS_M) {
        dir = 1;
        extreme = v;
      } else if (pivot - v >= SWING_HYSTERESIS_M) {
        dir = -1;
        extreme = v;
      }
    } else if (dir === 1) {
      if (v > extreme) extreme = v;
      else if (extreme - v >= SWING_HYSTERESIS_M) {
        if (extreme - pivot >= bigM) swings++;
        pivot = extreme;
        extreme = v;
        dir = -1;
      }
    } else if (v < extreme) {
      extreme = v;
    } else if (v - extreme >= SWING_HYSTERESIS_M) {
      if (pivot - extreme >= bigM) swings++;
      pivot = extreme;
      extreme = v;
      dir = 1;
    }
  }
  if (dir !== 0 && Math.abs(extreme - pivot) >= bigM) swings++;

  const sorted = Float64Array.from(resid).sort();
  const bounceCm = Math.round((percentile(sorted, 0.9) - percentile(sorted, 0.1)) * 1000) / 10;

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of wristTrajectory) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  const sidewaysCm = Math.round(Math.hypot(maxX - minX, maxZ - minZ) * 1000) / 10;

  // J and Z legitimately move the hand, so allow two extra swings for them.
  const motionLetters = (clean.match(/[JZ]/gu) ?? []).length;
  const allowedSwings = Math.max(2, clean.length - 2) + motionLetters * 2;
  const isBouncy = swings > allowedSwings;
  const steadinessScore = Math.max(
    0,
    Math.min(100, Math.round(100 - Math.max(0, bounceCm - 1) * 9 - Math.max(0, swings - allowedSwings) * 6)),
  );

  const summary = isBouncy
    ? `Bouncy: your wrist went up and down ${swings} times by ${BIG_SWING_CM} cm or more. Keep your hand at one height and let the fingers change shape.${doubleTip}`
    : `Steady wrist: typical vertical swing ${bounceCm.toFixed(1)} cm.${doubleTip}`;

  return {
    measured: true,
    bounceCm,
    bigSwings: swings,
    isBouncy,
    hasDoubleLetters,
    doublePair,
    sidewaysCm,
    steadinessScore,
    summary,
  };
}

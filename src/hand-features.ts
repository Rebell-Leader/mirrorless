/**
 * Hand-shape features from WebXR hand joints.
 *
 * Pure math, no DOM and no IWSDK imports, so it can be unit-tested in Node and
 * reused by the recorder, the recognizer and the ghost-hand feedback.
 *
 * Input: the 25 joint poses that `XRFrame.fillPoses` writes (16 floats per
 * joint, column-major matrices, in the session reference space), plus the
 * viewer (head) pose matrix in the same space.
 *
 * Everything is expressed in a palm frame that is mirrored for the left hand,
 * so a left-hand "A" and a right-hand "A" produce the same feature vector.
 */

/** WebXR joint order (XRHand iteration order). */
export const J = {
  wrist: 0,
  thumbMeta: 1,
  thumbProx: 2,
  thumbDist: 3,
  thumbTip: 4,
  indexMeta: 5,
  indexProx: 6,
  indexInter: 7,
  indexDist: 8,
  indexTip: 9,
  middleMeta: 10,
  middleProx: 11,
  middleInter: 12,
  middleDist: 13,
  middleTip: 14,
  ringMeta: 15,
  ringProx: 16,
  ringInter: 17,
  ringDist: 18,
  ringTip: 19,
  pinkyMeta: 20,
  pinkyProx: 21,
  pinkyInter: 22,
  pinkyDist: 23,
  pinkyTip: 24,
} as const;

export const JOINT_COUNT = 25;
export const FINGER_NAMES = ['thumb', 'index', 'middle', 'ring', 'pinky'] as const;
/** First joint (metacarpal) of index..pinky. */
const FINGER_META = [J.indexMeta, J.middleMeta, J.ringMeta, J.pinkyMeta];
const TIPS = [J.thumbTip, J.indexTip, J.middleTip, J.ringTip, J.pinkyTip];

/** Offsets into the feature vector. */
export const F = {
  /** 5 values, thumb..pinky: 0 = straight, 1 = fully curled. */
  curl: 0,
  /** 15 values: index..pinky MCP/PIP/DIP signed flexion (rad), then thumb MCP, IP, opposition. */
  flex: 5,
  /** 15 values: fingertip positions in the palm frame, divided by hand scale. */
  tips: 20,
  /** 3 values: signed spread index-middle, middle-ring, ring-pinky (rad, + = toward thumb side). */
  spread: 35,
  /** 6 values: thumb tip distance to index tip, middle tip, index/middle/ring/pinky knuckle (÷ scale). */
  thumbTo: 38,
  /** 1 value: index tip minus middle tip across the palm (÷ scale); negative when crossed (R). */
  cross: 44,
  /** 3 values: palm normal in the head frame (x mirrored for the left hand). */
  palmNormal: 45,
  /** 3 values: hand direction (wrist → middle knuckle) in the head frame (x mirrored for left). */
  pointing: 48,
  /** 1 value: hand scale in metres (wrist → middle knuckle). */
  handScale: 51,
} as const;

export const FEATURE_COUNT = 52;

export type Handedness = 'left' | 'right';

// Scratch buffers (module level so the per-frame path never allocates).
const P = new Float64Array(JOINT_COUNT * 3);
const ax = new Float64Array(3); // palm x: toward the thumb side
const ay = new Float64Array(3); // palm y: toward the fingers
const az = new Float64Array(3); // palm z: out of the palm
const a = new Float64Array(3);
const b = new Float64Array(3);
const c = new Float64Array(3);

const MAX_FINGER_FLEX = (270 * Math.PI) / 180;
const MAX_THUMB_FLEX = (140 * Math.PI) / 180;

function sub(out: Float64Array, i: number, j: number): void {
  out[0] = P[i * 3] - P[j * 3];
  out[1] = P[i * 3 + 1] - P[j * 3 + 1];
  out[2] = P[i * 3 + 2] - P[j * 3 + 2];
}

function dot(u: Float64Array, v: Float64Array): number {
  return u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
}

function len(u: Float64Array): number {
  return Math.sqrt(dot(u, u));
}

function normalize(u: Float64Array): number {
  const l = len(u);
  if (l > 1e-9) {
    u[0] /= l;
    u[1] /= l;
    u[2] /= l;
  }
  return l;
}

function dist(i: number, j: number): number {
  sub(c, i, j);
  return len(c);
}

/**
 * Angle between bones (j0→j1) and (j1→j2). When `mirror` is given, the angle is
 * signed: + for flexion toward the palm, − for hyperextension. Finger flexion
 * rotates about the across-palm axis, so the sign is (a × b) · x, mirrored for
 * the left hand. The thumb flexes about an oblique axis, so it stays unsigned.
 */
function flexion(j0: number, j1: number, j2: number, mirror = 0): number {
  sub(a, j1, j0);
  sub(b, j2, j1);
  if (mirror !== 0) {
    // Measure in the flexion plane only: drop the across-palm component so the
    // fanning of the metacarpals (abduction) does not read as curl.
    const da = dot(a, ax);
    const db = dot(b, ax);
    for (let i = 0; i < 3; i++) {
      a[i] -= da * ax[i];
      b[i] -= db * ax[i];
    }
  }
  normalize(a);
  normalize(b);
  const cos = Math.min(1, Math.max(-1, dot(a, b)));
  const angle = Math.acos(cos);
  if (mirror === 0) return angle;
  const cx = a[1] * b[2] - a[2] * b[1];
  const cy = a[2] * b[0] - a[0] * b[2];
  const cz = a[0] * b[1] - a[1] * b[0];
  const s = (cx * ax[0] + cy * ax[1] + cz * ax[2]) * mirror;
  return s >= 0 ? angle : -angle;
}

/**
 * Angle of a bone projected on the palm plane, measured from +y toward +x (thumb side).
 * Clamps the forward (+y) component so curled fingers (pointing along +z) do not
 * flip atan2 between -pi and +pi on tiny tracking noise.
 */
function bonePlaneAngle(j0: number, j1: number): number {
  sub(a, j1, j0);
  const boneLen = len(a);
  const forward = Math.max(boneLen * 0.2, dot(a, ay));
  return Math.atan2(dot(a, ax), forward);
}

/**
 * Compute the feature vector for one hand.
 *
 * @param poses 25 × 16 joint matrices from `fillPoses`.
 * @param head 16-float viewer matrix in the same space (or null to skip orientation features).
 * @returns false when the pose is degenerate (not a plausible hand).
 */
export function computeHandFeatures(
  poses: Float32Array,
  handedness: Handedness,
  head: Float32Array | null,
  out: Float32Array,
): boolean {
  for (let j = 0; j < JOINT_COUNT; j++) {
    const m = j * 16;
    P[j * 3] = poses[m + 12];
    P[j * 3 + 1] = poses[m + 13];
    P[j * 3 + 2] = poses[m + 14];
  }
  for (let i = 0; i < P.length; i++) {
    if (!Number.isFinite(P[i])) return false;
  }

  // Palm frame.
  sub(ay, J.middleProx, J.wrist);
  const scale = normalize(ay);
  if (scale < 0.04 || scale > 0.2) return false;
  sub(ax, J.indexProx, J.pinkyProx); // pinky → index points to the thumb side for both hands
  const along = dot(ax, ay);
  ax[0] -= along * ay[0];
  ax[1] -= along * ay[1];
  ax[2] -= along * ay[2];
  if (normalize(ax) < 1e-6) return false;
  // Palm normal: x × y for the right hand, mirrored for the left.
  const mirror = handedness === 'left' ? -1 : 1;
  az[0] = mirror * (ax[1] * ay[2] - ax[2] * ay[1]);
  az[1] = mirror * (ax[2] * ay[0] - ax[0] * ay[2]);
  az[2] = mirror * (ax[0] * ay[1] - ax[1] * ay[0]);

  // Flexion and curl.
  for (let f = 0; f < 4; f++) {
    const m = FINGER_META[f];
    const mcp = flexion(m, m + 1, m + 2, mirror);
    const pip = flexion(m + 1, m + 2, m + 3, mirror);
    const dip = flexion(m + 2, m + 3, m + 4, mirror);
    out[F.flex + f * 3] = mcp;
    out[F.flex + f * 3 + 1] = pip;
    out[F.flex + f * 3 + 2] = dip;
    out[F.curl + 1 + f] = Math.min(1, Math.max(0, (mcp + pip + dip) / MAX_FINGER_FLEX));
  }
  const tMcp = flexion(J.thumbMeta, J.thumbProx, J.thumbDist);
  const tIp = flexion(J.thumbProx, J.thumbDist, J.thumbTip);
  sub(a, J.thumbProx, J.thumbMeta);
  normalize(a);
  out[F.flex + 12] = tMcp;
  out[F.flex + 13] = tIp;
  out[F.flex + 14] = dot(a, az); // opposition: thumb metacarpal swinging in front of the palm
  out[F.curl] = Math.min(1, Math.max(0, (Math.abs(tMcp) + Math.abs(tIp)) / MAX_THUMB_FLEX));

  // Fingertips in the palm frame.
  for (let t = 0; t < 5; t++) {
    sub(c, TIPS[t], J.wrist);
    out[F.tips + t * 3] = dot(c, ax) / scale;
    out[F.tips + t * 3 + 1] = dot(c, ay) / scale;
    out[F.tips + t * 3 + 2] = dot(c, az) / scale;
  }

  // Spread between neighbouring proximal phalanges, on the palm plane.
  // Attenuate by finger extension so curled fingers into a fist have ~0 spread.
  const angIndex = bonePlaneAngle(J.indexProx, J.indexInter);
  const angMiddle = bonePlaneAngle(J.middleProx, J.middleInter);
  const angRing = bonePlaneAngle(J.ringProx, J.ringInter);
  const angPinky = bonePlaneAngle(J.pinkyProx, J.pinkyInter);
  const extI = 1 - 0.85 * out[F.curl + 1];
  const extM = 1 - 0.85 * out[F.curl + 2];
  const extR = 1 - 0.85 * out[F.curl + 3];
  const extP = 1 - 0.85 * out[F.curl + 4];
  out[F.spread] = (angIndex - angMiddle) * extI * extM;
  out[F.spread + 1] = (angMiddle - angRing) * extM * extR;
  out[F.spread + 2] = (angRing - angPinky) * extR * extP;

  // Thumb placement.
  out[F.thumbTo] = dist(J.thumbTip, J.indexTip) / scale;
  out[F.thumbTo + 1] = dist(J.thumbTip, J.middleTip) / scale;
  out[F.thumbTo + 2] = dist(J.thumbTip, J.indexProx) / scale;
  out[F.thumbTo + 3] = dist(J.thumbTip, J.middleProx) / scale;
  out[F.thumbTo + 4] = dist(J.thumbTip, J.ringProx) / scale;
  out[F.thumbTo + 5] = dist(J.thumbTip, J.pinkyProx) / scale;

  out[F.cross] = out[F.tips + 3] - out[F.tips + 6];

  // Orientation relative to the viewer.
  if (head) {
    // Head basis: right = column 0, up = column 1, back = column 2.
    const rx = head[0], ry = head[1], rz = head[2];
    const ux = head[4], uy = head[5], uz = head[6];
    const bx = head[8], by = head[9], bz = head[10];
    out[F.palmNormal] = mirror * (az[0] * rx + az[1] * ry + az[2] * rz);
    out[F.palmNormal + 1] = az[0] * ux + az[1] * uy + az[2] * uz;
    out[F.palmNormal + 2] = az[0] * bx + az[1] * by + az[2] * bz;
    out[F.pointing] = mirror * (ay[0] * rx + ay[1] * ry + ay[2] * rz);
    out[F.pointing + 1] = ay[0] * ux + ay[1] * uy + ay[2] * uz;
    out[F.pointing + 2] = ay[0] * bx + ay[1] * by + ay[2] * bz;
  } else {
    for (let i = 0; i < 6; i++) out[F.palmNormal + i] = 0;
  }
  out[F.handScale] = scale;
  return true;
}

/** Coarse words for the palm direction, for debugging and coaching text. */
export function describePalm(features: Float32Array): string {
  const x = features[F.palmNormal];
  const y = features[F.palmNormal + 1];
  const z = features[F.palmNormal + 2];
  const ax2 = Math.abs(x), ay2 = Math.abs(y), az2 = Math.abs(z);
  if (az2 >= ax2 && az2 >= ay2) return z > 0 ? 'palm toward you' : 'palm away';
  if (ay2 >= ax2) return y > 0 ? 'palm up' : 'palm down';
  return x > 0 ? 'palm outward' : 'palm inward';
}

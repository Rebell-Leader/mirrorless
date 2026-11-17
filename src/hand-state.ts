/**
 * Per-frame hand-tracking state shared by systems. HandTrackingSystem writes
 * it once per frame; the probe, the recorder and (later) the recognizer read
 * it. Plain module, no IWSDK imports.
 */

import { FEATURE_COUNT, type Handedness, JOINT_COUNT } from './hand-features.js';

export interface HandFrame {
  /** 25 joint matrices (16 floats each) in the session reference space. */
  poses: Float32Array;
  /** Joint radii in metres (zeros when the runtime does not report them). */
  radii: Float32Array;
  features: Float32Array;
  /** The input source reported a hand and all joint poses were available. */
  tracked: boolean;
  /** Tracked and the pose produced a plausible feature vector. */
  valid: boolean;
}

function makeHand(): HandFrame {
  return {
    poses: new Float32Array(JOINT_COUNT * 16),
    radii: new Float32Array(JOINT_COUNT),
    features: new Float32Array(FEATURE_COUNT),
    tracked: false,
    valid: false,
  };
}

export const handState = {
  left: makeHand(),
  right: makeHand(),
  /** Viewer pose matrix in the same reference space. */
  head: new Float32Array(16),
  headValid: false,
  /** performance.now() of the last update, ms. */
  time: 0,
  /** Frames per second over the last second. */
  fps: 0,
};

export function hand(h: Handedness): HandFrame {
  return h === 'left' ? handState.left : handState.right;
}

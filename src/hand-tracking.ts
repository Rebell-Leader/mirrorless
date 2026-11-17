/**
 * Reads WebXR hand joints once per frame and publishes poses, radii and
 * hand-shape features to `handState`. Register before any system that reads it.
 */

import { createSystem } from '@iwsdk/core';
import { computeHandFeatures } from './hand-features.js';
import { handState, type HandFrame } from './hand-state.js';

type BatchedFrame = XRFrame & {
  fillPoses?: (spaces: XRSpace[], base: XRSpace, out: Float32Array) => boolean;
  fillJointRadii?: (spaces: XRJointSpace[], out: Float32Array) => boolean;
};

export class HandTrackingSystem extends createSystem({}) {
  private jointSpaces!: WeakMap<XRHand, XRJointSpace[]>;
  private frames = 0;
  private fpsTimer = 0;

  init(): void {
    this.jointSpaces = new WeakMap();
  }

  update(delta: number): void {
    this.frames++;
    this.fpsTimer += delta;
    if (this.fpsTimer >= 1) {
      handState.fps = Math.round(this.frames / this.fpsTimer);
      this.frames = 0;
      this.fpsTimer = 0;
    }

    const left = handState.left;
    const right = handState.right;
    left.tracked = left.valid = false;
    right.tracked = right.valid = false;
    handState.headValid = false;
    handState.time = performance.now();

    const frame = this.world.xrFrame as BatchedFrame | null;
    const ref = this.world.xrReferenceSpace;
    if (!frame || !ref) return;

    const viewer = frame.getViewerPose(ref);
    if (viewer) {
      handState.head.set(viewer.transform.matrix);
      handState.headValid = true;
    }

    for (const source of frame.session.inputSources) {
      const xrHand = source.hand;
      if (!xrHand || (source.handedness !== 'left' && source.handedness !== 'right')) continue;
      const state = source.handedness === 'left' ? left : right;
      let spaces = this.jointSpaces.get(xrHand);
      if (!spaces) {
        spaces = Array.from(xrHand.values());
        this.jointSpaces.set(xrHand, spaces);
      }
      if (!this.readJoints(frame, spaces, ref, state)) continue;
      state.tracked = true;
      state.valid = computeHandFeatures(
        state.poses,
        source.handedness,
        handState.headValid ? handState.head : null,
        state.features,
      );
    }
  }

  private readJoints(
    frame: BatchedFrame,
    spaces: XRJointSpace[],
    ref: XRReferenceSpace,
    state: HandFrame,
  ): boolean {
    if (typeof frame.fillPoses === 'function') {
      if (!frame.fillPoses(spaces, ref, state.poses)) return false;
    } else {
      for (let i = 0; i < spaces.length; i++) {
        const pose = frame.getJointPose?.(spaces[i], ref);
        if (!pose) return false;
        state.poses.set(pose.transform.matrix, i * 16);
      }
    }
    if (typeof frame.fillJointRadii !== 'function' || !frame.fillJointRadii(spaces, state.radii)) {
      state.radii.fill(0);
    }
    return true;
  }
}

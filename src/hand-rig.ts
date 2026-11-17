/**
 * Reusable, zero-allocation 3D Hand Rig built from @iwsdk/core Three.js
 * primitives (25 joint spheres + 20 phalanx cylinders + wrist progress halo).
 *
 * Used in three spatial roles:
 * 1. First-person Wrist-Anchored Ghost Hand (translucent, per-finger green/amber glow)
 * 2. Reader's View Replay Hand across the table (replays learner's recorded word)
 * 3. Synthetic Table Tutor Hand (spells words on the real/fallback table in Reading Mode)
 */

import {
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  RingGeometry,
  SphereGeometry,
  Vector3,
} from '@iwsdk/core';
import { J, JOINT_COUNT } from './hand-features.js';

/** Bone segments [startJoint, endJoint, fingerIndex (-1 = palm, 0 = thumb..4 = pinky)]. */
const BONES: Array<[number, number, number]> = [
  // Thumb (0)
  [J.wrist, J.thumbMeta, 0],
  [J.thumbMeta, J.thumbProx, 0],
  [J.thumbProx, J.thumbDist, 0],
  [J.thumbDist, J.thumbTip, 0],
  // Index (1)
  [J.wrist, J.indexMeta, -1],
  [J.indexMeta, J.indexProx, -1],
  [J.indexProx, J.indexInter, 1],
  [J.indexInter, J.indexDist, 1],
  [J.indexDist, J.indexTip, 1],
  // Middle (2)
  [J.wrist, J.middleMeta, -1],
  [J.middleMeta, J.middleProx, -1],
  [J.middleProx, J.middleInter, 2],
  [J.middleInter, J.middleDist, 2],
  [J.middleDist, J.middleTip, 2],
  // Ring (3)
  [J.wrist, J.ringMeta, -1],
  [J.ringMeta, J.ringProx, -1],
  [J.ringProx, J.ringInter, 3],
  [J.ringInter, J.ringDist, 3],
  [J.ringDist, J.ringTip, 3],
  // Pinky (4)
  [J.wrist, J.pinkyMeta, -1],
  [J.pinkyMeta, J.pinkyProx, -1],
  [J.pinkyProx, J.pinkyInter, 4],
  [J.pinkyInter, J.pinkyDist, 4],
  [J.pinkyDist, J.pinkyTip, 4],
  // Across-knuckle palm bridge
  [J.indexProx, J.middleProx, -1],
  [J.middleProx, J.ringProx, -1],
  [J.ringProx, J.pinkyProx, -1],
];

function jointFingerIndex(j: number): number {
  if (j >= J.thumbMeta && j <= J.thumbTip) return 0;
  if (j >= J.indexProx && j <= J.indexTip) return 1;
  if (j >= J.middleProx && j <= J.middleTip) return 2;
  if (j >= J.ringProx && j <= J.ringTip) return 3;
  if (j >= J.pinkyProx && j <= J.pinkyTip) return 4;
  return -1; // wrist & metacarpals
}

export type HandVisualStyle = 'ghost' | 'tutor' | 'replay';

const COL_GHOST_IDLE = new Color('#3ee6c1');
const COL_GHOST_MATCH = new Color('#18e08a');
const COL_GHOST_WARN = new Color('#f5a623');
const COL_GHOST_SELF = new Color('#7aa2ff');
const COL_PALM_GHOST = new Color('#29b89b');

const COL_TUTOR_PALM = new Color('#d8dee9');
const COL_TUTOR_FINGER = [
  new Color('#5eead4'), // thumb highlighted so thumb tuck is easy to read
  new Color('#f8fafc'), // index
  new Color('#e2e8f0'), // middle
  new Color('#cbd5e1'), // ring
  new Color('#94a3b8'), // pinky
];

const COL_REPLAY_PALM = new Color('#93c5fd');
const COL_REPLAY_FINGER = new Color('#60a5fa');

export class HandRig {
  public readonly root: Group;
  private readonly joints: Mesh[] = [];
  private readonly bones: Mesh[] = [];
  private readonly palmMat: MeshStandardMaterial;
  private readonly fingerMats: MeshStandardMaterial[] = [];
  private readonly haloMesh: Mesh;
  private readonly haloMat: MeshStandardMaterial;

  private readonly tmpA = new Vector3();
  private readonly tmpB = new Vector3();
  private readonly tmpMid = new Vector3();
  private readonly tmpDir = new Vector3();
  private readonly tmpUp = new Vector3(0, 1, 0);
  private readonly tmpQuat = new Quaternion();

  constructor(style: HandVisualStyle, name = 'HandRig') {
    this.root = new Group();
    this.root.name = name;

    const isGhost = style === 'ghost';
    this.palmMat = new MeshStandardMaterial({
      color: isGhost ? COL_PALM_GHOST : style === 'tutor' ? COL_TUTOR_PALM : COL_REPLAY_PALM,
      emissive: isGhost ? COL_PALM_GHOST : new Color('#1e293b'),
      emissiveIntensity: isGhost ? 0.35 : 0.18,
      roughness: 0.35,
      metalness: 0.08,
      transparent: isGhost,
      opacity: isGhost ? 0.48 : 0.96,
      depthWrite: !isGhost,
    });

    for (let f = 0; f < 5; f++) {
      const baseCol = isGhost
        ? COL_GHOST_IDLE
        : style === 'tutor'
          ? COL_TUTOR_FINGER[f]
          : COL_REPLAY_FINGER;
      this.fingerMats.push(
        new MeshStandardMaterial({
          color: baseCol.clone(),
          emissive: baseCol.clone(),
          emissiveIntensity: isGhost ? 0.45 : 0.22,
          roughness: 0.3,
          metalness: 0.05,
          transparent: isGhost,
          opacity: isGhost ? 0.62 : 0.98,
          depthWrite: !isGhost,
        }),
      );
    }

    const sphereGeo = new SphereGeometry(1, 10, 8);
    const cylGeo = new CylinderGeometry(1, 1, 1, 8, 1);

    for (let j = 0; j < JOINT_COUNT; j++) {
      const fIdx = jointFingerIndex(j);
      const mat = fIdx >= 0 ? this.fingerMats[fIdx] : this.palmMat;
      const mesh = new Mesh(sphereGeo, mat);
      const isTip = j === J.thumbTip || j === J.indexTip || j === J.middleTip || j === J.ringTip || j === J.pinkyTip;
      const r = j === J.wrist ? 0.011 : isTip ? 0.0068 : 0.0076;
      mesh.scale.setScalar(r);
      this.root.add(mesh);
      this.joints.push(mesh);
    }

    for (const [, , fIdx] of BONES) {
      const mat = fIdx >= 0 ? this.fingerMats[fIdx] : this.palmMat;
      const mesh = new Mesh(cylGeo, mat);
      this.root.add(mesh);
      this.bones.push(mesh);
    }

    // Visual progress/status halo around the wrist (for Deaf / visual-first cues).
    const ringGeo = new RingGeometry(0.032, 0.041, 24);
    this.haloMat = new MeshStandardMaterial({
      color: COL_GHOST_IDLE.clone(),
      emissive: COL_GHOST_IDLE.clone(),
      emissiveIntensity: 0.7,
      side: DoubleSide,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    this.haloMesh = new Mesh(ringGeo, this.haloMat);
    this.root.add(this.haloMesh);
  }

  /**
   * Updates all 25 joint spheres and connecting bone cylinders from a 25 × 16
   * joint matrix array. Zero per-frame heap allocations.
   */
  updateFromPoses(poses: Float32Array): void {
    for (let j = 0; j < JOINT_COUNT; j++) {
      const m = j * 16;
      this.joints[j].position.set(poses[m + 12], poses[m + 13], poses[m + 14]);
    }

    for (let b = 0; b < BONES.length; b++) {
      const [j0, j1] = BONES[b];
      const bone = this.bones[b];
      this.tmpA.copy(this.joints[j0].position);
      this.tmpB.copy(this.joints[j1].position);
      const dist = this.tmpA.distanceTo(this.tmpB);
      if (dist < 1e-4) {
        bone.visible = false;
        continue;
      }
      bone.visible = true;
      this.tmpMid.addVectors(this.tmpA, this.tmpB).multiplyScalar(0.5);
      bone.position.copy(this.tmpMid);
      this.tmpDir.subVectors(this.tmpB, this.tmpA).divideScalar(dist);
      this.tmpQuat.setFromUnitVectors(this.tmpUp, this.tmpDir);
      bone.quaternion.copy(this.tmpQuat);
      bone.scale.set(0.0048, dist, 0.0048);
    }

    // Position the visual status halo at the wrist, oriented along the forearm/palm.
    this.haloMesh.position.copy(this.joints[J.wrist].position);
    this.tmpDir.subVectors(this.joints[J.middleProx].position, this.joints[J.wrist].position);
    if (this.tmpDir.lengthSq() > 1e-6) {
      this.tmpDir.normalize();
      this.tmpQuat.setFromUnitVectors(this.tmpUp, this.tmpDir);
      this.haloMesh.quaternion.copy(this.tmpQuat);
    }
  }

  /**
   * Updates per-finger Ghost Hand coloring and wrist halo progress.
   *
   * @param perFinger 5 scores in [0, 1] (thumb..pinky)
   * @param holdProgress01 Hold completion in [0, 1]
   * @param mode 'matching' | 'pass' | 'self-check' | 'idle'
   * @param faded True when ghost fades slightly as learner masters letters
   */
  updateGhostFeedback(
    perFinger: ArrayLike<number>,
    holdProgress01: number,
    mode: 'matching' | 'pass' | 'self-check' | 'idle',
    faded = false,
  ): void {
    const baseOpacity = faded ? 0.38 : 0.62;
    for (let f = 0; f < 5; f++) {
      const mat = this.fingerMats[f];
      const score = perFinger[f] ?? 0;
      if (mode === 'pass') {
        mat.color.copy(COL_GHOST_MATCH);
        mat.emissive.copy(COL_GHOST_MATCH);
        mat.emissiveIntensity = 0.85;
        mat.opacity = 0.88;
      } else if (mode === 'self-check') {
        mat.color.copy(score >= 0.68 ? COL_GHOST_MATCH : COL_GHOST_SELF);
        mat.emissive.copy(score >= 0.68 ? COL_GHOST_MATCH : COL_GHOST_SELF);
        mat.emissiveIntensity = 0.55;
        mat.opacity = baseOpacity + 0.1;
      } else if (mode === 'matching') {
        if (score >= 0.7) {
          mat.color.copy(COL_GHOST_MATCH);
          mat.emissive.copy(COL_GHOST_MATCH);
          mat.emissiveIntensity = 0.65;
          mat.opacity = baseOpacity + 0.15;
        } else {
          mat.color.copy(COL_GHOST_WARN);
          mat.emissive.copy(COL_GHOST_WARN);
          mat.emissiveIntensity = 0.5;
          mat.opacity = baseOpacity + 0.08;
        }
      } else {
        mat.color.copy(COL_GHOST_IDLE);
        mat.emissive.copy(COL_GHOST_IDLE);
        mat.emissiveIntensity = 0.4;
        mat.opacity = baseOpacity;
      }
    }

    // Halo visual pulse (visual-first feedback for Deaf and muted users).
    const scale = 0.85 + Math.min(1, Math.max(0, holdProgress01)) * 0.55;
    this.haloMesh.scale.setScalar(scale);
    if (mode === 'pass') {
      this.haloMat.color.copy(COL_GHOST_MATCH);
      this.haloMat.emissive.copy(COL_GHOST_MATCH);
      this.haloMat.opacity = 0.95;
    } else if (mode === 'self-check') {
      this.haloMat.color.copy(COL_GHOST_SELF);
      this.haloMat.emissive.copy(COL_GHOST_SELF);
      this.haloMat.opacity = 0.82;
    } else if (holdProgress01 > 0.05) {
      this.haloMat.color.copy(COL_GHOST_MATCH);
      this.haloMat.emissive.copy(COL_GHOST_MATCH);
      this.haloMat.opacity = 0.5 + holdProgress01 * 0.45;
    } else {
      this.haloMat.color.copy(COL_GHOST_IDLE);
      this.haloMat.emissive.copy(COL_GHOST_IDLE);
      this.haloMat.opacity = 0.35;
    }
  }
}

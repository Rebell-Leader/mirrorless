/**
 * Geometry sanity checks for hand-features.ts on synthetic hands.
 * Run with: npm test   (Node's built-in test runner with type stripping)
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeHandFeatures,
  describePalm,
  F,
  FEATURE_COUNT,
  J,
  JOINT_COUNT,
} from '../src/hand-features.ts';

type V = [number, number, number];

/** Right hand, palm facing away from the viewer (−Z), fingers up (+Y), thumb toward −X. */
function rightHand(curled: boolean): V[] {
  const p: V[] = new Array(JOINT_COUNT);
  p[J.wrist] = [0, 0, 0];
  p[J.thumbMeta] = [-0.02, 0.02, 0];
  p[J.thumbProx] = [-0.045, 0.045, 0];
  p[J.thumbDist] = [-0.06, 0.07, 0];
  p[J.thumbTip] = [-0.07, 0.09, 0];
  const xs = [-0.02, 0, 0.02, 0.04];
  const metas = [J.indexMeta, J.middleMeta, J.ringMeta, J.pinkyMeta];
  metas.forEach((m, i) => {
    const x = xs[i];
    p[m] = [x * 0.5, 0.01, 0];
    p[m + 1] = [x, 0.09, 0];
    if (curled) {
      // MCP 90° toward the palm (−Z), PIP 90° down, DIP 90° back toward the palm side.
      p[m + 2] = [x, 0.09, -0.045];
      p[m + 3] = [x, 0.065, -0.045];
      p[m + 4] = [x, 0.065, -0.025];
    } else {
      p[m + 2] = [x, 0.135, 0];
      p[m + 3] = [x, 0.16, 0];
      p[m + 4] = [x, 0.18, 0];
    }
  });
  return p;
}

function mirrorX(p: V[]): V[] {
  return p.map(([x, y, z]) => [-x, y, z] as V);
}

function toPoses(p: V[]): Float32Array {
  const out = new Float32Array(JOINT_COUNT * 16);
  p.forEach(([x, y, z], j) => {
    out[j * 16] = 1;
    out[j * 16 + 5] = 1;
    out[j * 16 + 10] = 1;
    out[j * 16 + 12] = x;
    out[j * 16 + 13] = y;
    out[j * 16 + 14] = z;
    out[j * 16 + 15] = 1;
  });
  return out;
}

// Viewer at the origin looking down −Z: right = +X, up = +Y, back = +Z.
const HEAD = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

test('open right hand: fingers straight, palm away', () => {
  const f = new Float32Array(FEATURE_COUNT);
  assert.equal(computeHandFeatures(toPoses(rightHand(false)), 'right', HEAD, f), true);
  for (let i = 1; i < 5; i++) assert.ok(f[F.curl + i] < 0.05, `finger ${i} curl ${f[F.curl + i]}`);
  assert.equal(describePalm(f), 'palm away');
  assert.ok(Math.abs(f[F.handScale] - 0.09) < 1e-6);
});

test('fist: fingers curled with positive (palmward) flexion at every joint', () => {
  const f = new Float32Array(FEATURE_COUNT);
  assert.equal(computeHandFeatures(toPoses(rightHand(true)), 'right', HEAD, f), true);
  for (let i = 1; i < 5; i++) assert.ok(f[F.curl + i] > 0.95, `finger ${i} curl ${f[F.curl + i]}`);
  for (let k = 0; k < 12; k++) assert.ok(f[F.flex + k] > 1.5, `flex ${k} = ${f[F.flex + k]}`);
});

test('mirrored left hand produces the same features as the right hand', () => {
  for (const curled of [false, true]) {
    const r = new Float32Array(FEATURE_COUNT);
    const l = new Float32Array(FEATURE_COUNT);
    computeHandFeatures(toPoses(rightHand(curled)), 'right', HEAD, r);
    assert.equal(computeHandFeatures(toPoses(mirrorX(rightHand(curled))), 'left', HEAD, l), true);
    for (let i = 0; i < FEATURE_COUNT; i++) {
      assert.ok(Math.abs(r[i] - l[i]) < 1e-5, `feature ${i}: right ${r[i]} vs left ${l[i]}`);
    }
  }
});

test('degenerate input is rejected', () => {
  const f = new Float32Array(FEATURE_COUNT);
  assert.equal(computeHandFeatures(new Float32Array(JOINT_COUNT * 16), 'right', HEAD, f), false);
  const nan = toPoses(rightHand(false));
  nan[12] = Number.NaN;
  assert.equal(computeHandFeatures(nan, 'right', HEAD, f), false);
});

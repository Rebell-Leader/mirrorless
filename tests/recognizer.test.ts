/**
 * Recognizer math on synthetic feature vectors.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FEATURE_COUNT } from '../src/hand-features.ts';
import { classify, medianVector, SHAPE_VECTOR_DIMS, shapeVector, trainModel } from '../src/recognizer.ts';
import { validateTake } from '../src/recording-schema.ts';

function features(seed: number, noise = 0): Float32Array {
  const f = new Float32Array(FEATURE_COUNT);
  for (let i = 0; i < FEATURE_COUNT; i++) {
    f[i] = Math.sin(seed * 7.13 + i * 1.7) + (noise ? (Math.sin(i * 13.1 + seed * 91.7) * noise) : 0);
  }
  return f;
}

test('shapeVector excludes hand scale and has the documented size', () => {
  assert.equal(SHAPE_VECTOR_DIMS, 51);
  assert.equal(shapeVector(features(1)).length, 51);
});

test('medianVector ignores a single outlier frame', () => {
  const frames = [features(1), features(1), features(1), features(9)];
  const m = medianVector([...frames, features(1)]);
  const ref = shapeVector(features(1));
  for (let d = 0; d < SHAPE_VECTOR_DIMS; d++) assert.ok(Math.abs(m[d] - ref[d]) < 1e-6);
});

test('nearest template wins with a clear margin; near-ties get a low margin', () => {
  const samples = ['A', 'B', 'C'].flatMap((label, k) =>
    [0.01, 0.02, 0.03].map((n) => ({ label, vec: shapeVector(features(k + 1, n)) })),
  );
  const model = trainModel(samples);
  const clear = classify(model, shapeVector(features(2, 0.015)));
  assert.equal(clear.label, 'B');
  assert.ok(clear.margin > 0.5, `margin ${clear.margin}`);

  // A point halfway between A and B is ambiguous.
  const a = shapeVector(features(1));
  const b = shapeVector(features(2));
  const mid = a.map((v, d) => (v + b[d]) / 2);
  const amb = classify(model, mid);
  assert.ok(amb.margin < 0.2, `margin ${amb.margin}`);
});

test('validateTake accepts letters and words, rejects bad labels', () => {
  const frame = { t: 0, joints: new Array(400).fill(0), radii: new Array(25).fill(0), head: new Array(16).fill(0), features: new Array(52).fill(0) };
  const base = {
    schema: 'mirrorless.recording.v1', sessionId: 's1', hand: 'right', take: 1, motion: false,
    recordedAt: '', durationMs: 0, fps: 72, userAgent: '', frames: new Array(6).fill(frame),
  };
  assert.equal(validateTake({ ...base, kind: 'letter', label: 'A' }), null);
  assert.equal(validateTake({ ...base, kind: 'word', label: 'MAYA', motion: true }), null);
  assert.equal(validateTake({ ...base, kind: 'letter', label: 'AB' }), 'bad label');
  assert.equal(validateTake({ ...base, kind: 'word', label: '../x' }), 'bad label');
  assert.equal(validateTake({ ...base, kind: 'letter', label: 'A', sessionId: '../../etc' }), 'bad sessionId');
});

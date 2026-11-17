/**
 * Unit tests for canonical 26-letter 3D poses, hybrid grading, and word
 * trajectory bounce/double-letter analysis.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ASL_LETTERS, LETTER_INDEX } from '../src/asl-letters.ts';
import { checkFingers, checkPalm } from '../src/finger-gate.ts';
import { computeHandFeatures, F, FEATURE_COUNT } from '../src/hand-features.ts';
import {
  analyzeWordDynamics,
  buildCanonicalModel,
  buildModelWithRecorded,
  canonicalLetterFeatures,
  REPLAY_FRAME_FLOATS,
  synthesizeLetterPoses,
  synthesizeWordPose,
  writeReaderViewPose,
} from '../src/hand-poses.ts';
import {
  classify,
  gradeAttempt,
  HIGH_OCCLUSION_LETTERS,
  shapeVector,
  trainModel,
} from '../src/recognizer.ts';

const HEAD = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

test('all 26 canonical ASL letters pass checkFingers and checkPalm on both hands', () => {
  for (const letter of ASL_LETTERS) {
    const r = new Float32Array(FEATURE_COUNT);
    const l = new Float32Array(FEATURE_COUNT);
    const posesR = synthesizeLetterPoses(letter.letter, 'right', 0.09, 0, [0, 0, 0], HEAD);
    const posesL = synthesizeLetterPoses(letter.letter, 'left', 0.09, 0, [0, 0, 0], HEAD);

    assert.equal(computeHandFeatures(posesR, 'right', HEAD, r), true, `valid right ${letter.letter}`);
    assert.equal(computeHandFeatures(posesL, 'left', HEAD, l), true, `valid left ${letter.letter}`);

    // Left and right hands must produce identical feature vectors.
    for (let i = 0; i < FEATURE_COUNT; i++) {
      assert.ok(
        Math.abs(r[i] - l[i]) < 1e-4,
        `${letter.letter} feature ${i}: right ${r[i]} vs left ${l[i]}`,
      );
    }

    const gate = checkFingers(letter.fingers, r);
    assert.equal(gate.pass, true, `${letter.letter} failed finger gate: ${gate.problems.join(', ')}`);
    const palm = checkPalm(letter.palm, r);
    assert.equal(palm, null, `${letter.letter} failed palm check: ${palm}`);
  }
});

test('canonical model classifies all 24 static letters and grades L/B/Y as pass', () => {
  const model = buildCanonicalModel('right');
  for (const letter of ASL_LETTERS) {
    if (letter.motion) continue;
    const f = canonicalLetterFeatures(letter.letter, 'right');
    const c = classify(model, shapeVector(f));
    assert.equal(c.label, letter.letter, `expected ${letter.letter}, got ${c.label}`);
  }

  for (const easy of ['L', 'B', 'Y']) {
    const info = LETTER_INDEX[easy];
    const f = canonicalLetterFeatures(easy, 'right');
    const grade = gradeAttempt(model, info, f, f);
    assert.equal(grade.verdict, 'pass', `${easy} should pass, got ${grade.verdict}: ${grade.feedback}`);
  }

  // Holding S when asked for A or B must never pass (Judge check J4).
  const sFeatures = canonicalLetterFeatures('S', 'right');
  const gradeSForB = gradeAttempt(model, LETTER_INDEX.B, sFeatures);
  assert.notEqual(gradeSForB.verdict, 'pass', 'holding S for B must not pass');
  const gradeSForA = gradeAttempt(model, LETTER_INDEX.A, sFeatures);
  assert.notEqual(gradeSForA.verdict, 'pass', 'holding S for A must not pass');
});

test('occluded letters are never auto-passed, and a hidden thumb never gets a false fix', () => {
  const model = buildCanonicalModel('right');
  for (const l of ['M', 'N', 'T', 'S', 'E', 'R', 'A']) {
    assert.ok(HIGH_OCCLUSION_LETTERS.has(l), `${l} should be in the abstention set`);
    // Even a perfect canonical shape is not passed by the app.
    const own = canonicalLetterFeatures(l, 'right');
    assert.equal(gradeAttempt(model, LETTER_INDEX[l], own, own).verdict, 'self-check', `${l} own shape`);
  }
  // A wrong thumb on a fist letter must not become a "fix your thumb" fail either.
  for (const [want, shown] of [['M', 'S'], ['T', 'A'], ['S', 'A'], ['A', 'S'], ['R', 'V']]) {
    const g = gradeAttempt(model, LETTER_INDEX[want], canonicalLetterFeatures(shown, 'right'));
    assert.equal(g.verdict, 'self-check', `asked ${want}, showed ${shown}: ${g.feedback}`);
  }
  // Clearly wrong fingers are still coached (e.g. an open B when asked for M).
  const b = gradeAttempt(model, LETTER_INDEX.M, canonicalLetterFeatures('B', 'right'));
  assert.equal(b.verdict, 'coach');
});

function lcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    const u = (s / 4294967296) || 1e-9;
    s = (s * 1664525 + 1013904223) >>> 0;
    return Math.sqrt(-2 * Math.log(u)) * Math.cos((2 * Math.PI * s) / 4294967296);
  };
}

test('bounce check: still wrist with tracker jitter stays steady however long the attempt (D5)', () => {
  const gauss = lcg(7);
  for (const seconds of [3, 10, 20]) {
    const track = [];
    for (let t = 0; t < seconds * 1000; t += 30) {
      track.push({ t, x: gauss() * 0.001, y: 1.2 + gauss() * 0.0015, z: -0.35 + gauss() * 0.001 });
    }
    const r = analyzeWordDynamics(track, 'MAYA');
    assert.equal(r.measured, true);
    assert.equal(r.isBouncy, false, `${seconds}s still wrist flagged bouncy (${r.bounceCm} cm, ${r.bigSwings} swings)`);
    assert.ok((r.steadinessScore ?? 0) >= 90, `${seconds}s steadiness ${r.steadinessScore}`);
  }
});

test('bounce check: stamping each letter is flagged, a slow height drift is not', () => {
  const stamping = [];
  for (let t = 0; t < 4000; t += 30) {
    // About one 4 cm down-up pump per letter (MAYA spelled over 4 s).
    stamping.push({ t, x: 0, y: 1.2 + 0.02 * Math.sin((2 * Math.PI * t) / 1000), z: -0.35 });
  }
  const bouncy = analyzeWordDynamics(stamping, 'MAYA');
  assert.equal(bouncy.isBouncy, true, `stamping: ${bouncy.bigSwings} swings`);
  assert.ok((bouncy.steadinessScore ?? 100) < 80, `stamping steadiness ${bouncy.steadinessScore}`);

  const drift = [];
  for (let t = 0; t < 5000; t += 30) drift.push({ t, x: 0, y: 1.2 - (0.06 * t) / 5000, z: -0.35 });
  const steady = analyzeWordDynamics(drift, 'BOOK');
  assert.equal(steady.isBouncy, false, 'a 6 cm slow drift is not bounce');
  assert.equal(steady.doublePair, 'OO');
  assert.match(steady.summary, /does not grade it yet/u, 'double letters are explained, not graded');
});

test('bounce check: too little data is reported as not measured, never as praise', () => {
  const r = analyzeWordDynamics([{ t: 0, x: 0, y: 1.2, z: -0.3 }, { t: 30, x: 0, y: 1.2, z: -0.3 }], 'MAYA');
  assert.equal(r.measured, false);
  assert.equal(r.steadinessScore, null);
  assert.equal(r.isBouncy, false);
  assert.match(r.summary, /Not enough/u);
  assert.equal(analyzeWordDynamics([], 'BOOK').measured, false);
});

test("reader's view replay turns the learner's own recorded hand 180 degrees onto the anchor", () => {
  const poses = synthesizeLetterPoses('L', 'right', 0.09, 0, [0.1, 1.25, -0.4], HEAD);
  const frames = new Float32Array(2 * REPLAY_FRAME_FLOATS);
  for (let f = 0; f < 2; f++) {
    for (let j = 0; j < 25; j++) {
      frames[f * REPLAY_FRAME_FLOATS + j * 3] = poses[j * 16 + 12] + f * 0.02; // second frame slid 2 cm right
      frames[f * REPLAY_FRAME_FLOATS + j * 3 + 1] = poses[j * 16 + 13];
      frames[f * REPLAY_FRAME_FLOATS + j * 3 + 2] = poses[j * 16 + 14];
    }
  }
  const pivot = [0.1, 1.25, -0.4];
  const anchor = [0, 0.9, -0.8];
  const out = new Float32Array(25 * 16);
  writeReaderViewPose(frames, 0, 1, 0, pivot, anchor, out);
  // Wrist (at the pivot) lands on the anchor.
  assert.ok(Math.abs(out[12] - anchor[0]) < 1e-6 && Math.abs(out[13] - anchor[1]) < 1e-6 && Math.abs(out[14] - anchor[2]) < 1e-6);
  // 180 deg about vertical: horizontal offsets from the pivot flip sign, height is kept.
  const thumbTip = 4 * 16 + 12;
  assert.ok(Math.abs(out[thumbTip] - anchor[0] + (poses[thumbTip] - pivot[0])) < 1e-6);
  assert.ok(Math.abs(out[thumbTip + 1] - anchor[1] - (poses[thumbTip + 1] - pivot[1])) < 1e-6);
  assert.ok(Math.abs(out[thumbTip + 2] - anchor[2] + (poses[thumbTip + 2] - pivot[2])) < 1e-6);
  // Bone lengths are preserved (a rotation, not a squash or mirror-scale).
  const d = (o: Float32Array, a: number, b: number) =>
    Math.hypot(o[a * 16 + 12] - o[b * 16 + 12], o[a * 16 + 13] - o[b * 16 + 13], o[a * 16 + 14] - o[b * 16 + 14]);
  assert.ok(Math.abs(d(out, 0, 9) - d(poses, 0, 9)) < 1e-6);
  // The signer's rightward slide reads as leftward to the reader, interpolated.
  writeReaderViewPose(frames, 0, 1, 0.5, pivot, anchor, out);
  assert.ok(Math.abs(out[12] - (anchor[0] - 0.01)) < 1e-6);
});

test('recorded model merges with the canonical model instead of replacing it', () => {
  const lFeat = canonicalLetterFeatures('L', 'right');
  const recorded = trainModel([
    { label: 'L', vec: Array.from(shapeVector(lFeat)) },
    { label: 'L', vec: Array.from(shapeVector(lFeat)).map((v) => v * 1.02) },
  ]);
  const merged = buildModelWithRecorded('right', recorded);
  assert.ok(merged, 'valid recorded model merges');
  const canonical = buildCanonicalModel('right');
  assert.equal(merged.templates.length, canonical.templates.length + 2);
  // Letters that were never recorded still classify correctly.
  for (const l of ['B', 'Y', 'W', 'C']) {
    assert.equal(classify(merged, shapeVector(canonicalLetterFeatures(l, 'right'))).label, l);
  }
  assert.equal(buildModelWithRecorded('right', { ...recorded, dims: 3 }), null, 'wrong dims rejected');
  assert.equal(buildModelWithRecorded('right', { version: 1 }), null, 'incomplete file rejected');
});

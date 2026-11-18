/**
 * The palm-direction convention must agree between the ghost hand (synthetic
 * poses), the feature extractor and the palm check. Recorded takes showed most
 * "forward" letters signed palm-toward-you; the check is right to reject them.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ASL_LETTERS } from '../src/asl-letters.ts';
import { checkPalm } from '../src/finger-gate.ts';
import { F } from '../src/hand-features.ts';
import { canonicalLetterFeatures } from '../src/hand-poses.ts';

test('every ghost-hand letter passes its own palm check (right and left hand)', () => {
  for (const hand of ['right', 'left'] as const) {
    for (const l of ASL_LETTERS) {
      const f = canonicalLetterFeatures(l.letter, hand);
      assert.equal(checkPalm(l.palm, f), null, `${hand} ${l.letter} (palm ${l.palm})`);
    }
  }
});

test('palm-forward letters face away from the viewer in the feature space', () => {
  for (const letter of ['B', 'L', 'Y']) {
    const f = canonicalLetterFeatures(letter, 'right');
    assert.ok(f[F.palmNormal + 2] < -0.5, `${letter} palm normal z = ${f[F.palmNormal + 2]}`);
  }
});

test('a palm-toward-you L is rejected with a "palm forward" hint', () => {
  const f = canonicalLetterFeatures('L', 'right');
  // Turn the palm to face the viewer (what most recorded takes did).
  f[F.palmNormal] = 0;
  f[F.palmNormal + 1] = 0.3;
  f[F.palmNormal + 2] = 0.9;
  assert.match(checkPalm('forward', f) ?? '', /palm forward/u);
});

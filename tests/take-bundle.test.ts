/**
 * Unit tests for the headset take bundle (hosted recorder → laptop import).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseTakeBundle,
  RECORDING_SCHEMA,
  type RecordingTake,
  TAKE_BUNDLE_SCHEMA,
  TAKE_FILE_RE,
  takeFileName,
} from '../src/recording-schema.ts';

function makeTake(label = 'A', take = 1): RecordingTake {
  const frame = { t: 0, joints: new Array(400).fill(0), radii: new Array(25).fill(0), head: new Array(16).fill(0), features: new Array(52).fill(0) };
  return {
    schema: RECORDING_SCHEMA,
    sessionId: 's20261117-221500',
    kind: 'letter',
    label,
    hand: 'right',
    take,
    motion: false,
    recordedAt: '2026-11-17T21:15:00.000Z',
    durationMs: 40,
    fps: 72,
    userAgent: 'test',
    frames: [0, 10, 20, 30, 40].map((t) => ({ ...frame, t })),
  };
}

test('headset file names match the layout the dev server writes', () => {
  const file = takeFileName(makeTake('B', 2), 1794955431861);
  assert.equal(file, 's20261117-221500/B-right-t2-1794955431861.json');
  assert.match(file, TAKE_FILE_RE);
});

test('a valid bundle imports every take', () => {
  const a = makeTake('A', 1);
  const b = makeTake('B', 3);
  const bundle = {
    schema: TAKE_BUNDLE_SCHEMA,
    exportedAt: '2026-11-17T22:00:00.000Z',
    takes: [
      { file: takeFileName(a, 1794955431861), take: a },
      { file: takeFileName(b, 1794955431999), take: b },
    ],
  };
  const { takes, errors } = parseTakeBundle(JSON.parse(JSON.stringify(bundle)));
  assert.deepEqual(errors, []);
  assert.equal(takes.length, 2);
  assert.equal(takes[1].take.label, 'B');
});

test('bad bundles and entries are rejected, never written', () => {
  assert.deepEqual(parseTakeBundle({ schema: 'something-else', takes: [] }).errors, ['not a Mirrorless take bundle']);
  assert.equal(parseTakeBundle(null).takes.length, 0);

  const good = makeTake('A', 1);
  const broken = { ...makeTake('C', 1), frames: [] };
  const { takes, errors } = parseTakeBundle({
    schema: TAKE_BUNDLE_SCHEMA,
    exportedAt: '',
    takes: [
      { file: '../../etc/passwd', take: good }, // path traversal
      { file: 's20261117-221500/A-right-t1-1794955431861.json/../x.json', take: good },
      { file: takeFileName(broken, 1794955431861), take: broken }, // invalid take
      { file: 's20261117-221500/Z-right-t1-1794955431861.json', take: good }, // name/content mismatch
      { file: takeFileName(good, 1794955431861), take: good },
    ],
  });
  assert.equal(takes.length, 1, `only the good entry survives: ${errors.join('; ')}`);
  assert.equal(errors.length, 4);
});

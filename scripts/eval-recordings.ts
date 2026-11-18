/**
 * Offline evaluation of recorded letters.
 *
 *   pnpm eval:recordings [--hand right] [--dir data/recordings] [--out data/models]
 *
 * - Static letter takes → one median shape vector each.
 * - Leave-one-session-out cross-validation when there are 2+ sessions,
 *   otherwise leave-one-take-out (optimistic: same session, say so).
 * - Reports per-letter accuracy, top confusions, and an abstention curve
 *   (accuracy on graded attempts vs. share of attempts graded) over margins.
 * - Writes the full model (all takes) to <out>/templates-<hand>.json with the
 *   suggested abstention margin and per-letter reliability.
 * - Skips static takes whose palm faces the wrong way for the letter (most
 *   letters are signed palm away from you), so a palm-toward-you "L" never
 *   becomes an L template. Pass --keep-wrong-palm to include them anyway.
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { LETTER_INDEX } from '../src/asl-letters.ts';
import { checkPalm } from '../src/finger-gate.ts';
import { classify, medianVector, trainModel, type LabeledVector } from '../src/recognizer.ts';
import { validateTake, type RecordingTake } from '../src/recording-schema.ts';

interface Sample extends LabeledVector {
  session: string;
  file: string;
}

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function loadTakes(dir: string): Promise<Array<{ take: RecordingTake; file: string }>> {
  const out: Array<{ take: RecordingTake; file: string }> = [];
  let sessions: string[] = [];
  try {
    sessions = await readdir(dir);
  } catch {
    return out;
  }
  for (const s of sessions.sort()) {
    let files: string[] = [];
    try {
      files = await readdir(path.join(dir, s));
    } catch {
      continue;
    }
    for (const f of files.filter((x) => x.endsWith('.json')).sort()) {
      const full = path.join(dir, s, f);
      const take = JSON.parse(await readFile(full, 'utf8')) as RecordingTake;
      const err = validateTake(take);
      if (err) {
        console.warn(`skip ${full}: ${err}`);
        continue;
      }
      out.push({ take, file: path.join(s, f) });
    }
  }
  return out;
}

/** Share of a take's frames whose palm direction matches the letter's. */
function palmMatchShare(take: RecordingTake): number {
  const want = LETTER_INDEX[take.label]?.palm;
  if (!want || take.frames.length === 0) return 1;
  let ok = 0;
  for (const f of take.frames) if (checkPalm(want, f.features) === null) ok++;
  return ok / take.frames.length;
}

function pct(x: number): string {
  return `${(x * 100).toFixed(0)}%`.padStart(4);
}

async function main(): Promise<void> {
  const hand = arg('hand', 'right');
  const dir = path.resolve(arg('dir', 'data/recordings'));
  const outDir = path.resolve(arg('out', 'data/models'));

  const all = await loadTakes(dir);
  const words = all.filter((t) => t.take.kind === 'word' && t.take.hand === hand);
  const motionLetters = all.filter((t) => t.take.kind === 'letter' && t.take.motion && t.take.hand === hand);
  const keepWrongPalm = process.argv.includes('--keep-wrong-palm');
  const staticTakes = all.filter((t) => t.take.kind === 'letter' && !t.take.motion && t.take.hand === hand);
  const wrongPalm = staticTakes.filter((t) => palmMatchShare(t.take) < 0.5);
  const samples: Sample[] = staticTakes
    .filter((t) => keepWrongPalm || !wrongPalm.includes(t))
    .map((t) => ({
      label: t.take.label,
      session: t.take.sessionId,
      file: t.file,
      vec: medianVector(t.take.frames.map((f) => f.features)),
    }));

  console.log(`Recordings in ${dir} (${hand} hand)`);
  console.log(`  static letter takes: ${samples.length}`);
  if (wrongPalm.length > 0) {
    const letters = [...new Set(wrongPalm.map((t) => t.take.label))].sort().join('');
    console.log(
      `  palm facing the wrong way: ${wrongPalm.length} takes (${letters}) ${keepWrongPalm ? 'KEPT (--keep-wrong-palm)' : 'skipped; re-record them palm away from you'}`,
    );
  }
  console.log(`  motion letter takes (J/Z, not evaluated yet): ${motionLetters.length}`);
  console.log(`  word takes (not evaluated yet): ${words.length}`);
  if (samples.length < 4) {
    console.log('Not enough static takes to evaluate (need 4+).');
    return;
  }

  const sessions = [...new Set(samples.map((s) => s.session))];
  const labels = [...new Set(samples.map((s) => s.label))].sort();
  const bySession = sessions.length >= 2;
  console.log(`  sessions: ${sessions.length} | letters: ${labels.join('')}`);
  console.log(
    bySession
      ? '  protocol: leave-one-session-out (each session tested on a model trained on the others)'
      : '  protocol: leave-one-take-out within ONE session (optimistic; record a 2nd session for an honest number)',
  );

  // Cross-validated predictions.
  const preds: Array<{ truth: string; pred: string; margin: number; runnerUp: string | null }> = [];
  for (const s of samples) {
    const train = samples.filter((o) => (bySession ? o.session !== s.session : o !== s));
    if (!train.some((o) => o.label === s.label)) continue; // label unseen in training fold
    const model = trainModel(train);
    const c = classify(model, s.vec);
    preds.push({ truth: s.label, pred: c.label, margin: c.margin, runnerUp: c.runnerUp });
  }
  if (preds.length === 0) {
    console.log('No evaluable folds (each letter needs takes in 2+ folds).');
    return;
  }

  const acc = preds.filter((p) => p.pred === p.truth).length / preds.length;
  console.log(`\nTop-1 accuracy (no abstention): ${pct(acc)} on ${preds.length} held-out takes`);

  // Abstention curve.
  console.log('\nAbstention curve: grade only when margin >= threshold');
  console.log('  margin  graded  accuracy-on-graded');
  let suggested = 0;
  for (const thr of [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4]) {
    const graded = preds.filter((p) => p.margin >= thr);
    const a = graded.length ? graded.filter((p) => p.pred === p.truth).length / graded.length : 1;
    console.log(`  ${thr.toFixed(2)}    ${pct(graded.length / preds.length)}    ${pct(a)}`);
    if (!suggested && graded.length > 0 && a >= 0.95) suggested = thr;
  }
  if (!suggested) suggested = 0.3;
  console.log(`  suggested margin threshold: ${suggested.toFixed(2)} (first with >= 95% accuracy on graded)`);

  // Per-letter reliability at the suggested threshold.
  console.log('\nPer letter (held-out): accuracy | graded share at threshold | most confused with');
  const perLetter: Record<string, { n: number; acc: number; graded: number; confusedWith: string | null }> = {};
  for (const l of labels) {
    const ps = preds.filter((p) => p.truth === l);
    if (!ps.length) continue;
    const wrong: Record<string, number> = {};
    for (const p of ps) if (p.pred !== l) wrong[p.pred] = (wrong[p.pred] ?? 0) + 1;
    const top = Object.entries(wrong).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const a = ps.filter((p) => p.pred === l).length / ps.length;
    const g = ps.filter((p) => p.margin >= suggested).length / ps.length;
    perLetter[l] = { n: ps.length, acc: a, graded: g, confusedWith: top };
    console.log(`  ${l}  n=${String(ps.length).padStart(2)}  ${pct(a)}  ${pct(g)}  ${top ?? '-'}`);
  }

  const pairs: Record<string, number> = {};
  for (const p of preds) if (p.pred !== p.truth) pairs[`${p.truth}->${p.pred}`] = (pairs[`${p.truth}->${p.pred}`] ?? 0) + 1;
  const topPairs = Object.entries(pairs).sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log(`\nTop confusions: ${topPairs.map(([k, v]) => `${k} x${v}`).join(', ') || 'none'}`);

  // Final model on all data.
  const model = trainModel(samples);
  await mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, `templates-${hand}.json`);
  const payload = JSON.stringify(
    {
      ...model,
      hand,
      createdAt: new Date().toISOString(),
      protocol: bySession ? 'leave-one-session-out' : 'leave-one-take-out (single session)',
      heldOutAccuracy: acc,
      abstainMargin: suggested,
      perLetter,
      sessions,
    },
    null,
    1,
  );
  await writeFile(outFile, payload);
  const publicDir = path.resolve('public/models');
  await mkdir(publicDir, { recursive: true });
  const publicFile = path.join(publicDir, `templates-${hand}.json`);
  await writeFile(publicFile, payload);
  console.log(`\nModel written to ${path.relative(process.cwd(), outFile)} and ${path.relative(process.cwd(), publicFile)}`);
}

void main();

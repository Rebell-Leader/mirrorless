/**
 * Imports take bundles downloaded from the headset recorder (hosted site, or
 * any time the laptop was unreachable) into data/recordings/<session>/, the
 * layout `pnpm eval:recordings` reads.
 *
 *   pnpm import:takes ~/Downloads/mirrorless-takes-*.json [--dir data/recordings]
 *
 * Takes already on disk are skipped, so importing the same bundle twice is safe.
 */

import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseTakeBundle } from '../src/recording-schema.js';

function parseArgs(argv: string[]): { files: string[]; dir: string } {
  const files: string[] = [];
  let dir = 'data/recordings';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dir' && argv[i + 1]) dir = argv[++i];
    else files.push(argv[i]);
  }
  return { files, dir: path.resolve(dir) };
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const { files, dir } = parseArgs(process.argv.slice(2));
  if (files.length === 0) {
    console.error('Usage: pnpm import:takes <mirrorless-takes-*.json> [...] [--dir data/recordings]');
    process.exit(1);
  }
  let imported = 0;
  let skipped = 0;
  let rejected = 0;
  for (const bundleFile of files) {
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(bundleFile, 'utf8'));
    } catch (err) {
      console.error(`${bundleFile}: can't read JSON (${err instanceof Error ? err.message : String(err)})`);
      rejected++;
      continue;
    }
    const { takes, errors } = parseTakeBundle(raw);
    for (const e of errors) console.error(`${bundleFile}: ${e}`);
    rejected += errors.length;
    for (const { file, take } of takes) {
      const target = path.join(dir, file);
      if (!target.startsWith(dir + path.sep)) {
        console.error(`${bundleFile}: ${file}: bad path`);
        rejected++;
        continue;
      }
      if (await exists(target)) {
        skipped++;
        continue;
      }
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, JSON.stringify(take));
      imported++;
    }
  }
  console.log(
    `Imported ${imported} take${imported === 1 ? '' : 's'} into ${path.relative(process.cwd(), dir) || dir}` +
      `${skipped ? `, skipped ${skipped} already there` : ''}${rejected ? `, rejected ${rejected}` : ''}.`,
  );
  if (imported > 0) console.log('Next: pnpm eval:recordings');
  if (imported === 0 && rejected > 0) process.exit(1);
}

void main();

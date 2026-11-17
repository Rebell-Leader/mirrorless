/**
 * Dev-only Vite plugin: lets the headset recorder save takes to the laptop.
 *
 *   POST   /api/recordings          body: RecordingTake JSON → data/recordings/<session>/<file>.json
 *   GET    /api/recordings/summary  → { total, byLabel: { A: { left: n, right: n } }, sessions }
 *   DELETE /api/recordings?file=<session>/<file>.json → removes one take (used by "Redo")
 *
 * The dev server listens on the LAN, so input is validated strictly and every
 * write stays inside data/recordings. Never shipped in production builds.
 */

import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import type { Plugin } from 'vite';
import {
  TAKE_FILE_RE,
  takeFileName,
  validateTake,
  type RecordingTake,
} from '../src/recording-schema.js';

const MAX_BODY_BYTES = 8 * 1024 * 1024;

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function summarize(root: string) {
  const byLabel: Record<string, { left: number; right: number }> = {};
  const sessions: Record<string, number> = {};
  let total = 0;
  let dirs: string[] = [];
  try {
    dirs = await readdir(root);
  } catch {
    return { total, byLabel, sessions };
  }
  for (const session of dirs) {
    let files: string[] = [];
    try {
      files = await readdir(path.join(root, session));
    } catch {
      continue;
    }
    for (const file of files) {
      const m = /^([A-Z]{1,16})-(left|right)-t\d+-\d+\.json$/u.exec(file);
      if (!m) continue;
      const entry = (byLabel[m[1]] ??= { left: 0, right: 0 });
      entry[m[2] as 'left' | 'right']++;
      sessions[session] = (sessions[session] ?? 0) + 1;
      total++;
    }
  }
  return { total, byLabel, sessions };
}

export function recordingsPlugin(options: { dir?: string } = {}): Plugin {
  return {
    name: 'mirrorless-recordings',
    apply: 'serve',
    configureServer(server) {
      const root = path.resolve(server.config.root, options.dir ?? 'data/recordings');

      server.middlewares.use('/api/recordings', async (req, res) => {
        try {
          const url = new URL(req.url ?? '/', 'http://localhost');

          if (req.method === 'GET' && url.pathname === '/summary') {
            send(res, 200, await summarize(root));
            return;
          }

          if (req.method === 'POST' && (url.pathname === '/' || url.pathname === '')) {
            const raw = await readBody(req);
            let take: RecordingTake;
            try {
              take = JSON.parse(raw) as RecordingTake;
            } catch {
              send(res, 400, { ok: false, error: 'invalid JSON' });
              return;
            }
            const error = validateTake(take);
            if (error) {
              send(res, 400, { ok: false, error });
              return;
            }
            const file = takeFileName(take, Date.now());
            const target = path.join(root, file);
            if (!target.startsWith(root + path.sep)) {
              send(res, 400, { ok: false, error: 'bad path' });
              return;
            }
            await mkdir(path.dirname(target), { recursive: true });
            await writeFile(target, JSON.stringify(take));
            send(res, 200, { ok: true, file, frames: take.frames.length });
            return;
          }

          if (req.method === 'DELETE') {
            const file = url.searchParams.get('file') ?? '';
            if (!TAKE_FILE_RE.test(file)) {
              send(res, 400, { ok: false, error: 'bad file' });
              return;
            }
            const target = path.join(root, file);
            if (!target.startsWith(root + path.sep)) {
              send(res, 400, { ok: false, error: 'bad path' });
              return;
            }
            // Confirm it is a recording before deleting.
            const content = JSON.parse(await readFile(target, 'utf8')) as { schema?: string };
            if (content.schema !== 'mirrorless.recording.v1') {
              send(res, 400, { ok: false, error: 'not a recording' });
              return;
            }
            await unlink(target);
            send(res, 200, { ok: true, deleted: file });
            return;
          }

          send(res, 404, { ok: false, error: 'not found' });
        } catch (err) {
          send(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
        }
      });
    },
  };
}

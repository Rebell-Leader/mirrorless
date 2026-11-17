/**
 * Headset-side take storage for the recorder (IndexedDB, this browser only).
 *
 * Used when the laptop's dev server can't be reached, e.g. on the hosted site
 * or a Wi-Fi that blocks device-to-device traffic. Takes stay here until the
 * learner downloads them as one bundle file (recorder page, 2D view) and
 * deletes them. Nothing is uploaded anywhere.
 */

import {
  type RecordingTake,
  type StoredTake,
  TAKE_BUNDLE_SCHEMA,
  type TakeBundle,
} from './recording-schema.js';

const DB_NAME = 'mirrorless-recorder';
const STORE = 'takes';

/** Fired on window whenever stored takes are added or removed. */
export const TAKES_CHANGED_EVENT = 'mirrorless:takes-changed';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('this browser has no IndexedDB'));
        return;
      }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE, { keyPath: 'file' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('could not open headset storage'));
    });
    // Let a later call retry instead of caching the failure.
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

async function run<T>(
  mode: IDBTransactionMode,
  op: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = op(tx.objectStore(STORE));
    // Resolve on commit, not on request success, so a quota abort is reported.
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error ?? req.error ?? new Error('headset storage error'));
    tx.onabort = () => reject(tx.error ?? new Error('headset storage write aborted'));
  });
}

function notify(): void {
  window.dispatchEvent(new Event(TAKES_CHANGED_EVENT));
}

export async function putTake(file: string, take: RecordingTake): Promise<void> {
  const entry: StoredTake = { file, take };
  await run('readwrite', (s) => s.put(entry));
  notify();
}

export async function deleteTake(file: string): Promise<void> {
  await run('readwrite', (s) => s.delete(file));
  notify();
}

export async function clearTakes(): Promise<void> {
  await run('readwrite', (s) => s.clear());
  notify();
}

export function countTakes(): Promise<number> {
  return run('readonly', (s) => s.count());
}

export async function buildTakeBundle(): Promise<TakeBundle> {
  const takes = (await run('readonly', (s) => s.getAll())) as StoredTake[];
  takes.sort((a, b) => a.file.localeCompare(b.file));
  return { schema: TAKE_BUNDLE_SCHEMA, exportedAt: new Date().toISOString(), takes };
}

/** Asks the browser not to evict stored takes under storage pressure. */
export async function requestPersistentStorage(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Best effort only.
  }
}

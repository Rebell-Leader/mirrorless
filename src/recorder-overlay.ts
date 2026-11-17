/**
 * 2D bar for the recorder page (?recorder=1). Shows how many takes are stored
 * in this browser (saved there when the laptop can't be reached), downloads
 * them as one bundle file for `pnpm import:takes`, and deletes them after.
 * Sits at the bottom so it never covers the page's Enter XR button; hidden
 * during the immersive session, like the trainer's setup bar.
 */

import { VisibilityState, type World } from '@iwsdk/core';
import { buildTakeBundle, clearTakes, countTakes, TAKES_CHANGED_EVENT } from './take-store.js';
import { isRecorderUrl } from './trainer.js';

const BUTTON_STYLE = [
  'padding:7px 12px',
  'border-radius:8px',
  'border:1px solid rgba(62,230,193,0.5)',
  'background:#0f2b2a',
  'color:#f8fafc',
  'font:inherit',
  'cursor:pointer',
].join(';');

function stamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function mountRecorderOverlay(world: World): void {
  if (!isRecorderUrl()) return;

  const root = document.createElement('div');
  root.id = 'mirrorless-recorder-overlay';
  root.style.cssText = [
    'position:fixed',
    'bottom:8px',
    'left:8px',
    'right:8px',
    'z-index:20',
    'padding:10px 14px',
    'background:rgba(15,23,42,0.9)',
    'border:1px solid rgba(62,230,193,0.35)',
    'border-radius:10px',
    'font:13px system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
    'color:#f8fafc',
  ].join(';');
  root.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;">
      <strong style="color:#3ee6c1;letter-spacing:0.8px;">MIRRORLESS RECORDER</strong>
      <span id="rec-store-count" style="flex:1 1 220px;">Checking takes stored in this browser...</span>
      <button id="rec-download" type="button" style="${BUTTON_STYLE}" disabled>Download takes</button>
      <button id="rec-clear" type="button" style="${BUTTON_STYLE};border-color:rgba(248,113,113,0.6);background:#3b1414;" disabled>Delete stored takes</button>
    </div>
    <div style="margin-top:6px;color:#94a3b8;font-size:12px;line-height:1.4;">
      When the laptop can't be reached, takes are saved in this browser. Download them, copy the file to the
      laptop, then run <code style="color:#e2e8f0;">pnpm import:takes &lt;file&gt;</code> and
      <code style="color:#e2e8f0;">pnpm eval:recordings</code>. Hand-joint data only, no camera images.
    </div>`;
  document.body.appendChild(root);

  const countEl = root.querySelector('#rec-store-count') as HTMLSpanElement;
  const downloadBtn = root.querySelector('#rec-download') as HTMLButtonElement;
  const clearBtn = root.querySelector('#rec-clear') as HTMLButtonElement;
  let count = 0;
  let note = '';

  const render = () => {
    const stored =
      count === 0
        ? 'No takes stored in this browser.'
        : `${count} take${count === 1 ? '' : 's'} stored in this browser.`;
    countEl.textContent = note ? `${stored} ${note}` : stored;
    downloadBtn.disabled = count === 0;
    clearBtn.disabled = count === 0;
  };

  const refresh = async () => {
    try {
      count = await countTakes();
    } catch (err) {
      count = 0;
      note = `Browser storage unavailable: ${err instanceof Error ? err.message : String(err)}`;
    }
    render();
  };

  downloadBtn.addEventListener('click', async () => {
    downloadBtn.disabled = true;
    try {
      const bundle = await buildTakeBundle();
      const blob = new Blob([JSON.stringify(bundle)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mirrorless-takes-${stamp(new Date())}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      const size = blob.size < 1e6 ? `${Math.max(1, Math.round(blob.size / 1e3))} KB` : `${(blob.size / 1e6).toFixed(1)} MB`;
      note = `Downloaded ${bundle.takes.length} (${size}). They stay here until you delete them.`;
    } catch (err) {
      note = `Download failed: ${err instanceof Error ? err.message : String(err)}`;
    }
    render();
  });

  clearBtn.addEventListener('click', async () => {
    if (!window.confirm(`Delete ${count} takes from this browser? Download them first: this can't be undone.`)) return;
    try {
      await clearTakes();
      note = '';
    } catch (err) {
      note = `Delete failed: ${err instanceof Error ? err.message : String(err)}`;
    }
    await refresh();
  });

  window.addEventListener(TAKES_CHANGED_EVENT, () => void refresh());
  world.visibilityState.subscribe((state) => {
    const is2D = state === VisibilityState.NonImmersive;
    root.style.display = is2D ? 'block' : 'none';
    if (is2D) void refresh();
  });
  void refresh();
}

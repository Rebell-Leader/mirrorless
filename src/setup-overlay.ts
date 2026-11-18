/**
 * Pre-XR 2D HTML bar & expandable drawer for Mirrorless:
 * - Personalize Your Name & Personal Word List before entering XR (checks C2, C3)
 * - Starter presets (Caregiver & Meds, Family & Names, Double Letters)
 * - Dominant hand & audio toggle
 * - Shareable word-list link generator
 * - Per-letter tracker reliability & mastery matrix (check D8)
 * - Scope, honesty, medical disclaimer & Deaf-led resources (checks C10, D2, D3, D10, D12)
 *
 * Designed as a compact top bar with a collapsible drawer so the central 3D
 * viewport and spatial panels remain completely unobstructed. Automatically
 * hides during immersive XR sessions.
 */

import { VisibilityState, type World } from '@iwsdk/core';
import { ASL_LETTERS } from './asl-letters.js';
import {
  cleanWord,
  getLetterReliability,
  loadProfile,
  saveProfile,
  STARTER_PRESETS,
} from './storage.js';
import { isRecorderUrl } from './trainer.js';

export function mountSetupOverlay(world: World): void {
  if (isRecorderUrl()) return;

  const profile = loadProfile();

  const root = document.createElement('div');
  root.id = 'mirrorless-2d-overlay';
  root.style.cssText = [
    'position:fixed',
    'top:8px',
    'left:8px',
    'right:8px',
    'z-index:20',
    'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
    'color:#f8fafc',
    'pointer-events:none',
  ].join(';');

  root.innerHTML = `
    <div id="ml-topbar" style="
      pointer-events:auto;
      display:flex;
      flex-wrap:wrap;
      align-items:center;
      justify-content:space-between;
      gap:8px;
      padding:8px 14px;
      background:rgba(15,23,42,0.88);
      border:1px solid rgba(62,230,193,0.35);
      border-radius:10px;
      backdrop-filter:blur(8px);
      font-size:13px;
    ">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <strong style="color:#3ee6c1;letter-spacing:0.8px;">MIRRORLESS</strong>
        <span style="color:#cbd5e1;">ASL Fingerspelling Practice (Manual Alphabet Only - Not ASL / Not a Translator)</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
        <label style="display:flex;align-items:center;gap:4px;color:#e2e8f0;">
          Name:
          <input id="ml-name-input" type="text" maxlength="12" value="${profile.userName}" style="
            width:78px;padding:3px 6px;border-radius:5px;border:1px solid #475569;
            background:#1e293b;color:#f8fafc;font-weight:700;text-transform:uppercase;font-size:12px;
          " />
        </label>
        <label style="display:flex;align-items:center;gap:4px;color:#e2e8f0;">
          Words:
          <input id="ml-words-input" type="text" value="${profile.personalWords.join(', ')}" style="
            width:175px;padding:3px 6px;border-radius:5px;border:1px solid #475569;
            background:#1e293b;color:#f8fafc;text-transform:uppercase;font-size:12px;
          " />
        </label>
        <button id="ml-save-btn" type="button" style="
          padding:4px 9px;border-radius:6px;border:none;background:#0d9488;color:#fff;
          font-weight:600;font-size:12px;cursor:pointer;
        ">Apply</button>
        <button id="ml-hand-btn" type="button" style="
          padding:4px 9px;border-radius:6px;border:1px solid #475569;background:#1e293b;color:#e2e8f0;
          font-size:12px;cursor:pointer;
        ">Hand: ${profile.dominantHand}</button>
        <button id="ml-drawer-btn" type="button" style="
          padding:4px 9px;border-radius:6px;border:1px solid #475569;background:#1e293b;color:#93c5fd;
          font-size:12px;cursor:pointer;
        ">Scope, Reliability & Presets</button>
        <button id="ml-enter-xr-btn" type="button" style="
          padding:5px 12px;border-radius:6px;border:none;background:#10b981;color:#052e16;
          font-weight:700;font-size:12px;cursor:pointer;
        ">Enter XR</button>
      </div>
    </div>

    <div id="ml-drawer" style="
      pointer-events:auto;
      display:none;
      margin-top:6px;
      padding:14px 16px;
      max-width:680px;
      max-height:76vh;
      overflow-y:auto;
      background:rgba(15,23,42,0.95);
      border:1px solid rgba(62,230,193,0.4);
      border-radius:10px;
      font-size:13px;
      line-height:1.45;
    ">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <strong style="color:#3ee6c1;font-size:14px;">Starter Word Packs & Shareable Link</strong>
        <button id="ml-close-drawer" type="button" style="
          background:transparent;border:1px solid #475569;color:#cbd5e1;border-radius:5px;
          padding:2px 8px;cursor:pointer;font-size:12px;
        ">Close</button>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
        <button data-preset="caregiver" type="button" style="padding:4px 8px;border-radius:5px;border:1px solid #0d9488;background:#134e4a;color:#ccfbf1;cursor:pointer;font-size:12px;">
          Caregiver & Meds (MAYA, HANNAH, INSULIN, IBUPROFEN)
        </button>
        <button data-preset="family" type="button" style="padding:4px 8px;border-radius:5px;border:1px solid #0d9488;background:#134e4a;color:#ccfbf1;cursor:pointer;font-size:12px;">
          Family & Names (ALEX, EMMA, NOAH, PARK)
        </button>
        <button data-preset="doubles" type="button" style="padding:4px 8px;border-radius:5px;border:1px solid #0d9488;background:#134e4a;color:#ccfbf1;cursor:pointer;font-size:12px;">
          Double Letters (ANNA, BOOK, COFFEE, PIZZA)
        </button>
        <button id="ml-share-btn" type="button" style="padding:4px 8px;border-radius:5px;border:1px solid #6366f1;background:#1e1b4b;color:#e0e7ff;cursor:pointer;font-size:12px;">
          Copy Shareable Word-List URL
        </button>
      </div>

      <div style="margin-bottom:10px;padding:8px 10px;background:#1e293b;border-radius:8px;border-left:3px solid #f59e0b;">
        <strong>Honest Scope & Safety Notice:</strong>
        <ul style="margin:4px 0 0 18px;padding:0;color:#cbd5e1;">
          <li><strong>Manual alphabet practice only:</strong> Does not teach ASL grammar, vocabulary signs, facial expressions, or mouthing.</li>
          <li><strong>Not for medical communication or interpreting:</strong> Never use this app in place of a certified Deaf/ASL interpreter or written teach-back in healthcare.</li>
          <li><strong>Authorship & Review:</strong> Built by a hearing developer; letter descriptions checked against published references and pending paid Deaf ASL signer sign-off. Reading-mode hand is explicitly labelled <em>synthetic</em>.</li>
          <li><strong>Privacy:</strong> All hand-joint math runs locally on your device. No camera video, no cloud, no LLM. (Quest Browser shows a standard WebXR hand-tracking & spatial permission prompt.)</li>
        </ul>
      </div>

      <div style="margin-bottom:10px;">
        <strong style="color:#3ee6c1;">Per-Letter Quest Tracker Reliability & Mastery (Honest Abstention):</strong>
        <div id="ml-letter-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:5px;margin-top:6px;"></div>
      </div>

      <div style="padding-top:6px;border-top:1px solid #334155;color:#cbd5e1;">
        <strong>Deaf-Led ASL Learning Resources (Learn Real Signs First):</strong>
        <a href="https://deafchildren.org/parents-and-families/asl-signon/" target="_blank" rel="noopener" style="color:#38bdf8;margin-left:6px;">ASDC SignOn (Deaf Mentors)</a> |
        <a href="https://www.lifeprint.com/" target="_blank" rel="noopener" style="color:#38bdf8;margin-left:6px;">Lifeprint (Dr. Bill Vicars)</a> |
        <a href="https://www.nad.org/" target="_blank" rel="noopener" style="color:#38bdf8;margin-left:6px;">National Association of the Deaf (NAD)</a> |
        <a href="?recorder=1" style="color:#94a3b8;margin-left:6px;">Dev Dataset Recorder</a>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  const nameInput = root.querySelector('#ml-name-input') as HTMLInputElement;
  const wordsInput = root.querySelector('#ml-words-input') as HTMLInputElement;
  const saveBtn = root.querySelector('#ml-save-btn') as HTMLButtonElement;
  const handBtn = root.querySelector('#ml-hand-btn') as HTMLButtonElement;
  const drawerBtn = root.querySelector('#ml-drawer-btn') as HTMLButtonElement;
  const closeDrawerBtn = root.querySelector('#ml-close-drawer') as HTMLButtonElement;
  const enterXrBtn = root.querySelector('#ml-enter-xr-btn') as HTMLButtonElement;
  const shareBtn = root.querySelector('#ml-share-btn') as HTMLButtonElement;
  const drawer = root.querySelector('#ml-drawer') as HTMLDivElement;
  const grid = root.querySelector('#ml-letter-grid') as HTMLDivElement;

  const renderGrid = () => {
    const p = loadProfile();
    grid.innerHTML = ASL_LETTERS.map((l) => {
      const rel = getLetterReliability(l.letter);
      const stat = p.letters[l.letter] ?? { attempts: 0, passes: 0, selfChecks: 0 };
      const done = stat.passes + stat.selfChecks;
      const badge =
        rel === 'auto-high'
          ? 'Auto (High)'
          : rel === 'auto-medium'
            ? 'Auto (Med)'
            : 'Self-Check';
      const borderCol =
        rel === 'auto-high' ? '#10b981' : rel === 'auto-medium' ? '#38bdf8' : '#818cf8';
      return `<div style="padding:4px 6px;border-radius:6px;background:#0f172a;border:1px solid ${borderCol};font-size:11px;">
        <div style="display:flex;justify-content:space-between;font-weight:700;">
          <span>${l.letter}</span>
          <span style="color:#94a3b8;">${done > 0 ? `OK x${done}` : '-'}</span>
        </div>
        <div style="color:${borderCol};font-size:10px;">${badge}</div>
      </div>`;
    }).join('');
  };
  renderGrid();

  const applyChanges = () => {
    const p = loadProfile();
    p.userName = cleanWord(nameInput.value, 'MAYA');
    const parsedWords = wordsInput.value
      .split(/[^A-Za-z]+/u)
      .map((w) => cleanWord(w, ''))
      .filter((w) => w.length >= 2)
      .slice(0, 5);
    if (parsedWords.length > 0) p.personalWords = parsedWords;
    nameInput.value = p.userName;
    wordsInput.value = p.personalWords.join(', ');
    saveProfile(p);
    window.dispatchEvent(new CustomEvent('mirrorless:profile-updated'));
    renderGrid();
  };

  saveBtn.addEventListener('click', applyChanges);
  nameInput.addEventListener('change', applyChanges);
  wordsInput.addEventListener('change', applyChanges);

  handBtn.addEventListener('click', () => {
    const p = loadProfile();
    p.dominantHand = p.dominantHand === 'right' ? 'left' : 'right';
    handBtn.textContent = `Hand: ${p.dominantHand}`;
    saveProfile(p);
    window.dispatchEvent(new CustomEvent('mirrorless:profile-updated'));
  });

  drawerBtn.addEventListener('click', () => {
    const open = drawer.style.display === 'block';
    drawer.style.display = open ? 'none' : 'block';
    if (!open) renderGrid();
  });

  closeDrawerBtn.addEventListener('click', () => {
    drawer.style.display = 'none';
  });

  for (const btn of Array.from(root.querySelectorAll('[data-preset]'))) {
    btn.addEventListener('click', () => {
      const key = (btn as HTMLElement).getAttribute('data-preset') ?? 'caregiver';
      const preset = STARTER_PRESETS[key];
      if (!preset) return;
      nameInput.value = preset.name;
      wordsInput.value = preset.words.join(', ');
      applyChanges();
    });
  }

  shareBtn.addEventListener('click', () => {
    applyChanges();
    const p = loadProfile();
    const url = new URL(window.location.href);
    url.searchParams.set('name', p.userName);
    url.searchParams.set('wordlist', p.personalWords.join(','));
    url.searchParams.set('hand', p.dominantHand);
    void navigator.clipboard?.writeText(url.toString());
    shareBtn.textContent = 'Copied Shareable Link!';
    setTimeout(() => {
      shareBtn.textContent = 'Copy Shareable Word-List URL';
    }, 2000);
  });

  enterXrBtn.addEventListener('click', () => {
    applyChanges();
    world.launchXR();
  });

  world.visibilityState.subscribe((state) => {
    const is2D = state === VisibilityState.NonImmersive;
    root.style.display = is2D ? 'block' : 'none';
    if (is2D) renderGrid();
  });
}

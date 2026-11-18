import { VisibilityState, type World } from '@iwsdk/core';
import { cleanWord, loadProfile, saveProfile, STARTER_PRESETS } from './storage.js';
import { isRecorderUrl } from './trainer.js';
import './setup-overlay.css';

const HELP_URL = 'https://github.com/Rebell-Leader/mirrorless#practice';

export function mountSetupOverlay(world: World): void {
  if (isRecorderUrl() || new URLSearchParams(location.search).has('probe')) return;

  const root = document.createElement('main');
  root.id = 'mirrorless-2d-overlay';
  root.className = 'ml-page';
  root.innerHTML = `
    <div class="ml-shell">
      <header class="ml-header">
        <div class="ml-brand">
          <img src="${import.meta.env.BASE_URL}mirrorless.svg" width="40" height="40" alt="" />
          Mirrorless
        </div>
        <a href="${HELP_URL}" target="_blank" rel="noopener">How to use</a>
      </header>

      <section class="ml-card" aria-label="Fingerspelling practice">
        <div id="ml-intro">
          <h1 id="ml-title">Practice a name.<br />See it from across the table.</h1>
          <p class="ml-description">ASL fingerspelling practice for Meta Quest.</p>
          <div class="ml-actions">
            <button id="ml-enter-xr-btn" class="ml-primary" type="button">Start practice</button>
            <button id="ml-drawer-btn" type="button" aria-expanded="false" aria-controls="ml-drawer">
              Personalize
            </button>
          </div>
          <p id="ml-entry-status" class="ml-message" role="status" hidden></p>
          <div class="ml-summary">
            <div>Practice name <strong id="ml-practice-name"></strong></div>
            <div>Signing hand <strong id="ml-signing-hand"></strong></div>
          </div>
        </div>

        <form id="ml-drawer" class="ml-settings" aria-labelledby="ml-settings-title" hidden>
          <h2 id="ml-settings-title">Personalize</h2>
          <div class="ml-fields">
            <div class="ml-field-group">
              <label for="ml-name-input">Practice name</label>
              <input id="ml-name-input" type="text" maxlength="12" autocomplete="off" spellcheck="false" />
              <label for="ml-words-input">Extra words</label>
              <input id="ml-words-input" type="text" placeholder="LILY, BOOK, ANNA" autocomplete="off" spellcheck="false" aria-describedby="ml-words-hint" />
              <p id="ml-words-hint" class="ml-hint">Up to five, separated by commas.</p>
            </div>
            <div class="ml-field-group">
              <fieldset>
                <legend>Signing hand</legend>
                <div class="ml-segment">
                  <label><input name="ml-hand" type="radio" value="left" /><span>Left</span></label>
                  <label><input name="ml-hand" type="radio" value="right" /><span>Right</span></label>
                </div>
              </fieldset>
              <label class="ml-check"><input id="ml-sound" type="checkbox" /> Play feedback sounds</label>
              <label for="ml-preset">Word list</label>
              <select id="ml-preset">
                <option value="">Choose a starter list</option>
                ${Object.entries(STARTER_PRESETS).map(([key, preset]) => `<option value="${key}">${preset.label}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="ml-actions">
            <button class="ml-primary" type="submit">Done</button>
            <button id="ml-share-btn" type="button">Copy practice link</button>
          </div>
          <p id="ml-share-status" class="ml-message" role="status" hidden></p>
        </form>
      </section>

      <footer class="ml-footer">
        <span>Progress stays in this browser.</span>
        <a href="https://deafchildren.org/2021/05/asdc-fingerspelling-app/" target="_blank" rel="noopener">More fingerspelling practice</a>
      </footer>
    </div>
  `;
  document.body.append(root);

  const intro = root.querySelector<HTMLElement>('#ml-intro')!;
  const settings = root.querySelector<HTMLFormElement>('#ml-drawer')!;
  const nameInput = root.querySelector<HTMLInputElement>('#ml-name-input')!;
  const wordsInput = root.querySelector<HTMLInputElement>('#ml-words-input')!;
  const leftInput = root.querySelector<HTMLInputElement>('input[value="left"]')!;
  const rightInput = root.querySelector<HTMLInputElement>('input[value="right"]')!;
  const soundInput = root.querySelector<HTMLInputElement>('#ml-sound')!;
  const presetInput = root.querySelector<HTMLSelectElement>('#ml-preset')!;
  const personalize = root.querySelector<HTMLButtonElement>('#ml-drawer-btn')!;
  const start = root.querySelector<HTMLButtonElement>('#ml-enter-xr-btn')!;
  const share = root.querySelector<HTMLButtonElement>('#ml-share-btn')!;
  const practiceName = root.querySelector<HTMLElement>('#ml-practice-name')!;
  const signingHand = root.querySelector<HTMLElement>('#ml-signing-hand')!;
  const entryStatus = root.querySelector<HTMLElement>('#ml-entry-status')!;
  const shareStatus = root.querySelector<HTMLElement>('#ml-share-status')!;

  let resumed = false;
  let launchTimeout: number | undefined;

  function showMessage(element: HTMLElement, message: string): void {
    element.textContent = message;
    element.hidden = !message;
  }

  function syncProfile(profile = loadProfile()): void {
    nameInput.value = practiceName.textContent = profile.userName;
    wordsInput.value = profile.personalWords.join(', ');
    leftInput.checked = profile.dominantHand === 'left';
    rightInput.checked = !leftInput.checked;
    signingHand.textContent = leftInput.checked ? 'Left' : 'Right';
    soundInput.checked = profile.soundEnabled;
  }

  function saveSettings() {
    const profile = loadProfile();
    profile.userName = cleanWord(nameInput.value, profile.userName);
    profile.personalWords = [...new Set(wordsInput.value.split(/[^A-Za-z]+/u)
      .map((word) => cleanWord(word, ''))
      .filter(Boolean))].slice(0, 5);
    profile.dominantHand = leftInput.checked ? 'left' : 'right';
    profile.soundEnabled = soundInput.checked;
    saveProfile(profile);

    // A shared link seeds the local profile. Later edits use the saved values.
    const url = new URL(location.href);
    const fragment = new URLSearchParams(url.hash.slice(1));
    let changed = false;
    let fragmentChanged = false;
    for (const key of ['name', 'wordlist', 'hand']) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
      if (fragment.has(key)) {
        fragment.delete(key);
        fragmentChanged = true;
      }
    }
    if (fragmentChanged) url.hash = fragment.toString();
    if (changed || fragmentChanged) history.replaceState(history.state, '', url);
    window.dispatchEvent(new CustomEvent('mirrorless:profile-updated'));
    syncProfile(profile);
    return profile;
  }

  function setSettingsOpen(open: boolean): void {
    intro.hidden = open;
    settings.hidden = !open;
    personalize.setAttribute('aria-expanded', String(open));
    showMessage(shareStatus, '');
    (open ? nameInput : personalize).focus();
  }

  personalize.addEventListener('click', () => {
    syncProfile();
    setSettingsOpen(true);
  });
  settings.addEventListener('submit', (event) => {
    event.preventDefault();
    saveSettings();
    setSettingsOpen(false);
  });
  settings.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setSettingsOpen(false);
  });
  presetInput.addEventListener('change', () => {
    const preset = STARTER_PRESETS[presetInput.value];
    if (!preset) return;
    nameInput.value = preset.name;
    wordsInput.value = preset.words.join(', ');
    presetInput.value = '';
  });
  share.addEventListener('click', async () => {
    const profile = saveSettings();
    const url = new URL(location.pathname, location.origin);
    url.hash = new URLSearchParams({
      name: profile.userName,
      wordlist: profile.personalWords.join(','),
      hand: profile.dominantHand,
    }).toString();
    try {
      await navigator.clipboard.writeText(url.toString());
      showMessage(shareStatus, 'Link copied with your name and words.');
    } catch {
      showMessage(shareStatus, 'Could not copy the link.');
    }
  });

  const showUnsupported = () => {
    start.disabled = true;
    showMessage(entryStatus, 'Open this page in Quest Browser to practice.');
  };
  if (!navigator.xr) showUnsupported();
  else void navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
    if (!supported && !resumed) showUnsupported();
  }).catch(() => { /* The start button still lets the browser request a session. */ });

  start.addEventListener('click', () => {
    saveSettings();
    start.disabled = true;
    showMessage(entryStatus, 'Opening practice…');
    launchTimeout = window.setTimeout(() => {
      start.disabled = false;
      showMessage(entryStatus, 'Could not start. Check hand tracking and try again.');
    }, 12000);
    world.launchXR();
  });

  world.visibilityState.subscribe((state) => {
    root.hidden = state !== VisibilityState.NonImmersive;
    if (root.hidden) {
      resumed = true;
      window.clearTimeout(launchTimeout);
      start.disabled = false;
      start.textContent = 'Resume practice';
      showMessage(entryStatus, '');
    } else {
      syncProfile();
    }
  });
}

/**
 * Local persistence for Mirrorless learner state (saved in localStorage, never
 * sent to any server). Supports URL overrides for shareable word lists.
 */

import { ASL_LETTERS } from './asl-letters.js';
import type { Handedness } from './hand-features.js';

const STORAGE_KEY = 'mirrorless.learner.v1';

export interface LetterProgress {
  attempts: number;
  /** Auto-graded by the recognizer. */
  passes: number;
  /** Confirmed by the learner against the Ghost Hand (not graded by the app). */
  selfChecks: number;
  /** Skipped without a grade or a confirmation; never counts as mastery. */
  skips: number;
  lastPracticed?: string;
}

export type LetterOutcome = 'pass' | 'self-check' | 'skip';

export interface LearnerProfile {
  userName: string;
  personalWords: string[];
  dominantHand: Handedness;
  soundEnabled: boolean;
  ghostOpacityLevel: 'full' | 'faded';
  streakDays: number;
  lastPracticeDate: string; // YYYY-MM-DD
  wordsCompleted: number;
  readingScore: number;
  readingRounds: number;
  letters: Record<string, LetterProgress>;
}

export const STARTER_PRESETS: Record<string, { label: string; name: string; words: string[] }> = {
  caregiver: {
    label: 'Caregiver terms',
    name: 'MAYA',
    words: ['HANNAH', 'INSULIN', 'IBUPROFEN', 'WATER'],
  },
  family: {
    label: 'Family names',
    name: 'ALEX',
    words: ['EMMA', 'NOAH', 'PARK', 'SCHOOL'],
  },
  doubles: {
    label: 'Double letters',
    name: 'ANNA',
    words: ['BOOK', 'COFFEE', 'PIZZA', 'HELLO'],
  },
};

export function cleanWord(raw: string, fallback = 'MAYA'): string {
  const w = raw.toUpperCase().replace(/[^A-Z]/gu, '').slice(0, 12);
  return w.length >= 2 ? w : fallback;
}

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function defaultProfile(): LearnerProfile {
  const letters: Record<string, LetterProgress> = {};
  for (const l of ASL_LETTERS) {
    letters[l.letter] = { attempts: 0, passes: 0, selfChecks: 0, skips: 0 };
  }
  return {
    userName: 'MAYA',
    personalWords: ['HANNAH', 'INSULIN', 'BOOK', 'COFFEE'],
    dominantHand: 'right',
    soundEnabled: true,
    ghostOpacityLevel: 'full',
    streakDays: 1,
    lastPracticeDate: todayIso(),
    wordsCompleted: 0,
    readingScore: 0,
    readingRounds: 0,
    letters,
  };
}

export function loadProfile(): LearnerProfile {
  const base = defaultProfile();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LearnerProfile>;
      if (typeof parsed.userName === 'string') base.userName = cleanWord(parsed.userName, 'MAYA');
      if (Array.isArray(parsed.personalWords)) {
        base.personalWords = parsed.personalWords
          .map((w) => cleanWord(String(w), ''))
          .filter((w) => w.length >= 2)
          .slice(0, 5);
      }
      if (parsed.dominantHand === 'left' || parsed.dominantHand === 'right') {
        base.dominantHand = parsed.dominantHand;
      }
      if (typeof parsed.soundEnabled === 'boolean') base.soundEnabled = parsed.soundEnabled;
      if (parsed.ghostOpacityLevel === 'full' || parsed.ghostOpacityLevel === 'faded') {
        base.ghostOpacityLevel = parsed.ghostOpacityLevel;
      }
      if (typeof parsed.streakDays === 'number' && parsed.streakDays >= 1) {
        base.streakDays = parsed.streakDays;
      }
      if (typeof parsed.lastPracticeDate === 'string') {
        base.lastPracticeDate = parsed.lastPracticeDate;
      }
      if (typeof parsed.wordsCompleted === 'number') base.wordsCompleted = parsed.wordsCompleted;
      if (typeof parsed.readingScore === 'number') base.readingScore = parsed.readingScore;
      if (typeof parsed.readingRounds === 'number') base.readingRounds = parsed.readingRounds;
      if (parsed.letters && typeof parsed.letters === 'object') {
        for (const [k, v] of Object.entries(parsed.letters)) {
          if (k in base.letters && v && typeof v === 'object') {
            base.letters[k] = {
              attempts: Number(v.attempts) || 0,
              passes: Number(v.passes) || 0,
              selfChecks: Number(v.selfChecks) || 0,
              skips: Number(v.skips) || 0,
              lastPracticed: v.lastPracticed,
            };
          }
        }
      }
    }
  } catch {
    // Ignore storage read errors in restricted contexts.
  }

  // Apply URL query overrides (e.g. ?hand=left&name=ALEX&wordlist=BOOK,ANNA).
  try {
    const query = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const shared = (key: string) => fragment.get(key) ?? query.get(key);
    const hand = shared('hand');
    if (hand === 'left' || hand === 'right') base.dominantHand = hand;
    const qName = shared('name');
    if (qName) base.userName = cleanWord(qName, base.userName);
    const qList = shared('wordlist');
    if (qList !== null) {
      const list = qList
        .split(/[^A-Za-z]+/u)
        .map((w) => cleanWord(w, ''))
        .filter((w) => w.length >= 2)
        .slice(0, 5);
      base.personalWords = list;
    }
  } catch {
    // Ignore URL errors in Node tests.
  }

  return base;
}

export function saveProfile(profile: LearnerProfile): void {
  try {
    const today = todayIso();
    if (profile.lastPracticeDate !== today) {
      // Increment streak if returning on a new day.
      profile.streakDays = Math.max(1, profile.streakDays + 1);
      profile.lastPracticeDate = today;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage write errors.
  }
}

export function recordLetterOutcome(
  profile: LearnerProfile,
  letter: string,
  outcome: LetterOutcome,
): void {
  const entry = profile.letters[letter];
  if (!entry) return;
  entry.attempts++;
  if (outcome === 'pass') entry.passes++;
  else if (outcome === 'self-check') entry.selfChecks++;
  else entry.skips++;
  entry.lastPracticed = todayIso();
  // Automatically fade ghost intensity slightly once 8+ letters are mastered (science guidance).
  const masteredCount = Object.values(profile.letters).filter((l) => l.passes + l.selfChecks >= 2).length;
  if (masteredCount >= 8) profile.ghostOpacityLevel = 'faded';
  saveProfile(profile);
}

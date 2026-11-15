// Pure game logic: no DOM, no storage. Tested by tests/engine.test.js.

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;
export const GAME_NAME = 'Fivefold';

// Puzzle #1 is 15 Nov 2026 (local time).
const EPOCH = { y: 2026, m: 10, d: 15 };
const DAY_MS = 86400000;

export const CORRECT = 'correct';
export const PRESENT = 'present';
export const ABSENT = 'absent';

const RANK = { [ABSENT]: 1, [PRESENT]: 2, [CORRECT]: 3 };

/**
 * Score a guess against the answer, handling repeated letters:
 * exact matches first, then "present" only while unmatched copies remain.
 */
export function scoreGuess(guess, answer) {
  const result = Array(WORD_LENGTH).fill(ABSENT);
  const remaining = {};
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === answer[i]) {
      result[i] = CORRECT;
    } else {
      remaining[answer[i]] = (remaining[answer[i]] || 0) + 1;
    }
  }
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === CORRECT) continue;
    const ch = guess[i];
    if (remaining[ch] > 0) {
      result[i] = PRESENT;
      remaining[ch]--;
    }
  }
  return result;
}

export function ordinal(n) {
  return ['1st', '2nd', '3rd', '4th', '5th'][n - 1] || `${n}th`;
}

/**
 * Hard mode: every revealed hint must be used. Returns an error message,
 * or null if the guess is allowed.
 * `previous` is an array of { guess, result }.
 */
export function hardModeError(guess, previous) {
  for (const { guess: prev, result } of previous) {
    for (let i = 0; i < WORD_LENGTH; i++) {
      if (result[i] === CORRECT && guess[i] !== prev[i]) {
        return `${ordinal(i + 1)} letter must be ${prev[i].toUpperCase()}`;
      }
    }
    // Count how many of each letter the hints require (correct + present).
    const need = {};
    for (let i = 0; i < WORD_LENGTH; i++) {
      if (result[i] !== ABSENT) need[prev[i]] = (need[prev[i]] || 0) + 1;
    }
    for (const [ch, count] of Object.entries(need)) {
      const have = [...guess].filter((c) => c === ch).length;
      if (have < count) return `Guess must contain ${ch.toUpperCase()}`;
    }
  }
  return null;
}

/** Best status for each letter seen so far, for colouring the keyboard. */
export function keyboardState(rows) {
  const keys = {};
  for (const { guess, result } of rows) {
    for (let i = 0; i < WORD_LENGTH; i++) {
      const ch = guess[i];
      if (!keys[ch] || RANK[result[i]] > RANK[keys[ch]]) keys[ch] = result[i];
    }
  }
  return keys;
}

/** Days since the epoch, using the device's local calendar date. */
export function dayNumber(date = new Date()) {
  const local = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((local - Date.UTC(EPOCH.y, EPOCH.m, EPOCH.d)) / DAY_MS);
}

export function puzzleNumber(day) {
  return day + 1;
}

export function dailyAnswer(answers, day) {
  const n = answers.length;
  return answers[((day % n) + n) % n];
}

export function msUntilTomorrow(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next - now;
}

export function formatCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

const EMOJI = {
  normal: { [CORRECT]: '🟩', [PRESENT]: '🟨' },
  contrast: { [CORRECT]: '🟦', [PRESENT]: '🟧' },
};

/** Spoiler-free share text. */
export function shareText({ puzzle, results, won, hard, highContrast, dark, hints = 0 }) {
  const set = highContrast ? EMOJI.contrast : EMOJI.normal;
  const absent = dark ? '⬛' : '⬜';
  const score = won ? results.length : 'X';
  const grid = results
    .map((row) => row.map((r) => set[r] || absent).join(''))
    .join('\n');
  const title = puzzle ? `${GAME_NAME} #${puzzle}` : `${GAME_NAME} practice`;
  const hintTag = hints ? ` 💡${hints}` : '';
  return `${title} ${score}/${MAX_GUESSES}${hard ? '*' : ''}${hintTag}\n\n${grid}`;
}

// ---------- Hints ----------
// Hint 1 reveals a letter in its correct spot. Hints 2 and 3 remove wrong letters
// from the keyboard. Giving up is handled by the app (it just ends the round).

export const MAX_HINTS = 3;
export const LETTERS_PER_ELIMINATION = 5;
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

function pick(options, rand) {
  return options[Math.floor(rand() * options.length)];
}

/** Reveal one letter in its correct position, preferring spots that aren't green yet. */
export function positionHint(answer, rows, given = [], rand = Math.random) {
  const placed = new Set();
  for (const { result } of rows) result.forEach((r, i) => { if (r === CORRECT) placed.add(i); });
  for (const h of given) if (h.kind === 'position') placed.add(h.index);
  const all = [...Array(WORD_LENGTH).keys()];
  const options = all.filter((i) => !placed.has(i));
  const index = pick(options.length ? options : all, rand);
  return {
    kind: 'position',
    index,
    letter: answer[index],
    text: `The ${ordinal(index + 1)} letter is ${answer[index].toUpperCase()}.`,
  };
}

/** Letters already removed from the keyboard by earlier hints. */
export function eliminatedLetters(given) {
  return new Set(given.filter((h) => h.kind === 'eliminate').flatMap((h) => h.letters));
}

/**
 * Remove up to LETTERS_PER_ELIMINATION letters that are not in the answer and
 * that the player hasn't already ruled out. Returns null if none are left.
 */
export function eliminationHint(answer, rows, given = [], rand = Math.random) {
  const known = new Set([...answer, ...eliminatedLetters(given)]);
  for (const { guess } of rows) for (const c of guess) known.add(c);
  const pool = [...ALPHABET].filter((c) => !known.has(c));
  if (!pool.length) return null;
  const letters = [];
  while (letters.length < LETTERS_PER_ELIMINATION && pool.length) {
    letters.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  }
  letters.sort();
  const list = letters.map((c) => c.toUpperCase()).join(', ');
  const n = letters.length;
  return {
    kind: 'eliminate',
    letters,
    text: `Removed ${n} letter${n === 1 ? '' : 's'} not in the word: ${list}.`,
  };
}

/**
 * The next hint for a game, or null when all hints are used.
 * Hint 1 is always a position. Hints 2 and 3 remove letters, falling back to a
 * position if every wrong letter has already been ruled out.
 */
export function nextHint(answer, rows, given, rand = Math.random) {
  if (given.length >= MAX_HINTS) return null;
  if (given.length === 0) return positionHint(answer, rows, given, rand);
  return eliminationHint(answer, rows, given, rand) || positionHint(answer, rows, given, rand);
}

/** Keyboard colours including what hints revealed. Guess results take priority. */
export function keyboardWithHints(rows, given) {
  const keys = keyboardState(rows);
  for (const h of given) {
    if (h.kind === 'position' && keys[h.letter] !== CORRECT) keys[h.letter] = CORRECT;
    if (h.kind === 'eliminate') for (const c of h.letters) if (!keys[c]) keys[c] = ABSENT;
  }
  return keys;
}

/** Stats after a daily game finishes. Returns a new object. */
export function recordDailyResult(stats, day, won, guessCount) {
  const s = { ...stats, dist: [...stats.dist] };
  if (s.lastPlayedDay === day) return s; // already counted
  s.played += 1;
  s.lastPlayedDay = day;
  if (won) {
    s.won += 1;
    s.dist[guessCount - 1] += 1;
    s.curStreak = s.lastWonDay === day - 1 ? s.curStreak + 1 : 1;
    s.lastWonDay = day;
    s.maxStreak = Math.max(s.maxStreak, s.curStreak);
  } else {
    s.curStreak = 0;
  }
  return s;
}

/** A streak breaks if a whole day was missed. */
export function currentStreak(stats, today) {
  if (stats.lastWonDay == null) return 0;
  return today - stats.lastWonDay <= 1 ? stats.curStreak : 0;
}

export function emptyStats() {
  return {
    played: 0, won: 0, curStreak: 0, maxStreak: 0,
    dist: [0, 0, 0, 0, 0, 0], lastWonDay: null, lastPlayedDay: null,
  };
}

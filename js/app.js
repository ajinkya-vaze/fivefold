import * as E from './engine.js';
import { ANSWERS, VALID } from './words.js';

// ---------- Storage (never throws) ----------
const PREFIX = 'fivefold:';
const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* ignore */ }
  },
};

// ---------- State ----------
const settings = { hard: false, theme: 'system', contrast: false, ...store.get('settings', {}) };
let stats = { ...E.emptyStats(), ...store.get('stats', {}) };
let today = E.dayNumber();
let mode = store.get('mode', 'daily') === 'practice' ? 'practice' : 'daily';
const games = { daily: loadDaily(), practice: loadPractice() };
const typed = { daily: '', practice: '' };
let busy = false;

function newDaily(day) {
  return { day, answer: E.dailyAnswer(ANSWERS, day), rows: [], status: 'playing', hard: false };
}
function loadDaily() {
  const g = store.get('daily', null);
  return g && g.day === today && Array.isArray(g.rows) ? g : newDaily(today);
}
function newPractice() {
  const daily = E.dailyAnswer(ANSWERS, today);
  let answer;
  do { answer = ANSWERS[Math.floor(Math.random() * ANSWERS.length)]; } while (answer === daily);
  return { answer, rows: [], status: 'playing', hard: false };
}
function loadPractice() {
  const g = store.get('practice', null);
  return g && g.answer && Array.isArray(g.rows) ? g : newPractice();
}
const game = () => games[mode];
function saveGame() { store.set(mode, game()); }

const WIN_WORDS = ['Genius', 'Magnificent', 'Impressive', 'Splendid', 'Great', 'Phew'];
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (sel, root = document) => root.querySelector(sel);

// ---------- Board ----------
const boardEl = $('#board');
const tiles = [];
function buildBoard() {
  for (let r = 0; r < E.MAX_GUESSES; r++) {
    const row = document.createElement('div');
    row.className = 'row';
    row.setAttribute('role', 'row');
    const rowTiles = [];
    for (let c = 0; c < E.WORD_LENGTH; c++) {
      const t = document.createElement('div');
      t.className = 'tile';
      t.setAttribute('role', 'gridcell');
      row.appendChild(t);
      rowTiles.push(t);
    }
    boardEl.appendChild(row);
    tiles.push(rowTiles);
  }
}
function setTile(t, letter, state) {
  t.textContent = letter || '';
  if (state) t.dataset.state = state; else delete t.dataset.state;
  t.setAttribute('aria-label', letter ? `${letter.toUpperCase()}${state && state !== 'tbd' ? ' ' + state : ''}` : 'empty');
}
function renderBoard() {
  const g = game();
  for (let r = 0; r < E.MAX_GUESSES; r++) {
    for (let c = 0; c < E.WORD_LENGTH; c++) {
      const t = tiles[r][c];
      t.className = 'tile';
      if (r < g.rows.length) setTile(t, g.rows[r].guess[c], g.rows[r].result[c]);
      else if (r === g.rows.length && g.status === 'playing' && c < typed[mode].length) setTile(t, typed[mode][c], 'tbd');
      else setTile(t, '', null);
    }
  }
}
function replayAnim(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth; // restart the animation
  el.classList.add(cls);
}

// ---------- Keyboard ----------
const keyboardEl = $('#keyboard');
const keyEls = {};
const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const BACKSPACE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7z"/><path d="M12 9.5l5 5M17 9.5l-5 5"/></svg>';
function buildKeyboard() {
  ROWS.forEach((letters, i) => {
    const row = document.createElement('div');
    row.className = 'kb-row';
    if (i === 1) row.appendChild(Object.assign(document.createElement('div'), { className: 'kb-spacer' }));
    if (i === 2) row.appendChild(makeKey('enter', 'Enter', true));
    for (const ch of letters) row.appendChild(makeKey(ch, ch));
    if (i === 2) row.appendChild(makeKey('back', BACKSPACE_SVG, true, 'Delete'));
    if (i === 1) row.appendChild(Object.assign(document.createElement('div'), { className: 'kb-spacer' }));
    keyboardEl.appendChild(row);
  });
}
function makeKey(key, html, wide = false, label) {
  const b = document.createElement('button');
  b.className = 'key' + (wide ? ' wide' : '');
  b.dataset.key = key;
  b.innerHTML = html;
  b.tabIndex = -1;
  b.setAttribute('aria-label', label || (key.length === 1 ? key.toUpperCase() : key));
  b.addEventListener('click', () => { b.blur(); handleKey(key); });
  if (key.length === 1) keyEls[key] = b;
  return b;
}
function renderKeyboard() {
  const state = E.keyboardState(game().rows);
  for (const [ch, el] of Object.entries(keyEls)) {
    if (state[ch]) el.dataset.state = state[ch]; else delete el.dataset.state;
  }
}

// ---------- Toasts ----------
function toast(message, ms = 1200) {
  const openDialog = document.querySelector('dialog[open]');
  const host = openDialog ? $('.toasts', openDialog) : $('body > .toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  host.prepend(el);
  if (ms) {
    setTimeout(() => {
      el.classList.add('hide');
      setTimeout(() => el.remove(), 260);
    }, ms);
  }
  return el;
}

// ---------- Input ----------
function handleKey(key) {
  if (busy || document.querySelector('dialog[open]')) return;
  const g = game();
  if (g.status !== 'playing') return;
  const row = g.rows.length;
  if (key === 'enter') return submitGuess();
  if (key === 'back') {
    if (!typed[mode]) return;
    typed[mode] = typed[mode].slice(0, -1);
    setTile(tiles[row][typed[mode].length], '', null);
    return;
  }
  if (/^[a-z]$/.test(key) && typed[mode].length < E.WORD_LENGTH) {
    const t = tiles[row][typed[mode].length];
    typed[mode] += key;
    setTile(t, key, 'tbd');
    replayAnim(t, 'pop');
  }
}

function rejectRow(message) {
  const g = game();
  replayAnim(boardEl.children[g.rows.length], 'shake');
  toast(message);
}

async function submitGuess() {
  const g = game();
  const guess = typed[mode];
  if (guess.length < E.WORD_LENGTH) return rejectRow('Not enough letters');
  if (!VALID.has(guess)) return rejectRow('Not in word list');
  if (settings.hard) {
    const err = E.hardModeError(guess, g.rows);
    if (err) return rejectRow(err);
  }

  if (g.rows.length === 0) g.hard = settings.hard;
  const result = E.scoreGuess(guess, g.answer);
  g.rows.push({ guess, result });
  typed[mode] = '';
  const won = guess === g.answer;
  if (won) g.status = 'won';
  else if (g.rows.length === E.MAX_GUESSES) g.status = 'lost';

  // Save before animating so closing the app mid-flip loses nothing.
  if (mode === 'daily' && g.status !== 'playing') {
    stats = E.recordDailyResult(stats, g.day, won, g.rows.length);
    store.set('stats', stats);
  }
  saveGame();

  busy = true;
  await revealRow(g.rows.length - 1, result);
  renderKeyboard();

  if (g.status !== 'playing') {
    renderModeBar();
    if (won) {
      toast(WIN_WORDS[g.rows.length - 1], 1800);
      await bounceRow(g.rows.length - 1);
    } else {
      toast(g.answer.toUpperCase(), 3500);
    }
    busy = false;
    await sleep(won ? 700 : 1600);
    if (game() === g) openStats();
  } else {
    busy = false;
  }
}

async function revealRow(r, result) {
  const flip = reduceMotion() ? 0 : 500;
  const stagger = reduceMotion() ? 0 : 300;
  tiles[r].forEach((t, i) => {
    setTimeout(() => {
      if (flip) replayAnim(t, 'flip');
      setTimeout(() => setTile(t, t.textContent, result[i]), flip / 2);
    }, i * stagger);
  });
  await sleep(stagger * (E.WORD_LENGTH - 1) + flip + 20);
  tiles[r].forEach((t) => t.classList.remove('flip'));
}

async function bounceRow(r) {
  if (reduceMotion()) return;
  tiles[r].forEach((t, i) => setTimeout(() => replayAnim(t, 'bounce'), i * 100));
  await sleep(100 * (E.WORD_LENGTH - 1) + 900);
}

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (document.querySelector('dialog[open]')) return;
  let key = null;
  if (e.key === 'Enter') key = 'enter';
  else if (e.key === 'Backspace') key = 'back';
  else if (/^[a-zA-Z]$/.test(e.key)) key = e.key.toLowerCase();
  if (!key) return;
  e.preventDefault();
  handleKey(key);
});

// ---------- Modes ----------
const tabDaily = $('#tab-daily');
const tabPractice = $('#tab-practice');
const btnNew = $('#btn-new');

function renderModeBar() {
  tabDaily.textContent = `Daily #${E.puzzleNumber(today)}`;
  tabDaily.setAttribute('aria-selected', String(mode === 'daily'));
  tabPractice.setAttribute('aria-selected', String(mode === 'practice'));
  btnNew.hidden = mode !== 'practice';
}
function renderAll() {
  renderModeBar();
  renderBoard();
  renderKeyboard();
}
function setMode(m) {
  if (busy || m === mode) return;
  mode = m;
  store.set('mode', mode);
  renderAll();
}
tabDaily.addEventListener('click', () => setMode('daily'));
tabPractice.addEventListener('click', () => setMode('practice'));

function startPractice() {
  const g = games.practice;
  if (busy) return;
  if (g.status === 'playing' && g.rows.length > 0 && !confirm('Give up on this word and start a new one?')) return;
  closeDialogs();
  games.practice = newPractice();
  typed.practice = '';
  mode = 'practice';
  store.set('mode', mode);
  saveGame();
  renderAll();
}
btnNew.addEventListener('click', startPractice);

// ---------- Dialogs ----------
const dlgHelp = $('#dlg-help');
const dlgStats = $('#dlg-stats');
const dlgSettings = $('#dlg-settings');

function openDialog(d) {
  closeDialogs();
  d.showModal();
  const sheet = $('.sheet', d);
  sheet.scrollTop = 0;
  sheet.focus({ preventScroll: true }); // keep the focus ring off the close button

}
function closeDialogs() {
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
}
document.querySelectorAll('dialog').forEach((d) => {
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
});
document.querySelectorAll('[data-close]').forEach((b) => {
  b.addEventListener('click', () => b.closest('dialog').close());
});
$('#btn-help').addEventListener('click', () => openDialog(dlgHelp));
$('#btn-stats').addEventListener('click', () => openStats());
$('#btn-settings').addEventListener('click', () => { renderSettings(); openDialog(dlgSettings); });

// ---------- Stats ----------
let countdownTimer = null;
function openStats() {
  renderStats();
  openDialog(dlgStats);
  clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    if (!dlgStats.open) return clearInterval(countdownTimer);
    if (E.dayNumber() !== today) { checkNewDay(); renderStats(); return; }
    const el = $('#countdown', dlgStats);
    if (el) el.textContent = E.formatCountdown(E.msUntilTomorrow());
  }, 1000);
}

function esc(s) { return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`); }

function renderStats() {
  const g = game();
  const daily = games.daily;
  const done = g.status !== 'playing';
  const parts = [];

  if (mode === 'practice' && done) {
    parts.push(`<div class="result-banner">
      <div class="big">${g.status === 'won' ? `Solved in ${g.rows.length}/${E.MAX_GUESSES}` : 'Out of guesses'}</div>
      ${g.status === 'lost' ? `<div class="answer">${esc(g.answer.toUpperCase())}</div>` : ''}
      <div class="btn-row"><button class="pill secondary" data-act="share">Share</button><button class="pill" data-act="new">New word</button></div>
    </div><h3>Daily statistics</h3>`);
  } else if (mode === 'daily' && daily.status === 'lost') {
    parts.push(`<div class="result-banner"><div class="big">The word was</div><div class="answer">${esc(daily.answer.toUpperCase())}</div></div><h3>Statistics</h3>`);
  } else {
    parts.push(`<h2 id="stats-title">Statistics</h2>`);
  }

  const cur = E.currentStreak(stats, today);
  const winPct = stats.played ? Math.round((stats.won / stats.played) * 100) : 0;
  parts.push(`<div class="stat-grid">
    <div><div class="num">${stats.played}</div><div class="lbl">Played</div></div>
    <div><div class="num">${winPct}</div><div class="lbl">Win %</div></div>
    <div><div class="num">${cur}</div><div class="lbl">Current<br>streak</div></div>
    <div><div class="num">${stats.maxStreak}</div><div class="lbl">Max<br>streak</div></div>
  </div>`);

  parts.push('<h3>Guess distribution</h3>');
  if (stats.won === 0) {
    parts.push('<p class="empty-note">Win a daily puzzle to see your guess distribution.</p>');
  } else {
    const max = Math.max(...stats.dist, 1);
    const hl = daily.status === 'won' && stats.lastWonDay === today ? daily.rows.length : 0;
    parts.push('<div class="dist">' + stats.dist.map((n, i) => `
      <div class="dist-row"><span>${i + 1}</span>
        <div><div class="dist-bar${hl === i + 1 ? ' hl' : ''}" style="width:${Math.max(7, (n / max) * 100)}%">${n}</div></div>
      </div>`).join('') + '</div>');
  }

  if (daily.status !== 'playing') {
    parts.push(`<div class="next-row">
      <div><div class="lbl">Next puzzle</div><div class="countdown" id="countdown">${E.formatCountdown(E.msUntilTomorrow())}</div></div>
      ${mode === 'daily' ? '<button class="pill" data-act="share">Share</button>' : '<button class="pill secondary" data-act="daily">Go to daily</button>'}
    </div>`);
  } else if (mode === 'practice') {
    parts.push(`<div class="btn-row"><button class="pill secondary" data-act="daily">Play today's puzzle</button></div>`);
  }

  $('#stats-body').innerHTML = parts.join('');
}

$('#stats-body').addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'share') shareResult();
  if (act === 'new') startPractice();
  if (act === 'daily') { closeDialogs(); setMode('daily'); }
});

function isDark() {
  if (settings.theme === 'dark') return true;
  if (settings.theme === 'light') return false;
  return matchMedia('(prefers-color-scheme: dark)').matches;
}

async function shareResult() {
  const g = game();
  const text = E.shareText({
    puzzle: mode === 'daily' ? E.puzzleNumber(g.day) : null,
    results: g.rows.map((r) => r.result),
    won: g.status === 'won',
    hard: g.hard,
    highContrast: settings.contrast,
    dark: isDark(),
  });
  if (navigator.share) {
    try { await navigator.share({ text }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied results to clipboard');
  } catch {
    toast('Sharing is not available');
  }
}

// ---------- Settings ----------
const setHard = $('#set-hard');
const setContrast = $('#set-contrast');
const themeSeg = $('#set-theme');

function saveSettings() { store.set('settings', settings); }

function applyTheme() {
  const root = document.documentElement;
  if (settings.theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = settings.theme;
  root.dataset.contrast = settings.contrast ? 'on' : 'off';
  requestAnimationFrame(() => {
    $('#theme-color').setAttribute('content', getComputedStyle(document.body).backgroundColor);
  });
}

function renderSettings() {
  setHard.checked = settings.hard;
  setContrast.checked = settings.contrast;
  themeSeg.querySelectorAll('button').forEach((b) => {
    b.setAttribute('aria-checked', String(b.dataset.themeOpt === settings.theme));
  });
}

setHard.addEventListener('change', () => {
  const g = game();
  if (setHard.checked && g.status === 'playing' && g.rows.length > 0) {
    setHard.checked = false;
    toast('Hard mode can only be turned on at the start of a round', 2200);
    return;
  }
  settings.hard = setHard.checked;
  if (!settings.hard) { games.daily.hard = false; games.practice.hard = false; store.set('daily', games.daily); store.set('practice', games.practice); }
  saveSettings();
});
setContrast.addEventListener('change', () => {
  settings.contrast = setContrast.checked;
  saveSettings();
  applyTheme();
});
themeSeg.addEventListener('click', (e) => {
  const opt = e.target.closest('[data-theme-opt]')?.dataset.themeOpt;
  if (!opt) return;
  settings.theme = opt;
  saveSettings();
  applyTheme();
  renderSettings();
});
$('#btn-reset').addEventListener('click', () => {
  if (!confirm('Reset all daily statistics and streaks? This cannot be undone.')) return;
  stats = E.emptyStats();
  // Keep today's finished puzzle from being counted again.
  if (games.daily.status !== 'playing') stats.lastPlayedDay = today;
  store.set('stats', stats);
  toast('Statistics reset');
});
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

// ---------- New day ----------
function checkNewDay() {
  const now = E.dayNumber();
  if (now === today) return;
  today = now;
  games.daily = newDaily(today);
  typed.daily = '';
  store.set('daily', games.daily);
  if (!busy) renderAll();
  if (mode === 'daily') toast('A new puzzle is ready', 2000);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkNewDay(); });
window.addEventListener('focus', checkNewDay);
setInterval(checkNewDay, 30000);

// ---------- Boot ----------
buildBoard();
buildKeyboard();
applyTheme();
renderAll();
store.set('daily', games.daily);
store.set('practice', games.practice);

if (!store.get('seenHelp', false)) {
  store.set('seenHelp', true);
  openDialog(dlgHelp);
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Run with: ./tests/run.sh   (uses macOS's built-in JavaScriptCore)
import {
  scoreGuess, hardModeError, keyboardState, dayNumber, dailyAnswer,
  shareText, recordDailyResult, currentStreak, emptyStats, formatCountdown,
  msUntilTomorrow,
} from '../js/engine.js';
import { ANSWERS, VALID } from '../js/words.js';

const log = typeof print === 'function' ? print : console.log;
let passed = 0, failed = 0;
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) passed++;
  else { failed++; log(`FAIL ${name}\n  expected ${e}\n  got      ${a}`); }
}
const C = 'correct', P = 'present', A = 'absent';
const s = (str) => [...str].map((c) => ({ g: C, y: P, '.': A })[c]);

// --- scoring
eq('all correct', scoreGuess('crane', 'crane'), s('ggggg'));
eq('all absent', scoreGuess('fight', 'crane'), s('.....'));
eq('mixed', scoreGuess('react', 'crane'), s('yygy.'));
eq('dup guess, single in answer, only one marked', scoreGuess('speed', 'abide'), s('..y.y'));
eq('PAPPY vs APPLE', scoreGuess('pappy', 'apple'), s('yyg..'));
eq('EERIE vs THEME: one E exact, one present', scoreGuess('eerie', 'theme'), s('y...g'));
eq('LLAMA vs HELLO', scoreGuess('llama', 'hello'), s('yy...'));
eq('ROBOT vs FLOOR', scoreGuess('robot', 'floor'), s('yy.g.'));
eq('dup in answer, single in guess', scoreGuess('stole', 'geese'), s('y...g'));

// --- hard mode
const h1 = [{ guess: 'crane', result: scoreGuess('crane', 'cigar') }]; // c=g r=y a=y
eq('hard: keep green', hardModeError('track', h1), '1st letter must be C');
eq('hard: must contain yellow', hardModeError('cabin', h1), 'Guess must contain R');
eq('hard: ok', hardModeError('cairn', h1), null);
const h2 = [{ guess: 'pappy', result: scoreGuess('pappy', 'apple') }];
eq('hard: needs two Ps', hardModeError('pairs', h2), '3rd letter must be P');
eq('hard: two Ps + A ok', hardModeError('apple', h2), null);
eq('hard: absent letters may be reused', hardModeError('cairn', [{ guess: 'fight', result: s('.....') }]), null);

// --- keyboard
eq('keyboard best state', keyboardState([
  { guess: 'crane', result: s('y....') },
  { guess: 'clock', result: s('g....') },
]).c, C);

// --- dates (month is 0-based)
eq('epoch day', dayNumber(new Date(2026, 10, 15, 0, 1)), 0);
eq('epoch day late', dayNumber(new Date(2026, 10, 15, 23, 59)), 0);
eq('next day', dayNumber(new Date(2026, 10, 16, 0, 0)), 1);
eq('across DST', dayNumber(new Date(2027, 2, 15, 12)), 120);
eq('new year', dayNumber(new Date(2027, 0, 1)), 47);
eq('daily answer wraps', dailyAnswer(['a', 'b', 'c'], 4), 'b');
eq('daily answer negative', dailyAnswer(['a', 'b', 'c'], -1), 'c');
eq('countdown', formatCountdown(3723000), '01:02:03');
eq('ms until tomorrow', msUntilTomorrow(new Date(2026, 10, 15, 23, 59, 0)), 60000);

// --- stats & streaks
let st = emptyStats();
st = recordDailyResult(st, 0, true, 3);
st = recordDailyResult(st, 0, true, 3); // double record ignored
eq('first win', [st.played, st.won, st.curStreak, st.dist[2]], [1, 1, 1, 1]);
st = recordDailyResult(st, 1, true, 4);
eq('streak 2', [st.curStreak, st.maxStreak], [2, 2]);
eq('streak shown next day', currentStreak(st, 2), 2);
eq('streak broken by gap', currentStreak(st, 3), 0);
st = recordDailyResult(st, 3, true, 2);
eq('streak restarts after gap', [st.curStreak, st.maxStreak], [1, 2]);
st = recordDailyResult(st, 4, false, 6);
eq('loss resets', [st.played, st.won, st.curStreak], [4, 3, 0]);

// --- share
eq('share text', shareText({
  puzzle: 12, won: true, hard: true, highContrast: false, dark: true,
  results: [s('y..g.'), s('ggggg')],
}), 'Fivefold #12 2/6*\n\n🟨⬛⬛🟩⬛\n🟩🟩🟩🟩🟩');
eq('share loss', shareText({ puzzle: 1, won: false, results: [s('.....')] }).split('\n')[0], 'Fivefold #1 X/6');

// --- word lists
eq('answers are 5 letters', ANSWERS.every((w) => /^[a-z]{5}$/.test(w)), true);
eq('answers unique', new Set(ANSWERS).size, ANSWERS.length);
eq('answers are valid guesses', ANSWERS.every((w) => VALID.has(w)), true);
eq('valid list size > 10000', VALID.size > 10000, true);

log(`\n${passed} passed, ${failed} failed`);
if (failed) throw new Error(`${failed} test(s) failed`);

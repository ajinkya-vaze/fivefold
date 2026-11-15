# Five-Letter Word Game — Spec (draft v1)

A personal, ad-free daily word-guessing game for iPhone. It works like Wordle
(guess a 5-letter word in 6 tries), but has its own name, look and word list,
and nothing that tracks you or needs an account.

Working name: **Fivefold** (easy to change).

---

## 1. Core rules

- A secret 5-letter English word. You get **6 guesses**.
- Each guess must be a real 5-letter word from the dictionary. Otherwise the row
  shakes and a "Not in word list" toast shows. The guess doesn't count.
- After a guess, each tile is colored:
  - **Correct**: right letter, right spot.
  - **Present**: the letter is in the word, but in another spot.
  - **Absent**: the letter is not in the word.
- **Repeated letters** follow the standard rule. First, mark the exact matches.
  Then mark "present" only as many times as the letter still appears in the
  answer. Example: answer `APPLE`, guess `PAPPY` → P(present) A(present)
  P(correct) P(absent) Y(absent).
- Win: you guess the word in 6 tries or fewer. Lose: the answer is revealed
  after the 6th miss.

## 2. Game modes

| Mode | Description |
|---|---|
| **Daily** (default) | One puzzle per day. The word is chosen from the date, so it works offline and is stable all day. It resets at local midnight. After you finish, a countdown to the next puzzle shows. |
| **Practice** (unlimited) | A new random word every time you tap "New word". Practice games don't affect daily stats or streaks. *(Extra feature; the original limits play to one puzzle a day.)* |
| **Archive** *(optional, v1.1)* | Replay any past daily puzzle since the game's launch date. |

## 3. Options

- **Hard mode**: any revealed hint must be used in later guesses. Correct letters
  stay in their spot; present letters must appear somewhere. You can only turn
  it on before the first guess of a game.
- **Dark mode**: follows the system setting, with a manual override.
- **High-contrast / colorblind mode**: changes the "correct" and "present"
  colors to a pair that is easier to tell apart.
- **Haptics** on/off (native build only).

## 4. Screens and UI

1. **Game screen**
   - Header: title, plus buttons for Help (?), Stats (chart) and Settings (gear).
   - A 6×5 tile grid in the middle.
   - On-screen QWERTY keyboard with ENTER and ⌫. Each key takes the best status
     its letter has had so far (correct > present > absent).
   - Animations: tile pop when typing, a staggered flip that reveals colors,
     a row shake on an invalid guess, and a bounce when you win.
   - Toasts: "Not enough letters", "Not in word list", hard-mode messages,
     and win messages ("Genius", "Magnificent", … "Phew").
2. **Help sheet**: the rules with example tiles. Shown automatically on first launch.
3. **Stats sheet**
   - Played, Win %, Current streak, Max streak.
   - Guess distribution bar chart (1–6), with today's result highlighted.
   - Countdown to the next daily puzzle.
   - **Share** button: copies a spoiler-free emoji grid
     (e.g. `Fivefold #142 4/6` plus colored squares) to the clipboard or the iOS share sheet.
4. **Settings sheet**: hard mode, dark mode, high contrast, haptics, reset stats.
5. **Hints sheet** (💡 button in the header; v1.2)
   - **3 hints per word**, revealed one at a time, always in this order:
     1. **Reveal a letter**: one letter in its correct position, picked from
        spots that aren't green yet. That letter turns green on the keyboard.
     2. **Remove letters**: 5 letters that aren't in the word, and that you
        haven't already ruled out, are greyed out on the keyboard.
     3. **Remove letters**: 5 more, as above. If every wrong letter is already
        ruled out, this hint reveals another position instead.
   - **Give up**: always available while playing. It asks for confirmation, then
     reveals the word and ends the round. In Daily it counts as a loss and resets
     the streak. In Practice it has no effect on stats.
   - Hints are saved with the game. A badge on the 💡 button shows how many you've used.
   - Hints don't affect stats or streaks. Share text adds `💡N` when you used any.
   - Hard mode doesn't require you to use hint letters.
   - Greyed-out letters can still be typed. The keyboard just marks them as known wrong.

## 5. Visual design (original look)

- Its own color palette, not a copy of the NYT green/yellow/gray:
  - Correct: teal `#2A9D8F` · Present: amber `#E9A23B` · Absent: slate `#4B5563`
  - High-contrast: blue `#3B82F6` / orange `#F97316`
- Light and dark themes, with system font, rounded tiles and its own app icon.
- Sized for iPhone portrait, respecting the notch and home-indicator safe areas.
  Usable on iPad too.

## 6. Word lists

- **Answer list**: about 2,300 common, family-friendly 5-letter words (no
  plurals ending in -S, no obscure words, no offensive words). It's built from
  public-domain word lists plus word-frequency data, not copied from NYT.
- **Valid-guess list**: about 12,000 5-letter words (public-domain ENABLE/SCOWL
  style list), so most real words are accepted.
- Both lists ship inside the app, so it needs no network.
- The daily answer is `answers[(daysSinceEpoch * K) mod N]` with a fixed
  shuffle. It's deterministic, but words aren't in alphabetical order.

## 7. Saved data (on device only)

- The current game in progress, which survives closing the app.
- Stats: games played and won, current and max streak, guess distribution, last
  daily puzzle completed.
- Settings.
- Storage is localStorage (web) or UserDefaults (native). There are no accounts,
  no analytics, no ads and no network calls.

## 8. Out of scope (v1)

Other NYT games, leaderboards and friends, badges, a solver/analysis bot,
cloud sync, notifications. (Hints were added in v1.1 and reworked in v1.2.)

## 9. How it gets onto your iPhone (decided: A, web app)

| | **A. Web app (PWA)** — recommended | **B. Native SwiftUI app** |
|---|---|---|
| Install | Open a URL in Safari → Share → *Add to Home Screen*. It opens full screen like a normal app and works offline. | Build in Xcode and install over a USB cable or Wi-Fi. |
| Needs on this Mac | Nothing extra; plain HTML/CSS/JS. | **Xcode isn't installed yet** (only Command Line Tools). It's a large App Store download. |
| Expiry | Never expires. | With a free Apple ID, the app **stops opening after 7 days** and must be reinstalled from Xcode. A $99/yr developer account extends this to 1 year. |
| Hosting | Needs a free static host once (e.g. GitHub Pages or Netlify). | None. |
| Haptics / native feel | Close, but iOS Safari has no vibration API. | Full haptics and native animations. |
| Testing here | I can run and test it in the in-app browser. | I can run it in the iOS Simulator once Xcode is installed. |

## 10. Build plan (after go-ahead)

1. Word lists and game engine (scoring, hard-mode checks, daily-word picker), with unit tests.
2. Game screen: grid, keyboard, physical-keyboard support, animations.
3. Help, stats and settings sheets; saving data; share text.
4. Themes, high contrast, app icon; PWA manifest and offline service worker (or the Xcode project).
5. Test in the browser or simulator at iPhone sizes, then install on your phone.

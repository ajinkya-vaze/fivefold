# Fivefold

A personal, ad-free daily five-letter word puzzle for iPhone, built as an
installable web app (PWA). It is plain HTML, CSS and JavaScript, with no build
step, no dependencies, no tracking and no network calls after the first load.
See [SPEC.md](SPEC.md) for the full feature spec.

## Run it locally

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765.

## Run the tests

```bash
./tests/run.sh
```

The tests use macOS's built-in JavaScriptCore, so Node isn't needed.

## Put it on your iPhone

iOS only installs web apps from an HTTPS address, so host the folder on any
free static host once. Then:

1. Open the URL in **Safari** on the iPhone.
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Launch it from the home-screen icon. It opens full screen and works offline.

Hosting options (all free):

- **GitHub Pages**: push this folder to a GitHub repo, then go to
  Settings → Pages → *Deploy from branch* → `main` / root.
- **Netlify Drop**: drag the folder onto https://app.netlify.com/drop.
- **Cloudflare Pages**: connect the repo or upload the folder.

Your stats and saved game live in the iPhone's storage for the installed app.
They are not synced anywhere.

## Updating

The service worker serves the cached app first and fetches updates in the
background, so after you redeploy, a change shows up on the **second** launch.
To force every file to refresh, bump `CACHE` in [sw.js](sw.js) (e.g. `fivefold-v2`).

## Project layout

| Path | What it is |
|---|---|
| `index.html`, `styles.css` | Page structure and styling (light/dark/high-contrast themes) |
| `js/app.js` | UI: board, keyboard, animations, dialogs, saving |
| `js/engine.js` | Pure game logic: scoring, hard mode, dates, streaks, share text |
| `js/words.js` | Generated word lists. Don't edit by hand |
| `tools/answers.txt` | Hand-picked answer words |
| `tools/extra_valid.txt` | Extra accepted guesses (modern words, missing inflections) |
| `tools/build_words.py` | Builds `js/words.js` from the above and `/usr/share/dict/web2` |
| `tools/make_icons.py` | Draws the app icons |
| `sw.js`, `manifest.webmanifest` | Offline support and home-screen install |

**Note:** the daily order comes from a fixed-seed shuffle of `tools/answers.txt`.
Any change to that file reshuffles which word falls on which day, past days
included. To accept more guesses without touching the daily order, edit
`tools/extra_valid.txt` and rebuild.

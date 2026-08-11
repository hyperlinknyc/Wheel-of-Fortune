# AGENTS.md

## Cursor Cloud specific instructions

This is a zero-dependency, no-build-step vanilla-JS PWA (Wheel of Fortune practice
trainer). See `README.md` and `HANDOFF.md` for full architecture and design
constraints. Notes below are the non-obvious bits for running it here.

### Running the app (dev)

- There are no npm/pip dependencies and no build step. The runtimes used are
  Node (for the `tools/` scripts) and Python 3 (for the static dev server).
- Serve the static files over HTTP from the repo root; the app uses ES modules
  and `fetch()` for its JSON data, so opening `index.html` via `file://` will
  not work. Start the dev server with `python3 -m http.server 8000` (documented
  in `README.md`), then open `http://localhost:8000`.

### "Lint"/"test"/"build"

- There is no linter and no automated unit-test suite. The closest equivalent to
  CI checks are the two Node tools:
  - `node tools/build-puzzles.mjs` — regenerates `data/puzzles.json` from
    `tools/puzzle-source.mjs` (deterministic; produces no diff if the source is
    unchanged).
  - `node tools/validate.mjs` — the validation/"test" gate; exits non-zero if any
    board disagrees with its answer, a bonus puzzle is RSTLNE-rich, a name is
    mis-bucketed, the service-worker precache is missing a shipped file, or a
    lesson day drifts outside the 10–15 min band.
- Run both after editing `tools/puzzle-source.mjs`, `js/strategy.js`, or
  `js/lessons.js`. Never hand-edit `data/puzzles.json`.

### Gotcha: service worker caching

- `sw.js` is an aggressive cache-first offline service worker. Once it installs,
  it will serve stale cached files. When developing, hard-reload / bypass the
  service worker (DevTools → Application → Service Workers → "Update on reload"
  or "Bypass for network") or you may not see your edits.

# Handoff — Wheel Trainer

Written for whoever (or whatever agent) picks this up next in Cursor. You
have no memory of the conversation that built this — everything you need
should be in this doc, the README, and the code comments. Read this first,
then `README.md` for setup/deploy mechanics.

## What this is, in one paragraph

A private, single-purpose PWA for one contestant taping **Wheel of Fortune**,
built to close exactly three gaps: she over-spins instead of solving, she
blanks on proper names, and she drifts during opponents' turns. Vanilla JS,
no build step, no framework, no backend, no accounts. Everything persists to
`localStorage`. It targets iOS Safari on an iPhone, one-handed, in 10–15
minute daily sessions over a 7-day countdown to taping.

Repo: `hyperlinknyc/Wheel-of-Fortune`, branch `claude/wheel-fortune-trainer-rybb5s`.
Three commits, all pushed, working tree clean as of this handoff.

## Status: functionally complete, cosmetically unfinished

Every drill in the original spec (10 of them) is built and wired into a
7-day lesson plan plus a "Practice Anything" free mode. The puzzle bank,
strategy engine, adaptive weighting, offline PWA shell, and cheat sheet are
all in place and have been exercised with headless-Chromium tests (Playwright,
emulating iPhone SE and iPhone 13) — not on a physical device. Treat browser
automation results as strong evidence, not proof; a real-device pass is still
owed before this ships to her.

**One known open cosmetic bug, left unfixed on purpose** (user said "stop
what you're doing on this and commit" mid-investigation):

- On the home screen, the three stat rings ("Category discipline", "Solve
  timing", "Name recall") sit side-by-side in `.rings` (`css/app.css`). After
  a readability pass bumped base font size 18px→20px, the third ring's label
  text ("Name recall") can clip past the right edge of the viewport on a
  390px-wide screen (iPhone 13 class). Confirmed via DOM measurement:
  `rect.right = 412` against a 390px screen. Not a layout break, not a
  functional bug — just a label that can run past the edge. Fix is either to
  shrink `.ring .rlabel` font-size slightly, wrap it to two lines (CSS
  already has `line-height: 1.2` on it, just remove the `white-space: nowrap`
  / `overflow: hidden` / `text-overflow: ellipsis` that's currently
  suppressing the wrap), or reduce label text ("Names" instead of "Name
  recall"). Start here — see `js/ui.js`'s `ring()` function and
  `.rings`/`.ring` rules in `css/app.css` (~line 208).

Beyond that specific bug, nobody has done a **deliberate polish pass** for
low vision beyond the one readability bump already applied (contrast ratios
were already good pre-bump — see "Design decisions" below). If you're
picking this up to keep working on it for her, a full pass on every screen
at both 375px (iPhone SE 2020+) and 428px (iPhone Pro Max) widths, actually
looking at the rendered output, is the highest-value next step.

## Architecture

No build step. Static files served over HTTPS (required for PWA install and
service worker). Everything is ES modules loaded directly by the browser —
`<script type="module" src="js/app.js">` in `index.html`.

```
index.html            shell: topbar / #screen / #actions / bottom nav
css/app.css            the entire design system (dark-only, one file)
manifest.webmanifest   PWA metadata
sw.js                   offline cache-first service worker

js/strategy.js          SOURCE OF TRUTH for every rule and constant.
                         Every drill's feedback and the cheat sheet both
                         generate their text from this file's exports, so a
                         rule cannot be taught two different ways on two
                         screens. If a game-strategy number is ever wrong,
                         fix it here — nowhere else.
js/store.js             localStorage persistence: streak, per-drill result
                         log, stats, and the adaptive weighting engine
                         (reweights the puzzle mix toward her worst clusters
                         every 10 results, floors proper-name share at 55%).
js/data.js              loads data/puzzles.json, weighted puzzle selection
js/ui.js                DOM kernel: hyperscript (`h()`), hash router,
                         puzzle-board tile renderer, the Timer class (see
                         "Timer correctness" below), audio blips,
                         full-screen interrupt, reusable card components.
                         Also owns a cancellation registry (`after()`,
                         `every()`, `cancelPending()`) — see "Known traps."
js/lessons.js            the 7-day plan definition + day intro/outro screens
js/cheatsheet.js         green-room screen, generated from strategy.js
js/app.js                bootstrap, router wiring, home screen, practice
                         menu, settings screen
js/voice.js              Web Audio energy-only voice-activity detection for
                         the bonus-round silence stat. No speech-to-text.
js/drills/
  common.js              shared drill scaffolding: runBlock() runner,
                          pot generation, mid-puzzle board states
  decision.js             Drill 1 (solve-or-spin), Drill 2 (vowel)
  bonus.js                Drill 3 (category choice), 4 (letter set),
                          5 (full bonus sim), + the shared letterPicker()
  attention.js             Drill 6 (toss-up buzz), Drill 9 (attention loop)
  names.js                 Drill 7 (name shape), 8 (sound it out),
                          10 (say it exactly)

data/puzzles.json        681 generated puzzles — DO NOT hand-edit
data/names.json          length-indexed name-recall tables

tools/puzzle-source.mjs  hand-authored category → answer lists
tools/build-puzzles.mjs  compiles puzzle-source.mjs → data/puzzles.json,
                          computing wordLengths/difficulty/bonusEligible/etc
tools/validate.mjs       fails (exit 1) if any board disagrees with its
                          answer, if a bonus puzzle is RSTLNE-rich, if a name
                          is filed under the wrong length bucket, if the
                          service worker's precache is missing a shipped
                          file, or if the 7-day plan's modeled session length
                          drifts outside 10–15 minutes. Run this after any
                          change to puzzle-source.mjs, strategy.js, or
                          lessons.js.
tools/make-icons.mjs     generates icons/icon-{180,192,512}.png from a
                          hand-rolled PNG encoder (no dependencies)
```

## Non-negotiable design constraints (do not relax these)

These came directly from the original brief and shaped every decision.
Breaking them isn't a style choice, it undermines why the app exists:

1. **No typing during timed drills.** Every timed drill follows tap → speak
   out loud → reveal → self-score ("I HAD IT" / "I DIDN'T"). iPhone typing
   latency would swamp the thing being measured, and she speaks on the real
   show, not types. Text entry is fine in *untimed* drills only
   (`sound-it-out`, `say-it-exactly`'s checklist).
2. **Strategy numbers live in exactly one place**: `js/strategy.js`. If you
   need to change a rule (e.g. the $3,000 copies-per-spin divisor, the vowel
   order A→O→E→I, a bonus letter-set override), change it there. Every drill
   and the cheat sheet read from those exports — don't hardcode a number
   anywhere else.
3. **`wordLengths` is computed, never hand-typed.** `tools/build-puzzles.mjs`
   derives it from `answer`. A puzzle with a wrong board would be worse than
   no puzzle at all — `tools/validate.mjs` enforces this and exits non-zero
   on any mismatch. Never hand-edit `data/puzzles.json`; edit
   `tools/puzzle-source.mjs` and rebuild.
4. **60×60px minimum touch targets, verified**, not assumed. Every
   interactive element was measured with Playwright at 375px and 390px
   widths. If you add new UI, check it the same way (`.btn`, `.key`,
   `.strip`, `.day`, `.util` all target this in `css/app.css`).
5. **No feature flags, no backend, no accounts, no analytics, no network
   calls at runtime.** Everything is static files + `localStorage`. Keep it
   that way — it's a deliberate scope cut, not an oversight.
6. **Dark theme only**, committed. Don't add a light/dark toggle.
7. **Gamification stays restrained.** Streak, a completion ring, a daily
   goal. No hearts, no lives, no fail states, nothing that can lock her out
   of practicing. She has 7 days and finite patience.

## Known traps if you touch the code

- **Async cancellation.** Drills schedule `setTimeout`/`setInterval` work
  (letter reveals, countdown clocks, opponent-turn simulation). If you write
  raw `setTimeout`/`setInterval` instead of the `after()`/`every()` helpers
  exported from `js/ui.js`, navigating away from a drill mid-round can let
  stale timers paint over whatever screen she's now looking at. This was a
  real bug, found and fixed (commit `00f647b`) — the fix is a `pending`
  registry that `cancelPending()` clears, called automatically by the router
  on every navigation and between drill rounds in `runBlock()`
  (`js/drills/common.js`). Use `after(ms, fn)` / `every(ms, fn)` /
  `new Timer(...)` for anything a drill schedules, never bare
  `setTimeout`/`setInterval`.
- **Timer clock source.** `Timer` in `js/ui.js` computes elapsed time from
  `Math.max(performance.now() - t0, Date.now() - d0)` on every tick, never
  by accumulating deltas. This is deliberate: if the OS throttles rAF (screen
  dim) or freezes the tab, one of the two clocks still advances correctly
  when the page resumes, and taking the max means a stall reports as time
  passed, not free extra seconds. Verified to hold ±0ms drift over a 7-second
  simulated suspension. Don't "simplify" this to a single running interval.
- **Puzzle bank edits go through the pipeline.** Edit
  `tools/puzzle-source.mjs` → run `node tools/build-puzzles.mjs` → run
  `node tools/validate.mjs`. Never touch `data/puzzles.json` directly.
- **Session-length modeling.** `tools/validate.mjs` contains a
  `ROUND_COST` table (seconds per round, split into forced/active/read time)
  that it uses to check every day in `js/lessons.js` lands in the 10–15
  minute band. If you add a new drill type to the lesson plan, add its cost
  model to that table or the validator will fail loudly (correctly) rather
  than silently ship a 30-minute "Day 3."
- **`js/ui.js` guards all `window` access** behind
  `typeof window !== 'undefined'` so the module can be `import()`-ed under
  plain Node (used by test scripts and could be used by future tooling).
  Keep that guard if you add more top-level `window.*` calls to that file.

## What's been tested, and how

All testing so far is via Playwright driving headless Chromium with iPhone
device emulation (`devices['iPhone SE']`, `devices['iPhone 13']`) — no
physical device pass yet. Things specifically verified:

- Every one of the 10 drills launches and completes a full round with zero
  console/page errors
- Zero text-input elements present during any timed drill
- All 681 puzzle boards render with tile counts matching their answers
  (cross-checked against `tools/validate.mjs`'s independent check)
- 10-second bonus clock: ±0–1ms drift over repeated real-time runs; still
  accurate after `requestAnimationFrame` is killed mid-count (simulating a
  dimmed screen) and after a simulated 7-second full suspension
- Touch targets ≥60×60px across every screen at both 375px and 390px widths
  (320px — the original 2016 iPod-era iPhone SE — was explicitly not chased;
  not a realistic device in 2026)
- Service worker installs, takes control, and the app fully works with the
  network killed (`context.setOffline(true)`) — home screen, a drill, and
  the cheat sheet all render from cache
- Progress (streak, drill log, day-completion, adaptive plan weights)
  survives a simulated "hard close": new browser context/page against the
  same `localStorage`, i.e. equivalent to force-quitting and reopening
- Auto-played a full Day 1 (44 rounds) and Day 7 (52 rounds) end-to-end with
  randomized taps; both reached their completion screen with zero errors
- `localStorage` throwing (private-browsing-style denial) degrades quietly —
  app stays usable, `store.js`'s `save()`/`flush()` catch and drop the
  oldest half of the result log rather than crashing
- WCAG contrast computed for the palette: worst case 5.93:1 (red-on-black),
  everything else 6.7:1+ — all clear AA's 4.5:1 floor

**Not yet done**: an actual iPhone in someone's hand. Also not done: VoiceOver
/ screen-reader pass (not in original scope, but worth asking about if this
keeps evolving), and a real go/no-go check of whether GitHub Pages is
actually serving this branch (the README documents the steps but nobody has
confirmed a live URL loads).

## Puzzle bank composition (as of this handoff)

681 puzzles, 55.5% proper-name-bearing (target was ~55%, the deliberate
gap-closing weight), 197 bonus-eligible (RSTLNE density < 35%, matching how
the real show builds bonus boards). Run `node tools/build-puzzles.mjs` and
watch its stdout for the per-category breakdown if you add more source
puzzles — it prints category totals and bonus-eligible counts on every
build.

## Immediate next steps, roughly in priority order

1. Fix the ring-label clipping bug described above.
2. Do a real low-vision polish pass across every screen (not just the one
   global font-size bump already applied) — actually render each screen at
   375px and 428px and look at it, don't just check computed contrast
   ratios.
3. Confirm GitHub Pages (or wherever this deploys) actually serves the app
   and that "Add to Home Screen" works from real Safari on a real iPhone —
   this has only been tested via emulation.
4. If there's time before taping: a real-device pass on the acceptance
   criteria list in the original brief (10 items — loads standalone from
   home screen in airplane mode, one-handed reachability, persistence across
   phone restart, 10s clock accuracy, arithmetic shown on wrong
   solve-or-spin answers, full-screen AVOID-category interrupt, no typing in
   timed drills, board/answer tile match, 10–15 min session length, cheat
   sheet in ≤2 taps).

## Everything else you need

`README.md` has deploy instructions (GitHub Pages → Safari → Add to Home
Screen) and the puzzle-bank edit workflow. `js/strategy.js`'s file header
and inline comments explain the game-theory derivations (why $3,000 per
copy, why A→O→E→I, why H/G/B+O is the default bonus set, etc.) if you need
to verify or extend the rules rather than just trust them.

# Wheel Trainer

A private practice tool for one contestant, seven days out from a taping.

It exists to fix three things and nothing else:

1. **Decision-making** — spinning when she should solve, buying letters that tell her nothing
2. **Proper names** — blanking on people, places and titles
3. **Attention** — drifting mid-round while opponents play

Not affiliated with, endorsed by, or connected to any television programme. No
logos, no likenesses, no wordmarks. It is a private study aid.

---

## Getting it on the phone

The app is plain static files. It needs to be served over **HTTPS** for
"Add to Home Screen" and offline mode to work.

### GitHub Pages (easiest)

1. Push this branch to GitHub.
2. Repo → **Settings** → **Pages**.
3. Under *Build and deployment*, set **Source: Deploy from a branch**, pick this
   branch and the `/ (root)` folder. Save.
4. Wait a minute, then open the URL it gives you **in Safari on the iPhone**.
5. Tap the **Share** button → **Add to Home Screen** → **Add**.

Open it from the new icon. It launches with no browser chrome and works in
airplane mode from then on.

> It must be Safari. Chrome on iOS cannot install a home-screen app.

### Running it locally to check something

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

---

## After changing any puzzle

`wordLengths` is generated from the answer, never typed by hand.

```sh
node tools/build-puzzles.mjs   # rebuild data/puzzles.json from the source list
node tools/validate.mjs        # fails loudly if anything is wrong
```

`validate.mjs` exits non-zero if any board's tile count disagrees with its
answer, if a bonus-eligible puzzle is RSTLNE-rich, if a name is filed under the
wrong length, or if a shipped file is missing from the service-worker precache
(which would silently break offline mode). **Run it before deploying.**

To regenerate the home-screen icons: `node tools/make-icons.mjs`.

---

## What is in here

```
index.html            shell
css/app.css           the whole design system
js/strategy.js        every rule and constant; all feedback is generated from it
js/store.js           localStorage, streak, stats, adaptive engine
js/data.js            bank loading and weighted selection
js/ui.js              hyperscript, router, board renderer, timers, audio
js/lessons.js         the seven-day plan
js/cheatsheet.js      the green-room screen
js/drills/            the ten drills
js/play.js            Play mode chooser, and the solo round
js/game.js            three rounds against two computer opponents
js/wheel.js           the SVG wheel, shared by both Play modes
js/tips.js            optional coach tips, shown as non-blocking chips
data/puzzles.json     681 puzzles, generated -- do not hand-edit
data/names.json       length-indexed name tables
tools/                build, validation, icon generation
sw.js                 offline precache
```

No build step, no dependencies, no backend, no analytics, no network calls at
runtime. Everything is stored on the phone.

## The rules it teaches

All of it lives in `js/strategy.js`, so the drills and the cheat sheet can
never disagree:

- **Solve vs. spin** — `copies needed = ceil(pot / 3000)`; over $9,000 always
  solve; on a proper name always solve on recognition
- **Vowels** — $250 flat, never ends your turn, break-even is `250 / pot`; on
  names buy before the second consonant, order A → O → E → I
- **Bonus** — RSTLNE gives up ~29.6% of a bonus board against ~44.7% in the main
  game; the default H, G, B + O set covers ~22.5% of the rest, for ~45% total
- **Category ranking** — take / tolerate / hard avoid, with the absolute rule
  that a proper-noun category is never taken when anything else is on offer
- **Letter-set overrides** per category, including that **Y is a consonant**

## Play mode

Two ways in, from **PLAY A GAME** on the home screen:

- **Play the game** — three rounds against Rita and Dean, with a $1,000 round
  minimum and the turn passing on any miss, Bankrupt, Lose-a-Turn or wrong solve.
- **Just spin** — one board, no opponents, no clock.

The opponents are the two halves of the lesson rather than set dressing. Rita
will not consider solving until the board is 76% showing, so she keeps spinning
puzzles she has already got and gets punished for it; Dean goes at 44% and
quietly wins. Neither can see the answer when choosing a letter — they pick by
English frequency out of what is still uncalled, and their solve attempts are
rolled against how much of the board is actually lit. `validate.mjs` simulates
several hundred turns for each and fails the build if either becomes unbeatable
or if the early solver stops out-solving the grinder, since that gap *is* the
lesson.

**Nothing in Play writes to the results log.** If messing about for fun could
move Category Discipline, the number she is driving to 100% would stop meaning
anything and the adaptive engine would start reweighting itself off play data.
Play totals live in their own keys.

**Coach tips** are one-line chips under the board — tap to open the reasoning,
ignore them entirely if you like. They never block a round and have no dismiss
button; a tip retires itself after four sightings, and the lot can be switched
off in Settings. Every tip is anchored to a cue in `js/strategy.js`, and
`validate.mjs` fails if a tip invents its own phrasing for a rule or listens for
a moment Play mode never emits.

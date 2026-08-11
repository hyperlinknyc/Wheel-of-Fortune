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

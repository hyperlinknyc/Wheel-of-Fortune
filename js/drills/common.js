// Shared drill scaffolding: block runner, pot generation, board states.

import { h, btn, setScreen, setActions, setTop, tipCard, primeAudio, cancelPending } from '../ui.js';
import { markBlockComplete } from '../store.js';
import { RSTLNE_MAIN_COVERAGE } from '../strategy.js';

const CONSONANTS = 'BCDFGHJKLMNPQRSTVWXYZ'.split('');
const VOWELS = 'AEIOU'.split('');

/**
 * Runs one drill block: tip card, then N rounds, then a summary.
 * Each drill supplies `round(ctx)`, which calls ctx.next(result) when done.
 */
export function runBlock({ drill, rounds = 6, dayNumber = null, blockIndex = null, onDone }) {
  const started = Date.now();
  const results = [];
  let i = 0;

  const showTip = () => {
    setTop({ title: drill.title, back: () => onDone?.({ aborted: true, results }) });
    setScreen(
      tipCard(drill.tip, start),
      h('p', { class: 'muted center' }, `${rounds} rounds. About ${drill.minutes ?? 3} minutes.`)
    );
    setActions(btn('GOT IT — START', { variant: 'primary tall', onclick: () => { primeAudio(); start(); } }));
  };

  const start = () => next();

  const next = (result) => {
    cancelPending();
    if (result) results.push(result);
    if (i >= rounds) return finish();
    i++;
    setTop({
      title: drill.title,
      back: () => onDone?.({ aborted: true, results }),
      right: `${i}/${rounds}`,
    });
    drill.round({ index: i, total: rounds, next });
  };

  const finish = () => {
    cancelPending();
    const correct = results.filter((r) => r.correct).length;
    const elapsed = Date.now() - started;
    // Keyed by position in the day, not drill.id: several days repeat the
    // same drill as separate blocks (e.g. Day 2 runs solveOrSpin twice), and
    // an id-keyed complete would falsely mark the second occurrence done too.
    if (dayNumber && blockIndex != null) markBlockComplete(dayNumber, blockIndex, elapsed);
    setTop({ title: drill.title });
    setScreen(
      h('div', { class: 'card center' },
        h('h3', {}, 'Block complete'),
        h('div', { class: 'big-num' }, `${correct}/${results.length}`),
        h('p', { class: 'muted' }, drill.summaryLine?.(results) ?? 'Logged.')
      ),
      ...(drill.summaryExtra?.(results) ?? [])
    );
    setActions(btn('CONTINUE', { variant: 'primary tall', onclick: () => onDone?.({ results, elapsed }) }));
  };

  showTip();
}

// ---------------------------------------------------------------------------
// Pots
//
// Exact multiples of $3,000 are avoided: that is the one place where the
// ceil() rule and the published band table disagree, and she should never see
// a board whose right answer depends on which of the two you read.
// ---------------------------------------------------------------------------

export function randomPot(band = null) {
  const bands = [
    [700, 2900],    // 1 copy
    [3100, 5900],   // 2 copies
    [6100, 8900],   // 3 copies
    [9100, 16000],  // always solve
  ];
  const idx = band ?? weightedIndex([0.25, 0.3, 0.25, 0.2]);
  const [lo, hi] = bands[idx];
  const raw = lo + Math.random() * (hi - lo);
  const pot = Math.round(raw / 50) * 50;
  return pot % 3000 === 0 ? pot + 50 : pot;
}

function weightedIndex(weights) {
  const t = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * t;
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; }
  return weights.length - 1;
}

export const pickN = (arr, n) => {
  const a = [...arr];
  const out = [];
  while (out.length < n && a.length) out.push(...a.splice(Math.floor(Math.random() * a.length), 1));
  return out;
};

const shuffle = (arr) => pickN(arr, arr.length);

/**
 * A believable mid-puzzle board: enough of the tiles lit to make "you know
 * the answer" plausible, a few blanks left so it doesn't read as finished.
 *
 * Targets a fraction of actual board *tiles* lit, not a count of distinct
 * letters -- picking 3 rare letters like J, Q, X lights almost nothing,
 * while 3 common ones can light a third of the board. Real feedback was
 * that the app "expects you to know the answer with just a few consonants
 * on the board," which was exactly this: a flat 2-3 letter *types*, so a
 * long answer with mostly-rare called letters could sit under 20% lit.
 * Anchored to RSTLNE_MAIN_COVERAGE (the app's own stated baseline for what
 * a main-game board typically shows by mid-round) plus a bit more, since a
 * believable "I know it" moment is usually past RSTLNE plus a couple of
 * personally-called letters -- selection is frequency-weighted, favoring
 * common letters first, the way RSTLNE-style reveals actually accumulate.
 */
export function midPuzzleState(puzzle, { vowels = false, minHidden = 2 } = {}) {
  const allLetters = puzzle.answer.replace(/[^A-Z]/g, '');
  const totalTiles = allLetters.length;
  const uniqueLetters = [...new Set(allLetters)];
  const wordCount = puzzle.answer.split(' ').length;

  const freq = (c) => [...allLetters].filter((x) => x === c).length;
  const uniqueConsonants = shuffle(CONSONANTS.filter((c) => uniqueLetters.includes(c)))
    .sort((a, b) => freq(b) - freq(a)); // common letters first, ties randomized
  const uniqueVowels = shuffle(VOWELS.filter((c) => uniqueLetters.includes(c)))
    .sort((a, b) => freq(b) - freq(a));

  const targetFraction = wordCount >= 5 ? RSTLNE_MAIN_COVERAGE + 0.22
    : wordCount >= 3 ? RSTLNE_MAIN_COVERAGE + 0.16
      : RSTLNE_MAIN_COVERAGE + 0.10;
  const targetTiles = Math.round(totalTiles * Math.min(0.85, targetFraction));

  const revealed = new Set();
  let lit = 0;
  const litCount = (c) => (revealed.has(c) ? 0 : freq(c));

  if (vowels) {
    const vowelTarget = Math.max(1, Math.ceil(uniqueVowels.length / 2));
    for (const v of uniqueVowels.slice(0, vowelTarget)) { revealed.add(v); lit += litCount(v); }
  }
  for (const c of uniqueConsonants) {
    if (lit >= targetTiles) break;
    lit += freq(c);
    revealed.add(c);
  }

  const misses = pickN(CONSONANTS.filter((c) => !uniqueLetters.includes(c)), 1);

  // Back off until a couple of letters are still hidden, so it never reads
  // as a fully-solved board -- a floor for short/common-letter-heavy
  // answers, not the thing driving how generous the reveal is.
  const order = [...revealed].sort((a, b) => freq(a) - freq(b)); // drop rarest first
  let i = 0;
  while (uniqueLetters.filter((l) => !revealed.has(l)).length < minHidden && i < order.length) {
    revealed.delete(order[i++]);
  }
  return { revealed, called: [...revealed, ...misses] };
}

export const money = (n) => '$' + Math.round(n).toLocaleString('en-US');

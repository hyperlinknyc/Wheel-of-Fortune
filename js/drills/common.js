// Shared drill scaffolding: block runner, pot generation, board states.

import { h, btn, setScreen, setActions, setTop, tipCard, primeAudio, cancelPending } from '../ui.js';
import { markBlockComplete } from '../store.js';

const CONSONANTS = 'BCDFGHJKLMNPQRSTVWXYZ'.split('');
const VOWELS = 'AEIOU'.split('');

/**
 * Runs one drill block: tip card, then N rounds, then a summary.
 * Each drill supplies `round(ctx)`, which calls ctx.next(result) when done.
 */
export function runBlock({ drill, rounds = 6, dayNumber = null, onDone }) {
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
    if (dayNumber) markBlockComplete(dayNumber, drill.id, elapsed);
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

/**
 * A believable mid-puzzle board: some consonants called, optionally a vowel.
 * Never reveals so much that the board reads itself.
 */
export function midPuzzleState(puzzle, { vowels = false, minHidden = 3 } = {}) {
  const letters = [...new Set(puzzle.answer.replace(/[^A-Z]/g, ''))];
  const inAnswer = (c) => letters.includes(c);

  const calledHits = pickN(CONSONANTS.filter(inAnswer), 2 + Math.floor(Math.random() * 2));
  const misses = pickN(CONSONANTS.filter((c) => !inAnswer(c)), 1);
  const revealed = new Set([...calledHits, ...(vowels ? pickN(VOWELS.filter(inAnswer), 1) : [])]);

  // Back off until enough of the board is still blank to be worth solving.
  while (letters.filter((l) => !revealed.has(l)).length < minHidden && revealed.size) {
    revealed.delete([...revealed][revealed.size - 1]);
  }
  return { revealed, called: [...revealed, ...misses] };
}

export const money = (n) => '$' + Math.round(n).toLocaleString('en-US');

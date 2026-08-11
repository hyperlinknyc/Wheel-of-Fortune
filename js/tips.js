// Coach tips: optional, and never in the way.
//
// The rule for this file is that a tip must be ignorable. It renders as one
// slim line she can walk straight past; tapping it opens the reasoning, tapping
// again closes it. Nothing here covers the screen, pauses a round, or costs a
// tap to get rid of -- the moment a tip has to be dismissed it has stopped
// being a tip and become an interruption, and then she stops reading them.
//
// Every tip leads with a cue from REFLEXES, so Play mode coaches in exactly the
// words the drills use. tools/validate.mjs asserts that link, which is what
// stops Play mode from quietly growing a second, contradictory rulebook.

import { h } from './ui.js';
import * as store from './store.js';
import {
  REFLEXES, MISTAKES, money, copiesRequired,
  ALWAYS_SOLVE_ABOVE, COPIES_DIVISOR, VOWEL_COST,
} from './strategy.js';

// After this many separate sessions of showing a tip, it retires itself. A
// coach who keeps repeating a note she has already absorbed is just noise.
const RETIRE_AFTER = 4;

// One tip per session per id: the session set is what stops a chip re-appearing
// on every re-render of the same screen.
const shownThisSession = new Set();

/**
 * The moments Play mode reports. A tip subscribes to one or more of these by
 * name rather than testing ctx.event by hand, so a tip listening for a moment
 * that never happens is a validation failure instead of silent dead code --
 * which is exactly what the first draft of this file shipped.
 */
export const EVENTS = [
  'turn',               // her turn, main screen
  'bankrupt',
  'lose-turn',
  'miss',               // wrong consonant, or a wrong solve in the game
  'vowel',
  'solving',            // she has tapped SOLVE and is about to say it
  'opponent-turn',
  'opponent-bankrupt',
  'opponent-solved',
];

/**
 * ctx fields, all optional beyond `event`:
 *   pot        her round money
 *   coverage   0..1 fraction of the board showing
 *   mode       'solo' | 'game'
 *   isProperName, category, spins, vowelsBought, roundsPlayed, opponent
 */
export const TIPS = [
  {
    id: 'play-is-free',
    on: ['turn'],
    cue: 'Nothing in Play touches your training stats.',
    why: 'The rings on the home screen only move in drills. Play as loose as you like — ' +
      'this is the room to try the thing you would not risk on tape.',
    when: (c) => !c.roundsPlayed && !c.spins && !c.pot,
  },
  {
    id: 'bankrupt-is-the-price',
    on: ['bankrupt'],
    reflex: 'solveKnown',
    why: 'That is the 1-in-12 every spin was buying. It never feels like 1-in-12 until it lands, ' +
      'which is exactly why the rule is a reflex and not a calculation.',
  },
  {
    id: 'opponent-milked',
    on: ['opponent-bankrupt'],
    cue: 'That is mistake #1, live.',
    why: (c) => `${c.opponent ?? 'She'} had that puzzle and kept spinning for more. ` +
      'The pot only exists if you solve. Watching it happen to someone else is the ' +
      'cheapest version of the lesson.',
  },
  {
    id: 'pot-cap',
    on: ['turn'],
    reflex: 'potCap',
    when: (c) => (c.pot ?? 0) > ALWAYS_SOLVE_ABOVE,
  },
  {
    id: 'name-solve',
    on: ['turn'],
    reflex: 'nameSolve',
    when: (c) => c.isProperName && (c.coverage ?? 0) >= 0.4,
  },
  {
    id: 'name-vowel',
    on: ['turn'],
    reflex: 'nameVowel',
    when: (c) => c.isProperName && !c.vowelsBought && (c.pot ?? 0) >= VOWEL_COST,
  },
  {
    id: 'board-is-there',
    on: ['turn'],
    reflex: 'solveKnown',
    why: (c) => `The board is about ${Math.round((c.coverage ?? 0) * 100)}% showing. ` +
      'If you can read it, the next spin is not buying information — it is risking ' +
      'money you have already earned.',
    when: (c) => (c.coverage ?? 0) >= 0.6,
  },
  {
    id: 'copies-first',
    on: ['turn'],
    reflex: 'certainCopies',
    why: (c) => `At ${money(c.pot)} you need ${copiesRequired(c.pot)} certain ` +
      `${copiesRequired(c.pot) === 1 ? 'copy' : 'copies'} still out to justify a spin ` +
      `(pot ÷ ${COPIES_DIVISOR}). Not "probably" — countable on the board.`,
    when: (c) => (c.pot ?? 0) >= COPIES_DIVISOR,
  },
  {
    id: 'opponent-sniped',
    on: ['opponent-solved'],
    cue: 'That is what a disciplined solver does to you.',
    why: (c) => `${c.opponent ?? 'They'} solved off a part-full board and took the round. ` +
      'Your pot went to zero the moment they said it. Money on the table is not money.',
    when: (c) => (c.pot ?? 0) > 0,
  },
  {
    id: 'miss-costs-the-turn',
    on: ['miss'],
    cue: 'A miss hands the puzzle to the table.',
    why: 'This is the hidden half of the spin cost. It is not only Bankrupt — a consonant ' +
      'that is not up there ends your turn just as completely, pot still unbanked.',
    when: (c) => c.mode === 'game',
  },
  {
    id: 'vowel-reason',
    on: ['vowel'],
    reflex: 'vowelReason',
  },
  {
    id: 'say-it-exactly',
    on: ['solving'],
    reflex: 'sayExactly',
  },
  {
    id: 'read-dont-invent',
    on: ['solving'],
    cue: MISTAKES[2].cue,
    why: MISTAKES[2].why + ' Read the tiles that are lit before you commit to a word.',
    when: (c) => (c.coverage ?? 1) < 0.6,
  },
  {
    id: 'attention-loop',
    on: ['opponent-turn'],
    reflex: 'attentionLoop',
    why: 'Their turn is not downtime. Longest word, best guess, first action — decide all ' +
      'three before control comes back to you, or you spend your first spin thinking.',
  },
  {
    id: 'lose-a-turn-is-cheap',
    on: ['lose-turn'],
    cue: 'Lose-a-Turn is the good one.',
    why: 'The pot survives. Of the three ways a spin can end your turn, this is the only ' +
      'one that does not take the money with it.',
  },
  {
    id: 'vowel-when-broke',
    on: ['turn'],
    cue: `A vowel is ${money(VOWEL_COST)} you have to earn first.`,
    why: 'You cannot buy one at zero. That is the argument for taking the early consonant ' +
      'spins seriously even on a board you half-recognise.',
    when: (c) => (c.pot ?? 0) < VOWEL_COST && (c.spins ?? 0) >= 2,
  },
];

/** Resolve a tip's text. `why` may be a function of the context. */
export function resolveTip(tip, ctx = {}) {
  const r = tip.reflex ? REFLEXES[tip.reflex] : null;
  const why = typeof tip.why === 'function' ? tip.why(ctx) : tip.why;
  return {
    id: tip.id,
    cue: tip.cue ?? r?.cue ?? '',
    why: why ?? r?.why ?? '',
  };
}

/** The first tip that fits, or null. Order in TIPS is priority order. */
export function pickTip(ctx = {}) {
  if (!store.tipsOn()) return null;
  for (const t of TIPS) {
    if (!t.on.includes(ctx.event)) continue;
    if (shownThisSession.has(t.id)) continue;
    if (store.tipViews(t.id) >= RETIRE_AFTER) continue;
    let fits = false;
    try { fits = !t.when || !!t.when(ctx); } catch { fits = false; }
    if (fits) return t;
  }
  return null;
}

/**
 * The chip. One line collapsed, cue plus reasoning open.
 * Returns null when there is nothing to say, so call sites can drop it
 * straight into setScreen().
 */
export function tipChip(ctx = {}) {
  const tip = pickTip(ctx);
  if (!tip) return null;
  shownThisSession.add(tip.id);
  store.tipShown(tip.id);

  const { cue, why } = resolveTip(tip, ctx);
  const body = h('p', { class: 'coach-why' }, why);
  const node = h('button', {
    class: 'coach', type: 'button',
    'aria-expanded': 'false',
    onclick: () => {
      const open = node.classList.toggle('open');
      node.setAttribute('aria-expanded', String(open));
    },
  },
    h('span', { class: 'coach-head' },
      h('span', { class: 'coach-tag' }, 'TIP'),
      h('span', { class: 'coach-cue' }, cue),
      h('span', { class: 'coach-caret' }, '')),
    body
  );
  return node;
}

/** Test seam: lets a harness replay a fresh session without reloading. */
export function _resetSession() { shownThisSession.clear(); }

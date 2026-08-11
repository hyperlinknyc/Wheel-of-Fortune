// Plain-language definitions for every bit of jargon the app uses. Not a
// strategy page -- the cue card and the Method page already own the rules.
// This just answers "wait, what does that word mean" so a rule never lands
// as noise because a term in it was unclear.

import { h, setScreen, setActions, setTop, btn, go } from './ui.js';
import { VOWEL_COST, money } from './strategy.js';

const section = (title, open, ...body) =>
  h('details', { class: 'acc', ...(open ? { open: true } : {}) },
    h('summary', {}, title),
    h('div', { class: 'body' }, ...body));

const term = (word, def) =>
  h('div', { class: 'ifthen' },
    h('b', {}, word),
    h('span', { class: 'then' }, def));

export function glossaryScreen() {
  setTop({ title: 'GLOSSARY', back: () => history.back() });

  setScreen(
    h('p', { class: 'muted', style: { marginBottom: '14px' } },
      'Every term the app uses, in plain language. Tap a heading to open it.'),

    section('The wheel and the pot', true,
      term('Pot', 'The money built up on the current puzzle. It pays out only if you solve it -- Bankrupt wipes it.'),
      term('Wedge', 'One space on the wheel. Most are dollar amounts; a few are Bankrupt or Lose a Turn.'),
      term('Spin', 'One turn of the wheel. Land on a dollar wedge and call a consonant; if it is on the board, you are paid that amount for every copy.'),
      term('Bankrupt', 'A wedge that empties your pot for this puzzle and ends your turn immediately. About 2 of the 24 wedges.'),
      term('Copies', 'How many times a letter appears in the answer. "2 certain copies" means you can see, or are sure of, two spots it belongs.'),
      term('Milking', 'Spinning again after you already know the answer, just to reveal more letters. Pure downside -- the pot cannot grow from information you do not need, but Bankrupt can still take it.')),

    section('Buying letters', false,
      term('Vowel buy', `Trading ${money(VOWEL_COST)} of your pot for one vowel. Unlike a spin, a vowel purchase never ends your turn.`),
      term('Break-even', 'The smallest improvement in your odds of solving that would make a vowel worth its cost. Smaller at a bigger pot, since $250 is a smaller slice of it.'),
      term('RSTLNE', 'The letters R, S, T, L, N, E. In the bonus round they are revealed automatically before you pick anything -- in everyday speech, "the free letters."')),

    section('Toss-ups', false,
      term('Toss-up', 'A fast standalone puzzle at the top of a round. Letters reveal on their own; whoever buzzes first with the right answer wins the value on offer. No wheel.'),
      term('Buzz', 'Committing to answer a toss-up. You can buzz the instant you think you know it -- there is no penalty for buzzing early beyond being wrong.'),
      term('Buzz rate', 'How often you buzz at all, out of every toss-up you see. A low number means you are hanging back.'),
      term('Conversion', 'How often you are right when you do buzz. A very high conversion number is not purely good news -- it usually means you are waiting for certainty and giving up toss-ups you could have won.')),

    section('Proper names', false,
      term('Proper-name category', 'Any category whose answer is a specific person, place, title, or named thing -- as opposed to a generic phrase or object. Crossword-style letter-frequency instincts are weaker here, because a name\'s spelling is not "solved" by logic the way a common phrase can be.'),
      term('Solve on recognition', 'The moment you recognize a name puzzle, stop spinning for more letters and solve. Knowing whose name it is does not mean you know how it is spelled, so extra spins do not buy you real information -- only Bankrupt risk.')),

    section('The bonus round', false,
      term('Board coverage', 'The percentage of the puzzle\'s letters that are lit up (revealed) at a given moment -- from RSTLNE, your own picks, or both.'),
      term('Letter set', 'The 3 consonants and 1 vowel you pick after RSTLNE is up. The best set changes by category -- that table is on the cue card.'),
      term('Category tiers -- Take / Tolerate / Avoid', 'This app\'s own ranking of bonus categories by how winnable they are for a strong solver who struggles with names. Take categories reward pattern logic; Avoid categories are almost all proper names.')),

    section('This app\'s own stats', false,
      term('Category Discipline', 'Home-screen stat: out of every bonus-category choice where a non-name option existed, how often you took it instead of a name category.'),
      term('Discipline break', 'The specific event of picking an Avoid-tier (usually proper-name) category when something better was on offer. Tracked separately because it is the single costliest habit this app exists to fix.'),
      term('Solve Timing', 'Home-screen stat: how often your solve-or-spin decisions matched the pot math.'),
      term('Name Recall', 'Home-screen stat: your accuracy across the drills weighted toward proper names.'),
      term('Reflex, cue, why', 'This app\'s teaching shape. A reflex is one rule. Its cue is the short phrase you actually rehearse ("If you know it -- solve"). Its why is one sentence of mechanism. The full arithmetic sits behind "Show the math," for whenever you want to check the reasoning, but it is never what you are asked to memorize.')),

    h('div', { class: 'spacer' })
  );

  setActions(
    btn('CUE CARD', { variant: 'primary tall', onclick: () => go('#/cheat') }),
    btn('THE METHOD', { variant: 'ghost', onclick: () => go('#/method') })
  );
}

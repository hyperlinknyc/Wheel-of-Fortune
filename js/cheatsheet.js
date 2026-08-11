// The green-room screen. One tap from anywhere, readable at arm's length.
// Everything here is generated from strategy.js so it cannot drift from the
// rules the drills score against.

import { h, setScreen, setActions, setTop, btn, go } from './ui.js';
import {
  BONUS_RANKING, BONUS_LETTER_SETS, MISTAKES, COPIES_DIVISOR, VOWEL_COST,
  EXPECTED_BOARD_COVERAGE, RSTLNE_BONUS_COVERAGE, RSTLNE_MAIN_COVERAGE,
  DEFAULT_LETTER_SET, money, CONVERSION_CEILING,
} from './strategy.js';

const ifThen = (cond, then) =>
  h('div', { class: 'ifthen' }, h('b', {}, cond), h('span', { class: 'then' }, then));

const section = (title, open, ...body) =>
  h('details', { class: 'acc', ...(open ? { open: true } : {}) },
    h('summary', {}, title),
    h('div', { class: 'body' }, ...body));

export function cheatSheetScreen() {
  setTop({ title: 'CHEAT SHEET', back: () => history.back() });

  setScreen(
    h('p', { class: 'muted', style: { marginBottom: '14px' } },
      'Tap a heading to open it. This screen works with no signal.'),

    section('Solve or spin', true,
      ifThen('Pot over $9,000', 'Solve. No exceptions. There is no arithmetic left.'),
      ifThen('Proper-name category', 'Solve on recognition. Never milk a name.'),
      ifThen('Otherwise', `Copies needed = pot ÷ ${COPIES_DIVISOR}, rounded up.`),
      h('div', { class: 'hr' }),
      ...[[2500, 1], [4500, 2], [7000, 3]].map(([pot, n]) =>
        h('div', { class: 'mathline' },
          h('span', { class: 'l' }, `Holding ${money(pot)}`),
          h('span', { class: 'v' }, `${n} certain cop${n === 1 ? 'y' : 'ies'}`))),
      h('div', { class: 'mathline' },
        h('span', { class: 'l' }, 'Holding over $9,000'),
        h('span', { class: 'v' }, 'SOLVE')),
      h('p', { class: 'muted', style: { marginTop: '10px' } },
        'Certain means you can see where they go. Not hopeful.')),

    section('Vowels', false,
      ifThen(`A vowel costs ${money(VOWEL_COST)}`, 'A correct vowel does not end your turn.'),
      ifThen('Before you buy', 'Finish this sentence: this changes what I do next.'),
      ifThen('On a name', 'Buy before your second consonant. Order: A → O → E → I.'),
      ifThen('Never buy', 'A vowel you could read off the word shape, or any vowel after you already know the answer.'),
      h('div', { class: 'hr' }),
      h('div', { class: 'mathline' },
        h('span', { class: 'l' }, 'At a $2,500 pot'),
        h('span', { class: 'v' }, 'needs 10% better odds')),
      h('div', { class: 'mathline' },
        h('span', { class: 'l' }, 'At a $5,000 pot'),
        h('span', { class: 'v' }, 'needs 5% better odds'))),

    section('Bonus: which category', false,
      h('p', { style: { fontWeight: '800' } }, 'If a proper-noun category is offered, take something else.'),
      h('p', { class: 'muted' }, 'Two of three are names? Take the third instantly.'),
      h('div', { class: 'hr' }),
      h('h3', {}, 'Take, in order'),
      h('p', {}, BONUS_RANKING.TAKE.join(' → ')),
      h('h3', { style: { marginTop: '12px' } }, 'Tolerate'),
      h('p', {}, BONUS_RANKING.TOLERATE.join(' · ')),
      h('h3', { style: { marginTop: '12px' } }, 'Hard avoid'),
      h('p', { style: { color: 'var(--bad)' } }, BONUS_RANKING.AVOID.join(' · '))),

    section('Bonus: which letters', false,
      h('p', { style: { fontWeight: '800' } },
        `Default: ${DEFAULT_LETTER_SET.consonants.join(', ')} + ${DEFAULT_LETTER_SET.vowel}`),
      h('p', { class: 'muted' }, 'Y is a consonant. Picking Y does not use up your vowel.'),
      h('div', { class: 'hr' }),
      ...Object.entries(BONUS_LETTER_SETS)
        .filter(([c]) => BONUS_RANKING.TAKE.includes(c) || BONUS_RANKING.TOLERATE.includes(c))
        .map(([c, s]) =>
          h('div', { class: 'ifthen' },
            h('b', {}, c),
            h('span', { class: 'then' },
              h('b', { style: { color: 'var(--text)', fontFamily: 'var(--mono)' } },
                `${s.consonants.join(' ')} + ${s.vowel}`),
              ' — ', s.logic))),
      h('div', { class: 'hr' }),
      h('h3', {}, 'If you end up in a name category anyway'),
      ...Object.entries(BONUS_LETTER_SETS)
        .filter(([c]) => BONUS_RANKING.AVOID.includes(c))
        .map(([c, s]) =>
          h('div', { class: 'mathline' },
            h('span', { class: 'l' }, c),
            h('span', { class: 'v' }, `${s.consonants.join(' ')} + ${s.vowel}`)))),

    section('Bonus: the board', false,
      h('div', { class: 'center' },
        h('div', { class: 'big-num' }, Math.round(EXPECTED_BOARD_COVERAGE * 100) + '%'),
        h('p', { style: { fontWeight: '700' } }, 'A winnable bonus board is more than half blank.')),
      h('div', { class: 'hr' }),
      h('div', { class: 'mathline' },
        h('span', { class: 'l' }, 'RSTLNE on a bonus board'),
        h('span', { class: 'v' }, Math.round(RSTLNE_BONUS_COVERAGE * 100) + '%')),
      h('div', { class: 'mathline' },
        h('span', { class: 'l' }, 'RSTLNE in the main game'),
        h('span', { class: 'v' }, Math.round(RSTLNE_MAIN_COVERAGE * 100) + '%')),
      h('p', { class: 'muted', style: { marginTop: '10px' } },
        'Producers pick against RSTLNE on purpose. Half a board is normal, not a disaster.'),
      h('p', { style: { fontWeight: '800', marginTop: '10px' } },
        'Unlimited guesses. Talking beats thinking. Silence is the only losing move.')),

    section('Toss-ups', false,
      ifThen('Buzz early', 'You get the whole board and the money.'),
      ifThen(`If your conversion is above ${Math.round(CONVERSION_CEILING * 100)}%`,
        'You are buzzing too late and leaving toss-ups on the table.'),
      ifThen('Wrong buzz costs nothing', 'You lose that toss-up. That is all.')),

    section('The five mistakes', false,
      ...Object.values(MISTAKES).map((m) =>
        h('div', { class: 'ifthen' },
          h('b', {}, `${m.id}. ${m.name}`),
          h('span', { class: 'then', style: { fontStyle: 'italic' } }, m.cue)))),

    section('On stage', false,
      ifThen('When you get control', 'You already know your first action. You decided during their turn.'),
      ifThen('Three-finger anchor', 'Thumb to index: longest word. Middle: best guess. Ring: first action.'),
      ifThen('Saying the answer', 'Full articulation, 80% speed. Every word, in order, no extras, clear ending.'),
      ifThen('Proper names', 'Read it aloud as sounds, not letters. Recognition of names is auditory.')),

    h('div', { class: 'spacer' })
  );

  setActions(btn('BACK TO PRACTICE', { variant: 'primary tall', onclick: () => go('#/practice') }));
}

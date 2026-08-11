// The green-room cue card. One tap from anywhere, readable at arm's length.
// Face = IF → DO + one-line why. Math is collapsed. Generated from strategy.js.

import { h, setScreen, setActions, setTop, btn, go, mathDisclosure } from './ui.js';
import {
  BONUS_RANKING, BONUS_LETTER_SETS, MISTAKES, COPIES_DIVISOR, VOWEL_COST,
  EXPECTED_BOARD_COVERAGE, RSTLNE_BONUS_COVERAGE, RSTLNE_MAIN_COVERAGE,
  DEFAULT_LETTER_SET, money, CONVERSION_CEILING, REFLEXES, SPIN_DERIVATION,
} from './strategy.js';

const cueRow = (reflex, { if: ifText = null } = {}) =>
  h('div', { class: 'ifthen' },
    ifText ? h('b', {}, ifText) : h('b', {}, 'Cue'),
    h('span', { class: 'then' },
      h('span', { class: 'cue', style: { display: 'block', fontSize: '20px', margin: '4px 0' } }, reflex.cue),
      h('span', { class: 'why', style: { display: 'block', margin: 0 } }, reflex.why)));

const section = (title, open, ...body) =>
  h('details', { class: 'acc', ...(open ? { open: true } : {}) },
    h('summary', {}, title),
    h('div', { class: 'body' }, ...body));

export function cheatSheetScreen() {
  setTop({ title: 'CUE CARD', back: () => history.back() });

  setScreen(
    h('p', { class: 'muted', style: { marginBottom: '14px' } },
      'Green-room card. Cues on the face. Math only if you want it.'),

    section('Solve or spin', true,
      cueRow(REFLEXES.potCap, { if: 'Pot over $9,000' }),
      cueRow(REFLEXES.nameSolve, { if: 'Proper-name category' }),
      cueRow(REFLEXES.solveKnown, { if: 'You know the answer' }),
      cueRow(REFLEXES.certainCopies, { if: 'You do not know it yet' }),
      mathDisclosure([
        { label: `Holding ${money(2500)}`, value: '1 certain copy' },
        { label: `Holding ${money(4500)}`, value: '2 certain copies' },
        { label: `Holding ${money(7000)}`, value: '3 certain copies' },
        { label: `Holding over ${money(9000)}`, value: 'SOLVE', emphasis: true },
        { label: 'Rule', value: `ceil(pot ÷ ${COPIES_DIVISOR})` },
      ], 'Show the copy table'),
      h('details', { class: 'math-disclosure' },
        h('summary', {}, 'Show the derivation'),
        h('p', { class: 'muted' }, SPIN_DERIVATION))),

    section('Vowels', false,
      cueRow(REFLEXES.vowelReason, { if: 'Before you buy' }),
      cueRow(REFLEXES.nameVowel, { if: 'On a name' }),
      h('div', { class: 'ifthen' },
        h('b', {}, `A vowel costs ${money(VOWEL_COST)}`),
        h('span', { class: 'then' }, 'A correct vowel does not end your turn.')),
      mathDisclosure([
        { label: 'At a $2,500 pot', value: 'needs 10% better odds' },
        { label: 'At a $5,000 pot', value: 'needs 5% better odds' },
      ])),

    section('Bonus: which category', false,
      cueRow(REFLEXES.bonusAvoidName),
      h('p', { class: 'muted' }, 'Two of three are names? Take the third instantly.'),
      h('div', { class: 'hr' }),
      h('h3', {}, 'Take, in order'),
      h('p', {}, BONUS_RANKING.TAKE.join(' → ')),
      h('h3', { style: { marginTop: '12px' } }, 'Tolerate'),
      h('p', {}, BONUS_RANKING.TOLERATE.join(' · ')),
      h('h3', { style: { marginTop: '12px' } }, 'Hard avoid'),
      h('p', { style: { color: 'var(--bad)' } }, BONUS_RANKING.AVOID.join(' · '))),

    section('Bonus: which letters', false,
      cueRow(REFLEXES.bonusLetters),
      cueRow(REFLEXES.yConsonant),
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

    section('Bonus: the ten seconds', false,
      cueRow(REFLEXES.bonusTalk),
      mathDisclosure([
        { label: 'Expect about', value: Math.round(EXPECTED_BOARD_COVERAGE * 100) + '% lit' },
        { label: 'RSTLNE on a bonus board', value: Math.round(RSTLNE_BONUS_COVERAGE * 100) + '%' },
        { label: 'RSTLNE in the main game', value: Math.round(RSTLNE_MAIN_COVERAGE * 100) + '%' },
        { label: 'Default set', value: `${DEFAULT_LETTER_SET.consonants.join(' ')} + ${DEFAULT_LETTER_SET.vowel}` },
      ])),

    section('Toss-ups', false,
      cueRow(REFLEXES.tossBuzz),
      h('div', { class: 'ifthen' },
        h('b', {}, `Conversion above ${Math.round(CONVERSION_CEILING * 100)}%`),
        h('span', { class: 'then' }, 'You are buzzing too late.')),
      h('div', { class: 'ifthen' },
        h('b', {}, 'Wrong buzz'),
        h('span', { class: 'then' }, 'Costs only that toss-up. That is all.'))),

    section('Attention', false,
      cueRow(REFLEXES.attentionLoop),
      h('div', { class: 'ifthen' },
        h('b', {}, 'Physical anchor'),
        h('span', { class: 'then' }, 'Thumb→index longest word · middle best guess · ring first action.'))),

    section('Say it / names', false,
      cueRow(REFLEXES.sayExactly),
      cueRow(REFLEXES.soundNames)),

    section('The five mistakes', false,
      ...Object.values(MISTAKES).map((m) =>
        h('div', { class: 'ifthen' },
          h('b', {}, `${m.id}. ${m.name}`),
          h('span', { class: 'then' },
            h('span', { class: 'cue', style: { display: 'block', fontSize: '18px', margin: '4px 0' } }, m.cue),
            h('span', { class: 'why', style: { display: 'block', margin: 0 } }, m.why))))),

    h('div', { class: 'spacer' })
  );

  setActions(btn('BACK TO PRACTICE', { variant: 'primary tall', onclick: () => go('#/practice') }));
}

// Drill 1: SOLVE OR SPIN     Drill 2: VOWEL OR NO VOWEL
// The two drills that attack "she keeps spinning when she should solve".

import { h, btn, setScreen, setActions, renderBoard, verdictCard, ding, buzzer } from '../ui.js';
import { pick } from '../data.js';
import { logResult } from '../store.js';
import {
  scoreSolveOrSpin, solveOrSpinMath, SPIN_DERIVATION, MISTAKES, money,
  scoreVowel, VOWEL_REASONS, vowelBreakEvenText, preferredVowel, copiesRequired,
} from '../strategy.js';
import { randomPot, midPuzzleState } from './common.js';

// ---------------------------------------------------------------------------
// Drill 1 -- SOLVE OR SPIN
// ---------------------------------------------------------------------------

export const solveOrSpin = {
  id: 'solve-or-spin',
  title: 'SOLVE OR SPIN',
  minutes: 3,
  tip: {
    rule: 'Copies needed to justify another spin = pot ÷ 3000, rounded up.',
    example: 'Holding $6,400? You need 3 certain copies of a big consonant. Over $9,000, you solve. Always.',
  },
  summaryLine: (rs) => {
    const over = rs.filter((r) => r.meta?.verdict === 'over-spin').length;
    return over ? `${over} over-spin${over > 1 ? 's' : ''}. That is the money leak.` : 'No over-spins. That is the whole game.';
  },

  round({ next }) {
    const puzzle = pick({ minWords: 2 });
    const pot = randomPot();
    const { revealed } = midPuzzleState(puzzle);
    const t0 = performance.now();

    const ask = () => {
      setScreen(
        h('div', { class: 'cat' }, puzzle.category),
        renderBoard(puzzle.answer, revealed),
        h('div', { class: 'card center' },
          h('h3', {}, "You're holding"),
          h('div', { class: 'big-num' }, money(pot)),
          h('p', { style: { marginTop: '10px', fontWeight: '700' } }, 'You know the answer.')
        )
      );
      setActions(
        btn('SOLVE', { variant: 'primary tall', onclick: () => choose('SOLVE') }),
        btn('SPIN AGAIN', { variant: 'tall', onclick: () => choose('SPIN') })
      );
    };

    const choose = (choice) => {
      const latencyMs = performance.now() - t0;
      if (choice === 'SOLVE') return score({ choice, copies: null, latencyMs });
      askCopies(latencyMs);
    };

    const askCopies = (latencyMs) => {
      setScreen(
        h('div', { class: 'cat' }, puzzle.category),
        renderBoard(puzzle.answer, revealed),
        h('div', { class: 'card center' },
          h('h2', {}, 'How many copies of a big consonant are you certain of?'),
          h('p', { class: 'muted' }, 'Certain. Not hopeful.')
        )
      );
      setActions(
        h('div', { class: 'row' },
          ...[1, 2, 3].map((n) => btn(String(n), { variant: 'tall', onclick: () => score({ choice: 'SPIN', copies: n, latencyMs }) }))),
        btn('4 OR MORE', { variant: '', onclick: () => score({ choice: 'SPIN', copies: 4, latencyMs }) })
      );
    };

    const score = ({ choice, copies, latencyMs }) => {
      const r = scoreSolveOrSpin({ pot, isProperName: puzzle.isProperName, choice, copies });
      r.correct ? ding() : buzzer();

      logResult({
        drillType: 'solve-or-spin',
        correct: r.correct,
        latencyMs,
        errorTag: r.errorTag,
        category: puzzle.category,
        isProperName: puzzle.isProperName,
        puzzleId: puzzle.id,
        meta: { pot, choice, copies, verdict: r.verdict },
      });

      const headline =
        r.verdict === 'optimal' ? (choice === 'SOLVE' ? 'Solve. Correct.' : 'Good spin.')
          : r.verdict === 'over-solve' ? 'Safe — but you left money there.'
            : 'Over-spin.';

      const notes = [];
      if (r.verdict === 'over-solve') {
        notes.push(`At ${money(pot)} the bar is ${copiesRequired(pot)} copy. With even one certain big consonant, that spin was worth taking.`);
      } else if (r.verdict === 'over-spin' && r.rule.nameForcesSolve && !r.rule.potForcesSolve) {
        notes.push('Proper-name category. Solve on recognition, never milk. Knowing it is a name does not mean you know the letters.');
      } else if (r.verdict === 'over-spin' && r.rule.potForcesSolve) {
        notes.push('Over $9,000 there is no arithmetic left to do. You solve.');
      }

      setScreen(
        verdictCard({
          good: r.correct,
          headline,
          lines: solveOrSpinMath({ pot, copies, isProperName: puzzle.isProperName }),
          notes,
          tag: r.errorTag ? MISTAKES[r.errorTag] : null,
        }),
        h('div', { class: 'card' },
          h('h3', {}, 'The answer was'),
          renderBoard(puzzle.answer, 'ALL')),
        !r.correct ? h('div', { class: 'card' }, h('h3', {}, 'Why the rule says that'), h('p', { class: 'muted' }, SPIN_DERIVATION)) : null
      );
      setActions(btn('NEXT', { variant: 'primary tall', onclick: () => next({ correct: r.correct, meta: { verdict: r.verdict } }) }));
    };

    ask();
  },
};

// ---------------------------------------------------------------------------
// Drill 2 -- VOWEL OR NO VOWEL
// ---------------------------------------------------------------------------

export function makeVowelDrill({ nameWeighted = false } = {}) {
  return {
    id: nameWeighted ? 'vowel-names' : 'vowel',
    title: 'VOWEL OR NO VOWEL',
    minutes: 3,
    tip: {
      rule: 'A vowel is $250 and never ends your turn. Buy one only when you can finish this sentence: this changes what I do next.',
      example: 'On a name, buy before your second consonant. Order: A → O → E → I.',
    },
    summaryLine: (rs) => {
      const reflex = rs.filter((r) => r.meta?.errorTag === 3).length;
      return reflex ? `${reflex} reflex ${reflex > 1 ? 'buys' : 'buy'}. Attach a reason or keep the $250.` : 'Every buy had a reason behind it.';
    },

    round({ next }) {
      const puzzle = pick(nameWeighted ? { isProperName: true } : {});
      const pot = randomPot();
      const { revealed } = midPuzzleState(puzzle, { vowels: false });
      const t0 = performance.now();

      const ask = () => {
        setScreen(
          h('div', { class: 'cat' }, puzzle.category),
          renderBoard(puzzle.answer, revealed),
          h('div', { class: 'card center' },
            h('h3', {}, 'Pot'),
            h('div', { class: 'big-num' }, money(pot)),
            h('p', { class: 'muted', style: { marginTop: '8px' } }, vowelBreakEvenText(pot)))
        );
        // Two rows, not five across: five buttons on a 320px iPhone SE would be
        // 50px wide, under the 60px floor for fast one-handed tapping.
        const vowelBtn = (v) =>
          btn(v, { variant: 'tall', onclick: () => askReason(v, performance.now() - t0) });
        setActions(
          h('div', { class: 'row' }, ...['A', 'E', 'I'].map(vowelBtn)),
          h('div', { class: 'row' }, ...['O', 'U'].map(vowelBtn)),
          btn('NO VOWEL', { variant: 'ghost', onclick: () => score({ choice: 'NONE', latencyMs: performance.now() - t0 }) })
        );
      };

      const askReason = (vowel, latencyMs) => {
        const reasons = [...VOWEL_REASONS].sort(() => Math.random() - 0.5);
        setScreen(
          h('div', { class: 'cat' }, puzzle.category),
          h('div', { class: 'card center' },
            h('h2', {}, `You bought ${vowel}. Why?`),
            h('p', { class: 'muted' }, 'Pick the reason that was actually in your head.')),
          ...reasons.map((r) =>
            btn(r.text, {
              variant: 'small',
              style: { marginBottom: '10px', textAlign: 'left' },
              onclick: () => score({ choice: 'BUY', vowel, reasonId: r.id, latencyMs }),
            }))
        );
        setActions();
      };

      const score = ({ choice, vowel, reasonId, latencyMs }) => {
        const r = scoreVowel({
          isProperName: puzzle.isProperName, choice, vowel, reasonId, revealed: [...revealed],
        });
        r.correct ? ding() : buzzer();

        logResult({
          drillType: 'vowel',
          correct: r.correct,
          latencyMs,
          errorTag: r.errorTag,
          category: puzzle.category,
          isProperName: puzzle.isProperName,
          puzzleId: puzzle.id,
          meta: { pot, choice, vowel, reasonId, errorTag: r.errorTag },
        });

        const best = preferredVowel([...revealed]);
        setScreen(
          verdictCard({
            good: r.correct,
            headline: r.headline,
            notes: [r.detail, vowelBreakEvenText(pot)],
            tag: r.errorTag ? MISTAKES[r.errorTag] : null,
          }),
          puzzle.isProperName
            ? h('div', { class: 'card' },
              h('h3', {}, 'Name rule'),
              h('p', {}, `Buy the vowel before your second consonant. Here that is ${best}.`),
              h('p', { class: 'muted' }, 'Order: A → O → E → I.'))
            : null,
          h('div', { class: 'card' }, h('h3', {}, 'The answer was'), renderBoard(puzzle.answer, 'ALL'))
        );
        setActions(btn('NEXT', { variant: 'primary tall', onclick: () => next({ correct: r.correct, meta: { errorTag: r.errorTag } }) }));
      };

      ask();
    },
  };
}

export const vowelDrill = makeVowelDrill();
export const vowelNameDrill = makeVowelDrill({ nameWeighted: true });

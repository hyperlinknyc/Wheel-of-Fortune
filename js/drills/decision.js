// Drill 1: SOLVE OR SPIN     Drill 2: VOWEL OR NO VOWEL
// The two drills that attack "she keeps spinning when she should solve".

import { h, btn, setScreen, setActions, renderBoard, verdictCard, ding, buzzer } from '../ui.js';
import { pick } from '../data.js';
import { logResult } from '../store.js';
import {
  scoreSolveOrSpin, solveOrSpinMath, SPIN_DERIVATION, MISTAKES, money,
  scoreVowel, VOWEL_REASONS, vowelBreakEvenText, preferredVowel, copiesRequired,
  tipFrom, REFLEXES,
} from '../strategy.js';
import { randomPot, midPuzzleState } from './common.js';

// ---------------------------------------------------------------------------
// Drill 1 -- SOLVE OR SPIN
// ---------------------------------------------------------------------------

export const solveOrSpin = {
  id: 'solve-or-spin',
  title: 'SOLVE OR SPIN',
  minutes: 3,
  tip: tipFrom(REFLEXES.solveKnown, {
    example: 'Mouth already has it? Hand does not reach the wheel. Over $9,000 is always solve.',
    math: SPIN_DERIVATION,
  }),
  summaryLine: (rs) => {
    const over = rs.filter((r) => r.meta?.verdict === 'over-spin').length;
    return over ? `${over} over-spin${over > 1 ? 's' : ''}. Cue: if you know it — solve.` : 'No over-spins. The reflex held.';
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
          h('p', { class: 'cue', style: { marginTop: '10px', fontSize: '20px' } }, 'You know the answer.')
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
          h('p', { class: 'cue', style: { fontSize: '22px' } }, 'Certain copies on the board?'),
          h('p', { class: 'why' }, 'Certain. Not hopeful.')
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

      let cue = null;
      let why = null;
      if (r.verdict === 'over-spin' && r.rule.potForcesSolve) {
        cue = REFLEXES.potCap.cue;
        why = REFLEXES.potCap.why;
      } else if (r.verdict === 'over-spin' && r.rule.nameForcesSolve) {
        cue = REFLEXES.nameSolve.cue;
        why = REFLEXES.nameSolve.why;
      } else if (r.verdict === 'over-spin') {
        cue = REFLEXES.solveKnown.cue;
        why = REFLEXES.solveKnown.why;
      } else if (r.verdict === 'over-solve') {
        cue = REFLEXES.certainCopies.cue;
        why = `At ${money(pot)} you only needed ${copiesRequired(pot)} certain cop${copiesRequired(pot) === 1 ? 'y' : 'ies'}.`;
      }

      setScreen(
        verdictCard({
          good: r.correct,
          headline,
          cue,
          why,
          lines: solveOrSpinMath({ pot, copies, isProperName: puzzle.isProperName }),
          tag: r.errorTag ? MISTAKES[r.errorTag] : null,
        }),
        h('div', { class: 'card' },
          h('h3', {}, 'The answer was'),
          renderBoard(puzzle.answer, 'ALL'))
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
    tip: tipFrom(nameWeighted ? REFLEXES.nameVowel : REFLEXES.vowelReason, {
      example: nameWeighted
        ? 'Person / Place / Title: buy before the second consonant. Order A → O → E → I.'
        : 'If you cannot finish “this changes what I do next,” keep the $250.',
    }),
    summaryLine: (rs) => {
      const reflex = rs.filter((r) => r.meta?.errorTag === 3).length;
      return reflex
        ? `${reflex} reflex ${reflex > 1 ? 'buys' : 'buy'}. Cue: this changes what I do next — or don't buy.`
        : 'Every buy had a next-action reason.';
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
            h('p', { class: 'cue', style: { marginTop: '10px', fontSize: '20px' } },
              nameWeighted ? REFLEXES.nameVowel.cue : REFLEXES.vowelReason.cue),
            h('details', { class: 'math-disclosure' },
              h('summary', {}, 'Show the math'),
              h('p', { class: 'muted' }, vowelBreakEvenText(pot))))
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
            h('p', { class: 'cue', style: { fontSize: '22px' } }, `You bought ${vowel}. Why?`),
            h('p', { class: 'why' }, 'Pick the reason that was actually in your head.')),
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
        const reflex = puzzle.isProperName ? REFLEXES.nameVowel : REFLEXES.vowelReason;
        setScreen(
          verdictCard({
            good: r.correct,
            headline: r.headline,
            cue: r.correct ? null : (r.errorTag ? MISTAKES[r.errorTag].cue : reflex.cue),
            why: r.correct ? r.detail : (r.errorTag ? MISTAKES[r.errorTag].why : reflex.why),
            lines: [
              { label: 'Break-even', value: vowelBreakEvenText(pot) },
              ...(puzzle.isProperName ? [{ label: 'Name vowel here', value: best, emphasis: true }] : []),
            ],
            tag: r.errorTag ? MISTAKES[r.errorTag] : null,
          }),
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

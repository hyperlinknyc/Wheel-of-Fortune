// Drill 1: SOLVE OR SPIN     Drill 2: VOWEL OR NO VOWEL
// The two drills that attack "she keeps spinning when she should solve".

import { h, btn, setScreen, setActions, renderBoard, verdictCard, selfScore, ding, buzzer } from '../ui.js';
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
        // Slim lines, not a card. The full card ran ~200px and, stacked under
        // a board and over three rows of buttons, left the pot itself as a
        // sliver at the bottom of an iPhone SE -- the one number the decision
        // is actually about. The break-even math is not lost: the feedback
        // card spells it out on every round.
        setScreen(
          h('div', { class: 'cat tight' }, puzzle.category),
          renderBoard(puzzle.answer, revealed),
          // No cue on the ask screen. On the name variant it read "Name? Vowel
          // before the second consonant" directly above the buttons -- which is
          // the answer to the question being asked. The reflex is taught on the
          // block's tip card and repeated in every feedback card; here it was
          // giving the round away, and costing the fold to do it.
          h('p', { class: 'center landed-line' }, 'Pot ', h('b', {}, money(pot)))
        );
        // Two rows, not five across: five buttons on a 320px iPhone SE would be
        // 50px wide, under the 60px floor for fast one-handed tapping.
        //
        // Heights are deliberately not `tall` here. Three rows of 92px ate the
        // whole screen on an SE and pushed the pot -- the number the decision
        // is actually about -- off the top. At 76 and 60 every target still
        // clears the floor with room to spare.
        const vowelBtn = (v) =>
          btn(v, { onclick: () => askReason(v, performance.now() - t0) });
        setActions(
          h('div', { class: 'row' }, ...['A', 'E', 'I'].map(vowelBtn)),
          h('div', { class: 'row' }, ...['O', 'U'].map(vowelBtn)),
          // Paired on one row so the third option costs no extra height.
          // NO VOWEL means "I don't have it and I'm still not buying";
          // I KNOW IT is the separate, and better, answer.
          h('div', { class: 'row' },
            btn('NO VOWEL', {
              variant: 'ghost small',
              onclick: () => score({ choice: 'NONE', latencyMs: performance.now() - t0 }),
            }),
            btn('I KNOW IT', {
              variant: 'good small',
              onclick: () => claimKnown(performance.now() - t0),
            }))
        );
      };

      /** Honest mode: saying you had it is a claim you then check. */
      const claimKnown = (latencyMs) => {
        setScreen(
          h('div', { class: 'cat' }, puzzle.category),
          renderBoard(puzzle.answer, revealed),
          h('div', { class: 'card center' },
            h('p', { class: 'cue', style: { fontSize: '22px' } }, 'Say it out loud.'),
            h('p', { class: 'why' }, 'Then check it. No marks for nearly.'))
        );
        setActions(btn('SHOW ME THE ANSWER', {
          variant: 'primary tall',
          onclick: () => {
            setScreen(
              h('div', { class: 'cat' }, puzzle.category),
              renderBoard(puzzle.answer, 'ALL'),
              h('div', { class: 'card center' }, h('h2', {}, puzzle.answer))
            );
            setActions(...selfScore('Did you have it, word for word?',
              (hadIt) => score({ choice: 'KNOW', hadIt, latencyMs })));
          },
        }));
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

      const score = ({ choice, vowel, reasonId, hadIt, latencyMs }) => {
        const r = scoreVowel({
          isProperName: puzzle.isProperName, choice, vowel, reasonId, hadIt, revealed: [...revealed],
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
          meta: { pot, choice, vowel, reasonId, hadIt, errorTag: r.errorTag },
        });

        const best = preferredVowel([...revealed]);
        const reflex = puzzle.isProperName ? REFLEXES.nameVowel : REFLEXES.vowelReason;
        setScreen(
          verdictCard({
            good: r.correct,
            headline: r.headline,
            cue: r.correct ? null : (r.errorTag ? MISTAKES[r.errorTag].cue : reflex.cue),
            why: r.correct ? r.detail : (r.errorTag ? MISTAKES[r.errorTag].why : reflex.why),
            // A correct I KNOW IT never needed the vowel, so the break-even
            // arithmetic is beside the point. A wrong one is exactly when the
            // name-vowel order is worth putting in front of her.
            lines: choice === 'KNOW' && r.correct ? [] : [
              { label: 'Break-even', value: vowelBreakEvenText(pot) },
              ...(puzzle.isProperName ? [{ label: 'Name vowel here', value: best, emphasis: true }] : []),
            ],
            tag: r.errorTag ? MISTAKES[r.errorTag] : null,
          }),
          // On the I KNOW IT path she has just been shown the full board to
          // score herself against, so repeating it here is noise.
          choice === 'KNOW'
            ? null
            : h('div', { class: 'card' }, h('h3', {}, 'The answer was'), renderBoard(puzzle.answer, 'ALL'))
        );
        setActions(btn('NEXT', { variant: 'primary tall', onclick: () => next({ correct: r.correct, meta: { errorTag: r.errorTag } }) }));
      };

      ask();
    },
  };
}

export const vowelDrill = makeVowelDrill();
export const vowelNameDrill = makeVowelDrill({ nameWeighted: true });

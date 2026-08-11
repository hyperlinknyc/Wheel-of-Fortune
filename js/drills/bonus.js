// Drill 3: BONUS CATEGORY CHOICE   Drill 4: BONUS LETTER SET   Drill 5: FULL BONUS SIM

import {
  h, btn, setScreen, setActions, renderBoard, revealLetter, revealAll, verdictCard,
  Timer, timerDisplay, attachCountdownAudio, showInterrupt, ding, buzzer, selfScore, primeAudio, after,
  screenOpts,
} from '../ui.js';
import { pickCategoryTriple, pickBonusCategory, pickBonusPuzzle, shuffle } from '../data.js';
import { logResult, settings } from '../store.js';
import {
  scoreCategoryChoice, categoryTier, bestOf, letterSetFor, scoreLetterSet,
  boardCoverage, FREE_LETTERS, EXPECTED_BOARD_COVERAGE, COVERAGE_HEADLINE,
  RSTLNE_BONUS_COVERAGE, RSTLNE_MAIN_COVERAGE, MISTAKES, BONUS_RANKING,
} from '../strategy.js';
import { measureSilence } from '../voice.js';

const TIER_PILL = { TAKE: 'take', TOLERATE: 'tol', AVOID: 'avoid' };

// ---------------------------------------------------------------------------
// Drill 3 -- BONUS CATEGORY CHOICE
// ---------------------------------------------------------------------------

export const bonusCategory = {
  id: 'bonus-category',
  title: 'BONUS CATEGORY',
  minutes: 2,
  tip: {
    rule: 'If a proper-noun category is offered, you take something else. Every time.',
    example: 'Two of three are names? Take the third instantly. You do not need to think about it.',
  },
  summaryLine: (rs) => {
    const breaks = rs.filter((r) => r.meta?.disciplineBreak).length;
    return breaks
      ? `${breaks} discipline break${breaks > 1 ? 's' : ''}. Target is zero by Day 5.`
      : 'Discipline held. That is what 100% looks like.';
  },

  round({ next }) {
    const offered = pickCategoryTriple();
    const t0 = performance.now();
    let answered = false;
    let timer;

    const readout = timerDisplay();

    const finishRound = (result) => next(result);

    const choose = (picked) => {
      if (answered) return;
      answered = true;
      timer?.stop();
      const latencyMs = performance.now() - t0;
      const r = scoreCategoryChoice(offered, picked);

      logResult({
        drillType: 'bonus-category',
        correct: r.correct,
        latencyMs,
        errorTag: r.errorTag,
        category: picked,
        isProperName: r.properNounBreak,
        meta: {
          offered, picked, best: r.best, tier: r.tier,
          disciplineBreak: r.disciplineBreak,
          disciplineHeld: r.disciplineHeld,
          countsForDiscipline: r.countsForDiscipline,
        },
      });

      if (r.disciplineBreak) {
        showInterrupt({
          kicker: 'CATEGORY DISCIPLINE',
          title: r.properNounBreak ? 'You took a name category.' : 'You took an avoid category.',
          body: [
            `${picked} was on the board next to ${r.best}.`,
            r.properNounBreak
              ? 'A name you half-know is a board you cannot finish. There is no partial credit on this one.'
              : 'This category hides its structure until it is too late. Take the clean one.',
            'Two of three are names? Take the third instantly.',
          ],
          onClose: () => showResult(r, picked),
        });
      } else {
        r.correct ? ding() : buzzer();
        showResult(r, picked);
      }
    };

    const timeout = () => {
      if (answered) return;
      answered = true;
      buzzer();
      const r = scoreCategoryChoice(offered, null);
      logResult({
        drillType: 'bonus-category',
        correct: false,
        latencyMs: 3000,
        errorTag: null,
        category: null,
        isProperName: false,
        meta: { offered, picked: null, best: r.best, timedOut: true, countsForDiscipline: false },
      });
      setScreen(
        verdictCard({
          good: false,
          headline: 'Out of time.',
          notes: [
            'Three seconds is what you actually get. Not choosing is a choice, and it is the wrong one.',
            `The take here was ${r.best}.`,
          ],
        }),
        rankingCard(offered, r.best, null)
      );
      setActions(btn('NEXT', { variant: 'primary tall', onclick: () => finishRound({ correct: false, meta: {} }) }));
    };

    const showResult = (r, picked) => {
      setScreen(
        verdictCard({
          good: r.correct,
          headline: r.correct ? 'Correct take.' : r.disciplineBreak ? 'Discipline break.' : `${r.best} was the better take.`,
          notes: r.correct
            ? [`${picked} is the highest-ranked category on offer.`]
            : [`You took ${picked}. The take was ${r.best}.`],
          tag: r.errorTag ? MISTAKES[r.errorTag] : null,
        }),
        rankingCard(offered, r.best, picked)
      );
      setActions(btn('NEXT', { variant: 'primary tall', onclick: () => finishRound({ correct: r.correct, meta: { disciplineBreak: r.disciplineBreak } }) }));
    };

    setScreen(
      h('div', { class: 'card center' },
        h('h3', {}, 'Pick one. Three seconds.'),
        readout.node),
      ...offered.map((c) => h('button', { class: 'strip', type: 'button', onclick: () => choose(c) }, c))
    );
    setActions();

    timer = new Timer({ duration: 3000, onTick: readout.update, onDone: timeout });
    attachCountdownAudio(timer, 3);
    timer.start();
  },
};

function rankingCard(offered, best, picked) {
  return h('div', { class: 'card' },
    h('h3', {}, 'Where these rank'),
    ...offered.map((c) => {
      const tier = categoryTier(c);
      return h('div', { class: 'mathline' },
        h('span', { class: 'l' },
          c, c === best ? ' ← take' : '', c === picked && c !== best ? ' ← you' : ''),
        h('span', { class: 'v' }, h('span', { class: `pill ${TIER_PILL[tier]}` }, tier)));
    }));
}

// ---------------------------------------------------------------------------
// Drill 4 -- BONUS LETTER SET
// ---------------------------------------------------------------------------

// R S T L N E are not in the grid at all -- they are already on the board, so
// they are shown as information above it. Four keys per row keeps every
// pickable target comfortably over 60px wide on the narrowest iPhone.
const CONSONANT_ROWS = [
  ['B', 'C', 'D', 'F'],
  ['G', 'H', 'J', 'K'],
  ['M', 'P', 'Q', 'V'],
  ['W', 'X', 'Y', 'Z'],
];
const VOWEL_ROW = ['A', 'I', 'O', 'U'];

/** The picker. Returns via onConfirm({consonants, vowel}). */
export function letterPicker({ onConfirm, confirmLabel = 'LOCK IT IN' }) {
  const chosen = { consonants: [], vowel: null };
  const keys = new Map();

  const sync = () => {
    for (const [l, el] of keys) {
      const on = chosen.consonants.includes(l) || chosen.vowel === l;
      el.classList.toggle('on', on);
    }
    counter.textContent = `${chosen.consonants.length} of 3 consonants · ${chosen.vowel ? '1' : '0'} of 1 vowel`;
    confirm.disabled = chosen.consonants.length !== 3 || !chosen.vowel;
  };

  const key = (l, isVowel) => {
    const el = h('button', {
      class: `key${l === 'Y' ? ' y' : ''}`,
      type: 'button',
      onclick: () => {
        if (isVowel) chosen.vowel = chosen.vowel === l ? null : l;
        else if (chosen.consonants.includes(l))
          chosen.consonants = chosen.consonants.filter((c) => c !== l);
        else if (chosen.consonants.length < 3) chosen.consonants.push(l);
        sync();
      },
    }, l);
    keys.set(l, el);
    return el;
  };

  const counter = h('span', { class: 'sub' });
  const confirm = btn(confirmLabel, {
    variant: 'primary',
    disabled: true,
    sub: ' ',
    onclick: () => onConfirm({ ...chosen }),
  });
  confirm.querySelector('.sub').replaceWith(counter);

  const node = h('div', { class: 'kb' },
    h('div', { class: 'freebar' },
      h('span', { class: 'lbl2' }, 'Already up'),
      h('span', { class: 'letters' }, FREE_LETTERS.join(' '))),
    h('div', { class: 'kbrow' },
      h('div', { class: 'lbl' }, 'Consonants (Y counts as one)')),
    ...CONSONANT_ROWS.map((row) => h('div', { class: 'kbrow' }, ...row.map((l) => key(l, false)))),
    h('div', { class: 'kbrow' }, h('div', { class: 'lbl' }, 'Vowel')),
    h('div', { class: 'kbrow' }, ...VOWEL_ROW.map((l) => key(l, true)))
  );

  sync();
  return { node, counter, confirm, chosen };
}

export const bonusLetters = {
  id: 'bonus-letters',
  title: 'BONUS LETTER SET',
  minutes: 3,
  tip: {
    rule: 'Y is a consonant. Picking Y does not use up your vowel.',
    example: 'Living Thing: C, D, Y + A. FURRY, PUPPY, BUTTERFLY — Y is free money in that category.',
  },
  summaryLine: (rs) => {
    const avg = rs.reduce((s, r) => s + (r.meta?.score ?? 0), 0) / (rs.length || 1);
    return `Average set quality ${Math.round(avg * 100)}%.`;
  },

  round({ next }) {
    const category = pickBonusCategory();
    const t0 = performance.now();

    const picker = letterPicker({
      onConfirm: (chosen) => score(chosen, performance.now() - t0),
    });

    setScreen(
      h('div', { class: 'cat tight' }, category),
      picker.node,
      screenOpts({ dense: true })
    );
    setActions(picker.confirm);

    const score = (chosen, latencyMs) => {
      const r = scoreLetterSet({ category, ...chosen });
      r.correct ? ding() : buzzer();

      logResult({
        drillType: 'bonus-letters',
        correct: r.correct,
        latencyMs,
        errorTag: r.errorTag,
        category,
        isProperName: false,
        meta: { chosen, ideal: r.ideal, score: r.score },
      });

      setScreen(
        verdictCard({
          good: r.correct,
          headline: r.exact ? 'Exact set.' : r.partial ? `Partial — ${Math.round(r.score * 100)}%.` : 'Wrong set.',
          notes: [
            `${category}: ${r.ideal.consonants.join(', ')} + ${r.ideal.vowel}.`,
            r.ideal.logic,
            ...r.notes,
          ],
          tag: r.errorTag ? MISTAKES[r.errorTag] : null,
        }),
        h('div', { class: 'card' },
          h('h3', {}, 'You picked'),
          h('p', { style: { fontSize: '24px', fontWeight: '800' } },
            `${chosen.consonants.join(', ')} + ${chosen.vowel}`),
          r.missed.length ? h('p', { class: 'muted' }, `Missed: ${r.missed.join(', ')}`) : null)
      );
      setActions(btn('NEXT', { variant: 'primary tall', onclick: () => next({ correct: r.correct, meta: { score: r.score } }) }));
    };
  },
};

// ---------------------------------------------------------------------------
// Drill 5 -- FULL BONUS ROUND SIM
// ---------------------------------------------------------------------------

export const bonusSim = {
  id: 'bonus-sim',
  title: 'BONUS ROUND',
  minutes: 4,
  tip: {
    rule: 'Expect about 45% of the board. A winnable bonus board is more than half blank.',
    example: 'Unlimited guesses means talking always beats thinking. Silence is the only losing move.',
  },
  summaryLine: (rs) => {
    const got = rs.filter((r) => r.correct).length;
    return `${got} of ${rs.length} solved inside ten seconds.`;
  },

  round({ next }) {
    const category = pickBonusCategory({ takeOnly: Math.random() < 0.75 });
    const puzzle = pickBonusPuzzle(category);
    if (!puzzle) return next({ correct: false, meta: {} });

    const cat = puzzle.category;
    let boardWrap;

    // Stage 1: RSTLNE is already up there.
    const stageReveal = () => {
      boardWrap = renderBoard(puzzle.answer, new Set(FREE_LETTERS));
      const cov = boardCoverage(puzzle.answer, []);
      setScreen(
        h('div', { class: 'cat' }, cat),
        boardWrap,
        h('div', { class: 'card center' },
          h('h3', {}, 'R S T L N E is on the board'),
          h('div', { class: 'big-num' }, Math.round(cov * 100) + '%'),
          h('p', { class: 'muted' },
            `Bonus boards give up about ${Math.round(RSTLNE_BONUS_COVERAGE * 100)}% to RSTLNE, against ` +
            `${Math.round(RSTLNE_MAIN_COVERAGE * 100)}% in the main game. Producers pick against it on purpose.`))
      );
      setActions(btn('PICK MY LETTERS', { variant: 'primary tall', onclick: () => { primeAudio(); stagePick(); } }));
    };

    // Stage 2: her set.
    const stagePick = () => {
      const picker = letterPicker({ onConfirm: stageFill });
      setScreen(
        h('div', { class: 'cat tight' }, cat),
        boardWrap,
        picker.node,
        screenOpts({ dense: true })
      );
      setActions(picker.confirm);
    };

    // Stage 3: letters fill, then the clock.
    const stageFill = (chosen) => {
      const picks = [...chosen.consonants, chosen.vowel];
      const setScore = scoreLetterSet({ category: cat, ...chosen });
      const coverage = boardCoverage(puzzle.answer, picks);

      setScreen(h('div', { class: 'cat' }, cat), boardWrap);
      setActions();

      picks.forEach((l, i) => after(140 * (i + 1), () => revealLetter(boardWrap, l)));
      after(140 * picks.length + 500, () => stageClock({ chosen, picks, setScore, coverage }));
    };

    // Stage 4: the ten seconds.
    const stageClock = (ctx) => {
      const readout = timerDisplay({ huge: true });
      setScreen(
        h('div', { class: 'cat' }, cat),
        boardWrap,
        h('div', { class: 'card center' }, readout.node,
          h('p', { style: { fontWeight: '800', fontSize: '20px', marginTop: '10px' } }, 'TALK. Do not think.'))
      );
      setActions();

      const mic = settings().mic ? measureSilence(10000) : null;

      const timer = new Timer({
        duration: 10000,
        onTick: readout.update,
        onDone: async () => {
          buzzer();
          const voice = mic ? await mic.result() : null;
          stageScore({ ...ctx, voice });
        },
      });
      attachCountdownAudio(timer, 3);
      timer.start();
    };

    // Stage 5: reveal and self-score.
    const stageScore = (ctx) => {
      revealAll(boardWrap);
      setScreen(
        h('div', { class: 'cat' }, cat),
        boardWrap,
        h('div', { class: 'card center' },
          h('h2', {}, puzzle.answer))
      );
      setActions(...selfScore('Did you say it inside the ten seconds?', (got) => finish(ctx, got)));
    };

    const finish = (ctx, got) => {
      logResult({
        drillType: 'bonus-sim',
        correct: got,
        latencyMs: null,
        errorTag: got ? null : 2,
        category: cat,
        isProperName: puzzle.isProperName,
        puzzleId: puzzle.id,
        meta: {
          coverage: ctx.coverage, optimalSet: ctx.setScore.exact,
          setScore: ctx.setScore.score, silenceMs: ctx.voice?.silenceMs ?? null,
        },
      });

      const lines = [
        { label: 'Board coverage you achieved', value: Math.round(ctx.coverage * 100) + '%' },
        { label: 'Typical coverage', value: Math.round(EXPECTED_BOARD_COVERAGE * 100) + '%' },
        { label: 'Optimal set for ' + cat, value: `${ctx.setScore.ideal.consonants.join(' ')} + ${ctx.setScore.ideal.vowel}` },
        { label: 'You picked', value: `${ctx.chosen.consonants.join(' ')} + ${ctx.chosen.vowel}` },
      ];
      if (ctx.voice) {
        lines.push({
          label: 'You were quiet for',
          value: (ctx.voice.silenceMs / 1000).toFixed(1) + ' of 10.0s',
          emphasis: true,
          good: ctx.voice.silenceMs < 3000,
        });
      }

      setScreen(
        verdictCard({
          good: got,
          headline: got ? 'Solved.' : 'Not inside ten.',
          lines,
          notes: [
            ctx.setScore.exact ? 'Optimal letter set.' : ctx.setScore.ideal.logic,
            ctx.voice && ctx.voice.silenceMs >= 3000
              ? `You were silent for ${(ctx.voice.silenceMs / 1000).toFixed(1)} seconds. Unlimited guesses means talking always beats thinking. Silence is the only losing move.`
              : COVERAGE_HEADLINE,
          ],
        })
      );
      setActions(btn('NEXT', { variant: 'primary tall', onclick: () => next({ correct: got, meta: { coverage: ctx.coverage } }) }));
    };

    stageReveal();
  },
};

export const BONUS_TAKE_LIST = BONUS_RANKING.TAKE;
export { shuffle, bestOf };

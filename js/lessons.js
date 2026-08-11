// The seven-day plan. Locked-until-previous-complete, with Practice Anything
// always available in the bottom bar -- she is an adult on a deadline.
//
// Each day installs ONE reflex (cue + why). Math stays in strategy.js and
// behind "Show the math" — never as the primary teaching surface.

import { h, btn, setScreen, setActions, setTop, go, card, primeAudio } from './ui.js';
import * as store from './store.js';
import { runBlock } from './drills/common.js';
import { solveOrSpin, vowelDrill, vowelNameDrill } from './drills/decision.js';
import { bonusCategory, bonusLetters, bonusSim } from './drills/bonus.js';
import { tossUp, attentionLoop } from './drills/attention.js';
import { nameShape, soundItOut, sayItExactly } from './drills/names.js';
import { MISTAKES, REFLEXES, tipFrom } from './strategy.js';

// ---------------------------------------------------------------------------
// Composite drills used only by the plan
// ---------------------------------------------------------------------------

/** Rotates through sub-drills, one round each. Day 6's full dress rehearsal. */
function mixedDrill({ id, title, tip, drills, minutes = 4 }) {
  return {
    id, title, tip, minutes,
    summaryLine: (rs) => `${rs.filter((r) => r.correct).length} of ${rs.length} across mixed play.`,
    round(ctx) {
      const d = drills[(ctx.index - 1) % drills.length];
      return d.round(ctx);
    },
  };
}

const fullGameSim = mixedDrill({
  id: 'full-game-sim',
  title: 'FULL GAME',
  minutes: 5,
  tip: tipFrom(REFLEXES.attentionLoop, {
    example: 'Toss-up, then the wheel, then the bonus. Same cues, mixed up — no warning which is coming.',
  }),
  drills: [tossUp, solveOrSpin, vowelDrill, bonusCategory, bonusSim],
});

/** Day 7: say the CUES out loud. No new material on taper day. */
const RECITAL = [
  { q: 'You know the answer?', a: REFLEXES.solveKnown.cue },
  { q: 'Pot over $9,000?', a: REFLEXES.potCap.cue },
  { q: 'Proper-name category and you recognise it?', a: REFLEXES.nameSolve.cue },
  { q: 'Before you buy a vowel?', a: REFLEXES.vowelReason.cue },
  { q: 'Vowel on a name?', a: REFLEXES.nameVowel.cue },
  { q: 'A name category is offered in the bonus round?', a: REFLEXES.bonusAvoidName.cue },
  { q: 'Default bonus letters?', a: REFLEXES.bonusLetters.cue },
  { q: 'Is Y a consonant?', a: REFLEXES.yConsonant.cue },
  { q: 'Bonus board looks half blank?', a: REFLEXES.bonusTalk.cue },
  { q: 'Toss-up board almost full?', a: REFLEXES.tossBuzz.cue },
  { q: 'Opponent is playing — what do you run?', a: REFLEXES.attentionLoop.cue },
  { q: 'Saying the solve?', a: REFLEXES.sayExactly.cue },
];

const cheatRecital = {
  id: 'cheat-recital',
  title: 'RECITE THE CUES',
  minutes: 4,
  tip: tipFrom(REFLEXES.sayExactly, {
    example: 'Taper day. Nothing new. Say the cue out loud before you tap.',
  }),
  summaryLine: () => 'Cues recited. That is taper day done.',
  round({ index, next }) {
    const item = RECITAL[(index - 1) % RECITAL.length];
    setScreen(
      card(h('h3', {}, 'Say the cue out loud'), h('p', { class: 'cue' }, item.q))
    );
    setActions(btn('SHOW THE CUE', {
      variant: 'primary tall',
      onclick: () => {
        setScreen(
          card(
            h('h3', {}, item.q),
            h('p', { class: 'cue', style: { color: 'var(--accent)' } }, item.a))
        );
        setActions(
          btn('I HAD IT', { variant: 'good tall', onclick: () => log(true) }),
          btn('SAY IT AGAIN', { variant: 'ghost', onclick: () => log(false) })
        );
      },
    }));

    const log = (correct) => {
      store.logResult({
        drillType: 'cheat-recital', correct, latencyMs: null, errorTag: null,
        category: null, isProperName: false, meta: { q: item.q },
      });
      next({ correct, meta: {} });
    };
  },
};

// ---------------------------------------------------------------------------
// The plan — one reflex per day
// ---------------------------------------------------------------------------

const B = (drill, rounds) => ({ drill, rounds });

export const DAYS = [
  {
    n: 1,
    theme: 'Name offered — take anything else',
    blurb: 'Install the bonus-category reflex first, then light reps on solve and vowels.',
    reflex: REFLEXES.bonusAvoidName,
    minutes: 12,
    blocks: [B(bonusCategory, 15), B(bonusSim, 4), B(solveOrSpin, 9), B(vowelDrill, 9), B(tossUp, 7)],
  },
  {
    n: 2,
    theme: 'If you know it — solve',
    blurb: 'Stop milking known answers. Attach a next-action reason before every vowel.',
    reflex: REFLEXES.solveKnown,
    minutes: 12,
    blocks: [B(solveOrSpin, 12), B(vowelDrill, 12), B(solveOrSpin, 10), B(vowelNameDrill, 9)],
  },
  {
    n: 3,
    theme: 'Names: sounds, then the vowel',
    blurb: 'People-shaped boards. Fire names out loud. Buy the spelling vowel early.',
    reflex: REFLEXES.nameVowel,
    minutes: 12,
    blocks: [B(nameShape, 6), B(soundItOut, 7), B(vowelNameDrill, 8), B(nameShape, 6), B(soundItOut, 6)],
  },
  {
    n: 4,
    theme: 'Their turn: longest · guess · action',
    blurb: 'Give attention a job. Find the buzz half-beat.',
    reflex: REFLEXES.attentionLoop,
    minutes: 12,
    blocks: [B(attentionLoop, 3), B(tossUp, 10), B(attentionLoop, 3), B(tossUp, 10), B(attentionLoop, 3)],
  },
  {
    n: 5,
    theme: 'Places, titles, letter overrides',
    blurb: 'Name-heavy boards again — plus the bonus letter sets that rescue them.',
    reflex: REFLEXES.bonusLetters,
    minutes: 12,
    blocks: [B(nameShape, 6), B(soundItOut, 7), B(bonusLetters, 9), B(bonusCategory, 12), B(solveOrSpin, 7)],
  },
  {
    n: 6,
    theme: 'Full dress — cues under fire',
    blurb: 'Everything mixed in stage order. Then say it exactly.',
    reflex: REFLEXES.sayExactly,
    minutes: 11,
    blocks: [B(bonusSim, 5), B(tossUp, 11), B(fullGameSim, 11), B(sayItExactly, 7)],
  },
  {
    n: 7,
    theme: 'Taper — recite the cues',
    blurb: 'Light. No new material. Cues out loud, clean articulation.',
    reflex: REFLEXES.solveKnown,
    minutes: 10,
    blocks: [B(bonusCategory, 20), B(solveOrSpin, 10), B(sayItExactly, 10), B(cheatRecital, 12)],
  },
];

export const todaysDayNumber = () => store.highestUnlockedDay();

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

export function lessonTreeScreen() {
  setTop({ title: 'SEVEN DAYS', back: () => go('#/home') });
  const unlocked = store.highestUnlockedDay();

  setScreen(
    h('p', { class: 'muted' },
      `${store.daysUntilTaping()} days until taping. Each day installs one reflex.`),
    ...DAYS.map((d) => {
      const done = store.isDayComplete(d.n);
      const ahead = d.n > unlocked;
      const cls = done ? 'day done' : d.n === unlocked ? 'day current' : ahead ? 'day locked' : 'day';
      const doneBlocks = d.blocks.filter((b, idx) => store.isBlockComplete(d.n, idx)).length;
      return h('button', {
        class: cls, type: 'button',
        onclick: () => {
          primeAudio();
          // Days ahead of the plan are dimmed, not barred. The order is a
          // recommendation, not a cage -- she is an adult with a real
          // deadline, and if she wants Day 5's name work tonight she should
          // get it. One extra tap keeps the default path obvious.
          if (ahead) return confirmJump(d);
          go('#/day/' + d.n);
        },
      },
        h('div', { class: 'n' }, String(d.n)),
        h('div', { class: 't' },
          h('b', {}, d.theme),
          h('span', {}, ahead ? `Ahead of the plan · tap to open anyway`
            : done ? `Done · ${d.minutes} min`
              : `${d.blocks.length} blocks · ${d.minutes} min · ${doneBlocks}/${d.blocks.length}`)));
    }),
    card(
      h('h3', {}, 'Want to pick your own?'),
      h('p', { class: 'muted' },
        'Any day above opens, in or out of order. Single drills live in ' +
        'Practice at the bottom — all of them, always unlocked.'),
      btn('PRACTICE ANY DRILL', {
        variant: 'small', onclick: () => go('#/practice'),
      }))
  );

  setActions(
    btn(store.isDayComplete(unlocked) ? 'REVIEW' : `START DAY ${unlocked}`, {
      variant: 'primary tall',
      onclick: () => { primeAudio(); go('#/day/' + unlocked); },
    }),
    btn('WHY THIS PLAN', { variant: 'ghost', onclick: () => go('#/method') })
  );
}

/**
 * Tapping a day she has not unlocked yet: explain, then let her through.
 *
 * This renders in place without changing the hash, so going "back" has to
 * re-render the tree directly -- go('#/days') from here would set the hash
 * to the value it already has, fire no hashchange, and strand her on this
 * screen.
 */
function confirmJump(d) {
  setTop({ title: `DAY ${d.n}`, back: () => lessonTreeScreen() });
  setScreen(
    card(
      h('h3', {}, `Day ${d.n} · ahead of the plan`),
      h('p', { class: 'cue' }, d.reflex.cue),
      h('p', { class: 'why' }, d.reflex.why),
      h('p', { class: 'muted' }, d.blurb)),
    card(
      h('h3', {}, 'Out of order'),
      h('p', {}, 'The week builds in order, so earlier days set this one up.'),
      h('p', { class: 'muted' }, 'That is a recommendation, not a rule. Your call.'))
  );
  setActions(
    btn(`OPEN DAY ${d.n} ANYWAY`, {
      variant: 'primary tall', onclick: () => { primeAudio(); go('#/day/' + d.n); },
    }),
    btn('BACK TO THE PLAN', { variant: 'ghost', onclick: () => lessonTreeScreen() })
  );
}

export function runDay(n) {
  const day = DAYS[n - 1];
  if (!day) return go('#/days');
  const started = Date.now();

  // Resume at the first block not yet marked complete, not always block 0 --
  // closing the app mid-day and coming back must not repeat finished work.
  const firstUnfinished = day.blocks.findIndex((b, idx) => !store.isBlockComplete(n, idx));
  const doneCount = firstUnfinished === -1 ? day.blocks.length : firstUnfinished;
  let i = doneCount;

  // A block can be mid-way through its own rounds without being "done" at
  // all -- doneCount alone would miss that (it only counts whole blocks),
  // and the intro screen would say BEGIN while actually about to resume
  // partway through block 1, which reads as a lie even though no progress
  // is lost.
  const nextBlock = day.blocks[doneCount];
  const partial = nextBlock
    ? store.loadRoundProgress(store.dayBlockKey(n, doneCount), nextBlock.rounds)
    : null;

  const intro = () => {
    setTop({ title: `DAY ${n}`, back: () => go('#/days') });
    const resuming = (doneCount > 0 || !!partial) && doneCount < day.blocks.length;
    const allDone = doneCount === day.blocks.length && day.blocks.length > 0;
    const resumeMessage = !resuming ? null
      : partial
        ? (doneCount > 0
            ? `${doneCount} of ${day.blocks.length} block${doneCount === 1 ? '' : 's'} done today, plus ${partial.index} of ${partial.total} rounds into block ${doneCount + 1}. Picking back up right there.`
            : `${partial.index} of ${partial.total} rounds done in block ${doneCount + 1} today. Picking back up right there.`)
        : `${doneCount} of ${day.blocks.length} blocks already done today. Resuming at block ${doneCount + 1}.`;
    setScreen(
      card(
        h('h3', {}, `Day ${n} · today's reflex`),
        h('p', { class: 'cue' }, day.reflex.cue),
        h('p', { class: 'why' }, day.reflex.why),
        h('p', { class: 'muted' }, day.blurb)),
      resuming ? h('div', { class: 'card', style: { borderColor: 'var(--accent)' } },
        h('h3', {}, 'Welcome back'),
        h('p', {}, resumeMessage)) : null,
      allDone ? h('div', { class: 'card', style: { borderColor: 'var(--good)' } },
        h('h3', {}, 'Already done'),
        h('p', {}, 'Every block in this day is complete. Go again from the top, or head back.')) : null,
      card(
        h('h3', {}, 'Today'),
        ...day.blocks.map((b, idx) =>
          h('div', { class: 'mathline' },
            h('span', { class: 'l' },
              `${idx < doneCount ? '✓ ' : ''}${idx + 1}. ${b.drill.title}`),
            h('span', { class: 'v' }, `${b.rounds}`))))
    );
    setActions(
      btn(allDone ? 'GO AGAIN FROM THE TOP'
        : resuming ? (doneCount > 0 ? `RESUME AT BLOCK ${doneCount + 1}` : 'RESUME WHERE YOU LEFT OFF')
          : 'BEGIN', {
        variant: 'primary tall',
        onclick: () => {
          primeAudio();
          // A full replay starts clean -- any mid-block rounds left over
          // from a prior pass through this day should not silently resume.
          if (allDone) { i = 0; store.clearDayRoundProgress(n, day.blocks.length); }
          runNext();
        },
      }),
      resuming ? btn('START THIS DAY OVER INSTEAD', {
        variant: 'ghost',
        onclick: () => {
          primeAudio();
          i = 0;
          store.clearDayRoundProgress(n, day.blocks.length);
          runNext();
        },
      }) : null
    );
  };

  const runNext = () => {
    if (i >= day.blocks.length) return finish();
    const blockIndex = i;
    const block = day.blocks[i++];
    runBlock({
      drill: block.drill,
      rounds: block.rounds,
      dayNumber: n,
      blockIndex,
      onDone: (res) => {
        if (res?.aborted) return go('#/days');
        runNext();
      },
    });
  };

  const finish = () => {
    store.markDayComplete(n);
    const planCard = store.takePlanCard();
    setTop({ title: `DAY ${n} COMPLETE` });
    setScreen(
      h('div', { class: 'card center', style: { borderColor: 'var(--good)' } },
        h('h3', {}, `Day ${n} complete`),
        h('div', { class: 'big-num', style: { color: 'var(--good)' } }, '✓'),
        h('p', { class: 'cue', style: { fontSize: '20px' } }, day.reflex.cue),
        h('p', { class: 'muted' }, `${Math.round((Date.now() - started) / 60000)} minutes.`)),
      planCard ? h('div', { class: 'card', style: { borderColor: 'var(--accent)' } },
        h('h3', {}, planCard.title),
        h('p', {}, planCard.because),
        h('p', { class: 'muted' }, planCard.change)) : null,
      n < 7 ? card(
        h('h3', {}, 'Tomorrow\'s reflex'),
        h('p', { class: 'cue', style: { fontSize: '20px' } }, DAYS[n].reflex.cue),
        h('p', { class: 'why' }, DAYS[n].reflex.why)) : card(
        h('h3', {}, 'That is the plan'),
        h('p', {}, 'Open the cue card in the green room. Nothing new before you tape.'))
    );
    setActions(
      btn('HOME', { variant: 'primary tall', onclick: () => go('#/home') }),
      btn('CUE CARD', { variant: 'ghost', onclick: () => go('#/cheat') })
    );
  };

  intro();
}

export { MISTAKES, REFLEXES };

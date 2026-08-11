// The seven-day plan. Locked-until-previous-complete, with Practice Anything
// always available in the bottom bar -- she is an adult on a deadline.

import { h, btn, setScreen, setActions, setTop, go, card, primeAudio } from './ui.js';
import * as store from './store.js';
import { runBlock } from './drills/common.js';
import { solveOrSpin, vowelDrill, vowelNameDrill } from './drills/decision.js';
import { bonusCategory, bonusLetters, bonusSim } from './drills/bonus.js';
import { tossUp, attentionLoop } from './drills/attention.js';
import { nameShape, soundItOut, sayItExactly } from './drills/names.js';
import { BONUS_RANKING, MISTAKES, COPIES_DIVISOR } from './strategy.js';

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
  tip: {
    rule: 'Everything, in the order it happens on stage, with no warning which is coming.',
    example: 'Toss-up, then the wheel, then the bonus. Same rules, mixed up.',
  },
  drills: [tossUp, solveOrSpin, vowelDrill, bonusCategory, bonusSim],
});

/** Day 7: say the rules out loud. No new material on taper day. */
const RECITAL = [
  { q: 'Pot over $9,000?', a: 'Solve. No exceptions.' },
  { q: 'Copies needed to justify a spin?', a: `Pot ÷ ${COPIES_DIVISOR}, rounded up.` },
  { q: 'Proper-name category, and you recognise it?', a: 'Solve. Never milk a name.' },
  { q: 'Before you buy a vowel?', a: 'Finish the sentence: this changes what I do next.' },
  { q: 'Vowel order on a name?', a: 'A, then O, then E, then I. Before the second consonant.' },
  { q: 'A name category is offered in the bonus round?', a: 'Take something else. Every time.' },
  { q: 'Best three bonus categories?', a: BONUS_RANKING.TAKE.slice(0, 3).join(', ') + '.' },
  { q: 'Default bonus letters?', a: 'H, G, B, and O.' },
  { q: 'Is Y a consonant?', a: 'Yes. Picking Y does not cost me my vowel.' },
  { q: 'How much of the bonus board should you expect?', a: 'About 45%. More than half of it stays blank.' },
  { q: 'What loses the bonus round?', a: 'Silence. Talking always beats thinking.' },
  { q: 'First thing when you get control?', a: 'The thing I already decided during their turn.' },
];

const cheatRecital = {
  id: 'cheat-recital',
  title: 'RECITE THE RULES',
  minutes: 4,
  tip: {
    rule: 'Say the answer out loud before you tap. Out loud is the whole exercise.',
    example: 'Taper day. Nothing new. Just make the rules automatic.',
  },
  summaryLine: () => 'Rules recited. That is taper day done.',
  round({ index, next }) {
    const item = RECITAL[(index - 1) % RECITAL.length];
    setScreen(
      card(h('h3', {}, 'Say it out loud'), h('h2', { style: { fontSize: '26px' } }, item.q))
    );
    setActions(btn('SHOW THE ANSWER', {
      variant: 'primary tall',
      onclick: () => {
        setScreen(
          card(h('h3', {}, item.q),
            h('h2', { style: { fontSize: '26px', color: 'var(--accent)' } }, item.a))
        );
        setActions(
          btn('I HAD IT', { variant: 'good tall', onclick: () => log(true) }),
          btn("SAY IT AGAIN", { variant: 'ghost', onclick: () => log(false) })
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
// The plan
// ---------------------------------------------------------------------------

const B = (drill, rounds) => ({ drill, rounds });

export const DAYS = [
  {
    n: 1,
    theme: 'The bonus round is decided before it starts',
    blurb: 'Category choice first, then the ten seconds. Plus a baseline on everything else.',
    minutes: 12,
    blocks: [B(bonusCategory, 15), B(bonusSim, 4), B(solveOrSpin, 9), B(vowelDrill, 9), B(tossUp, 7)],
  },
  {
    n: 2,
    theme: 'The solve trigger',
    blurb: 'When to stop spinning, and when a vowel is worth $250.',
    minutes: 12,
    blocks: [B(solveOrSpin, 12), B(vowelDrill, 12), B(solveOrSpin, 10), B(vowelNameDrill, 9)],
  },
  {
    n: 3,
    theme: 'Proper names: people',
    blurb: 'Shapes, sounds, and buying the vowel that tells you the spelling.',
    minutes: 12,
    blocks: [B(nameShape, 6), B(soundItOut, 7), B(vowelNameDrill, 8), B(nameShape, 6), B(soundItOut, 6)],
  },
  {
    n: 4,
    theme: 'Attention has a job',
    blurb: 'Run the loop during their turn. Find your buzz threshold.',
    minutes: 12,
    blocks: [B(attentionLoop, 3), B(tossUp, 10), B(attentionLoop, 3), B(tossUp, 10), B(attentionLoop, 3)],
  },
  {
    n: 5,
    theme: 'Proper names: places, titles, structures',
    blurb: 'The categories that cost the most, and the letter sets that rescue them.',
    minutes: 12,
    blocks: [B(nameShape, 6), B(soundItOut, 7), B(bonusLetters, 9), B(bonusCategory, 12), B(solveOrSpin, 7)],
  },
  {
    n: 6,
    theme: 'Full dress',
    blurb: 'Everything, mixed, in stage order. Then say it exactly.',
    minutes: 11,
    blocks: [B(bonusSim, 5), B(tossUp, 11), B(fullGameSim, 11), B(sayItExactly, 7)],
  },
  {
    n: 7,
    theme: 'Taper — light, no new material',
    blurb: 'Short reps on what you already know, clean articulation, cheat sheet out loud.',
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
      `${store.daysUntilTaping()} days until taping. Each day is 10 to 15 minutes.`),
    ...DAYS.map((d) => {
      const done = store.isDayComplete(d.n);
      const locked = d.n > unlocked;
      const cls = done ? 'day done' : d.n === unlocked ? 'day current' : locked ? 'day locked' : 'day';
      const doneBlocks = d.blocks.filter((b) => store.isBlockComplete(d.n, b.drill.id)).length;
      return h('button', {
        class: cls, type: 'button',
        onclick: () => {
          if (locked) return;
          primeAudio();
          go('#/day/' + d.n);
        },
      },
        h('div', { class: 'n' }, done ? '✓' : String(d.n)),
        h('div', { class: 't' },
          h('b', {}, d.theme),
          h('span', {}, locked
            ? `Finish day ${d.n - 1} first`
            : `${d.blocks.length} blocks · ${d.minutes} min${doneBlocks && !done ? ` · ${doneBlocks} done` : ''}`)));
    }),
    card(
      h('h3', {}, 'Not in the mood for the plan?'),
      h('p', { class: 'muted' }, 'Practice Anything is in the bar at the bottom. Nothing is ever locked there.'))
  );
  setActions(btn(store.isDayComplete(unlocked) ? 'REVIEW' : `START DAY ${unlocked}`, {
    variant: 'primary tall',
    onclick: () => { primeAudio(); go('#/day/' + unlocked); },
  }));
}

export function runDay(n) {
  const day = DAYS[n - 1];
  if (!day) return go('#/days');
  let i = 0;
  const started = Date.now();

  const intro = () => {
    setTop({ title: `DAY ${n}`, back: () => go('#/days') });
    setScreen(
      card(
        h('h3', {}, `Day ${n}`),
        h('h1', {}, day.theme),
        h('p', { class: 'muted' }, day.blurb)),
      card(
        h('h3', {}, 'Today'),
        ...day.blocks.map((b, idx) =>
          h('div', { class: 'mathline' },
            h('span', { class: 'l' }, `${idx + 1}. ${b.drill.title}`),
            h('span', { class: 'v' }, `${b.rounds}`))))
    );
    setActions(btn('BEGIN', { variant: 'primary tall', onclick: () => { primeAudio(); runNext(); } }));
  };

  const runNext = () => {
    if (i >= day.blocks.length) return finish();
    const block = day.blocks[i++];
    runBlock({
      drill: block.drill,
      rounds: block.rounds,
      dayNumber: n,
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
        h('p', {}, day.theme),
        h('p', { class: 'muted' }, `${Math.round((Date.now() - started) / 60000)} minutes.`)),
      planCard ? h('div', { class: 'card', style: { borderColor: 'var(--accent)' } },
        h('h3', {}, planCard.title),
        h('p', {}, planCard.because),
        h('p', { class: 'muted' }, planCard.change)) : null,
      n < 7 ? card(
        h('h3', {}, 'Tomorrow'),
        h('p', {}, DAYS[n].theme),
        h('p', { class: 'muted' }, DAYS[n].blurb)) : card(
        h('h3', {}, 'That is the plan'),
        h('p', {}, 'Open the cheat sheet in the green room. Nothing new before you tape.'))
    );
    setActions(
      btn('HOME', { variant: 'primary tall', onclick: () => go('#/home') }),
      btn('CHEAT SHEET', { variant: 'ghost', onclick: () => go('#/cheat') })
    );
  };

  intro();
}

export { MISTAKES };

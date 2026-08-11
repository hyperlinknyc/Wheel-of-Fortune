// The Method — ethos + why each day exists.
// Read when she wants the "why behind the madness." Not the green-room cue card;
// not a timed drill. Calm, blunt, built for an adult who is already a strong solver.

import { h, setScreen, setActions, setTop, btn, go, card } from './ui.js';
import { DAYS } from './lessons.js';
import { MISTAKES, VOWEL_COST, money } from './strategy.js';

const section = (title, open, ...body) =>
  h('details', { class: 'acc', ...(open ? { open: true } : {}) },
    h('summary', {}, title),
    h('div', { class: 'body' }, ...body));

const p = (...kids) => h('p', {}, ...kids);
const muted = (...kids) => h('p', { class: 'muted' }, ...kids);

/** Extra "why this day" copy — paired with DAYS[n].theme / reflex from lessons.js. */
const DAY_METHOD = [
  {
    stake: 'Highest-leverage decision of the night.',
    why:
      'Bonus category is chosen before letters, before the ten seconds, before luck has a say. ' +
      'Her gap is proper names. Taking a name category when anything else is offered is volunteering for her weakest board. ' +
      'Day 1 installs the hard rule first, while the rest of the plan still has room to reinforce it.',
  },
  {
    stake: 'The money leak for strong solvers.',
    why:
      'She often knows the answer early. The trap is milking — one more spin for letters she does not need — ' +
      'until Bankrupt eats a pot that only banks on a correct solve. Over $9,000 there is no arithmetic left. ' +
      'This day makes “if you know it — solve” automatic, and attaches a next-action reason to every vowel.',
  },
  {
    stake: 'Her biggest content gap, attacked directly.',
    why:
      'Crossword instincts fail on people. Letter-frequency logic degrades; spelling does not. ' +
      'We train shape → sound → early vowel (A → O → E → I) so recognition becomes auditory and fast, ' +
      'not a silent stare at blanks.',
  },
  {
    stake: 'Attention needs a job, or it drifts.',
    why:
      'Mid-round focus loss is not a personality flaw — it is an empty mind during someone else\'s turn. ' +
      'The three-finger loop (longest word · best guess · first action) gives attention work. ' +
      'Toss-ups train the half-beat: buzzing slightly before certainty beats waiting for a perfect read.',
  },
  {
    stake: 'Same gap, harder categories — plus letter overrides.',
    why:
      'Places, titles, and show-biz names are where frequency logic feels most “right” and is most wrong. ' +
      'We pair name drills with bonus letter-set overrides so category dictates letters, not a memorized default alone.',
  },
  {
    stake: 'Cues under fire, then the car-saving habit.',
    why:
      'Mixed stage order removes the comfort of knowing which drill is next. ' +
      'Then say-it-exactly: every word, in order, clear ending. Mumbling or an extra word loses the prize. ' +
      'Tedious on purpose — the show is not.',
  },
  {
    stake: 'Taper. Nothing new. Make the cues automatic.',
    why:
      'The day before taping is for retrieval, not input. Recite the cues out loud. ' +
      'Light reps. Clean articulation. Trust what the week already built.',
  },
];

export function methodScreen() {
  setTop({ title: 'THE METHOD', back: () => history.back() });

  setScreen(
    card(
      h('h3', {}, 'Ethos'),
      h('p', { class: 'cue', style: { fontSize: '22px' } }, 'She is already a strong solver.'),
      muted(
        'This is not a beginner\'s puzzle app. Her ceiling is decision-making and attention under lights — ' +
        'not whether she can see the answer. We train the moves that punish people who are good at puzzles.'
      ),
      h('p', { class: 'why' },
        'Be blunt about skill versus luck. Over-prepare what she can control. Leave the rest alone.'),
    ),

    section('What we believe', true,
      p(h('b', {}, 'Cues beat calculation. '),
        'Under studio lights she will not divide pots by 3,000. She needs a phrase that fires the right move in three seconds. ' +
        'The math is real — it lives behind “Show the math” and on this page — but it is not what she rehearses out loud.'),
      p(h('b', {}, 'Why makes it stick. '),
        'A rule without a mechanism is trivia. One sentence of why turns a cue into something she can trust when adrenaline argues for another spin.'),
      p(h('b', {}, 'Speak it. '),
        'On the show she speaks. Timed drills are tap → say out loud → self-score. Typing would measure the wrong thing.'),
      p(h('b', {}, 'No lockouts. '),
        'Seven days, finite patience. Streak and a daily goal — never hearts, lives, or a wall that blocks practice.'),
      p(h('b', {}, 'Honest about luck. '),
        'Wheel wedges, toss-up timing noise, and which letters hit are partly luck. We do not pretend otherwise. ' +
        'We do not waste a week polishing noise.')),

    section('The three gaps this week closes', false,
      p(h('b', {}, '1. Over-spinning. '),
        'She knows it — and still reaches for the wheel. Round money vanishes if someone else solves.'),
      p(h('b', {}, '2. Proper names. '),
        'People, places, titles. Frequency logic fails; early vowels and sound-it-out do not.'),
      p(h('b', {}, '3. Mid-round drift. '),
        'Opponent\'s turn becomes dead air. Attention gets a job: longest · guess · first action.'),
      muted('Everything else is optional. If it will not move the needle in seven days, it is cut.')),

    section('How a day is built', false,
      p('Each day installs ', h('b', {}, 'one reflex'), ' — a cue she can say, a why she can believe, drills that fire that cue until it is boring.'),
      p('The Cue Card is the green-room face: if → do. This Method page is the briefing: why we ordered the week this way.'),
      muted(`Vowels still cost ${money(VOWEL_COST)}. That has been true since 1983. Cheap information — not a hobby.`)),

    section('Why each day exists', true,
      ...DAYS.map((d, i) => {
        const m = DAY_METHOD[i];
        return h('div', { class: 'method-day' },
          h('h3', {}, `Day ${d.n}`),
          h('p', { class: 'cue', style: { fontSize: '20px' } }, d.reflex.cue),
          h('p', { class: 'why', style: { marginBottom: '6px' } }, d.reflex.why),
          h('p', { style: { fontWeight: '800', margin: '8px 0 4px' } }, m.stake),
          muted(m.why));
      })),

    section('The five mistakes strong solvers make', false,
      muted('Each one has a cue that means she is about to make it — and a reflex that replaces it.'),
      ...Object.values(MISTAKES).map((m) =>
        h('div', { class: 'ifthen' },
          h('b', {}, `${m.id}. ${m.name}`),
          h('span', { class: 'then' },
            h('span', { class: 'cue', style: { display: 'block', fontSize: '18px', margin: '4px 0' } }, m.cue),
            h('span', { class: 'why', style: { display: 'block', margin: 0 } }, m.why))))),

    section('What is luck (leave it alone)', false,
      p('Which wedge she hits. Whether a called letter is on the board. Toss-up race noise when two people buzz together.'),
      p('We train the decisions around those moments — solve timing, category choice, letter sets, buzz threshold, exact speech — not superstition about the wheel.'),
      muted('If a tip cannot change what her hands or mouth do in three seconds, it does not belong in this app.')),

    section('How to use this page', false,
      p('Read it once at the start of the week. Skim a day\'s “why” the morning she trains that day. Do not study it in the green room — that is what the Cue Card is for.'),
      muted('Then close this and practice. The method only works if the cues get reps.')),

    h('div', { class: 'spacer' })
  );

  setActions(
    btn("TODAY'S LESSON", { variant: 'primary tall', onclick: () => { go('#/days'); } }),
    h('div', { class: 'row' },
      btn('CUE CARD', { variant: 'ghost', onclick: () => go('#/cheat') }),
      btn('GLOSSARY', { variant: 'ghost', onclick: () => go('#/glossary') }))
  );
}

// The Method — ethos + why each day exists.
// Read when she wants the "why behind the madness." Not the green-room cue card;
// not a timed drill. Calm, blunt, built for an adult who is already a strong solver.

import { h, setScreen, setActions, setTop, btn, go, card, mathDisclosure } from './ui.js';
import { DAYS } from './lessons.js';
import {
  MISTAKES, VOWEL_COST, money, SPIN_DERIVATION, COPIES_DIVISOR, ALWAYS_SOLVE_ABOVE,
  WEDGE_AVERAGE, TURN_ENDING_ODDS, SURVIVAL_ODDS, CEDED_TURN_COST,
  RSTLNE_MAIN_COVERAGE, RSTLNE_BONUS_COVERAGE, DEFAULT_SET_COVERAGE, EXPECTED_BOARD_COVERAGE,
  vowelBreakEven,
} from './strategy.js';

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

    section('The math, in full', false,
      muted(
        'Every cue in this app is a compressed version of an actual calculation. ' +
        'None of it is folklore or a hot take -- each number below is derived from ' +
        'how the wheel and the board are actually built. This is the full working, ' +
        'for whenever you want to check it rather than just trust it.'),

      h('h3', { style: { marginTop: '14px' } }, 'Solve vs. spin'),
      p(
        `A standard wheel carries 24 wedges. Two are Bankrupt, one is Lose a Turn -- ` +
        `three of twenty-four end your turn outright, so a spin keeps your turn about ` +
        `${(SURVIVAL_ODDS * 100).toFixed(1)}% of the time and ends it about ` +
        `${(TURN_ENDING_ODDS * 100).toFixed(0)}% of the time.`),
      p(
        `Expected gain from one more spin is that survival odds, times a typical wedge ` +
        `value, times how many copies of the letter you are certain of: ` +
        `${SURVIVAL_ODDS} × ${money(WEDGE_AVERAGE)} × copies.`),
      p(
        `Expected cost is the odds of ending your turn, times the whole pot you would ` +
        `be walking away from -- doubled, because if you are the best solver at the ` +
        `table, a turn you hand to an opponent is not neutral. It is a puzzle you would ` +
        `probably have solved, going to someone who might not have. ` +
        `${TURN_ENDING_ODDS} doubled is ${CEDED_TURN_COST} × pot.`),
      p(
        `Set the two equal and solve for copies: at a ${money(WEDGE_AVERAGE)} average ` +
        `wedge, that works out to copies = pot ÷ ${COPIES_DIVISOR.toLocaleString()}, ` +
        `rounded up. Above ${money(ALWAYS_SOLVE_ABOVE)} the required copies get high ` +
        `enough, fast enough, that treating it as "always solve" is a rounding error, ` +
        `not a simplification.`),
      mathDisclosure([
        { label: 'Wedges that end your turn', value: '3 of 24' },
        { label: 'Turn survives a spin', value: `${(SURVIVAL_ODDS * 100).toFixed(1)}%` },
        { label: 'Turn ends on a spin', value: `${(TURN_ENDING_ODDS * 100).toFixed(0)}%, doubled to ${(CEDED_TURN_COST * 100).toFixed(0)}%` },
        { label: 'Gain per spin', value: `${SURVIVAL_ODDS} × ${money(WEDGE_AVERAGE)} × copies` },
        { label: 'Cost per spin', value: `${CEDED_TURN_COST} × pot` },
        { label: 'Copies needed', value: `pot ÷ ${COPIES_DIVISOR.toLocaleString()}` },
      ], 'Show the full working'),

      h('h3', { style: { marginTop: '16px' } }, 'The vowel buy'),
      p(
        `A vowel is a flat ${money(VOWEL_COST)}, and unlike a spin it never risks your ` +
        `turn -- so the only question is whether it is worth the money. The break-even ` +
        `is simple: ${money(VOWEL_COST)} divided by the pot. ` +
        `At a $2,500 pot that is ${(vowelBreakEven(2500) * 100).toFixed(0)}%; at $5,000 ` +
        `it is ${(vowelBreakEven(5000) * 100).toFixed(0)}%. If buying it does not improve ` +
        `your odds of solving by at least that much, it is not a bargain just because ` +
        `it is cheap.`),

      h('h3', { style: { marginTop: '16px' } }, 'Where the bonus-round numbers come from'),
      p(
        `RSTLNE -- the six letters given free before you pick -- reveals roughly ` +
        `${Math.round(RSTLNE_MAIN_COVERAGE * 100)}% of the letters on a typical main-game ` +
        `board. Bonus-round puzzles are deliberately built to defeat that: this app's own ` +
        `puzzle bank only marks a board bonus-eligible if RSTLNE would reveal under 35% of ` +
        `it, matching how those boards are actually constructed. Across the eligible bank, ` +
        `RSTLNE alone comes in around ${Math.round(RSTLNE_BONUS_COVERAGE * 100)}%.`),
      p(
        `The default pick -- H, G, B plus O -- covers about ` +
        `${Math.round(DEFAULT_SET_COVERAGE * 100)}% of whatever RSTLNE left behind. Layer ` +
        `that on top of the RSTLNE coverage and total expected coverage is ` +
        `${RSTLNE_BONUS_COVERAGE.toFixed(3)} + ${DEFAULT_SET_COVERAGE.toFixed(3)} × ` +
        `(1 − ${RSTLNE_BONUS_COVERAGE.toFixed(3)}) ≈ ${(EXPECTED_BOARD_COVERAGE * 100).toFixed(0)}%. ` +
        `That is the actual arithmetic behind "expect the board to be less than half full" -- ` +
        `it is not a comforting exaggeration, it is what the numbers say a normal bonus board looks like.`),

      h('h3', { style: { marginTop: '16px' } }, 'What this app does and does not do with the numbers'),
      p(
        'None of this is published Wheel of Fortune statistics -- there is no public ' +
        'dataset of wedge outcomes or letter reveals to draw on. It is built from what ' +
        'is knowable directly: how many wedges are on a standard wheel and what they ' +
        'are, how a vowel is priced, and a hand-built puzzle bank filtered to match how ' +
        'bonus boards are actually constructed. Where a number depends on judgment ' +
        '(the $700 average wedge, doubling the cost of a ceded turn for a strong ' +
        'solver) that judgment is stated plainly above rather than hidden inside a ' +
        'constant, so it can be argued with instead of just trusted.'),
      muted(SPIN_DERIVATION)),

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

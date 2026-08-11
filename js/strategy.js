// The strategy engine. Every piece of drill feedback in the app is generated
// from these constants and functions, so a rule can never be taught two
// different ways in two different screens.
//
// Pure module: no DOM, no storage. Imported by the app and by tools/validate.mjs.

export const WEDGE_AVERAGE = 700;      // dollars, average big-consonant wedge
export const TURN_ENDING_ODDS = 0.11;  // 2 Bankrupt + 1 Lose-a-Turn of 24 wedges
export const SURVIVAL_ODDS = 0.875;    // ~7 of 8 spins keep the turn
export const CEDED_TURN_MULTIPLIER = 2;// a ceded turn is a ceded puzzle for her
export const CEDED_TURN_COST = 0.20;   // TURN_ENDING_ODDS doubled
export const COPIES_DIVISOR = 3000;
export const ALWAYS_SOLVE_ABOVE = 9000;
export const VOWEL_COST = 250;
// A solved round always pays at least this, the way the show guarantees a
// minimum. It matters for training as well as realism: without it, solving
// early off a small pot can bank literally nothing, which argues against
// exactly the reflex every drill in this app is trying to build.
export const ROUND_MINIMUM = 1000;

/**
 * The wheel used by Play mode.
 *
 * It lives here, next to the constants derived from it, because the drills
 * teach "2 Bankrupt + 1 Lose-a-Turn out of 24" and "a $700 average wedge" --
 * if the wheel she actually spins disagreed with that, the app would be
 * teaching one game and letting her play a different one. tools/validate.mjs
 * asserts the composition still matches WEDGE_AVERAGE and TURN_ENDING_ODDS.
 *
 * Order is interleaved the way a real wheel is: big money spread out, the
 * two Bankrupts nowhere near each other.
 */
export const BANKRUPT = 'BANKRUPT';
export const LOSE_A_TURN = 'LOSE A TURN';

export const WHEEL = [
  500, 900, 700, BANKRUPT, 600, 800, 500, 650,
  500, LOSE_A_TURN, 700, 600, 550, 500, 600, 550,
  BANKRUPT, 650, 500, 700, 800, 650, 2500, 350,
];

export const wheelCashWedges = () => WHEEL.filter((w) => typeof w === 'number');

/**
 * Fraction of the letter slots on a board that are showing.
 *
 * This is the number both Play modes reason about: it is what decides when an
 * opponent goes for a solve, and it is what the coach tips use to say "the
 * board is 60% there and you are still spinning".
 */
export function revealedFraction(answer, revealed) {
  const letters = answer.replace(/[^A-Z]/g, '');
  if (!letters.length) return 0;
  const set = revealed instanceof Set ? revealed : new Set(revealed ?? []);
  let n = 0;
  for (const ch of letters) if (set.has(ch)) n++;
  return n / letters.length;
}

// ---------------------------------------------------------------------------
// The five strong-solver mistakes. Every logged error carries one of these.
// ---------------------------------------------------------------------------
export const MISTAKES = {
  1: {
    id: 1,
    name: 'Milking a puzzle you had already solved',
    cue: 'If you know it — solve.',
    why: 'Every extra spin risks Bankrupt. Round money only banks on a correct solve.',
  },
  2: {
    id: 2,
    name: 'The confident wrong word',
    cue: "Read it — don't invent it.",
    why: 'Speed plus certainty is how strong solvers say the wrong phrase cleanly.',
  },
  3: {
    id: 3,
    name: 'The vowel reflex',
    cue: 'This changes what I do next — or don\'t buy.',
    why: '$250 is cheap; a vowel with no next move is a waste, not a bargain.',
  },
  4: {
    id: 4,
    name: 'The speed-clip',
    cue: 'Every word, in order, clear ending.',
    why: 'An extra word or a mumble loses the car. Slow the mouth, not the mind.',
  },
  5: {
    id: 5,
    name: 'Running word-logic on a name puzzle',
    cue: 'Name? Buy the vowel. Then solve on recognition.',
    why: 'Names are not in your crossword dictionary. Frequency logic fails; spelling does not.',
  },
};

/**
 * The reflex map. Every tip, day intro, and cheat-sheet face should lead with
 * a cue from here. Math stays available; it is never the primary teaching line.
 */
export const REFLEXES = {
  solveKnown: {
    id: 'solveKnown',
    cue: 'If you know it — solve.',
    why: 'Extra spins risk Bankrupt. Pot only banks when you solve.',
  },
  potCap: {
    id: 'potCap',
    cue: 'Over nine thousand — solve.',
    why: 'Above $9,000 no spin pays for the risk. Arithmetic is over.',
  },
  nameSolve: {
    id: 'nameSolve',
    cue: 'Name category — solve on recognition.',
    why: 'Milking a name is how you lose an answer you already had.',
  },
  certainCopies: {
    id: 'certainCopies',
    cue: 'Certain copies on the board — then spin.',
    why: `One more spin only pays if enough big consonants are clearly still out (about pot ÷ ${COPIES_DIVISOR}).`,
  },
  vowelReason: {
    id: 'vowelReason',
    cue: 'This changes what I do next — or don\'t buy.',
    why: 'A vowel is $250 and never ends your turn. No next-action means no buy.',
  },
  nameVowel: {
    id: 'nameVowel',
    cue: 'Name? Vowel before the second consonant.',
    why: 'On names, the vowel is the spelling. Order: A → O → E → I.',
  },
  bonusAvoidName: {
    id: 'bonusAvoidName',
    cue: 'Name offered — take anything else.',
    why: 'Category choice is the highest-leverage decision of the night. Her gap is names.',
  },
  bonusLetters: {
    id: 'bonusLetters',
    cue: 'H, G, B + O — unless the category overrides.',
    why: 'That set covers about 22% of what RSTLNE-sparse bonus boards leave behind.',
  },
  yConsonant: {
    id: 'yConsonant',
    cue: 'Y is a consonant — it does not spend the vowel.',
    why: 'You still get three consonants and one vowel. Y fills a consonant slot.',
  },
  bonusTalk: {
    id: 'bonusTalk',
    cue: 'Talk the whole ten. Silence loses.',
    why: 'Unlimited guesses. A winnable board is often more than half blank — that is normal.',
  },
  tossBuzz: {
    id: 'tossBuzz',
    cue: 'Board almost full — buzz a half-beat early.',
    why: 'A wrong buzz costs only that toss-up. Waiting for certainty leaves money on the table.',
  },
  attentionLoop: {
    id: 'attentionLoop',
    cue: 'Their turn: longest · best guess · first action.',
    why: 'Attention needs a job or it drifts. Decide before you get control.',
  },
  sayExactly: {
    id: 'sayExactly',
    cue: 'Every word, in order, clear ending.',
    why: 'Mumbling or an extra word loses it. Full articulation at about 80% speed.',
  },
  soundNames: {
    id: 'soundNames',
    cue: 'Names: say sounds, not letter names.',
    why: 'Name recognition is auditory. Silent reading uses the wrong retrieval path.',
  },
};

/** Tip payload helper — cue first, why second, math optional. */
export function tipFrom(reflex, { example = null, math = null } = {}) {
  const r = typeof reflex === 'string' ? REFLEXES[reflex] : reflex;
  return {
    cue: r.cue,
    why: r.why,
    example,
    math,
    // legacy alias so older call sites still render something sensible
    rule: r.cue,
  };
}

export const money = (n) =>
  '$' + Math.round(n).toLocaleString('en-US');

// ---------------------------------------------------------------------------
// Solve vs. spin
// ---------------------------------------------------------------------------

export function copiesRequired(pot) {
  return Math.ceil(pot / COPIES_DIVISOR);
}

/** What the rules say to do, before she has chosen anything. */
export function solveOrSpinRule({ pot, isProperName }) {
  const potForcesSolve = pot > ALWAYS_SOLVE_ABOVE;
  return {
    potForcesSolve,
    nameForcesSolve: !!isProperName,
    mustSolve: potForcesSolve || !!isProperName,
    copiesNeeded: copiesRequired(pot),
  };
}

export function spinGain(copies) {
  return SURVIVAL_ODDS * WEDGE_AVERAGE * copies;
}

export function spinCost(pot) {
  return CEDED_TURN_COST * pot;
}

/**
 * Scores a solve-or-spin decision.
 * verdict: 'optimal' | 'over-spin' | 'over-solve'
 */
export function scoreSolveOrSpin({ pot, isProperName, choice, copies }) {
  const rule = solveOrSpinRule({ pot, isProperName });
  const needed = rule.copiesNeeded;

  if (choice === 'SOLVE') {
    // Over-solving is never one of the five mistakes -- it is at worst money
    // left on the table, and it is the direction we want her erring in.
    if (rule.mustSolve || pot >= COPIES_DIVISOR) {
      return { verdict: 'optimal', correct: true, errorTag: null, rule };
    }
    return { verdict: 'over-solve', correct: false, errorTag: null, rule };
  }

  // choice === 'SPIN'
  if (rule.mustSolve) {
    return {
      verdict: 'over-spin',
      correct: false,
      errorTag: rule.nameForcesSolve && !rule.potForcesSolve ? 5 : 1,
      rule,
    };
  }
  if (copies >= needed) return { verdict: 'optimal', correct: true, errorTag: null, rule };
  return { verdict: 'over-spin', correct: false, errorTag: 1, rule };
}

/** The arithmetic to put on screen. Acceptance criterion 5. */
export function solveOrSpinMath({ pot, copies, isProperName }) {
  const rule = solveOrSpinRule({ pot, isProperName });
  const lines = [];

  if (rule.potForcesSolve) {
    lines.push({
      label: 'Pot is over ' + money(ALWAYS_SOLVE_ABOVE),
      value: 'Always solve. No exceptions.',
      wide: true,
    });
  }
  if (rule.nameForcesSolve) {
    lines.push({
      label: 'Proper-name category',
      value: 'Solve on recognition. Never milk a name.',
      wide: true,
    });
  }

  lines.push({
    label: 'Copies needed to justify a spin',
    value: `ceil(${money(pot).replace('$', '')} / ${COPIES_DIVISOR}) = ${rule.copiesNeeded}`,
  });

  if (typeof copies === 'number') {
    const gain = spinGain(copies);
    const cost = spinCost(pot);
    lines.push({ label: 'You were certain of', value: `${copies} cop${copies === 1 ? 'y' : 'ies'}` });
    lines.push({
      label: 'Expected gain from spinning',
      value: `${SURVIVAL_ODDS} × ${money(WEDGE_AVERAGE)} × ${copies} = ${money(gain)}`,
    });
    lines.push({
      label: 'Expected cost of spinning',
      value: `${CEDED_TURN_COST} × ${money(pot)} = ${money(cost)}`,
    });
    lines.push({
      label: 'Net',
      value: (gain - cost >= 0 ? '+' : '−') + money(Math.abs(gain - cost)),
      emphasis: true,
      good: gain - cost >= 0,
    });
  }
  return lines;
}

export const SPIN_DERIVATION =
  'About 1 in 8 spins ends your turn (2 Bankrupt + 1 Lose-a-Turn out of 24 wedges). ' +
  'Gain per spin is 0.875 × wedge × copies. Loss is 0.11 × pot, doubled to 0.20 × pot ' +
  'because you are the best solver at the table and a ceded turn is a ceded puzzle. ' +
  'Set those equal at a $700 average wedge and copies = pot ÷ 3000.';

// ---------------------------------------------------------------------------
// Vowels
// ---------------------------------------------------------------------------

export const VOWEL_ORDER_NAMES = ['A', 'O', 'E', 'I'];

export function vowelBreakEven(pot) {
  return VOWEL_COST / pot;
}

/** First vowel in the name-category order that is not already on the board. */
export function preferredVowel(revealed = []) {
  const seen = new Set(revealed.map((c) => c.toUpperCase()));
  return VOWEL_ORDER_NAMES.find((v) => !seen.has(v)) ?? 'U';
}

export const VOWEL_REASONS = [
  { id: 'split', text: 'It splits two answers I am stuck between', good: true },
  { id: 'pattern', text: 'It tells me the vowel pattern of the longest word', good: true },
  {
    id: 'spelling',
    text: 'It is a name — I need the spelling, not the shape',
    good: 'nameOnly',
  },
  { id: 'cheap', text: 'It is cheap', good: false, errorTag: 3 },
  { id: 'known', text: 'I already know the answer', good: false, errorTag: 1 },
  { id: 'shape', text: 'I can already see where the vowels go', good: false, errorTag: 3 },
];

export function scoreVowel({ isProperName, choice, vowel, reasonId, revealed, hadIt }) {
  // "I know it" is the one answer that beats every vowel decision, including on
  // a name. Without it the drill was a trap: buying with the reason "I already
  // know the answer" is milking (mistake 1), and passing on the vowel was
  // scored as mistake 5, so a puzzle she had already solved had no right
  // answer at all. Claiming it is not free -- she says it out loud and scores
  // herself, exactly like every other solve in the app.
  if (choice === 'KNOW') {
    if (hadIt) {
      return {
        correct: true,
        errorTag: null,
        headline: 'Right. Solving beats buying.',
        detail: isProperName
          ? 'Name category — solve on recognition. A vowel you did not need is $250 ' +
            'and one more chance to hand the puzzle over.'
          : 'If you know it, solve. A vowel can only sell you information you already had.',
      };
    }
    return {
      correct: false,
      errorTag: isProperName ? 5 : 2,
      headline: 'You did not have it.',
      detail: isProperName
        ? 'This is exactly why names get the vowel first. Recognising who it is ' +
          'is not the same as knowing how it is spelled.'
        : 'Read the board again before you commit. The certainty is the expensive part.',
    };
  }

  if (choice === 'NONE') {
    if (isProperName) {
      return {
        correct: false,
        errorTag: 5,
        headline: 'On a name, no vowel is the wrong answer.',
        detail:
          'Buy the vowel before your second consonant. Order: A → O → E → I. ' +
          'Knowing it is a person does not tell you how it is spelled. ' +
          'If you already had the answer, that is the I KNOW IT button — and it wins.',
      };
    }
    return {
      correct: true,
      errorTag: null,
      headline: 'Good. No reason, no buy.',
      detail:
        'A vowel you can infer from word shape is $250 you already had. ' +
        'Passing here is the disciplined play.',
    };
  }

  const reason = VOWEL_REASONS.find((r) => r.id === reasonId);
  const good = reason ? (reason.good === 'nameOnly' ? !!isProperName : reason.good) : false;
  const best = preferredVowel(revealed);

  if (!good) {
    const tag = reason?.errorTag ?? (reason?.good === 'nameOnly' ? 3 : 3);
    return {
      correct: false,
      errorTag: tag,
      headline:
        reason?.id === 'known'
          ? 'You already had it. That $250 bought you nothing.'
          : reason?.id === 'spelling'
            ? 'That is the right reason on the wrong puzzle.'
            : 'That is the vowel reflex.',
      detail: MISTAKES[tag].cue,
    };
  }

  return {
    correct: true,
    errorTag: null,
    optimal: !isProperName || vowel === best,
    headline: isProperName && vowel !== best
      ? `Right call, wrong vowel. On a name, take ${best} first.`
      : 'Good buy, and you can say why.',
    detail: isProperName
      ? 'Name order is A → O → E → I, and a correct vowel does not end your turn.'
      : 'A correct vowel does not end your turn. The only cost is the $250.',
  };
}

export function vowelBreakEvenText(pot) {
  const pct = vowelBreakEven(pot) * 100;
  return `At a ${money(pot)} pot, $250 is ${pct.toFixed(pct < 10 ? 1 : 0)}% of the pot. ` +
    `The vowel pays for itself if it improves your odds of solving by ${pct.toFixed(pct < 10 ? 1 : 0)}%.`;
}

// ---------------------------------------------------------------------------
// Bonus round
// ---------------------------------------------------------------------------

export const FREE_LETTERS = ['R', 'S', 'T', 'L', 'N', 'E'];
export const RSTLNE_BONUS_COVERAGE = 0.296;   // bonus boards
export const RSTLNE_MAIN_COVERAGE = 0.447;    // main-game boards
export const DEFAULT_SET_COVERAGE = 0.225;    // H G B + O, of what is left
export const EXPECTED_BOARD_COVERAGE =
  RSTLNE_BONUS_COVERAGE + DEFAULT_SET_COVERAGE * (1 - RSTLNE_BONUS_COVERAGE); // 0.454

export const COVERAGE_HEADLINE =
  'Expect about 45% of the board. A winnable bonus board is more than half blank.';

export const BONUS_RANKING = {
  TAKE: [
    'PHRASE',
    'THING',
    'WHAT ARE YOU DOING?',
    'AROUND THE HOUSE',
    'FOOD & DRINK',
    'LIVING THING',
    'OCCUPATION',
    'FUN & GAMES',
    'EVENT',
  ],
  TOLERATE: [
    'QUOTATION',
    'RHYME TIME',
    'SAME LETTER',
  ],
  AVOID: [
    'PROPER NAME',
    'PERSON',
    'STAR & ROLE',
    'SHOW BIZ',
    'FICTIONAL CHARACTER',
    'ON THE MAP',
    'PLACE',
    'LANDMARK',
    'SONG / ARTIST',
    'TITLE',
    'AUTHOR & TITLE',
    'SAME NAME',
    'BEFORE & AFTER',
  ],
};

// Categories on the avoid list specifically because they are proper nouns.
// These trigger the absolute rule, not just the ranking.
export const PROPER_NOUN_AVOID = new Set([
  'PROPER NAME', 'PERSON', 'STAR & ROLE', 'SHOW BIZ', 'FICTIONAL CHARACTER',
  'ON THE MAP', 'PLACE', 'LANDMARK', 'SONG / ARTIST', 'TITLE', 'AUTHOR & TITLE',
]);

export function categoryTier(category) {
  if (BONUS_RANKING.TAKE.includes(category)) return 'TAKE';
  if (BONUS_RANKING.TOLERATE.includes(category)) return 'TOLERATE';
  return 'AVOID';
}

/** Lower is better. Used to pick the single best of three offered strips. */
export function categoryRank(category) {
  const t = BONUS_RANKING.TAKE.indexOf(category);
  if (t >= 0) return t;
  const o = BONUS_RANKING.TOLERATE.indexOf(category);
  if (o >= 0) return 100 + o;
  const a = BONUS_RANKING.AVOID.indexOf(category);
  return 200 + (a >= 0 ? a : 50);
}

export function bestOf(categories) {
  return [...categories].sort((a, b) => categoryRank(a) - categoryRank(b))[0];
}

export function scoreCategoryChoice(offered, picked) {
  const best = bestOf(offered);
  const tier = categoryTier(picked);
  const hadAlternative = offered.some((c) => categoryTier(c) !== 'AVOID');
  const disciplineBreak = tier === 'AVOID' && hadAlternative;
  return {
    best,
    tier,
    disciplineBreak,
    properNounBreak: disciplineBreak && PROPER_NOUN_AVOID.has(picked),
    correct: picked === best,
    errorTag: disciplineBreak ? 5 : null,
    countsForDiscipline: hadAlternative,
    disciplineHeld: !disciplineBreak,
  };
}

// ---------------------------------------------------------------------------
// Bonus letter sets
// ---------------------------------------------------------------------------

export const DEFAULT_LETTER_SET = { consonants: ['H', 'G', 'B'], vowel: 'O' };

const SET = (consonants, vowel, logic, extra = {}) => ({ consonants, vowel, logic, ...extra });

export const BONUS_LETTER_SETS = {
  'PHRASE':              SET(['H','G','B'], 'O', 'The default set. Nothing about a phrase argues against it.'),
  'THING':               SET(['H','G','D'], 'O', 'Plural S is free, so D beats B on nouns.'),
  'WHAT ARE YOU DOING?': SET(['H','D','P'], 'A', 'Never G or I here — the -ING is guaranteed, so both reveal letters you already know.', { forbidden: ['G','I'] }),
  'AROUND THE HOUSE':    SET(['C','D','W'], 'O', 'W over-performs in this category: WASHER, WINDOW, WALL.'),
  'FOOD & DRINK':        SET(['C','P','D'], 'A', 'C is enormous in food.'),
  'LIVING THING':        SET(['C','D','Y'], 'A', 'Y is free here — FURRY, PUPPY, BUTTERFLY — and it costs you no vowel.'),
  'OCCUPATION':          SET(['C','D','M'], 'O', '-ER and -OR endings: DOCTOR, SAILOR.'),
  'EVENT':               SET(['C','D','P'], 'A', 'PARTY, PARADE, GRADUATION.'),
  'TITLE':               SET(['H','C','D'], 'A', 'H first — it completes THE, since T and E are already free.'),
  'SHOW BIZ':            SET(['H','C','D'], 'A', 'H first — it completes THE, since T and E are already free.'),
  'SONG / ARTIST':       SET(['M','D','H'], 'O', 'If a one-letter word is showing, take I as your vowel instead.'),
  'ON THE MAP':          SET(['C','D','M'], 'A', 'A always — and you should not be in this category at all.'),
  'PLACE':               SET(['C','D','M'], 'A', 'A always — and you should not be in this category at all.'),
  'LANDMARK':            SET(['C','D','M'], 'A', 'A always — and you should not be in this category at all.'),
  'PERSON':              SET(['C','D','M'], 'A', 'A always — and you should not be in this category at all.'),
  'PROPER NAME':         SET(['C','D','M'], 'A', 'A always — and you should not be in this category at all.'),
  'FICTIONAL CHARACTER': SET(['C','D','M'], 'A', 'A always — name rules apply. And you should not be here.'),
  'STAR & ROLE':         SET(['C','D','M'], 'A', 'A always — name rules apply. And you should not be here.'),
  'AUTHOR & TITLE':      SET(['H','C','D'], 'A', 'Title rules — H completes THE. And you should not be here.'),
  'SAME NAME':           SET(['H','D','C'], 'A', 'Target the shared word — those letters appear twice on the board.'),
  'BEFORE & AFTER':      SET(['H','D','C'], 'A', 'Target the pivot word — it is the hinge the whole board turns on.'),
  'RHYME TIME':          SET(['C','D','P'], 'A', 'The rhyme ending repeats across both words.'),
  'QUOTATION':           SET(['H','D','M'], 'O', 'Conversational language: YOU, MY, DON’T.'),
  'FUN & GAMES':         SET(['H','G','B'], 'O', 'No override — fall back to the default set.'),
  'SAME LETTER':         SET(['H','G','B'], 'O', 'No override — fall back to the default set.'),
};

export function letterSetFor(category) {
  return BONUS_LETTER_SETS[category] ?? { ...DEFAULT_LETTER_SET, logic: 'The default set.' };
}

export function scoreLetterSet({ category, consonants, vowel }) {
  const ideal = letterSetFor(category);
  const picked = consonants.map((c) => c.toUpperCase());
  const hits = picked.filter((c) => ideal.consonants.includes(c));
  const vowelHit = vowel === ideal.vowel;

  const wasted = picked.filter((c) => FREE_LETTERS.includes(c));
  const forbidden = (ideal.forbidden ?? []).filter(
    (f) => picked.includes(f) || vowel === f
  );

  let score = hits.length / 3 * 0.75 + (vowelHit ? 0.25 : 0);
  if (wasted.length) score = 0;
  if (forbidden.length) score = Math.max(0, score - 0.4);

  const notes = [];
  if (wasted.length)
    notes.push(`${wasted.join(', ')} ${wasted.length > 1 ? 'are' : 'is'} already on the board for free.`);
  if (forbidden.length)
    notes.push(`${forbidden.join(' and ')} ${forbidden.length > 1 ? 'reveal' : 'reveals'} letters you already know here.`);
  if (picked.includes('Y'))
    notes.push('Y is a consonant. Picking it did not cost you your vowel.');
  if (!vowelHit) notes.push(`The vowel to take here is ${ideal.vowel}.`);

  return {
    ideal,
    score,
    exact: hits.length === 3 && vowelHit,
    correct: score >= 0.99,
    partial: score > 0 && score < 0.99,
    hits,
    missed: ideal.consonants.filter((c) => !picked.includes(c)),
    vowelHit,
    notes,
    errorTag: score >= 0.99 ? null : 3,
  };
}

/** Fraction of an answer's letters revealed by a set of picks. */
export function boardCoverage(answer, picks) {
  const letters = answer.replace(/[^A-Z]/g, '');
  if (!letters.length) return 0;
  const set = new Set([...FREE_LETTERS, ...picks.map((c) => c.toUpperCase())]);
  let hit = 0;
  for (const ch of letters) if (set.has(ch)) hit++;
  return hit / letters.length;
}

// ---------------------------------------------------------------------------
// Toss-up coaching
// ---------------------------------------------------------------------------

export const CONVERSION_CEILING = 0.85;

export function tossUpCoaching({ buzzRate, conversion, samples }) {
  if (samples < 4) return 'Keep going — a few more toss-ups and this will mean something.';
  if (conversion > CONVERSION_CEILING)
    return `Conversion ${Math.round(conversion * 100)}%. That is too high. ` +
      'You are buzzing too late and leaving toss-ups on the table. Commit one reveal earlier.';
  if (conversion < 0.55)
    return `Conversion ${Math.round(conversion * 100)}%. You are firing before the board is there. ` +
      'Give it one more reveal.';
  return `Conversion ${Math.round(conversion * 100)}%. That is the zone. Hold it.`;
}

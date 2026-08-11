#!/usr/bin/env node
// Fails the build if anything in the shipped bank is wrong.
//
// The headline check is wordLengths vs answer. A single mismatched board
// destroys trust in every other board in the app, so this exits non-zero and
// prints the offending row rather than warning.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BONUS_RANKING, BONUS_LETTER_SETS, FREE_LETTERS,
  WHEEL, BANKRUPT, LOSE_A_TURN, wheelCashWedges, WEDGE_AVERAGE,
  REFLEXES, revealedFraction, scoreVowel, VOWEL_REASONS,
} from '../js/strategy.js';
import { DAYS } from '../js/lessons.js';
import { TIPS, EVENTS as TIP_EVENTS, resolveTip } from '../js/tips.js';
import { OPPONENTS, planOpponentTurn } from '../js/game.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warnings = [];
const fail = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

// --- Categories the strategy engine knows how to rank -----------------------
// Every category in the bank must appear in the bonus ranking and in the
// letter-set table, otherwise a drill could show a board it cannot score.
const rankedCategories = new Set([
  ...BONUS_RANKING.TAKE,
  ...BONUS_RANKING.TOLERATE,
  ...BONUS_RANKING.AVOID,
]);
for (const c of rankedCategories) {
  if (!BONUS_LETTER_SETS[c]) fail(`category "${c}" is ranked but has no letter-set override`);
}
for (const c of Object.keys(BONUS_LETTER_SETS)) {
  if (!rankedCategories.has(c)) fail(`letter set for "${c}" but it is not in the ranking`);
  const set = BONUS_LETTER_SETS[c];
  if (set.consonants.length !== 3) fail(`letter set for "${c}" has ${set.consonants.length} consonants`);
  for (const l of [...set.consonants, set.vowel]) {
    if (FREE_LETTERS.includes(l)) fail(`letter set for "${c}" picks ${l}, which is already free`);
  }
  if (!'AIOU'.includes(set.vowel)) fail(`letter set for "${c}" has non-vowel ${set.vowel}`);
}

const RSTLNE = new Set(['R', 'S', 'T', 'L', 'N', 'E']);
const STRUCTURAL = { 'SAME NAME': 'shared', 'BEFORE & AFTER': 'pivot', 'RHYME TIME': 'rhyme' };

// --- Puzzle bank ------------------------------------------------------------
const bankPath = resolve(ROOT, 'data/puzzles.json');
if (!existsSync(bankPath)) {
  console.error('FAIL: data/puzzles.json missing. Run: node tools/build-puzzles.mjs');
  process.exit(1);
}
const bank = JSON.parse(readFileSync(bankPath, 'utf8'));

if (!Array.isArray(bank)) fail('bank is not an array');
if (bank.length < 300) fail(`bank has ${bank.length} puzzles, need at least 300`);

const ids = new Set();
const answers = new Set();
let properCount = 0;
let bonusCount = 0;

for (const p of bank) {
  const where = `${p.id ?? '??'} ${JSON.stringify(p.answer ?? '')}`;

  if (!p.id) fail(`${where}: missing id`);
  else if (ids.has(p.id)) fail(`${where}: duplicate id`);
  ids.add(p.id);

  if (typeof p.answer !== 'string' || !p.answer.length) {
    fail(`${where}: missing answer`);
    continue;
  }
  if (answers.has(p.answer)) fail(`${where}: duplicate answer`);
  answers.add(p.answer);

  if (!/^[A-Z' &-]+$/.test(p.answer)) fail(`${where}: illegal characters in answer`);
  if (/ {2}/.test(p.answer) || p.answer !== p.answer.trim())
    fail(`${where}: stray or doubled spaces`);

  // THE headline assertion.
  const expected = p.answer.split(' ').map((w) => w.length);
  if (!Array.isArray(p.wordLengths)) fail(`${where}: wordLengths is not an array`);
  else if (
    p.wordLengths.length !== expected.length ||
    p.wordLengths.some((n, i) => n !== expected[i])
  ) {
    fail(
      `${where}: BOARD MISMATCH -- wordLengths ${JSON.stringify(p.wordLengths)} ` +
        `but answer needs ${JSON.stringify(expected)}`
    );
  }

  if (!rankedCategories.has(p.category))
    fail(`${where}: category "${p.category}" is not in the strategy ranking`);

  if (typeof p.isProperName !== 'boolean') fail(`${where}: isProperName must be boolean`);
  else if (p.isProperName) properCount++;

  if (!Number.isInteger(p.difficulty) || p.difficulty < 1 || p.difficulty > 5)
    fail(`${where}: difficulty ${p.difficulty} out of range 1-5`);

  // Bonus eligibility must actually be RSTLNE-sparse, or the bonus drills
  // train the wrong reflex.
  const letters = p.answer.replace(/[^A-Z]/g, '');
  const density = [...letters].filter((c) => RSTLNE.has(c)).length / letters.length;
  if (typeof p.bonusEligible !== 'boolean') fail(`${where}: bonusEligible must be boolean`);
  else if (p.bonusEligible) {
    bonusCount++;
    if (density >= 0.35)
      fail(`${where}: bonusEligible but RSTLNE density is ${(density * 100).toFixed(0)}%`);
    const words = p.answer.split(' ').length;
    if (words < 2 || words > 4) fail(`${where}: bonusEligible but has ${words} word(s)`);
    if (letters.length < 9 || letters.length > 20)
      fail(`${where}: bonusEligible but has ${letters.length} letters`);
  }
  if (Math.abs(p.rstlneDensity - Math.round(density * 1000) / 1000) > 1e-9)
    fail(`${where}: stored rstlneDensity ${p.rstlneDensity} != computed ${density.toFixed(3)}`);

  const hookType = STRUCTURAL[p.category];
  if (hookType) {
    if (!p.structuralHook) fail(`${where}: ${p.category} requires a structuralHook`);
    else if (p.structuralHook.type !== hookType)
      fail(`${where}: hook type ${p.structuralHook.type}, expected ${hookType}`);
    else if (!p.structuralHook.value) fail(`${where}: structuralHook has no value`);
    else if (p.category !== 'RHYME TIME' && !p.answer.includes(p.structuralHook.value))
      fail(`${where}: hook "${p.structuralHook.value}" does not appear in the answer`);
  } else if (p.structuralHook !== null) {
    fail(`${where}: non-structural category must have structuralHook: null`);
  }
}

// Same Name boards must actually show the shared word twice -- that is the
// whole reason the letter-set override targets it.
for (const p of bank) {
  if (p.category !== 'SAME NAME') continue;
  const v = p.structuralHook?.value;
  if (!v) continue;
  const hits = p.answer.split(v).length - 1;
  if (hits < 2) fail(`${p.id} ${p.answer}: shared word "${v}" appears ${hits}x, expected 2`);
}

const properPct = (100 * properCount) / bank.length;
if (properPct < 50 || properPct > 62)
  warn(`proper-name share is ${properPct.toFixed(1)}%, target is ~55%`);
if (bonusCount < 60) fail(`only ${bonusCount} bonus-eligible puzzles, need at least 60`);

// --- Play-mode wheel --------------------------------------------------------
// The drills teach "2 Bankrupt + 1 Lose-a-Turn out of 24" and a $700 average
// wedge. If the wheel she actually spins in Play mode drifted from that, the
// app would teach one game and let her play a different one.
{
  const bankrupts = WHEEL.filter((w) => w === BANKRUPT).length;
  const loseTurns = WHEEL.filter((w) => w === LOSE_A_TURN).length;
  const cash = wheelCashWedges();

  if (WHEEL.length !== 24) fail(`wheel has ${WHEEL.length} wedges, expected 24`);
  if (bankrupts !== 2) fail(`wheel has ${bankrupts} Bankrupt wedges, expected 2`);
  if (loseTurns !== 1) fail(`wheel has ${loseTurns} Lose-a-Turn wedges, expected 1`);
  if (cash.length !== 21) fail(`wheel has ${cash.length} cash wedges, expected 21`);

  const avg = cash.reduce((a, b) => a + b, 0) / cash.length;
  if (Math.abs(avg - WEDGE_AVERAGE) > WEDGE_AVERAGE * 0.05) {
    fail(`wheel average wedge is $${avg.toFixed(0)}, but the drills teach $${WEDGE_AVERAGE}`);
  }
  for (const w of cash) {
    if (!Number.isInteger(w) || w <= 0) fail(`wheel has an invalid cash wedge: ${w}`);
  }
  // Two Bankrupts side by side would make a whole arc of the wheel dead.
  for (let i = 0; i < WHEEL.length; i++) {
    if (WHEEL[i] === BANKRUPT && WHEEL[(i + 1) % WHEEL.length] === BANKRUPT) {
      fail('the two Bankrupt wedges are adjacent on the wheel');
    }
  }
}

// --- Coach tips -------------------------------------------------------------
// Play mode coaches with the same words the drills do. A tip that invented its
// own phrasing for a rule would be a second rulebook she has to reconcile, so
// every tip either points at a REFLEX or carries its own complete text.
{
  const seen = new Set();
  const stubCtx = {
    event: 'turn', mode: 'game', pot: 3200, coverage: 0.5, isProperName: false,
    category: 'PHRASE', spins: 3, vowelsBought: 1, roundsPlayed: 4, opponent: 'RITA',
  };
  for (const t of TIPS) {
    const where = `tip "${t.id}"`;
    if (!t.id) fail('a tip has no id');
    else if (seen.has(t.id)) fail(`${where}: duplicate id`);
    seen.add(t.id);

    if (t.reflex && !REFLEXES[t.reflex]) fail(`${where}: unknown reflex "${t.reflex}"`);
    if (t.when != null && typeof t.when !== 'function') fail(`${where}: when is not a function`);
    if (!Array.isArray(t.on) || !t.on.length) fail(`${where}: has no "on" events`);
    else for (const ev of t.on) {
      if (!TIP_EVENTS.includes(ev)) fail(`${where}: listens for unknown event "${ev}"`);
    }

    const { cue, why } = resolveTip(t, stubCtx);
    if (!cue) fail(`${where}: resolves to no cue`);
    if (!why) fail(`${where}: resolves to no why`);
    // The chip is one line on a phone. A long cue wraps to three and stops
    // being glanceable, which is the only thing it is for.
    if (cue && cue.length > 62) fail(`${where}: cue is ${cue.length} chars, max 62`);
    if (why && why.length > 260) fail(`${where}: why is ${why.length} chars, max 260`);

    try { t.when?.(stubCtx); } catch (e) { fail(`${where}: when() threw on a normal context (${e.message})`); }
  }
  if (!TIPS.some((t) => t.reflex)) fail('no coach tip is anchored to a REFLEX');

  // Both directions must hold, or a tip silently never fires:
  //   - every event a tip listens for is actually emitted by a Play screen
  //   - every declared event has at least one tip, or it is dead weight
  const playSrc = ['js/game.js', 'js/play.js']
    .map((f) => readFileSync(resolve(ROOT, f), 'utf8')).join('\n');
  for (const ev of TIP_EVENTS) {
    if (!playSrc.includes(`ctx('${ev}'`)) fail(`tip event "${ev}" is never emitted by Play mode`);
    if (!TIPS.some((t) => t.on?.includes(ev))) warn(`tip event "${ev}" has no tip listening for it`);
  }
}

// --- Play-mode opponents ----------------------------------------------------
// The opponents must be beatable and must not cheat. Both are checked by
// simulation rather than by reading the constants, because the thing that
// matters is the behaviour that actually reaches the screen.
{
  if (OPPONENTS.length !== 2) fail(`expected 2 opponents, found ${OPPONENTS.length}`);
  for (const o of OPPONENTS) {
    if (!o.name || !o.blurb || !o.tell) fail(`opponent "${o.id}" is missing name/blurb/tell`);
    if (!(o.solveAt > 0.2 && o.solveAt < 1)) fail(`opponent "${o.id}" solveAt ${o.solveAt} out of range`);
    if (!(o.nerve > 0 && o.nerve <= 1)) fail(`opponent "${o.id}" nerve ${o.nerve} out of range`);
  }
  // The two of them exist to demonstrate opposite lessons. If they converge,
  // the game stops teaching anything.
  if (Math.abs(OPPONENTS[0].solveAt - OPPONENTS[1].solveAt) < 0.15)
    fail('the two opponents solve at nearly the same board coverage — they teach nothing apart');

  const answer = 'LET THE CAT OUT OF THE BAG';
  for (const o of OPPONENTS) {
    let solves = 0;
    let turnsWithLetters = 0;
    for (let i = 0; i < 400; i++) {
      const { events, solved } = planOpponentTurn(o, {
        answer, revealed: new Set(), called: new Set(), pot: 0,
      });
      if (solved) solves++;
      if (events.some((e) => e.type === 'call')) turnsWithLetters++;
      // No opponent may call the same letter twice in one turn, and none may
      // act after its turn has already ended.
      const called = new Set();
      let ended = false;
      for (const e of events) {
        if (ended) { fail(`opponent "${o.id}" keeps acting after its turn ended`); break; }
        if (e.type === 'call' || e.type === 'vowel') {
          if (called.has(e.letter)) { fail(`opponent "${o.id}" called ${e.letter} twice in one turn`); break; }
          called.add(e.letter);
          if (!e.count) ended = true;
        }
        if (e.type === 'bankrupt' || e.type === 'lose') ended = true;
        if (e.type === 'solve') ended = true;
      }
    }
    const rate = solves / 400;
    if (rate > 0.7) fail(`opponent "${o.id}" solves ${(rate * 100).toFixed(0)}% of turns from an empty board — unbeatable`);
    if (turnsWithLetters < 200) fail(`opponent "${o.id}" rarely calls a letter — its turns will be dull to watch`);
  }
  // Dean should out-solve Rita from an empty board; that gap IS the lesson.
  const rateOf = (o) => {
    let n = 0;
    for (let i = 0; i < 600; i++) {
      if (planOpponentTurn(o, { answer, revealed: new Set(), called: new Set(), pot: 0 }).solved) n++;
    }
    return n / 600;
  };
  if (rateOf(OPPONENTS[1]) <= rateOf(OPPONENTS[0]))
    fail('the early solver does not actually beat the grinder — the game teaches the wrong lesson');
}

// --- Vowel drill: every board must have a right answer ----------------------
// This shipped broken. On a proper name, buying with the reason "I already know
// the answer" scored as milking (mistake 1) and passing on the vowel scored as
// mistake 5, so a puzzle she had already solved had no correct answer at all --
// the drill marked her wrong for being right. A drill that cannot be answered
// correctly teaches her to distrust the feedback, so it is now a build failure.
{
  for (const isProperName of [false, true]) {
    const outcomes = [
      scoreVowel({ isProperName, choice: 'KNOW', hadIt: true }),
      scoreVowel({ isProperName, choice: 'NONE', revealed: [] }),
      ...VOWEL_REASONS.map((rs) =>
        scoreVowel({ isProperName, choice: 'BUY', vowel: 'A', reasonId: rs.id, revealed: [] })),
    ];
    if (!outcomes.some((o) => o.correct))
      fail(`vowel drill has no correct answer available when isProperName=${isProperName}`);
    for (const o of outcomes) {
      if (!o.headline) fail(`vowel drill: an outcome has no headline (isProperName=${isProperName})`);
      if (!o.correct && !o.errorTag) fail(`vowel drill: a wrong outcome carries no mistake tag`);
    }
  }

  // The specific trap, pinned.
  if (!scoreVowel({ isProperName: true, choice: 'KNOW', hadIt: true }).correct)
    fail('vowel drill: knowing the answer on a name must not score as wrong');
  if (scoreVowel({ isProperName: true, choice: 'KNOW', hadIt: false }).correct)
    fail('vowel drill: an unverified claim to know it must not score as correct');
  if (scoreVowel({ isProperName: true, choice: 'BUY', vowel: 'A', reasonId: 'known', revealed: [] }).correct)
    fail('vowel drill: buying a vowel on a puzzle you have already solved is milking');
}

// --- revealedFraction -------------------------------------------------------
{
  if (revealedFraction('CAT', new Set()) !== 0) fail('revealedFraction: empty set should be 0');
  if (revealedFraction('CAT', new Set(['C', 'A', 'T'])) !== 1) fail('revealedFraction: full set should be 1');
  if (Math.abs(revealedFraction('A B', new Set(['A'])) - 0.5) > 1e-9)
    fail('revealedFraction: spaces must not count as letter slots');
  if (revealedFraction("DON'T", new Set(['D', 'O', 'N', 'T'])) !== 1)
    fail('revealedFraction: apostrophes must not count as letter slots');
}

// --- Name tables ------------------------------------------------------------
// Same principle as the boards: a name filed under the wrong length would show
// her a shape that cannot hold it.
const namesPath = resolve(ROOT, 'data/names.json');
if (existsSync(namesPath)) {
  const names = JSON.parse(readFileSync(namesPath, 'utf8'));
  let nameCount = 0;
  for (const [group, buckets] of Object.entries(names)) {
    for (const [len, list] of Object.entries(buckets)) {
      if (!list.length) fail(`names: ${group} length ${len} is empty`);
      for (const n of list) {
        nameCount++;
        if (n.length !== Number(len))
          fail(`names: "${n}" is ${n.length} letters but filed under ${group} length ${len}`);
        if (!/^[A-Z]+$/.test(n)) fail(`names: "${n}" has illegal characters`);
      }
      if (new Set(list).size !== list.length) fail(`names: ${group} length ${len} has duplicates`);
    }
  }
  if (nameCount < 200) fail(`only ${nameCount} names in the recall tables`);
}

// --- Session length ---------------------------------------------------------
// Acceptance criterion: a complete daily session runs 10-15 minutes. Round
// counts drift easily, so the plan is measured rather than trusted.
//   [forced, active, read] seconds per round: clock time she cannot skip,
//   deciding and speaking, and absorbing the feedback card.
const ROUND_COST = {
  'solve-or-spin':  [0,  6,  9], 'vowel':          [0,  9,  7],
  'vowel-names':    [0,  9,  7], 'bonus-category': [2,  1,  6],
  'bonus-letters':  [0, 11,  8], 'bonus-sim':      [10, 16, 10],
  'toss-up':        [6,  3,  5], 'name-shape':     [15,  2, 10],
  'sound-it-out':   [0, 12,  5], 'attention-loop': [26,  6,  8],
  'say-it-exactly': [0, 11,  2], 'cheat-recital':  [0,  5,  3],
  'full-game-sim':  [4,  8,  7],
};
const BLOCK_OVERHEAD = 13; // tip card + block summary

if (DAYS.length !== 7) fail(`lesson plan has ${DAYS.length} days, expected 7`);
for (const day of DAYS) {
  if (day.blocks.length < 3 || day.blocks.length > 6)
    fail(`day ${day.n} has ${day.blocks.length} blocks, expected 4-6`);

  let seconds = BLOCK_OVERHEAD * day.blocks.length;
  for (const b of day.blocks) {
    const cost = ROUND_COST[b.drill.id];
    if (!cost) {
      fail(`day ${day.n}: no session-length model for drill "${b.drill.id}"`);
      continue;
    }
    const blockSeconds = cost.reduce((a, c) => a + c, 0) * b.rounds + BLOCK_OVERHEAD;
    if (blockSeconds > 260)
      warn(`day ${day.n} block "${b.drill.id}" runs ${(blockSeconds / 60).toFixed(1)} min, over the 4-minute block target`);
    seconds += cost.reduce((a, c) => a + c, 0) * b.rounds;
    if (!b.drill.tip?.rule) fail(`drill "${b.drill.id}" has no tip card`);
    if (typeof b.drill.round !== 'function') fail(`drill "${b.drill.id}" has no round()`);
  }

  const minutes = seconds / 60;
  if (minutes < 10 || minutes > 15)
    fail(`day ${day.n} session is ${minutes.toFixed(1)} min, outside the 10-15 minute band`);
  if (Math.abs(minutes - day.minutes) > 1.5)
    fail(`day ${day.n} advertises ${day.minutes} min but models at ${minutes.toFixed(1)} min`);
}

// --- Service worker precache must cover every shipped file ------------------
const swPath = resolve(ROOT, 'sw.js');
if (existsSync(swPath)) {
  const sw = readFileSync(swPath, 'utf8');
  const listed = new Set(
    [...sw.matchAll(/'(\.\/[^']+)'/g)].map((m) => m[1].replace(/^\.\//, ''))
  );
  const shipped = [];
  const walk = (dir) => {
    for (const entry of readdirSync(join(ROOT, dir))) {
      const rel = dir ? `${dir}/${entry}` : entry;
      if (entry.startsWith('.') || ['tools', 'node_modules'].includes(rel)) continue;
      if (statSync(join(ROOT, rel)).isDirectory()) walk(rel);
      else if (/\.(js|css|json|webmanifest|png|html)$/.test(entry)) shipped.push(rel);
    }
  };
  walk('');
  for (const f of shipped) {
    if (f === 'sw.js') continue;
    if (!listed.has(f)) fail(`sw.js precache is missing ${f} -- it will not work offline`);
  }
  for (const f of listed) {
    if (f !== './' && f !== '' && !existsSync(join(ROOT, f)))
      fail(`sw.js precaches ${f}, which does not exist`);
  }
}

// --- Report -----------------------------------------------------------------
for (const w of warnings) console.warn(`WARN: ${w}`);
if (errors.length) {
  console.error(`\n${errors.length} error(s):\n`);
  for (const e of errors.slice(0, 40)) console.error(`  FAIL: ${e}`);
  if (errors.length > 40) console.error(`  ... and ${errors.length - 40} more`);
  process.exit(1);
}
console.log(
  `OK  ${bank.length} puzzles, ${properCount} proper-name (${properPct.toFixed(1)}%), ` +
    `${bonusCount} bonus-eligible. All boards match their answers.`
);

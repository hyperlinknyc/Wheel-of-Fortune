#!/usr/bin/env node
// Fails the build if anything in the shipped bank is wrong.
//
// The headline check is wordLengths vs answer. A single mismatched board
// destroys trust in every other board in the app, so this exits non-zero and
// prints the offending row rather than warning.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BONUS_RANKING, BONUS_LETTER_SETS, FREE_LETTERS } from '../js/strategy.js';
import { DAYS } from '../js/lessons.js';

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

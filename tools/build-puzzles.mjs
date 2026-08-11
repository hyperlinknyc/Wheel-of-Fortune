#!/usr/bin/env node
// Builds data/puzzles.json from tools/puzzle-source.mjs.
//
// wordLengths is COMPUTED, never hand-written. A board can therefore not
// disagree with its answer by construction; validate.mjs re-checks it anyway
// so that a hand edit to the JSON is caught before it ever reaches a phone.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCE, HOOKS, NAME_BEARING_CATEGORIES } from './puzzle-source.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const RSTLNE = new Set(['R', 'S', 'T', 'L', 'N', 'E']);
export const ALLOWED_CHARS = /^[A-Z' &-]+$/;

// Answers in categories that are not themselves name-bearing but which still
// contain a proper noun. Explicit beats clever here -- a heuristic that gets
// this wrong teaches the wrong reflex.
const PROPER_NAME_EXCEPTIONS = new Set([
  'LUCILLE BALL GAME',
  'BETTY WHITE HOUSE',
  'DOUBLE DUTCH OVEN',
  'FRENCH TOAST & FRENCH BRAID',
  'FRENCH BREAD BASKET',
  'SUNDAY SCHOOL BUS',
]);

export const HOOK_TYPE = {
  'SAME NAME': 'shared',
  'BEFORE & AFTER': 'pivot',
  'RHYME TIME': 'rhyme',
};

export function wordLengthsOf(answer) {
  return answer.split(' ').map((w) => w.length);
}

export function lettersOf(answer) {
  return answer.replace(/[^A-Z]/g, '');
}

export function rstlneDensity(answer) {
  const letters = lettersOf(answer);
  if (!letters.length) return 0;
  let hit = 0;
  for (const ch of letters) if (RSTLNE.has(ch)) hit++;
  return hit / letters.length;
}

// Producers build bonus puzzles to defeat RSTLNE. A bonus bank that is
// RSTLNE-rich trains exactly the wrong reflex, so the filter is strict.
export function isBonusEligible(category, answer) {
  const words = answer.split(' ');
  const letters = lettersOf(answer);
  if (words.length < 2 || words.length > 4) return false;
  if (letters.length < 9 || letters.length > 20) return false;
  if (category === 'AUTHOR & TITLE' || category === 'STAR & ROLE') return false;
  return rstlneDensity(answer) < 0.35;
}

export function difficultyOf(category, answer, proper) {
  const letters = lettersOf(answer).length;
  let d = 1;
  if (letters > 12) d++;
  if (letters > 20) d++;
  if (proper) d++;
  if (rstlneDensity(answer) < 0.3) d++;
  return Math.max(1, Math.min(5, d));
}

export function buildBank() {
  const puzzles = [];
  let n = 0;
  for (const [category, answers] of Object.entries(SOURCE)) {
    for (const answer of answers) {
      const proper =
        NAME_BEARING_CATEGORIES.has(category) || PROPER_NAME_EXCEPTIONS.has(answer);
      const hookType = HOOK_TYPE[category];
      const hookValue = hookType ? HOOKS[category]?.[answer] : undefined;
      puzzles.push({
        id: 'p' + String(++n).padStart(3, '0'),
        category,
        answer,
        wordLengths: wordLengthsOf(answer),
        isProperName: proper,
        difficulty: difficultyOf(category, answer, proper),
        bonusEligible: isBonusEligible(category, answer),
        structuralHook: hookType ? { type: hookType, value: hookValue ?? null } : null,
        rstlneDensity: Math.round(rstlneDensity(answer) * 1000) / 1000,
      });
    }
  }
  return puzzles;
}

function main() {
  const puzzles = buildBank();
  mkdirSync(resolve(ROOT, 'data'), { recursive: true });
  writeFileSync(
    resolve(ROOT, 'data/puzzles.json'),
    JSON.stringify(puzzles, null, 0) + '\n'
  );

  const byCat = {};
  let proper = 0;
  let bonus = 0;
  for (const p of puzzles) {
    byCat[p.category] ??= { n: 0, bonus: 0 };
    byCat[p.category].n++;
    if (p.bonusEligible) byCat[p.category].bonus++, bonus++;
    if (p.isProperName) proper++;
  }
  console.log(`built ${puzzles.length} puzzles`);
  console.log(`  proper-name-bearing: ${proper} (${((100 * proper) / puzzles.length).toFixed(1)}%)`);
  console.log(`  bonus-eligible:      ${bonus}`);
  for (const [c, v] of Object.entries(byCat).sort()) {
    console.log(`    ${c.padEnd(22)} ${String(v.n).padStart(3)}  bonus:${String(v.bonus).padStart(3)}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();

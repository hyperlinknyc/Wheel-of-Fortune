// Puzzle bank loading and selection.
//
// Selection is weighted by the adaptive plan and avoids anything she has seen
// recently, so a 10-minute session never repeats a board.

import { planWeights, clusterOf, recentPuzzleIds } from './store.js';
import { BONUS_RANKING, categoryTier } from './strategy.js';

let BANK = [];
let byCategory = new Map();

export async function loadBank() {
  if (BANK.length) return BANK;
  const res = await fetch('data/puzzles.json', { cache: 'force-cache' });
  if (!res.ok) throw new Error('Could not load the puzzle bank (' + res.status + ')');
  BANK = await res.json();
  byCategory = new Map();
  for (const p of BANK) {
    if (!byCategory.has(p.category)) byCategory.set(p.category, []);
    byCategory.get(p.category).push(p);
  }
  return BANK;
}

export const bank = () => BANK;
export const categories = () => [...byCategory.keys()];
export const byId = (id) => BANK.find((p) => p.id === id);

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function matches(p, f) {
  if (f.bonusEligible != null && p.bonusEligible !== f.bonusEligible) return false;
  if (f.isProperName != null && p.isProperName !== f.isProperName) return false;
  if (f.categories && !f.categories.includes(p.category)) return false;
  if (f.clusters && !f.clusters.includes(clusterOf(p.category))) return false;
  if (f.minWords && p.wordLengths.length < f.minWords) return false;
  if (f.maxWords && p.wordLengths.length > f.maxWords) return false;
  if (f.hasHook && !p.structuralHook) return false;
  return true;
}

/**
 * Weighted pick. Cluster weights come from the adaptive plan, so the mix
 * drifts toward whatever she is currently missing.
 */
export function pick(filter = {}) {
  const recent = recentPuzzleIds();
  let pool = BANK.filter((p) => matches(p, filter));
  // A filter that matches nothing must still hand back a board. An empty
  // screen mid-drill is worse than a slightly off-spec puzzle.
  if (!pool.length) pool = BANK.filter((p) => matches(p, { isProperName: filter.isProperName }));
  if (!pool.length) pool = BANK;

  const fresh = pool.filter((p) => !recent.has(p.id));
  if (fresh.length >= 4) pool = fresh;

  if (filter.unweighted) return rand(pool);

  const w = planWeights();
  let total = 0;
  const weighted = pool.map((p) => {
    const weight = w[clusterOf(p.category)] ?? 0.1;
    total += weight;
    return { p, acc: total };
  });
  const target = Math.random() * total;
  return (weighted.find((x) => x.acc >= target) ?? weighted[weighted.length - 1]).p;
}

export function pickMany(n, filter = {}) {
  const out = [];
  const used = new Set();
  for (let i = 0; i < n * 12 && out.length < n; i++) {
    const p = pick(filter);
    if (!p) break;
    if (used.has(p.id)) continue;
    used.add(p.id);
    out.push(p);
  }
  return out;
}

/**
 * Three category strips for the bonus-category drill.
 *
 * The mix is deliberately biased so the absolute rule keeps getting tested:
 * most trials put two name categories against one clean take. All three are
 * never on the avoid list, which keeps Category Discipline % meaningful.
 */
export function pickCategoryTriple() {
  const take = shuffle(BONUS_RANKING.TAKE);
  const tolerate = shuffle(BONUS_RANKING.TOLERATE);
  const avoid = shuffle(BONUS_RANKING.AVOID);
  const roll = Math.random();

  let picked;
  if (roll < 0.55) picked = [avoid[0], avoid[1], take[0]];              // the real test
  else if (roll < 0.75) picked = [avoid[0], take[0], take[1]];          // ordering within take
  else if (roll < 0.9) picked = [avoid[0], tolerate[0], take[0]];       // tolerate vs take
  else picked = [take[0], take[1], tolerate[0]];                        // pure ordering

  return shuffle(picked);
}

/** Categories that make sense to drill letter sets on. */
export function pickBonusCategory({ takeOnly = false } = {}) {
  const pool = takeOnly
    ? BONUS_RANKING.TAKE
    : [...BONUS_RANKING.TAKE, ...BONUS_RANKING.TOLERATE, ...BONUS_RANKING.AVOID];
  return rand(pool);
}

/**
 * A bonus board. Prefers a puzzle in the given category, but every bonus
 * puzzle in the bank is already RSTLNE-sparse so any fallback is still honest.
 */
export function pickBonusPuzzle(category) {
  const inCat = (byCategory.get(category) ?? []).filter((p) => p.bonusEligible);
  if (inCat.length) {
    const recent = recentPuzzleIds();
    const fresh = inCat.filter((p) => !recent.has(p.id));
    return rand(fresh.length ? fresh : inCat);
  }
  return pick({ bonusEligible: true, unweighted: true });
}

export const tierOf = categoryTier;

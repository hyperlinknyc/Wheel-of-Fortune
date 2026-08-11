// localStorage persistence, streak, stats and the adaptive engine.
// No accounts, no network. Everything here survives a full app close.

const KEY = 'wheeltrainer.v1';
const MAX_RESULTS = 3000;

export const CLUSTERS = {
  NAME_PLACE:  ['ON THE MAP', 'PLACE', 'LANDMARK'],
  NAME_PERSON: ['PERSON', 'PROPER NAME', 'FICTIONAL CHARACTER', 'STAR & ROLE'],
  NAME_TITLE:  ['TITLE', 'SHOW BIZ', 'SONG / ARTIST', 'AUTHOR & TITLE'],
  WORDPLAY:    ['SAME NAME', 'BEFORE & AFTER', 'RHYME TIME', 'SAME LETTER'],
  EVERYDAY:    ['PHRASE', 'THING', 'AROUND THE HOUSE', 'FOOD & DRINK',
                'WHAT ARE YOU DOING?', 'LIVING THING', 'OCCUPATION',
                'FUN & GAMES', 'EVENT', 'QUOTATION'],
};

export const CLUSTER_LABEL = {
  NAME_PLACE: 'places and maps',
  NAME_PERSON: 'people and characters',
  NAME_TITLE: 'titles, shows and songs',
  WORDPLAY: 'structure puzzles',
  EVERYDAY: 'everyday categories',
};

const CAT_TO_CLUSTER = {};
for (const [c, cats] of Object.entries(CLUSTERS)) for (const cat of cats) CAT_TO_CLUSTER[cat] = c;
export const clusterOf = (category) => CAT_TO_CLUSTER[category] ?? 'EVERYDAY';

export const NAME_CLUSTERS = ['NAME_PLACE', 'NAME_PERSON', 'NAME_TITLE'];
export const PROPER_NAME_BASELINE = 0.55; // the gap, held regardless of performance
const RECOMPUTE_EVERY = 10;

export const todayKey = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function defaultTapeDate() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return todayKey(d);
}

function blank() {
  return {
    version: 1,
    tapeDate: defaultTapeDate(),
    createdAt: Date.now(),
    results: [],
    days: {},
    streak: { current: 0, longest: 0, lastDay: null },
    lessons: {},
    plan: { weights: null, lastRecomputeCount: 0, card: null, history: [] },
    recent: [],
    settings: { mic: false },
  };
}

let state = blank();
let saveTimer = null;

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 1) state = { ...blank(), ...parsed };
    }
  } catch {
    // Corrupt or unavailable storage must never stop her from practising.
    state = blank();
  }
  return state;
}

export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 250);
}

export function flush() {
  clearTimeout(saveTimer);
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Quota or private mode. Drop the oldest half and try once more.
    state.results = state.results.slice(-Math.floor(MAX_RESULTS / 2));
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* give up quietly */ }
  }
}

export const get = () => state;
export const settings = () => state.settings;

export function setTapeDate(iso) {
  state.tapeDate = iso;
  save();
}

export function daysUntilTaping() {
  const [y, m, d] = state.tapeDate.split('-').map(Number);
  const tape = new Date(y, m - 1, d);
  const now = new Date();
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((tape - a) / 86400000);
}

// ---------------------------------------------------------------------------
// Results log
// ---------------------------------------------------------------------------

/** @param r {drillType, correct, latencyMs, errorTag, category, isProperName, ...} */
export function logResult(r) {
  const rec = {
    ts: Date.now(),
    drillType: r.drillType,
    correct: !!r.correct,
    latencyMs: Number.isFinite(r.latencyMs) ? Math.round(r.latencyMs) : null,
    errorTag: r.errorTag ?? null,
    category: r.category ?? null,
    isProperName: !!r.isProperName,
    meta: r.meta ?? null,
  };
  state.results.push(rec);
  if (state.results.length > MAX_RESULTS) state.results = state.results.slice(-MAX_RESULTS);

  const day = (state.days[todayKey()] ??= { drills: 0, ms: 0, blocks: [] });
  day.drills++;
  touchStreak();

  if (r.puzzleId) {
    state.recent.push(r.puzzleId);
    if (state.recent.length > 120) state.recent = state.recent.slice(-120);
  }

  maybeRecomputePlan();
  save();
  return rec;
}

export function markBlockComplete(dayNumber, blockId, elapsedMs = 0) {
  const l = (state.lessons[dayNumber] ??= { blocks: {}, done: false });
  l.blocks[blockId] = true;
  const day = (state.days[todayKey()] ??= { drills: 0, ms: 0, blocks: [] });
  day.ms += elapsedMs;
  if (!day.blocks.includes(`${dayNumber}:${blockId}`)) day.blocks.push(`${dayNumber}:${blockId}`);
  touchStreak();
  save();
}

export function markDayComplete(dayNumber) {
  const l = (state.lessons[dayNumber] ??= { blocks: {}, done: false });
  l.done = true;
  save();
}

export const isDayComplete = (n) => !!state.lessons[n]?.done;
export const isBlockComplete = (n, id) => !!state.lessons[n]?.blocks?.[id];

export function highestUnlockedDay() {
  for (let d = 1; d <= 7; d++) if (!isDayComplete(d)) return d;
  return 7;
}

// ---------------------------------------------------------------------------
// Streak -- days, not sessions. Never punishes; a missed day just resets to 1.
// ---------------------------------------------------------------------------

function touchStreak() {
  const t = todayKey();
  const s = state.streak;
  if (s.lastDay === t) return;
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  s.current = s.lastDay === todayKey(yest) ? s.current + 1 : 1;
  s.lastDay = t;
  s.longest = Math.max(s.longest, s.current);
}

/** A streak stays alive through today even if she has not practised yet. */
export function streakDisplay() {
  const s = state.streak;
  if (!s.lastDay) return 0;
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  if (s.lastDay === todayKey() || s.lastDay === todayKey(yest)) return s.current;
  return 0;
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

const pct = (n, d) => (d ? n / d : null);

export function stats() {
  const R = state.results;
  const cat = R.filter((r) => r.drillType === 'bonus-category' && r.meta?.countsForDiscipline);
  const held = cat.filter((r) => r.meta.disciplineHeld).length;

  const solve = R.filter((r) => r.drillType === 'solve-or-spin');
  const nameish = R.filter(
    (r) => r.isProperName && ['solve-or-spin', 'vowel', 'name-shape', 'sound-it-out'].includes(r.drillType)
  );

  const buzz = R.filter((r) => r.drillType === 'toss-up');
  const buzzed = buzz.filter((r) => r.meta?.buzzed);

  const loops = R.filter((r) => r.drillType === 'attention-loop');

  return {
    categoryDiscipline: pct(held, cat.length),
    categoryDisciplineN: cat.length,
    solveTiming: pct(solve.filter((r) => r.correct).length, solve.length),
    solveTimingN: solve.length,
    nameRecall: pct(nameish.filter((r) => r.correct).length, nameish.length),
    nameRecallN: nameish.length,
    buzzRate: pct(buzzed.length, buzz.length),
    conversion: pct(buzzed.filter((r) => r.correct).length, buzzed.length),
    tossUpN: buzz.length,
    loopCompletion: pct(loops.filter((r) => r.correct).length, loops.length),
    loopN: loops.length,
    totalDrills: R.length,
    today: state.days[todayKey()]?.drills ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Adaptive engine
//
// Every 10 logged puzzles, recompute a weakness vector across
// (category cluster x error tag) and reweight the mix toward the worst two.
// Proper names stay at 55% of the mix no matter what the numbers say.
// ---------------------------------------------------------------------------

export function weaknessVector(window = 60) {
  const recent = state.results.slice(-window);
  const cells = {};
  const clusterTotals = {};
  for (const r of recent) {
    if (!r.category) continue;
    const c = clusterOf(r.category);
    clusterTotals[c] ??= { n: 0, wrong: 0 };
    clusterTotals[c].n++;
    if (!r.correct) {
      clusterTotals[c].wrong++;
      const tag = r.errorTag ?? 0;
      const k = `${c}|${tag}`;
      cells[k] ??= { cluster: c, errorTag: tag, count: 0 };
      cells[k].count++;
    }
  }
  const ranked = Object.values(cells).sort((a, b) => b.count - a.count);
  return { cells: ranked, clusterTotals };
}

function baseWeights() {
  const nameShare = PROPER_NAME_BASELINE / NAME_CLUSTERS.length;
  const others = Object.keys(CLUSTERS).filter((c) => !NAME_CLUSTERS.includes(c));
  const otherShare = (1 - PROPER_NAME_BASELINE) / others.length;
  const w = {};
  for (const c of NAME_CLUSTERS) w[c] = nameShare;
  for (const c of others) w[c] = otherShare;
  return w;
}

function maybeRecomputePlan() {
  const n = state.results.length;
  if (n - state.plan.lastRecomputeCount < RECOMPUTE_EVERY) return;
  state.plan.lastRecomputeCount = n;

  const { cells, clusterTotals } = weaknessVector();
  const worst = [];
  for (const cell of cells) {
    if (worst.some((w) => w.cluster === cell.cluster)) continue;
    worst.push(cell);
    if (worst.length === 2) break;
  }
  if (!worst.length) return;

  const w = baseWeights();
  const BOOST = 0.18;
  let taken = 0;
  for (const cell of worst) {
    w[cell.cluster] += BOOST;
    taken += BOOST;
  }
  const donors = Object.keys(w).filter((c) => !worst.some((x) => x.cluster === c));
  const donorTotal = donors.reduce((s, c) => s + w[c], 0);
  for (const c of donors) w[c] = Math.max(0.02, w[c] - taken * (w[c] / donorTotal));

  // Re-assert the proper-name floor after reweighting.
  const nameSum = NAME_CLUSTERS.reduce((s, c) => s + w[c], 0);
  if (nameSum < PROPER_NAME_BASELINE) {
    const need = PROPER_NAME_BASELINE - nameSum;
    for (const c of NAME_CLUSTERS) w[c] += need * (w[c] / nameSum);
    const rest = Object.keys(w).filter((c) => !NAME_CLUSTERS.includes(c));
    const restSum = rest.reduce((s, c) => s + w[c], 0);
    for (const c of rest) w[c] = Math.max(0.02, w[c] - need * (w[c] / restSum));
  }
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  for (const c of Object.keys(w)) w[c] /= total;

  state.plan.weights = w;
  state.plan.card = buildPlanCard(worst, clusterTotals, w);
  state.plan.history.push({ ts: Date.now(), card: state.plan.card });
  if (state.plan.history.length > 20) state.plan.history = state.plan.history.slice(-20);
}

function buildPlanCard(worst, clusterTotals, weights) {
  const lead = worst[0];
  const t = clusterTotals[lead.cluster] ?? { n: 0, wrong: 0 };
  const label = CLUSTER_LABEL[lead.cluster] ?? lead.cluster;
  const share = Math.round(weights[lead.cluster] * 100);
  const because =
    t.n > 0
      ? `You've missed ${t.wrong} of ${t.n} ${label} puzzles.`
      : `You're weakest on ${label}.`;
  const also =
    worst[1] && CLUSTER_LABEL[worst[1].cluster]
      ? ` ${CLUSTER_LABEL[worst[1].cluster][0].toUpperCase()}${CLUSTER_LABEL[worst[1].cluster].slice(1)} is next.`
      : '';
  return {
    ts: Date.now(),
    title: 'Your plan has been updated',
    because,
    change: `The upcoming mix now weights ${label} at ${share}%.${also}`,
    clusters: worst.map((w) => w.cluster),
    errorTag: lead.errorTag || null,
  };
}

export const planWeights = () => state.plan.weights ?? baseWeights();

export function takePlanCard() {
  const c = state.plan.card;
  state.plan.card = null;
  if (c) save();
  return c;
}

export const recentPuzzleIds = () => new Set(state.recent);

export function resetAll() {
  state = blank();
  flush();
}

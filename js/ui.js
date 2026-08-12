// DOM kernel: hyperscript, router, board renderer, timers, audio, feedback.

export const $ = (sel, root = document) => root.querySelector(sel);

/** Marker object understood by setScreen. */
export const screenOpts = (o) => ({ ...o, __screenOpts: true });

/** Minimal hyperscript. h('div', {class:'x'}, 'text', child) */
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat(9)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export const btn = (label, props = {}) => {
  const { sub, ...rest } = props;
  return h('button', { class: `btn ${rest.variant ?? ''}`.trim(), type: 'button', ...rest },
    sub ? h('span', {}, label, h('span', { class: 'sub' }, sub)) : label);
};

// ---------------------------------------------------------------------------
// Screen regions
// ---------------------------------------------------------------------------

const screenEl = () => $('#screen');
const actionsEl = () => $('#actions');

/** Pass { dense: true } to reclaim top padding on tall, grid-heavy screens. */
export function setScreen(...nodes) {
  const s = screenEl();
  const opts = (nodes.length && nodes[nodes.length - 1]?.__screenOpts) ? nodes.pop() : null;
  s.classList.toggle('dense', !!opts?.dense);
  s.replaceChildren(...nodes.flat(9).filter(Boolean));
  s.scrollTop = 0;
  s.classList.remove('fade');
  void s.offsetWidth;
  s.classList.add('fade');
  sizeAllBoards();
}

export function setActions(...nodes) {
  actionsEl().replaceChildren(...nodes.flat(9).filter(Boolean));
}

export function setTop({ title = 'WHEEL TRAINER', back = null, right = '' } = {}) {
  $('#topTitle').textContent = title;
  $('#topRight').textContent = right;
  const b = $('#backBtn');
  b.hidden = !back;
  b.onclick = back || null;
}

// ---------------------------------------------------------------------------
// Puzzle board
// ---------------------------------------------------------------------------

const LETTER = /[A-Z]/;

/**
 * Renders a board as a real tile grid. Words never split across lines.
 * revealed: Set of uppercase letters, or the string 'ALL', or null.
 */
export function renderBoard(answer, revealed = null, { id = null } = {}) {
  const showAll = revealed === 'ALL';
  const set = showAll ? null : (revealed instanceof Set ? revealed : new Set(revealed ?? []));
  const board = h('div', { class: 'board', role: 'img', 'aria-label': boardLabel(answer, set, showAll) });
  if (id) board.id = id;

  let longest = 0;
  let idx = 0;
  for (const word of answer.split(' ')) {
    longest = Math.max(longest, word.length);
    const w = h('div', { class: 'word' });
    for (const ch of word) {
      if (!LETTER.test(ch)) {
        w.append(h('div', { class: 'tile punct' }, ch));
      } else {
        const lit = showAll || set.has(ch);
        // data-i lets the toss-up drill light individual tiles in a scattered
        // order, the way the real board fills in.
        w.append(h('div', { class: `tile${lit ? ' lit' : ''}`, dataset: { l: ch, i: String(idx++) } }, ch));
      }
    }
    board.append(w);
  }
  board.dataset.letters = String(idx);
  board.dataset.longest = String(longest);
  return h('div', { class: 'board-wrap' }, board);
}

function boardLabel(answer, set, showAll) {
  if (showAll) return `Puzzle: ${answer}`;
  const shown = answer
    .split('')
    .map((c) => (c === ' ' ? ' / ' : LETTER.test(c) ? (set.has(c) ? c : '_') : c))
    .join('');
  return `Puzzle board: ${shown}`;
}

/** Tiles are sized so the longest word fits, with a hard 24px font floor. */
export function sizeBoard(board) {
  const wrap = board.parentElement;
  const avail = Math.min((wrap?.clientWidth || screenEl().clientWidth || 340), 560);
  const longest = Number(board.dataset.longest || 8);
  const gap = longest >= 11 ? 2 : 4;
  const raw = Math.floor((avail - (longest - 1) * gap - 2) / longest);
  const tile = Math.max(21, Math.min(46, raw));
  board.style.setProperty('--tile', tile + 'px');
  board.style.setProperty('--tile-font', Math.max(26, Math.round(tile * 1.04)) + 'px');
  board.style.gap = `6px ${Math.max(6, gap * 2)}px`;
  for (const w of board.querySelectorAll('.word')) w.style.gap = gap + 'px';
}

export function sizeAllBoards() {
  for (const b of document.querySelectorAll('.board')) sizeBoard(b);
}
// Guarded so the module can be imported by the build tools under Node.
if (typeof window !== 'undefined') {
  window.addEventListener('resize', sizeAllBoards);
  window.addEventListener('orientationchange', () => setTimeout(sizeAllBoards, 120));
}

/** Light up one letter across a board, with a short pop. */
export function revealLetter(boardWrap, letter) {
  let n = 0;
  for (const t of boardWrap.querySelectorAll(`.tile[data-l="${letter}"]`)) {
    if (t.classList.contains('lit')) continue;
    t.classList.add('lit', 'fresh');
    setTimeout(() => t.classList.remove('fresh'), 200);
    n++;
  }
  return n;
}

export function revealAll(boardWrap) {
  for (const t of boardWrap.querySelectorAll('.tile:not(.punct)')) t.classList.add('lit');
}

/** Light a single tile by index. Used by the toss-up cadence. */
export function revealTile(boardWrap, i) {
  const t = boardWrap.querySelector(`.tile[data-i="${i}"]`);
  if (!t || t.classList.contains('lit')) return false;
  t.classList.add('lit', 'fresh');
  setTimeout(() => t.classList.remove('fresh'), 200);
  return true;
}

/** Indices of every letter tile, shuffled -- the toss-up reveal order. */
export function tileOrder(boardWrap) {
  const idx = [...boardWrap.querySelectorAll('.tile[data-i]')].map((t) => Number(t.dataset.i));
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

// ---------------------------------------------------------------------------
// Timer
//
// Elapsed time is derived from absolute clocks every tick, never accumulated,
// so throttled frames and a dimmed or locked screen cannot make it drift.
// rAF drives the display; a 100ms interval guarantees completion fires even
// when rAF is throttled to a stop.
// ---------------------------------------------------------------------------

// Anything asynchronous a drill schedules is registered here so navigating
// away cannot let a dead round paint over the screen she is now looking at.
const pending = new Set();

export function cancelPending() {
  for (const p of [...pending]) {
    try { p.cancel(); } catch { /* already gone */ }
  }
  pending.clear();
  // Discipline interrupt is a live overlay, not a timer — clear it on every
  // navigation so a mid-drill abandon cannot leave a red sheet on home.
  hideInterrupt();
}

/** setTimeout that is cancelled automatically on navigation. */
export function after(ms, fn) {
  const handle = { cancel: () => clearTimeout(id) };
  const id = setTimeout(() => { pending.delete(handle); fn(); }, ms);
  pending.add(handle);
  return handle;
}

/** setInterval that is cancelled automatically on navigation. */
export function every(ms, fn) {
  const handle = { cancel: () => clearInterval(id) };
  const id = setInterval(fn, ms);
  pending.add(handle);
  return handle;
}

export class Timer {
  constructor({ duration, onTick, onDone }) {
    this.duration = duration;
    this.onTick = onTick;
    this.onDone = onDone;
    this.done = false;
    this._raf = null;
    this._iv = null;
    this._vis = () => this._tick();
  }

  start() {
    this.p0 = performance.now();
    this.d0 = Date.now();
    this._iv = setInterval(() => this._tick(), 100);
    document.addEventListener('visibilitychange', this._vis);
    this.cancel = () => this.stop();
    pending.add(this);
    this._loop();
    this._tick();
    return this;
  }

  elapsed() {
    // Max of the two clocks: if one is frozen by the OS, the other still runs,
    // and an over-estimate ends the drill rather than gifting extra seconds.
    return Math.max(performance.now() - this.p0, Date.now() - this.d0);
  }

  remaining() {
    return Math.max(0, this.duration - this.elapsed());
  }

  _loop() {
    this._raf = requestAnimationFrame(() => {
      if (this.done) return;
      this._tick();
      this._loop();
    });
  }

  _tick() {
    if (this.done) return;
    const rem = this.remaining();
    this.onTick?.(rem, this.duration);
    if (rem <= 0) {
      this.stop();
      this.onDone?.();
    }
  }

  stop() {
    if (this.done) return this;
    this.done = true;
    cancelAnimationFrame(this._raf);
    clearInterval(this._iv);
    document.removeEventListener('visibilitychange', this._vis);
    pending.delete(this);
    return this;
  }
}

/** Big numeric readout. Under 10s it shows tenths, because tenths hurt. */
export function timerDisplay({ huge = false } = {}) {
  const num = h('div', { class: `timer${huge ? ' huge' : ''}` }, '0.0');
  const bar = h('div', { class: 'timer-bar' }, h('i'));
  const fill = bar.firstChild;
  return {
    node: h('div', {}, num, bar),
    update(rem, total) {
      const s = rem / 1000;
      num.textContent = total <= 15000 ? s.toFixed(1) : Math.ceil(s).toString();
      const frac = total ? rem / total : 0;
      fill.style.width = (frac * 100).toFixed(2) + '%';
      const hot = s <= 3;
      num.classList.toggle('hot', hot);
      num.classList.toggle('warn', !hot && s <= total / 1000 / 2);
      bar.classList.toggle('hot', hot);
    },
  };
}

// ---------------------------------------------------------------------------
// Audio -- the timer is the only thing in this app that makes noise.
// ---------------------------------------------------------------------------

let actx = null;
export function primeAudio() {
  try {
    actx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  } catch { /* audio is a nicety, never a blocker */ }
}

function tone(freq, ms, gain = 0.16) {
  if (!actx || actx.state !== 'running') return;
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, actx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + ms / 1000);
  o.connect(g).connect(actx.destination);
  o.start();
  o.stop(actx.currentTime + ms / 1000);
}

export const tick = () => tone(880, 70, 0.10);
export const buzzer = () => { tone(196, 420, 0.22); setTimeout(() => tone(155, 460, 0.22), 90); };
export const ding = () => { tone(1046, 110, 0.14); setTimeout(() => tone(1568, 160, 0.12), 100); };

/** Fires tick() once per second over the last `from` seconds. */
export function attachCountdownAudio(timer, from = 3) {
  let last = Infinity;
  const orig = timer.onTick;
  timer.onTick = (rem, total) => {
    const s = Math.ceil(rem / 1000);
    if (s <= from && s < last && s > 0) tick();
    last = s;
    orig?.(rem, total);
  };
  return timer;
}

// ---------------------------------------------------------------------------
// Full-screen interrupt -- deliberately unmissable
// ---------------------------------------------------------------------------

export function hideInterrupt() {
  const box = typeof document !== 'undefined' ? document.getElementById('interrupt') : null;
  if (!box) return;
  box.hidden = true;
  box.replaceChildren();
}

export function showInterrupt({ kicker, title, body, button = 'I SEE IT', onClose }) {
  const box = $('#interrupt');
  box.replaceChildren(
    h('div', { class: 'k' }, kicker),
    h('h1', {}, title),
    ...[].concat(body).map((t) => h('p', {}, t)),
    btn(button, {
      onclick: () => {
        hideInterrupt();
        onClose?.();
      },
    })
  );
  box.hidden = false;
  buzzer();
}

// ---------------------------------------------------------------------------
// Reusable cards
// ---------------------------------------------------------------------------

export const card = (...kids) => h('div', { class: 'card' }, ...kids);

export function verdictCard({ good, headline, cue = null, why = null, lines = [], notes = [], tag = null }) {
  const missCue = cue || tag?.cue || null;
  const missWhy = why || tag?.why || null;
  return h('div', { class: `card ${good ? 'good' : 'bad'}` },
    h('div', { class: `verdict ${good ? 'good' : 'bad'}` }, headline),
    !good && missCue ? h('p', { class: 'cue' }, missCue) : null,
    !good && missWhy ? h('p', { class: 'why' }, missWhy) : null,
    ...notes.map((n) => h('p', { class: 'muted' }, n)),
    tag ? h('div', { class: 'chip-row', style: { marginTop: '10px' } },
      h('span', { class: 'pill tag' }, `Mistake #${tag.id}`),
      h('span', { class: 'muted', style: { fontSize: '15px' } }, tag.name)) : null,
    lines.length ? mathDisclosure(lines) : null
  );
}

export function mathBlock(lines) {
  return h('div', {}, ...lines.map((l) =>
    h('div', { class: `mathline${l.emphasis ? ' em' : ''}` },
      h('span', { class: 'l' }, l.label),
      h('span', { class: `v${l.emphasis ? (l.good ? ' good' : ' bad') : ''}` }, l.value))));
}

/** Math stays available; it is never the first thing she has to read. */
export function mathDisclosure(lines, label = 'Show the math') {
  if (!lines?.length) return null;
  return h('details', { class: 'math-disclosure' },
    h('summary', {}, label),
    mathBlock(lines));
}

/** Honest-mode self scoring. The measured action already happened. */
export function selfScore(prompt, onPick) {
  return [
    h('p', { class: 'center muted' }, prompt),
    h('div', { class: 'row' },
      btn('I HAD IT', { variant: 'good tall', onclick: () => onPick(true) }),
      btn("I DIDN'T", { variant: 'bad tall', onclick: () => onPick(false) })),
  ];
}

/**
 * Cue-first tip card.
 * Accepts { cue, why, example, math } or legacy { rule, example }.
 */
export function tipCard({ cue, why, rule, example, math } = {}, onDismiss) {
  const lead = cue || rule;
  const node = h('div', { class: 'card tip' },
    h('h3', {}, 'Today\'s reflex'),
    lead ? h('p', { class: 'cue' }, lead) : null,
    why ? h('p', { class: 'why' }, why) : null,
    example ? h('p', { class: 'muted' }, example) : null,
    math ? (typeof math === 'string'
      ? h('details', { class: 'math-disclosure' },
          h('summary', {}, 'Show the math'),
          h('p', { class: 'muted' }, math))
      : mathDisclosure(math)) : null,
    h('p', { class: 'muted tiny' }, 'Swipe away or tap Got it.')
  );
  let x0 = null;
  node.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  node.addEventListener('touchmove', (e) => {
    if (x0 == null) return;
    const dx = e.touches[0].clientX - x0;
    node.style.transform = `translateX(${dx}px)`;
    node.style.opacity = String(Math.max(0, 1 - Math.abs(dx) / 220));
  }, { passive: true });
  node.addEventListener('touchend', (e) => {
    const dx = (e.changedTouches[0].clientX - (x0 ?? 0));
    node.style.transform = '';
    node.style.opacity = '';
    x0 = null;
    if (Math.abs(dx) > 90) onDismiss();
  });
  return node;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const routes = [];
export const route = (pattern, handler) => routes.push({ parts: pattern.split('/'), handler });
export const go = (hash) => { window.location.hash = hash; };
export const back = () => window.history.back();

/** Highlight the bottom-nav item that owns the current screen. */
function syncNav(raw) {
  const section = (raw || 'home').split('/')[0] || 'home';
  const active = ({
    home: 'home', settings: 'home', days: 'home', day: 'home',
    practice: 'practice', drill: 'practice',
    cheat: 'cheat',
  })[section] || 'home';
  for (const b of document.querySelectorAll('.util[data-nav]')) {
    b.classList.toggle('accent', b.dataset.nav === active);
  }
}

export function startRouter(fallback = '#/home') {
  const resolve = () => {
    const raw = (window.location.hash || fallback).replace(/^#\/?/, '');
    syncNav(raw);
    const parts = raw.split('/');
    for (const r of routes) {
      if (r.parts.length !== parts.length) continue;
      const params = {};
      let ok = true;
      for (let i = 0; i < r.parts.length; i++) {
        if (r.parts[i].startsWith(':')) params[r.parts[i].slice(1)] = decodeURIComponent(parts[i]);
        else if (r.parts[i] !== parts[i]) { ok = false; break; }
      }
      if (ok) { cancelPending(); setActions(); r.handler(params); return; }
    }
    go(fallback);
  };
  window.addEventListener('hashchange', resolve);
  resolve();
}

/** Ring gauge for the home screen stats. */
export function ring(label, value, { suffix = '%' } = {}) {
  const pct = value == null ? 0 : Math.round(value * 100);
  const R = 38, C = 2 * Math.PI * R;
  const dash = value == null ? 0 : (pct / 100) * C;
  const color = value == null ? 'var(--line)'
    : pct >= 85 ? 'var(--good)' : pct >= 60 ? 'var(--accent)' : 'var(--bad)';
  const svg = `<svg viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="50" r="${R}" fill="none" stroke="var(--surface-2)" stroke-width="10"/>
    <circle cx="50" cy="50" r="${R}" fill="none" stroke="${color}" stroke-width="10"
      stroke-linecap="round" stroke-dasharray="${dash} ${C}" transform="rotate(-90 50 50)"/>
  </svg>`;
  return h('div', { class: 'ring' },
    h('div', { html: svg }),
    h('div', { class: 'rval' }, value == null ? '—' : pct + suffix),
    h('div', { class: 'rlabel' }, label));
}

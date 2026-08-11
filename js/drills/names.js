// Drill 7: NAME SHAPE RECALL   Drill 8: SOUND IT OUT   Drill 10: SAY IT EXACTLY
// The drills that attack "she blanks on people, places and titles".

import {
  h, btn, setScreen, setActions, renderBoard, revealAll, verdictCard,
  Timer, timerDisplay, selfScore, ding, buzzer,
} from '../ui.js';
import { pick } from '../data.js';
import { logResult } from '../store.js';
import { MISTAKES, tipFrom, REFLEXES } from '../strategy.js';

let NAMES = null;
async function names() {
  if (NAMES) return NAMES;
  const res = await fetch('data/names.json', { cache: 'force-cache' });
  NAMES = await res.json();
  return NAMES;
}

const rand = (a) => a[Math.floor(Math.random() * a.length)];

// ---------------------------------------------------------------------------
// Drill 7 -- NAME SHAPE RECALL
// ---------------------------------------------------------------------------

const RECALL_MS = 15000;

export const nameShape = {
  id: 'name-shape',
  title: 'NAME SHAPE RECALL',
  minutes: 3,
  tip: tipFrom(REFLEXES.soundNames, {
    example: 'Four letters, man\'s first name: JOHN, MARK, PAUL, GARY, FRED, CARL. Keep firing until the clock stops.',
  }),
  summaryLine: (rs) => {
    const hits = rs.reduce((s, r) => s + (r.meta?.hits ?? 0), 0);
    return `${hits} names fired across ${rs.length} shapes.`;
  },

  async round({ next }) {
    const tables = await names();
    const group = rand(Object.keys(tables));
    const lengths = Object.keys(tables[group]).filter((k) => tables[group][k].length >= 6);
    const len = rand(lengths);
    const list = tables[group][len];

    const shape = h('div', { class: 'board-wrap' },
      h('div', {
        class: 'board',
        style: { '--tile': '38px', '--tile-font': '30px' },
        dataset: { longest: String(len) },
      }, h('div', { class: 'word' }, ...Array.from({ length: Number(len) }, () => h('div', { class: 'tile' }, ' ')))));

    const readout = timerDisplay();

    const reveal = () => {
      buzzer();
      setScreen(
        h('div', { class: 'cat' }, `${group} · ${len} letters`),
        h('div', { class: 'card' },
          h('h3', {}, `Every ${len}-letter ${group.toLowerCase()} on the list`),
          h('p', { style: { fontSize: '21px', lineHeight: '1.6', fontWeight: '700' } },
            list.join('  ·  ')),
          h('p', { class: 'muted' }, `${list.length} on the list.`))
      );
      setActions(
        h('p', { class: 'center muted' }, 'How many did you say out loud?'),
        h('div', { class: 'row' },
          btn('0', { variant: 'bad tall', onclick: () => finish(0) }),
          btn('1–2', { variant: 'tall', onclick: () => finish(2) })),
        h('div', { class: 'row' },
          btn('3–5', { variant: 'tall', onclick: () => finish(4) }),
          btn('6+', { variant: 'good tall', onclick: () => finish(6) }))
      );
    };

    const finish = (hits) => {
      const correct = hits >= 3;
      correct ? ding() : buzzer();
      logResult({
        drillType: 'name-shape',
        correct,
        latencyMs: null,
        errorTag: correct ? null : 5,
        category: group,
        isProperName: true,
        meta: { hits, len: Number(len), listSize: list.length },
      });
      next({ correct, meta: { hits } });
    };

    setScreen(
      h('div', { class: 'cat' }, group),
      shape,
      h('div', { class: 'card center' },
        h('h2', {}, `${len} letters`),
        h('p', { style: { fontWeight: '700' } }, 'Say every one you can. Out loud. Do not stop.'),
        readout.node)
    );
    setActions(btn('I AM OUT OF NAMES', { variant: 'ghost', onclick: () => { timer.stop(); reveal(); } }));

    const timer = new Timer({ duration: RECALL_MS, onTick: readout.update, onDone: reveal }).start();
  },
};

// ---------------------------------------------------------------------------
// Drill 8 -- SOUND IT OUT (untimed on purpose)
// ---------------------------------------------------------------------------

export const soundItOut = {
  id: 'sound-it-out',
  title: 'SOUND IT OUT',
  minutes: 3,
  tip: tipFrom(REFLEXES.soundNames, {
    example: '_ A _ _ A   _ H I _ E → "uh-AH-uh-ah … hmm-HIGH-uh". Say it until a name clicks.',
  }),
  summaryLine: (rs) => `${rs.filter((r) => r.correct).length} of ${rs.length} came to you out loud.`,

  round({ next }) {
    const puzzle = pick({ isProperName: true, minWords: 2 });
    // Keep the vowels and drop most consonants: this is a sound puzzle.
    const letters = [...new Set(puzzle.answer.replace(/[^A-Z]/g, ''))];
    const vowels = letters.filter((c) => 'AEIOU'.includes(c));
    const consonants = letters.filter((c) => !'AEIOU'.includes(c));
    const keep = new Set([
      ...vowels.slice(0, 2),
      ...consonants.sort(() => Math.random() - 0.5).slice(0, Math.max(1, Math.floor(consonants.length / 3))),
    ]);
    const boardWrap = renderBoard(puzzle.answer, keep);

    setScreen(
      h('div', { class: 'cat' }, puzzle.category),
      boardWrap,
      h('div', { class: 'card center' },
        h('h2', {}, 'Read it aloud as sounds.'),
        h('p', {}, 'Not letter names. Sounds. Take as long as you want — nothing is timed here.'),
        h('p', { class: 'muted' }, 'Silent reading uses the wrong retrieval path for names.'))
    );
    setActions(btn('SHOW ME', {
      variant: 'primary tall',
      onclick: () => {
        revealAll(boardWrap);
        setScreen(
          h('div', { class: 'cat' }, puzzle.category),
          boardWrap,
          h('div', { class: 'card center' }, h('h2', {}, puzzle.answer))
        );
        setActions(...selfScore('Did saying it out loud get you there?', (got) => {
          logResult({
            drillType: 'sound-it-out',
            correct: got,
            latencyMs: null,
            errorTag: got ? null : 5,
            category: puzzle.category,
            isProperName: true,
            puzzleId: puzzle.id,
            meta: {},
          });
          got ? ding() : buzzer();
          next({ correct: got, meta: {} });
        }));
      },
    }));
  },
};

// ---------------------------------------------------------------------------
// Drill 10 -- SAY IT EXACTLY (untimed, end of session, deliberately tedious)
// ---------------------------------------------------------------------------

const CHECKS = [
  { id: 'every', label: 'Every word?' },
  { id: 'order', label: 'In order?' },
  { id: 'extra', label: 'No extra words?' },
  { id: 'ending', label: 'Clear ending?' },
];

export const sayItExactly = {
  id: 'say-it-exactly',
  title: 'SAY IT EXACTLY',
  minutes: 3,
  tip: tipFrom(REFLEXES.sayExactly, {
    example: 'This is the drill that saves the car. It is meant to be tedious.',
  }),
  summaryLine: (rs) => `${rs.filter((r) => r.correct).length} of ${rs.length} clean.`,

  round({ next }) {
    const puzzle = pick({ minWords: 3 });
    const ticked = new Set();

    const render = () => {
      setScreen(
        h('div', { class: 'cat' }, puzzle.category),
        renderBoard(puzzle.answer, 'ALL'),
        h('div', { class: 'card center' },
          h('h2', {}, 'Say it out loud.'),
          h('p', {}, 'Full articulation. 80% speed. Now tick each one.')),
        ...CHECKS.map((c) =>
          btn(`${ticked.has(c.id) ? '✓  ' : ''}${c.label}`, {
            variant: ticked.has(c.id) ? 'good small' : 'small',
            style: { marginBottom: '10px' },
            onclick: () => {
              ticked.has(c.id) ? ticked.delete(c.id) : ticked.add(c.id);
              render();
            },
          }))
      );
      setActions(btn(ticked.size === CHECKS.length ? 'CLEAN' : `${ticked.size}/4 TICKED`, {
        variant: ticked.size === CHECKS.length ? 'good tall' : 'tall',
        disabled: ticked.size !== CHECKS.length,
        onclick: () => {
          ding();
          logResult({
            drillType: 'say-it-exactly',
            correct: true,
            latencyMs: null,
            errorTag: null,
            category: puzzle.category,
            isProperName: puzzle.isProperName,
            puzzleId: puzzle.id,
            meta: { checks: [...ticked] },
          });
          next({ correct: true, meta: {} });
        },
      }));
    };

    render();
  },
};

export { MISTAKES };

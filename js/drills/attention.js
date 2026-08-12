// Drill 6: TOSS-UP BUZZ    Drill 9: ATTENTION LOOP
// The two drills that attack "she drifts mid-round while opponents play".

import {
  h, btn, setScreen, setActions, renderBoard, revealTile, tileOrder, revealAll,
  verdictCard, Timer, timerDisplay, selfScore, ding, buzzer, after, every,
} from '../ui.js';
import { pick } from '../data.js';
import { logResult, stats } from '../store.js';
import { tossUpCoaching, CONVERSION_CEILING, MISTAKES, tipFrom, REFLEXES } from '../strategy.js';
import { pickN } from './common.js';

const REVEAL_MS = 1200; // the real toss-up cadence

// ---------------------------------------------------------------------------
// Drill 6 -- TOSS-UP BUZZ
// ---------------------------------------------------------------------------

export const tossUp = {
  id: 'toss-up',
  title: 'TOSS-UP BUZZ',
  minutes: 3,
  tip: tipFrom(REFLEXES.tossBuzz, {
    example: `If you are right more than ${Math.round(CONVERSION_CEILING * 100)}% of the time you buzz, you are buzzing too late.`,
  }),
  summaryLine(rs) {
    const s = stats();
    return tossUpCoaching({ buzzRate: s.buzzRate, conversion: s.conversion, samples: s.tossUpN });
  },
  summaryExtra() {
    const s = stats();
    if (s.tossUpN < 4) return [];
    return [h('div', { class: 'card' },
      h('h3', {}, 'Your two numbers'),
      h('div', { class: 'mathline' },
        h('span', { class: 'l' }, 'Buzz rate — how often you committed'),
        h('span', { class: 'v' }, Math.round(s.buzzRate * 100) + '%')),
      h('div', { class: 'mathline' },
        h('span', { class: 'l' }, 'Conversion — how often you were right'),
        h('span', { class: 'v' }, Math.round(s.conversion * 100) + '%')),
      h('p', { class: 'muted', style: { marginTop: '10px' } },
        `Conversion above ${Math.round(CONVERSION_CEILING * 100)}% means you are waiting too long. ` +
        'A wrong buzz costs you one toss-up. Waiting costs you the whole board.'))];
  },

  round({ next }) {
    const puzzle = pick({ minWords: 2, maxWords: 4 });
    const boardWrap = renderBoard(puzzle.answer);
    const order = tileOrder(boardWrap);
    const t0 = performance.now();

    let shown = 0;
    let buzzed = false;
    let iv = null;

    const counter = h('p', { class: 'center muted', style: { fontWeight: '700' } }, '0 letters');

    const stop = () => { iv?.cancel(); iv = null; };

    const step = () => {
      if (buzzed) return;
      if (shown >= order.length) { stop(); return outOfBoard(); }
      revealTile(boardWrap, order[shown++]);
      counter.textContent = `${shown} of ${order.length} letters`;
    };

    const buzz = () => {
      if (buzzed) return;
      buzzed = true;
      stop();
      ding();
      reveal({ buzzed: true, latencyMs: performance.now() - t0, revealsAtBuzz: shown });
    };

    const outOfBoard = () => {
      if (buzzed) return;
      buzzed = true;
      buzzer();
      reveal({ buzzed: false, latencyMs: null, revealsAtBuzz: order.length });
    };

    const reveal = (info) => {
      revealAll(boardWrap);
      if (!info.buzzed) {
        logResult({
          drillType: 'toss-up',
          correct: false,
          latencyMs: null,
          errorTag: null,
          category: puzzle.category,
          isProperName: puzzle.isProperName,
          puzzleId: puzzle.id,
          meta: { buzzed: false, revealsAtBuzz: order.length },
        });
        setScreen(
          h('div', { class: 'cat' }, puzzle.category),
          boardWrap,
          verdictCard({
            good: false,
            headline: 'Whole board, no buzz.',
            notes: [
              `The answer was ${puzzle.answer}.`,
              'A toss-up you never buzz on is a toss-up you definitely lose. Commit earlier.',
            ],
          })
        );
        setActions(btn('NEXT', { variant: 'primary tall', onclick: () => next({ correct: false, meta: info }) }));
        return;
      }

      setScreen(
        h('div', { class: 'cat' }, puzzle.category),
        boardWrap,
        h('div', { class: 'card center' },
          h('h2', {}, puzzle.answer),
          h('p', { class: 'muted' },
            `You buzzed on ${info.revealsAtBuzz} of ${order.length} letters, ` +
            `${(info.latencyMs / 1000).toFixed(1)}s in.`))
      );
      setActions(...selfScore('Say it out loud first. Did you have it?', (got) => {
        logResult({
          drillType: 'toss-up',
          correct: got,
          latencyMs: info.latencyMs,
          errorTag: got ? null : 4,
          category: puzzle.category,
          isProperName: puzzle.isProperName,
          puzzleId: puzzle.id,
          meta: { ...info, revealFraction: info.revealsAtBuzz / order.length },
        });
        next({ correct: got, meta: info });
      }));
    };

    setScreen(h('div', { class: 'cat' }, puzzle.category), boardWrap, counter);
    setActions(btn('BUZZ', { variant: 'primary', style: { minHeight: '116px', fontSize: '38px' }, onclick: buzz }));

    iv = every(REVEAL_MS, step);
    after(350, step);
  },
};

// ---------------------------------------------------------------------------
// Drill 9 -- ATTENTION LOOP
// ---------------------------------------------------------------------------

const WATCH_MS = 20000;
const PROMPT_MS = 5000;

export const attentionLoop = {
  id: 'attention-loop',
  title: 'ATTENTION LOOP',
  minutes: 4,
  tip: tipFrom(REFLEXES.attentionLoop, {
    example: 'Thumb→index: longest word. Middle: best guess. Ring: first action. Run it every opponent turn.',
  }),
  summaryLine: (rs) => {
    const done = rs.filter((r) => r.correct).length;
    return `${done} of ${rs.length} loops completed. Most contestants get control and then start thinking.`;
  },

  round({ next }) {
    const puzzle = pick({ minWords: 3 });
    const boardWrap = renderBoard(puzzle.answer);
    const letters = [...new Set(puzzle.answer.replace(/[^A-Z]/g, ''))];
    const called = pickN(letters, Math.min(4, Math.max(2, letters.length - 4)));

    // Phase 1: an opponent plays for twenty seconds.
    const watch = () => {
      const readout = timerDisplay();
      setScreen(
        h('div', { class: 'cat' }, puzzle.category),
        boardWrap,
        h('div', { class: 'card center' },
          h('h3', {}, 'Not your turn'),
          readout.node,
          h('p', { style: { fontWeight: '700', marginTop: '10px' } }, 'Watch the board. Run the loop.'),
          h('p', { class: 'muted' }, 'Longest word · best guess · first action'))
      );
      setActions();

      called.forEach((l, i) =>
        after(2500 + i * 3800, () => {
          for (const t of boardWrap.querySelectorAll(`.tile[data-l="${l}"]`)) t.classList.add('lit', 'fresh');
        }));

      new Timer({ duration: WATCH_MS, onTick: readout.update, onDone: () => askLength() }).start();
    };

    // Phase 2, prompt 1: objectively scoreable, so it is not self-scored.
    const revealedSet = new Set(called);
    const unsolved = puzzle.answer.split(' ')
      .filter((w) => [...w].some((c) => /[A-Z]/.test(c) && !revealedSet.has(c)));
    const longest = unsolved.reduce((a, b) => (b.length > a.length ? b : a), unsolved[0] ?? '');
    const answers = { length: null, guess: null, action: null };

    const promptScreen = ({ title, hint, controls, onTimeout }) => {
      const readout = timerDisplay();
      const timer = new Timer({ duration: PROMPT_MS, onTick: readout.update, onDone: onTimeout });
      setScreen(
        h('div', { class: 'cat' }, puzzle.category),
        boardWrap,
        h('div', { class: 'card center' }, h('h2', {}, title),
          hint ? h('p', { class: 'muted' }, hint) : null, readout.node)
      );
      setActions(...controls(timer));
      timer.start();
      return timer;
    };

    const askLength = () => {
      const opts = [];
      const base = Math.max(2, longest.length - 2);
      for (let n = base; n < base + 6; n++) opts.push(n);
      if (!opts.includes(longest.length)) opts[2] = longest.length;

      const answer = (timer, n) => {
        timer.stop();
        answers.length = n;
        n === longest.length ? ding() : buzzer();
        askGuess();
      };

      promptScreen({
        title: 'Letter count of the longest unsolved word?',
        hint: 'Thumb to index finger.',
        onTimeout: () => { answers.length = 0; buzzer(); askGuess(); },
        controls: (timer) => [
          h('div', { class: 'row' }, ...opts.slice(0, 3).map((n) =>
            btn(String(n), { variant: 'tall', onclick: () => answer(timer, n) }))),
          h('div', { class: 'row' }, ...opts.slice(3).map((n) =>
            btn(String(n), { variant: 'tall', onclick: () => answer(timer, n) }))),
        ],
      });
    };

    const askGuess = () => {
      promptScreen({
        title: 'Your best guess right now?',
        hint: 'Say it out loud. Middle finger.',
        onTimeout: () => { answers.guess = false; buzzer(); askAction(); },
        controls: (timer) => [
          btn('SAID IT', {
            variant: 'good tall',
            onclick: () => { timer.stop(); answers.guess = true; askAction(); },
          }),
          btn('BLANK', {
            variant: 'tall',
            onclick: () => { timer.stop(); answers.guess = false; askAction(); },
          }),
        ],
      });
    };

    const askAction = () => {
      promptScreen({
        title: 'Your first action if you get control?',
        hint: 'This is the one that wins money. Ring finger.',
        onTimeout: () => { answers.action = false; buzzer(); finish(); },
        controls: (timer) => [
          btn('SAID IT', {
            variant: 'good tall',
            onclick: () => { timer.stop(); answers.action = true; finish(); },
          }),
          btn('BLANK', {
            variant: 'tall',
            onclick: () => { timer.stop(); answers.action = false; finish(); },
          }),
        ],
      });
    };

    const finish = () => {
      const lengthRight = answers.length === longest.length;
      const complete = lengthRight && answers.guess && answers.action;
      complete ? ding() : buzzer();

      logResult({
        drillType: 'attention-loop',
        correct: complete,
        latencyMs: null,
        errorTag: complete ? null : 4,
        category: puzzle.category,
        isProperName: puzzle.isProperName,
        puzzleId: puzzle.id,
        meta: { lengthRight, guess: answers.guess, action: answers.action, longest: longest.length },
      });

      revealAll(boardWrap);
      setScreen(
        verdictCard({
          good: complete,
          headline: complete ? 'Full loop.' : 'Loop broke.',
          lines: [
            { label: 'Longest unsolved word', value: `${longest} (${longest.length})` },
            { label: 'You said', value: answers.length ? String(answers.length) : 'nothing' },
            { label: 'Best guess', value: answers.guess ? 'said it' : 'blank' },
            { label: 'First action', value: answers.action ? 'said it' : 'blank', emphasis: true, good: !!answers.action },
          ],
          notes: [
            answers.action
              ? 'That is the one that wins money. You had it ready before you had control.'
              : 'Most contestants get control and then start thinking. That is the gap you are closing.',
          ],
          tag: complete ? null : MISTAKES[4],
        }),
        h('div', { class: 'card' }, h('h3', {}, 'The board was'), renderBoard(puzzle.answer, 'ALL'))
      );
      setActions(btn('NEXT', { variant: 'primary tall', onclick: () => next({ correct: complete, meta: answers }) }));
    };

    watch();
  },
};

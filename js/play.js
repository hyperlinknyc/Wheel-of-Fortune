// Play mode -- a real round, for fun.
//
// Deliberately NOT a drill: nothing here writes to the training results log,
// so the stat rings and the adaptive engine stay clean. If playing for fun
// moved Category Discipline, the number she is trying to get to 100% would
// stop meaning anything. Play totals are tracked separately.
//
// It is still the honest-mode pattern for solving: tap SOLVE, say it out
// loud, then self-score. No typing -- same as everywhere else.

import {
  h, btn, setScreen, setActions, setTop, renderBoard, revealLetter, revealAll,
  card, go, after, ding, buzzer, primeAudio, screenOpts,
} from './ui.js';
import { pick } from './data.js';
import * as store from './store.js';
import { WHEEL, BANKRUPT, LOSE_A_TURN, VOWEL_COST, money } from './strategy.js';

const CONSONANTS = 'BCDFGHJKLMNPQRSTVWXYZ'.split('');
const VOWELS = 'AEIOU'.split('');
const SEG = 360 / WHEEL.length;

const reducedMotion = () =>
  typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------------
// The wheel, drawn as SVG so it scales cleanly and needs no assets
// ---------------------------------------------------------------------------

const wedgeClass = (w) =>
  w === BANKRUPT ? 'bankrupt' : w === LOSE_A_TURN ? 'lose' : 'cash';

const shortLabel = (w) =>
  w === BANKRUPT ? 'BANK' : w === LOSE_A_TURN ? 'LOSE' : String(w);

function wheelSvg() {
  const C = 150;
  const R = 148;
  const pt = (deg, r) => {
    const rad = (deg - 90) * Math.PI / 180;
    return [C + r * Math.cos(rad), C + r * Math.sin(rad)];
  };

  const parts = WHEEL.map((w, i) => {
    const a1 = i * SEG;
    const a2 = a1 + SEG;
    const [x1, y1] = pt(a1, R);
    const [x2, y2] = pt(a2, R);
    const d = `M ${C} ${C} L ${x1.toFixed(2)} ${y1.toFixed(2)} ` +
      `A ${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
    const mid = a1 + SEG / 2;
    const [tx, ty] = pt(mid, R * 0.72);
    return `<path d="${d}" class="wedge ${wedgeClass(w)}"/>` +
      `<text x="${tx.toFixed(2)}" y="${ty.toFixed(2)}" class="wedge-label ${wedgeClass(w)}"` +
      ` transform="rotate(${mid.toFixed(2)} ${tx.toFixed(2)} ${ty.toFixed(2)})">${shortLabel(w)}</text>`;
  }).join('');

  return `<svg viewBox="0 0 300 300" class="wheel-svg" aria-hidden="true">
    <g class="wheel-rotor">${parts}<circle cx="${C}" cy="${C}" r="26" class="wheel-hub"/></g>
  </svg>`;
}

// ---------------------------------------------------------------------------
// Round state
// ---------------------------------------------------------------------------

function newRound() {
  const puzzle = pick({ minWords: 2 });
  return {
    puzzle,
    revealed: new Set(),
    called: new Set(),
    roundMoney: 0,
    spins: 0,
    over: false,
  };
}

const lettersIn = (answer) => new Set(answer.replace(/[^A-Z]/g, ''));

const remaining = (state, pool) => {
  const inAnswer = lettersIn(state.puzzle.answer);
  return pool.filter((c) => !state.called.has(c) && inAnswer.has(c));
};

const anyConsonantsLeft = (s) => remaining(s, CONSONANTS).length > 0;
const anyVowelsLeft = (s) => remaining(s, VOWELS).length > 0;

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

export function playScreen() {
  let state = newRound();
  let rotation = 0;

  const board = () => renderBoard(state.puzzle.answer, state.revealed);

  /** Same board, sized down: on the picker screens it is context beside the
   *  letter grid, and at full size it pushed the last letter row off screen. */
  const compactBoard = () => {
    const wrap = board();
    wrap.classList.add('compact');
    return wrap;
  };

  const calledStrip = () => {
    const used = [...state.called].sort();
    if (!used.length) return null;
    return h('p', { class: 'muted center called-strip' }, 'Called: ' + used.join(' '));
  };

  // --- main round screen -----------------------------------------------
  const showRound = (flash = null) => {
    setTop({ title: 'PLAY', back: () => go('#/home') });
    const canVowel = state.roundMoney >= VOWEL_COST && anyVowelsLeft(state);
    const canSpin = anyConsonantsLeft(state);

    setScreen(
      h('div', { class: 'cat tight' }, state.puzzle.category),
      board(),
      flash ? h('div', { class: `card center flash ${flash.tone}` },
        h('p', { class: 'cue', style: { margin: 0 } }, flash.text)) : null,
      h('div', { class: 'card center' },
        h('h3', {}, 'This round'),
        h('div', { class: 'big-num' }, money(state.roundMoney)),
        calledStrip()),
      screenOpts({ dense: true })
    );

    setActions(
      btn('SPIN', {
        variant: 'primary tall',
        disabled: !canSpin,
        sub: canSpin ? null : 'no consonants left — solve it',
        onclick: () => { primeAudio(); showWheel(); },
      }),
      h('div', { class: 'row' },
        btn('BUY A VOWEL', {
          variant: '',
          disabled: !canVowel,
          sub: state.roundMoney < VOWEL_COST ? `needs ${money(VOWEL_COST)}` : null,
          onclick: () => showVowelPicker(),
        }),
        btn('SOLVE', { variant: 'good', onclick: () => showSolve() }))
    );
  };

  // --- the spin ---------------------------------------------------------
  const showWheel = () => {
    const landed = Math.floor(Math.random() * WHEEL.length);
    const wedge = WHEEL[landed];

    // Land the chosen wedge under the pointer at 12 o'clock, plus whole
    // turns for the spin itself and a little jitter so it never looks canned.
    const jitter = (Math.random() - 0.5) * (SEG * 0.55);
    const target = -(landed * SEG + SEG / 2) + jitter;
    rotation += 360 * 4 + (((target - rotation) % 360) + 360) % 360;

    const spinMs = reducedMotion() ? 200 : 1700;

    setTop({ title: 'PLAY' });
    setScreen(
      h('div', { class: 'wheel-wrap' },
        h('div', { class: 'wheel-pointer' }),
        h('div', { class: 'wheel-box', html: wheelSvg() })),
      h('p', { class: 'center muted spin-status' }, 'Spinning…'),
      screenOpts({ dense: true })
    );
    setActions();

    const rotor = document.querySelector('.wheel-rotor');
    if (rotor) {
      rotor.style.transition = `transform ${spinMs}ms cubic-bezier(.17,.67,.21,1)`;
      // Next frame, so the browser paints the start position first.
      requestAnimationFrame(() => { rotor.style.transform = `rotate(${rotation}deg)`; });
    }

    after(spinMs + 60, () => landOn(wedge));
  };

  const landOn = (wedge) => {
    state.spins++;
    const status = document.querySelector('.spin-status');

    if (wedge === BANKRUPT) {
      buzzer();
      const lost = state.roundMoney;
      state.roundMoney = 0;
      if (status) status.remove();
      setScreen(
        h('div', { class: 'wheel-wrap small' },
          h('div', { class: 'wheel-pointer' }),
          h('div', { class: 'wheel-box', html: wheelSvg() })),
        h('div', { class: 'card center bad' },
          h('h2', { style: { color: 'var(--bad)' } }, 'BANKRUPT'),
          h('p', {}, lost ? `${money(lost)} gone.` : 'Nothing in the pot — no harm done.'),
          h('p', { class: 'muted' }, 'This is the risk every extra spin is buying.')),
        screenOpts({ dense: true })
      );
      lockRotor();
      setActions(btn('KEEP GOING', { variant: 'primary tall', onclick: () => showRound() }));
      return;
    }

    if (wedge === LOSE_A_TURN) {
      buzzer();
      if (status) status.remove();
      setScreen(
        h('div', { class: 'wheel-wrap small' },
          h('div', { class: 'wheel-pointer' }),
          h('div', { class: 'wheel-box', html: wheelSvg() })),
        h('div', { class: 'card center' },
          h('h2', {}, 'LOSE A TURN'),
          h('p', {}, 'Pot is safe. The spin is wasted.')),
        screenOpts({ dense: true })
      );
      lockRotor();
      setActions(btn('KEEP GOING', { variant: 'primary tall', onclick: () => showRound() }));
      return;
    }

    ding();
    showConsonantPicker(wedge);
  };

  /** Freeze the rotor where it stopped so a re-render cannot snap it back. */
  const lockRotor = () => {
    const rotor = document.querySelector('.wheel-rotor');
    if (rotor) {
      rotor.style.transition = 'none';
      rotor.style.transform = `rotate(${rotation}deg)`;
    }
  };

  // --- letter pickers ---------------------------------------------------
  const letterGrid = (pool, onPick) => {
    const inAnswer = lettersIn(state.puzzle.answer);
    return h('div', { class: 'play-keys' },
      ...pool.map((l) => {
        const used = state.called.has(l);
        return h('button', {
          class: `key${used ? ' used' : ''}`,
          type: 'button',
          disabled: used,
          onclick: () => { if (!used) onPick(l, inAnswer.has(l)); },
        }, l);
      }));
  };

  const showConsonantPicker = (wedge) => {
    setTop({ title: 'PLAY' });
    // Compact header: the full three-line card pushed the last letter row
    // (Z, alone on row 5) below the fold on an iPhone 13.
    setScreen(
      h('p', { class: 'center landed-line' },
        h('b', {}, money(wedge)), ' a letter — call a consonant'),
      compactBoard(),
      letterGrid(CONSONANTS, (letter, hit) => resolveConsonant(letter, hit, wedge)),
      screenOpts({ dense: true })
    );
    setActions();
  };

  const showVowelPicker = () => {
    setTop({ title: 'PLAY' });
    setScreen(
      h('p', { class: 'center landed-line' },
        h('b', {}, `−${money(VOWEL_COST)}`), ' — pick a vowel'),
      compactBoard(),
      letterGrid(VOWELS, (letter, hit) => resolveVowel(letter, hit)),
      screenOpts({ dense: true })
    );
    setActions(btn('NEVER MIND', { variant: 'ghost', onclick: () => showRound() }));
  };

  const countIn = (letter) =>
    [...state.puzzle.answer].filter((c) => c === letter).length;

  const resolveConsonant = (letter, hit, wedge) => {
    state.called.add(letter);
    if (hit) {
      const n = countIn(letter);
      const won = n * wedge;
      state.roundMoney += won;
      state.revealed.add(letter);
      ding();
      showRound({
        tone: 'good',
        text: `${n} × ${letter} — ${money(won)}`,
      });
    } else {
      buzzer();
      showRound({ tone: 'bad', text: `No ${letter}.` });
    }
  };

  const resolveVowel = (letter, hit) => {
    state.called.add(letter);
    state.roundMoney -= VOWEL_COST;
    if (hit) {
      state.revealed.add(letter);
      ding();
      showRound({ tone: 'good', text: `${letter} is up there. −${money(VOWEL_COST)}` });
    } else {
      buzzer();
      showRound({ tone: 'bad', text: `No ${letter}. −${money(VOWEL_COST)}` });
    }
  };

  // --- solving ----------------------------------------------------------
  const showSolve = () => {
    setTop({ title: 'PLAY' });
    setScreen(
      h('div', { class: 'cat tight' }, state.puzzle.category),
      board(),
      h('div', { class: 'card center' },
        h('p', { class: 'cue' }, 'Say it out loud.'),
        h('p', { class: 'why' }, `${money(state.roundMoney)} on the line.`)),
      screenOpts({ dense: true })
    );
    setActions(
      btn('SHOW ME THE ANSWER', { variant: 'primary tall', onclick: () => revealAnswer() }),
      btn('NOT YET — KEEP PLAYING', { variant: 'ghost', onclick: () => showRound() })
    );
  };

  const revealAnswer = () => {
    const wrap = board();
    revealAll(wrap);
    setTop({ title: 'PLAY' });
    setScreen(
      h('div', { class: 'cat tight' }, state.puzzle.category),
      wrap,
      h('div', { class: 'card center' }, h('h2', {}, state.puzzle.answer)),
      screenOpts({ dense: true })
    );
    setActions(
      h('div', { class: 'row' },
        btn('I HAD IT', { variant: 'good tall', onclick: () => endRound(true) }),
        btn("I DIDN'T", { variant: 'bad tall', onclick: () => endRound(false) }))
    );
  };

  const endRound = (won) => {
    state.over = true;
    const banked = won ? state.roundMoney : 0;
    store.recordPlayRound({ won, amount: banked });
    won ? ding() : buzzer();
    const s = store.playStats();

    setTop({ title: won ? 'SOLVED' : 'ROUND OVER' });
    setScreen(
      h('div', { class: `card center ${won ? 'good' : 'bad'}` },
        h('h3', {}, won ? 'Banked' : 'Not this time'),
        h('div', { class: 'big-num', style: { color: won ? 'var(--good)' : 'var(--bad)' } },
          money(banked)),
        h('p', { class: 'muted' },
          won ? `${state.spins} spin${state.spins === 1 ? '' : 's'} to get there.`
            : `${money(state.roundMoney)} was on the table.`)),
      card(
        h('h3', {}, 'Play totals'),
        h('div', { class: 'mathline' },
          h('span', { class: 'l' }, 'Rounds played'),
          h('span', { class: 'v' }, String(s.rounds))),
        h('div', { class: 'mathline' },
          h('span', { class: 'l' }, 'Solved'),
          h('span', { class: 'v' }, `${s.wins} of ${s.rounds}`)),
        h('div', { class: 'mathline' },
          h('span', { class: 'l' }, 'Total banked'),
          h('span', { class: 'v' }, money(s.banked))),
        h('div', { class: 'mathline em' },
          h('span', { class: 'l' }, 'Best round'),
          h('span', { class: 'v good' }, money(s.best)))),
      h('p', { class: 'muted center' },
        'Play rounds are just for fun — they do not move your training stats.')
    );
    setActions(
      btn('PLAY ANOTHER', {
        variant: 'primary tall',
        onclick: () => { state = newRound(); showRound(); },
      }),
      btn('DONE', { variant: 'ghost', onclick: () => go('#/home') })
    );
  };

  showRound();
}

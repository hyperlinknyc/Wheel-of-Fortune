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
  h, btn, setScreen, setActions, setTop, renderBoard, revealAll,
  card, go, after, ding, buzzer, primeAudio, screenOpts,
} from './ui.js';
import { pick } from './data.js';
import * as store from './store.js';
import { tipChip } from './tips.js';
import { OPPONENTS } from './game.js';
import {
  WHEEL, BANKRUPT, LOSE_A_TURN, VOWEL_COST, money, revealedFraction,
} from './strategy.js';
import { wheelSvg, spinAnimation, lockRotor } from './wheel.js';

const CONSONANTS = 'BCDFGHJKLMNPQRSTVWXYZ'.split('');
const VOWELS = 'AEIOU'.split('');

const reducedMotion = () =>
  typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------------
// The chooser -- one tap, and it says what each mode is for
// ---------------------------------------------------------------------------

export function playScreen() {
  setTop({ title: 'PLAY', back: () => go('#/home') });
  const p = store.playStats();
  const g = store.gameStats();

  setScreen(
    h('p', { class: 'muted' }, 'Neither of these moves your training stats.'),

    card(
      h('h3', {}, 'Who you are playing'),
      ...OPPONENTS.map((o) => h('div', { class: 'mathline wide' },
        h('span', { class: 'l' }, o.name),
        h('span', { class: 'v' }, o.blurb)))),

    (p.rounds || g.games) ? card(
      h('h3', {}, 'So far'),
      g.games ? h('div', { class: 'mathline' },
        h('span', { class: 'l' }, 'Games won'),
        h('span', { class: 'v' }, `${g.wins} of ${g.games}`)) : null,
      p.rounds ? h('div', { class: 'mathline' },
        h('span', { class: 'l' }, 'Solo rounds solved'),
        h('span', { class: 'v' }, `${p.wins} of ${p.rounds}`)) : null,
      h('div', { class: 'mathline em' },
        h('span', { class: 'l' }, 'Best single round'),
        h('span', { class: 'v good' }, money(p.best)))) : null
  );

  // The two modes are the two buttons. Listing them again as tiles in the
  // screen body was the same choice twice and cost the fold.
  setActions(
    btn('PLAY THE GAME', {
      variant: 'primary tall', sub: `three rounds against ${OPPONENTS[0].name} and ${OPPONENTS[1].name}`,
      onclick: () => { primeAudio(); go('#/game'); },
    }),
    btn('JUST SPIN', {
      variant: 'ghost', sub: 'one board, no opponents',
      onclick: () => { primeAudio(); soloScreen(); },
    })
  );
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
    vowelsBought: 0,
    over: false,
  };
}

const lettersIn = (answer) => new Set(answer.replace(/[^A-Z]/g, ''));

// Uncalled, NOT "uncalled and actually in the answer". Filtering by the answer
// would grey out BUY A VOWEL exactly when no vowels were left to find, which
// quietly tells her something the board has not shown her yet.
const uncalled = (state, pool) => pool.filter((c) => !state.called.has(c));

// ---------------------------------------------------------------------------
// Solo round
// ---------------------------------------------------------------------------

export function soloScreen() {
  let state = newRound();

  const board = () => renderBoard(state.puzzle.answer, state.revealed);

  /** Same board, sized down: on the picker screens it is context beside the
   *  letter grid, and at full size it pushed the last letter row off screen. */
  const compactBoard = () => {
    const wrap = board();
    wrap.classList.add('compact');
    return wrap;
  };

  const ctx = (event, extra = {}) => ({
    event,
    mode: 'solo',
    pot: state.roundMoney,
    coverage: revealedFraction(state.puzzle.answer, state.revealed),
    isProperName: state.puzzle.isProperName,
    category: state.puzzle.category,
    spins: state.spins,
    vowelsBought: state.vowelsBought,
    roundsPlayed: store.playStats().rounds,
    ...extra,
  });

  const calledStrip = () => {
    const used = [...state.called].sort();
    if (!used.length) return null;
    return h('p', { class: 'muted center called-strip' }, 'Called: ' + used.join(' '));
  };

  // --- main round screen -----------------------------------------------
  const showRound = (flash = null) => {
    setTop({ title: 'JUST SPIN', back: () => go('#/play') });
    const canVowel = state.roundMoney >= VOWEL_COST && uncalled(state, VOWELS).length > 0;
    const canSpin = uncalled(state, CONSONANTS).length > 0;

    setScreen(
      h('div', { class: 'cat tight' }, state.puzzle.category),
      board(),
      flash ? h('div', { class: `card center flash ${flash.tone}` },
        h('p', { class: 'cue', style: { margin: 0 } }, flash.text)) : null,
      h('div', { class: 'card center' },
        h('h3', {}, 'This round'),
        h('div', { class: 'big-num' }, money(state.roundMoney)),
        calledStrip()),
      tipChip(ctx('turn')),
      screenOpts({ dense: true })
    );

    setActions(
      btn('SPIN', {
        variant: 'primary tall',
        disabled: !canSpin,
        sub: canSpin ? null : 'every consonant has been called',
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
    const spinMs = reducedMotion() ? 200 : 1700;

    setTop({ title: 'JUST SPIN' });
    setScreen(
      h('div', { class: 'wheel-wrap' },
        h('div', { class: 'wheel-pointer' }),
        h('div', { class: 'wheel-box', html: wheelSvg() })),
      h('p', { class: 'center muted spin-status' }, 'Spinning…'),
      screenOpts({ dense: true })
    );
    setActions();
    spinAnimation(landed, spinMs);
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
        tipChip(ctx('bankrupt', { pot: lost })),
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
        tipChip(ctx('lose-turn')),
        screenOpts({ dense: true })
      );
      lockRotor();
      setActions(btn('KEEP GOING', { variant: 'primary tall', onclick: () => showRound() }));
      return;
    }

    ding();
    showConsonantPicker(wedge);
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
    setTop({ title: 'JUST SPIN' });
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
    setTop({ title: 'JUST SPIN' });
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
    state.vowelsBought++;
    state.roundMoney = Math.max(0, state.roundMoney - VOWEL_COST);
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
    setTop({ title: 'JUST SPIN' });
    setScreen(
      h('div', { class: 'cat tight' }, state.puzzle.category),
      board(),
      h('div', { class: 'card center' },
        h('p', { class: 'cue' }, 'Say it out loud.'),
        h('p', { class: 'why' }, `${money(state.roundMoney)} on the line.`)),
      tipChip(ctx('solving')),
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
    setTop({ title: 'JUST SPIN' });
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
        h('h3', {}, 'Solo totals'),
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
      btn('PLAY THE REAL GAME', { variant: 'ghost', onclick: () => go('#/game') })
    );
  };

  showRound();
}

// Play mode: a full three-round game against two computer opponents.
//
// The point of the opponents is not decoration. A solo round cannot teach the
// thing that actually costs her money on tape, which is that a pot is worth
// nothing until it is banked and that somebody else is waiting to take the
// puzzle off her. So the two of them are built as the two halves of the
// lesson: Rita grinds a board she has already solved and gets punished for it,
// and Dean solves early off a half-empty board and quietly wins. Watching Dean
// beat her is a faster teacher than any feedback card.
//
// The opponents do not cheat. They pick letters by English frequency out of
// what has not been called yet -- they cannot see the answer when choosing --
// and their solve attempts are rolled against how much of the board is
// actually showing. A rigged opponent would teach nothing.
//
// Like the solo round, nothing here writes to the training results log.

import {
  h, btn, setScreen, setActions, setTop, renderBoard, revealAll,
  card, go, after, ding, buzzer, primeAudio, screenOpts, mathDisclosure,
} from './ui.js';
import { pick } from './data.js';
import * as store from './store.js';
import { tipChip } from './tips.js';
import {
  WHEEL, BANKRUPT, LOSE_A_TURN, VOWEL_COST, ROUND_MINIMUM, money, revealedFraction,
} from './strategy.js';
import { wheelSvg, spinAnimation } from './wheel.js';

const CONSONANTS = 'BCDFGHJKLMNPQRSTVWXYZ'.split('');
const VOWELS = 'AEIOU'.split('');
const ROUNDS = 3;
const TURN_CAP = 18;   // safety net: no round can loop forever

const reducedMotion = () =>
  typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------------
// The opponents
// ---------------------------------------------------------------------------

export const OPPONENTS = [
  {
    id: 'rita',
    name: 'RITA',
    blurb: 'Grinds every board for one more letter',
    // Will not even consider solving until the board is nearly given away.
    solveAt: 0.76,
    nerve: 0.56,
    vowelUrge: 0.16,
    tell: 'Rita milks puzzles she has already got. She is mistake #1 with a face on it.',
  },
  {
    id: 'dean',
    name: 'DEAN',
    blurb: 'Solves the moment he can read it',
    solveAt: 0.44,
    nerve: 0.82,
    vowelUrge: 0.44,
    tell: 'Dean is the one who beats you. He banks small pots early instead of big pots never.',
  },
];

// Rough English letter frequency, x10. The opponents choose from what is
// still uncalled using these weights, which is what a decent player does
// without thinking about it.
const FREQ = {
  E: 127, T: 91, A: 82, O: 75, I: 70, N: 67, S: 63, H: 61, R: 60, D: 43,
  L: 40, C: 28, U: 28, M: 24, W: 24, F: 22, G: 20, Y: 20, P: 19, B: 15,
  V: 10, K: 8, J: 2, X: 2, Q: 1, Z: 1,
};

function weightedPick(pool) {
  let total = 0;
  for (const l of pool) total += FREQ[l] ?? 1;
  let r = Math.random() * total;
  for (const l of pool) {
    r -= FREQ[l] ?? 1;
    if (r <= 0) return l;
  }
  return pool[pool.length - 1];
}

/** Odds an opponent's solve attempt is right, given how much is showing. */
const solveOdds = (ai, coverage) => Math.min(0.97, ai.nerve * (0.45 + coverage * 0.7));

// ---------------------------------------------------------------------------
// Opponent turn, planned as pure data
//
// The whole turn is simulated up front into a list of events, then played back
// with delays. Planning and painting stay separate, so the pacing code never
// has to hold game rules and the rules never have to know about timers.
// ---------------------------------------------------------------------------

const lettersIn = (answer) => new Set(answer.replace(/[^A-Z]/g, ''));
const countOf = (answer, letter) => [...answer].filter((c) => c === letter).length;

export function planOpponentTurn(ai, { answer, revealed, called, pot }) {
  const events = [];
  const seen = new Set(revealed);
  const said = new Set(called);
  let purse = pot;

  const coverage = () => revealedFraction(answer, seen);
  const attemptSolve = () => {
    const ok = Math.random() < solveOdds(ai, coverage());
    events.push({ type: 'solve', ok });
    return { events, solved: ok };
  };

  for (let step = 0; step < 14; step++) {
    const consLeft = CONSONANTS.filter((c) => !said.has(c));
    const vowelsLeft = VOWELS.filter((v) => !said.has(v));

    if (!consLeft.length || coverage() >= ai.solveAt) return attemptSolve();

    if (purse >= VOWEL_COST && vowelsLeft.length && Math.random() < ai.vowelUrge) {
      const v = weightedPick(vowelsLeft);
      said.add(v);
      purse -= VOWEL_COST;
      const n = countOf(answer, v);
      if (n) seen.add(v);
      events.push({ type: 'vowel', letter: v, count: n });
      if (!n) return { events, solved: false };
      continue;
    }

    const wedge = WHEEL[Math.floor(Math.random() * WHEEL.length)];
    events.push({ type: 'spin', wedge });

    if (wedge === BANKRUPT) {
      events.push({ type: 'bankrupt', lost: purse });
      return { events, solved: false };
    }
    if (wedge === LOSE_A_TURN) {
      events.push({ type: 'lose' });
      return { events, solved: false };
    }

    const c = weightedPick(consLeft);
    said.add(c);
    const n = countOf(answer, c);
    if (n) { seen.add(c); purse += n * wedge; }
    events.push({ type: 'call', letter: c, count: n, wedge });
    if (!n) return { events, solved: false };
  }

  return attemptSolve();
}

const BEAT = { spin: 950, call: 1150, vowel: 1050, bankrupt: 1500, lose: 1250, solve: 1500 };
const beatFor = (e) => (reducedMotion() ? 200 : BEAT[e.type] ?? 900);

// ---------------------------------------------------------------------------
// The game
// ---------------------------------------------------------------------------

function newGame() {
  return {
    round: 1,
    players: [
      { name: 'YOU', human: true, round: 0, total: 0 },
      { name: OPPONENTS[0].name, ai: OPPONENTS[0], round: 0, total: 0 },
      { name: OPPONENTS[1].name, ai: OPPONENTS[1], round: 0, total: 0 },
    ],
    roundWins: 0,
  };
}

function newRound(game) {
  const puzzle = pick({ minWords: 2 });
  for (const p of game.players) p.round = 0;
  return {
    puzzle,
    revealed: new Set(),
    called: new Set(),
    // The round's opening turn rotates, the way the toss-up winner rotates.
    turn: (game.round - 1) % game.players.length,
    turns: 0,
    spins: 0,
    vowelsBought: 0,
    log: [],
  };
}

export function gameScreen() {
  const game = newGame();
  let r = newRound(game);
  let beat = null;             // the pending playback timer, so SKIP can cancel it

  const you = () => game.players[0];
  const current = () => game.players[r.turn];
  const coverage = () => revealedFraction(r.puzzle.answer, r.revealed);
  const uncalled = (pool) => pool.filter((c) => !r.called.has(c));

  const ctx = (event, extra = {}) => ({
    event,
    mode: 'game',
    pot: you().round,
    coverage: coverage(),
    isProperName: r.puzzle.isProperName,
    category: r.puzzle.category,
    spins: r.spins,
    vowelsBought: r.vowelsBought,
    roundsPlayed: store.gameStats().rounds,
    ...extra,
  });

  // --- shared furniture -------------------------------------------------

  const scoreboard = () => h('div', { class: 'scores' },
    ...game.players.map((p, i) => h('div', { class: `score${i === r.turn ? ' on' : ''}` },
      h('div', { class: 'who' }, p.name),
      h('div', { class: 'amt' }, money(p.round)),
      h('div', { class: 'tot' }, money(p.total) + ' banked'))));

  const roundLabel = () => h('div', { class: 'round-label' },
    `Round ${game.round} of ${ROUNDS}`);

  const board = () => renderBoard(r.puzzle.answer, r.revealed);

  const compactBoard = () => {
    const wrap = board();
    wrap.classList.add('compact');
    return wrap;
  };

  // --- her turn ---------------------------------------------------------

  const showTurn = (flash = null) => {
    setTop({ title: 'YOUR TURN', back: () => go('#/play') });
    const canVowel = you().round >= VOWEL_COST && uncalled(VOWELS).length > 0;
    const canSpin = uncalled(CONSONANTS).length > 0;

    setScreen(
      roundLabel(),
      scoreboard(),
      flash ? h('p', { class: `flash-line ${flash.tone}` }, flash.text) : null,
      h('div', { class: 'cat tight' }, r.puzzle.category),
      board(),
      tipChip(ctx('turn')),
      screenOpts({ dense: true })
    );

    setActions(
      btn('SPIN', {
        variant: 'primary tall',
        disabled: !canSpin,
        sub: canSpin ? null : 'every consonant has been called',
        onclick: () => { primeAudio(); spin(); },
      }),
      h('div', { class: 'row' },
        btn('BUY A VOWEL', {
          disabled: !canVowel,
          sub: you().round < VOWEL_COST ? `needs ${money(VOWEL_COST)}` : null,
          onclick: () => showVowelPicker(),
        }),
        btn('SOLVE', { variant: 'good', onclick: () => showSolve() }))
    );
  };

  const spin = () => {
    r.spins++;
    const landed = Math.floor(Math.random() * WHEEL.length);
    const wedge = WHEEL[landed];
    const spinMs = reducedMotion() ? 200 : 1700;

    setTop({ title: 'YOUR TURN' });
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
    if (wedge === BANKRUPT) {
      buzzer();
      const lost = you().round;
      you().round = 0;
      return showBreak({
        tone: 'bad',
        title: 'BANKRUPT',
        body: lost ? `${money(lost)} gone, and your turn with it.` : 'Nothing in the pot — no harm done.',
        tip: ctx('bankrupt', { pot: lost }),
        onNext: passTurn,
      });
    }
    if (wedge === LOSE_A_TURN) {
      buzzer();
      return showBreak({
        tone: '',
        title: 'LOSE A TURN',
        body: 'The pot is safe. The turn is not.',
        tip: ctx('lose-turn'),
        onNext: passTurn,
      });
    }
    ding();
    showConsonantPicker(wedge);
  };

  // --- letter pickers ---------------------------------------------------

  const letterGrid = (pool, onPick) => {
    const inAnswer = lettersIn(r.puzzle.answer);
    return h('div', { class: 'play-keys' },
      ...pool.map((l) => {
        const used = r.called.has(l);
        return h('button', {
          class: `key${used ? ' used' : ''}`,
          type: 'button',
          disabled: used,
          onclick: () => { if (!used) onPick(l, inAnswer.has(l)); },
        }, l);
      }));
  };

  const showConsonantPicker = (wedge) => {
    setTop({ title: 'YOUR TURN' });
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
    setTop({ title: 'YOUR TURN' });
    setScreen(
      h('p', { class: 'center landed-line' },
        h('b', {}, `−${money(VOWEL_COST)}`), ' — pick a vowel'),
      compactBoard(),
      letterGrid(VOWELS, (letter, hit) => resolveVowel(letter, hit)),
      screenOpts({ dense: true })
    );
    setActions(btn('NEVER MIND', { variant: 'ghost', onclick: () => showTurn() }));
  };

  const resolveConsonant = (letter, hit, wedge) => {
    r.called.add(letter);
    if (hit) {
      const n = countOf(r.puzzle.answer, letter);
      you().round += n * wedge;
      r.revealed.add(letter);
      ding();
      return showTurn({ tone: 'good', text: `${n} × ${letter} — ${money(n * wedge)}` });
    }
    buzzer();
    showBreak({
      tone: 'bad',
      title: `No ${letter}`,
      body: 'Your turn passes with the pot still unbanked.',
      tip: ctx('miss'),
      onNext: passTurn,
    });
  };

  const resolveVowel = (letter, hit) => {
    r.called.add(letter);
    r.vowelsBought++;
    you().round = Math.max(0, you().round - VOWEL_COST);
    if (hit) {
      r.revealed.add(letter);
      ding();
      return showTurn({ tone: 'good', text: `${letter} is up there. −${money(VOWEL_COST)}` });
    }
    buzzer();
    showBreak({
      tone: 'bad',
      title: `No ${letter}`,
      body: `−${money(VOWEL_COST)}, and the turn passes.`,
      tip: ctx('vowel'),
      onNext: passTurn,
    });
  };

  // --- her solve --------------------------------------------------------

  const showSolve = () => {
    setTop({ title: 'SOLVE' });
    setScreen(
      h('div', { class: 'cat tight' }, r.puzzle.category),
      board(),
      h('div', { class: 'card center' },
        h('p', { class: 'cue' }, 'Say it out loud.'),
        h('p', { class: 'why' }, `${money(you().round)} on the line.`)),
      tipChip(ctx('solving')),
      screenOpts({ dense: true })
    );
    setActions(
      btn('SHOW ME THE ANSWER', { variant: 'primary tall', onclick: () => revealAnswer() }),
      btn('NOT YET — KEEP PLAYING', { variant: 'ghost', onclick: () => showTurn() })
    );
  };

  const revealAnswer = () => {
    const wrap = board();
    revealAll(wrap);
    setTop({ title: 'SOLVE' });
    setScreen(
      h('div', { class: 'cat tight' }, r.puzzle.category),
      wrap,
      h('div', { class: 'card center' }, h('h2', {}, r.puzzle.answer)),
      h('p', { class: 'muted center tiny' },
        'Honest scoring is the whole point — a turn you did not really win teaches nothing.'),
      screenOpts({ dense: true })
    );
    setActions(
      h('div', { class: 'row' },
        btn('I HAD IT', { variant: 'good tall', onclick: () => endRound(you()) }),
        btn("I DIDN'T", {
          variant: 'bad tall',
          onclick: () => {
            buzzer();
            showBreak({
              tone: 'bad',
              title: 'Turn over',
              body: 'A wrong solve costs the turn, same as a wrong letter.',
              tip: ctx('miss'),
              onNext: passTurn,
            });
          },
        }))
    );
  };

  // --- a beat between turns --------------------------------------------

  const showBreak = ({ tone, title, body, tip, onNext, button = 'NEXT' }) => {
    setTop({ title: 'PLAY' });
    setScreen(
      roundLabel(),
      scoreboard(),
      h('div', { class: `card center ${tone}` },
        h('h2', { style: tone === 'bad' ? { color: 'var(--bad)' } : null }, title),
        h('p', {}, body)),
      tip ? tipChip(tip) : null,
      screenOpts({ dense: true })
    );
    setActions(btn(button, { variant: 'primary tall', onclick: onNext }));
  };

  // --- an opponent's turn ----------------------------------------------

  const opponentIntro = (p) => {
    setTop({ title: `${p.name}'S TURN` });
    setScreen(
      roundLabel(),
      scoreboard(),
      h('div', { class: 'cat tight' }, r.puzzle.category),
      board(),
      h('p', { class: 'center muted' }, p.ai.tell),
      tipChip(ctx('opponent-turn', { opponent: p.name })),
      screenOpts({ dense: true })
    );
    setActions(btn('WATCH', { variant: 'primary tall', onclick: () => runOpponent(p) }));
  };

  const narrate = (p, e) => {
    switch (e.type) {
      case 'spin':
        return e.wedge === BANKRUPT ? `${p.name} spins — Bankrupt.`
          : e.wedge === LOSE_A_TURN ? `${p.name} spins — Lose a Turn.`
            : `${p.name} spins — ${money(e.wedge)} a letter.`;
      case 'call':
        return e.count
          ? `“${e.letter}” — ${e.count === 1 ? 'one' : e.count === 2 ? 'two' : e.count === 3 ? 'three' : e.count}. +${money(e.count * e.wedge)}`
          : `“${e.letter}” — nothing. Turn over.`;
      case 'vowel': {
        // "an A/E/I/O", but "a U" -- U is said "yoo".
        const art = 'AEIO'.includes(e.letter) ? 'an' : 'a';
        return e.count
          ? `Buys ${art} ${e.letter} — ${e.count} up there.`
          : `Buys ${art} ${e.letter} — not there. Turn over.`;
      }
      case 'bankrupt':
        return e.lost ? `BANKRUPT. ${money(e.lost)} gone.` : 'BANKRUPT — with nothing in the pot.';
      case 'lose':
        return 'Lose a Turn. The pot survives.';
      case 'solve':
        return e.ok ? `Solves it: “${r.puzzle.answer}”` : 'Says it wrong. Turn over.';
      default:
        return '';
    }
  };

  const applyEvent = (p, e) => {
    switch (e.type) {
      case 'call':
        r.called.add(e.letter);
        if (e.count) { r.revealed.add(e.letter); p.round += e.count * e.wedge; }
        break;
      case 'vowel':
        r.called.add(e.letter);
        p.round = Math.max(0, p.round - VOWEL_COST);
        if (e.count) r.revealed.add(e.letter);
        break;
      case 'bankrupt':
        p.round = 0;
        break;
      default:
        break;
    }
  };

  const showOpponent = (p) => {
    setTop({ title: `${p.name}'S TURN` });
    const lines = r.log.slice(-4);
    setScreen(
      roundLabel(),
      scoreboard(),
      h('div', { class: 'cat tight' }, r.puzzle.category),
      board(),
      h('div', { class: 'turn-log' },
        ...lines.map((t, i) => h('p', { class: `log-line${i === lines.length - 1 ? ' now' : ''}` }, t))),
      screenOpts({ dense: true })
    );
  };

  const runOpponent = (p) => {
    const { events, solved } = planOpponentTurn(p.ai, {
      answer: r.puzzle.answer,
      revealed: r.revealed,
      called: r.called,
      pot: p.round,
    });
    r.log = [];

    // Events are applied once and only once. SKIP AHEAD fires mid-playback,
    // when some of them have already landed, so replaying the list from the
    // top would pay the opponent twice for every letter it had already hit.
    let cursor = 0;
    const applyThrough = (upto) => {
      while (cursor <= upto && cursor < events.length) {
        const e = events[cursor];
        applyEvent(p, e);
        const line = narrate(p, e);
        if (line) r.log.push(line);
        cursor++;
      }
    };

    const step = (i) => {
      if (i >= events.length) return finishOpponent(p, solved, events);
      const e = events[i];
      applyThrough(i);
      if (e.type === 'bankrupt' || (e.type === 'call' && !e.count) || (e.type === 'solve' && !e.ok)) buzzer();
      else if (e.type === 'call' || (e.type === 'vowel' && e.count) || (e.type === 'solve' && e.ok)) ding();
      showOpponent(p);
      beat = after(beatFor(e), () => step(i + 1));
    };

    const skipAll = () => {
      beat?.cancel();
      beat = null;
      applyThrough(events.length - 1);
      finishOpponent(p, solved, events);
    };

    setActions(btn('SKIP AHEAD', { variant: 'ghost', onclick: skipAll }));
    step(0);
  };

  const finishOpponent = (p, solved, events) => {
    beat = null;
    if (solved) return endRound(p);

    const wentBankrupt = events.some((e) => e.type === 'bankrupt' && e.lost > 0);
    showBreak({
      tone: '',
      title: `${p.name}'s turn is over`,
      body: r.log[r.log.length - 1] ?? 'Nothing came of it.',
      tip: wentBankrupt
        ? ctx('opponent-bankrupt', { opponent: p.name })
        : ctx('opponent-turn', { opponent: p.name }),
      onNext: passTurn,
      button: 'CARRY ON',
    });
  };

  // --- turn plumbing ----------------------------------------------------

  const beginTurn = () => {
    r.turns++;
    if (r.turns > TURN_CAP) return endRound(null);
    const p = current();
    if (p.human) showTurn();
    else opponentIntro(p);
  };

  const passTurn = () => {
    r.turn = (r.turn + 1) % game.players.length;
    beginTurn();
  };

  // --- round and game ends ---------------------------------------------

  const endRound = (winner) => {
    beat?.cancel();
    beat = null;
    const youWon = winner === you();
    const banked = winner ? Math.max(winner.round, ROUND_MINIMUM) : 0;
    if (winner) {
      winner.total += banked;
      if (youWon) game.roundWins++;
    }
    for (const p of game.players) p.round = 0;
    youWon ? ding() : buzzer();

    const wrap = renderBoard(r.puzzle.answer, 'ALL');
    const last = game.round >= ROUNDS;

    setTop({ title: youWon ? 'YOU TOOK IT' : 'ROUND OVER' });
    setScreen(
      roundLabel(),
      h('div', { class: 'cat tight' }, r.puzzle.category),
      wrap,
      h('div', { class: `card center ${youWon ? 'good' : 'bad'}` },
        h('h2', { style: { color: youWon ? 'var(--good)' : 'var(--bad)' } },
          winner ? (youWon ? `You banked ${money(banked)}` : `${winner.name} banked ${money(banked)}`)
            : 'Nobody solved it'),
        // The board directly above is already showing the answer in full;
        // repeating it here just cost a line the totals needed.
        winner && winner.round < ROUND_MINIMUM
          ? h('p', { class: 'muted tiny', style: { margin: 0 } },
              `${money(ROUND_MINIMUM)} round minimum applied.`) : null),
      card(
        h('h3', {}, 'Totals'),
        ...game.players.map((p) => h('div', { class: `mathline${p.human ? ' em' : ''}` },
          h('span', { class: 'l' }, p.name),
          h('span', { class: `v${p.human ? ' good' : ''}` }, money(p.total))))),
      youWon ? null : tipChip(ctx('opponent-solved', {
        opponent: winner?.name,
        pot: banked,
      })),
      screenOpts({ dense: true })
    );

    setActions(
      btn(last ? 'SEE THE RESULT' : 'NEXT ROUND', {
        variant: 'primary tall',
        onclick: () => {
          if (last) return endGame();
          game.round++;
          r = newRound(game);
          beginTurn();
        },
      }),
      btn('STOP HERE', { variant: 'ghost', onclick: () => go('#/play') })
    );
  };

  const endGame = () => {
    const standings = [...game.players].sort((a, b) => b.total - a.total);
    // Leaders, not "first after a stable sort". A tie must not be reported as
    // her win just because YOU happens to sit at index 0 -- and a three-way
    // tie at zero is nobody's win at all.
    const top = Math.max(...game.players.map((p) => p.total));
    const leaders = top > 0 ? game.players.filter((p) => p.total === top) : [];
    const youWon = leaders.length === 1 && leaders[0] === you();
    const tied = leaders.length > 1;
    store.recordGame({
      won: youWon,
      total: you().total,
      rounds: ROUNDS,
      roundWins: game.roundWins,
    });
    const s = store.gameStats();
    youWon ? ding() : buzzer();

    setTop({ title: youWon ? 'YOU WIN' : tied ? 'A TIE' : 'GAME OVER' });
    setScreen(
      h('div', { class: `card center ${youWon ? 'good' : ''}` },
        h('h3', {}, tied ? 'Tied at the top' : 'Winner'),
        h('div', { class: 'big-num', style: { color: youWon ? 'var(--good)' : 'var(--text)' } },
          !leaders.length ? 'NOBODY' : leaders.map((p) => p.name).join(' & ')),
        h('p', { class: 'muted', style: { margin: 0 } },
          !leaders.length ? 'Three rounds, nothing banked.'
            : tied ? `${money(top)} each — that goes to a tiebreaker.`
              : `${money(top)} across ${ROUNDS} rounds.`),
        youWon ? h('p', { class: 'tiny' }, 'You would be going to the bonus round.') : null),
      card(
        h('h3', {}, 'Final standings'),
        ...standings.map((p) => h('div', { class: `mathline${p.human ? ' em' : ''}` },
          h('span', { class: 'l' }, p.name),
          h('span', { class: `v${p.human ? (youWon ? ' good' : tied ? '' : ' bad') : ''}` }, money(p.total))))),
      // Collapsed: the standings are what she wants on this screen, and a
      // second full card of lifetime totals pushed them under the buttons.
      card(mathDisclosure([
        { label: 'Games played', value: String(s.games) },
        { label: 'Games won', value: `${s.wins} of ${s.games}` },
        { label: 'Rounds taken', value: `${s.roundWins} of ${s.rounds}` },
        { label: 'Best game', value: money(s.best), emphasis: true, good: true },
      ], 'Your play record')),
      h('p', { class: 'muted center tiny' },
        'Play never moves your training stats — only drills do.'),
      screenOpts({ dense: true })
    );

    setActions(
      btn('PLAY AGAIN', {
        variant: 'primary tall',
        onclick: () => gameScreen(),
      }),
      btn('DONE', { variant: 'ghost', onclick: () => go('#/home') })
    );
  };

  beginTurn();
}

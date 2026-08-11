// Bootstrap, home screen, practice menu, routing.

import {
  h, btn, setScreen, setActions, setTop, route, startRouter, go, ring, card, primeAudio, $,
} from './ui.js';
import { loadBank } from './data.js';
import * as store from './store.js';
import { cheatSheetScreen } from './cheatsheet.js';
import { methodScreen } from './method.js';
import { glossaryScreen } from './glossary.js';
import { playScreen } from './play.js';
import { runBlock } from './drills/common.js';
import { solveOrSpin, vowelDrill, vowelNameDrill } from './drills/decision.js';
import { bonusCategory, bonusLetters, bonusSim } from './drills/bonus.js';
import { tossUp, attentionLoop } from './drills/attention.js';
import { nameShape, soundItOut, sayItExactly } from './drills/names.js';
import { DAYS, todaysDayNumber, runDay } from './lessons.js';
import { micSupported, requestMic, releaseMic } from './voice.js';

export const DRILLS = {
  'solve-or-spin': { drill: solveOrSpin, rounds: 6, blurb: 'If you know it — solve' },
  'vowel': { drill: vowelDrill, rounds: 6, blurb: 'This changes what I do next — or don\'t buy' },
  'vowel-names': { drill: vowelNameDrill, rounds: 6, blurb: 'Name? Vowel before the second consonant' },
  'bonus-category': { drill: bonusCategory, rounds: 8, blurb: 'Name offered — take anything else' },
  'bonus-letters': { drill: bonusLetters, rounds: 6, blurb: 'H, G, B + O — unless category overrides' },
  'bonus-sim': { drill: bonusSim, rounds: 3, blurb: 'Talk the whole ten. Silence loses.' },
  'toss-up': { drill: tossUp, rounds: 6, blurb: 'Board almost full — buzz a half-beat early' },
  'name-shape': { drill: nameShape, rounds: 5, blurb: 'Fire names from the blank shape' },
  'sound-it-out': { drill: soundItOut, rounds: 5, blurb: 'Names: say sounds, not letter names' },
  'attention-loop': { drill: attentionLoop, rounds: 3, blurb: 'Their turn: longest · guess · action' },
  'say-it-exactly': { drill: sayItExactly, rounds: 4, blurb: 'Every word, in order, clear ending' },
};

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

function homeScreen() {
  setTop({ title: 'WHEEL TRAINER' });
  const s = store.stats();
  const days = store.daysUntilTaping();
  const streak = store.streakDisplay();
  const dayNumber = todaysDayNumber();
  const day = DAYS[dayNumber - 1];
  const planCard = store.takePlanCard();

  // The whole countdown card is the tap target for changing the tape date --
  // a full-width button inside it pushed the stat rings below the fold.
  const countdown = h('button', {
    class: 'card center countdown', type: 'button',
    onclick: () => go('#/settings'),
  },
    h('h3', {}, days === 0 ? 'Taping is today' : days < 0 ? 'Taping has passed' : 'Days until taping'),
    h('div', { class: 'big-num countdown-num' }, days < 0 ? '—' : String(days)),
    h('p', { class: 'muted' },
      streak ? `${streak}-day streak · ${s.today} drills today` : `${s.today} drills today`),
    h('p', { class: 'muted tiny' }, 'Tap to change the tape date')
  );

  setScreen(
    countdown,

    h('div', { class: 'rings' },
      ring('Category discipline', s.categoryDiscipline),
      ring('Solve timing', s.solveTiming),
      ring('Name recall', s.nameRecall)),

    planCard ? h('div', { class: 'card', style: { borderColor: 'var(--accent)' } },
      h('h3', {}, planCard.title),
      h('p', {}, planCard.because),
      h('p', { class: 'muted' }, planCard.change)) : null,

    s.tossUpN >= 4 ? card(
      h('h3', {}, 'Toss-ups'),
      h('div', { class: 'mathline' },
        h('span', { class: 'l' }, 'Buzz rate'),
        h('span', { class: 'v' }, Math.round(s.buzzRate * 100) + '%')),
      h('div', { class: 'mathline' },
        h('span', { class: 'l' }, 'Conversion'),
        h('span', { class: 'v' }, Math.round(s.conversion * 100) + '%'))) : null,

    s.loopN ? card(
      h('h3', {}, 'Attention loop'),
      h('div', { class: 'mathline' },
        h('span', { class: 'l' }, 'Loop completion'),
        h('span', { class: 'v' }, Math.round(s.loopCompletion * 100) + '%'))) : null,

    card(
      h('h3', {}, `Day ${dayNumber} · ${day.theme}`),
      h('p', { class: 'muted' }, day.blurb)),

    h('button', {
      class: 'day', type: 'button',
      onclick: () => go('#/method'),
      style: { borderColor: 'var(--line)' },
    },
      h('div', { class: 'n' }, '?'),
      h('div', { class: 't' },
        h('b', {}, 'The method'),
        h('span', {}, 'Ethos, and why each day exists')))
  );

  setActions(
    btn(`TODAY'S LESSON`, {
      variant: 'primary tall', sub: `Day ${dayNumber} — ${day.minutes} min`,
      onclick: () => { primeAudio(); go('#/days'); },
    }),
    btn('JUST PLAY A ROUND', {
      variant: 'ghost', sub: 'spin the wheel, no scoring',
      onclick: () => { primeAudio(); go('#/play'); },
    })
  );
}

// ---------------------------------------------------------------------------
// Practice Anything
// ---------------------------------------------------------------------------

function practiceScreen() {
  setTop({ title: 'PRACTICE ANYTHING', back: () => go('#/home') });
  setScreen(
    h('p', { class: 'muted' }, 'Any drill, any time, no unlocking.'),
    ...Object.entries(DRILLS).map(([id, d]) =>
      h('button', {
        class: 'day', type: 'button',
        onclick: () => { primeAudio(); go('#/drill/' + id); },
      },
        h('div', { class: 'n' }, '▸'),
        h('div', { class: 't' }, h('b', {}, d.drill.title), h('span', {}, d.blurb))))
  );
  setActions(btn('THE LESSON PLAN', { variant: 'primary tall', onclick: () => go('#/days') }));
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

function settingsScreen() {
  setTop({ title: 'SETTINGS', back: () => go('#/home') });
  const st = store.get();
  const dateInput = h('input', {
    type: 'date', value: st.tapeDate,
    style: {
      width: '100%', minHeight: '64px', fontSize: '20px', padding: '10px 14px',
      background: 'var(--surface-2)', color: 'var(--text)',
      border: '2px solid var(--line)', borderRadius: '12px', fontFamily: 'var(--font)',
    },
    onchange: (e) => { if (e.target.value) { store.setTapeDate(e.target.value); } },
  });

  const micRow = h('div');
  const renderMic = () => {
    micRow.replaceChildren(
      h('h3', {}, 'Bonus-round voice coaching'),
      h('p', { class: 'muted' },
        'Measures how long you go silent during the ten seconds. Energy only — it never listens to words, and nothing leaves the phone.'),
      !micSupported()
        ? h('p', { class: 'muted' }, 'Not available in this browser.')
        : btn(store.settings().mic ? 'MIC COACHING: ON' : 'MIC COACHING: OFF', {
          variant: store.settings().mic ? 'good small' : 'small',
          onclick: async () => {
            if (store.settings().mic) {
              store.settings().mic = false;
              releaseMic();
            } else {
              store.settings().mic = await requestMic();
            }
            store.save();
            renderMic();
          },
        })
    );
  };
  renderMic();

  setScreen(
    card(h('h3', {}, 'Tape date'), dateInput,
      h('p', { class: 'muted', style: { marginTop: '10px' } },
        `${store.daysUntilTaping()} days from today.`)),
    card(micRow),
    card(
      h('h3', {}, 'Progress'),
      h('p', { class: 'muted' }, `${store.stats().totalDrills} drills logged. Everything is stored on this phone only.`),
      btn('ERASE ALL PROGRESS', {
        variant: 'small ghost',
        style: { color: 'var(--bad)', borderColor: 'var(--bad)' },
        onclick: () => {
          if (confirm('Erase all progress? This cannot be undone.')) { store.resetAll(); go('#/home'); location.reload(); }
        },
      }))
  );
  setActions(
    btn('DONE', { variant: 'primary tall', onclick: () => go('#/home') }),
    btn('THE METHOD', { variant: 'ghost', onclick: () => go('#/method') })
  );
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function fatal(err) {
  setTop({ title: 'WHEEL TRAINER' });
  setScreen(card(
    h('h2', {}, 'Something did not load'),
    h('p', { class: 'muted' }, String(err?.message ?? err)),
    btn('TRY AGAIN', { variant: 'primary', onclick: () => location.reload() })));
}

async function boot() {
  store.load();
  try {
    await loadBank();
  } catch (e) {
    return fatal(e);
  }

  route('home', homeScreen);
  route('practice', practiceScreen);
  route('cheat', cheatSheetScreen);
  route('method', methodScreen);
  route('glossary', glossaryScreen);
  route('play', playScreen);
  route('settings', settingsScreen);
  route('days', () => import('./lessons.js').then((m) => m.lessonTreeScreen()));
  route('day/:n', ({ n }) => runDay(Number(n)));
  route('drill/:id', ({ id }) => {
    const entry = DRILLS[id];
    if (!entry) return go('#/practice');
    runBlock({
      drill: entry.drill,
      rounds: entry.rounds,
      onDone: () => go('#/practice'),
    });
  });

  for (const b of document.querySelectorAll('[data-go]')) {
    b.addEventListener('click', () => { primeAudio(); go(b.dataset.go); });
  }

  startRouter('#/home');
  window.addEventListener('pagehide', store.flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') store.flush();
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline is a bonus, not a blocker */ });
  }
}

boot();

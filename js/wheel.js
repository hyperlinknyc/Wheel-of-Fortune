// The wheel, drawn as SVG so it scales cleanly and ships no assets.
//
// Shared by the solo round and the three-player game. It is deliberately the
// same object in both: the wheel composition is asserted against the taught
// constants in tools/validate.mjs, and two hand-rolled copies would be two
// chances to drift away from that.

import { WHEEL, BANKRUPT, LOSE_A_TURN } from './strategy.js';

export const SEG = 360 / WHEEL.length;

const wedgeClass = (w) =>
  w === BANKRUPT ? 'bankrupt' : w === LOSE_A_TURN ? 'lose' : 'cash';

const shortLabel = (w) =>
  w === BANKRUPT ? 'BANK' : w === LOSE_A_TURN ? 'LOSE' : String(w);

export function wheelSvg() {
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

// Where the rotor was left. Module-level because there is only ever one wheel
// on screen, and carrying the angle forward is what stops consecutive spins
// from visibly snapping back to zero between them.
let rotation = 0;

/**
 * Spin so `landed` finishes under the pointer at 12 o'clock.
 * Call after the SVG is in the document.
 */
export function spinAnimation(landed, spinMs) {
  const jitter = (Math.random() - 0.5) * (SEG * 0.55);
  const target = -(landed * SEG + SEG / 2) + jitter;
  rotation += 360 * 4 + (((target - rotation) % 360) + 360) % 360;

  const rotor = typeof document !== 'undefined' ? document.querySelector('.wheel-rotor') : null;
  if (!rotor) return rotation;
  rotor.style.transition = `transform ${spinMs}ms cubic-bezier(.17,.67,.21,1)`;
  // Next frame, so the browser paints the start position first.
  requestAnimationFrame(() => { rotor.style.transform = `rotate(${rotation}deg)`; });
  return rotation;
}

/** Freeze the rotor where it stopped so a re-render cannot snap it back. */
export function lockRotor() {
  const rotor = typeof document !== 'undefined' ? document.querySelector('.wheel-rotor') : null;
  if (!rotor) return;
  rotor.style.transition = 'none';
  rotor.style.transform = `rotate(${rotation}deg)`;
}

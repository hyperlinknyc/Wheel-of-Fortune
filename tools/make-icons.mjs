#!/usr/bin/env node
// Generates the home-screen icons as real PNGs with no dependencies.
// The mark is three board tiles with the middle one lit -- legible at 60px,
// and inside the maskable safe zone so iOS can round the corners.

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return (buf) => {
    let c = -1;
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(body));
  return Buffer.concat([len, body, crc]);
}

function png(width, height, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // truecolour
  const raw = Buffer.alloc(height * (width * 3 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0; // filter: none
    rgb.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const BG = hex('#12161F');
const LIT = hex('#F4F7FB');
const ACCENT = hex('#FFB020');
const EDGE = hex('#2A3344');

function draw(S) {
  const buf = Buffer.alloc(S * S * 3);
  const put = (x, y, c) => {
    const i = (y * S + x) * 3;
    buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2];
  };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) put(x, y, BG);

  const tw = Math.round(S * 0.18);
  const th = Math.round(S * 0.26);
  const gap = Math.round(S * 0.04);
  const total = tw * 3 + gap * 2;
  const x0 = Math.round((S - total) / 2);
  const y0 = Math.round((S - th) / 2);
  const r = Math.max(2, Math.round(S * 0.018));

  const rounded = (px, py, x, y, w, hgt) => {
    const dx = Math.min(px - x, x + w - 1 - px);
    const dy = Math.min(py - y, y + hgt - 1 - py);
    if (dx >= r || dy >= r) return true;
    const cx = dx < r ? r - dx : 0;
    const cy = dy < r ? r - dy : 0;
    return cx * cx + cy * cy <= r * r;
  };

  for (let t = 0; t < 3; t++) {
    const x = x0 + t * (tw + gap);
    const fill = t === 1 ? ACCENT : LIT;
    for (let py = y0; py < y0 + th; py++) {
      for (let px = x; px < x + tw; px++) {
        if (!rounded(px, py, x, y0, tw, th)) continue;
        const border = px < x + 2 || px >= x + tw - 2 || py < y0 + 2 || py >= y0 + th - 2;
        put(px, py, border && t !== 1 ? EDGE : fill);
      }
    }
  }
  return buf;
}

mkdirSync(resolve(ROOT, 'icons'), { recursive: true });
for (const size of [180, 192, 512]) {
  const file = resolve(ROOT, `icons/icon-${size}.png`);
  writeFileSync(file, png(size, size, draw(size)));
  console.log('wrote', `icons/icon-${size}.png`);
}

// The walkable rooms (dorm, classroom, dining hall), baked into one smooth picture per room at ART_RES times the
// world's resolution: a continuous plank floor instead of a repeated tile, plaster walls with a skirting board,
// furniture drawn with shading and soft shadows, daylight falling in from the windows and shade along the walls.
// The room's tile layer stays underneath, invisible, for collisions.
import Phaser from 'phaser';
import { TILE } from '../content/campus';
import { RT } from '../content/dormroom';
import { DT } from '../content/dining';
import { ART_RES, rng } from './textures';

type Ctx = CanvasRenderingContext2D;
const R = ART_RES;

const FLOORISH = new Set<number>([RT.FLOOR, RT.DESK, RT.RUG, RT.BED, RT.TV, RT.TABLE_L, RT.TABLE_R, RT.SCREEN, DT.COUNTER, DT.TABLE, DT.KANTIN]);
const WALLISH = new Set<number>([RT.WALL, RT.WALL_BASE, RT.BOARD, RT.WINDOW, RT.DOOR, RT.LOCKER, RT.SHELF, DT.SINK]);

function lin(c: Ctx, x0: number, y0: number, x1: number, y1: number, stops: Array<[number, string]>) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  for (const [o, s] of stops) g.addColorStop(o, s);
  return g;
}
function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number | number[], fill: string | CanvasGradient) {
  c.fillStyle = fill; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill();
}
function softShadow(c: Ctx, x: number, y: number, w: number, h: number, a = 0.28) {
  c.save();
  c.shadowColor = `rgba(0,0,0,${a})`; c.shadowBlur = 3 * R; c.shadowOffsetX = 1.5 * R; c.shadowOffsetY = 2 * R;
  c.fillStyle = `rgba(0,0,0,${a * 0.5})`; c.beginPath(); c.roundRect(x, y, w, h, 2); c.fill();
  c.restore();
}

// ---------- floor and walls ----------

/** oak planks running east–west across the whole room, each its own length and shade */
function floor(c: Ctx, W: number, H: number) {
  c.fillStyle = '#b8874f'; c.fillRect(0, 0, W, H);
  const r = rng(717);
  for (let y = 0; y < H; y += 8) {
    let x = -r() * 60;
    while (x < W) {
      const len = 44 + r() * 56, tone = r();
      const base = tone < 0.2 ? '#bf8f58' : tone > 0.8 ? '#d3a870' : '#c99b63';
      rr(c, x + 0.4, y + 0.4, len - 0.8, 7.2, 0.6, base);
      c.fillStyle = lin(c, 0, y, 0, y + 8, [[0, 'rgba(255,240,210,0.22)'], [0.5, 'rgba(255,255,255,0)'], [1, 'rgba(70,40,15,0.18)']]);
      c.fillRect(x + 0.4, y + 0.4, len - 0.8, 7.2);
      c.strokeStyle = 'rgba(110,70,30,0.22)'; c.lineWidth = 0.35;
      for (let k = 0; k < 2; k++) { const gy = y + 2 + r() * 4; c.beginPath(); c.moveTo(x + 2, gy); c.bezierCurveTo(x + len * 0.3, gy - 0.8, x + len * 0.6, gy + 0.8, x + len - 2, gy); c.stroke(); }
      if (r() < 0.25) { c.fillStyle = 'rgba(100,60,25,0.35)'; c.beginPath(); c.ellipse(x + 8 + r() * (len - 16), y + 4, 1.4, 0.8, 0, 0, Math.PI * 2); c.fill(); } // knot
      x += len;
    }
  }
}

function plaster(c: Ctx, x: number, y: number, w: number, h: number, seed: number) {
  c.fillStyle = '#efe6d6'; c.fillRect(x, y, w, h);
  c.fillStyle = lin(c, 0, y, 0, y + h, [[0, 'rgba(255,255,255,0.25)'], [1, 'rgba(120,100,70,0.06)']]); c.fillRect(x, y, w, h);
  const r = rng(seed);
  for (let i = 0; i < 18; i++) { c.fillStyle = r() < 0.5 ? 'rgba(120,100,70,0.06)' : 'rgba(255,255,255,0.35)'; c.beginPath(); c.arc(x + r() * w, y + r() * h, 0.3 + r() * 0.4, 0, Math.PI * 2); c.fill(); }
}

function skirting(c: Ctx, x: number, y: number, w: number) {
  c.fillStyle = lin(c, 0, y, 0, y + 8, [[0, '#b07a45'], [0.25, '#8a5a32'], [1, '#6a4324']]); c.fillRect(x, y, w, 8);
  c.fillStyle = 'rgba(255,235,200,0.45)'; c.fillRect(x, y, w, 0.8);
}

// ---------- furniture ----------

function board(c: Ctx, o: number, y: number, up: boolean, down: boolean, left: boolean, right: boolean, seed: number) {
  plaster(c, o, y, 32, 32, seed);
  const top = up ? y : y + 2, bot = down ? y + 32 : y + 28;
  const x0 = left ? o : o + 1.5, x1 = right ? o + 32 : o + 30.5;
  c.fillStyle = '#7a5434'; c.fillRect(x0, top, x1 - x0, bot - top);
  const fx0 = left ? o : o + 3, fx1 = right ? o + 32 : o + 29, fy0 = up ? y : y + 4, fy1 = down ? y + 32 : y + 26;
  c.fillStyle = lin(c, fx0, fy0, fx1, fy1, [[0, '#356a44'], [1, '#244a30']]); c.fillRect(fx0, fy0, fx1 - fx0, fy1 - fy0);
  // chalk dust: soft smudges where it was wiped, and a few lines of writing
  const r = rng(seed);
  for (let i = 0; i < 2; i++) { const sx = fx0 + r() * (fx1 - fx0), sy = fy0 + r() * (fy1 - fy0); const g = c.createRadialGradient(sx, sy, 0, sx, sy, 8); g.addColorStop(0, 'rgba(255,255,255,0.1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(sx - 8, sy - 8, 16, 16); }
  c.strokeStyle = 'rgba(245,245,235,0.7)'; c.lineWidth = 0.6; c.lineCap = 'round';
  for (let i = 0; i < 2; i++) {
    const ly = fy0 + 5 + i * 8 + r() * 2;
    if (ly > fy1 - 3) break;
    let x = fx0 + 3 + r() * 4; c.beginPath(); c.moveTo(x, ly);
    const end = Math.min(fx1 - 3, x + 8 + r() * 14);
    while (x < end) { x += 1.2; c.lineTo(x, ly + Math.sin(x * 1.7) * 0.7); }
    c.stroke();
  }
  if (!down) {
    c.fillStyle = '#5b3a22'; c.fillRect(x0, y + 26, x1 - x0, 2.5); // chalk tray
    c.fillStyle = '#f4f4ec'; c.fillRect(o + 8, y + 25.6, 3, 0.9);
  }
}

function windowTile(c: Ctx, o: number, y: number, seed: number) {
  plaster(c, o, y, 32, 32, seed);
  rr(c, o + 3, y + 3, 26, 24, 1, '#8a6040');
  c.fillStyle = lin(c, 0, y + 5, 0, y + 25, [[0, '#d9eefa'], [0.45, '#a6d2ee'], [1, '#7fb4d8']]); c.fillRect(o + 5, y + 5, 22, 20);
  c.fillStyle = lin(c, o + 5, 0, o + 27, 0, [[0, 'rgba(255,255,255,0)'], [0.55, 'rgba(255,255,255,0)'], [0.62, 'rgba(255,255,255,0.4)'], [0.72, 'rgba(255,255,255,0.08)'], [1, 'rgba(255,255,255,0)']]); c.fillRect(o + 5, y + 5, 22, 20);
  c.fillStyle = '#8a6040'; c.fillRect(o + 15, y + 5, 2, 20); c.fillRect(o + 5, y + 14, 22, 1.4);
  // curtains gathered at each side, in soft folds
  for (const [cx, dir] of [[o + 3.5, 1], [o + 28.5, -1]] as const) {
    c.fillStyle = lin(c, cx - 3, 0, cx + 3, 0, [[0, '#d9c49a'], [0.5, '#f0e2c0'], [1, '#c9b285']]);
    c.beginPath(); c.moveTo(cx - 2.5 * dir, y + 1.5); c.lineTo(cx + 3 * dir, y + 1.5); c.quadraticCurveTo(cx + 1.5 * dir, y + 16, cx + 3.5 * dir, y + 28); c.lineTo(cx - 2.5 * dir, y + 28); c.closePath(); c.fill();
  }
  c.fillStyle = '#d8d0c0'; c.fillRect(o + 2, y + 27, 28, 2.5); c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(o + 2, y + 29.5, 28, 1);
}

function door(c: Ctx, o: number, y: number, seed: number) {
  plaster(c, o, y, 32, 32, seed);
  rr(c, o + 4, y + 2, 24, 30, 1, '#7a4e2a');
  c.fillStyle = lin(c, o + 7, 0, o + 25, 0, [[0, '#7a5030'], [0.4, '#6a4224'], [1, '#4e2f18']]); c.fillRect(o + 7, y + 5, 18, 27);
  c.strokeStyle = 'rgba(30,15,5,0.4)'; c.lineWidth = 0.6; c.strokeRect(o + 9.5, y + 8, 13, 9); c.strokeRect(o + 9.5, y + 20, 13, 10);
  c.fillStyle = '#e0b04a'; c.beginPath(); c.arc(o + 22, y + 19, 1.1, 0, Math.PI * 2); c.fill();
  // the green exit sign above, glowing
  const g = c.createRadialGradient(o + 16, y + 2, 0, o + 16, y + 2, 9); g.addColorStop(0, 'rgba(120,230,150,0.35)'); g.addColorStop(1, 'rgba(120,230,150,0)'); c.fillStyle = g; c.fillRect(o + 4, y - 6, 24, 16);
  rr(c, o + 10, y, 12, 4, 0.6, '#2f9a55'); c.fillStyle = '#e8ffe8'; c.fillRect(o + 12.5, y + 1.4, 7, 1.2);
}

function desk(c: Ctx, o: number, y: number, seed: number) {
  softShadow(c, o + 2.5, y + 7, 27, 20);
  c.fillStyle = '#5c646a'; c.fillRect(o + 4, y + 18, 1.6, 10); c.fillRect(o + 26.4, y + 18, 1.6, 10); // steel legs
  rr(c, o + 2, y + 6, 28, 14, 1.2, lin(c, o + 2, y + 6, o + 30, y + 20, [[0, '#e6c48e'], [1, '#c79e66']]));
  c.fillStyle = '#a97f4b'; c.fillRect(o + 2, y + 18.5, 28, 1.6);
  const r = rng(seed);
  // an open exercise book, a pencil case
  rr(c, o + 7, y + 8.5, 11, 7, 0.4, '#fbfbf6'); c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(o + 12.3, y + 8.5, 0.5, 7);
  c.strokeStyle = 'rgba(80,110,160,0.5)'; c.lineWidth = 0.3; for (let l = 0; l < 3; l++) { c.beginPath(); c.moveTo(o + 8, y + 10.5 + l * 1.6); c.lineTo(o + 11.5, y + 10.5 + l * 1.6); c.stroke(); }
  rr(c, o + 19.5, y + 10, 7, 3.5, 1.4, ['#4f8fc0', '#c0392b', '#3d7a45', '#8e5ea2'][Math.floor(r() * 4)]);
}

function studyTable(c: Ctx, o: number, y: number, left: boolean, seed: number) {
  const x0 = left ? o + 2 : o, x1 = left ? o + 32 : o + 30;
  softShadow(c, x0 + 0.5, y + 5, x1 - x0, 18);
  c.fillStyle = '#5c646a'; c.fillRect(left ? o + 4 : o + 25, y + 20, 1.8, 8);
  rr(c, x0, y + 4, x1 - x0, 18, left ? [1.4, 0, 0, 1.4] : [0, 1.4, 1.4, 0], lin(c, o, y + 4, o + 32, y + 22, [[0, '#e6c48e'], [1, '#c79e66']]));
  c.fillStyle = 'rgba(255,240,210,0.5)'; c.fillRect(x0, y + 4, x1 - x0, 0.8);
  c.fillStyle = '#a97f4b'; c.fillRect(x0, y + 20.4, x1 - x0, 1.6);
  const r = rng(seed);
  const book = (bx: number, by: number, w: number, h: number) => { rr(c, bx + 0.5, by + 0.7, w, h, 0.4, 'rgba(0,0,0,0.15)'); rr(c, bx, by, w, h, 0.4, '#fbfbf6'); c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(bx + w / 2 - 0.2, by, 0.4, h); };
  if (left) { book(o + 8, y + 6, 9, 5); book(o + 9, y + 14, 10, 5); rr(c, o + 20, y + 6, 5, 4, 0.5, '#c0392b'); c.fillStyle = '#e0b04a'; c.save(); c.translate(o + 24, y + 16.5); c.rotate(-0.25); c.fillRect(-3.5, -0.4, 7, 0.9); c.restore(); }
  else { book(o + 14, y + 6, 9, 5); book(o + 12, y + 14, 10, 5); rr(c, o + 5, y + 15, 5, 4, 0.5, '#4f8fc0'); rr(c, o + 5, y + 6, 6, 4, 0.5, '#3d7a45'); }
  if (r() < 0.5) { c.fillStyle = 'rgba(255,255,255,0.8)'; c.beginPath(); c.arc(left ? o + 27 : o + 25, y + 8, 1.4, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(140,90,50,0.8)'; c.beginPath(); c.arc(left ? o + 27 : o + 25, y + 8, 0.9, 0, Math.PI * 2); c.fill(); } // a glass of tea
}

function rug(c: Ctx, o: number, y: number) {
  c.fillStyle = '#9b3b3b'; c.fillRect(o, y, 32, 32);
  c.strokeStyle = '#c9a24a'; c.lineWidth = 2; c.strokeRect(o + 4, y + 4, 24, 24);
  c.strokeStyle = 'rgba(240,220,170,0.6)'; c.lineWidth = 0.6; c.strokeRect(o + 7, y + 7, 18, 18);
  c.fillStyle = '#2f4a6b'; c.beginPath(); c.moveTo(o + 16, y + 10); c.lineTo(o + 22, y + 16); c.lineTo(o + 16, y + 22); c.lineTo(o + 10, y + 16); c.closePath(); c.fill();
  c.fillStyle = '#c9a24a'; c.beginPath(); c.arc(o + 16, y + 16, 1.6, 0, Math.PI * 2); c.fill();
  const r = rng(o * 7 + y);
  for (let i = 0; i < 40; i++) { c.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,220,190,0.08)'; c.fillRect(o + r() * 32, y + r() * 32, 0.6, 0.6); } // wool texture
}

const BLANKETS = ['#22365c', '#6e1f2d', '#2f6b4a', '#4a4f8a', '#7a5a2a', '#355a7a'];
function bed(c: Ctx, o: number, y: number, seed: number) {
  softShadow(c, o + 2, y + 1, 28, 29);
  rr(c, o + 2, y + 1, 28, 29, 1.5, lin(c, o + 2, 0, o + 30, 0, [[0, '#7d868c'], [0.5, '#5a6268'], [1, '#3e454a']]));   // steel frame
  rr(c, o + 3.5, y + 2.5, 25, 26, 1.2, '#f1efe8');                                                                   // mattress
  const r = rng(seed);
  const col = BLANKETS[Math.floor(r() * BLANKETS.length)];
  // the blanket, folded back at the top, with soft folds across it
  rr(c, o + 3.5, y + 9, 25, 19.5, 1.2, lin(c, o + 3.5, y + 9, o + 28.5, y + 28.5, [[0, col], [1, col]]));
  c.fillStyle = lin(c, o + 3.5, 0, o + 28.5, 0, [[0, 'rgba(255,255,255,0.14)'], [0.5, 'rgba(255,255,255,0)'], [1, 'rgba(0,0,0,0.18)']]); c.fillRect(o + 3.5, y + 9, 25, 19.5);
  c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 0.6;
  for (let i = 0; i < 2; i++) { const fy = y + 14 + i * 6 + r() * 2; c.beginPath(); c.moveTo(o + 4, fy); c.bezierCurveTo(o + 12, fy - 1.5, o + 18, fy + 1.5, o + 28, fy - 0.5); c.stroke(); }
  c.fillStyle = 'rgba(255,255,255,0.85)'; c.fillRect(o + 3.5, y + 9, 25, 2.2); // the sheet folded over
  // pillow
  rr(c, o + 6, y + 3, 20, 5.6, 2.4, lin(c, o + 6, y + 3, o + 6, y + 8.6, [[0, '#ffffff'], [1, '#d9dcdf']]));
  c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(o + 12, y + 4); c.quadraticCurveTo(o + 14, y + 6, o + 13, y + 8); c.stroke();
}

function lockers(c: Ctx, o: number, y: number) {
  c.fillStyle = lin(c, o, 0, o + 32, 0, [[0, '#93ad9e'], [1, '#6c8678']]); c.fillRect(o, y, 32, 32);
  for (const dx of [0, 16]) {
    c.strokeStyle = 'rgba(40,60,50,0.55)'; c.lineWidth = 0.8; c.strokeRect(o + dx + 0.8, y + 0.8, 14.4, 30.4);
    c.strokeStyle = 'rgba(40,60,50,0.5)'; c.lineWidth = 0.6;
    for (let v = 0; v < 4; v++) { c.beginPath(); c.moveTo(o + dx + 3.5, y + 4 + v * 2); c.lineTo(o + dx + 12, y + 4 + v * 2); c.stroke(); }  // vents
    rr(c, o + dx + (dx ? 3 : 11), y + 13, 1.8, 5, 0.8, lin(c, 0, y + 13, 0, y + 18, [[0, '#f0f3f1'], [1, '#9aa7a0']])); // handle
    c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(o + dx + 1.2, y + 1.2, 1, 29.6);
  }
}

function shelf(c: Ctx, o: number, y: number, seed: number) {
  c.fillStyle = lin(c, o, 0, o + 32, 0, [[0, '#7a5030'], [1, '#5a3a20']]); c.fillRect(o, y, 32, 32);
  const r = rng(seed);
  const cols = ['#c0392b', '#2f6b9a', '#e0b04a', '#3d7a45', '#8e5ea2', '#d9822b', '#2a3a5a', '#e9e4d8'];
  for (let row = 0; row < 3; row++) {
    const base = y + 10 * row + 9;
    c.fillStyle = '#3f2814'; c.fillRect(o + 1, y + 10 * row + 1, 30, 8); // the dark back of the shelf
    let x = o + 2;
    while (x < o + 29) {
      const w = 2 + r() * 2.4, h = 5 + r() * 3, lean = r() < 0.1;
      if (x + w > o + 30) break;
      c.fillStyle = cols[Math.floor(r() * cols.length)];
      c.save(); c.translate(x, base); if (lean) c.rotate(-0.25);
      c.fillRect(0, -h, w, h);
      c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(0, -h, 0.5, h); c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(w - 0.5, -h, 0.5, h);
      c.fillStyle = 'rgba(255,240,200,0.6)'; c.fillRect(0.4, -h + 1.4, w - 0.8, 0.5);
      c.restore();
      x += w + 0.25 + (lean ? 1 : 0);
    }
    c.fillStyle = lin(c, 0, base, 0, base + 2, [[0, '#a07048'], [1, '#5a3a20']]); c.fillRect(o + 1, base, 30, 2);
  }
}

function tv(c: Ctx, o: number, y: number) {
  rug(c, o, y);
  softShadow(c, o + 2, y + 15, 28, 15);
  rr(c, o + 2, y + 16, 28, 14, 1, lin(c, o, y + 16, o + 32, y + 30, [[0, '#7a5030'], [1, '#4e2f18']]));
  c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(o + 16, y + 18); c.lineTo(o + 16, y + 29); c.stroke();
  rr(c, o + 5, y + 2, 22, 15, 1.2, '#1b1f22');
  c.fillStyle = lin(c, o + 7, y + 4, o + 25, y + 15, [[0, '#7fb8e0'], [0.5, '#3f78a8'], [1, '#22476b']]); c.fillRect(o + 7, y + 4, 18, 11);
  c.fillStyle = lin(c, o + 7, 0, o + 25, 0, [[0, 'rgba(255,255,255,0)'], [0.6, 'rgba(255,255,255,0.25)'], [0.7, 'rgba(255,255,255,0)']]); c.fillRect(o + 7, y + 4, 18, 11);
  c.fillStyle = '#e0b04a'; c.beginPath(); c.arc(o + 24, y + 16.3, 0.4, 0, Math.PI * 2); c.fill();
}

function counter(c: Ctx, o: number, y: number, seed: number) {
  softShadow(c, o, y + 5, 32, 21);
  c.fillStyle = lin(c, 0, y + 4, 0, y + 26, [[0, '#dfe4e7'], [0.2, '#b8c0c5'], [1, '#868e93']]); c.fillRect(o, y + 4, 32, 22);
  c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect(o, y + 4, 32, 1);
  c.fillStyle = '#5f676c'; c.fillRect(o, y + 24, 32, 2);
  const foods = [['#e0b04a', '#c99230'], ['#c0392b', '#8f2a1f'], ['#7fb466', '#5d8f46'], ['#d9822b', '#a65f1d'], ['#efe6c8', '#cfc4a0']];
  const r = rng(seed);
  for (const tx of [o + 2.5, o + 17]) {
    rr(c, tx, y + 9.5, 12.5, 10, 0.8, '#9aa3a9');
    const [f0, f1] = foods[Math.floor(r() * foods.length)];
    rr(c, tx + 0.8, y + 10.3, 10.9, 8.4, 0.6, lin(c, tx, y + 10, tx + 12, y + 19, [[0, f0], [1, f1]]));
    for (let k = 0; k < 7; k++) { c.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)'; c.beginPath(); c.arc(tx + 2 + r() * 8.5, y + 12 + r() * 5, 0.5 + r() * 0.6, 0, Math.PI * 2); c.fill(); }
  }
}

function diningTable(c: Ctx, o: number, y: number, left: boolean, right: boolean, seed: number) {
  const x0 = left ? o + 1.5 : o, x1 = right ? o + 30.5 : o + 32;
  softShadow(c, x0, y + 6, x1 - x0, 19, 0.22);
  c.fillStyle = lin(c, 0, y + 6, 0, y + 25, [[0, '#f4e6c8'], [1, '#dcc59c']]);
  c.beginPath(); c.roundRect(x0, y + 6, x1 - x0, 19, [left ? 1.5 : 0, right ? 1.5 : 0, right ? 1.5 : 0, left ? 1.5 : 0]); c.fill();
  c.fillStyle = '#c4ab80'; c.fillRect(x0, y + 23.4, x1 - x0, 1.6);
  const r = rng(seed);
  const plate = (px: number, py: number) => {
    c.fillStyle = 'rgba(0,0,0,0.12)'; c.beginPath(); c.ellipse(px + 0.5, py + 0.8, 4.2, 3.2, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(px, py, 4.2, 3.2, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(150,160,170,0.5)'; c.lineWidth = 0.4; c.beginPath(); c.ellipse(px, py, 2.9, 2.1, 0, 0, Math.PI * 2); c.stroke();
    if (r() < 0.6) { c.fillStyle = ['#e0b04a', '#c0392b', '#7fb466', '#d9822b'][Math.floor(r() * 4)]; c.beginPath(); c.ellipse(px, py, 2.2, 1.5, 0, 0, Math.PI * 2); c.fill(); }
  };
  plate(o + 8, y + 12); plate(o + 24, y + 18);
  if (r() < 0.7) { c.fillStyle = 'rgba(210,235,250,0.8)'; rr(c, o + 15, y + 9, 3, 4, 0.8, 'rgba(210,235,250,0.85)'); c.fillStyle = 'rgba(255,255,255,0.9)'; c.fillRect(o + 15.4, y + 9.3, 0.6, 3.4); } // a glass
}

function sink(c: Ctx, o: number, y: number, seed: number) {
  plaster(c, o, y, 32, 32, seed);
  for (let ty = 0; ty < 32; ty += 6) for (let tx = 0; tx < 32; tx += 6) { rr(c, o + tx + 0.3, y + ty + 0.3, 5.4, 5.4, 0.4, (tx + ty) % 12 ? '#e9eef0' : '#dfe6e9'); } // tiles behind
  c.fillStyle = 'rgba(0,0,0,0.12)'; c.beginPath(); c.ellipse(o + 18, y + 25, 12, 3, 0, 0, Math.PI * 2); c.fill();
  rr(c, o + 6, y + 8, 22, 16, 3, lin(c, o + 6, y + 8, o + 28, y + 24, [[0, '#ffffff'], [1, '#c9d0d4']]));
  rr(c, o + 9, y + 11.5, 16, 9, 3, lin(c, 0, y + 11.5, 0, y + 20.5, [[0, '#a9b6bd'], [1, '#e6ecef']]));
  c.fillStyle = lin(c, o + 15, 0, o + 18, 0, [[0, '#e6eaed'], [1, '#7d858a']]); c.fillRect(o + 15.3, y + 4, 2.6, 8);
  c.fillRect(o + 13.5, y + 3.5, 6.2, 1.6);
  rr(c, o + 2, y + 6, 3, 10, 1, '#fbfbf7'); // soap dispenser
}

function kantin(c: Ctx, o: number, y: number, seed: number) {
  softShadow(c, o, y + 3, 32, 25);
  c.fillStyle = lin(c, 0, y + 2, 0, y + 28, [[0, '#e4574a'], [0.2, '#c0392b'], [1, '#8f2a1f']]); c.fillRect(o, y + 2, 32, 26);
  c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(o, y + 2, 32, 0.8);
  // a glass display case of snacks
  rr(c, o + 2, y + 6, 28, 15, 1, 'rgba(220,240,250,0.35)');
  const r = rng(seed);
  const snacks = ['#f2c14e', '#e9e4d8', '#3d7a45', '#2f6b9a', '#d9822b', '#8e5ea2'];
  for (let i = 0; i < 9; i++) { rr(c, o + 3.5 + (i % 5) * 5.3, y + 7.5 + Math.floor(i / 5) * 6.5, 4.4, 5, 0.6, snacks[Math.floor(r() * snacks.length)]); c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(o + 3.8 + (i % 5) * 5.3, y + 7.8 + Math.floor(i / 5) * 6.5, 0.8, 4.4); }
  c.fillStyle = lin(c, o + 2, 0, o + 30, 0, [[0, 'rgba(255,255,255,0)'], [0.6, 'rgba(255,255,255,0.3)'], [0.7, 'rgba(255,255,255,0)']]); c.fillRect(o + 2, y + 6, 28, 15);
  c.fillStyle = '#5a3a20'; c.fillRect(o + 4, y + 22.5, 10, 3); // the till
}

function screen(c: Ctx, o: number, y: number) {
  for (let i = 0; i < 2; i++) {
    const py = y + i * 16, dx = i ? 3 : -3;
    softShadow(c, o + 9 + dx, py, 15, 16, 0.25);
    rr(c, o + 9 + dx, py, 15, 16, 0.6, lin(c, o + 9 + dx, 0, o + 24 + dx, 0, [[0, '#8a5a32'], [1, '#5a3a20']]));
    c.fillStyle = lin(c, o + 11 + dx, 0, o + 22 + dx, 0, [[0, '#f6ecd4'], [0.55, '#ecdfc0'], [1, '#d2bf98']]); c.fillRect(o + 11 + dx, py + 3, 11, 12);
    c.fillStyle = 'rgba(181,104,74,0.7)'; for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(o + 13.5 + dx + k * 3, py + 7 + (k % 2) * 3, 0.8, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#d1a64a'; c.fillRect(o + 15 + dx, py + 15, 3, 0.8);
  }
}

// ---------- the bake ----------

/** paints a room (tile ids in rows) into one texture; place it at the room's origin with setScale(1 / ART_RES) */
export function bakeRoom(scene: Phaser.Scene, key: string, data: number[][]): string {
  if (scene.textures.exists(key)) return key;
  const H = data.length, W = data[0].length;
  const tex = scene.textures.createCanvas(key, W * TILE * R, H * TILE * R)!;
  const c = tex.getContext();
  c.setTransform(R, 0, 0, R, 0, 0);
  c.lineCap = 'round'; c.lineJoin = 'round';
  const at = (x: number, y: number) => data[y]?.[x] ?? -1;
  const seed = (x: number, y: number) => x * 7919 + y * 104729 + key.length * 31;

  floor(c, W * TILE, H * TILE);
  // the walls and everything on them
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = at(x, y), o = x * TILE, py = y * TILE;
    if (!WALLISH.has(t) && t !== RT.WALL_BASE) continue;
    if (t === RT.WALL) {
      plaster(c, o, py, TILE, TILE, seed(x, y));
      if (y === 0) { c.fillStyle = 'rgba(120,100,70,0.12)'; c.fillRect(o, py, TILE, 3); c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(o, py + 3, TILE, 0.7); } // cornice
      if (x === 0) { c.fillStyle = lin(c, o + TILE - 4, 0, o + TILE, 0, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(60,40,20,0.18)']]); c.fillRect(o + TILE - 4, py, 4, TILE); }
      if (x === W - 1) { c.fillStyle = lin(c, o, 0, o + 4, 0, [[0, 'rgba(60,40,20,0.12)'], [1, 'rgba(0,0,0,0)']]); c.fillRect(o, py, 4, TILE); }
    } else if (t === RT.WALL_BASE) { plaster(c, o, py, TILE, TILE, seed(x, y)); skirting(c, o, py + 24, TILE); }
    else if (t === RT.BOARD) board(c, o, py, at(x, y - 1) === RT.BOARD, at(x, y + 1) === RT.BOARD, at(x - 1, y) === RT.BOARD, at(x + 1, y) === RT.BOARD, seed(x, y));
    else if (t === RT.WINDOW) windowTile(c, o, py, seed(x, y));
    else if (t === RT.DOOR) door(c, o, py, seed(x, y));
    else if (t === RT.LOCKER) lockers(c, o, py);
    else if (t === RT.SHELF) shelf(c, o, py, seed(x, y));
    else if (t === DT.SINK) sink(c, o, py, seed(x, y));
  }
  // shade on the floor along the walls, and daylight from the windows
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!FLOORISH.has(at(x, y))) continue;
    const o = x * TILE, py = y * TILE;
    const wallAbove = WALLISH.has(at(x, y - 1)), wallLeft = WALLISH.has(at(x - 1, y)), wallRight = WALLISH.has(at(x + 1, y));
    if (wallAbove) { c.fillStyle = lin(c, 0, py, 0, py + 10, [[0, 'rgba(50,30,10,0.32)'], [1, 'rgba(50,30,10,0)']]); c.fillRect(o, py, TILE, 10); }
    if (wallLeft) { c.fillStyle = lin(c, o, 0, o + 8, 0, [[0, 'rgba(50,30,10,0.25)'], [1, 'rgba(50,30,10,0)']]); c.fillRect(o, py, 8, TILE); }
    if (wallRight) { c.fillStyle = lin(c, o + TILE, 0, o + TILE - 8, 0, [[0, 'rgba(50,30,10,0.25)'], [1, 'rgba(50,30,10,0)']]); c.fillRect(o + TILE - 8, py, 8, TILE); }
  }
  for (let x = 0; x < W; x++) {
    if (at(x, 0) !== RT.WINDOW) continue;
    // a slanted patch of sunlight on the floor below and a little to the east of each window
    let fy = 1; while (fy < H && !FLOORISH.has(at(x, fy))) fy++;
    const o = x * TILE, top = fy * TILE;
    const g = c.createLinearGradient(0, top, 0, top + 80);
    g.addColorStop(0, 'rgba(255,244,214,0.32)'); g.addColorStop(1, 'rgba(255,244,214,0)');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(o + 4, top); c.lineTo(o + 28, top); c.lineTo(o + 44, top + 80); c.lineTo(o + 20, top + 80); c.closePath(); c.fill();
  }
  // furniture on the floor, back to front
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = at(x, y), o = x * TILE, py = y * TILE;
    if (t === RT.RUG) rug(c, o, py);
    else if (t === RT.DESK) desk(c, o, py, seed(x, y));
    else if (t === RT.BED) bed(c, o, py, seed(x, y));
    else if (t === RT.TV) tv(c, o, py);
    else if (t === RT.TABLE_L) studyTable(c, o, py, true, seed(x, y));
    else if (t === RT.TABLE_R) studyTable(c, o, py, false, seed(x, y));
    else if (t === RT.SCREEN) screen(c, o, py);
    else if (t === DT.COUNTER) counter(c, o, py, seed(x, y));
    else if (t === DT.TABLE) diningTable(c, o, py, at(x - 1, y) !== DT.TABLE, at(x + 1, y) !== DT.TABLE, seed(x, y));
    else if (t === DT.KANTIN) kantin(c, o, py, seed(x, y));
  }
  c.setTransform(1, 0, 0, 1, 0, 0);
  tex.refresh();
  tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
  return key;
}

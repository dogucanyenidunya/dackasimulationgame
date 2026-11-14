// The ground's detail layer, baked once over the tile layer: lawns that vary in colour instead of one
// tile repeated, tufts and daisies, paving with stained and cracked stones, worn strips where lawn
// meets path, plazas cut along their real outlines (not the tile staircase), basketball keys, hoops
// and goal nets. It also picks where puddles form and where pigeons can land.
import Phaser from 'phaser';
import { COURTS, EXTRA_COURTS, MAP_H, MAP_W, PLAZAS, T, TILE, inPoly, nearestEdge } from '../content/campus';
import { rng, tileCanvas } from './textures';

export interface GroundInfo {
  /** where puddles sit (world px) and which puddle picture */
  puddles: Array<{ x: number; y: number; key: string }>;
  /** open plaza paving for pigeons (world px) */
  plazaSpots: Array<[number, number]>;
}

const CHUNK = 1024;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16 - 0.5);

function lattice(ix: number, iy: number, seed: number) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x: number, y: number, seed: number) {
  const ix = Math.floor(x), iy = Math.floor(y), s = (t: number) => t * t * (3 - 2 * t);
  const fx = s(x - ix), fy = s(y - iy);
  const a = lattice(ix, iy, seed), b = lattice(ix + 1, iy, seed), c = lattice(ix, iy + 1, seed), d = lattice(ix + 1, iy + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** 0 other, 1 lawn, 2 paving, 3 a plaza's outline crosses it */
const OTHER = 0, LAWN = 1, PAVE = 2, MIXED = 3;

export function dressGround(scene: Phaser.Scene, map: number[][]): GroundInfo {
  const W = MAP_W * TILE, H = MAP_H * TILE;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  const img = c.createImageData(W, H), d = img.data;
  const tile = (x: number, y: number) => map[y]?.[x] ?? -1;

  // ---- what each tile really is, once the plazas follow their outlines ----
  const surf = new Uint8Array(MAP_W * MAP_H);
  const sf = (x: number, y: number) => (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H ? OTHER : surf[y * MAP_W + x]);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const t = tile(x, y);
    let s = OTHER;
    if (t === T.PATH || t === T.GATE) s = PAVE;
    else if (t === T.GROUND || t === T.PLAZA) {
      s = LAWN;
      for (const p of PLAZAS) {
        const n = [[0.02, 0.02], [0.98, 0.02], [0.02, 0.98], [0.98, 0.98]].filter(([u, v]) => inPoly(x + u, y + v, p)).length;
        if (n === 4) { s = PAVE; break; }
        if (n > 0 || (t === T.PLAZA && inPoly(x + 0.5, y + 0.5, p))) s = MIXED;
      }
      if (t === T.PLAZA && s === LAWN) s = MIXED; // a plaza tile wholly outside the outline: repaint as lawn
    }
    surf[y * MAP_W + x] = s;
  }

  /** source-over a colour onto a pixel */
  const blend = (px: number, py: number, r: number, g: number, b: number, a: number) => {
    if (px < 0 || py < 0 || px >= W || py >= H) return;
    const i = (py * W + px) * 4, da = d[i + 3] / 255, oa = a + da * (1 - a);
    if (oa <= 0) return;
    d[i] = (r * a + d[i] * da * (1 - a)) / oa; d[i + 1] = (g * a + d[i + 1] * da * (1 - a)) / oa; d[i + 2] = (b * a + d[i + 2] * da * (1 - a)) / oa;
    d[i + 3] = oa * 255;
  };
  const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const put = (px: number, py: number, col: string, a = 1) => { const [r, g, b] = hex(col); blend(px, py, r, g, b, a); };

  // ---- plazas along their outlines, with a stone kerb ----
  const grassPx = tileCanvas(T.GROUND).getContext('2d')!.getImageData(0, 0, TILE, TILE).data;
  const plazaPx = tileCanvas(T.PLAZA).getContext('2d')!.getImageData(0, 0, TILE, TILE).data;
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
    if (sf(tx, ty) !== MIXED) continue;
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const u = tx + (x + 0.5) / TILE, v = ty + (y + 0.5) / TILE;
      let inside = false, dist = Infinity;
      for (const p of PLAZAS) { if (inPoly(u, v, p)) inside = true; dist = Math.min(dist, nearestEdge(u, v, p).d * TILE); }
      const i = ((ty * TILE + y) * W + tx * TILE + x) * 4, j = (y * TILE + x) * 4;
      const src = inside ? plazaPx : grassPx;
      d[i] = src[j]; d[i + 1] = src[j + 1]; d[i + 2] = src[j + 2]; d[i + 3] = 255;
      if (inside && dist < 1) put(tx * TILE + x, ty * TILE + y, '#b3a993');
      else if (inside && dist < 3) put(tx * TILE + x, ty * TILE + y, '#efe9dd');
      else if (!inside && dist < 1.6) put(tx * TILE + x, ty * TILE + y, '#3a5a26', 0.28);
    }
  }

  // ---- lawn: broad lighter and darker drifts, dithered so they stay pixel art ----
  const lawnAt = (px: number, py: number) => {
    const s = sf(Math.floor(px / TILE), Math.floor(py / TILE));
    if (s === LAWN) return true;
    if (s !== MIXED) return false;
    const u = (px + 0.5) / TILE, v = (py + 0.5) / TILE;
    return !PLAZAS.some((p) => inPoly(u, v, p));
  };
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
    const s = sf(tx, ty);
    if (s !== LAWN && s !== MIXED) continue;
    for (let by = 0; by < TILE; by += 2) for (let bx = 0; bx < TILE; bx += 2) {
      const px = tx * TILE + bx, py = ty * TILE + by;
      if (s === MIXED && !lawnAt(px, py)) continue;
      const n = vnoise(px / (TILE * 3.7), py / (TILE * 3.7), 1) * 0.68 + vnoise(px / (TILE * 1.2), py / (TILE * 1.2), 2) * 0.32;
      const k = n + BAYER[((by >> 1) & 3) * 4 + ((bx >> 1) & 3)] * 0.14;
      const tint: [number, number, number, number] | null = k > 0.66 ? [236, 255, 180, 0.16] : k > 0.6 ? [236, 255, 180, 0.08]
        : k < 0.32 ? [30, 72, 26, 0.17] : k < 0.38 ? [30, 72, 26, 0.08] : null;
      if (tint) for (let q = 0; q < 4; q++) blend(px + (q & 1), py + (q >> 1), tint[0], tint[1], tint[2], tint[3]);
    }
  }

  // ---- lawn details: tufts, daisies, clover, the odd stone ----
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
    if (sf(tx, ty) !== LAWN) continue;
    const r = rng(tx * 7919 + ty * 104729);
    const ox = tx * TILE, oy = ty * TILE;
    for (let i = 0, n = 1 + Math.floor(r() * 3); i < n; i++) {
      const x = ox + 2 + Math.floor(r() * 27), y = oy + 3 + Math.floor(r() * 26);
      put(x, y, '#5a8f43'); put(x, y + 1, '#5a8f43'); put(x + 2, y - 1, '#5a8f43'); put(x + 2, y, '#5a8f43'); put(x + 2, y + 1, '#5a8f43');
      put(x + 1, y + 1, '#6a9e4c'); put(x + 2, y - 2, '#b6dc8c'); put(x, y - 1, '#a6d27e');
    }
    const flora = r();
    if (flora < 0.07) {
      for (let i = 0, n = 2 + Math.floor(r() * 4); i < n; i++) {
        const x = ox + 3 + Math.floor(r() * 25), y = oy + 3 + Math.floor(r() * 25), petal = r() < 0.75 ? '#f6f6ee' : r() < 0.5 ? '#f2d35a' : '#c99ad8';
        put(x - 1, y, petal); put(x + 1, y, petal); put(x, y - 1, petal); put(x, y + 1, petal); put(x, y, '#e8b830');
      }
    } else if (flora < 0.13) {
      const x = ox + 6 + Math.floor(r() * 18), y = oy + 6 + Math.floor(r() * 18);
      for (let i = 0; i < 9; i++) { const a = r() * Math.PI * 2, rr = r() * 5; put(Math.round(x + Math.cos(a) * rr), Math.round(y + Math.sin(a) * rr * 0.7), '#5f9a45'); }
    } else if (flora < 0.15) {
      const x = ox + 4 + Math.floor(r() * 24), y = oy + 4 + Math.floor(r() * 24);
      put(x, y, '#a8a69a'); put(x + 1, y, '#c9c7bb'); put(x, y + 1, '#7f7d72'); put(x + 1, y + 1, '#8f8d82');
    }
  }

  // ---- where lawn meets paving: a worn, uneven strip; grass poking over the kerb ----
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
    if (sf(tx, ty) !== LAWN) continue;
    const r = rng(tx * 31337 + ty * 7331);
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      if (sf(tx + dx, ty + dy) !== PAVE) continue;
      for (let t = 0; t < TILE; t++) {
        // edge pixel on the lawn side, stepping inwards
        const ex = dx === 1 ? tx * TILE + TILE - 1 : dx === -1 ? tx * TILE : tx * TILE + t;
        const ey = dy === 1 ? ty * TILE + TILE - 1 : dy === -1 ? ty * TILE : ty * TILE + t;
        const w = 1 + Math.floor(vnoise((ex + ey) / 9, (tx * dx + ty * dy) * 3.1, 5) * 3.2);
        for (let k = 0; k < w; k++) {
          const px = ex - dx * k, py = ey - dy * k;
          put(px, py, k === 0 ? '#8c8a55' : '#6d8f45', k === 0 ? 0.45 : 0.3 - k * 0.06);
        }
        // the paving's edge: a thin shadow line, and now and then a grass blade over it
        put(ex + dx, ey + dy, '#000000', 0.09);
        if (r() < 0.12) { put(ex + dx, ey + dy, '#6aa04c'); if (r() < 0.5) put(ex + dx * 2, ey + dy * 2, '#88bc62'); }
      }
    }
  }

  // ---- paving: stones that are a little lighter or darker, a few cracks and weeds in the joints ----
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
    if (sf(tx, ty) !== PAVE) continue;
    const t = tile(tx, ty), r = rng(tx * 4241 + ty * 9173);
    const ox = tx * TILE, oy = ty * TILE;
    const slab = t === T.PLAZA;
    for (let i = 0, n = Math.floor(r() * 3); i < n; i++) {
      let x: number, y: number, w: number, h: number;
      if (slab) { x = ox + 1 + Math.floor(r() * 2) * 16; y = oy + 1 + Math.floor(r() * 2) * 16; w = 15; h = 15; }
      else { const row = Math.floor(r() * 4), off = row % 2 ? 8 : 0; x = ox + off + 1 + Math.floor(r() * 2) * 16; y = oy + row * 8 + 1; w = Math.min(15, ox + TILE - x); h = 7; }
      const dark = r() < 0.55;
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) put(x + xx, y + yy, dark ? '#5a4a30' : '#ffffff', dark ? 0.06 : 0.16);
    }
    if (r() < 0.12) { let x = ox + 4 + Math.floor(r() * 22), y = oy + 4 + Math.floor(r() * 22); for (let i = 0; i < 5; i++) { put(x, y, '#9f9582', 0.8); x += r() < 0.5 ? 1 : 0; y += 1; } }
    if (r() < 0.08) { const x = ox + 8 + Math.floor(r() * 2) * 16, y = oy + (slab ? 16 : 8 * Math.floor(r() * 4)); put(x, y, '#6aa04c'); put(x + 1, y, '#88bc62'); put(x, y - 1, '#6aa04c'); }
  }

  // ---- puddles and pigeon spots ----
  const info: GroundInfo = { puddles: [], plazaSpots: [] };
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
    const s = sf(tx, ty), r = rng(tx * 613 + ty * 2087 + 11);
    if ((s === PAVE && r() < 0.11) || (s === LAWN && r() < 0.025)) info.puddles.push({ x: tx * TILE + 6 + r() * 20, y: ty * TILE + 8 + r() * 16, key: `puddle-${Math.floor(r() * 3)}` });
    if (s === PAVE && tile(tx, ty) === T.PLAZA) info.plazaSpots.push([tx * TILE + 16, ty * TILE + 16]);
  }

  c.putImageData(img, 0, 0);

  // ---- basketball courts: keys, free-throw circles, three-point lines ----
  const halfCourt: Array<{ foot: [number, number]; flip: boolean }> = [];
  for (const bk of [COURTS.basketball, ...EXTRA_COURTS]) {
    const x = bk.x * TILE + 8, y = bk.y * TILE + 8, w = bk.w * TILE - 16, h = bk.h * TILE - 16;
    if (w < h) continue;
    const my = y + h / 2, keyLen = Math.round(w * 0.19), keyW = Math.round(h * 0.34), r3 = Math.min((h / 2 - 6) / 0.932, w * 0.3);
    c.fillStyle = 'rgba(255,255,255,0.05)'; c.beginPath(); c.ellipse(x + w / 2, my, w * 0.3, h * 0.35, 0, 0, Math.PI * 2); c.fill();
    for (const west of [true, false]) {
      const base = west ? x : x + w, dir = west ? 1 : -1, kx = west ? x : x + w - keyLen;
      c.fillStyle = '#4a7f9e'; c.fillRect(kx, Math.round(my - keyW / 2), keyLen, keyW);
      c.strokeStyle = 'rgba(242,242,234,0.9)'; c.lineWidth = 2;
      c.strokeRect(kx, Math.round(my - keyW / 2), keyLen, keyW);
      c.beginPath(); c.arc(base + dir * keyLen, my, keyW / 2, 0, Math.PI * 2); c.stroke();
      const hx = base + dir * 13, a = 1.2;
      c.beginPath(); c.arc(hx, my, r3, west ? -a : Math.PI - a, west ? a : Math.PI + a); c.stroke();
      for (const sgn of [-1, 1]) { const ey = my + sgn * r3 * Math.sin(a); c.beginPath(); c.moveTo(base, ey); c.lineTo(hx + dir * r3 * Math.cos(a), ey); c.stroke(); }
      halfCourt.push({ foot: [base - dir * 6, my + 2], flip: !west });
    }
  }

  // ---- into textures, in chunks small enough for any GPU ----
  for (let cy = 0; cy * CHUNK < H; cy++) for (let cx = 0; cx * CHUNK < W; cx++) {
    const key = `ground-detail-${cx}-${cy}`, w = Math.min(CHUNK, W - cx * CHUNK), h = Math.min(CHUNK, H - cy * CHUNK);
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const tex = scene.textures.createCanvas(key, w, h)!;
    tex.getContext().drawImage(cv, cx * CHUNK, cy * CHUNK, w, h, 0, 0, w, h);
    tex.refresh();
    scene.add.image(cx * CHUNK, cy * CHUNK, key).setOrigin(0, 0).setDepth(0.2);
  }

  // ---- hoops and goals, with their shadows ----
  const shade = scene.add.graphics().setDepth(1.1);
  shade.fillStyle(0x000000, 0.16);
  for (const { foot: [fx, fy], flip } of halfCourt) {
    scene.add.image(fx, fy, 'hoop').setOrigin(flip ? 30 / 40 : 10 / 40, 53 / 56).setFlipX(flip).setDepth(fy);
    const s = flip ? -1 : 1;
    // the pole's shadow falls south-east; the board's lands a little further along
    shade.fillPoints([{ x: fx - 1, y: fy }, { x: fx + 1, y: fy }, { x: fx + 23, y: fy + 13 }, { x: fx + 21, y: fy + 13 }], true);
    shade.fillRect(Math.min(fx + 20, fx + 20 + s * 10), fy + 9, 10, 5);
  }
  const fb = COURTS.football;
  const gx = fb.x * TILE + 6, gy = fb.y * TILE + 6, gw = fb.w * TILE - 12, gh = fb.h * TILE - 12;
  if (gh > gw) {
    scene.add.image(gx + gw / 2, gy, 'goal-n').setOrigin(0.5, 32 / 34).setDepth(gy);
    scene.add.image(gx + gw / 2, gy + gh + 10, 'goal-s').setOrigin(0.5, 30 / 34).setDepth(gy + gh + 10);
  }
  return info;
}

// The ground, baked once over the tile layer at ART_RES times the world's resolution and shown smoothly scaled:
// lawns of fine mottled grass with lighter and darker drifts, tufts, daisies and clover; brick paths in a running
// bond with a worn strip where lawn meets paving; plazas of stone slabs cut along their real outlines with a kerb;
// the running track and the basketball markings. Everything is drawn with canvas paths and seamless patterns,
// one chunk at a time, so nothing is ever a block of pixels. It also picks where puddles form and pigeons land.
import Phaser from 'phaser';
import { COURTS, EXTRA_COURTS, MAP_H, MAP_W, PLAZAS, T, TILE, TRACK, inPoly, timWallAt } from '../content/campus';
import { ART_RES, rng } from './textures';

export interface GroundInfo {
  /** where puddles sit (world px) and which puddle picture */
  puddles: Array<{ x: number; y: number; key: string }>;
  /** open plaza paving for pigeons (world px) */
  plazaSpots: Array<[number, number]>;
}

const R = ART_RES;
/** world px per baked chunk (its texture is R times bigger) */
const CHUNK = 1024;

// ---------- noise ----------

function lattice(ix: number, iy: number, seed: number) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** value noise that repeats every `period` lattice cells (for seamless textures) */
function pnoise(x: number, y: number, period: number, seed: number) {
  const ix = Math.floor(x), iy = Math.floor(y), s = (t: number) => t * t * (3 - 2 * t);
  const fx = s(x - ix), fy = s(y - iy);
  const w = (v: number) => ((v % period) + period) % period;
  const a = lattice(w(ix), w(iy), seed), b = lattice(w(ix + 1), w(iy), seed), c = lattice(w(ix), w(iy + 1), seed), d = lattice(w(ix + 1), w(iy + 1), seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

// ---------- colours ----------

const rgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function mixHex(a: string, b: string, t: number) {
  const x = rgb(a), y = rgb(b);
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`;
}

// ---------- seamless textures (drawn once, R times finer than the world) ----------

function canvasOf(w: number, h: number) {
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * R); cv.height = Math.round(h * R);
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  return { cv, c };
}

/** wraps a drawing so it repeats seamlessly: draws it again shifted by ±period wherever it crosses an edge */
function wrapped(period: number, x: number, y: number, m: number, draw: (x: number, y: number) => void) {
  for (const dx of [0, -period, period]) for (const dy of [0, -period, period]) {
    const xx = x + dx, yy = y + dy;
    if (xx < -m || yy < -m || xx > period + m || yy > period + m) continue;
    draw(xx, yy);
  }
}

/** grass: mottled at several scales, with short blades leaning a little in all directions */
function grassTexture() {
  const P = 256;
  const { cv, c } = canvasOf(P, P);
  const S = cv.width, img = c.createImageData(S, S), d = img.data;
  const dark = rgb('#5f9845'), mid = rgb('#86b964'), light = rgb('#a6d27f');
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
    const x = px / R, y = py / R;
    const n = pnoise(x / 32, y / 32, 8, 1) * 0.45 + pnoise(x / 8, y / 8, 32, 2) * 0.33 + pnoise(x / 2, y / 2, 128, 3) * 0.22;
    const g = (lattice(px, py, 9) - 0.5) * 14;
    const t = Math.min(1, Math.max(0, (n - 0.25) * 1.9));
    const i = (py * S + px) * 4;
    for (let k = 0; k < 3; k++) {
      const v = t < 0.5 ? dark[k] + (mid[k] - dark[k]) * t * 2 : mid[k] + (light[k] - mid[k]) * (t - 0.5) * 2;
      d[i + k] = Math.max(0, Math.min(255, v + g));
    }
    d[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  c.scale(R, R);
  c.lineCap = 'round';
  const r = rng(77);
  for (let i = 0; i < 2600; i++) {
    const x = r() * P, y = r() * P, len = 1.6 + r() * 2.6, a = -Math.PI / 2 + (r() - 0.5) * 0.9;
    const lightBlade = r() < 0.45;
    wrapped(P, x, y, 5, (xx, yy) => {
      c.strokeStyle = lightBlade ? 'rgba(196,232,150,0.55)' : 'rgba(58,98,40,0.45)';
      c.lineWidth = 0.42;
      c.beginPath(); c.moveTo(xx, yy); c.quadraticCurveTo(xx + Math.cos(a) * len * 0.5 + 0.4, yy + Math.sin(a) * len * 0.5, xx + Math.cos(a) * len, yy + Math.sin(a) * len); c.stroke();
    });
  }
  return { cv, period: P };
}

/** brick paving in a running bond: each brick a slightly different stone, bevelled, with sand in the joints */
function paverTexture() {
  const P = 64;
  const { cv, c } = canvasOf(P, P);
  c.scale(R, R);
  c.fillStyle = '#b9ae99'; c.fillRect(0, 0, P, P);
  const r = rng(31);
  for (let row = 0; row < P / 8; row++) {
    const off = row % 2 ? 8 : 0;
    for (let col = -1; col < P / 16; col++) {
      const x = col * 16 + off, y = row * 8;
      const tone = r();
      const base = tone < 0.15 ? '#cfc5b2' : tone > 0.85 ? '#e4ddd0' : mixHex('#d6cebe', '#ddd6c8', r());
      const brick = (bx: number) => {
        c.fillStyle = base; c.beginPath(); c.roundRect(bx + 0.55, y + 0.55, 14.9, 6.9, 1.1); c.fill();
        const g = c.createLinearGradient(bx, y, bx + 4, y + 8);
        g.addColorStop(0, 'rgba(255,255,255,0.28)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(70,55,35,0.16)');
        c.fillStyle = g; c.beginPath(); c.roundRect(bx + 0.55, y + 0.55, 14.9, 6.9, 1.1); c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 0.35;
        c.beginPath(); c.moveTo(bx + 1.2, y + 7); c.lineTo(bx + 1.2, y + 1.2); c.lineTo(bx + 15, y + 1.2); c.stroke();
        c.strokeStyle = 'rgba(80,64,40,0.25)';
        c.beginPath(); c.moveTo(bx + 15.1, y + 1.4); c.lineTo(bx + 15.1, y + 7.2); c.lineTo(bx + 1.4, y + 7.2); c.stroke();
        for (let k = 0; k < 6; k++) { c.fillStyle = r() < 0.5 ? 'rgba(120,100,70,0.18)' : 'rgba(255,255,255,0.25)'; c.beginPath(); c.arc(bx + 2 + r() * 12, y + 2 + r() * 4, 0.25 + r() * 0.3, 0, Math.PI * 2); c.fill(); }
      };
      brick(x);
      if (x < 0) brick(x + P);
      if (x + 16 > P) brick(x - P);
    }
  }
  return { cv, period: P };
}

/** plaza slabs: big square stones in a grid, each its own shade, with fine grit */
function slabTexture() {
  const P = 64;
  const { cv, c } = canvasOf(P, P);
  c.scale(R, R);
  c.fillStyle = '#cbc2af'; c.fillRect(0, 0, P, P);
  const r = rng(41);
  for (let y = 0; y < P; y += 16) for (let x = 0; x < P; x += 16) {
    const base = mixHex('#e1dacb', '#ece6da', r());
    c.fillStyle = base; c.beginPath(); c.roundRect(x + 0.5, y + 0.5, 15, 15, 0.8); c.fill();
    const g = c.createLinearGradient(x, y, x + 16, y + 16);
    g.addColorStop(0, 'rgba(255,255,255,0.3)'); g.addColorStop(0.35, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(90,75,50,0.12)');
    c.fillStyle = g; c.beginPath(); c.roundRect(x + 0.5, y + 0.5, 15, 15, 0.8); c.fill();
    for (let k = 0; k < 18; k++) { c.fillStyle = r() < 0.6 ? 'rgba(120,105,80,0.16)' : 'rgba(255,255,255,0.4)'; c.beginPath(); c.arc(x + 1 + r() * 14, y + 1 + r() * 14, 0.2 + r() * 0.35, 0, Math.PI * 2); c.fill(); }
    if (r() < 0.25) { c.fillStyle = 'rgba(110,95,70,0.07)'; c.beginPath(); c.ellipse(x + 4 + r() * 8, y + 4 + r() * 8, 3 + r() * 3, 2 + r() * 2, r() * 3, 0, Math.PI * 2); c.fill(); }
  }
  return { cv, period: P };
}

/** the running track's rubber: speckled red-brown */
function rubberTexture() {
  const P = 32;
  const { cv, c } = canvasOf(P, P);
  c.scale(R, R);
  c.fillStyle = '#b4543c'; c.fillRect(0, 0, P, P);
  const r = rng(13);
  for (let k = 0; k < 260; k++) { c.fillStyle = r() < 0.6 ? 'rgba(60,15,8,0.16)' : 'rgba(255,215,190,0.14)'; c.fillRect(r() * P, r() * P, 0.5 + r() * 0.6, 0.5); }
  return { cv, period: P };
}

// ---------- the bake ----------

export function dressGround(scene: Phaser.Scene, map: number[][]): GroundInfo {
  const W = MAP_W * TILE, H = MAP_H * TILE;
  const tile = (x: number, y: number) => map[y]?.[x] ?? -1;
  const isGround = (t: number) => t === T.GROUND || t === T.PLAZA;
  const isPath = (t: number) => t === T.PATH || t === T.GATE;
  const polys = PLAZAS.map((p) => p.map(([x, y]) => [x * TILE, y * TILE] as [number, number]));
  /** how many of a tile's corners are inside a plaza */
  const cornersIn = (x: number, y: number) => {
    let best = 0;
    for (const p of PLAZAS) best = Math.max(best, [[0.02, 0.02], [0.98, 0.02], [0.02, 0.98], [0.98, 0.98]].filter(([u, v]) => inPoly(x + u, y + v, p)).length);
    return best;
  };
  const corners = new Uint8Array(MAP_W * MAP_H);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (isGround(tile(x, y))) corners[y * MAP_W + x] = cornersIn(x, y);
  /** a lawn tile untouched by any plaza */
  const pureLawn = (x: number, y: number) => isGround(tile(x, y)) && corners[y * MAP_W + x] === 0;
  /** paved: a path, or ground wholly inside a plaza */
  const paved = (x: number, y: number) => isPath(tile(x, y)) || (isGround(tile(x, y)) && corners[y * MAP_W + x] === 4);

  // ---- the regions, as paths in world px (shared by every chunk) ----
  const groundArea = new Path2D(), pathArea = new Path2D(), plazaArea = new Path2D(), forestArea = new Path2D();
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const t = tile(x, y);
    // (the TIM yard's low wall stands on the lawn: it's drawn as a sprite on top)
    if (isGround(t) || (t === T.FENCE && timWallAt(x, y))) groundArea.rect(x * TILE, y * TILE, TILE, TILE);
    else if (isPath(t)) pathArea.rect(x * TILE, y * TILE, TILE, TILE);
    else if (t === T.FOREST) forestArea.rect(x * TILE, y * TILE, TILE, TILE);
  }
  for (const p of polys) { plazaArea.moveTo(p[0][0], p[0][1]); for (const [x, y] of p.slice(1)) plazaArea.lineTo(x, y); plazaArea.closePath(); }
  // the outline of the brick paths where they meet lawn (not other paving)
  const pathEdge = new Path2D();
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (!isPath(tile(x, y))) continue;
    const X = x * TILE, Y = y * TILE;
    if (isGround(tile(x, y - 1)) && !paved(x, y - 1)) { pathEdge.moveTo(X, Y); pathEdge.lineTo(X + TILE, Y); }
    if (isGround(tile(x, y + 1)) && !paved(x, y + 1)) { pathEdge.moveTo(X, Y + TILE); pathEdge.lineTo(X + TILE, Y + TILE); }
    if (isGround(tile(x - 1, y)) && !paved(x - 1, y)) { pathEdge.moveTo(X, Y); pathEdge.lineTo(X, Y + TILE); }
    if (isGround(tile(x + 1, y)) && !paved(x + 1, y)) { pathEdge.moveTo(X + TILE, Y); pathEdge.lineTo(X + TILE, Y + TILE); }
  }

  const grass = grassTexture(), pavers = paverTexture(), slabs = slabTexture(), rubber = rubberTexture();

  const paintChunk = (c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) => {
    const pat = (t: { cv: HTMLCanvasElement }) => {
      const p = c.createPattern(t.cv, 'repeat')!;
      p.setTransform(new DOMMatrix().scale(1 / R));
      return p;
    };
    c.lineCap = 'round'; c.lineJoin = 'round';
    const tx0 = Math.max(0, Math.floor(x0 / TILE) - 2), ty0 = Math.max(0, Math.floor(y0 / TILE) - 2);
    const tx1 = Math.min(MAP_W - 1, Math.ceil(x1 / TILE) + 2), ty1 = Math.min(MAP_H - 1, Math.ceil(y1 / TILE) + 2);

    // the woods round the campus: a dense roof of leaf clusters, lit from the north-west, darkest in the gaps
    c.fillStyle = '#1b4029'; c.fill(forestArea);
    c.save(); c.clip(forestArea);
    const leaf = ['#16351f', '#214f34', '#2f6b45', '#3d8052', '#57a066', '#7cbd7f'];
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (tile(tx, ty) !== T.FOREST) continue;
      const r = rng(tx * 5413 + ty * 2203 + 3);
      for (let i = 0; i < 14; i++) {
        const x = (tx + r()) * TILE, y = (ty + r()) * TILE, rad = 3.2 + r() * 4.8;
        c.fillStyle = leaf[0]; c.beginPath(); c.arc(x + 1.2, y + 1.8, rad, 0, Math.PI * 2); c.fill();
        const g = c.createRadialGradient(x - rad * 0.4, y - rad * 0.45, rad * 0.1, x, y, rad);
        const tone = 2 + Math.floor(r() * 2);
        g.addColorStop(0, leaf[tone + 2]); g.addColorStop(0.55, leaf[tone]); g.addColorStop(1, leaf[tone - 1]);
        c.fillStyle = g; c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.fill();
        for (let k = 0; k < 3; k++) {
          const a = Math.PI * (1.05 + r() * 0.6), d = rad * (0.35 + r() * 0.45);
          c.fillStyle = leaf[5]; c.globalAlpha = 0.55; c.beginPath(); c.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, 1.1, 0.7, a, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
        }
      }
    }
    c.restore();

    // lawn everywhere there's ground (plazas are laid over it)
    c.fillStyle = pat(grass); c.fill(groundArea);
    c.save(); c.clip(groundArea);
    // broad drifts of lighter and darker grass
    for (let gy = Math.floor(ty0 / 3); gy <= Math.ceil(ty1 / 3); gy++) for (let gx = Math.floor(tx0 / 3); gx <= Math.ceil(tx1 / 3); gx++) {
      const r = rng(gx * 92821 + gy * 68917 + 5);
      const cx = (gx * 3 + r() * 3) * TILE, cy = (gy * 3 + r() * 3) * TILE, rad = (1.6 + r() * 2.4) * TILE;
      const lightDrift = r() < 0.5, a = 0.08 + r() * 0.08;
      const g = c.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, lightDrift ? `rgba(226,250,170,${a})` : `rgba(30,70,24,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.beginPath(); c.ellipse(cx, cy, rad, rad * 0.75, r() * 3, 0, Math.PI * 2); c.fill();
    }
    // a worn strip of bare earth and flattened grass along the brick paths
    c.strokeStyle = 'rgba(112,128,66,0.22)'; c.lineWidth = 7; c.stroke(pathEdge);
    c.strokeStyle = 'rgba(140,132,84,0.32)'; c.lineWidth = 3.5; c.stroke(pathEdge);
    // and a soft green shadow outside each plaza's kerb
    c.strokeStyle = 'rgba(52,84,34,0.3)'; c.lineWidth = 4; c.stroke(plazaArea);
    c.restore();

    // lawn details, tile by tile (seeded by the tile, so neighbouring chunks agree)
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (!pureLawn(tx, ty)) continue;
      const r = rng(tx * 7919 + ty * 104729);
      const ox = tx * TILE, oy = ty * TILE;
      for (let i = 0, n = 1 + Math.floor(r() * 3); i < n; i++) {
        const x = ox + 3 + r() * 26, y = oy + 5 + r() * 24;
        for (let b = 0; b < 6; b++) {
          const a = -Math.PI / 2 + (b - 2.5) * 0.28 + (r() - 0.5) * 0.2, len = 3 + r() * 2.5;
          c.strokeStyle = b % 2 ? '#5a8f43' : '#4b7d38'; c.lineWidth = 0.6;
          c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * len * 0.4, y + Math.sin(a) * len * 0.6, x + Math.cos(a) * len, y + Math.sin(a) * len); c.stroke();
          c.fillStyle = 'rgba(190,226,140,0.8)'; c.beginPath(); c.arc(x + Math.cos(a) * len, y + Math.sin(a) * len, 0.3, 0, Math.PI * 2); c.fill();
        }
      }
      const flora = r();
      if (flora < 0.07) {
        for (let i = 0, n = 2 + Math.floor(r() * 4); i < n; i++) {
          const x = ox + 3 + r() * 26, y = oy + 3 + r() * 26, petal = r() < 0.75 ? '#f8f8f0' : r() < 0.5 ? '#f2d35a' : '#c99ad8';
          c.fillStyle = 'rgba(40,70,30,0.25)'; c.beginPath(); c.ellipse(x + 0.4, y + 0.6, 1.6, 0.8, 0, 0, Math.PI * 2); c.fill();
          c.fillStyle = petal;
          for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; c.beginPath(); c.ellipse(x + Math.cos(a) * 0.95, y + Math.sin(a) * 0.75, 0.62, 0.38, a, 0, Math.PI * 2); c.fill(); }
          c.fillStyle = '#e8b830'; c.beginPath(); c.arc(x, y, 0.5, 0, Math.PI * 2); c.fill();
        }
      } else if (flora < 0.13) {
        const x = ox + 6 + r() * 18, y = oy + 6 + r() * 18;
        for (let i = 0; i < 12; i++) {
          const a = r() * Math.PI * 2, rr = r() * 5, lx = x + Math.cos(a) * rr, ly = y + Math.sin(a) * rr * 0.7;
          for (let k = 0; k < 3; k++) { const b = (k / 3) * Math.PI * 2; c.fillStyle = k ? '#5f9a45' : '#6faa52'; c.beginPath(); c.arc(lx + Math.cos(b) * 0.55, ly + Math.sin(b) * 0.55, 0.6, 0, Math.PI * 2); c.fill(); }
        }
      } else if (flora < 0.15) {
        const x = ox + 5 + r() * 22, y = oy + 5 + r() * 22;
        c.fillStyle = 'rgba(30,40,20,0.25)'; c.beginPath(); c.ellipse(x + 0.6, y + 0.8, 2, 1.1, 0, 0, Math.PI * 2); c.fill();
        const g = c.createRadialGradient(x - 0.6, y - 0.5, 0, x, y, 2);
        g.addColorStop(0, '#d6d3c6'); g.addColorStop(1, '#85827a');
        c.fillStyle = g; c.beginPath(); c.ellipse(x, y, 1.9, 1.3, 0.3, 0, Math.PI * 2); c.fill();
      }
    }

    // brick paths
    c.fillStyle = pat(pavers); c.fill(pathArea);
    c.save(); c.clip(pathArea);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (!isPath(tile(tx, ty))) continue;
      const r = rng(tx * 4241 + ty * 9173);
      const ox = tx * TILE, oy = ty * TILE;
      if (r() < 0.35) { const g = c.createRadialGradient(ox + 16, oy + 16, 0, ox + 16, oy + 16, 14 + r() * 10); g.addColorStop(0, `rgba(90,74,48,${0.05 + r() * 0.05})`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(ox - 8, oy - 8, TILE + 16, TILE + 16); }
      if (r() < 0.12) {
        let x = ox + 4 + r() * 22, y = oy + 4 + r() * 22;
        c.strokeStyle = 'rgba(110,98,78,0.55)'; c.lineWidth = 0.45; c.beginPath(); c.moveTo(x, y);
        for (let i = 0; i < 5; i++) { x += (r() - 0.3) * 2.2; y += 1.2 + r(); c.lineTo(x, y); }
        c.stroke();
      }
      if (r() < 0.1) {
        const x = ox + 8 + Math.floor(r() * 2) * 16, y = oy + 8 * Math.floor(r() * 4);
        for (let b = 0; b < 4; b++) { const a = -Math.PI / 2 + (b - 1.5) * 0.45; c.strokeStyle = '#6aa04c'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 2.4, y + Math.sin(a) * 2.4); c.stroke(); }
      }
    }
    c.restore();
    // the paths' kerb: a soft shadow on the lawn and a lit lip on the stone
    c.strokeStyle = 'rgba(30,40,20,0.16)'; c.lineWidth = 1.6; c.stroke(pathEdge);
    c.save(); c.clip(pathArea); c.strokeStyle = 'rgba(255,250,236,0.4)'; c.lineWidth = 1.4; c.stroke(pathEdge); c.restore();
    // a few blades poking over the kerb
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (!pureLawn(tx, ty)) continue;
      const r = rng(tx * 31337 + ty * 7331);
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        if (!isPath(tile(tx + dx, ty + dy))) continue;
        for (let i = 0; i < 4; i++) {
          if (r() > 0.6) continue;
          const t = 2 + r() * 28;
          const ex = dx === 1 ? (tx + 1) * TILE : dx === -1 ? tx * TILE : tx * TILE + t;
          const ey = dy === 1 ? (ty + 1) * TILE : dy === -1 ? ty * TILE : ty * TILE + t;
          const len = 1.5 + r() * 1.8;
          c.strokeStyle = r() < 0.5 ? '#6aa04c' : '#88bc62'; c.lineWidth = 0.55;
          c.beginPath(); c.moveTo(ex - dx * 1.2, ey - dy * 1.2); c.lineTo(ex + dx * len + (dy ? (r() - 0.5) * 1.4 : 0), ey + dy * len + (dx ? (r() - 0.5) * 1.4 : 0)); c.stroke();
        }
      }
    }

    // plazas: slabs along the real outline, over the lawn only (paths stay brick)
    c.save(); c.clip(groundArea); c.clip(plazaArea);
    c.fillStyle = pat(slabs); c.fill(plazaArea);
    c.strokeStyle = 'rgba(245,240,230,0.75)'; c.lineWidth = 6; c.stroke(plazaArea);
    c.strokeStyle = '#ada38c'; c.lineWidth = 2.2; c.stroke(plazaArea);
    c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 0.6; c.translate(0.9, 0.9); c.stroke(plazaArea);
    c.restore();

    // ---- the running track round the football pitch: tartan lanes with white lines, a start line on the west straight ----
    {
      const ox = TRACK.x * TILE, oy = TRACK.y * TILE, ow = TRACK.w * TILE, oh = TRACK.h * TILE, Rr = TRACK.r * TILE, tw = TRACK.width * TILE;
      if (ox < x1 && oy < y1 && ox + ow > x0 && oy + oh > y0) {
        const rr = (x: number, y: number, w: number, h: number, r: number) => {
          c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
        };
        c.beginPath(); rr(ox, oy, ow, oh, Rr); rr(ox + tw, oy + tw, ow - 2 * tw, oh - 2 * tw, Rr - tw);
        c.fillStyle = pat(rubber); c.fill('evenodd');
        c.strokeStyle = 'rgba(244,244,236,0.95)'; c.lineWidth = 0.8;
        for (let i = 0; i <= TRACK.lanes; i++) {
          const d = 1 + (i * (tw - 2)) / TRACK.lanes;
          c.beginPath(); rr(ox + d, oy + d, ow - 2 * d, oh - 2 * d, Rr - d); c.stroke();
        }
        c.strokeStyle = '#e8e6df'; c.lineWidth = 2;
        c.beginPath(); rr(ox + tw, oy + tw, ow - 2 * tw, oh - 2 * tw, Rr - tw); c.stroke();
        const sy = oy + oh / 2;
        c.fillStyle = '#f4f4ec'; c.fillRect(ox + 1, sy, tw - 2, 2.5);
        c.fillStyle = 'rgba(244,244,236,0.8)';
        for (let i = 0; i < TRACK.lanes; i++) c.fillRect(ox + 3 + (i + 0.35) * ((tw - 2) / TRACK.lanes), sy + 7, 1.6, 3.5);
      }
    }

    // ---- basketball courts: keys, free-throw circles, three-point lines (drawn along the court's length) ----
    for (const bk of [COURTS.basketball, ...EXTRA_COURTS]) {
      const x = bk.x * TILE + 8, y = bk.y * TILE + 8, w = bk.w * TILE - 16, h = bk.h * TILE - 16;
      if (x > x1 || y > y1 || x + w < x0 || y + h < y0) continue;
      const vertical = h > w, Lw = vertical ? h : w, Lh = vertical ? w : h;
      c.save();
      c.translate(x + w / 2, y + h / 2);
      if (vertical) c.rotate(Math.PI / 2);
      const lx = -Lw / 2, my = 0, keyLen = Math.round(Lw * 0.19), keyW = Math.round(Lh * 0.34), r3 = Math.min((Lh / 2 - 6) / 0.932, Lw * 0.3);
      c.fillStyle = 'rgba(255,255,255,0.05)'; c.beginPath(); c.ellipse(0, 0, Lw * 0.3, Lh * 0.35, 0, 0, Math.PI * 2); c.fill();
      for (const first of [true, false]) {
        const base = first ? lx : lx + Lw, dir = first ? 1 : -1, kx = first ? lx : lx + Lw - keyLen;
        c.fillStyle = '#4a7f9e'; c.fillRect(kx, my - keyW / 2, keyLen, keyW);
        c.strokeStyle = 'rgba(242,242,234,0.9)'; c.lineWidth = 1.6;
        c.strokeRect(kx, my - keyW / 2, keyLen, keyW);
        c.beginPath(); c.arc(base + dir * keyLen, my, keyW / 2, 0, Math.PI * 2); c.stroke();
        const hx = base + dir * 13, a = 1.2;
        c.beginPath(); c.arc(hx, my, r3, first ? -a : Math.PI - a, first ? a : Math.PI + a); c.stroke();
        for (const sgn of [-1, 1]) { const ey = my + sgn * r3 * Math.sin(a); c.beginPath(); c.moveTo(base, ey); c.lineTo(hx + dir * r3 * Math.cos(a), ey); c.stroke(); }
      }
      c.restore();
    }
  };

  // ---- into textures, chunk by chunk, each drawn straight at R× ----
  for (let cy = 0; cy * CHUNK < H; cy++) for (let cx = 0; cx * CHUNK < W; cx++) {
    const key = `ground-detail-${cx}-${cy}`, x0 = cx * CHUNK, y0 = cy * CHUNK, w = Math.min(CHUNK, W - x0), h = Math.min(CHUNK, H - y0);
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const cv = document.createElement('canvas');
    cv.width = w * R; cv.height = h * R;
    const c = cv.getContext('2d')!;
    c.setTransform(R, 0, 0, R, -x0 * R, -y0 * R);
    paintChunk(c, x0, y0, x0 + w, y0 + h);
    const tex = scene.textures.addCanvas(key, cv)!;
    tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
    scene.add.image(x0, y0, key).setOrigin(0, 0).setScale(1 / R).setDepth(0.2);
  }

  // ---- puddles and pigeon spots ----
  const info: GroundInfo = { puddles: [], plazaSpots: [] };
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
    const r = rng(tx * 613 + ty * 2087 + 11);
    const pave = paved(tx, ty), lawn = pureLawn(tx, ty);
    if ((pave && r() < 0.11) || (lawn && r() < 0.025)) info.puddles.push({ x: tx * TILE + 6 + r() * 20, y: ty * TILE + 8 + r() * 16, key: `puddle-${Math.floor(r() * 3)}` });
    if (pave && tile(tx, ty) === T.PLAZA) info.plazaSpots.push([tx * TILE + 16, ty * TILE + 16]);
  }

  // ---- hoops and goals, with their shadows ----
  const halfCourt: Array<{ foot: [number, number]; end: 'w' | 'e' | 'n' | 's' }> = [];
  for (const bk of [COURTS.basketball, ...EXTRA_COURTS]) {
    const x = bk.x * TILE + 8, y = bk.y * TILE + 8, w = bk.w * TILE - 16, h = bk.h * TILE - 16;
    if (h > w) halfCourt.push({ foot: [x + w / 2, y - 4], end: 'n' }, { foot: [x + w / 2, y + h + 6], end: 's' });
    else halfCourt.push({ foot: [x + 6, y + h / 2 + 2], end: 'w' }, { foot: [x + w - 6, y + h / 2 + 2], end: 'e' });
  }
  const shade = scene.add.graphics().setDepth(1.1);
  shade.fillStyle(0x000000, 0.16);
  for (const { foot: [fx, fy], end } of halfCourt) {
    if (end === 'n' || end === 's') {
      // at the ends of a north–south court: the north board faces you, the south one shows its back
      scene.add.image(fx, fy, end === 'n' ? 'hoop-n' : 'hoop-s').setOrigin(0.5, 57 / 60).setScale(1 / R).setDepth(fy);
      shade.fillPoints([{ x: fx - 1, y: fy }, { x: fx + 1, y: fy }, { x: fx + 23, y: fy + 13 }, { x: fx + 21, y: fy + 13 }], true);
      shade.fillRect(fx + 14, fy + 8, 16, 5);
      continue;
    }
    const flip = end === 'e';
    scene.add.image(fx, fy, 'hoop').setOrigin(flip ? 30 / 40 : 10 / 40, 53 / 56).setFlipX(flip).setScale(1 / R).setDepth(fy);
    const s = flip ? -1 : 1;
    // the pole's shadow falls south-east; the board's lands a little further along
    shade.fillPoints([{ x: fx - 1, y: fy }, { x: fx + 1, y: fy }, { x: fx + 23, y: fy + 13 }, { x: fx + 21, y: fy + 13 }], true);
    shade.fillRect(Math.min(fx + 20, fx + 20 + s * 10), fy + 9, 10, 5);
  }
  const fb = COURTS.football;
  const gx = fb.x * TILE + 6, gy = fb.y * TILE + 6, gw = fb.w * TILE - 12, gh = fb.h * TILE - 12;
  if (gh > gw) {
    scene.add.image(gx + gw / 2, gy, 'goal-n').setOrigin(0.5, 32 / 34).setScale(1 / R).setDepth(gy);
    scene.add.image(gx + gw / 2, gy + gh + 10, 'goal-s').setOrigin(0.5, 30 / 34).setScale(1 / R).setDepth(gy + gh + 10);
  }
  return info;
}

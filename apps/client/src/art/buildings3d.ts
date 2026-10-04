// 2.5D (3/4 view) buildings: each building is painted once into its own canvas, with a flat roof seen
// from above and a tall south façade seen from the front. The roof is lifted one tile above the
// footprint, so you can walk "behind" a building. A second canvas holds only the window panes,
// which glow at night.
import Phaser from 'phaser';
import { LOCATIONS, TILE, type Building, type Door, type Rect } from '../content/campus';

/** how many tiles the roof rises above the footprint (0 when the main door faces north) */
export function liftOf(b: Building): number {
  return doorsOf(b).some((d) => d.side === 'n') ? 0 : 1;
}
/** façade height in tiles (taller buildings look taller) */
const FACADE: Record<string, number> = { kiz_yurdu: 4, erkek_yurdu: 4, egitim: 4, yemekhane: 3, cemiyet: 3, spor: 3, teknik: 3 };
/** extra pixels left and right for side entrance canopies */
export const PAD = 10;

const FLOORS: Record<string, number> = { kiz_yurdu: 4, erkek_yurdu: 4, egitim: 3, yemekhane: 2, cemiyet: 2, spor: 1, teknik: 2 };

const ROOF = {
  grey: { base: '#bcc3c9', dark: '#a6aeb5', light: '#d3d9de', rim: '#e6eaed', rimDark: '#8f979e' },
  white: { base: '#dfe3e6', dark: '#c9cfd4', light: '#eef1f3', rim: '#f7f8f9', rimDark: '#a3abb2' },
  green: { base: '#79ae5f', dark: '#62964b', light: '#93c477', rim: '#d9dfe2', rimDark: '#8f979e' },
};

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function doorsOf(b: Building): Door[] {
  const r = b.rect;
  const inside = (d: Door) => d.x >= r.x && d.x < r.x + r.w && d.y >= r.y && d.y < r.y + r.h;
  return LOCATIONS.flatMap((l) => (l.doors ?? []).filter(inside).map((d) => ({ ...d, kind: d.kind ?? (l.id === 'revir' ? 'revir' : undefined) })));
}

/** groups neighbouring door tiles on the same side into one entrance */
function entrances(b: Building): Array<{ side: Door['side']; x: number; y: number; n: number; revir: boolean }> {
  const out: Array<{ side: Door['side']; x: number; y: number; n: number; revir: boolean }> = [];
  const ds = doorsOf(b).sort((a, c) => a.y - c.y || a.x - c.x);
  for (const d of ds) {
    const last = out[out.length - 1];
    const along = d.side === 'e' || d.side === 'w';
    if (last && last.side === d.side && !last.revir && d.kind !== 'revir' && (along ? last.x === d.x && last.y + last.n === d.y : last.y === d.y && last.x + last.n === d.x)) { last.n++; continue; }
    out.push({ side: d.side, x: d.x, y: d.y, n: 1, revir: d.kind === 'revir' });
  }
  return out;
}

export interface BuildingArt { key: string; litKey: string; x: number; y: number; w: number; h: number; base: number }

/** paints the building and its night windows; returns where to place them in the world */
export function makeBuildingArt(scene: Phaser.Scene, b: Building): BuildingArt {
  const r = b.rect;
  const lift = liftOf(b);
  const W = r.w * TILE + PAD * 2, H = (r.h + lift) * TILE;
  const key = `bld-${b.id}`, litKey = `bld-${b.id}-lit`;
  const art: BuildingArt = { key, litKey, x: r.x * TILE - PAD, y: (r.y - lift) * TILE, w: W, h: H, base: (r.y + r.h) * TILE };
  if (scene.textures.exists(key)) return art;
  const tex = scene.textures.createCanvas(key, W, H)!;
  const lit = scene.textures.createCanvas(litKey, W, H)!;
  const c = tex.getContext(), L = lit.getContext();
  const rand = rng(b.id.length * 977 + r.x * 31 + r.y);
  const px = (x: number, y: number, w: number, h: number, col: string) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const glow = (x: number, y: number, w: number, h: number, col = '#ffd57e') => { L.fillStyle = col; L.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

  const X0 = PAD, X1 = PAD + r.w * TILE; // building edges inside the canvas
  const facadeTiles = FACADE[b.id] ?? 3;
  const roofBottom = H - facadeTiles * TILE;
  /** world tile → canvas coords (roof features are lifted with the roof) */
  const fx = (tx: number) => PAD + (tx - r.x) * TILE;
  const fy = (ty: number) => (ty - r.y) * TILE;
  const pal = ROOF[b.roof];

  // ---------- roof ----------
  px(X0, 0, X1 - X0, roofBottom, pal.base);
  // gravel / membrane texture
  for (let i = 0; i < (r.w * r.h) * 5; i++) {
    px(X0 + 4 + rand() * (X1 - X0 - 8), 4 + rand() * (roofBottom - 8), 2, 1, rand() < 0.5 ? pal.dark : pal.light);
  }
  for (let sx = X0 + 32; sx < X1 - 8; sx += 32) px(sx, 6, 1, roofBottom - 12, pal.dark);
  for (let sy = 32; sy < roofBottom - 8; sy += 32) px(X0 + 6, sy, X1 - X0 - 12, 1, pal.dark);
  if (b.roof === 'green') for (let i = 0; i < r.w * r.h * 3; i++) px(X0 + 4 + rand() * (X1 - X0 - 8), 4 + rand() * (roofBottom - 8), 2, 2, rand() < 0.5 ? '#88bb6b' : '#5d8f46');
  // parapet: light coping on top, darker inside lip (so the roof reads as a recessed surface)
  px(X0, 0, X1 - X0, 5, pal.rim); px(X0, 0, 5, roofBottom, pal.rim); px(X1 - 5, 0, 5, roofBottom, pal.rim);
  px(X0 + 5, 5, X1 - X0 - 10, 3, 'rgba(0,0,0,0.13)'); px(X0 + 5, 5, 3, roofBottom - 10, 'rgba(0,0,0,0.08)');
  px(X0, roofBottom - 6, X1 - X0, 6, pal.rim);
  px(X0, roofBottom - 1, X1 - X0, 1, pal.rimDark);

  const features: Rect[] = [];
  const toCanvas = (s: Rect) => ({ x: fx(s.x), y: fy(s.y), w: s.w * TILE, h: s.h * TILE });

  // courtyard: an open well; you see its floor and the inner wall of its north side
  if (b.courtyard) {
    const q = toCanvas(b.courtyard);
    features.push(b.courtyard);
    px(q.x - 3, q.y - 3, q.w + 6, q.h + 6, pal.rim);
    px(q.x, q.y, q.w, q.h, '#d9d1c2');
    for (let i = 0; i < q.w * q.h / 60; i++) px(q.x + rand() * (q.w - 3), q.y + rand() * (q.h - 3), 3, 2, '#c4baa7');
    const wallH = Math.min(22, q.h * 0.55);
    px(q.x, q.y, q.w, wallH, '#e9ebe8');
    for (let wx = q.x + 4; wx < q.x + q.w - 8; wx += 12) { px(wx, q.y + 5, 7, wallH - 10, '#4f6f8c'); px(wx, q.y + 5, 7, 2, '#9cc0dd'); glow(wx, q.y + 5, 7, wallH - 10); }
    px(q.x, q.y + wallH, q.w, 4, 'rgba(0,0,0,0.18)');
    // a small tree in the yard
    if (q.h > 60) { c.fillStyle = '#3d7f47'; c.beginPath(); c.arc(q.x + q.w / 2, q.y + q.h - 22, 14, 0, Math.PI * 2); c.fill(); c.fillStyle = '#5a9e57'; c.beginPath(); c.arc(q.x + q.w / 2 - 4, q.y + q.h - 26, 7, 0, Math.PI * 2); c.fill(); }
  }
  // green roof patches
  for (const g of b.greenPatches ?? []) {
    const q = toCanvas(g); features.push(g);
    px(q.x, q.y, q.w, q.h, '#7fb466');
    for (let i = 0; i < q.w * q.h / 25; i++) px(q.x + rand() * (q.w - 2), q.y + rand() * (q.h - 2), 2, 2, rand() < 0.5 ? '#94c77a' : '#679d50');
    px(q.x, q.y + q.h - 2, q.w, 2, 'rgba(0,0,0,0.15)');
  }
  // skylights: glass ridges
  for (const s of b.skylights ?? []) {
    const q = toCanvas(s); features.push(s);
    px(q.x, q.y + 6, q.w, q.h - 6, 'rgba(0,0,0,0.18)');
    px(q.x, q.y + 2, q.w, q.h - 8, '#8fb6d4');
    px(q.x, q.y + 2, q.w, 4, '#cfe5f4');
    for (let sx = q.x; sx < q.x + q.w; sx += 16) px(sx, q.y + 2, 2, q.h - 8, '#6d8fac');
    glow(q.x, q.y + 2, q.w, q.h - 8, '#ffe7a8');
  }
  // solar panels: tilted rows with a raised edge and a shadow
  for (const s of b.solar ?? []) {
    const q = toCanvas(s); features.push(s);
    for (let y = q.y; y + 14 <= q.y + q.h; y += 16) {
      px(q.x + 2, y + 12, q.w - 4, 3, 'rgba(0,0,0,0.22)');
      px(q.x, y, q.w, 12, '#2f4f84');
      px(q.x, y, q.w, 2, '#7c9dd0');
      for (let sx = q.x + 10; sx < q.x + q.w; sx += 10) px(sx, y + 2, 1, 10, '#4c6fa8');
      px(q.x, y + 7, q.w, 1, '#4c6fa8');
    }
  }
  // rooftop units (vents, a stair box) where there's room
  const free = (x: number, y: number, w: number, h: number) =>
    x > X0 + 10 && x + w < X1 - 10 && y > 12 && y + h < roofBottom - 14 &&
    !features.some((f) => { const q = toCanvas(f); return x < q.x + q.w + 6 && x + w > q.x - 6 && y < q.y + q.h + 6 && y + h > q.y - 6; });
  const box = (x: number, y: number, w: number, h: number, tall: number) => {
    px(x + 3, y + h, w, 4, 'rgba(0,0,0,0.2)');               // shadow
    px(x, y + h - tall, w, tall, '#9aa2a8');                 // front face
    px(x, y - tall, w, h, '#d6dbdf');                        // top face
    px(x, y - tall, w, 1, '#eef1f3');
    px(x + w - 2, y - tall, 2, h + tall, 'rgba(0,0,0,0.12)');
  };
  for (let i = 0, placed = 0; i < 40 && placed < Math.max(2, Math.floor(r.w / 5)); i++) {
    const w = 10 + Math.floor(rand() * 3) * 4, h = 8 + Math.floor(rand() * 2) * 4;
    const x = X0 + 14 + rand() * (X1 - X0 - 28 - w), y = 18 + rand() * (roofBottom - 40 - h);
    if (!free(x, y - 6, w, h + 6)) continue;
    box(x, y, w, h, 5); features.push({ x: r.x + (x - PAD) / TILE, y: r.y + y / TILE, w: w / TILE, h: h / TILE });
    placed++;
  }

  // ---------- façade ----------
  const F0 = roofBottom, FH = facadeTiles * TILE;
  const plinth = 9;
  px(X0, F0, X1 - X0, FH, '#f1f2f0');
  px(X0, F0, X1 - X0, 4, 'rgba(0,0,0,0.16)'); // shadow under the coping
  const floors = FLOORS[b.id] ?? 2;
  const bandTop = F0 + 7, bandBottom = F0 + FH - plinth - 2;
  const fh = (bandBottom - bandTop) / floors;
  const southDoors = entrances(b).filter((e) => e.side === 's');
  const doorSpan = southDoors.map((e) => ({ x0: fx(e.x) - 6, x1: fx(e.x) + e.n * TILE + 6 }));
  for (let f = 0; f < floors; f++) {
    const y = Math.round(bandTop + f * fh);
    const wh = Math.round(fh - (floors === 1 ? 10 : 7));
    const ground = f === floors - 1;
    // slab line between floors
    if (f > 0) px(X0, y - 3, X1 - X0, 2, '#dcdfe0');
    if (b.id === 'spor') {
      // tall curtain wall of the sports hall
      px(X0 + 8, y + 2, X1 - X0 - 16, wh, '#5f819f');
      px(X0 + 8, y + 2, X1 - X0 - 16, 4, '#a9c9e2');
      for (let x = X0 + 8; x < X1 - 8; x += 18) px(x, y + 2, 2, wh, '#e8ecef');
      px(X0 + 8, y + 2 + wh / 2, X1 - X0 - 16, 2, '#e8ecef');
      glow(X0 + 8, y + 6, X1 - X0 - 16, wh - 4);
      continue;
    }
    for (let x = X0 + 6; x + 18 <= X1 - 4; x += 22) {
      if (ground && doorSpan.some((d) => x + 18 > d.x0 && x < d.x1)) continue;
      // window with frame, sky reflection and a wooden fin beside it (as in the aerial render)
      px(x, y, 16, wh, '#4f6f8c');
      px(x, y, 16, 3, '#9cc0dd');
      px(x + 2, y + 5, 4, 2, '#9cc0dd');
      px(x + 7, y, 1, wh, '#e8ecef');
      px(x, y + wh, 16, 2, '#c9ced2');            // sill
      px(x + 17, y - 2, 3, wh + 4, '#c98a4b');     // fin
      px(x + 19, y - 2, 1, wh + 4, '#9c6633');
      if (rand() < 0.72) glow(x, y + 3, 16, wh - 3, rand() < 0.2 ? '#fff0c4' : '#ffd57e');
    }
  }
  // corner shading so the box has depth
  px(X0, F0, 3, FH, 'rgba(0,0,0,0.07)'); px(X1 - 4, F0, 4, FH, 'rgba(0,0,0,0.16)');
  // plinth
  px(X0, F0 + FH - plinth, X1 - X0, plinth, '#9aa1a6');
  px(X0, F0 + FH - plinth, X1 - X0, 1, '#b8bec3');
  px(X0, F0 + FH - 1, X1 - X0, 1, '#6f767b');

  // ---------- entrances ----------
  for (const e of entrances(b)) {
    if (e.side === 's') {
      const x = fx(e.x) + 2, w = e.n * TILE - 4, y = F0 + FH - 30;
      px(x - 4, y - 8, w + 8, 6, '#7f878d');             // canopy slab
      px(x - 4, y - 8, w + 8, 1, '#c9ced2');
      px(x - 2, y - 2, w + 4, 3, 'rgba(0,0,0,0.25)');
      px(x, y, w, 30, e.revir ? '#f4f4f2' : '#3e4a52');  // door frame
      px(x + 2, y + 2, w - 4, 28, e.revir ? '#d8e8f0' : '#6f93ad');
      px(x + 2, y + 2, w - 4, 3, '#cfe5f4');
      if (w > 20) px(x + w / 2 - 1, y + 2, 2, 28, '#3e4a52');
      glow(x + 2, y + 5, w - 4, 25, '#fff0c4');
      if (e.revir) { px(x + w / 2 - 6, y - 7, 12, 4, '#c0392b'); px(x + w / 2 - 2, y - 11, 4, 12, '#c0392b'); }
    } else if (e.side === 'e' || e.side === 'w') {
      // side entrance: a lower glass vestibule cut into the corner, with a canopy and a doormat
      const east = e.side === 'e';
      const y = (e.y - r.y + lift) * TILE, h = e.n * TILE;
      const nx = east ? X1 - 30 : X0;               // notch in the edge column
      const dir = east ? 1 : -1;
      px(nx, y - 14, 30, h + 12, '#f1f2f0');                    // vestibule wall
      px(nx, y - 18, 30, 4, pal.rim);                           // its low roof edge
      px(east ? nx : nx + 26, y - 14, 4, h + 12, 'rgba(0,0,0,0.12)');
      const gx = east ? X1 - 16 : X0 + 2;
      px(gx, y - 4, 14, h - 2, '#3e4a52');                      // glass doors
      px(gx + 2, y - 2, 10, h - 6, '#6f93ad');
      px(gx + 2, y - 2, 10, 4, '#cfe5f4');
      px(gx + 2, y - 4 + h / 2, 10, 2, '#3e4a52');
      glow(gx + 2, y + 2, 10, h - 10, '#fff0c4');
      const cx = east ? X1 - 22 : 0;
      px(cx, y - 12, 22 + PAD, 6, '#7f878d');                   // canopy
      px(cx, y - 12, 22 + PAD, 1, '#c9ced2');
      px(cx, y - 6, 22 + PAD, 3, 'rgba(0,0,0,0.25)');
      const mx = east ? X1 + 1 : 1;
      px(mx, y + 4, PAD - 2, h - 12, '#6b5b4b');                 // doormat
      px(mx + (dir > 0 ? 0 : PAD - 3), y + 4, 1, h - 12, '#4f4236');
    } else {
      // north entrance (sports hall faces the plaza): glass vestibule on the roof edge, with a sign
      const x = fx(e.x) - 14, w = e.n * TILE + 28;
      px(x, 0, w, 40, '#e8ecef');
      px(x, 0, w, 3, '#f7f8f9');
      px(x + 3, 12, w - 6, 24, '#6f93ad');
      px(x + 3, 12, w - 6, 3, '#cfe5f4');
      for (let gx = x + 3 + (w - 6) / 4; gx < x + w - 4; gx += (w - 6) / 4) px(gx, 12, 2, 24, '#3e4a52');
      px(x + 6, 3, w - 12, 7, '#2f5d8a');
      c.fillStyle = '#ffffff'; c.font = 'bold 7px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('SPOR', x + w / 2, 7);
      px(x + 2, 40, w - 4, 4, 'rgba(0,0,0,0.2)');
      glow(x + 3, 15, w - 6, 21, '#fff0c4');
    }
  }

  // crisp dark outline around the silhouette (pixel-art style)
  c.strokeStyle = 'rgba(40, 46, 52, 0.55)'; c.lineWidth = 1;
  c.strokeRect(X0 + 0.5, 0.5, X1 - X0 - 1, H - 1);
  tex.refresh(); lit.refresh();
  return art;
}

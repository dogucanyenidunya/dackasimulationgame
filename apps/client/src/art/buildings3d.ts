// 2.5D (3/4 view) buildings: each building is painted once into its own canvas, with its roof seen
// from above and its south-facing walls seen from the front. Footprints are real outlines (slanted
// walls, round halls), so the painter works edge by edge: every wall that faces the viewer is drawn
// as a quad between its foot on the ground and its top at roof level, with windows laid out along it.
// The roof is squashed towards the footprint so you can walk "behind" a building; the scene slices
// the picture into narrow columns, each sorted by the building's front edge in that column. A second
// canvas holds only the window panes, which glow at night.
import Phaser from 'phaser';
import { LOCATIONS, T, TILE, doorInPassage, inBuilding, nearestEdge, type Building, type Door, type Pt, type Rect } from '../content/campus';

/** how many tiles the roof rises above the footprint (0 when an entrance faces north: it's drawn on the roof edge) */
export function liftOf(b: Building): number {
  return doorsOf(b).some((d) => d.side === 'n') ? 0 : 1;
}
/** façade height in tiles (taller buildings look taller) */
const FACADE: Record<string, number> = { kiz_yurdu: 4, erkek_yurdu: 4, egitim: 4, yemekhane: 3, cemiyet: 3, spor: 3, tim: 3, kantin: 2 };
/** extra pixels left and right for side entrance canopies */
export const PAD = 10;

const FLOORS: Record<string, number> = { kiz_yurdu: 4, erkek_yurdu: 4, egitim: 3, yemekhane: 2, cemiyet: 2, spor: 1, tim: 1, kantin: 1 };

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

/** the building's doors on its outside walls (doors inside a corridor are drawn by the scene instead) */
function doorsOf(b: Building): Array<Door & { loc: string }> {
  return LOCATIONS.flatMap((l) => (l.doors ?? []).filter((d) => inBuilding(d.x + 0.5, d.y + 0.5, b) && !doorInPassage(d, b))
    .map((d) => ({ ...d, kind: d.kind ?? (l.id === 'revir' ? 'revir' : undefined), loc: l.id })));
}

export interface Entrance {
  side: Door['side'];
  /** where it sits on the outline (tiles), the outward normal there and the edge it's on */
  x: number; y: number; nx: number; ny: number; edge: number;
  /** width in tiles */
  w: number;
  revir: boolean;
  loc: string;
}

/** groups neighbouring door tiles on the same side into one entrance, placed on the building's outline */
export function entrances(b: Building): Entrance[] {
  const groups: Array<{ side: Door['side']; x: number; y: number; n: number; span?: number; revir: boolean; loc: string }> = [];
  const ds = doorsOf(b).sort((a, c) => a.y - c.y || a.x - c.x);
  for (const d of ds) {
    const last = groups[groups.length - 1];
    const along = d.side === 'e' || d.side === 'w';
    if (last && last.side === d.side && !last.revir && d.kind !== 'revir' && (along ? last.x === d.x && last.y + last.n === d.y : last.y === d.y && last.x + last.n === d.x)) { last.n++; continue; }
    groups.push({ side: d.side, x: d.x, y: d.y, n: 1, span: d.span, revir: d.kind === 'revir', loc: d.loc });
  }
  return groups.map((g) => {
    const along = g.side === 'e' || g.side === 'w';
    const cx = along ? g.x + 0.5 : g.x + g.n / 2, cy = along ? g.y + g.n / 2 : g.y + 0.5;
    const e = nearestEdge(cx, cy, b.shape);
    return { side: g.side, x: e.x, y: e.y, nx: e.nx, ny: e.ny, edge: e.i, w: g.span ?? g.n, revir: g.revir, loc: g.loc };
  });
}

/** the front edge of the footprint (largest y) along a vertical line, in tiles; null if the line misses it */
export function frontAt(shape: Pt[], x: number): number | null {
  let best: number | null = null;
  for (let i = 0; i < shape.length; i++) {
    const [ax, ay] = shape[i], [bx, by] = shape[(i + 1) % shape.length];
    if ((ax <= x && bx > x) || (bx <= x && ax > x)) {
      const y = ay + ((x - ax) / (bx - ax)) * (by - ay);
      if (best === null || y > best) best = y;
    }
  }
  return best;
}

/** where a horizontal line crosses the footprint: its west and east ends (tiles), or null */
export function sideX(shape: Pt[], y: number): [number, number] | null {
  const xs: number[] = [];
  for (let i = 0; i < shape.length; i++) {
    const [ax, ay] = shape[i], [bx, by] = shape[(i + 1) % shape.length];
    if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
  }
  return xs.length >= 2 ? [Math.min(...xs), Math.max(...xs)] : null;
}

/** spots along a building's sunny front walls where a bush fits (on lawn, away from doors) */
export function bushSpots(b: Building, map: number[][]): Pt[] {
  const out: Pt[] = [];
  const doors = entrances(b);
  for (let i = 0; i < b.shape.length; i++) {
    const [ax, ay] = b.shape[i], [bx, by] = b.shape[(i + 1) % b.shape.length];
    const len = Math.hypot(bx - ax, by - ay);
    const nx = (by - ay) / len, ny = -(bx - ax) / len;
    if (ny < 0.3 || len < 2) continue;
    for (let s = 1.5; s < len - 0.8; s += 3) {
      const x = ax + ((bx - ax) * s) / len + nx * 0.45, y = ay + ((by - ay) * s) / len + ny * 0.45;
      if (map[Math.floor(y)]?.[Math.floor(x)] !== T.GROUND) continue;
      if (doors.some((d) => Math.hypot(d.x - x, d.y - y) < d.w / 2 + 1.2)) continue;
      out.push([x, y]);
    }
  }
  return out;
}

export interface BuildingArt { key: string; litKey: string; x: number; y: number; w: number; h: number; base: number }

/** paints the building and its night windows; returns where to place them in the world */
export function makeBuildingArt(scene: Phaser.Scene, b: Building): BuildingArt {
  const r = b.rect;
  const lift = liftOf(b);
  const FT = FACADE[b.id] ?? 3;
  const top = (r.y - lift) * TILE;
  /** the roof's squash: the footprint's y range maps onto [top, front − façade] */
  const k = (r.h + lift - FT) / r.h;
  const ox = Math.floor(r.x * TILE) - PAD, oy = Math.floor(top);
  const W = Math.ceil((r.x + r.w) * TILE) + PAD - ox, H = Math.ceil((r.y + r.h) * TILE) - oy + 2;
  const key = `bld-${b.id}`, litKey = `bld-${b.id}-lit`;
  const art: BuildingArt = { key, litKey, x: ox, y: oy, w: W, h: H, base: (r.y + r.h) * TILE };
  if (scene.textures.exists(key)) return art;
  const tex = scene.textures.createCanvas(key, W, H)!;
  const lit = scene.textures.createCanvas(litKey, W, H)!;
  const c = tex.getContext(), L = lit.getContext();
  const rand = rng(b.id.length * 977 + Math.round(r.x * 31 + r.y));
  const pal = ROOF[b.roof];
  const style = b.roofStyle ?? 'flat';

  /** a footprint point (tiles) in canvas pixels: h = 0 on the ground, 1 at roof level */
  const P = (x: number, y: number, h = 1): [number, number] => {
    const gy = y * TILE, ry = top + (y - r.y) * k * TILE;
    return [x * TILE - ox, gy + (ry - gy) * h - oy];
  };
  const path = (ctx: CanvasRenderingContext2D, pts: Pt[], h = 1) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => { const [px, py] = P(x, y, h); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
    ctx.closePath();
  };
  const px = (x: number, y: number, w: number, h: number, col: string) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const glow = (x: number, y: number, w: number, h: number, col = '#ffd57e') => { L.fillStyle = col; L.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  /** a roof-level rect (tiles) in canvas pixels */
  const toCanvas = (s: Rect) => { const [x0, y0] = P(s.x, s.y), [x1, y1] = P(s.x + s.w, s.y + s.h); return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; };
  const [bx0, by0] = P(r.x, r.y), [bx1, by1] = P(r.x + r.w, r.y + r.h);

  // ---------- roof ----------
  c.save();
  path(c, b.shape); c.clip();
  c.fillStyle = pal.base; c.fillRect(0, 0, W, H);
  if (style === 'dome') {
    // a shallow dome: light from the north-west, ribs running to the rim
    const [cx, cy] = P(r.x + r.w / 2, r.y + r.h / 2);
    const rad = Math.max(bx1 - bx0, by1 - by0) / 2;
    const grd = c.createRadialGradient(cx - rad * 0.35, cy - rad * 0.35, 2, cx, cy, rad);
    grd.addColorStop(0, '#fbfcfc'); grd.addColorStop(0.6, pal.base); grd.addColorStop(1, pal.dark);
    c.fillStyle = grd; c.fillRect(0, 0, W, H);
    c.strokeStyle = pal.dark; c.lineWidth = 1;
    for (const [x, y] of b.shape) { const [qx, qy] = P(x, y); c.beginPath(); c.moveTo(cx, cy); c.lineTo(qx, qy); c.stroke(); }
    for (const f of [0.35, 0.7]) { c.beginPath(); c.ellipse(cx, cy, (bx1 - bx0) / 2 * f, (by1 - by0) / 2 * f, 0, 0, Math.PI * 2); c.stroke(); }
    c.fillStyle = '#eef1f3'; c.beginPath(); c.ellipse(cx, cy, 7, 5, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = pal.rimDark; c.stroke();
  } else if (style === 'vault') {
    // a barrel vault running north–south: lit on the west, shaded on the east, with arched ribs
    const grd = c.createLinearGradient(bx0, 0, bx1, 0);
    grd.addColorStop(0, pal.dark); grd.addColorStop(0.3, '#f4f6f7'); grd.addColorStop(0.55, pal.base); grd.addColorStop(1, pal.rimDark);
    c.fillStyle = grd; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(0,0,0,0.08)'; for (let y = by0 + 6; y < by1; y += 14) c.fillRect(0, y, W, 2);
    c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(bx0 + (bx1 - bx0) * 0.3, 0, 2, H);
  } else {
    // gravel / membrane texture and seams
    for (let i = 0; i < (r.w * r.h) * 5; i++) px(bx0 + rand() * (bx1 - bx0), by0 + rand() * (by1 - by0), 2, 1, rand() < 0.5 ? pal.dark : pal.light);
    for (let sx = bx0 + 32; sx < bx1; sx += 32) px(sx, 0, 1, H, pal.dark);
    for (let sy = by0 + 32; sy < by1; sy += 32) px(0, sy, W, 1, pal.dark);
    if (b.roof === 'green') for (let i = 0; i < r.w * r.h * 3; i++) px(bx0 + rand() * (bx1 - bx0), by0 + rand() * (by1 - by0), 2, 2, rand() < 0.5 ? '#88bb6b' : '#5d8f46');
  }

  const features: Rect[] = [];
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
    px(q.x, q.y + 4, q.w, q.h, 'rgba(0,0,0,0.18)');
    px(q.x, q.y, q.w, q.h, '#8fb6d4');
    if (q.w > q.h) { px(q.x, q.y, q.w, 3, '#cfe5f4'); for (let sx = q.x; sx < q.x + q.w; sx += 16) px(sx, q.y, 2, q.h, '#6d8fac'); }
    else { px(q.x, q.y, 3, q.h, '#cfe5f4'); for (let sy = q.y; sy < q.y + q.h; sy += 12) px(q.x, sy, q.w, 2, '#6d8fac'); }
    glow(q.x, q.y, q.w, q.h, '#ffe7a8');
  }
  // solar panels: tilted rows with a raised edge and a shadow
  for (const s of b.solar ?? []) {
    const q = toCanvas(s); features.push(s);
    for (let y = q.y; y + 12 <= q.y + q.h; y += 15) {
      px(q.x + 2, y + 11, q.w - 4, 3, 'rgba(0,0,0,0.22)');
      px(q.x, y, q.w, 11, '#2f4f84');
      px(q.x, y, q.w, 2, '#7c9dd0');
      for (let sx = q.x + 10; sx < q.x + q.w; sx += 10) px(sx, y + 2, 1, 9, '#4c6fa8');
      px(q.x, y + 6, q.w, 1, '#4c6fa8');
    }
  }
  // rooftop units (vents, a stair box) where there's room on a flat roof
  if (style === 'flat') {
    const clear = (x: number, y: number, w: number, h: number) => [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].every(([qx, qy]) =>
      inBuilding(qx, qy, b) && nearestEdge(qx, qy, b.shape).d > 0.7 && !(b.courtyard && nearestEdge(qx, qy, b.courtyard).d < 0.7))
      && !features.some((f) => x < f.x + f.w + 0.3 && x + w > f.x - 0.3 && y < f.y + f.h + 0.3 && y + h > f.y - 0.3);
    for (let i = 0, placed = 0; i < 60 && placed < Math.max(2, Math.floor(r.w / 5)); i++) {
      const w = (10 + Math.floor(rand() * 3) * 4) / TILE, h = (10 + Math.floor(rand() * 2) * 5) / TILE;
      const x = r.x + rand() * (r.w - w), y = r.y + rand() * (r.h - h);
      if (!clear(x, y, w, h)) continue;
      const q = toCanvas({ x, y, w, h }), tall = 5;
      px(q.x + 3, q.y + q.h, q.w, 4, 'rgba(0,0,0,0.2)');        // shadow
      px(q.x, q.y + q.h - tall, q.w, tall, '#9aa2a8');           // front face
      px(q.x, q.y - tall, q.w, q.h, '#d6dbdf');                  // top face
      px(q.x, q.y - tall, q.w, 1, '#eef1f3');
      px(q.x + q.w - 2, q.y - tall, 2, q.h + tall, 'rgba(0,0,0,0.12)');
      features.push({ x, y, w, h });
      placed++;
    }
  }
  // parapet: light coping along the edge with a darker inside lip (so the roof reads as recessed)
  c.lineJoin = 'round';
  path(c, b.shape);
  if (style === 'flat') { c.strokeStyle = 'rgba(0,0,0,0.13)'; c.lineWidth = 16; c.stroke(); }
  c.strokeStyle = pal.rim; c.lineWidth = style === 'flat' ? 10 : 6; c.stroke();
  c.restore();

  // courtyard: an open well; you see its floor and the inner wall of its north side
  if (b.courtyard) {
    const cy = b.courtyard;
    c.save();
    path(c, cy); c.clip();
    c.fillStyle = '#d9d1c2'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) px(rand() * W, rand() * H, 3, 2, '#c4baa7');
    for (let i = 0; i < cy.length; i++) {
      const [ax, ay] = cy[i], [bx, by] = cy[(i + 1) % cy.length];
      const len = Math.hypot(bx - ax, by - ay);
      if (-(bx - ax) / len > -0.2) continue; // only the yard's north side shows its wall (outward normal pointing north)
      const [x0, y0] = P(ax, ay), [x1, y1] = P(bx, by);
      c.fillStyle = '#e9ebe8'; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineTo(x1, y1 + 20); c.lineTo(x0, y0 + 20); c.closePath(); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.moveTo(x0, y0 + 20); c.lineTo(x1, y1 + 20); c.lineTo(x1, y1 + 24); c.lineTo(x0, y0 + 24); c.closePath(); c.fill();
      for (let s = 4; s < Math.abs(x1 - x0) - 8; s += 12) {
        const t = s / Math.abs(x1 - x0), wx = x0 + (x1 - x0) * t, wy = y0 + (y1 - y0) * t;
        px(Math.min(wx, wx + 7), wy + 5, 7, 10, '#4f6f8c'); px(Math.min(wx, wx + 7), wy + 5, 7, 2, '#9cc0dd'); glow(Math.min(wx, wx + 7), wy + 5, 7, 10);
      }
    }
    c.restore();
    path(c, cy); c.strokeStyle = pal.rim; c.lineWidth = 6; c.stroke();
  }

  // ---------- walls (only the ones facing the viewer), back to front ----------
  const floors = FLOORS[b.id] ?? 2;
  const doors = entrances(b);
  const n = b.shape.length;
  const walls = b.shape.map((A, i) => {
    const B = b.shape[(i + 1) % n];
    const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
    return { A, B, i, nx: (B[1] - A[1]) / len, ny: -(B[0] - A[0]) / len };
  }).filter((w) => w.ny > 0.05).sort((p, q) => Math.max(p.A[1], p.B[1]) - Math.max(q.A[1], q.B[1]));
  const quadOn = (ctx: CanvasRenderingContext2D, G: (t: number, h: number) => [number, number], t0: number, t1: number, h0: number, h1: number, col: string) => {
    ctx.fillStyle = col; ctx.beginPath();
    for (const [t, h] of [[t0, h0], [t1, h0], [t1, h1], [t0, h1]] as const) { const [qx, qy] = G(t, h); ctx.lineTo(qx, qy); }
    ctx.closePath(); ctx.fill();
  };
  for (const w of walls) {
    const [ax, ay] = w.A, [bx, by] = w.B;
    const G = (t: number, h: number) => P(ax + (bx - ax) * t, ay + (by - ay) * t, h);
    const q = (t0: number, t1: number, h0: number, h1: number, col: string) => quadOn(c, G, t0, t1, h0, h1, col);
    const ql = (t0: number, t1: number, h0: number, h1: number, col = '#ffd57e') => quadOn(L, G, t0, t1, h0, h1, col);
    const Lpx = Math.hypot((bx - ax) * TILE, (by - ay) * TILE);
    const hpx = G(0.5, 0)[1] - G(0.5, 1)[1];
    /** pixels → fraction along the wall (u) or up it (v) */
    const u = (p: number) => p / Lpx, v = (p: number) => p / hpx;
    // sun from the north-west: east-facing walls sit in shade
    q(0, 1, 0, 1, '#f1f2f0');
    if (w.nx > 0) q(0, 1, 0, 1, `rgba(0,0,0,${(0.03 + w.nx * 0.13).toFixed(3)})`);
    q(0, 1, 1 - v(4), 1, 'rgba(0,0,0,0.16)'); // shadow under the coping
    const plinth = 9;
    const vb = v(plinth + 2), vt = 1 - v(7);
    const fhf = (vt - vb) / floors;
    // entrances on this wall keep the ground floor clear
    const doorSpans = doors.filter((d) => d.edge === w.i).map((d) => {
      const tc = ((d.x - ax) * (bx - ax) + (d.y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2);
      const half = u(d.w * TILE / 2);
      return { t0: tc - half, t1: tc + half, d };
    });
    // where a corridor comes out through this wall
    const mouths = (b.passages ?? []).flatMap((p) => {
      if (Math.abs(by - ay) < 1e-3) return [];
      const ta = (p.y - ay) / (by - ay), tb = (p.y + p.h - ay) / (by - ay);
      const t0 = Math.max(0, Math.min(ta, tb)), t1 = Math.min(1, Math.max(ta, tb));
      return t1 - t0 > 0.01 ? [{ t0, t1 }] : [];
    });
    if (b.id === 'tim') {
      // the round hall's drum: tall glass slits between white panels
      q(0.25, 0.75, vb + v(2), vt - v(2), '#5f819f');
      q(0.25, 0.75, vt - v(6), vt - v(2), '#a9c9e2');
      ql(0.25, 0.75, vb + v(4), vt - v(6), '#fff0c4');
      q(0, u(1), 0, 1, 'rgba(0,0,0,0.06)');
    } else {
      for (let f = 0; f < floors; f++) {
        const lo = vb + fhf * (floors - 1 - f), hi = lo + fhf;
        const ground = f === floors - 1;
        if (f > 0) q(0, 1, hi - v(1), hi + v(1), '#dcdfe0'); // slab line between floors
        if (b.id === 'spor') {
          // tall curtain wall of the sports hall
          q(u(8), 1 - u(8), lo + v(2), hi - v(4), '#5f819f');
          q(u(8), 1 - u(8), hi - v(8), hi - v(4), '#a9c9e2');
          for (let s = 8; s < Lpx - 8; s += 18) q(u(s), u(s + 2), lo + v(2), hi - v(4), '#e8ecef');
          q(u(8), 1 - u(8), (lo + hi) / 2, (lo + hi) / 2 + v(2), '#e8ecef');
          ql(u(8), 1 - u(8), lo + v(4), hi - v(8), '#fff0c4');
          continue;
        }
        const count = Math.floor((Lpx - 8) / 22);
        const off = (Lpx - count * 22) / 2;
        const w0 = lo + v(1), w1 = hi - v(floors === 1 ? 8 : 5);
        for (let j = 0; j < count; j++) {
          const t0 = u(off + j * 22), t1 = t0 + u(16);
          if (ground && [...doorSpans, ...mouths].some((s) => t1 + u(6) > s.t0 && t0 - u(6) < s.t1)) continue;
          // window with frame, sky reflection and a wooden fin beside it (as in the aerial render)
          q(t0, t1, w0, w1, '#4f6f8c');
          q(t0, t1, w1 - v(3), w1, '#9cc0dd');
          q(t0 + u(2), t0 + u(6), w1 - v(7), w1 - v(5), '#9cc0dd');
          q(t0 + u(7), t0 + u(8), w0, w1, '#e8ecef');
          q(t0, t1, w0 - v(2), w0, '#c9ced2');              // sill
          q(t1 + u(1), t1 + u(4), w0 - v(2), w1 + v(2), '#c98a4b'); // fin
          q(t1 + u(3), t1 + u(4), w0 - v(2), w1 + v(2), '#9c6633');
          if (rand() < 0.72) ql(t0, t1, w0 + v(1), w1 - v(3), rand() < 0.2 ? '#fff0c4' : '#ffd57e');
        }
      }
    }
    // corner shading at the wall's ends
    q(0, u(2), 0, 1, 'rgba(0,0,0,0.07)'); q(1 - u(3), 1, 0, 1, 'rgba(0,0,0,0.14)');
    // plinth
    q(0, 1, 0, v(plinth), '#9aa1a6');
    q(0, 1, v(plinth) - v(1), v(plinth), '#b8bec3');
    q(0, 1, 0, v(1), '#6f767b');
    // entrances on this wall: canopy, glass doors (the Revir's is white with a red cross)
    for (const { t0, t1, d } of doorSpans) {
      const dh = v(30);
      q(t0 - u(4), t1 + u(4), dh + v(2), dh + v(8), '#7f878d');  // canopy slab
      q(t0 - u(4), t1 + u(4), dh + v(7), dh + v(8), '#c9ced2');
      q(t0 - u(2), t1 + u(2), dh - v(1), dh + v(2), 'rgba(0,0,0,0.25)');
      q(t0, t1, 0, dh, d.revir ? '#f4f4f2' : '#3e4a52');          // door frame
      q(t0 + u(2), t1 - u(2), v(1), dh - v(2), d.revir ? '#d8e8f0' : '#6f93ad');
      q(t0 + u(2), t1 - u(2), dh - v(5), dh - v(2), '#cfe5f4');
      if (t1 - t0 > u(20)) { const m = (t0 + t1) / 2; q(m - u(1), m + u(1), v(1), dh - v(2), '#3e4a52'); }
      ql(t0 + u(2), t1 - u(2), v(1), dh - v(5), '#fff0c4');
      if (d.revir) { const m = (t0 + t1) / 2; q(m - u(6), m + u(6), dh + v(10), dh + v(14), '#c0392b'); q(m - u(2), m + u(2), dh + v(6), dh + v(18), '#c0392b'); }
    }
    // corridor mouths: a tall dark opening with a stone lintel, lit inside at night
    for (const { t0, t1 } of mouths) {
      const oh = v(44);
      q(t0, t1, 0, oh, '#2b3136');
      q(t0 + u(4), t1 - u(4), v(10), oh - v(6), '#3a4147');
      ql(t0 + u(4), t1 - u(4), v(10), oh - v(6), '#ffe7a8');
      q(t0 + u(2), t1 - u(2), 0, v(10), '#8f887c');                 // the corridor floor running in
      q(t0 + u(2), t1 - u(2), v(9), v(10), '#6b655b');
      q(t0 - u(2), t1 + u(2), oh, oh + v(5), '#c9ced2');
      q(t0 - u(2), t1 + u(2), oh, oh + v(1), 'rgba(0,0,0,0.3)');
    }
    // crisp outline of the wall's foot and ends
    c.strokeStyle = 'rgba(40, 46, 52, 0.55)'; c.lineWidth = 1;
    c.beginPath(); for (const [t, h] of [[0, 1], [0, 0], [1, 0], [1, 1]] as const) { const [qx, qy] = G(t, h); c.lineTo(qx + 0.5, qy - 0.5); } c.stroke();
  }

  // ---------- entrances on walls you can't see: a glass vestibule at the roof edge or the side ----------
  for (const e of doors) {
    if (e.ny > 0.05) continue;
    if (e.ny < -0.5) {
      // facing north: a glass vestibule on the roof edge, with the place's name
      const [cx, cy] = P(e.x, e.y);
      const w = e.w * TILE + 28, x = cx - w / 2, y = cy - 2;
      px(x, y, w, 40, '#e8ecef');
      px(x, y, w, 3, '#f7f8f9');
      px(x + 3, y + 12, w - 6, 24, '#6f93ad');
      px(x + 3, y + 12, w - 6, 3, '#cfe5f4');
      for (let gx = x + 3 + (w - 6) / 4; gx < x + w - 4; gx += (w - 6) / 4) px(gx, y + 12, 2, 24, '#3e4a52');
      px(x + 6, y + 3, w - 12, 7, '#2f5d8a');
      const name = LOCATIONS.find((l) => l.id === e.loc)?.name.tr.toLocaleUpperCase('tr-TR') ?? '';
      c.fillStyle = '#ffffff'; c.font = 'bold 7px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(name.length * 4.6 > w - 14 ? name.split(' ')[0] : name, x + w / 2, y + 7);
      px(x + 2, y + 40, w - 4, 4, 'rgba(0,0,0,0.2)');
      glow(x + 3, y + 15, w - 6, 21, '#fff0c4');
    } else {
      // facing east or west: a lower glass vestibule cut into the outline, with a canopy and a doormat
      const east = e.nx > 0;
      const [ex] = P(e.x, e.y, 0);
      const y = P(e.x, e.y - e.w / 2, 0)[1], h = e.w * TILE;
      const nx = east ? ex - 30 : ex;
      const dir = east ? 1 : -1;
      px(nx, y - 14, 30, h + 12, '#f1f2f0');                    // vestibule wall
      px(nx, y - 18, 30, 4, pal.rim);                           // its low roof edge
      px(east ? nx : nx + 26, y - 14, 4, h + 12, 'rgba(0,0,0,0.12)');
      const gx = east ? ex - 16 : ex + 2;
      px(gx, y - 4, 14, h - 2, e.revir ? '#f4f4f2' : '#3e4a52');  // glass doors
      px(gx + 2, y - 2, 10, h - 6, e.revir ? '#d8e8f0' : '#6f93ad');
      px(gx + 2, y - 2, 10, 4, '#cfe5f4');
      px(gx + 2, y - 4 + h / 2, 10, 2, '#3e4a52');
      glow(gx + 2, y + 2, 10, h - 10, '#fff0c4');
      if (e.revir) { px(gx + 1, y - 12, 12, 4, '#c0392b'); px(gx + 5, y - 16, 4, 12, '#c0392b'); }
      const cx = east ? ex - 22 : ex - PAD;
      px(cx, y - 12, 22 + PAD, 6, '#7f878d');                   // canopy
      px(cx, y - 12, 22 + PAD, 1, '#c9ced2');
      px(cx, y - 6, 22 + PAD, 3, 'rgba(0,0,0,0.25)');
      const mx = east ? ex + 1 : ex - PAD + 1;
      px(mx, y + 4, PAD - 2, h - 12, '#6b5b4b');                 // doormat
      px(mx + (dir > 0 ? 0 : PAD - 3), y + 4, 1, h - 12, '#4f4236');
    }
  }

  // corridors through the building: an opening at each end, lit inside at night
  for (const p of b.passages ?? []) {
    const ends = sideX(b.shape, p.y + p.h / 2);
    if (!ends) continue;
    for (const [x, west] of [[ends[0], true], [ends[1], false]] as const) {
      if (nearestEdge(x, p.y + p.h / 2, b.shape).ny > 0.05) continue; // on a wall you can see: drawn with the wall
      const [ex, y0] = P(x, p.y + 0.1, 0), y1 = P(x, p.y + p.h - 0.1, 0)[1], h = y1 - y0;
      const rx = west ? ex : ex - 14;
      px(west ? ex - PAD : ex, y0, PAD, h, '#d9d1c2');            // paving at the mouth
      px(rx, y0, 14, h, '#2b3136');                               // the dark opening
      px(west ? rx + 6 : rx + 2, y0 + 3, 6, h - 6, '#3a4147');
      glow(west ? rx + 6 : rx + 2, y0 + 3, 6, h - 6, '#ffe7a8');
      px(rx - 1, y0 - 4, 16, 4, '#c9ced2');                       // lintel
      px(rx - 1, y0 - 1, 16, 1, 'rgba(0,0,0,0.3)');
    }
  }

  // crisp dark outline around the roof (pixel-art style)
  path(c, b.shape); c.strokeStyle = 'rgba(40, 46, 52, 0.55)'; c.lineWidth = 1; c.stroke();
  tex.refresh(); lit.refresh();
  return art;
}

/** the building's shadow on the ground (sun from the north-west), as an opaque silhouette to draw at low alpha */
export function makeShadowArt(scene: Phaser.Scene, b: Building, reach: number): { key: string; x: number; y: number } {
  const r = b.rect, key = `bld-${b.id}-shadow-${reach}`;
  const dx = reach * TILE, dy = reach * 0.6 * TILE;
  const x = Math.floor(r.x * TILE), y = Math.floor(r.y * TILE);
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.createCanvas(key, Math.ceil(r.w * TILE + dx) + 2, Math.ceil(r.h * TILE + dy) + 2)!;
    const c = tex.getContext();
    c.fillStyle = '#000';
    const at = ([px, py]: Pt, sx = 0, sy = 0): [number, number] => [px * TILE - x + sx, py * TILE - y + sy];
    const poly = (pts: Array<[number, number]>) => { c.beginPath(); pts.forEach(([qx, qy], i) => (i ? c.lineTo(qx, qy) : c.moveTo(qx, qy))); c.closePath(); c.fill(); };
    poly(b.shape.map((p) => at(p)));
    poly(b.shape.map((p) => at(p, dx, dy)));
    // sweep every edge from the footprint to its shifted copy, so the silhouette has no gaps
    b.shape.forEach((p, i) => { const q = b.shape[(i + 1) % b.shape.length]; poly([at(p), at(q), at(q, dx, dy), at(p, dx, dy)]); });
    tex.refresh();
  }
  return { key, x, y };
}

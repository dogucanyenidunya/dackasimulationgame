// Characters, drawn with canvas paths inside a 32×32 unit box so they stay sharp at any size: the 2× textures
// the campus uses and the big portraits in the creator and the profile card come from the same drawing.
// The light comes from the upper left; every part is shaded, and the dark outline is added afterwards.
import Phaser from 'phaser';
import { OUTFITS } from '../content/wardrobe';

export type HairStyle = 0 | 1 | 2 | 3 | 4 | 5; // short, buzz, long, ponytail, curly, braids
export type FaceShape = 0 | 1 | 2 | 3 | 4; // oval, round, long, square, heart

export interface CharacterLook {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  top: string;     // sweater
  bottom: string;  // trousers / skirt
  skirt: boolean;
  glasses?: boolean;
  /** iris colour */
  eyes?: string;
  freckles?: boolean;
  face?: FaceShape;
}

export const DEFAULT_LOOK: CharacterLook = {
  skin: '#e8b98f', hair: '#3b2a20', hairStyle: 0, top: '#22365c', bottom: '#5b6168', skirt: false,
};

/** texture pixels per world pixel: characters stand 32×32 in the world, their textures are drawn this many times finer */
export const CHAR_RES = 2;

/** shows a character texture at its world size (times `scale`) */
export function fitCharacter<T extends Phaser.GameObjects.Sprite>(sp: T, scale = 1): T {
  sp.setScale(scale / CHAR_RES);
  return sp;
}

/** the usual hit box: 16×10 world pixels around the feet */
export function footBody(sp: Phaser.Physics.Arcade.Sprite) {
  (sp.body as Phaser.Physics.Arcade.Body).setSize(16 * CHAR_RES, 10 * CHAR_RES).setOffset(8 * CHAR_RES, 21 * CHAR_RES);
}

// ---------- clothes ----------

type Garment = 'uniform' | 'tracksuit' | 'coat' | 'pyjamas' | 'casual';
const GARMENT_BY_OUTFIT: Record<string, Garment> = { uniforma: 'uniform', esofman: 'tracksuit', mont: 'coat', pijama: 'pyjamas' };
const GARMENT_BY_TOP = new Map(OUTFITS.map((o) => [o.top.toLowerCase(), GARMENT_BY_OUTFIT[o.id] ?? 'casual']));
const JEANS = OUTFITS.find((o) => o.id === 'sivil')?.bottom.toLowerCase();
const TIE = '#8c2230';
const SHIRT = '#f4f4ee';

// ---------- colour helpers ----------

function rgbOf(col: string): [number, number, number] {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(col.trim());
  if (!m) return [128, 128, 128];
  let s = m[1];
  if (s.length === 3) s = s.split('').map((ch) => ch + ch).join('');
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mix(a: string, b: string, t: number): string {
  const x = rgbOf(a), y = rgbOf(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
const dk = (c: string, t: number) => mix(c, '#140c12', t);
const lt = (c: string, t: number) => mix(c, '#fff8ec', t);
/** skin darkens towards a warm brown rather than grey */
const sdk = (c: string, t: number) => mix(c, '#5c2216', t);
const rgba = (c: string, a: number) => { const [r, g, b] = rgbOf(c); return `rgba(${r},${g},${b},${a})`; };

// ---------- drawing helpers (one character is drawn at a time) ----------

type Ctx = CanvasRenderingContext2D;
let C!: Ctx;
/** the side view facing left is the right-facing one mirrored; shading still has to come from the left */
let FLIP = false;

const P = () => new Path2D();
function rr(x: number, y: number, w: number, h: number, r: number | number[]) { const p = P(); p.roundRect(x, y, w, h, r); return p; }
function el(x: number, y: number, rx: number, ry: number, rot = 0) { const p = P(); p.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); return p; }
function fill(p: Path2D, style: string | CanvasGradient) { C.fillStyle = style; C.fill(p); }
function stroke(p: Path2D, col: string, w: number) { C.strokeStyle = col; C.lineWidth = w; C.stroke(p); }
function lin(x0: number, y0: number, x1: number, y1: number, stops: Array<[number, string]>) {
  const g = C.createLinearGradient(x0, y0, x1, y1);
  for (const [o, s] of stops) g.addColorStop(o, s);
  return g;
}
function rad(x: number, y: number, r: number, stops: Array<[number, string]>) {
  const g = C.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, s] of stops) g.addColorStop(o, s);
  return g;
}
/** x moved towards the light by d (left on screen, whichever way the view is mirrored) */
const toLight = (x: number, d: number) => x + (FLIP ? d : -d);
/** lit on the screen-left edge, in shadow on the right */
function shaded(p: Path2D, base: string, x0: number, x1: number, hi = 0.18, lo = 0.34) {
  if (FLIP) [x0, x1] = [x1, x0];
  fill(p, lin(x0, 0, x1, 0, [[0, lt(base, hi)], [0.45, base], [1, dk(base, lo)]]));
}
function clip(p: Path2D, fn: () => void) { C.save(); C.clip(p); fn(); C.restore(); }
function curve(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, col: string, w: number) {
  const p = P(); p.moveTo(x0, y0); p.quadraticCurveTo(cx, cy, x1, y1); stroke(p, col, w);
}
function line(pts: number[], col: string, w: number) {
  const p = P(); p.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1]);
  stroke(p, col, w);
}

type View = 'front' | 'side' | 'back';
interface Kid {
  look: CharacterLook; view: View;
  /** stride: 1 / -1 mid-step, 0 standing */
  f: number;
  g: Garment; blink: boolean;
}

/**
 * Draws one character in a 32×32 box at (ox, oy) of the current transform (scale the context first for a bigger picture).
 * dir: 0 down, 1 left, 2 right, 3 up. frame: 0 idle, 1/2 walking.
 */
export function drawCharacter(c: Ctx, ox: number, oy: number, look: CharacterLook, dir: number, frame: number, opts: { blink?: boolean } = {}) {
  C = c;
  c.save();
  c.translate(ox, oy);
  FLIP = dir === 1;
  if (FLIP) { c.translate(32, 0); c.scale(-1, 1); }
  c.lineCap = 'round'; c.lineJoin = 'round';
  const k: Kid = {
    look, view: dir === 0 ? 'front' : dir === 3 ? 'back' : 'side',
    f: frame === 1 ? 1 : frame === 2 ? -1 : 0,
    g: GARMENT_BY_TOP.get(look.top.toLowerCase()) ?? 'casual', blink: !!opts.blink,
  };
  groundShadow();
  if (k.view === 'side') drawSide(k); else drawFrontBack(k);
  c.restore();
  FLIP = false;
}

function groundShadow() {
  C.save(); C.translate(16, 29.1); C.scale(1, 0.27);
  fill(el(0, 0, 7, 7), rad(0, 0, 7, [[0, 'rgba(10,14,12,0.32)'], [0.65, 'rgba(10,14,12,0.18)'], [1, 'rgba(10,14,12,0)']]));
  C.restore();
}

// ---------- front and back ----------

function drawFrontBack(k: Kid) {
  const back = k.view === 'back';
  const bob = k.f ? 0.55 : 0;
  if (!back) { C.save(); C.translate(0, -bob); hairBehind(k); C.restore(); }
  if (k.look.skirt) skirtLegs(k); else trousers(k);
  C.save(); C.translate(0, -bob);
  neckFront(k);
  torsoFB(k);
  armFB(k, -1); armFB(k, 1);
  if (k.g === 'coat') coatCollar(k);
  if (back) headBack(k); else headFront(k);
  hair(k);
  if (!back && k.look.glasses) glassesFront();
  C.restore();
}

/** which foot is up: frame 1 lifts the screen-left one */
const lift = (k: Kid, side: number) => (k.f === -side ? 0.9 : 0);

function shoe(k: Kid, x: number, y: number, w: number, back: boolean) {
  const g = k.g;
  const col = g === 'tracksuit' ? '#ecebe6' : g === 'pyjamas' ? '#6f7fa6' : g === 'coat' ? '#4b3427' : g === 'casual' ? '#3a404a' : '#211d1f';
  const s = rr(x, y, w, 2.35, back ? [1, 1, 0.7, 0.7] : [1.3, 1.3, 0.7, 0.7]);
  shaded(s, col, x, x + w, 0.22, 0.42);
  const soleCol = g === 'tracksuit' || g === 'casual' ? '#f2f1ec' : dk(col, 0.45);
  fill(rr(x - 0.05, y + 1.8, w + 0.1, 0.6, 0.3), soleCol);
  if (back) return;
  if (g === 'tracksuit' || g === 'casual') {
    line([x + w / 2 - 0.7, y + 0.55, x + w / 2 + 0.7, y + 0.55], rgba(g === 'casual' ? '#ffffff' : '#9aa0a6', 0.8), 0.22);
    line([x + w / 2 - 0.6, y + 1.05, x + w / 2 + 0.6, y + 1.05], rgba(g === 'casual' ? '#ffffff' : '#9aa0a6', 0.8), 0.22);
  } else if (g !== 'pyjamas') {
    fill(el(x + w * 0.36, y + 0.75, w * 0.24, 0.38), 'rgba(255,255,255,0.3)'); // polished toe
  }
}

function trousers(k: Kid) {
  const { look } = k;
  const col = look.bottom;
  const legs: Array<{ x: number; l: number; p: Path2D }> = [];
  for (const side of [-1, 1]) {
    const x = side < 0 ? 11.7 : 16.3, l = lift(k, side);
    shoe(k, x - 0.3, 26.65 - l, 4.6, k.view === 'back');
    legs.push({ x, l, p: rr(x, 20.4, 4.0, 6.9 - l, [0.4, 0.4, 0.5, 0.5]) });
  }
  const all = rr(11.5, 19.3, 9.0, 3.4, [1.2, 1.2, 0.4, 0.4]);
  for (const g of legs) all.addPath(g.p);
  shaded(all, col, 11.5, 20.5, 0.16, 0.3);
  const jeans = col.toLowerCase() === JEANS;
  for (const { x, l, p } of legs) {
    clip(p, () => {
      // each leg is round: a soft shadow down its inner side and a darker hem
      fill(rr(x - 0.2, 20, 4.4, 8, 0), lin(x, 0, x + 4, 0, [[0, 'rgba(255,255,255,0.08)'], [0.5, 'rgba(255,255,255,0)'], [1, 'rgba(20,10,18,0.16)']]));
      fill(rr(x - 0.2, 26.6 - l, 4.4, 0.8, 0), rgba(dk(col, 0.5), 0.35));
      fill(rr(x - 0.2, 23.0, 4.4, 0.9, 0), 'rgba(255,255,255,0.06)'); // knee
    });
    if (k.g === 'tracksuit') line([x + (x < 16 ? 0.55 : 3.45), 20.4, x + (x < 16 ? 0.55 : 3.45), 27.2 - l], 'rgba(255,255,255,0.85)', 0.38);
    else if (k.g === 'pyjamas') clip(p, () => { for (let sx = x + 0.5; sx < x + 4; sx += 1.2) line([sx, 20, sx, 28], rgba(lt(col, 0.5), 0.7), 0.35); });
    else line([x + 2.0, 21.6, x + 2.05, 26.5 - l], rgba(dk(col, 0.45), 0.4), 0.2); // crease
    if (jeans) {
      C.setLineDash([0.35, 0.3]);
      line([x + (x < 16 ? 0.45 : 3.55), 21, x + (x < 16 ? 0.45 : 3.55), 26.8 - l], 'rgba(214,160,92,0.6)', 0.14);
      C.setLineDash([]);
    }
  }
  // the seam between the legs and the shadow under the sweater
  line([16, 20.6, 16, 22.4], rgba(dk(col, 0.5), 0.5), 0.22);
  fill(rr(11.5, 19.3, 9.0, 1.0, 0.5), rgba(dk(col, 0.6), 0.35));
  if (jeans && k.view === 'front') { curve(12.2, 20.6, 13.4, 21.8, 14.6, 20.6, 'rgba(214,160,92,0.55)', 0.14); curve(17.4, 20.6, 18.6, 21.8, 19.8, 20.6, 'rgba(214,160,92,0.55)', 0.14); }
}

function skirtLegs(k: Kid) {
  const { look } = k;
  for (const side of [-1, 1]) {
    const x = side < 0 ? 12.3 : 16.9, l = lift(k, side);
    shoe(k, x - 0.45, 26.85 - l, 3.7, k.view === 'back');
    const leg = rr(x, 23.0, 2.8, 4.3 - l, 0.9);
    shaded(leg, look.skin, x, x + 2.8, 0.12, 0.28);
    // knee socks with a folded top
    const sock = rr(x - 0.05, 25.0 - l, 2.9, 2.2, [0.5, 0.5, 0.2, 0.2]);
    shaded(sock, '#efefe9', x, x + 2.9, 0.1, 0.22);
    fill(rr(x - 0.05, 25.0 - l, 2.9, 0.55, 0.3), '#dcdcd5');
  }
  const col = look.bottom;
  const s = P();
  s.moveTo(11.3, 19.3); s.lineTo(20.7, 19.3); s.lineTo(22.4, 24.9);
  s.quadraticCurveTo(16, 25.6, 9.6, 24.9); s.closePath();
  shaded(s, col, 9.6, 22.4, 0.16, 0.32);
  clip(s, () => {
    // pleats: each fold has a lit face and a shaded one
    for (let i = 0; i < 6; i++) {
      const tx = 12.0 + i * 1.6, bx = 10.6 + i * 2.15;
      line([tx, 19.6, bx, 25.6], rgba(dk(col, 0.45), 0.55), 0.24);
      line([tx + 0.35, 19.6, bx + 0.5, 25.6], rgba(lt(col, 0.3), 0.35), 0.18);
    }
    fill(rr(9, 24.1, 14, 1.6, 0), rgba(dk(col, 0.4), 0.3));
    fill(rr(9, 19.2, 14, 0.9, 0), rgba(dk(col, 0.55), 0.35)); // under the sweater
    if (k.g === 'pyjamas') for (let sx = 10; sx < 23; sx += 1.3) line([sx, 19, sx + (sx - 16) * 0.2, 26], rgba(lt(col, 0.5), 0.6), 0.32);
  });
}

function neckFront(k: Kid) {
  const skin = k.look.skin;
  const n = rr(14.6, 10.2, 2.8, 3.4, 0.9);
  fill(n, lin(0, 10.2, 0, 13.6, [[0, sdk(skin, 0.32)], [0.6, sdk(skin, 0.18)], [1, sdk(skin, 0.1)]]));
}

function torsoPath(k: Kid) {
  const coat = k.g === 'coat';
  const w = coat ? 0.5 : 0, hem = coat ? 22.0 : 20.7;
  const t = P();
  t.moveTo(13.4, 12.4);
  t.bezierCurveTo(11.6 - w, 12.6, 10.0 - w, 13.0, 9.8 - w, 14.8);
  t.lineTo(10.2 - w, hem);
  t.quadraticCurveTo(16, hem + 0.5, 21.8 + w, hem);
  t.lineTo(22.2 + w, 14.8);
  t.bezierCurveTo(22.0 + w, 13.0, 20.4 + w, 12.6, 18.6, 12.4);
  if (k.view === 'back') t.quadraticCurveTo(16, 11.9, 13.4, 12.4);
  else t.quadraticCurveTo(16, 13.5, 13.4, 12.4);
  t.closePath();
  return { t, hem };
}

function ribs(x0: number, x1: number, y: number, h: number, col: string) {
  fill(rr(x0, y, x1 - x0, h, 0), rgba(dk(col, 0.3), 0.45));
  for (let x = x0 + 0.3; x < x1; x += 0.55) line([x, y + 0.1, x, y + h - 0.1], rgba(dk(col, 0.5), 0.35), 0.12);
}

function torsoFB(k: Kid) {
  const { look, g } = k;
  const col = look.top;
  const back = k.view === 'back';
  const { t, hem } = torsoPath(k);
  shaded(t, col, 9.6, 22.4);
  clip(t, () => {
    // the head throws a soft shadow on the chest; the sides of the body turn away from the light
    fill(el(16, 12.8, 4.4, 1.8), rad(16, 12.6, 4.4, [[0, 'rgba(20,10,18,0.28)'], [1, 'rgba(20,10,18,0)']]));
    fill(rr(9, 12, 14, 10.5, 0), lin(0, 12, 0, hem, [[0, 'rgba(255,255,255,0.08)'], [0.5, 'rgba(255,255,255,0)'], [1, 'rgba(20,10,18,0.12)']]));
    if (g === 'uniform' || g === 'casual') {
      ribs(9, 23, hem - 1.2, 1.4, col);
      // knit: faint rows
      for (let y = 13.6; y < hem - 1.2; y += 0.75) line([9, y, 23, y], rgba(dk(col, 0.4), 0.1), 0.12);
    }
    if (g === 'pyjamas') {
      for (let x = 10.2; x < 22.4; x += 1.3) line([x, 12, x, 22], rgba(lt(col, 0.55), 0.75), 0.4);
    }
    if (g === 'coat') {
      // quilted down coat
      for (const y of [15.0, 17.4, 19.8]) curve(9, y, 16, y + 0.6, 23, y, rgba(dk(col, 0.5), 0.7), 0.3);
      for (const y of [14.4, 16.8, 19.2, 21.4]) curve(9, y, 16, y + 0.6, 23, y, rgba(lt(col, 0.25), 0.35), 0.5);
    }
    if (g === 'tracksuit' && !back) fill(rr(18.6, 14.6, 1.6, 0.9, 0.2), 'rgba(255,255,255,0.8)');
  });
  if (back) {
    if (g === 'uniform') fill(rr(13.5, 11.5, 5.0, 1.2, 0.5), lin(0, 11.5, 0, 12.7, [[0, SHIRT], [1, '#cfcfc8']]));
    if (g === 'tracksuit') fill(rr(13.3, 11.4, 5.4, 1.4, 0.5), lt(col, 0.1));
    return;
  }
  if (g === 'uniform') uniformFront(col);
  else if (g === 'tracksuit') {
    fill(rr(13.3, 11.6, 5.4, 1.5, [0.6, 0.6, 0.2, 0.2]), lin(0, 11.6, 0, 13.1, [[0, lt(col, 0.15)], [1, dk(col, 0.2)]]));
    line([16, 12.8, 16, hem], '#d8dde0', 0.28);
    fill(rr(15.65, 13.3, 0.7, 1.1, 0.2), '#e8ecee');
  } else if (g === 'pyjamas') {
    for (const s of [-1, 1]) { const p = P(); p.moveTo(16, 13.6); p.lineTo(16 - s * 2.7, 12.3); p.lineTo(16 - s * 1.5, 14.6); p.closePath(); fill(p, lt(col, 0.35)); stroke(p, rgba(dk(col, 0.4), 0.5), 0.14); }
    line([16, 13.6, 16, hem], rgba(dk(col, 0.35), 0.6), 0.2);
    for (const y of [15.2, 17.0, 18.8]) fill(el(16.45, y, 0.32, 0.32), '#ffffff');
  } else if (g === 'casual') {
    curve(13.4, 12.5, 16, 13.7, 18.6, 12.5, dk(col, 0.32), 0.75);
  } else if (g === 'coat') {
    line([16, 13.4, 16, hem], rgba(dk(col, 0.6), 0.8), 0.28);
    line([11.4, 18.6, 12.8, 20.4], rgba(dk(col, 0.6), 0.7), 0.24); line([20.6, 18.6, 19.2, 20.4], rgba(dk(col, 0.6), 0.7), 0.24);
  }
}

function uniformFront(col: string) {
  const v = P(); v.moveTo(13.4, 12.45); v.lineTo(18.6, 12.45); v.lineTo(16, 16.9); v.closePath();
  fill(v, lin(0, 12.4, 0, 16.9, [[0, '#d6d6cf'], [0.35, SHIRT], [1, '#e2e2db']]));
  clip(v, () => {
    fill(rr(15.35, 12.95, 1.3, 1.05, 0.4), dk(TIE, 0.15));
    const b = P(); b.moveTo(15.4, 13.85); b.lineTo(16.6, 13.85); b.lineTo(17.0, 17.2); b.lineTo(15.0, 17.2); b.closePath();
    shaded(b, TIE, 15.0, 17.0, 0.2, 0.3);
    for (const y of [14.7, 15.9]) line([15.1, y + 0.4, 16.9, y - 0.2], 'rgba(222,184,92,0.55)', 0.2); // school stripes
  });
  // collar points lying over the sweater
  for (const s of [-1, 1]) {
    const p = P(); p.moveTo(16 + s * 2.75, 12.15); p.lineTo(16 + s * 0.35, 13.3); p.lineTo(16 + s * 1.75, 14.6); p.closePath();
    fill(p, s < 0 ? '#fbfbf7' : '#e6e6df'); stroke(p, 'rgba(60,60,70,0.35)', 0.14);
  }
  // V-neck rib
  const vr = P(); vr.moveTo(13.2, 12.45); vr.lineTo(16, 17.05); vr.lineTo(18.8, 12.45);
  stroke(vr, dk(col, 0.35), 0.6);
  stroke(vr, rgba(lt(col, 0.25), 0.4), 0.15);
  // school badge
  const e = P(); e.moveTo(18.7, 15.0); e.lineTo(20.2, 15.0); e.lineTo(20.2, 16.0); e.quadraticCurveTo(20.1, 16.7, 19.45, 17.0); e.quadraticCurveTo(18.8, 16.7, 18.7, 16.0); e.closePath();
  fill(e, lin(18.7, 15, 20.2, 17, [[0, '#f2d27a'], [1, '#b88a2e']]));
  fill(el(19.45, 15.9, 0.35, 0.35), '#7a1f2b');
}

function armFB(k: Kid, side: number) {
  const { look, g } = k;
  const col = look.top;
  const px = side < 0 ? 10.9 : 21.1;
  const sw = k.f * side * 0.5; // the arms swing against the legs
  const wide = g === 'coat' ? 0.25 : 0;
  C.save(); C.translate(px - side * wide, 13.9); C.rotate(-side * 0.1);
  const len = 7.0 + sw;
  const sl = rr(-1.4 - wide, -0.7, 2.8 + wide * 2, len, [1.4, 1.4, 0.7, 0.7]);
  shaded(sl, col, -1.4, 1.4, 0.18, 0.36);
  clip(sl, () => {
    if (g === 'uniform' || g === 'casual') ribs(-2, 2, len - 1.7, 1.0, col);
    if (g === 'pyjamas') line([0, -1, 0, len], rgba(lt(col, 0.55), 0.75), 0.4);
    if (g === 'coat') for (const y of [2.0, 4.4]) curve(-2, y, 0, y + 0.4, 2, y, rgba(dk(col, 0.5), 0.6), 0.26);
    if (g === 'tracksuit') line([side * 0.85, -1, side * 0.85, len], 'rgba(255,255,255,0.85)', 0.38);
  });
  // hand
  const h = el(0, len - 0.05, 1.12, 1.32);
  fill(h, rad(toLight(0, 0.4), len - 0.5, 1.6, [[0, lt(look.skin, 0.1)], [0.6, look.skin], [1, sdk(look.skin, 0.25)]]));
  curve(-side * 0.55, len + 0.1, -side * 0.75, len + 0.6, -side * 0.35, len + 0.9, rgba(sdk(look.skin, 0.5), 0.45), 0.16); // thumb
  C.restore();
}

function coatCollar(k: Kid) {
  const col = mix(k.look.top, '#e9dcc4', 0.68);
  const c = rr(12.3, 11.3, 7.4, 2.5, 1.25);
  if (k.view === 'front') {
    // a fur-lined hood around the neck, open at the front
    shaded(c, col, 12.3, 19.7, 0.15, 0.3);
    fill(rr(14.4, 12.3, 3.2, 1.6, 0.8), dk(k.look.top, 0.4));
    for (let x = 12.8; x < 19.5; x += 0.8) fill(el(x, 11.5 + ((x * 7) % 3) * 0.1, 0.35, 0.3), rgba(lt(col, 0.4), 0.7));
  } else {
    shaded(rr(12.0, 11.2, 8.0, 3.0, 1.4), col, 12, 20, 0.15, 0.3);
  }
}

// ---------- faces ----------

/**
 * Face shapes (front view): half the width at the temples, the cheek and jaw control points of the side curve
 * (as offsets from the centre line) and how low the chin sits. Square faces get a jaw corner instead of a curve.
 */
const FACES: Record<FaceShape, { rx: number; cheek: [number, number]; jaw: [number, number]; chin: number }> = {
  0: { rx: 4.7, cheek: [4.8, 9.6], jaw: [3.2, 11.9], chin: 12.0 },   // oval
  1: { rx: 5.1, cheek: [5.5, 10.3], jaw: [4.1, 11.6], chin: 11.65 }, // round
  2: { rx: 4.25, cheek: [4.3, 10.4], jaw: [2.4, 12.75], chin: 12.85 }, // long
  3: { rx: 4.95, cheek: [4.95, 10.3], jaw: [4.6, 11.65], chin: 12.1 }, // square
  4: { rx: 5.05, cheek: [5.5, 8.1], jaw: [1.5, 11.8], chin: 12.4 },  // heart
};
const faceOf = (look: CharacterLook) => FACES[look.face ?? 0] ?? FACES[0];
/** where the ears sit for this face (half the width from the centre) */
const earX = (look: CharacterLook) => faceOf(look).rx + 0.05;

function facePath(look: CharacterLook) {
  const f = faceOf(look);
  const p = P();
  p.moveTo(16 - f.rx, 6.6);
  p.ellipse(16, 6.6, f.rx, 5.2, 0, Math.PI, Math.PI * 2);
  if (look.face === 3) {
    // straight sides, a clear jaw corner and a broad chin
    p.lineTo(16 + f.cheek[0], f.cheek[1]);
    p.quadraticCurveTo(16 + f.jaw[0] + 0.45, f.jaw[1] - 0.1, 16 + f.jaw[0] - 0.9, f.jaw[1] + 0.35);
    p.quadraticCurveTo(17.4, f.chin + 0.05, 16, f.chin);
    p.quadraticCurveTo(14.6, f.chin + 0.05, 16 - f.jaw[0] + 0.9, f.jaw[1] + 0.35);
    p.quadraticCurveTo(16 - f.jaw[0] - 0.45, f.jaw[1] - 0.1, 16 - f.cheek[0], f.cheek[1]);
  } else {
    p.bezierCurveTo(16 + f.cheek[0], f.cheek[1], 16 + f.jaw[0], f.jaw[1], 16, f.chin);
    p.bezierCurveTo(16 - f.jaw[0], f.jaw[1], 16 - f.cheek[0], f.cheek[1], 16 - f.rx, 6.6);
  }
  p.closePath();
  return p;
}

function ear(x: number, y: number, side: number, skin: string) {
  fill(el(x, y, 0.95, 1.38), lin(x - 1, 0, x + 1, 0, side < 0 ? [[0, lt(skin, 0.05)], [1, sdk(skin, 0.2)]] : [[0, sdk(skin, 0.12)], [1, sdk(skin, 0.3)]]));
  curve(x + side * 0.1, y - 0.8, x + side * 0.55, y, x + side * 0.05, y + 0.75, rgba(sdk(skin, 0.6), 0.45), 0.2);
}

function brows(look: CharacterLook) {
  return mix(look.hair, '#24160f', 0.35);
}

function eyeFront(x: number, y: number, k: Kid, side: number) {
  const lid = '#2a1812';
  const iris = k.look.eyes ?? '#4a2e1c';
  if (k.blink) { curve(x - 1.05, y - 0.1, x, y + 0.45, x + 1.05, y - 0.1, lid, 0.34); return; }
  const w = P();
  w.moveTo(x - 1.1, y); w.quadraticCurveTo(x - side * 0.1, y - 1.1, x + 1.1, y - 0.05);
  w.quadraticCurveTo(x, y + 0.85, x - 1.1, y); w.closePath();
  fill(w, '#f7f3ec');
  clip(w, () => {
    fill(el(x + 0.06, y - 0.05, 0.7, 0.7), rad(x + 0.06, y + 0.25, 0.9, [[0, lt(iris, 0.3)], [0.6, iris], [1, dk(iris, 0.45)]]));
    fill(el(x + 0.06, y - 0.05, 0.3, 0.3), '#0b0706');
    fill(rr(x - 1.3, y - 1.2, 2.6, 0.75, 0), 'rgba(70,35,25,0.28)'); // the lid's shadow on the eyeball
  });
  fill(el(x - 0.2, y - 0.32, 0.17, 0.17), '#ffffff');
  const u = P(); u.moveTo(x - 1.18, y + 0.05); u.quadraticCurveTo(x - side * 0.1, y - 1.18, x + 1.18, y - 0.08);
  stroke(u, lid, 0.36);
  line([x + side * 1.12, y - 0.1, x + side * 1.45, y - 0.35], lid, 0.2); // lashes at the outer corner
  curve(x - 0.8, y + 0.55, x, y + 0.85, x + 0.8, y + 0.5, rgba(sdk(k.look.skin, 0.5), 0.3), 0.16);
}

function headFront(k: Kid) {
  const { look } = k;
  const skin = look.skin;
  ear(16 - earX(look), 7.7, -1, skin); ear(16 + earX(look), 7.7, 1, skin);
  const face = facePath(look);
  fill(face, rad(14.5, 5.4, 7.6, [[0, lt(skin, 0.16)], [0.5, skin], [1, sdk(skin, 0.3)]]));
  clip(face, () => {
    if (look.hairStyle !== 1) fill(rr(10, 3.5, 12, 3.4, 0), lin(0, 4.4, 0, 6.6, [[0, rgba(sdk(skin, 0.6), 0.4)], [1, rgba(sdk(skin, 0.6), 0)]]));
    for (const s of [-1, 1]) fill(el(16 + s * 2.95, 9.55, 1.6, 1.05), rad(16 + s * 2.95, 9.55, 1.6, [[0, 'rgba(232,104,100,0.32)'], [1, 'rgba(232,104,100,0)']]));
    fill(el(16, faceOf(look).chin + 0.3, 3.6, 1.0), 'rgba(92,34,22,0.12)'); // under the chin
  });
  // brows
  const bc = brows(look);
  curve(12.75, 6.2, 13.8, 5.45, 15.05, 5.95, bc, 0.45);
  curve(19.25, 6.2, 18.2, 5.45, 16.95, 5.95, bc, 0.45);
  eyeFront(13.95, 7.75, k, -1);
  eyeFront(18.05, 7.75, k, 1);
  // nose: a shaded side, a soft shadow underneath and a lit tip
  curve(16.5, 7.9, 16.85, 8.9, 16.6, 9.55, rgba(sdk(skin, 0.6), 0.3), 0.3);
  curve(15.4, 9.75, 16.0, 10.1, 16.65, 9.72, rgba(sdk(skin, 0.6), 0.5), 0.3);
  fill(el(15.85, 9.15, 0.36, 0.26), rgba(lt(skin, 0.6), 0.45));
  // mouth
  curve(15.0, 10.75, 16.0, 11.3, 17.0, 10.75, mix(skin, '#8a3832', 0.6), 0.38);
  curve(15.55, 11.3, 16.0, 11.45, 16.45, 11.3, rgba(lt(skin, 0.35), 0.6), 0.22);
  if (look.freckles) {
    const fc = rgba(sdk(skin, 0.6), 0.55);
    for (const [x, y] of [[12.9, 9.0], [13.6, 9.55], [12.6, 9.7], [14.3, 9.05], [17.7, 9.05], [18.4, 9.55], [19.1, 9.0], [18.9, 9.75], [15.5, 8.7], [16.55, 8.55]]) fill(el(x, y, 0.15, 0.15), fc);
  }
}

function headBack(k: Kid) {
  const skin = k.look.skin;
  ear(16 - earX(k.look), 7.7, -1, skin); ear(16 + earX(k.look), 7.7, 1, skin);
  fill(facePath(k.look), rad(14.5, 6, 7.6, [[0, skin], [1, sdk(skin, 0.3)]]));
}

function glassesFront() {
  const fr = '#3b4a5c';
  for (const x of [13.95, 18.05]) {
    const g = rr(x - 1.45, 6.6, 2.9, 2.25, 0.85);
    fill(g, 'rgba(205,228,245,0.16)');
    stroke(g, fr, 0.3);
    line([x - 0.85, 7.6, x - 0.25, 6.95], 'rgba(255,255,255,0.65)', 0.2);
  }
  curve(15.4, 7.35, 16, 7.0, 16.6, 7.35, fr, 0.3);
  line([12.5, 7.3, 11.4, 7.1], fr, 0.3); line([19.5, 7.3, 20.6, 7.1], fr, 0.3);
}

// ---------- side ----------

function drawSide(k: Kid) {
  const { look } = k;
  const bob = k.f ? 0.55 : 0;
  const legA = k.f * 0.42;
  const armA = -k.f * 0.5;
  C.save(); C.translate(0, -bob); armSide(k, -armA, true); C.restore();
  legSide(k, -legA, true);
  legSide(k, legA, false);
  if (look.skirt) skirtSide(k);
  else shaded(rr(12.6, 19.2, 7.0, 2.9, [1.2, 1.4, 0.6, 0.6]), look.bottom, 12.6, 19.6, 0.16, 0.3);
  C.save(); C.translate(0, -bob);
  fill(rr(14.6, 10.2, 2.9, 3.4, 0.9), sdk(look.skin, 0.24));
  torsoSide(k);
  if (k.g === 'coat') coatCollar(k);
  hairBackSide(k);
  headSide(k);
  hairSideCap(k);
  if (look.glasses) {
    const fr = '#3b4a5c';
    const g = rr(18.45, 6.7, 1.75, 2.2, 0.7);
    fill(g, 'rgba(205,228,245,0.16)'); stroke(g, fr, 0.3);
    line([18.45, 7.35, 15.6, 7.0], fr, 0.3);
  }
  armSide(k, armA, false);
  C.restore();
}

function legSide(k: Kid, a: number, far: boolean) {
  const { look } = k;
  C.save(); C.translate(16.0, 19.9); C.rotate(-a);
  // the foot stays nearly flat on the ground while the leg swings
  const foot = () => {
    C.save(); C.translate(0, 7.1); C.rotate(a * 0.8);
    const g = k.g;
    const col0 = g === 'tracksuit' ? '#ecebe6' : g === 'pyjamas' ? '#6f7fa6' : g === 'coat' ? '#4b3427' : g === 'casual' ? '#3a404a' : '#211d1f';
    const col = far ? dk(col0, 0.2) : col0;
    const s = P(); s.moveTo(-1.8, 0); s.lineTo(0.9, 0); s.quadraticCurveTo(2.9, 0.35, 3.0, 1.6); s.lineTo(3.0, 2.05); s.lineTo(-1.8, 2.05); s.closePath();
    shaded(s, col, -1.8, 3.0, 0.2, 0.4);
    fill(rr(-1.85, 1.55, 4.9, 0.6, 0.25), g === 'tracksuit' || g === 'casual' ? '#f2f1ec' : dk(col, 0.45));
    if (g === 'uniform' || g === 'coat') fill(el(1.6, 0.6, 0.8, 0.3), 'rgba(255,255,255,0.28)');
    C.restore();
  };
  if (look.skirt) {
    foot();
    shaded(rr(-1.25, 0, 2.5, 7.4, 0.9), far ? sdk(look.skin, 0.15) : look.skin, -1.25, 1.25, 0.12, 0.28);
    shaded(rr(-1.3, 4.9, 2.6, 2.3, [0.5, 0.5, 0.2, 0.2]), far ? '#cfcfca' : '#efefe9', -1.3, 1.3, 0.1, 0.22);
  } else {
    foot();
    const col = far ? dk(look.bottom, 0.22) : look.bottom;
    const leg = rr(-1.85, -0.4, 3.7, 7.75, [1, 1, 0.5, 0.5]);
    shaded(leg, col, -1.85, 1.85, 0.16, 0.32);
    clip(leg, () => fill(rr(-2, 6.6, 4, 0.8, 0), rgba(dk(col, 0.5), 0.35)));
    if (k.g === 'tracksuit' && !far) line([0, -0.4, 0, 7.3], 'rgba(255,255,255,0.85)', 0.38);
    if (k.g === 'pyjamas') clip(leg, () => { for (let x = -1.3; x < 2; x += 1.2) line([x, -1, x, 8], rgba(lt(col, 0.5), 0.6), 0.35); });
  }
  C.restore();
}

function skirtSide(k: Kid) {
  const col = k.look.bottom;
  const s = P();
  s.moveTo(12.6, 19.2); s.lineTo(19.6, 19.2); s.lineTo(21.2, 24.7);
  s.quadraticCurveTo(16.2, 25.4, 11.0, 24.8); s.closePath();
  shaded(s, col, 11, 21.2, 0.16, 0.32);
  clip(s, () => {
    for (let i = 0; i < 5; i++) {
      const tx = 13.2 + i * 1.5, bx = 11.8 + i * 2.1;
      line([tx, 19.5, bx, 25.6], rgba(dk(col, 0.45), 0.55), 0.24);
      line([tx + 0.35, 19.5, bx + 0.5, 25.6], rgba(lt(col, 0.3), 0.35), 0.18);
    }
    fill(rr(10, 24, 12, 1.6, 0), rgba(dk(col, 0.4), 0.3));
  });
}

function torsoSide(k: Kid) {
  const { look, g } = k;
  const col = look.top;
  const coat = g === 'coat';
  const w = coat ? 0.5 : 0, hem = coat ? 22.0 : 20.7;
  const t = P();
  t.moveTo(14.0, 12.5);
  t.bezierCurveTo(12.4 - w, 12.7, 12.0 - w, 14.0, 12.1 - w, 15.4);
  t.lineTo(12.4 - w, hem);
  t.quadraticCurveTo(16.2, hem + 0.45, 19.9 + w, hem);
  t.lineTo(20.0 + w, 15.6);
  t.bezierCurveTo(20.1 + w, 13.6, 19.2, 12.7, 17.8, 12.4);
  t.quadraticCurveTo(16, 12.9, 14.0, 12.5);
  t.closePath();
  shaded(t, col, 12, 20);
  clip(t, () => {
    fill(el(17.6, 12.8, 3.0, 1.5), rad(17.4, 12.6, 3.2, [[0, 'rgba(20,10,18,0.26)'], [1, 'rgba(20,10,18,0)']]));
    if (g === 'uniform' || g === 'casual') { ribs(11, 21, hem - 1.2, 1.4, col); for (let y = 13.6; y < hem - 1.2; y += 0.75) line([11, y, 21, y], rgba(dk(col, 0.4), 0.1), 0.12); }
    if (g === 'pyjamas') for (let x = 12.6; x < 20.4; x += 1.3) line([x, 12, x, 22], rgba(lt(col, 0.55), 0.75), 0.4);
    if (coat) for (const y of [15.0, 17.4, 19.8]) curve(11, y, 16, y + 0.5, 21, y, rgba(dk(col, 0.5), 0.7), 0.3);
  });
  if (g === 'uniform') {
    const c = P(); c.moveTo(17.3, 12.35); c.lineTo(19.3, 12.6); c.lineTo(18.6, 13.8); c.closePath();
    fill(c, SHIRT); stroke(c, 'rgba(60,60,70,0.35)', 0.14);
    const tie = P(); tie.moveTo(19.15, 13.3); tie.lineTo(19.75, 13.45); tie.lineTo(20.0, 16.6); tie.lineTo(19.45, 16.3); tie.closePath();
    fill(tie, TIE);
  }
  if (g === 'tracksuit') fill(rr(14.2, 11.5, 4.6, 1.5, [0.6, 0.6, 0.2, 0.2]), lt(col, 0.1));
}

function armSide(k: Kid, a: number, far: boolean) {
  const { look, g } = k;
  const col = far ? dk(look.top, 0.25) : look.top;
  const skin = far ? sdk(look.skin, 0.18) : look.skin;
  C.save(); C.translate(16.1, 13.9); C.rotate(-a);
  const wide = g === 'coat' ? 0.25 : 0;
  const sl = rr(-1.45 - wide, -0.8, 2.9 + wide * 2, 7.2, [1.4, 1.4, 0.8, 0.8]);
  shaded(sl, col, -1.45, 1.45, 0.18, 0.36);
  clip(sl, () => {
    if (g === 'uniform' || g === 'casual') ribs(-2, 2, 5.0, 1.0, col);
    if (g === 'pyjamas') line([0, -1, 0, 7], rgba(lt(col, 0.55), 0.75), 0.4);
    if (g === 'tracksuit' && !far) line([0, -1, 0, 7], 'rgba(255,255,255,0.85)', 0.38);
    if (g === 'coat') for (const y of [2.0, 4.4]) curve(-2, y, 0, y + 0.4, 2, y, rgba(dk(col, 0.5), 0.6), 0.26);
  });
  fill(el(0.15, 7.0, 1.12, 1.3), rad(toLight(0.15, 0.4), 6.6, 1.6, [[0, lt(skin, 0.1)], [0.6, skin], [1, sdk(skin, 0.25)]]));
  fill(el(0.95, 6.55, 0.42, 0.62, -0.3), sdk(skin, 0.08)); // thumb
  C.restore();
}

function sidePath(look: CharacterLook) {
  // the profile's chin and jaw follow the face shape: lower for long faces, softer for round, a corner for square
  const dy = faceOf(look).chin - 12.0;
  const chinX = look.face === 1 ? 19.4 : look.face === 4 ? 19.8 : 19.6;
  const h = P();
  h.moveTo(11.0, 7.2);
  h.bezierCurveTo(10.6, 2.6, 13.6, 1.2, 16.0, 1.3);
  h.bezierCurveTo(18.8, 1.4, 20.4, 3.2, 20.5, 5.6);
  h.bezierCurveTo(20.6, 6.6, 20.6, 7.2, 20.95, 7.9);
  h.lineTo(21.45, 8.85);
  h.quadraticCurveTo(21.3, 9.4, 20.6, 9.45);
  h.quadraticCurveTo(20.95, 10.0, 20.65, 10.5);
  h.quadraticCurveTo(20.65, 11.4 + dy, chinX, 11.8 + dy);
  if (look.face === 3) { h.lineTo(17.2, 12.25 + dy); h.quadraticCurveTo(15.9, 12.3, 15.5, 11.5); }
  else h.bezierCurveTo(18.4, 12.3 + dy, 16.6, 12.0 + dy * 0.6, 15.6, 11.4);
  h.bezierCurveTo(14.4, 11.6, 12.6, 11.0, 11.6, 9.6);
  h.closePath();
  return h;
}

function headSide(k: Kid) {
  const { look } = k;
  const skin = look.skin;
  const h = sidePath(look);
  fill(h, rad(toLight(17, 1.6), 5.4, 8, [[0, lt(skin, 0.16)], [0.5, skin], [1, sdk(skin, 0.3)]]));
  clip(h, () => {
    if (look.hairStyle !== 1) fill(rr(16, 3.5, 6, 3.2, 0), lin(0, 4.4, 0, 6.6, [[0, rgba(sdk(skin, 0.6), 0.4)], [1, rgba(sdk(skin, 0.6), 0)]]));
    fill(el(18.6, 9.5, 1.5, 1.0), rad(18.6, 9.5, 1.5, [[0, 'rgba(232,104,100,0.32)'], [1, 'rgba(232,104,100,0)']]));
    fill(el(17.4, 12.0, 3.0, 0.9), 'rgba(92,34,22,0.14)');
  });
  const bc = brows(look);
  curve(18.4, 6.15, 19.3, 5.6, 20.25, 5.95, bc, 0.45);
  const iris = look.eyes ?? '#4a2e1c';
  if (k.blink) curve(18.7, 7.6, 19.3, 8.0, 19.9, 7.6, '#2a1812', 0.32);
  else {
    const w = P(); w.moveTo(18.65, 7.65); w.quadraticCurveTo(19.3, 6.9, 20.0, 7.35); w.quadraticCurveTo(19.9, 8.25, 18.65, 7.65); w.closePath();
    fill(w, '#f7f3ec');
    clip(w, () => { fill(el(19.6, 7.7, 0.45, 0.62), iris); fill(el(19.65, 7.7, 0.22, 0.32), '#0b0706'); });
    fill(el(19.45, 7.42, 0.14, 0.14), '#ffffff');
    curve(18.55, 7.6, 19.2, 6.75, 20.05, 7.25, '#2a1812', 0.34);
  }
  curve(20.6, 7.9, 21.1, 8.6, 20.9, 9.3, rgba(sdk(skin, 0.6), 0.3), 0.25);
  line([20.15, 10.45, 20.75, 10.4], mix(skin, '#8a3832', 0.6), 0.32);
  if (look.freckles) for (const [x, y] of [[18.2, 9.0], [18.9, 9.4], [19.5, 8.95], [18.5, 9.7]]) fill(el(x, y, 0.15, 0.15), rgba(sdk(skin, 0.6), 0.55));
  if (!coversEar(look)) ear(15.0, 7.75, -1, skin);
}

const coversEar = (look: CharacterLook) => look.hairStyle === 2 || look.hairStyle === 4;

// ---------- hair ----------

function hairFill(p: Path2D, hair: string, cx: number, cy: number, r = 8) {
  fill(p, rad(toLight(cx, 1.4), cy, r, [[0, lt(hair, 0.28)], [0.45, hair], [1, dk(hair, 0.45)]]));
}
/** strands: [x0, y0, cx, cy, x1, y1] curves in shadow, each with a lit edge beside it */
function strands(hair: string, list: number[][], dx = 0.28) {
  for (const s of list) {
    curve(s[0], s[1], s[2], s[3], s[4], s[5], rgba(dk(hair, 0.5), 0.55), 0.2);
    curve(s[0] + dx, s[1], s[2] + dx, s[3], s[4] + dx, s[5], rgba(lt(hair, 0.4), 0.35), 0.14);
  }
}
/** the shiny band where the light catches the hair */
function sheen(hair: string, cx: number, cy: number, rx: number, ry: number, a0: number, a1: number) {
  const p = P(); p.ellipse(cx, cy, rx, ry, 0, a0, a1);
  stroke(p, rgba(lt(hair, 0.5), 0.5), 0.55);
}
function stubble(p: Path2D, hair: string) {
  clip(p, () => { for (let i = 0; i < 70; i++) { const x = 10.5 + ((i * 37) % 110) / 10, y = 0.8 + ((i * 53) % 100) / 10; fill(el(x, y, 0.12, 0.12), rgba(dk(hair, 0.4), 0.6)); } });
}
function curls(p: Path2D, hair: string, pts: number[][]) {
  hairFill(p, hair, 15, 2.2, 9);
  clip(p, () => {
    for (const [x, y, r] of pts) {
      const a = P(); a.arc(x, y, r * 0.62, Math.PI * 0.9, Math.PI * 1.9); stroke(a, rgba(lt(hair, 0.4), 0.5), 0.22);
      const b = P(); b.arc(x, y, r * 0.75, Math.PI * 0.1, Math.PI * 0.85); stroke(b, rgba(dk(hair, 0.5), 0.5), 0.22);
    }
  });
}
function curlyPath(pts: number[][], base: Path2D) {
  for (const [x, y, r] of pts) base.addPath(el(x, y, r, r));
  return base;
}
/** a plait: overlapping lobes leaning left and right, with a tie at the end */
function braid(hair: string, x0: number, y0: number, x1: number, y1: number) {
  const n = Math.max(3, Math.round(Math.hypot(x1 - x0, y1 - y0) / 1.05));
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    const lobe = el(x, y, 0.95 - t * 0.2, 0.72, i % 2 ? 0.5 : -0.5);
    fill(lobe, rad(toLight(x, 0.35), y - 0.3, 1.2, [[0, lt(hair, 0.25)], [0.6, hair], [1, dk(hair, 0.45)]]));
    stroke(lobe, rgba(dk(hair, 0.55), 0.6), 0.14);
  }
  fill(el(x1, y1 + 0.75, 0.55, 0.4), '#b83a48');
  const tuft = P(); tuft.moveTo(x1 - 0.5, y1 + 1); tuft.quadraticCurveTo(x1, y1 + 2.4, x1 + 0.5, y1 + 1); tuft.closePath();
  fill(tuft, dk(hair, 0.15));
}

/** hair that falls behind the body in the front view */
function hairBehind(k: Kid) {
  const { hair, hairStyle } = k.look;
  if (hairStyle === 2) {
    const p = P();
    p.moveTo(16, 1.0); p.bezierCurveTo(11.0, 1.0, 9.6, 5.5, 9.8, 10.5); p.bezierCurveTo(9.9, 14, 9.4, 16.5, 10.0, 17.8);
    p.quadraticCurveTo(11.6, 18.5, 12.6, 17.4); p.lineTo(19.4, 17.4); p.quadraticCurveTo(20.4, 18.5, 22.0, 17.8);
    p.bezierCurveTo(22.6, 16.5, 22.1, 14, 22.2, 10.5); p.bezierCurveTo(22.4, 5.5, 21, 1, 16, 1); p.closePath();
    fill(p, lin(0, 1, 0, 18, [[0, dk(hair, 0.2)], [1, dk(hair, 0.4)]]));
  } else if (hairStyle === 3) {
    const sway = k.f * 0.35;
    const p = P();
    p.moveTo(20.4, 2.6); p.bezierCurveTo(23.3 + sway, 3.8, 23.2 + sway, 8.0, 22.5 + sway, 10.6);
    p.bezierCurveTo(22.2 + sway, 12.3, 22.7 + sway, 13.4, 22.1 + sway, 14.3);
    p.bezierCurveTo(21.3 + sway, 13.0, 21.0, 11.0, 21.0, 9.0); p.closePath();
    hairFill(p, dk(hair, 0.12), 22, 5, 9);
    strands(hair, [[21.2, 4, 22.6, 7, 22, 12]]);
  }
}

function hair(k: Kid) {
  const { look, view } = k;
  const h = look.hair;
  const s = look.hairStyle;
  if (view === 'front') {
    if (s === 1) {
      const p = P();
      p.moveTo(11.25, 7.6); p.bezierCurveTo(10.9, 3.2, 13.0, 1.15, 16, 1.15); p.bezierCurveTo(19, 1.15, 21.1, 3.2, 20.75, 7.6);
      p.lineTo(20.2, 7.2); p.bezierCurveTo(20.0, 5.0, 19.2, 3.75, 16, 3.85); p.bezierCurveTo(12.8, 3.75, 12.0, 5.0, 11.8, 7.2); p.closePath();
      hairFill(p, mix(h, look.skin, 0.2), 15, 2.2);
      stubble(p, h);
      sheen(h, 16, 4.6, 3.6, 2.8, Math.PI * 1.15, Math.PI * 1.45);
    } else if (s === 2) {
      const p = P();
      p.moveTo(10.9, 10.6); p.bezierCurveTo(10.0, 4.5, 12.0, 0.6, 16.0, 0.7); p.bezierCurveTo(20.0, 0.6, 22.0, 4.5, 21.1, 10.6);
      p.lineTo(20.2, 10.0); p.bezierCurveTo(20.3, 7.0, 19.8, 5.2, 18.6, 4.6);
      p.quadraticCurveTo(16.5, 5.2, 14.2, 5.7); p.quadraticCurveTo(12.4, 6.3, 11.9, 8.2); p.lineTo(11.8, 10.0); p.closePath();
      hairFill(p, h, 14.6, 2.2);
      strands(h, [[17.8, 1.2, 15.6, 3.2, 13.0, 5.8], [19.0, 1.8, 18.0, 4.0, 15.2, 5.4], [12.6, 2.4, 11.2, 5.6, 11.4, 9.6], [20.0, 3.0, 21.0, 6.0, 20.6, 9.6]]);
      sheen(h, 16, 4.8, 4.2, 3.2, Math.PI * 1.1, Math.PI * 1.5);
      for (const side of [-1, 1]) {
        const x = (v: number) => 16 + side * (16 - v);
        const lk = P();
        lk.moveTo(x(11.0), 8.0); lk.bezierCurveTo(x(10.4), 11.0, x(10.6), 14.0, x(10.0), 17.2);
        lk.quadraticCurveTo(x(11.0), 17.9, x(12.3), 17.0); lk.bezierCurveTo(x(12.5), 14.6, x(12.3), 11.6, x(12.1), 9.0); lk.closePath();
        hairFill(lk, h, x(11), 9, 9);
        strands(h, [[x(11.4), 9, x(11), 13, x(10.9), 16.6]], 0.2);
      }
    } else if (s === 4) {
      const pts = [[11.1, 7.4, 1.35], [10.9, 5.0, 1.65], [12.2, 2.8, 1.8], [14.3, 1.4, 1.85], [16.6, 1.1, 1.9], [18.9, 1.7, 1.8], [20.5, 3.4, 1.7], [21.1, 5.6, 1.55], [20.9, 7.6, 1.3],
        [13.0, 4.7, 1.3], [14.9, 5.0, 1.3], [16.9, 4.95, 1.3], [18.8, 4.6, 1.3]];
      const p = curlyPath(pts, el(16, 3.6, 5.2, 3.2));
      curls(p, h, pts);
    } else if (s === 3 || s === 5) {
      const p = P();
      p.moveTo(11.15, 8.0); p.bezierCurveTo(10.4, 3.6, 12.6, 0.8, 16, 0.8); p.bezierCurveTo(19.4, 0.8, 21.6, 3.6, 20.85, 8.0);
      p.lineTo(20.3, 7.4); p.bezierCurveTo(20.2, 5.2, 18.6, 3.75, 16.4, 3.9);
      if (s === 5) { p.lineTo(16, 3.4); p.lineTo(15.6, 3.9); } // middle parting for the plaits
      p.quadraticCurveTo(13.6, 4.0, 12.6, 5.0); p.bezierCurveTo(11.9, 5.6, 11.7, 6.6, 11.7, 7.6); p.closePath();
      hairFill(p, h, 14.6, 2.2);
      strands(h, s === 5
        ? [[15.8, 3.6, 14, 2.6, 11.8, 6.4], [16.2, 3.6, 18, 2.6, 20.2, 6.4], [15.6, 3.2, 13.2, 2.0, 11.4, 5.0], [16.4, 3.2, 18.8, 2.0, 20.6, 5.0]]
        : [[13.0, 5.0, 14.4, 2.4, 18.8, 1.6], [12.0, 6.4, 13.0, 3.0, 17.0, 1.2], [16.6, 4.0, 19.0, 3.6, 20.4, 6.4]]);
      sheen(h, 16, 4.6, 4.0, 3.0, Math.PI * 1.1, Math.PI * 1.45);
      if (s === 5) { braid(h, 11.0, 9.2, 10.6, 16.4); braid(h, 21.0, 9.2, 21.4, 16.4); }
    } else {
      const p = P();
      p.moveTo(11.0, 8.2); p.bezierCurveTo(10.3, 4.0, 12.4, 0.7, 16.2, 0.8); p.bezierCurveTo(19.9, 0.9, 21.8, 3.6, 21.0, 8.2);
      p.lineTo(20.4, 8.0); p.bezierCurveTo(20.5, 6.4, 20.0, 5.0, 19.0, 4.7);
      p.quadraticCurveTo(18.4, 5.7, 17.6, 5.4); p.quadraticCurveTo(16.9, 6.0, 16.0, 5.3); p.quadraticCurveTo(15.0, 6.0, 14.3, 5.0);
      p.quadraticCurveTo(13.4, 5.8, 12.6, 4.9); p.bezierCurveTo(11.8, 5.6, 11.6, 6.6, 11.7, 8.0); p.closePath();
      hairFill(p, h, 14.6, 2.2);
      strands(h, [[16.2, 1.3, 14.6, 2.6, 13.0, 5.0], [16.6, 1.3, 15.8, 3.2, 15.0, 5.4], [17.2, 1.4, 17.4, 3.4, 16.9, 5.6], [18.0, 1.6, 19.2, 3.0, 18.6, 5.2], [13.4, 2.0, 11.6, 4.4, 11.4, 7.6]]);
      sheen(h, 16, 4.6, 4.0, 3.0, Math.PI * 1.12, Math.PI * 1.45);
    }
    return;
  }
  // back view: the hair covers the whole head
  if (s === 4) {
    const pts = [[11.1, 8.2, 1.4], [10.9, 5.6, 1.65], [12.2, 3.0, 1.8], [14.3, 1.5, 1.85], [16.6, 1.2, 1.9], [18.9, 1.8, 1.8], [20.6, 3.6, 1.7], [21.1, 6.0, 1.6], [20.9, 8.4, 1.4],
      [12.8, 9.7, 1.3], [14.9, 10.3, 1.3], [17.1, 10.3, 1.3], [19.2, 9.7, 1.3], [16, 6.5, 1.8]];
    const p = curlyPath(pts, el(16, 6, 5.1, 4.6));
    curls(p, h, pts);
    return;
  }
  if (s === 2) {
    const p = P();
    p.moveTo(16, 0.7); p.bezierCurveTo(11.6, 0.7, 10.0, 4, 10.2, 8.5); p.bezierCurveTo(10.3, 12, 9.6, 15.5, 10.2, 18.0);
    p.quadraticCurveTo(13, 18.9, 16, 18.4); p.quadraticCurveTo(19, 18.9, 21.8, 18.0);
    p.bezierCurveTo(22.4, 15.5, 21.7, 12, 21.8, 8.5); p.bezierCurveTo(22, 4, 20.4, 0.7, 16, 0.7); p.closePath();
    hairFill(p, h, 14.6, 3, 12);
    strands(h, [[14.0, 2, 12.0, 9, 11.6, 17.4], [15.4, 2, 14.4, 10, 14.2, 17.8], [16.8, 2, 17.0, 10, 17.4, 17.8], [18.2, 2, 20, 9, 20.4, 17.4]]);
    sheen(h, 16, 5.2, 4.4, 3.4, Math.PI * 1.1, Math.PI * 1.5);
    return;
  }
  const buzz = s === 1;
  const p = P();
  if (buzz) {
    p.moveTo(11.3, 7.8); p.bezierCurveTo(10.9, 3.2, 13.0, 1.15, 16, 1.15); p.bezierCurveTo(19, 1.15, 21.1, 3.2, 20.7, 7.8);
    p.bezierCurveTo(20.6, 9.2, 19.8, 10.0, 18.8, 10.2); p.quadraticCurveTo(16, 10.7, 13.2, 10.2); p.bezierCurveTo(12.2, 10.0, 11.4, 9.2, 11.3, 7.8);
  } else {
    p.moveTo(10.9, 7.8); p.bezierCurveTo(10.4, 3.4, 12.6, 0.8, 16, 0.8); p.bezierCurveTo(19.4, 0.8, 21.6, 3.4, 21.1, 7.8);
    p.bezierCurveTo(21.0, 9.4, 20.2, 10.4, 19.0, 10.6);
    p.quadraticCurveTo(18.0, 10.2, 17.4, 10.9); p.quadraticCurveTo(16.6, 10.4, 16, 11.1); p.quadraticCurveTo(15.3, 10.4, 14.6, 10.9); p.quadraticCurveTo(14.0, 10.2, 13.0, 10.6);
    p.bezierCurveTo(11.8, 10.4, 11.0, 9.4, 10.9, 7.8);
  }
  p.closePath();
  hairFill(p, buzz ? mix(h, look.skin, 0.2) : h, 14.6, 3, 10);
  if (buzz) stubble(p, h);
  else strands(h, [[16, 2.6, 13.6, 4, 12.4, 9.4], [16, 2.6, 15.0, 6, 14.8, 10.4], [16, 2.6, 17.2, 6, 17.4, 10.4], [16, 2.6, 18.6, 4, 19.8, 9.4]]);
  sheen(h, 16, 5.0, 4.0, 3.2, Math.PI * 1.1, Math.PI * 1.45);
  if (s === 3) {
    const sway = k.f * 0.35;
    const t = P();
    t.moveTo(15.2, 4.4); t.bezierCurveTo(14.2 + sway, 7, 15.0 + sway, 10.5, 15.6 + sway, 14.6);
    t.quadraticCurveTo(16.2 + sway, 15.4, 16.8 + sway, 14.6); t.bezierCurveTo(17.4 + sway, 10.5, 17.8, 7, 16.8, 4.4); t.closePath();
    hairFill(t, h, 15.6, 6, 9);
    strands(h, [[15.8, 5, 15.4 + sway, 9, 15.9 + sway, 14], [16.4, 5, 16.8 + sway, 9, 16.4 + sway, 14]], 0.2);
    fill(el(16, 4.3, 1.0, 0.65), '#b83a48');
  }
  if (s === 5) {
    line([16, 1.2, 16, 9.4], rgba(lt(look.skin, 0.1), 0.8), 0.25); // parting
    braid(h, 13.4, 9.6, 13.0, 17.0); braid(h, 18.6, 9.6, 19.0, 17.0);
  }
}

/** long hair and plaits falling down the back, over the sweater (side view) */
function hairBackSide(k: Kid) {
  const { hair, hairStyle } = k.look;
  if (hairStyle === 2) {
    const p = P();
    p.moveTo(10.4, 6); p.bezierCurveTo(9.8, 9.5, 10.2, 13, 10.0, 17.6); p.quadraticCurveTo(11.4, 18.4, 12.6, 17.6);
    p.quadraticCurveTo(13.4, 18.2, 14.4, 17.4); p.bezierCurveTo(14.6, 14.5, 14.6, 12.2, 15.2, 10.8); p.lineTo(13.4, 6.4); p.closePath();
    hairFill(p, dk(hair, 0.08), 12, 8, 11);
    strands(hair, [[11.4, 8, 11.0, 13, 11.2, 17.2], [13.0, 9, 12.8, 13, 13.2, 17.2]], 0.22);
  }
  if (hairStyle === 5) braid(hair, 13.9, 9.6, 13.4, 16.6);
}

function hairSideCap(k: Kid) {
  const { look } = k;
  const h = look.hair;
  const s = look.hairStyle;
  if (s === 4) {
    ear(15.0, 7.75, -1, look.skin);
    const pts = [[11.0, 7.6, 1.5], [10.8, 5.0, 1.7], [12.2, 2.6, 1.8], [14.5, 1.2, 1.85], [17.0, 1.1, 1.8], [19.2, 2.0, 1.6], [20.2, 3.8, 1.3], [12.4, 9.4, 1.3], [14.0, 8.9, 1.0], [19.4, 4.9, 1.0]];
    const p = curlyPath(pts, el(15.2, 4.4, 4.4, 3.4));
    curls(p, h, pts);
    return;
  }
  const p = P();
  if (s === 1) {
    p.moveTo(19.6, 4.0); p.bezierCurveTo(19.6, 2.2, 18, 1.1, 15.8, 1.1); p.bezierCurveTo(12.6, 1.2, 10.8, 3.4, 11.0, 7.0);
    p.bezierCurveTo(11.1, 8.4, 11.6, 9.4, 12.2, 9.8); p.lineTo(13.6, 9.0); p.bezierCurveTo(14.0, 7.4, 14.4, 6.2, 15.4, 6.0);
    p.lineTo(16.4, 6.2); p.lineTo(16.6, 7.6); p.lineTo(17.0, 7.4); p.lineTo(17.2, 5.0); p.quadraticCurveTo(18.4, 4.3, 19.6, 4.0);
  } else if (s === 2) {
    ear(15.0, 7.75, -1, look.skin);
    p.moveTo(20.0, 5.4); p.bezierCurveTo(20.8, 2.2, 18.6, 0.6, 15.8, 0.7); p.bezierCurveTo(12.0, 0.8, 9.9, 3.4, 10.2, 7.4);
    p.lineTo(10.4, 10.5); p.lineTo(14.0, 11.0); p.bezierCurveTo(15.8, 11.2, 16.9, 10.2, 17.0, 8.6); p.lineTo(17.2, 5.8);
    p.quadraticCurveTo(18.8, 5.9, 20.0, 5.4);
  } else if (s === 3 || s === 5) {
    p.moveTo(19.9, 4.4); p.bezierCurveTo(20.2, 2.2, 18.4, 0.8, 15.8, 0.8); p.bezierCurveTo(12.6, 0.9, 10.6, 3.0, 10.8, 6.8);
    p.bezierCurveTo(10.9, 8.4, 11.5, 9.4, 12.3, 9.9); p.lineTo(13.6, 9.2); p.bezierCurveTo(14.0, 7.2, 14.4, 6.1, 15.4, 5.9);
    p.lineTo(16.6, 6.2); p.lineTo(16.8, 7.4); p.lineTo(17.2, 7.3); p.lineTo(17.4, 5.2); p.quadraticCurveTo(18.8, 4.9, 19.9, 4.4);
  } else {
    p.moveTo(20.2, 4.9); p.bezierCurveTo(20.6, 2.4, 18.6, 0.7, 15.8, 0.8); p.bezierCurveTo(12.4, 0.9, 10.2, 3.2, 10.6, 7.0);
    p.bezierCurveTo(10.8, 8.6, 11.4, 9.7, 12.2, 10.1); p.lineTo(13.4, 9.4); p.bezierCurveTo(14.0, 7.4, 14.3, 6.2, 15.2, 5.9);
    p.lineTo(16.3, 6.1); p.lineTo(16.5, 8.2); p.lineTo(17.0, 8.0); p.lineTo(17.1, 5.6);
    p.quadraticCurveTo(18.6, 5.7, 19.2, 5.0); p.quadraticCurveTo(19.7, 5.6, 20.2, 4.9);
  }
  p.closePath();
  hairFill(p, s === 1 ? mix(h, look.skin, 0.2) : h, 15, 2.4, 9);
  if (s === 1) stubble(p, h);
  else if (s === 2) strands(h, [[19.0, 1.6, 15.4, 2.6, 11.4, 6.6], [17.4, 1.2, 13.4, 3.6, 12.0, 10.0], [19.6, 3.4, 17.6, 5.4, 16.4, 10.4]]);
  else if (s === 3 || s === 5) strands(h, [[19.6, 4.4, 17.6, 1.8, 12.0, 3.6], [17.2, 5.4, 15.4, 3.6, 11.4, 5.6], [15.6, 6.2, 13.4, 5.6, 11.6, 8.4]]);
  else strands(h, [[15.6, 1.2, 18.4, 2.0, 19.6, 4.8], [14.4, 1.6, 17.2, 3.0, 18.4, 5.4], [13.0, 2.4, 11.4, 5.2, 12.0, 9.4], [14.6, 3.6, 13.6, 6.4, 13.2, 9.2]]);
  sheen(h, 15.6, 4.8, 4.0, 3.0, Math.PI * 1.15, Math.PI * 1.5);
  if (s === 3) {
    const sway = -Math.abs(k.f) * 0.4;
    const t = P();
    t.moveTo(11.4, 3.2); t.bezierCurveTo(9.0 + sway, 3.4, 8.4 + sway, 6.4, 9.2 + sway, 9.0); t.bezierCurveTo(9.6 + sway, 11.0, 9.0 + sway, 12.8, 9.8 + sway, 13.6);
    t.bezierCurveTo(10.6, 12.4, 10.9, 10.6, 11.0, 8.8); t.bezierCurveTo(11.2, 7.0, 11.4, 5.6, 11.8, 4.8); t.closePath();
    hairFill(t, h, 10, 5, 9);
    strands(h, [[10.6, 4, 9.4 + sway, 7, 9.9 + sway, 12.8]], 0.2);
    fill(el(11.3, 4.0, 0.65, 0.9), '#b83a48');
  }
  if (s !== 2) ear(15.0, 7.75, -1, look.skin);
}

// ---------- outlines, textures and portraits ----------

/** adds a dark outline `r` pixels wide around everything solid on the canvas, behind its soft edges */
export function addOutline(c: CanvasRenderingContext2D, w: number, h: number, r: number) {
  const src = c.getImageData(0, 0, w, h).data;
  const img = new ImageData(w, h);
  const o = img.data;
  const R = Math.ceil(r), offs: number[] = [];
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) if ((dx || dy) && dx * dx + dy * dy <= r * r + 0.01) offs.push(dx, dy);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (src[i + 3] >= 250) continue;
    for (let j = 0; j < offs.length; j += 2) {
      const xx = x + offs[j], yy = y + offs[j + 1];
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      if (src[(yy * w + xx) * 4 + 3] > 120) { o[i] = 26; o[i + 1] = 24; o[i + 2] = 30; o[i + 3] = 232; break; }
    }
  }
  const tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  tmp.getContext('2d')!.putImageData(img, 0, 0);
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'destination-over';
  c.drawImage(tmp, 0, 0);
  c.restore();
}

/**
 * Paints a character into a canvas of any size: the whole body, or (bust) the head and shoulders, close up.
 * Used for the creator, the profile card and the wardrobe.
 */
export function paintCharacter(cv: HTMLCanvasElement, look: CharacterLook, dir = 0, frame = 0, opts: { blink?: boolean; bust?: boolean } = {}) {
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  const w = cv.width, h = cv.height;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, w, h);
  let s: number;
  if (opts.bust) { s = w / 15; c.setTransform(s, 0, 0, s, -8.5 * s, -0.2 * s); }
  else { s = Math.min(w, h) / 32; c.setTransform(s, 0, 0, s, (w - 32 * s) / 2, (h - 32 * s) / 2); }
  drawCharacter(c, 0, 0, look, dir, frame, opts);
  c.setTransform(1, 0, 0, 1, 0, 0);
  addOutline(c, w, h, Math.max(1, s * (opts.bust ? 0.18 : 0.3)));
}

/** Builds a 3x4 spritesheet texture for a character look (with a dark outline). Frame index = dir * 3 + frame. */
export function makeCharacterTexture(scene: Phaser.Scene, key: string, look: CharacterLook) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const S = 32 * CHAR_RES;
  const tex = scene.textures.createCanvas(key, S * 3, S * 4)!;
  const ctx = tex.getContext();
  const tmp = document.createElement('canvas');
  tmp.width = S; tmp.height = S;
  const t = tmp.getContext('2d', { willReadFrequently: true })!;
  for (let dir = 0; dir < 4; dir++) for (let f = 0; f < 3; f++) {
    t.setTransform(1, 0, 0, 1, 0, 0);
    t.clearRect(0, 0, S, S);
    t.setTransform(CHAR_RES, 0, 0, CHAR_RES, 0, 0);
    drawCharacter(t, 0, 0, look, dir, f);
    addOutline(t, S, S, 1.5);
    ctx.drawImage(tmp, f * S, dir * S);
  }
  tex.refresh();
  // smooth filtering, so the finer texture is averaged down cleanly at 100% zoom (the rest of the game is pixel art)
  tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
  for (let dir = 0; dir < 4; dir++) for (let f = 0; f < 3; f++) tex.add(dir * 3 + f, 0, f * S, dir * S, S, S);
  return tex;
}

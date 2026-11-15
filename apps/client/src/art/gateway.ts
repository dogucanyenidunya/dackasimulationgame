// The way in from Ana Kapı: the big green gate with the guards' cabin beside it, the steps up the slope and
// the Roman-style aqueduct between Eğitim and the Cemiyet that you walk through. 2D sprites, painted once.
import Phaser from 'phaser';
import { AQUEDUCT, AQUEDUCT_PIER, CABIN, GATE, MEYDAN_STAIRS, PYRAMID, STAIRS, TILE, TRIBUNE, TRIBUNE_ROWS } from '../content/campus';
import { shade, wallColor } from './buildingArt';

type Ctx = CanvasRenderingContext2D;

/** the aqueduct's stone: the Cemiyet's colour */
export const BRIDGE_STONE = wallColor('cemiyet');
export const GATE_GREEN = '#2f6b3a';

/** aqueduct proportions, in tiles above the ground (shared with the 3D view) */
export const AQ = { spring: 0.7, crown: 1.62, impost: 1.8, upper: 2.3, top: 2.7 };
/** its deck as seen from above in the 2D view, in pixels */
const DECK = 14;

export const AQUEDUCT_SIZE = { w: AQUEDUCT.w * TILE, h: Math.round(AQ.top * TILE) + DECK };
export const STAIRS_SIZE = { w: STAIRS.w * TILE, h: STAIRS.h * TILE };
/** the gatehouse: its roof seen from above (the whole footprint), then its front wall */
const CABIN_FACE = 50;
export const CABIN_SIZE = { w: Math.round(CABIN.w * TILE), h: CABIN.h * TILE + CABIN_FACE };
/** the green arch over the gateway spans from pillar to pillar, with a little overhang */
export const GATE_ARCH_SIZE = { w: (GATE.w + 1) * TILE + 16, h: 34 };
/** a gate leaf swung 60° open into the campus, seen from the front: a slanted panel */
export const GATE_LEAF_SIZE = { w: 26, h: 94 };
/** the perimeter wall: how tall its face is in the 2D view (px), and in the 3D view (tiles) */
export const WALL_FACE = 46;
export const WALL_HEIGHT_3D = 2.1;
export const WALL_STONE = '#a89f8e';
/** the steps down from the Eğitim corridor to the Merkez Meydan */
export const MEYDAN_STAIRS_SIZE = { w: Math.round(MEYDAN_STAIRS.w * TILE), h: MEYDAN_STAIRS.h * TILE + 8 };
/** the pyramid on the Merkez Meydan: its picture, and how much of the bottom is its footprint on the ground */
export const PYRAMID_SIZE = { w: PYRAMID.w * TILE, h: 92, foot: 26 };
/** the grandstand: each row sits this many pixels higher than the one in front of it */
export const TRIBUNE_STEP = 4;
export const TRIBUNE_LIFT = TRIBUNE_STEP * (TRIBUNE_ROWS - 1);
export const tribuneKey = (i: number) => `tribune-${i}`;

export function makeGatewayTextures(scene: Phaser.Scene) {
  const canvas = (key: string, w: number, h: number, draw: (c: Ctx) => void) => {
    if (scene.textures.exists(key)) return;
    const t = scene.textures.createCanvas(key, w, h)!;
    draw(t.getContext());
    t.refresh();
  };
  canvas('aqueduct', AQUEDUCT_SIZE.w, AQUEDUCT_SIZE.h, paintAqueduct);
  canvas('stairs', STAIRS_SIZE.w, STAIRS_SIZE.h, paintStairs);
  canvas('cabin', CABIN_SIZE.w, CABIN_SIZE.h, paintCabin);
  canvas('gatearch', GATE_ARCH_SIZE.w, GATE_ARCH_SIZE.h, (c) => paintGateArch(c, 'DARÜŞŞAFAKA'));
  canvas('gatearch-tim', GATE_ARCH_SIZE.w, GATE_ARCH_SIZE.h, (c) => paintGateArch(c, 'TIM GÖSTERİ'));
  canvas('stairs-ew', MEYDAN_STAIRS_SIZE.w, MEYDAN_STAIRS_SIZE.h, paintMeydanStairs);
  canvas('pyramid', PYRAMID_SIZE.w, PYRAMID_SIZE.h, paintPyramid);
  TRIBUNE.forEach((r, i) => canvas(tribuneKey(i), Math.round(r.w * TILE), Math.round(r.h * TILE) + TRIBUNE_LIFT, (c) => paintTribune(c, Math.round(r.w * TILE), Math.round(r.h * TILE), i)));
  canvas('gateleaf', GATE_LEAF_SIZE.w, GATE_LEAF_SIZE.h, paintGateLeaf);
  canvas('wallblock', TILE, TILE + WALL_FACE, (c) => paintWall(c, true));
  canvas('walltop', TILE, TILE, (c) => paintWall(c, false));
}

/** the south face of the aqueduct: a tall arch to walk through, a cornice, a row of small arches and a parapet,
 *  all in coursed stone; the big arch is cut out so you see whoever walks through it */
function paintAqueduct(c: Ctx) {
  const { w: W, h: H } = AQUEDUCT_SIZE;
  const s = BRIDGE_STONE, dark = shade(s, 0.82), light = shade(s, 1.08), mortar = shade(s, 0.74);
  const gy = (t: number) => H - t * TILE; // tiles above the ground → canvas y
  // the deck seen from above, with its parapets
  c.fillStyle = shade(s, 0.9); c.fillRect(0, 0, W, DECK);
  c.fillStyle = light; c.fillRect(0, 0, W, 3); c.fillRect(0, DECK - 4, W, 3);
  c.fillStyle = shade(s, 0.7); c.fillRect(0, 3, W, 1);
  // the face, in courses of stone
  c.fillStyle = s; c.fillRect(0, DECK, W, H - DECK);
  for (let y = H - 6, row = 0; y > DECK; y -= 6, row++) {
    c.fillStyle = mortar; c.fillRect(0, y, W, 1);
    for (let x = (row % 2) * 7; x < W; x += 14) c.fillRect(x, y - 5, 1, 5);
  }
  for (let i = 0; i < 90; i++) { c.fillStyle = (i * 37) % 3 ? light : dark; c.fillRect((i * 53) % W, DECK + ((i * 29) % (H - DECK)), 2, 1); }
  // cornice at the impost and the coping on top
  const band = (t: number, h: number) => { const y = gy(t); c.fillStyle = light; c.fillRect(0, y, W, h); c.fillStyle = shade(s, 0.66); c.fillRect(0, y + h, W, 1); };
  band(AQ.impost + 0.06, 4); band(AQ.top - 0.02, 3);
  // the upper arcade: three small open arches (dark: you look into the water channel's vault)
  const pier = AQUEDUCT_PIER * TILE;
  for (let i = 0; i < 3; i++) {
    const cx = W * (i + 0.5) / 3, r = 8, spring = gy(AQ.impost + 0.3);
    c.fillStyle = shade(s, 0.42);
    c.beginPath(); c.moveTo(cx - r, gy(AQ.impost + 0.1)); c.lineTo(cx - r, spring); c.arc(cx, spring, r, Math.PI, 0); c.lineTo(cx + r, gy(AQ.impost + 0.1)); c.closePath(); c.fill();
    c.strokeStyle = light; c.lineWidth = 1; c.beginPath(); c.arc(cx, spring, r + 1.5, Math.PI, 0); c.stroke();
  }
  // the big arch: voussoirs round it, then cut the opening out
  const x0 = pier, x1 = W - pier, cx = W / 2, r = (x1 - x0) / 2, spring = gy(AQ.spring);
  c.fillStyle = dark;
  c.beginPath(); c.arc(cx, spring, r + 6, Math.PI, 0); c.lineTo(x1, spring); c.arc(cx, spring, r, 0, Math.PI, true); c.closePath(); c.fill();
  c.strokeStyle = light; c.lineWidth = 1;
  for (let k = 0; k <= 10; k++) {
    const a = Math.PI + (k / 10) * Math.PI;
    c.beginPath(); c.moveTo(cx + Math.cos(a) * r, spring + Math.sin(a) * r); c.lineTo(cx + Math.cos(a) * (r + 6), spring + Math.sin(a) * (r + 6)); c.stroke();
  }
  c.fillStyle = light; c.fillRect(cx - 3, spring - r - 7, 6, 8); // keystone
  c.fillStyle = dark; c.fillRect(x0 - 2, spring - 2, 4, 3); c.fillRect(x1 - 2, spring - 2, 4, 3); // imposts
  // the piers' feet, a little wider and darker
  c.fillStyle = shade(s, 0.78); c.fillRect(0, H - 5, x0, 5); c.fillRect(x1, H - 5, W - x1, 5);
  c.globalCompositeOperation = 'destination-out';
  c.beginPath(); c.moveTo(x0, H); c.lineTo(x0, spring); c.arc(cx, spring, r, Math.PI, 0); c.lineTo(x1, H); c.closePath(); c.fill();
  c.globalCompositeOperation = 'source-over';
  // shade the inner edge of each pier, so the passage reads as deep
  c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(x1 - 1, spring, 1, H - spring); c.fillRect(x0, spring, 2, H - spring);
}

/** eight steps going up to the north: light treads, shaded risers, low stone cheek walls either side */
export function paintStairs(c: Ctx) {
  const { w: W, h: H } = STAIRS_SIZE;
  const s = BRIDGE_STONE, n = 8, step = H / n;
  for (let i = 0; i < n; i++) {
    const y = i * step;
    c.fillStyle = shade(s, 1.12 - i * 0.012); c.fillRect(0, y, W, step - 3);
    c.fillStyle = shade(s, 1.2); c.fillRect(0, y, W, 1);                         // worn nosing
    c.fillStyle = shade(s, 0.72); c.fillRect(0, y + step - 3, W, 3);             // riser in shade
    for (let k = 0; k < 6; k++) { c.fillStyle = shade(s, 0.95); c.fillRect((k * 41 + i * 17) % (W - 4) + 2, y + 2 + (k % 3), 3, 1); }
  }
  for (const x of [0, W - 5]) {
    c.fillStyle = shade(s, 0.8); c.fillRect(x, 0, 5, H);
    c.fillStyle = shade(s, 1.1); c.fillRect(x, 0, 5, 2); c.fillRect(x + 1, 0, 1, H);
  }
}

/** the gatehouse in the wall line: a flat green-edged roof seen from above, then its front on the road side:
 *  white walls, a wide guard's window under a GÜVENLİK sign, green trim matching the gate */
function paintCabin(c: Ctx) {
  const { w: W, h: H } = CABIN_SIZE;
  const roofH = H - CABIN_FACE;
  // roof
  c.fillStyle = shade(GATE_GREEN, 0.85); c.fillRect(0, 0, W, roofH);
  c.fillStyle = '#d6dbdf'; c.fillRect(4, 4, W - 8, roofH - 8);
  c.fillStyle = '#c3c8cb'; for (let y = 10; y < roofH - 4; y += 8) c.fillRect(4, y, W - 8, 1);
  c.fillStyle = shade(GATE_GREEN, 1.3); c.fillRect(0, 0, W, 2); c.fillRect(0, 0, 2, roofH);
  c.fillStyle = '#9aa1a6'; c.fillRect(W - 22, 12, 12, 9); c.fillStyle = '#c3c8cb'; c.fillRect(W - 22, 12, 12, 3); // AC unit
  c.fillStyle = '#4a5258'; c.fillRect(14, 10, 1, 16); c.fillRect(10, 13, 9, 1); // radio mast
  // front wall
  const f = roofH;
  c.fillStyle = shade(GATE_GREEN, 0.7); c.fillRect(0, f, W, 4);
  c.fillStyle = '#f1f2f0'; c.fillRect(0, f + 4, W, CABIN_FACE - 4);
  c.fillStyle = 'rgba(0,0,0,0.1)'; c.fillRect(W - 5, f + 4, 5, CABIN_FACE - 4);
  c.fillStyle = '#9aa1a6'; c.fillRect(0, H - 6, W, 6); c.fillStyle = '#b8bec3'; c.fillRect(0, H - 6, W, 1);
  // sign
  c.fillStyle = GATE_GREEN; c.fillRect(10, f + 8, W - 20, 8);
  c.fillStyle = '#f2c14e'; c.font = 'bold 7px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('GÜVENLİK', W / 2, f + 12.5);
  // the guard's window, with a little counter ledge and the desk lamp glowing inside
  const wx = 9, wy = f + 19, ww = W - 18, wh = 19;
  c.fillStyle = '#c3c8cb'; c.fillRect(wx - 1, wy - 1, ww + 2, wh + 2);
  c.fillStyle = '#4f6f8c'; c.fillRect(wx, wy, ww, wh);
  c.fillStyle = '#2f475c'; c.fillRect(wx, wy, ww, 3);
  c.fillStyle = '#7fa3c2'; c.fillRect(wx + ww - 16, wy + 5, 9, 2);
  c.fillStyle = '#e8ecef'; c.fillRect(wx + Math.round(ww / 2) - 1, wy, 2, wh);
  c.fillStyle = '#ffd57e'; c.fillRect(wx + 6, wy + 12, 5, 4);
  c.fillStyle = '#d9dde0'; c.fillRect(wx - 3, wy + wh + 1, ww + 6, 3);
}

/** the green iron arch over the gateway, with the school's name in gold */
function paintGateArch(c: Ctx, name: string) {
  const { w: W, h: H } = GATE_ARCH_SIZE;
  c.fillStyle = GATE_GREEN;
  c.beginPath(); c.moveTo(0, H - 4); c.lineTo(0, 12); c.quadraticCurveTo(W / 2, -6, W, 12); c.lineTo(W, H - 4); c.closePath(); c.fill();
  c.fillStyle = shade(GATE_GREEN, 1.35);
  c.beginPath(); c.moveTo(0, 12); c.quadraticCurveTo(W / 2, -6, W, 12); c.lineTo(W, 14); c.quadraticCurveTo(W / 2, -4, 0, 14); c.closePath(); c.fill();
  c.fillStyle = shade(GATE_GREEN, 0.7); c.fillRect(0, H - 6, W, 2);
  // a dark name board with gold letters, and scrolls either side
  c.fillStyle = '#1f3d24'; c.fillRect(W / 2 - 46, 12, 92, 14);
  c.fillStyle = '#f2c14e'; c.font = 'bold 10px "Pixelify Sans", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(name, W / 2, 19.5);
  c.strokeStyle = '#d9b44a'; c.lineWidth = 1.5;
  for (const sx of [-1, 1]) {
    const x = W / 2 + sx * 60;
    c.beginPath(); c.arc(x, 20, 5, 0, Math.PI * 1.6); c.stroke();
    c.beginPath(); c.arc(x + sx * 11, 22, 3, 0, Math.PI * 2); c.stroke();
  }
}

/** one leaf of the gate, swung open into the campus (hinge at the bottom left): a slanted green railing panel
 *  with gilded spear tips. The right leaf is the same picture, flipped */
function paintGateLeaf(c: Ctx) {
  const { w: W, h: H } = GATE_LEAF_SIZE;
  const tall = 50, run = H - tall; // the panel's height, and how far up its far end sits (it reaches into the campus)
  /** a point on the panel: t along it from the hinge (0) to the free end (1), h up it (0 ground, 1 top) */
  const P = (t: number, h: number): [number, number] => [1 + t * (W - 3), H - 1 - t * run - h * tall];
  const line = (t0: number, h0: number, t1: number, h1: number, w: number, col: string) => {
    const [x0, y0] = P(t0, h0), [x1, y1] = P(t1, h1);
    c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  };
  // its shadow on the ground
  c.fillStyle = 'rgba(0,0,0,0.16)';
  c.beginPath(); const [a0, b0] = P(0, 0), [a1, b1] = P(1, 0); c.moveTo(a0 + 3, b0); c.lineTo(a1 + 3, b1); c.lineTo(a1 + 6, b1 + 2); c.lineTo(a0 + 6, b0 + 2); c.fill();
  for (const h of [0.08, 0.52, 0.94]) line(0, h, 1, h, 2, GATE_GREEN);
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    line(t, 0.05, t, 1, i === 0 || i === 8 ? 2.5 : 1.5, GATE_GREEN);
    const [tx, ty] = P(t, 1);
    c.fillStyle = '#d9b44a'; c.fillRect(Math.round(tx) - 1, Math.round(ty) - 3, 2, 3);
  }
  line(0, 0.94, 1, 0.94, 1, shade(GATE_GREEN, 1.4));
}

/** a stretch of the perimeter wall on one tile: its coping seen from above and, where nothing walls it in to
 *  the south, its tall stone face. Courses of stone, a darker plinth and a lighter coping band */
function paintWall(c: Ctx, face: boolean) {
  const s = WALL_STONE;
  // the top: coping stones with a lighter rim
  c.fillStyle = shade(s, 1.25); c.fillRect(0, 0, TILE, TILE);
  c.fillStyle = shade(s, 1.12); c.fillRect(0, 3, TILE, TILE - 6);
  c.fillStyle = shade(s, 1.0); for (let x = 0; x < TILE; x += 16) c.fillRect(x, 3, 1, TILE - 6);
  c.fillStyle = shade(s, 1.35); c.fillRect(0, 0, TILE, 1);
  if (!face) return;
  const y0 = TILE;
  c.fillStyle = shade(s, 0.7); c.fillRect(0, y0, TILE, 2); // the coping's overhang casting a line of shade
  c.fillStyle = s; c.fillRect(0, y0 + 2, TILE, WALL_FACE - 2);
  for (let y = y0 + 8, row = 0; y < y0 + WALL_FACE; y += 7, row++) {
    c.fillStyle = shade(s, 0.82); c.fillRect(0, y, TILE, 1);
    for (let x = (row % 2) * 8 + 3; x < TILE; x += 16) c.fillRect(x, y - 6, 1, 6);
  }
  for (let i = 0; i < 14; i++) { c.fillStyle = i % 2 ? shade(s, 1.08) : shade(s, 0.92); c.fillRect((i * 13) % 30, y0 + 4 + ((i * 17) % (WALL_FACE - 8)), 2, 1); }
  c.fillStyle = shade(s, 0.78); c.fillRect(0, y0 + WALL_FACE - 6, TILE, 6);   // plinth
  c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(0, y0 + WALL_FACE - 2, TILE, 2);
}

/** a flight of steps running down to the east (the corridor is a floor above the square): each tread a little
 *  darker and lower than the last, a line of shade under every nosing, stone cheek walls along both sides */
function paintMeydanStairs(c: Ctx) {
  const { w: W, h: H } = MEYDAN_STAIRS_SIZE;
  const s = BRIDGE_STONE, n = 9, step = W / n, drop = 8 / (n - 1);
  for (let i = 0; i < n; i++) {
    const x = Math.round(i * step), w = Math.round((i + 1) * step) - x, y = Math.round(i * drop);
    c.fillStyle = shade(s, 1.16 - i * 0.03); c.fillRect(x, y + 5, w, H - 8 - 10);
    c.fillStyle = shade(s, 1.24 - i * 0.03); c.fillRect(x, y + 5, 2, H - 8 - 10);       // worn nosing
    c.fillStyle = shade(s, 0.66); c.fillRect(x + w - 2, y + 5, 2, H - 8 - 10);          // the drop to the next tread
    for (let k = 0; k < 4; k++) { c.fillStyle = shade(s, 0.96); c.fillRect(x + 3 + ((k * 7 + i * 3) % Math.max(1, w - 6)), y + 9 + ((k * 19 + i * 11) % (H - 30)), 1, 3); }
    // cheek walls, stepping down with the flight
    for (const top of [y, y + H - 8 - 5]) {
      c.fillStyle = shade(s, 0.8); c.fillRect(x, top, w, 5);
      c.fillStyle = shade(s, 1.12); c.fillRect(x, top, w, 2);
    }
  }
  c.fillStyle = 'rgba(0,0,0,0.16)'; c.fillRect(0, H - 3, W, 3);
}

/** a three-sided pyramid seen from the south: the sunlit west face and the shaded east face meet on the front edge,
 *  glazed in panels like a skylight, on a low stone plinth */
function paintPyramid(c: Ctx) {
  const { w: W, h: H, foot } = PYRAMID_SIZE;
  const apex: [number, number] = [W / 2, 3], left: [number, number] = [3, H - foot + 4], right: [number, number] = [W - 3, H - foot + 4], front: [number, number] = [W / 2 - 4, H - 6];
  const tri = (a: [number, number], b: [number, number], d: [number, number], col: string) => { c.fillStyle = col; c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.lineTo(...d); c.closePath(); c.fill(); };
  // its shadow, falling east, and the plinth
  c.fillStyle = 'rgba(0,0,0,0.2)'; c.beginPath(); c.ellipse(W / 2 + 6, H - 8, W / 2 - 4, 8, 0, 0, Math.PI * 2); c.fill();
  tri([0, H - foot + 4], [W, H - foot + 4], [W / 2 - 4, H - 1], '#b9b2a3');
  tri([2, H - foot + 3], [W - 2, H - foot + 3], [W / 2 - 4, H - 4], '#d8d2c4');
  // the two faces
  tri(apex, left, front, '#9fd0e6');
  tri(apex, front, right, '#4f86a6');
  // glazing bars: lines fanning from the apex, and bands parallel to the base
  const lerp = (a: [number, number], b: [number, number], t: number): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const line = (a: [number, number], b: [number, number], col: string, w = 1) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.stroke(); };
  for (const [a, b, col] of [[left, front, 'rgba(255,255,255,0.55)'], [front, right, 'rgba(20,40,60,0.35)']] as const) {
    for (let k = 1; k < 4; k++) line(apex, lerp(a, b, k / 4), col);
    for (let k = 1; k < 5; k++) line(lerp(apex, a, k / 5), lerp(apex, b, k / 5), col);
  }
  // a sheen on the lit face, and the bright edges
  tri(lerp(apex, left, 0.15), lerp(apex, left, 0.55), lerp(apex, front, 0.35), 'rgba(255,255,255,0.22)');
  line(apex, front, '#f4fbff', 2); line(apex, left, '#e8f6fc', 1.5); line(apex, right, '#2f5d7a', 1.5);
  line(left, front, '#e8f6fc', 1.5); line(front, right, '#2f5d7a', 1.5);
  c.fillStyle = '#f2c14e'; c.fillRect(W / 2 - 1, 0, 2, 5);
}

/** one block of the grandstand, facing east: ten rows of seats running north–south, each row a step higher than the
 *  one in front, so every row is drawn a little further up the picture and the block's south end shows its stepped side */
function paintTribune(c: Ctx, W: number, D: number, block: number) {
  const rows = TRIBUNE_ROWS, rw = W / rows;
  const concrete = '#c9ccd0';
  for (let i = 0; i < rows; i++) {
    // row 0 is the top row against the hall (west), the last row is down at the pitch
    const x = Math.round(i * rw), w = Math.round((i + 1) * rw) - x;
    const up = TRIBUNE_STEP * (rows - 1 - i), y = TRIBUNE_LIFT - up;
    // the tread, then the seats on it: green, with a gold block in the middle of each stand
    c.fillStyle = shade(concrete, 1.06 - i * 0.012); c.fillRect(x, y, w, D);
    c.fillStyle = shade(concrete, 0.72); c.fillRect(x + w - 1, y, 1, D);
    for (let sy = 3; sy < D - 5; sy += 7) {
      const gold = Math.abs(sy - D / 2) < 22 && i >= 2 && i <= 7;
      const seat = gold ? '#e6b93f' : (i + block) % 2 ? '#2f7a45' : '#2a6d3d';
      c.fillStyle = shade(seat, 0.7); c.fillRect(x + 1, y + sy, w - 3, 5);
      c.fillStyle = seat; c.fillRect(x + 1, y + sy, w - 4, 4);
      c.fillStyle = shade(seat, 1.3); c.fillRect(x + 1, y + sy, 2, 4);              // the seat back, catching the light
    }
    // the stepped south end: the side wall under this row
    c.fillStyle = shade(concrete, 0.82); c.fillRect(x, y + D, w, up);
    c.fillStyle = shade(concrete, 0.62); c.fillRect(x, y + D, w, 1);
    if (up > 6) { c.fillStyle = shade(concrete, 0.74); for (let ly = y + D + 6; ly < y + D + up; ly += 6) c.fillRect(x, ly, w, 1); }
  }
  // aisles: two flights of steps cutting across the rows, painted yellow at the nosings
  for (const ay of [Math.round(D * 0.28), Math.round(D * 0.72)]) {
    for (let i = 0; i < rows; i++) {
      const x = Math.round(i * rw), w = Math.round((i + 1) * rw) - x, y = TRIBUNE_LIFT - TRIBUNE_STEP * (rows - 1 - i);
      c.fillStyle = '#aeb3b8'; c.fillRect(x, y + ay - 4, w, 8);
      c.fillStyle = '#e6b93f'; c.fillRect(x + w - 2, y + ay - 4, 1, 8);
    }
  }
  // a handrail along the top row and the front rail down at the pitch
  c.fillStyle = '#5b6168'; c.fillRect(0, 0, 2, D); c.fillRect(W - 2, TRIBUNE_LIFT, 2, D);
  c.fillStyle = '#8f979e'; for (let py = 0; py < D; py += 16) { c.fillRect(W - 2, TRIBUNE_LIFT + py, 2, 2); }
}

// The way in from Ana Kapı: the big green gate with the guards' cabin beside it, the steps up the slope and
// the Roman-style aqueduct between Eğitim and the Cemiyet that you walk through. 2D sprites, painted once;
// the 3D view builds its own meshes from the same rects (World3D).
import Phaser from 'phaser';
import { AQUEDUCT, AQUEDUCT_PIER, CABIN, GATE, STAIRS, TILE } from '../content/campus';
import { shade, wallColor } from './buildings3d';

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
export const CABIN_SIZE = { w: CABIN.w * TILE, h: 72 };
/** the green arch over the gateway spans from pillar to pillar, with a little overhang */
export const GATE_ARCH_SIZE = { w: (GATE.w + 1) * TILE + 16, h: 34 };
export const GATE_LEAF_SIZE = { w: 48, h: 50 };

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
  canvas('gatearch', GATE_ARCH_SIZE.w, GATE_ARCH_SIZE.h, paintGateArch);
  canvas('gateleaf', GATE_LEAF_SIZE.w, GATE_LEAF_SIZE.h, paintGateLeaf);
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

/** the guards' cabin: white walls, a wide window and a door on the front, a green roof slab and a sign */
function paintCabin(c: Ctx) {
  const { w: W, h: H } = CABIN_SIZE;
  const roofH = 24, front = H - roofH;
  c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(4, H - 3, W - 2, 3);
  // roof seen from above, with an overhang
  c.fillStyle = GATE_GREEN; c.fillRect(0, 2, W, roofH);
  c.fillStyle = shade(GATE_GREEN, 1.3); c.fillRect(0, 2, W, 2);
  c.fillStyle = shade(GATE_GREEN, 0.7); c.fillRect(0, roofH, W, 3);
  c.fillStyle = '#9aa1a6'; c.fillRect(W - 16, 8, 8, 6); c.fillStyle = '#c3c8cb'; c.fillRect(W - 16, 8, 8, 2); // AC unit
  // the front wall
  c.fillStyle = '#f1f2f0'; c.fillRect(2, roofH + 3, W - 4, front - 6);
  c.fillStyle = 'rgba(0,0,0,0.1)'; c.fillRect(W - 6, roofH + 3, 4, front - 6);
  c.fillStyle = '#9aa1a6'; c.fillRect(2, H - 6, W - 4, 4);
  // wide window with the guard's desk lamp glowing
  c.fillStyle = '#c3c8cb'; c.fillRect(5, roofH + 9, 34, 20);
  c.fillStyle = '#4f6f8c'; c.fillRect(6, roofH + 10, 32, 18);
  c.fillStyle = '#7fa3c2'; c.fillRect(24, roofH + 12, 8, 2);
  c.fillStyle = '#e8ecef'; c.fillRect(21, roofH + 10, 2, 18);
  c.fillStyle = '#ffd57e'; c.fillRect(9, roofH + 22, 4, 3);
  // door
  c.fillStyle = '#c3c8cb'; c.fillRect(43, roofH + 9, 16, front - 15);
  c.fillStyle = '#5b646a'; c.fillRect(44, roofH + 10, 14, front - 16);
  c.fillStyle = '#e8ecef'; c.fillRect(55, roofH + 24, 2, 2);
  // sign over the window
  c.fillStyle = GATE_GREEN; c.fillRect(6, roofH + 4, 32, 5);
  c.fillStyle = '#f2c14e'; c.font = 'bold 5px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('GÜVENLİK', 22, roofH + 6.5);
}

/** the green iron arch over the gateway, with the school's name in gold */
function paintGateArch(c: Ctx) {
  const { w: W, h: H } = GATE_ARCH_SIZE;
  c.fillStyle = GATE_GREEN;
  c.beginPath(); c.moveTo(0, H - 4); c.lineTo(0, 12); c.quadraticCurveTo(W / 2, -6, W, 12); c.lineTo(W, H - 4); c.closePath(); c.fill();
  c.fillStyle = shade(GATE_GREEN, 1.35);
  c.beginPath(); c.moveTo(0, 12); c.quadraticCurveTo(W / 2, -6, W, 12); c.lineTo(W, 14); c.quadraticCurveTo(W / 2, -4, 0, 14); c.closePath(); c.fill();
  c.fillStyle = shade(GATE_GREEN, 0.7); c.fillRect(0, H - 6, W, 2);
  // a dark name board with gold letters, and scrolls either side
  c.fillStyle = '#1f3d24'; c.fillRect(W / 2 - 46, 12, 92, 14);
  c.fillStyle = '#f2c14e'; c.font = 'bold 10px "Pixelify Sans", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('DARÜŞŞAFAKA', W / 2, 19.5);
  c.strokeStyle = '#d9b44a'; c.lineWidth = 1.5;
  for (const sx of [-1, 1]) {
    const x = W / 2 + sx * 60;
    c.beginPath(); c.arc(x, 20, 5, 0, Math.PI * 1.6); c.stroke();
    c.beginPath(); c.arc(x + sx * 11, 22, 3, 0, Math.PI * 2); c.stroke();
  }
}

/** one leaf of the gate, slid open beside a pillar: a green frame with railings and spear tips */
function paintGateLeaf(c: Ctx) {
  const { w: W, h: H } = GATE_LEAF_SIZE;
  c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(2, H - 3, W - 2, 3);
  c.fillStyle = GATE_GREEN;
  c.fillRect(0, 8, W, 3); c.fillRect(0, H - 8, W, 3); c.fillRect(0, (H + 8) / 2, W, 2);
  c.fillRect(0, 6, 3, H - 9); c.fillRect(W - 3, 6, 3, H - 9);
  for (let x = 6; x < W - 3; x += 5) {
    c.fillRect(x, 6, 2, H - 11);
    c.fillStyle = '#d9b44a'; c.fillRect(x, 3, 2, 3); c.fillRect(x - 0.5, 4, 3, 1); c.fillStyle = GATE_GREEN; // gilded spear tips
  }
  c.fillStyle = shade(GATE_GREEN, 1.35); c.fillRect(0, 8, W, 1);
}

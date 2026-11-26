// Procedural pixel art. Placeholder until real art is commissioned; palette follows GDD §17
// (roof grey, façade white, wood fins, solar blue, plaza green, court red).
import Phaser from 'phaser';
import { T, TILE } from '../content/campus';

export { CHAR_RES, DEFAULT_LOOK, drawCharacter, fitCharacter, footBody, makeCharacterTexture, paintCharacter } from './character';
export type { CharacterLook, FaceShape, HairStyle } from './character';

/** texture pixels per world pixel for the smooth (non-pixel-art) world textures: ground, trees */
export const ART_RES = 2;

const PAL = {
  roof: '#c3c9cf', roofDark: '#a9b0b7', roofLight: '#d8dde2',
  wall: '#f1f2f0', wallShade: '#dcdfe0', fin: '#c98a4b', finDark: '#9c6633', window: '#4f6f8c', windowLight: '#9cc0dd',
  solar: '#34588f', solarLine: '#6d8fc6',
  green: '#7fb466', greenDark: '#679d50',
  lawn: '#8cbd68', lawnDark: '#79ab57', lawnLight: '#a3cf7d',
  paver: '#d9d1c2', paverDark: '#c4baa7', paverLight: '#e6dfd2',
  plaza: '#e7e1d4', plazaLine: '#d3cbbb',
  forest: '#2f6b45', forestLight: '#3d8052', forestDark: '#214f34',
  courtRed: '#a8483e', courtBlue: '#3f7fa6',
  door: '#5b3a22', doorFrame: '#7a4e2a', revir: '#c0392b',
};

export function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Ctx = CanvasRenderingContext2D;

function speckle(ctx: Ctx, ox: number, base: string, dark: string, n: number, seed: number, size = 2) {
  const r = rng(seed);
  ctx.fillStyle = base; ctx.fillRect(ox, 0, TILE, TILE);
  ctx.fillStyle = dark;
  for (let i = 0; i < n; i++) ctx.fillRect(ox + Math.floor(r() * (TILE - size)), Math.floor(r() * (TILE - size)), size, size);
}

/** façade: white wall, ribbon windows and the warm wooden fins from the aerial render */
function facade(c: Ctx, o: number, base: boolean) {
  c.fillStyle = PAL.wall; c.fillRect(o, 0, 32, 32);
  c.fillStyle = PAL.wallShade; c.fillRect(o, 0, 32, 3);
  c.fillStyle = '#b8bec3'; c.fillRect(o, 0, 32, 1);
  // window band
  c.fillStyle = PAL.window; c.fillRect(o + 2, 7, 28, 14);
  c.fillStyle = PAL.windowLight; c.fillRect(o + 2, 7, 28, 3); c.fillRect(o + 4, 12, 6, 2); c.fillRect(o + 19, 12, 5, 2);
  c.fillStyle = '#e8ecef'; c.fillRect(o + 15, 7, 2, 14);
  // wooden fins
  c.fillStyle = PAL.fin; c.fillRect(o + 0, 4, 3, 22); c.fillRect(o + 10, 4, 3, 22); c.fillRect(o + 21, 4, 3, 22);
  c.fillStyle = PAL.finDark; c.fillRect(o + 2, 4, 1, 22); c.fillRect(o + 12, 4, 1, 22); c.fillRect(o + 23, 4, 1, 22);
  c.fillStyle = PAL.wallShade; c.fillRect(o, 25, 32, 2);
  if (base) { c.fillStyle = '#9aa1a6'; c.fillRect(o, 28, 32, 4); c.fillStyle = '#80878c'; c.fillRect(o, 31, 32, 1); }
}

const TILE_PAINTERS: Record<number, (ctx: Ctx, ox: number) => void> = {
  [T.FOREST]: (c, o) => {
    speckle(c, o, PAL.forestDark, '#1b4029', 14, 11, 3);
    const r = rng(12);
    for (let i = 0; i < 4; i++) {
      const x = o + 4 + r() * 24, y = 4 + r() * 24, rad = 7 + r() * 5;
      c.fillStyle = PAL.forest; c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.fill();
      c.fillStyle = PAL.forestLight; c.beginPath(); c.arc(x - 2, y - 2, rad * 0.55, 0, Math.PI * 2); c.fill();
    }
  },
  [T.GROUND]: (c, o) => {
    speckle(c, o, PAL.lawn, PAL.lawnDark, 26, 21, 2);
    const r = rng(22);
    c.fillStyle = PAL.lawnLight;
    for (let i = 0; i < 10; i++) { const x = o + Math.floor(r() * 30), y = Math.floor(r() * 29); c.fillRect(x, y, 1, 3); }
  },
  [T.PATH]: (c, o) => {
    c.fillStyle = PAL.paver; c.fillRect(o, 0, 32, 32);
    c.fillStyle = PAL.paverDark;
    for (let y = 0; y < 32; y += 8) { c.fillRect(o, y, 32, 1); const off = (y / 8) % 2 ? 8 : 0; for (let x = off; x < 32; x += 16) c.fillRect(o + x, y, 1, 8); }
    c.fillStyle = PAL.paverLight; const r = rng(31); for (let i = 0; i < 6; i++) c.fillRect(o + Math.floor(r() * 30), Math.floor(r() * 30), 2, 1);
  },
  [T.PLAZA]: (c, o) => {
    c.fillStyle = PAL.plaza; c.fillRect(o, 0, 32, 32);
    c.fillStyle = PAL.plazaLine; c.fillRect(o, 0, 32, 1); c.fillRect(o, 16, 32, 1); c.fillRect(o, 0, 1, 32); c.fillRect(o + 16, 0, 1, 32);
    c.fillStyle = '#efe9dd'; c.fillRect(o + 2, 2, 5, 1); c.fillRect(o + 18, 18, 5, 1);
    const r = rng(41); c.fillStyle = '#d9d1c1'; for (let i = 0; i < 6; i++) c.fillRect(o + Math.floor(r() * 30), Math.floor(r() * 30), 1, 1);
  },
  [T.ROOF]: (c, o) => {
    c.fillStyle = PAL.roof; c.fillRect(o, 0, 32, 32);
    c.fillStyle = PAL.roofDark; for (let x = 0; x < 32; x += 8) c.fillRect(o + x, 0, 1, 32);
    c.fillStyle = PAL.roofLight; for (let x = 3; x < 32; x += 8) c.fillRect(o + x, 0, 1, 32);
  },
  [T.SKYLIGHT]: (c, o) => {
    TILE_PAINTERS[T.ROOF](c, o);
    c.fillStyle = '#7f9db5'; c.fillRect(o + 3, 5, 26, 22);
    c.fillStyle = '#b9d2e6'; c.fillRect(o + 3, 5, 26, 4); c.fillRect(o + 3, 5, 3, 22);
    c.fillStyle = PAL.roofDark; c.fillRect(o + 15, 5, 2, 22);
  },
  [T.SOLAR]: (c, o) => {
    c.fillStyle = PAL.roof; c.fillRect(o, 0, 32, 32);
    c.fillStyle = PAL.solar; c.fillRect(o + 1, 1, 30, 30);
    c.fillStyle = PAL.solarLine; for (let x = 1; x < 32; x += 10) c.fillRect(o + x, 1, 1, 30); for (let y = 1; y < 32; y += 7) c.fillRect(o + 1, y, 30, 1);
    c.fillStyle = '#5a80c2'; c.fillRect(o + 3, 3, 6, 2);
  },
  [T.GREEN_ROOF]: (c, o) => {
    speckle(c, o, PAL.green, PAL.greenDark, 26, 61);
    c.fillStyle = '#9ad07f'; const r = rng(62); for (let i = 0; i < 8; i++) c.fillRect(o + Math.floor(r() * 30), Math.floor(r() * 30), 2, 1);
    c.fillStyle = '#e6c84f'; c.fillRect(o + 8, 9, 2, 2); c.fillRect(o + 22, 20, 2, 2);
  },
  [T.WALL]: (c, o) => facade(c, o, false),
  [T.WALL_BASE]: (c, o) => facade(c, o, true),
  [T.DOOR]: (c, o) => {
    c.fillStyle = PAL.wall; c.fillRect(o, 0, 32, 32);
    c.fillStyle = '#6f757a'; c.fillRect(o, 0, 32, 5); // awning
    c.fillStyle = '#8b9196'; c.fillRect(o, 0, 32, 2);
    c.fillStyle = PAL.doorFrame; c.fillRect(o + 3, 5, 26, 27);
    c.fillStyle = '#3c5468'; c.fillRect(o + 6, 8, 20, 24);
    c.fillStyle = '#9cc0dd'; c.fillRect(o + 7, 9, 8, 12); c.fillRect(o + 17, 9, 8, 12);
    c.fillStyle = '#d7e7f2'; c.fillRect(o + 7, 9, 8, 2); c.fillRect(o + 17, 9, 8, 2);
    c.fillStyle = '#e0b04a'; c.fillRect(o + 14, 22, 1, 4); c.fillRect(o + 17, 22, 1, 4);
  },
  [T.DOOR_REVIR]: (c, o) => {
    c.fillStyle = PAL.wall; c.fillRect(o, 0, 32, 32);
    c.fillStyle = PAL.revir; c.fillRect(o + 3, 3, 26, 29);
    c.fillStyle = '#7d241b'; c.fillRect(o + 6, 12, 20, 20);
    c.fillStyle = '#ffffff'; c.fillRect(o + 13, 4, 6, 7); c.fillRect(o + 11, 6, 10, 3);
    c.fillStyle = '#5a1a14'; for (let y = 15; y < 32; y += 5) c.fillRect(o + 6, y, 20, 1);
  },
  [T.COURT_RED]: (c, o) => speckle(c, o, PAL.courtRed, '#9a4038', 10, 81),
  [T.COURT_BLUE]: (c, o) => speckle(c, o, PAL.courtBlue, '#386f92', 10, 91),
  [T.FENCE]: (c, o) => {
    // the foot of the perimeter wall (the wall itself stands on it as sprites, see art/gateway.ts)
    c.fillStyle = '#8f8778'; c.fillRect(o, 0, 32, 32);
    c.fillStyle = '#7a7366'; for (let y = 4; y < 32; y += 8) c.fillRect(o, y, 32, 1);
  },
  [T.GATE]: (c, o) => {
    // the open gateway in the south wall (its pillars are drawn as separate sprites)
    TILE_PAINTERS[T.PATH](c, o);
    c.fillStyle = 'rgba(122,112,96,0.45)'; c.fillRect(o, 13, 32, 6);
  },
  // ----- interior tiles (dorm study room / sleeping room) -----
  17: (c, o) => { // wooden floor
    c.fillStyle = '#c79a66'; c.fillRect(o, 0, 32, 32);
    c.fillStyle = '#b5874f'; for (let y = 0; y < 32; y += 8) c.fillRect(o, y, 32, 1);
    c.fillStyle = '#a97b45'; c.fillRect(o + 11, 0, 1, 8); c.fillRect(o + 25, 8, 1, 8); c.fillRect(o + 6, 16, 1, 8); c.fillRect(o + 19, 24, 1, 8);
    c.fillStyle = '#d6aa76'; c.fillRect(o + 2, 3, 6, 1); c.fillRect(o + 16, 19, 5, 1);
  },
  18: (c, o) => { // interior wall
    c.fillStyle = '#efe6d6'; c.fillRect(o, 0, 32, 32);
    c.fillStyle = '#e2d7c3'; c.fillRect(o, 0, 32, 4);
    c.fillStyle = '#d4c8b2'; c.fillRect(o, 28, 32, 4);
  },
  19: (c, o) => { // wall with baseboard
    c.fillStyle = '#efe6d6'; c.fillRect(o, 0, 32, 32);
    c.fillStyle = '#8a5a32'; c.fillRect(o, 24, 32, 8);
    c.fillStyle = '#a8703f'; c.fillRect(o, 24, 32, 2);
  },
  20: (c, o) => { // blackboard
    c.fillStyle = '#efe6d6'; c.fillRect(o, 0, 32, 32);
    c.fillStyle = '#7a5434'; c.fillRect(o, 2, 32, 26);
    c.fillStyle = '#2f5d3a'; c.fillRect(o, 4, 32, 22);
    c.fillStyle = 'rgba(255,255,255,0.55)'; c.fillRect(o + 4, 9, 12, 1); c.fillRect(o + 4, 14, 18, 1); c.fillRect(o + 18, 19, 8, 1);
  },
  21: (c, o) => { // window
    c.fillStyle = '#efe6d6'; c.fillRect(o, 0, 32, 32);
    c.fillStyle = '#7a5434'; c.fillRect(o + 3, 3, 26, 24);
    c.fillStyle = '#9fd0f0'; c.fillRect(o + 5, 5, 22, 20);
    c.fillStyle = '#d7eefa'; c.fillRect(o + 5, 5, 22, 5);
    c.fillStyle = '#7a5434'; c.fillRect(o + 15, 5, 2, 20);
  },
  22: (c, o) => { // desk
    TILE_PAINTERS[17](c, o);
    c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(o + 3, 26, 27, 4);
    c.fillStyle = '#6b4426'; c.fillRect(o + 4, 18, 3, 10); c.fillRect(o + 25, 18, 3, 10);
    c.fillStyle = '#d9b47f'; c.fillRect(o + 2, 6, 28, 14);
    c.fillStyle = '#b8915c'; c.fillRect(o + 2, 18, 28, 2);
    c.fillStyle = '#ffffff'; c.fillRect(o + 8, 9, 9, 6); c.fillStyle = '#4f8fc0'; c.fillRect(o + 18, 10, 6, 5);
  },
  23: (c, o) => { // rug
    c.fillStyle = '#9b3b3b'; c.fillRect(o, 0, 32, 32);
    c.fillStyle = '#c9a24a'; c.fillRect(o + 3, 3, 26, 26);
    c.fillStyle = '#9b3b3b'; c.fillRect(o + 6, 6, 20, 20);
    c.fillStyle = '#2f4a6b'; c.fillRect(o + 12, 12, 8, 8);
  },
  24: (c, o) => { // bunk bed (seen from above)
    TILE_PAINTERS[17](c, o);
    c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(o + 4, 28, 26, 3);
    c.fillStyle = '#4a5156'; c.fillRect(o + 2, 1, 28, 29);
    c.fillStyle = '#22365c'; c.fillRect(o + 4, 9, 24, 19);
    c.fillStyle = '#2e4777'; c.fillRect(o + 4, 9, 24, 3);
    c.fillStyle = '#f4f4f0'; c.fillRect(o + 6, 3, 20, 6);
  },
  25: (c, o) => { // lockers
    c.fillStyle = '#7f9a8a'; c.fillRect(o, 0, 32, 32);
    c.fillStyle = '#6a8475'; c.fillRect(o + 15, 0, 2, 32); c.fillRect(o, 0, 32, 2);
    c.fillStyle = '#c9d3cd'; c.fillRect(o + 11, 14, 2, 4); c.fillRect(o + 19, 14, 2, 4);
    c.fillStyle = '#5b7366'; for (let y = 4; y < 12; y += 3) { c.fillRect(o + 3, y, 9, 1); c.fillRect(o + 20, y, 9, 1); }
  },
  26: (c, o) => { // bookshelf
    c.fillStyle = '#6b4426'; c.fillRect(o, 0, 32, 32);
    const cols = ['#c0392b', '#2f6b9a', '#e0b04a', '#3d7a45', '#8e5ea2'];
    for (let row = 0; row < 3; row++) {
      c.fillStyle = '#4a2f1a'; c.fillRect(o + 1, 10 * row + 9, 30, 2);
      for (let i = 0; i < 6; i++) { c.fillStyle = cols[(i + row) % cols.length]; c.fillRect(o + 2 + i * 5, 10 * row + 2, 4, 7); }
    }
  },
  27: (c, o) => { // interior door with exit sign
    c.fillStyle = '#efe6d6'; c.fillRect(o, 0, 32, 32);
    c.fillStyle = '#7a4e2a'; c.fillRect(o + 4, 2, 24, 30);
    c.fillStyle = '#5b3a22'; c.fillRect(o + 7, 5, 18, 27);
    c.fillStyle = '#3d9a5b'; c.fillRect(o + 10, 0, 12, 4);
    c.fillStyle = '#e0b04a'; c.fillRect(o + 21, 17, 2, 4);
  },
  28: (c, o) => { // TV corner
    TILE_PAINTERS[23](c, o);
    c.fillStyle = '#5b3a22'; c.fillRect(o + 2, 16, 28, 14);
    c.fillStyle = '#1d2326'; c.fillRect(o + 5, 2, 22, 15);
    c.fillStyle = '#4f8fc0'; c.fillRect(o + 7, 4, 18, 11);
    c.fillStyle = '#9fd0f0'; c.fillRect(o + 7, 4, 18, 3);
  },
  29: (c, o) => { // serving counter with food trays
    TILE_PAINTERS[17](c, o);
    c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(o, 26, 32, 4);
    c.fillStyle = '#9aa3a9'; c.fillRect(o, 4, 32, 22);
    c.fillStyle = '#c7cfd4'; c.fillRect(o, 4, 32, 4);
    c.fillStyle = '#6f777c'; c.fillRect(o, 24, 32, 2);
    const foods = ['#e0b04a', '#c0392b', '#7fb466', '#d9822b'];
    c.fillStyle = '#e8ecef'; c.fillRect(o + 3, 10, 12, 9); c.fillRect(o + 17, 10, 12, 9);
    c.fillStyle = foods[o / 32 % 4 | 0]; c.fillRect(o + 5, 12, 8, 5);
    c.fillStyle = foods[(o / 32 + 2) % 4 | 0]; c.fillRect(o + 19, 12, 8, 5);
  },
  30: (c, o) => { // long dining table
    TILE_PAINTERS[17](c, o);
    c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(o, 25, 32, 4);
    c.fillStyle = '#e8d6b4'; c.fillRect(o, 6, 32, 19);
    c.fillStyle = '#d4bf98'; c.fillRect(o, 23, 32, 2); c.fillRect(o, 6, 32, 1);
    c.fillStyle = '#ffffff'; c.fillRect(o + 4, 10, 8, 6); c.fillRect(o + 20, 14, 8, 6);
    c.fillStyle = '#4f8fc0'; c.fillRect(o + 14, 9, 3, 5);
  },
  31: (c, o) => { // sink
    c.fillStyle = '#efe6d6'; c.fillRect(o, 0, 32, 32);
    c.fillStyle = '#d7dde1'; c.fillRect(o + 6, 8, 22, 16);
    c.fillStyle = '#9fd0f0'; c.fillRect(o + 10, 12, 14, 8);
    c.fillStyle = '#8b9196'; c.fillRect(o + 15, 4, 3, 7);
    c.fillStyle = '#f4f4f0'; c.fillRect(o + 2, 6, 3, 10);
  },
  32: (c, o) => { // canteen counter with snacks
    TILE_PAINTERS[17](c, o);
    c.fillStyle = '#c0392b'; c.fillRect(o, 2, 32, 26);
    c.fillStyle = '#e4574a'; c.fillRect(o, 2, 32, 4);
    c.fillStyle = '#f2c14e'; c.fillRect(o + 4, 10, 6, 5); c.fillRect(o + 20, 16, 7, 5);
    c.fillStyle = '#f4f4f0'; c.fillRect(o + 12, 9, 6, 8);
    c.fillStyle = '#8a5a32'; c.fillRect(o + 4, 18, 10, 4);
  },
  36: (c, o) => { // study table for four, left half: one long top, a notebook for each side
    TILE_PAINTERS[17](c, o);
    c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(o + 3, 25, 29, 5);
    c.fillStyle = '#6b4426'; c.fillRect(o + 4, 20, 3, 8);
    c.fillStyle = '#d9b47f'; c.fillRect(o + 2, 4, 30, 18);
    c.fillStyle = '#e6c793'; c.fillRect(o + 2, 4, 30, 2);
    c.fillStyle = '#b8915c'; c.fillRect(o + 2, 20, 30, 2); c.fillRect(o + 2, 4, 1, 18);
    c.fillStyle = '#ffffff'; c.fillRect(o + 8, 6, 9, 5); c.fillRect(o + 9, 14, 10, 5);   // a notebook facing each way
    c.fillStyle = '#c0392b'; c.fillRect(o + 20, 6, 5, 4);                            // a textbook
    c.fillStyle = '#e0b04a'; c.fillRect(o + 21, 16, 7, 1);                           // a pencil
  },
  37: (c, o) => { // study table for four, right half
    TILE_PAINTERS[17](c, o);
    c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(o, 25, 30, 5);
    c.fillStyle = '#6b4426'; c.fillRect(o + 25, 20, 3, 8);
    c.fillStyle = '#d9b47f'; c.fillRect(o, 4, 30, 18);
    c.fillStyle = '#e6c793'; c.fillRect(o, 4, 30, 2);
    c.fillStyle = '#b8915c'; c.fillRect(o, 20, 30, 2); c.fillRect(o + 29, 4, 1, 18);
    c.fillStyle = '#ffffff'; c.fillRect(o + 14, 6, 9, 5); c.fillRect(o + 12, 14, 10, 5);
    c.fillStyle = '#4f8fc0'; c.fillRect(o + 5, 15, 5, 4);
    c.fillStyle = '#3d7a45'; c.fillRect(o + 5, 6, 6, 4);
  },
  38: (c, o) => { // folding screen (paravan) running north–south: wooden frames, cream cloth, panels hinged in a zig-zag
    TILE_PAINTERS[17](c, o);
    for (let i = 0; i < 2; i++) {
      const y = i * 16, dx = i ? 3 : -3;                                       // each panel turns the other way at its hinge
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(o + 23 + dx, y + 2, 5, 15);  // its shadow on the floor
      c.fillStyle = '#6b4426'; c.fillRect(o + 9 + dx, y, 15, 16);               // frame
      c.fillStyle = '#8a5a32'; c.fillRect(o + 9 + dx, y, 15, 2);                // top rail catching the light
      c.fillStyle = '#f1e6cc'; c.fillRect(o + 11 + dx, y + 3, 6, 12);           // cloth, lit side
      c.fillStyle = '#dccba5'; c.fillRect(o + 17 + dx, y + 3, 5, 12);           // cloth, shaded side
      c.fillStyle = '#b5684a'; c.fillRect(o + 13 + dx, y + 7, 2, 2); c.fillRect(o + 18 + dx, y + 10, 2, 2); // a little pattern
      c.fillStyle = '#d1a64a'; c.fillRect(o + 15 + dx, y + 15, 3, 1);           // brass hinge
    }
  },
  [T.ROAD]: (c, o) => {
    // asphalt outside the fence, with a dashed centre line
    speckle(c, o, '#5d6266', '#53585c', 18, 101);
    c.fillStyle = '#6b7075'; const r = rng(102); for (let i = 0; i < 8; i++) c.fillRect(o + Math.floor(r() * 30), Math.floor(r() * 30), 2, 1);
    c.fillStyle = '#d9d4c4'; c.fillRect(o + 4, 15, 10, 2); c.fillRect(o + 20, 15, 8, 2);
  },
  [T.HOUSES]: (c, o) => {
    // the neighbourhood's terracotta roofs, seen from above
    c.fillStyle = '#7d4a3a'; c.fillRect(o, 0, 32, 32);
    const r = rng(111);
    for (const [x, y, w, h] of [[1, 1, 14, 13], [17, 2, 14, 12], [2, 17, 12, 14], [16, 16, 15, 15]]) {
      const tone = ['#b5573f', '#a24c37', '#c4674a', '#9a5a46'][Math.floor(r() * 4)];
      c.fillStyle = tone; c.fillRect(o + x, y, w, h);
      c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(o + x, y, w, Math.floor(h / 2));
      c.fillStyle = 'rgba(0,0,0,0.18)'; for (let ly = y + 2; ly < y + h; ly += 3) c.fillRect(o + x, ly, w, 1);
    }
  },
  [T.CAMPUS_WALL]: (c, o) => {
    // a stone garden wall running north–south, seen from above: light coping, shaded east face
    TILE_PAINTERS[T.GROUND](c, o);
    c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(o + 22, 0, 6, 32);
    c.fillStyle = '#8f8778'; c.fillRect(o + 10, 0, 12, 32);
    c.fillStyle = '#7a7366'; for (let y = 3; y < 32; y += 8) c.fillRect(o + 16, y, 6, 1);
    c.fillStyle = '#d8d2c4'; c.fillRect(o + 10, 0, 8, 32);
    c.fillStyle = '#ebe6da'; c.fillRect(o + 10, 0, 2, 32);
    c.fillStyle = '#b9b2a3'; for (let y = 7; y < 32; y += 8) c.fillRect(o + 10, y, 8, 1);
  },
  [T.COURTYARD]: (c, o) => {
    c.fillStyle = PAL.roofDark; c.fillRect(o, 0, 32, 32);
    c.fillStyle = '#8fb37a'; c.fillRect(o + 2, 2, 28, 28);
    c.fillStyle = '#79a067'; c.fillRect(o + 6, 6, 8, 8); c.fillRect(o + 18, 16, 8, 8);
    c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(o + 2, 2, 28, 3);
  },
};

/** one tile painted on its own canvas (the ground layer uses them as fill patterns) */
export function tileCanvas(id: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = TILE; cv.height = TILE;
  TILE_PAINTERS[id]?.(cv.getContext('2d')!, 0);
  return cv;
}

// ---------- trees: three shapes, in leaf all year ----------

export type TreeShape = 'round' | 'broad' | 'cypress';
export const TREE_SHAPES: TreeShape[] = ['round', 'broad', 'round', 'cypress', 'broad'];
export const treeKey = (shape: TreeShape, tone: number) => `tree-${shape}-${tone}`;

/** leaf palettes: outline, shade, base, light, highlight, sparkle */
const LEAF: Record<string, string[]> = {
  green: ['#1d4227', '#2a6036', '#357443', '#4a9152', '#67ad62', '#8fcc76'],
  fresh: ['#22492a', '#2f6d38', '#3f8a45', '#5aa853', '#7fc46a', '#a6dc88'],
  pine: ['#142f22', '#1d4430', '#27573b', '#33704a', '#4a8a5c', '#6aa676'],
};

/** a canopy of leaf clusters: a dark mass at the back, then clusters lit from the north-west, smallest and brightest on top */
function canopy(c: Ctx, blobs: Array<[number, number, number]>, pal: string[], seed: number) {
  const rnd = rng(seed);
  // the whole crown's centre and size, for the light
  const cx = blobs.reduce((a, b) => a + b[0], 0) / blobs.length, cy = blobs.reduce((a, b) => a + b[1], 0) / blobs.length;
  const span = Math.max(...blobs.map(([x, y, r]) => Math.hypot(x - cx, y - cy) + r));
  const lightAt = (x: number, y: number) => -((x - cx) + (y - cy) * 1.2) / span; // −1 shaded (south-east) … 1 sunlit (north-west)
  // the outline and the deep shade inside the crown
  for (const [x, y, r] of blobs) { c.fillStyle = pal[0]; c.beginPath(); c.arc(x + 0.4, y + 0.8, r + 0.9, 0, Math.PI * 2); c.fill(); }
  for (const [x, y, r] of blobs) {
    const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, pal[3]); g.addColorStop(0.55, pal[2]); g.addColorStop(1, pal[1]);
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  }
  // leaf clusters, back to front: each a little bumpy disc with its own light and shade
  const clusters: Array<[number, number, number, number]> = [];
  for (const [x, y, r] of blobs) for (let i = 0; i < r * 2.2; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * (r - 1.2);
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
    clusters.push([px, py, 1.6 + rnd() * 2.2, lightAt(px, py) + (rnd() - 0.5) * 0.5]);
  }
  clusters.sort((a, b) => a[3] - b[3]);
  for (const [x, y, r, l] of clusters) {
    const tone = l > 0.55 ? 4 : l > 0.1 ? 3 : l > -0.35 ? 2 : 1;
    c.fillStyle = pal[Math.max(0, tone - 1)]; c.beginPath(); c.arc(x + 0.35, y + 0.45, r, 0, Math.PI * 2); c.fill();
    const g = c.createRadialGradient(x - r * 0.4, y - r * 0.45, 0, x, y, r);
    g.addColorStop(0, pal[Math.min(5, tone + 1)]); g.addColorStop(0.6, pal[tone]); g.addColorStop(1, pal[Math.max(0, tone - 1)]);
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  }
  // single leaves catching the sun on the lit edge
  for (let i = 0; i < blobs.length * 9; i++) {
    const [x, y, r] = blobs[Math.floor(rnd() * blobs.length)], a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * r;
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
    if (lightAt(px, py) < 0.3) continue;
    c.fillStyle = pal[5]; c.beginPath(); c.ellipse(px, py, 0.9, 0.55, a, 0, Math.PI * 2); c.fill();
  }
}

function trunk(c: Ctx, x: number, top: number, w: number, bottom: number) {
  const p = new Path2D();
  p.moveTo(x + 0.6, top); p.lineTo(x + w - 0.6, top);
  p.quadraticCurveTo(x + w - 0.2, bottom - 6, x + w + 2.2, bottom);
  p.lineTo(x - 2.2, bottom); p.quadraticCurveTo(x + 0.2, bottom - 6, x + 0.6, top); p.closePath();
  const g = c.createLinearGradient(x - 2, 0, x + w + 2, 0);
  g.addColorStop(0, '#8a6440'); g.addColorStop(0.35, '#6a4a2c'); g.addColorStop(1, '#3a2716');
  c.fillStyle = g; c.fill(p);
  c.strokeStyle = 'rgba(40,26,14,0.55)'; c.lineWidth = 0.4;
  for (let y = top + 2; y < bottom - 2; y += 2.6) { c.beginPath(); c.moveTo(x + 0.8 + ((y * 7) % 3) * 0.4, y); c.lineTo(x + 1.6 + ((y * 7) % 3) * 0.4, y + 1.6); c.stroke(); c.beginPath(); c.moveTo(x + w - 1.2, y + 1); c.lineTo(x + w - 1.6, y + 2.4); c.stroke(); }
  c.strokeStyle = 'rgba(30,20,10,0.6)'; c.lineWidth = 0.5; c.stroke(p);
}

function paintTree(c: Ctx, shape: TreeShape, tone: number) {
  const seed = 200 + tone * 17 + shape.length * 5;
  c.lineCap = 'round'; c.lineJoin = 'round';
  // contact shadow under the trunk
  const sg = c.createRadialGradient(24.5, 66.5, 0, 24.5, 66.5, 9);
  sg.addColorStop(0, 'rgba(0,0,0,0.35)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  c.save(); c.translate(0, 66.5); c.scale(1, 0.32); c.translate(0, -66.5); c.fillStyle = sg; c.beginPath(); c.arc(24.5, 66.5, 9, 0, Math.PI * 2); c.fill(); c.restore();
  if (shape === 'cypress') {
    trunk(c, 22, 52, 4, 67);
    const blobs: Array<[number, number, number]> = [[24, 52, 8], [24, 43, 10], [24, 33, 9], [24, 24, 8], [24, 15, 6], [24, 8, 4]];
    canopy(c, blobs, LEAF.pine, seed);
    return;
  }
  const broad = shape === 'broad';
  trunk(c, broad ? 20 : 21, 34, broad ? 7 : 6, 67);
  const pal = tone === 2 ? LEAF.green : LEAF.fresh;
  const blobs: Array<[number, number, number]> = broad
    ? [[24, 28, 13], [12, 28, 10], [36, 28, 10], [17, 19, 11], [31, 19, 11], [24, 12, 9]]
    : [[24, 29, 17], [15, 25, 11], [33, 24, 11], [24, 15, 12], [20, 9, 7], [29, 11, 6]];
  canopy(c, blobs, pal, seed);
  if (broad) {
    // blossom: a judas tree in pink, a plum in white
    const rnd = rng(seed + 1);
    for (let i = 0; i < 70; i++) {
      const [x, y, r] = blobs[Math.floor(rnd() * blobs.length)], a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * (r - 1);
      const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
      const col = tone === 1 ? (rnd() < 0.6 ? '#f6f4ee' : '#ead9e2') : (rnd() < 0.6 ? '#e48ab8' : '#f4b6d0');
      c.fillStyle = 'rgba(60,30,40,0.25)'; c.beginPath(); c.arc(px + 0.35, py + 0.45, 0.95, 0, Math.PI * 2); c.fill();
      c.fillStyle = col; c.beginPath(); c.arc(px, py, 0.9, 0, Math.PI * 2); c.fill();
    }
  }
}

export const TILESET_KEY = 'tiles';
/** tileset padding (see the extrusion in generateTextures) */
export const TILESET_MARGIN = 1;
export const TILESET_SPACING = 2;
export const FOG_KEY = 'fog';
export const FOG_FULL = 0;
export const FOG_SOFT = 1;

export function generateTextures(scene: Phaser.Scene) {
  const count = 39;
  // paint tiles side by side, then copy them into an "extruded" sheet: each tile gets a 1px border
  // repeating its edge pixels, so zooming never samples the neighbouring tile (no seams)
  const raw = document.createElement('canvas');
  raw.width = TILE * count; raw.height = TILE;
  const rctx = raw.getContext('2d')!;
  for (let i = 0; i < count; i++) TILE_PAINTERS[i]?.(rctx, i * TILE);
  const step = TILE + TILESET_SPACING;
  const tiles = scene.textures.createCanvas(TILESET_KEY, TILESET_MARGIN * 2 + count * step - TILESET_SPACING, TILE + TILESET_MARGIN * 2)!;
  const ctx = tiles.getContext();
  for (let i = 0; i < count; i++) {
    const dx = TILESET_MARGIN + i * step, dy = TILESET_MARGIN, sx = i * TILE;
    ctx.drawImage(raw, sx, 0, TILE, TILE, dx, dy, TILE, TILE);
    ctx.drawImage(raw, sx, 0, 1, TILE, dx - 1, dy, 1, TILE);               // left edge
    ctx.drawImage(raw, sx + TILE - 1, 0, 1, TILE, dx + TILE, dy, 1, TILE); // right edge
    ctx.drawImage(tiles.getSourceImage() as HTMLCanvasElement, dx - 1, dy, TILE + 2, 1, dx - 1, dy - 1, TILE + 2, 1);               // top edge
    ctx.drawImage(tiles.getSourceImage() as HTMLCanvasElement, dx - 1, dy + TILE - 1, TILE + 2, 1, dx - 1, dy + TILE, TILE + 2, 1); // bottom edge
  }
  tiles.refresh();

  const fog = scene.textures.createCanvas(FOG_KEY, TILE * 2, TILE)!;
  const fctx = fog.getContext();
  const r = rng(7);
  for (const [i, alpha] of [[0, 0.95], [1, 0.55]] as const) {
    fctx.fillStyle = `rgba(150, 172, 160, ${alpha})`;
    fctx.fillRect(i * TILE, 0, TILE, TILE);
    fctx.fillStyle = `rgba(178, 196, 186, ${alpha * 0.35})`;
    for (let k = 0; k < 7; k++) { fctx.beginPath(); fctx.arc(i * TILE + 4 + r() * 24, 4 + r() * 24, 3 + r() * 5, 0, Math.PI * 2); fctx.fill(); }
  }
  fog.refresh();

  const canvas = (key: string, w: number, h: number, draw: (c: Ctx) => void) => {
    if (scene.textures.exists(key)) return;
    const t = scene.textures.createCanvas(key, w, h)!;
    draw(t.getContext());
    t.refresh();
  };

  // trees (48x72): tall trunk and a layered canopy, so they stand up in the 3/4 view. 'tree' is the
  // default; the scene swaps in a shape and tone per spot (see Ambient)
  /** a smooth texture drawn ART_RES times finer than the world (show it with setScale(1 / ART_RES)) */
  const hdCanvas = (key: string, w: number, h: number, draw: (c: Ctx) => void) => {
    if (scene.textures.exists(key)) return;
    const t = scene.textures.createCanvas(key, w * ART_RES, h * ART_RES)!;
    const c = t.getContext();
    c.setTransform(ART_RES, 0, 0, ART_RES, 0, 0);
    draw(c);
    t.refresh();
    t.setFilter(Phaser.Textures.FilterMode.LINEAR);
  };
  // trees (48x72 in the world): tall trunk and a layered canopy, so they stand up in the 3/4 view. 'tree' is the
  // default; the scene swaps in a shape and tone per spot (see Ambient)
  const tree = (key: string, shape: TreeShape, tone: number) => hdCanvas(key, 48, 72, (c) => paintTree(c, shape, tone));
  tree('tree', 'round', 2);
  for (const shape of ['round', 'broad', 'cypress'] as const) for (let tone = 0; tone < 3; tone++) tree(treeKey(shape, tone), shape, tone);
  // their shadows, cast south-east (sun from the north-west), soft-edged; the trunk's foot sits at (10, 6)
  for (const [shape, rx, ry, rot] of [['round', 21, 10, 0.2], ['broad', 25, 11, 0.15], ['cypress', 22, 6, 0.5]] as const) {
    hdCanvas(`treeshadow-${shape}`, 80, 40, (c) => {
      // drawn off to the left and thrown back in place as a blurred shadow
      const off = 80 * ART_RES;
      c.setTransform(ART_RES, 0, 0, ART_RES, -off, 0);
      c.shadowColor = '#000'; c.shadowBlur = 3 * ART_RES; c.shadowOffsetX = off;
      c.fillStyle = '#000';
      c.beginPath(); c.moveTo(8, 5); c.lineTo(12, 4); c.lineTo(30, 14); c.lineTo(24, 18); c.closePath(); c.fill();
      c.beginPath(); c.ellipse(shape === 'cypress' ? 38 : 40, 19, rx, ry, rot, 0, Math.PI * 2); c.fill();
    });
  }
  // basketball hoops and football goals, drawn smooth at ART_RES
  const steel = (c: Ctx, x: number, y: number, w: number, h: number) => {
    const g = c.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#8a9298'); g.addColorStop(0.35, '#4c5358'); g.addColorStop(1, '#2c3135');
    c.fillStyle = g; c.beginPath(); c.roundRect(x, y, w, h, Math.min(w, h) / 2); c.fill();
  };
  const net = (c: Ctx, cx: number, top: number, rw: number, depth: number) => {
    c.strokeStyle = 'rgba(244,244,240,0.9)'; c.lineWidth = 0.45;
    for (let i = 0; i <= 5; i++) { const t = i / 5; c.beginPath(); c.moveTo(cx - rw + t * rw * 2, top); c.lineTo(cx - rw * 0.55 + t * rw * 1.1, top + depth); c.stroke(); }
    for (let k = 1; k <= 3; k++) { const f = k / 3, y = top + depth * f, hw = rw - (rw * 0.45) * f; c.beginPath(); c.moveTo(cx - hw, y); c.lineTo(cx + hw, y); c.stroke(); }
  };
  const groundShadow = (c: Ctx, x: number, y: number, rx: number, ry: number, a = 0.28) => {
    c.save(); c.translate(x, y); c.scale(1, ry / rx);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, Math.PI * 2); c.fill(); c.restore();
  };
  const board = (c: Ctx, x: number, y: number, w: number, h: number) => {
    c.fillStyle = '#6f777c'; c.beginPath(); c.roundRect(x, y, w, h, 0.8); c.fill();
    const g = c.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#dfe3e6');
    c.fillStyle = g; c.beginPath(); c.roundRect(x + 0.8, y + 0.8, w - 1.6, h - 1.6, 0.6); c.fill();
  };
  hdCanvas('hoop', 40, 56, (c) => {
    groundShadow(c, 10.5, 52, 7, 2.2);
    c.fillStyle = '#2a2f33'; c.beginPath(); c.roundRect(5, 49.5, 11, 4, 1); c.fill();
    steel(c, 8, 13, 4, 38); steel(c, 10, 15, 8, 3);
    board(c, 16, 1, 7, 27);
    c.strokeStyle = '#d6452b'; c.lineWidth = 1; c.strokeRect(18, 13, 2, 8);
    c.strokeStyle = '#e2572b'; c.lineWidth = 1.4; c.beginPath(); c.ellipse(28, 21, 6, 2.4, 0, 0, Math.PI * 2); c.stroke();
    net(c, 28, 21.5, 5.6, 8);
  });
  // hoops at the ends of a north–south court (36x60): the north one faces you across the court (white board, rim and
  // net in front of it), the south one shows the back of its board and the pole in front
  hdCanvas('hoop-n', 36, 60, (c) => {
    groundShadow(c, 18, 56, 7, 2.2);
    c.fillStyle = '#2a2f33'; c.beginPath(); c.roundRect(13, 53.5, 10, 4, 1); c.fill();
    steel(c, 16, 20, 4, 35);
    board(c, 4, 1, 28, 19);
    c.strokeStyle = '#d6452b'; c.lineWidth = 0.9; c.strokeRect(13.5, 8.5, 9, 7);
    c.strokeStyle = '#e2572b'; c.lineWidth = 1.4; c.beginPath(); c.ellipse(18, 19, 5.5, 2, 0, 0, Math.PI * 2); c.stroke();
    net(c, 18, 19.5, 5.2, 8);
  });
  hdCanvas('hoop-s', 36, 60, (c) => {
    groundShadow(c, 18, 56, 7, 2.2);
    c.fillStyle = '#2a2f33'; c.beginPath(); c.roundRect(13, 53.5, 10, 4, 1); c.fill();
    c.strokeStyle = '#e2572b'; c.lineWidth = 1.4; c.beginPath(); c.ellipse(18, 6, 5.5, 2, 0, Math.PI, Math.PI * 2); c.stroke();
    const g = c.createLinearGradient(4, 5, 4, 22); g.addColorStop(0, '#7a8287'); g.addColorStop(1, '#4f565b');
    c.fillStyle = g; c.beginPath(); c.roundRect(4, 5, 28, 17, 1); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(6, 10.5); c.lineTo(30, 10.5); c.moveTo(6, 15.5); c.lineTo(30, 15.5); c.stroke();
    steel(c, 14, 12, 8, 3); steel(c, 16, 14, 4, 41);
  });
  // football goals: the north one faces you (net seen through the mouth), the south one shows its back
  const goalNet = (c: Ctx, x0: number, y0: number, x1: number, y1: number) => {
    c.strokeStyle = 'rgba(236,240,242,0.55)'; c.lineWidth = 0.4;
    for (let x = x0; x <= x1; x += 2.5) { c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y1); c.stroke(); }
    for (let y = y0; y <= y1; y += 2.5) { c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke(); }
  };
  const post = (c: Ctx, x: number, y: number, w: number, h: number) => {
    c.fillStyle = '#6b7278'; c.beginPath(); c.roundRect(x - 0.4, y - 0.4, w + 0.8, h + 0.8, 1.4); c.fill();
    const g = c.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d4d9dc');
    c.fillStyle = g; c.beginPath(); c.roundRect(x, y, w, h, 1.2); c.fill();
  };
  hdCanvas('goal-n', 64, 34, (c) => {
    goalNet(c, 5, 5, 59, 22);
    groundShadow(c, 33, 33, 30, 2.5, 0.22);
    post(c, 2, 11, 60, 3.4); post(c, 2, 11, 3.4, 22); post(c, 58.6, 11, 3.4, 22);
  });
  hdCanvas('goal-s', 64, 34, (c) => {
    groundShadow(c, 33, 31.5, 30, 2.5, 0.22);
    post(c, 2, 1, 60, 3.4); post(c, 2, 1, 3.4, 21); post(c, 58.6, 1, 3.4, 21);
    goalNet(c, 5, 4, 59, 30);
    c.strokeStyle = 'rgba(220,226,230,0.8)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(5, 14); c.lineTo(60, 14); c.moveTo(5, 30); c.lineTo(60, 30); c.stroke();
  });
  // a gull over the campus (2 wing frames) and a plaza pigeon (stand, peck, fly), drawn smooth at ART_RES
  const frames = (key: string, fw: number, fh: number, n: number, draw: (c: Ctx, f: number) => void) => {
    if (scene.textures.exists(key)) return;
    const t = scene.textures.createCanvas(key, fw * n * ART_RES, fh * ART_RES)!;
    const c = t.getContext();
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (let f = 0; f < n; f++) { c.setTransform(ART_RES, 0, 0, ART_RES, f * fw * ART_RES, 0); draw(c, f); }
    c.setTransform(1, 0, 0, 1, 0, 0);
    t.refresh();
    t.setFilter(Phaser.Textures.FilterMode.LINEAR);
    for (let f = 0; f < n; f++) t.add(f, 0, f * fw * ART_RES, 0, fw * ART_RES, fh * ART_RES);
  };
  frames('gull', 14, 8, 2, (c, f) => {
    const up = f === 0;
    // wings: grey on top with dark tips, swept up or down from the shoulders
    for (const side of [-1, 1]) {
      const w = new Path2D();
      w.moveTo(7, 4); w.quadraticCurveTo(7 + side * 3, up ? 0.5 : 4.5, 7 + side * 6.5, up ? 0.6 : 5.6);
      w.quadraticCurveTo(7 + side * 3.5, up ? 2.6 : 5.4, 7, 4.8); w.closePath();
      c.fillStyle = '#c9d0d5'; c.fill(w);
      c.fillStyle = '#5f676c'; c.beginPath(); c.arc(7 + side * 6.2, up ? 0.8 : 5.5, 0.7, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = '#f6f6f2'; c.beginPath(); c.ellipse(7, 4.2, 2.6, 1.1, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#e8a33b'; c.beginPath(); c.moveTo(9.4, 4); c.lineTo(10.6, 4.3); c.lineTo(9.4, 4.6); c.closePath(); c.fill();
  });
  frames('pigeon', 12, 10, 3, (c, f) => {
    const sh = (x: number, y: number) => { c.fillStyle = 'rgba(0,0,0,0.22)'; c.beginPath(); c.ellipse(x, y, 3.6, 0.8, 0, 0, Math.PI * 2); c.fill(); };
    if (f < 2) {
      const peck = f === 1, hx = peck ? 8.6 : 8, hy = peck ? 6 : 3.2;
      sh(6, 9.2);
      c.strokeStyle = '#c2645a'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(5.4, 7.6); c.lineTo(5.2, 8.9); c.moveTo(6.8, 7.6); c.lineTo(7, 8.9); c.stroke();
      c.fillStyle = '#5d646b'; c.beginPath(); c.moveTo(4, 5.4); c.lineTo(0.8, 4.6); c.lineTo(1.2, 6.2); c.closePath(); c.fill(); // tail
      const body = c.createLinearGradient(3, 4, 6, 8); body.addColorStop(0, '#b4bcc2'); body.addColorStop(1, '#757d84');
      c.fillStyle = body; c.beginPath(); c.ellipse(5.8, 5.9, 3.3, 2.1, -0.1, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(60,66,72,0.7)'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(4, 5.6); c.lineTo(6.8, 6.2); c.moveTo(4.2, 6.6); c.lineTo(6.6, 7); c.stroke(); // wing bars
      c.fillStyle = '#5f8f7a'; c.beginPath(); c.ellipse(hx - 0.8, hy + 1.6, 1.3, 1.1, 0, 0, Math.PI * 2); c.fill(); // green neck
      c.fillStyle = '#7f878e'; c.beginPath(); c.arc(hx, hy + 0.6, 1.3, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1d2326'; c.beginPath(); c.arc(hx + 0.4, hy + 0.3, 0.3, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#d9a07a'; c.beginPath(); c.moveTo(hx + 1.2, hy + 0.6); c.lineTo(hx + 2.2, hy + 1); c.lineTo(hx + 1.2, hy + 1.2); c.closePath(); c.fill();
    } else {
      // flying: wings spread
      for (const side of [-1, 1]) {
        c.fillStyle = '#aab2b8'; c.beginPath(); c.moveTo(6, 3); c.quadraticCurveTo(6 + side * 3, 0.2, 6 + side * 5.6, 1); c.quadraticCurveTo(6 + side * 3, 3, 6, 4.4); c.closePath(); c.fill();
        c.fillStyle = '#5d646b'; c.beginPath(); c.arc(6 + side * 5.2, 1.2, 0.6, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = '#8f979e'; c.beginPath(); c.ellipse(6, 4, 1.6, 2.2, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#5f8f7a'; c.beginPath(); c.arc(6, 2.2, 0.9, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#7f878e'; c.beginPath(); c.arc(6, 1.6, 0.9, 0, Math.PI * 2); c.fill();
    }
  });
  // rain puddles (3 shapes): dark water with a soft edge, the sky reflected in a bright streak
  for (let i = 0; i < 3; i++) hdCanvas(`puddle-${i}`, 40, 18, (c) => {
    const r = rng(300 + i);
    const blobs = Array.from({ length: 3 }, (_, k) => [10 + k * 9 + r() * 4, 8 + r() * 3, 6 + r() * 4, 3 + r() * 2]);
    const p = new Path2D();
    for (const [x, y, rx, ry] of blobs) p.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fillStyle = 'rgba(40,52,64,0.18)'; c.save(); c.translate(0.4, 0.6); c.fill(p); c.restore(); // wet rim
    const g = c.createLinearGradient(0, 2, 0, 16);
    g.addColorStop(0, 'rgba(150,180,206,0.62)'); g.addColorStop(1, 'rgba(80,102,124,0.6)');
    c.fillStyle = g; c.fill(p);
    c.save(); c.clip(p);
    c.strokeStyle = 'rgba(232,242,250,0.65)'; c.lineWidth = 0.8;
    for (const [x, y, rx] of blobs) { c.beginPath(); c.moveTo(x - rx * 0.55, y - 1.6); c.lineTo(x + rx * 0.15, y - 1.9); c.stroke(); }
    c.restore();
  });
  // Atatürk bust (40x64): marble pedestal with a gold plaque, bronze head and shoulders
  hdCanvas('bust', 40, 64, (c) => {
    groundShadow(c, 22, 60, 19, 4, 0.3);
    // plinth and pedestal, lit from the north-west
    const marble = (x: number, y: number, w: number, h: number, lite: string, dark: string) => {
      const g = c.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, lite); g.addColorStop(0.7, dark); g.addColorStop(1, dark);
      c.fillStyle = g; c.beginPath(); c.roundRect(x, y, w, h, 0.8); c.fill();
    };
    marble(2, 52, 36, 8, '#d6cfc0', '#a9a293'); c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(2.5, 52.3, 35, 0.8);
    marble(7, 30, 26, 22, '#f2eee6', '#cbc4b5');
    c.strokeStyle = 'rgba(150,140,125,0.35)'; c.lineWidth = 0.35; c.beginPath(); c.moveTo(10, 33); c.quadraticCurveTo(16, 40, 13, 48); c.moveTo(25, 31); c.quadraticCurveTo(22, 38, 28, 46); c.stroke(); // marble veins
    marble(6, 28, 28, 3, '#fbf9f4', '#ddd7cb');
    const gold = c.createLinearGradient(12, 38, 26, 45); gold.addColorStop(0, '#f0d07a'); gold.addColorStop(1, '#a07a2c');
    c.fillStyle = gold; c.beginPath(); c.roundRect(12, 38, 14, 7, 0.6); c.fill();
    c.fillStyle = 'rgba(80,55,20,0.6)'; c.fillRect(14, 40.5, 10, 0.5); c.fillRect(15, 42.3, 8, 0.5);
    // bronze: shoulders, neck and head, with a sheen on the lit side
    const bronze = (p: Path2D, x0: number, x1: number) => {
      const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, '#9a8060'); g.addColorStop(0.35, '#6e5a42'); g.addColorStop(1, '#3f3224');
      c.fillStyle = g; c.fill(p);
    };
    const sh = new Path2D(); sh.moveTo(7, 28); sh.lineTo(33, 28); sh.quadraticCurveTo(32, 20, 26, 19); sh.lineTo(14, 19); sh.quadraticCurveTo(8, 20, 7, 28); sh.closePath();
    bronze(sh, 7, 33);
    c.strokeStyle = 'rgba(40,30,20,0.5)'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(18, 19.5); c.lineTo(20, 26); c.lineTo(22, 19.5); c.stroke(); // lapels
    const nk = new Path2D(); nk.roundRect(17, 14.5, 6, 5.5, 1.5); bronze(nk, 17, 23);
    const hd = new Path2D(); hd.ellipse(20, 10, 6.4, 7.8, 0, 0, Math.PI * 2); bronze(hd, 13.6, 26.4);
    c.fillStyle = 'rgba(255,236,200,0.35)'; c.beginPath(); c.ellipse(17.2, 7.5, 1.6, 3, -0.2, 0, Math.PI * 2); c.fill();
    const hair = new Path2D(); hair.moveTo(13.8, 7); hair.quadraticCurveTo(15, 1.5, 20, 1.8); hair.quadraticCurveTo(25.5, 1.5, 26.2, 7); hair.quadraticCurveTo(21, 4.2, 13.8, 7); hair.closePath();
    c.fillStyle = '#3f3224'; c.fill(hair);
  });
  // the coin/card payphone on the dorm wall (16x24)
  canvas('payphone', 16, 24, (c) => {
    c.fillStyle = '#d9822b'; c.fillRect(1, 0, 14, 22); c.fillStyle = '#b5651d'; c.fillRect(12, 0, 3, 22);
    c.fillStyle = '#2d3238'; c.fillRect(3, 3, 6, 3); c.fillRect(3, 8, 8, 8);
    c.fillStyle = '#9aa1a6'; for (let y = 9; y < 15; y += 2) for (let x = 4; x < 10; x += 2) c.fillRect(x, y, 1, 1);
    c.fillStyle = '#1f1f22'; c.fillRect(10, 2, 3, 12); c.fillRect(11, 14, 1, 8);
    c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(2, 22, 13, 2);
  });
  // stone pillar of the big green main gate (32x100), taller than the campus wall: coursed stone, a green cap
  // and a lantern on top
  hdCanvas('gatepost', 32, 100, (c) => {
    groundShadow(c, 18, 96, 15, 3.5, 0.3);
    const sg = c.createLinearGradient(4, 0, 28, 0); sg.addColorStop(0, '#f0d6a8'); sg.addColorStop(0.3, '#dcb27d'); sg.addColorStop(1, '#b38a58');
    c.fillStyle = sg; c.fillRect(4, 20, 24, 76);
    const r = rng(55);
    for (let y = 20; y < 96; y += 7) {
      c.strokeStyle = 'rgba(140,105,64,0.6)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(4, y); c.lineTo(28, y); c.stroke();
      const jx = (y / 7) % 2 ? 11 : 20; c.beginPath(); c.moveTo(jx, y); c.lineTo(jx, y + 7); c.stroke();
      for (let k = 0; k < 4; k++) { c.fillStyle = r() < 0.5 ? 'rgba(120,90,50,0.15)' : 'rgba(255,240,210,0.25)'; c.beginPath(); c.arc(5 + r() * 22, y + 1 + r() * 5, 0.3 + r() * 0.5, 0, Math.PI * 2); c.fill(); }
    }
    c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(24, 20, 4, 76);
    const base = c.createLinearGradient(2, 0, 30, 0); base.addColorStop(0, '#d8b07a'); base.addColorStop(1, '#a8804e');
    c.fillStyle = base; c.beginPath(); c.roundRect(2, 88, 28, 8, 0.8); c.fill();
    const cap = c.createLinearGradient(0, 13, 0, 21); cap.addColorStop(0, '#5aa566'); cap.addColorStop(1, '#245a30');
    c.fillStyle = cap; c.beginPath(); c.roundRect(1, 13, 30, 8, 1.2); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(4, 21, 24, 1.2);
    // the lantern
    c.fillStyle = '#1f2326'; c.beginPath(); c.roundRect(10, 4, 12, 9.5, 1); c.fill(); c.beginPath(); c.moveTo(12, 4); c.lineTo(16, 0); c.lineTo(20, 4); c.closePath(); c.fill();
    const glass = c.createRadialGradient(15, 8, 0, 16, 8.5, 6); glass.addColorStop(0, '#ffffff'); glass.addColorStop(0.5, '#fff1bf'); glass.addColorStop(1, '#e8c06a');
    c.fillStyle = glass; c.fillRect(11.5, 5.5, 9, 6.5);
    c.strokeStyle = '#1f2326'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(16, 5.5); c.lineTo(16, 12); c.stroke();
  });
  // park bench: wooden slats on cast-iron ends, a soft shadow to the south-east
  hdCanvas('bench', 32, 18, (c) => {
    groundShadow(c, 18, 16, 15, 2.5, 0.3);
    const iron = (x: number) => {
      c.fillStyle = '#23272b';
      c.beginPath(); c.moveTo(x, 1); c.quadraticCurveTo(x + 2.5, 1, x + 2.6, 4); c.lineTo(x + 2.6, 13); c.quadraticCurveTo(x + 3.2, 15.5, x + 2, 16); c.lineTo(x + 0.6, 16); c.quadraticCurveTo(x - 0.4, 15.5, x + 0.2, 13); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(160,170,178,0.6)'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(x + 0.6, 2); c.lineTo(x + 0.6, 13); c.stroke();
    };
    iron(2); iron(27);
    const slat = (y: number, h: number, tone: number) => {
      const g = c.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, tone ? '#c99a62' : '#b4834e'); g.addColorStop(0.5, tone ? '#a87342' : '#9a6538'); g.addColorStop(1, '#6b4426');
      c.fillStyle = g; c.beginPath(); c.roundRect(4, y, 24, h, 0.6); c.fill();
      c.strokeStyle = 'rgba(70,40,18,0.35)'; c.lineWidth = 0.25;
      c.beginPath(); c.moveTo(6, y + h * 0.45); c.quadraticCurveTo(14, y + h * 0.3, 26, y + h * 0.55); c.stroke(); // grain
    };
    slat(1, 1.7, 1); slat(3.1, 1.7, 0); slat(5.2, 1.7, 1);
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(4, 7.1, 24, 0.9);
    slat(8, 2.2, 1); slat(10.4, 2.2, 0);
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(4, 12.6, 24, 0.6);
  });
  // street lamp: a lantern on a fluted post
  hdCanvas('lamp', 16, 56, (c) => {
    groundShadow(c, 9, 53, 6.5, 2.5, 0.3);
    const pole = c.createLinearGradient(6, 0, 11, 0); pole.addColorStop(0, '#6b757c'); pole.addColorStop(0.35, '#3d4449'); pole.addColorStop(1, '#1b1f22');
    c.fillStyle = pole; c.fillRect(6.6, 13, 3.8, 34);
    c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 0.35; c.beginPath(); c.moveTo(7.6, 14); c.lineTo(7.6, 46); c.stroke(); // fluting
    c.fillStyle = pole; c.beginPath(); c.moveTo(4, 53); c.lineTo(13, 53); c.lineTo(12, 49); c.quadraticCurveTo(11, 46, 10.4, 45); c.lineTo(6.6, 45); c.quadraticCurveTo(6, 46, 5, 49); c.closePath(); c.fill();
    // lantern: a dark roof, glass glowing warm, thin glazing bars
    c.fillStyle = '#1b1f22'; c.beginPath(); c.moveTo(2, 5.5); c.lineTo(8.5, 0.5); c.lineTo(15, 5.5); c.closePath(); c.fill();
    c.beginPath(); c.roundRect(3, 5, 11, 1.4, 0.5); c.fill(); c.beginPath(); c.roundRect(4, 12, 9, 1.6, 0.5); c.fill();
    const glass = c.createRadialGradient(7.5, 8.5, 0, 8.5, 9, 5.5); glass.addColorStop(0, '#ffffff'); glass.addColorStop(0.5, '#fff3c4'); glass.addColorStop(1, '#e8c06a');
    c.fillStyle = glass; c.beginPath(); c.moveTo(4, 6.4); c.lineTo(13, 6.4); c.lineTo(12.2, 12); c.lineTo(4.8, 12); c.closePath(); c.fill();
    c.strokeStyle = '#1b1f22'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(8.5, 6.4); c.lineTo(8.5, 12); c.stroke();
  });
  // a clipped shrub: leaf clusters lit from the north-west, sitting on its own soft shadow
  hdCanvas('bush', 30, 20, (c) => {
    groundShadow(c, 16, 17, 14, 3, 0.3);
    canopy(c, [[9, 11, 6.5], [20, 11, 7.5], [14, 8, 6.5], [12, 6, 3]], LEAF.green, 77);
  });
  // a raised flower bed: a timber edge, dark soil, leaves and flowers in four colours
  hdCanvas('flowers', 32, 22, (c) => {
    groundShadow(c, 17, 20, 15, 2.5, 0.25);
    const wood = c.createLinearGradient(0, 8, 0, 21); wood.addColorStop(0, '#9a6a42'); wood.addColorStop(1, '#5a3c24');
    c.fillStyle = wood; c.beginPath(); c.roundRect(1, 8, 30, 13, 1.2); c.fill();
    c.strokeStyle = 'rgba(40,25,12,0.4)'; c.lineWidth = 0.35; c.beginPath(); c.moveTo(2, 14.5); c.lineTo(30, 14.5); c.moveTo(11, 8); c.lineTo(11, 21); c.moveTo(21, 8); c.lineTo(21, 21); c.stroke();
    c.fillStyle = '#4a3322'; c.beginPath(); c.roundRect(2.5, 8.6, 27, 4, 1); c.fill();
    const r = rng(5);
    for (let i = 0; i < 22; i++) {
      const x = 3 + r() * 26, y = 5 + r() * 7, rad = 1.3 + r() * 1.3;
      const g = c.createRadialGradient(x - rad * 0.4, y - rad * 0.4, 0, x, y, rad); g.addColorStop(0, '#7fc46a'); g.addColorStop(1, '#2f6d38');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.fill();
    }
    const cols = ['#e4574a', '#f2c14e', '#f6f4ee', '#d78ad1'];
    for (let i = 0; i < 18; i++) {
      const x = 3.5 + r() * 25, y = 3.5 + r() * 8, col = cols[i % 4];
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; c.fillStyle = col; c.beginPath(); c.arc(x + Math.cos(a) * 0.7, y + Math.sin(a) * 0.6, 0.55, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = '#f0c040'; c.beginPath(); c.arc(x, y, 0.35, 0, Math.PI * 2); c.fill();
    }
  });
  canvas('tray', 16, 12, (c) => {
    c.fillStyle = '#8b9196'; c.fillRect(0, 2, 16, 10);
    c.fillStyle = '#c7cfd4'; c.fillRect(1, 3, 14, 8);
    c.fillStyle = '#e0b04a'; c.fillRect(3, 5, 4, 3); c.fillStyle = '#c0392b'; c.fillRect(9, 5, 4, 3);
  });
  // a canteen spoon, drawn twice as fine as the world (shown at half size): the bowl at the top, a little food in it
  canvas('spoon', 6, 18, (c) => {
    c.fillStyle = '#9aa3a8'; c.fillRect(2.4, 5.5, 1.4, 12);
    c.fillStyle = '#d7dde0'; c.fillRect(2.6, 5.5, 0.6, 11.5);
    c.fillStyle = '#b8c0c4'; c.beginPath(); c.ellipse(3, 3.2, 2.6, 3.1, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#e8edef'; c.beginPath(); c.ellipse(2.6, 2.7, 1.4, 1.9, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#e0b04a'; c.beginPath(); c.ellipse(3.1, 2.6, 1.6, 1.2, 0, 0, Math.PI * 2); c.fill();
  });
  canvas('suitcase', 14, 14, (c) => {
    c.fillStyle = '#3a2a1a'; c.fillRect(5, 0, 4, 1); c.fillRect(4, 1, 1, 3); c.fillRect(9, 1, 1, 3);
    c.fillStyle = '#8a4b2a'; c.fillRect(1, 3, 12, 10);
    c.fillStyle = '#a65f37'; c.fillRect(1, 3, 12, 2);
    c.fillStyle = '#e0b04a'; c.fillRect(3, 6, 2, 2); c.fillRect(9, 6, 2, 2);
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(1, 12, 12, 1);
  });
  // soft round light used to cut holes into the night layer
  canvas('glow', 128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  });
  canvas('warm', 128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,214,140,0.55)'); g.addColorStop(1, 'rgba(255,214,140,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  });
  // outdoor pull-up bars (barfiks): three bars at three heights on green-painted posts, sand underneath
  hdCanvas('pullup', 80, 56, (c) => {
    const sand = c.createRadialGradient(36, 48, 2, 40, 50, 40); sand.addColorStop(0, '#e2d3ad'); sand.addColorStop(1, '#c4b085');
    c.fillStyle = sand; c.beginPath(); c.ellipse(40, 50, 39, 6, 0, 0, Math.PI * 2); c.fill();
    const r = rng(9); for (let i = 0; i < 90; i++) { c.fillStyle = r() < 0.5 ? 'rgba(150,125,80,0.3)' : 'rgba(255,248,225,0.4)'; c.beginPath(); c.arc(4 + r() * 72, 46 + r() * 8, 0.35, 0, Math.PI * 2); c.fill(); }
    const bar = (x0: number, x1: number, top: number) => {
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.beginPath(); c.roundRect(x0 + 3, 50.5, x1 - x0, 2, 1); c.fill();
      for (const x of [x0, x1]) {
        const g = c.createLinearGradient(x - 2, 0, x + 2, 0); g.addColorStop(0, '#4f8f5c'); g.addColorStop(0.4, '#2d6139'); g.addColorStop(1, '#1b3a23');
        c.fillStyle = g; c.beginPath(); c.roundRect(x - 2, top, 4, 52 - top, 1.2); c.fill();
        c.fillStyle = '#1b3a23'; c.beginPath(); c.roundRect(x - 3, 49, 6, 3, 0.8); c.fill();
      }
      const st = c.createLinearGradient(0, top + 1, 0, top + 3); st.addColorStop(0, '#eef2f4'); st.addColorStop(1, '#7d858a');
      c.fillStyle = st; c.beginPath(); c.roundRect(x0, top + 1, x1 - x0, 2, 1); c.fill();
    };
    bar(4, 28, 22); bar(28, 52, 8); bar(52, 76, 15);                                                        // low, high, middle
  });
  // the flagpole with a waving Turkish flag (3 frames), drawn at ART_RES: the cloth's folds catch the light
  if (!scene.textures.exists('flag')) {
    const t = scene.textures.createCanvas('flag', 48 * 3 * ART_RES, 96 * ART_RES)!;
    const c = t.getContext();
    for (let f = 0; f < 3; f++) {
      const o = f * 48;
      c.setTransform(ART_RES, 0, 0, ART_RES, o * ART_RES, 0);
      groundShadow(c, 9, 92, 7, 3, 0.28);
      const pole = c.createLinearGradient(7, 0, 10, 0); pole.addColorStop(0, '#e2e7ea'); pole.addColorStop(0.4, '#9aa1a6'); pole.addColorStop(1, '#5f666b');
      c.fillStyle = pole; c.fillRect(7, 6, 3, 86);
      const fin = c.createRadialGradient(8, 4, 0, 8.5, 5, 3); fin.addColorStop(0, '#fff2b8'); fin.addColorStop(1, '#b8892e');
      c.fillStyle = fin; c.beginPath(); c.arc(8.5, 4.6, 2.4, 0, Math.PI * 2); c.fill();
      // the cloth: top and bottom edges follow the wave
      const wave = (x: number) => Math.sin((x / 34) * Math.PI * 2 + f * 2.1) * 2.2 * (x / 34);
      const cloth = new Path2D();
      cloth.moveTo(10, 8);
      for (let x = 0; x <= 34; x += 1) cloth.lineTo(10 + x, 8 + wave(x));
      for (let x = 34; x >= 0; x -= 1) cloth.lineTo(10 + x, 30 + wave(x));
      cloth.closePath();
      c.fillStyle = '#d42a2a'; c.fill(cloth);
      c.save(); c.clip(cloth);
      for (let x = 0; x < 34; x += 0.5) {
        const slope = Math.cos((x / 34) * Math.PI * 2 + f * 2.1);
        c.fillStyle = slope > 0 ? `rgba(255,255,255,${(slope * 0.18).toFixed(3)})` : `rgba(60,0,0,${(-slope * 0.28).toFixed(3)})`;
        c.fillRect(10 + x, 0, 0.6, 40);
      }
      // the crescent and star, riding the wave
      const dy = wave(14);
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(22, 19 + dy, 6, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#d42a2a'; c.beginPath(); c.arc(23.6, 19 + dy, 4.9, 0, Math.PI * 2); c.fill();
      const sy = 19 + wave(21);
      c.fillStyle = '#ffffff'; c.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? 1.45 : 3.5; c.lineTo(31 + Math.cos(a) * rr, sy + Math.sin(a) * rr); }
      c.fill();
      c.restore();
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    t.refresh();
    t.setFilter(Phaser.Textures.FilterMode.LINEAR);
    for (let f = 0; f < 3; f++) t.add(f, 0, f * 48 * ART_RES, 0, 48 * ART_RES, 96 * ART_RES);
  }
  canvas('raindrop', 2, 9, (c) => { c.fillStyle = 'rgba(190, 215, 240, 0.85)'; c.fillRect(0, 0, 2, 9); });
  canvas('puff', 6, 6, (c) => { c.fillStyle = 'rgba(214, 200, 176, 0.9)'; c.beginPath(); c.arc(3, 3, 3, 0, Math.PI * 2); c.fill(); });

  canvas('qmark', 18, 22, (c) => {
    c.fillStyle = '#f2c14e'; c.beginPath(); c.arc(9, 9, 9, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#3a2a10'; c.font = 'bold 14px monospace'; c.textAlign = 'center'; c.fillText('?', 9, 14);
    c.fillStyle = '#f2c14e'; c.beginPath(); c.moveTo(5, 16); c.lineTo(13, 16); c.lineTo(9, 22); c.fill();
  });
}

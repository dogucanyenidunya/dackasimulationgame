// Procedural pixel art. Placeholder until real art is commissioned; palette follows GDD §17
// (roof grey, façade white, wood fins, solar blue, plaza green, court red).
import Phaser from 'phaser';
import { T, TILE } from '../content/campus';

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

function rng(seed: number) {
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
    TILE_PAINTERS[T.GROUND](c, o);
    c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(o, 22, 32, 3);
    c.fillStyle = '#3d4246'; for (let x = 2; x < 32; x += 5) { c.fillRect(o + x, 4, 2, 18); c.fillRect(o + x, 2, 2, 2); }
    c.fillRect(o, 7, 32, 2); c.fillRect(o, 17, 32, 2);
    c.fillStyle = '#6b7176'; c.fillRect(o, 7, 32, 1);
  },
  [T.GATE]: (c, o) => {
    TILE_PAINTERS[T.PATH](c, o);
    c.fillStyle = '#8a2d2d'; c.fillRect(o, 0, 4, 32); c.fillRect(o + 28, 0, 4, 32);
    c.fillStyle = '#a94040'; c.fillRect(o, 0, 4, 3); c.fillRect(o + 28, 0, 4, 3);
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
  [T.COURTYARD]: (c, o) => {
    c.fillStyle = PAL.roofDark; c.fillRect(o, 0, 32, 32);
    c.fillStyle = '#8fb37a'; c.fillRect(o + 2, 2, 28, 28);
    c.fillStyle = '#79a067'; c.fillRect(o + 6, 6, 8, 8); c.fillRect(o + 18, 16, 8, 8);
    c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(o + 2, 2, 28, 3);
  },
};

export const TILESET_KEY = 'tiles';
/** tileset padding (see the extrusion in generateTextures) */
export const TILESET_MARGIN = 1;
export const TILESET_SPACING = 2;
export const FOG_KEY = 'fog';
export const FOG_FULL = 0;
export const FOG_SOFT = 1;

export interface CharacterLook {
  skin: string;
  hair: string;
  hairStyle: 0 | 1 | 2 | 3; // short, buzz, long, ponytail
  top: string;     // sweater
  bottom: string;  // trousers / skirt
  skirt: boolean;
  glasses?: boolean;
}

export const DEFAULT_LOOK: CharacterLook = {
  skin: '#e8b98f', hair: '#3b2a20', hairStyle: 0, top: '#22365c', bottom: '#5b6168', skirt: false,
};

export function generateTextures(scene: Phaser.Scene) {
  const count = 33;
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

  // tree (48x72): tall trunk and a layered canopy, so it stands up in the 3/4 view
  canvas('tree', 48, 72, (c) => {
    c.fillStyle = 'rgba(0,0,0,0.22)'; c.beginPath(); c.ellipse(27, 66, 17, 5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#5e4027'; c.fillRect(21, 36, 6, 30); c.fillStyle = '#7a5434'; c.fillRect(21, 36, 2, 30);
    c.fillStyle = '#4a321e'; c.fillRect(19, 63, 10, 3);
    const blob = (x: number, y: number, rad: number, col: string) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.fill(); };
    blob(24, 30, 19, '#2a6036'); blob(24, 27, 19, '#2f6b3b'); blob(16, 24, 13, '#3d7f47'); blob(32, 22, 12, '#3d7f47');
    blob(24, 15, 13, '#4a9152'); blob(18, 13, 6, '#67ad62'); blob(29, 10, 4, '#7cc070');
  });
  canvas('bench', 32, 18, (c) => {
    c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(2, 15, 28, 3);
    c.fillStyle = '#8a5a32'; c.fillRect(2, 3, 28, 4); c.fillRect(2, 9, 28, 3);
    c.fillStyle = '#a8703f'; c.fillRect(2, 3, 28, 1); c.fillRect(2, 9, 28, 1);
    c.fillStyle = '#3d4246'; c.fillRect(4, 12, 2, 5); c.fillRect(26, 12, 2, 5);
  });
  canvas('lamp', 16, 56, (c) => {
    c.fillStyle = 'rgba(0,0,0,0.2)'; c.beginPath(); c.ellipse(8, 53, 6, 2.5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#2f3438'; c.fillRect(7, 12, 3, 41); c.fillRect(4, 50, 9, 3);
    c.fillStyle = '#4a5156'; c.fillRect(7, 12, 1, 41);
    c.fillStyle = '#2f3438'; c.fillRect(3, 6, 11, 3); c.fillRect(5, 2, 7, 4);
    c.fillStyle = '#fff3c4'; c.fillRect(5, 9, 7, 4);
  });
  canvas('bush', 30, 20, (c) => {
    c.fillStyle = 'rgba(0,0,0,0.15)'; c.beginPath(); c.ellipse(15, 17, 13, 3, 0, 0, Math.PI * 2); c.fill();
    const blob = (x: number, y: number, rad: number, col: string) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.fill(); };
    blob(9, 11, 7, '#3f8048'); blob(20, 11, 8, '#3f8048'); blob(14, 8, 7, '#4f9455'); blob(12, 6, 3, '#6cb066');
  });
  canvas('flowers', 32, 22, (c) => {
    c.fillStyle = '#7a5434'; c.fillRect(1, 8, 30, 13); c.fillStyle = '#5e4027'; c.fillRect(1, 18, 30, 3);
    c.fillStyle = '#3f8048'; c.fillRect(3, 6, 26, 9);
    const fr = rng(5); const cols = ['#e4574a', '#f2c14e', '#f0f0f0', '#d78ad1'];
    for (let i = 0; i < 14; i++) { c.fillStyle = cols[i % 4]; c.fillRect(3 + Math.floor(fr() * 25), 4 + Math.floor(fr() * 9), 2, 2); }
  });
  canvas('tray', 16, 12, (c) => {
    c.fillStyle = '#8b9196'; c.fillRect(0, 2, 16, 10);
    c.fillStyle = '#c7cfd4'; c.fillRect(1, 3, 14, 8);
    c.fillStyle = '#e0b04a'; c.fillRect(3, 5, 4, 3); c.fillStyle = '#c0392b'; c.fillRect(9, 5, 4, 3);
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
  // central plaza fountain (2 frames of water) and the flagpole with a waving Turkish flag (3 frames)
  if (!scene.textures.exists('fountain')) {
    const t = scene.textures.createCanvas('fountain', 72 * 2, 56)!;
    const c = t.getContext();
    for (let f = 0; f < 2; f++) {
      const o = f * 72;
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.beginPath(); c.ellipse(o + 38, 48, 32, 7, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#b8b0a2'; c.beginPath(); c.ellipse(o + 36, 40, 32, 12, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#d6cfc2'; c.beginPath(); c.ellipse(o + 36, 37, 30, 10, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#4f9ad0'; c.beginPath(); c.ellipse(o + 36, 37, 25, 7, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#9fd0f0'; for (let i = 0; i < 6; i++) c.fillRect(o + 16 + ((i * 7 + f * 3) % 40), 34 + (i % 3) * 2, 4, 1);
      c.fillStyle = '#b8b0a2'; c.fillRect(o + 33, 14, 6, 22);
      c.fillStyle = '#d6cfc2'; c.beginPath(); c.ellipse(o + 36, 15, 10, 4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(159, 208, 240, 0.9)';
      const h = f ? 12 : 9;
      c.fillRect(o + 35, 15 - h, 2, h);
      c.fillRect(o + 28 - f, 17, 2, 14); c.fillRect(o + 42 + f, 17, 2, 14);
      c.fillStyle = '#ffffff'; c.fillRect(o + 35, 15 - h, 2, 2);
    }
    t.refresh();
    t.add(0, 0, 0, 0, 72, 56); t.add(1, 0, 72, 0, 72, 56);
  }
  if (!scene.textures.exists('flag')) {
    const t = scene.textures.createCanvas('flag', 48 * 3, 96)!;
    const c = t.getContext();
    for (let f = 0; f < 3; f++) {
      const o = f * 48;
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.beginPath(); c.ellipse(o + 9, 92, 7, 3, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#8b9196'; c.fillRect(o + 7, 6, 3, 86); c.fillStyle = '#c7cfd4'; c.fillRect(o + 7, 6, 1, 86);
      c.fillStyle = '#e0b04a'; c.fillRect(o + 6, 3, 5, 4);
      // waving red flag: columns shifted by a sine wave
      for (let x = 0; x < 34; x++) {
        const dy = Math.round(Math.sin((x / 34) * Math.PI * 2 + f * 2.1) * 2 * (x / 34));
        c.fillStyle = '#d42a2a'; c.fillRect(o + 10 + x, 8 + dy, 1, 22);
      }
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(o + 22, 19, 6, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#d42a2a'; c.beginPath(); c.arc(o + 24, 19, 5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffffff'; c.beginPath();
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5; c.lineTo(o + 31 + Math.cos(a) * 3.5, 19 + Math.sin(a) * 3.5); }
      c.fill();
    }
    t.refresh();
    for (let f = 0; f < 3; f++) t.add(f, 0, f * 48, 0, 48, 96);
  }
  canvas('raindrop', 2, 9, (c) => { c.fillStyle = 'rgba(190, 215, 240, 0.85)'; c.fillRect(0, 0, 2, 9); });
  canvas('puff', 6, 6, (c) => { c.fillStyle = 'rgba(214, 200, 176, 0.9)'; c.beginPath(); c.arc(3, 3, 3, 0, Math.PI * 2); c.fill(); });

  // seasonal particles
  canvas('leaf', 6, 4, (c) => { c.fillStyle = '#d9822b'; c.fillRect(0, 1, 6, 2); c.fillStyle = '#b5561e'; c.fillRect(1, 0, 3, 4); });
  canvas('snow', 4, 4, (c) => { c.fillStyle = '#ffffff'; c.fillRect(1, 0, 2, 4); c.fillRect(0, 1, 4, 2); });
  canvas('petal', 4, 3, (c) => { c.fillStyle = '#f4b6c8'; c.fillRect(0, 0, 4, 3); c.fillStyle = '#ffffff'; c.fillRect(1, 1, 1, 1); });
  canvas('qmark', 18, 22, (c) => {
    c.fillStyle = '#f2c14e'; c.beginPath(); c.arc(9, 9, 9, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#3a2a10'; c.font = 'bold 14px monospace'; c.textAlign = 'center'; c.fillText('?', 9, 14);
    c.fillStyle = '#f2c14e'; c.beginPath(); c.moveTo(5, 16); c.lineTo(13, 16); c.lineTo(9, 22); c.fill();
  });
}

/** Draws a 32x32 kid. dir: 0 down, 1 left, 2 right, 3 up. frame: 0 idle, 1/2 walking. */
export function drawCharacter(c: Ctx, ox: number, oy: number, look: CharacterLook, dir: number, frame: number) {
  const p = (x: number, y: number, w: number, h: number, col: string) => { c.fillStyle = col; c.fillRect(ox + x, oy + y, w, h); };
  const shoe = '#1f1f22';
  const shirt = '#f4f4f0';
  const bob = frame === 0 ? 0 : 1;
  p(9, 29, 14, 2, 'rgba(0,0,0,0.2)');

  // legs
  const legL = frame === 1 ? -1 : frame === 2 ? 1 : 0;
  if (look.skirt) {
    p(10, 20 - bob, 12, 5, look.bottom);
    p(11, 25 - bob, 3, 3 + (legL < 0 ? 1 : 0), look.skin); p(18, 25 - bob, 3, 3 + (legL > 0 ? 1 : 0), look.skin);
  } else {
    p(11, 21 - bob, 4, 6 + (legL < 0 ? 1 : 0), look.bottom); p(17, 21 - bob, 4, 6 + (legL > 0 ? 1 : 0), look.bottom);
  }
  p(10, 27 - bob + (legL < 0 ? 1 : 0), 5, 2, shoe); p(17, 27 - bob + (legL > 0 ? 1 : 0), 5, 2, shoe);

  // torso + arms
  p(9, 13 - bob, 14, 9, look.top);
  p(9, 20 - bob, 14, 2, 'rgba(0,0,0,0.18)'); p(10, 14 - bob, 1, 6, 'rgba(255,255,255,0.14)');
  if (dir === 0) { p(14, 13 - bob, 4, 3, shirt); p(15, 16 - bob, 2, 4, '#8a1f2b'); }
  const swing = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  if (dir === 0 || dir === 3) {
    p(7, 14 - bob + swing, 2, 7, look.top); p(23, 14 - bob - swing, 2, 7, look.top);
    p(7, 21 - bob + swing, 2, 2, look.skin); p(23, 21 - bob - swing, 2, 2, look.skin);
  } else {
    const ax = dir === 1 ? 14 + swing * 2 : 16 - swing * 2;
    p(ax, 14 - bob, 3, 7, look.top); p(ax, 21 - bob, 3, 2, look.skin);
  }

  // head
  p(10, 2 - bob, 12, 11, look.skin);
  // hair
  const h = look.hair;
  const style = look.hairStyle;
  if (style === 1) { p(10, 1 - bob, 12, 3, h); }
  else { p(9, 0 - bob, 14, 4, h); p(9, 4 - bob, 2, 3, h); p(21, 4 - bob, 2, 3, h); }
  if (dir === 3) { p(10, 2 - bob, 12, 8, h); if (style === 2) p(9, 8 - bob, 14, 7, h); if (style === 3) p(14, 9 - bob, 4, 7, h); }
  else if (style === 2) { p(8, 4 - bob, 3, 10, h); p(21, 4 - bob, 3, 10, h); }
  else if (style === 3) { const px = dir === 1 ? 21 : dir === 2 ? 8 : 22; p(px, 5 - bob, 3, 7, h); }
  if (dir !== 3) p(12, 1 - bob, 5, 1, 'rgba(255,255,255,0.22)');
  // face
  const eye = '#2a1d16';
  if (dir === 0) { p(13, 7 - bob, 2, 2, eye); p(18, 7 - bob, 2, 2, eye); p(15, 11 - bob, 3, 1, '#b5735a'); }
  if (dir === 1) { p(11, 7 - bob, 2, 2, eye); p(9, 6 - bob, 2, 5, look.skin); }
  if (dir === 2) { p(19, 7 - bob, 2, 2, eye); p(21, 6 - bob, 2, 5, look.skin); }
  if (look.glasses) {
    const fr = '#5a7896';
    const lens = 'rgba(214, 232, 245, 0.55)';
    if (dir === 0) {
      p(12, 6 - bob, 4, 4, fr); p(17, 6 - bob, 4, 4, fr); p(16, 7 - bob, 1, 1, fr);
      p(13, 7 - bob, 2, 2, lens); p(18, 7 - bob, 2, 2, lens);
    }
    if (dir === 1) { p(10, 6 - bob, 4, 4, fr); p(11, 7 - bob, 2, 2, lens); p(14, 7 - bob, 4, 1, fr); }
    if (dir === 2) { p(18, 6 - bob, 4, 4, fr); p(19, 7 - bob, 2, 2, lens); p(14, 7 - bob, 4, 1, fr); }
  }
}

/** Builds a 3x4 spritesheet texture for a character look (with a dark outline). Frame index = dir * 3 + frame. */
export function makeCharacterTexture(scene: Phaser.Scene, key: string, look: CharacterLook) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, 32 * 3, 32 * 4)!;
  const ctx = tex.getContext();
  const tmp = document.createElement('canvas');
  tmp.width = 32; tmp.height = 32;
  const t = tmp.getContext('2d')!;
  for (let dir = 0; dir < 4; dir++) for (let f = 0; f < 3; f++) {
    t.clearRect(0, 0, 32, 32);
    drawCharacter(t, 0, 0, look, dir, f);
    const img = t.getImageData(0, 0, 32, 32);
    const d = img.data;
    const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < 32 && y < 32 && d[(y * 32 + x) * 4 + 3] > 150;
    const out = new Uint8ClampedArray(d);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      if (solid(x, y)) continue;
      if (solid(x + 1, y) || solid(x - 1, y) || solid(x, y + 1) || solid(x, y - 1)) out.set([28, 30, 34, 220], (y * 32 + x) * 4);
    }
    ctx.putImageData(new ImageData(out, 32, 32), f * 32, dir * 32);
  }
  tex.refresh();
  for (let dir = 0; dir < 4; dir++) for (let f = 0; f < 3; f++) tex.add(dir * 3 + f, 0, f * 32, dir * 32, 32, 32);
  return tex;
}

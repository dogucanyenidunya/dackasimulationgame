// The wire fences round the courts on the south lawn: chain-link panels on steel posts, a rail along the top, and
// framed gateways where they open. Seen in the 3/4 view, an east–west run stands up as a see-through panel; a
// north–south run is seen edge-on, so it's drawn a tile at a time (each piece sorted by its own south end).
import Phaser from 'phaser';
import { TILE, cageLines, type Cage } from '../content/campus';

/** how tall the fence stands in the picture (px) */
export const FENCE_H = 30;
const POST = 0x5b6168, POST_LIT = 0x9aa1a7, MESH = 0xd5dce1, RAIL = 0x767d84;

export function drawFences(scene: Phaser.Scene, cages: Cage[]) {
  for (const cage of cages) {
    for (const [x0, y0, x1, y1] of cageLines(cage)) {
      if (y0 === y1) drawRun(scene, x0 * TILE, x1 * TILE, y0 * TILE);
      else for (let ty = y0; ty < y1; ty++) drawSide(scene, x0 * TILE, ty * TILE, Math.min(ty + 1, y1) * TILE, ty === y0);
    }
    for (const g of cage.gates) drawGate(scene, cage, g);
  }
}

/** an east–west run: posts every tile, chain-link between them, rails at the top and bottom, its shadow on the grass */
function drawRun(scene: Phaser.Scene, ax: number, bx: number, y: number) {
  const g = scene.add.graphics().setDepth(y);
  const top = y - FENCE_H;
  g.fillStyle(0x000000, 0.13); g.fillRect(ax + 3, y + 1, bx - ax, 3);
  // chain-link: two sets of diagonals, faint, so the court shows through
  g.lineStyle(1, MESH, 0.42);
  for (let x = ax - FENCE_H; x < bx; x += 5) {
    g.lineBetween(Math.max(ax, x), top + Math.max(0, ax - x), Math.min(bx, x + FENCE_H), top + Math.min(FENCE_H, bx - x));
    g.lineBetween(Math.max(ax, x), y - Math.max(0, ax - x), Math.min(bx, x + FENCE_H), y - Math.min(FENCE_H, bx - x));
  }
  g.fillStyle(RAIL, 1); g.fillRect(ax, top, bx - ax, 2); g.fillRect(ax, y - 3, bx - ax, 1);
  for (let x = ax; x <= bx; x += TILE) post(g, Math.min(x, bx - 1), y, FENCE_H);
}

/** one tile of a north–south run, seen edge-on: a narrow strip of mesh with its top rail, and a post at each end */
function drawSide(scene: Phaser.Scene, x: number, ya: number, yb: number, first: boolean) {
  const g = scene.add.graphics().setDepth(yb);
  g.fillStyle(0x000000, 0.13); g.fillRect(x + 2, ya + 3, 3, yb - ya);
  // the mesh, from the top rail down to the ground, seen side-on; a few wire glints across it
  g.fillStyle(MESH, 0.26); g.fillRect(x - 1, ya - FENCE_H, 3, FENCE_H + (yb - ya));
  g.fillStyle(MESH, 0.55); for (let yy = ya - FENCE_H + 3; yy < yb; yy += 6) g.fillRect(x - 1, yy, 3, 1);
  g.fillStyle(RAIL, 1); g.fillRect(x - 1, ya - FENCE_H, 2, yb - ya);
  if (first) post(g, x, ya, FENCE_H);
  post(g, x, yb, FENCE_H);
}

/** a steel post standing at (x, y), with a lit west side and a cap */
function post(g: Phaser.GameObjects.Graphics, x: number, y: number, h: number) {
  g.fillStyle(POST, 1); g.fillRect(x - 1, y - h - 2, 3, h + 2);
  g.fillStyle(POST_LIT, 1); g.fillRect(x - 1, y - h - 2, 1, h + 2);
  g.fillStyle(0x3d4247, 1); g.fillRect(x - 2, y - h - 3, 5, 2);
}

/** a gateway: taller posts either side and a crossbar over the opening */
function drawGate(scene: Phaser.Scene, cage: Cage, gate: Cage['gates'][number]) {
  const { x, y, w, h } = cage.rect, H = FENCE_H + 6;
  if (gate.side === 'n' || gate.side === 's') {
    const gy = (gate.side === 'n' ? y : y + h) * TILE, ax = gate.from * TILE, bx = gate.to * TILE;
    const g = scene.add.graphics().setDepth(gy + 0.5);
    g.fillStyle(RAIL, 1); g.fillRect(ax, gy - H, bx - ax, 3);
    g.fillStyle(POST_LIT, 1); g.fillRect(ax, gy - H, bx - ax, 1);
    post(g, ax, gy, H); post(g, bx, gy, H);
  } else {
    const gx = (gate.side === 'w' ? x : x + w) * TILE, ay = gate.from * TILE, by = gate.to * TILE;
    const ga = scene.add.graphics().setDepth(ay + 0.5), gb = scene.add.graphics().setDepth(by + 0.5);
    post(ga, gx, ay, H); post(gb, gx, by, H);
    const bar = scene.add.graphics().setDepth(by + 0.4);
    bar.fillStyle(RAIL, 1); bar.fillRect(gx - 1, ay - H, 3, by - ay);
  }
}

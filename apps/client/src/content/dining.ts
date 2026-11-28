// The dining hall (Yemekhane) as a walkable room: serving counter, long tables and sinks.
import { RT } from './dormroom';
import { CLASS_OX, CLASS_W } from './classroom';

export const DINING_W = 27;
export const DINING_H = 17;
export const DINING_OX = CLASS_OX + CLASS_W + 80;

/** extra interior tiles */
export const DT = { COUNTER: 29, TABLE: 30, SINK: 31, KANTIN: 32 } as const;
export const DINING_SOLID = [DT.COUNTER, DT.TABLE, DT.SINK, DT.KANTIN];

/** long tables: [x, y, length]: two full rows of three, and a third row either side of the aisle to the door */
export const TABLES: Array<[number, number, number]> = [
  [3, 6, 5], [11, 6, 5], [19, 6, 5],
  [3, 10, 5], [11, 10, 5], [19, 10, 5],
  [3, 13, 5], [19, 13, 5],
];
/** seats: the tiles just above and below every table tile; `faces` is the sprite direction (0 down, 3 up) */
export const SEATS: Array<{ x: number; y: number; faces: 0 | 3 }> = [];
for (const [tx, ty, len] of TABLES) for (let x = tx; x < tx + len; x++) { SEATS.push({ x, y: ty - 1, faces: 0 }); SEATS.push({ x, y: ty + 1, faces: 3 }); }
export const COUNTER_TILES: Array<[number, number]> = [];
for (let x = 7; x <= 19; x++) COUNTER_TILES.push([x, 3]);
export const SINKS: Array<[number, number]> = [[1, 9], [1, 10]];
export const DINING_EXIT: Array<[number, number]> = [[13, 16], [14, 16]];
export const DINING_SPAWN: [number, number] = [13.9, 15.2];
export const COOKS: Array<[number, number]> = [[9, 2.4], [13.5, 2.4], [18, 2.4]];

export function buildDining(): number[][] {
  const m: number[][] = [];
  for (let y = 0; y < DINING_H; y++) {
    const row: number[] = [];
    for (let x = 0; x < DINING_W; x++) {
      const edge = x === 0 || x === DINING_W - 1 || y === DINING_H - 1;
      row.push(y === 0 ? RT.WALL : y === 1 ? RT.WALL_BASE : edge ? RT.WALL : RT.FLOOR);
    }
    m.push(row);
  }
  const set = (x: number, y: number, t: number) => { m[y][x] = t; };
  for (let x = 11; x <= 15; x++) { set(x, 0, RT.BOARD); set(x, 1, RT.BOARD); } // menu board
  for (const x of [2, 3, 7, 19, 23, 24]) set(x, 0, RT.WINDOW);
  for (const [x, y] of COUNTER_TILES) set(x, y, DT.COUNTER);
  for (const [tx, ty, len] of TABLES) for (let x = tx; x < tx + len; x++) set(x, ty, DT.TABLE);
  for (const [x, y] of SINKS) set(x, y, DT.SINK);
  for (const [x, y] of DINING_EXIT) set(x, y, RT.DOOR);
  return m;
}


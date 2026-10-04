// The dining hall (Yemekhane) as a walkable room: serving counter, long tables, sinks and the canteen.
import { RT } from './dormroom';
import { CLASS_OX, CLASS_W } from './classroom';

export const DINING_W = 22;
export const DINING_H = 14;
export const DINING_OX = CLASS_OX + CLASS_W + 80;

/** extra interior tiles */
export const DT = { COUNTER: 29, TABLE: 30, SINK: 31, KANTIN: 32 } as const;
export const DINING_SOLID = [DT.COUNTER, DT.TABLE, DT.SINK, DT.KANTIN];

/** long tables: [x, y, length] */
export const TABLES: Array<[number, number, number]> = [[3, 6, 4], [9, 6, 4], [15, 6, 4], [3, 10, 4], [9, 10, 4], [15, 10, 4]];
/** seats: the tiles just above and below every table tile; `faces` is the sprite direction (0 down, 3 up) */
export const SEATS: Array<{ x: number; y: number; faces: 0 | 3 }> = [];
for (const [tx, ty, len] of TABLES) for (let x = tx; x < tx + len; x++) { SEATS.push({ x, y: ty - 1, faces: 0 }); SEATS.push({ x, y: ty + 1, faces: 3 }); }
export const COUNTER_TILES: Array<[number, number]> = [];
for (let x = 6; x <= 15; x++) COUNTER_TILES.push([x, 3]);
export const SINKS: Array<[number, number]> = [[1, 9], [1, 10]];
export const KANTIN_TILES: Array<[number, number]> = [[18, 12], [19, 12], [20, 12]];
export const DINING_EXIT: Array<[number, number]> = [[10, 13], [11, 13]];
export const DINING_SPAWN: [number, number] = [10.9, 12.2];
export const COOKS: Array<[number, number]> = [[8, 2.4], [13, 2.4]];

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
  for (let x = 9; x <= 12; x++) { set(x, 0, RT.BOARD); set(x, 1, RT.BOARD); } // menu board
  for (const x of [2, 3, 6, 15, 18, 19]) set(x, 0, RT.WINDOW);
  for (const [x, y] of COUNTER_TILES) set(x, y, DT.COUNTER);
  for (const [tx, ty, len] of TABLES) for (let x = tx; x < tx + len; x++) set(x, ty, DT.TABLE);
  for (const [x, y] of SINKS) set(x, y, DT.SINK);
  for (const [x, y] of KANTIN_TILES) set(x, y, DT.KANTIN);
  for (const [x, y] of DINING_EXIT) set(x, y, RT.DOOR);
  return m;
}

// The inside of your dorm: a study room (etüt) with tables for four, and the sleeping room: two bays of six
// bunk beds side by side, with a folding screen between them. It lives in the same world as the campus,
// placed to the right of the campus map.
import { MAP_W, T } from './campus';

export const ROOM_W = 34;
export const ROOM_H = 14;
/** world-tile offset of the room (to the right of the campus map) */
export const ROOM_OX = MAP_W + 80; // far from the campus so a centred room never shows anything else

/** interior tile ids continue after the campus tiles (36+ come after the campus's own 33–35) */
export const RT = {
  FLOOR: 17, WALL: 18, WALL_BASE: 19, BOARD: 20, WINDOW: 21, DESK: 22, RUG: 23, BED: 24, LOCKER: 25, SHELF: 26, DOOR: 27, TV: 28,
  TABLE_L: 36, TABLE_R: 37, SCREEN: 38,
} as const;
export const ROOM_SOLID = [RT.WALL, RT.WALL_BASE, RT.BOARD, RT.WINDOW, RT.DESK, RT.BED, RT.LOCKER, RT.SHELF, RT.DOOR, RT.TV, RT.TABLE_L, RT.TABLE_R, RT.SCREEN];
export const TILE_COUNT = 39;

/** study tables (room tiles of their left half): each is two tiles wide, two chairs on either long side */
export const TABLES: Array<[number, number]> = [];
for (const y of [5, 9]) for (const x of [2, 7, 12]) TABLES.push([x, y]);
/** a chair at a study table: the tile you sit on, and which way you face (up = the chair is below the table) */
export interface Seat { x: number; y: number; face: 'up' | 'down' }
/** your place: the right-hand chair on the near side of the middle table by the door */
export const MY_DESK: [number, number] = [8, 9];
/** every chair, nearest to yours first (your classmates fill the ones around you) */
export const SEATS: Seat[] = TABLES.flatMap(([x, y]) => [x, x + 1].flatMap((sx) => [{ x: sx, y: y + 1, face: 'up' as const }, { x: sx, y: y - 1, face: 'down' as const }]))
  .filter((s) => !(s.x === MY_DESK[0] && s.y === MY_DESK[1] + 1))
  .sort((a, b) => Math.hypot(a.x - MY_DESK[0], a.y - MY_DESK[1] - 1) - Math.hypot(b.x - MY_DESK[0], b.y - MY_DESK[1] - 1));

/** the folding screen between the two bays (room tile x); it stops short of the lockers so you can walk round it */
export const SCREEN_X = 26;
export const SCREEN_Y: [number, number] = [2, 10];
/** two bays of six: three rows of two in each, yours (west) nearest the study room */
export const BEDS: Array<[number, number]> = [];
for (const bx of [20, 28]) for (const y of [3, 6, 9]) for (const x of [bx, bx + 3]) BEDS.push([x, y]);
export const MY_BED: [number, number] = [20, 3];
export const MY_LOCKER: [number, number] = [20, 12];
export const TV_SPOT: [number, number] = [2, 12];
export const EXIT: Array<[number, number]> = [[8, 13], [9, 13]];
/** where you appear when you come in */
export const ROOM_SPAWN: [number, number] = [8.9, 12.2];
/** the duty teacher walks the aisles between the tables, then up and down both bays (every leg is a straight, clear line) */
export const BELLETMEN_ROUTE: Array<[number, number]> = [
  [10.5, 3.2], [10.5, 11.5], [5.5, 11.5], [5.5, 3.2], [15.5, 3.2], [15.5, 7.5], [21.9, 7.5], [21.9, 11.3],
  [29.9, 11.3], [29.9, 3.4], [29.9, 11.3], [21.9, 11.3], [21.9, 7.5], [15.5, 7.5], [15.5, 3.2],
];

export function buildRoom(): number[][] {
  const m: number[][] = [];
  for (let y = 0; y < ROOM_H; y++) {
    const row: number[] = [];
    for (let x = 0; x < ROOM_W; x++) {
      const edge = x === 0 || x === ROOM_W - 1 || y === ROOM_H - 1;
      row.push(y === 0 ? RT.WALL : y === 1 ? RT.WALL_BASE : edge ? RT.WALL : RT.FLOOR);
    }
    m.push(row);
  }
  const set = (x: number, y: number, t: number) => { m[y][x] = t; };
  // front wall: blackboard and windows
  for (let x = 7; x <= 12; x++) { set(x, 0, RT.BOARD); set(x, 1, RT.BOARD); }
  for (const x of [2, 3, 15, 16, 21, 22, 29, 30]) set(x, 0, RT.WINDOW);
  // partition between study room and the sleeping room, with an opening
  for (let y = 2; y < ROOM_H - 1; y++) if (y !== 6 && y !== 7) set(18, y, RT.WALL);
  // teacher's desk + the study tables
  set(9, 2, RT.DESK); set(10, 2, RT.DESK);
  for (const [x, y] of TABLES) { set(x, y, RT.TABLE_L); set(x + 1, y, RT.TABLE_R); }
  // bookshelf, TV corner and rug
  set(1, 2, RT.SHELF); set(1, 3, RT.SHELF); set(17, 2, RT.SHELF);
  for (let x = 1; x <= 4; x++) for (let y = 11; y <= 12; y++) set(x, y, RT.RUG);
  set(TV_SPOT[0], TV_SPOT[1], RT.TV);
  // sleeping room: two bays, a folding screen between them, lockers along the back
  for (const [x, y] of BEDS) set(x, y, RT.BED);
  for (let y = SCREEN_Y[0]; y <= SCREEN_Y[1]; y++) set(SCREEN_X, y, RT.SCREEN);
  for (let x = 19; x <= ROOM_W - 2; x++) set(x, 12, RT.LOCKER);
  for (const [x, y] of EXIT) set(x, y, RT.DOOR);
  void T;
  return m;
}

/** the payphone on the back wall (room tile x; you use it from the floor below) */
export const PHONE_SPOT: [number, number] = [5, 1];
/** Cemil Emmi's spot inside the boys' dorm (room tiles) */
export const CEMIL_IN: [number, number] = [13.5, 12.2];

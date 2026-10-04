// The inside of your dorm: a study room (etüt, classroom-style) and the sleeping room with bunk beds.
// It lives in the same world as the campus, placed to the right of the campus map.
import { MAP_W, T } from './campus';

export const ROOM_W = 26;
export const ROOM_H = 14;
/** world-tile offset of the room (to the right of the campus map) */
export const ROOM_OX = MAP_W + 80; // far from the campus so a centred room never shows anything else

/** interior tile ids continue after the campus tiles */
export const RT = {
  FLOOR: 17, WALL: 18, WALL_BASE: 19, BOARD: 20, WINDOW: 21, DESK: 22, RUG: 23, BED: 24, LOCKER: 25, SHELF: 26, DOOR: 27, TV: 28,
} as const;
export const ROOM_SOLID = [RT.WALL, RT.WALL_BASE, RT.BOARD, RT.WINDOW, RT.DESK, RT.BED, RT.LOCKER, RT.SHELF, RT.DOOR, RT.TV];
export const TILE_COUNT = 29;

/** desks in the study room (room tiles); the seat is the tile just below each desk */
export const DESKS: Array<[number, number]> = [];
for (const y of [4, 7, 10]) for (const x of [3, 5, 7, 11, 13, 15]) DESKS.push([x, y]);
/** your desk (front of the door) */
export const MY_DESK: [number, number] = [11, 10];
export const BEDS: Array<[number, number]> = [[20, 3], [23, 3], [20, 6], [23, 6], [20, 9], [23, 9]];
export const MY_BED: [number, number] = [20, 3];
export const MY_LOCKER: [number, number] = [20, 12];
export const TV_SPOT: [number, number] = [2, 12];
export const EXIT: Array<[number, number]> = [[8, 13], [9, 13]];
/** where you appear when you come in */
export const ROOM_SPAWN: [number, number] = [8.9, 12.2];
/** the duty teacher walks these aisles */
export const BELLETMEN_ROUTE: Array<[number, number]> = [[9.5, 3.2], [9.5, 11.5], [2, 11.5], [2, 3.2], [17, 3.2], [17, 11.5]];

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
  for (const x of [2, 3, 15, 16, 21, 22]) set(x, 0, RT.WINDOW);
  // partition between study room and the sleeping room, with an opening
  for (let y = 2; y < ROOM_H - 1; y++) if (y !== 6 && y !== 7) set(18, y, RT.WALL);
  // teacher's desk + student desks
  set(9, 2, RT.DESK); set(10, 2, RT.DESK);
  for (const [x, y] of DESKS) set(x, y, RT.DESK);
  // bookshelf, TV corner and rug
  set(1, 2, RT.SHELF); set(1, 3, RT.SHELF); set(17, 2, RT.SHELF);
  for (let x = 1; x <= 4; x++) for (let y = 11; y <= 12; y++) set(x, y, RT.RUG);
  set(TV_SPOT[0], TV_SPOT[1], RT.TV);
  // sleeping room
  for (const [x, y] of BEDS) set(x, y, RT.BED);
  for (let x = 19; x <= 24; x++) set(x, 12, RT.LOCKER);
  for (const [x, y] of EXIT) set(x, y, RT.DOOR);
  void T;
  return m;
}

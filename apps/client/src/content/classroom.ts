// Your classroom in the Eğitim Binası (walkable). Placed in the world to the right of the dorm room.
import { ROOM_OX, ROOM_W, RT } from './dormroom';
import type { SubjectId } from '../game/state';
import type { CharacterLook } from '../art/textures';

export const CLASS_W = 18;
export const CLASS_H = 13;
export const CLASS_OX = ROOM_OX + ROOM_W + 80;

export const CLASS_DESKS: Array<[number, number]> = [];
for (const y of [5, 7, 9]) for (const x of [3, 5, 7, 10, 12, 14]) CLASS_DESKS.push([x, y]);
export const MY_CLASS_DESK: [number, number] = [10, 9];
export const CLASS_EXIT: Array<[number, number]> = [[8, 12], [9, 12]];
export const CLASS_SPAWN: [number, number] = [8.9, 11.2];
/** the teacher paces in front of the blackboard */
export const TEACHER_ROUTE: Array<[number, number]> = [[5, 3.2], [12.5, 3.2]];

export function buildClassroom(): number[][] {
  const m: number[][] = [];
  for (let y = 0; y < CLASS_H; y++) {
    const row: number[] = [];
    for (let x = 0; x < CLASS_W; x++) {
      const edge = x === 0 || x === CLASS_W - 1 || y === CLASS_H - 1;
      row.push(y === 0 ? RT.WALL : y === 1 ? RT.WALL_BASE : edge ? RT.WALL : RT.FLOOR);
    }
    m.push(row);
  }
  const set = (x: number, y: number, t: number) => { m[y][x] = t; };
  for (let x = 6; x <= 11; x++) { set(x, 0, RT.BOARD); set(x, 1, RT.BOARD); }
  for (const x of [2, 3, 14, 15]) set(x, 0, RT.WINDOW);
  set(14, 3, RT.DESK); set(15, 3, RT.DESK); // teacher's desk
  set(1, 2, RT.SHELF); set(16, 2, RT.SHELF); set(1, 10, RT.SHELF);
  for (const [x, y] of CLASS_DESKS) set(x, y, RT.DESK);
  for (const [x, y] of CLASS_EXIT) set(x, y, RT.DOOR);
  return m;
}

export const TEACHERS: Record<SubjectId, { name: string; look: Partial<CharacterLook> }> = {
  turkce: { name: 'Ayten Hanım', look: { skin: '#e8b98f', hair: '#5e3b22', hairStyle: 3, skirt: true, top: '#7a4a5a', bottom: '#3a3a3a', glasses: true } },
  matematik: { name: 'Ahmet Bey', look: { skin: '#d9a77d', hair: '#3b2a20', hairStyle: 1, skirt: false, top: '#4a5560', bottom: '#2d3238' } },
  fen: { name: 'Murat Bey', look: { skin: '#c68e63', hair: '#120c09', hairStyle: 0, skirt: false, top: '#f4f4f0', bottom: '#2d3238', glasses: true } },
  sosyal: { name: 'Leyla Hanım', look: { skin: '#f1c9a5', hair: '#2b1d14', hairStyle: 2, skirt: true, top: '#2f5d6b', bottom: '#3a3a3a' } },
  ingilizce: { name: 'Elif Hanım', look: { skin: '#f6d7bd', hair: '#a8682e', hairStyle: 3, skirt: true, top: '#6b5a2f', bottom: '#3a3a3a' } },
};

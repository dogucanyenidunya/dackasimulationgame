// Daçka campus layout in tiles (layout v7, from the annotated satellite map; north is up).
// West: Erkek Yurdu (top, with the basketball court and the Kapalı Saha on the lawn east of it) and Kız Yurdu + Revir (bottom) facing each other across the
// Yurt Meydanı; Eğitim Binası + Kütüphane (one building, the library in its long east wing). South-west: the
// TIM Gösteri Merkezi (round) in its own walled yard, reached only from the street through its own gate.
// Middle: Yemekhane (Teknik Alan behind it, on Ayaz Cd) and the Merkez Meydan, with the pyramid in its centre
// and the Atatürk bust in its south-east corner. The Meydan is a terrace some 20 m above the Spor Salonu side:
// a covered stairway/tunnel, a sloping road and an open flight of steps lead down from it. East: Spor Salonu (canteen and stores inside, the grandstand
// along its east wall) and the football pitch. South: Cemiyet + Müze, a small court and the basketball court;
// Ana Kapı opens onto Darüşşafaka Cd. Buildings have true outlines (polygons and circles) instead of tile rectangles.

import type { Text } from '../i18n';

export const TILE = 32;
export const MAP_W = 96;
export const MAP_H = 56;
/** bump when buildings move: old saves get their fog and position reset */
export const LAYOUT = 7;

export const T = {
  FOREST: 0,
  GROUND: 1,
  PATH: 2,
  PLAZA: 3,
  ROOF: 4,
  SKYLIGHT: 5,
  SOLAR: 6,
  GREEN_ROOF: 7,
  WALL: 8,
  DOOR: 9,
  COURT_RED: 10,
  COURT_BLUE: 11,
  FENCE: 12,
  GATE: 13,
  COURTYARD: 14,
  DOOR_REVIR: 15,
  WALL_BASE: 16,
  // 17–32 are the interiors' tiles (dorm room, dining hall)
  ROAD: 33,
  HOUSES: 34,
  CAMPUS_WALL: 35,
} as const;

/** tiles nobody can stand on (buildings included: NPC routes and spawn spots avoid them) */
export const SOLID_TILES = [T.FOREST, T.ROOF, T.SKYLIGHT, T.SOLAR, T.GREEN_ROOF, T.WALL, T.DOOR, T.FENCE, T.COURTYARD, T.DOOR_REVIR, T.WALL_BASE, T.ROAD, T.HOUSES, T.CAMPUS_WALL];
/** tiles the physics tile layer blocks; buildings collide through their real outlines instead */
export const BLOCK_TILES = [T.FOREST, T.FENCE, T.ROAD, T.HOUSES, T.CAMPUS_WALL];

export interface Rect { x: number; y: number; w: number; h: number }
/** a point in tiles (fractions allowed) */
export type Pt = [number, number];

/** `span`: how many tiles wide the entrance looks (doors on slanted walls are a single tile) */
export interface Door { x: number; y: number; side: 'n' | 's' | 'e' | 'w'; kind?: 'revir'; span?: number }

/** room: discovered from inside its parent building's menu */
export type LocationKind = 'building' | 'zone' | 'room';

export interface Location {
  id: string;
  kind: LocationKind;
  name: Text;
  /** short English/Turkish subtitle shown under the name */
  sub: Text;
  info: Text;
  /** area used for "seen" distance checks and label placement */
  rect: Rect;
  /** buildings are discovered by interacting at a door */
  doors?: Door[];
  /** area whose fog clears on discovery (defaults to rect) */
  revealRect?: Rect;
  /** label anchor in tiles (defaults to rect centre) */
  label?: { x: number; y: number };
  minimapColor: string;
}

export interface Building {
  id: string;
  /** footprint outline, clockwise on screen */
  shape: Pt[];
  /** bounding box of the outline */
  rect: Rect;
  roof: 'grey' | 'green' | 'white' | 'tarp';
  /** flat with a parapet, a dome (round halls), a barrel vault (the sports hall) or an inflated tarp (the balloon court) */
  roofStyle?: 'flat' | 'dome' | 'vault' | 'balloon';
  /** open-air yard cut out of the footprint */
  courtyard?: Pt[];
  solar?: Rect[];
  greenPatches?: Rect[];
  skylights?: Rect[];
  /** covered corridors you can walk straight through (they run east–west, out past both walls) */
  passages?: Rect[];
}

// ---------- geometry ----------

export function rectPts(r: Rect): Pt[] {
  return [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
}

/** a rectangle with its corners rounded off (radius `rad`, `n` points per corner) */
export function roundRectPts(r: Rect, rad: number, n = 5): Pt[] {
  const out: Pt[] = [];
  const corners: Array<[number, number, number]> = [[r.x + r.w - rad, r.y + rad, -Math.PI / 2], [r.x + r.w - rad, r.y + r.h - rad, 0], [r.x + rad, r.y + r.h - rad, Math.PI / 2], [r.x + rad, r.y + rad, Math.PI]];
  for (const [cx, cy, a0] of corners) for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * (Math.PI / 2); out.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]); }
  return out;
}

export function circlePts(cx: number, cy: number, r: number, n = 32): Pt[] {
  return Array.from({ length: n }, (_, i) => { const a = -Math.PI / 2 + (i / n) * Math.PI * 2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as Pt; });
}

/** twice the signed area; positive = clockwise on screen (y points down) */
function area2(p: Pt[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) { const [x0, y0] = p[i], [x1, y1] = p[(i + 1) % p.length]; s += x0 * y1 - x1 * y0; }
  return s;
}

/** the same outline, clockwise on screen (so an edge's outward normal is (dy, -dx)) */
export function clockwise(p: Pt[]): Pt[] {
  return area2(p) >= 0 ? p : [...p].reverse();
}

export function bounds(p: Pt[]): Rect {
  const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function inPoly(x: number, y: number, p: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** nearest point on the outline, with the outward normal of that edge and the distance to it */
export function nearestEdge(x: number, y: number, p: Pt[]): { x: number; y: number; nx: number; ny: number; d: number; i: number } {
  let best = { x: 0, y: 0, nx: 0, ny: 0, d: Infinity, i: 0 };
  for (let i = 0; i < p.length; i++) {
    const [ax, ay] = p[i], [bx, by] = p[(i + 1) % p.length];
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
    const qx = ax + dx * t, qy = ay + dy * t, d = Math.hypot(x - qx, y - qy);
    if (d < best.d) { const l = Math.sqrt(len2); best = { x: qx, y: qy, nx: dy / l, ny: -dx / l, d, i }; }
  }
  return best;
}

/** is this door inside a corridor (its stand tile is in one)? Such doors aren't drawn on the outside walls */
export function doorInPassage(d: Door, b: Building): boolean {
  const s = doorStandTile(d);
  return !!passageAt(s.x + 0.5, s.y + 0.5, b);
}

/** the corridor through a building that (x, y) lies in, if any */
export function passageAt(x: number, y: number, b: Building): Rect | undefined {
  return b.passages?.find((p) => x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h);
}

/** a point is inside a building when it's inside the outline but not in its open courtyard */
export function inBuilding(x: number, y: number, b: Building): boolean {
  return inPoly(x, y, b.shape) && !(b.courtyard && inPoly(x, y, b.courtyard));
}

const bld = (b: Omit<Building, 'rect'>): Building => ({ ...b, shape: clockwise(b.shape), courtyard: b.courtyard && clockwise(b.courtyard), rect: bounds(b.shape) });

// ---------- the campus ----------

/** the walkable campus inside the fence (the fence runs just outside it) */
export const GROUND_SHAPE: Pt[] = [[4, 4], [30, 4], [39, 13], [92, 13], [92, 52], [30, 52], [4, 39]];
/** outside the fence: Ayaz Cd along the north, Darüşşafaka Cd along the south-west and south */
const ROADS: Pt[][] = [
  [[33, 9], [96, 9], [96, 12.5], [36.5, 12.5]],
  [[0, 37.6], [30, 52.6], [96, 52.6], [96, 56], [0, 56]],
];
/** the neighbourhood north of Ayaz Cd */
const HOUSES: Pt[] = [[30, 0], [96, 0], [96, 9], [33, 9], [30, 5]];

/** the TIM Gösteri Merkezi: a round hall in its own walled yard in the south-west corner */
const TIM_C: Pt = [27, 41.5];
const TIM_R = 5.2;

export const BUILDINGS: Building[] = [
  bld({
    id: 'erkek_yurdu', shape: [[8, 8.5], [12.5, 5.5], [24, 5.5], [26.3, 5.8], [27.8, 6.6], [28.4, 7.6], [28.5, 9], [28.5, 17.2], [8, 21.5]], roof: 'grey',
    courtyard: [[11, 8.5], [25.5, 8.5], [25.5, 14.8], [11, 17.8]],
  }),
  bld({ id: 'kiz_yurdu', shape: [[7, 25.5], [18.5, 31], [14.5, 40], [5.5, 35.5]], roof: 'grey', courtyard: circlePts(11.2, 34, 1.7, 14) }),
  bld({ id: 'tim', shape: circlePts(TIM_C[0], TIM_C[1], TIM_R, 32), roof: 'white', roofStyle: 'dome' }),
  bld({
    id: 'egitim', shape: [[26.5, 23.5], [28.5, 19.5], [39, 21.5], [39, 44], [36, 44], [35.5, 34], [34, 27.5]], roof: 'grey',
    skylights: [{ x: 30, y: 21.6, w: 6, h: 1 }, { x: 36.5, y: 29, w: 1, h: 6.5 }],
    // the only way between the dorm side and the Merkez Meydan: a tunnel through the building, from the
    // wall facing TIM to the main street. The Kütüphane opens off its north side, the classrooms off its south.
    passages: [{ x: 29, y: 25, w: 11, h: 2 }],
  }),
  bld({ id: 'yemekhane', shape: rectPts({ x: 41.5, y: 14, w: 13.5, h: 9 }), roof: 'white', solar: [{ x: 43, y: 15.3, w: 10.5, h: 2.5 }], greenPatches: [{ x: 43, y: 18.8, w: 10.5, h: 2 }] }),
  bld({ id: 'spor', shape: [[58, 16.5], [59.5, 15], [68.5, 15], [70, 16.5], [70, 39.5], [58, 39.5]], roof: 'white', roofStyle: 'vault' }),
  bld({ id: 'cemiyet', shape: rectPts({ x: 42, y: 40, w: 14, h: 9 }), roof: 'grey', courtyard: rectPts({ x: 45, y: 42, w: 5, h: 2 }) }),
  // the indoor court between the boys' dorm and Eğitim, against the garden wall: a balloon court, an air-filled dome of green tarp
  bld({ id: 'kapali_saha', shape: roundRectPts({ x: 30, y: 14.8, w: 8, h: 3.8 }, 1.1), roof: 'tarp', roofStyle: 'balloon' }),
];

export const PLAZAS: Pt[][] = [
  [[8.5, 22.6], [27.6, 18.7], [26.5, 22.8], [20, 29.5], [8.5, 24.8]], // Yurt Meydanı, between the dorms
  rectPts({ x: 41, y: 24, w: 13, h: 14 }),                            // Merkez Meydan (the terrace)
];

export const PATHS: Rect[] = [
  { x: 39, y: 13, w: 2, h: 39 },   // the main street: Ana Kapı → north, between Eğitim and the Meydan
  { x: 41, y: 38, w: 1, h: 14 },   // …a tile wider between Eğitim and the Cemiyet, up the stairs and under the aqueduct
  { x: 41, y: 13, w: 51, h: 1 },   // service road behind the Yemekhane (Teknik Alan door)
  { x: 41, y: 23, w: 14, h: 1 },   // in front of the Yemekhane
  { x: 55, y: 14, w: 3, h: 26 },   // the low street between the Meydan's terrace and the Spor Salonu
  { x: 54, y: 23, w: 1, h: 8 },    // the road sloping down the terrace's east side (see MEYDAN_RAMP)…
  { x: 54, y: 31, w: 1, h: 7 },    // …and below its foot, the street under the terrace wall
  { x: 73, y: 14, w: 2, h: 26 },   // between the grandstand and the football pitch
  { x: 70, y: 27, w: 3, h: 2 },    // the way through the grandstand to the Spor Salonu's pitch-side door
  { x: 41, y: 38, w: 51, h: 2 },   // the south street, to the courts
  { x: 56, y: 40, w: 16, h: 1 },   // the wide stretch of the south street
  { x: 41, y: 49, w: 17, h: 2 },   // behind the Cemiyet
  { x: 29, y: 26, w: 4, h: 4 },    // the corridor's west mouth ↔ Yurt Meydanı
  { x: 26, y: 47, w: 2, h: 2 },    // TIM door…
  { x: 26, y: 48, w: 8, h: 2 },    // …across its yard…
  { x: 31, y: 48, w: 3, h: 4 },    // …to its own gate
  { x: 30, y: 53, w: 13, h: 1 },   // the pavement on Darüşşafaka Cd, from Ana Kapı to the TIM gate
  { x: 36, y: 44, w: 3, h: 2 },    // behind the Eğitim wing, off the main street
  { x: 20, y: 28, w: 11, h: 2 },   // Yurt Meydanı → the corridor through Eğitim
  { x: 19, y: 19, w: 2, h: 2 },    // boys' dorm door → Yurt Meydanı
  { x: 27, y: 19, w: 10, h: 1 },   // Yurt Meydanı → Kapalı Saha door, along Eğitim
  { x: 29, y: 10, w: 1, h: 9 },    // up the dorm's east side to the basketball court
  { x: 12, y: 26, w: 2, h: 2 },    // girls' dorm door → Yurt Meydanı
  { x: 56, y: 40, w: 2, h: 11 },   // round the Cemiyet's east end to the Müze door at the back
];

export const COURTS = {
  basketball: { x: 75, y: 42, w: 10, h: 5 },
  football: { x: 75, y: 16, w: 16, h: 21 },
};
/** the basketball court on the lawn east of the boys' dorm */
export const DORM_COURT: Rect = { x: 30, y: 10, w: 6, h: 4 };
/** courts drawn besides the main two: the small one on the south lawn (just for show) and the dorm court */
export const EXTRA_COURTS: Rect[] = [{ x: 64, y: 42, w: 6, h: 4 }, DORM_COURT];
/** Beden Eğitimi is out on the football pitch and the basketball court beside it */
export const PE_AREA: Rect = { x: 73, y: 14, w: 19, h: 34 };
export const inPeArea = (x: number, y: number) => x >= PE_AREA.x && x < PE_AREA.x + PE_AREA.w && y >= PE_AREA.y && y < PE_AREA.y + PE_AREA.h;
/** where you can call friends over for a pick-up game */
export const PLAY_COURTS: Array<{ sport: 'basketball' | 'football'; rect: Rect }> = [
  { sport: 'basketball', rect: COURTS.basketball }, { sport: 'basketball', rect: DORM_COURT }, { sport: 'football', rect: COURTS.football },
];

/** garden walls closing off the dorm side: one from the north fence to Eğitim (between it and the Yemekhane),
 *  one from the end of the Eğitim wing to the south fence. The corridor through Eğitim is the way across. */
export const CAMPUS_WALLS: Rect[] = [{ x: 38, y: 12, w: 1, h: 10 }, { x: 35, y: 43, w: 1, h: 9 }];
/** the tall walls round the TIM Gösteri Merkezi's yard (the perimeter wall, the Eğitim wing and the garden wall
 *  close its other sides): there is no way in from the campus, only from the street through its own gate */
export const TIM_WALLS: Rect[] = [{ x: 20, y: 33, w: 15, h: 1 }, { x: 20, y: 33, w: 1, h: 14 }];

/** Ana Kapı, in the south fence on Darüşşafaka Cd */
export const GATE: Rect = { x: 39, y: 52, w: 3, h: 1 };
/** the tile just inside the gate */
export const GATE_IN: Pt = [40, 51];
/** the TIM Gösteri Merkezi's own gate on the street, a little west of Ana Kapı */
export const TIM_GATE: Rect = { x: 31, y: 52, w: 3, h: 1 };
export const GATES: Rect[] = [GATE, TIM_GATE];

/** player spawn (tile coords, can be fractional) */
export const SPAWN = { x: 40.5, y: 50.5 };
/** the guards' gatehouse, built into the wall right against the gate's east pillar (its window looks out on the road) */
export const CABIN: Rect = { x: 42.9, y: 51, w: 2.4, h: 2 };
/** the campus is walled in: every fence tile carries a tall stretch of wall, except where the gate's pillars
 *  and the gatehouse stand */
export function wallAt(m: number[][], x: number, y: number): boolean {
  if (m[y]?.[x] !== T.FENCE) return false;
  if (GATES.some((g) => y === g.y && (x === g.x - 1 || x === g.x + g.w))) return false;
  return !(x + 0.5 > CABIN.x && x + 0.5 < CABIN.x + CABIN.w && y + 0.5 > CABIN.y && y + 0.5 < CABIN.y + CABIN.h);
}

/** a Roman-style aqueduct joining Eğitim and the Cemiyet over the main street: you walk through its big arch */
export const AQUEDUCT: Rect = { x: 39, y: 41.8, w: 3, h: 0.8 };
/** how wide each of the aqueduct's two piers is, against the building walls (tiles) */
export const AQUEDUCT_PIER = 0.55;
/** the steps up from the Cemiyet door to the aqueduct's arch */
export const STAIRS: Rect = { x: 39, y: 43.2, w: 3, h: 2.5 };
/** the corridor through Eğitim is the building's first floor: at its east mouth a flight of steps runs down to the Merkez Meydan */
export const MEYDAN_STAIRS: Rect = { x: 39.6, y: 25, w: 2.6, h: 2 };

// ---------- the Merkez Meydan's terrace ----------
// The Meydan stands about 20 m above the Spor Salonu side (the street beside the hall and the south street).
// Its east and south edges are retaining walls; three ways lead down, all of them ending in the low south-east:
//  · in its top-left corner a railed stairwell goes down east into a covered tunnel under the north edge, which
//    comes out through an arch in the retaining wall onto the street beside the Spor Salonu;
//  · along its east side a narrow road slopes down south, level with the Meydan at the Yemekhane end, and comes
//    out on the street halfway down;
//  · in front of the Cemiyet a short flight of steps runs down east from the south-west corner, outside the south wall.
/** the stairwell down into the tunnel: steps going down to the east, the tunnel's mouth at its east end */
export const TUNNEL_STAIRS: Rect = { x: 43, y: 24, w: 4, h: 1 };
/** the tunnel itself, under the Meydan's north edge (and under the top of the road), to the arch in the east wall */
export const TUNNEL: Rect = { x: 47, y: 24, w: 8, h: 1 };
/** the road down the terrace's east side, from the Yemekhane corner (level with the Meydan) to the street halfway down */
export const MEYDAN_RAMP: Rect = { x: 54, y: 23, w: 1, h: 8 };
/** the steps in front of the Cemiyet, outside the Meydan against its south wall: they start at the Meydan's south-west
 *  corner (top, reached from the square or from the main street beside it) and go down east to the street */
export const SOUTH_STAIRS: Rect = { x: 42, y: 38, w: 4, h: 1 };
/** the Meydan's south retaining wall: its face shows along the bottom of the square */
export const SOUTH_WALL = { x0: 42, x1: 54, y: 38 };
/** the retaining walls and railings you can't cross, as lines along tile edges: [x0, y0, x1, y1] (tiles) */
export type Ledge = [number, number, number, number];
export const LEDGES: Ledge[] = [
  // the stairwell's railings and the tunnel mouth at its far end (you only go through it from the steps)
  [43, 24, 47, 24], [43, 25, 47, 25], [47, 24, 47, 25],
  // the east wall: beside the road (getting taller as the road drops away) and then on its own down to the corner;
  // and the road's own east side over the street, with the tunnel's arch in it
  [54, 26, 54, 38], [55, 23, 55, 30],
  // the south wall, open at the top of the Cemiyet steps in the corner; the steps' railing over the street, and the
  // wall between the main street and the street in front of the Cemiyet below the steps (the steps are the only way)
  [43, 38, 54, 38], [42, 39, 46, 39], [42, 39, 42, 40],
];
/** the tunnel's mouths: the foot of the stairwell and the arch in the east wall (x in tiles, row y–y+1) */
export const TUNNEL_IN = { west: TUNNEL.x, east: TUNNEL.x + TUNNEL.w, y: TUNNEL.y };
/** the grandstand built onto the Spor Salonu's east wall, facing the football pitch: ten rows along the whole hall,
 *  in two blocks either side of the way through to the hall's pitch-side door */
export const TRIBUNE_ROWS = 10;
export const TRIBUNE: Rect[] = [{ x: 70, y: 17, w: 3, h: 9.7 }, { x: 70, y: 29.3, w: 3, h: 9.7 }];

export const TREES: Array<[number, number]> = [
  [5, 10], [5, 15], [5, 20], [31, 8], [37, 13], [4, 26], [4, 30],
  [9, 40], [18, 43], [22, 36], [33, 37], [23, 47], [34, 46],
  [90, 40], [73, 48], [87, 49], [70, 48], [60, 50], [59, 44], [62, 46],
  [49.6, 34.7], [52.7, 34.3], // either side of the Atatürk bust
];

export const BENCHES: Array<[number, number]> = [
  [12, 23], [23, 20], [16, 27], [43, 27], [46, 36], [52, 27], [43, 34], [33, 43], [60, 42],
];

/** street lamps: they light up at night */
export const LAMPS: Array<[number, number]> = [
  [10, 22], [26, 20], [29, 14], [42, 25], [53, 25], [41.4, 36], [53, 36], [38, 46], [37.6, 48.3], [37.4, 50.6], [32, 31], [30, 47], [72, 40], [53.2, 30], [86, 40],
];

export const FLOWERS: Array<[number, number]> = [
  [11, 24], [22, 22], [44, 25], [51, 25], [34, 40], [60, 48], [28, 30],
];

/** landmarks: on the Merkez Meydan the three-sided pyramid in the very centre,
 *  the Atatürk bust among its trees in the south-east corner and the flag on the north side */
export const BUST: [number, number] = [51.5, 35.4];
export const FLAGPOLE: [number, number] = [50, 26];
/** the pyramid's centre and the width of its base (tiles) */
export const PYRAMID = { x: 47.75, y: 31.4, w: 3 };
/** the pull-up bars on the lawn west of the boys' dorm (centre of their foot, tiles): the high schoolers' corner */
export const PULLUP_BARS: [number, number] = [5.6, 12.8];

/** daytime hangouts for students: [x, y, roam] */
export const HANGOUTS: Array<[number, number, number]> = [
  [16, 24, 2], [22, 21, 2], [47, 27, 3], [47, 35, 3], [32, 12, 2], [24, 26, 2], [66, 49, 2], [80, 40, 2], [86, 48, 2], [20, 30, 2],
];

/** where each age group hangs out by day (lawns between the buildings and the campus walls) */
export type AgeGroup = 'g4' | 'g56' | 'g78' | 'lise';
/** the back of the dorms: the lawn west of the boys' dorm (with the pull-up bars), the strip behind it to the north,
 *  and the lawns west and south of the girls' dorm. Only high schoolers hang out there. */
export const DORM_BACKS: Rect[] = [{ x: 4, y: 4, w: 4, h: 17 }, { x: 8, y: 4, w: 21, h: 1.5 }, { x: 4, y: 26, w: 2, h: 13 }, { x: 5, y: 36, w: 14, h: 9 }];
/** where the lise devres gather in their free time, each school year on its own turf: the boys' dorm yard (between the
 *  dorm and the west wall, round the pull-up bars) for the 9th and 11th grades, the girls' dorm yard (between the dorm
 *  and the south-west wall) for the 10th and 12th */
export const LISE_YARDS = { boys: { x: 4.2, y: 9, w: 3, h: 10 }, girls: { x: 8, y: 40, w: 10, h: 2 } } satisfies Record<string, Rect>;
export const liseYard = (grade: number): Rect => (grade % 2 ? LISE_YARDS.boys : LISE_YARDS.girls);
/** is this spot (tiles) behind one of the dorms? */
export const inDormBacks = (x: number, y: number) => DORM_BACKS.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
export const AGE_ZONES: Record<AgeGroup, Rect[]> = {
  // 4th graders: the lawn in front of the girls' dorm, between it and the TIM wall
  g4: [{ x: 18, y: 29, w: 6, h: 3 }],
  // 5th–6th graders: the dorm basketball court north of Eğitim, and the lawn by Eğitim's west wall
  g56: [{ x: 30, y: 9, w: 6, h: 5 }, { x: 25, y: 29, w: 7, h: 3 }],
  // 7th–8th graders: round the small court and the big court
  g78: [{ x: 64, y: 47, w: 7, h: 3 }, { x: 84, y: 40, w: 7, h: 2 }],
  // high schoolers: their devre's yard behind one of the dorms (see LISE_YARDS)
  lise: [LISE_YARDS.boys, LISE_YARDS.girls],
};
/** the plazas: everyone mixes here */
export const CENTER_ZONES: Rect[] = [{ x: 41, y: 24, w: 13, h: 13 }, { x: 10, y: 21, w: 14, h: 4 }];
/** where students wait for the bell: the school side of the Merkez Meydan */
export const SCHOOL_FRONT: Rect = { x: 41, y: 24, w: 4, h: 8 };

/** 20:00–22:00 you may be anywhere around the dorms: the Yurt Meydanı and the lawns round both dorms */
export const PLAZA_EVENING: Rect = { x: 4, y: 4, w: 33, h: 28 };
/** …and the way down the girls' dorm's east side to the Revir's own door, which never shuts */
export const REVIR_WAY: Rect = { x: 4, y: 30, w: 16, h: 9 };
export const PLAZA_ALLOWED: Rect[] = [PLAZA_EVENING, REVIR_WAY];

/** evening (20:00–22:00) spots around the dorms, one per grade; the Yurt Meydanı in the middle is the mixed crowd */
export const EVENING_ZONES: Record<'4' | '5' | '6' | '7' | '8' | 'lise', Rect> = {
  '4': { x: 22, y: 26, w: 5, h: 2 },      // the lawn east of the Yurt Meydanı
  '5': { x: 9, y: 22.5, w: 6, h: 2 },     // west end of the Yurt Meydanı
  '6': { x: 20, y: 20, w: 6, h: 2 },      // east end of the Yurt Meydanı
  '7': { x: 30, y: 9, w: 6, h: 5 },       // the dorm basketball court
  '8': { x: 18, y: 29, w: 6, h: 2 },      // in front of the girls' dorm
  lise: LISE_YARDS.boys,                  // (each lise devre actually goes to its own yard, see LISE_YARDS)
};
export const EVENING_CENTER: Rect = { x: 10, y: 21, w: 15, h: 6 };

/** Selim Hoca's night patrol loop */
export const PATROL_ROUTE: Array<[number, number]> = [[16, 25], [30, 29], [34, 26], [40, 26], [40, 46], [40, 30], [47, 26], [54, 25], [55, 37], [40, 38], [40, 20], [40, 26], [31, 27], [20, 21]];

export const LOCATIONS: Location[] = [
  {
    id: 'ana_kapi', kind: 'zone',
    name: { tr: 'Ana Kapı', en: 'Ana Kapı' }, sub: { tr: 'Ana giriş', en: 'Main gate' },
    info: { tr: 'Herkesin hikâyesi burada başlar. Pazar günleri ziyaret günüdür.', en: "Everyone's story starts here. Sundays are visiting day." },
    rect: { x: 35, y: 47, w: 11, h: 5 }, label: { x: 40.5, y: 49.4 }, minimapColor: '#8a2d2d',
  },
  {
    id: 'cemiyet', kind: 'building',
    name: { tr: 'Cemiyet Binası', en: 'Cemiyet Binası' }, sub: { tr: 'Yönetim · kayıt', en: 'Administration · registration' },
    info: {
      tr: 'İlk durağın: kayıt burada yapılır. Müdür ve ziyaretçi odası buradadır.',
      en: 'Your first stop: registration happens here. The principal and the visitors\' room are here.',
    },
    rect: { x: 42, y: 40, w: 14, h: 9 }, label: { x: 46.5, y: 44.5 }, doors: [{ x: 42, y: 46, side: 'w' }, { x: 42, y: 47, side: 'w' }], minimapColor: '#b9c0c6',
  },
  {
    id: 'muze', kind: 'building',
    name: { tr: 'Müze', en: 'Müze' }, sub: { tr: 'Okulun tarihi', en: "The school's history" },
    info: { tr: 'Okulun 1863\'ten bu yana hikâyesi. Her yıl yeni bir bölüm açılır. Girişi binanın güney yüzünde.', en: "The school's story since 1863. A new chapter opens every year. Its entrance is on the south side of the building." },
    rect: { x: 51, y: 42, w: 5, h: 6 }, doors: [{ x: 53, y: 48, side: 's' }, { x: 54, y: 48, side: 's' }],
    label: { x: 53.2, y: 46.6 }, revealRect: { x: 42, y: 40, w: 14, h: 9 }, minimapColor: '#7a4e2a',
  },
  {
    id: 'kiz_yurdu', kind: 'building',
    name: { tr: 'Kız Yurdu', en: 'Kız Yurdu' }, sub: { tr: 'Kızların yurdu · A1–A3 blokları', en: "Girls' dorm · blocks A1–A3" },
    info: { tr: 'A1, A2 ve A3 blokları; her blokta 4 kat ve 14 bölüm. Girişi Yurt Meydanı\'na ve Erkek Yurdu\'na bakar.', en: 'Blocks A1, A2 and A3, each with 4 floors and 14 sections. The entrance faces the dorm plaza and the boys\' dorm.' },
    rect: { x: 6, y: 26, w: 12, h: 14 }, label: { x: 11, y: 31 }, doors: [{ x: 12, y: 28, side: 'n', span: 2 }], minimapColor: '#d98fa8',
  },
  {
    id: 'revir', kind: 'building',
    name: { tr: 'Revir', en: 'Revir' }, sub: { tr: 'Kız Yurdu −1. kat · herkese açık', en: "Infirmary · girls' dorm floor −1 · everyone" },
    info: { tr: 'Hemşire gece gündüz burada. Kendi dış girişi var; herkes kullanabilir.', en: 'The nurse is here day and night. It has its own outside entrance, so everyone can use it.' },
    rect: { x: 13, y: 32, w: 4, h: 4 }, doors: [{ x: 16, y: 33, side: 'e', kind: 'revir' }],
    label: { x: 14.6, y: 36.4 }, revealRect: { x: 6, y: 26, w: 12, h: 14 }, minimapColor: '#c0392b',
  },
  {
    id: 'erkek_yurdu', kind: 'building',
    name: { tr: 'Erkek Yurdu', en: 'Erkek Yurdu' }, sub: { tr: 'Erkeklerin yurdu · A1–A3 blokları', en: "Boys' dorm · blocks A1–A3" },
    info: { tr: 'A1, A2 ve A3 blokları; her blokta 4 kat ve 14 bölüm. Girişi Yurt Meydanı\'na ve Kız Yurdu\'na bakar.', en: 'Blocks A1, A2 and A3, each with 4 floors and 14 sections. The entrance faces the dorm plaza and the girls\' dorm.' },
    rect: { x: 8, y: 5.5, w: 20.5, h: 16 }, label: { x: 18, y: 7.2 }, doors: [{ x: 19, y: 18, side: 's' }, { x: 20, y: 18, side: 's' }], minimapColor: '#7fa8d9',
  },
  {
    id: 'yurt_meydani', kind: 'zone',
    name: { tr: 'Yurt Meydanı', en: 'Yurt Meydanı' }, sub: { tr: 'Yurtlar arası meydan', en: 'Dorm plaza' },
    info: { tr: 'Akşam buluşma yeri. İki yurt karşılıklı bakar; ortası açık bir meydan.', en: 'The evening hangout. The two dorms face each other across an open square.' },
    rect: { x: 8, y: 18, w: 20, h: 12 }, label: { x: 17, y: 26.6 }, minimapColor: '#a9cf95',
  },
  {
    id: 'merkez_meydan', kind: 'zone',
    name: { tr: 'Merkez Meydan', en: 'Merkez Meydan' }, sub: { tr: 'Piramit · Atatürk büstü · tören alanı', en: 'Pyramid · Atatürk bust · ceremonies' },
    info: { tr: 'Kampüsün tam ortası: ortasında üçgen piramit, güneydoğu köşesinde ağaçların arasında Atatürk büstü. Bayrak törenleri burada yapılır. Spor salonu tarafından yirmi metre yüksekte bir teras: oraya kuzey köşedeki merdivenden inen yeraltı geçidiyle, doğu kenarındaki yokuş yoldan ya da Cemiyet\'in önündeki merdivenlerden inilir.', en: 'The very centre of the campus: the three-sided pyramid in the middle, the Atatürk bust among trees in the south-east corner. Flag ceremonies are held here. It is a terrace twenty metres above the sports hall side: you go down by the underground passage from the steps in its north corner, the sloping road along its east edge or the steps in front of the Cemiyet.' },
    rect: { x: 41, y: 24, w: 14, h: 14 }, label: { x: 47.5, y: 36.4 }, minimapColor: '#a9cf95',
  },
  {
    id: 'tim', kind: 'building',
    name: { tr: 'TIM Gösteri Merkezi', en: 'TIM Gösteri Merkezi' }, sub: { tr: 'Konferans salonu · sahne', en: 'Auditorium · stage' },
    info: { tr: 'Kırmızı koltuklar ve büyük bir sahne. Törenler, seçimler ve tiyatro gösterileri burada yapılır. Duvarlarla çevrili kendi bahçesinde durur: kampüsten geçiş yoktur, yalnızca sokaktaki kendi kapısından girilir (Ana Kapı\'nın biraz batısında).', en: 'Red seats and a big stage. Ceremonies, elections and plays happen here. It stands in its own walled yard: there is no way in from the campus, only through its own gate on the street, a little west of Ana Kapı.' },
    rect: { x: TIM_C[0] - TIM_R, y: TIM_C[1] - TIM_R, w: TIM_R * 2, h: TIM_R * 2 }, doors: [{ x: 26, y: 46, side: 's' }, { x: 27, y: 46, side: 's' }], minimapColor: '#e2c48f',
  },
  {
    id: 'egitim', kind: 'building',
    name: { tr: 'Eğitim Binası', en: 'Eğitim Binası' }, sub: { tr: 'Sınıflar · öğretmenler odası', en: 'Classrooms · teachers\' room' },
    info: { tr: 'Sınıflar, öğretmenler odası, müdür yardımcısı ve rehber öğretmen, binanın güney ve doğu kanadında. İki girişi var: biri Merkez Meydan\'a bakar; öteki binanın içinden geçen birinci kat koridorundadır. Koridor yurt tarafını merdivenlerle Merkez Meydan\'a bağlar.', en: 'Classrooms, the teachers\' room, the deputy head and the counselor, in the south and east wings. It has two entrances: one faces the Merkez Meydan; the other is in the first-floor corridor that runs through the building, linking the dorm side to the Merkez Meydan down a flight of steps.' },
    rect: { x: 35.5, y: 27, w: 3.5, h: 17 }, label: { x: 37.3, y: 34 }, doors: [{ x: 36, y: 27, side: 'n' }, { x: 37, y: 27, side: 'n' }, { x: 38, y: 31, side: 'e' }, { x: 38, y: 32, side: 'e' }], minimapColor: '#c9a46a',
  },
  {
    id: 'kutuphane', kind: 'building',
    name: { tr: 'Kütüphane', en: 'Kütüphane' }, sub: { tr: 'Ders kitapları · okuma salonu', en: 'Textbooks · reading room' },
    info: { tr: 'Ders kitapları, okuma rafları ve sessiz çalışma masaları. Kütüphaneci Nermin Hanım\'ın yeri. Eğitim Binası\'nın kuzey kanadında; kapısı binanın içinden geçen koridorda.', en: 'Textbooks, reading shelves and quiet study desks. Librarian Ms. Nermin\'s domain, in the north wing of the Eğitim building; its door is in the corridor through the building.' },
    rect: { x: 28, y: 20, w: 11, h: 5 }, label: { x: 33.5, y: 22.4 }, doors: [{ x: 33, y: 24, side: 's' }, { x: 34, y: 24, side: 's' }], minimapColor: '#b58f5e',
  },
  {
    id: 'yemekhane', kind: 'building',
    name: { tr: 'Yemekhane', en: 'Yemekhane' }, sub: { tr: 'Yemek salonu · çatı terası', en: 'Dining hall · roof terrace' },
    info: { tr: 'Kahvaltı 07:00, öğle 12:20, ara öğün 16:00–17:00 (poğaça, simit, kek), akşam 17:00. Kulüp odaları ve çatı terası da burada; arkasında Teknik Alan var.', en: 'Breakfast 07:00, lunch 12:20, afternoon snack 16:00–17:00 (poğaça, simit, cake), dinner 17:00. Club rooms and the roof terrace too; the Teknik Alan is at the back.' },
    rect: { x: 41.5, y: 14, w: 13.5, h: 9 }, label: { x: 48.2, y: 19.5 }, doors: [{ x: 47, y: 22, side: 's' }, { x: 48, y: 22, side: 's' }], minimapColor: '#9fb3c8',
  },
  {
    id: 'teknik', kind: 'building',
    name: { tr: 'Teknik Alan', en: 'Teknik Alan' }, sub: { tr: 'Kısıtlı alan · Yemekhane\'nin arkası', en: 'Restricted area · behind the dining hall' },
    info: { tr: 'Hademe Hüseyin Usta\'nın atölyesi ve kazan dairesi, Yemekhane\'nin arka girişinde. Kapı kilitli… şimdilik.', en: "Caretaker Hüseyin Usta's workshop and the boiler room, through the dining hall's back door. The door is locked… for now." },
    rect: { x: 44, y: 14, w: 7, h: 3 }, label: { x: 47.5, y: 15.4 }, revealRect: { x: 41.5, y: 13, w: 13.5, h: 10 },
    doors: [{ x: 47, y: 14, side: 'n' }, { x: 48, y: 14, side: 'n' }], minimapColor: '#7fb466',
  },
  {
    id: 'spor', kind: 'building',
    name: { tr: 'Spor Salonu', en: 'Spor Salonu' }, sub: { tr: 'Salon · havuz · kantin · depo', en: 'Hall · pool · canteen · stores' },
    info: { tr: 'Basketbol, voleybol, futsal, yüzme havuzu ve eskrim salonu; Şakir Abi\'nin kantini ve kıyafetlerin dağıtıldığı depo da içeride. Doğu duvarı boyunca futbol sahasına bakan on sıralı tribün uzanır; o taraftaki kapıdan sahaya çıkılır.', en: "Basketball, volleyball, futsal, the swimming pool and the fencing room; Şakir's canteen and the stores that hand out your clothes are inside too. A ten-row grandstand runs along its east wall, facing the football pitch, with a door out to the pitch on that side." },
    rect: { x: 58, y: 15, w: 12, h: 24.5 }, doors: [{ x: 58, y: 30, side: 'w' }, { x: 58, y: 31, side: 'w' }, { x: 69, y: 27, side: 'e' }, { x: 69, y: 28, side: 'e' }], minimapColor: '#dfe3e6',
  },
  {
    id: 'kapali_saha', kind: 'building',
    name: { tr: 'Kapalı Saha', en: 'Kapalı Saha' }, sub: { tr: 'Futbol · hentbol · badminton · voleybol', en: 'Indoor court · football · handball · badminton · volleyball' },
    info: { tr: 'Yurtların yanındaki balon saha: üstü yeşil brandayla kaplı, içeriye basılan havayla ayakta duran şişme bir kubbe. Futbol, hentbol, badminton ve voleybol oynanır; yağmurda da kışın da açık. Akşam etüt sonrası da açık.', en: 'The balloon court by the dorms: an inflated dome of green tarp, held up by the air pumped inside it. Football, handball, badminton and volleyball, rain or shine, all winter long. Open in the evening too, after study hour.' },
    rect: { x: 30, y: 14.8, w: 8, h: 3.8 }, label: { x: 34, y: 16.4 }, doors: [{ x: 33, y: 18, side: 's' }, { x: 34, y: 18, side: 's' }], minimapColor: '#4f8f4a',
  },
  {
    id: 'kortlar', kind: 'zone',
    name: { tr: 'Açık Sahalar', en: 'Açık Sahalar' }, sub: { tr: 'Futbol · basketbol', en: 'Outdoor pitches' },
    info: { tr: 'Futbol sahası (Spor Salonu\'nun tribünü ona bakar) ve basketbol sahası. Teneffüste herkes burada.', en: 'The football pitch (the Spor Salonu\'s grandstand looks onto it) and the basketball court. Everyone is here at break time.' },
    rect: { x: 74, y: 15, w: 18, h: 36 }, label: { x: 82, y: 39.4 }, minimapColor: '#a8483e',
  },
];

/** fills tiles whose centre lies inside the outline */
function fillPoly(m: number[][], p: Pt[], t: number | ((x: number, y: number) => number | null)) {
  const r = bounds(p);
  for (let y = Math.max(0, Math.floor(r.y)); y < Math.min(MAP_H, Math.ceil(r.y + r.h)); y++) {
    for (let x = Math.max(0, Math.floor(r.x)); x < Math.min(MAP_W, Math.ceil(r.x + r.w)); x++) {
      if (!inPoly(x + 0.5, y + 0.5, p)) continue;
      const v = typeof t === 'number' ? t : t(x, y);
      if (v !== null) m[y][x] = v;
    }
  }
}

export function buildMap(): number[][] {
  const m: number[][] = Array.from({ length: MAP_H }, (_, y) => Array.from({ length: MAP_W }, (_, x) => (inPoly(x + 0.5, y + 0.5, GROUND_SHAPE) ? T.GROUND : T.FOREST)));
  // the fence: every outside tile touching the campus
  const ground = (x: number, y: number) => m[y]?.[x] === T.GROUND;
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (m[y][x] !== T.GROUND && [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]].some(([dx, dy]) => ground(x + dx, y + dy))) m[y][x] = T.FENCE;
  }
  const outside = (t: number) => (x: number, y: number) => (m[y][x] === T.FOREST ? t : null);
  fillPoly(m, HOUSES, outside(T.HOUSES));
  for (const r of ROADS) fillPoly(m, r, outside(T.ROAD));

  for (const p of PLAZAS) fillPoly(m, p, T.PLAZA);
  for (const p of PATHS) fillPoly(m, rectPts(p), T.PATH);
  fillPoly(m, rectPts(COURTS.basketball), T.COURT_RED);
  for (const c of EXTRA_COURTS) fillPoly(m, rectPts(c), T.COURT_RED);
  for (const g of GATES) fillPoly(m, rectPts(g), T.GATE);

  for (const b of BUILDINGS) {
    const roofTile = b.roof === 'green' || b.roof === 'tarp' ? T.GREEN_ROOF : T.ROOF;
    fillPoly(m, b.shape, roofTile);
    if (b.courtyard) fillPoly(m, b.courtyard, T.COURTYARD);
    b.solar?.forEach((s) => fillPoly(m, rectPts(s), T.SOLAR));
    b.greenPatches?.forEach((s) => fillPoly(m, rectPts(s), T.GREEN_ROOF));
    b.skylights?.forEach((s) => fillPoly(m, rectPts(s), T.SKYLIGHT));
    // the front (southern-most) rows of each column read as façade on the minimap
    fillPoly(m, b.shape, (x, y) => {
      if (m[y][x] === T.COURTYARD) return null;
      if (!inBuilding(x + 0.5, y + 1.5, b)) return T.WALL_BASE;
      return inBuilding(x + 0.5, y + 2.5, b) ? null : T.WALL;
    });
  }
  for (const loc of LOCATIONS) {
    for (const d of loc.doors ?? []) m[d.y][d.x] = d.kind === 'revir' || loc.id === 'revir' ? T.DOOR_REVIR : T.DOOR;
  }
  // corridors through buildings are walkable floor; garden walls go up last
  for (const b of BUILDINGS) for (const p of b.passages ?? []) fillPoly(m, rectPts(p), (x, y) => (m[y][x] === T.FENCE || m[y][x] === T.FOREST ? null : T.PATH));
  for (const w of CAMPUS_WALLS) fillPoly(m, rectPts(w), T.CAMPUS_WALL);
  for (const w of TIM_WALLS) fillPoly(m, rectPts(w), (x, y) => (m[y][x] === T.FOREST || m[y][x] === T.ROAD ? null : T.FENCE));
  return m;
}

/** the walkable tile just outside a door, where the player stands to interact */
export function doorStandTile(d: Door): { x: number; y: number } {
  switch (d.side) {
    case 'e': return { x: d.x + 1, y: d.y };
    case 'w': return { x: d.x - 1, y: d.y };
    case 's': return { x: d.x, y: d.y + 1 };
    case 'n': return { x: d.x, y: d.y - 1 };
  }
}

/** the building a door belongs to */
export function buildingOfDoor(d: Door): Building | undefined {
  return BUILDINGS.find((b) => inBuilding(d.x + 0.5, d.y + 0.5, b));
}

/** Cemil Emmi sweeps in front of the boys' dorm by day */
export const CEMIL_OUT: [number, number] = [23.5, 20.2];

// Daçka campus layout in tiles (layout v5, from the annotated satellite map; north is up).
// West: Erkek Yurdu (the wedge, top) and Kız Yurdu + Revir (bottom) facing each other across the
// Yurt Meydanı; TIM Gösteri Merkezi (round) beside the girls' dorm; Eğitim Binası + Kütüphane (one
// building, the library in its long east wing). Middle: Yemekhane (Teknik Alan behind it, on Ayaz Cd)
// and the Merkez Meydan with the Atatürk bust. East: Spor Salonu and the football pitch. South:
// Cemiyet + Müze, the Kantin with a small court and the basketball court; Ana Kapı opens onto
// Darüşşafaka Cd. Buildings have true outlines (polygons and circles) instead of tile rectangles.

import type { Text } from '../i18n';

export const TILE = 32;
export const MAP_W = 96;
export const MAP_H = 56;
/** bump when buildings move: old saves get their fog and position reset */
export const LAYOUT = 5;

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
  roof: 'grey' | 'green' | 'white';
  /** flat with a parapet, a dome (round halls) or a barrel vault (the sports hall) */
  roofStyle?: 'flat' | 'dome' | 'vault';
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
export const GROUND_SHAPE: Pt[] = [[4, 4], [30, 4], [39, 13], [92, 13], [92, 52], [35, 52], [4, 39]];
/** outside the fence: Ayaz Cd along the north, Darüşşafaka Cd along the south-west and south */
const ROADS: Pt[][] = [
  [[33, 9], [96, 9], [96, 12.5], [36.5, 12.5]],
  [[0, 39.6], [35, 52.6], [96, 52.6], [96, 56], [0, 56]],
];
/** the neighbourhood north of Ayaz Cd */
const HOUSES: Pt[] = [[30, 0], [96, 0], [96, 9], [33, 9], [30, 5]];

export const BUILDINGS: Building[] = [
  bld({ id: 'erkek_yurdu', shape: [[8, 8.5], [12.5, 5.5], [28.5, 17.2], [8, 21.5]], roof: 'grey', courtyard: [[11, 11], [18, 14.5], [11, 17]] }),
  bld({ id: 'kiz_yurdu', shape: [[7, 25.5], [18.5, 31], [14.5, 40], [5.5, 35.5]], roof: 'grey', courtyard: circlePts(11.2, 34, 1.7, 14) }),
  bld({ id: 'tim', shape: circlePts(25.5, 35.5, 5.2, 32), roof: 'white', roofStyle: 'dome' }),
  bld({
    id: 'egitim', shape: [[26.5, 23.5], [28.5, 19.5], [39, 21.5], [39, 44], [36, 44], [35.5, 34], [34, 27.5]], roof: 'grey',
    skylights: [{ x: 30, y: 21.6, w: 6, h: 1 }, { x: 36.5, y: 29, w: 1, h: 6.5 }],
    // the only way between the dorm side and the Merkez Meydan: a tunnel through the building, from the
    // wall facing TIM to the main street. The Kütüphane opens off its north side, the classrooms off its south.
    passages: [{ x: 29, y: 25, w: 11, h: 2 }],
  }),
  bld({ id: 'yemekhane', shape: rectPts({ x: 41.5, y: 14, w: 13.5, h: 9 }), roof: 'white', solar: [{ x: 43, y: 15.3, w: 10.5, h: 2.5 }], greenPatches: [{ x: 43, y: 18.8, w: 10.5, h: 2 }] }),
  bld({ id: 'spor', shape: [[58, 16.5], [59.5, 15], [70, 15], [71.5, 16.5], [71.5, 39.5], [58, 39.5]], roof: 'white', roofStyle: 'vault' }),
  bld({ id: 'cemiyet', shape: rectPts({ x: 41, y: 40, w: 15, h: 9 }), roof: 'grey', courtyard: rectPts({ x: 45, y: 42, w: 5, h: 2 }) }),
  bld({ id: 'kantin', shape: rectPts({ x: 58, y: 41, w: 5, h: 6 }), roof: 'green' }),
];

export const PLAZAS: Pt[][] = [
  [[8.5, 22.6], [27.6, 18.7], [26.5, 22.8], [20, 29.5], [8.5, 24.8]], // Yurt Meydanı, between the dorms
  rectPts({ x: 41, y: 24, w: 13.5, h: 13.5 }),                        // Merkez Meydan
];

export const PATHS: Rect[] = [
  { x: 39, y: 13, w: 2, h: 39 },   // the main street: Ana Kapı → north, between Eğitim and the Meydan
  { x: 41, y: 13, w: 51, h: 1 },   // service road behind the Yemekhane (Teknik Alan door)
  { x: 41, y: 23, w: 14, h: 1 },   // in front of the Yemekhane
  { x: 55, y: 14, w: 3, h: 26 },   // between the Meydan and the Spor Salonu
  { x: 72, y: 14, w: 2, h: 24 },   // between the Spor Salonu and the football pitch
  { x: 41, y: 38, w: 51, h: 2 },   // the south street, to the courts
  { x: 56, y: 40, w: 16, h: 1 },   // in front of the Kantin
  { x: 41, y: 49, w: 17, h: 2 },   // behind the Cemiyet
  { x: 30, y: 26, w: 3, h: 20 },   // Eğitim door ↔ TIM door
  { x: 27, y: 44, w: 8, h: 2 },    // south of TIM (the garden wall stops it at the Eğitim wing)
  { x: 36, y: 44, w: 3, h: 2 },    // behind the Eğitim wing, off the main street
  { x: 20, y: 28, w: 11, h: 2 },   // Yurt Meydanı → TIM
  { x: 19, y: 19, w: 2, h: 2 },    // boys' dorm door → Yurt Meydanı
  { x: 12, y: 26, w: 2, h: 2 },    // girls' dorm door → Yurt Meydanı
  { x: 56, y: 40, w: 2, h: 11 },   // Müze door, between the Cemiyet and the Kantin
];

export const COURTS = {
  basketball: { x: 75, y: 42, w: 10, h: 5 },
  football: { x: 74, y: 16, w: 16, h: 21 },
};
/** the small court next to the Kantin (just for show) */
export const EXTRA_COURTS: Rect[] = [{ x: 64, y: 42, w: 6, h: 4 }];

/** garden walls closing off the dorm side: one from the north fence to Eğitim (between it and the Yemekhane),
 *  one from the end of the Eğitim wing to the south fence. The corridor through Eğitim is the way across. */
export const CAMPUS_WALLS: Rect[] = [{ x: 38, y: 12, w: 1, h: 10 }, { x: 35, y: 43, w: 1, h: 9 }];

/** Ana Kapı, in the south fence on Darüşşafaka Cd */
export const GATE: Rect = { x: 39, y: 52, w: 2, h: 1 };
/** the tile just inside the gate */
export const GATE_IN: Pt = [40, 51];

/** player spawn (tile coords, can be fractional) */
export const SPAWN = { x: 40, y: 50.5 };

export const TREES: Array<[number, number]> = [
  [5, 10], [5, 15], [5, 20], [33, 9], [36, 12], [31, 14], [4, 26], [4, 30],
  [9, 40], [19, 42], [24, 43], [28, 46], [34, 48],
  [90, 40], [73, 48], [87, 49], [70, 48], [90, 31], [90, 20], [60, 50],
];

export const BENCHES: Array<[number, number]> = [
  [12, 23], [23, 20], [16, 27], [43, 27], [43, 34], [52, 27], [52, 34], [33, 42],
];

/** street lamps: they light up at night */
export const LAMPS: Array<[number, number]> = [
  [10, 22], [26, 20], [42, 25], [53, 25], [42, 36], [53, 36], [38, 46], [37, 50], [43, 51], [33, 33], [72, 40], [54, 30], [86, 40],
];

export const FLOWERS: Array<[number, number]> = [
  [11, 24], [22, 22], [44, 25], [51, 25], [34, 40], [60, 48], [28, 30],
];

/** landmarks: the fountain in the Yurt Meydanı; the Atatürk bust in the middle of the Merkez Meydan, with the flag beside it */
export const FOUNTAIN: [number, number] = [17, 24];
export const BUST: [number, number] = [47.5, 31];
export const FLAGPOLE: [number, number] = [50, 29];

/** daytime hangouts for students: [x, y, roam] */
export const HANGOUTS: Array<[number, number, number]> = [
  [16, 24, 2], [22, 21, 2], [47, 27, 3], [47, 35, 3], [33, 11, 2], [33, 40, 2], [66, 49, 2], [80, 40, 2], [86, 48, 2], [5, 15, 2],
];

/** where each age group hangs out by day (lawns between the buildings and the campus walls) */
export type AgeGroup = 'g4' | 'g56' | 'g78' | 'lise';
export const AGE_ZONES: Record<AgeGroup, Rect[]> = {
  // 4th graders: the lawns west of the boys' dorm and south of the girls' dorm
  g4: [{ x: 4, y: 9, w: 3, h: 12 }, { x: 13, y: 41, w: 8, h: 2 }],
  // 5th–6th graders: the lawn north of Eğitim, and beside the girls' dorm
  g56: [{ x: 31, y: 9, w: 6, h: 7 }, { x: 4, y: 26, w: 2, h: 8 }],
  // 7th–8th graders: round the Kantin court and the big court
  g78: [{ x: 64, y: 47, w: 7, h: 3 }, { x: 84, y: 40, w: 7, h: 2 }],
  // high schoolers: east of the basketball court and behind the Kantin
  lise: [{ x: 86, y: 42, w: 5, h: 8 }, { x: 57, y: 49, w: 14, h: 2 }],
};
/** the plazas: everyone mixes here */
export const CENTER_ZONES: Rect[] = [{ x: 41, y: 24, w: 13, h: 13 }, { x: 10, y: 21, w: 14, h: 4 }];

/** 20:00–22:00 you may be anywhere around the dorms: the Yurt Meydanı and the lawns round both dorms */
export const PLAZA_EVENING: Rect = { x: 4, y: 4, w: 33, h: 28 };
export const PLAZA_ALLOWED: Rect[] = [PLAZA_EVENING];

/** evening (20:00–22:00) spots around the dorms, one per grade; the Yurt Meydanı in the middle is the mixed crowd */
export const EVENING_ZONES: Record<'4' | '5' | '6' | '7' | '8' | 'lise', Rect> = {
  '4': { x: 4, y: 9, w: 3, h: 12 },       // west of the boys' dorm
  '5': { x: 9, y: 22.5, w: 6, h: 2 },     // west end of the Yurt Meydanı
  '6': { x: 20, y: 20, w: 6, h: 2 },      // east end of the Yurt Meydanı
  '7': { x: 31, y: 9, w: 5, h: 7 },       // the lawn north of Eğitim
  '8': { x: 4, y: 26, w: 2, h: 5 },       // beside the girls' dorm
  lise: { x: 27, y: 18, w: 8, h: 2 },     // along Eğitim, by the boys' dorm
};
export const EVENING_CENTER: Rect = { x: 11, y: 22, w: 12, h: 4 };

/** Selim Bey's night patrol loop */
export const PATROL_ROUTE: Array<[number, number]> = [[16, 25], [31, 30], [31, 44], [40, 46], [40, 30], [47, 24], [56, 24], [56, 38], [40, 38], [40, 20], [30, 18], [20, 21]];

export const LOCATIONS: Location[] = [
  {
    id: 'ana_kapi', kind: 'zone',
    name: { tr: 'Ana Kapı', en: 'Ana Kapı' }, sub: { tr: 'Ana giriş', en: 'Main gate' },
    info: { tr: 'Herkesin hikâyesi burada başlar. Pazar günleri ziyaret günüdür.', en: "Everyone's story starts here. Sundays are visiting day." },
    rect: { x: 35, y: 47, w: 11, h: 5 }, label: { x: 40, y: 47.6 }, minimapColor: '#8a2d2d',
  },
  {
    id: 'cemiyet', kind: 'building',
    name: { tr: 'Cemiyet Binası', en: 'Cemiyet Binası' }, sub: { tr: 'Yönetim · kayıt', en: 'Administration · registration' },
    info: {
      tr: 'İlk durağın: kayıt burada yapılır. Müdür, rehber öğretmen ve ziyaretçi odası buradadır. Ambar (−1. kat) üniforma, ayakkabı ve eşofman dağıtır.',
      en: 'Your first stop: registration happens here. The principal, the guidance counselor and the visitors\' room are here. The Ambar (floor −1) hands out uniforms, shoes and tracksuits.',
    },
    rect: { x: 41, y: 40, w: 15, h: 9 }, label: { x: 46, y: 44.5 }, doors: [{ x: 41, y: 44, side: 'w' }, { x: 41, y: 45, side: 'w' }], minimapColor: '#b9c0c6',
  },
  {
    id: 'muze', kind: 'building',
    name: { tr: 'Müze', en: 'Müze' }, sub: { tr: 'Okulun tarihi', en: "The school's history" },
    info: { tr: 'Okulun 1863\'ten bu yana hikâyesi. Her yıl yeni bir bölüm açılır.', en: "The school's story since 1863. A new chapter opens every year." },
    rect: { x: 51, y: 42, w: 5, h: 6 }, doors: [{ x: 55, y: 45, side: 'e' }, { x: 55, y: 46, side: 'e' }],
    label: { x: 53.2, y: 46.6 }, revealRect: { x: 41, y: 40, w: 15, h: 9 }, minimapColor: '#7a4e2a',
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
    rect: { x: 8, y: 5.5, w: 20.5, h: 16 }, label: { x: 13, y: 9.5 }, doors: [{ x: 19, y: 18, side: 's' }, { x: 20, y: 18, side: 's' }], minimapColor: '#7fa8d9',
  },
  {
    id: 'yurt_meydani', kind: 'zone',
    name: { tr: 'Yurt Meydanı', en: 'Yurt Meydanı' }, sub: { tr: 'Yurtlar arası meydan', en: 'Dorm plaza' },
    info: { tr: 'Akşam buluşma yeri. İki yurt karşılıklı bakar; ortada fıskiye var.', en: 'The evening hangout. The two dorms face each other, with the fountain in the middle.' },
    rect: { x: 8, y: 18, w: 20, h: 12 }, label: { x: 17, y: 26.6 }, minimapColor: '#a9cf95',
  },
  {
    id: 'merkez_meydan', kind: 'zone',
    name: { tr: 'Merkez Meydan', en: 'Merkez Meydan' }, sub: { tr: 'Atatürk büstü · tören alanı', en: 'Atatürk bust · ceremonies' },
    info: { tr: 'Kampüsün tam ortası. Atatürk büstünün önünde törenler yapılır; yemekhane, kütüphane ve spor salonu arasındaki günlük geçit.', en: 'The very centre of the campus. Ceremonies are held in front of the Atatürk bust; the daily crossing between the dining hall, the library and the sports hall.' },
    rect: { x: 41, y: 24, w: 14, h: 14 }, label: { x: 47.5, y: 36.4 }, minimapColor: '#a9cf95',
  },
  {
    id: 'tim', kind: 'building',
    name: { tr: 'TIM Gösteri Merkezi', en: 'TIM Gösteri Merkezi' }, sub: { tr: 'Konferans salonu · sahne', en: 'Auditorium · stage' },
    info: { tr: 'Kırmızı koltuklar ve büyük bir sahne. Törenler, seçimler ve tiyatro gösterileri burada yapılır.', en: 'Red seats and a big stage. Ceremonies, elections and plays happen here.' },
    rect: { x: 20.3, y: 30.3, w: 10.4, h: 10.4 }, doors: [{ x: 30, y: 34, side: 'e' }, { x: 30, y: 35, side: 'e' }], minimapColor: '#e2c48f',
  },
  {
    id: 'egitim', kind: 'building',
    name: { tr: 'Eğitim Binası', en: 'Eğitim Binası' }, sub: { tr: 'Sınıflar · öğretmenler odası', en: 'Classrooms · teachers\' room' },
    info: { tr: 'Sınıflar ve öğretmenler odası, binanın güney ve doğu kanadında. Girişi, binanın içinden geçen koridorda: koridor yurt tarafını Merkez Meydan\'a bağlar.', en: 'Classrooms and the teachers\' room, in the south and east wings. You go in from the corridor that runs through the building, linking the dorm side to the Merkez Meydan.' },
    rect: { x: 35.5, y: 27, w: 3.5, h: 17 }, label: { x: 37.3, y: 34 }, doors: [{ x: 36, y: 27, side: 'n' }, { x: 37, y: 27, side: 'n' }], minimapColor: '#c9a46a',
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
    info: { tr: 'Kahvaltı 07:00, öğle 12:20, akşam 17:00. Kulüp odaları ve çatı terası da burada; arkasında Teknik Alan var.', en: 'Breakfast 07:00, lunch 12:20, dinner 17:00. Club rooms and the roof terrace too; the Teknik Alan is at the back.' },
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
    name: { tr: 'Spor Salonu', en: 'Spor Salonu' }, sub: { tr: 'Havuz · eskrim · basketbol', en: 'Pool · fencing · basketball' },
    info: { tr: 'Basketbol, voleybol, futsal, yüzme havuzu ve eskrim salonu. Antrenörlerin odası da burada.', en: "Basketball, volleyball, futsal, the swimming pool and the fencing room. The coaches' office is here too." },
    rect: { x: 58, y: 15, w: 13.5, h: 24.5 }, doors: [{ x: 58, y: 30, side: 'w' }, { x: 58, y: 31, side: 'w' }], minimapColor: '#dfe3e6',
  },
  {
    id: 'kantin', kind: 'building',
    name: { tr: 'Kantin', en: 'Kantin' }, sub: { tr: 'Şakir Abi\'nin kantini', en: "Şakir's canteen" },
    info: { tr: 'Tost, ayran ve telefon kartı. Yanında küçük bir basketbol sahası var.', en: 'Toasties, ayran and phone cards. There\'s a small basketball court next to it.' },
    rect: { x: 58, y: 41, w: 5, h: 6 }, doors: [{ x: 60, y: 41, side: 'n' }, { x: 61, y: 41, side: 'n' }], minimapColor: '#93c477',
  },
  {
    id: 'kortlar', kind: 'zone',
    name: { tr: 'Açık Sahalar', en: 'Açık Sahalar' }, sub: { tr: 'Futbol · basketbol', en: 'Outdoor pitches' },
    info: { tr: 'Futbol sahası ve basketbol sahası. Teneffüste herkes burada.', en: 'The football pitch and the basketball court. Everyone is here at break time.' },
    rect: { x: 73, y: 15, w: 18, h: 36 }, label: { x: 82, y: 39.4 }, minimapColor: '#a8483e',
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
  fillPoly(m, rectPts(GATE), T.GATE);

  for (const b of BUILDINGS) {
    const roofTile = b.roof === 'green' ? T.GREEN_ROOF : T.ROOF;
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

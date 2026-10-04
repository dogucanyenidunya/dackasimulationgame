// Daçka campus layout in tiles. Mirrors reference/campus-layout.svg (blockout v3.1).
// North row: Kız Yurdu · Yurt Meydanı · Erkek Yurdu
// Center row: Eğitim Binası (+Kütüphane) · Merkez Meydan · Yemekhane & Sosyal Merkez
// South row: Cemiyet + Müze · Spor Salonu · courts · Teknik Alan. Ana Kapı in the south-west.

import type { Text } from '../i18n';

export const TILE = 32;
export const MAP_W = 74;
export const MAP_H = 56;
/** walkable campus ground; the fence runs one tile outside it */
export const GROUND_RECT = { x0: 4, y0: 4, x1: 69, y1: 51 };

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
} as const;

export const SOLID_TILES = [T.FOREST, T.ROOF, T.SKYLIGHT, T.SOLAR, T.GREEN_ROOF, T.WALL, T.DOOR, T.FENCE, T.COURTYARD, T.DOOR_REVIR, T.WALL_BASE];

export interface Rect { x: number; y: number; w: number; h: number }

export interface Door { x: number; y: number; side: 'n' | 's' | 'e' | 'w'; kind?: 'revir' }

/** room: discovered from inside its parent building's menu */
export type LocationKind = 'building' | 'zone' | 'room';

export interface Location {
  id: string;
  kind: LocationKind;
  name: Text;
  /** short English/Turkish subtitle shown under the name */
  sub: Text;
  info: Text;
  /** footprint used for "seen" distance checks and roof label placement */
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
  rect: Rect;
  roof: 'grey' | 'green' | 'white';
  courtyard?: Rect;
  solar?: Rect[];
  greenPatches?: Rect[];
  skylights?: Rect[];
}

export const BUILDINGS: Building[] = [
  { id: 'kiz_yurdu', rect: { x: 8, y: 6, w: 16, h: 10 }, roof: 'grey', courtyard: { x: 13, y: 8, w: 6, h: 3 } },
  { id: 'erkek_yurdu', rect: { x: 50, y: 6, w: 16, h: 10 }, roof: 'grey', courtyard: { x: 55, y: 8, w: 6, h: 3 } },
  { id: 'egitim', rect: { x: 8, y: 22, w: 16, h: 12 }, roof: 'grey', courtyard: { x: 11, y: 24, w: 10, h: 2 }, skylights: [{ x: 10, y: 28, w: 12, h: 1 }] },
  { id: 'yemekhane', rect: { x: 50, y: 22, w: 16, h: 12 }, roof: 'white', solar: [{ x: 52, y: 23, w: 12, h: 3 }], greenPatches: [{ x: 53, y: 28, w: 10, h: 2 }] },
  { id: 'cemiyet', rect: { x: 6, y: 38, w: 14, h: 10 }, roof: 'grey', courtyard: { x: 9, y: 40, w: 8, h: 2 } },
  { id: 'spor', rect: { x: 26, y: 38, w: 20, h: 10 }, roof: 'white', solar: [{ x: 28, y: 40, w: 16, h: 2 }, { x: 28, y: 43, w: 16, h: 2 }] },
  { id: 'teknik', rect: { x: 60, y: 38, w: 9, h: 9 }, roof: 'green' },
];

export const PLAZAS: Rect[] = [
  { x: 26, y: 6, w: 22, h: 12 },   // Yurt Meydanı
  { x: 26, y: 22, w: 22, h: 12 },  // Merkez Meydan
];

export const PATHS: Rect[] = [
  { x: 4, y: 19, w: 66, h: 2 },
  { x: 4, y: 35, w: 66, h: 2 },
  { x: 36, y: 6, w: 2, h: 32 },
  { x: 24, y: 10, w: 26, h: 2 },
  { x: 24, y: 27, w: 26, h: 2 },
  { x: 21, y: 37, w: 3, h: 15 },
  { x: 20, y: 42, w: 1, h: 2 },
  { x: 19, y: 16, w: 2, h: 3 },
  { x: 9, y: 48, w: 2, h: 1 },
  { x: 58, y: 42, w: 2, h: 2 },
];

export const COURTS = {
  basketball: { x: 48, y: 38, w: 10, h: 5 },
  tennis: { x: 48, y: 43, w: 10, h: 5 },
};

export const GATE: Rect = { x: 21, y: 52, w: 3, h: 1 };

/** player spawn (tile coords, can be fractional) */
export const SPAWN = { x: 22.5, y: 50 };

export const TREES: Array<[number, number]> = [
  [28, 7], [45, 7], [28, 16], [45, 16],
  [28, 23], [45, 23], [28, 32], [45, 32], [32, 25], [41, 31],
  [6, 17], [67, 17], [6, 33], [67, 33], [32, 50], [42, 50], [64, 50], [14, 50],
];

export const BENCHES: Array<[number, number]> = [
  [29, 13], [33, 13], [40, 13], [44, 13],
  [29, 30], [33, 30], [40, 30], [44, 30],
];

/** street lamps: they light up at night */
export const LAMPS: Array<[number, number]> = [
  [25, 18], [49, 18], [25, 34], [49, 34], [12, 18], [62, 18], [12, 34], [62, 34],
  [34, 9], [39, 9], [34, 25], [39, 25], [24, 49], [47, 37],
];

export const FLOWERS: Array<[number, number]> = [
  [27, 8], [46, 8], [27, 15], [46, 15], [31, 23], [42, 23], [31, 32], [42, 32],
];

/** landmarks: the fountain sits on the central plaza crossing, the flag beside it for ceremonies */
export const FOUNTAIN: [number, number] = [37, 28];
export const FLAGPOLE: [number, number] = [42, 25];

/** daytime hangouts for students: [x, y, roam] */
export const HANGOUTS: Array<[number, number, number]> = [
  [30, 12, 3], [43, 12, 3], [37, 8, 2], [30, 26, 3], [43, 26, 3], [37, 31, 2], [52, 36, 2], [40, 36, 2], [14, 18, 2], [60, 18, 2],
];

/** where each age group hangs out by day (lawns between the buildings and the campus walls) */
export type AgeGroup = 'g4' | 'g56' | 'g78' | 'lise';
export const AGE_ZONES: Record<AgeGroup, Rect[]> = {
  // 4th graders: west lawns beside the girls' dorm and the academic building
  g4: [{ x: 4, y: 6, w: 4, h: 10 }, { x: 4, y: 22, w: 4, h: 12 }, { x: 8, y: 16, w: 10, h: 3 }],
  // 5th–6th graders: the strip between the dorms and the north wall
  g56: [{ x: 8, y: 4, w: 16, h: 2 }, { x: 26, y: 4, w: 22, h: 2 }, { x: 4, y: 16, w: 4, h: 3 }],
  // 7th–8th graders: around the boys' dorm, east side
  g78: [{ x: 50, y: 4, w: 16, h: 2 }, { x: 66, y: 6, w: 4, h: 12 }, { x: 50, y: 16, w: 16, h: 3 }],
  // high schoolers: east of the dining hall and the south lawns by the sports hall
  lise: [{ x: 66, y: 22, w: 4, h: 12 }, { x: 26, y: 48, w: 20, h: 4 }, { x: 47, y: 48, w: 22, h: 4 }],
};
/** the plazas in the middle: everyone mixes here */
export const CENTER_ZONES: Rect[] = [{ x: 27, y: 7, w: 20, h: 10 }, { x: 27, y: 23, w: 20, h: 10 }];

/** 20:00–22:00 you may be anywhere around the dorms: the dorm plaza and the lawns around both dorms (incl. the infirmary door) */
export const PLAZA_EVENING: Rect = { x: 4, y: 4, w: 66, h: 15 };
export const PLAZA_ALLOWED: Rect[] = [PLAZA_EVENING];

/** evening (20:00–22:00) spots around the dorms, one per grade; the dorm plaza in the middle is the mixed crowd */
export const EVENING_ZONES: Record<'4' | '5' | '6' | '7' | '8' | 'lise', Rect> = {
  '4': { x: 4, y: 6, w: 4, h: 10 },     // west lawn by the girls' dorm
  '5': { x: 8, y: 16, w: 10, h: 3 },    // south of the girls' dorm
  '6': { x: 8, y: 4, w: 16, h: 2 },     // north of the girls' dorm
  '7': { x: 50, y: 4, w: 16, h: 2 },    // north of the boys' dorm
  '8': { x: 66, y: 6, w: 4, h: 10 },    // east lawn by the boys' dorm
  lise: { x: 50, y: 16, w: 16, h: 3 },  // south of the boys' dorm
};
export const EVENING_CENTER: Rect = { x: 27, y: 7, w: 20, h: 10 };

/** Selim Bey's night patrol loop */
export const PATROL_ROUTE: Array<[number, number]> = [[37, 13], [37, 30], [25, 28], [37, 35], [49, 28], [37, 19], [27, 10], [47, 10]];

export const LOCATIONS: Location[] = [
  {
    id: 'ana_kapi', kind: 'zone',
    name: { tr: 'Ana Kapı', en: 'Ana Kapı' }, sub: { tr: 'Ana giriş', en: 'Main gate' },
    info: { tr: 'Herkesin hikâyesi burada başlar. Pazar günleri ziyaret günüdür.', en: "Everyone's story starts here. Sundays are visiting day." },
    rect: { x: 19, y: 48, w: 7, h: 4 }, label: { x: 22.5, y: 49 }, minimapColor: '#8a2d2d',
  },
  {
    id: 'cemiyet', kind: 'building',
    name: { tr: 'Cemiyet Binası', en: 'Cemiyet Binası' }, sub: { tr: 'Yönetim · kayıt', en: 'Administration · registration' },
    info: {
      tr: 'İlk durağın: kayıt burada yapılır. Müdür, rehber öğretmen ve ziyaretçi odası buradadır. Ambar (−1. kat) üniforma, ayakkabı ve eşofman dağıtır.',
      en: 'Your first stop: registration happens here. The principal, the guidance counselor and the visitors\' room are here. The Ambar (floor −1) hands out uniforms, shoes and tracksuits.',
    },
    rect: { x: 6, y: 38, w: 14, h: 10 }, doors: [{ x: 19, y: 42, side: 'e' }, { x: 19, y: 43, side: 'e' }], minimapColor: '#b9c0c6',
  },
  {
    id: 'muze', kind: 'building',
    name: { tr: 'Müze', en: 'Müze' }, sub: { tr: 'Okulun tarihi', en: "The school's history" },
    info: { tr: 'Okulun 1863\'ten bu yana hikâyesi. Her yıl yeni bir bölüm açılır.', en: "The school's story since 1863. A new chapter opens every year." },
    rect: { x: 7, y: 43, w: 6, h: 5 }, doors: [{ x: 9, y: 47, side: 's' }, { x: 10, y: 47, side: 's' }],
    label: { x: 10, y: 44.5 }, revealRect: { x: 6, y: 38, w: 14, h: 10 }, minimapColor: '#7a4e2a',
  },
  {
    id: 'kiz_yurdu', kind: 'building',
    name: { tr: 'Kız Yurdu', en: 'Kız Yurdu' }, sub: { tr: 'Kızların yurdu · A1–A3 blokları', en: "Girls' dorm · blocks A1–A3" },
    info: { tr: 'A1, A2 ve A3 blokları; her blokta 4 kat ve 14 bölüm. Girişi Yurt Meydanı\'na ve Erkek Yurdu\'na bakar.', en: 'Blocks A1, A2 and A3, each with 4 floors and 14 sections. The entrance faces the dorm plaza and the boys\' dorm.' },
    rect: { x: 8, y: 6, w: 16, h: 10 }, doors: [{ x: 23, y: 10, side: 'e' }, { x: 23, y: 11, side: 'e' }], minimapColor: '#d98fa8',
  },
  {
    id: 'revir', kind: 'building',
    name: { tr: 'Revir', en: 'Revir' }, sub: { tr: 'Kız Yurdu −1. kat · herkese açık', en: "Infirmary · girls' dorm floor −1 · everyone" },
    info: { tr: 'Hemşire gece gündüz burada. Kendi dış girişi var; herkes kullanabilir.', en: 'The nurse is here day and night. It has its own outside entrance, so everyone can use it.' },
    rect: { x: 17, y: 13, w: 6, h: 3 }, doors: [{ x: 19, y: 15, side: 's' }, { x: 20, y: 15, side: 's', kind: 'revir' }],
    label: { x: 20, y: 13.5 }, revealRect: { x: 8, y: 6, w: 16, h: 10 }, minimapColor: '#c0392b',
  },
  {
    id: 'erkek_yurdu', kind: 'building',
    name: { tr: 'Erkek Yurdu', en: 'Erkek Yurdu' }, sub: { tr: 'Erkeklerin yurdu · A1–A3 blokları', en: "Boys' dorm · blocks A1–A3" },
    info: { tr: 'A1, A2 ve A3 blokları; her blokta 4 kat ve 14 bölüm. Girişi Yurt Meydanı\'na ve Kız Yurdu\'na bakar.', en: 'Blocks A1, A2 and A3, each with 4 floors and 14 sections. The entrance faces the dorm plaza and the girls\' dorm.' },
    rect: { x: 50, y: 6, w: 16, h: 10 }, doors: [{ x: 50, y: 10, side: 'w' }, { x: 50, y: 11, side: 'w' }], minimapColor: '#7fa8d9',
  },
  {
    id: 'yurt_meydani', kind: 'zone',
    name: { tr: 'Yurt Meydanı', en: 'Yurt Meydanı' }, sub: { tr: 'Yurtlar arası meydan', en: 'Dorm plaza' },
    info: { tr: 'Akşam buluşma yeri. İki yurt karşılıklı bakar.', en: 'The evening hangout. The two dorms face each other here.' },
    rect: { x: 26, y: 6, w: 22, h: 12 }, label: { x: 37, y: 15.5 }, minimapColor: '#a9cf95',
  },
  {
    id: 'merkez_meydan', kind: 'zone',
    name: { tr: 'Merkez Meydan', en: 'Merkez Meydan' }, sub: { tr: 'Okul ile yemekhane arası', en: 'Central plaza' },
    info: { tr: 'Dersler ile yemekler arasındaki günlük geçit. Törenler burada yapılır.', en: 'The daily crossing between lessons and meals. Ceremonies happen here.' },
    rect: { x: 26, y: 22, w: 22, h: 12 }, label: { x: 37, y: 31.5 }, minimapColor: '#a9cf95',
  },
  {
    id: 'egitim', kind: 'building',
    name: { tr: 'Eğitim Binası', en: 'Eğitim Binası' }, sub: { tr: 'Okul + Kütüphane', en: 'Academic building + library' },
    info: { tr: 'Kuzeyde ortaokul kanadı, ortada Kütüphane, güneyde lise kanadı. Öğretmenler odası da burada.', en: 'Middle school wing to the north, the library in the middle, high school wing to the south. The teachers\' room is here too.' },
    rect: { x: 8, y: 22, w: 16, h: 12 }, doors: [{ x: 23, y: 27, side: 'e' }, { x: 23, y: 28, side: 'e' }], minimapColor: '#c9a46a',
  },
  {
    id: 'kutuphane', kind: 'room',
    name: { tr: 'Kütüphane', en: 'Kütüphane' }, sub: { tr: 'Eğitim Binası içinde', en: 'Library · inside the academic building' },
    info: { tr: 'Ders kitapları, okuma rafları ve sessiz çalışma masaları.', en: 'Textbooks, reading shelves and quiet study desks.' },
    rect: { x: 10, y: 27, w: 12, h: 3 }, label: { x: 16, y: 28.5 }, minimapColor: '#c9a46a',
  },
  {
    id: 'yemekhane', kind: 'building',
    name: { tr: 'Yemekhane', en: 'Yemekhane' }, sub: { tr: 'Yemekhane & Sosyal Merkez', en: 'Dining hall & social center' },
    info: { tr: 'Kahvaltı 07:00, öğle 12:20, akşam 17:00. Kantin, konferans salonu, kulüp odaları ve çatı terasları.', en: 'Breakfast 07:00, lunch 12:20, dinner 17:00. Canteen, auditorium, club rooms and roof terraces.' },
    rect: { x: 50, y: 22, w: 16, h: 12 }, doors: [{ x: 50, y: 27, side: 'w' }, { x: 50, y: 28, side: 'w' }], minimapColor: '#9fb3c8',
  },
  {
    id: 'spor', kind: 'building',
    name: { tr: 'Spor Salonu', en: 'Spor Salonu' }, sub: { tr: 'Havuz · eskrim · basketbol', en: 'Pool · fencing · basketball' },
    info: { tr: 'Basketbol, voleybol, futsal, yüzme havuzu ve eskrim salonu. Antrenörlerin odası da burada.', en: "Basketball, volleyball, futsal, the swimming pool and the fencing room. The coaches' office is here too." },
    rect: { x: 26, y: 38, w: 20, h: 10 }, doors: [{ x: 36, y: 38, side: 'n' }, { x: 37, y: 38, side: 'n' }], minimapColor: '#dfe3e6',
  },
  {
    id: 'kortlar', kind: 'zone',
    name: { tr: 'Açık Kortlar', en: 'Açık Kortlar' }, sub: { tr: 'Basketbol · tenis', en: 'Outdoor courts' },
    info: { tr: 'Basketbol, mini futbol ve tenis. Teneffüste herkes burada.', en: 'Basketball, mini football and tennis. Everyone is here at break time.' },
    rect: { x: 48, y: 38, w: 10, h: 10 }, label: { x: 53, y: 43 }, minimapColor: '#a8483e',
  },
  {
    id: 'teknik', kind: 'building',
    name: { tr: 'Teknik Alan', en: 'Teknik Alan' }, sub: { tr: 'Kısıtlı alan', en: 'Restricted area' },
    info: { tr: 'Hademe Hüseyin Usta\'nın atölyesi ve kazan dairesi. Kapı kilitli… şimdilik.', en: "Caretaker Hüseyin Usta's workshop and the boiler room. The door is locked… for now." },
    rect: { x: 60, y: 38, w: 9, h: 9 }, doors: [{ x: 60, y: 42, side: 'w' }, { x: 60, y: 43, side: 'w' }], minimapColor: '#7fb466',
  },
];

export function buildMap(): number[][] {
  const m: number[][] = [];
  for (let y = 0; y < MAP_H; y++) {
    const row: number[] = [];
    for (let x = 0; x < MAP_W; x++) {
      const g = GROUND_RECT;
      const inside = x >= g.x0 && x <= g.x1 && y >= g.y0 && y <= g.y1;
      const onRing = (x === g.x0 - 1 || x === g.x1 + 1) && y >= g.y0 - 1 && y <= g.y1 + 1
        || (y === g.y0 - 1 || y === g.y1 + 1) && x >= g.x0 - 1 && x <= g.x1 + 1;
      const fence = onRing;
      row.push(inside ? T.GROUND : fence ? T.FENCE : T.FOREST);
    }
    m.push(row);
  }
  const fill = (r: Rect, t: number) => {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      if (y >= 0 && y < MAP_H && x >= 0 && x < MAP_W) m[y][x] = t;
    }
  };
  PLAZAS.forEach((p) => fill(p, T.PLAZA));
  PATHS.forEach((p) => fill(p, T.PATH));
  fill(COURTS.basketball, T.COURT_RED);
  fill(COURTS.tennis, T.COURT_BLUE);
  fill(GATE, T.GATE);

  for (const b of BUILDINGS) {
    const r = b.rect;
    const roofTile = b.roof === 'green' ? T.GREEN_ROOF : T.ROOF;
    fill({ x: r.x, y: r.y, w: r.w, h: r.h - 2 }, roofTile);
    fill({ x: r.x, y: r.y + r.h - 2, w: r.w, h: 1 }, T.WALL);
    fill({ x: r.x, y: r.y + r.h - 1, w: r.w, h: 1 }, T.WALL_BASE);
    if (b.courtyard) fill(b.courtyard, T.COURTYARD);
    b.solar?.forEach((s) => fill(s, T.SOLAR));
    b.greenPatches?.forEach((s) => fill(s, T.GREEN_ROOF));
    b.skylights?.forEach((s) => fill(s, T.SKYLIGHT));
  }
  for (const loc of LOCATIONS) {
    for (const d of loc.doors ?? []) m[d.y][d.x] = d.kind === 'revir' || loc.id === 'revir' ? T.DOOR_REVIR : T.DOOR;
  }
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

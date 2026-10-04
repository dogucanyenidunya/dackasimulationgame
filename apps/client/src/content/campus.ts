// Daçka campus layout in tiles (layout v4, from the hand sketch).
// North row: Kız Yurdu · Yurt Meydanı (fountain) · Erkek Yurdu
// Middle row: Eğitim Binası · Kütüphane · Yemekhane & Konferans Salonu (tall, east)
// Merkez Meydan with the Atatürk bust in the very centre; Ana Kapı on the west wall.
// South row: Cemiyet + Müze · Spor Salonu · basketball court + football pitch · Teknik Alan.

import type { Text } from '../i18n';

export const TILE = 32;
export const MAP_W = 96;
export const MAP_H = 56;
/** walkable campus ground; the fence runs one tile outside it */
export const GROUND_RECT = { x0: 4, y0: 4, x1: 91, y1: 51 };
/** bump when buildings move: old saves get their fog and position reset */
export const LAYOUT = 4;

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
  { id: 'kiz_yurdu', rect: { x: 12, y: 6, w: 16, h: 10 }, roof: 'grey', courtyard: { x: 17, y: 8, w: 6, h: 3 } },
  { id: 'erkek_yurdu', rect: { x: 68, y: 6, w: 16, h: 10 }, roof: 'grey', courtyard: { x: 73, y: 8, w: 6, h: 3 } },
  { id: 'egitim', rect: { x: 10, y: 19, w: 32, h: 11 }, roof: 'grey', courtyard: { x: 15, y: 21, w: 22, h: 2 }, skylights: [{ x: 13, y: 25, w: 26, h: 1 }] },
  { id: 'kutuphane', rect: { x: 52, y: 19, w: 13, h: 10 }, roof: 'grey', skylights: [{ x: 54, y: 21, w: 9, h: 1 }, { x: 54, y: 23, w: 9, h: 1 }] },
  { id: 'yemekhane', rect: { x: 70, y: 20, w: 13, h: 20 }, roof: 'white', solar: [{ x: 72, y: 22, w: 9, h: 4 }], greenPatches: [{ x: 72, y: 29, w: 9, h: 5 }] },
  { id: 'cemiyet', rect: { x: 12, y: 36, w: 16, h: 11 }, roof: 'grey', courtyard: { x: 16, y: 38, w: 8, h: 2 } },
  { id: 'spor', rect: { x: 32, y: 38, w: 30, h: 8 }, roof: 'white', solar: [{ x: 34, y: 40, w: 26, h: 2 }] },
  { id: 'teknik', rect: { x: 79, y: 42, w: 10, h: 8 }, roof: 'green' },
];

export const PLAZAS: Rect[] = [
  { x: 32, y: 6, w: 32, h: 10 },   // Yurt Meydanı
  { x: 30, y: 30, w: 36, h: 7 },   // Merkez Meydan
];

export const PATHS: Rect[] = [
  { x: 4, y: 16, w: 88, h: 2 },    // north road, past both dorms
  { x: 4, y: 31, w: 26, h: 3 },    // from the main gate to the central plaza
  { x: 46, y: 18, w: 4, h: 12 },   // the central axis between the academic building and the library
  { x: 28, y: 10, w: 4, h: 2 },    // girls' dorm door → dorm plaza
  { x: 64, y: 10, w: 4, h: 2 },    // boys' dorm door → dorm plaza
  { x: 56, y: 29, w: 4, h: 1 },    // library steps
  { x: 66, y: 29, w: 4, h: 2 },    // central plaza → dining hall
  { x: 30, y: 37, w: 36, h: 1 },   // along the sports hall front
  { x: 28, y: 34, w: 2, h: 14 },   // gate road → Cemiyet door → museum
  { x: 14, y: 47, w: 16, h: 1 },   // past the museum door
  { x: 62, y: 38, w: 3, h: 8 },    // east of the sports hall, down to the pitches
  { x: 30, y: 46, w: 32, h: 1 },   // behind the sports hall
  { x: 74, y: 40, w: 2, h: 5 },    // dining hall → technical area
  { x: 72, y: 45, w: 7, h: 2 },
];

export const COURTS = {
  basketball: { x: 42, y: 47, w: 9, h: 5 },
  football: { x: 53, y: 47, w: 18, h: 5 },
};

/** the main gate, in the west wall */
export const GATE: Rect = { x: 3, y: 31, w: 1, h: 3 };

/** player spawn (tile coords, can be fractional) */
export const SPAWN = { x: 5.2, y: 32.5 };

export const TREES: Array<[number, number]> = [
  [6, 8], [6, 13], [31, 6], [65, 6], [31, 14], [65, 14], [87, 8], [87, 13],
  [5, 21], [5, 27], [44, 20], [44, 26], [67, 21], [67, 26], [87, 23], [87, 30], [87, 37],
  [6, 37], [6, 44], [8, 49], [31, 48], [36, 48], [76, 49], [90, 49],
];

export const BENCHES: Array<[number, number]> = [
  [34, 13], [38, 13], [57, 13], [61, 13],
  [33, 35], [38, 35], [58, 35], [63, 35],
];

/** street lamps: they light up at night */
export const LAMPS: Array<[number, number]> = [
  [11, 18], [30, 18], [64, 18], [85, 18], [9, 30], [24, 30], [44, 29], [51, 29], [65, 31],
  [40, 8], [56, 8], [27, 46], [65, 37], [76, 41], [40, 45],
];

export const FLOWERS: Array<[number, number]> = [
  [33, 7], [62, 7], [33, 15], [62, 15], [31, 31], [64, 31], [42, 34], [53, 34],
];

/** landmarks: the fountain in the dorm plaza; the Atatürk bust in the very centre of the campus, with the flag beside it */
export const FOUNTAIN: [number, number] = [48, 11];
export const BUST: [number, number] = [48, 33];
export const FLAGPOLE: [number, number] = [51, 31];

/** daytime hangouts for students: [x, y, roam] */
export const HANGOUTS: Array<[number, number, number]> = [
  [36, 12, 3], [60, 12, 3], [48, 8, 2], [36, 33, 3], [61, 33, 3], [44, 23, 2], [67, 24, 2], [87, 27, 2], [20, 17, 2], [8, 33, 2],
];

/** where each age group hangs out by day (lawns between the buildings and the campus walls) */
export type AgeGroup = 'g4' | 'g56' | 'g78' | 'lise';
export const AGE_ZONES: Record<AgeGroup, Rect[]> = {
  // 4th graders: the west lawns by the girls' dorm and the academic building
  g4: [{ x: 4, y: 6, w: 7, h: 10 }, { x: 4, y: 19, w: 5, h: 11 }],
  // 5th–6th graders: the strip along the north wall
  g56: [{ x: 12, y: 4, w: 16, h: 2 }, { x: 30, y: 4, w: 36, h: 2 }],
  // 7th–8th graders: around the boys' dorm, north-east
  g78: [{ x: 68, y: 4, w: 16, h: 2 }, { x: 85, y: 6, w: 6, h: 10 }],
  // high schoolers: east of the dining hall and the lawn south of the sports hall
  lise: [{ x: 84, y: 20, w: 7, h: 20 }, { x: 30, y: 48, w: 11, h: 3 }],
};
/** the plazas in the middle: everyone mixes here */
export const CENTER_ZONES: Rect[] = [{ x: 33, y: 7, w: 30, h: 8 }, { x: 31, y: 31, w: 34, h: 5 }];

/** 20:00–22:00 you may be anywhere around the dorms: the dorm plaza, the lawns around both dorms and the north road (incl. the infirmary door) */
export const PLAZA_EVENING: Rect = { x: 4, y: 4, w: 88, h: 14 };
export const PLAZA_ALLOWED: Rect[] = [PLAZA_EVENING];

/** evening (20:00–22:00) spots around the dorms, one per grade; the dorm plaza in the middle is the mixed crowd */
export const EVENING_ZONES: Record<'4' | '5' | '6' | '7' | '8' | 'lise', Rect> = {
  '4': { x: 4, y: 6, w: 7, h: 10 },     // west lawn by the girls' dorm
  '5': { x: 4, y: 16, w: 8, h: 2 },     // west end of the north road
  '6': { x: 12, y: 4, w: 16, h: 2 },    // north of the girls' dorm
  '7': { x: 68, y: 4, w: 16, h: 2 },    // north of the boys' dorm
  '8': { x: 85, y: 6, w: 6, h: 10 },    // east lawn by the boys' dorm
  lise: { x: 68, y: 16, w: 16, h: 2 },  // south of the boys' dorm
};
export const EVENING_CENTER: Rect = { x: 33, y: 7, w: 30, h: 8 };

/** Selim Bey's night patrol loop */
export const PATROL_ROUTE: Array<[number, number]> = [[48, 13], [48, 24], [38, 33], [48, 36], [60, 33], [48, 20], [33, 10], [63, 10]];

export const LOCATIONS: Location[] = [
  {
    id: 'ana_kapi', kind: 'zone',
    name: { tr: 'Ana Kapı', en: 'Ana Kapı' }, sub: { tr: 'Ana giriş', en: 'Main gate' },
    info: { tr: 'Herkesin hikâyesi burada başlar. Pazar günleri ziyaret günüdür.', en: "Everyone's story starts here. Sundays are visiting day." },
    rect: { x: 3, y: 29, w: 7, h: 7 }, label: { x: 6.5, y: 29.6 }, minimapColor: '#8a2d2d',
  },
  {
    id: 'cemiyet', kind: 'building',
    name: { tr: 'Cemiyet Binası', en: 'Cemiyet Binası' }, sub: { tr: 'Yönetim · kayıt', en: 'Administration · registration' },
    info: {
      tr: 'İlk durağın: kayıt burada yapılır. Müdür, rehber öğretmen ve ziyaretçi odası buradadır. Ambar (−1. kat) üniforma, ayakkabı ve eşofman dağıtır.',
      en: 'Your first stop: registration happens here. The principal, the guidance counselor and the visitors\' room are here. The Ambar (floor −1) hands out uniforms, shoes and tracksuits.',
    },
    rect: { x: 12, y: 36, w: 16, h: 11 }, doors: [{ x: 27, y: 40, side: 'e' }, { x: 27, y: 41, side: 'e' }], minimapColor: '#b9c0c6',
  },
  {
    id: 'muze', kind: 'building',
    name: { tr: 'Müze', en: 'Müze' }, sub: { tr: 'Okulun tarihi', en: "The school's history" },
    info: { tr: 'Okulun 1863\'ten bu yana hikâyesi. Her yıl yeni bir bölüm açılır.', en: "The school's story since 1863. A new chapter opens every year." },
    rect: { x: 13, y: 42, w: 6, h: 5 }, doors: [{ x: 15, y: 46, side: 's' }, { x: 16, y: 46, side: 's' }],
    label: { x: 16, y: 43.5 }, revealRect: { x: 12, y: 36, w: 16, h: 11 }, minimapColor: '#7a4e2a',
  },
  {
    id: 'kiz_yurdu', kind: 'building',
    name: { tr: 'Kız Yurdu', en: 'Kız Yurdu' }, sub: { tr: 'Kızların yurdu · A1–A3 blokları', en: "Girls' dorm · blocks A1–A3" },
    info: { tr: 'A1, A2 ve A3 blokları; her blokta 4 kat ve 14 bölüm. Girişi Yurt Meydanı\'na ve Erkek Yurdu\'na bakar.', en: 'Blocks A1, A2 and A3, each with 4 floors and 14 sections. The entrance faces the dorm plaza and the boys\' dorm.' },
    rect: { x: 12, y: 6, w: 16, h: 10 }, doors: [{ x: 27, y: 10, side: 'e' }, { x: 27, y: 11, side: 'e' }], minimapColor: '#d98fa8',
  },
  {
    id: 'revir', kind: 'building',
    name: { tr: 'Revir', en: 'Revir' }, sub: { tr: 'Kız Yurdu −1. kat · herkese açık', en: "Infirmary · girls' dorm floor −1 · everyone" },
    info: { tr: 'Hemşire gece gündüz burada. Kendi dış girişi var; herkes kullanabilir.', en: 'The nurse is here day and night. It has its own outside entrance, so everyone can use it.' },
    rect: { x: 21, y: 13, w: 6, h: 3 }, doors: [{ x: 23, y: 15, side: 's' }, { x: 24, y: 15, side: 's', kind: 'revir' }],
    label: { x: 24, y: 13.5 }, revealRect: { x: 12, y: 6, w: 16, h: 10 }, minimapColor: '#c0392b',
  },
  {
    id: 'erkek_yurdu', kind: 'building',
    name: { tr: 'Erkek Yurdu', en: 'Erkek Yurdu' }, sub: { tr: 'Erkeklerin yurdu · A1–A3 blokları', en: "Boys' dorm · blocks A1–A3" },
    info: { tr: 'A1, A2 ve A3 blokları; her blokta 4 kat ve 14 bölüm. Girişi Yurt Meydanı\'na ve Kız Yurdu\'na bakar.', en: 'Blocks A1, A2 and A3, each with 4 floors and 14 sections. The entrance faces the dorm plaza and the girls\' dorm.' },
    rect: { x: 68, y: 6, w: 16, h: 10 }, doors: [{ x: 68, y: 10, side: 'w' }, { x: 68, y: 11, side: 'w' }], minimapColor: '#7fa8d9',
  },
  {
    id: 'yurt_meydani', kind: 'zone',
    name: { tr: 'Yurt Meydanı', en: 'Yurt Meydanı' }, sub: { tr: 'Yurtlar arası meydan', en: 'Dorm plaza' },
    info: { tr: 'Akşam buluşma yeri. İki yurt karşılıklı bakar; ortada fıskiye var.', en: 'The evening hangout. The two dorms face each other, with the fountain in the middle.' },
    rect: { x: 30, y: 5, w: 36, h: 12 }, label: { x: 48, y: 14.5 }, minimapColor: '#a9cf95',
  },
  {
    id: 'merkez_meydan', kind: 'zone',
    name: { tr: 'Merkez Meydan', en: 'Merkez Meydan' }, sub: { tr: 'Atatürk büstü · tören alanı', en: 'Atatürk bust · ceremonies' },
    info: { tr: 'Kampüsün tam ortası. Atatürk büstünün önünde törenler yapılır; dersler, kütüphane ve spor salonu arasındaki günlük geçit.', en: 'The very centre of the campus. Ceremonies are held in front of the Atatürk bust; the daily crossing between lessons, the library and the sports hall.' },
    rect: { x: 30, y: 30, w: 36, h: 7 }, label: { x: 48, y: 35.8 }, minimapColor: '#a9cf95',
  },
  {
    id: 'egitim', kind: 'building',
    name: { tr: 'Eğitim Binası', en: 'Eğitim Binası' }, sub: { tr: 'Sınıflar · öğretmenler odası', en: 'Classrooms · teachers\' room' },
    info: { tr: 'Batıda ortaokul kanadı, doğuda lise kanadı. Öğretmenler odası da burada. Girişi Merkez Meydan\'a bakar.', en: 'Middle school wing to the west, high school wing to the east. The teachers\' room is here too. The entrance faces the central plaza.' },
    rect: { x: 10, y: 19, w: 32, h: 11 }, doors: [{ x: 35, y: 29, side: 's' }, { x: 36, y: 29, side: 's' }], minimapColor: '#c9a46a',
  },
  {
    id: 'kutuphane', kind: 'building',
    name: { tr: 'Kütüphane', en: 'Kütüphane' }, sub: { tr: 'Ders kitapları · okuma salonu', en: 'Textbooks · reading room' },
    info: { tr: 'Ders kitapları, okuma rafları ve sessiz çalışma masaları. Kütüphaneci Nermin Hanım\'ın yeri.', en: 'Textbooks, reading shelves and quiet study desks. Librarian Ms. Nermin\'s domain.' },
    rect: { x: 52, y: 19, w: 13, h: 10 }, doors: [{ x: 57, y: 28, side: 's' }, { x: 58, y: 28, side: 's' }], minimapColor: '#b58f5e',
  },
  {
    id: 'yemekhane', kind: 'building',
    name: { tr: 'Yemekhane', en: 'Yemekhane' }, sub: { tr: 'Yemekhane & Konferans Salonu', en: 'Dining hall & conference hall' },
    info: { tr: 'Kahvaltı 07:00, öğle 12:20, akşam 17:00. Kantin, konferans salonu, kulüp odaları ve çatı terasları.', en: 'Breakfast 07:00, lunch 12:20, dinner 17:00. Canteen, conference hall, club rooms and roof terraces.' },
    rect: { x: 70, y: 20, w: 13, h: 20 }, doors: [{ x: 70, y: 29, side: 'w' }, { x: 70, y: 30, side: 'w' }], minimapColor: '#9fb3c8',
  },
  {
    id: 'spor', kind: 'building',
    name: { tr: 'Spor Salonu', en: 'Spor Salonu' }, sub: { tr: 'Havuz · eskrim · basketbol', en: 'Pool · fencing · basketball' },
    info: { tr: 'Basketbol, voleybol, futsal, yüzme havuzu ve eskrim salonu. Antrenörlerin odası da burada.', en: "Basketball, volleyball, futsal, the swimming pool and the fencing room. The coaches' office is here too." },
    rect: { x: 32, y: 38, w: 30, h: 8 }, doors: [{ x: 46, y: 38, side: 'n' }, { x: 47, y: 38, side: 'n' }], minimapColor: '#dfe3e6',
  },
  {
    id: 'kortlar', kind: 'zone',
    name: { tr: 'Açık Sahalar', en: 'Açık Sahalar' }, sub: { tr: 'Basketbol · futbol', en: 'Outdoor pitches' },
    info: { tr: 'Basketbol sahası ve futbol sahası. Teneffüste herkes burada.', en: 'The basketball court and the football pitch. Everyone is here at break time.' },
    rect: { x: 42, y: 46, w: 30, h: 6 }, label: { x: 56, y: 47.2 }, minimapColor: '#a8483e',
  },
  {
    id: 'teknik', kind: 'building',
    name: { tr: 'Teknik Alan', en: 'Teknik Alan' }, sub: { tr: 'Kısıtlı alan', en: 'Restricted area' },
    info: { tr: 'Hademe Hüseyin Usta\'nın atölyesi ve kazan dairesi. Kapı kilitli… şimdilik.', en: "Caretaker Hüseyin Usta's workshop and the boiler room. The door is locked… for now." },
    rect: { x: 79, y: 42, w: 10, h: 8 }, doors: [{ x: 79, y: 45, side: 'w' }, { x: 79, y: 46, side: 'w' }], minimapColor: '#7fb466',
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

/** Cemil Emmi sweeps in front of the boys' dorm by day */
export const CEMIL_OUT: [number, number] = [65.5, 13.4];

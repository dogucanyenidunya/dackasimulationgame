// Player progress for the prototype (needs, money, school). Lives inside SaveData.
import type { Text } from '../i18n';

export type SubjectId = 'turkce' | 'matematik' | 'fen' | 'sosyal' | 'ingilizce';
export type SportId = 'basketball' | 'volleyball' | 'football' | 'tennis' | 'swimming' | 'fencing' | 'athletics' | 'tabletennis' | 'chess';
export type MealId = 'breakfast' | 'lunch' | 'dinner';
export type BookId = 'kucuk_prens' | 'pal_sokagi' | 'nasreddin';

export const SUBJECTS: Array<{ id: SubjectId; name: Text }> = [
  { id: 'turkce', name: { tr: 'Türkçe', en: 'Turkish' } },
  { id: 'matematik', name: { tr: 'Matematik', en: 'Math' } },
  { id: 'fen', name: { tr: 'Fen Bilimleri', en: 'Science' } },
  { id: 'sosyal', name: { tr: 'Sosyal Bilgiler', en: 'Social Studies' } },
  { id: 'ingilizce', name: { tr: 'İngilizce', en: 'English' } },
];

export interface PlayerState {
  energy: number;
  hunger: number; // 100 = full
  mood: number;
  money: number;
  xp: number;
  school: {
    registered: boolean;
    kit: boolean;
    books: boolean;
    classLabel: string;
    /** dorm section (1–14) on your current floor; the block and floor follow from the school year */
    section: number;
    /** lesson keys attended, `${day}-${periodId}` */
    attended: string[];
    scores: Record<SubjectId, number[]>;
    /** pending homework and the day it was given (due by the next morning) */
    homework: Array<{ s: SubjectId; day: number }>;
  };
  sport: SportId | null;
  trainings: number;
  reading: { book: BookId | null; sessions: number; finished: BookId[] };
  meals: MealId[];
  /** per-day once-only actions: key -> day number it was last done */
  daily: Record<string, number>;
  /** one-time flags (museum chapter, allowance week, …) */
  once: Record<string, boolean>;
  lastAllowanceWeek: number;
  /** 0–100; low health makes you sick (GDD §6.2.1) */
  health: number;
  sick: boolean;
  everSick: boolean;
  /** friendship with classmates and older students, -100…100 */
  friends: Record<string, number>;
  /** the abi/abla favor chain (Year 1 mission "Abi'den Sandviç") */
  favor: { giver: string | null; stage: 'none' | 'accepted' | 'done' | 'rewarded' };
  examPassed: boolean;
  missionsDone: string[];
  /** missions whose "new mission" card was already shown */
  announced: string[];
  yearDone: boolean;
  /** school year (1 = grade 4); dorm floor and some rules depend on it */
  year: number;
  /** discipline record, lower is better (GDD §6.6) */
  discipline: number;
  lastPenaltyDay: number;
  /** out of the dorm at night after a successful escape */
  escaped: boolean;
  escapes: number;
  /** optional name you gave your friend group */
  groupName?: string;
}

export function defaultState(): PlayerState {
  return {
    energy: 90, hunger: 70, mood: 60, money: 50, xp: 0,
    school: {
      registered: false, kit: false, books: false, classLabel: '4-A', section: 1 + Math.floor(Math.random() * DORM_SECTIONS),
      attended: [], scores: { turkce: [], matematik: [], fen: [], sosyal: [], ingilizce: [] }, homework: [],
    },
    sport: null, trainings: 0,
    reading: { book: null, sessions: 0, finished: [] },
    meals: [], daily: {}, once: {}, lastAllowanceWeek: 1,
    health: 90, sick: false, everSick: false, friends: {},
    favor: { giver: null, stage: 'none' }, examPassed: false, missionsDone: [], announced: [], yearDone: false,
    year: 1, discipline: 0, lastPenaltyDay: 0, escaped: false, escapes: 0,
  };
}

/** merge older saves with any fields added since */
export function withDefaults(s: Partial<PlayerState> | undefined): PlayerState {
  const d = defaultState();
  if (!s) return d;
  const merged: PlayerState = {
    ...d, ...s,
    school: { ...d.school, ...s.school, scores: { ...d.school.scores, ...s.school?.scores } },
    reading: { ...d.reading, ...s.reading },
    favor: { ...d.favor, ...s.favor },
  };
  // older saves stored homework as plain subject ids
  merged.school.homework = (merged.school.homework as unknown[]).map((h) => (typeof h === 'string' ? { s: h as SubjectId, day: 1 } : h as { s: SubjectId; day: number }));
  // meals eaten before they started counting (older versions) are still in the daily log: credit them
  for (const m of ['breakfast', 'lunch', 'dinner'] as const) {
    if (merged.daily[`meal-${m}`] !== undefined && !merged.meals.includes(m)) merged.meals.push(m);
  }
  return merged;
}

export const clamp = (v: number) => Math.max(0, Math.min(100, v));

export function average(xs: number[]): number | null {
  return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
}

export const YEAR1_XP = 2000;
export const grade = (year: number) => year + 3;
/** sneaking out of the dorm unlocks in grade 6 (add ?dev to the URL to try it earlier) */
export const ESCAPE_FROM_YEAR = 3;
export const DEV = typeof location !== 'undefined' && new URLSearchParams(location.search).has('dev');

export function behaviorGrade(discipline: number): Text {
  if (discipline < 20) return { tr: 'Çok iyi', en: 'Very good' };
  if (discipline < 40) return { tr: 'İyi', en: 'Good' };
  if (discipline < 60) return { tr: 'Orta', en: 'Fair' };
  return { tr: 'Zayıf', en: 'Poor' };
}

/**
 * Dorm address: each dorm (boys'/girls') has blocks A1–A3, 4 floors each, 14 sections per floor.
 * You start low in A1 and move up a floor every year, then on to A2 and A3.
 */
export const DORM_SECTIONS = 14;
export function dormPlace(year: number): { block: 'A1' | 'A2' | 'A3'; floor: number } {
  const i = Math.max(0, Math.min(11, year - 1)); // Y1–4: A1 floors 1–4 · Y5–8: A2 floors 1–4 · Y9–10: A3 floors 1–2
  return { block: (['A1', 'A2', 'A3'] as const)[Math.floor(i / 4)], floor: (i % 4) + 1 };
}
export const LESSONS_FOR_EXAM = 6;
export const FRIEND_AT = 40;

/** autumn → winter (flu season, coat matters) → spring, by day of the school year */
export function season(day: number): 'autumn' | 'winter' | 'spring' {
  return day < 10 ? 'autumn' : day <= 20 ? 'winter' : 'spring';
}
export const SEASON_NAME: Record<ReturnType<typeof season>, Text> = {
  autumn: { tr: 'Sonbahar', en: 'Autumn' },
  winter: { tr: 'Kış · grip mevsimi', en: 'Winter · flu season' },
  spring: { tr: 'İlkbahar', en: 'Spring' },
};

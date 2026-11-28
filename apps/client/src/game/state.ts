// Player progress for the prototype (needs, money, school). Lives inside SaveData.
import type { Text } from '../i18n';
import { defaultCare, type CareState } from './care';
import { newGrowth, type Growth } from './growth';

export type SubjectId = 'turkce' | 'matematik' | 'fen' | 'sosyal' | 'ingilizce' | 'muzik' | 'beden' | 'din' | 'teknoloji';
export type SportId = 'basketball' | 'volleyball' | 'football' | 'tennis' | 'swimming' | 'fencing' | 'athletics' | 'tabletennis' | 'chess';
export type MealId = 'breakfast' | 'lunch' | 'dinner';
export type BookId = 'kucuk_prens' | 'pal_sokagi' | 'nasreddin';

export const SUBJECTS: Array<{ id: SubjectId; name: Text }> = [
  { id: 'turkce', name: { tr: 'Türkçe', en: 'Turkish' } },
  { id: 'matematik', name: { tr: 'Matematik', en: 'Math' } },
  { id: 'fen', name: { tr: 'Fen Bilimleri', en: 'Science' } },
  { id: 'sosyal', name: { tr: 'Sosyal Bilgiler', en: 'Social Studies' } },
  { id: 'ingilizce', name: { tr: 'İngilizce', en: 'English' } },
  { id: 'muzik', name: { tr: 'Müzik', en: 'Music' } },
  { id: 'beden', name: { tr: 'Beden Eğitimi', en: 'Physical Education' } },
  { id: 'din', name: { tr: 'Din Kültürü ve Ahlak Bilgisi', en: 'Religious Culture and Ethics' } },
  { id: 'teknoloji', name: { tr: 'Teknoloji ve Tasarım', en: 'Technology and Design' } },
];
const emptyScores = (): Record<SubjectId, number[]> => Object.fromEntries(SUBJECTS.map((s) => [s.id, []])) as unknown as Record<SubjectId, number[]>;
const zeroLessons = (): Record<SubjectId, number> => Object.fromEntries(SUBJECTS.map((s) => [s.id, 0])) as unknown as Record<SubjectId, number>;
/** the year-end exam opens once you've sat in on every subject this many times */
export const LESSONS_PER_SUBJECT = 3;
export const lessonsLeft = (st: PlayerState) => SUBJECTS.reduce((n, s) => n + Math.max(0, LESSONS_PER_SUBJECT - (st.school.lessons[s.id] ?? 0)), 0);

export interface PlayerState {
  energy: number;
  hunger: number; // 100 = full
  mood: number;
  money: number;
  xp: number;
  /** levels and development points (see growth.ts) */
  growth: Growth;
  school: {
    registered: boolean;
    kit: boolean;
    books: boolean;
    classLabel: string;
    /** dorm section (1–14) on your current floor; the block and floor follow from the school year */
    section: number;
    /** lesson keys attended, `${day}-${periodId}` */
    attended: string[];
    /** performance marks: one for every lesson you sat in on and every homework you handed in */
    scores: Record<SubjectId, number[]>;
    /** how many lessons of each subject you've attended */
    lessons: Record<SubjectId, number>;
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
  /** side quests from the dorm's abi and abla (game/missions.ts): the ones you took, and the ones you handed back in */
  side: { taken: string[]; handed: string[] };
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
  /** pick-up games on the outdoor courts, 0–100 */
  skills: Record<CourtSport, number>;
  /** music room: the 4th-grade mandolin course unlocks an instrument; then a band or solo path */
  music: {
    mandolin: number;
    mandolinDone: boolean;
    instrument: InstrumentId | null;
    skill: number;
    path: 'band' | 'solo' | null;
    /** school years you played at the rock competition / gave a solo recital */
    shows: number[];
  };
  /** units left on your phone card (the dorm payphone) */
  phoneUnits: number;
  /** Cemil Emmi's tasks (boys' dorm caretaker) */
  cemil: { pee: 'none' | 'assigned' | 'held' | 'rewarded'; peeYear: number; peeFails: number; wetDay: number };
  /** student council: class rep → grade president → (11th grade only) school president */
  council: { year: number; stage: CouncilStage; day: number; support: number; titles: string[] };
  /** who you are becoming: six hidden axes, −100…100 (see game/dilemmas.ts) */
  temper: Record<AxisId, number>;
  /** the choices you made at dilemma moments, kept so later years can call back to them */
  memories: Memory[];
  /** secret skills you have opened (game/secrets.ts) */
  secrets: string[];
  /** this term's focus (game/focus.ts) and how far you've got towards its goal; null until you choose */
  focus: { id: string; progress: number; since: number } | null;
  /** focus goals already met, as `${year}:${focus}` */
  focusDone: string[];
  /** what you're wearing (see content/wardrobe.ts); `borrowed` is a friend's outfit, handed back the next morning */
  wardrobe: { wearing: string; borrowed: { from: string; name: string; top: string; bottom: string; day: number } | null };
  /** snacks: in your pockets, and put away in your locker */
  food: { bag: string[]; locker: string[] };
  /** today's diary: what you did, written as it happens (minute of the game since day 1, and the line); shown when you go to bed */
  journal: Array<{ at: number; kind?: string; a?: string; b?: string; c?: string; n?: number; m?: number; text?: string }>;
  /** daily care while you're away in real life (see game/care.ts) */
  care: CareState;
}

export type AxisId = 'rules' | 'ambition' | 'presence' | 'warmth' | 'loyalty' | 'heart';
export interface Memory { id: string; choice: string; day: number; year: number; who?: string }

export type CouncilStage = 'none' | 'candidate' | 'rep' | 'lost' | 'gradePresident' | 'gradeLost' | 'schoolPresident' | 'schoolLost';
/** the school president is always an 11th grader */
export const SCHOOL_PRESIDENT_GRADE = 11;
export const CLASS_LETTERS = ['A', 'B', 'C', 'D', 'E'];

export type CourtSport = 'basketball' | 'football';
export type InstrumentId = 'gitar' | 'bas' | 'davul' | 'klavye' | 'keman' | 'flut';
/** players you need besides yourself for a pick-up game */
export const COURT_PLAYERS: Record<CourtSport, number> = { basketball: 3, football: 5 };
/** the mandolin course is 6 lessons, in the 4th grade only */
export const MANDOLIN_LESSONS = 6;
/** Cemil Emmi's "hold your pee" challenge is for 4th and 5th graders */
export const PEE_LAST_YEAR = 2;

export function defaultState(): PlayerState {
  return {
    energy: 90, hunger: 70, mood: 60, money: 50, xp: 0, growth: newGrowth(),
    school: {
      registered: false, kit: false, books: false, classLabel: '4-A', section: 1 + Math.floor(Math.random() * DORM_SECTIONS),
      attended: [], scores: emptyScores(), lessons: zeroLessons(), homework: [],
    },
    sport: null, trainings: 0,
    reading: { book: null, sessions: 0, finished: [] },
    meals: [], daily: {}, once: {}, lastAllowanceWeek: 1,
    health: 90, sick: false, everSick: false, friends: {},
    favor: { giver: null, stage: 'none' }, side: { taken: [], handed: [] }, examPassed: false, missionsDone: [], announced: [], yearDone: false,
    year: 1, discipline: 0, lastPenaltyDay: 0, escaped: false, escapes: 0,
    skills: { basketball: 0, football: 0 },
    music: { mandolin: 0, mandolinDone: false, instrument: null, skill: 0, path: null, shows: [] },
    // your family gave you a phone card before you left home
    phoneUnits: 30,
    cemil: { pee: 'none', peeYear: 0, peeFails: 0, wetDay: -1 },
    council: { year: 0, stage: 'none', day: 0, support: 0, titles: [] },
    temper: { rules: 0, ambition: 0, presence: 0, warmth: 0, loyalty: 0, heart: 0 },
    memories: [],
    secrets: [],
    focus: null,
    focusDone: [],
    wardrobe: { wearing: 'sivil', borrowed: null },
    food: { bag: [], locker: [] },
    journal: [],
    care: defaultCare(),
  };
}

/** merge older saves with any fields added since */
export function withDefaults(s: Partial<PlayerState> | undefined): PlayerState {
  const d = defaultState();
  if (!s) return d;
  const merged: PlayerState = {
    ...d, ...s,
    school: { ...d.school, ...s.school, scores: { ...d.school.scores, ...s.school?.scores }, lessons: { ...d.school.lessons, ...s.school?.lessons } },
    reading: { ...d.reading, ...s.reading },
    favor: { ...d.favor, ...s.favor },
    side: { taken: [...(s.side?.taken ?? [])], handed: [...(s.side?.handed ?? [])] },
    skills: { ...d.skills, ...s.skills },
    music: { ...d.music, ...s.music },
    cemil: { ...d.cemil, ...s.cemil },
    council: { ...d.council, ...s.council },
    temper: { ...d.temper, ...s.temper },
    memories: s.memories ?? [],
    secrets: s.secrets ?? [],
    focus: s.focus ?? null,
    focusDone: s.focusDone ?? [],
    wardrobe: { ...d.wardrobe, ...s.wardrobe },
    food: { bag: [...(s.food?.bag ?? [])], locker: [...(s.food?.locker ?? [])] },
    // (older saves count the XP they already had: their levels and points are waiting for them)
    growth: { earned: s.growth?.earned ?? s.xp ?? 0, attrSpent: s.growth?.attrSpent ?? 0, perks: [...(s.growth?.perks ?? [])] },
    journal: [...(s.journal ?? [])],
    // older saves start their care clock now, so nobody comes back to a drift they never knew about
    care: { ...d.care, ...s.care, today: { ...d.care.today, ...s.care?.today, acts: [...(s.care?.today?.acts ?? [])] } },
  };
  // saves from before the registration weekend: whoever had registered is past it, and already in uniform
  if (!s.wardrobe && merged.school.kit) merged.wardrobe.wearing = 'uniforma';
  if (merged.missionsDone.includes('kayit')) merged.once.rushDone = true;
  // explored everything before "Explore the Campus" was a mission: it's done, and its XP was paid then
  if (merged.once.exploredAll && !merged.missionsDone.includes('kampusu_kesfet')) { merged.missionsDone.push('kampusu_kesfet'); merged.announced.push('kampusu_kesfet'); }
  if (!s.school?.lessons) for (const sub of SUBJECTS) merged.school.lessons[sub.id] = Math.min(LESSONS_PER_SUBJECT, Math.floor(merged.school.scores[sub.id].length / 2));
  // older saves stored homework as plain subject ids
  merged.school.homework = (merged.school.homework as unknown[]).map((h) => (typeof h === 'string' ? { s: h as SubjectId, day: 1 } : h as { s: SubjectId; day: number }));
  // meals eaten before they started counting (older versions) are still in the daily log: credit them
  for (const m of ['breakfast', 'lunch', 'dinner'] as const) {
    if (merged.daily[`meal-${m}`] !== undefined && !merged.meals.includes(m)) merged.meals.push(m);
  }
  // a failed night used to end the task; now you keep trying until you hold it
  if ((merged.cemil.pee as string) === 'wet') { merged.cemil.pee = 'assigned'; merged.cemil.peeFails = Math.max(1, merged.cemil.peeFails); }
  return merged;
}

/** your student council title this year, if any */
export function councilTitle(st: PlayerState): Text | null {
  if (st.council.year !== st.year) return null;
  if (st.council.stage === 'schoolPresident') return { tr: 'Okul Başkanı', en: 'School President' };
  if (st.council.stage === 'gradePresident') return { tr: 'Sınıf Başkanı', en: 'Grade President' };
  if (st.council.stage === 'rep') return { tr: 'Sınıf Temsilcisi', en: 'Class Rep' };
  return null;
}

export const clamp = (v: number) => Math.max(0, Math.min(100, v));

export function average(xs: number[]): number | null {
  return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
}

export const YEAR1_XP = 1000;
export const grade = (year: number) => year + 3;

// ---- growing up: you start in the 4th grade and stay until the 12th, so nothing should top out in the first year ----
/** the most your attributes (and sports skills) can reach by the end of each grade: 25 in the 4th, about +9 a year, 100 in the 12th */
export const attrCap = (g: number) => Math.min(100, Math.round(25 + (Math.max(4, g) - 4) * (75 / 8)));
/** the same for saygınlık (0–1000): 100 in the 4th grade, about +110 a year, 1000 in the 12th */
export const respectCap = (g: number) => Math.min(1000, Math.round(100 + (Math.max(4, g) - 4) * (900 / 8)));
/**
 * A gain, slowing down as you near this year's ceiling: the full amount at the start of the year's band, a fraction of
 * it close to the top (never less than 15%), nothing once you're there. Losses aren't slowed. `floor` is where this
 * year's band starts (last year's ceiling, or where everyone starts in the 4th grade).
 */
export function paced(cur: number, gain: number, floor: number, cap: number): number {
  if (gain <= 0) return cur + gain;
  if (cur >= cap) return cur;
  const f = Math.max(0.15, Math.min(1, (cap - cur) / Math.max(1, cap - floor)));
  return Math.min(cap, cur + gain * f);
}
/** an attribute after a gain this year (one decimal, as the profile shows them) */
export const growAttr = (cur: number, gain: number, year: number) => {
  const g = grade(year);
  return Math.round(paced(cur, gain, g <= 4 ? 10 : attrCap(g - 1), attrCap(g)) * 10) / 10;
};
/** a sports skill (0–100) after a gain this year */
export const growSkill = (cur: number, gain: number, year: number) => {
  const g = grade(year);
  return Math.round(paced(cur, gain, g <= 4 ? 0 : attrCap(g - 1), attrCap(g)));
};
/** saygınlık after a gain this year (whole points, at least 1 while there's room) */
export function growRespect(cur: number, gain: number, year: number): number {
  const g = grade(year);
  if (gain <= 0) return Math.max(0, cur + gain);
  const next = paced(cur, gain, g <= 4 ? 0 : respectCap(g - 1), respectCap(g));
  return next <= cur ? cur : Math.max(cur + 1, Math.round(next));
}
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
export const FRIEND_AT = 40;


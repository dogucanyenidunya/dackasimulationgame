// Daily timetable (GDD §2, §7). Weekdays have lessons; weekends keep meals only.
import type { Text } from '../i18n';
import { SUBJECTS, type MealId, type SubjectId } from './state';

export type PeriodKind = 'meal' | 'lesson' | 'sports' | 'etut' | 'plaza' | 'night';

export interface Period {
  id: string;
  kind: PeriodKind;
  start: number; // minutes since midnight
  end: number;
  name: Text;
  meal?: MealId;
}

const h = (hh: number, mm = 0) => hh * 60 + mm;

/** 0 = Monday … 6 = Sunday. The story starts on a Friday: days 0–2 are the registration days, day 3 the first Monday */
export const weekday = (day: number) => (((day + 4) % 7) + 7) % 7;
/** 1 on the first Monday, 2 a week later… (0 during the registration days) */
export const weekOf = (day: number) => Math.floor((day + 4) / 7);
/** the first school day: no lessons, ceremonies or weekend buses before it */
export const FIRST_MONDAY = 3;

/** the registration days ("kayıt dönemi"): Friday morning to Sunday evening, with the clock running fast */
export const RUSH_START = h(9);
export const RUSH_NIGHT = h(20);
export const RUSH_MORNING = h(8);
export const RUSH_END = h(18);
/** the first registration day (older saves started theirs on day 1) and the last */
export const RUSH_FIRST = 0;
export const RUSH_DAYS = 2;
/** the desks' opening hours on a registration day */
function rushHours(day: number): [number, number] {
  return [day <= RUSH_FIRST ? RUSH_START : RUSH_MORNING, day >= RUSH_DAYS ? RUSH_END : RUSH_NIGHT];
}
/** game minutes of registration time left (the nights in between don't count) */
export function rushLeft(day: number, minutes: number): number {
  let left = 0;
  for (let d = Math.max(day, RUSH_FIRST); d <= RUSH_DAYS; d++) {
    const [a, b] = rushHours(d);
    left += d === day ? Math.max(0, b - Math.max(minutes, a)) : b - a;
  }
  return left;
}
export const RUSH_TOTAL = rushLeft(RUSH_FIRST, 0);

export const PERIODS: Period[] = [
  { id: 'breakfast', kind: 'meal', meal: 'breakfast', start: h(7), end: h(8, 30), name: { tr: 'Kahvaltı', en: 'Breakfast' } },
  { id: 'p1', kind: 'lesson', start: h(8, 30), end: h(9, 20), name: { tr: '1. ders', en: 'Lesson 1' } },
  { id: 'p2', kind: 'lesson', start: h(9, 30), end: h(10, 20), name: { tr: '2. ders', en: 'Lesson 2' } },
  { id: 'p3', kind: 'lesson', start: h(10, 30), end: h(11, 20), name: { tr: '3. ders', en: 'Lesson 3' } },
  { id: 'p4', kind: 'lesson', start: h(11, 30), end: h(12, 20), name: { tr: '4. ders', en: 'Lesson 4' } },
  { id: 'lunch', kind: 'meal', meal: 'lunch', start: h(12, 20), end: h(13, 30), name: { tr: 'Öğle yemeği', en: 'Lunch' } },
  { id: 'p5', kind: 'lesson', start: h(13, 30), end: h(14, 20), name: { tr: '5. ders', en: 'Lesson 5' } },
  { id: 'p6', kind: 'lesson', start: h(14, 30), end: h(15, 20), name: { tr: '6. ders', en: 'Lesson 6' } },
  { id: 'sports', kind: 'sports', start: h(15, 30), end: h(17), name: { tr: 'Spor ve kulüpler', en: 'Sports & clubs' } },
  { id: 'dinner', kind: 'meal', meal: 'dinner', start: h(17), end: h(18), name: { tr: 'Akşam yemeği', en: 'Dinner' } },
  { id: 'etut', kind: 'etut', start: h(18), end: h(20), name: { tr: 'Etüt · yurdunda ol', en: 'Evening study · be in your dorm' } },
  { id: 'plaza', kind: 'plaza', start: h(20), end: h(22, 30), name: { tr: 'Yurtlar çevresinde serbest', en: 'Free time around the dorms' } },
];

/** evening rules (GDD §6.6): study in the dorm, then the dorm plaza only, then bed */
export const ETUT_START = h(18);
export const PLAZA_START = h(20);
/** lights out by school stage: up to the 8th grade at 22:00, the lise (9th–12th grade) half an hour later */
export const lightsOutFor = (grade: number) => (grade >= 9 ? h(22, 30) : h(22));
/** the latest lights out of all: the campus clock runs its quick night from here */
export const LATEST_LIGHTS_OUT = h(22, 30);
let yourLightsOut = h(22);
/** your own lights out (the scene sets it from your grade): the evening, curfew and night all follow it */
export const lightsOut = () => yourLightsOut;
export function setLightsOut(grade: number) { yourLightsOut = lightsOutFor(grade); }
export const WAKE_UP = h(7);
/** no evening study on Fridays and Saturdays: 18:00 to lights out is all free time around the dorms */
export const hasEtut = (day: number) => day >= FIRST_MONDAY && (weekday(day) < 4 || weekday(day) === 6) && !isMatchDay(day);

/** the second Sunday: Darüşşafaka play Banvit in the Spor Salonu at 19:00, and the whole school goes (no evening study) */
let matchDay = 9;
export const setMatchDay = (d: number) => { matchDay = d; };
export const getMatchDay = () => matchDay;
export function isMatchDay(day: number) { return day === matchDay; }
/** doors open, tip-off, final whistle; until MATCH_FREE you may be anywhere on the campus */
export const MATCH_OPEN = h(18, 30);
export const MATCH_TIP = h(19);
export const MATCH_END = h(20, 45);
export const MATCH_FREE = h(21);
export const matchOn = (day: number, minutes: number) => isMatchDay(day) && minutes >= MATCH_OPEN && minutes < MATCH_END;
export const matchFree = (day: number, minutes: number) => isMatchDay(day) && minutes >= MATCH_OPEN && minutes < MATCH_FREE;
export type DayPhase = 'day' | 'etut' | 'plaza' | 'night';
export function phaseOf(minutes: number, day: number): DayPhase {
  if (minutes >= lightsOut() || minutes < WAKE_UP) return 'night';
  if (minutes >= PLAZA_START) return 'plaza';
  if (minutes >= ETUT_START) return hasEtut(day) ? 'etut' : 'plaza';
  return 'day';
}
const NO_ETUT_EVENING: Period = { id: 'plaza', kind: 'plaza', start: ETUT_START, end: LATEST_LIGHTS_OUT, name: { tr: 'Etüt yok · yurtlar çevresinde serbest', en: 'No study tonight · free time around the dorms' } };

/** afternoon snack (ara öğün) at the dining hall counter; it runs alongside sports & clubs */
export const SNACK_START = h(16);
export const SNACK_END = h(17);
export const isSnackTime = (minutes: number) => minutes >= SNACK_START && minutes < SNACK_END;
/** the dining hall is only open while something is being served (meals and the afternoon snack) */
export const diningOpen = (minutes: number) => isSnackTime(minutes) || PERIODS.some((p) => p.kind === 'meal' && minutes >= p.start && minutes < p.end);
/** a lesson you walk into this many minutes after the bell needs a late slip from the deputy head */
export const LATE_AFTER = 5;
/** PE is out on the pitch, a long walk from the classrooms */
export const LATE_AFTER_PE = 15;
/** the register mark for "was in class (or out on the pitch for PE) when the lesson began": no late slip needed */
export const presentKey = (periodId: string) => `inclass-${periodId}`;

/** flag ceremony on the Merkez Meydan: Monday before the first lesson, Friday after the last; [start, end, the anthem] */
export function ceremonyWindow(day: number): [number, number, number] | null {
  if (day < FIRST_MONDAY) return null;
  const wd = weekday(day);
  return wd === 0 ? [h(8, 10), h(8, 25), h(8, 15)] : wd === 4 ? [h(15, 22), h(15, 40), h(15, 30)] : null;
}
export const ceremonyNow = (day: number, minutes: number) => { const w = ceremonyWindow(day); return !!w && minutes >= w[0] && minutes < w[1]; };
export const CEREMONY: Text = { tr: 'Bayrak töreni · Merkez Meydan', en: 'Flag ceremony · Merkez Meydan' };

export const BREAK: Text = { tr: 'Teneffüs', en: 'Break' };
export const NIGHT: Text = { tr: 'Gece · ışıklar kapalı', en: 'Night · lights out' };
export const WEEKEND_FREE: Text = { tr: 'Hafta sonu', en: 'Weekend' };
const FREE_TIME: Text = { tr: 'Serbest zaman', en: 'Free time' };

export const isWeekend = (day: number) => weekday(day) >= 5;

/** the weekend goes by in one jump, for everyone: from Friday 18:00 straight to Sunday 15:00 (nothing happens in
 *  between: no hunger, no tiredness, no lessons missed). The registration days (before the first Monday) keep theirs. */
export const WEEKEND_FROM = h(18);
export const WEEKEND_TO = h(15);
/** inside the skipped stretch: Friday evening, all of Saturday, Sunday morning */
export function inWeekendGap(day: number, minutes: number): boolean {
  if (day < FIRST_MONDAY) return false;
  const wd = weekday(day);
  return (wd === 4 && minutes >= WEEKEND_FROM) || wd === 5 || (wd === 6 && minutes < WEEKEND_TO);
}
/** where the jump lands: that weekend's Sunday at 15:00 */
export const afterWeekend = (day: number) => ({ day: day + ((6 - weekday(day) + 7) % 7), minutes: WEEKEND_TO });
/** does a jump from one moment to another (absolute minutes) pass a Friday 18:00, i.e. skip a weekend? */
export function skipsWeekend(fromAbs: number, toAbs: number): boolean {
  const d = Math.floor(fromAbs / (24 * 60));
  let t = (d + ((4 - weekday(d) + 7) % 7)) * 24 * 60 + WEEKEND_FROM;
  if (t < fromAbs) t += 7 * 24 * 60;
  return t <= toAbs && t >= FIRST_MONDAY * 24 * 60;
}

export function currentPeriod(day: number, minutes: number): Period | null {
  const p = PERIODS.find((x) => minutes >= x.start && minutes < x.end) ?? null;
  // weekends (and the registration days) have no lessons and no sports & clubs slot: all free time between meals
  if (p && (p.kind === 'lesson' || p.kind === 'sports') && (isWeekend(day) || day < FIRST_MONDAY)) return null;
  if (p && p.kind === 'etut' && !hasEtut(day)) return NO_ETUT_EVENING;
  return p;
}

/** teneffüs: a school day between 08:00 and 15:30, outside a lesson, when the class waits in its classroom.
 *  `prev`/`next` are the lessons either side; `short` = the ten minutes between two lessons (the teacher stays in). */
export interface ClassBreak { key: string; prev: Period | null; next: Period | null; short: boolean }
export function classBreak(day: number, minutes: number): ClassBreak | null {
  if (isWeekend(day) || day < FIRST_MONDAY || minutes < h(8) || minutes >= h(15, 30)) return null;
  if (currentPeriod(day, minutes)?.kind === 'lesson') return null;
  const lessons = PERIODS.filter((p) => p.kind === 'lesson');
  const prev = [...lessons].reverse().find((p) => p.end <= minutes) ?? null;
  const next = lessons.find((p) => p.start > minutes) ?? null;
  return { key: `${day}:${next?.id ?? 'out'}`, prev, next, short: !!prev && !!next && next.start - prev.end <= 10 };
}

/** which subject a lesson period teaches on a given day (rotates through the week) */
export function subjectFor(day: number, periodId: string): SubjectId {
  const idx = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].indexOf(periodId);
  return SUBJECTS[(((day - 1) * 6 + idx) % SUBJECTS.length + SUBJECTS.length) % SUBJECTS.length].id;
}

export function periodLabel(day: number, minutes: number): Text {
  if (minutes >= lightsOut() || minutes < WAKE_UP) return NIGHT;
  const p = currentPeriod(day, minutes);
  if (!p) return isWeekend(day) ? WEEKEND_FREE : day < FIRST_MONDAY ? FREE_TIME : BREAK;
  if (p.kind === 'lesson') {
    const s = SUBJECTS.find((x) => x.id === subjectFor(day, p.id))!;
    return { tr: `${p.name.tr}: ${s.name.tr}`, en: `${p.name.en}: ${s.name.en}` };
  }
  return p.name;
}

export const fmtTime = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;

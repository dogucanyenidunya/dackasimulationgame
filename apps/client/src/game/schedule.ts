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

/** 0 = Monday … 6 = Sunday. The story starts on a Saturday: day 1 and 2 are the registration weekend, day 3 the first Monday */
export const weekday = (day: number) => (((day + 4) % 7) + 7) % 7;
/** 1 on the first Monday, 2 a week later… (0 during the registration weekend) */
export const weekOf = (day: number) => Math.floor((day + 4) / 7);

/** the registration weekend ("kayıt dönemi"): Saturday morning to Sunday evening, with the clock running fast */
export const RUSH_START = h(9);
export const RUSH_NIGHT = h(20);
export const RUSH_MORNING = h(8);
export const RUSH_END = h(18);
export const RUSH_DAYS = 2;
/** game minutes of registration time left (the Saturday night in between doesn't count) */
export function rushLeft(day: number, minutes: number): number {
  if (day > RUSH_DAYS || (day === RUSH_DAYS && minutes >= RUSH_END)) return 0;
  const today = day === 1 ? Math.max(0, RUSH_NIGHT - Math.max(minutes, RUSH_START)) : Math.max(0, RUSH_END - Math.max(minutes, RUSH_MORNING));
  return today + (day === 1 ? RUSH_END - RUSH_MORNING : 0);
}
export const RUSH_TOTAL = RUSH_NIGHT - RUSH_START + RUSH_END - RUSH_MORNING;

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
  { id: 'plaza', kind: 'plaza', start: h(20), end: h(22), name: { tr: 'Yurtlar çevresinde serbest', en: 'Free time around the dorms' } },
];

/** evening rules (GDD §6.6): study in the dorm, then the dorm plaza only, then bed */
export const ETUT_START = h(18);
export const PLAZA_START = h(20);
export const LIGHTS_OUT = h(22);
export const WAKE_UP = h(7);
/** no evening study on Fridays and Saturdays: 18:00–22:00 is all free time around the dorms */
export const hasEtut = (day: number) => weekday(day) < 4 || weekday(day) === 6;
export type DayPhase = 'day' | 'etut' | 'plaza' | 'night';
export function phaseOf(minutes: number, day: number): DayPhase {
  if (minutes >= LIGHTS_OUT || minutes < WAKE_UP) return 'night';
  if (minutes >= PLAZA_START) return 'plaza';
  if (minutes >= ETUT_START) return hasEtut(day) ? 'etut' : 'plaza';
  return 'day';
}
const NO_ETUT_EVENING: Period = { id: 'plaza', kind: 'plaza', start: ETUT_START, end: LIGHTS_OUT, name: { tr: 'Etüt yok · yurtlar çevresinde serbest', en: 'No study tonight · free time around the dorms' } };

/** afternoon snack (ara öğün) at the dining hall counter; it runs alongside sports & clubs */
export const SNACK_START = h(16);
export const SNACK_END = h(17);
export const isSnackTime = (minutes: number) => minutes >= SNACK_START && minutes < SNACK_END;
/** the dining hall is only open while something is being served (meals and the afternoon snack) */
export const diningOpen = (minutes: number) => isSnackTime(minutes) || PERIODS.some((p) => p.kind === 'meal' && minutes >= p.start && minutes < p.end);
/** a lesson you walk into this many minutes after the bell needs a late slip from the deputy head */
export const LATE_AFTER = 5;

/** flag ceremony on the Merkez Meydan: Monday before the first lesson, Friday after the last; [start, end, the anthem] */
export function ceremonyWindow(day: number): [number, number, number] | null {
  const wd = weekday(day);
  return wd === 0 ? [h(8, 10), h(8, 25), h(8, 15)] : wd === 4 ? [h(15, 22), h(15, 40), h(15, 30)] : null;
}
export const ceremonyNow = (day: number, minutes: number) => { const w = ceremonyWindow(day); return !!w && minutes >= w[0] && minutes < w[1]; };
export const CEREMONY: Text = { tr: 'Bayrak töreni · Merkez Meydan', en: 'Flag ceremony · Merkez Meydan' };

export const BREAK: Text = { tr: 'Teneffüs', en: 'Break' };
export const NIGHT: Text = { tr: 'Gece · ışıklar kapalı', en: 'Night · lights out' };
export const WEEKEND_FREE: Text = { tr: 'Hafta sonu', en: 'Weekend' };

export const isWeekend = (day: number) => weekday(day) >= 5;

export function currentPeriod(day: number, minutes: number): Period | null {
  const p = PERIODS.find((x) => minutes >= x.start && minutes < x.end) ?? null;
  if (p && p.kind === 'lesson' && isWeekend(day)) return null;
  if (p && p.kind === 'etut' && !hasEtut(day)) return NO_ETUT_EVENING;
  return p;
}

/** teneffüs: a school day between 08:00 and 15:30, outside a lesson, when the class waits in its classroom.
 *  `prev`/`next` are the lessons either side; `short` = the ten minutes between two lessons (the teacher stays in). */
export interface ClassBreak { key: string; prev: Period | null; next: Period | null; short: boolean }
export function classBreak(day: number, minutes: number): ClassBreak | null {
  if (isWeekend(day) || minutes < h(8) || minutes >= h(15, 30)) return null;
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
  if (minutes >= LIGHTS_OUT || minutes < WAKE_UP) return NIGHT;
  const p = currentPeriod(day, minutes);
  if (!p) return isWeekend(day) ? WEEKEND_FREE : BREAK;
  if (p.kind === 'lesson') {
    const s = SUBJECTS.find((x) => x.id === subjectFor(day, p.id))!;
    return { tr: `${p.name.tr}: ${s.name.tr}`, en: `${p.name.en}: ${s.name.en}` };
  }
  return p.name;
}

export const fmtTime = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;

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
export type DayPhase = 'day' | 'etut' | 'plaza' | 'night';
export function phaseOf(minutes: number): DayPhase {
  if (minutes >= LIGHTS_OUT || minutes < WAKE_UP) return 'night';
  if (minutes >= PLAZA_START) return 'plaza';
  if (minutes >= ETUT_START) return 'etut';
  return 'day';
}

export const BREAK: Text = { tr: 'Teneffüs', en: 'Break' };
export const NIGHT: Text = { tr: 'Gece · ışıklar kapalı', en: 'Night · lights out' };
export const WEEKEND_FREE: Text = { tr: 'Hafta sonu', en: 'Weekend' };

export const isWeekend = (day: number) => ((day - 1) % 7) >= 5;

export function currentPeriod(day: number, minutes: number): Period | null {
  const p = PERIODS.find((x) => minutes >= x.start && minutes < x.end) ?? null;
  if (p && p.kind === 'lesson' && isWeekend(day)) return null;
  return p;
}

/** which subject a lesson period teaches on a given day (rotates through the week) */
export function subjectFor(day: number, periodId: string): SubjectId {
  const idx = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].indexOf(periodId);
  return SUBJECTS[((day - 1) * 6 + idx) % SUBJECTS.length].id;
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

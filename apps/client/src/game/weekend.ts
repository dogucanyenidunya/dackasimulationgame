// Weekends (GDD §3.1.1): evci students go home Friday 17:00 → Sunday 17:40; daimi students stay at school.
import type { NpcDef } from '../content/npcs';
import { FIRST_MONDAY, weekday } from './schedule';

export { weekday };

export const BUS_BOARDING = 15 * 60 + 20; // after the last lesson
export const BUS_LEAVES = 17 * 60;
export const BACK_ON_SUNDAY = 17 * 60 + 40;

export const isFriday = (day: number) => weekday(day) === 4 && day >= FIRST_MONDAY;
export const isSunday = (day: number) => weekday(day) === 6;

/** about half the students are evci (deterministic per student) */
export function npcIsEvci(n: NpcDef): boolean {
  if (n.kind === 'belletmen' || n.fixed) return false;
  let h = 0;
  for (const ch of n.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 2 === 0;
}

/** is an evci student away at home right now? */
export function awayForWeekend(day: number, minutes: number): boolean {
  const wd = weekday(day);
  return (wd === 4 && minutes >= BUS_LEAVES) || wd === 5 || (wd === 6 && minutes < BACK_ON_SUNDAY);
}

/** Wednesday afternoon is "çarşı izni": families visit at the canteen, and from the 6th grade you may go into town */
export const isWednesday = (day: number) => weekday(day) === 2;
export const CARSI_START = 15 * 60 + 30;
export const CARSI_END = 18 * 60;
/** going out into town is allowed from the 6th grade (school year 3) */
export const CARSI_OUT_FROM_YEAR = 3;
export const carsiNow = (day: number, minutes: number) => isWednesday(day) && minutes >= CARSI_START && minutes < CARSI_END;
/** the family visit at the canteen lasts until this (15 minutes before evening study), whenever it began */
export const FAMILY_VISIT_END = CARSI_END - 15;
/** your family is at the canteen and there's still time for a visit */
export const familyVisitNow = (day: number, minutes: number) => isWednesday(day) && minutes >= CARSI_START && minutes < FAMILY_VISIT_END;

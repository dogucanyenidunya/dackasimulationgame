// Weekends (GDD §3.1.1): evci students go home Friday 17:00 → Sunday 17:40; daimi students stay at school.
import type { NpcDef } from '../content/npcs';

export const BUS_BOARDING = 15 * 60 + 20; // after the last lesson
export const BUS_LEAVES = 17 * 60;
export const BACK_ON_SUNDAY = 17 * 60 + 40;
export const VISIT_START = 10 * 60;
export const VISIT_END = 16 * 60;

/** 0 = Monday … 6 = Sunday */
export const weekday = (day: number) => (day - 1) % 7;
export const isFriday = (day: number) => weekday(day) === 4;
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

// The campus clock (GDD §3.1): online, every player sees the same time of day and the same weekday.
// It is worked out from real time, so it needs no server, keeps running when nobody is playing,
// and every browser arrives at the same answer (to within its own clock's accuracy).
import { LIGHTS_OUT, WAKE_UP } from './schedule';

/** real milliseconds per game minute: day (07:00–22:00) ≈ 1 game hour per 80 s; night is compressed */
export const MS_PER_MIN_DAY = 80_000 / 60;
export const MS_PER_MIN_NIGHT = 240_000 / (8.5 * 60);

const DAY_MIN = 24 * 60;
const AWAKE = LIGHTS_OUT - WAKE_UP; // game minutes from wake-up to lights-out
const AWAKE_MS = AWAKE * MS_PER_MIN_DAY;
/** one whole campus day in real milliseconds (≈ 24 minutes) */
export const WORLD_DAY_MS = AWAKE_MS + (DAY_MIN - AWAKE) * MS_PER_MIN_NIGHT;
/** campus day 3 (a Monday, see `weekday`) began at 07:00 at this instant; any fixed instant would do */
const ANCHOR = Date.UTC(2026, 0, 5);
const ANCHOR_DAY = 3;

export interface ClockTime { day: number; minutes: number }

/** the campus day and minute at real time `now` (day numbers follow the same calendar as a save's) */
export function worldNow(now = Date.now()): ClockTime {
  const since = now - ANCHOR;
  const n = Math.floor(since / WORLD_DAY_MS);
  const into = since - n * WORLD_DAY_MS; // real ms since that day's 07:00
  let day = ANCHOR_DAY + n;
  let minutes = into < AWAKE_MS ? WAKE_UP + into / MS_PER_MIN_DAY : LIGHTS_OUT + (into - AWAKE_MS) / MS_PER_MIN_NIGHT;
  if (minutes >= DAY_MIN) { minutes -= DAY_MIN; day += 1; } // past midnight: tomorrow already
  return { day, minutes: Math.min(DAY_MIN - 1, Math.floor(minutes)) };
}

/**
 * How many days to subtract from campus day numbers to get this player's own day numbers.
 * A player keeps their own day count (their school year is theirs), but the weekday and time must match
 * the campus: this picks the first moment at or after `from` that does, so a player never goes back in time.
 * The result is always a multiple of 7.
 */
export function alignOffset(from: ClockTime, world: ClockTime): number {
  let day = from.day + ((((world.day - from.day) % 7) + 7) % 7);
  if (day * DAY_MIN + world.minutes < from.day * DAY_MIN + from.minutes) day += 7;
  return world.day - day;
}

export const absMinutes = (t: ClockTime) => t.day * DAY_MIN + t.minutes;

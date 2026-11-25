// The campus clock (GDD §3.1): online, every player sees the same time of day and the same weekday.
// It is worked out from real time, so it needs no server, keeps running when nobody is playing,
// and every browser arrives at the same answer (to within its own clock's accuracy).
import { LIGHTS_OUT, PERIODS, WAKE_UP } from './schedule';

/** real milliseconds per game minute: day (07:00–22:00) ≈ 1 game hour per 80 s; night is compressed (the whole night ≈ 40 real seconds) */
export const MS_PER_MIN_DAY = 80_000 / 60;
export const MS_PER_MIN_NIGHT = 40_000 / (8.5 * 60);

/** on school days the lessons themselves run twice as fast: a lesson takes about half a minute, not a whole one */
export const LESSON_SPEED = 2;

const DAY_MIN = 24 * 60;

/** a stretch of a campus day (07:00 to the next 07:00) and how fast it runs */
interface Stretch { from: number; to: number; ms: number }

/** a campus day as stretches: lessons faster on school days, the night compressed */
function dayPlan(schoolDay: boolean): Stretch[] {
  const out: Stretch[] = [];
  let t = WAKE_UP;
  const lessons = schoolDay ? PERIODS.filter((p) => p.kind === 'lesson').sort((a, b) => a.start - b.start) : [];
  for (const p of lessons) {
    if (p.start > t) out.push({ from: t, to: p.start, ms: MS_PER_MIN_DAY });
    out.push({ from: p.start, to: p.end, ms: MS_PER_MIN_DAY / LESSON_SPEED });
    t = p.end;
  }
  out.push({ from: t, to: LIGHTS_OUT, ms: MS_PER_MIN_DAY });
  out.push({ from: LIGHTS_OUT, to: DAY_MIN + WAKE_UP, ms: MS_PER_MIN_NIGHT });
  return out;
}
const SCHOOL_DAY = dayPlan(true);
const FREE_DAY = dayPlan(false);
const length = (plan: Stretch[]) => plan.reduce((n, s) => n + (s.to - s.from) * s.ms, 0);
/** a school day and a weekend day in real milliseconds (≈ 18 and 22 minutes) */
export const SCHOOL_DAY_MS = length(SCHOOL_DAY);
export const FREE_DAY_MS = length(FREE_DAY);
/** one campus week (Monday–Friday school days, then the weekend) in real milliseconds */
const WEEK_MS = 5 * SCHOOL_DAY_MS + 2 * FREE_DAY_MS;
/** campus day 3 (a Monday, see `weekday`) began at 07:00 at this instant; any fixed instant would do */
const ANCHOR = Date.UTC(2026, 0, 5);
const ANCHOR_DAY = 3;

export interface ClockTime { day: number; minutes: number }

/** the campus day and minute at real time `now` (day numbers follow the same calendar as a save's) */
export function worldNow(now = Date.now()): ClockTime {
  const since = now - ANCHOR;
  // whole weeks first (days differ in length), then the day of the week (0 = Monday), then the stretch of the day
  const weeks = Math.floor(since / WEEK_MS);
  let rest = since - weeks * WEEK_MS;
  let i = 0;
  for (; i < 6; i++) {
    const len = i < 5 ? SCHOOL_DAY_MS : FREE_DAY_MS;
    if (rest < len) break;
    rest -= len;
  }
  let day = ANCHOR_DAY + weeks * 7 + i;
  const plan = i < 5 ? SCHOOL_DAY : FREE_DAY;
  let minutes = plan[plan.length - 1].to;
  for (const st of plan) {
    const len = (st.to - st.from) * st.ms;
    if (rest < len) { minutes = st.from + rest / st.ms; break; }
    rest -= len;
  }
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

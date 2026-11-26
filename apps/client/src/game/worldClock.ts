// The campus clock (GDD §3.1): online, every player sees the same time of day and the same weekday.
// It is worked out from real time, so it needs no server, keeps running when nobody is playing,
// and every browser arrives at the same answer (to within its own clock's accuracy).
import { LATEST_LIGHTS_OUT, PERIODS, WAKE_UP, WEEKEND_FROM, WEEKEND_TO } from './schedule';

/** real milliseconds per game minute: day (07:00–22:30) ≈ 1 game hour per 80 s; night is compressed (the whole night ≈ 40 real seconds) */
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
  // (the quick night starts at the latest lights out, so the lise's extra half hour is a real one)
  out.push({ from: t, to: LATEST_LIGHTS_OUT, ms: MS_PER_MIN_DAY });
  out.push({ from: LATEST_LIGHTS_OUT, to: DAY_MIN + WAKE_UP, ms: MS_PER_MIN_NIGHT });
  return out;
}
const SCHOOL_DAY = dayPlan(true);
const FREE_DAY = dayPlan(false);
const length = (plan: Stretch[]) => plan.reduce((n, s) => n + (s.to - s.from) * s.ms, 0);
/** a school day and a weekend day in real milliseconds (≈ 18 and 22 minutes) */
export const SCHOOL_DAY_MS = length(SCHOOL_DAY);
export const FREE_DAY_MS = length(FREE_DAY);
/** the stretches of a plan between minute `a` and minute `b` of its day (`b` may run past midnight) */
const clip = (plan: Stretch[], a: number, b: number): Stretch[] =>
  plan.filter((s) => s.to > a && s.from < b).map((s) => ({ from: Math.max(s.from, a), to: Math.min(s.to, b), ms: s.ms }));
/** one campus week: Monday to Thursday whole, Friday until 18:00, then Sunday from 15:00 to Monday morning (the
 *  weekend in between is skipped for everyone); `day` is the weekday (0 = Monday) */
const WEEK: Array<{ day: number; plan: Stretch[] }> = [
  ...[0, 1, 2, 3].map((day) => ({ day, plan: SCHOOL_DAY })),
  { day: 4, plan: clip(SCHOOL_DAY, WAKE_UP, WEEKEND_FROM) },
  { day: 6, plan: clip(FREE_DAY, WEEKEND_TO, DAY_MIN + WAKE_UP) },
];
/** one campus week in real milliseconds */
const WEEK_MS = WEEK.reduce((n, d) => n + length(d.plan), 0);
/** campus day 3 (a Monday, see `weekday`) began at 07:00 at this instant; any fixed instant would do */
const ANCHOR = Date.UTC(2026, 0, 5);
const ANCHOR_DAY = 3;

export interface ClockTime { day: number; minutes: number }

/** the campus day and minute at real time `now` (day numbers follow the same calendar as a save's) */
export function worldNow(now = Date.now()): ClockTime {
  const since = now - ANCHOR;
  // whole weeks first (days differ in length), then the day of the week, then the stretch of the day
  const weeks = Math.floor(since / WEEK_MS);
  let rest = since - weeks * WEEK_MS;
  let i = 0;
  for (; i < WEEK.length - 1; i++) {
    const len = length(WEEK[i].plan);
    if (rest < len) break;
    rest -= len;
  }
  let day = ANCHOR_DAY + weeks * 7 + WEEK[i].day;
  const plan = WEEK[i].plan;
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

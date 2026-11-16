// Where every student is at any moment of the week: bed, meals, lessons, sports, study time, the plaza.
// It is a pure function of the clock, so the campus, the dining hall, the classroom and the dorm room
// all agree about who is where. Each student runs a few minutes early or late, so nobody moves in step.
import type { NpcDef } from '../content/npcs';
import { ETUT_START, PLAZA_START, RUSH_NIGHT, ceremonyWindow, currentPeriod, hasEtut, matchOn, subjectFor } from './schedule';
import { BACK_ON_SUNDAY, BUS_BOARDING, CARSI_START, VISIT_START, npcIsEvci, weekday } from './weekend';

/** inside a building (`dorm` = their own dorm) or off campus (`away`: they leave by the main gate) */
export type Indoors = 'dorm' | 'yemekhane' | 'egitim' | 'spor' | 'kutuphane' | 'cemiyet' | 'revir' | 'away';
/** outdoors: their age group's lawn, the square in front of the school, their evening spot around the dorms, or lined up at the flag */
export type Outdoors = 'lawn' | 'school' | 'plaza' | 'ceremony' | 'pe';
export interface Activity { in?: Indoors; out?: Outdoors }

export interface RoutineClock {
  day: number;
  minutes: number;
  /** lessons only start once the player has settled in (the "first days" of the year) */
  lessonsOn: boolean;
  raining: boolean;
  /** the registration weekend: the whole school is queueing at the Cemiyet, the infirmary, the stores and the library */
  rush?: boolean;
}

const H = (h: number, m = 0) => h * 60 + m;
/** when the crowd starts taking their seats on match night */
const MATCH_SEAT = H(18, 30);

const memo = new Map<string, number>();
/** a steady number in 0..1 for a student and a purpose (so each one keeps their own habits) */
function roll(key: string): number {
  let v = memo.get(key);
  if (v === undefined) {
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13;
    v = (h >>> 0) / 4294967296;
    if (memo.size > 5000) memo.clear();
    memo.set(key, v);
  }
  return v;
}

/** devrecilik: everyone in the same school year (their "devre") keeps nearly the same hours, so they get up, eat and
 *  move about together. Each one's habits are mostly the devre's, with a little of their own so nobody moves in step. */
function habit(def: NpcDef, k: string): number {
  return 0.8 * roll(`devre${def.grade ?? 4}${k}`) + 0.2 * roll(def.id + k);
}
/** today's whim: most days the devre decides together (the gym, the canteen, a trip into town); now and then someone goes their own way */
function whim(def: NpcDef, k: string, day: number): number {
  return roll(`${def.id}solo${k}${day}`) < 0.2 ? roll(def.id + k + day) : roll(`devre${def.grade ?? 4}${k}${day}`);
}

/** when they get out of bed and when they turn in (minutes since midnight) */
export function wakeTime(def: NpcDef, day: number): number {
  return weekday(day) >= 5 ? H(7, 15) + habit(def, 'wake') * 45 : H(7) + habit(def, 'wake') * 30;
}
/** after getting up they spend a few minutes at their locker, getting dressed, before they leave the dorm */
export const DRESS_MINUTES = 12;
export function bedTime(def: NpcDef): number {
  return H(21, 45) + habit(def, 'bed') * 12;
}

export function activityOf(def: NpcDef, c: RoutineClock): Activity {
  const a = planned(def, c);
  // in the rain most of them take shelter
  if (a.out && a.out !== 'ceremony' && a.out !== 'pe' && c.raining && whim(def, 'rain', c.day) < 0.7) {
    if (a.out === 'school') return { in: 'egitim' };
    if (a.out === 'plaza') return { in: 'dorm' };
    return { in: habit(def, 'shelter') < 0.5 ? 'dorm' : 'spor' };
  }
  return a;
}

function planned(def: NpcDef, c: RoutineClock): Activity {
  const m = c.minutes, wd = weekday(c.day), weekend = wd >= 5;
  /** their habit (mostly their devre's), the same every day */
  const u = (k: string) => habit(def, k);
  /** today's whim (mostly their devre's); family visits are their own */
  const ud = (k: string) => (k === 'visit' || k === 'vt' ? roll(def.id + k + c.day) : whim(def, k, c.day));
  const free: Activity = { out: 'lawn' };
  // the older students who hand out favours stay where you can find them in their free time
  const optional = !def.fixed;
  const evci = npcIsEvci(def);

  if (c.rush) return registering(def, c);
  // match night: almost the whole school is in the Spor Salonu, cheering
  if (matchOn(c.day, c.minutes) && c.minutes >= MATCH_SEAT + habit(def, 'seat') * 20 && roll(def.id + 'fan') < 0.85) return { in: 'spor' };

  // home for the weekend: out by the gate on Friday after lessons, back on Sunday evening
  if (evci && ((wd === 4 && m >= BUS_BOARDING + 22 + u('bus') * 50) || wd === 5 || (wd === 6 && m < BACK_ON_SUNDAY + u('bus') * 8))) return { in: 'away' };

  // asleep
  const wake = wakeTime(def, c.day);
  if (m < wake || m >= bedTime(def)) return { in: 'dorm' };

  // the flag ceremony: everyone lines up on the Merkez Meydan (not in the rain)
  const cer = c.raining ? null : ceremonyWindow(c.day);
  if (cer && m >= cer[0] - 7 + u('bell') * 5 && m < cer[1]) return { out: 'ceremony' };

  // a few minutes at the locker getting dressed, then breakfast
  if (m < wake + DRESS_MINUTES) return { in: 'dorm' };
  if (m < Math.min(wake + 38 + u('eat') * 14, weekend ? H(8, 30) : H(8, 15))) return { in: 'yemekhane' };

  if (!weekend && c.lessonsOn) {
    // your own class does Beden Eğitimi out on the pitch and the court
    if (def.kind === 'classmate') {
      const p = currentPeriod(c.day, m);
      if (p?.kind === 'lesson' && subjectFor(c.day, p.id) === 'beden' && m >= p.start + 3 + u('bell') * 6 && m < p.end - 4) return { out: 'pe' };
    }
    // four lessons, lunch, two lessons; the ten-minute breaks are spent in the corridors
    const out1 = H(12, 20) + u('out') * 6;
    if (m < H(8, 18) + u('bell') * 8) return { out: 'school' };
    if (m < out1) return { in: 'egitim' };
    if (m < out1 + 34 + u('eat') * 14) return { in: 'yemekhane' };
    if (m < H(13, 20) + u('bell') * 8) return { out: 'school' };
    if (m < H(15, 20) + u('out') * 5) return { in: 'egitim' };
  } else {
    // weekends and the first days of the year: only lunch breaks up the day
    const l0 = H(12, 20) + u('out') * 20;
    if (m >= l0 && m < l0 + 34 + u('eat') * 14) return { in: 'yemekhane' };
    if (!weekend && m < H(15, 20)) return free;
  }

  if (weekend && optional && m < H(17)) {
    // Sunday is visiting day: about half of those who stayed have family over for an hour
    if (wd === 6 && ud('visit') < 0.5) {
      const v = VISIT_START + Math.floor(ud('vt') * 5) * 60;
      if (m >= v && m < v + 60) return { in: 'yemekhane' };
    }
    if (m < H(12, 20)) {
      const r = ud('am');
      if (r < 0.3 && m >= H(10) && m < H(12)) return { in: 'spor' };
      if (r >= 0.3 && r < 0.45 && m >= H(9, 30) && m < H(11, 30)) return { in: 'kutuphane' };
    } else {
      const r = ud('pm');
      if (r < 0.3 && m >= H(14) && m < H(15, 30)) return { in: 'spor' }; // a film at Şakir Abi's canteen
      if (r >= 0.3 && r < 0.5 && m >= H(14) && m < H(16)) return { in: 'spor' };
    }
  }

  // Wednesday çarşı izni: from the 6th grade about half go into town; some of the little ones have family at the canteen
  const wednesday = !weekend && wd === 2 && optional;
  const town = wednesday && (def.grade ?? 4) >= 6 && ud('carsi') < 0.5;
  if (town && m >= CARSI_START + 5 + u('bus') * 15 && m < H(17, 30) + u('bus') * 12) return { in: 'away' };

  if (m < H(17)) {
    if (!weekend && optional && !town) {
      if (wednesday && (def.grade ?? 4) < 6 && ud('visit') < 0.35 && m >= CARSI_START + 5 && m < H(16, 45)) return { in: 'spor' }; // family at the canteen
      // sports and clubs
      if (ud('sport') < 0.4 && m >= H(15, 30) + u('bell') * 8 && m < H(16, 50) + u('out') * 8) return { in: 'spor' };
    }
    // afternoon snack at the counter
    if (optional && ud('snack') < 0.4) {
      const s = H(16) + u('snack') * 25;
      if (m >= s && m < s + 20) return { in: 'yemekhane' };
    }
    return free;
  }

  // evening study in the dorm, then the plaza until bedtime
  if (hasEtut(c.day) && m >= ETUT_START - 15 + u('bell') * 8 && m < PLAZA_START + u('out') * 8) return { in: 'dorm' };
  const d0 = H(17) + u('din') * 15;
  if (m < d0) return free;
  // (those just back from the weekend have eaten at home)
  if (m < d0 + 25 + u('eat') * 10 && !(evci && wd === 6)) return { in: 'yemekhane' };
  return { out: 'plaza' };
}

/** the registration weekend, for everyone: the new ones enrol, everybody has a health check and collects this year's
 *  clothes and books. They go round the four desks in their own order, queueing at each, with meals in between */
const DESKS: Indoors[] = ['cemiyet', 'revir', 'spor', 'kutuphane', 'dorm'];
function registering(def: NpcDef, c: RoutineClock): Activity {
  const m = c.minutes;
  const u = (k: string) => habit(def, k), ud = (k: string) => whim(def, k, c.day);
  const wake = H(7, 30) + u('wake') * 40;
  if (m < wake || m >= RUSH_NIGHT - 10 + u('bed') * 20) return { in: 'dorm' };
  if (m < wake + 35 + u('eat') * 15) return { in: 'yemekhane' };
  const l0 = H(12, 20) + u('out') * 25;
  if (m >= l0 && m < l0 + 30 + u('eat') * 12) return { in: 'yemekhane' };
  const d0 = H(17) + u('din') * 20;
  if (m >= d0 && m < d0 + 28) return { in: 'yemekhane' };
  // 50-minute rounds: about half an hour in a queue, then out in the open on the way to the next desk
  const t = m - H(8, 30) + u('rush') * 50;
  const round = Math.floor(t / 50), into = t - round * 50;
  const start = Math.floor(u('first') * DESKS.length) + (c.day - 1) * 2;
  const stop = DESKS[(((round + start) % 6) + 6) % 6]; // (a sixth "desk" = a break on the lawn)
  if (stop && (def.fixed ? ud(`r${round}`) < 0.35 : true) && into < 26 + u('q') * 10) return { in: stop };
  return { out: 'lawn' };
}

/** teachers (0–4, one per subject): in by the gate before the bell, two on yard duty each day, home after lessons */
export function teacherActivity(index: number, c: RoutineClock): Activity {
  const m = c.minutes, wd = weekday(c.day);
  const u = (k: string) => roll(`teacher${index}${k}`);
  // on the registration weekend a few of them are in, helping at the desks or out greeting the new ones
  if (c.rush) return m < H(8, 30) || m >= H(18) ? { in: 'away' } : index % 3 === 0 ? { out: 'school' } : index % 3 === 1 ? { in: 'egitim' } : { in: 'away' };
  if (wd >= 5 || m < H(7, 40) + u('in') * 20) return { in: 'away' };
  const cer = c.raining ? null : ceremonyWindow(c.day);
  if (cer && m >= cer[0] - 6 + u('in') * 4 && m < cer[1]) return { out: 'ceremony' };
  if (m >= (cer && wd === 4 ? cer[1] : H(15, 30)) + 2 + u('out') * 45) return { in: 'away' };
  // yard duty: before the bell, through the lunch break, and seeing everyone off
  const duty = (index + c.day) % 4 < 1 && !c.raining;
  if (duty && (m < H(8, 26) || (m >= H(12, 24) && m < H(13, 24)) || m >= H(15, 22))) return { out: 'school' };
  return { in: 'egitim' };
}

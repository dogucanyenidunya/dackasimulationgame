// Daily care (GDD §6.2.2): while you're away in real life, your character slowly gets tired and homesick.
// One small act of care a day (a kumanya, a call from home, a note to a friend) or a visit to campus
// holds their mood, energy and health for the next 24 real hours. It's gentle by design: the drift
// stops at a floor above the sickness line, and grades, friendships and missions never change.
import type { Text } from '../i18n';
import type { PlayerState } from './state';

// (state.ts imports this file for the defaults, so only types come back the other way)
const clamp = (v: number) => Math.max(0, Math.min(100, v));

export type CareAct = 'kumanya' | 'call' | 'note';

export interface CareState {
  /** real time (ms) of the last care act or campus visit: stats hold for HOLD_MS after it */
  lastCare: number;
  /** real time (ms) up to which the drift has already been applied */
  driftedTo: number;
  /** today's care acts (local calendar date), each once a day */
  today: { date: string; acts: CareAct[] };
}

/** stats hold this long after the last care */
export const HOLD_MS = 24 * 3600_000;
/** the drift never takes a stat below this (sickness only starts below 40, GDD §6.2.1) */
export const FLOOR = 45;
/** how much each stat drifts per real hour once the hold is over: from full to the floor in about two days */
const PER_HOUR = { mood: 1.2, energy: 1.2, health: 0.6 } as const;

export function defaultCare(now = Date.now()): CareState {
  return { lastCare: now, driftedTo: now, today: { date: localDate(now), acts: [] } };
}

export function localDate(now = Date.now()): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** applies the drift for the real time since the last visit; returns how many hours of it there were */
export function applyDrift(st: PlayerState, now = Date.now()): number {
  const from = Math.max(st.care.lastCare + HOLD_MS, st.care.driftedTo);
  st.care.driftedTo = Math.max(st.care.driftedTo, now);
  if (now <= from) return 0;
  const hours = (now - from) / 3600_000;
  for (const k of ['mood', 'energy', 'health'] as const) {
    // only ever lowers a stat, and never below the floor (a stat already under it stays where it is)
    if (st[k] > FLOOR) st[k] = Math.max(FLOOR, Math.round(st[k] - PER_HOUR[k] * hours));
  }
  return hours;
}

/** coming to campus counts as being there: it holds the stats like a care act (with no boost) */
export function markVisit(st: PlayerState, now = Date.now()) {
  applyDrift(st, now);
  st.care.lastCare = now;
}

export function doneToday(st: PlayerState, act: CareAct, now = Date.now()): boolean {
  return st.care.today.date === localDate(now) && st.care.today.acts.includes(act);
}

/** what each act gives (on top of holding the stats for a day) */
const BOOST: Record<CareAct, Partial<Record<'mood' | 'energy' | 'health' | 'hunger', number>>> = {
  kumanya: { hunger: 35, energy: 10, health: 3 },
  call: { mood: 15 },
  note: { mood: 10 },
};

/** does a care act: false if it was already done today */
export function care(st: PlayerState, act: CareAct, now = Date.now()): boolean {
  if (doneToday(st, act, now)) return false;
  applyDrift(st, now);
  const date = localDate(now);
  if (st.care.today.date !== date) st.care.today = { date, acts: [] };
  st.care.today.acts.push(act);
  st.care.lastCare = now;
  for (const [k, v] of Object.entries(BOOST[act]) as Array<[keyof typeof BOOST[CareAct], number]>) st[k] = clamp(st[k] + v);
  return true;
}

/** a few words on how your character is doing, for the title screen */
export function careMood(st: PlayerState): Text {
  const low = Math.min(st.mood, st.energy, st.health);
  if (st.sick) return { tr: 'Hasta, revirde dinleniyor', en: 'Sick, resting in the infirmary' };
  if (low <= FLOOR + 2) return { tr: 'Biraz yorgun ve evini özlemiş', en: 'A little tired and homesick' };
  if (low < 65) return { tr: 'İdare ediyor', en: 'Doing okay' };
  return { tr: 'Keyfi yerinde', en: 'In good spirits' };
}

// ── what the day's kumanya and call from home are (the same all day, different each day) ──

const dayIndex = (now: number, n: number, salt: number) => {
  const d = localDate(now).split('-').map(Number);
  return Math.abs(d[0] * 372 + d[1] * 31 + d[2] + salt * 7) % n;
};

const KUMANYAS: Text[] = [
  { tr: 'beyaz peynirli domatesli sandviç', en: 'a white cheese and tomato sandwich' },
  { tr: 'kaşarlı tost', en: 'a toasted kaşar cheese sandwich' },
  { tr: 'zeytin ezmeli sandviç', en: 'an olive paste sandwich' },
  { tr: 'tahin pekmezli sandviç', en: 'a tahini and grape molasses sandwich' },
  { tr: 'yumurtalı sandviç ve bir elma', en: 'an egg sandwich and an apple' },
  { tr: 'simit ve bir üçgen peynir', en: 'a simit and a cheese triangle' },
  { tr: 'salamlı sandviç ve ayran', en: 'a salami sandwich and ayran' },
];

export function todaysKumanya(now = Date.now()): Text {
  return KUMANYAS[dayIndex(now, KUMANYAS.length, 1)];
}

/** what your guardian says on today's call; `who` is "Annen" / "Your mother" etc. */
const CALLS: Array<(who: Text) => Text> = [
  (w) => ({ tr: `${w.tr} aradı: "Sesini duymak çok iyi geldi. Yemeklerini yiyor musun?"`, en: `${w.en} called: "It's so good to hear your voice. Are you eating properly?"` }),
  (w) => ({ tr: `${w.tr} aradı: "Hafta sonu sana kurabiye yaptım, ziyarette getireceğim."`, en: `${w.en} called: "I baked you cookies this weekend. I'll bring them when I visit."` }),
  (w) => ({ tr: `${w.tr} aradı: "Seninle gurur duyuyorum. Derslerin nasıl gidiyor?"`, en: `${w.en} called: "I'm proud of you. How are your lessons going?"` }),
  (w) => ({ tr: `${w.tr} aradı: "Mahallede herkes seni soruyor. Arkadaşlarına selam söyle."`, en: `${w.en} called: "Everyone in the neighbourhood asks about you. Say hi to your friends."` }),
  (w) => ({ tr: `${w.tr} aradı: "Hava soğuyormuş, hırkanı giy olur mu?"`, en: `${w.en} called: "They say it's getting cold. Wear your cardigan, okay?"` }),
  (w) => ({ tr: `${w.tr} aradı: "Seni özledim. Bu akşam erken yat, dinlen."`, en: `${w.en} called: "I miss you. Get to bed early tonight and rest."` }),
  (w) => ({ tr: `${w.tr} aradı: "Mektubunu aldım, iki kere okudum!"`, en: `${w.en} called: "I got your letter. I read it twice!"` }),
];

export function todaysCall(who: Text, now = Date.now()): Text {
  return CALLS[dayIndex(now, CALLS.length, 2)](who);
}

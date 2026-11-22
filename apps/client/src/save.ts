// Prototype persistence: browser localStorage. Replaced by server-side saves in M2 (GDD §18.5).
import { LAYOUT, MAP_H, MAP_W, SPAWN } from './content/campus';
import type { Lang } from './i18n';
import type { AttrId, CauseId, CharacterData } from './content/character';
import { defaultState, growAttr, growRespect, growSkill, withDefaults, type PlayerState } from './game/state';

export interface SaveData {
  v: 2;
  lang: Lang;
  character: CharacterData;
  state: PlayerState;
  /** `door`: the outside step of the door you went in by (tiles) */
  player: { x: number; y: number; dir: number; inside?: boolean | 'dorm' | 'class' | 'dining'; door?: [number, number] };
  clock: { day: number; minutes: number };
  /** revealed fog tiles, bit-packed + base64 */
  fog: string;
  seen: string[];
  discovered: string[];
  flags: Record<string, boolean>;
  /** campus layout version the fog and position belong to */
  layout?: number;
}

const KEY = 'dacka.save.v3'; // v3: compact campus (old maps don't fit)

export function newSave(lang: Lang, character: CharacterData): SaveData {
  return {
    v: 2,
    lang,
    character,
    state: defaultState(),
    player: { x: SPAWN.x, y: SPAWN.y, dir: 3 },
    // the story starts on the Saturday morning of the registration weekend
    clock: { day: 1, minutes: 9 * 60 },
    fog: '',
    seen: [],
    discovered: [],
    flags: { [STORY_BONUS_REMOVED]: true, [PACED_TO_GRADE]: true },
    layout: LAYOUT,
  };
}

const STORY_BONUS_REMOVED = 'storyBonusRemoved';
/** stats now grow at a pace that lasts from the 4th grade to the 12th (v0.11): older characters are brought into line once */
const PACED_TO_GRADE = 'pacedToGrade';

/** what an older character would have now if what they'd gained above `start` had come at the new, slower pace:
 *  the same progress replayed in steps of `step` through `grow` (so whoever had grown more still ends up higher) */
function repace(cur: number, start: number, step: number, grow: (v: number, gain: number) => number): number {
  if (!(cur > start)) return cur;
  let v = start, left = cur - start;
  while (left > 1e-6) { const s = Math.min(step, left); const next = grow(v, s); left -= s; if (next === v && v > start) break; v = next; }
  return v;
}
/** what each story used to add when the character was created (removed in v0.10) */
const OLD_STORY_BONUS: Record<CauseId, { attrs: Partial<Record<AttrId, number>>; respect: number }> = {
  illness: { attrs: { social: 10 }, respect: 0 },
  accident: { attrs: { discipline: 10 }, respect: 0 },
  disaster: { attrs: { fitness: 10 }, respect: 0 },
  work: { attrs: { creativity: 10 }, respect: 0 },
  service: { attrs: { discipline: 5, social: 5 }, respect: 50 },
  private: { attrs: { knowledge: 2, fitness: 2, social: 2, discipline: 2, creativity: 2 }, respect: 0 },
};

/** brings a save made by an older version up to date (used for saves in this browser and in the cloud) */
export function upgradeSave(data: SaveData): SaveData {
  data.state = withDefaults(data.state);
  data.flags ??= {};
  if (!data.flags[STORY_BONUS_REMOVED]) {
    // your story no longer gives a starting bonus: take back what older characters were given, once
    const old = OLD_STORY_BONUS[data.character.cause];
    if (old) {
      for (const [k, v] of Object.entries(old.attrs) as Array<[AttrId, number]>) {
        data.character.attributes[k] = Math.max(0, Math.round((data.character.attributes[k] - v) * 10) / 10);
      }
      data.character.respect = Math.max(0, data.character.respect - old.respect);
    }
    data.flags[STORY_BONUS_REMOVED] = true;
  }
  if (!data.flags[PACED_TO_GRADE]) {
    // bring stats grown at the old, quick pace down to where this grade's pace would have them, once
    const year = data.state.year, ch = data.character, st = data.state;
    for (const k of Object.keys(ch.attributes) as AttrId[]) ch.attributes[k] = repace(ch.attributes[k], 10, 1, (v, g) => growAttr(v, g, year));
    ch.respect = repace(ch.respect, 0, 5, (v, g) => growRespect(v, g, year));
    for (const k of Object.keys(st.skills) as Array<keyof typeof st.skills>) st.skills[k] = repace(st.skills[k], 0, 4, (v, g) => growSkill(v, g, year));
    data.flags[PACED_TO_GRADE] = true;
  }
  return data;
}

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (data.v !== 2) return null;
    return upgradeSave(data);
  } catch {
    return null;
  }
}

export function writeSave(data: SaveData) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage unavailable: play continues unsaved */ }
}

const BACKUP_KEY = 'dacka.save.backup';

/** keeps a copy of the current game before it gets replaced, so it can be restored */
export function backupSave() {
  try { const raw = localStorage.getItem(KEY); if (raw) localStorage.setItem(BACKUP_KEY, raw); } catch { /* ignore */ }
}

export function hasBackup(): boolean {
  try { return !!localStorage.getItem(BACKUP_KEY); } catch { return false; }
}

/** swaps the backup back in (the current game, if any, becomes the new backup) */
export function restoreBackup(): boolean {
  try {
    const b = localStorage.getItem(BACKUP_KEY);
    if (!b) return false;
    const cur = localStorage.getItem(KEY);
    localStorage.setItem(KEY, b);
    if (cur) localStorage.setItem(BACKUP_KEY, cur); else localStorage.removeItem(BACKUP_KEY);
    return true;
  } catch { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function encodeFog(revealed: Uint8Array): string {
  const bytes = new Uint8Array(Math.ceil(revealed.length / 8));
  for (let i = 0; i < revealed.length; i++) if (revealed[i]) bytes[i >> 3] |= 1 << (i & 7);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function decodeFog(encoded: string): Uint8Array {
  const out = new Uint8Array(MAP_W * MAP_H);
  if (!encoded) return out;
  const s = atob(encoded);
  for (let i = 0; i < out.length; i++) out[i] = (s.charCodeAt(i >> 3) >> (i & 7)) & 1;
  return out;
}

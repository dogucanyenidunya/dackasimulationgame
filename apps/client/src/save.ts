// Prototype persistence: browser localStorage. Replaced by server-side saves in M2 (GDD §18.5).
import { LAYOUT, MAP_H, MAP_W, SPAWN } from './content/campus';
import type { Lang } from './i18n';
import type { CharacterData } from './content/character';
import { defaultState, withDefaults, type PlayerState } from './game/state';

export interface SaveData {
  v: 2;
  lang: Lang;
  character: CharacterData;
  state: PlayerState;
  player: { x: number; y: number; dir: number; inside?: boolean | 'dorm' | 'class' | 'dining' };
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
    clock: { day: 1, minutes: 7 * 60 },
    fog: '',
    seen: [],
    discovered: [],
    flags: {},
    layout: LAYOUT,
  };
}

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (data.v !== 2) return null;
    data.state = withDefaults(data.state);
    return data;
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

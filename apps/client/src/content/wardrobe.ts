// What's in your locker: the clothes you can change into, and the snacks you can put away for later.
import type { Text } from '../i18n';
import type { CharacterLook } from '../art/textures';
import type { PlayerState } from '../game/state';
import type { NpcDef } from './npcs';

export interface Outfit {
  id: string;
  name: Text;
  desc: Text;
  top: string;
  bottom: string;
  /** handed out at the stores in the Spor Salonu, with the rest of your kit */
  kit: boolean;
}

export const OUTFITS: Outfit[] = [
  { id: 'sivil', kit: false, top: '#b5503c', bottom: '#3d4f6b', name: { tr: 'Evden geldiğin kıyafetler', en: 'The clothes you came in' }, desc: { tr: 'Kırmızı kazak ve kot pantolon. Hafta sonu için.', en: 'A red jumper and jeans. For the weekend.' } },
  { id: 'uniforma', kit: true, top: '#6e1f2d', bottom: '#5b6168', name: { tr: 'Okul üniforması', en: 'School uniform' }, desc: { tr: 'Bordo kazak, beyaz gömlek, lacivert kravat.', en: 'Burgundy sweater, white shirt, navy tie.' } },
  { id: 'esofman', kit: true, top: '#2f7a45', bottom: '#23262b', name: { tr: 'Eşofman', en: 'Tracksuit' }, desc: { tr: 'Yeşil-siyah okul eşofmanı. Spor ve Beden Eğitimi için.', en: 'The green and black school tracksuit. For sports and PE.' } },
  { id: 'mont', kit: true, top: '#4a4038', bottom: '#5b6168', name: { tr: 'Mont', en: 'Coat' }, desc: { tr: 'Kalın kışlık mont. Yağmurda ve soğukta.', en: 'A thick winter coat. For rain and cold.' } },
  { id: 'pijama', kit: true, top: '#9fc3e0', bottom: '#b9d3e8', name: { tr: 'Pijama', en: 'Pyjamas' }, desc: { tr: 'Açık mavi çizgili pijama. Yatmadan önce.', en: 'Pale blue striped pyjamas. For bedtime.' } },
];
export const BORROWED = 'odunc';
export const PYJAMAS = { top: '#9fc3e0', bottom: '#b9d3e8' };

export const outfitById = (id: string) => OUTFITS.find((o) => o.id === id);
/** the outfits hanging in your locker right now */
export const ownedOutfits = (st: PlayerState) => OUTFITS.filter((o) => !o.kit || st.school.kit);

/** the top and bottom you're wearing */
export function wornColours(st: PlayerState): { top: string; bottom: string } {
  const w = st.wardrobe;
  if (w.wearing === BORROWED && w.borrowed) return { top: w.borrowed.top, bottom: w.borrowed.bottom };
  const o = outfitById(w.wearing) ?? OUTFITS[0];
  return { top: o.top, bottom: o.bottom };
}
export const wornLook = (look: CharacterLook, st: PlayerState): CharacterLook => ({ ...look, ...wornColours(st) });

function hash(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h ^ (h >>> 15)) >>> 0;
}

const LOANS: Array<{ name: Text; top: string; bottom: string }> = [
  { name: { tr: 'sarı kapüşonlusu', en: 'yellow hoodie' }, top: '#e2b23a', bottom: '#3d4f6b' },
  { name: { tr: 'çizgili kazağı', en: 'striped jumper' }, top: '#5b8fc7', bottom: '#4a4038' },
  { name: { tr: 'turuncu forması', en: 'orange football shirt' }, top: '#e07a2f', bottom: '#23262b' },
  { name: { tr: 'mor hırkası', en: 'purple cardigan' }, top: '#7b5aa6', bottom: '#5b6168' },
  { name: { tr: 'yeşil-siyah takım forması', en: 'green and black team shirt' }, top: '#2f7a45', bottom: '#23262b' },
  { name: { tr: 'kırmızı kareli gömleği', en: 'red checked shirt' }, top: '#c0473c', bottom: '#3a4a5c' },
];
/** the favourite thing a friend lends you out of their locker (the same one every time) */
export function loanOf(npc: NpcDef): { name: Text; top: string; bottom: string } {
  return LOANS[hash(npc.id) % LOANS.length];
}

// ---- snacks ----

export interface Snack { id: string; name: Text; hunger: number; mood: number }
/** things that keep: you can eat them on the spot or take them back to your locker */
export const SNACKS: Snack[] = [
  { id: 'atistirmalik', name: { tr: 'Cips & çikolata', en: 'Crisps & chocolate' }, hunger: 10, mood: 6 },
  { id: 'gofret', name: { tr: 'Gofret', en: 'Wafer bar' }, hunger: 8, mood: 5 },
  { id: 'biskuvi', name: { tr: 'Bisküvi', en: 'Biscuits' }, hunger: 12, mood: 3 },
  { id: 'kuruyemis', name: { tr: 'Kuruyemiş', en: 'Nuts & raisins' }, hunger: 14, mood: 3 },
  { id: 'meyvesuyu', name: { tr: 'Meyve suyu', en: 'Fruit juice' }, hunger: 6, mood: 4 },
  { id: 'ayran', name: { tr: 'Ayran', en: 'Ayran' }, hunger: 8, mood: 3 },
  { id: 'kurabiye', name: { tr: 'Ev kurabiyesi', en: 'Homemade cookies' }, hunger: 15, mood: 10 },
  { id: 'seker', name: { tr: 'Cemil Emmi\'nin şekeri', en: "Cemil Emmi's sweets" }, hunger: 4, mood: 6 },
];
export const snackById = (id: string) => SNACKS.find((s) => s.id === id);
/** how much fits in your pockets and in your locker */
export const BAG_MAX = 4;
export const LOCKER_MAX = 8;

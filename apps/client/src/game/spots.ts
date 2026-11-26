// Online, nobody owns a bed or a desk. When you come online you take a free bed, a free chair at the study
// tables and a free desk in the classroom, and they stay yours until you leave. If two players pick the same
// one, whoever came online first keeps it. Playing solo, you always have the usual ones.
import { BEDS, MY_BED, MY_DESK, SEATS } from '../content/dormroom';
import { CLASS_DESKS, MY_CLASS_DESK } from '../content/classroom';

export type Pt = [number, number];
/** bed = bed tile · desk = study-table tile you sit just below · seat = classroom desk tile */
export interface Spots { bed: Pt; desk: Pt; seat: Pt }
export type SpotKind = keyof Spots;

export const CLASSIC: Spots = { bed: MY_BED, desk: MY_DESK, seat: MY_CLASS_DESK };

const same = (a: Pt, b: Pt) => a[0] === b[0] && a[1] === b[1];
export const spotKey = (p: Pt) => `${p[0]},${p[1]}`;

/** your roommates sleep in these, the first one first */
export const NPC_BEDS: Pt[] = BEDS.filter((b) => !same(b, MY_BED));
/** your roommates study at these chairs (SEATS), as table tiles; only the near-side chairs can be a player's */
const npcDeskOf = (i: number): Pt | null => { const s = SEATS[i]; return s && s.face === 'up' ? [s.x, s.y - 1] : null; };
/** your classmates sit at these, the first one first */
export const NPC_CLASS_DESKS: Pt[] = CLASS_DESKS.filter((d) => !same(d, MY_CLASS_DESK));

/** the spots you can take, best first: the usual one, those nobody uses, then the NPCs' own from the last one back */
function choices(kind: SpotKind, npcs: number): Pt[] {
  if (kind === 'bed') return [MY_BED, ...NPC_BEDS.slice(npcs), ...NPC_BEDS.slice(0, npcs).reverse()];
  if (kind === 'seat') return [MY_CLASS_DESK, ...NPC_CLASS_DESKS.slice(npcs), ...NPC_CLASS_DESKS.slice(0, npcs).reverse()];
  const idx = SEATS.map((_, i) => i);
  const order = [...idx.slice(npcs), ...idx.slice(0, npcs).reverse()];
  return [MY_DESK, ...order.map(npcDeskOf).filter((d): d is Pt => d !== null)];
}

/** a player online, and the spots they hold */
export interface Claim { id: string; since: number; gender: string; spots: Spots }

/** from someone else's presence (untrusted): their spots, or the usual ones if they sent none (an older version of the game) */
export function readSpots(v: unknown): Spots {
  const pt = (p: unknown): p is Pt => Array.isArray(p) && p.length === 2 && p.every((n) => Number.isInteger(n) && n >= 0 && n < 100);
  const s = v as Partial<Spots> | null;
  return s && pt(s.bed) && pt(s.desk) && pt(s.seat) ? { bed: s.bed, desk: s.desk, seat: s.seat } : CLASSIC;
}

/** a beats b: online longer (and, at the same moment, the smaller id) */
const beats = (a: Claim, b: Claim) => a.since < b.since || (a.since === b.since && a.id < b.id);

/** your spots, now that you know who else is here: you keep each one unless someone who beats you holds it too,
 *  and then you move to the first one nobody holds. Beds and study chairs are only shared with your own dorm. */
export function settle(me: Claim, others: Claim[], npcs: { roommates: number; classmates: number }): Spots {
  const out = { ...me.spots };
  for (const kind of ['bed', 'desk', 'seat'] as const) {
    const rivals = kind === 'seat' ? others : others.filter((o) => o.gender === me.gender);
    const mine = me.spots[kind];
    if (!rivals.some((o) => beats(o, me) && same(o.spots[kind], mine))) continue;
    const held = new Set(rivals.map((o) => spotKey(o.spots[kind])));
    const elder = new Set(rivals.filter((o) => beats(o, me)).map((o) => spotKey(o.spots[kind])));
    const list = choices(kind, kind === 'seat' ? npcs.classmates : npcs.roommates);
    out[kind] = list.find((p) => !held.has(spotKey(p))) ?? list.find((p) => !elder.has(spotKey(p))) ?? mine;
  }
  return out;
}

/** a reload keeps the spots you had, when they're still free */
export function storedSpots(id: string): Spots {
  try { return readSpots(JSON.parse(sessionStorage.getItem(`dacka.spots.${id}`) ?? 'null')); } catch { return CLASSIC; }
}
export function storeSpots(id: string, s: Spots) {
  try { sessionStorage.setItem(`dacka.spots.${id}`, JSON.stringify(s)); } catch { /* ignore */ }
}

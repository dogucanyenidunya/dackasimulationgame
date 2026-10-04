// Friend groups, rivals and the bad surprises that come from people who don't like you.
import { GROUPS, NPCS, genitiveTr, type GroupId, type NpcDef } from '../content/npcs';
import { FRIEND_AT, type PlayerState } from './state';
import { L, type Text } from '../i18n';

export const DISLIKE_AT = -15;

/** your group = the one where you have the most friends (at least 2), ties broken by total friendship */
export function myGroup(st: PlayerState): GroupId | null {
  let best: GroupId | null = null, bestKey = -Infinity;
  for (const g of GROUPS) {
    const members = NPCS.filter((n) => n.group === g.id);
    const friends = members.filter((n) => (st.friends[n.id] ?? 0) >= FRIEND_AT).length;
    if (friends < 2) continue;
    const key = friends * 1000 + members.reduce((a, n) => a + Math.max(0, st.friends[n.id] ?? 0), 0);
    if (key > bestKey) { bestKey = key; best = g.id; }
  }
  return best;
}

export function dislikers(st: PlayerState): NpcDef[] {
  return NPCS.filter((n) => (st.friends[n.id] ?? 0) <= DISLIKE_AT);
}

export interface Surprise {
  text: (who: string) => Text;
  effect: { mood?: number; minutes?: number; discipline?: number; homeworkHit?: boolean; gossip?: boolean };
}

export const SURPRISES: Surprise[] = [
  { text: (w) => ({ tr: `${w} ayakkabılarını saklamış! Ararken 20 dakika kaybettin.`, en: `${w} hid your shoes! You lost 20 minutes looking for them.` }), effect: { mood: -5, minutes: 20 } },
  { text: (w) => ({ tr: `${w} ödev defterine "yanlışlıkla" su döktü.`, en: `${w} "accidentally" spilled water on your homework notebook.` }), effect: { mood: -4, homeworkHit: true } },
  { text: (w) => ({ tr: `${w} herkese senin hakkında dedikodu yapmış.`, en: `${w} has been gossiping about you to everyone.` }), effect: { mood: -6, gossip: true } },
  { text: (w) => ({ tr: `${w} seni belletmene şikâyet etmiş: "Gece fener yaktı!"`, en: `${w} told the belletmen on you: "They had a torch on at night!"` }), effect: { discipline: 3, mood: -3 } },
  { text: (w) => ({ tr: `${w} kahvaltıda yerini kaptı ve gülüp geçti.`, en: `${w} grabbed your seat at breakfast and laughed it off.` }), effect: { mood: -4 } },
];

/** "Mert'in grubu" / "Mert's group", or your own name for your group */
export function groupLabel(gid: GroupId, st: PlayerState): string {
  if (gid === myGroup(st) && st.groupName) return st.groupName;
  const leader = NPCS.find((n) => n.id === GROUPS.find((g) => g.id === gid)!.leader)!.name;
  return L({ tr: `${genitiveTr(leader)} grubu`, en: `${leader}'s group` });
}

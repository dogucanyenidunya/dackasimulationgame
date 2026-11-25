// Which interactions you have with someone depends on how close you are and how old they are (after Popmundo,
// where what you could do with a character opened up as your relationship grew). Each interaction is a row:
// the relationship tier it needs, which ages it suits, and the group it's shown in.
import { L, type Text } from '../i18n';
import type { NpcDef } from '../content/npcs';

/** relationship tiers, from the friendship score (−100…100); the same steps as friendLevel() */
export type Tier = 'rival' | 'cold' | 'stranger' | 'known' | 'friend' | 'close' | 'best';
export const TIERS: Tier[] = ['rival', 'cold', 'stranger', 'known', 'friend', 'close', 'best'];

export function tierOf(f: number): Tier {
  if (f >= 90) return 'best';
  if (f >= 70) return 'close';
  if (f >= 40) return 'friend';
  if (f >= 10) return 'known';
  if (f > -15) return 'stranger';
  if (f > -40) return 'cold';
  return 'rival';
}

export const TIER_NAME: Record<Tier, Text> = {
  rival: { tr: 'Rakip', en: 'Rival' },
  cold: { tr: 'Anlaşamıyorsunuz', en: "Don't get along" },
  stranger: { tr: 'Yabancı', en: 'Stranger' },
  known: { tr: 'Tanıdık', en: 'Acquaintance' },
  friend: { tr: 'Arkadaş', en: 'Friend' },
  close: { tr: 'Yakın arkadaş', en: 'Close friend' },
  best: { tr: 'En iyi arkadaş', en: 'Best friend' },
};

/** how old they are next to you: two or more grades apart counts as younger / older */
export type AgeRel = 'younger' | 'peer' | 'older' | 'adult';

export function ageRel(npc: NpcDef, playerGrade: number): AgeRel {
  if (npc.kind === 'teacher' || npc.kind === 'belletmen') return 'adult';
  // (the abis and ablas without a set grade are lise students)
  const g = npc.grade ?? (npc.kind === 'abi' ? 10 : playerGrade);
  return g <= playerGrade - 2 ? 'younger' : g >= playerGrade + 2 ? 'older' : 'peer';
}

/** how the actions are grouped (and ordered) in someone's panel */
export type Group = 'talk' | 'play' | 'help' | 'risky';
const GROUP_ORDER: Group[] = ['talk', 'play', 'help', 'risky'];

interface Rule {
  group: Group;
  /** the closest you need to be at least */
  min?: Tier;
  /** the closest you may be at most (apologising is for when things are bad) */
  max?: Tier;
  /** the ages it suits (any when unset) */
  ages?: AgeRel[];
  /** only with someone in your own grade (you can't copy the homework of another grade) */
  sameGrade?: boolean;
}

/** the student interactions; ids are the panel's action ids */
export const RULES: Record<string, Rule> = {
  meet: { group: 'talk' },
  chat: { group: 'talk' },
  hello: { group: 'talk' },
  sorry: { group: 'talk', max: 'cold' },
  joke: { group: 'talk', min: 'known' },
  // (Sırdaş opens it from Arkadaş; the panel checks that itself)
  secret: { group: 'talk', min: 'friend' },
  play: { group: 'play', min: 'known' },
  yetimball: { group: 'play', min: 'known' },
  treat: { group: 'help' },
  comfort: { group: 'help', min: 'known' },
  borrow: { group: 'help', min: 'friend' },
  copy: { group: 'risky', min: 'friend', sameGrade: true },
  nickname: { group: 'risky', min: 'known', ages: ['peer', 'younger'] },
  gossip: { group: 'risky', min: 'known' },
  // you can mock anyone your age or younger, even a stranger; not an older student
  mock: { group: 'risky', ages: ['peer', 'younger'] },
  study: { group: 'help', min: 'friend' },
  heart: { group: 'talk', min: 'close' },
  story: { group: 'talk', min: 'close' },
  // when things are bad: settle it in a race (not with someone younger), or find a friend in common to make peace
  challenge: { group: 'risky', max: 'cold', ages: ['peer', 'older'] },
  mediate: { group: 'help', max: 'cold' },

  // older students (abi / abla): what they can do for a little one they know
  advice: { group: 'talk', min: 'known', ages: ['older'] },
  errand: { group: 'help', min: 'known', ages: ['older'] },
  protect: { group: 'help', min: 'friend', ages: ['older'] },
  notes: { group: 'help', min: 'close', ages: ['older'] },

  // adults: teachers, belletmens and the staff. For them the score reads as trust, not friendship
  ask: { group: 'talk', ages: ['adult'] },
  extra: { group: 'help', min: 'known', ages: ['adult'] },
  guidance: { group: 'talk', min: 'friend', ages: ['adult'] },
  confide: { group: 'talk', min: 'known', ages: ['adult'] },
  pass: { group: 'help', min: 'friend', ages: ['adult'] },
  banter: { group: 'talk', ages: ['adult'] },
  onthehouse: { group: 'help', min: 'friend', ages: ['adult'] },
  counter: { group: 'help', min: 'close', ages: ['adult'] },
  sweep: { group: 'help', ages: ['adult'] },
  chess: { group: 'play', min: 'known', ages: ['adult'] },
  oldtimes: { group: 'talk', min: 'friend', ages: ['adult'] },

  // shared history: these only appear when something happened between you (a dilemma, a race); the tier still applies
  phoneThanks: { group: 'talk', min: 'known' },
  phoneSorry: { group: 'talk' },
  sawYou: { group: 'talk' },
  snitchSorry: { group: 'talk' },
  leverage: { group: 'risky' },
  partyPartner: { group: 'talk', min: 'known' },
  rematch: { group: 'play', min: 'known' },
};

const rank = (t: Tier) => TIERS.indexOf(t);

export interface Who { tier: Tier; age: AgeRel; sameGrade: boolean }

/** why an action isn't open with this person: 'tier' (not close enough yet), 'other' (age, grade, too close), or null */
export function blockedBy(id: string, who: Who): 'tier' | 'other' | null {
  const r = RULES[id];
  if (!r) return null;
  if (r.ages && !r.ages.includes(who.age)) return 'other';
  if (r.sameGrade && !who.sameGrade) return 'other';
  if (r.max && rank(who.tier) > rank(r.max)) return 'other';
  if (r.min && rank(who.tier) < rank(r.min)) return 'tier';
  return null;
}

/** keeps what's open with this person, ordered talk → play → help → risky; and the next tier that would open more */
export function sortOut<A extends { id: string }>(actions: A[], who: Who): { open: A[]; next: Tier | null } {
  const open = actions.filter((a) => blockedBy(a.id, who) === null);
  const order = (a: A) => GROUP_ORDER.indexOf(RULES[a.id]?.group ?? 'talk');
  open.sort((a, b) => order(a) - order(b));
  const waiting = actions.filter((a) => blockedBy(a.id, who) === 'tier').map((a) => RULES[a.id].min!);
  const next = waiting.length ? waiting.sort((a, b) => rank(a) - rank(b))[0] : null;
  return { open, next };
}

/** with an adult the same score is how much they trust you */
export const TRUST_NAME: Record<Tier, Text> = {
  rival: { tr: 'Sana kızgın', en: 'Angry with you' },
  cold: { tr: 'Sana mesafeli', en: 'Wary of you' },
  stranger: { tr: 'Seni pek tanımıyor', en: "Doesn't know you yet" },
  known: { tr: 'Seni tanıyor', en: 'Knows you' },
  friend: { tr: 'Sana güveniyor', en: 'Trusts you' },
  close: { tr: 'Sana çok güveniyor', en: 'Trusts you a lot' },
  best: { tr: 'Sana kendi çocuğu gibi bakıyor', en: 'Treats you like family' },
};

/** "Sana güveniyor · 42/100" for an adult */
export const trustLine = (f: number) => `${L(TRUST_NAME[tierOf(f)])} · ${L({ tr: 'güven', en: 'trust' })} ${f}/100`;

/** the hint at the bottom: what you'd need to be for more to open (it doesn't say what) */
export function nextTierHint(next: Tier, age?: AgeRel): string {
  if (age === 'adult') return L({ tr: `🤝 "${L(TRUST_NAME[next])}" olunca yeni şeyler açılır`, en: `🤝 More opens up at "${L(TRUST_NAME[next])}"` });
  return L({ tr: `💛 ${L(TIER_NAME[next])} olunca yeni şeyler açılır`, en: `💛 More opens up once you're ${L(TIER_NAME[next]).toLowerCase()}s` });
}

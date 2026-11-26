// Levels and development points, the Mount & Blade way: every 100 XP you earn is a level. Each level gives you a point
// to put into one of your attributes (+2, never past this grade's ceiling), and every third level a perk. Spending
// never takes XP away: XP still counts towards the end of the year as before.
import type { Text } from '../i18n';
import type { AttrId } from '../content/character';

export const XP_PER_LEVEL = 100;
/** what one development point adds to an attribute */
export const ATTR_STEP = 2;
/** a perk every this many levels */
export const PERK_EVERY = 3;

export type PerkId = 'hizliOkuma' | 'ezberci' | 'dayanikli' | 'takimOyuncusu' | 'sohbetUstasi' | 'pazarlikci' | 'dakik' | 'ustaEller';

export interface Perk { id: PerkId; icon: string; name: Text; desc: Text; attr: AttrId; need: number }

export const PERKS: Perk[] = [
  { id: 'hizliOkuma', icon: '📖', attr: 'knowledge', need: 20, name: { tr: 'Hızlı Okuma', en: 'Speed Reading' }, desc: { tr: 'Kitap oturumu 45 yerine 30 dk sürer.', en: 'A reading session takes 30 min instead of 45.' } },
  { id: 'ezberci', icon: '🧠', attr: 'knowledge', need: 35, name: { tr: 'Ezberci', en: 'Quick Study' }, desc: { tr: 'Ödev bulmacasında bir hakkın daha olur.', en: 'One more try in the homework puzzle.' } },
  { id: 'dayanikli', icon: '🏃', attr: 'fitness', need: 20, name: { tr: 'Dayanıklı', en: 'Stamina' }, desc: { tr: 'Enerjin %20 daha yavaş düşer.', en: 'Your energy drains 20% more slowly.' } },
  { id: 'takimOyuncusu', icon: '🏀', attr: 'fitness', need: 35, name: { tr: 'Takım Oyuncusu', en: 'Team Player' }, desc: { tr: 'Sahadaki maçlarda isabet alanın daha geniş.', en: 'A wider sweet spot in pick-up games on the courts.' } },
  { id: 'sohbetUstasi', icon: '💬', attr: 'social', need: 20, name: { tr: 'Sohbet Ustası', en: 'Smooth Talker' }, desc: { tr: 'Arkadaşlık kazançların %25 daha fazla.', en: 'Your friendship gains are 25% bigger.' } },
  { id: 'pazarlikci', icon: '🪙', attr: 'social', need: 35, name: { tr: 'Pazarlıkçı', en: 'Haggler' }, desc: { tr: 'Kantinde her şey %10 daha ucuz.', en: 'Everything at the canteen is 10% cheaper.' } },
  { id: 'dakik', icon: '⏰', attr: 'discipline', need: 20, name: { tr: 'Dakik', en: 'Punctual' }, desc: { tr: 'Derse ve etüde geç kalma payın 5 dk daha uzun.', en: 'Five more minutes before you count as late for lessons and study.' } },
  { id: 'ustaEller', icon: '🎨', attr: 'creativity', need: 20, name: { tr: 'Usta Eller', en: 'Skilled Hands' }, desc: { tr: '"Yaratıcı ol" bir Yaratıcılık daha verir.', en: '"Get creative" gives one more Creativity.' } },
];

export interface Growth {
  /** all the XP you've ever earned (it doesn't go down when you spend points) */
  earned: number;
  /** development points put into attributes so far */
  attrSpent: number;
  perks: PerkId[];
}

export const newGrowth = (): Growth => ({ earned: 0, attrSpent: 0, perks: [] });
export const levelOf = (g: Growth) => Math.floor(g.earned / XP_PER_LEVEL);
/** XP into the current level (0–99) */
export const levelProgress = (g: Growth) => g.earned - levelOf(g) * XP_PER_LEVEL;
export const attrPoints = (g: Growth) => Math.max(0, levelOf(g) - g.attrSpent);
export const perkPoints = (g: Growth) => Math.max(0, Math.floor(levelOf(g) / PERK_EVERY) - g.perks.length);
export const hasPerk = (st: { growth: Growth }, id: PerkId) => st.growth.perks.includes(id);

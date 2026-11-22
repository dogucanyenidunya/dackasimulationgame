// Secret skills (after Popmundo's): who you are becoming unlocks small, lasting abilities. Each one belongs to
// one end of a temperament axis and opens once you lean far enough that way. You keep it even if you change
// later, and only you can see your own.
import type { Text } from '../i18n';
import type { AxisId, PlayerState } from './state';

export type SecretId =
  | 'sessizAdim' | 'gozde' | 'azim' | 'keyif' | 'sahne' | 'odak'
  | 'teselli' | 'kalkan' | 'devre' | 'yalniz' | 'sirdas' | 'icKale';

/** how far along an axis you have to lean (it runs from −100 to 100) */
export const SECRET_AT = 25;

export interface Secret {
  id: SecretId;
  axis: AxisId;
  /** +1: the `hi` end of the axis (Haylaz, Hırslı…); −1: the `lo` end (Uslu, Rahat…) */
  dir: 1 | -1;
  name: Text;
  /** what it does, as the player reads it */
  effect: Text;
}

export const SECRETS: Secret[] = [
  { id: 'sessizAdim', axis: 'rules', dir: 1, name: { tr: 'Sessiz Adım', en: 'Soft Step' },
    effect: { tr: 'Gece devriyesi ve seni arayan belletmenler seni ancak daha yakından fark eder.', en: 'The night patrol and belletmens out looking for you only spot you from closer up.' } },
  { id: 'gozde', axis: 'rules', dir: -1, name: { tr: 'Öğretmenin Gözdesi', en: "Teacher's Pet" },
    effect: { tr: 'Temiz geçen her gün disiplin puanın 2 yerine 4 düşer.', en: 'Each clean day takes 4 discipline points off your record instead of 2.' } },
  { id: 'azim', axis: 'ambition', dir: 1, name: { tr: 'Azim', en: 'Grit' },
    effect: { tr: 'Sınavlarda +5 puan alırsın.', en: 'You get +5 points in exams.' } },
  { id: 'keyif', axis: 'ambition', dir: -1, name: { tr: 'Keyif Ehli', en: 'Takes It Easy' },
    effect: { tr: 'Uyanıkken enerjin %25 daha yavaş biter.', en: 'Your energy runs down 25% more slowly while you are awake.' } },
  { id: 'sahne', axis: 'presence', dir: 1, name: { tr: 'Sahne Işığı', en: 'Spotlight' },
    effect: { tr: 'Şakaların ve taktığın lakaplar çok daha sık tutar.', en: 'Your jokes and the nicknames you give land much more often.' } },
  { id: 'odak', axis: 'presence', dir: -1, name: { tr: 'Derin Odak', en: 'Deep Focus' },
    effect: { tr: 'Ödev yapmak ve kitap okumak sana +1 Bilgi daha kazandırır.', en: 'Homework and reading give you +1 more Knowledge.' } },
  { id: 'teselli', axis: 'warmth', dir: -1, name: { tr: 'Teselli', en: 'Comfort' },
    effect: { tr: 'Arkadaşlarını teselli edebilirsin: günde bir kez, +15 arkadaşlık.', en: 'You can comfort your friends: once a day each, +15 friendship.' } },
  { id: 'kalkan', axis: 'warmth', dir: 1, name: { tr: 'Kimse Bulaşamaz', en: 'Untouchable' },
    effect: { tr: 'Senden hoşlanmayanlar artık sana kötü sürpriz yapmaya cesaret edemez.', en: "People who don't like you no longer dare to play nasty tricks on you." } },
  { id: 'devre', axis: 'loyalty', dir: 1, name: { tr: 'Devre Ruhu', en: 'Devre Spirit' },
    effect: { tr: 'Arkadaşlıkların %15 daha hızlı gelişir.', en: 'Your friendships grow 15% faster.' } },
  { id: 'yalniz', axis: 'loyalty', dir: -1, name: { tr: 'Kendi Kendine Yeter', en: 'Self-Sufficient' },
    effect: { tr: 'Moralin 20\'nin altına düşmez.', en: 'Your mood never drops below 20.' } },
  { id: 'sirdas', axis: 'heart', dir: 1, name: { tr: 'Sırdaş', en: 'Confidant' },
    effect: { tr: 'Sırlarını yalnızca yakın arkadaşlarınla değil, her arkadaşınla paylaşabilirsin; rehber öğretmenle konuşmak daha çok iyi gelir.', en: 'You can share secrets with any friend, not just close ones, and talking to the counselor does you more good.' } },
  { id: 'icKale', axis: 'heart', dir: -1, name: { tr: 'İç Kale', en: 'Inner Fortress' },
    effect: { tr: 'Kötü sürprizler moralini yarısı kadar bozar.', en: 'Nasty tricks hurt your mood only half as much.' } },
];

export const hasSecret = (st: PlayerState, id: SecretId) => st.secrets.includes(id);

/** secrets you lean far enough for but haven't opened yet */
export function dueSecrets(st: PlayerState): Secret[] {
  return SECRETS.filter((s) => !st.secrets.includes(s.id) && st.temper[s.axis] * s.dir >= SECRET_AT);
}

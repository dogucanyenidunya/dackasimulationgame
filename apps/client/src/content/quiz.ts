// Library books (titles and blurbs only; the game uses guessing games instead of real school questions).
import type { Text } from '../i18n';
import type { BookId } from '../game/state';

export interface Book { id: BookId; title: Text; author: string; blurb: Text }

export const BOOKS: Book[] = [
  { id: 'kucuk_prens', title: { tr: 'Küçük Prens', en: 'The Little Prince' }, author: 'Antoine de Saint-Exupéry',
    blurb: { tr: 'Çölde mahsur kalan bir pilot, küçük bir gezegenden gelen bir prensle tanışır.', en: 'A pilot stranded in the desert meets a prince from a tiny planet.' } },
  { id: 'pal_sokagi', title: { tr: 'Pal Sokağı Çocukları', en: 'The Paul Street Boys' }, author: 'Ferenc Molnár',
    blurb: { tr: 'Bir grup çocuk, oyun oynadıkları boş arsayı başka bir çeteye karşı korur.', en: 'A group of boys defends their playground from a rival gang.' } },
  { id: 'nasreddin', title: { tr: 'Nasreddin Hoca Fıkraları', en: 'Tales of Nasreddin Hodja' }, author: 'Halk hikâyeleri',
    blurb: { tr: 'Akıllı ve komik Nasreddin Hoca\'nın kısa hikâyeleri.', en: 'Short, clever and funny stories about Nasreddin Hodja.' } },
];

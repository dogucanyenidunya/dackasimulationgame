// Classmates (4-A) and the older students who ask favors. Positions in tiles.
import type { CharacterLook } from '../art/textures';
import type { Text } from '../i18n';
import { HANGOUTS, type AgeGroup } from './campus';

export interface NpcDef {
  id: string;
  name: string;
  /** classmate = your 4th-grade class · student = other classes/grades · abi = older student · belletmen = night teacher */
  kind: 'classmate' | 'student' | 'abi' | 'belletmen';
  gender: 'girl' | 'boy';
  /** friend group (students only) */
  group?: GroupId;
  /** school grade (4–12); decides where they hang out */
  grade?: number;
  /** stays at its home spot instead of the age-group hangouts (e.g. the abis on the dorm plaza) */
  fixed?: boolean;
  role: Text;
  look: Partial<CharacterLook>;
  home: [number, number];
  /** how far they wander from home, in tiles */
  roam: number;
  lines: Text[];
}

const HANDMADE: Array<Omit<NpcDef, 'gender'>> = [
  { id: 'zeynep', name: 'Zeynep', kind: 'classmate', role: { tr: 'Sınıf arkadaşın', en: 'Your classmate' }, look: { skin: '#f1c9a5', hair: '#1f1612', hairStyle: 2, skirt: true }, home: [36, 12], roam: 3,
    lines: [{ tr: 'Denize bayılırım. Keşke bir teknede yaşasam!', en: "I love the sea. I'd live on a boat if I could!" }, { tr: 'Matematik ödevini yaptın mı? Ben bölmede takıldım.', en: 'Did you do the math homework? I got stuck on division.' }] },
  { id: 'mert', name: 'Mert', kind: 'classmate', role: { tr: 'Sınıf arkadaşın', en: 'Your classmate' }, look: { skin: '#c68e63', hair: '#2b1d14', hairStyle: 1, skirt: false }, home: [60, 13], roam: 3,
    lines: [{ tr: 'Teneffüste kortta maç var, gelsene!', en: "There's a game on the court at break, come!" }, { tr: 'Yemekhanede bugün mercimek çorbası var bence.', en: "I bet it's lentil soup in the dining hall today." }] },
  { id: 'defne', name: 'Defne', kind: 'classmate', role: { tr: 'Sınıf arkadaşın', en: 'Your classmate' }, look: { skin: '#e8b98f', hair: '#7a4a24', hairStyle: 3, skirt: true, glasses: true }, home: [44, 24], roam: 3,
    lines: [{ tr: 'Kütüphanede gizli bir raf varmış, duydun mu?', en: 'Have you heard there\'s a secret shelf in the library?' }, { tr: 'Resim yapmayı seviyorum. Sen ne seversin?', en: 'I love drawing. What do you like?' }] },
  { id: 'emre', name: 'Emre', kind: 'classmate', role: { tr: 'Sınıf arkadaşın', en: 'Your classmate' }, look: { skin: '#a8714a', hair: '#120c09', hairStyle: 0, skirt: false }, home: [60, 33], roam: 3,
    lines: [{ tr: 'İlk gece hiç uyuyamadım. Sen?', en: "I couldn't sleep at all the first night. You?" }, { tr: 'Eskrim çok havalı görünüyor!', en: 'Fencing looks so cool!' }] },
  { id: 'ayse', name: 'Ayşe', kind: 'classmate', role: { tr: 'Sınıf arkadaşın', en: 'Your classmate' }, look: { skin: '#f3d2b3', hair: '#c79a4a', hairStyle: 2, skirt: true }, home: [38, 33], roam: 2,
    lines: [{ tr: 'Tenis kortunda kimse yokken top sektirmeyi seviyorum.', en: 'I like bouncing a ball on the tennis court when nobody is around.' }, { tr: 'Annem her pazar ziyarete gelecek.', en: 'My mum will visit every Sunday.' }] },
  { id: 'can', name: 'Can', kind: 'classmate', role: { tr: 'Sınıf arkadaşın', en: 'Your classmate' }, look: { skin: '#d9a77d', hair: '#3b2a20', hairStyle: 0, skirt: false }, home: [20, 18], roam: 2,
    lines: [{ tr: 'Müzede eski bir okul zili var, gördün mü?', en: "There's an old school bell in the museum, have you seen it?" }, { tr: 'Hüseyin Usta çok iyi biri ama atölyeye kimseyi almıyor.', en: "Hüseyin Usta is really nice, but he doesn't let anyone into the workshop." }] },
  { id: 'burak', name: 'Burak Abi', kind: 'abi', role: { tr: '11. sınıf · abi', en: 'Grade 11 · an older student' }, look: { skin: '#d9a77d', hair: '#2b1d14', hairStyle: 0, skirt: false, top: '#3f4a55', bottom: '#2d3238' }, home: [46, 9], roam: 1,
    lines: [{ tr: 'Hoş geldin ufaklık! Bir şeye ihtiyacın olursa söyle.', en: 'Welcome, little one! Tell me if you need anything.' }] },
  { id: 'ece', name: 'Ece Abla', kind: 'abi', role: { tr: '10. sınıf · abla', en: 'Grade 10 · an older student' }, look: { skin: '#f1c9a5', hair: '#5e3b22', hairStyle: 3, skirt: true, top: '#3f4a55', bottom: '#2d3238' }, home: [31, 9], roam: 1,
    lines: [{ tr: 'İlk yılım aklıma geldi… Zamanla burası evin olacak.', en: 'Reminds me of my first year… this place becomes home, you\'ll see.' }] },
];

export type GroupId = 'kortcular' | 'kitap' | 'sanat' | 'haylaz';
/** friend groups have no names; they're known by their best-known member ("Mert'in grubu"). Only yours can be named. */
export const GROUPS: Array<{ id: GroupId; leader: string; rival: GroupId }> = [
  { id: 'kortcular', leader: 'mert', rival: 'kitap' },
  { id: 'kitap', leader: 'zeynep', rival: 'kortcular' },
  { id: 'sanat', leader: 'defne', rival: 'haylaz' },
  { id: 'haylaz', leader: 'emre', rival: 'sanat' },
];

/** Turkish genitive: Mert'in, Can'ın, Ayşe'nin, Zeynep'in */
export function genitiveTr(name: string): string {
  const vowels = 'aıoueiöüAIOUEİÖÜ';
  const last = [...name].reverse().find((ch) => vowels.includes(ch))?.toLocaleLowerCase('tr-TR') ?? 'e';
  const v = 'aı'.includes(last) ? 'ı' : 'ei'.includes(last) ? 'i' : 'ou'.includes(last) ? 'u' : 'ü';
  const endsVowel = vowels.includes(name[name.length - 1]);
  return `${name}'${endsVowel ? 'n' : ''}${v}n`;
}

export const HAND_GROUPS: Record<string, GroupId> = { zeynep: 'kitap', mert: 'kortcular', defne: 'sanat', emre: 'haylaz', ayse: 'kortcular', can: 'kitap' };

// ---- generated students (deterministic so everyone keeps the same name and look between sessions) ----
function rng(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}
const GIRLS = ['Elif', 'Zehra', 'Melis', 'Nehir', 'Ecrin', 'Asel', 'Duru', 'İpek', 'Beren', 'Lina', 'Ada', 'Eylül', 'Yağmur', 'Nisa', 'Su', 'Ela', 'Azra', 'Hira'];
const BOYS = ['Arda', 'Yusuf', 'Kaan', 'Ege', 'Berk', 'Ömer', 'Alp', 'Deniz', 'Efe', 'Kuzey', 'Mirza', 'Baran', 'Eymen', 'Aras', 'Tuna', 'Doruk', 'Çınar', 'Selim'];
const SKINS = ['#f6d7bd', '#f1c9a5', '#e8b98f', '#d9a77d', '#c68e63', '#a8714a', '#8a5a3b'];
const HAIRS = ['#120c09', '#2b1d14', '#3b2a20', '#5e3b22', '#7a4a24', '#a8682e', '#c79a4a'];
const GENERIC_LINES: Text[] = [
  { tr: 'Bugün yemekhanede ne var biliyor musun?', en: "Do you know what's for dinner today?" },
  { tr: 'Etütte matematik ödevini birlikte yapalım mı?', en: 'Want to do the math homework together at study time?' },
  { tr: 'Belletmen Mehmet Bey çok sert ama aslında iyi biri.', en: 'Mr. Mehmet the belletmen is strict, but he\'s actually nice.' },
  { tr: 'Hafta sonu ziyaret günü, sabırsızlanıyorum!', en: "It's visiting day this weekend, I can't wait!" },
  { tr: 'Kortta maç yapıyoruz, takıma bir kişi lazım.', en: "We're playing on the court and need one more." },
  { tr: 'Müzedeki eski fotoğraflarda bir tanesi bize benziyor!', en: 'One of the old photos in the museum looks just like us!' },
];
// day hangouts (tiles): dorm plaza, central plaza, by the courts, in front of the sports hall
const SPOTS = HANGOUTS;

function generate(): NpcDef[] {
  const r = rng(1863);
  const out: NpcDef[] = [];
  const pickName = (girl: boolean, used: Set<string>) => {
    const pool = girl ? GIRLS : BOYS;
    for (;;) { const n = pool[Math.floor(r() * pool.length)]; if (!used.has(n)) { used.add(n); return n; } }
  };
  const used = new Set(HANDMADE.map((h) => h.name));
  const make = (kind: 'classmate' | 'student' | 'abi', i: number): NpcDef => {
    const girl = r() < 0.5;
    const spot = SPOTS[Math.floor(r() * SPOTS.length)];
    const older = kind === 'abi';
    const g = older ? 9 + Math.floor(r() * 3) : kind === 'classmate' ? 4 : 4 + Math.floor(r() * 5);
    const cls = ['A', 'B', 'C', 'D'][Math.floor(r() * 4)];
    const name = pickName(girl, used) + (older ? (girl ? ' Abla' : ' Abi') : '');
    return {
      id: `${kind}-${i}`, name, kind, gender: girl ? 'girl' : 'boy', grade: g,
      group: older ? undefined : GROUPS[(i + (kind === 'student' ? 2 : 0)) % GROUPS.length].id,
      role: kind === 'classmate' ? { tr: 'Sınıf arkadaşın', en: 'Your classmate' }
        : older ? { tr: `${g}. sınıf · ${girl ? 'abla' : 'abi'}`, en: `Grade ${g} · an older student` }
          : { tr: `${g}-${cls} öğrencisi`, en: `Student in ${g}-${cls}` },
      look: {
        skin: SKINS[Math.floor(r() * SKINS.length)], hair: HAIRS[Math.floor(r() * HAIRS.length)],
        hairStyle: (girl ? [0, 2, 3][Math.floor(r() * 3)] : [0, 1][Math.floor(r() * 2)]) as 0 | 1 | 2 | 3,
        skirt: girl && r() < 0.8, glasses: r() < 0.15,
        ...(older ? { top: '#3f4a55', bottom: '#2d3238' } : {}),
      },
      home: [spot[0] + Math.round((r() - 0.5) * spot[2] * 2), spot[1] + Math.round((r() - 0.5) * spot[2] * 2)],
      roam: spot[2],
      lines: [GENERIC_LINES[Math.floor(r() * GENERIC_LINES.length)], GENERIC_LINES[Math.floor(r() * GENERIC_LINES.length)]],
    };
  };
  for (let i = 0; i < 8; i++) out.push(make('classmate', i));
  for (let i = 0; i < 20; i++) out.push(make('student', i));
  for (let i = 0; i < 4; i++) out.push(make('abi', i));
  return out;
}

const withGender = (h: Omit<NpcDef, 'gender'>): NpcDef => ({ ...h, group: HAND_GROUPS[h.id], grade: h.kind === 'abi' ? (h.id === 'burak' ? 11 : 10) : 4, fixed: h.kind === 'abi', gender: h.look.skirt || h.look.hairStyle === 2 || h.look.hairStyle === 3 ? 'girl' : 'boy' });

/** 40 students: 14 classmates, 20 from other classes, 6 older students */
export const NPCS: NpcDef[] = [...HANDMADE.map(withGender), ...generate()];

/** night teachers: on duty from 18:00 to 07:00 */
export const BELLETMENS: NpcDef[] = [
  { id: 'bel-hatice', name: 'Hatice Hanım', kind: 'belletmen', gender: 'girl', role: { tr: 'Belletmen · Kız Yurdu', en: "Belletmen · girls' dorm" }, look: { skin: '#e8b98f', hair: '#5e3b22', hairStyle: 3, skirt: true, top: '#6b3a3a', bottom: '#3a3a3a', glasses: true }, home: [29, 9], roam: 0,
    lines: [{ tr: 'Etüt saatinde herkes yurtta! Ödevler bitmeden oyun yok.', en: 'Everyone in the dorm at study time! No games until homework is done.' }, { tr: 'Saat 22:00\'de ışıklar sönüyor, unutma.', en: 'Lights out at 22:00, remember.' }] },
  { id: 'bel-mehmet', name: 'Mehmet Bey', kind: 'belletmen', gender: 'boy', role: { tr: 'Belletmen · Erkek Yurdu', en: "Belletmen · boys' dorm" }, look: { skin: '#c68e63', hair: '#3b2a20', hairStyle: 1, skirt: false, top: '#3a4a6b', bottom: '#2d3238' }, home: [66, 9], roam: 0,
    lines: [{ tr: 'Meydandan ayrılmak yok. Sizi buradan görebiliyorum!', en: 'Nobody leaves the plaza. I can see you all from here!' }, { tr: 'Yarın sabah erken kalkacaksınız, haydi bakalım.', en: 'Early start tomorrow, off you go.' }] },
  { id: 'bel-selim', name: 'Selim Bey', kind: 'belletmen', gender: 'boy', role: { tr: 'Belletmen · gece nöbeti', en: 'Belletmen · night patrol' }, look: { skin: '#d9a77d', hair: '#120c09', hairStyle: 0, skirt: false, top: '#2f4a3a', bottom: '#2d3238' }, home: [48, 13], roam: 5,
    lines: [{ tr: 'Gece nöbetindeyim. Fenerim her yeri görür!', en: "I'm on night patrol. My torch sees everything!" }] },
];

export function friendLevel(v: number): Text {
  if (v >= 90) return { tr: 'En iyi arkadaş', en: 'Best friend' };
  if (v >= 70) return { tr: 'Yakın arkadaş', en: 'Close friend' };
  if (v >= 40) return { tr: 'Arkadaş', en: 'Friend' };
  if (v >= 10) return { tr: 'Tanıdık', en: 'Acquaintance' };
  if (v > -15) return { tr: 'Yabancı', en: 'Stranger' };
  if (v > -40) return { tr: 'Anlaşamıyorsunuz', en: "Don't get along" };
  return { tr: 'Rakip', en: 'Rival' };
}

export function ageGroup(n: NpcDef): AgeGroup {
  const g = n.grade ?? 4;
  return g <= 4 ? 'g4' : g <= 6 ? 'g56' : g <= 8 ? 'g78' : 'lise';
}

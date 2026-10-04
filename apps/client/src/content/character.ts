// Character creation content: look options, traits, family and "Your story" (GDD §5).
import type { CharacterLook } from '../art/textures';
import { getLang, type Text } from '../i18n';

export type Gender = 'girl' | 'boy';
export type TraitId = 'curious' | 'sporty' | 'chatty' | 'creative' | 'calm';
export type Loss = 'mother' | 'father' | 'both';
export type CauseId = 'illness' | 'accident' | 'disaster' | 'work' | 'service' | 'private';
export type GuardianId =
  | 'mother' | 'father' | 'grandma_m' | 'grandma_f' | 'grandpa' | 'aunt_m' | 'aunt_f' | 'uncle_m' | 'uncle_f' | 'sister' | 'brother';
export type MemoryScenes = 'full' | 'gentle' | 'off';
/** evci = goes home every weekend · daimi = stays at school */
export type Boarding = 'evci' | 'daimi';
export type AttrId = 'knowledge' | 'fitness' | 'social' | 'discipline' | 'creativity';
export type Attributes = Record<AttrId, number>;

export interface CharacterData {
  first: string;
  last: string;
  gender: Gender;
  look: CharacterLook;
  hometown: string;
  trait: TraitId;
  loss: Loss;
  guardian: GuardianId;
  cause: CauseId;
  memoryScenes: MemoryScenes;
  /** missing in older saves: treated as 'daimi' */
  boarding?: Boarding;
  attributes: Attributes;
  respect: number;
}

export const SKIN_TONES = ['#f6d7bd', '#f1c9a5', '#e8b98f', '#d9a77d', '#c68e63', '#a8714a', '#8a5a3b', '#6b432b'];
export const HAIR_COLORS = ['#120c09', '#2b1d14', '#3b2a20', '#5e3b22', '#7a4a24', '#a8682e', '#c79a4a', '#b5462e'];
export const HAIR_STYLES: Array<{ id: 0 | 1 | 2 | 3; name: Text }> = [
  { id: 0, name: { tr: 'Kısa', en: 'Short' } },
  { id: 1, name: { tr: 'Çok kısa', en: 'Buzz' } },
  { id: 2, name: { tr: 'Uzun', en: 'Long' } },
  { id: 3, name: { tr: 'At kuyruğu', en: 'Ponytail' } },
];
/** Daçka uniform: navy sweater, white shirt, burgundy tie, grey trousers/skirt */
export const UNIFORM = { top: '#22365c', bottom: '#5b6168' };

export const ATTRS: Array<{ id: AttrId; name: Text }> = [
  { id: 'knowledge', name: { tr: 'Bilgi', en: 'Knowledge' } },
  { id: 'fitness', name: { tr: 'Kondisyon', en: 'Fitness' } },
  { id: 'social', name: { tr: 'Sosyallik', en: 'Social' } },
  { id: 'discipline', name: { tr: 'Disiplin', en: 'Discipline' } },
  { id: 'creativity', name: { tr: 'Yaratıcılık', en: 'Creativity' } },
];

export const TRAITS: Array<{ id: TraitId; name: Text; desc: Text; attr: AttrId }> = [
  { id: 'curious', attr: 'knowledge', name: { tr: 'Meraklı', en: 'Curious' }, desc: { tr: 'Her şeyi sorarsın. Bilgi kazanımın +%10.', en: 'You ask about everything. +10% Knowledge gains.' } },
  { id: 'sporty', attr: 'fitness', name: { tr: 'Sportif', en: 'Sporty' }, desc: { tr: 'Yerinde duramazsın. Kondisyon kazanımın +%10.', en: "You can't sit still. +10% Fitness gains." } },
  { id: 'chatty', attr: 'social', name: { tr: 'Konuşkan', en: 'Chatty' }, desc: { tr: 'Herkesle sohbet edersin. Sosyallik kazanımın +%10.', en: 'You talk to everyone. +10% Social gains.' } },
  { id: 'creative', attr: 'creativity', name: { tr: 'Yaratıcı', en: 'Creative' }, desc: { tr: 'Defterlerin çizim dolu. Yaratıcılık kazanımın +%10.', en: 'Your notebooks are full of drawings. +10% Creativity gains.' } },
  { id: 'calm', attr: 'discipline', name: { tr: 'Sakin', en: 'Calm' }, desc: { tr: 'Kolay kolay telaşlanmazsın. Disiplin kazanımın +%10.', en: "You don't rattle easily. +10% Discipline gains." } },
];

export const LOSSES: Array<{ id: Loss; name: Text }> = [
  { id: 'mother', name: { tr: 'Annemi', en: 'My mother' } },
  { id: 'father', name: { tr: 'Babamı', en: 'My father' } },
  { id: 'both', name: { tr: 'İkisini de', en: 'Both of them' } },
];

/** `your` is the possessive used in sentences ("Your grandmother…" / "Anneannen…") */
export const GUARDIANS: Array<{ id: GuardianId; name: Text; your: Text }> = [
  { id: 'mother', name: { tr: 'Annem', en: 'My mother' }, your: { tr: 'Annen', en: 'Your mother' } },
  { id: 'father', name: { tr: 'Babam', en: 'My father' }, your: { tr: 'Baban', en: 'Your father' } },
  { id: 'grandma_m', name: { tr: 'Anneannem', en: "My grandmother (mother's side)" }, your: { tr: 'Anneannen', en: 'Your grandmother' } },
  { id: 'grandma_f', name: { tr: 'Babaannem', en: "My grandmother (father's side)" }, your: { tr: 'Babaannen', en: 'Your grandmother' } },
  { id: 'grandpa', name: { tr: 'Dedem', en: 'My grandfather' }, your: { tr: 'Deden', en: 'Your grandfather' } },
  { id: 'aunt_m', name: { tr: 'Teyzem', en: "My aunt (mother's sister)" }, your: { tr: 'Teyzen', en: 'Your aunt' } },
  { id: 'aunt_f', name: { tr: 'Halam', en: "My aunt (father's sister)" }, your: { tr: 'Halan', en: 'Your aunt' } },
  { id: 'uncle_m', name: { tr: 'Dayım', en: "My uncle (mother's brother)" }, your: { tr: 'Dayın', en: 'Your uncle' } },
  { id: 'uncle_f', name: { tr: 'Amcam', en: "My uncle (father's brother)" }, your: { tr: 'Amcan', en: 'Your uncle' } },
  { id: 'sister', name: { tr: 'Ablam', en: 'My older sister' }, your: { tr: 'Ablan', en: 'Your older sister' } },
  { id: 'brother', name: { tr: 'Ağabeyim', en: 'My older brother' }, your: { tr: 'Ağabeyin', en: 'Your older brother' } },
];

export function guardianOptions(loss: Loss): GuardianId[] {
  return GUARDIANS.map((g) => g.id).filter((id) => !(id === loss || (loss === 'both' && (id === 'mother' || id === 'father'))));
}

export function defaultGuardian(loss: Loss): GuardianId {
  return loss === 'mother' ? 'father' : loss === 'father' ? 'mother' : 'grandma_m';
}

export interface Cause {
  id: CauseId;
  how: Text;
  strength: Text;
  /** one calm sentence shown while choosing */
  blurb: Text;
  /** concrete perk, shown on the summary */
  perk: Text;
  bonus: Partial<Attributes>;
  respect: number;
}

export const CAUSES: Cause[] = [
  {
    id: 'illness', how: { tr: 'Uzun bir hastalık', en: 'A long illness' },
    strength: { tr: 'Şefkat', en: 'Compassion' },
    blurb: { tr: 'Hasta ebeveynine bakarken başkalarına nasıl iyi geleceğini öğrendin.', en: 'Caring for your parent taught you how to look after others.' },
    perk: { tr: 'Arkadaşlıkların %15 daha hızlı gelişir. Günde bir kez bir arkadaşını teselli edebilirsin (+15 moral). Hemşire seni tanır.', en: 'Friendships grow 15% faster. Once a day you can comfort a friend (+15 mood). The nurse knows you.' },
    bonus: { social: 10 }, respect: 0,
  },
  {
    id: 'accident', how: { tr: 'Ani bir kaza', en: 'A sudden accident' },
    strength: { tr: 'Erken Olgunluk', en: 'Grew up early' },
    blurb: { tr: 'Bir gecede sorumluluk almayı öğrendin.', en: 'You learned to take responsibility overnight.' },
    perk: { tr: 'Ödevler %20 daha az enerji harcar. Disiplin puanların iki kat hızlı silinir. Öğretmenler sana baştan güvenir.', en: 'Homework costs 20% less energy. Discipline points fade twice as fast. Teachers trust you from the start.' },
    bonus: { discipline: 10 }, respect: 0,
  },
  {
    id: 'disaster', how: { tr: 'Deprem ya da doğal afet', en: 'An earthquake or natural disaster' },
    strength: { tr: 'Dayanıklılık', en: 'Resilience' },
    blurb: { tr: 'En kötüsünü zaten atlattın; kolay kolay yıkılmazsın.', en: "You've already survived the worst; you don't break easily." },
    perk: { tr: 'Moralin asla 25\'in altına düşmez. Kayıplardan ve kötü sınavlardan iki kat hızlı toparlanırsın. Deprem tatbikatını sen yönetirsin.', en: 'Your mood never drops below 25. You bounce back twice as fast from losses and bad exams. You lead the earthquake drill.' },
    bonus: { fitness: 10 }, respect: 0,
  },
  {
    id: 'work', how: { tr: 'Bir iş kazası', en: 'A work accident' },
    strength: { tr: 'El Becerisi', en: 'Handy' },
    blurb: { tr: 'Ebeveyninin mesleği ellerinde yaşıyor.', en: "Your parent's craft lives on in your hands." },
    perk: { tr: 'Teknik Alan atölyesi 1. yıldan açık. Robotik, sanat ve teknoloji oyunlarında +%10. Eşya tamir edebilirsin.', en: 'The Teknik Alan workshop is open to you from Year 1. +10% in robotics, art and technology games. You can repair items.' },
    bonus: { creativity: 10 }, respect: 0,
  },
  {
    id: 'service', how: { tr: 'Görev başında (şehit)', en: 'In the line of duty (şehit)' },
    strength: { tr: 'Onur', en: 'Honor' },
    blurb: { tr: 'Onların adını gururla taşıyorsun.', en: 'You carry their name with pride.' },
    perk: { tr: '+50 saygınlıkla başlarsın. 29 Ekim ve 18 Mart törenlerinde ek saygınlık ve moral. Seçimlerde +%10 oy.', en: 'You start with +50 Respect. Extra respect and mood at the 29 Ekim and 18 Mart ceremonies. +10% votes in elections.' },
    bonus: { discipline: 5, social: 5 }, respect: 50,
  },
  {
    id: 'private', how: { tr: 'Söylemek istemiyorum', en: "I'd rather not say" },
    strength: { tr: 'Sessiz Güç', en: 'Quiet strength' },
    blurb: { tr: 'Hikâyen sana ait. Kimse sormaz.', en: 'Your story is yours. Nobody asks.' },
    perk: { tr: 'Tüm özelliklerin +2. Moralin %10 daha yavaş düşer. Hikâyen gizli kalır.', en: 'All attributes +2. Your mood falls 10% more slowly. Your story stays private.' },
    bonus: { knowledge: 2, fitness: 2, social: 2, discipline: 2, creativity: 2 }, respect: 0,
  },
];

export const BOARDING_OPTIONS: Array<{ id: Boarding; name: Text; desc: Text }> = [
  { id: 'evci', name: { tr: 'Evci', en: 'Evci (home at weekends)' }, desc: { tr: 'Cuma 16:00\'da servisle eve gidersin, Pazar akşamı 18:00 civarı dönersin.', en: 'You take the bus home on Friday around 16:00 and come back on Sunday evening around 18:00.' } },
  { id: 'daimi', name: { tr: 'Daimi', en: 'Daimi (stays at school)' }, desc: { tr: 'Hafta sonları okulda kalırsın. Ders yok, Cemiyet kapalı; Pazar günleri ailen ziyarete gelir.', en: 'You stay at school at weekends. No lessons, the Cemiyet building is closed; your family visits on Sundays.' } },
];

export const MEMORY_OPTIONS: Array<{ id: MemoryScenes; name: Text }> = [
  { id: 'full', name: { tr: 'Tam', en: 'Full' } },
  { id: 'gentle', name: { tr: 'Hafif', en: 'Gentle' } },
  { id: 'off', name: { tr: 'Kapalı', en: 'Off' } },
];

/** keepsake name, lowercase-first in Turkish so it fits mid-sentence */
export function keepsakeName(cause: CauseId, loss: Loss): string {
  const tr = getLang() === 'tr';
  const whoTr = loss === 'mother' ? 'annenin' : loss === 'father' ? 'babanın' : 'annenle babanın';
  const whoEn = loss === 'mother' ? "your mother's" : loss === 'father' ? "your father's" : "your parents'";
  switch (cause) {
    case 'illness': return tr ? `${whoTr} atkısı` : `${whoEn} scarf`;
    case 'accident': return tr ? `${whoTr} saati` : `${whoEn} watch`;
    case 'disaster': return tr ? 'evden kurtarılan bir fotoğraf' : 'a photo saved from home';
    case 'work': return tr ? `${whoTr} iş kartı` : `${whoEn} work badge`;
    case 'service': return tr ? `${whoTr} madalyası` : `${whoEn} medal`;
    case 'private': return tr ? 'küçük bir defter' : 'a small notebook';
  }
}

export function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase(getLang() === 'tr' ? 'tr-TR' : 'en-US') + s.slice(1);
}

export function computeAttributes(trait: TraitId, cause: CauseId): { attributes: Attributes; respect: number } {
  const attributes: Attributes = { knowledge: 10, fitness: 10, social: 10, discipline: 10, creativity: 10 };
  const c = CAUSES.find((x) => x.id === cause)!;
  for (const [k, v] of Object.entries(c.bonus)) attributes[k as AttrId] += v ?? 0;
  void trait; // traits change XP gain rates, not starting values
  return { attributes, respect: c.respect };
}

export const PROVINCES = [
  'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Aksaray', 'Amasya', 'Ankara', 'Antalya', 'Ardahan', 'Artvin', 'Aydın',
  'Balıkesir', 'Bartın', 'Batman', 'Bayburt', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale',
  'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Düzce', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir',
  'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Iğdır', 'Isparta', 'İstanbul', 'İzmir', 'Kahramanmaraş',
  'Karabük', 'Karaman', 'Kars', 'Kastamonu', 'Kayseri', 'Kilis', 'Kırıkkale', 'Kırklareli', 'Kırşehir', 'Kocaeli',
  'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Mardin', 'Mersin', 'Muğla', 'Muş', 'Nevşehir', 'Niğde', 'Ordu', 'Osmaniye',
  'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas', 'Şanlıurfa', 'Şırnak', 'Tekirdağ', 'Tokat', 'Trabzon',
  'Tunceli', 'Uşak', 'Van', 'Yalova', 'Yozgat', 'Zonguldak',
];

// Character creation content: look options, traits, family and "Your story" (GDD §5).
import type { CharacterLook, FaceShape, HairStyle } from '../art/textures';
import { L, getLang, type Text } from '../i18n';
import type { AxisId } from '../game/state';

export type Gender = 'girl' | 'boy';
export type TraitId = 'curious' | 'sporty' | 'chatty' | 'creative' | 'calm' | 'shy' | 'helpful' | 'joker' | 'stubborn' | 'carefree' | 'leader';
export type Loss = 'mother' | 'father' | 'both';
export type CauseId = 'illness' | 'accident' | 'disaster' | 'work' | 'service' | 'private';
export type GuardianId =
  | 'mother' | 'father' | 'grandma_m' | 'grandma_f' | 'grandpa' | 'aunt_m' | 'aunt_f' | 'uncle_m' | 'uncle_f' | 'sister' | 'brother';
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
  /** the strongest trait in your mix (older saves have only this) */
  trait: TraitId;
  /** your personality as a mix: points per trait, adding up to 100 */
  mix?: TraitMix;
  loss: Loss;
  guardian: GuardianId;
  cause: CauseId;
  /** missing in older saves: treated as 'daimi' */
  boarding?: Boarding;
  attributes: Attributes;
  respect: number;
}

export const SKIN_TONES = ['#f6d7bd', '#f1c9a5', '#e8b98f', '#d9a77d', '#c68e63', '#a8714a', '#8a5a3b', '#6b432b'];
export const HAIR_COLORS = ['#120c09', '#2b1d14', '#3b2a20', '#5e3b22', '#7a4a24', '#a8682e', '#c79a4a', '#b5462e'];
export const HAIR_STYLES: Array<{ id: HairStyle; name: Text }> = [
  { id: 0, name: { tr: 'Kısa', en: 'Short' } },
  { id: 1, name: { tr: 'Çok kısa', en: 'Buzz' } },
  { id: 2, name: { tr: 'Uzun', en: 'Long' } },
  { id: 3, name: { tr: 'At kuyruğu', en: 'Ponytail' } },
  { id: 4, name: { tr: 'Kıvırcık', en: 'Curly' } },
  { id: 5, name: { tr: 'Örgülü', en: 'Braids' } },
];
export const FACE_SHAPES: Array<{ id: FaceShape; name: Text }> = [
  { id: 0, name: { tr: 'Oval', en: 'Oval' } },
  { id: 1, name: { tr: 'Yuvarlak', en: 'Round' } },
  { id: 2, name: { tr: 'Uzun', en: 'Long' } },
  { id: 3, name: { tr: 'Köşeli', en: 'Square' } },
  { id: 4, name: { tr: 'Kalp', en: 'Heart' } },
];
/** iris colours: dark brown, brown, hazel, green, blue, grey */
export const EYE_COLORS = ['#2e1c12', '#4a2e1c', '#7a5426', '#56703a', '#4d7aa6', '#6c7a86'];
/** Daçka uniform: navy sweater, white shirt, burgundy tie, grey trousers/skirt */
export const UNIFORM = { top: '#22365c', bottom: '#5b6168' };

export const ATTRS: Array<{ id: AttrId; name: Text }> = [
  { id: 'knowledge', name: { tr: 'Bilgi', en: 'Knowledge' } },
  { id: 'fitness', name: { tr: 'Kondisyon', en: 'Fitness' } },
  { id: 'social', name: { tr: 'Sosyallik', en: 'Social' } },
  { id: 'discipline', name: { tr: 'Disiplin', en: 'Discipline' } },
  { id: 'creativity', name: { tr: 'Yaratıcılık', en: 'Creativity' } },
];

export type AxisLean = Partial<Record<AxisId, number>>;
export type TraitMix = Partial<Record<TraitId, number>>;
/** the personality mix is shared out in steps of this many points, 100 in all */
export const MIX_STEP = 10;
export const MIX_TOTAL = 100;

/** `lean`: where you start on the six hidden temperament axes (game/dilemmas.ts); what you do from then on can change it */
/** `attr`: the attribute it speeds up; `mood`: instead, it softens mood losses (Tasasız) */
export const TRAITS: Array<{ id: TraitId; name: Text; desc: Text; attr?: AttrId; mood?: true; lean: AxisLean }> = [
  { id: 'curious', attr: 'knowledge', lean: { ambition: 10, rules: 6 }, name: { tr: 'Meraklı', en: 'Curious' },
    desc: { tr: 'Her şeyi sorar, her şeyi kurcalarsın. Hırslı ve biraz haylaz başlarsın.', en: 'You ask about everything and poke at everything. You start out ambitious and a little mischievous.' } },
  { id: 'sporty', attr: 'fitness', lean: { loyalty: 10, presence: 5 }, name: { tr: 'Sportif', en: 'Sporty' },
    desc: { tr: 'Yerinde duramazsın. Takım ruhuyla başlarsın.', en: "You can't sit still. You start out a team player." } },
  { id: 'chatty', attr: 'social', lean: { presence: 12, heart: 10 }, name: { tr: 'Konuşkan', en: 'Chatty' },
    desc: { tr: 'Herkesle sohbet edersin. Gösterişli ve açık yürekli başlarsın.', en: 'You talk to everyone. You start out showy and open-hearted.' } },
  { id: 'creative', attr: 'creativity', lean: { loyalty: -10, presence: -5 }, name: { tr: 'Yaratıcı', en: 'Creative' },
    desc: { tr: 'Defterlerin çizim dolu. Kendi yolunda ve biraz sessiz başlarsın.', en: 'Your notebooks are full of drawings. You start out going your own way, a little quiet.' } },
  { id: 'calm', attr: 'discipline', lean: { rules: -10, presence: -8 }, name: { tr: 'Sakin', en: 'Calm' },
    desc: { tr: 'Kolay kolay telaşlanmazsın. Uslu ve sessiz başlarsın.', en: "You don't rattle easily. You start out dutiful and quiet." } },
  { id: 'shy', attr: 'creativity', lean: { presence: -12, heart: -10 }, name: { tr: 'Utangaç', en: 'Shy' },
    desc: { tr: 'Yeni biriyle konuşmadan önce iki kere düşünürsün. Sessiz ve içine kapanık başlarsın.', en: 'You think twice before talking to someone new. You start out quiet and guarded.' } },
  { id: 'helpful', attr: 'social', lean: { warmth: -12, heart: 6 }, name: { tr: 'Yardımsever', en: 'Helpful' },
    desc: { tr: 'Birinin derdini görünce duramazsın. Şefkatli ve açık yürekli başlarsın.', en: "You can't walk past someone in trouble. You start out caring and open-hearted." } },
  { id: 'joker', attr: 'social', lean: { presence: 10, rules: 8 }, name: { tr: 'Şakacı', en: 'Joker' },
    desc: { tr: 'Sınıfı güldürmeden duramazsın. Gösterişli ve haylaz başlarsın.', en: "You can't help making the class laugh. You start out showy and mischievous." } },
  { id: 'stubborn', attr: 'fitness', lean: { warmth: 10, rules: 6 }, name: { tr: 'Dik başlı', en: 'Stubborn' },
    desc: { tr: 'Bir kere karar verdin mi kimse fikrini değiştiremez. Sert ve biraz haylaz başlarsın.', en: "Once you've made up your mind, nobody can change it. You start out tough and a little mischievous." } },
  { id: 'carefree', mood: true, lean: { ambition: -12, heart: 5 }, name: { tr: 'Tasasız', en: 'Carefree' },
    desc: { tr: 'Kötü bir gün seni pek üzmez. Rahat başlarsın; moralin daha zor bozulur.', en: "A bad day doesn't get you down much. You start out easygoing, and your mood is harder to dent." } },
  { id: 'leader', attr: 'discipline', lean: { ambition: 8, loyalty: 8, presence: 4 }, name: { tr: 'Lider', en: 'Leader' },
    desc: { tr: 'Oyunu kim kuracaksa o sensin. Hırslı ve takımına bağlı başlarsın.', en: "When there's a game to set up, it's you who sets it up. You start out ambitious and loyal to your team." } },
];

/** your mix (older characters chose a single trait: that's all of it) */
export function traitMix(ch: Pick<CharacterData, 'trait' | 'mix'>): TraitMix {
  return ch.mix && Object.values(ch.mix).some((v) => (v ?? 0) > 0) ? ch.mix : { [ch.trait]: MIX_TOTAL };
}

/** the traits in your mix, strongest first */
export function mixParts(mix: TraitMix): Array<{ trait: (typeof TRAITS)[number]; pts: number }> {
  return TRAITS.map((t) => ({ trait: t, pts: mix[t.id] ?? 0 })).filter((x) => x.pts > 0).sort((a, b) => b.pts - a.pts);
}

/** where the mix starts you on the temperament axes: each trait's lean, weighted by its share */
export function mixLean(mix: TraitMix): AxisLean {
  const out: AxisLean = {};
  for (const { trait, pts } of mixParts(mix)) {
    for (const [k, v] of Object.entries(trait.lean) as Array<[AxisId, number]>) out[k] = (out[k] ?? 0) + (v * pts) / MIX_TOTAL;
  }
  for (const k of Object.keys(out) as AxisId[]) out[k] = Math.round(out[k]! * 10) / 10;
  return out;
}

/** gain multiplier for an attribute: all of one trait gives ×1.1, a half share ×1.05 */
export function mixBonus(mix: TraitMix, attr: AttrId): number {
  return 1 + 0.1 * mixParts(mix).filter((x) => x.trait.attr === attr).reduce((a, x) => a + x.pts, 0) / MIX_TOTAL;
}

/** how much of the mix is this trait, 0–1 */
export function mixShare(mix: TraitMix, id: TraitId): number {
  return (mix[id] ?? 0) / MIX_TOTAL;
}

/** mood losses are multiplied by this: all of Tasasız takes 30% off them */
export function moodGuard(mix: TraitMix): number {
  return 1 - 0.3 * mixParts(mix).filter((x) => x.trait.mood).reduce((a, x) => a + x.pts, 0) / MIX_TOTAL;
}

/** e.g. "Konuşkan %60 · Meraklı %40" */
export function mixLabel(mix: TraitMix): string {
  const tr = getLang() === 'tr';
  return mixParts(mix).map(({ trait, pts }) => (tr ? `${L(trait.name)} %${pts}` : `${L(trait.name)} ${pts}%`)).join(' · ');
}

/** the one or two strongest traits, e.g. "Konuşkan ve Meraklı" */
export function mixName(mix: TraitMix): Text {
  const top = mixParts(mix).slice(0, 2).map((x) => x.trait.name);
  return { tr: top.map((n) => n.tr).join(' ve '), en: top.map((n) => n.en).join(' and ') };
}

/** the strongest trait in a mix (stored as `trait` for older code and other players) */
export function mainTrait(mix: TraitMix): TraitId {
  return mixParts(mix)[0]?.trait.id ?? 'curious';
}

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

/** how the parent was lost: part of the player's story only, with no gameplay effect */
export interface Cause {
  id: CauseId;
  how: Text;
  /** one calm sentence shown while choosing */
  blurb: Text;
}

export const CAUSES: Cause[] = [
  {
    id: 'illness', how: { tr: 'Uzun bir hastalık', en: 'A long illness' },
    blurb: { tr: 'Hasta ebeveynine bakarken başkalarına nasıl iyi geleceğini öğrendin.', en: 'Caring for your parent taught you how to look after others.' },
  },
  {
    id: 'accident', how: { tr: 'Ani bir kaza', en: 'A sudden accident' },
    blurb: { tr: 'Bir gecede sorumluluk almayı öğrendin.', en: 'You learned to take responsibility overnight.' },
  },
  {
    id: 'disaster', how: { tr: 'Deprem ya da doğal afet', en: 'An earthquake or natural disaster' },
    blurb: { tr: 'En kötüsünü zaten atlattın; kolay kolay yıkılmazsın.', en: "You've already survived the worst; you don't break easily." },
  },
  {
    id: 'work', how: { tr: 'Bir iş kazası', en: 'A work accident' },
    blurb: { tr: 'Ebeveyninin mesleği ellerinde yaşıyor.', en: "Your parent's craft lives on in your hands." },
  },
  {
    id: 'service', how: { tr: 'Görev başında (şehit)', en: 'In the line of duty (şehit)' },
    blurb: { tr: 'Onların adını gururla taşıyorsun.', en: 'You carry their name with pride.' },
  },
  {
    id: 'private', how: { tr: 'Söylemek istemiyorum', en: "I'd rather not say" },
    blurb: { tr: 'Hikâyen sana ait. Kimse sormaz.', en: 'Your story is yours. Nobody asks.' },
  },
];

export const BOARDING_OPTIONS: Array<{ id: Boarding; name: Text; desc: Text }> = [
  { id: 'evci', name: { tr: 'Evci', en: 'Evci (home at weekends)' }, desc: { tr: 'Cuma dersten sonra (15:20–17:00) Ana Kapı\'dan servisle eve gidersin, Pazar 17:40\'ta dönersin.', en: 'You take the bus home from the main gate after Friday\'s lessons (15:20–17:00) and come back on Sunday at 17:40.' } },
  { id: 'daimi', name: { tr: 'Daimi', en: 'Daimi (stays at school)' }, desc: { tr: 'Hafta sonları okulda kalırsın. Ders yok, Cemiyet kapalı; Pazar günleri ailen ziyarete gelir.', en: 'You stay at school at weekends. No lessons, the Cemiyet building is closed; your family visits on Sundays.' } },
];

export function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase(getLang() === 'tr' ? 'tr-TR' : 'en-US') + s.slice(1);
}

/** everyone starts level: traits change gain rates, and the story has no gameplay effect */
export function startingAttributes(): { attributes: Attributes; respect: number } {
  return { attributes: { knowledge: 10, fitness: 10, social: 10, discipline: 10, creativity: 10 }, respect: 0 };
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

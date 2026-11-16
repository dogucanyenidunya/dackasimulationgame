// Getting to know people: the first time you meet someone they tell you a little about themselves:
// where they are from, who they have at home, what they like and what they don't.
import type { Text } from '../i18n';
import type { NpcDef } from './npcs';
import { HAND_PERSONAS, STAFF, WRITTEN, type Persona } from './stories';

export interface Bio { from: string; likes: Text; story: Text }

const HAND: Record<string, Bio> = {
  zeynep: { from: 'İzmir', likes: { tr: 'denizi ve yüzmeyi', en: 'the sea and swimming' }, story: {
    tr: 'İzmir\'den geldim, Karşıyaka\'dan. Babam balıkçıydı; onu üç yıl önce kaybettik. Annem ve küçük kardeşim hâlâ orada. En çok denizi severim: kokusunu, sesini, hepsini. Matematiği pek sevmem ama kitap okumaya bayılırım. Bir gün kendi teknem olacak!',
    en: "I'm from İzmir, from Karşıyaka. My dad was a fisherman; we lost him three years ago. My mum and my little brother are still there. What I love most is the sea: its smell, its sound, all of it. I'm not keen on maths, but I love reading. One day I'll have a boat of my own!" } },
  mert: { from: 'Trabzon', likes: { tr: 'futbolu ve basketbolu', en: 'football and basketball' }, story: {
    tr: 'Trabzonluyum, hem de koyu Trabzonsporlu! Annemi küçükken kaybettim, beni babamla babaannem büyüttü. Topun olduğu her yerde ben varım: futbol, basket, fark etmez. Yerimde duramam, o yüzden derste hep uyarı alıyorum. Teneffüste kortta buluşalım mı?',
    en: "I'm from Trabzon, and a die-hard Trabzonspor fan! I lost my mum when I was little; my dad and my gran raised me. Wherever there's a ball, I'm there: football, basketball, anything. I can't sit still, so I'm always getting told off in class. Meet you on the court at break?" } },
  defne: { from: 'Eskişehir', likes: { tr: 'resim yapmayı ve kedileri', en: 'drawing and cats' }, story: {
    tr: 'Eskişehir\'den geliyorum. Babam ressamdı; fırçaları hâlâ bende. Annem bir kütüphanede çalışıyor. Resim çizmeyi ve kedileri çok severim, evde Pamuk diye bir kedim var. Gürültüyü hiç sevmem. Bir gün senin de resmini çizerim, ister misin?',
    en: "I come from Eskişehir. My dad was a painter; I still have his brushes. My mum works in a library. I love drawing, and cats: I have one at home called Pamuk. I can't stand noise. I'll draw you one day, if you like?" } },
  emre: { from: 'Diyarbakır', likes: { tr: 'şaka yapmayı ve kılıç filmlerini', en: 'playing jokes and sword films' }, story: {
    tr: 'Diyarbakır\'dan geldim, dört kardeşin en küçüğüyüm. Babamı kaybedince annem "orada iyi okursun" dedi, beni buraya yazdırdı. Şaka yapmayı, kılıçlı filmleri ve karpuzu severim. Erken kalkmayı hiç sevmem! Eskrime yazılacağım, gör bak.',
    en: "I'm from Diyarbakır, the youngest of four. When we lost my dad, my mum said \"you'll get a good education there\" and signed me up. I like playing jokes, sword-fighting films and watermelon. I hate getting up early! I'm going to join fencing, you'll see." } },
  ayse: { from: 'Konya', likes: { tr: 'tenisi ve etli ekmeği', en: 'tennis and etli ekmek' }, story: {
    tr: 'Konyalıyım. Babam öğretmendi; ben daha okula başlamadan kaybettik. Annem her pazar ziyarete gelecek, söz verdi. Top sektirmeyi ve tenisi severim, bir de annemin etli ekmeğini! Kalabalıkta biraz utanırım ama tanıyınca çok konuşurum.',
    en: "I'm from Konya. My dad was a teacher; we lost him before I even started school. My mum will visit every Sunday, she promised. I like bouncing a ball and playing tennis, and my mum's etli ekmek! I'm a bit shy in a crowd, but once I know you I talk a lot." } },
  can: { from: 'Ankara', likes: { tr: 'tarihi ve eski eşyaları', en: 'history and old things' }, story: {
    tr: 'Ankara\'dan geldim. Annem hemşireydi. Şimdi dedemle yaşıyorum; bana hep eski hikâyeler anlatır. Müzeleri, eski paraları ve haritaları severim. Yüksek sesle bağıranlardan hoşlanmam. Müzedeki eski zili gördün mü? Birlikte bakalım!',
    en: "I came from Ankara. My mum was a nurse. I live with my grandad now; he's always telling me old stories. I like museums, old coins and maps. I don't like people who shout. Have you seen the old bell in the museum? Let's go and look together!" } },
  burak: { from: 'Samsun', likes: { tr: 'basketbolu ve küçüklere abilik yapmayı', en: 'basketball and looking out for the little ones' }, story: {
    tr: 'Samsunluyum, sekiz yıldır buradayım; ben de senin gibi 4. sınıfta bavulumla geldim. İlk ay her gece ağladım, kimseye söyleme. Sonra burası evim oldu. Basketbol takımının kaptanıyım. Bir derdin olursa bana gel, tamam mı ufaklık?',
    en: "I'm from Samsun, and I've been here eight years; I arrived with a suitcase in the 4th grade, just like you. I cried every night for the first month, don't tell anyone. Then this place became home. I captain the basketball team. If anything's wrong, come to me, all right, little one?" } },
  ece: { from: 'Antalya', likes: { tr: 'tiyatroyu ve şiiri', en: 'theatre and poetry' }, story: {
    tr: 'Antalya\'dan geldim, yedi yıl oldu. Annemle ablam orada. Tiyatro kulübündeyim; TIM\'in sahnesine ilk çıktığımda dizlerim titriyordu. Şiir okumayı, yağmurlu havayı ve sıcak çikolatayı severim. Sen de alışacaksın, hepimiz alıştık.',
    en: "I came from Antalya seven years ago. My mum and my big sister are there. I'm in the drama club; the first time I went on stage at the TIM my knees were shaking. I like reading poetry, rainy days and hot chocolate. You'll get used to it too, we all did." } },
};

// (all of these take the same "-dan" ending in Turkish)
const TOWNS = ['Adana', 'Bursa', 'Erzurum', 'Hatay', 'Malatya', 'Muğla', 'Ordu', 'Van', 'Aydın', 'Çorum', 'Bolu', 'Kütahya', 'Isparta', 'Amasya', 'Yalova', 'Manisa'];
const LIKES: Text[] = [
  { tr: 'futbolu', en: 'football' }, { tr: 'resim yapmayı', en: 'drawing' }, { tr: 'kitap okumayı', en: 'reading' }, { tr: 'satrancı', en: 'chess' },
  { tr: 'şarkı söylemeyi', en: 'singing' }, { tr: 'bisiklete binmeyi', en: 'riding a bike' }, { tr: 'yüzmeyi', en: 'swimming' }, { tr: 'hayvanları', en: 'animals' },
  { tr: 'bulmaca çözmeyi', en: 'doing puzzles' }, { tr: 'uçurtma uçurmayı', en: 'flying kites' }, { tr: 'voleybolu', en: 'volleyball' }, { tr: 'yıldızlara bakmayı', en: 'stargazing' },
];
const FOODS: Text[] = [
  { tr: 'mantıyı', en: 'mantı' }, { tr: 'lahmacunu', en: 'lahmacun' }, { tr: 'sütlacı', en: 'rice pudding' }, { tr: 'köfteyi', en: 'köfte' },
  { tr: 'gözlemeyi', en: 'gözleme' }, { tr: 'baklavayı', en: 'baklava' }, { tr: 'simidi', en: 'simit' }, { tr: 'kuru fasulyeyi', en: 'bean stew' },
];
const DISLIKES: Text[] = [
  { tr: 'erken kalkmayı', en: 'getting up early' }, { tr: 'karanlığı', en: 'the dark' }, { tr: 'ıspanağı', en: 'spinach' }, { tr: 'gürültüyü', en: 'noise' },
  { tr: 'yağmurda ıslanmayı', en: 'getting wet in the rain' }, { tr: 'yalan söyleyenleri', en: 'people who lie' }, { tr: 'sınavları', en: 'exams' }, { tr: 'uzun kuyrukları', en: 'long queues' },
];
const HOME: Array<{ lost: Text; with: Text }> = [
  { lost: { tr: 'Babamı kaybettim', en: 'I lost my dad' }, with: { tr: 'annem ve kardeşim', en: 'my mum and my little brother' } },
  { lost: { tr: 'Annemi kaybettim', en: 'I lost my mum' }, with: { tr: 'babam ve ablam', en: 'my dad and my big sister' } },
  { lost: { tr: 'Babamı kaybettim', en: 'I lost my dad' }, with: { tr: 'annem ve anneannem', en: 'my mum and my gran' } },
  { lost: { tr: 'Annemi kaybettim', en: 'I lost my mum' }, with: { tr: 'babam ve dedem', en: 'my dad and my grandad' } },
  { lost: { tr: 'Annemle babamı kaybettim', en: 'I lost both my parents' }, with: { tr: 'teyzem ve kuzenlerim', en: 'my aunt and my cousins' } },
  { lost: { tr: 'Babamı kaybettim', en: 'I lost my dad' }, with: { tr: 'annem ve iki ağabeyim', en: 'my mum and my two big brothers' } },
];
const DREAMS: Text[] = [
  { tr: 'pilot', en: 'a pilot' }, { tr: 'doktor', en: 'a doctor' }, { tr: 'öğretmen', en: 'a teacher' }, { tr: 'mühendis', en: 'an engineer' },
  { tr: 'veteriner', en: 'a vet' }, { tr: 'futbolcu', en: 'a footballer' }, { tr: 'yazar', en: 'a writer' }, { tr: 'astronot', en: 'an astronaut' },
];

function hash(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13;
  return h >>> 0;
}
const pick = <X,>(xs: X[], key: string) => xs[hash(key) % xs.length];

const cache = new Map<string, Bio>();
/** who they are: written by hand for the main cast, put together (the same way every time) for everyone else */
export function bioOf(npc: NpcDef): Bio {
  const hand = HAND[npc.id];
  if (hand) return hand;
  const written = WRITTEN[npc.id];
  if (written && written.name === npc.name) return written;
  let bio = cache.get(npc.id);
  if (!bio) {
    const town = pick(TOWNS, `${npc.id}t`), like = pick(LIKES, `${npc.id}l`), food = pick(FOODS, `${npc.id}f`);
    const no = pick(DISLIKES, `${npc.id}d`), home = pick(HOME, `${npc.id}h`), dream = pick(DREAMS, `${npc.id}j`);
    const first = npc.name.split(' ')[0];
    const older = npc.kind === 'abi';
    const years = older ? Math.max(5, (npc.grade ?? 10) - 4) : 0;
    bio = {
      from: town, likes: like,
      story: {
        tr: `Ben ${first}, ${town}'dan geliyorum. ${home.lost.tr}; evde ${home.with.tr} var.${older ? ` ${years} yıldır buradayım, burası artık ikinci evim.` : ''} En çok ${like.tr} ve ${food.tr} severim; ${no.tr} ise hiç sevmem. Büyüyünce ${dream.tr} olmak istiyorum. Ya sen?`,
        en: `I'm ${first}, from ${town}. ${home.lost.en}; at home there's ${home.with.en}.${older ? ` I've been here ${years} years, so this is my second home now.` : ''} I love ${like.en} and ${food.en} most, and I really don't like ${no.en}. I want to be ${dream.en} when I grow up. What about you?`,
      },
    };
    cache.set(npc.id, bio);
  }
  return bio;
}

/** what kind of person they are and what the school knows about them (shown whenever you talk to them) */
export function personaOf(npc: NpcDef): Persona {
  const known = STAFF[npc.id] ?? HAND_PERSONAS[npc.id] ?? (WRITTEN[npc.id]?.name === npc.name ? WRITTEN[npc.id] : undefined);
  if (known) return known;
  // anyone without a written story yet: put one together from their bio, in the third person
  const b = bioOf(npc);
  return {
    type: npc.kind === 'abi' ? { tr: 'Okulun büyüklerinden', en: 'One of the older students' } : { tr: 'Kampüs sakini', en: 'One of the campus crowd' },
    about: { tr: `${b.from}'dan geldi; en çok ${b.likes.tr} sever.`, en: `Came here from ${b.from}; loves ${b.likes.en} most.` },
  };
}

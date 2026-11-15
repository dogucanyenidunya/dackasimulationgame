// What people say when you talk to them: it fits the moment (breakfast, a lesson, the evening plaza…),
// mixed with the few lines of their own.
import type { Text } from '../i18n';
import type { NpcDef, NpcLine } from './npcs';
import { weekday } from '../game/schedule';

/** where and when you caught them */
export type Moment = 'rush' | 'first' | 'morning' | 'class' | 'meal' | 'break' | 'afternoon' | 'evening' | 'study' | 'weekend';

export interface LineCtx {
  moment: Moment;
  day: number;
  minutes: number;
  /** they are outdoors in the rain */
  wet: boolean;
  /** this student goes home at weekends */
  evci: boolean;
  /** a flag ceremony is about to start or under way */
  ceremony: boolean;
}

const KIDS: Record<Moment, Text[]> = {
  rush: [
    { tr: 'Depoda sıra çok uzun! Kıyafetlerini aldın mı?', en: 'The queue at the stores is huge! Have you got your clothes yet?' },
    { tr: 'Sağlık kontrolünde boyumu ölçtüler. Sen gittin mi Revir\'e?', en: 'They measured my height at the health check. Have you been to the infirmary?' },
    { tr: 'Kitaplar çok ağır, kütüphaneden yurda zor taşıdım.', en: 'The books are so heavy, I could hardly carry them from the library to the dorm.' },
    { tr: 'Pazartesi dersler başlıyormuş. Hangi sınıfa düşeceğiz acaba?', en: "Lessons start on Monday. I wonder which class we'll be in?" },
    { tr: 'Daha bavulumu dolaba yerleştirmedim, vakit yetişecek mi?', en: "I haven't even put my suitcase in my locker yet. Will there be time?" },
    { tr: 'Kayıt kâğıdımı kaybettim sandım, cebimdeymiş!', en: 'I thought I had lost my registration form. It was in my pocket!' },
  ],
  first: [
    { tr: 'Sen de yeni mi geldin? Ben de her yeri yeni öğreniyorum.', en: "Are you new too? I'm still finding my way around." },
    { tr: 'Dersler başlamadan kampüsü gezelim mi?', en: 'Shall we look round the campus before lessons start?' },
    { tr: 'Yurt çok büyük, dün koridorda kayboldum.', en: 'The dorm is huge. I got lost in the corridor yesterday.' },
    { tr: 'Bavulumu daha yeni yerleştirdim. Dolabım küçücük!', en: "I've only just unpacked. My locker is tiny!" },
  ],
  morning: [
    { tr: 'Günaydın! Daha gözlerim açılmadı.', en: 'Morning! I can barely keep my eyes open.' },
    { tr: 'Kahvaltıda ne var acaba? Umarım simit vardır.', en: "I wonder what's for breakfast. I hope there's simit." },
    { tr: 'Zil çalmadan sınıfa yetişmemiz lazım.', en: 'We have to get to class before the bell.' },
    { tr: 'Yatağımı üç kere düzelttim, belletmen yine beğenmedi.', en: "I made my bed three times and the belletmen still wasn't happy." },
  ],
  class: [
    { tr: 'Şşt! Öğretmen bu tarafa bakıyor.', en: "Shh! The teacher's looking this way." },
    { tr: 'Bu konuyu hiç anlamadım. Teneffüste anlatır mısın?', en: "I don't get this at all. Will you explain it at break?" },
    { tr: 'Zile ne kadar kaldı?', en: 'How long till the bell?' },
    { tr: 'Defterini biraz bu tarafa çevirsene.', en: 'Turn your notebook this way a bit.' },
  ],
  meal: [
    { tr: 'Afiyet olsun! Yanıma otursana.', en: 'Enjoy your meal! Come and sit with me.' },
    { tr: 'Ekmeğimi ister misin? Ben doydum.', en: "Want my bread? I'm full." },
    { tr: 'Bugünkü yemek fena değil, değil mi?', en: "Today's food isn't bad, is it?" },
    { tr: 'Tatlıyı sona saklıyorum.', en: "I'm saving dessert for last." },
  ],
  break: [
    { tr: 'Teneffüs çok kısa, hiçbir şeye yetmiyor!', en: "Break is so short, there's no time for anything!" },
    { tr: 'Öğleden sonra hangi ders vardı?', en: 'What do we have this afternoon?' },
    { tr: 'Ödevi yaptın mı? Ben son soruda takıldım.', en: 'Did you do the homework? I got stuck on the last question.' },
    { tr: 'Zil çalınca birlikte gidelim.', en: "Let's go in together when the bell rings." },
  ],
  afternoon: [
    { tr: 'Dersler bitti, oh be!', en: 'Lessons are over, phew!' },
    { tr: 'Kortta maç var, gelsene!', en: "There's a game on the court, come along!" },
    { tr: 'Ara öğünde poğaça varmış, koşalım mı?', en: "There's poğaça at snack time. Shall we run?" },
    { tr: 'Etütten önce biraz oynayalım.', en: "Let's play a bit before study time." },
  ],
  evening: [
    { tr: 'Işıklar sönmeden bir tur daha atalım mı?', en: 'One more lap before lights out?' },
    { tr: 'Bu saatte evi biraz özlüyorum.', en: 'I miss home a bit at this hour.' },
    { tr: 'Telefon kuyruğu yine çok uzun.', en: 'The phone queue is long again.' },
    { tr: 'Belletmen bizi görüyor, meydandan ayrılmayalım.', en: "The belletmen can see us. Let's not leave the plaza." },
  ],
  study: [
    { tr: 'Şşt, belletmen duyacak! Ödevin bitti mi?', en: 'Shh, the belletmen will hear! Have you finished your homework?' },
    { tr: 'Bir kıta daha ezberlersem bitiyor.', en: "One more stanza and I'm done." },
    { tr: 'Matematikte takıldım. Sen yaptın mı?', en: "I'm stuck on the maths. Have you done it?" },
  ],
  weekend: [
    { tr: 'Hafta sonu kampüs ne kadar sessiz, değil mi?', en: "The campus is so quiet at the weekend, isn't it?" },
    { tr: 'Kantinde film varmış, gidelim mi?', en: "There's a film at the canteen. Shall we go?" },
    { tr: 'Yarısı eve gitti; meydan bize kaldı.', en: 'Half of them have gone home; the plaza is ours.' },
    { tr: 'Bugün ders yok, canım hiçbir şey yapmak istemiyor.', en: "No lessons today, and I don't feel like doing anything." },
  ],
};

/** the older students talk down to you a little, kindly */
const OLDER: Partial<Record<Moment, Text[]>> = {
  rush: [
    { tr: 'Kayıt haftası hep böyle koşturmaca. Pazar akşamına kadar her şeyi bitir.', en: "Registration weekend is always a scramble. Get everything done by Sunday evening." },
    { tr: 'Yeni kitaplarımı aldım. Sen önce Cemiyet\'e git, kaydını yaptır.', en: 'I have my new books. You go to the Cemiyet first and get registered.' },
  ],
  first: [{ tr: 'Hoş geldin ufaklık! Bir şeye ihtiyacın olursa söyle.', en: 'Welcome, little one! Tell me if you need anything.' }],
  morning: [{ tr: 'Günaydın ufaklık! Kahvaltını atlamadın, değil mi?', en: "Morning, little one! You didn't skip breakfast, did you?" }],
  class: [{ tr: 'Derse geç kalıyorum, sonra konuşalım.', en: "I'm late for class. Let's talk later." }],
  meal: [{ tr: 'Afiyet olsun ufaklık. Sebzeni de ye.', en: 'Enjoy your meal, little one. Eat your vegetables too.' }],
  break: [
    { tr: 'Dersler nasıl gidiyor? Takıldığın bir şey olursa sor.', en: "How are lessons going? Ask if you're stuck on anything." },
    { tr: 'Bizim zamanımızda kantin sırası bu kadar uzun değildi.', en: "The canteen queue wasn't this long in our day." },
  ],
  afternoon: [
    { tr: 'Antrenmana gidiyorum. Sen bir spora yazıldın mı?', en: "I'm off to practice. Have you joined a sport yet?" },
    { tr: 'Bir şeye ihtiyacın olursa meydandayım.', en: "I'm on the plaza if you need anything." },
  ],
  evening: [
    { tr: 'İlk yılım aklıma geldi… Zamanla burası evin olacak.', en: "Reminds me of my first year… this place becomes home, you'll see." },
    { tr: 'Işıklar sönmeden yat, belletmeni kızdırma.', en: "Be in bed before lights out. Don't upset the belletmen." },
  ],
  weekend: [{ tr: 'Hafta sonu sıkılırsan gel, tavla öğretirim.', en: "If you get bored at the weekend, come over and I'll teach you backgammon." }],
};

const TEACHER: Partial<Record<Moment, Text[]>> = {
  morning: [
    { tr: 'Günaydın! Zil çalmadan sınıfta ol.', en: 'Good morning! Be in class before the bell.' },
    { tr: 'Kahvaltını yaptın mı? Aç karnına ders olmaz.', en: "Have you had breakfast? You can't learn on an empty stomach." },
  ],
  break: [
    { tr: 'Bugün nöbetçiyim. Koşmadan yürüyün!', en: "I'm on yard duty today. Walk, don't run!" },
    { tr: 'Öğleden sonraki derse geç kalma.', en: "Don't be late for the afternoon lesson." },
  ],
  afternoon: [
    { tr: 'Ödevini unutma. Yarın görüşürüz.', en: "Don't forget your homework. See you tomorrow." },
    { tr: 'Bugün derste iyiydin. Böyle devam et.', en: 'You did well in class today. Keep it up.' },
  ],
  first: [{ tr: 'Hoş geldin! Kayıt işlerini bitirince derslere başlıyoruz.', en: 'Welcome! Lessons start as soon as you have registered.' }],
  rush: [{ tr: 'Hoş geldin! Pazartesi sabahı ilk zilde sınıfta ol.', en: 'Welcome! Be in class at the first bell on Monday morning.' }],
};

const WET: Text[] = [
  { tr: 'Yağmurda sırılsıklam oldum!', en: "I'm soaked from the rain!" },
  { tr: 'Bu havada dışarıda ne işimiz var?', en: 'What are we doing outside in this weather?' },
];
const CEREMONY: Text[] = [
  { tr: 'Bayrak töreni var, sıraya girmemiz lazım.', en: "It's the flag ceremony. We have to line up." },
  { tr: 'Tören başlıyor, konuşmayalım.', en: "The ceremony's starting. Let's not talk." },
];
const GOING_HOME: Text = { tr: 'Cuma günü eve gidiyorum, sabırsızlanıyorum!', en: "I'm going home on Friday. I can't wait!" };
const BACK_FROM_HOME: Text = { tr: 'Hafta sonu evdeydim. Börek getirdim, ister misin?', en: 'I was home for the weekend. I brought börek. Want some?' };

function pick(key: string, n: number): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13;
  return (h >>> 0) % n;
}

/** is one of their own lines right for now? */
function fits(l: NpcLine, c: LineCtx): boolean {
  const weekend = weekday(c.day) >= 5;
  if (l.when === 'first') return c.moment === 'first';
  if (l.when === 'day') return !weekend && (c.moment === 'break' || c.moment === 'afternoon');
  if (l.when === 'weekdays') return !weekend;
  return c.moment !== 'class' && c.moment !== 'study';
}

/** what they say right now; it stays the same for about an hour and a half, then changes */
export function lineFor(npc: NpcDef, c: LineCtx): Text {
  const pool: Text[] = [];
  if (c.ceremony) pool.push(...CEREMONY, ...CEREMONY);
  else if (npc.kind === 'teacher') pool.push(...(TEACHER[c.moment] ?? TEACHER.break!));
  else {
    const mine = npc.lines.filter((l) => fits(l, c));
    pool.push(...(npc.kind === 'abi' ? OLDER[c.moment] ?? OLDER.break! : KIDS[c.moment]), ...mine);
    const wd = weekday(c.day);
    if (c.wet) pool.push(...WET, ...WET);
    if (c.evci && (wd === 3 || wd === 4) && c.moment !== 'class' && c.moment !== 'study') pool.push(GOING_HOME, GOING_HOME);
    if (c.evci && c.day > 5 && (wd === 0 || (wd === 6 && c.minutes > 17 * 60)) && c.moment !== 'class') pool.push(BACK_FROM_HOME, BACK_FROM_HOME);
  }
  return pool[pick(`${npc.id}:${c.day}:${Math.floor(c.minutes / 90)}:${c.moment}`, pool.length)];
}

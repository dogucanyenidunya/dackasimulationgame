// The diary: through the day the game notes what happened (who you met, who you ate with, what you decided,
// how a lesson went…). At bedtime those notes become a short entry in the child's own voice: only the things
// that stood out, and how they felt about them.
import type { Lang } from '../i18n';
import { ablativeTr } from './npcs';

/** one thing that happened; the meaning of a/b/c/n/m depends on the kind */
export interface DiaryEvent { kind: string; a?: string; b?: string; c?: string; n?: number; m?: number }

type Pair = [string, string];

/** a steady pick (the same day reads the same if you reopen it) */
function chooser(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return <X,>(xs: X[]): X => { h = Math.imul(h ^ (h >>> 13), 2246822519) >>> 0; return xs[h % xs.length]; };
}

/** Turkish "de/da" after a name (Mert de, Zeynep de, Burak da) */
function daDe(names: string): string {
  const v = [...names].reverse().find((ch) => 'aıoueiöüAIOUEİÖÜ'.includes(ch))?.toLocaleLowerCase('tr-TR') ?? 'e';
  return 'aıou'.includes(v) ? 'da' : 'de';
}

const list = (names: string[], lang: Lang) => names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} ${lang === 'tr' ? 've' : 'and'} ${names[names.length - 1]}`;

/** what a choice at a dilemma left behind, in the child's words */
const DILEMMA: Record<string, Record<string, Pair>> = {
  telefon: {
    give: ['Telefon sırasında arkamdaki ağlıyordu; sıramı ona verdim. Evi arayamadım ama içim garip bir şekilde ısındı.', "In the phone queue the kid behind me was crying, so I gave them my turn. I couldn't call home, but I felt oddly warm inside."],
    call: ['Telefonda evi aradım. Arkamda biri ağlıyordu… sesini hâlâ duyar gibiyim.', 'I called home. Someone behind me was crying… I can still sort of hear it.'],
    share: ['Evle sadece bir dakika konuştum ki arkamdaki de arayabilsin. Kısacıktı ama ikimiz de mutlu yattık.', 'I only talked to home for a minute so the kid behind me could call too. It was short, but we both went to bed happy.'],
    sit: ['Telefondan sonra ağlayan arkadaşın yanına oturdum. Bir süre konuşmadık, sonra evlerimizi anlattık.', 'After my call I sat with the kid who was crying. We said nothing for a while, then we talked about home.'],
    stay: ['Kartım bitmişti ama ağlayan arkadaşla sırada bekledim. "İyi ki bekledin" dedi.', 'My card had run out, but I waited in the queue with the kid who was crying. "I\'m glad you waited," they said.'],
    bed: ['Telefon sırasından çıkıp yattım. Koridordaki hıçkırıkları duymamaya çalıştım.', 'I left the phone queue and went to bed, and tried not to hear the sobbing in the corridor.'],
  },
  arka: {
    tell: ['Yurdun arkasında gördüklerimi belletmene söyledim. Doğrusu bu muydu, bilmiyorum; büyükler bana tuhaf bakıyor.', "I told the belletmen what I saw behind the dorm. I don't know if that was right; the older kids look at me strangely now."],
    quiet: ['Yurdun arkasında bir şey gördüm ama kimseye söylemedim. O benim sırrım değil.', "I saw something behind the dorm but I didn't tell anyone. It isn't my secret."],
    gossip: ['Yurdun arkasında gördüklerimi herkese anlattım. O an çok heyecanlıydı… şimdi biraz pişmanım.', 'I told everyone what I saw behind the dorm. It was so exciting at the time… now I feel a bit sorry.'],
    deal: ['Yurdun arkasında gördüklerimi belli ettim; ertesi gün bana tost ısmarladılar. Akıllıca mıydı, kötü müydü, bilemedim.', "I let them know I'd seen them behind the dorm, and the next day they bought me a toastie. Was that clever or mean? I can't tell."],
  },
  parti: {
    ask: ['Partide birine eşim olmasını sordum! Kalbim yerinden çıkacaktı.', 'At the party I asked someone to be my partner! My heart nearly jumped out.'],
    wait: ['Partide biri bana teklif etsin diye bekledim. Uzun bir bekleyişti.', 'At the party I waited for someone to ask me. It was a long wait.'],
    group: ['Partiye arkadaş grubumla gittik, kol kola. Kimseyi dert etmedik.', "We went to the party as a group, arm in arm. We didn't worry about anything."],
    skip: ['Partiye gitmedim, yurtta kitap okudum. Müziği pencereden dinledim.', "I didn't go to the party; I read in the dorm and listened to the music through the window."],
  },
  mac: {
    cheer: ['Devre arasında tezahüratı ben başlattım, bütün tribün arkamdan geldi! Sesim kısıldı ama değdi.', 'At half-time I started the chant and the whole stand joined in! I lost my voice, but it was worth it.'],
    hotdog: ['Devre arasında kantinden sosisli aldım. Efsaneydi ama bir smacı kaçırdım.', 'At half-time I got a hot dog. It was legendary, but I missed a dunk.'],
    chat: ['Maçta arkadaşlarla sohbete daldık; maçın yarısını kaçırdım ama çok güldük.', 'At the match we got so caught up talking that I missed half of it, but we laughed a lot.'],
    watch: ['Maçı dikkatle izledim; oyuncuların nasıl perdeleme yaptığını ilk kez fark ettim.', 'I watched the match closely and noticed for the first time how the players set screens.'],
  },
};

const ACTS: Record<string, Pair> = {
  call: ['Evi aradım; sesini duyunca içim ısındı.', 'I called home; hearing their voice warmed me right up.'],
  wedvisit: ['Ailem ziyarete geldi! Gittiklerinde biraz hüzünlendim.', 'My family came to visit! I felt a bit sad when they left.'],
  visit: ['Ailem ziyarete geldi! Gittiklerinde biraz hüzünlendim.', 'My family came to visit! I felt a bit sad when they left.'],
  movie: ['Kantinde film izledik, Şakir Abi patlamış mısır dağıttı.', 'We watched a film at the canteen and Şakir handed out popcorn.'],
  train: ['Antrenmana gittim; yoruldum ama kendimi güçlü hissettim.', 'I went to training. I was tired but I felt strong.'],
  read: ['Kitabımı okudum; kendimi başka bir yerde gibi hissettim.', 'I read my book and felt like I was somewhere else.'],
  homework: ['Ödevimi bitirdim, içim rahatladı.', 'I finished my homework, what a relief.'],
  anthem: ['İstiklal Marşı\'ndan birkaç kıta daha ezberledim.', 'I learnt a few more stanzas of the İstiklal Marşı.'],
  borrow: ['Arkadaşımın kıyafetini ödünç giydim. Bence bana çok yakıştı!', "I borrowed my friend's clothes. I think they really suited me!"],
  treat: ['Bir arkadaşıma simit ısmarladım; çok sevindi.', 'I shared a simit with a friend; they were so pleased.'],
  joke: ['Bir şaka yaptım. Güldüler… sanırım.', 'I told a joke. They laughed… I think.'],
  mock: ['Birisiyle dalga geçtim. Şimdi düşününce kendimi pek iyi hissetmiyorum.', "I made fun of someone. Thinking about it now, I don't feel great."],
  gossip: ['Biri hakkında dedikodu yaptım; belki de yapmamalıydım.', "I gossiped about someone. Maybe I shouldn't have."],
  secret: ['Bir arkadaşıma sırrımı anlattım. Artık sırdaşım var.', 'I told a friend my secret. Now I have someone to share secrets with.'],
  sorry: ['Birinden özür diledim; içim hafifledi.', 'I said sorry to someone, and I felt lighter.'],
  play: ['Arkadaşlarla oyun oynadık, zaman nasıl geçti anlamadım.', 'We played games and the time just flew.'],
  talk: ['Rehber öğretmenle konuştum; özlemek normalmiş.', 'I talked to the counselor. Apparently missing home is normal.'],
  view: ['Çatı terasından bütün kampüsü seyrettim.', 'I looked out over the whole campus from the roof terrace.'],
  idle: ['Etütte hiçbir şey yapmadan oturdum; zaman geçmek bilmedi.', "At study time I just sat there doing nothing. The time wouldn't pass."],
  mandolin: ['Müzikte mandolin çaldık; parmaklarım hâlâ sızlıyor.', 'We played the mandolin in Music; my fingers still sting.'],
  enroll: ['Bir spor takımı için seçmelere girdim.', 'I tried out for a sports team.'],
};
const REGISTRATION = new Set(['register', 'kit', 'textbooks', 'enrolCheck']);

const PE: Record<string, Pair> = { futbol: ['futbol oynadık', 'we played football'], basket: ['basketbol oynadık', 'we played basketball'], kosu: ['sahanın etrafında koştuk', 'we ran laps of the pitch'], yakar: ['yakar top oynadık', 'we played dodgeball'] };

/** the day's entry: a few short paragraphs in the child's voice */
export function writeDiary(events: DiaryEvent[], mood: number, lang: Lang, seed: string): string[] {
  const T = (p: Pair) => (lang === 'tr' ? p[0] : p[1]);
  const pick = chooser(seed);
  const of = (k: string) => events.filter((e) => e.kind === k);
  const out: string[] = [];
  const add = (p: Pair) => { if (!out.includes(T(p))) out.push(T(p)); };

  const draw = of('classdraw')[0];
  if (draw) add([`Sonunda sınıf kurası çekildi: ${draw.a} sınıfındayım! Kalbim yerinden çıkacak sandım.`, `The class draw finally happened: I'm in ${draw.a}! I thought my heart would burst.`]);

  const match = of('match')[0];
  if (match) {
    const h = match.n ?? 0, a = match.m ?? 0;
    add(h > a ? [`Akşam bütün okul Darüşşafaka – Banvit maçına gittik. ${h}–${a} kazandık! Tribün yıkıldı, ben de bağırmaktan yoruldum.`, `In the evening the whole school went to Darüşşafaka v Banvit. We won ${h}–${a}! The stand went wild and I shouted myself hoarse.`]
      : [`Akşam Darüşşafaka – Banvit maçına gittik. ${a}–${h} kaybettik ama o kalabalığın içinde olmak bile güzeldi.`, `In the evening we went to Darüşşafaka v Banvit. We lost ${a}–${h}, but just being in that crowd was great.`]);
  }

  for (const d of of('dilemma')) { const p = DILEMMA[d.a ?? '']?.[d.b ?? '']; if (p) add(p); }

  const met = of('met');
  const friends = of('friend').map((e) => e.a!);
  if (met.length) {
    const f = met[0];
    const quick = friends.includes(f.a!);
    add([`${f.a} ile tanıştım; ${f.b ? ablativeTr(f.b) : 'uzaktan'} gelmiş, ${f.c ?? 'oyun oynamayı'} seviyormuş.${quick ? ' Daha ilk günden arkadaş olduk bile!' : ''}`, `I met ${f.a}. They're from ${f.b ?? 'far away'} and they love ${f.c ?? 'games'}.${quick ? " We're already friends!" : ''}`]);
    const rest = met.slice(1).map((e) => e.a!);
    if (rest.length) add([`Bir de ${list(rest, 'tr')} ile tanıştım. Kafamda isimler birbirine karışıyor!`, `I also met ${list(rest, 'en')}. All the names are getting mixed up in my head!`]);
  }
  const newFriends = friends.filter((n) => n !== met[0]?.a);
  if (newFriends.length) add(newFriends.length === 1
    ? pick<Pair>([[`${newFriends[0]} ile artık gerçekten arkadaşız. Burada yalnız olmadığımı hissettim.`, `${newFriends[0]} and I are proper friends now. I don't feel alone here.`], [`Bugün ${newFriends[0]} ile arkadaş olduk! Yarın yine beraber takılacağız.`, `${newFriends[0]} and I became friends today! We'll hang out again tomorrow.`]])
    : [`${list(newFriends, 'tr')} ile arkadaş olduk. Burası yavaş yavaş evim gibi olmaya başladı.`, `I became friends with ${list(newFriends, 'en')}. This place is slowly starting to feel like home.`]);

  const fall = of('fallout').map((e) => e.a!);
  if (fall.length) add([`${list(fall, 'tr')} ile aramız bozuldu. Bunu düşündükçe canım sıkılıyor.`, `I fell out with ${list(fall, 'en')}. It bothers me whenever I think about it.`]);

  const pen = of('penalty');
  if (pen.length) add(pen.length === 1
    ? [`Başım derde girdi. ${pen[0].a ?? ''} Yüzüm kızardı.`, `I got into trouble. ${pen[0].a ?? ''} My face went red.`]
    : [`Bugün ${pen.length} kere azar işittim. İlki: ${pen[0].a ?? ''} Kendime kızgınım.`, `I got told off ${pen.length} times today. The first: ${pen[0].a ?? ''} I'm cross with myself.`]);

  const lessons = of('lesson');
  const best = [...lessons].sort((x, y) => (y.n ?? 0) - (x.n ?? 0))[0];
  const worst = [...lessons].sort((x, y) => (x.n ?? 0) - (y.n ?? 0))[0];
  if (best && (best.n ?? 0) >= 85) add(pick<Pair>([[`${best.a} dersinde öğretmenin sorusunu bildim, herkesin önünde övüldüm. Çok gururlandım!`, `In ${best.a} I knew the answer and got praised in front of everyone. So proud!`], [`${best.a} dersi harika geçti; her şeyi anladım.`, `${best.a} went brilliantly; I understood everything.`]]));
  if (worst && worst !== best && (worst.n ?? 100) <= 40) add([`${worst.a} dersi iyi geçmedi, biraz utandım. Daha çok çalışmalıyım.`, `${worst.a} didn't go well and I felt a bit embarrassed. I need to work harder.`]);
  else if (worst && worst === best && (worst.n ?? 100) <= 40) add([`${worst.a} dersi iyi geçmedi, biraz utandım.`, `${worst.a} didn't go well and I felt a bit embarrassed.`]);
  else if (lessons.length >= 3 && !(best && (best.n ?? 0) >= 85)) add([`${lessons.length} derse girdim; kafam biraz doldu.`, `I had ${lessons.length} lessons; my head is a bit full.`]);

  const pe = of('pe')[0];
  if (pe) { const act = PE[pe.a ?? ''] ?? PE.futbol; add([`Beden Eğitimi'nde ${act[0]}${pe.b ? ` (${pe.b} ${daDe(pe.b)} vardı)` : ''}; ter içinde kaldım ama çok eğlendim.`, `In PE ${act[1]}${pe.b ? ` (with ${pe.b})` : ''}; I got all sweaty but it was so much fun.`]); }

  const acts = of('act');
  if (acts.some((e) => REGISTRATION.has(e.a ?? ''))) add(['Kayıt için bir oradan bir oraya koşturdum: danışma, revir, depo, kütüphane… Bacaklarım koptu.', 'I ran all over the place for registration: the office, the infirmary, the stores, the library… My legs are done.']);
  const seen = new Set<string>();
  for (const e of acts) { const p = ACTS[e.a ?? '']; if (p && !seen.has(e.a!)) { seen.add(e.a!); add(p); } }

  // who I ate with
  const meals = of('meal');
  if (meals.length) {
    const count = new Map<string, number>();
    meals.forEach((e) => (e.b ? e.b.split(', ') : []).forEach((n) => count.set(n, (count.get(n) ?? 0) + 1)));
    const top = [...count.entries()].sort((x, y) => y[1] - x[1]).slice(0, 2).map(([n]) => n);
    const alone = meals.filter((e) => !e.b).length;
    if (top.length && alone < meals.length / 2) add([`Yemekte ${list(top, 'tr')} ile oturdum; en güzel sohbetler masada oluyor.`, `I sat with ${list(top, 'en')} at meals; the best chats happen at the table.`]);
    else if (alone >= 2) add(['Yemekte çoğu zaman tek başımaydım. Biraz yalnız hissettim.', 'I ate on my own most of the time today. I felt a bit lonely.']);
  }

  const missions = of('mission').map((e) => e.a!);
  if (missions.length) add([`Bir şey daha başardım: ${list(missions.slice(0, 2), 'tr')}. ✓`, `I managed something else too: ${list(missions.slice(0, 2), 'en')}. ✓`]);

  const places = of('discover').map((e) => e.a!);
  if (places.length >= 3) add([`Kampüste yeni yerler keşfettim: ${list(places.slice(0, 3), 'tr')}. Burası kocaman!`, `I found new places on the campus: ${list(places.slice(0, 3), 'en')}. It's huge!`]);
  else if (places.length) add([`${list(places, 'tr')} neresiymiş, bugün öğrendim.`, `Today I found out where ${list(places, 'en')} ${places.length > 1 ? 'are' : 'is'}.`]);

  // the opening and the closing line follow how the day felt
  const open = mood >= 70 ? pick<Pair>([['Bugün güzel bir gündü.', 'Today was a good day.'], ['Bugün içim kıpır kıpırdı.', 'I felt all fizzy inside today.']])
    : mood >= 45 ? pick<Pair>([['Bugün fena geçmedi.', "Today wasn't bad."], ['Bugün sıradan ama idare eder bir gündü.', 'Today was ordinary, but all right.']])
      : pick<Pair>([['Bugün zor bir gündü.', 'Today was a hard day.'], ['Bugün içim biraz sıkıldı.', 'I felt a bit down today.']]);
  const close = mood >= 70 ? pick<Pair>([['Yarını iple çekiyorum.', "I can't wait for tomorrow."], ['Uykum geldi ama gülümseyerek yatıyorum.', "I'm sleepy, but I'm going to bed smiling."]])
    : mood >= 45 ? pick<Pair>([['Bakalım yarın neler olacak.', "Let's see what tomorrow brings."], ['Şimdi uyku vakti.', 'Time to sleep now.']])
      : pick<Pair>([['Umarım yarın daha iyi geçer. Evi özledim.', "I hope tomorrow is better. I miss home."], ['Yorganı başıma çekip uyuyacağım.', "I'm pulling the blanket over my head and going to sleep."]]);

  // keep it short: the six things that stood out most, in the order they matter
  const body = out.slice(0, 6);
  if (!body.length) body.push(T(['Pek bir şey olmadı; sıradan bir okul günüydü.', 'Not much happened; just an ordinary school day.']));
  const half = Math.ceil(body.length / 2);
  return [`${T(open)} ${body.slice(0, half).join(' ')}`, ...(body.length > half ? [body.slice(half).join(' ')] : []), T(close)];
}

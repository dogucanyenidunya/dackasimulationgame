// Dilemma moments (GDD v0.10): real boarding-school situations with no right answer and no stat hints.
// Each choice nudges who you are becoming (six hidden axes) and is remembered for later years.
import { L, type Text } from '../i18n';
import { GUARDIANS } from '../content/character';
import { BELLETMENS, NPCS, dativeTr, genitiveTr, type NpcDef } from '../content/npcs';
import { myGroup } from './social';
import { FRIEND_AT, type AxisId, type PlayerState } from './state';
import type { GameCtx } from './buildings';

const T = (tr: string, en: string) => L({ tr, en });

/** each axis runs from `lo` (−100) to `hi` (+100); neither end is the bad one */
export const AXES: Array<{ id: AxisId; lo: Text; hi: Text }> = [
  { id: 'rules', lo: { tr: 'Uslu', en: 'Dutiful' }, hi: { tr: 'Haylaz', en: 'Mischievous' } },
  { id: 'ambition', lo: { tr: 'Rahat', en: 'Easygoing' }, hi: { tr: 'Hırslı', en: 'Ambitious' } },
  { id: 'presence', lo: { tr: 'Sessiz', en: 'Quiet' }, hi: { tr: 'Gösterişli', en: 'Show-off' } },
  { id: 'warmth', lo: { tr: 'Şefkatli', en: 'Caring' }, hi: { tr: 'Sert', en: 'Tough' } },
  { id: 'loyalty', lo: { tr: 'Kendi yolunda', en: 'Self-reliant' }, hi: { tr: 'Devreci', en: 'Group-first' } },
  { id: 'heart', lo: { tr: 'Kapalı', en: 'Guarded' }, hi: { tr: 'Açık', en: 'Open' } },
];

export type DilemmaId = 'telefon' | 'arka' | 'parti';

/** nudge the axes (positive = towards `hi`) */
export function shape(st: PlayerState, d: Partial<Record<AxisId, number>>) {
  for (const [k, v] of Object.entries(d) as Array<[AxisId, number]>) st.temper[k] = Math.max(-100, Math.min(100, st.temper[k] + v));
}

export const dilemmaDone = (st: PlayerState, id: DilemmaId) => st.memories.some((m) => m.id === id);

/** the two strongest leanings, e.g. "Şefkatli · Açık"; null while nothing stands out yet */
export function temperLabel(st: PlayerState): string | null {
  const top = AXES.map((a) => ({ a, v: st.temper[a.id] })).filter((x) => Math.abs(x.v) >= 5)
    .sort((x, y) => Math.abs(y.v) - Math.abs(x.v)).slice(0, 2);
  return top.length ? top.map(({ a, v }) => L(v < 0 ? a.lo : a.hi)).join(' · ') : null;
}

interface Choice {
  id: string;
  label: Text;
  /** applies the effects and returns what happened */
  run: () => Text;
}
interface Dilemma { title: Text; intro: Text; question: Text; who?: NpcDef; choices: Choice[] }

const belletmenOf = (ctx: GameCtx) => (ctx.ch.gender === 'girl' ? { id: 'bel-hatice', name: 'Ayşe Hanım' } : { id: 'bel-mehmet', name: 'Ercan Bey' });
const friendOf = (ctx: GameCtx, id: string) => ctx.st.friends[id] ?? 0;
const byId = (id: string) => NPCS.find((n) => n.id === id)!;
const markCall = (ctx: GameCtx) => { ctx.st.daily.call = ctx.clock.day; };

/** the payphone queue in the corridor before lights out (memory 3) */
function telefon(ctx: GameCtx): Dilemma {
  const st = ctx.st;
  // the classmate from your dorm you know least is the one crying behind you
  const kid = NPCS.filter((n) => n.kind === 'classmate' && n.gender === ctx.ch.gender).sort((a, b) => friendOf(ctx, a.id) - friendOf(ctx, b.id))[0];
  const g = L(GUARDIANS.find((x) => x.id === ctx.ch.guardian)!.your);
  const card = st.phoneUnits >= 10;
  const choices: Choice[] = card ? [
    {
      id: 'give', label: { tr: `Sıranı ${dativeTr(kid.name)} ver; sen bu akşam arama`, en: `Give ${kid.name} your turn and go without a call tonight` },
      run: () => {
        markCall(ctx); shape(st, { warmth: -8, ambition: -2 }); ctx.befriend(kid.id, 20); ctx.gain({ mood: 3 });
        return { tr: `${kid.name} telefona sarıldı. "Anne, ben iyiyim…" derken sesi titriyordu. Sen bu akşam aramadan yattın ama içinde garip bir sıcaklık var.`, en: `${kid.name} grabbed the phone. Their voice shook as they said "Mum, I'm fine…". You go to bed without calling tonight, with an odd warm feeling inside.` };
      },
    },
    {
      id: 'call', label: { tr: 'Sıra senin: kendi aramanı yap', en: "It's your turn: make your call" },
      run: () => {
        markCall(ctx); st.phoneUnits -= 10; shape(st, { warmth: 5 }); ctx.befriend(kid.id, -3); ctx.advance(10); ctx.gain({ mood: 12 });
        return { tr: `${g} sesini duyunca çok sevindi. Arkandaki burun çekmeleri gittikçe yükseldi; telefonu kapattığında ışıklar sönmek üzereydi ve ${kid.name} arayamadan yatağına dönmüştü.`, en: `${g} was so happy to hear you. Behind you the sniffles got louder; by the time you hung up the lights were about to go out, and ${kid.name} had gone back to bed without calling.` };
      },
    },
    {
      id: 'share', label: { tr: 'Çok kısa konuş: bir dakikada kapat ki o da arayabilsin', en: 'Keep it very short: hang up after a minute so they can call too' },
      run: () => {
        markCall(ctx); st.phoneUnits -= 5;
        shape(st, { warmth: -5, loyalty: 5 }); ctx.befriend(kid.id, 15); ctx.advance(10); ctx.gain({ mood: 6 });
        return { tr: `${g.toLowerCase()} ile yalnızca bir dakika konuştun: "İyiyim, seni seviyorum, arkamda sıra var!" Ahizeyi ${dativeTr(kid.name)} uzattın; ışıklar sönmeden o da evini aradı. "Sağ ol… yarın sana simit alırım."`, en: `You had just one minute with ${g.toLowerCase()}: "I'm fine, I love you, there's a queue!" You handed the receiver to ${kid.name}, who got through to home before lights out. "Thanks… I'll get you a simit tomorrow."` };
      },
    },
    {
      id: 'sit', label: { tr: `Aramanı yap; telefonu kapatınca ${kid.name}'i teselli et`, en: `Make your call, then go and comfort ${kid.name}` },
      run: () => {
        markCall(ctx); st.phoneUnits -= 10; shape(st, { heart: 8, warmth: -3 }); ctx.befriend(kid.id, 12); ctx.advance(25); ctx.gain({ mood: 10 });
        return { tr: `Aramanı yaptın; ${kid.name} bu akşam arayamadı. Telefonu kapatınca yanına gidip koridorda yere oturdun. Bir süre konuşmadınız; sonra evlerinizi, köpeklerinizi, en sevdiğiniz yemekleri anlattınız. Ağlaması geçti.`, en: `You made your call; ${kid.name} didn't get to ring home tonight. When you hung up you went and sat on the corridor floor beside them. For a while neither of you spoke; then you talked about home, your dogs and your favourite food. The crying stopped.` };
      },
    },
  ] : [
    {
      id: 'stay', label: { tr: 'Kartın yok ama onunla sırada bekle', en: 'No card, but wait in the queue with them' },
      run: () => { shape(st, { warmth: -6, heart: 5 }); ctx.befriend(kid.id, 12); ctx.advance(15); return { tr: `${genitiveTr(kid.name)} sırası gelene kadar yanında durdun. Telefonu kapatınca "İyi ki bekledin" dedi.`, en: `You stood with ${kid.name} until it was their turn. When they hung up they said, "I'm glad you waited."` }; },
    },
    {
      id: 'bed', label: { tr: 'Yatağına git', en: 'Go to bed' },
      run: () => { shape(st, { heart: -5, warmth: 2 }); return { tr: 'Sıradan çıkıp yatağına döndün. Işıklar sönerken koridordan hâlâ hıçkırık sesleri geliyordu.', en: 'You left the queue and went to bed. As the lights went out you could still hear sobbing from the corridor.' }; },
    },
  ];
  return {
    title: { tr: '📞 Telefon sırası', en: '📞 The phone queue' },
    intro: card
      ? { tr: `Işıklar sönmeden önce koridordaki telefonun önünde uzun bir sıra var. Sonunda sıra sana geldi. Arkandaki ${kid.name} ağlıyor; ailesini çok özlemiş. Işıklar sönmeden yalnızca bir kişinin rahatça konuşacağı kadar vakit kaldı.`, en: `Before lights out there's a long queue at the corridor payphone. At last it's your turn. ${kid.name}, behind you, is crying; they miss their family terribly. There's only time left for one proper call before lights out.` }
      : { tr: `Işıklar sönmeden önce koridordaki telefonun önünde uzun bir sıra var. Senin kartında kontör kalmamış. Sıranın sonundaki ${kid.name} ağlıyor; ailesini çok özlemiş.`, en: `Before lights out there's a long queue at the corridor payphone. Your card has run out. ${kid.name}, at the back of the queue, is crying; they miss their family terribly.` },
    question: { tr: 'Ne yaparsın?', en: 'What do you do?' },
    who: kid,
    choices,
  };
}

/** an abi and an abla behind the dorm (memory 2) */
function arka(ctx: GameCtx): Dilemma {
  const st = ctx.st;
  const burak = byId('burak'), ece = byId('ece');
  const bel = belletmenOf(ctx);
  const both = (n: number) => { ctx.befriend(burak.id, n); ctx.befriend(ece.id, n); };
  const dorm = ctx.ch.gender === 'girl' ? T('Kız Yurdu', "girls' dorm") : T('Erkek Yurdu', "boys' dorm");
  return {
    title: { tr: '🌙 Yurdun arkasında', en: '🌙 Behind the dorm' },
    intro: { tr: `Kaçan topu almak için ${dorm}'nun arkasına dolandın. Karanlıkta Burak Abi ile Ece Abla'yı gördün: öpüşüyorlar. Seni henüz fark etmediler.`, en: `You went round the back of the ${dorm} to fetch a ball. In the dark you see Burak Abi and Ece Abla: they're kissing. They haven't noticed you yet.` },
    question: { tr: 'Ne yaparsın?', en: 'What do you do?' },
    choices: [
      {
        id: 'tell', label: { tr: `Belletmene söyle (${bel.name})`, en: `Tell your belletmen, ${bel.name}` },
        run: () => {
          shape(st, { rules: -10 }); ctx.befriend(bel.id, 10); both(-30); ctx.ch.respect = Math.max(0, ctx.ch.respect - 5);
          return { tr: `${bel.name} hemen arkaya gitti. Ertesi gün büyükler seni görünce susup birbirlerine baktı. Biri arkandan "ispiyoncu" diye fısıldadı.`, en: `${bel.name} went straight round the back. The next day the older students went quiet when they saw you, and someone whispered "snitch" behind your back.` };
        },
      },
      {
        id: 'quiet', label: { tr: 'Sessizce uzaklaş, kimseye söyleme', en: 'Walk away and say nothing' },
        run: () => {
          shape(st, { loyalty: 6, presence: -4 });
          return { tr: 'Topu bırakıp sessizce meydana döndün. Bu senin sırrın değil; kimseye bir şey söylemedin.', en: "You left the ball and slipped back to the plaza. It's not your secret, so you told no one." };
        },
      },
      {
        id: 'gossip', label: { tr: 'Koşup arkadaşlarına anlat', en: 'Run and tell your friends' },
        run: () => {
          shape(st, { presence: 8, rules: 3 }); both(-15); ctx.gain({ mood: 4 });
          for (const n of NPCS.filter((x) => x.kind === 'classmate' && friendOf(ctx, x.id) >= 10).slice(0, 3)) ctx.befriend(n.id, 4);
          return { tr: 'Meydanda herkes etrafına toplandı. Sabah kahvaltısına kadar bütün sınıf biliyordu. Ece Abla bir daha sana gülümsemedi.', en: 'Everyone on the plaza crowded round you. By breakfast the whole year knew. Ece Abla never smiled at you again.' };
        },
      },
      {
        id: 'deal', label: { tr: 'Gördüğünü belli et, karşılığında bir şey iste', en: 'Let them know you saw, and ask for something' },
        run: () => {
          shape(st, { warmth: 8, ambition: 6, rules: 4 }); both(-10); ctx.gain({ hunger: 30, mood: 6 });
          return { tr: 'Öksürdün. İkisi de dondu kaldı. Ertesi gün Ece Abla kantinde sana tost ısmarladı: "Bunu unutuyoruz, değil mi ufaklık?"', en: 'You coughed. They both froze. The next day Ece Abla bought you a toastie at the canteen: "We\'re forgetting this, aren\'t we, little one?"' };
        },
      },
    ],
  };
}

/** the first party, on report card day (memory 1) */
function parti(ctx: GameCtx): Dilemma {
  const st = ctx.st;
  const known = NPCS.filter((n) => n.kind === 'classmate' && st.once[`met-${n.id}`]).sort((a, b) => friendOf(ctx, b.id) - friendOf(ctx, a.id)).slice(0, 4);
  const asked = known[0];
  return {
    title: { tr: '🎶 İlk parti', en: '🎶 The first party' },
    intro: { tr: 'Karne töreninden sonra Kapalı Saha\'da okulun ilk partisi var. Bütün gün herkes aynı şeyi konuştu: halay ve ilk dans için kim kiminle eş olacak?', en: 'After the report card ceremony there\'s the school\'s first party in the Kapalı Saha. All day everyone has talked about one thing: who will be whose partner for the halay and the first dance?' },
    question: { tr: 'Sen ne yaparsın?', en: 'What do you do?' },
    choices: [
      ...(asked ? [{
        id: 'ask', label: { tr: `Eşin olmasını iste: ${asked.name}`, en: `Ask ${asked.name} to be your partner` },
        run: (): Text => {
          shape(st, { heart: 8, presence: 5 });
          const yes = Math.random() < Math.max(0.15, Math.min(0.9, 0.3 + friendOf(ctx, asked.id) / 100));
          if (yes) { ctx.befriend(asked.id, 15); ctx.gain({ mood: 12 }); return { tr: `${asked.name} kızardı ve "Olur!" dedi. Halayda en önde siz vardınız.`, en: `${asked.name} went red and said "OK!". You two led the halay.` }; }
          ctx.befriend(asked.id, 3); ctx.gain({ mood: -6 });
          return { tr: `${asked.name}: "Ah… başkasına söz verdim, özür dilerim." Yine de bir şarkıda yanında dans etti.`, en: `${asked.name}: "Oh… I've already promised someone, sorry." They still danced next to you for one song.` };
        },
      }] : []),
      {
        id: 'wait', label: { tr: 'Bekle, belki biri sana teklif eder', en: 'Wait and hope someone asks you' },
        run: () => {
          shape(st, { heart: -6, presence: -6 });
          const fan = NPCS.filter((n) => n.kind === 'classmate' && friendOf(ctx, n.id) >= FRIEND_AT).sort((a, b) => friendOf(ctx, b.id) - friendOf(ctx, a.id))[0];
          if (fan && Math.random() < 0.6) { ctx.befriend(fan.id, 10); ctx.gain({ mood: 10 }); return { tr: `Tam umudunu keserken ${fan.name} yanına geldi: "Benimle dans eder misin?"`, en: `Just as you gave up, ${fan.name} came over: "Will you dance with me?"` }; }
          ctx.gain({ mood: -4 });
          return { tr: 'Kimse gelmedi. Duvarın dibinde gazozunu içip dansı izledin.', en: 'Nobody came. You drank your fizzy pop by the wall and watched the dancing.' };
        },
      },
      {
        id: 'group', label: { tr: 'Arkadaş grubunla birlikte git', en: 'Go with your friend group' },
        run: () => {
          shape(st, { loyalty: 8 });
          const g = myGroup(st);
          const pals = NPCS.filter((n) => (g ? n.group === g : n.kind === 'classmate') && friendOf(ctx, n.id) >= FRIEND_AT / 2);
          pals.forEach((n) => ctx.befriend(n.id, 5)); ctx.gain({ mood: 8 });
          return pals.length
            ? { tr: `${pals.slice(0, 3).map((n) => n.name).join(', ')} ile kol kola girdiniz; eş derdi kimsenin aklına gelmedi.`, en: `You went arm in arm with ${pals.slice(0, 3).map((n) => n.name).join(', ')}; nobody gave partners another thought.` }
            : { tr: 'Grubun daha tam oturmamıştı ama sınıftan birkaç kişiyle takıldınız.', en: "Your group hadn't quite formed yet, but you hung out with a few people from your class." };
        },
      },
      {
        id: 'skip', label: { tr: 'Partiye gitme', en: 'Skip the party' },
        run: () => {
          shape(st, { presence: -8, loyalty: -6 }); ctx.gain({ mood: 2 });
          return { tr: 'Yurtta kitabını okudun. Müzik pencereden içeri süzülüyordu; kimse seni rahatsız etmedi.', en: 'You read your book in the dorm. The music drifted in through the window, and nobody bothered you.' };
        },
      },
    ],
  };
}

const BUILD: Record<DilemmaId, (ctx: GameCtx) => Dilemma> = { telefon, arka, parti };

/** what a choice changed, read off the state before and after it ran */
function snapshot(ctx: GameCtx) {
  const st = ctx.st;
  return { temper: { ...st.temper }, friends: { ...st.friends }, mood: st.mood, money: st.money, units: st.phoneUnits, hunger: st.hunger, respect: ctx.ch.respect, discipline: st.discipline };
}

/** shows the dilemma over the open panel: the situation and the choices together, then what came of it;
 *  false if it was set aside (it comes back later) */
export async function runDilemma(ctx: GameCtx, id: DilemmaId): Promise<boolean> {
  if (dilemmaDone(ctx.st, id)) return true;
  const d = BUILD[id](ctx);
  const pick = await ctx.panel.dilemma({
    title: L(d.title), intro: L(d.intro), question: L(d.question),
    choices: d.choices.map((c) => ({ id: c.id, label: L(c.label) })),
    later: T('Şimdi karar veremiyorum', "I can't decide right now"),
  });
  const c = d.choices.find((x) => x.id === pick);
  if (!c) return false;
  const before = snapshot(ctx);
  const outcome = c.run();
  ctx.st.memories.push({ id, choice: c.id, day: ctx.clock.day, year: ctx.st.year, who: d.who?.id });
  ctx.log(`✦ ${L(d.title).replace(/^\S+\s/, '')}: ${L(c.label)}`);
  const after = snapshot(ctx);
  const shifts = AXES.map((a) => ({ a, d: after.temper[a.id] - before.temper[a.id] })).filter((x) => x.d !== 0)
    .sort((x, y) => Math.abs(y.d) - Math.abs(x.d))
    .map(({ a, d: delta }) => ({ towards: L(delta < 0 ? a.lo : a.hi), from: L(delta < 0 ? a.hi : a.lo), amount: Math.abs(delta) }));
  const effects: Array<{ text: string; good: boolean }> = [];
  const num = (label: string, delta: number, unit = '', flip = false) => {
    const r = Math.round(delta);
    if (r) effects.push({ text: `${label} ${r > 0 ? '+' : '−'}${Math.abs(r)}${unit}`, good: flip ? r < 0 : r > 0 });
  };
  for (const n of [...NPCS, ...BELLETMENS]) {
    const df = (after.friends[n.id] ?? 0) - (before.friends[n.id] ?? 0);
    if (df) num(`${df > 0 ? '🤝' : '💔'} ${n.name}`, df);
  }
  num(T('🙂 Moral', '🙂 Mood'), after.mood - before.mood);
  num(T('🍽 Tokluk', '🍽 Fullness'), after.hunger - before.hunger);
  num(T('☎️ Kontör', '☎️ Phone units'), after.units - before.units);
  num(T('💰 Para', '💰 Money'), after.money - before.money, ' ₺');
  num(T('⭐ Saygınlık', '⭐ Respect'), after.respect - before.respect);
  num(T('⚠ Disiplin puanı', '⚠ Discipline points'), after.discipline - before.discipline, '', true);
  await ctx.panel.outcome({ title: L(d.title), body: L(outcome), shifts, effects });
  return true;
}

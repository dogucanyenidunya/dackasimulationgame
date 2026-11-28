// What you can do inside each building (step 3 of the prototype). Interiors are menus for now.
import { L, type Text } from '../i18n';
import type { Panel, PanelView, ActionView, RoomView } from '../ui/panel';
import { GUARDIANS, type Attributes, type CharacterData } from '../content/character';
import { BOOKS, askFor } from '../content/quiz';
import { hasPerk } from './growth';
import { TEACHERS } from '../content/classroom';
import { bioOf, personaOf } from '../content/bios';
import { DEFAULT_LOOK } from '../art/character';
import { BAG_MAX, BORROWED, LOCKER_MAX, loanOf, outfitById, ownedOutfits, snackById } from '../content/wardrobe';
import { MATCH_TIP, lightsOut, matchOn, ceremonyNow, ETUT_START, currentPeriod, diningOpen, fmtTime, hasEtut, isSnackTime, isWeekend, LATE_AFTER, LATE_AFTER_PE, presentKey, PERIODS, periodLabel, phaseOf, PLAZA_START, SNACK_END, SNACK_START, subjectFor } from './schedule';
import { CLASS_LETTERS, SCHOOL_PRESIDENT_GRADE, DEV, ESCAPE_FROM_YEAR, grade, dormPlace, LESSONS_PER_SUBJECT, SUBJECTS, FRIEND_AT, YEAR1_XP, clamp, COURT_PLAYERS, MANDOLIN_LESSONS, PEE_LAST_YEAR, lessonsLeft, type CourtSport, type InstrumentId, type MealId, type PlayerState, type SportId } from './state';
import { GIVER_IDS, MISSIONS, missionById, missionDone, oldersToMeet, questsFrom, reached, statusOf, type Mission, type MissionCtx } from './missions';
import { BUS_BOARDING, BUS_LEAVES, CARSI_END, CARSI_OUT_FROM_YEAR, CARSI_START, FAMILY_VISIT_END, carsiNow, familyVisitNow, isFriday, npcIsEvci } from './weekend';
import { activityOf } from './routine';
import { lineFor, type Moment } from '../content/lines';
import { dilemmaDone, runDilemma, shape } from './dilemmas';
import { growRespect, growSkill, type AxisId } from './state';
import { DEPUTY, NPCS, ablativeTr, dativeTr, friendLevel, genitiveTr, type NpcDef } from '../content/npcs';
import type { CharacterLook } from '../art/textures';
import type { DiaryEvent } from '../content/diary';
import type { YbResult } from '../ui/yetimball';
import type { BasketResult } from '../ui/basketball';
import type { FootballResult } from '../ui/football';
import type { NetResult, NetSport } from '../ui/netgame';
import type { MarblesResult } from '../ui/marbles';
import type { DodgeResult } from '../ui/dodgeball';
import type { HideResult, HideRole } from '../ui/hideseek';
import type { PhoneRunResult } from '../ui/phoneRun';
import { hasSecret } from './secrets';
import { chooseFocus, focusLine, focusTick } from './focus';
import { ageRel, blockedBy, nextTierHint, sortOut, tierOf, trustLine, type AgeRel } from './interactions';
import { dislikers } from './social';
import { lessonEvent, lessonFiller, lessonOpening, type MomentResult } from './lessonMoments';

export interface Gain { xp?: number; attrs?: Partial<Attributes>; mood?: number; energy?: number; hunger?: number; money?: number }

export interface GameCtx {
  st: PlayerState;
  ch: CharacterData;
  clock: { day: number; minutes: number };
  raining: boolean;
  panel: Panel;
  /** the action took this long. Offline the clock jumps ahead; online (one shared clock) it's done at once, unless
   *  `wait` is set for time you really spend (a lesson until the bell, a family visit, an afternoon in town), with a
   *  banner counting it down and a button to finish early */
  advance(minutes: number, opts?: { wait?: boolean; label?: string }): void;
  /** let this much time go by, then carry on: solo it jumps; online you wait for the campus clock (Stop cuts it short) */
  pass(minutes: number, label?: string): Promise<void>;
  sleep(): void;
  gain(g: Gain): void;
  toast(msg: string, kind?: 'info' | 'good'): void;
  discover(id: string): void;
  mc(): MissionCtx;
  befriend(npcId: string, amount: number): void;
  yearEnd(): void;
  /** discipline points (+) with a reason toast */
  penalize(points: number, why: string): void;
  /** successful escape: leave the dorm at night */
  escape(): void;
  /** walk out of the dorm room onto the dorm plaza */
  leaveDorm(): void;
  /** is the belletmen close enough to notice what you're doing? */
  beltNear(): boolean;
  /** evci: take the bus home and come back on Sunday evening */
  goHome(summary: string): void;
  /** courts: ask friends who are around to come and play; returns why not, or null when they're on their way */
  callFriends(sport: CourtSport): string | null;
  /** where you are: out on the campus, or in one of the walkable rooms */
  place(): 'out' | 'class' | 'dining' | 'dorm';
  /** the registration weekend is still on (the Cemiyet stays open, nobody has lessons yet) */
  rush(): boolean;
  /** you changed clothes: repaint yourself */
  dress(): void;
  /** sit and let the time go by, quickly, until this minute of the day (nothing gained) */
  killTime(until: number): void;
  /** back inside the Eğitim Binası, in your classroom (after PE) */
  toClass(): void;
  /** a line in today's diary */
  log(e: DiaryEvent): void;
  /** take your seat in the stand for the match */
  watchMatch(): void;
  /** a game of Yetimball against a classmate of this skill (0–1); resolves with how it ended */
  playYetimball(opponent: string, skill: number): Promise<YbResult>;
  /** a game of 2-on-2 basketball: you and `mate` against `opps` */
  playBasketball(mate: NpcDef, opps: [NpcDef, NpcDef]): Promise<BasketResult>;
  /** a game of 3-on-3 football: you, `team[0]` and `team[1]` in goal, against `opps` (the last of them in goal) */
  playFootball(team: [NpcDef, NpcDef], opps: [NpcDef, NpcDef, NpcDef], variant?: 'football' | 'futsal' | 'handball'): Promise<FootballResult>;
  /** badminton against one, or volleyball with `mate` against two */
  playNetGame(sport: NetSport, mate: NpcDef | null, opps: NpcDef[]): Promise<NetResult>;
  /** rock-paper-scissors with a classmate, best of three: true won, false lost, null walked off */
  playRps(npc: NpcDef): Promise<boolean | null>;
  /** a game of marbles in the ring with a classmate */
  playMarbles(npc: NpcDef): Promise<MarblesResult>;
  /** dodgeball: you and `mates` in the middle, the two `ebes` throwing */
  playDodgeball(mates: NpcDef[], ebes: [NpcDef, NpcDef]): Promise<DodgeResult>;
  /** hide-and-seek: hiding from `others[0]`, or seeking all of `others` */
  playHideSeek(role: HideRole, others: NpcDef[]): Promise<HideResult>;
  /** the run down the dorm corridor to the phone (`caller` is ringing, `belletmen` is on duty); resolves at the phone */
  runToPhone(caller: string, belletmen: string): Promise<PhoneRunResult>;
}

/** reason text when a feature is still locked behind a mission */
function needMission(ctx: GameCtx, id: string): string | undefined {
  if (reached(id, ctx.mc())) return undefined;
  const title = L(missionById(id).title);
  return T(`"${title}" görevi açılınca kullanılabilir.`, `Opens with the "${title}" mission.`);
}
const sickLock = (ctx: GameCtx) => (ctx.st.sick ? T('Hastasın. Önce Revir\'e git.', "You're sick. Go to the infirmary first.") : undefined);
/** what you look like in an outfit (for the wardrobe pictures) */
const lookIn = (ctx: GameCtx, c: { top: string; bottom: string }): CharacterLook => ({ ...ctx.ch.look, top: c.top, bottom: c.bottom });
/** your closest friend among the classmates in your dorm (the lockers next to yours are theirs) */
export function dormBestFriend(ctx: GameCtx): NpcDef | null {
  const pals = NPCS.filter((n) => n.kind === 'classmate' && n.gender === ctx.ch.gender && (ctx.st.friends[n.id] ?? 0) >= FRIEND_AT)
    .sort((a, b) => (ctx.st.friends[b.id] ?? 0) - (ctx.st.friends[a.id] ?? 0));
  return pals[0] ?? null;
}
/** a snack goes into your pockets; false if they're full */
function pocket(ctx: GameCtx, id: string): boolean {
  if (ctx.st.food.bag.length >= BAG_MAX) return false;
  ctx.st.food.bag.push(id);
  return true;
}

/** something from your family (homemade cookies): it goes straight onto the food shelf in your locker, or into your
 *  pocket if the shelf is full; with no room anywhere you eat it there and then. Says where it went. */
function familyTreat(ctx: GameCtx, id: string): Text {
  const { locker, bag } = ctx.st.food;
  if (locker.length < LOCKER_MAX) { locker.push(id); return { tr: ' Kurabiyeler dolabında, yiyecek rafında.', en: ' The cookies are on the food shelf in your locker.' }; }
  if (bag.length < BAG_MAX) { bag.push(id); return { tr: ' Dolabın dolu olduğu için kurabiyeler cebinde.', en: ' Your locker is full, so the cookies are in your pocket.' }; }
  const sn = snackById(id);
  if (sn) ctx.gain({ hunger: sn.hunger, mood: sn.mood });
  return { tr: ' Dolabında da cebinde de yer yoktu; kurabiyeleri orada yedin.', en: ' There was no room in your locker or your pockets, so you ate the cookies there and then.' };
}

const T = (tr: string, en: string): string => L({ tr, en });

// ---- what your perks change (see growth.ts) ----
/** a reading session: 45 minutes, 30 with Hızlı Okuma */
const readMinutes = (ctx: GameCtx) => (hasPerk(ctx.st, 'hizliOkuma') ? 30 : 45);
/** tries at the homework puzzle: 4, 5 with Ezberci */
const homeworkTries = (ctx: GameCtx) => (hasPerk(ctx.st, 'ezberci') ? 5 : 4);
/** a canteen price, 10% off (rounded) for a Pazarlıkçı */
const price = (ctx: GameCtx, p: number) => (hasPerk(ctx.st, 'pazarlikci') ? Math.max(1, Math.round(p * 0.9)) : p);
/** a music game's speed: the more creative you are, the slower the notes come (up to a third slower at 100) */
const musicSpeed = (ctx: GameCtx, speed: number) => speed * (1 - ctx.ch.attributes.creativity / 300);
/** extra minutes before you count as late (Dakik) */
export const lateGrace = (ctx: { st: PlayerState }) => (hasPerk(ctx.st, 'dakik') ? 5 : 0);
const subjName = (id: string) => L(SUBJECTS.find((s) => s.id === id)!.name);

export const SPORTS: Array<{ id: SportId; name: Text; where: Text; tryout: Text; zone: number; speed: number }> = [
  { id: 'basketball', name: { tr: 'Basketbol', en: 'Basketball' }, where: { tr: 'Spor Salonu / açık kort', en: 'Sports hall / outdoor court' }, tryout: { tr: 'Serbest atış', en: 'Free throws' }, zone: 0.22, speed: 1.2 },
  { id: 'volleyball', name: { tr: 'Voleybol', en: 'Volleyball' }, where: { tr: 'Spor Salonu', en: 'Sports hall' }, tryout: { tr: 'Servis zamanlaması', en: 'Serve timing' }, zone: 0.22, speed: 1.3 },
  { id: 'football', name: { tr: 'Futbol (futsal)', en: 'Football (futsal)' }, where: { tr: 'Spor Salonu / açık kort', en: 'Sports hall / outdoor court' }, tryout: { tr: 'Penaltı atışı', en: 'Penalty kicks' }, zone: 0.24, speed: 1.25 },
  { id: 'tennis', name: { tr: 'Tenis', en: 'Tennis' }, where: { tr: 'Tenis kortu', en: 'Tennis court' }, tryout: { tr: 'Ralli zamanlaması', en: 'Rally timing' }, zone: 0.18, speed: 1.4 },
  { id: 'swimming', name: { tr: 'Yüzme', en: 'Swimming' }, where: { tr: 'Havuz', en: 'Pool' }, tryout: { tr: 'Kulaç ritmi', en: 'Stroke rhythm' }, zone: 0.24, speed: 1.1 },
  { id: 'fencing', name: { tr: 'Eskrim', en: 'Fencing' }, where: { tr: 'Eskrim salonu', en: 'Fencing room' }, tryout: { tr: 'Savuşturma ve hamle', en: 'Parry and lunge' }, zone: 0.16, speed: 1.5 },
  { id: 'athletics', name: { tr: 'Atletizm', en: 'Athletics' }, where: { tr: 'Orman kenarındaki koşu yolu', en: 'Running loop by the forest' }, tryout: { tr: 'Depar ritmi', en: 'Sprint rhythm' }, zone: 0.24, speed: 1.2 },
  { id: 'tabletennis', name: { tr: 'Masa tenisi', en: 'Table tennis' }, where: { tr: 'Sosyal Merkez kulüp odası', en: 'Social center club room' }, tryout: { tr: 'Refleks', en: 'Reflexes' }, zone: 0.18, speed: 1.6 },
  { id: 'chess', name: { tr: 'Satranç', en: 'Chess' }, where: { tr: 'Kütüphane', en: 'Library' }, tryout: { tr: 'Hamle zamanlaması', en: 'Move timing' }, zone: 0.26, speed: 1.0 },
];

/** Şakir Abi's canteen */
const KANTIN: Array<{ id: string; name: Text; price: number; hunger: number; mood: number }> = [
  { id: 'sosisli', name: { tr: 'Şakir\'in sosislisi', en: "Şakir's hot dog" }, price: 15, hunger: 35, mood: 8 },
  { id: 'hamburger', name: { tr: 'Hamburger', en: 'Hamburger' }, price: 25, hunger: 50, mood: 10 },
  { id: 'tantuni', name: { tr: 'Tantuni', en: 'Tantuni wrap' }, price: 30, hunger: 55, mood: 12 },
  { id: 'tost', name: { tr: 'Kaşarlı tost', en: 'Cheese toastie' }, price: 12, hunger: 30, mood: 5 },
];
/** snacks keep: eat them on the spot or take them back to your locker */
const KANTIN_SNACKS: Array<{ id: string; price: number }> = [
  { id: 'atistirmalik', price: 8 }, { id: 'gofret', price: 5 }, { id: 'biskuvi', price: 6 }, { id: 'kuruyemis', price: 10 }, { id: 'meyvesuyu', price: 5 }, { id: 'ayran', price: 4 },
];
/** the dining hall's afternoon snack (ara öğün), one a day */
const ARA_OGUN: Array<{ id: string; name: Text; hunger: number; mood: number }> = [
  { id: 'pogaca', name: { tr: 'Peynirli poğaça', en: 'Cheese poğaça' }, hunger: 40, mood: 4 },
  { id: 'catalsimit', name: { tr: 'Çatal simit', en: 'Çatal simit' }, hunger: 35, mood: 4 },
  { id: 'dieforyou', name: { tr: '"Die for you" kek', en: '"Die for you" cake' }, hunger: 30, mood: 9 },
  { id: 'acma', name: { tr: 'Açma', en: 'Açma' }, hunger: 40, mood: 4 },
];
/** a phone card for the dorm payphone */
const PHONE_CARD = { price: 25, units: 30, perCall: 10 };

/** everyday actions nudge who you are becoming a little (dilemmas move it more) */
function nudge(ctx: GameCtx, d: Partial<Record<AxisId, number>>) { shape(ctx.st, d); }
const TEAM_SPORTS: string[] = ['basketball', 'volleyball', 'football'];
const LESSON_NUDGE: Record<string, Partial<Record<AxisId, number>>> = {
  answer: { ambition: 1, presence: 1 }, notes: { rules: -1, ambition: 1 }, talk: { rules: 1, loyalty: 1 },
  tease: { warmth: 2, presence: 1, rules: 1 }, else: { rules: 1, ambition: -1 }, mandolin: { ambition: 1 },
};

function doneToday(ctx: GameCtx, key: string) { return ctx.st.daily[key] === ctx.clock.day; }
function markToday(ctx: GameCtx, key: string) { ctx.st.daily[key] = ctx.clock.day; }

function status(ctx: GameCtx): string {
  const { day, minutes } = ctx.clock;
  return `⏰ ${fmtTime(minutes)} · ${L(periodLabel(day, minutes))}`;
}

function nextOf(ctx: GameCtx, kind: 'lesson' | 'meal'): string {
  const { day, minutes } = ctx.clock;
  const next = PERIODS.find((p) => p.kind === kind && p.start > minutes && !(kind === 'lesson' && isWeekend(day)));
  return next ? `${L(next.name)} ${fmtTime(next.start)}` : T('yarın', 'tomorrow');
}

/** "Erkek Yurdu · A1 Blok · 1. Kat · 7. Bölüm" */
export function dormAddress(ctx: GameCtx): string {
  const { block, floor } = dormPlace(1);
  const name = ctx.ch.gender === 'girl' ? T('Kız Yurdu', "Girls' Dorm") : T('Erkek Yurdu', "Boys' Dorm");
  return T(`${name} · ${block} Blok · ${floor}. Kat · ${ctx.st.school.section}. Bölüm`, `${name} · Block ${block} · Floor ${floor} · Section ${ctx.st.school.section}`);
}

/** guessing-game score from how far off you were (used in lessons and the exam) */
function closenessScore(d: number): number {
  return d === 0 ? 100 : d === 1 ? 85 : d === 2 ? 65 : d <= 4 ? 40 : 20;
}

const needRegistration = (ctx: GameCtx) => (ctx.st.school.registered ? undefined : T('Önce Cemiyet Binası\'nda kayıt olmalısın.', 'Register at the Cemiyet building first.'));
const teacherOf = (sub: keyof typeof TEACHERS) => TEACHERS[sub].name;

// ---------------- buildings ----------------

function cemiyet(ctx: GameCtx): PanelView {
  const s = ctx.st.school;
  return {
    title: 'Cemiyet Binası', sub: T('Yönetim · kayıt', 'Administration · registration'), status: status(ctx),
    rooms: [
      {
        id: 'danisma', name: T('Danışma', 'Reception'),
        note: ctx.st.once.classDrawn
          ? T(`Kaydın tamam: ${s.classLabel} sınıfı · ${dormAddress(ctx)}`, `You're registered: class ${s.classLabel} · ${dormAddress(ctx)}`)
          : s.registered
            ? T('Kaydın yapıldı. Sağlık kontrolü, kıyafetler ve kitaplar da bitince sınıfın kurayla belli olacak.', "You're registered. Once the health check, your clothes and your books are done too, your class will be decided by a draw.")
            : T('Danışmanın önü kalabalık: bütün okul kayıt için burada. Görevli gülümsüyor: "Hoş geldin! Kaydını yapalım."', 'The reception is crowded: the whole school is here to register. The clerk smiles: "Welcome! Let\'s get you registered."'),
        actions: [
          {
            id: 'register', label: T('Kaydını yap', 'Register'), hint: T('20 dk · +20 XP', '20 min · +20 XP'),
            locked: s.registered ? T('Kaydın zaten yapıldı.', 'Already registered.') : undefined,
            run: async () => {
              s.registered = true;
              ctx.advance(20);
              ctx.gain({ xp: 20 });
              await ctx.panel.message(T('Kayıt tamam', 'Registered'), T(
                'Artık resmen bir Daçkalısın! Sıradakiler: Revir\'de sağlık kontrolü, Spor Salonu\'ndaki depodan kıyafetlerin ve Kütüphane\'den ders kitapların. Hepsi bitince sınıf kuran çekilecek.',
                "You're officially a Daçka student! Next: a health check at the infirmary, your clothes from the stores in the Spor Salonu and your textbooks at the library. When they're all done, your class will be drawn."));
            },
          },
        ],
      },
    ],
  };
}

/** the stores in the Spor Salonu: uniforms, coats, shoes and tracksuits */
function depoRoom(ctx: GameCtx): RoomView {
  const s = ctx.st.school;
  return {
    id: 'depo', name: T('Depo', 'Stores'),
    locked: needRegistration(ctx),
    note: s.kit ? T('Kıyafetlerin dolabında: üniforma, mont, ayakkabılar, eşofman, pijama.', 'Your clothes are in your locker: uniform, coat, shoes, tracksuit, pyjamas.') : T('Depo memuru raflardan senin bedenini arıyor. Önünde uzun bir sıra var.', 'The storekeeper searches the shelves for your size. There is a long queue.'),
    actions: [{
      id: 'kit', label: T('Kıyafetlerini al', 'Collect your kit'), hint: T('15 dk · +20 XP', '15 min · +20 XP'),
      locked: s.kit ? T('Kıyafetlerini zaten aldın.', 'Already collected.') : undefined,
      run: async () => {
        s.kit = true;
        ctx.st.wardrobe.wearing = 'uniforma';
        ctx.dress();
        ctx.advance(15);
        ctx.gain({ xp: 20 });
        await ctx.panel.message(T('Depo', 'Stores'), T(
          'Aldıkların: gömlek, bordo kazak, kravat, pantolon/etek, mont, okul ayakkabısı, spor ayakkabısı, eşofman ve pijama. Üniformanı hemen giydin; ötekiler dolabında, istediğin zaman değiştirebilirsin.',
          "You got: shirt, burgundy sweater, tie, trousers/skirt, a coat, school shoes, sports shoes, a tracksuit and pyjamas. You put the uniform straight on; the rest are in your locker, and you can change whenever you like."));
      },
    }],
  };
}

/** the counselor's room in the Eğitim Binası */
function rehberRoom(ctx: GameCtx): RoomView {
  return {
    id: 'rehber', name: T('Rehber öğretmen', 'Counselor'),
    note: T('Rehber öğretmen Tolga Hoca\'nın kapısı herkese açık.', 'Mr. Tolga, the counselor, keeps his door open for everyone.'),
    actions: [{
      id: 'talk', label: T('Biraz konuş', 'Have a talk'), hint: T('20 dk · +12 moral (günde bir)', '20 min · +12 mood (once a day)'),
      locked: doneToday(ctx, 'counselor') ? T('Bugün zaten konuştunuz.', 'You already talked today.') : undefined,
      run: async () => { nudge(ctx, { heart: 2 });
        markToday(ctx, 'counselor');
        ctx.advance(20);
        ctx.gain({ mood: hasSecret(ctx.st, 'sirdas') ? 20 : 12, xp: 5 });
        await ctx.panel.message(T('Tolga Hoca', 'Mr. Tolga'), T(
          '"İlk haftalar herkes için zordur. Özlemek normal. Bir şeye ihtiyacın olursa buradayım."',
          '"The first weeks are hard for everyone. Missing home is normal. I\'m here whenever you need me."'));
      },
    }],
  };
}

/** the lesson that's on right now, and whether you still have to get to it */
export function lessonNow(ctx: GameCtx): { key: string; periodId: string; start: number; end: number; subject: keyof typeof TEACHERS; attended: boolean; late: boolean; slip: boolean } | null {
  const { day, minutes } = ctx.clock;
  const p = currentPeriod(day, minutes);
  if (!p || p.kind !== 'lesson') return null;
  const key = `${day}-${p.id}`;
  const slip = ctx.st.daily[`slip-${p.id}`] === day;
  const subject = subjectFor(day, p.id);
  // you're only late if you weren't there when it began: in the classroom (or out on the pitch for PE)
  const present = ctx.st.daily[presentKey(p.id)] === day;
  const late = !present && minutes - p.start > (subject === 'beden' ? LATE_AFTER_PE : LATE_AFTER) + lateGrace(ctx);
  return { key, periodId: p.id, start: p.start, end: p.end, subject, attended: ctx.st.school.attended.includes(key), late, slip };
}

/** the deputy head's office: late slips */
function deputyRoom(ctx: GameCtx): RoomView {
  const les = lessonNow(ctx);
  const need = !!les && !les.attended && les.late && !les.slip;
  return {
    id: 'mudur_yrd', name: T('Müdür yardımcısı', 'Deputy head'),
    note: need
      ? T(`${DEPUTY.name} saatine bakıyor: "Zil çalalı ${ctx.clock.minutes - les!.start} dakika oldu. Geç kâğıdı olmadan sınıfa giremezsin."`, `${DEPUTY.name} checks her watch: "The bell rang ${ctx.clock.minutes - les!.start} minutes ago. You can't go into class without a late slip."`)
      : T(`${DEPUTY.name} masasında yoklama defterlerini inceliyor. Derse geç kalan, geç kâğıdını buradan alır; derse girmeyeni kendisi bulup getirir.`, `${DEPUTY.name} is going through the registers at her desk. Anyone late for a lesson gets a late slip here; anyone who skips one, she goes and fetches herself.`),
    actions: [{
      id: 'slip', label: T('📝 Geç kâğıdı al', '📝 Get a late slip'), hint: T('5 dk · +1 disiplin puanı · bu derse girebilirsin', '5 min · +1 discipline point · lets you into this lesson'),
      locked: !les ? T('Şu an ders yok.', 'There is no lesson right now.') : les.attended ? T('Bu derse zaten girdin.', 'You already attended this lesson.')
        : !les.late ? T('Geç kalmadın: doğru sınıfa!', "You're not late: straight to class!") : les.slip ? T('Geç kâğıdın cebinde. Sınıfa koş!', 'You have your slip. Run to class!') : undefined,
      run: async () => {
        ctx.st.daily[`slip-${les!.periodId}`] = ctx.clock.day;
        nudge(ctx, { rules: 1 });
        ctx.advance(5);
        ctx.penalize(1, T(`${DEPUTY.name}: "Bir daha geç kalma!"`, `${DEPUTY.name}: "Don't be late again!"`));
        await ctx.panel.message(DEPUTY.name, T('"Al bakalım geç kâğıdını. Öğretmenine ver ve sessizce yerine otur. Bu, defterine işlendi."', '"Here is your late slip. Give it to your teacher and sit down quietly. It has gone in your record."'));
      },
    }],
  };
}

function muze(ctx: GameCtx): PanelView {
  return {
    title: 'Müze', sub: T('Okulun tarihi', "The school's history"), status: status(ctx),
    rooms: [{
      id: 'sergi', name: T('Sergi', 'Exhibition'),
      note: T('Cam vitrinlerde eski fotoğraflar, defterler ve bir okul zili.', 'Glass cases hold old photographs, notebooks and a school bell.'),
      actions: [{
        id: 'ch1', label: T('Bölüm 1: 1863', 'Chapter 1: 1863'), hint: T('15 dk · +15 XP · +1 Bilgi', '15 min · +15 XP · +1 Knowledge'),
        locked: ctx.st.once.museum1 ? T('Bu bölümü okudun. Yeni bölüm gelecek yıl.', 'You read this chapter. The next one opens next year.') : undefined,
        run: async () => {
          ctx.st.once.museum1 = true;
          ctx.advance(15);
          ctx.gain({ xp: 15, attrs: { knowledge: 1 } });
          await ctx.panel.message(T('Bölüm 1: 1863', 'Chapter 1: 1863'), T(
            '1863\'te İstanbul\'da bir grup gönüllü, ebeveynini kaybetmiş çocuklara iyi bir eğitim vermek için bir cemiyet kurdu. On yıl sonra, 1873\'te, okul ilk öğrencilerini kabul etti. O günden beri her yeni öğrenci bu kapıdan, senin gibi bir bavulla girdi.',
            'In 1863 a group of volunteers in Istanbul founded a society to give children who had lost a parent a good education. Ten years later, in 1873, the school took its first students. Ever since, every new student has walked through the gate with a suitcase, just like you.'));
        },
      }],
    }],
  };
}

/** the academic building: 'desk' = your seat in the classroom, 'corridor' = the rest of the building */
/** the library (its own building): textbooks, borrowing and reading, the librarian's book chat */
function libraryActionsFor(ctx: GameCtx): ActionView[] {
  const s = ctx.st.school;
  const reading = ctx.st.reading;
  const book = BOOKS.find((b) => b.id === reading.book);

  const libraryActions: ActionView[] = [
    {
      id: 'textbooks', label: T('Ders kitaplarını al', 'Collect your textbooks'), hint: T('10 dk · +20 XP', '10 min · +20 XP'),
      locked: needRegistration(ctx) ?? (s.books ? T('Kitaplarını zaten aldın.', 'Already collected.') : undefined),
      run: async () => {
        s.books = true; ctx.advance(10); ctx.gain({ xp: 20 });
        ctx.toast(T('Ders kitapları çantanda!', 'Textbooks in your bag!'), 'good');
      },
    },
  ];
  if (!book) {
    const unread = BOOKS.filter((b) => !reading.finished.includes(b.id));
    libraryActions.push({
      id: 'borrow', label: T('Kitap ödünç al', 'Borrow a book'), hint: T('9–10 yaş rafı', 'Ages 9–10 shelf'),
      locked: needMission(ctx, 'ilk_kitap') ?? (unread.length ? undefined : T('Bu raftaki tüm kitapları okudun!', "You've read every book on this shelf!")),
      run: async () => {
        const id = await ctx.panel.choose(T('Hangi kitap?', 'Which book?'), unread.map((b) => ({ id: b.id, label: `${L(b.title)} · ${b.author}`, hint: L(b.blurb) })));
        if (!id) return;
        reading.book = id as typeof reading.book; reading.sessions = 0;
        ctx.toast(T(`Ödünç alındı: ${L(BOOKS.find((b) => b.id === id)!.title)}`, `Borrowed: ${L(BOOKS.find((b) => b.id === id)!.title)}`), 'good');
      },
    });
  } else if (reading.sessions < 3) {
    libraryActions.push({
      id: 'read', label: T(`Oku: ${L(book.title)} (${reading.sessions}/3)`, `Read: ${L(book.title)} (${reading.sessions}/3)`),
      hint: T(`${readMinutes(ctx)} dk · −5 enerji · +15 XP`, `${readMinutes(ctx)} min · −5 energy · +15 XP`),
      locked: ctx.st.energy < 8 ? T('Çok yorgunsun.', "You're too tired.") : undefined,
      run: () => {
        nudge(ctx, { loyalty: -1 }); // a book of your own, in the quiet
        reading.sessions++; ctx.advance(readMinutes(ctx)); ctx.gain({ xp: 15, energy: -5, attrs: { knowledge: hasSecret(ctx.st, 'odak') ? 2 : 1 } }); focusTick(ctx, 'study');
        ctx.toast(reading.sessions >= 3 ? T('Kitabı bitirdin! Kütüphaneciyle konuş.', 'You finished the book! Talk to the librarian.') : T(`Okuma ${reading.sessions}/3`, `Reading ${reading.sessions}/3`), 'good');
      },
    });
  } else {
    libraryActions.push({
      id: 'bookchat', label: T(`Kütüphaneciyle sohbet: ${L(book.title)}`, `Book chat with the librarian: ${L(book.title)}`),
      hint: T('Tahmin oyunu · 3 hak · +120 XP', 'Guessing game · 3 tries · +120 XP'),
      run: async () => {
        const r = await ctx.panel.guessScore(L(book.title), T('Nermin Hanım: "Bakalım gerçekten okumuş musun… En sevdiğim bölüm kaçıncı bölüm? (1–10)"', 'Ms. Nermin: "Let\'s see if you really read it… which chapter is my favourite? (1–10)"'), 10, 3);
        ctx.advance(20);
        if (r.ok) {
          reading.finished.push(book.id); reading.book = null; reading.sessions = 0;
          ctx.gain({ xp: 120, attrs: { knowledge: 3 }, mood: 6 });
          ctx.toast(T('İlk kitabın tamam! Okuma listen açıldı.', 'Book complete! Your reading list is open.'), 'good');
        } else {
          ctx.toast(T('Nermin Hanım: "Biraz daha düşün, sonra tekrar gel."', 'Ms. Nermin: "Think it over a bit and come back."'));
        }
      },
    });
  }

  if (ctx.st.favor.stage === 'accepted') {
    const giver = NPCS.find((n) => n.id === ctx.st.favor.giver)!;
    libraryActions.unshift({
      id: 'return', label: T(`${genitiveTr(giver.name)} kitabını iade et`, `Return ${giver.name}'s book`), hint: T('Abi/abla ricası', 'A favor for an older student'),
      run: () => { ctx.st.favor.stage = 'done'; ctx.advance(5); ctx.gain({ xp: 10 }); ctx.toast(T(`Kitap iade edildi. ${dativeTr(giver.name)} haber ver!`, `Book returned. Go tell ${giver.name}!`), 'good'); },
    });
  }

  return libraryActions;
}

export function kutuphane(ctx: GameCtx): PanelView {
  return {
    title: T('Kütüphane', 'Library'), sub: T('Ders kitapları · okuma salonu', 'Textbooks · reading room'), status: status(ctx),
    rooms: [
      { id: 'kutuphane', name: T('Okuma salonu', 'Reading room'), note: T('Kütüphaneci Nermin Hanım: "Sessiz lütfen… ama hoş geldin!"', 'Librarian Ms. Nermin: "Quiet please… but welcome!"'), actions: [...libraryActionsFor(ctx), { id: 'out', label: T('Kütüphaneden çık', 'Leave the library'), run: () => { ctx.panel.close(); } }] },
    ],
  };
}

export function egitim(ctx: GameCtx, mode: 'desk' | 'corridor' = 'corridor'): PanelView {
  const s = ctx.st.school;
  const { day, minutes } = ctx.clock;
  const p = currentPeriod(day, minutes);
  const les = lessonNow(ctx);
  const lessonKey = les?.key ?? '';
  const subject = les?.subject ?? null;
  const tname = subject ? teacherOf(subject) : '';

  let lessonLock: string | undefined = needMission(ctx, 'derse_gir') ?? needRegistration(ctx);
  if (!lessonLock && !s.books) lessonLock = T('Ders kitapların yok. Kütüphane\'den al.', 'You have no textbooks. Get them at the library.');
  if (!lessonLock && !subject) lessonLock = T(`Şu an ders yok. Sıradaki: ${nextOf(ctx, 'lesson')}`, `No lesson right now. Next: ${nextOf(ctx, 'lesson')}`);
  if (!lessonLock && les!.attended) lessonLock = T('Bu derse zaten girdin.', 'You already attended this lesson.');
  if (!lessonLock && subject === 'beden') lessonLock = T(`Beden Eğitimi sahada! ${tname} sınıfı futbol sahasında bekliyor: oraya git ve onunla konuş.`, `PE is outside! ${tname} is waiting with the class on the football pitch: go there and talk to him.`);
  // sick: the teacher won't have you in class; late: not without a slip from the deputy head
  if (!lessonLock && ctx.st.sick) lessonLock = T(`${tname}: "Yüzün bembeyaz, hastasın sen. Seni derse alamam; doğru Revir'e!"`, `${tname}: "You're as white as a sheet, you're ill. I can't have you in class; straight to the infirmary!"`);
  if (!lessonLock && les!.late && !les!.slip) lessonLock = T(`${tname}: "Zil çalalı ${minutes - les!.start} dakika oldu! Önce müdür yardımcısından geç kâğıdı al." (kapıdan koridora çık)`, `${tname}: "The bell rang ${minutes - les!.start} minutes ago! Get a late slip from the deputy head first." (go out to the corridor)`);

  const left = lessonsLeft(ctx.st);
  const missing = SUBJECTS.filter((x) => (s.lessons[x.id] ?? 0) < LESSONS_PER_SUBJECT).map((x) => `${L(x.name)} ${s.lessons[x.id] ?? 0}/${LESSONS_PER_SUBJECT}`);
  const examAction: ActionView = {
    id: 'exam', label: T('Yıl sonu sınavı', 'Year-end exam'), hint: T(`${SUBJECTS.length} soru, her dersten bir tane · %50 ile geçersin · Bilgi puanın yardım eder`, `${SUBJECTS.length} questions, one per subject · 50% to pass · your Knowledge helps`),
    locked: needMission(ctx, 'sinavlar')
      ?? (ctx.st.examPassed ? T('Sınavı geçtin! 🎉', 'You passed! 🎉')
        : left > 0 ? T(`Önce her dersten en az ${LESSONS_PER_SUBJECT} derse gir. Eksikler: ${missing.join(' · ')}`, `Attend at least ${LESSONS_PER_SUBJECT} lessons of every subject first. Still missing: ${missing.join(' · ')}`)
          : p?.kind === 'lesson' ? T('Ders sırasında sınav olmaz.', 'No exams during a lesson.')
            : doneToday(ctx, 'exam') ? T('Bütünleme yarın.', 'The make-up exam is tomorrow.') : undefined),
    run: async () => {
      // one question per subject
      let right = 0;
      for (const [i, sub] of SUBJECTS.entries()) {
        const q = askFor(sub.id, Math.floor(Math.random() * 1000));
        if (await ctx.panel.quiz(T(`Yıl sonu sınavı · ${L(sub.name)}`, `Year-end exam · ${L(sub.name)}`), L(q.q), q.options.map(L), q.answer, `${i + 1}/${SUBJECTS.length}`)) right++;
      }
      const pct = Math.min(100, Math.round((right / SUBJECTS.length) * 100 + ctx.ch.attributes.knowledge / 4 + (hasSecret(ctx.st, 'azim') ? 5 : 0) + (ctx.st.once[`notes-${ctx.st.year}`] ? 5 : 0)));
      ctx.advance(60);
      if (pct >= 50) {
        ctx.st.examPassed = true;
        ctx.gain({ xp: 100, mood: 10, attrs: { knowledge: 2 } });
        await ctx.panel.message(T('Geçtin!', 'You passed!'), T(`${right}/${SUBJECTS.length} doğru · sınav notun: %${pct}. Murat Hoca gülümsüyor: "Aferin!"`, `${right}/${SUBJECTS.length} right · your score: ${pct}%. Mr. Murat smiles: "Well done!"`));
      } else {
        markToday(ctx, 'exam');
        ctx.gain({ mood: -5, energy: -10 });
        await ctx.panel.message(T('Bu sefer olmadı', 'Not this time'), T(`${right}/${SUBJECTS.length} doğru · sınav notun: %${pct}. Üzülme: yarın bütünleme sınavına girebilirsin.`, `${right}/${SUBJECTS.length} right · your score: ${pct}%. Don't worry: you can take the make-up exam tomorrow.`));
      }
    },
  };

  const lessonActions: ActionView[] = [{
    id: 'lesson', label: subject ? T(`Derse gir: ${subjName(subject)}`, `Attend: ${subjName(subject)}`) : T('Derse gir', 'Attend lesson'),
    hint: T('Derste ne yapacağını sen seçersin · −8 enerji · sonunda performans notu alırsın', 'You choose what to do in class · −8 energy · you get a performance mark at the end'),
    locked: lessonLock ?? (ctx.st.energy < 8 ? T('Çok yorgunsun.', "You're too tired.") : undefined),
    run: async () => {
      const sub = subject!;
      const teacher = tname;
      const mates = NPCS.filter((n) => n.kind === 'classmate');
      const mus = ctx.st.music;
      const course = ctx.st.year === 1 && !mus.mandolinDone;
      // a lesson in three moments, with the lesson going on in between (online that's real time, so there's always something to do)
      const marks: MomentResult[] = [];
      const left = () => Math.max(0, p!.end - ctx.clock.minutes);
      const between = async (share: number) => {
        const m = Math.round(left() * share);
        if (m <= 0 || !ctx.panel.isOpen) return;
        const hide = ctx.panel.notice(T('📚 Ders devam ediyor', '📚 The lesson goes on'), lessonFiller(teacher));
        await ctx.pass(m, T(`📚 ${subjName(sub)}`, `📚 ${subjName(sub)}`));
        hide();
      };
      const finish = async () => {
        if (!marks.length) return;
        let score = Math.round(marks.reduce((n, r) => n + r.score, 0) / marks.length);
        if (les!.late) score = Math.max(20, score - 10); // you missed the start
        attendLesson(ctx, les!.key, sub, score);
        ctx.gain({ xp: 10 + marks.reduce((n, r) => n + r.xp, 0), energy: -8 });
        ctx.advance(left(), { wait: true }); // (in class until the bell)
        const parts = marks.map((r) => `${r.title} ${r.score}`).join(' · ');
        const text = T(
          `Performans notu: ${score}/100 (${parts}). Bu derste gösterdiğin performans; ortalaması karnendeki ${subjName(sub)} notunu belirler. ${subjName(sub)}: ${s.lessons[sub]}/${LESSONS_PER_SUBJECT} ders · ödev: akşam etütte.`,
          `Performance mark: ${score}/100 (${parts}). How you did in this lesson; the average becomes your ${subjName(sub)} grade on your report card. ${subjName(sub)}: ${s.lessons[sub]}/${LESSONS_PER_SUBJECT} lessons · homework: at evening study.`);
        if (ctx.panel.isOpen) await ctx.panel.message(T('🔔 Zil çaldı', '🔔 The bell'), text);
        else ctx.toast(text, 'good');
      };
      // late enough that the lesson's nearly over: no opening
      if (left() > 20) {
        const opening = await lessonOpening(ctx, subjName(sub), teacher);
        if (!opening) return;
        marks.push(opening);
        await ctx.panel.message(opening.title, opening.body);
        await between(0.4);
        if (!ctx.panel.isOpen) { await finish(); return; }
      }
      const choice = await ctx.panel.choose(T(`${subjName(sub)} dersi · ${teacher}: ne yapacaksın?`, `${subjName(sub)} with ${teacher}: what will you do?`), [
        // in music lessons the class plays the mandolin (the 4th-grade course: six lessons for the certificate)
        ...(sub === 'muzik' ? [{
          id: 'mandolin', label: course ? T(`🪕 Mandolin çal (kurs: ${mus.mandolin}/${MANDOLIN_LESSONS})`, `🪕 Play the mandolin (course: ${mus.mandolin}/${MANDOLIN_LESSONS})`) : T('🪕 Mandolin çal', '🪕 Play the mandolin'),
          hint: course ? T(`Ritim oyunu · 4. sınıf mandolin kursu, ${MANDOLIN_LESSONS} derste sertifika · iyi çalarsan yüksek performans notu`, `Rhythm game · the 4th-grade mandolin course, a certificate after ${MANDOLIN_LESSONS} lessons · play well for a high performance mark`)
            : T('Ritim oyunu · iyi çalarsan yüksek performans notu · +Yaratıcılık', 'Rhythm game · play well for a high performance mark · +Creativity'),
        }] : []),
        { id: 'answer', label: T('Öğretmenin sorusunu cevapla', "Answer the teacher's question"), hint: T('Dört şıklı bir soru · doğru bilirsen +40 XP ve yüksek performans notu', 'A four-choice question · get it right for +40 XP and a high performance mark') },
        { id: 'notes', label: T('Not al', 'Take notes'), hint: T('+15 XP · +2 Bilgi · güvenli seçim', '+15 XP · +2 Knowledge · the safe choice') },
        { id: 'talk', label: T('Arkadaşınla fısıldaş', 'Whisper with a friend'), hint: T('+8 arkadaşlık · ⚠ öğretmen uyarabilir', '+8 friendship · ⚠ the teacher may warn you') },
        { id: 'tease', label: T('Bir sınıf arkadaşınla dalga geç', 'Make fun of a classmate'), hint: T('Sınıf güler ama o kişi seni sevmez ve intikam alabilir · ⚠ disiplin', "The class laughs, but they won't like you and may get revenge · ⚠ discipline") },
        { id: 'else', label: T('Başka bir şeyle ilgilen', 'Get distracted by something else'), hint: T('Defterine çizim yap · +1 Yaratıcılık · XP yok', 'Doodle in your notebook · +1 Creativity · no XP') },
      ]);
      if (!choice) { await finish(); return; }
      nudge(ctx, LESSON_NUDGE[choice] ?? {});
      focusTick(ctx, choice === 'mandolin' ? 'art' : 'study');
      let score = 50, xp = 0;
      let title = '', body = '';
      const pickMate = async (q: string) => {
        const sorted = [...mates].sort((x, y) => (ctx.st.friends[y.id] ?? 0) - (ctx.st.friends[x.id] ?? 0));
        const id = await ctx.panel.choose(q, sorted.map((n) => ({ id: n.id, label: n.name, hint: `${L(friendLevel(ctx.st.friends[n.id] ?? 0))} · ${Math.round(ctx.st.friends[n.id] ?? 0)}` })));
        return mates.find((n) => n.id === (id ?? sorted[0].id))!;
      };
      if (choice === 'mandolin') {
        const hits = await ctx.panel.rhythm(T(`${teacher} · mandolin`, `${teacher} · mandolin`), T('Bütün sınıf birlikte çalıyor: notalar çizgiye gelince BOŞLUK\'a bas.', 'The whole class plays together: press SPACE as each note crosses the line.'), 8, musicSpeed(ctx, 0.4));
        score = Math.min(100, 30 + hits * 9); xp = 5 + hits * 3;
        ctx.gain({ mood: hits >= 6 ? 5 : 1, attrs: { creativity: hits >= 6 ? 2 : 1 } });
        title = T(`Mandolin · ${hits}/8 nota`, `Mandolin · ${hits}/8 notes`);
        body = hits >= 7 ? T(`${teacher}: "Harika! Bir sonraki derste öne geç, sınıfa sen çal."`, `${teacher}: "Wonderful! Next lesson you come to the front and play for the class."`)
          : hits >= 4 ? T(`${teacher}: "Güzel, parmakların alışıyor. Biraz daha pratik!"`, `${teacher}: "Nice, your fingers are getting used to it. A bit more practice!"`)
            : T(`Teller birbirine karıştı; yanındaki kıkırdadı. ${teacher}: "Olsun, herkes böyle başlar."`, `The strings got tangled and your neighbour giggled. ${teacher}: "Never mind, everyone starts like this."`);
        if (course) {
          mus.mandolin++;
          if (mus.mandolin >= MANDOLIN_LESSONS) {
            mus.mandolinDone = true;
            body += T(` Mandolin kursu bitti! 🎶 ${teacher} sertifikanı verdi: "5. sınıftan itibaren müzik odasında istediğin enstrümanı seçebilirsin."`, ` Mandolin course complete! 🎶 ${teacher} handed you the certificate: "From the 5th grade you can pick any instrument you like in the music room."`);
          } else body += T(` (Mandolin kursu: ${mus.mandolin}/${MANDOLIN_LESSONS})`, ` (Mandolin course: ${mus.mandolin}/${MANDOLIN_LESSONS})`);
        }
      } else if (choice === 'answer') {
        const q = askFor(sub, (s.lessons[sub] ?? 0) + ctx.clock.day);
        const ok = await ctx.panel.quiz(`${teacher} · ${subjName(sub)}`, L(q.q), q.options.map(L), q.answer, T('Parmak kaldırdın…', 'You put your hand up…'));
        if (ok) {
          score = 100; xp = 40;
          ctx.gain({ mood: 6, attrs: { knowledge: 2 } });
          title = T('Doğru cevap!', 'Right answer!'); body = T(`${teacher} seni bütün sınıfın önünde övdü: "Aferin, işte böyle!"`, `${teacher} praised you in front of the whole class: "Well done, that's the way!"`);
        } else {
          score = 45; xp = 5;
          ctx.gain({ mood: -3, attrs: { knowledge: 1 } });
          title = T('Yanlış cevap', 'Wrong answer'); body = T(`Birkaç kişi kıkırdadı. ${teacher}: "Olsun, parmak kaldırman güzel. Doğrusunu şimdi öğrendin."`, `A few kids giggled. ${teacher}: "Never mind, I'm glad you put your hand up. Now you know the answer."`);
        }
      } else if (choice === 'notes') {
        score = 75; xp = 15;
        ctx.gain({ attrs: { knowledge: 2, discipline: 1 } });
        title = T('Notlar', 'Notes'); body = T('Defterin tertemiz notlarla doldu. Sınavda işine yarayacak.', 'Your notebook is full of tidy notes. They\'ll help in the exam.');
      } else if (choice === 'talk') {
        const mate = await pickMate(T('Kiminle fısıldaşacaksın?', 'Whisper with whom?'));
        ctx.befriend(mate.id, 8);
        if (Math.random() < 0.3) {
          score = 40; xp = 0;
          ctx.penalize(2, T(`${teacher}: "${ctx.ch.first}, ${mate.name}, konuşmayı bırakın!"`, `${teacher}: "${ctx.ch.first}, ${mate.name}, stop talking!"`));
          title = T('Yakalandınız', 'Caught'); body = T('Öğretmen ikinizi de uyardı ama en azından güldünüz.', 'The teacher warned you both, but at least you had a laugh.');
        } else {
          score = 55; xp = 5;
          ctx.gain({ mood: 4 });
          title = mate.name; body = T(`${mate.name} ile teneffüs planları yaptınız.`, `You and ${mate.name} made plans for break time.`);
        }
      } else if (choice === 'tease') {
        const mate = await pickMate(T('Kiminle dalga geçeceksin?', 'Make fun of whom?'));
        ctx.befriend(mate.id, -25);
        const laughers = mates.filter((n) => n.id !== mate.id).sort(() => Math.random() - 0.5).slice(0, 2);
        laughers.forEach((n) => ctx.befriend(n.id, 5));
        ctx.gain({ mood: 3 });
        score = 40; xp = 0;
        if (Math.random() < 0.4) ctx.penalize(5, T(`${teacher}: "Arkadaşınla dalga geçmek yok! Disiplin notu alıyorsun."`, `${teacher}: "We don't make fun of classmates! That's a discipline note."`));
        title = T('Sınıf güldü…', 'The class laughed…');
        body = T(`${laughers.map((n) => n.name).join(' ve ')} kahkahayı bastı ama ${mate.name} çok kırıldı. Bunu unutmayacak.`, `${laughers.map((n) => n.name).join(' and ')} burst out laughing, but ${mate.name} was really hurt. They won't forget it.`);
      } else {
        score = 45; xp = 0;
        ctx.gain({ mood: 4, attrs: { creativity: 1 } });
        if (Math.random() < 0.2) ctx.penalize(1, T(`${teacher}: "Pencereden dışarı bakmayı bırak!"`, `${teacher}: "Stop staring out of the window!"`));
        title = T('Hayal dünyası', 'Daydreaming'); body = T('Defterinin kenarına koca bir ejderha çizdin. Dersin yarısı kaçtı.', 'You drew a huge dragon in the margin of your notebook. Half the lesson slipped by.');
      }
      marks.push({ score, xp, title, body });
      await ctx.panel.message(title, body);
      // near the end, something happens in class
      await between(0.5);
      if (ctx.panel.isOpen && left() > 3) {
        const ev = await lessonEvent(ctx, sub, subjName(sub), teacher, choice === 'answer', pickMate);
        if (ev) { marks.push(ev); await ctx.panel.message(ev.title, ev.body); }
      }
      await finish();
    },
  }];
  void lessonKey;

  if (mode === 'desk') {
    return {
      title: T(`Sıran · ${s.classLabel}`, `Your desk · ${s.classLabel}`), sub: 'Eğitim Binası', status: status(ctx),
      rooms: [{
        id: 'sinif', name: T(`Sınıfın (${s.classLabel})`, `Your class (${s.classLabel})`),
        note: subject ? T(`Şimdi ${subjName(subject)} dersi var.`, `${subjName(subject)} is on now.`) : T('Şu an ders yok.', 'No lesson right now.'),
        actions: [...lessonActions, examAction],
      }],
    };
  }

  return {
    title: 'Eğitim Binası', sub: T(`Koridor · ${s.classLabel}`, `Corridor · ${s.classLabel}`), status: status(ctx),
    rooms: [
      {
        id: 'koridor', name: T('Koridor', 'Corridor'),
        note: T('Uzun bir koridor: bir yanda sınıfın, karşıda öğretmenler odası, müdür yardımcısının ve rehber öğretmenin odaları. Kütüphane binanın kuzey kanadında.', 'A long corridor: your classroom on one side; opposite, the teachers\' room and the rooms of the deputy head and the counselor. The library is in the north wing of the building.'),
        actions: [{ id: 'out', label: T('Binadan çık', 'Leave the building'), run: () => { ctx.panel.close(); ctx.leaveDorm(); } }],
      },
      {
        id: 'ogretmenler', name: T('Öğretmenler odası', "Teachers' room"),
        note: T('Sınıf öğretmenin Murat Hoca çayını yudumluyor.', 'Your homeroom teacher, Mr. Murat, is sipping his tea.'),
        actions: [{
          id: 'teacher', label: T('Murat Hoca\'yla konuş', 'Talk to Mr. Murat'), hint: T('10 dk · günde bir', '10 min · once a day'),
          locked: needRegistration(ctx) ?? (doneToday(ctx, 'teacher') ? T('Bugün zaten konuştunuz.', 'You already talked today.') : undefined),
          run: async () => { nudge(ctx, { rules: -1 });
            markToday(ctx, 'teacher'); ctx.advance(10); ctx.gain({ xp: 10, mood: 4 });
            const tips = [
              T('"Ders saatleri sol üstte yazıyor. Kaçırırsan dert etme, yarın yine ders var."', '"Lesson times are shown at the top left. If you miss one, don\'t worry, there\'s more tomorrow."'),
              T('"Ödevlerini akşam etütte yap; etüt 18:00\'de yurdunda başlıyor."', '"Do your homework at evening study; it starts at 18:00 in your dorm."'),
              T('"Yemekleri kaçırma. Aç karnına kimse ders dinleyemez."', '"Don\'t skip meals. Nobody can learn on an empty stomach."'),
            ];
            await ctx.panel.message('Murat Hoca', tips[ctx.clock.day % tips.length]);
          },
        }],
      },
      deputyRoom(ctx),
      rehberRoom(ctx),
      musicRoom(ctx),
      councilRoom(ctx),
      { id: 'lise', name: T('Lise kanadı', 'High school wing'), locked: T('Lise kanadı hazırlık yılında açılır.', 'The high school wing opens in the prep year.'), actions: [] },
    ],
  };
}

/** Beden Eğitimi, out on the football pitch and the basketball court: pick what you join */
export function pePanel(ctx: GameCtx): PanelView {
  const st = ctx.st;
  const les = lessonNow(ctx);
  const tname = TEACHERS.beden.name;
  const mates = NPCS.filter((n) => n.kind === 'classmate');
  const kit = st.wardrobe.wearing === 'esofman';
  const lock = !les || les.subject !== 'beden' ? T('Şu an Beden Eğitimi dersi yok.', 'There is no PE lesson right now.')
    : les.attended ? T('Bu derse zaten girdin. Eğitim Binası\'na dön.', 'You already had this lesson. Head back to the Eğitim Binası.')
      : st.sick ? T(`${tname}: "Hasta hasta koşturamam seni. Doğru Revir'e!"`, `${tname}: "I'm not having you run about ill. Straight to the infirmary!"`)
        : les.late && !les.slip ? T(`${tname}: "${ctx.clock.minutes - les.start} dakika geç kaldın! Müdür yardımcısından geç kâğıdı al, öyle gel." (Eğitim Binası, koridor)`, `${tname}: "You're ${ctx.clock.minutes - les.start} minutes late! Get a late slip from the deputy head, then come back." (Eğitim Binası, corridor)`)
          : st.energy < 10 ? T('Çok yorgunsun.', "You're too tired.") : undefined;
  type Act = { id: string; label: Text; hint: Text; where: Text; play: () => Promise<number> };
  const acts: Act[] = [
    { id: 'futbol', label: { tr: '⚽ Futbol maçı', en: '⚽ A football match' }, where: { tr: 'futbol sahası', en: 'the football pitch' }, hint: { tr: 'Futbol sahasında iki takım · gole vur · +futbol becerisi', en: 'Two teams on the football pitch · shoot at goal · +football skill' },
      play: () => ctx.panel.timing(T('Gole vur!', 'Shoot at goal!'), 4, 0.2 + st.skills.football / 600, 1.3) },
    { id: 'basket', label: { tr: '🏀 Basketbol', en: '🏀 Basketball' }, where: { tr: 'basketbol sahası', en: 'the basketball court' }, hint: { tr: 'Futbol sahasının yanındaki basketbol sahasında · serbest atış · +basketbol becerisi', en: 'On the basketball court beside the pitch · free throws · +basketball skill' },
      play: () => ctx.panel.timing(T('Serbest atış', 'Free throws'), 4, 0.2 + st.skills.basketball / 600, 1.25) },
    { id: 'kosu', label: { tr: '🏃 Koşu ve ısınma', en: '🏃 Running and warm-up' }, where: { tr: 'sahanın çevresi', en: 'round the pitch' }, hint: { tr: 'Sahanın etrafında tur · adımlarını ritme uydur · en çok Kondisyon', en: 'Laps round the pitch · keep your stride in rhythm · the most Fitness' },
      play: () => ctx.panel.rhythm(T('Koşu', 'Running'), T('Her adım çizgiye gelince BOŞLUK\'a bas.', 'Press SPACE as each step crosses the line.'), 8, 0.5) },
    { id: 'yakar', label: { tr: '🔴 Yakar top', en: '🔴 Dodgeball' }, where: { tr: 'futbol sahasının yarısı', en: 'half of the pitch' }, hint: { tr: 'Sahanın yarısında, bütün sınıfla · zamanında eğil · +arkadaşlık', en: 'On half of the pitch with the whole class · duck in time · +friendship' },
      play: () => ctx.panel.timing(T('Topu atla!', 'Dodge the ball!'), 4, 0.24, 1.45) },
  ];
  return {
    title: T('Beden Eğitimi', 'Physical Education'), sub: T(`${tname} · futbol sahası ve basketbol sahası`, `${tname} · the football pitch and the basketball court`), status: status(ctx),
    rooms: [{
      id: 'pe', name: T('Ders', 'Lesson'),
      note: T(`${tname} düdüğünü çaldı: "Herkes toplansın! Bugün dört etkinlik var, hangisine katılacağını seç."${kit ? ' Eşofmanını giymişsin, aferin!' : ' (Eşofmanla gelirsen performansın daha iyi olur.)'}`, `${tname} blew his whistle: "Everyone over here! Four activities today: pick the one you'll join."${kit ? " You're in your tracksuit, good!" : ' (You do better in your tracksuit.)'}`),
      actions: acts.map((a) => ({
        id: a.id, label: L(a.label), hint: L(a.hint), locked: lock,
        run: async () => {
          nudge(ctx, a.id === 'kosu' ? { loyalty: -1, ambition: 1 } : { loyalty: 1 });
          const hits = await a.play();
          const max = a.id === 'kosu' ? 8 : 4;
          const pct = hits / max;
          const score = Math.min(100, Math.round(30 + pct * 60 + (kit ? 10 : 0)));
          // the classmates who joined the same thing
          const team = mates.filter((n) => (n.id.length + a.id.length) % 2 === 0 || a.id === 'yakar').slice(0, a.id === 'yakar' ? 5 : 3);
          team.forEach((n) => ctx.befriend(n.id, a.id === 'yakar' ? 4 : 3));
          if (a.id === 'futbol') st.skills.football = growSkill(st.skills.football, 2 + hits, st.year);
          if (a.id === 'basket') st.skills.basketball = growSkill(st.skills.basketball, 2 + hits, st.year);
          st.health = clamp(st.health + 3);
          ctx.log({ kind: 'pe', a: a.id, b: team.slice(0, 3).map((n) => n.name).join(', ') });
          attendLesson(ctx, les!.key, 'beden', score);
          ctx.gain({ xp: 15 + Math.round(pct * 25), energy: -15, hunger: -10, mood: pct >= 0.5 ? 8 : 2, attrs: { fitness: a.id === 'kosu' ? 3 : 2, social: a.id === 'kosu' ? 0 : 1 } });
          ctx.advance(Math.max(0, les!.end - ctx.clock.minutes), { wait: true }); // (on the pitch until the bell)
          const verdict = pct >= 0.75 ? T(`${tname}: "Harikaydın! Seni takıma düşünüyorum."`, `${tname}: "Brilliant! I'm thinking of you for the team."`)
            : pct >= 0.4 ? T(`${tname}: "Güzel, böyle devam."`, `${tname}: "Good, keep it up."`) : T(`${tname}: "Olsun, terledin ya, o da bir şey."`, `${tname}: "Never mind, you worked up a sweat, that's something."`);
          await ctx.panel.message(L(a.label), `${T(`${L(a.where)[0].toLocaleUpperCase('tr-TR')}${L(a.where).slice(1)}: ${team.map((n) => n.name).join(', ')} ile birlikte.`, `On ${L(a.where)} with ${team.map((n) => n.name).join(', ')}.`)} ${verdict} ${T(`(Performans notu: ${score}/100 · Beden Eğitimi: ${st.school.lessons.beden}/${LESSONS_PER_SUBJECT} ders) Zil çaldı; herkes Eğitim Binası'na dönüyor.`, `(Performance mark: ${score}/100 · PE: ${st.school.lessons.beden}/${LESSONS_PER_SUBJECT} lessons) The bell went; everyone heads back to the Eğitim Binası.`)}`);
          ctx.panel.close();
          ctx.toClass();
        },
      })),
    }],
  };
}

/** a lesson goes into the register: a performance mark, one more of that subject, and homework for the evening */
export function attendLesson(ctx: GameCtx, key: string, sub: keyof typeof TEACHERS, score: number) {
  const s = ctx.st.school;
  if (s.attended.includes(key)) return;
  s.attended.push(key);
  s.scores[sub].push(score);
  s.lessons[sub] = (s.lessons[sub] ?? 0) + 1;
  if (s.homework.length < 3) s.homework.push({ s: sub, day: ctx.clock.day });
  ctx.log({ kind: 'lesson', a: subjName(sub), n: score });
}

/** what's being served right now, if anything */
export function currentMeal(ctx: GameCtx): { meal: MealId; name: string } | null {
  const p = currentPeriod(ctx.clock.day, ctx.clock.minutes);
  return p?.kind === 'meal' && p.meal ? { meal: p.meal, name: L(p.name) } : null;
}

/** why you can't pick up a tray right now (undefined = you can) */
export function trayLock(ctx: GameCtx): string | undefined {
  const m = currentMeal(ctx);
  if (!m) return T(`Servis yok. Sıradaki: ${nextOf(ctx, 'meal')}`, `Not serving right now. Next: ${nextOf(ctx, 'meal')}`);
  if (doneToday(ctx, `meal-${m.meal}`)) return T('Bu öğünü zaten yedin.', 'You already ate this meal.');
  return undefined;
}

export function washHands(ctx: GameCtx) {
  if (doneToday(ctx, 'wash')) { ctx.toast(T('Ellerin zaten temiz. 🧼', 'Your hands are already clean. 🧼')); return; }
  markToday(ctx, 'wash'); ctx.advance(3); ctx.toast(T('Eller tertemiz. 🧼', 'Squeaky clean hands. 🧼'), 'good');
}

/** changes how someone feels about you, and says by how much it really changed (bonuses, and the ±100 ends, included) */
function befriendBy(ctx: GameCtx, id: string, amount: number): number {
  const before = ctx.st.friends[id] ?? 0;
  ctx.befriend(id, amount);
  return (ctx.st.friends[id] ?? 0) - before;
}

/** "Zeynep (+8)", or just the name when nothing changed (already as close as can be) */
const withChange = (name: string, d: number) => (d ? `${name} (${d > 0 ? '+' : '−'}${Math.abs(d)})` : name);

/** you've finished your tray (the scene lets the meal last a while first): you're full, and you got to know the people at your table */
export function eatMeal(ctx: GameCtx, meal: MealId, mealName: string, tablemates: NpcDef[], friendsElsewhere: NpcDef[] = []) {
  markToday(ctx, `meal-${meal}`);
  nudge(ctx, tablemates.length ? { loyalty: 1 } : { presence: -1, loyalty: -1 }); // with friends, or on your own
  if (tablemates.length) focusTick(ctx, 'friends');
  // every meal you eat counts toward "Three Meals", even before that mission opens
  if (!ctx.st.meals.includes(meal)) {
    ctx.st.meals.push(meal);
    const left = (['breakfast', 'lunch', 'dinner'] as const).filter((m) => !ctx.st.meals.includes(m)).length;
    ctx.toast(left
      ? T(`✓ ${mealName} "Üç Öğün" görevine sayıldı (${3 - left}/3)`, `✓ ${mealName} counted for "Three Meals" (${3 - left}/3)`)
      : T('✓ Üç öğünün hepsi tamam!', '✓ All three meals done!'), 'good');
  }
  ctx.st.health = clamp(ctx.st.health + 3);
  ctx.gain({ hunger: 100, mood: 5, xp: 10 });
  // a friend in the hall you didn't sit with feels a little left out
  if (friendsElsewhere.length) {
    const who = friendsElsewhere.map((n) => withChange(n.name, befriendBy(ctx, n.id, -3))).join(', ');
    ctx.toast(T(`${who} başka bir masada oturduğuna biraz bozuldu.`, `${who} ${friendsElsewhere.length > 1 ? 'were' : 'was'} a bit hurt that you sat at another table.`));
  }
  ctx.log({ kind: 'meal', a: mealName, b: tablemates.map((n) => n.name).join(', ') });
  if (tablemates.length) {
    // eating side by side or across from someone brings you a little closer (a friend most of all)
    const who = tablemates.map((n) => withChange(n.name, befriendBy(ctx, n.id, (ctx.st.friends[n.id] ?? 0) >= FRIEND_AT ? 10 : n.kind === 'classmate' ? 8 : 5))).join(', ');
    ctx.toast(T(`💛 Birlikte yediniz: ${who}. Afiyet olsun!`, `💛 You ate together: ${who}. Enjoy!`), 'good');
  } else {
    ctx.toast(T('Afiyet olsun!', 'Enjoy your meal!'), 'good');
  }
}

/** a ceremony at the TIM Gösteri Merkezi you can go to right now (the report card ceremony, an election), or null.
 *  Only then does the guard let you out of Ana Kapı and along the street to TIM's own gate. */
export function timEventNow(ctx: GameCtx): Text | null {
  const st = ctx.st;
  if (!needMission(ctx, 'karne') && !st.yearDone && st.xp >= YEAR1_XP) return { tr: 'Karne töreni', en: 'The report card ceremony' };
  const c = councilNow(ctx);
  const today = ctx.clock.day;
  if (c.stage === 'rep' && today >= c.day) return { tr: 'Sınıflar başkanlık seçimi', en: 'The grade president election' };
  if (c.stage === 'gradePresident' && grade(st.year) === SCHOOL_PRESIDENT_GRADE && c.day > 0 && today >= c.day) return { tr: 'Okul başkanlığı seçimi', en: 'The school president election' };
  return null;
}

/** the TIM Gösteri Merkezi's auditorium: ceremonies and elections */
function konferansRoom(ctx: GameCtx): RoomView {
  return {
    id: 'konferans', name: T('Konferans salonu', 'Auditorium'),
    note: T('Kırmızı koltuklar ve büyük bir sahne. Törenler ve tiyatro gösterileri burada yapılır.', 'Red seats and a big stage. Ceremonies and plays happen here.'),
    actions: [...councilHallActions(ctx), {
      id: 'karne', label: T('Karne törenine katıl', 'Attend the report card ceremony'), hint: T('1. yılın sonu', 'The end of Year 1'),
      locked: needMission(ctx, 'karne') ?? (ctx.st.yearDone ? T('Karneni aldın. 🎓', 'You have your report card. 🎓')
        : ctx.st.xp < YEAR1_XP ? T(`Önce ${YEAR1_XP} XP topla (${ctx.st.xp}/${YEAR1_XP}).`, `Earn ${YEAR1_XP} XP first (${ctx.st.xp}/${YEAR1_XP}).`) : undefined),
      run: async () => {
        // the first party comes straight after the ceremony
        if (!(await runDilemma(ctx, 'parti'))) return;
        ctx.st.yearDone = true; ctx.panel.close(); ctx.yearEnd();
      },
    }],
  };
}

/** TIM Gösteri Merkezi: the round hall with the auditorium */
export function tim(ctx: GameCtx): PanelView {
  return { title: 'TIM Gösteri Merkezi', sub: T('Konferans salonu · sahne', 'Auditorium · stage'), status: status(ctx), rooms: [konferansRoom(ctx)] };
}

/** the afternoon snack at the serving counter, 16:00–17:00 */
function snackRoom(ctx: GameCtx): RoomView {
  const hours = `${fmtTime(SNACK_START)}–${fmtTime(SNACK_END)}`;
  const lock = !isSnackTime(ctx.clock.minutes) ? T(`Ara öğün sadece ${hours} arası verilir.`, `The afternoon snack is only served ${hours}.`)
      : doneToday(ctx, 'snack') ? T('Bugünkü ara öğününü aldın.', "You've had today's snack.") : undefined;
  return {
    id: 'araogun', name: T('Ara öğün', 'Afternoon snack'),
    note: isSnackTime(ctx.clock.minutes)
      ? T('Tezgâhta sıcak poğaçalar ve kekler. Bir tane al.', 'Warm pastries and cakes on the counter. Help yourself to one.')
      : T(`Ara öğün ${hours} arası tezgâhta.`, `The afternoon snack is at the counter ${hours}.`),
    actions: ARA_OGUN.map((k) => ({
      id: `snack-${k.id}`, label: L(k.name), hint: T(`15 dk · +${k.hunger} tokluk · +${k.mood} moral · günde bir`, `15 min · +${k.hunger} fullness · +${k.mood} mood · once a day`),
      locked: lock,
      run: () => {
        markToday(ctx, 'snack');
        ctx.advance(15);
        ctx.gain({ hunger: k.hunger, mood: k.mood });
        ctx.toast(T(`${L(k.name)} · afiyet olsun!`, `${L(k.name)} · enjoy!`), 'good');
      },
    })),
  };
}

/** the snack counter on its own (the serving counter inside the dining hall) */
export function araOgun(ctx: GameCtx): PanelView {
  return { title: T('Ara öğün', 'Afternoon snack'), sub: 'Yemekhane', status: status(ctx), rooms: [snackRoom(ctx)] };
}

/** Şakir Abi and Cemil Emmi keep their trust in `friends` under these ids */
const SAKIR = 'sakir';
const CEMIL = 'cemil';

/** Şakir Abi behind the counter: he gets to know the regulars (every purchase counts) */
function sakirActions(ctx: GameCtx): ActionView[] {
  const f = Math.round(ctx.st.friends[SAKIR] ?? 0);
  const once = (key: string) => (doneToday(ctx, `${key}-sakir`) ? T('Bugün zaten yaptın.', 'Already done today.') : undefined);
  const mark = (key: string) => markToday(ctx, `${key}-sakir`);
  const say = (tr: string, en: string) => ctx.panel.message('Şakir Abi', T(tr, en));
  return gate([
    {
      id: 'banter', label: T(`🗣️ Şakir Abi'yle laflaş · ${trustLine(f)}`, `🗣️ Chat with Şakir · ${trustLine(f)}`), hint: T('5 dk · +4 güven · günde bir · aldığın her şey de güvenini artırır', '5 min · +4 trust · once a day · everything you buy counts too'),
      locked: once('banter'),
      run: async () => {
        mark('banter'); ctx.advance(5); ctx.befriend(SAKIR, 4); ctx.gain({ mood: 2 });
        await say('"Maç kaç kaç bitti, duydun mu? Ben radyodan dinledim." Tezgâhı silerken anlattı da anlattı.', '"Did you hear the score last night? I listened on the radio." He went on and on while wiping the counter.');
      },
    },
    {
      id: 'onthehouse', label: T('🫖 "Bir çay, bir simit… benden"', '🫖 "Tea and a simit, on me"'), hint: T('Bedava · +15 tokluk · +5 moral · günde bir', 'Free · +15 fullness · +5 mood · once a day'),
      locked: once('treat'),
      run: async () => {
        mark('treat'); ctx.gain({ hunger: 15, mood: 5 });
        await say('"Otur bakalım şöyle. Para mara istemem, sen benim müdavimimsin."', '"Sit yourself down. I don\'t want your money; you\'re one of my regulars."');
      },
    },
    {
      id: 'counter', label: T('🧺 Tezgâhta yardım et', '🧺 Help behind the counter'), hint: T('30 dk · +10 ₺ · +3 güven · günde bir', '30 min · +10 ₺ · +3 trust · once a day'),
      locked: once('counter') ?? (ctx.st.energy < 10 ? T('Çok yorgunsun.', "You're too tired.") : undefined),
      run: async () => {
        mark('counter'); nudge(ctx, { warmth: -1, ambition: 1 }); ctx.advance(30); ctx.befriend(SAKIR, 3); ctx.gain({ money: 10, energy: -6, xp: 5 });
        await say('Teneffüs kalabalığında simitleri sen uzattın, bozukları o saydı. "Al bakalım, alın terinin hakkı." +10 ₺', 'In the break-time rush you handed out the simits while he counted the change. "Here you go, you earned it." +10 ₺');
      },
    },
  ], f, 'adult');
}

/** Şakir Abi's canteen, inside the Spor Salonu */
/** an abi or abla sent you for a soda: buy it here (with their money) */
function errandAtKantin(ctx: GameCtx, open: boolean): ActionView[] {
  const e = ctx.st.errand;
  if (e.stage !== 'fetch' || !e.giver) return [];
  const g = NPCS.find((n) => n.id === e.giver)?.name ?? '';
  return [{
    id: 'errand-buy', label: T(`🥤 ${g} için gazoz al`, `🥤 Buy a soda for ${g}`), hint: T('Onun parasıyla', 'With their money'),
    locked: open ? undefined : T('Kantin kapalı (08:00–18:00).', 'The canteen is closed (08:00–18:00).'),
    run: () => {
      e.stage = 'got';
      ctx.advance(5);
      ctx.befriend(SAKIR, 1);
      ctx.toast(T(`🥤 Gazoz elinde. Şimdi ${g}'a götür.`, `🥤 You've got the soda. Now take it to ${g}.`), 'good');
    },
  }];
}

function kantinRoom(ctx: GameCtx): RoomView {
  const minutes = ctx.clock.minutes;
  const kantinOpen = minutes >= 8 * 60 && minutes < 18 * 60;
  const bag = ctx.st.food.bag;
  return {
    id: 'kantin', name: T('Şakir Abi\'nin Kantini', "Şakir's canteen"),
    note: kantinOpen
      ? T(`Şakir Abi: "Ne alırsın evlat?" · Cebinde ${ctx.st.money} ₺ · telefon kartın ${ctx.st.phoneUnits} kontör · cebindeki atıştırmalıklar: ${bag.length}/${BAG_MAX}`, `Şakir: "What'll it be, kid?" · You have ${ctx.st.money} ₺ · ${ctx.st.phoneUnits} phone units · snacks in your pockets: ${bag.length}/${BAG_MAX}`)
      : T('Kantin kapalı (08:00–18:00).', 'The canteen is closed (08:00–18:00).'),
    actions: [
      ...visitActions(ctx),
      ...errandAtKantin(ctx, kantinOpen),
      ...(kantinOpen ? sakirActions(ctx) : []),
      ...KANTIN.map((k) => ({
        id: k.id, label: `${L(k.name)} · ${price(ctx, k.price)} ₺`, hint: T(`Sıcak, hemen yenir · +${k.hunger} tokluk · +${k.mood} moral`, `Hot, eaten on the spot · +${k.hunger} fullness · +${k.mood} mood`),
        locked: !kantinOpen ? T('Kapalı', 'Closed') : ctx.st.money < price(ctx, k.price) ? T('Paran yetmiyor.', "You can't afford it.") : undefined,
        run: () => {
          ctx.gain({ money: -price(ctx, k.price), hunger: k.hunger, mood: k.mood });
          ctx.befriend(SAKIR, 1);
          ctx.advance(10);
          ctx.toast(T(`${L(k.name)} · afiyet olsun!`, `${L(k.name)} · enjoy!`));
        },
      })),
      ...KANTIN_SNACKS.map((k) => {
        const sn = snackById(k.id)!;
        return {
          id: `snack-${k.id}`, label: `${L(sn.name)} · ${price(ctx, k.price)} ₺`, hint: T(`Atıştırmalık: hemen ye ya da dolabına götür · +${sn.hunger} tokluk · +${sn.mood} moral`, `A snack: eat it now or take it to your locker · +${sn.hunger} fullness · +${sn.mood} mood`),
          locked: !kantinOpen ? T('Kapalı', 'Closed') : ctx.st.money < price(ctx, k.price) ? T('Paran yetmiyor.', "You can't afford it.") : undefined,
          run: async () => {
            const what = await ctx.panel.choose(T(`${L(sn.name)}: ne yapacaksın?`, `${L(sn.name)}: what will you do with it?`), [
              { id: 'eat', label: T('😋 Hemen ye', '😋 Eat it now'), hint: T(`+${sn.hunger} tokluk · +${sn.mood} moral`, `+${sn.hunger} fullness · +${sn.mood} mood`) },
              { id: 'keep', label: T('🎒 Cebine koy, dolabına götür', '🎒 Pocket it and take it to your locker'), hint: bag.length >= BAG_MAX ? T('Ceplerin dolu!', 'Your pockets are full!') : T(`Cebinde ${bag.length}/${BAG_MAX} · sonra dolabında saklar ya da yersin`, `${bag.length}/${BAG_MAX} in your pockets · keep it in your locker or eat it later`) },
            ]);
            if (!what) return;
            if (what === 'keep' && !pocket(ctx, k.id)) { ctx.toast(T('Ceplerin dolu. Önce dolabına bırak ya da ye.', 'Your pockets are full. Put some in your locker or eat them first.')); return; }
            ctx.gain({ money: -price(ctx, k.price) });
            ctx.befriend(SAKIR, 1);
            if (what === 'eat') { ctx.gain({ hunger: sn.hunger, mood: sn.mood }); ctx.advance(5); ctx.toast(T(`${L(sn.name)} · afiyet olsun!`, `${L(sn.name)} · enjoy!`)); }
            else ctx.toast(T(`${L(sn.name)} cebinde. Dolabına koyabilirsin.`, `${L(sn.name)} is in your pocket. You can put it in your locker.`), 'good');
          },
        };
      }),
      {
        id: 'hangout', label: T('☕ Masada takıl', '☕ Hang out at a table'), hint: T('30 dk · +6 moral · arkadaşlık · günde bir', '30 min · +6 mood · friendship · once a day'),
        locked: !kantinOpen ? T('Kapalı', 'Closed') : doneToday(ctx, 'hangout') ? T('Bugün kantinde yeterince takıldın.', "You've hung out at the canteen enough today.") : undefined,
        run: async () => { nudge(ctx, { loyalty: 1 }); focusTick(ctx, 'friends');
          markToday(ctx, 'hangout');
          // (online you really spend the half hour there, counted down)
          ctx.advance(30, { wait: true, label: T('☕ Kantinde takılıyorsun', '☕ Hanging out at the canteen') });
          const social = Math.random() < 0.4 ? 1 : 0;
          ctx.gain({ mood: 6, attrs: { social } });
          // whoever likes you most of those who might drop by sits down with you (now and then someone new)
          const pals = NPCS.filter((n) => n.kind === 'classmate' || n.kind === 'student' || n.kind === 'abi').sort(() => Math.random() - 0.5);
          const known = pals.filter((n) => (ctx.st.friends[n.id] ?? 0) > 0).sort((x, y) => (ctx.st.friends[y.id] ?? 0) - (ctx.st.friends[x.id] ?? 0));
          const pal = known.length && Math.random() < 0.8 ? known[Math.floor(Math.random() * Math.min(3, known.length))] : pals[0];
          const before = pal ? ctx.st.friends[pal.id] ?? 0 : 0;
          if (pal) ctx.befriend(pal.id, 5);
          const won = pal ? (ctx.st.friends[pal.id] ?? 0) - before : 0;
          const topics = [T('dünkü maçı', "yesterday's match"), T('yaklaşan sınavları', 'the coming exams'), T('yatakhanedeki son dedikoduyu', 'the latest dorm gossip'), T('Şakir Abi\'nin yeni tostunu', "Şakir's new toastie"), T('hafta sonu planlarını', 'weekend plans')];
          const topic = topics[Math.floor(Math.random() * topics.length)];
          const gains = [T('+6 moral', '+6 mood'), ...(social ? [T('+1 Sosyallik', '+1 Social')] : []), ...(pal && won ? [T(`${pal.name} ile +${won} arkadaşlık`, `+${won} friendship with ${pal.name}`)] : [])].join(' · ');
          await ctx.panel.message(T('☕ Kantinde', '☕ At the canteen'), pal
            ? T(`Bir çay alıp köşedeki masaya oturdun. Az sonra ${pal.name} de geldi; ${topic} konuştunuz, Şakir Abi de araya girip birkaç espri yaptı. ✨ ${gains}`, `You got a tea and sat at the corner table. Soon ${pal.name} came over; you talked about ${topic}, and Şakir chipped in with a few jokes. ✨ ${gains}`)
            : T(`Bir çay alıp köşedeki masaya oturdun ve kantinin kalabalığını izledin. ✨ ${gains}`, `You got a tea, sat at the corner table and watched the busy canteen. ✨ ${gains}`));
        },
      },
      {
        id: 'phonecard', label: T(`☎️ Telefon kartı · ${price(ctx, PHONE_CARD.price)} ₺`, `☎️ Phone card · ${price(ctx, PHONE_CARD.price)} ₺`), hint: T(`${PHONE_CARD.units} kontör · yurttaki ankesörlü telefon için`, `${PHONE_CARD.units} units · for the payphone in your dorm`),
        locked: !kantinOpen ? T('Kapalı', 'Closed') : ctx.st.money < price(ctx, PHONE_CARD.price) ? T('Paran yetmiyor.', "You can't afford it.") : undefined,
        run: () => { ctx.gain({ money: -price(ctx, PHONE_CARD.price) }); ctx.st.phoneUnits += PHONE_CARD.units; ctx.toast(T(`Telefon kartı aldın: ${ctx.st.phoneUnits} kontör.`, `Phone card bought: ${ctx.st.phoneUnits} units.`), 'good'); },
      },
    ],
  };
}

function terraceRoom(ctx: GameCtx): RoomView {
  return {
    id: 'teras', name: T('Çatı terası', 'Roof terrace'),
    note: T('Buradan bütün kampüs görünüyor.', 'You can see the whole campus from up here.'),
    actions: [{
      id: 'view', label: T('Manzarayı izle', 'Enjoy the view'), hint: T('15 dk · +8 moral (günde bir)', '15 min · +8 mood (once a day)'),
      locked: doneToday(ctx, 'terrace') ? T('Bugün zaten çıktın.', 'You were already up here today.') : undefined,
      run: () => { nudge(ctx, { presence: -1 }); markToday(ctx, 'terrace'); ctx.advance(15); ctx.gain({ mood: 8 }); ctx.toast(T('Rüzgâr yüzüne çarpıyor. İyi geldi.', 'The breeze feels good.'), 'good'); },
    }],
  };
}

/** the dining hall's door, from inside: out to the campus, the snack counter, the stairs up to the roof terrace */
export function yemekhane(ctx: GameCtx): PanelView {
  return {
    title: 'Yemekhane', sub: T('Yemekhane & Sosyal Merkez', 'Dining hall & social center'), status: status(ctx),
    rooms: [
      { id: 'cikis', name: T('Çıkış', 'Exit'), note: T('Merdivenler çatı terasına çıkıyor.', 'The stairs lead up to the roof terrace.'), actions: [{ id: 'out', label: T('Dışarı çık', 'Go outside'), run: () => { ctx.panel.close(); ctx.leaveDorm(); } }] },
      snackRoom(ctx),
      terraceRoom(ctx),
    ],
  };
}

/** at the dining hall's door when nothing is being served: the hall is shut, the outside stairs still go up to the terrace */
export function yemekhaneClosed(ctx: GameCtx): PanelView {
  return {
    title: 'Yemekhane', sub: T('Şu an kapalı', 'Closed right now'), status: status(ctx),
    rooms: [
      { id: 'kapali', name: T('Kapı', 'Door'), note: T(`Yemekhane yalnızca öğün saatlerinde açık: kahvaltı 07:00–08:30, öğle 12:20–13:30, ara öğün 16:00–17:00, akşam 17:00–18:00. Sıradaki: ${nextOf(ctx, 'meal')}.`, `The dining hall is only open at mealtimes: breakfast 07:00–08:30, lunch 12:20–13:30, snack 16:00–17:00, dinner 17:00–18:00. Next: ${nextOf(ctx, 'meal')}.`), actions: [] },
      terraceRoom(ctx),
    ],
  };
}

// ---------------- inside your dorm (walkable room) ----------------

const belletmenName = (ctx: GameCtx) => (ctx.ch.gender === 'girl' ? 'Ayşe Hoca' : 'Ercan Hoca');
const dormTitle = (ctx: GameCtx) => (ctx.ch.gender === 'girl' ? T('Kız Yurdu', "Girls' Dorm") : T('Erkek Yurdu', "Boys' Dorm"));

/** your desk in the study room: homework, reading, drawing */
export function deskPanel(ctx: GameCtx): PanelView {
  const st = ctx.st;
  const phase = phaseOf(ctx.clock.minutes, ctx.clock.day);
  const hw = st.school.homework[0];
  const book = BOOKS.find((b) => b.id === st.reading.book);
  return {
    title: T('Masan', 'Your desk'), sub: `${dormTitle(ctx)} · ${T('Etüt salonu', 'Study room')}`, status: status(ctx),
    rooms: [{
      id: 'desk', name: T('Masan', 'Your desk'),
      note: phase === 'etut'
        ? T(`Etüt 20:00'de bitiyor (${20 * 60 - ctx.clock.minutes} dk).${st.school.homework.length ? ` Bekleyen ödev: ${st.school.homework.map((h) => subjName(h.s)).join(', ')}.` : ' Ödevin yok.'}`, `Study time ends at 20:00 (${20 * 60 - ctx.clock.minutes} min).${st.school.homework.length ? ` Homework due: ${st.school.homework.map((h) => subjName(h.s)).join(', ')}.` : ' No homework due.'}`)
        : T('Defterlerin ve kalemlerin burada.', 'Your notebooks and pencils are here.'),
      actions: [
        {
          id: 'focus', label: st.focus ? `🎯 ${T('Dönem odağı', 'Term focus')}: ${focusLine(st)}` : T('🎯 Dönem odağını seç', '🎯 Choose your term focus'),
          hint: st.focus ? T('Değiştirebilirsin; o hedefteki ilerlemen sıfırlanır', "You can change it; you'll lose your progress towards its goal") : T('Bir alana odaklan: o alan daha hızlı gelişir', 'Focus on one area: it grows faster'),
          run: async () => { await chooseFocus(ctx); },
        },
        {
          id: 'homework', label: hw ? T(`Ödev yap: ${subjName(hw.s)}`, `Do homework: ${subjName(hw.s)}`) : T('Ödev yap', 'Do homework'),
          hint: T('Tahmin oyunu · 30 dk · −6 enerji · notun ve disiplinin için iyi', 'Guessing game · 30 min · −6 energy · good for grades and discipline'),
          locked: !hw ? T('Bekleyen ödevin yok. 🎉', 'No homework due. 🎉') : phase === 'night' ? T('Işıklar söndü.', 'Lights are out.') : sickLock(ctx),
          run: async () => { nudge(ctx, { rules: -1, ambition: 1 }); focusTick(ctx, 'study');
            const r = await ctx.panel.guessScore(T(`Ödev: ${subjName(hw.s)}`, `Homework: ${subjName(hw.s)}`), T(`Cevap 1 ile 20 arasında bir sayı. İpuçlarını takip et: ${homeworkTries(ctx)} hakkın var.`, `The answer is a number from 1 to 20. Follow the hints: you have ${homeworkTries(ctx)} tries.`), 20, homeworkTries(ctx));
            const score = Math.min(100, (r.ok ? [100, 85, 70, 55][r.used - 1] : 30) + Math.round(ctx.ch.attributes.knowledge / 4));
            st.school.homework.shift();
            st.school.scores[hw.s].push(score);
            ctx.advance(30);
            ctx.gain({ xp: 10 + Math.round(score / 5), energy: -6, mood: -2, attrs: { discipline: 1, knowledge: hasSecret(st, 'odak') ? 1 : 0 } });
            ctx.toast(T('Ödev bitti. Yarın öğretmenin memnun olacak.', 'Homework done. Your teacher will be pleased tomorrow.'), 'good');
          },
        },
        {
          id: 'read', label: book ? T(`Kitap oku: ${L(book.title)} (${st.reading.sessions}/3)`, `Read: ${L(book.title)} (${st.reading.sessions}/3)`) : T('Kitap oku', 'Read a book'),
          hint: T(`${readMinutes(ctx)} dk · +1 Bilgi · −5 enerji`, `${readMinutes(ctx)} min · +1 Knowledge · −5 energy`),
          locked: !book ? T('Okuyacak kitabın yok. Kütüphane\'den ödünç al.', 'You have no book. Borrow one from the library.') : st.reading.sessions >= 3 ? T('Kitabı bitirdin; kütüphaneciyle konuş.', 'You finished it; talk to the librarian.') : undefined,
          run: () => {
            st.reading.sessions++; ctx.advance(readMinutes(ctx)); ctx.gain({ xp: 15, energy: -5, attrs: { knowledge: hasSecret(ctx.st, 'odak') ? 2 : 1 } }); focusTick(ctx, 'study');
            ctx.toast(T(`Okuma ${st.reading.sessions}/3`, `Reading ${st.reading.sessions}/3`), 'good');
          },
        },
        ...(phase === 'etut' ? [{
          id: 'idle', label: T('⏳ Vakit öldür', '⏳ Kill time'),
          hint: T(`Kalemini çevir, tavana bak: etüt bitene kadar zaman hızla geçer (${PLAZA_START - ctx.clock.minutes} dk) · hiçbir faydası yok`, `Twirl your pencil, stare at the ceiling: time flies until study ends (${PLAZA_START - ctx.clock.minutes} min) · no benefit at all`),
          run: () => { nudge(ctx, { ambition: -1 }); ctx.panel.close(); ctx.killTime(PLAZA_START); },
        } as ActionView] : []),
        {
          id: 'create', label: T('Yaratıcı ol: resim çiz, hikâye yaz', 'Get creative: draw, write a story'),
          hint: T(`40 dk · +2 Yaratıcılık · +${5 + Math.round(ctx.ch.attributes.creativity / 10)} moral · günde bir`, `40 min · +2 Creativity · +${5 + Math.round(ctx.ch.attributes.creativity / 10)} mood · once a day`),
          locked: doneToday(ctx, 'create') ? T('Bugünkü resmini çizdin, hikâyeni yazdın. Yarın yeni bir fikirle gel.', "You've done today's drawing and story. Come back tomorrow with a new idea.") : undefined,
          run: () => { markToday(ctx, 'create'); nudge(ctx, { presence: -1 }); focusTick(ctx, 'art');
            ctx.advance(40); ctx.gain({ mood: 5 + Math.round(ctx.ch.attributes.creativity / 10), energy: -4, xp: 10, attrs: { creativity: hasPerk(ctx.st, 'ustaEller') ? 3 : 2 } });
            const ideas = [T('Okulun 1863\'teki hâlini çizdin.', 'You drew the school as it looked in 1863.'), T('Gece kaçan bir öğrenci hakkında bir hikâye yazdın.', 'You wrote a story about a student who sneaks out at night.'), T('Bölümün için bir bayrak tasarladın.', 'You designed a flag for your dorm section.')];
            ctx.toast(ideas[ctx.clock.day % ideas.length], 'good');
          },
        },
      ],
    }],
  };
}

/** a classmate at their desk during study time */
export function matePanel(npc: NpcDef, ctx: GameCtx): PanelView {
  const st = ctx.st;
  const f = Math.round(st.friends[npc.id] ?? 0);
  const near = ctx.beltNear();
  const belId = ctx.ch.gender === 'girl' ? 'bel-hatice' : 'bel-mehmet';
  const strict = (st.friends[belId] ?? 0) <= -20 ? 0.1 : 0; // a belletmen you've annoyed watches you closely
  const risk = (base: number) => base + strict + (near ? 0.25 : 0);
  const bel = belletmenName(ctx);
  const hw = st.school.homework[0];
  return {
    title: npc.name, sub: `${L(npc.role)} · ${L(friendLevel(f))} ${f}/100`, status: status(ctx), profile: profileFor(npc, ctx, !!ctx.st.once[`met-${npc.id}`]),
    rooms: [{
      id: 'mate', name: npc.name,
      note: near ? T(`⚠ ${bel} hemen yakınında!`, `⚠ ${bel} is right nearby!`) : T(`${npc.name} defterine bir şeyler karalıyor.`, `${npc.name} is scribbling in a notebook.`),
      actions: [
        {
          id: 'whisper', label: T('Fısıldaş', 'Whisper'), hint: T(`10 dk · +10 arkadaşlık · yakalanma riski %${Math.round(risk(0.1) * 100)}`, `10 min · +10 friendship · ${Math.round(risk(0.1) * 100)}% chance of getting caught`),
          run: async () => { nudge(ctx, { rules: 1, loyalty: 1 });
            ctx.advance(10);
            ctx.befriend(npc.id, 10);
            if (Math.random() < risk(0.1)) ctx.penalize(2, T(`${bel}: "Etütte konuşma yok!"`, `${bel}: "No talking during study time!"`));
            else await ctx.panel.message(npc.name, `"${L(lineNow(npc, ctx))}"`);
          },
        },
        {
          id: 'play', label: T('Gizlice oyun oyna', 'Play a game on the sly'), hint: T(`45 dk · +10 moral · +15 arkadaşlık · yakalanma riski %${Math.round(risk(0.3) * 100)}`, `45 min · +10 mood · +15 friendship · ${Math.round(risk(0.3) * 100)}% chance of getting caught`),
          run: async () => { nudge(ctx, { rules: 2, loyalty: 1 });
            ctx.advance(45);
            ctx.befriend(npc.id, 15);
            ctx.gain({ mood: 10, energy: -6, attrs: { social: 1 } });
            if (Math.random() < risk(0.3)) { ctx.penalize(5, T(`${bel} sizi yakaladı: "Etütte oyun olmaz!"`, `${bel} caught you: "No games during study time!"`)); ctx.gain({ mood: -6 }); }
            else await ctx.panel.message(T('Gizli turnuva', 'Secret tournament'), T(`${npc.name} ile sıranın altında taş-kâğıt-makas oynadınız. Kimse fark etmedi!`, `You played rock-paper-scissors under the desk with ${npc.name}. Nobody noticed!`));
          },
        },
        {
          id: 'help', label: T('Ödevde yardım iste', 'Ask for help with homework'), hint: T('Arkadaşınsa ödevin birlikte biter (+iyi not)', 'If you\'re friends, you finish your homework together (good score)'),
          locked: !hw ? T('Bekleyen ödevin yok.', 'No homework due.') : f < FRIEND_AT ? T(`${npc.name} henüz yakın arkadaşın değil.`, `${npc.name} isn't a close enough friend yet.`) : undefined,
          run: () => { nudge(ctx, { heart: 1, loyalty: 1 });
            st.school.homework.shift();
            st.school.scores[hw.s].push(85);
            ctx.advance(35);
            ctx.befriend(npc.id, 5);
            ctx.gain({ xp: 25, energy: -4, attrs: { knowledge: 1 } });
            ctx.toast(T(`${npc.name} ile ${subjName(hw.s)} ödevini birlikte bitirdiniz.`, `You and ${npc.name} finished the ${subjName(hw.s)} homework together.`), 'good');
          },
        },
      ],
    }],
  };
}

export function bedPanel(ctx: GameCtx): PanelView {
  const st = ctx.st;
  const m = ctx.clock.minutes;
  const phase = phaseOf(m, ctx.clock.day);
  return {
    title: T('Yatağın', 'Your bed'), sub: dormAddress(ctx), status: status(ctx),
    rooms: [{
      id: 'bed', name: T('Yatağın', 'Your bed'),
      note: !st.once.luggage ? T(`Belletmen ${belletmenName(ctx)}: "Hoş geldin! Yatağın burası, cam kenarında. Bavulunu yatağa değil dolabına yerleştir: dolabın şurada, yatakhanenin alt duvarında."`, `${belletmenName(ctx)}: "Welcome! This is your bed, by the window. Your suitcase doesn't go on the bed, it goes in your locker: over there, along the bottom wall of the sleeping room."`)
        : phase === 'night' ? T('Işıklar söndü. Herkes uyuyor…', 'Lights are out. Everyone is asleep…') : T('Battaniyen düzgünce katlanmış.', 'Your blanket is neatly folded.'),
      actions: [{
        id: 'sleep', label: phase === 'etut' ? T('Erkenden uyu', 'Go to bed early') : T('Uyu', 'Sleep'),
        hint: phase === 'etut' ? T('Enerji dolar · ⚠ yapılmamış ödevler sabah ceza getirir', 'Restores energy · ⚠ undone homework is penalised in the morning') : T('Sabah 07:00\'ye kadar', 'Until 07:00'),
        locked: m >= 18 * 60 || m < 7 * 60 || st.energy < 30 ? undefined : T('Uyumak için erken (18:00\'den sonra ya da çok yorgunken).', 'Too early to sleep (after 18:00, or when very tired).'),
        run: () => { ctx.panel.close(); ctx.sleep(); },
      }],
    }],
  };
}

export function lockerPanel(ctx: GameCtx): PanelView {
  const st = ctx.st;
  const w = st.wardrobe;
  if (!st.once.luggage) {
    return {
      title: T('Dolabın', 'Your locker'), sub: dormAddress(ctx), status: status(ctx),
      rooms: [{
        id: 'locker', name: T('Dolabın', 'Your locker'),
        note: T('Boş, temiz bir dolap: üstünde adın yazıyor. Bavulundakiler buraya yerleşecek.', 'An empty, clean locker with your name on it. Everything in your suitcase goes in here.'),
        actions: [{
          id: 'luggage', label: T('🧳 Bavulunu dolabına yerleştir', '🧳 Unpack your suitcase into your locker'), hint: T('10 dk', '10 min'),
          run: () => { st.once.luggage = true; ctx.advance(10); ctx.gain({ xp: 10, mood: 5 }); ctx.toast(T('Bavulun dolabına yerleşti: kıyafetlerin askıda, boş bavul dolabın üstünde.', 'Suitcase unpacked: your clothes are on the hangers, the empty case on top of the locker.'), 'good'); },
        }],
      }],
    };
  }
  const wearName = w.wearing === BORROWED && w.borrowed ? T(`${genitiveTr(NPCS.find((n) => n.id === w.borrowed!.from)?.name ?? '?')} ${w.borrowed.name}`, w.borrowed.name) : L((outfitById(w.wearing) ?? outfitById('sivil')!).name);
  const clothes: ActionView[] = ownedOutfits(st).map((o) => ({
    id: `wear-${o.id}`, label: `${w.wearing === o.id ? '✓ ' : ''}${L(o.name)}`, hint: L(o.desc), look: lookIn(ctx, o),
    locked: w.wearing === o.id ? T('Üzerinde.', "You're wearing it.") : undefined,
    run: () => {
      w.wearing = o.id;
      ctx.dress();
      ctx.advance(5);
      ctx.toast(T(`Üzerini değiştirdin: ${L(o.name)}.`, `You got changed: ${L(o.name)}.`), 'good');
    },
  }));
  if (w.borrowed) {
    const from = NPCS.find((n) => n.id === w.borrowed!.from);
    clothes.push({
      id: 'wear-loan', label: `${w.wearing === BORROWED ? '✓ ' : ''}${T(`Ödünç: ${genitiveTr(from?.name ?? '?')} ${w.borrowed.name}`, `Borrowed: ${from?.name ?? '?'}'s ${w.borrowed.name}`)}`,
      hint: T('Yarın sabah geri vereceksin.', 'You give it back tomorrow morning.'), look: lookIn(ctx, w.borrowed),
      locked: w.wearing === BORROWED ? T('Üzerinde.', "You're wearing it.") : undefined,
      run: () => { w.wearing = BORROWED; ctx.dress(); ctx.advance(5); },
    });
  }
  const { bag, locker } = st.food;
  const eat = (from: string[], i: number) => {
    const sn = snackById(from[i]);
    from.splice(i, 1);
    if (!sn) return;
    ctx.gain({ hunger: sn.hunger, mood: sn.mood });
    ctx.advance(5);
    ctx.toast(T(`${L(sn.name)} · afiyet olsun!`, `${L(sn.name)} · enjoy!`), 'good');
  };
  const food: ActionView[] = [];
  if (bag.length) {
    food.push({
      id: 'stash', label: T(`🎒 Cebindekileri dolaba koy (${bag.length})`, `🎒 Put what's in your pockets in the locker (${bag.length})`), hint: bag.map((id) => L(snackById(id)?.name ?? { tr: id, en: id })).join(', '),
      locked: locker.length >= LOCKER_MAX ? T('Dolabında yer kalmadı.', 'There is no room left in your locker.') : undefined,
      run: () => { while (bag.length && locker.length < LOCKER_MAX) locker.push(bag.shift()!); ctx.toast(T('Atıştırmalıkların dolabında, kıyafetlerinin yanında.', 'Your snacks are in the locker, next to your clothes.'), 'good'); },
    });
  }
  locker.forEach((id, i) => {
    const sn = snackById(id);
    if (sn) food.push({ id: `eat-l${i}`, label: T(`😋 Ye: ${L(sn.name)}`, `😋 Eat: ${L(sn.name)}`), hint: T(`Dolabında · +${sn.hunger} tokluk · +${sn.mood} moral`, `In your locker · +${sn.hunger} fullness · +${sn.mood} mood`), run: () => eat(locker, i) });
  });
  bag.forEach((id, i) => {
    const sn = snackById(id);
    if (sn) food.push({ id: `eat-b${i}`, label: T(`😋 Ye: ${L(sn.name)}`, `😋 Eat: ${L(sn.name)}`), hint: T(`Cebinde · +${sn.hunger} tokluk · +${sn.mood} moral`, `In your pocket · +${sn.hunger} fullness · +${sn.mood} mood`), run: () => eat(bag, i) });
  });
  return {
    title: T('Dolabın', 'Your locker'), sub: dormAddress(ctx), status: status(ctx),
    rooms: [
      {
        id: 'locker', name: T(`Kıyafetler (${clothes.length})`, `Clothes (${clothes.length})`),
        note: st.school.kit
          ? T(`Askıda kıyafetlerin, alt rafta ayakkabıların. Şu an üzerinde: ${wearName}.`, `Your clothes on the hangers, your shoes on the bottom shelf. You're wearing: ${wearName}.`)
          : T(`Şimdilik yalnızca evden geldiğin kıyafetler var. Üniforman, montun, eşofmanın ve pijaman Spor Salonu'ndaki depodan gelecek. Şu an üzerinde: ${wearName}.`, `For now there are only the clothes you came in. Your uniform, coat, tracksuit and pyjamas come from the stores in the Spor Salonu. You're wearing: ${wearName}.`),
        actions: clothes,
      },
      {
        id: 'food', name: T(`Yiyecekler (${locker.length})`, `Food (${locker.length})`),
        note: locker.length || bag.length
          ? T(`Dolabında ${locker.length}/${LOCKER_MAX}, cebinde ${bag.length}/${BAG_MAX} atıştırmalık var.`, `${locker.length}/${LOCKER_MAX} snacks in your locker, ${bag.length}/${BAG_MAX} in your pockets.`)
          : T('Yiyecek rafın boş. Kantinden aldığın atıştırmalıkları hemen yemek yerine buraya getirebilirsin.', 'Your food shelf is empty. Instead of eating snacks from the canteen straight away, you can bring them here.'),
        actions: food,
      },
    ],
  };
}

/** a friend's locker, next to yours: ask your closest friend in the class for something to wear */
export function mateLockerPanel(ctx: GameCtx): PanelView {
  const st = ctx.st;
  const pal = dormBestFriend(ctx);
  const loan = pal ? loanOf(pal) : null;
  const w = st.wardrobe;
  return {
    title: pal ? T(`${genitiveTr(pal.name)} dolabı`, `${pal.name}'s locker`) : T('Arkadaşının dolabı', "A friend's locker"), sub: dormAddress(ctx), status: status(ctx),
    rooms: [{
      id: 'matelocker', name: T('Dolap', 'Locker'),
      note: pal
        ? T(`Sınıfındaki en yakın arkadaşın ${pal.name} (${Math.round(st.friends[pal.id] ?? 0)}/100). Dolabında en sevdiği şey asılı: ${L(loan!.name)}.`, `Your closest friend in the class is ${pal.name} (${Math.round(st.friends[pal.id] ?? 0)}/100). Their favourite thing is hanging inside: the ${L(loan!.name)}.`)
        : T('Başkasının dolabı. Sınıfından biriyle "Arkadaş" olunca (40+) ondan kıyafet isteyebilirsin.', "Somebody else's locker. Once you're \"Friends\" (40+) with a classmate, you can ask to borrow their clothes."),
      actions: [{
        id: 'borrow', label: pal ? T(`👕 ${ablativeTr(pal.name)} kıyafet iste`, `👕 Ask ${pal.name} to lend you some clothes`) : T('👕 Arkadaşından kıyafet iste', '👕 Ask a friend to lend you some clothes'),
        hint: T('+6 moral · +5 arkadaşlık · yarın sabah geri verirsin', '+6 mood · +5 friendship · you give it back tomorrow morning'), look: pal ? lookIn(ctx, loan!) : undefined,
        locked: !pal ? T('Sınıfında henüz yakın bir arkadaşın yok.', "You don't have a close friend in your class yet.")
          : w.borrowed ? T(`Zaten ödünç bir kıyafetin var (${w.borrowed.name}).`, `You already have something on loan (${w.borrowed.name}).`) : undefined,
        run: async () => {
          w.borrowed = { from: pal!.id, name: L(loan!.name), top: loan!.top, bottom: loan!.bottom, day: ctx.clock.day };
          w.wearing = BORROWED;
          ctx.dress();
          nudge(ctx, { heart: 1, loyalty: 1 });
          ctx.befriend(pal!.id, 5);
          ctx.advance(5);
          ctx.gain({ mood: 6 });
          await ctx.panel.message(pal!.name, T('"Tabii, al giy! Sana çok yakışır. Yarın sabah geri ver ama, tamam mı?"', `"Sure, put it on! The ${L(loan!.name)} will suit you. Give it back tomorrow morning though, OK?"`));
        },
      }],
    }],
  };
}

export function tvPanel(ctx: GameCtx): PanelView {
  const phase = phaseOf(ctx.clock.minutes, ctx.clock.day);
  return {
    title: T('Televizyon köşesi', 'TV corner'), status: status(ctx),
    rooms: [{
      id: 'tv', name: 'TV', note: T('Eski bir televizyon ve yumuşak bir halı.', 'An old TV and a soft rug.'),
      actions: [{
        id: 'tv', label: T('Biraz televizyon izle', 'Watch some TV'), hint: T('30 dk · +5 moral · +3 enerji', '30 min · +5 mood · +3 energy'),
        locked: phase === 'etut' ? T(`${belletmenName(ctx)}: "Etütte televizyon yok!"`, `${belletmenName(ctx)}: "No TV during study time!"`) : phase === 'night' ? T('Işıklar söndü.', 'Lights are out.') : undefined,
        run: () => {
          nudge(ctx, { ambition: -1 });
          const shows = [
            T('Çizgi film vardı; koltuğa gömülüp bir bölüm izledin.', 'A cartoon was on; you sank into the sofa for an episode.'),
            T('Belgeselde penguenler buzun üstünde kayıyordu. Herkes güldü.', 'Penguins were sliding on the ice in a documentary. Everyone laughed.'),
            T('Bir yarışma programı vardı; sorulardan üçünü sen bildin!', 'A quiz show was on, and you got three of the questions right!'),
            T('Maç özetleri vardı; en güzel golü üç kere tekrar izlediniz.', 'The match highlights were on; you watched the best goal three times.'),
          ];
          ctx.panel.close();
          ctx.advance(30, { label: T('📺 Televizyon izliyorsun', '📺 Watching TV') });
          ctx.gain({ mood: 5, energy: 3 });
          ctx.toast(`📺 ${shows[Math.floor(Math.random() * shows.length)]} +5 ${T('moral', 'mood')}`, 'good');
        },
      }],
    }],
  };
}

/** the door out of the dorm: shut during study time and at night */
export function exitPanel(ctx: GameCtx): PanelView {
  const st = ctx.st;
  const phase = phaseOf(ctx.clock.minutes, ctx.clock.day);
  const bel = belletmenName(ctx);
  const canEscape = st.year >= ESCAPE_FROM_YEAR || DEV;
  const actions: ActionView[] = [];
  if (phase === 'night') {
    actions.push({
      id: 'escape', label: T('🌙 Gizlice yurttan kaç', '🌙 Sneak out of the dorm'),
      hint: T('Çok zor · belletmenin nöbet sırasını tahmin et (1–10, 2 hak)', 'Very hard · guess the belletmen\'s patrol turn (1–10, 2 tries)'),
      locked: !canEscape ? T(`Bunu ancak 6. sınıftan itibaren deneyebilirsin (şu an ${grade(st.year)}. sınıf).`, `Only from grade 6 on (you're in grade ${grade(st.year)}).`) : undefined,
      run: async () => { nudge(ctx, { rules: 3 });
        const ok = await ctx.panel.guess(T('Kaçış: belletmen kaçıncı turda kapıdan uzaklaşacak?', 'Escape: on which round will the belletmen leave the door?'), 10, 2);
        if (ok) { st.escapes++; ctx.panel.close(); ctx.escape(); }
        else { ctx.penalize(10, T(`${bel} seni kapıda yakaladı! Hemen yatağa.`, `${bel} caught you at the door! Straight to bed.`)); ctx.gain({ mood: -8 }); }
      },
    });
  } else {
    actions.push({
      id: 'leave', label: T('Dışarı çık', 'Go outside'), hint: phase === 'plaza' ? T(`${fmtTime(lightsOut())}'e kadar yalnızca yurtların çevresi`, `Only around the dorms until ${fmtTime(lightsOut())}`) : T('Kampüse', 'To the campus'),
      locked: phase === 'etut' ? T(`${bel}: "Etüt bitmeden çıkmak yok!" (20:00'ye ${20 * 60 - ctx.clock.minutes} dk)`, `${bel}: "Nobody leaves before study time ends!" (${20 * 60 - ctx.clock.minutes} min to 20:00)`) : undefined,
      run: () => { ctx.panel.close(); ctx.leaveDorm(); },
    });
  }
  return {
    title: T('Yurdun kapısı', 'Dorm door'), sub: dormAddress(ctx), status: status(ctx),
    rooms: [{ id: 'exit', name: T('Kapı', 'Door'), note: phase === 'night' ? T('Kapı kilitli. Belletmen koridorda nöbet tutuyor…', 'The door is locked. The belletmen is keeping watch in the corridor…') : undefined, actions }],
  };
}

function revir(ctx: GameCtx): PanelView {
  return {
    title: 'Revir', sub: T('Revir görevlisi Kasım Abi · gece gündüz açık', 'Kasım Abi · open day and night'), status: status(ctx),
    rooms: [{
      id: 'revir', name: 'Revir',
      note: T('Temiz çarşaflar ve hafif bir kolonya kokusu.', 'Clean sheets and a faint smell of cologne.'),
      actions: [
        ...(ctx.st.sick ? [{
          id: 'treat', label: T('Tedavi ol', 'Get treated'), hint: T('3 saat yatak istirahati', '3 hours of bed rest'),
          run: async () => {
            // a bowl of soup with the rest: hunger is what made most of them ill, and without it you'd fall ill again
            // straight away (or during the three hours in bed)
            const cure = () => { ctx.st.sick = false; ctx.st.health = Math.max(ctx.st.health, 75); ctx.st.hunger = Math.max(ctx.st.hunger, 70); };
            cure();
            ctx.advance(180);
            cure(); // (well again at the end of the rest, whatever the hours in bed did)
            ctx.gain({ energy: 20, mood: 5 });
            await ctx.panel.message('Kasım Abi', T('"Ateşin düştü. Sana bir kâse çorba içirdim; bol sıvı iç, öğünlerini atlama, ellerini yıka ve geceleri dışarıda kalma!"', '"Your fever is down. I gave you a bowl of soup; drink plenty, don\'t skip meals, wash your hands and don\'t stay out at night!"'));
          },
        } as ActionView] : []),
        ...(!ctx.st.once.healthCheck ? [{
          id: 'enrolCheck', label: T('Kayıt sağlık kontrolü', 'Enrolment health check'), hint: T('30 dk · kaydın için gerekli', '30 min · needed for registration'),
          locked: ctx.st.school.registered ? undefined : T('Önce Cemiyet Binası\'nda kayıt ol; sonra kontrole gel.', 'Register at the Cemiyet building first, then come for the check.'),
          run: async () => {
            ctx.st.once.healthCheck = true;
            ctx.st.health = clamp(ctx.st.health + 5);
            ctx.advance(30);
            ctx.gain({ xp: 20 });
            const vision = 8 + Math.floor(Math.random() * 3);
            await ctx.panel.message(T('Sağlık kontrolü', 'Health check'), T(
              `Kasım Abi boyunu ölçtü, kulaklarına ve dişlerine baktı, aşı kartını kontrol etti. Göz testi: 10 üzerinden ${vision}. "Sağlığın yerinde! Bol su iç, öğünlerini atlama. Kendini kötü hissedersen gece gündüz buradayım."`,
              `Kasım Abi measured your height, checked your ears and teeth and looked over your vaccination card. Eye test: ${vision}/10. "You're healthy! Drink plenty of water and don't skip meals. If you ever feel unwell, I'm here day and night."`));
          },
        } as ActionView] : []),
        {
          id: 'checkup', label: T('Sağlık kontrolü', 'Check-up'), hint: T('15 dk · +5 sağlık (günde bir)', '15 min · +5 health (once a day)'),
          locked: doneToday(ctx, 'checkup') ? T('Bugün kontrol oldun.', 'Already checked today.') : undefined,
          run: () => { markToday(ctx, 'checkup'); ctx.st.health = clamp(ctx.st.health + 5); ctx.advance(15); ctx.gain({}); ctx.toast(T(`Sağlığın: ${Math.round(ctx.st.health)}/100`, `Your health: ${Math.round(ctx.st.health)}/100`), 'good'); },
        },
        {
          id: 'rest', label: T('Biraz dinlen', 'Rest a while'), hint: T('1 saat · +20 enerji (günde bir)', '1 hour · +20 energy (once a day)'),
          locked: doneToday(ctx, 'rest') ? T('Bugün zaten dinlendin.', 'You already rested today.') : undefined,
          run: () => { markToday(ctx, 'rest'); ctx.advance(60); ctx.gain({ energy: 20 }); ctx.toast(T('Kendini daha iyi hissediyorsun.', 'You feel better.'), 'good'); },
        },
        {
          id: 'nurse', label: T('Kasım Abi ile sohbet et', 'Chat with Kasım Abi'), hint: T('10 dk · +5 moral', '10 min · +5 mood'),
          locked: doneToday(ctx, 'nurse') ? T('Bugün zaten konuştunuz.', 'You already talked today.') : undefined,
          run: () => { nudge(ctx, { heart: 1 }); markToday(ctx, 'nurse'); ctx.advance(10); ctx.gain({ mood: 5 }); },
        },
      ],
    }],
  };
}

function spor(ctx: GameCtx): PanelView {
  const st = ctx.st;
  const sport = SPORTS.find((x) => x.id === st.sport);
  const { day, minutes } = ctx.clock;
  const trainingTime = !isWeekend(day) && minutes >= 15.5 * 60 && minutes < 17 * 60; // (weekdays after lessons; no training at weekends)
  const enroll: ActionView = {
    id: 'enroll', label: T('Bir spora yazıl', 'Join a sport'), hint: T('Seçmeler · 3 deneme · 2 isabet gerekli', 'Try-out · 3 attempts · 2 hits needed'),
    locked: needMission(ctx, 'spora_basla') ?? sickLock(ctx) ?? (!st.school.kit ? T('Spor ayakkabın yok. Spor Salonu\'ndaki depodan al.', 'You have no sports shoes. Get them at the stores in the Spor Salonu.')
      : doneToday(ctx, 'tryout') ? T('Antrenör: "Yarın tekrar dene!"', 'Coach: "Try again tomorrow!"') : undefined),
    run: async () => { nudge(ctx, { ambition: 2 });
      const id = await ctx.panel.choose(T('Hangi spor?', 'Which sport?'), SPORTS.map((x) => ({ id: x.id, label: L(x.name), hint: `${L(x.where)} · ${L(x.tryout)}` })));
      if (!id) return;
      const sp = SPORTS.find((x) => x.id === id)!;
      const hits = await ctx.panel.timing(`${L(sp.name)}: ${L(sp.tryout)}`, 3, sp.zone, sp.speed);
      ctx.advance(30);
      if (hits >= 2) {
        st.sport = sp.id;
        ctx.gain({ xp: 100, attrs: { fitness: 2 }, mood: 8, energy: -10 });
        await ctx.panel.message(T('Takımdasın!', "You're on the team!"), T(`Antrenör Kemal Hoca: "Hoş geldin! ${L(sp.name)} antrenmanları hafta içi 15:30–17:00 arası."`, `Coach Kemal: "Welcome aboard! ${L(sp.name)} training is on weekdays 15:30–17:00."`));
      } else {
        markToday(ctx, 'tryout');
        ctx.gain({ energy: -10 });
        await ctx.panel.message(T('Bu sefer olmadı', 'Not this time'), T('Antrenör Kemal Hoca: "Fena değildi! Yarın tekrar gel."', 'Coach Kemal: "Not bad! Come back tomorrow."'));
      }
    },
  };
  const train: ActionView = {
    id: 'train', label: sport ? T(`Antrenman: ${L(sport.name)}`, `Training: ${L(sport.name)}`) : T('Antrenman', 'Training'),
    hint: T('1 saat · −15 enerji · +2 Kondisyon · +15 XP', '1 hour · −15 energy · +2 Fitness · +15 XP'),
    locked: sickLock(ctx) ?? (!trainingTime ? T('Antrenmanlar hafta içi 15:30–17:00 (hafta sonu antrenman yok).', 'Training is weekdays 15:30–17:00 (none at weekends).')
      : ctx.st.energy < 15 ? T('Çok yorgunsun.', "You're too tired.") : undefined),
    run: () => { nudge(ctx, { ambition: 1, loyalty: TEAM_SPORTS.includes(st.sport!) ? 1 : -1 }); focusTick(ctx, 'sport');
      ctx.st.health = clamp(ctx.st.health + 2);
      st.trainings++; ctx.advance(60); ctx.gain({ xp: 15, energy: -15, mood: 4, attrs: { fitness: 2 } });
      ctx.toast(T(`Antrenman tamam (${st.trainings}).`, `Training done (${st.trainings}).`), 'good');
    },
  };
  return {
    title: 'Spor Salonu', sub: T('Salon · havuz · kantin · depo', 'Hall · pool · canteen · stores'), status: status(ctx),
    rooms: [
      ...(matchOn(ctx.clock.day, ctx.clock.minutes) && !st.once.matchWatched ? [matchRoom(ctx)] : []),
      ...(st.school.kit ? [] : [depoRoom(ctx)]),
      {
        id: 'antrenor', name: T('Antrenör odası', "Coaches' office"),
        note: sport ? T(`Takımın: ${L(sport.name)} (${L(sport.where)}).`, `Your team: ${L(sport.name)} (${L(sport.where)}).`) : T('Antrenör Kemal Hoca: "Bir spor seç, seçmelere gir!"', 'Coach Kemal: "Pick a sport and try out!"'),
        actions: sport ? [train] : [enroll],
      },
      { id: 'salon', name: T('Ana salon', 'Main hall'), note: T('Basketbol, voleybol ve futsal sahaları. Ayakkabı gıcırtıları yankılanıyor.', 'Basketball, volleyball and futsal courts. Squeaking shoes echo everywhere.'), actions: [] },
      { id: 'havuz', name: T('Havuz', 'Pool'), note: T('Klor kokusu ve mavi kulvarlar.', 'The smell of chlorine and blue lanes.'), actions: [] },
      { id: 'eskrim', name: T('Eskrim salonu', 'Fencing room'), note: T('Beyaz kıyafetler, maskeler ve parlayan pistler.', 'White suits, masks and gleaming pistes.'), actions: [] },
      kantinRoom(ctx),
      ...(st.school.kit ? [depoRoom(ctx)] : []),
      {
        id: 'tribun', name: T('Tribün', 'Grandstand'),
        note: T('Doğu kapısından futbol sahasına bakan on sıralı tribüne çıkılır. Yeşil koltuklar, ortada sarı bir blok.', 'The east door leads out to the ten-row grandstand facing the football pitch. Green seats, with a gold block in the middle.'),
        actions: [{
          id: 'watch', label: T('Tribünde otur, sahayı izle', 'Sit in the stand and watch the pitch'), hint: T('20 dk · +5 moral (günde bir)', '20 min · +5 mood (once a day)'),
          locked: doneToday(ctx, 'tribun') ? T('Bugün zaten oturdun.', 'You already sat there today.') : undefined,
          run: () => { nudge(ctx, { presence: -1 }); markToday(ctx, 'tribun'); ctx.advance(20); ctx.gain({ mood: 5 }); ctx.toast(T('Sahada top koşturanları izledin. Güzel bir mola.', 'You watched the kids chasing a ball on the pitch. A nice break.'), 'good'); },
        }],
      },
    ],
  };
}

/** match night: the grandstand in the main hall, Darüşşafaka v Banvit */
function matchRoom(ctx: GameCtx): RoomView {
  const early = ctx.clock.minutes < MATCH_TIP;
  return {
    id: 'mac', name: T('🏀 Maç gecesi', '🏀 Match night'),
    note: early
      ? T(`Ana salonun tribünleri dolmaya başladı. Darüşşafaka – Banvit maçı 19:00'da (${MATCH_TIP - ctx.clock.minutes} dk). Davullar şimdiden çalıyor!`, `The stands in the main hall are filling up. Darüşşafaka v Banvit tips off at 19:00 (${MATCH_TIP - ctx.clock.minutes} min). The drums are already going!`)
      : T('Maç başladı! Tribünden tezahürat sesleri geliyor.', "The match has started! You can hear the chants from the stand."),
    actions: [{
      id: 'match', label: T('🏀 Basket maçı izle', '🏀 Watch the basketball match'), hint: early ? T('Tribünde yerini al · 19:00\'da başlıyor', 'Take your seat in the stand · tip-off at 19:00') : T('Tribüne geç · maç sürüyor', 'Go up to the stand · the match is on'),
      run: () => { ctx.panel.close(); ctx.watchMatch(); },
    }],
  };
}

/** the indoor court by the dorms: a pick-up game of one of four sports, once a day */
function kapaliSaha(ctx: GameCtx): PanelView {
  const st = ctx.st;
  const phase = phaseOf(ctx.clock.minutes, ctx.clock.day);
  const games = [
    { id: 'futbol', name: T('⚽ Salon futbolu', '⚽ Indoor football'), mood: 8, fitness: 2 },
    { id: 'hentbol', name: T('🤾 Hentbol', '🤾 Handball'), mood: 6, fitness: 2 },
    { id: 'badminton', name: T('🏸 Badminton', '🏸 Badminton'), mood: 6, fitness: 1 },
    { id: 'voleybol', name: T('🏐 Voleybol', '🏐 Volleyball'), mood: 7, fitness: 1 },
  ];
  const play: ActionView = {
    id: 'play', label: T('Bir oyuna katıl', 'Join a game'), hint: T('45 dk · −15 enerji · +Kondisyon · +moral (günde bir)', '45 min · −15 energy · +Fitness · +mood (once a day)'),
    locked: sickLock(ctx) ?? (phase === 'etut' ? T('Etüt saati: salon 20:00\'de açılıyor.', 'Study hour: the hall opens at 20:00.')
      : phase === 'night' ? T('Işıklar söndü; salon yarın açılıyor.', 'Lights are out; the hall opens tomorrow.')
      : currentPeriod(ctx.clock.day, ctx.clock.minutes)?.kind === 'lesson' && reached('derse_gir', ctx.mc()) ? T('Ders saatinde salon kapalı.', 'The hall is closed during lessons.')
        : !st.school.kit ? T('Spor ayakkabın yok. Spor Salonu\'ndaki depodan al.', 'You have no sports shoes. Get them at the stores in the Spor Salonu.')
          : doneToday(ctx, 'kapali_saha') ? T('Bugün zaten oynadın.', 'You already played today.')
            : st.energy < 20 ? T('Çok yorgunsun.', "You're too tired.") : undefined),
    run: async () => { nudge(ctx, { loyalty: 1 }); focusTick(ctx, 'sport');
      const id = await ctx.panel.choose(T('Ne oynanıyor?', "What's on?"), games.map((g) => ({ id: g.id, label: g.name })));
      const g = games.find((x) => x.id === id);
      if (!g) return;
      // whoever's in tonight: your closest friends on your side, the others against you
      const pool = NPCS.filter((n) => n.kind === 'classmate' || n.kind === 'student');
      const friends = pool.filter((n) => (st.friends[n.id] ?? 0) >= 0).sort((a, b) => (st.friends[b.id] ?? 0) - (st.friends[a.id] ?? 0));
      const pick = (n: number, not: NpcDef[]) => pool.filter((x) => !not.includes(x)).sort(() => Math.random() - 0.5).slice(0, n);
      let r: { us: number; them: number; quit: boolean };
      let side: NpcDef[] = [], others: NpcDef[] = [];
      if (g.id === 'futbol' || g.id === 'hentbol') {
        side = friends.slice(0, 2); others = pick(3, side);
        r = await ctx.playFootball([side[0], side[1]], [others[0], others[1], others[2]], g.id === 'futbol' ? 'futsal' : 'handball');
      } else if (g.id === 'voleybol') {
        side = friends.slice(0, 1); others = pick(2, side);
        r = await ctx.playNetGame('voleybol', side[0], others);
      } else {
        others = pick(1, friends.slice(0, 1));
        r = await ctx.playNetGame('badminton', null, others);
      }
      markToday(ctx, 'kapali_saha');
      if (r.quit) {
        ctx.advance(15);
        ctx.gain({ mood: -3, energy: -5 });
        for (const m of [...side, ...others]) ctx.befriend(m.id, -1);
        ctx.toast(T('Oyunu yarıda bıraktın; ötekiler biraz bozuldu.', 'You walked out of the game; the others were a bit put out.'));
        return;
      }
      const won = r.us > r.them;
      ctx.advance(45);
      ctx.gain({ xp: 15 + (won ? 20 : 0), mood: g.mood + (won ? 5 : 0), energy: -15, hunger: -8, attrs: { fitness: g.fitness + (won ? 1 : 0), social: 1 } });
      for (const m of side) ctx.befriend(m.id, won ? 4 : 2);
      for (const m of others) ctx.befriend(m.id, 1);
      await ctx.panel.message(won ? T('Kazandınız! 🎉', 'You won! 🎉') : T('Maç bitti', 'Full time'), T(
        `${g.name.replace(/^\S+\s/, '')}: ${r.us}–${r.them}. ${side.length ? `Takımında: ${side.map((m) => m.name).join(', ')}. ` : ''}Rakipler: ${others.map((m) => m.name).join(', ')}.`,
        `${g.name.replace(/^\S+\s/, '')}: ${r.us}–${r.them}. ${side.length ? `On your side: ${side.map((m) => m.name).join(', ')}. ` : ''}Against you: ${others.map((m) => m.name).join(', ')}.`,
      ));
    },
  };
  return {
    title: 'Kapalı Saha', sub: T('Futbol · hentbol · badminton · voleybol', 'Football · handball · badminton · volleyball'), status: status(ctx),
    rooms: [{
      id: 'saha', name: T('Saha', 'Court'),
      note: T('Parke zeminde futbol kaleleri, hentbol çizgileri ve gerilmiş bir file. Akşamları yurtlardan gelenlerle dolup taşar.', 'Football goals, handball lines and a net strung across the parquet. In the evenings it fills up with kids from the dorms.'),
      actions: [play],
    }],
  };
}

const pickRandom = <X,>(a: readonly X[]) => a[Math.floor(Math.random() * a.length)];

/** what this person says right now: it fits where they are and the time of day */
function lineNow(npc: NpcDef, ctx: GameCtx): Text {
  const { day, minutes } = ctx.clock;
  if (npc.kind === 'belletmen') return npc.lines[day % npc.lines.length];
  const lessonsOn = reached('derse_gir', ctx.mc());
  const rush = ctx.rush();
  const where = npc.kind === 'teacher' ? undefined : activityOf(npc, { day, minutes, lessonsOn, raining: ctx.raining, rush }).in;
  const weekend = isWeekend(day);
  const moment: Moment = rush && where !== 'yemekhane' ? 'rush' : where === 'egitim' ? 'class' : where === 'yemekhane' ? 'meal' : where === 'dorm' ? (phaseOf(minutes, day) === 'etut' ? 'study' : 'evening')
    : minutes >= 18 * 60 ? 'evening' : weekend ? 'weekend' : !lessonsOn ? 'first' : minutes < 8 * 60 + 30 ? 'morning' : minutes < 15 * 60 + 20 ? 'break' : 'afternoon';
  return lineFor(npc, { moment, day, minutes, wet: ctx.raining && !where, evci: npcIsEvci(npc), ceremony: !where && !ctx.raining && ceremonyNow(day, minutes) });
}

/** the fun, risky and mean things you can do with another student (once a day each) */
/** how good a classmate is at Yetimball (0–1): the court crowd and the older ones are good at it, the bookworms less so */
export function yetimballSkill(npc: NpcDef): number {
  const base = npc.kind === 'abi' ? 0.76 : npc.group === 'kortcular' ? 0.72 : npc.group === 'haylaz' ? 0.64 : npc.group === 'sanat' ? 0.55 : npc.group === 'kitap' ? 0.48 : 0.58;
  let h = 0;
  for (const ch of npc.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return Math.max(0.4, Math.min(0.85, base + 0.015 * ((npc.grade ?? 4) - 4) + ((h % 11) - 5) / 100));
}

/** a game of Yetimball with a classmate, out on the campus */
async function yetimballWith(npc: NpcDef, ctx: GameCtx) {
  const say = (tr: string, en: string) => ctx.panel.message(npc.name, T(tr, en));
  ctx.panel.close();
  const r = await ctx.playYetimball(npc.name, yetimballSkill(npc));
  if (r === 'win') {
    ctx.befriend(npc.id, 8);
    ctx.gain({ mood: 8, xp: 15, energy: -6, attrs: { fitness: 1 } });
    ctx.toast(T(`🪢 ${npc.name}'ı Yetimball'da yendin! "Rövanş yarın, hazır ol!"`, `🪢 You beat ${npc.name} at Yetimball! "Rematch tomorrow, be ready!"`), 'good');
  } else if (r === 'lose') {
    ctx.befriend(npc.id, 10);
    ctx.gain({ mood: 2, xp: 8, energy: -6, attrs: { fitness: 1 } });
    ctx.toast(T(`🪢 ${npc.name} kazandı ve çok sevindi. "İyi oynadın ama!"`, `🪢 ${npc.name} won and is delighted. "You played well, though!"`));
  } else {
    ctx.befriend(npc.id, -2);
    await say(`Oyunu yarıda bıraktın. ${npc.name}: "Hıh, tam da kazanıyordum…"`, `You walked off mid-game. ${npc.name}: "Hmph, I was just about to win…"`);
  }
}

function socialActions(npc: NpcDef, ctx: GameCtx, f: number, lock: string | undefined): ActionView[] {
  const st = ctx.st;
  const once = (key: string) => (doneToday(ctx, `${key}-${npc.id}`) ? T('Bugün zaten yaptın.', 'Already done today.') : undefined);
  const mark = (key: string) => markToday(ctx, `${key}-${npc.id}`);
  const others = NPCS.filter((n) => n.id !== npc.id && n.kind !== 'belletmen' && (st.friends[n.id] !== undefined || n.kind === 'classmate'));
  const say = (tr: string, en: string) => ctx.panel.message(npc.name, T(tr, en));
  const hw = st.school.homework[0];
  // some things need room to run about: no dodgeball or hide-and-seek in a classroom, the dining hall or the dorm
  const place = ctx.place();
  const indoors = place !== 'out';
  const where = place === 'class' ? T('sınıfta', 'in the classroom') : place === 'dining' ? T('yemekhanede', 'in the dining hall') : T('yurtta', 'in the dorm');
  const list: ActionView[] = [
    {
      id: 'play', label: T('🎮 Birlikte oyun oyna', '🎮 Play a game together'),
      hint: indoors ? T(`Taş-kâğıt-makas${place === 'dining' ? '' : ', misket'} · yakar top ve saklambaç ${where} oynanmaz`, `Rock-paper-scissors${place === 'dining' ? '' : ', marbles'} · no dodgeball or hide-and-seek ${where}`) : T('Taş-kâğıt-makas, misket, yakar top, saklambaç', 'Rock-paper-scissors, marbles, dodgeball, hide-and-seek'),
      locked: lock ?? once('play'),
      run: async () => { nudge(ctx, { heart: 1 }); focusTick(ctx, 'friends');
        const games = [
          { id: 'rps', label: T('✊ Taş-kâğıt-makas', '✊ Rock-paper-scissors'), hint: T('5 dk', '5 min') },
          ...(place === 'dining' ? [] : [{ id: 'misket', label: T('🔵 Misket', '🔵 Marbles'), hint: T('20 dk · misketini kaybedebilirsin', '20 min · you might lose a marble') }]),
          ...(indoors ? [] : [
            { id: 'yakar', label: T('🏐 Yakar top', '🏐 Dodgeball'), hint: T('30 dk · +Kondisyon · −enerji', '30 min · +Fitness · −energy') },
            { id: 'saklambac', label: T('🙈 Saklambaç', '🙈 Hide-and-seek'), hint: T('40 dk', '40 min') },
          ]),
        ];
        const game = await ctx.panel.choose(indoors ? T(`Ne oynayalım? (${where} yalnızca sessiz oyunlar)`, `What shall we play? (quiet games only ${where})`) : T('Ne oynayalım?', 'What shall we play?'), games);
        if (!game) return;
        mark('play');
        if (game === 'rps') {
          const won = await ctx.playRps(npc);
          ctx.advance(5);
          if (won === null) { ctx.befriend(npc.id, -1); await say(`Oyunu yarıda bıraktın. ${npc.name}: "Korktun mu yoksa?" 😏`, `You walked off mid-game. ${npc.name}: "Scared, were you?" 😏`); }
          else if (won) { ctx.befriend(npc.id, 10); ctx.gain({ mood: 6 }); await say(`Kazandın! 🎉 ${npc.name}: "Bir dahakine görürsün!"`, `You win! 🎉 ${npc.name}: "Just you wait till next time!"`); }
          else { ctx.befriend(npc.id, 6); ctx.gain({ mood: -1 }); await say(`${npc.name} kazandı. "Rövanş ister misin?" 😏`, `${npc.name} won. "Want a rematch?" 😏`); }
        } else if (game === 'misket') {
          const r = await ctx.playMarbles(npc);
          ctx.advance(20);
          if (r.quit) { ctx.befriend(npc.id, -1); await say(`Oyunu yarıda bıraktın. ${npc.name}: "Misketlerimi geri ver ama!"`, `You walked off mid-game. ${npc.name}: "Give me my marbles back, then!"`); }
          else if (r.mine > r.theirs) { ctx.befriend(npc.id, 6); ctx.gain({ mood: 6 }); await say(`${r.mine}–${r.theirs}! Onun en güzel misketini de kazandın.`, `${r.mine}–${r.theirs}! You won their best marble too.`); }
          else if (r.mine < r.theirs) { ctx.befriend(npc.id, 9); ctx.gain({ mood: -2 }); await say(`${r.theirs}–${r.mine}: ${npc.name} senin mavi misketini kazandı ve çok sevindi.`, `${r.theirs}–${r.mine}: ${npc.name} won your blue marble and is over the moon.`); }
          else { ctx.befriend(npc.id, 7); ctx.gain({ mood: 2 }); await say(`${r.mine}–${r.theirs}, berabere! Herkes kendi misketini aldı.`, `${r.mine}–${r.theirs}, a draw! Everyone took their own marbles back.`); }
        } else if (game === 'yakar') {
          // whoever's about: your friend and a few others in the middle with you, two more throwing
          const others = NPCS.filter((n) => n.id !== npc.id && (n.kind === 'classmate' || n.kind === 'student')).sort(() => Math.random() - 0.5);
          const r = await ctx.playDodgeball([npc, ...others.slice(0, 3)], [others[3], others[4]]);
          ctx.advance(30);
          if (r.quit) { ctx.befriend(npc.id, -1); await say(`Oyunu yarıda bıraktın. ${npc.name}: "Yanmaktan mı korktun?"`, `You walked off mid-game. ${npc.name}: "Scared of getting hit?"`); }
          else {
            ctx.befriend(npc.id, 10);
            ctx.gain({ energy: -8, attrs: { fitness: 1 } });
            if (r.last) { ctx.gain({ mood: 8, xp: 10 }); await say(`Ortada son kalan sen oldun!${r.catches ? ` ${r.catches} kez topu tuttun.` : ''} Herkes seni alkışladı. 🏆`, `You were the last one left in the middle!${r.catches ? ` You caught the ball ${r.catches} times.` : ''} Everyone cheered. 🏆`); }
            else if (r.won) { ctx.gain({ mood: 6, xp: 6 }); await say('Süre bitene kadar yanmadın! 💪', "You lasted till the end without getting hit! 💪"); }
            else if (r.seconds < 12) { ctx.gain({ mood: -3 }); await say('Top daha başta tam suratına geldi! Herkes güldü… sen de güldün sonunda. 😅', 'The ball hit you right in the face straight away! Everyone laughed… eventually you did too. 😅'); }
            else { ctx.gain({ mood: 3 }); await say(`${r.seconds} saniye dayandın, sonra yandın. Fena değil!`, `You lasted ${r.seconds} seconds before you were out. Not bad!`); }
          }
        } else {
          const role = await ctx.panel.choose(T('Kim ebe?', "Who's it?"), [
            { id: 'hide', label: T(`🙈 ${npc.name} ebe olsun, ben saklanayım`, `🙈 ${npc.name} is it, I'll hide`) },
            { id: 'seek', label: T('👁 Ben ebe olayım', "👁 I'll be it") },
          ]) as HideRole | undefined;
          if (!role) return;
          const others = NPCS.filter((n) => n.id !== npc.id && (n.kind === 'classmate' || n.kind === 'student')).sort(() => Math.random() - 0.5).slice(0, 2);
          const r = await ctx.playHideSeek(role, [npc, ...others]);
          ctx.advance(40);
          if (r.quit) { ctx.befriend(npc.id, -1); await say(`Oyunu yarıda bıraktın. ${npc.name}: "Hey, daha bitmedi!"`, `You walked off mid-game. ${npc.name}: "Hey, we weren't done!"`); }
          else {
            ctx.befriend(npc.id, 12);
            if (role === 'hide' && r.safe) { ctx.gain({ mood: 6 }); await say(`"Sobe!" ${npc.name} seni yakalayamadı. 😎`, `"Home free!" ${npc.name} never caught you. 😎`); }
            else if (role === 'hide') { ctx.gain({ mood: 2 }); await say(`${npc.name} seni sobeledi. "Bir dahakine sen ebesin!"`, `${npc.name} caught you. "You're it next time!"`); }
            else if (r.caught * 2 >= r.of) { ctx.gain({ mood: 6 }); await say(`${r.of} kişiden ${r.caught} tanesini sobeledin! Kimse senden saklanamıyor. 👁`, `You caught ${r.caught} of ${r.of}! Nobody can hide from you. 👁`); }
            else { ctx.gain({ mood: 2 }); await say(`${r.of} kişiden ${r.caught} tanesini yakalayabildin; ötekiler seni atlatıp sobeledi.`, `You caught ${r.caught} of ${r.of}; the others gave you the slip and got home.`); }
          }
        }
      },
    },
    {
      id: 'yetimball', label: T('🪢 Yetimball oyna', '🪢 Play Yetimball'),
      hint: T(`Karşılıklı ip sarma · topu yanından geçerken kendi yönüne vur · ${npc.name}: ${yetimballSkill(npc) >= 0.68 ? 'iyi oyuncu' : yetimballSkill(npc) >= 0.56 ? 'fena değil' : 'pek iyi değil'}`, `A rope-winding duel · hit the ball your way as it swings past · ${npc.name}: ${yetimballSkill(npc) >= 0.68 ? 'a strong player' : yetimballSkill(npc) >= 0.56 ? 'not bad' : 'not much good'}`),
      locked: lock ?? (indoors ? T(`Yetimball dışarıda, direğin başında oynanır (${where} olmaz).`, `Yetimball is played outside at the pole (not ${where}).`) : once('yetimball')),
      run: async () => { nudge(ctx, { heart: 1 }); focusTick(ctx, 'sport'); mark('yetimball'); await yetimballWith(npc, ctx); },
    },
    {
      id: 'joke', label: T('😂 Şaka yap', '😂 Tell a joke'), hint: T('Güldürürsen +10 · tutmazsa −3', 'If they laugh +10 · if it flops −3'),
      locked: lock ?? once('joke'),
      run: async () => { nudge(ctx, { presence: 2 });
        mark('joke');
        ctx.advance(5);
        const jokes = [
          T('"Temel ile Dursun kantine gitmiş…" diye başladın.', 'You started with "So Temel and Dursun walk into the canteen…"'),
          T('Murat Hoca\'nın "Sessiz olun!" deyişini taklit ettin.', 'You did an impression of Mr. Murat saying "Quiet, please!"'),
          T('"Neden matematik kitabı üzgünmüş? Çünkü çok problemi varmış!" dedin.', '"Why was the maths book sad? It had too many problems!"'),
        ];
        const joke = pickRandom(jokes);
        if (Math.random() < (hasSecret(st, 'sahne') ? 0.85 : 0.6)) { ctx.befriend(npc.id, 10); ctx.gain({ mood: 4, attrs: { social: 1 } }); await ctx.panel.message(npc.name, `${joke} ${T(`${npc.name} gülmekten yere yattı! 😂`, `${npc.name} is rolling on the floor laughing! 😂`)}`); }
        else { ctx.befriend(npc.id, -3); ctx.gain({ mood: -2 }); await ctx.panel.message(npc.name, `${joke} ${T(`${npc.name}: "…Anlamadım." Cırcır böcekleri öttü. 🦗`, `${npc.name}: "…I don't get it." Crickets. 🦗`)}`); }
      },
    },
    {
      id: 'nickname', label: T('🏷️ Lakap tak', '🏷️ Give them a nickname'), hint: T('Ya bayılır (+8) ya da nefret eder (−12)', 'They either love it (+8) or hate it (−12)'),
      locked: lock ?? once('nickname'),
      run: async () => { nudge(ctx, { presence: 1, warmth: 1 });
        mark('nickname');
        const nick = pickRandom(['Kirpi', 'Uzay Adam', 'Profesör', 'Turbo', 'Fasulye', 'Şimşek', 'Kaptan', 'Pamuk']);
        if (Math.random() < (hasSecret(st, 'sahne') ? 0.75 : 0.5)) { ctx.befriend(npc.id, 8); await say(`"${nick}" mı? Bayıldım! Artık herkes bana böyle desin!`, `"${nick}"? I love it! Everyone has to call me that now!`); }
        else { ctx.befriend(npc.id, -12); ctx.gain({ mood: -2 }); await say(`"${nick}" mı?! Bir daha sakın bana öyle deme!`, `"${nick}"?! Don't you dare call me that again!`); }
      },
    },
    {
      id: 'gossip', label: T('🗣️ Dedikodu yap', '🗣️ Gossip about someone'), hint: T('Dinleyen +6 · hedefin −8 · duyulursa daha kötü', 'Listener +6 · your target −8 · worse if it gets back to them'),
      locked: lock ?? once('gossip') ?? (others.length ? undefined : T('Dedikodu yapacak kimseyi tanımıyorsun.', "You don't know anyone to gossip about.")),
      run: async () => { nudge(ctx, { warmth: 2, presence: 1 });
        const who = await ctx.panel.choose(T('Kimin hakkında?', 'About whom?'), others.slice(0, 14).map((n) => ({ id: n.id, label: n.name, hint: L(friendLevel(st.friends[n.id] ?? 0)) })));
        if (!who) return;
        mark('gossip');
        const target = NPCS.find((n) => n.id === who)!;
        ctx.advance(10);
        ctx.gain({ mood: 2 });
        const listenerLikesTarget = npc.group && npc.group === target.group && (st.friends[target.id] ?? 0) >= 0;
        if (listenerLikesTarget && Math.random() < 0.6) {
          ctx.befriend(npc.id, -10);
          await say(`"${target.name} benim arkadaşım! Arkasından konuşma." ${npc.name} sana kızdı.`, `"${target.name} is my friend! Don't talk behind their back." ${npc.name} is cross with you.`);
          return;
        }
        ctx.befriend(npc.id, 6);
        ctx.befriend(target.id, -8);
        if (Math.random() < 0.3) {
          ctx.befriend(target.id, -10);
          await say(`${npc.name} kıkırdadı… ama dedikodu ${dativeTr(target.name)} kadar gitti! Seninle konuşmuyor.`, `${npc.name} giggled… but the gossip got back to ${target.name}! They're not speaking to you.`);
        } else {
          await say(`${npc.name}: "Yok artık! Kimseye söylemem, söz." 🤭`, `${npc.name}: "No way! I won't tell anyone, promise." 🤭`);
        }
      },
    },
    {
      id: 'mock', label: T('😜 Dalga geç', '😜 Make fun of them'), hint: T('Etraftakiler güler · o seni sevmez (−20) · ⚠ disiplin', 'Others laugh · they won\'t like you (−20) · ⚠ discipline'),
      locked: lock ?? once('mock') ?? (place === 'dining' ? T('Yemekhanede nöbetçi öğretmen tam karşında.', 'The teacher on duty in the dining hall is right in front of you.') : undefined),
      run: async () => { nudge(ctx, { warmth: 3, presence: 2 });
        mark('mock');
        ctx.befriend(npc.id, -20);
        const laughers = others.filter((n) => n.kind === 'classmate').sort(() => Math.random() - 0.5).slice(0, 2);
        laughers.forEach((n) => ctx.befriend(n.id, 4));
        ctx.gain({ mood: 4 });
        if (Math.random() < 0.25) ctx.penalize(3, T(`${npc.name} ağlayarak öğretmene gitti.`, `${npc.name} went crying to a teacher.`));
        await say(`${laughers.map((n) => n.name).join(' ve ') || 'Birkaç kişi'} güldü ama ${npc.name} çok kırıldı. Bunu unutmayacak.`, `${laughers.map((n) => n.name).join(' and ') || 'A few kids'} laughed, but ${npc.name} was really hurt. They won't forget it.`);
      },
    },
    {
      id: 'borrow', label: T('💰 5 ₺ borç iste', '💰 Ask to borrow 5 ₺'), hint: T('Arkadaşsanız verir (−4) · değilseniz bozulur (−6)', 'A friend will lend it (−4) · otherwise they\'re annoyed (−6)'),
      locked: lock ?? once('borrow'),
      run: async () => {
        mark('borrow');
        if (f >= 30) { ctx.gain({ money: 5 }); ctx.befriend(npc.id, -4); await say('"Al bakalım… ama geri isterim, ha!"', '"Here you go… but I want it back, okay?"'); }
        else { ctx.befriend(npc.id, -6); await say('"Seni daha doğru dürüst tanımıyorum bile!"', '"I barely even know you!"'); }
      },
    },
  ];
  if (hw) {
    list.push({
      id: 'copy', label: T(`📄 Ödevini kopyala (${subjName(hw.s)})`, `📄 Copy their homework (${subjName(hw.s)})`), hint: T('Hızlı ama riskli: %35 yakalanma', 'Quick but risky: 35% chance of getting caught'),
      locked: lock ?? once('copy') ?? (place === 'dining' ? T('Yemekhanede defter açılmaz.', "You can't get your notebooks out in the dining hall.") : undefined) ?? (f < 40 ? T(`${npc.name} ödevini sana vermez; yeterince yakın değilsiniz.`, `${npc.name} won't share; you're not close enough.`) : undefined),
      run: async () => { nudge(ctx, { rules: 2, ambition: -1 });
        mark('copy');
        st.school.homework.shift();
        ctx.advance(10);
        if (Math.random() < 0.35) {
          st.school.scores[hw.s].push(0);
          ctx.penalize(5, T('Öğretmen iki ödevin aynı olduğunu fark etti!', 'The teacher noticed the two homeworks were identical!'));
          ctx.befriend(npc.id, -5);
        } else {
          st.school.scores[hw.s].push(60);
          await say('Kimse fark etmedi… bu sefer. 😬', 'Nobody noticed… this time. 😬');
        }
      },
    });
  }
  if (f >= (hasSecret(st, 'sirdas') ? 40 : 60)) {
    list.push({
      id: 'secret', label: T('🤫 Bir sırrını paylaş', '🤫 Share a secret'), hint: T('Yakın arkadaşlar için · +15', 'For close friends · +15'),
      locked: lock ?? once('secret'),
      run: async () => { nudge(ctx, { heart: 3 }); mark('secret'); ctx.befriend(npc.id, 15); ctx.gain({ mood: 6 }); await say('"Kimseye söylemeyeceğim. Sen de benimkini dinler misin?"', '"I won\'t tell a soul. Will you listen to mine too?"'); },
    });
  }
  // ---- friends (40+): study together ----
  list.push({
    id: 'study', label: T('📚 Birlikte ders çalış', '📚 Study together'),
    hint: hw ? T(`30 dk · ${subjName(hw.s)} ödevini birlikte bitirirsiniz · +arkadaşlık`, `30 min · you finish the ${subjName(hw.s)} homework together · +friendship`) : T('30 dk · +1 Bilgi · +arkadaşlık · günde bir', '30 min · +1 Knowledge · +friendship · once a day'),
    locked: lock ?? once('study') ?? (phaseOf(ctx.clock.minutes, ctx.clock.day) === 'night' ? T('Işıklar söndü.', 'Lights are out.') : undefined),
    run: async () => {
      nudge(ctx, { loyalty: 1, ambition: 1 }); focusTick(ctx, 'study'); mark('study');
      ctx.advance(30); ctx.befriend(npc.id, 8);
      if (hw) {
        st.school.homework.shift();
        st.school.scores[hw.s].push(Math.min(100, 70 + Math.round(ctx.ch.attributes.knowledge / 4)));
        ctx.gain({ xp: 15, energy: -4, attrs: { knowledge: 1 } });
        await say(`${subjName(hw.s)} ödevini birlikte çözdünüz. "Sen olmasan bu soruyu hiç anlamayacaktım."`, `You worked through the ${subjName(hw.s)} homework together. "I'd never have got that question without you."`);
      } else {
        ctx.gain({ xp: 10, energy: -4, attrs: { knowledge: 1 } });
        await say('Ertesi günün derslerine birlikte göz attınız; birbirinize soru sordunuz.', "You looked over tomorrow's lessons together and quizzed each other.");
      }
    },
  });
  // ---- close friends (70+): a heart-to-heart, and once, the story of your loss ----
  list.push({
    id: 'heart', label: T('🫂 Dertleş', '🫂 Have a heart-to-heart'), hint: T('20 dk · +12 moral · +arkadaşlık · günde bir', '20 min · +12 mood · +friendship · once a day'),
    locked: lock ?? once('heart'),
    run: async () => {
      nudge(ctx, { heart: 2 }); focusTick(ctx, 'friends'); mark('heart');
      ctx.advance(20); ctx.befriend(npc.id, 6); ctx.gain({ mood: 12 });
      await say('Yatakhanenin merdivenlerine oturdunuz. Ev, özlem, okuldaki dertler… Kalkarken ikinizin de içi hafiflemişti.', 'You sat on the dorm stairs. Home, missing people, school troubles… When you got up, you both felt lighter.');
    },
  });
  if (!st.once[`told-${npc.id}`]) {
    const whom = ctx.ch.loss === 'mother' ? T('anneni', 'your mum') : ctx.ch.loss === 'father' ? T('babanı', 'your dad') : T('anneni ve babanı', 'both your parents');
    list.push({
      id: 'story', label: T('🕯️ Kaybını anlat', '🕯️ Tell them about your loss'), hint: T('Bir kez · yakın arkadaşlar için', 'Once · for close friends'),
      locked: lock,
      run: async () => {
        nudge(ctx, { heart: 5 }); st.once[`told-${npc.id}`] = true;
        ctx.advance(30); ctx.befriend(npc.id, 20); ctx.gain({ mood: 8 });
        await say(`Ona ${whom} kaybettiğin günü ilk kez bu kadar açık anlattın. Uzun süre sustu; sonra o da kendi kaybını anlattı. O akşam ikiniz de bir şeyin değiştiğini biliyordunuz.`,
          `For the first time you told them, openly, about the day you lost ${whom}. They were quiet for a long time; then they told you about their own loss. That evening you both knew something had changed.`);
      },
    });
  }
  // ---- when things are bad (Anlaşamıyor / Rakip): settle it in a race, or find someone to make peace ----
  {
    const win = Math.max(0.2, Math.min(0.8, 0.3 + ctx.ch.attributes.fitness / 150 + (st.skills.basketball + st.skills.football) / 600));
    list.push({
      id: 'challenge', label: T('⚔️ Meydan oku: bahçede koşu yarışı', '⚔️ Challenge them: a race across the yard'), hint: T('Kazanırsan saygı kazanırsın · kaybedersen moralin bozulur', 'Win and they respect you · lose and it stings'),
      locked: lock ?? once('challenge') ?? (indoors ? T(`Yarış dışarıda yapılır (${where} olmaz).`, `Races happen outside (not ${where}).`) : undefined),
      run: async () => {
        nudge(ctx, { presence: 2, warmth: 2 }); mark('challenge'); st.once[`raced-${npc.id}`] = true; ctx.advance(15);
        if (Math.random() < win) {
          ctx.ch.respect += 5; ctx.befriend(npc.id, 12); ctx.gain({ mood: 6, energy: -6, attrs: { fitness: 1 } });
          await say(`Fıskiyeye senden önce varamadı. Nefes nefese elini uzattı: "Tamam… hakkını verdin." +5 saygınlık`, `They couldn't reach the fountain before you. Out of breath, they held out a hand: "Fine… fair's fair." +5 respect`);
        } else {
          ctx.ch.respect = Math.max(0, ctx.ch.respect - 2); ctx.befriend(npc.id, -3); ctx.gain({ mood: -6, energy: -6 });
          await say('Son düzlükte seni geçti ve dönüp güldü. Etraftakiler de güldü.', 'They passed you on the last stretch and turned round laughing. So did everyone watching.');
        }
      },
    });
    const go = NPCS.find((n) => n.id !== npc.id && !!npc.group && n.group === npc.group && (st.friends[n.id] ?? 0) >= FRIEND_AT);
    list.push({
      id: 'mediate', label: T('🕊️ Arabulucu bul', '🕊️ Find someone to make peace'), hint: go ? T(`${go.name} ikinizi de tanıyor · +20`, `${go.name} knows you both · +20`) : T('Ortak bir arkadaş gerekir', 'You need a friend in common'),
      locked: lock ?? once('mediate') ?? (go ? undefined : T(`${npc.name} ile ortak bir arkadaşınız yok.`, `You and ${npc.name} have no friend in common.`)),
      run: async () => {
        nudge(ctx, { warmth: -2, heart: 1 }); mark('mediate'); ctx.advance(15); ctx.befriend(npc.id, 20);
        await say(`${go!.name} ikinizi kantinde aynı masaya oturttu. Önce kimse konuşmadı; sonra gülmeye başladınız.`, `${go!.name} sat you both down at the same canteen table. Nobody spoke at first; then you started laughing.`);
      },
    });
  }
  if (f < 0) {
    list.push({
      id: 'sorry', label: T('🙏 Özür dile', '🙏 Apologize'), hint: T('+15 · araları düzeltir', '+15 · patches things up'),
      locked: lock ?? once('sorry'),
      run: async () => { nudge(ctx, { warmth: -2, heart: 1 }); mark('sorry'); ctx.befriend(npc.id, 15); await say('"…Peki. Unutalım gitsin."', '"…Fine. Let\'s forget about it."'); },
    });
  }
  return list;
}

/** the first time you talk to someone: they tell you who they are, where they're from and what they like */
function meetAction(npc: NpcDef, ctx: GameCtx): ActionView {
  return {
    id: 'meet', label: T(`👋 Tanış: "Merhaba, ben ${ctx.ch.first}!"`, `👋 Introduce yourself: "Hi, I'm ${ctx.ch.first}!"`), hint: T('10 dk · kendini anlatır · +20 arkadaşlık', '10 min · they tell you about themselves · +20 friendship'),
    run: async () => {
      nudge(ctx, { heart: 1, presence: 1 });
      const before = sideProgress(ctx);
      ctx.st.once[`met-${npc.id}`] = true;
      const after = sideProgress(ctx);
      for (const [id, p] of after) if (before.get(id) !== p) ctx.toast(`📜 ${L(missionById(id).title)} · ${p}`, 'good');
      ctx.log({ kind: 'met', a: npc.name, b: bioOf(npc).from, c: L(bioOf(npc).likes) });
      ctx.advance(10);
      ctx.befriend(npc.id, 20);
      ctx.gain({ attrs: { social: 1 }, mood: 3, xp: 8 });
      const classmate = npc.kind === 'classmate' && ctx.st.once.classDrawn;
      await ctx.panel.message(T(`${npc.name} ile tanıştın`, `You met ${npc.name}`), `"${L(bioOf(npc).story)}"${classmate ? T(` · ${ctx.st.school.classLabel} sınıfından, senin sınıf arkadaşın.`, ` · In ${ctx.st.school.classLabel}, your own class.`) : ''}`);
    },
  };
}

/** how far along the "meet them" step of each side quest you're on is ("2/3") */
function sideProgress(ctx: GameCtx): Map<string, string> {
  const c = ctx.mc();
  const out = new Map<string, string>();
  for (const m of MISSIONS) {
    const o = m.kind === 'side' && statusOf(m, c) === 'active' ? m.objectives.find((x) => x.progress) : undefined;
    if (o?.progress) out.set(m.id, o.progress(c));
  }
  return out;
}

const listTr = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} ve ${xs[xs.length - 1]}` : xs[0] ?? '');
const listEn = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0] ?? '');

/** Kerem Abi and Selin Abla: the side quests they hand out this year, and handing them back in */
function questActions(npc: NpcDef, ctx: GameCtx, met: boolean): ActionView[] {
  const c = ctx.mc();
  const st = ctx.st;
  const out: ActionView[] = [];
  const girls = npc.gender === 'girl';
  const word = girls ? T('abla', 'abla') : T('abi', 'abi');
  for (const m of questsFrom(npc.id, c)) {
    const s = statusOf(m, c);
    if (s === 'done') continue;
    const meet = m.objectives.find((o) => o.id !== 'report');
    if (!st.side.taken.includes(m.id)) {
      out.push({
        id: `quest-${m.id}`, label: T(`📜 Görev al: ${m.title.tr}`, `📜 Take a quest: ${m.title.en}`), hint: T(`${meet ? `${meet.text.tr} · ` : ''}+${m.reward.xp} XP`, `${meet ? `${meet.text.en} · ` : ''}+${m.reward.xp} XP`),
        locked: met ? undefined : T(`Önce ${npc.name} ile tanış.`, `Get to know ${npc.name} first.`),
        run: async () => {
          nudge(ctx, { presence: 1, warmth: -1 });
          st.side.taken.push(m.id);
          ctx.befriend(npc.id, 5);
          const names = oldersToMeet(girls).map((n) => n.name);
          await ctx.panel.message(npc.name, T(
            `"Bak ${ctx.ch.first}, burada herkesin bir ${word} vardır. Git, ${girls ? 'ablalarınla' : 'abilerinle'} tanış; seni bilsinler, bir derdin olunca kime gideceğini bil. ${listTr(names)}… Üçüyle tanış, sonra gel bana anlat. Kimini burada meydanda, kimini sahaların orada bulursun; akşamları herkes meydana çıkar."`,
            `"Listen, ${ctx.ch.first}: everyone here has an ${word}. Go and get to know the older ${girls ? 'girls' : 'boys'}; let them know who you are, so you know who to go to when something's wrong. ${listEn(names)}… Meet three of them, then come and tell me. Some you'll find here on the plaza, some out by the courts; in the evening everyone comes out to the plaza."`,
          ));
        },
      });
    } else if (meet && !meet.done(c)) {
      out.push({ id: `quest-${m.id}`, label: T(`📜 ${m.title.tr} · ${meet.progress?.(c) ?? ''}`, `📜 ${m.title.en} · ${meet.progress?.(c) ?? ''}`), locked: T(`Önce ${meet.text.tr.toLocaleLowerCase('tr-TR')}, sonra gel.`, `${meet.text.en} first, then come back.`), run: () => {} });
    } else {
      out.push({
        id: `quest-${m.id}`, label: T(`✅ Görevi teslim et: ${m.title.tr}`, `✅ Hand in: ${m.title.en}`), hint: T(`+${m.reward.xp} XP`, `+${m.reward.xp} XP`),
        run: async () => {
          const met3 = oldersToMeet(girls).filter((n) => st.once[`met-${n.id}`]).map((n) => n.name);
          st.side.handed.push(m.id);
          await ctx.panel.message(npc.name, T(
            `"${listTr(met3)} seni sordu bana, 'Yeni gelen ${ctx.ch.first} mi o?' diye. Aferin! Artık burada seni bilen ${girls ? 'ablaların' : 'abilerin'} var. Ben de buradayım, unutma."`,
            `"${listEn(met3)} asked me about you: 'Is that ${ctx.ch.first}, the new one?' Well done! Now there are older ${girls ? 'girls' : 'boys'} here who know you. And I'm here too, don't forget."`,
          ));
          // (the mission completes and pays out its XP on this check)
          ctx.befriend(npc.id, 10);
        },
      });
    }
  }
  return out;
}

/** a giver's note: what they're waiting for, or that this year's quests are done */
function questNote(npc: NpcDef, ctx: GameCtx): string {
  const c = ctx.mc();
  const qs: Mission[] = questsFrom(npc.id, c);
  if (!qs.length || qs.every((m) => missionDone(ctx.st, m.id))) return T(' · Bu yılın görevlerini bitirdin; yeni görevler seneye.', " · You've done this year's quests; new ones next year.");
  return T(' · 📜 Sana bir görevi var.', ' · 📜 Has a quest for you.');
}

/** keeps what's open with this person (by tier and age) and adds the "more opens up" hint when something is waiting */
function gate(actions: ActionView[], f: number, age: AgeRel, sameGrade = false, hint = true): ActionView[] {
  const { open, next } = sortOut(actions, { tier: tierOf(f), age, sameGrade });
  if (next && hint) open.push({ id: 'next-tier', label: nextTierHint(next, age), locked: age === 'adult' ? T('Güvenini kazandıkça', 'As you earn their trust') : T('Birbirinizi tanıdıkça', 'As you get to know each other'), run: () => {} });
  return open;
}

/** what happened between you and them, from the dilemmas you've lived through (and a race or two) */
export function historyWith(st: PlayerState, id: string): string[] {
  const out: string[] = [];
  for (const m of st.memories) {
    if (m.id === 'telefon' && m.who === id) out.push(['call', 'bed'].includes(m.choice) ? 'phoneLeft' : 'phoneHelped');
    if (m.id === 'arka' && (id === 'burak' || id === 'ece')) out.push(`arka-${m.choice}`);
    if (m.id === 'parti' && m.who === id && st.once[`partner-${id}`]) out.push('partner');
  }
  if (st.once[`raced-${id}`]) out.push('raced');
  return out;
}

/** options that only exist because of something you two went through */
function historyActions(npc: NpcDef, ctx: GameCtx, lock: string | undefined): ActionView[] {
  const st = ctx.st, h = historyWith(st, npc.id);
  if (!h.length) return [];
  const say = (tr: string, en: string) => ctx.panel.message(npc.name, T(tr, en));
  const done = (key: string) => st.once[`${key}-${npc.id}`];
  const setDone = (key: string) => { st.once[`${key}-${npc.id}`] = true; };
  const out: ActionView[] = [];
  const girl = npc.gender === 'girl';
  if (h.includes('phoneHelped') && !done('phoneThanks')) out.push({
    id: 'phoneThanks', label: T('📞 Telefon gecesini anın', '📞 Remember the phone night'), hint: T('Ortak anı · bir kez · +15 arkadaşlık', 'A shared memory · once · +15 friendship'),
    locked: lock,
    run: async () => {
      setDone('phoneThanks'); nudge(ctx, { heart: 2 }); ctx.befriend(npc.id, 15); ctx.gain({ mood: 6 });
      await say(`"O gece telefon sırasında… hiç unutmadım biliyor musun? Annem o akşam sesimi duyunca rahatlamış." Bir an sustu. "Senin sıran geldiğinde ben de yanında olacağım."`,
        `"That night in the phone queue… I've never forgotten it, you know? My mum said hearing my voice that evening put her mind at rest." They paused. "When it's your turn, I'll be there too."`);
    },
  });
  if (h.includes('phoneLeft') && !done('phoneSorry')) out.push({
    id: 'phoneSorry', label: T('🙏 Telefon gecesi için özür dile', '🙏 Say sorry about the phone night'), hint: T('Ortak anı · bir kez · +12 arkadaşlık', 'A shared memory · once · +12 friendship'),
    locked: lock,
    run: async () => {
      setDone('phoneSorry'); nudge(ctx, { heart: 3, warmth: -1 }); ctx.befriend(npc.id, 12);
      await say(`"O gece seni orada ağlarken bırakıp gittim. Özür dilerim." Omuz silkti ama gözleri parladı. "Herkes evini arayamıyor işte… Ama sağ ol, söylediğin için."`,
        `"That night I left you there crying. I'm sorry." They shrugged, but their eyes brightened. "Not everyone gets to call home… But thanks for saying it."`);
    },
  });
  if (h.includes('arka-quiet') && !st.once.arkaTold) out.push({
    id: 'sawYou', label: T('🤫 "O gece sizi gördüm, kimseye söylemedim" de', '🤫 Tell them "I saw you that night, and told no one"'), hint: T('Ortak sır · bir kez · ikisiyle de +20', 'A shared secret · once · +20 with both of them'),
    locked: lock,
    run: async () => {
      st.once.arkaTold = true; nudge(ctx, { loyalty: 3, heart: 2 }); ctx.befriend('burak', 20); ctx.befriend('ece', 20);
      await say(`Önce yüzü kızardı, sonra güldü. "Demek sendin… O top hâlâ orada duruyor biliyor musun?" Elini omzuna koydu. "Sağ ol ufaklık. Bunu ${girl ? 'Burak\'a' : 'Ece\'ye'} de söyleyeceğim. Bir şeye ihtiyacın olursa bize gel."`,
        `First they went red, then they laughed. "So it was you… That ball's still lying there, you know." A hand on your shoulder. "Thanks, little one. I'll tell ${girl ? 'Burak' : 'Ece'} too. If you ever need anything, come to us."`);
    },
  });
  if ((h.includes('arka-tell') || h.includes('arka-gossip')) && !done('snitchSorry')) out.push({
    id: 'snitchSorry', label: h.includes('arka-tell') ? T('🙏 Belletmene söylediğin için özür dile', '🙏 Apologise for telling the belletmen') : T('🙏 Herkese anlattığın için özür dile', '🙏 Apologise for telling everyone'),
    hint: T('Ortak anı · bir kez · +15 arkadaşlık', 'A shared memory · once · +15 friendship'),
    locked: lock,
    run: async () => {
      setDone('snitchSorry'); nudge(ctx, { warmth: -2, heart: 2 }); ctx.befriend(npc.id, 15);
      await say('Uzun uzun yüzüne baktı. "Küçüktün, korktun herhalde… Tamam. Ama bir dahakine önce bize gel."', 'They looked at you for a long time. "You were little, you were scared, I suppose… All right. But next time come to us first."');
    },
  });
  if (h.includes('arka-deal') && !st.once.dealOver) {
    const times = [1, 2, 3].filter((i) => st.once[`lever-${i}`]).length;
    out.push({
      id: 'leverage', label: T('🤝 O geceyi hatırlat, bir şey iste', '🤝 Remind them of that night and ask for something'), hint: T('Tost ya da 10 ₺ · −8 arkadaşlık · haftada bir · uzatırsan biter', 'A toastie or 10 ₺ · −8 friendship · once a week · push it and it ends'),
      locked: lock ?? ((st.daily.leverNext ?? 0) > ctx.clock.day ? T('Bu hafta zaten istedin.', 'You already asked this week.') : undefined),
      run: async () => {
        nudge(ctx, { warmth: 3, rules: 1 }); st.daily.leverNext = ctx.clock.day + 7;
        if (times >= 3) {
          st.once.dealOver = true; ctx.befriend('burak', -15); ctx.befriend('ece', -15); ctx.gain({ mood: -4 });
          await say('"Yeter artık." Sesi sertti. "İstiyorsan git söyle, umurumda değil. Ama bizden bir şey daha bekleme."', '"That\'s enough." Their voice was hard. "Go and tell if you want, I don\'t care. But don\'t expect anything more from us."');
          return;
        }
        st.once[`lever-${times + 1}`] = true; ctx.befriend(npc.id, -8);
        if (times % 2 === 0) ctx.gain({ hunger: 30, mood: 4 }); else ctx.gain({ money: 10 });
        await say(times % 2 === 0 ? 'Gözlerini devirdi ama kantine gidip sana bir tost aldı. "Al. Unuttuk, değil mi?"' : 'İç çekip cebinden 10 ₺ çıkardı. "Son olsun bu."',
          times % 2 === 0 ? 'They rolled their eyes but went to the canteen and got you a toastie. "Here. We\'ve forgotten, right?"' : 'They sighed and took 10 ₺ out of their pocket. "Let this be the last time."');
      },
    });
  }
  if (h.includes('partner') && !done('partyPartner')) out.push({
    id: 'partyPartner', label: T('🎶 İlk partiyi anın', '🎶 Remember the first party'), hint: T('Ortak anı · bir kez · +12 arkadaşlık', 'A shared memory · once · +12 friendship'),
    locked: lock,
    run: async () => {
      setDone('partyPartner'); nudge(ctx, { heart: 2, presence: 1 }); ctx.befriend(npc.id, 12); ctx.gain({ mood: 8 });
      await say('"Halayda en önde biz vardık, hatırlıyor musun? Ayağına iki kere bastım!" İkiniz de güldünüz. "Seneye de birlikte gidelim mi?"', '"We were at the front of the halay, remember? I trod on your foot twice!" You both laughed. "Shall we go together next year too?"');
    },
  });
  if (h.includes('raced')) {
    const win = Math.max(0.2, Math.min(0.8, 0.3 + ctx.ch.attributes.fitness / 150 + (st.skills.basketball + st.skills.football) / 600));
    const indoors = ctx.place() !== 'out';
    out.push({
      id: 'rematch', label: T('🏃 Rövanş: yine yarışın', '🏃 Rematch: race again'), hint: T(`O yarıştan beri aranızda bir oyun bu · kazanma şansın %${Math.round(win * 100)} · günde bir`, `It's your thing since that race · ${Math.round(win * 100)}% chance to win · once a day`),
      locked: lock ?? (doneToday(ctx, `rematch-${npc.id}`) ? T('Bugün zaten yarıştınız.', 'You already raced today.') : indoors ? T('Yarış dışarıda yapılır.', 'Races happen outside.') : ctx.st.energy < 10 ? T('Çok yorgunsun.', "You're too tired.") : undefined),
      run: async () => {
        markToday(ctx, `rematch-${npc.id}`); nudge(ctx, { presence: 1, loyalty: 1 }); ctx.advance(15); ctx.befriend(npc.id, 6);
        const won = Math.random() < win;
        ctx.gain({ mood: won ? 6 : 2, energy: -6, attrs: { fitness: 1 } });
        await say(won ? 'Fıskiyeye yine sen önce vardın. "Yarın rövanş!" diye bağırdı, gülerek.' : 'Bu sefer o kazandı ve havaya zıpladı. "Bir–bir! Yarın yine!"',
          won ? 'You got to the fountain first again. "Rematch tomorrow!" they shouted, laughing.' : 'This time they won and jumped in the air. "One all! Again tomorrow!"');
      },
    });
  }
  return out;
}

/** what an older student (abi / abla) can do for a younger one they know */
function olderActions(npc: NpcDef, ctx: GameCtx, lock: string | undefined): ActionView[] {
  const st = ctx.st, day = ctx.clock.day;
  const once = (key: string) => (doneToday(ctx, `${key}-${npc.id}`) ? T('Bugün zaten yaptın.', 'Already done today.') : undefined);
  const mark = (key: string) => markToday(ctx, `${key}-${npc.id}`);
  const say = (tr: string, en: string) => ctx.panel.message(npc.name, T(tr, en));
  const girl = npc.gender === 'girl';
  const kantinOpen = ctx.clock.minutes >= 8 * 60 && ctx.clock.minutes < 18 * 60;
  const foes = dislikers(st).filter((n) => n.id !== npc.id);
  const worst = [...foes].sort((a, b) => (st.friends[a.id] ?? 0) - (st.friends[b.id] ?? 0))[0];
  const year = grade(st.year);
  return [
    {
      id: 'advice', label: T(`🧭 ${girl ? 'Ablana' : 'Abine'} akıl danış`, '🧭 Ask their advice'), hint: T('10 dk · burada işlerin nasıl döndüğünü anlatır · +6 arkadaşlık · günde bir', '10 min · they tell you how things work here · +6 friendship · once a day'),
      locked: lock ?? once('advice'),
      run: async () => {
        mark('advice'); nudge(ctx, { heart: 1 }); ctx.advance(10); ctx.befriend(npc.id, 6); ctx.gain({ mood: 3, xp: 5 });
        const tips: Array<[string, string]> = [
          ['Etüt 18:00\'de başlar. Beş dakika geç kalırsan belletmen yazar, üstüne bir de sana bozulur.', "Study time starts at 18:00. Five minutes late and the belletmen writes you up, and holds it against you too."],
          ['Gece Selim Hoca fenerle dolaşır. Işığına girmezsen seni görmez; gir, yandın.', "At night Mr. Selim walks round with a torch. Stay out of its beam and he won't see you; step into it and you're done."],
          ['Ödevi aldığın gün bitir. Ertesi sabah defterde yoksa Murat Hoca sıfır verir, tartışması yok.', "Finish your homework the day you get it. If it isn't in your notebook the next morning, Mr. Murat gives you a zero, no arguing."],
          ['Disiplin puanı silinir mi? Silinir. Temiz geçen her gün biraz düşer; yeter ki üst üste batırma.', "Do discipline points go away? They do. Each clean day takes a few off; just don't keep messing up."],
          ['Bir grubun olsun. Arkanda birileri varken sana bulaşan da azalır.', "Find your group. With people behind you, fewer people mess with you."],
          ['Pazartesi 08:10\'da bayrak töreni var. Kahvaltıyı uzatma, sıraya geç kalan hemen göze batar.', "The flag ceremony is Monday at 08:10. Don't linger over breakfast; anyone late to the line stands out at once."],
          ['Sınavda sadece o gün bildiklerin değil, bütün yıl okuduğun da işe yarar. Kütüphaneyi boş bırakma.', "In the exam it's not just what you know that day; everything you read during the year counts. Don't skip the library."],
        ];
        const [tr, en] = tips[(day + npc.id.length) % tips.length];
        await say(`"${tr}"`, `"${en}"`);
      },
    },
    // the errand is a little side quest: take it here, buy the soda at Şakir's canteen (Spor Salonu), bring it back
    ...(st.errand.giver === npc.id && st.errand.stage === 'got' ? [{
      id: 'errand-give', label: T('🥤 Gazozu ver', '🥤 Hand over the soda'), hint: T('+10 arkadaşlık', '+10 friendship'),
      run: async () => {
        st.errand = { giver: null, stage: 'none' };
        nudge(ctx, { warmth: -1, loyalty: 1 }); ctx.befriend(npc.id, 10); ctx.gain({ xp: 10, energy: -3 });
        const tip = Math.random() < 0.5;
        if (tip) ctx.gain({ money: 5 });
        await say(
          `Gazozu ${girl ? 'ablana' : 'abine'} uzattın, buz gibiydi.${tip ? ' "Üstü sende kalsın ufaklık." +5 ₺' : ' "Eyvallah, sağ ol."'}`,
          `You handed over the soda, ice cold.${tip ? ' "Keep the change, little one." +5 ₺' : ' "Cheers, thanks."'}`,
        );
      },
    } as ActionView] : st.errand.giver === npc.id && st.errand.stage === 'fetch' ? [{
      id: 'errand-wait', label: T('🥤 Gazoz hâlâ alınmadı', "🥤 You haven't got the soda yet"),
      locked: T('Spor Salonu\'ndaki Şakir Abi\'nin kantininden gazozu al, sonra getir.', "Get the soda at Şakir's canteen in the Spor Salonu, then bring it here."), run: () => {},
    } as ActionView] : [{
      id: 'errand', label: T('🏃 Ayak işi yap', '🏃 Run an errand for them'), hint: T('Kantinden gazoz getir · +10 arkadaşlık · günde bir', 'Fetch a soda from the canteen · +10 friendship · once a day'),
      locked: lock ?? once('errand') ?? (st.errand.stage !== 'none' ? T('Önce üstlendiğin ayak işini bitir.', 'Finish the errand you already took on first.') : kantinOpen ? undefined : T('Kantin kapalı (08:00–18:00).', 'The canteen is closed (08:00–18:00).')),
      run: async () => {
        mark('errand');
        st.errand = { giver: npc.id, stage: 'fetch' };
        await say(
          `"Ufaklık, bana kantinden bir gazoz getirir misin? Al şu parayı. Şakir Abi\'nin kantini, Spor Salonu\'nda."`,
          `"Hey kid, could you get me a soda from the canteen? Here's the money. Şakir's canteen, in the Spor Salonu."`,
        );
      },
    } as ActionView]),
    {
      id: 'protect', label: T(`🛡️ ${girl ? 'Ablandan' : 'Abinden'} arka çıkmasını iste`, '🛡️ Ask them to have your back'), hint: worst ? T(`${worst.name} seninle uğraşıyor · bir hafta kimse sana bulaşmaz · haftada bir`, `${worst.name} keeps picking on you · nobody messes with you for a week · once a week`) : T('Biri sana bulaşırsa', 'When someone picks on you'),
      locked: lock ?? (!worst ? T('Şu an sana bulaşan kimse yok.', 'Nobody is picking on you right now.') : (st.daily.protectNext ?? 0) > day ? T('Bu hafta zaten konuştu.', 'They already had a word this week.') : undefined),
      run: async () => {
        nudge(ctx, { loyalty: 2, warmth: 1 });
        st.daily.protectNext = day + 7; st.daily.protectedUntil = day + 7;
        ctx.befriend(worst!.id, 15); ctx.befriend(npc.id, 4); ctx.gain({ mood: 6 });
        await say(
          `"${worst!.name} mi? Tamam, ben bir konuşurum onunla." Ertesi gün ${worst!.name} yanından geçerken başını önüne eğdi. Bu hafta kimse sana bulaşmaz.`,
          `"${worst!.name}? Fine, I'll have a word." The next day ${worst!.name} kept their eyes down walking past you. Nobody will mess with you this week.`,
        );
      },
    },
    {
      id: 'notes', label: T(`📒 ${girl ? 'Ablanın' : 'Abinin'} eski defterlerini iste`, '📒 Ask for their old notebooks'), hint: T(`${year}. sınıftaki notları · +3 Bilgi · yıl sonu sınavında +5 · yılda bir`, `Their grade ${year} notes · +3 Knowledge · +5 in the year-end exam · once a year`),
      locked: lock ?? (st.once[`notes-${st.year}`] ? T('Bu yılın defterlerini zaten aldın.', "You've already got this year's notebooks.") : undefined),
      run: async () => {
        st.once[`notes-${st.year}`] = true; nudge(ctx, { ambition: 1, loyalty: 1 }); ctx.befriend(npc.id, 5); ctx.gain({ attrs: { knowledge: 3 }, xp: 10 });
        await say(
          `"Benim ${year}. sınıf defterlerim, hepsi burada. Kenarlarına sınavda ne çıktıysa yazdım. Kaybetme, sonra senden küçüğe verirsin."`,
          `"My grade ${year} notebooks, all of them. I wrote what came up in the exam in the margins. Don't lose them; pass them on to someone younger after."`,
        );
      },
    },
  ];
}

/** a subject teacher or the deputy head: what opens as they come to trust you */
function teacherActions(npc: NpcDef, ctx: GameCtx): ActionView[] {
  const once = (key: string) => (doneToday(ctx, `${key}-${npc.id}`) ? T('Bugün zaten yaptın.', 'Already done today.') : undefined);
  const mark = (key: string) => markToday(ctx, `${key}-${npc.id}`);
  const say = (tr: string, en: string) => ctx.panel.message(npc.name, T(tr, en));
  const subjectTeacher = npc.id.startsWith('ogr-');
  const subject = L(npc.role).replace(/ öğretmeni$| teacher$/, '');
  return [
    {
      id: 'ask', label: subjectTeacher ? T(`❓ ${subject} dersiyle ilgili soru sor`, `❓ Ask a question about ${subject}`) : T('❓ Bir şey sor', '❓ Ask something'), hint: T('10 dk · +1 Bilgi · +5 güven · günde bir', '10 min · +1 Knowledge · +5 trust · once a day'),
      locked: once('ask'),
      run: async () => {
        mark('ask'); nudge(ctx, { ambition: 1 }); ctx.advance(10); ctx.befriend(npc.id, 5); ctx.gain({ attrs: { knowledge: 1 }, xp: 5 });
        await say('"Güzel soru. Bak, şöyle düşün…" Tahtaya çizer gibi havada anlattı; sonunda kafanda bir şey yerine oturdu.', '"Good question. Look, think of it like this…" They sketched it in the air as if on a blackboard, and something clicked into place.');
      },
    },
    ...(subjectTeacher ? [{
      id: 'extra', label: T('📝 Ek çalışma iste', '📝 Ask for extra work'), hint: T('20 dk · −8 enerji · +2 Bilgi · +6 güven · günde bir', '20 min · −8 energy · +2 Knowledge · +6 trust · once a day'),
      locked: once('extra') ?? (ctx.st.energy < 8 ? T('Çok yorgunsun.', "You're too tired.") : undefined),
      run: async () => {
        mark('extra'); nudge(ctx, { ambition: 2 }); focusTick(ctx, 'study'); ctx.advance(20); ctx.befriend(npc.id, 6); ctx.gain({ attrs: { knowledge: 2 }, energy: -8, xp: 10 });
        await say('Çantasından fotokopili bir yaprak çıkardı. "Bunları çöz, yarın bana getir. Zor olanları boş bırakma, dene en azından."', 'They pulled a photocopied sheet from their bag. "Do these and bring them to me tomorrow. Don\'t leave the hard ones blank; at least try."');
      },
    }] : []),
    {
      id: 'guidance', label: T('💬 Hocanla dertleş', '💬 Talk to them about how you are'), hint: T('15 dk · +10 moral · +4 güven · günde bir', '15 min · +10 mood · +4 trust · once a day'),
      locked: once('guidance'),
      run: async () => {
        mark('guidance'); nudge(ctx, { heart: 1 }); ctx.advance(15); ctx.befriend(npc.id, 4); ctx.gain({ mood: 10 });
        await say(`"Nasılsın ${ctx.ch.first}, gerçekten? Evi özlüyor musun?" Bir süre konuştunuz. Kalkarken omzuna dokundu: "Kapım hep açık, biliyorsun."`, `"How are you, ${ctx.ch.first}, really? Do you miss home?" You talked for a while. As you got up they touched your shoulder: "My door is always open, you know that."`);
      },
    },
  ];
}

/** your belletmen and the night patrol: owning up, opening up, and (once they trust you) a little leeway */
function belletmenActions(npc: NpcDef, ctx: GameCtx): ActionView[] {
  const st = ctx.st, day = ctx.clock.day;
  const once = (key: string) => (doneToday(ctx, `${key}-${npc.id}`) ? T('Bugün zaten yaptın.', 'Already done today.') : undefined);
  const mark = (key: string) => markToday(ctx, `${key}-${npc.id}`);
  const say = (tr: string, en: string) => ctx.panel.message(npc.name, T(tr, en));
  const mine = npc.id === (ctx.ch.gender === 'girl' ? 'bel-hatice' : 'bel-mehmet');
  return [
    {
      id: 'sorry', label: T('🙏 Özür dile', '🙏 Apologise'), hint: T('+10 güven · günde bir', '+10 trust · once a day'),
      locked: once('sorry'),
      run: async () => {
        mark('sorry'); nudge(ctx, { rules: -1, warmth: -1 }); ctx.befriend(npc.id, 10);
        await say('"Bir daha olmasın." Sesi hâlâ sertti ama yüzü biraz yumuşadı.', '"Don\'t let it happen again." Their voice was still stern, but their face softened a little.');
      },
    },
    {
      id: 'confide', label: T('💬 İçini dök', '💬 Open up to them'), hint: T('10 dk · +10 moral · +3 güven · günde bir', '10 min · +10 mood · +3 trust · once a day'),
      locked: once('confide'),
      run: async () => {
        mark('confide'); nudge(ctx, { heart: 2 }); ctx.advance(10); ctx.befriend(npc.id, 3); ctx.gain({ mood: 10 });
        await say(`Evi özlediğini, bazı geceler uyuyamadığını anlattın. Dinledi, sonra çayını uzattı. "Herkes ilk sene böyledir ${ctx.ch.first}. Geçer. Ben buradayım."`, `You told them you miss home and some nights can't sleep. They listened, then passed you their tea. "Everyone's like this the first year, ${ctx.ch.first}. It passes. I'm here."`);
      },
    },
    ...(mine ? [{
      id: 'pass', label: T('🎟️ Etüte geç gelmek için izin iste', '🎟️ Ask to be late for study time'), hint: T('Bugün 18:30\'a kadar geç sayılmazsın · haftada bir', "You won't count as late until 18:30 today · once a week"),
      locked: (st.daily.passNext ?? 0) > day ? T('Bu hafta zaten izin aldın.', 'You already had leave this week.')
        : !hasEtut(day) || ctx.clock.minutes >= ETUT_START ? T('Etütten önce sorman lazım.', 'You have to ask before study time.') : undefined,
      run: async () => {
        nudge(ctx, { rules: 1 }); st.daily.etutPass = day; st.daily.passNext = day + 7;
        await say('"Peki. Ama 18:30\'da masanda ol, bir dakika bile geç kalma. Sana güvendiğim için."', '"All right. But be at your desk by 18:30, not a minute later. Only because I trust you."');
      },
    }] : []),
  ];
}

/** the card at the top of anyone's panel: what kind of person they are and their story */
function profileFor(npc: NpcDef, ctx: GameCtx, met: boolean) {
  const p = personaOf(npc);
  const kind = npc.kind === 'teacher' ? (npc.id === DEPUTY.id ? T('Müdür yardımcısı', 'Deputy head') : T('Öğretmen', 'Teacher'))
    : npc.kind === 'belletmen' ? T('Belletmen', 'Belletmen')
      : npc.kind === 'abi' ? (npc.gender === 'girl' ? T('Abla · lise', 'Older student · high school') : T('Abi · lise', 'Older student · high school'))
        : npc.kind === 'classmate' ? T(`Sınıf arkadaşın${ctx.st.once.classDrawn ? ` · ${ctx.st.school.classLabel}` : ''}`, `Classmate${ctx.st.once.classDrawn ? ` · ${ctx.st.school.classLabel}` : ''}`)
          : T(`Öğrenci${npc.grade ? ` · ${npc.grade}. sınıf` : ''}`, `Student${npc.grade ? ` · grade ${npc.grade}` : ''}`);
  const tags = [kind];
  // where they're from is something they tell you themselves
  if (npc.kind !== 'teacher' && npc.kind !== 'belletmen' && met) tags.push(`📍 ${bioOf(npc).from}`);
  return { look: { ...DEFAULT_LOOK, ...npc.look }, type: L(p.type), tags, story: L(p.about) };
}

/** talking to a classmate or an older student */
export function npcPanel(npc: NpcDef, ctx: GameCtx): PanelView {
  const f = Math.round(ctx.st.friends[npc.id] ?? 0);
  const line = lineNow(npc, ctx);
  const talks = Object.keys(ctx.st.daily).filter((k) => k.startsWith(`talk-${npc.id}-`) && ctx.st.daily[k] === ctx.clock.day).length;
  const met = !!ctx.st.once[`met-${npc.id}`];
  const bio = bioOf(npc);
  const about = met ? T(` · ${bio.from} · ${L(bio.likes)} sever`, ` · from ${bio.from} · likes ${L(bio.likes)}`) : '';
  const actions: ActionView[] = [];
  if (npc.kind === 'belletmen') {
    actions.push({
      id: 'hello', label: T('Selam ver', 'Say hello'),
      run: async () => { await ctx.panel.message(npc.name, `"${L(line)}"`); },
    });
    actions.push({
      id: 'help', label: T('Belletmene yardım et', 'Help the belletmen'), hint: T('15 dk · +8 ilişki (günde bir)', '15 min · +8 relationship (once a day)'),
      locked: doneToday(ctx, `help-${npc.id}`) ? T('Bugün zaten yardım ettin.', 'You already helped today.') : undefined,
      run: () => { nudge(ctx, { rules: -2 }); markToday(ctx, `help-${npc.id}`); ctx.advance(15); ctx.befriend(npc.id, 8); ctx.toast(T(`${npc.name} ile meydandaki küçükleri yoklamaya topladınız.`, `You helped ${npc.name} round up the little ones for roll call.`), 'good'); },
    });
    actions.push(...gate(belletmenActions(npc, ctx), f, 'adult'));
  } else if (npc.kind === 'teacher') {
    actions.push({
      id: 'hello', label: T('Selam ver', 'Say hello'), hint: T('+2 güven · günde bir', '+2 trust · once a day'),
      run: async () => { if (!doneToday(ctx, `hello-${npc.id}`)) { markToday(ctx, `hello-${npc.id}`); ctx.befriend(npc.id, 2); } await ctx.panel.message(npc.name, `"${L(line)}"`); },
    });
    actions.push(...gate(teacherActions(npc, ctx), f, 'adult'));
  } else if (npc.kind === 'classmate' || npc.kind === 'student') {
    const lock = met ? undefined : T(`Önce ${npc.name} ile tanış.`, `Get to know ${npc.name} first.`);
    if (!met) actions.push(meetAction(npc, ctx));
    actions.push({
      id: 'chat', label: T('Sohbet et', 'Chat'), hint: T('+15 arkadaşlık · günde 2 kez', '+15 friendship · twice a day'),
      locked: lock ?? (talks >= 2 ? T(`${npc.name} şimdilik başka işlerle meşgul. Yarın tekrar konuş.`, `${npc.name} is busy for now. Talk again tomorrow.`) : undefined),
      run: async () => { nudge(ctx, { heart: 1 }); focusTick(ctx, 'friends');
        ctx.st.daily[`talk-${npc.id}-${talks + 1}`] = ctx.clock.day;
        ctx.advance(10);
        ctx.befriend(npc.id, 15);
        ctx.gain({ attrs: { social: 1 }, mood: 2, xp: 5 });
        await ctx.panel.message(npc.name, `"${L(line)}"`);
      },
    });
    actions.push({
      id: 'treat', label: T('Simit ikram et (5 ₺)', 'Share a simit (5 ₺)'), hint: T('+12 arkadaşlık · günde bir', '+12 friendship · once a day'),
      locked: lock ?? (doneToday(ctx, `treat-${npc.id}`) ? T('Bugün zaten ikram ettin.', 'You already shared a treat today.') : ctx.st.money < 5 ? T('Paran yetmiyor.', "You can't afford it.") : undefined),
      run: () => { nudge(ctx, { warmth: -2 }); focusTick(ctx, 'friends');
        markToday(ctx, `treat-${npc.id}`);
        ctx.gain({ money: -5, mood: 3 });
        ctx.befriend(npc.id, 12);
        ctx.toast(T(`${npc.name}: "Teşekkürler, çok naziksin!"`, `${npc.name}: "Thanks, that's so kind!"`), 'good');
      },
    });
    if (hasSecret(ctx.st, 'teselli')) actions.push({
      id: 'comfort', label: T('🤗 Teselli et', '🤗 Comfort them'), hint: T('Gizli yetenek · 10 dk · +15 arkadaşlık · günde bir', 'Secret skill · 10 min · +15 friendship · once a day'),
      locked: lock ?? (doneToday(ctx, `comfort-${npc.id}`) ? T('Bugün zaten teselli ettin.', 'You already comforted them today.') : undefined),
      run: async () => {
        markToday(ctx, `comfort-${npc.id}`); nudge(ctx, { warmth: -1 }); focusTick(ctx, 'friends'); ctx.advance(10); ctx.befriend(npc.id, 15); ctx.gain({ mood: 4 });
        await ctx.panel.message(npc.name, T('Yanına oturdun ve sadece dinledin. "…Sağ ol. Buna ihtiyacım vardı."', 'You sat with them and just listened. "…Thanks. I needed that."'));
      },
    });
    actions.push(...socialActions(npc, ctx, f, lock), ...olderActions(npc, ctx, lock), ...historyActions(npc, ctx, lock));
    // what's open depends on how close you are and how old they are (game/interactions.ts)
    const mine = grade(ctx.st.year);
    const open = gate(actions, f, ageRel(npc, mine), (npc.grade ?? mine) === mine, met);
    actions.length = 0;
    actions.push(...open);
  } else {
    const st = ctx.st;
    const lock = needMission(ctx, 'abi_sandvic');
    const mine = st.favor.giver === npc.id;
    const giver = GIVER_IDS.includes(npc.id);
    if (!met) actions.push(meetAction(npc, ctx));
    if (giver) actions.push(...questActions(npc, ctx, met));
    // (the quest givers have their own quests; the sandwich favor is for the other abis and ablas)
    else if (st.favor.stage === 'none') {
      actions.push({
        id: 'offer', label: T('Yardım teklif et', 'Offer to help'), hint: T('Bir rica', 'A small favor'),
        locked: lock,
        run: async () => { nudge(ctx, { warmth: -1, loyalty: 1 });
          st.favor = { giver: npc.id, stage: 'accepted' };
          ctx.befriend(npc.id, 5);
          await ctx.panel.message(npc.name, T('"Ah, süpersin! Şu kitabı benim yerime Kütüphane\'ye iade eder misin? Antrenmana yetişmem lazım. Dönünce bir sandviç ısmarlarım!"', '"Oh, you\'re a star! Could you return this book to the library for me? I have to get to practice. I\'ll buy you a sandwich when you\'re back!"'));
        },
      });
    } else if (mine && st.favor.stage === 'accepted') {
      actions.push({ id: 'wait', label: T('Kitap hâlâ çantanda', 'The book is still in your bag'), locked: T('Önce kitabı Kütüphane\'ye (Eğitim Binası) iade et.', 'Return the book to the library (academic building) first.'), run: () => {} });
    } else if (mine && st.favor.stage === 'done') {
      actions.push({
        id: 'sandwich', label: T('Sandviçini al', 'Get your sandwich'), hint: T('+40 tokluk · +15 moral', '+40 fullness · +15 mood'),
        run: async () => {
          st.favor.stage = 'rewarded';
          ctx.befriend(npc.id, 15);
          ctx.gain({ hunger: 40, mood: 15, xp: 20 });
          await ctx.panel.message(npc.name, T('"Eline sağlık ufaklık! Al, bu sandviç senin. Bir şeye ihtiyacın olursa bana gel."', '"Thanks, little one! Here, this sandwich is yours. Come to me if you ever need anything."'));
        },
      });
    }
    actions.push({
      id: 'hello', label: T('Selam ver', 'Say hello'), hint: T('+5 arkadaşlık · günde bir', '+5 friendship · once a day'),
      locked: doneToday(ctx, `hello-${npc.id}`) ? T('Bugün zaten selamlaştınız.', 'You already said hello today.') : undefined,
      run: async () => { markToday(ctx, `hello-${npc.id}`); ctx.befriend(npc.id, 5); await ctx.panel.message(npc.name, `"${L(line)}"`); },
    });
    const lockMet = met ? undefined : T(`Önce ${npc.name} ile tanış.`, `Get to know ${npc.name} first.`);
    actions.push(...olderActions(npc, ctx, lockMet), ...historyActions(npc, ctx, lockMet));
    const open = gate(actions, f, ageRel(npc, grade(st.year)), false, met);
    actions.length = 0;
    actions.push(...open);
  }
  return {
    title: npc.name, sub: L(npc.role), status: status(ctx), profile: profileFor(npc, ctx, met),
    rooms: [{
      id: 'talk', name: npc.name,
      note: npc.kind === 'teacher' ? `${L(npc.role)} · ${trustLine(f)}` : npc.kind === 'belletmen' ? T(`Gece öğretmeni · ${trustLine(f)}. Geç kalırsan bozulur; düşükse seni daha sıkı izler.`, `Night teacher · ${trustLine(f)}. Being late hurts it; if it's low, they watch you more closely.`)
        : `${f >= FRIEND_AT ? '💛 ' : ''}${L(friendLevel(f))} · ${f}/100${npc.kind === 'classmate' && f < FRIEND_AT ? T(` (arkadaşlık için ${FRIEND_AT})`, ` (${FRIEND_AT} to be friends)`) : ''}${about}${met ? '' : T(' · henüz tanışmadınız', " · you haven't met yet")}${GIVER_IDS.includes(npc.id) ? questNote(npc, ctx) : ''}`,
      actions,
    }],
  };
}

/** the main gate: the weekend bus for evci students, visiting day for daimi students */
export function gatePanel(ctx: GameCtx): PanelView {
  const st = ctx.st;
  const { day, minutes } = ctx.clock;
  const evci = (ctx.ch.boarding ?? 'daimi') === 'evci';
  const guardian = L(GUARDIANS.find((g) => g.id === ctx.ch.guardian)!.your);
  const actions: ActionView[] = [];
  if (evci) {
    const busTime = isFriday(day) && minutes >= BUS_BOARDING && minutes < BUS_LEAVES;
    actions.push({
      id: 'bus', label: T('🚌 Servise bin, eve git', '🚌 Take the bus home'), hint: T('Pazar 17:40\'ta dönersin', 'You come back on Sunday at 17:40'),
      locked: !st.school.registered ? needRegistration(ctx)
        : !busTime ? T('Servis Cuma 15:20–17:00 arası kalkar.', 'The bus leaves on Fridays between 15:20 and 17:00.') : undefined,
      run: async () => {
        const plan = await ctx.panel.choose(T('Hafta sonu evde ne yapacaksın?', 'What will you do at home this weekend?'), [
          { id: 'family', label: T('👪 Ailenle vakit geçir', '👪 Spend time with family'), hint: T('+25 moral · +10 sağlık', '+25 mood · +10 health') },
          { id: 'friends', label: T('⚽ Mahalle arkadaşlarınla oyna', '⚽ Play with friends back home'), hint: T('+15 moral · +Sosyallik · +Kondisyon', '+15 mood · +Social · +Fitness') },
          { id: 'study', label: T('📚 Ders çalış', '📚 Study'), hint: T('+3 Bilgi · ödevlerin biter', '+3 Knowledge · finishes your homework') },
          { id: 'rest', label: T('😴 Dinlen', '😴 Rest'), hint: T('+15 sağlık · +8 moral', '+15 health · +8 mood') },
        ]);
        if (!plan) return;
        let text = '';
        if (plan === 'family') { st.health = clamp(st.health + 10); ctx.gain({ mood: 25 }); text = T(`${guardian} en sevdiğin yemeği yaptı; bütün akşam sohbet ettiniz.`, `${guardian} cooked your favourite meal and you talked all evening.`); }
        if (plan === 'friends') { ctx.gain({ mood: 15, attrs: { social: 2, fitness: 1 } }); text = T('Mahalledeki eski arkadaşlarınla sokakta top oynadın. Herkes Daçka\'yı sordu!', 'You played football in the street with your old friends. Everyone asked about Daçka!'); }
        if (plan === 'study') {
          const n = st.school.homework.length;
          st.school.homework.forEach((h) => st.school.scores[h.s].push(80));
          st.school.homework = [];
          ctx.gain({ attrs: { knowledge: 3 }, mood: -2 }); text = n ? T(`${n} ödevini bitirdin ve konuları tekrar ettin.`, `You finished ${n} homework assignment(s) and revised.`) : T('Konuları tekrar ettin.', 'You revised your lessons.');
        }
        if (plan === 'rest') { st.health = clamp(st.health + 15); ctx.gain({ mood: 8 }); text = T('Bol bol uyudun ve hiçbir şey yapmadın. Harikaydı.', 'You slept in and did absolutely nothing. It was great.'); }
        ctx.gain({ money: 20 });
        ctx.panel.close();
        ctx.goHome(`${text} ${T(`${guardian} sana 20 ₺ harçlık verdi.`, `${guardian} gave you 20 ₺ pocket money.`)}`);
      },
    });
  }
  actions.push(carsiAction(ctx));
  return {
    title: 'Ana Kapı', sub: evci ? T('Sen evcisin', "You're evci (home at weekends)") : T('Sen daimisin', "You're daimi (you stay at weekends)"), status: status(ctx),
    rooms: [{
      id: 'gate', name: 'Ana Kapı',
      note: evci
        ? T('Cuma 15:20–17:00 arası servis burada bekler. Pazar 17:40\'ta dönersin.', 'On Fridays the bus waits here from 15:20 to 17:00. You come back on Sunday at 17:40.')
        : T('Hafta sonları okuldasın. Ailen Çarşamba çarşı izninde kantine gelir.', 'You stay at school at weekends. Your family comes to the canteen on Wednesday afternoons.'),
      actions,
    }],
  };
}

// ---------------- Wednesday "çarşı izni": your family visits at the canteen ----------------

function guardianName(ctx: GameCtx): string {
  return L(GUARDIANS.find((g) => g.id === ctx.ch.guardian)!.your);
}

/** on Wednesday afternoons your family waits for you at the canteen */
function visitActions(ctx: GameCtx): ActionView[] {
  if (!familyVisitNow(ctx.clock.day, ctx.clock.minutes)) return [];
  const g = guardianName(ctx);
  // the visit runs until a quarter of an hour before evening study, however late it starts
  const left = FAMILY_VISIT_END - ctx.clock.minutes;
  const until = fmtTime(FAMILY_VISIT_END);
  return [{
    id: 'wedvisit', label: T(`👪 ${g} seni bekliyor!`, `👪 ${g} is waiting for you!`), hint: T(`Çarşı izni · ${until}'e kadar (${left} dk) · +18 moral · harçlık`, `Wednesday visit · until ${until} (${left} min) · +18 mood · pocket money`),
    locked: doneToday(ctx, 'wedvisit') ? T('Bugün ailenle zaten görüştün.', 'You already saw your family today.') : undefined,
    run: async () => {
      markToday(ctx, 'wedvisit');
      ctx.advance(left, { wait: true, label: T(`👪 ${g} ile kantindesin · ${until}'te biter`, `👪 At the canteen with ${g} · ends at ${until}`) }); // (online you spend it, counted down; you can cut it short)
      ctx.gain({ mood: 18, money: 20, hunger: 30 });
      const where = familyTreat(ctx, 'kurabiye');
      await ctx.panel.message(T('Çarşı izni', 'Wednesday visit'), T(
        `${g} kantinde seni bekliyordu. Şakir Abi'den iki sosisli aldınız, haftanı anlattın. Saat ${until}'te etüt için vedalaştınız; giderken eline 20 ₺ ve ev yapımı kurabiye tutuşturdu. Etüt 18:00'de: yurduna yetiş!${where.tr}`,
        `${g} was waiting at the canteen. You got two of Şakir's hot dogs and told them all about your week. At ${until} you said goodbye for evening study; on the way out they slipped you 20 ₺ and homemade cookies. Study starts at 18:00: get back to your dorm!${where.en}`,
      ));
    },
  }];
}

/** from the 6th grade: a few hours in town on Wednesday afternoon */
function carsiAction(ctx: GameCtx): ActionView {
  const { day, minutes } = ctx.clock;
  const st = ctx.st;
  return {
    id: 'carsi', label: T('🛍️ Çarşıya çık', '🛍️ Go into town'), hint: T(`Çarşamba ${fmtTime(CARSI_START)}–${fmtTime(CARSI_END)} · 2 saat · 6. sınıftan itibaren`, `Wednesdays ${fmtTime(CARSI_START)}–${fmtTime(CARSI_END)} · 2 hours · from the 6th grade`),
    locked: st.year < CARSI_OUT_FROM_YEAR && !DEV ? T('Çarşıya 6. sınıftan itibaren çıkabilirsin.', 'You can go into town from the 6th grade.')
      : !carsiNow(day, minutes) ? T(`Çarşı izni Çarşamba ${fmtTime(CARSI_START)}–${fmtTime(CARSI_END)}.`, `Town leave is on Wednesdays ${fmtTime(CARSI_START)}–${fmtTime(CARSI_END)}.`)
        : minutes > CARSI_END - 60 ? T('Etüde yetişemezsin; bir dahaki çarşamba!', "You wouldn't be back for study; next Wednesday!")
          : doneToday(ctx, 'carsi') ? T('Bugün zaten çarşıdaydın.', 'You were already in town today.') : undefined,
    run: async () => {
      const pick = await ctx.panel.choose(T('Çarşıda ne yapacaksın?', 'What will you do in town?'), [
        { id: 'doner', label: T('🥙 Dönerciye git · 20 ₺', '🥙 Go for döner · 20 ₺'), hint: T('+50 tokluk · +10 moral', '+50 fullness · +10 mood') },
        { id: 'kirtasiye', label: T('✏️ Kırtasiye & oyuncakçı · 15 ₺', '✏️ Stationery & toy shop · 15 ₺'), hint: T('+12 moral · +1 Yaratıcılık', '+12 mood · +1 Creativity') },
        { id: 'kafe', label: T('🎮 İnternet kafe · 10 ₺', '🎮 Internet café · 10 ₺'), hint: T('+15 moral · −10 enerji', '+15 mood · −10 energy') },
        { id: 'yuru', label: T('🚶 Sahilde yürü · ücretsiz', '🚶 Walk by the sea · free'), hint: T('+8 moral · +5 sağlık', '+8 mood · +5 health') },
      ]);
      if (!pick) return;
      const cost = { doner: 20, kirtasiye: 15, kafe: 10, yuru: 0 }[pick as 'doner'] ?? 0;
      if (st.money < cost) { ctx.toast(T('Paran yetmiyor.', "You can't afford it.")); return; }
      markToday(ctx, 'carsi');
      ctx.gain({ money: -cost });
      if (pick === 'doner') ctx.gain({ hunger: 50, mood: 10 });
      if (pick === 'kirtasiye') ctx.gain({ mood: 12, attrs: { creativity: 1 } });
      if (pick === 'kafe') ctx.gain({ mood: 15, energy: -10 });
      if (pick === 'yuru') { ctx.gain({ mood: 8 }); st.health = clamp(st.health + 5); }
      ctx.advance(120, { wait: true, label: T('🛍️ Çarşıdasın', '🛍️ Out in town') }); // (online you spend these two hours, counted down)
      await ctx.panel.message(T('Çarşı izni', 'Town leave'), T('İki saat dışarıdaydın. Kapıdaki görevli saatine baktı: "Tam zamanında, aferin."', 'You were out for two hours. The guard at the gate checked his watch: "Right on time, well done."'));
    },
  };
}

// ---------------- the dorm payphone ----------------

export function phonePanel(ctx: GameCtx): PanelView {
  const st = ctx.st;
  const g = guardianName(ctx);
  const night = phaseOf(ctx.clock.minutes, ctx.clock.day) === 'night';
  return {
    title: T('Ankesörlü telefon', 'Payphone'), sub: T(`Telefon kartın: ${st.phoneUnits} kontör`, `Phone card: ${st.phoneUnits} units`), status: status(ctx),
    rooms: [{
      id: 'phone', name: T('Telefon', 'Phone'),
      note: T('Koridordaki kartlı telefon. Önünde hep küçük bir sıra olur.', 'The card phone in the corridor. There is always a little queue.'),
      actions: [{
        id: 'call', label: T('📞 Evi ara', '📞 Call home'), hint: T(`${PHONE_CARD.perCall} kontör · 10 dk · +12 moral`, `${PHONE_CARD.perCall} units · 10 min · +12 mood`),
        locked: night ? T('Işıklar söndükten sonra telefon yasak.', 'No phone calls after lights out.')
          : st.phoneUnits < PHONE_CARD.perCall ? T('Telefon kartın yok ya da bitti. Kantinden al.', 'No phone card, or it ran out. Buy one at the canteen.')
            : doneToday(ctx, 'call') ? T('Bugün zaten aradın; sıradakilere de yer bırak.', 'You already called today; give the others a turn.') : undefined,
        run: async () => { nudge(ctx, { heart: 1 });
          // in the evening the queue is long, and someone behind you is crying
          if (!dilemmaDone(st, 'telefon') && ctx.clock.minutes >= 19 * 60 + 55) { await runDilemma(ctx, 'telefon'); return; }
          markToday(ctx, 'call');
          st.phoneUnits -= PHONE_CARD.perCall;
          ctx.advance(10);
          ctx.gain({ mood: 12 });
          const talks = [
            T(`${g} sesini duyunca çok sevindi. "Yemeklerini yiyor musun?" diye üç kere sordu.`, `${g} was so happy to hear your voice and asked three times whether you were eating properly.`),
            T(`${g} evdeki haberleri anlattı. Kapatırken "Seninle gurur duyuyoruz" dedi.`, `${g} told you the news from home. Before hanging up: "We're proud of you."`),
            T(`Kontör bitmek üzereyken ${g.toLowerCase()} hızlıca "Hafta sonu görüşürüz!" diye yetiştirdi.`, `As the units ran out, ${g.toLowerCase()} just managed: "See you soon!"`),
          ];
          await ctx.panel.message(T('Telefon', 'Phone call'), talks[ctx.clock.day % talks.length]);
        },
      }],
    }],
  };
}

// ---------------- music room (academic building) ----------------

const INSTRUMENTS: Array<{ id: InstrumentId; name: Text }> = [
  { id: 'gitar', name: { tr: 'Gitar', en: 'Guitar' } },
  { id: 'bas', name: { tr: 'Bas gitar', en: 'Bass guitar' } },
  { id: 'davul', name: { tr: 'Davul', en: 'Drums' } },
  { id: 'klavye', name: { tr: 'Klavye', en: 'Keyboard' } },
  { id: 'keman', name: { tr: 'Keman', en: 'Violin' } },
  { id: 'flut', name: { tr: 'Flüt', en: 'Flute' } },
];
const SHOW_SKILL = 40;

function musicRoom(ctx: GameCtx): RoomView {
  const st = ctx.st;
  const m = st.music;
  const inst = INSTRUMENTS.find((i) => i.id === m.instrument);
  const lessonNow = currentPeriod(ctx.clock.day, ctx.clock.minutes)?.kind === 'lesson';
  const actions: ActionView[] = [];
  if (!m.instrument) {
    actions.push({
      id: 'pick', label: T('🎸 Bir enstrüman seç', '🎸 Pick an instrument'), hint: T('5. sınıftan itibaren · mandolin sertifikası gerekir', 'From the 5th grade · needs the mandolin certificate'),
      locked: !m.mandolinDone ? T(`Önce 4. sınıftaki mandolin kursunu bitirmelisin: Müzik derslerinde mandolin çal (${m.mandolin}/${MANDOLIN_LESSONS}).`, `You need to finish the 4th-grade mandolin course first: play the mandolin in Music lessons (${m.mandolin}/${MANDOLIN_LESSONS}).`)
        : st.year < 2 && !DEV ? T('Enstrüman seçimi 5. sınıfta.', 'You pick an instrument in the 5th grade.') : undefined,
      run: async () => {
        const id = await ctx.panel.choose(T('Hangi enstrüman?', 'Which instrument?'), INSTRUMENTS.map((i) => ({ id: i.id, label: L(i.name) })));
        if (!id) return;
        m.instrument = id as InstrumentId;
        ctx.toast(T(`Artık ${L(INSTRUMENTS.find((i) => i.id === id)!.name).toLowerCase()} çalıyorsun!`, `You now play the ${L(INSTRUMENTS.find((i) => i.id === id)!.name).toLowerCase()}!`), 'good');
      },
    });
  } else {
    actions.push({
      id: 'practice', label: T(`🎵 ${L(inst!.name)} çalış (seviye ${m.skill})`, `🎵 Practise ${L(inst!.name).toLowerCase()} (level ${m.skill})`), hint: T('45 dk · ritim oyunu · günde bir', '45 min · rhythm game · once a day'),
      locked: lessonNow ? T('Ders saatinde müzik odası boş değil.', 'The music room is busy during lessons.') : doneToday(ctx, 'practice') ? T('Bugün yeterince çalıştın.', "You've practised enough today.") : undefined,
      run: async () => { nudge(ctx, { ambition: 1 }); focusTick(ctx, 'art');
        markToday(ctx, 'practice');
        const hits = await ctx.panel.rhythm(L(inst!.name), T('Ritmi yakala!', 'Catch the beat!'), 10, musicSpeed(ctx, 0.42 + m.skill / 300));
        ctx.advance(45);
        m.skill = Math.min(100, m.skill + 2 + Math.round(hits / 2));
        ctx.gain({ xp: 12 + hits, attrs: { creativity: 1 } });
        ctx.toast(T(`${L(inst!.name)} seviyesi: ${m.skill}`, `${L(inst!.name)} level: ${m.skill}`), 'good');
      },
    });
    if (!m.path) {
      actions.push({
        id: 'path', label: T('Yolunu seç: grup mu, solo mu?', 'Choose your path: band or solo?'), hint: T(`Seviye ${SHOW_SKILL}\'tan itibaren sahneye çıkarsın`, `From level ${SHOW_SKILL} you can go on stage`),
        run: async () => {
          const p = await ctx.panel.choose(T('Nasıl devam edeceksin?', 'How will you carry on?'), [
            { id: 'band', label: T('🤘 Okulun rock grubuna katıl', "🤘 Join the school's rock band"), hint: T('Rock müzik yarışmalarına katılırsınız', 'You enter rock music competitions together') },
            { id: 'solo', label: T('🎼 Solo devam et', '🎼 Carry on solo'), hint: T('Her yıl bir solo resital verirsin', 'You give a solo recital every year') },
          ]);
          if (p) nudge(ctx, p === 'band' ? { loyalty: 3 } : { loyalty: -3 });
          if (p) { m.path = p as 'band' | 'solo'; ctx.toast(p === 'band' ? T('Gruba katıldın! Provalar perşembe akşamüstü.', 'You joined the band! Rehearsals on Thursday afternoons.') : T('Solo yolunu seçtin.', 'You chose the solo path.'), 'good'); }
        },
      });
    } else {
      const band = m.path === 'band';
      actions.push({
        id: 'show', label: band ? T('🏆 Rock müzik yarışmasına katıl', '🏆 Enter the rock music competition') : T('🎤 Solo resital ver', '🎤 Give a solo recital'),
        hint: T(`Yılda bir · seviye ${SHOW_SKILL}+`, `Once a year · level ${SHOW_SKILL}+`),
        locked: m.shows.includes(st.year) ? T('Bu yılki sahneni yaptın.', "You've had your stage moment this year.")
          : m.skill < SHOW_SKILL ? T(`Önce seviye ${SHOW_SKILL}\'a ulaş (${m.skill}).`, `Reach level ${SHOW_SKILL} first (${m.skill}).`) : undefined,
        run: async () => { nudge(ctx, { presence: 3, ambition: 2 }); focusTick(ctx, 'art');
          const hits = await ctx.panel.rhythm(band ? T('Final şarkısı', 'Final song') : T('Resital', 'Recital'), T('Sahnedesin, herkes seni izliyor!', "You're on stage, everyone is watching!"), 14, musicSpeed(ctx, 0.5 + m.skill / 250));
          m.shows.push(st.year);
          ctx.advance(120);
          const great = hits >= 11;
          ctx.gain({ xp: great ? 200 : 80, mood: great ? 20 : 8, attrs: { creativity: great ? 4 : 2, social: band ? 2 : 0 } });
          await ctx.panel.message(band ? T('Rock yarışması', 'Rock competition') : T('Solo resital', 'Solo recital'), great
            ? (band ? T('Grubunuz birinci oldu! 🏆 Kupayı müzik odasının rafına koydunuz.', 'Your band won! 🏆 The trophy now sits on the music room shelf.') : T('Ayakta alkışlandın! 👏', 'A standing ovation! 👏'))
            : T(`${hits}/14 nota. Biraz heyecanlandın ama sahneye çıkmak bile cesaretti.`, `${hits}/14 notes. A bit nervous, but getting on stage took courage.`));
        },
      });
    }
  }
  return {
    id: 'muzik', name: T('Müzik odası', 'Music room'),
    note: m.mandolinDone
      ? T(`Duvarda mandolinler, köşede bir davul seti. ${TEACHERS.muzik.name}: "Mandolin sertifikan var; artık kendi enstrümanını seçebilirsin."`, `Mandolins on the wall, a drum kit in the corner. ${TEACHERS.muzik.name}: "You have your mandolin certificate; now you can choose your own instrument."`)
      : T(`Duvarda mandolinler, köşede bir davul seti. ${TEACHERS.muzik.name}: "4. sınıfta herkes mandolinle başlar: Müzik derslerinde birlikte çalıyoruz." (Mandolin kursu: ${m.mandolin}/${MANDOLIN_LESSONS})`, `Mandolins on the wall, a drum kit in the corner. ${TEACHERS.muzik.name}: "In the 4th grade everyone starts with the mandolin: we play it together in Music lessons." (Mandolin course: ${m.mandolin}/${MANDOLIN_LESSONS})`),
    actions,
  };
}

// ---------------- student council ----------------

/** this year's race (a new school year starts a fresh one) */
function councilNow(ctx: GameCtx): PlayerState['council'] {
  const c = ctx.st.council;
  if (c.year !== ctx.st.year) Object.assign(c, { year: ctx.st.year, stage: 'none', day: 0, support: 0 });
  return c;
}

/** a school day `plus` days from now (elections don't happen at weekends) */
function schoolDayAfter(day: number, plus: number): number {
  let d = day + plus;
  while (isWeekend(d)) d++;
  return d;
}

const whenText = (ctx: GameCtx, day: number) => {
  const n = day - ctx.clock.day;
  return n <= 0 ? T('bugün', 'today') : n === 1 ? T('yarın', 'tomorrow') : T(`${n} gün sonra`, `in ${n} days`);
};

const RIVALS = ['Kerem', 'Ela', 'Bora', 'Nehir', 'Arda', 'Duru', 'Kaan', 'Lina', 'Efe', 'Mira', 'Tuna', 'Asya'];

/** promise + speech, then the count. Returns true if you won. */
async function runElection(ctx: GameCtx, level: 'class' | 'grade' | 'school'): Promise<boolean> {
  const st = ctx.st;
  const ch = ctx.ch;
  const c = councilNow(ctx);
  const promise = await ctx.panel.choose(T('Seçim vaadin ne?', "What's your campaign promise?"), [
    { id: 'kantin', label: T('🥪 Kantinde daha ucuz tost', '🥪 Cheaper toasties at the canteen'), hint: T('Herkes sever', 'Everyone loves it') },
    { id: 'spor', label: T('⚽ Teneffüste sahalar herkese açık', '⚽ Courts open to all at break'), hint: T('Kondisyonun yardım eder', 'Your Fitness helps') },
    { id: 'muzik', label: T('🎸 Her cuma müzik saati', '🎸 Music hour every Friday'), hint: T('Yaratıcılığın yardım eder', 'Your Creativity helps') },
    { id: 'ders', label: T('📚 Etütte ders yardımlaşma grupları', '📚 Study-buddy groups at evening study'), hint: T('Bilgin yardım eder', 'Your Knowledge helps') },
  ]);
  if (!promise) return false;
  const a = ch.attributes;
  const promiseBonus = { kantin: 8, spor: 4 + a.fitness / 8, muzik: 4 + a.creativity / 8, ders: 4 + a.knowledge / 8 }[promise as 'kantin'] ?? 4;
  const hits = await ctx.panel.rhythm(T('Seçim konuşması', 'Election speech'), T('Kalabalığın alkış ritmini yakala!', "Catch the crowd's clapping rhythm!"), 8, 0.42 * (1 - ctx.ch.attributes.social / 300)); // (a sociable speaker keeps the crowd with them)
  const classmates = NPCS.filter((n) => n.kind === 'classmate');
  const friendsInClass = classmates.filter((n) => (st.friends[n.id] ?? 0) >= FRIEND_AT).length;
  const friendsAll = NPCS.filter((n) => (st.friends[n.id] ?? 0) >= FRIEND_AT).length;
  const reach = level === 'class' ? friendsInClass * 5 : friendsAll * 3;
  const mine = 35 + reach + a.social * 0.5 + ch.respect * (level === 'class' ? 0.08 : 0.15) - st.discipline * 0.6 + c.support + hits * 3 + promiseBonus + Math.random() * 12;
  const [lo, hi, count, voters] = level === 'class' ? [45, 70, 2, 25] : level === 'grade' ? [55, 80, 4, 125] : [65, 90, 2, 640];
  const g = grade(st.year);
  const myLetter = st.school.classLabel.split('-')[1] ?? 'A';
  const otherLetters = CLASS_LETTERS.filter((l) => l !== myLetter);
  const names = [...RIVALS].sort(() => Math.random() - 0.5).slice(0, count);
  const field = [
    { name: `${ch.first} (${T('sen', 'you')})`, score: Math.max(5, mine), you: true },
    ...names.map((n, i) => ({ name: level === 'grade' ? `${n} (${g}-${otherLetters[i % otherLetters.length]})` : level === 'school' ? `${n} (${g}. ${T('sınıf', 'grade')})` : n, score: lo + Math.random() * (hi - lo), you: false })),
  ];
  const total = field.reduce((s, f) => s + f.score * f.score, 0);
  let left = voters;
  const results = field.map((f, i) => {
    const v = i === field.length - 1 ? left : Math.round((voters * f.score * f.score) / total);
    left -= v;
    return { ...f, votes: v };
  }).sort((x, y) => y.votes - x.votes);
  const won = results[0].you;
  ctx.advance(60);
  await ctx.panel.message(won ? T('Kazandın! 🎉', 'You won! 🎉') : T('Seçim sonuçları', 'Election results'),
    results.map((r) => `${r.you ? '▶ ' : ''}${r.name}: ${r.votes} ${T('oy', 'votes')}`).join(' · ') + ` · ${T(`Konuşman: ${hits}/8`, `Your speech: ${hits}/8`)}`);
  return won;
}

/** the notice board in the academic building corridor: run for class rep, campaign */
function councilRoom(ctx: GameCtx): RoomView {
  const st = ctx.st;
  const c = councilNow(ctx);
  const today = ctx.clock.day;
  const g = grade(st.year);
  const actions: ActionView[] = [];
  const campaign = (target: string): ActionView => ({
    id: 'campaign', label: T(`📣 Kampanya yap (destek: ${c.support})`, `📣 Campaign (support: ${c.support})`), hint: T(`30 dk · günde bir · ${target}`, `30 min · once a day · ${target}`),
    locked: doneToday(ctx, 'campaign') ? T('Bugün yeterince kampanya yaptın.', "You've campaigned enough today.") : undefined,
    run: async () => { nudge(ctx, { ambition: 1, presence: 1 });
      const how = await ctx.panel.choose(T('Nasıl kampanya yapacaksın?', 'How will you campaign?'), [
        { id: 'poster', label: T('🖍️ Afiş çiz ve koridora as', '🖍️ Draw posters for the corridor'), hint: T('Yaratıcılık', 'Creativity') },
        { id: 'talk', label: T('🗣️ Kantinde herkesle sohbet et', '🗣️ Chat with everyone at the canteen'), hint: T('Sosyallik', 'Social') },
        { id: 'help', label: T('📚 Arkadaşlarına ödevde yardım et', '📚 Help friends with homework'), hint: T('Bilgi', 'Knowledge') },
      ]);
      if (!how) return;
      if (how === 'poster') focusTick(ctx, 'art');
      markToday(ctx, 'campaign');
      const a = ctx.ch.attributes;
      const boost = 2 + Math.round((how === 'poster' ? a.creativity : how === 'talk' ? a.social : a.knowledge) / 10);
      c.support += boost;
      ctx.advance(30);
      ctx.gain({ xp: 8, attrs: { social: 1 } });
      ctx.toast(T(`Destek +${boost} (toplam ${c.support})`, `Support +${boost} (total ${c.support})`), 'good');
    },
  });
  let note = '';
  if (c.stage === 'none') {
    note = T(`Öğrenci Meclisi seçimleri: önce sınıfının temsilcisi ol, sonra ${g}. sınıfların 5 temsilcisi arasından sınıf başkanı seçilir. Okul başkanı yalnızca 11. sınıftan çıkar.`,
      `Student council elections: first become your class rep, then the 5 reps of grade ${g} elect a grade president. The school president is always an 11th grader.`);
    actions.push({
      id: 'run', label: T(`🗳️ ${st.school.classLabel} sınıf temsilciliğine aday ol`, `🗳️ Run for class rep of ${st.school.classLabel}`), hint: T('Seçim 2 okul günü sonra · yılda bir', 'Election in 2 school days · once a year'),
      locked: !st.once.classDrawn ? T('Sınıfın, kayıt dönemi bitince kurayla belli olacak.', 'Your class is drawn when registration weekend is over.') : undefined,
      run: () => { nudge(ctx, { ambition: 4, presence: 3 });
        Object.assign(c, { stage: 'candidate', day: schoolDayAfter(today, 2), support: 0 });
        ctx.gain({ xp: 10 });
        ctx.toast(T(`Adaylığın panoya asıldı! Seçim ${whenText(ctx, c.day)}.`, `Your name is on the board! The vote is ${whenText(ctx, c.day)}.`), 'good');
      },
    });
  } else if (c.stage === 'candidate') {
    note = T(`Sınıf temsilciliği seçimi ${whenText(ctx, c.day)}. Arkadaşların, sosyalliğin, saygınlığın ve kampanyan oy getirir; disiplin cezaları oy kaybettirir.`,
      `The class rep vote is ${whenText(ctx, c.day)}. Friends, Social, respect and your campaign win votes; discipline points lose them.`);
    if (today < c.day) actions.push(campaign(T('seçim günü oy getirir', 'counts on election day')));
    else actions.push({
      id: 'vote', label: T('🗳️ Seçim günü: konuşmanı yap', '🗳️ Election day: give your speech'), hint: T('Vaat seç · konuşma ritmi · oylar sayılır', 'Pick a promise · speech rhythm · the count'),
      run: async () => { nudge(ctx, { presence: 2 });
        const won = await runElection(ctx, 'class');
        if (won) {
          Object.assign(c, { stage: 'rep', day: schoolDayAfter(ctx.clock.day, 5), support: 0 });
          c.titles.push(`${st.school.classLabel} ${T('sınıf temsilcisi', 'class rep')}`);
          ctx.ch.respect = growRespect(ctx.ch.respect, 15, st.year); ctx.gain({ xp: 60, mood: 12, attrs: { social: 2 } });
          ctx.toast(T(`Artık ${st.school.classLabel} sınıf temsilcisisin! Sınıf başkanlığı seçimi ${whenText(ctx, c.day)}, Konferans salonunda.`, `You're now class rep of ${st.school.classLabel}! The grade president vote is ${whenText(ctx, c.day)}, in the auditorium.`), 'good');
        } else { c.stage = 'lost'; ctx.gain({ xp: 15, mood: -5 }); }
      },
    });
  } else if (c.stage === 'rep') {
    note = T(`Sınıf temsilcisisin. ${g}. sınıfların başkanlık seçimi ${whenText(ctx, c.day)}, Konferans salonunda (TIM Gösteri Merkezi).`, `You're class rep. The grade ${g} president vote is ${whenText(ctx, c.day)}, in the auditorium (dining hall).`);
    actions.push(campaign(T('başkanlık seçiminde oy getirir', 'counts in the president vote')));
  } else if (c.stage === 'gradePresident') {
    note = g === SCHOOL_PRESIDENT_GRADE
      ? (c.day > 0 ? T(`${g}. sınıfların başkanısın. Okul başkanlığı seçimi ${whenText(ctx, c.day)}, Konferans salonunda.`, `You're grade ${g} president. The school president vote is ${whenText(ctx, c.day)}, in the auditorium.`) : T('Okul başkanlığı yarışı bitti.', 'The school president race is over.'))
      : T(`${g}. sınıfların başkanısın! Okul başkanlığına yalnızca 11. sınıfta aday olabilirsin.`, `You're grade ${g} president! You can only run for school president in the 11th grade.`);
    if (g === SCHOOL_PRESIDENT_GRADE && c.day > 0) actions.push(campaign(T('okul seçiminde oy getirir', 'counts in the school vote')));
  } else if (c.stage === 'schoolPresident') note = T('Okul başkanısın! Bütün okul seni tanıyor. 👑', "You're the school president! The whole school knows you. 👑");
  else note = T('Bu yılki seçim bitti. Seneye yeniden aday olabilirsin.', "This year's race is over. You can run again next year.");
  return { id: 'meclis', name: T('Öğrenci Meclisi', 'Student council'), note, actions };
}

/** the grade and school votes happen in the auditorium */
function councilHallActions(ctx: GameCtx): ActionView[] {
  const st = ctx.st;
  const c = councilNow(ctx);
  const g = grade(st.year);
  const today = ctx.clock.day;
  const out: ActionView[] = [];
  if (c.stage === 'rep') {
    out.push({
      id: 'gradevote', label: T(`🗳️ ${g}. sınıflar başkanlık seçimi`, `🗳️ Grade ${g} president election`), hint: T(`5 sınıf temsilcisi yarışıyor · ${whenText(ctx, c.day)}`, `5 class reps compete · ${whenText(ctx, c.day)}`),
      locked: today < c.day ? T(`Seçim ${whenText(ctx, c.day)}.`, `The vote is ${whenText(ctx, c.day)}.`) : undefined,
      run: async () => {
        const won = await runElection(ctx, 'grade');
        if (won) {
          Object.assign(c, { stage: 'gradePresident', day: g === SCHOOL_PRESIDENT_GRADE ? schoolDayAfter(ctx.clock.day, 5) : 0, support: 0 });
          c.titles.push(T(`${g}. sınıflar başkanı`, `Grade ${g} president`));
          ctx.ch.respect = growRespect(ctx.ch.respect, 30, st.year); ctx.gain({ xp: 120, mood: 15, attrs: { social: 3 } });
        } else { c.stage = 'gradeLost'; ctx.gain({ xp: 20, mood: -5 }); }
      },
    });
  }
  if (c.stage === 'gradePresident' && g === SCHOOL_PRESIDENT_GRADE && c.day > 0) {
    out.push({
      id: 'schoolvote', label: T('👑 Okul başkanlığı seçimi', '👑 School president election'), hint: T(`Bütün okul oy veriyor · ${whenText(ctx, c.day)}`, `The whole school votes · ${whenText(ctx, c.day)}`),
      locked: today < c.day ? T(`Seçim ${whenText(ctx, c.day)}.`, `The vote is ${whenText(ctx, c.day)}.`) : undefined,
      run: async () => {
        const won = await runElection(ctx, 'school');
        c.day = 0;
        if (won) {
          c.stage = 'schoolPresident';
          c.titles.push(T('Okul başkanı', 'School president'));
          ctx.ch.respect = growRespect(ctx.ch.respect, 60, st.year); ctx.gain({ xp: 250, mood: 20, attrs: { social: 4 } });
        } else { c.stage = 'schoolLost'; ctx.gain({ xp: 30, mood: -5 }); }
      },
    });
  }
  return out;
}

// ---------------- Cemil Emmi (boys' dorm caretaker) ----------------

/** Cemil Emmi between tasks: a hand with the broom, a game of chess, and the old days */
function cemilActions(ctx: GameCtx): ActionView[] {
  const st = ctx.st;
  const f = Math.round(st.friends[CEMIL] ?? 0);
  const once = (key: string) => (doneToday(ctx, `${key}-cemil`) ? T('Bugün zaten yaptın.', 'Already done today.') : undefined);
  const mark = (key: string) => markToday(ctx, `${key}-cemil`);
  const say = (tr: string, en: string) => ctx.panel.message('Cemil Emmi', T(tr, en));
  const win = Math.min(0.3, 0.05 + ctx.ch.attributes.knowledge / 400);
  const times: Array<[string, string]> = [
    ['"Ben buraya geldiğimde bu ağaçlar senin boyundaydı. Şimdi bak." Çınara uzun uzun baktı.', '"When I came here these trees were your height. Look at them now." He gazed up at the plane tree for a long while.'],
    ['"Bir kış kaloriferler bozulmuştu. Koğuştakiler yatakları yan yana çekip yorganları birleştirdi, sabaha kadar fıkra anlattılar. Kimse üşümedi."', '"One winter the heating broke down. The boys pushed their beds together, piled up the blankets and told jokes until morning. Nobody was cold."'],
    ['"Benim çocuklarım büyüdü, gitti; doktor oldu, mühendis oldu, öğretmen oldu. Bayramda hâlâ gelip elimi öperler. Sen de gelirsin, biliyorum."', '"My boys grew up and left: doctors, engineers, teachers. They still come at the holidays to kiss my hand. You will too, I know."'],
    ['"Mezuniyet günü bütün devre şu kapının önünde marşı söyledi. Ben de süpürgeye yaslanıp ağladım, kimseye söyleme."', '"On graduation day the whole year sang the anthem in front of that door. I leaned on my broom and cried. Don\'t tell anyone."'],
  ];
  return gate([
    {
      id: 'sweep', label: T('🧹 Süpürmesine yardım et', '🧹 Help him sweep'), hint: T('15 dk · +8 güven · günde bir', '15 min · +8 trust · once a day'),
      locked: once('sweep'),
      run: async () => {
        mark('sweep'); nudge(ctx, { warmth: -1, rules: -1 }); ctx.advance(15); ctx.befriend(CEMIL, 8); ctx.gain({ energy: -4, xp: 5 });
        await say('"Köşelere de bak, köşelere! Hah, şöyle. Aferin evlat."', '"Get the corners too, the corners! That\'s it. Good lad."');
      },
    },
    {
      id: 'chess', label: T('♟️ Satranç oyna', '♟️ Play chess'), hint: T(`30 dk · kazanma şansın %${Math.round(win * 100)} (Bilgi'ne göre) · +güven · günde bir`, `30 min · ${Math.round(win * 100)}% chance to win (from your Knowledge) · +trust · once a day`),
      locked: once('chess'),
      run: async () => {
        mark('chess'); nudge(ctx, { ambition: 1 }); ctx.advance(30);
        if (Math.random() < win) {
          const first = !st.once.beatCemil;
          st.once.beatCemil = true;
          ctx.befriend(CEMIL, 6);
          if (first) ctx.ch.respect += 10;
          ctx.gain({ mood: 10, xp: first ? 40 : 10, attrs: { knowledge: 1 } });
          await say(first ? '"Mat mı? Bu mat!" Uzun uzun tahtaya baktı, sonra güldü. "Kerem\'den sonra beni yenen ilk sensin. Yarın rövanş!" +10 saygınlık' : '"Yine mi? Sen bu işi öğrendin evlat."',
            first ? '"Checkmate? That\'s checkmate!" He stared at the board for a long time, then laughed. "You\'re the first to beat me since Kerem. Rematch tomorrow!" +10 respect' : '"Again? You\'ve got the hang of this, lad."');
        } else {
          ctx.befriend(CEMIL, 3); ctx.gain({ attrs: { knowledge: 1 } });
          await say('"Şah… ve mat." Taşları yavaşça topladı. "Atını çok erken oynuyorsun. Yarın yine gel."', '"Check… and mate." He gathered the pieces slowly. "You bring your knight out too early. Come again tomorrow."');
        }
      },
    },
    {
      id: 'oldtimes', label: T('📻 Eski günleri sor', '📻 Ask about the old days'), hint: T('15 dk · +6 moral · +4 güven · günde bir', '15 min · +6 mood · +4 trust · once a day'),
      locked: once('oldtimes'),
      run: async () => {
        mark('oldtimes'); nudge(ctx, { loyalty: 2, heart: 1 }); ctx.advance(15); ctx.befriend(CEMIL, 4); ctx.gain({ mood: 6 });
        const [tr, en] = times[ctx.clock.day % times.length];
        await say(tr, en);
      },
    },
  ], f, 'adult');
}

export function cemilPanel(ctx: GameCtx): PanelView {
  const st = ctx.st;
  const c = st.cemil;
  const actions: ActionView[] = [];
  const tooOld = st.year > PEE_LAST_YEAR;
  if (!tooOld && (c.pee === 'none' || (c.pee === 'rewarded' && c.peeYear < st.year))) {
    actions.push({
      id: 'pee', label: T('Görev: Çişini tut!', 'Task: hold your pee!'), hint: T('Gece sabaha kadar dayan · 4.–5. sınıf, yılda bir', 'Last the night until morning · grades 4–5, once a year'),
      run: async () => {
        c.pee = 'assigned'; c.peeYear = st.year; c.peeFails = 0;
        await ctx.panel.message('Cemil Emmi', T(
          '"Bak evlat, yatmadan önce o koca bardak suyu içtin, gördüm. Bu gece çişin gelecek ama yataktan kalkıp tuvalete gitmek yok, belletmen yakalar! Sabaha kadar tutacaksın. Başaramazsan ertesi gece yine deneyeceksin, ta ki tutana kadar. Sonra gel, anlat."',
          '"Listen, kid. I saw you drink that big glass of water before bed. Tonight you\'ll need to pee, but no getting up, the belletmen will catch you! Hold it until morning. If you don\'t make it, you try again the next night, and the next, until you do. Then come and tell me."',
        ));
      },
    });
  }
  if (c.pee === 'held') {
    actions.push({
      id: 'report', label: T('Gece tuttuğunu anlat', 'Tell him you held it'), hint: T('Ödül', 'Reward'),
      run: async () => {
        c.pee = 'rewarded';
        ctx.gain({ xp: 30, mood: 10, money: 10 });
        pocket(ctx, 'seker');
        await ctx.panel.message('Cemil Emmi', T('"Aferin aslanım! Al bakalım, bu şekerler senin. Dedikodular da yakında unutulur. Yakında sana yeni bir görevim olacak."', '"Well done, champ! Here, these sweets are yours. The gossip will die down soon. I\'ll have a new task for you before long."'));
      },
    });
  }
  actions.push(...cemilActions(ctx));
  const notes: Record<string, string> = {
    none: tooOld ? T('"Sen artık büyüdün evlat. Yeni görevler yakında."', '"You\'re a big kid now. New tasks soon."') : T('Yaşlı hademe Cemil Emmi, elinde süpürgesiyle seni süzüyor. "Gel bakalım, sana bir görevim var."', 'Old caretaker Cemil Emmi eyes you, broom in hand. "Come here, I have a task for you."'),
    assigned: c.peeFails > 0
      ? T(`"Olmadı ha? (${c.peeFails} gece) Üzülme evlat, bu gece yine dene. Ama çabuk ol, koğuşta laf yayılıyor…"`, `"Didn't make it, eh? (${c.peeFails} nights) Chin up, try again tonight. But hurry, the dorm is starting to talk…"`)
      : T('"Bu gece çişini tutacaksın, unutma! Yatağa erken gir."', '"Tonight you hold your pee, remember! Get to bed early."'),
    held: T('"Ooo, yüzünden belli, başardın galiba!"', '"Oho, I can see it on your face, you did it!"'),
    rewarded: T('"Yeni görevler yolda. Şimdilik dersine çalış."', '"New tasks are on the way. Study for now."'),
  };
  return {
    title: 'Cemil Emmi', sub: T(`Erkek Yurdu · hademe · ${trustLine(Math.round(st.friends[CEMIL] ?? 0))}`, `Boys' dorm · caretaker · ${trustLine(Math.round(st.friends[CEMIL] ?? 0))}`), status: status(ctx),
    rooms: [{ id: 'cemil', name: 'Cemil Emmi', note: notes[c.pee], actions }],
  };
}

// ---------------- pick-up games on the outdoor courts ----------------

const COURT_NAME: Record<CourtSport, Text> = { basketball: { tr: 'Basketbol sahası', en: 'Basketball court' }, football: { tr: 'Futbol sahası', en: 'Football pitch' } };

/** `evening`: the court behind the dorms, open in the evening free time too (until lights out) */
export function courtPanel(ctx: GameCtx, sport: CourtSport, evening = false): PanelView {
  const st = ctx.st;
  const phase = phaseOf(ctx.clock.minutes, ctx.clock.day);
  const open = phase === 'day' || (evening && phase === 'plaza');
  const need = COURT_PLAYERS[sport];
  return {
    title: L(COURT_NAME[sport]), sub: T(`Becerin: ${st.skills[sport]}/100`, `Your skill: ${st.skills[sport]}/100`), status: status(ctx),
    rooms: [{
      id: 'court', name: L(COURT_NAME[sport]),
      note: sport === 'basketball' ? T(`2'ye 2 maç için senin dışında ${need} kişi lazım.`, `For a 2-on-2 game you need ${need} more players.`) : T(`3'e 3 maç için senin dışında ${need} kişi lazım.`, `For a 3-on-3 game you need ${need} more players.`),
      actions: [{
        id: 'call', label: T('📣 Arkadaşlarını çağır', '📣 Call your friends over'), hint: T('Yakındaki arkadaşların gelir, sen bekle', 'Friends who are around will come; wait for them here'),
        locked: !open ? (evening ? (phase === 'etut' ? T('Etüt saati: saha 20:00\'de açılıyor.', 'Study hour: the court opens at 20:00.') : T('Işıklar söndü; saha yarın açılıyor.', "Lights are out; the court opens tomorrow."))
          : T('Akşam sahalar kapalı. Yatakhane arkasındaki saha ışıklar sönene kadar açık.', 'The courts are closed in the evening. The court behind the dorms is open until lights out.'))
          : currentPeriod(ctx.clock.day, ctx.clock.minutes)?.kind === 'lesson' && reached('derse_gir', ctx.mc()) ? T('Ders saatinde maç olmaz!', 'No games during lessons!')
            : st.energy < 25 ? T('Çok yorgunsun.', "You're too tired.") : undefined,
        run: () => { nudge(ctx, { loyalty: 1, presence: 1 });
          const why = ctx.callFriends(sport);
          if (why) { ctx.toast(why); return; }
          ctx.panel.close();
        },
      }],
    }],
  };
}

/** the match itself, once enough friends have arrived */
export async function playMatch(ctx: GameCtx, sport: CourtSport, mates: NpcDef[]) {
  const st = ctx.st;
  focusTick(ctx, 'sport');
  const skill = st.skills[sport];
  let ours: number, theirs: number, hits: number;
  if (sport === 'basketball' && mates.length >= 3) {
    // a real game: you and your closest friend against the other two
    const r = await ctx.playBasketball(mates[0], [mates[1], mates[2]]);
    if (r.quit) {
      ctx.advance(15);
      ctx.gain({ mood: -3, energy: -5 });
      for (const m of mates) ctx.befriend(m.id, -1);
      ctx.toast(T('Maçı yarıda bıraktın; arkadaşların biraz bozuldu.', 'You walked out of the game; your friends were a bit put out.'));
      return;
    }
    ours = r.us; theirs = r.them;
    hits = Math.min(5, r.made);
  } else if (sport === 'football' && mates.length >= 5) {
    // a real game: you and your two closest friends (the second in goal) against the other three
    const r = await ctx.playFootball([mates[0], mates[1]], [mates[2], mates[3], mates[4]]);
    if (r.quit) {
      ctx.advance(15);
      ctx.gain({ mood: -3, energy: -5 });
      for (const m of mates) ctx.befriend(m.id, -1);
      ctx.toast(T('Maçı yarıda bıraktın; arkadaşların biraz bozuldu.', 'You walked out of the game; your friends were a bit put out.'));
      return;
    }
    ours = r.us; theirs = r.them;
    hits = Math.min(5, r.goals * 2 + Math.min(1, r.shots));
  } else {
    const zone = 0.16 + skill / 600 + ctx.ch.attributes.fitness / 800 + (hasPerk(ctx.st, 'takimOyuncusu') ? 0.04 : 0);
    hits = await ctx.panel.timing(T('Gole vur!', 'Shoot at goal!'), 5, zone, 1.3);
    theirs = Math.floor(Math.random() * 4) + 1;
    ours = hits + (Math.random() < 0.5 ? 1 : 0);
  }
  const won = ours > theirs;
  ctx.advance(45);
  st.skills[sport] = growSkill(skill, 2 + hits, st.year);
  ctx.gain({ xp: 20 + hits * 6 + (won ? 25 : 0), mood: won ? 12 : 5, energy: -18, hunger: -10, attrs: { fitness: 1 + (won ? 1 : 0), social: 1 } });
  for (const m of mates) ctx.befriend(m.id, won ? 4 : 2);
  const names = mates.map((m) => m.name).join(', ');
  await ctx.panel.message(won ? T('Kazandınız! 🎉', 'You won! 🎉') : T('Maç bitti', 'Full time'), T(
    `Skor ${ours}–${theirs}. Oynayanlar: ${names}. ${L(COURT_NAME[sport])} becerin ${st.skills[sport]} oldu.`,
    `Score ${ours}–${theirs}. Played with: ${names}. Your ${L(COURT_NAME[sport]).toLowerCase()} skill is now ${st.skills[sport]}.`,
  ));
}

/** returns the interior menu for a location, or null when the door stays shut */
export function buildingPanel(locId: string, ctx: GameCtx): PanelView | null {
  // (the office is open all through the registration weekend)
  const weekendClosed = isWeekend(ctx.clock.day) && !ctx.rush();
  switch (locId) {
    case 'cemiyet': return weekendClosed ? null : cemiyet(ctx);
    case 'muze': return weekendClosed ? null : muze(ctx);
    case 'egitim': return egitim(ctx);
    case 'kutuphane': return kutuphane(ctx);
    case 'yemekhane': return diningOpen(ctx.clock.minutes) ? yemekhane(ctx) : yemekhaneClosed(ctx);
    case 'tim': return tim(ctx);
    case 'revir': return revir(ctx);
    case 'spor': return spor(ctx);
    case 'kapali_saha': return kapaliSaha(ctx);
    default: return null;
  }
}


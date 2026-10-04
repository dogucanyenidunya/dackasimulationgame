// What you can do inside each building (step 3 of the prototype). Interiors are menus for now.
import { L, type Text } from '../i18n';
import type { Panel, PanelView, ActionView, RoomView } from '../ui/panel';
import { GUARDIANS, keepsakeName, capitalize, type Attributes, type CharacterData } from '../content/character';
import { BOOKS } from '../content/quiz';
import { currentPeriod, fmtTime, isWeekend, PERIODS, periodLabel, phaseOf, subjectFor } from './schedule';
import { ANTHEM_STANZAS, CLASS_LETTERS, SCHOOL_PRESIDENT_GRADE, DEV, ESCAPE_FROM_YEAR, grade, dormPlace, LESSONS_FOR_EXAM, SUBJECTS, FRIEND_AT, YEAR1_XP, clamp, COURT_PLAYERS, MANDOLIN_LESSONS, PEE_LAST_YEAR, type CourtSport, type InstrumentId, type MealId, type PlayerState, type SportId } from './state';
import { missionById, reached, type MissionCtx } from './missions';
import { BUS_BOARDING, BUS_LEAVES, CARSI_END, CARSI_OUT_FROM_YEAR, CARSI_START, VISIT_END, VISIT_START, carsiNow, isFriday, isSunday } from './weekend';
import { NPCS, friendLevel, type NpcDef } from '../content/npcs';

export interface Gain { xp?: number; attrs?: Partial<Attributes>; mood?: number; energy?: number; hunger?: number; money?: number }

export interface GameCtx {
  st: PlayerState;
  ch: CharacterData;
  clock: { day: number; minutes: number };
  panel: Panel;
  advance(minutes: number): void;
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
}

/** reason text when a feature is still locked behind a mission */
function needMission(ctx: GameCtx, id: string): string | undefined {
  if (reached(id, ctx.mc())) return undefined;
  const title = L(missionById(id).title);
  return T(`"${title}" görevi açılınca kullanılabilir.`, `Opens with the "${title}" mission.`);
}
const sickLock = (ctx: GameCtx) => (ctx.st.sick ? T('Hastasın. Önce Revir\'e git.', "You're sick. Go to the infirmary first.") : undefined);

const T = (tr: string, en: string): string => L({ tr, en });
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
  { id: 'atistirmalik', name: { tr: 'Cips & çikolata', en: 'Crisps & chocolate' }, price: 8, hunger: 10, mood: 6 },
  { id: 'ayran', name: { tr: 'Ayran', en: 'Ayran' }, price: 4, hunger: 8, mood: 3 },
];
/** a phone card for the dorm payphone */
const PHONE_CARD = { price: 25, units: 30, perCall: 10 };

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

// ---------------- buildings ----------------

function cemiyet(ctx: GameCtx): PanelView {
  const s = ctx.st.school;
  const dormName = ctx.ch.gender === 'girl' ? T('Kız Yurdu', "Girls' Dorm") : T('Erkek Yurdu', "Boys' Dorm");
  return {
    title: 'Cemiyet Binası', sub: T('Yönetim · kayıt · Ambar', 'Administration · registration · supply room'), status: status(ctx),
    rooms: [
      {
        id: 'danisma', name: T('Danışma', 'Reception'),
        note: ctx.st.once.classDrawn
          ? T(`Kaydın tamam: ${s.classLabel} sınıfı · ${dormAddress(ctx)}`, `You're registered: class ${s.classLabel} · ${dormAddress(ctx)}`)
          : s.registered
            ? T('Kaydın tamam. Sınıfın kurayla belli olacak.', "You're registered. Your class will be decided by a draw.")
            : T('Görevli gülümsüyor: "Hoş geldin! Kaydını yapalım."', 'The clerk smiles: "Welcome! Let\'s get you registered."'),
        actions: [
          {
            id: 'register', label: T('Kaydını yap', 'Register'), hint: T('20 dk · +20 XP · yemek kartı', '20 min · +20 XP · meal card'),
            locked: needMission(ctx, 'kayit') ?? (s.registered ? T('Kaydın zaten yapıldı.', 'Already registered.') : undefined),
            run: async () => {
              s.registered = true;
              ctx.advance(20);
              ctx.gain({ xp: 20 });
              await ctx.panel.message(T('Kayıt tamam', 'Registered'), T(
                'Artık resmen bir Daçkalısın! Yemek kartın hazır. Sıradakiler: Revir\'de sağlık kontrolü, aşağı kattaki Ambar\'dan kıyafetlerin ve Kütüphane\'den ders kitapların. Sınıfını ise kurayla öğreneceksin.',
                "You're officially a Daçka student! Your meal card is ready. Next: a health check at the infirmary, your clothes from the Ambar downstairs and your textbooks at the library. Your class will be decided by a draw."));
            },
          },
          {
            id: 'draw', label: T('Sınıf kurası çek', 'Draw your class'), hint: T(`${grade(ctx.st.year)}-A'dan ${grade(ctx.st.year)}-E'ye beş sınıf`, `Five classes, ${grade(ctx.st.year)}-A to ${grade(ctx.st.year)}-E`),
            locked: needMission(ctx, 'sinif') ?? (ctx.st.once.classDrawn ? T(`Sınıfın: ${s.classLabel}`, `Your class: ${s.classLabel}`) : undefined),
            run: async () => {
              const classes = CLASS_LETTERS.map((l) => `${grade(ctx.st.year)}-${l}`);
              const pick = classes[Math.floor(Math.random() * classes.length)];
              await ctx.panel.roulette(T('Sınıf kurası', 'Class draw'), classes, pick);
              s.classLabel = pick;
              ctx.st.once.classDrawn = true;
              ctx.advance(10);
              ctx.gain({ xp: 10, mood: 5 });
              await ctx.panel.message(pick, T(
                `Sınıfın ${pick}! 14 sınıf arkadaşın meydanlarda dolaşıyor; isimlerinin üstünde ★ olanlar senin sınıfından. Git, tanış!`,
                `You're in ${pick}! Your 14 classmates are out on the plazas; the ones with a ★ by their name are in your class. Go say hello!`));
            },
          },
        ],
      },
      {
        id: 'ambar', name: T('Ambar (−1. kat)', 'Ambar (floor −1)'),
        locked: needRegistration(ctx),
        note: s.kit ? T('Dolabın dolu: üniforma, mont, ayakkabılar, eşofman.', 'All set: uniform, coat, shoes, tracksuit.') : T('Ambar memuru raflardan senin bedenini arıyor.', 'The storekeeper searches the shelves for your size.'),
        actions: [{
          id: 'kit', label: T('Kıyafetlerini al', 'Collect your kit'), hint: T('15 dk · +20 XP', '15 min · +20 XP'),
          locked: s.kit ? T('Kıyafetlerini zaten aldın.', 'Already collected.') : undefined,
          run: async () => {
            s.kit = true;
            ctx.advance(15);
            ctx.gain({ xp: 20 });
            await ctx.panel.message(T('Ambar', 'Supply room'), T(
              'Aldıkların: gömlek, lacivert kazak, kravat, pantolon/etek, kışlık mont, okul ayakkabısı, spor ayakkabısı ve eşofman. Montunu kışın unutma!',
              'You got: shirt, navy sweater, tie, trousers/skirt, a winter coat, school shoes, sports shoes and a tracksuit. Don\'t forget your coat in winter!'));
          },
        }],
      },
      {
        id: 'rehber', name: T('Rehber öğretmen', 'Counselor'),
        note: T('Rehber öğretmen Selma Hanım\'ın kapısı herkese açık.', 'Ms. Selma, the counselor, keeps her door open for everyone.'),
        actions: [{
          id: 'talk', label: T('Biraz konuş', 'Have a talk'), hint: T('20 dk · +12 moral (günde bir)', '20 min · +12 mood (once a day)'),
          locked: doneToday(ctx, 'counselor') ? T('Bugün zaten konuştunuz.', 'You already talked today.') : undefined,
          run: async () => {
            markToday(ctx, 'counselor');
            ctx.advance(20);
            ctx.gain({ mood: 12, xp: 5 });
            await ctx.panel.message(T('Selma Hanım', 'Ms. Selma'), T(
              '"İlk haftalar herkes için zordur. Özlemek normal. Bir şeye ihtiyacın olursa buradayım."',
              '"The first weeks are hard for everyone. Missing home is normal. I\'m here whenever you need me."'));
          },
        }],
      },
    ],
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
      hint: T('45 dk · −5 enerji · +15 XP', '45 min · −5 energy · +15 XP'),
      locked: ctx.st.energy < 8 ? T('Çok yorgunsun.', "You're too tired.") : undefined,
      run: () => {
        reading.sessions++; ctx.advance(45); ctx.gain({ xp: 15, energy: -5, attrs: { knowledge: 1 } });
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
      id: 'return', label: T(`${giver.name}'nin kitabını iade et`, `Return ${giver.name}'s book`), hint: T('Abi/abla ricası', 'A favor for an older student'),
      run: () => { ctx.st.favor.stage = 'done'; ctx.advance(5); ctx.gain({ xp: 10 }); ctx.toast(T(`Kitap iade edildi. ${giver.name}'ye haber ver!`, `Book returned. Go tell ${giver.name}!`), 'good'); },
    });
  }

  return libraryActions;
}

export function kutuphane(ctx: GameCtx): PanelView {
  return {
    title: T('Kütüphane', 'Library'), sub: T('Ders kitapları · okuma salonu', 'Textbooks · reading room'), status: status(ctx),
    rooms: [
      { id: 'kutuphane', name: T('Okuma salonu', 'Reading room'), note: T('Kütüphaneci Nermin Hanım: "Sessiz lütfen… ama hoş geldin!"', 'Librarian Ms. Nermin: "Quiet please… but welcome!"'), actions: [...libraryActionsFor(ctx), { id: 'out', label: T('Kütüphaneden çık', 'Leave the library'), run: () => { ctx.panel.close(); ctx.leaveDorm(); } }] },
    ],
  };
}

export function egitim(ctx: GameCtx, mode: 'desk' | 'corridor' = 'corridor'): PanelView {
  const s = ctx.st.school;
  const { day, minutes } = ctx.clock;
  const p = currentPeriod(day, minutes);
  const lessonKey = p ? `${day}-${p.id}` : '';
  const subject = p && p.kind === 'lesson' ? subjectFor(day, p.id) : null;

  let lessonLock: string | undefined = needMission(ctx, 'derse_gir') ?? needRegistration(ctx);
  if (!lessonLock && !s.books) lessonLock = T('Ders kitapların yok. Kütüphane binasından al.', 'You have no textbooks. Get them at the library building.');
  if (!lessonLock && !subject) lessonLock = T(`Şu an ders yok. Sıradaki: ${nextOf(ctx, 'lesson')}`, `No lesson right now. Next: ${nextOf(ctx, 'lesson')}`);
  if (!lessonLock && s.attended.includes(lessonKey)) lessonLock = T('Bu derse zaten girdin.', 'You already attended this lesson.');

  const attendedCount = s.attended.length;
  const examAction: ActionView = {
    id: 'exam', label: T('Yıl sonu sınavı', 'Year-end exam'), hint: T('5 tahmin turu · ortalama 50 ile geçersin · Bilgi puanın yardım eder', '5 guessing rounds · average 50 to pass · your Knowledge helps'),
    locked: needMission(ctx, 'sinavlar')
      ?? (ctx.st.examPassed ? T('Sınavı geçtin! 🎉', 'You passed! 🎉')
        : attendedCount < LESSONS_FOR_EXAM ? T(`Önce en az ${LESSONS_FOR_EXAM} derse gir (${attendedCount}/${LESSONS_FOR_EXAM}).`, `Attend at least ${LESSONS_FOR_EXAM} lessons first (${attendedCount}/${LESSONS_FOR_EXAM}).`)
          : p?.kind === 'lesson' ? T('Ders sırasında sınav olmaz.', 'No exams during a lesson.')
            : doneToday(ctx, 'exam') ? T('Bütünleme yarın.', 'The make-up exam is tomorrow.') : undefined),
    run: async () => {
      // one round per subject: the teacher thinks of a number 1–10, the closer your guess the better
      let total = 0;
      for (const sub of SUBJECTS) {
        const secret = 1 + Math.floor(Math.random() * 10);
        const g = await ctx.panel.pickNumber(T(`Yıl sonu sınavı · ${L(sub.name)}`, `Year-end exam · ${L(sub.name)}`), T('Öğretmen 1 ile 10 arasında bir sayı tuttu. Ne kadar yaklaşırsan o kadar puan!', 'The teacher is thinking of a number from 1 to 10. The closer you get, the more points!'), 10);
        total += closenessScore(Math.abs(g - secret));
        ctx.toast(T(`${L(sub.name)}: sen ${g}, doğrusu ${secret}`, `${L(sub.name)}: you said ${g}, it was ${secret}`));
      }
      const pct = Math.min(100, Math.round(total / SUBJECTS.length + ctx.ch.attributes.knowledge / 2));
      ctx.advance(60);
      if (pct >= 50) {
        ctx.st.examPassed = true;
        ctx.gain({ xp: 100, mood: 10, attrs: { knowledge: 2 } });
        await ctx.panel.message(T('Geçtin!', 'You passed!'), T(`Sınav notun: %${pct}. Ahmet Bey gülümsüyor: "Aferin!"`, `Your score: ${pct}%. Mr. Ahmet smiles: "Well done!"`));
      } else {
        markToday(ctx, 'exam');
        ctx.gain({ mood: -5, energy: -10 });
        await ctx.panel.message(T('Bu sefer olmadı', 'Not this time'), T(`Sınav notun: %${pct}. Üzülme: yarın bütünleme sınavına girebilirsin.`, `Your score: ${pct}%. Don't worry: you can take the make-up exam tomorrow.`));
      }
    },
  };

  const lessonActions: ActionView[] = [{
    id: 'lesson', label: subject ? T(`Derse gir: ${subjName(subject)}`, `Attend: ${subjName(subject)}`) : T('Derse gir', 'Attend lesson'),
    hint: T('Derste ne yapacağını sen seçersin · −8 enerji', 'You choose what to do in class · −8 energy'),
    locked: lessonLock ?? sickLock(ctx) ?? (ctx.st.energy < 8 ? T('Çok yorgunsun.', "You're too tired.") : undefined),
    run: async () => {
      const sub = subject!;
      const teacher = 'Ahmet Bey';
      const mates = NPCS.filter((n) => n.kind === 'classmate');
      const choice = await ctx.panel.choose(T(`${subjName(sub)} dersi: ne yapacaksın?`, `${subjName(sub)}: what will you do?`), [
        { id: 'answer', label: T('Öğretmenin sorusunu cevapla', "Answer the teacher's question"), hint: T('Öğretmen 1–10 arası bir sayı tutuyor; ne kadar yaklaşırsan o kadar XP', 'The teacher thinks of a number 1–10; the closer you get, the more XP') },
        { id: 'notes', label: T('Not al', 'Take notes'), hint: T('+15 XP · +2 Bilgi · güvenli seçim', '+15 XP · +2 Knowledge · the safe choice') },
        { id: 'talk', label: T('Arkadaşınla fısıldaş', 'Whisper with a friend'), hint: T('+8 arkadaşlık · ⚠ öğretmen uyarabilir', '+8 friendship · ⚠ the teacher may warn you') },
        { id: 'tease', label: T('Bir sınıf arkadaşınla dalga geç', 'Make fun of a classmate'), hint: T('Sınıf güler ama o kişi seni sevmez ve intikam alabilir · ⚠ disiplin', "The class laughs, but they won't like you and may get revenge · ⚠ discipline") },
        { id: 'else', label: T('Başka bir şeyle ilgilen', 'Get distracted by something else'), hint: T('Defterine çizim yap · +1 Yaratıcılık · XP yok', 'Doodle in your notebook · +1 Creativity · no XP') },
      ]);
      if (!choice) return;
      let score = 50, xp = 0;
      let title = '', body = '';
      const pickMate = async (q: string) => {
        const sorted = [...mates].sort((x, y) => (ctx.st.friends[y.id] ?? 0) - (ctx.st.friends[x.id] ?? 0));
        const id = await ctx.panel.choose(q, sorted.map((n) => ({ id: n.id, label: n.name, hint: `${L(friendLevel(ctx.st.friends[n.id] ?? 0))} · ${Math.round(ctx.st.friends[n.id] ?? 0)}` })));
        return mates.find((n) => n.id === (id ?? sorted[0].id))!;
      };
      if (choice === 'answer') {
        const secret = 1 + Math.floor(Math.random() * 10);
        const g = await ctx.panel.pickNumber(teacher, T('"Aklımdan 1 ile 10 arasında bir sayı tuttum. Kim bilecek?" Elini kaldırdın…', '"I\'m thinking of a number between 1 and 10. Who can guess it?" You raise your hand…'), 10);
        const d = Math.abs(g - secret);
        const tiers = [
          { score: 100, xp: 40, mood: 6, tr: 'Tam isabet! Öğretmen seni bütün sınıfın önünde övdü.', en: 'Spot on! The teacher praised you in front of the whole class.' },
          { score: 85, xp: 30, mood: 4, tr: 'Çok yaklaştın! "Aferin, iyi düşünmüşsün."', en: 'So close! "Well done, good thinking."' },
          { score: 65, xp: 15, mood: 1, tr: 'Fena değil. "Biraz daha dikkat!"', en: 'Not bad. "A bit more focus!"' },
          { score: 40, xp: 5, mood: -2, tr: 'Uzak kaldın. Birkaç kişi kıkırdadı.', en: 'Way off. A few kids giggled.' },
          { score: 20, xp: 0, mood: -5, tr: 'Çok uzak… Sınıf güldü, yüzün kızardı.', en: 'Miles off… the class laughed and you went red.' },
        ];
        const t = tiers[d === 0 ? 0 : d === 1 ? 1 : d === 2 ? 2 : d <= 4 ? 3 : 4];
        score = t.score; xp = t.xp;
        ctx.gain({ mood: t.mood, attrs: { knowledge: d <= 1 ? 2 : 0 } });
        title = T(`Senin cevabın ${g}, doğrusu ${secret}`, `You said ${g}, it was ${secret}`); body = L(t);
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
      s.attended.push(lessonKey);
      s.scores[sub].push(score);
      if (s.homework.length < 3) s.homework.push({ s: sub, day: ctx.clock.day });
      ctx.gain({ xp: 10 + xp, energy: -8 });
      ctx.advance(Math.max(0, p!.end - ctx.clock.minutes));
      await ctx.panel.message(title, `${body} ${T(`(Ders notu: ${score} · ödev: ${subjName(sub)}, akşam etütte)`, `(Lesson score: ${score} · homework: ${subjName(sub)}, at evening study)`)}`);
    },
  }];

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
        note: T('Uzun bir koridor: bir yanda sınıfın, karşıda öğretmenler odası. Kütüphane karşıdaki ayrı binada.', 'A long corridor: your classroom on one side, the teachers\' room opposite. The library is in its own building across the plaza.'),
        actions: [{ id: 'out', label: T('Binadan çık', 'Leave the building'), run: () => { ctx.panel.close(); ctx.leaveDorm(); } }],
      },
      {
        id: 'ogretmenler', name: T('Öğretmenler odası', "Teachers' room"),
        note: T('Sınıf öğretmenin Ahmet Bey çayını yudumluyor.', 'Your homeroom teacher, Mr. Ahmet, is sipping his tea.'),
        actions: [{
          id: 'teacher', label: T('Ahmet Bey\'le konuş', 'Talk to Mr. Ahmet'), hint: T('10 dk · günde bir', '10 min · once a day'),
          locked: needRegistration(ctx) ?? (doneToday(ctx, 'teacher') ? T('Bugün zaten konuştunuz.', 'You already talked today.') : undefined),
          run: async () => {
            markToday(ctx, 'teacher'); ctx.advance(10); ctx.gain({ xp: 10, mood: 4 });
            const tips = [
              T('"Ders saatleri sol üstte yazıyor. Kaçırırsan dert etme, yarın yine ders var."', '"Lesson times are shown at the top left. If you miss one, don\'t worry, there\'s more tomorrow."'),
              T('"Ödevlerini akşam etütte yap; etüt 18:00\'de yurdunda başlıyor."', '"Do your homework at evening study; it starts at 18:00 in your dorm."'),
              T('"Yemekleri kaçırma. Aç karnına kimse ders dinleyemez."', '"Don\'t skip meals. Nobody can learn on an empty stomach."'),
            ];
            await ctx.panel.message('Ahmet Bey', tips[ctx.clock.day % tips.length]);
          },
        }],
      },
      musicRoom(ctx),
      councilRoom(ctx),
      { id: 'lise', name: T('Lise kanadı', 'High school wing'), locked: T('Lise kanadı hazırlık yılında açılır.', 'The high school wing opens in the prep year.'), actions: [] },
    ],
  };
}

/** what's being served right now, if anything */
export function currentMeal(ctx: GameCtx): { meal: MealId; name: string } | null {
  const p = currentPeriod(ctx.clock.day, ctx.clock.minutes);
  return p?.kind === 'meal' && p.meal ? { meal: p.meal, name: L(p.name) } : null;
}

/** why you can't pick up a tray right now (undefined = you can) */
export function trayLock(ctx: GameCtx): string | undefined {
  const m = currentMeal(ctx);
  if (!ctx.st.school.registered) return T('Yemek kartın yok. Önce Cemiyet\'te kayıt ol.', 'You have no meal card yet. Register at the Cemiyet building first.');
  if (!m) return T(`Servis yok. Sıradaki: ${nextOf(ctx, 'meal')}`, `Not serving right now. Next: ${nextOf(ctx, 'meal')}`);
  if (doneToday(ctx, `meal-${m.meal}`)) return T('Bu öğünü zaten yedin.', 'You already ate this meal.');
  return undefined;
}

export function washHands(ctx: GameCtx) {
  if (doneToday(ctx, 'wash')) { ctx.toast(T('Ellerin zaten temiz. 🧼', 'Your hands are already clean. 🧼')); return; }
  markToday(ctx, 'wash'); ctx.advance(3); ctx.toast(T('Eller tertemiz. 🧼', 'Squeaky clean hands. 🧼'), 'good');
}

/** you sat down with a tray: eat, and get to know the people at your table */
export function eatMeal(ctx: GameCtx, meal: MealId, mealName: string, tablemates: NpcDef[]) {
  markToday(ctx, `meal-${meal}`);
  // every meal you eat counts toward "Three Meals", even before that mission opens
  if (!ctx.st.meals.includes(meal)) {
    ctx.st.meals.push(meal);
    const left = (['breakfast', 'lunch', 'dinner'] as const).filter((m) => !ctx.st.meals.includes(m)).length;
    ctx.toast(left
      ? T(`✓ ${mealName} "Üç Öğün" görevine sayıldı (${3 - left}/3)`, `✓ ${mealName} counted for "Three Meals" (${3 - left}/3)`)
      : T('✓ Üç öğünün hepsi tamam!', '✓ All three meals done!'), 'good');
  }
  const flu = ctx.clock.day >= 10 && ctx.clock.day <= 20;
  ctx.st.health = clamp(ctx.st.health + (flu && !doneToday(ctx, 'wash') ? -6 : 3));
  if (flu && !doneToday(ctx, 'wash')) ctx.toast(T('Ellerini yıkamadan yedin… Grip mevsiminde dikkat!', "You ate without washing your hands… careful in flu season!"));
  ctx.advance(30);
  ctx.gain({ hunger: 100, mood: 5, xp: 10 });
  if (ctx.st.once.classDrawn && tablemates.length) {
    tablemates.forEach((n) => ctx.befriend(n.id, n.kind === 'classmate' ? 8 : 5));
    ctx.toast(T(`Masada: ${tablemates.map((n) => n.name).join(', ')}. Afiyet olsun!`, `At your table: ${tablemates.map((n) => n.name).join(', ')}. Enjoy!`), 'good');
  } else {
    ctx.toast(T('Afiyet olsun!', 'Enjoy your meal!'), 'good');
  }
}

/** dining hall menus: 'kantin' = the canteen counter, 'exit' = the door (outside, auditorium, roof terrace) */
export function yemekhane(ctx: GameCtx, mode: 'kantin' | 'exit' = 'exit'): PanelView {
  const minutes = ctx.clock.minutes;
  const kantinOpen = minutes >= 8 * 60 && minutes < 18 * 60;
  const rooms: RoomView[] = [
      {
        id: 'kantin', name: T('Şakir Abi\'nin Kantini', "Şakir's canteen"),
        note: kantinOpen
          ? T(`Şakir Abi: "Ne alırsın evlat?" · Cebinde ${ctx.st.money} ₺ · telefon kartın ${ctx.st.phoneUnits} kontör`, `Şakir: "What'll it be, kid?" · You have ${ctx.st.money} ₺ · ${ctx.st.phoneUnits} phone units`)
          : T('Kantin kapalı (08:00–18:00).', 'The canteen is closed (08:00–18:00).'),
        actions: [
          ...visitActions(ctx),
          ...KANTIN.map((k) => ({
            id: k.id, label: `${L(k.name)} · ${k.price} ₺`, hint: T(`+${k.hunger} tokluk · +${k.mood} moral`, `+${k.hunger} fullness · +${k.mood} mood`),
            locked: !kantinOpen ? T('Kapalı', 'Closed') : ctx.st.money < k.price ? T('Paran yetmiyor.', "You can't afford it.") : undefined,
            run: () => {
              ctx.gain({ money: -k.price, hunger: k.hunger, mood: k.mood });
              ctx.advance(10);
              ctx.toast(T(`${L(k.name)} · afiyet olsun!`, `${L(k.name)} · enjoy!`));
            },
          })),
          {
            id: 'movie', label: T('🎬 Kantinde film izle', '🎬 Watch a film in the canteen'), hint: T('90 dk · +12 moral · günde bir', '90 min · +12 mood · once a day'),
            locked: !kantinOpen ? T('Kapalı', 'Closed')
              : !isWeekend(ctx.clock.day) && minutes < 15 * 60 + 20 ? T('Filmler dersler bittikten sonra (15:20) ya da hafta sonu.', 'Films are on after lessons (15:20) or at weekends.')
                : doneToday(ctx, 'movie') ? T('Bugün zaten film izledin.', 'You already watched a film today.') : undefined,
            run: async () => {
              markToday(ctx, 'movie'); ctx.advance(90); ctx.gain({ mood: 12, energy: -5, xp: 10 });
              const films = [T('eski bir Kemal Sunal filmi', 'an old Kemal Sunal comedy'), T('bir uzay macerası', 'a space adventure'), T('bir animasyon', 'an animated film'), T('bir futbol belgeseli', 'a football documentary')];
              await ctx.panel.message(T('Film saati', 'Film time'), T(`Kantinin köşesindeki televizyonda ${films[ctx.clock.day % films.length]} vardı. Şakir Abi herkese patlamış mısır dağıttı.`, `The TV in the corner showed ${films[ctx.clock.day % films.length]}. Şakir handed out popcorn to everyone.`));
            },
          },
          {
            id: 'hangout', label: T('Masada takıl', 'Hang out at a table'), hint: T('30 dk · +4 moral', '30 min · +4 mood'),
            locked: !kantinOpen ? T('Kapalı', 'Closed') : undefined,
            run: () => {
              ctx.advance(30); ctx.gain({ mood: 4, attrs: { social: Math.random() < 0.3 ? 1 : 0 } });
              const pals = NPCS.filter((n) => (ctx.st.friends[n.id] ?? 0) > 0);
              const pal = pals[Math.floor(Math.random() * pals.length)];
              if (pal) { ctx.befriend(pal.id, 3); ctx.toast(T(`${pal.name} de geldi; biraz sohbet ettiniz.`, `${pal.name} turned up and you chatted for a bit.`), 'good'); }
              else ctx.toast(T('Kantin kalabalığını izledin.', 'You people-watched the busy canteen.'));
            },
          },
          {
            id: 'phonecard', label: T(`☎️ Telefon kartı · ${PHONE_CARD.price} ₺`, `☎️ Phone card · ${PHONE_CARD.price} ₺`), hint: T(`${PHONE_CARD.units} kontör · yurttaki ankesörlü telefon için`, `${PHONE_CARD.units} units · for the payphone in your dorm`),
            locked: !kantinOpen ? T('Kapalı', 'Closed') : ctx.st.money < PHONE_CARD.price ? T('Paran yetmiyor.', "You can't afford it.") : undefined,
            run: () => { ctx.gain({ money: -PHONE_CARD.price }); ctx.st.phoneUnits += PHONE_CARD.units; ctx.toast(T(`Telefon kartı aldın: ${ctx.st.phoneUnits} kontör.`, `Phone card bought: ${ctx.st.phoneUnits} units.`), 'good'); },
          },
        ],
      },
      {
        id: 'konferans', name: T('Konferans salonu', 'Auditorium'),
        note: T('Kırmızı koltuklar ve büyük bir sahne. Törenler ve tiyatro gösterileri burada yapılır.', 'Red seats and a big stage. Ceremonies and plays happen here.'),
        actions: [...councilHallActions(ctx), {
          id: 'karne', label: T('Karne törenine katıl', 'Attend the report card ceremony'), hint: T('1. yılın sonu', 'The end of Year 1'),
          locked: needMission(ctx, 'karne') ?? (ctx.st.yearDone ? T('Karneni aldın. 🎓', 'You have your report card. 🎓')
            : ctx.st.xp < YEAR1_XP ? T(`Önce ${YEAR1_XP} XP topla (${ctx.st.xp}/${YEAR1_XP}).`, `Earn ${YEAR1_XP} XP first (${ctx.st.xp}/${YEAR1_XP}).`) : undefined),
          run: () => { ctx.st.yearDone = true; ctx.panel.close(); ctx.yearEnd(); },
        }],
      },
      {
        id: 'teras', name: T('Çatı terası', 'Roof terrace'),
        note: T('Buradan bütün kampüs görünüyor.', 'You can see the whole campus from up here.'),
        actions: [{
          id: 'view', label: T('Manzarayı izle', 'Enjoy the view'), hint: T('15 dk · +8 moral (günde bir)', '15 min · +8 mood (once a day)'),
          locked: doneToday(ctx, 'terrace') ? T('Bugün zaten çıktın.', 'You were already up here today.') : undefined,
          run: () => { markToday(ctx, 'terrace'); ctx.advance(15); ctx.gain({ mood: 8 }); ctx.toast(T('Rüzgâr yüzüne çarpıyor. İyi geldi.', 'The breeze feels good.'), 'good'); },
        }],
      },
  ];
  if (mode === 'kantin') return { title: T('Kantin', 'Canteen'), sub: 'Yemekhane', status: status(ctx), rooms: rooms.filter((r) => r.id === 'kantin') };
  return {
    title: 'Yemekhane', sub: T('Yemekhane & Sosyal Merkez', 'Dining hall & social center'), status: status(ctx),
    rooms: [
      { id: 'cikis', name: T('Çıkış', 'Exit'), note: T('Merdivenler konferans salonuna ve çatı terasına çıkıyor.', 'The stairs lead up to the auditorium and the roof terrace.'), actions: [{ id: 'out', label: T('Dışarı çık', 'Go outside'), run: () => { ctx.panel.close(); ctx.leaveDorm(); } }] },
      ...rooms.filter((r) => r.id !== 'kantin'),
    ],
  };
}

// ---------------- inside your dorm (walkable room) ----------------

const belletmenName = (ctx: GameCtx) => (ctx.ch.gender === 'girl' ? 'Hatice Hanım' : 'Mehmet Bey');
const dormTitle = (ctx: GameCtx) => (ctx.ch.gender === 'girl' ? T('Kız Yurdu', "Girls' Dorm") : T('Erkek Yurdu', "Boys' Dorm"));

/** your desk in the study room: homework, reading, drawing */
/** İstiklal Marşı: write it out and memorise it stanza by stanza at evening study, then recite it to the belletmen */
function anthemActions(ctx: GameCtx): ActionView[] {
  const st = ctx.st;
  const a = st.anthem;
  if (a.recited) return [];
  const etut = phaseOf(ctx.clock.minutes) === 'etut';
  const belletmen = ctx.ch.gender === 'girl' ? 'Hatice Hanım' : 'Mehmet Bey';
  const notAtStudy = etut ? undefined : T('Etüt saatinde çalışılır (18:00–20:00).', 'Done during evening study (18:00–20:00).');
  if (a.stanzas < ANTHEM_STANZAS) {
    return [{
      id: 'anthem', label: T(`🇹🇷 İstiklal Marşı'nı yaz ve ezberle (${a.stanzas}/${ANTHEM_STANZAS} kıta)`, `🇹🇷 Write out and memorise the İstiklal Marşı (${a.stanzas}/${ANTHEM_STANZAS} stanzas)`),
      hint: T('40 dk · etütte, günde bir · deftere güzel yazıyla', '40 min · at study, once a day · in your neatest handwriting'),
      locked: needRegistration(ctx) ?? notAtStudy ?? (doneToday(ctx, 'anthem') ? T('Bugünkü kıtalarını çalıştın.', "You've done today's stanzas.") : undefined),
      run: async () => {
        markToday(ctx, 'anthem');
        const hits = await ctx.panel.timing(T('Kıtayı deftere yaz', 'Copy the stanza into your notebook'), 3, 0.24, 1.1);
        const learned = Math.min(ANTHEM_STANZAS - a.stanzas, hits >= 2 ? 2 : 1);
        a.stanzas += learned;
        ctx.advance(40);
        ctx.gain({ xp: 10 + hits * 4, energy: -4, attrs: { discipline: 1 } });
        ctx.toast(a.stanzas >= ANTHEM_STANZAS
          ? T(`On kıtanın hepsi defterinde ve aklında! Şimdi ${belletmen}'e ezberden oku.`, `All ten stanzas are in your notebook and in your head! Now recite them to ${belletmen}.`)
          : T(`"Korkma, sönmez bu şafaklarda yüzen al sancak…" · ${a.stanzas}/${ANTHEM_STANZAS} kıta`, `"Korkma, sönmez bu şafaklarda yüzen al sancak…" · ${a.stanzas}/${ANTHEM_STANZAS} stanzas`), 'good');
      },
    }];
  }
  return [{
    id: 'recite', label: T(`🎤 ${belletmen}'e İstiklal Marşı'nı ezberden oku`, `🎤 Recite the İstiklal Marşı to ${belletmen}`), hint: T('Ritmi kaçırma: 10 kıta, en az 7 doğru', "Keep the rhythm: 10 stanzas, at least 7 right"),
    locked: notAtStudy,
    run: async () => {
      const hits = await ctx.panel.rhythm(T('İstiklal Marşı', 'İstiklal Marşı'), T('Her kıta çizgiye gelince BOŞLUK\'a bas.', 'Press SPACE as each stanza crosses the line.'), 10, 0.38);
      ctx.advance(15);
      if (hits >= 7) {
        a.recited = true;
        ctx.ch.respect += 10;
        ctx.gain({ xp: 80, mood: 10 });
        await ctx.panel.message(T('Aferin!', 'Well done!'), T(`${belletmen} ayağa kalktı ve alkışladı: "Bir kelimesini bile kaçırmadın. Pazartesi töreninde sen okuyacaksın!" +10 saygınlık`, `${belletmen} stood up and applauded: "You didn't miss a single word. You'll lead it at Monday's ceremony!" +10 respect`));
      } else {
        ctx.gain({ xp: 10 });
        ctx.toast(T(`${hits}/10 · "Birkaç yerde takıldın. Yarın etütte tekrar dinlerim."`, `${hits}/10 · "You stumbled in a few places. I'll hear it again tomorrow at study."`));
      }
    },
  }];
}

export function deskPanel(ctx: GameCtx): PanelView {
  const st = ctx.st;
  const phase = phaseOf(ctx.clock.minutes);
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
          id: 'homework', label: hw ? T(`Ödev yap: ${subjName(hw.s)}`, `Do homework: ${subjName(hw.s)}`) : T('Ödev yap', 'Do homework'),
          hint: T('Tahmin oyunu · 30 dk · −6 enerji · notun ve disiplinin için iyi', 'Guessing game · 30 min · −6 energy · good for grades and discipline'),
          locked: !hw ? T('Bekleyen ödevin yok. 🎉', 'No homework due. 🎉') : phase === 'night' ? T('Işıklar söndü.', 'Lights are out.') : sickLock(ctx),
          run: async () => {
            const r = await ctx.panel.guessScore(T(`Ödev: ${subjName(hw.s)}`, `Homework: ${subjName(hw.s)}`), T('Cevap 1 ile 20 arasında bir sayı. İpuçlarını takip et: 4 hakkın var.', 'The answer is a number from 1 to 20. Follow the hints: you have 4 tries.'), 20, 4);
            const score = Math.min(100, (r.ok ? [100, 85, 70, 55][r.used - 1] : 30) + Math.round(ctx.ch.attributes.knowledge / 4));
            st.school.homework.shift();
            st.school.scores[hw.s].push(score);
            ctx.advance(30);
            ctx.gain({ xp: 10 + Math.round(score / 5), energy: -6, mood: -2, attrs: { discipline: 1 } });
            ctx.toast(T('Ödev bitti. Yarın öğretmenin memnun olacak.', 'Homework done. Your teacher will be pleased tomorrow.'), 'good');
          },
        },
        {
          id: 'read', label: book ? T(`Kitap oku: ${L(book.title)} (${st.reading.sessions}/3)`, `Read: ${L(book.title)} (${st.reading.sessions}/3)`) : T('Kitap oku', 'Read a book'),
          hint: T('45 dk · +1 Bilgi · −5 enerji', '45 min · +1 Knowledge · −5 energy'),
          locked: !book ? T('Okuyacak kitabın yok. Kütüphane\'den ödünç al.', 'You have no book. Borrow one from the library.') : st.reading.sessions >= 3 ? T('Kitabı bitirdin; kütüphaneciyle konuş.', 'You finished it; talk to the librarian.') : undefined,
          run: () => {
            st.reading.sessions++; ctx.advance(45); ctx.gain({ xp: 15, energy: -5, attrs: { knowledge: 1 } });
            ctx.toast(T(`Okuma ${st.reading.sessions}/3`, `Reading ${st.reading.sessions}/3`), 'good');
          },
        },
        ...anthemActions(ctx),
        {
          id: 'create', label: T('Yaratıcı ol: resim çiz, hikâye yaz', 'Get creative: draw, write a story'),
          hint: T('40 dk · +2 Yaratıcılık · +5 moral', '40 min · +2 Creativity · +5 mood'),
          run: () => {
            ctx.advance(40); ctx.gain({ mood: 5, energy: -4, xp: 10, attrs: { creativity: 2 } });
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
    title: npc.name, sub: `${L(npc.role)} · ${L(friendLevel(f))} ${f}/100`, status: status(ctx),
    rooms: [{
      id: 'mate', name: npc.name,
      note: near ? T(`⚠ ${bel} hemen yakınında!`, `⚠ ${bel} is right nearby!`) : T(`${npc.name} defterine bir şeyler karalıyor.`, `${npc.name} is scribbling in a notebook.`),
      actions: [
        {
          id: 'whisper', label: T('Fısıldaş', 'Whisper'), hint: T(`10 dk · +10 arkadaşlık · yakalanma riski %${Math.round(risk(0.1) * 100)}`, `10 min · +10 friendship · ${Math.round(risk(0.1) * 100)}% chance of getting caught`),
          run: async () => {
            ctx.advance(10);
            ctx.befriend(npc.id, 10);
            if (Math.random() < risk(0.1)) ctx.penalize(2, T(`${bel}: "Etütte konuşma yok!"`, `${bel}: "No talking during study time!"`));
            else await ctx.panel.message(npc.name, `"${L(npc.lines[ctx.clock.day % npc.lines.length])}"`);
          },
        },
        {
          id: 'play', label: T('Gizlice oyun oyna', 'Play a game on the sly'), hint: T(`45 dk · +10 moral · +15 arkadaşlık · yakalanma riski %${Math.round(risk(0.3) * 100)}`, `45 min · +10 mood · +15 friendship · ${Math.round(risk(0.3) * 100)}% chance of getting caught`),
          run: async () => {
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
          run: () => {
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
  const phase = phaseOf(m);
  if (!st.once.luggage) {
    return {
      title: T('Yatağın', 'Your bed'), sub: dormAddress(ctx), status: status(ctx),
      rooms: [{
        id: 'bed', name: T('Yatağın', 'Your bed'),
        note: T(`Belletmen ${belletmenName(ctx)}: "Hoş geldin! Yatağın burası, cam kenarında. Bavulunu bırak, sonra kampüsü bir gez."`, `${belletmenName(ctx)}: "Welcome! This is your bed, by the window. Drop your suitcase, then take a look around campus."`),
        actions: [{
          id: 'luggage', label: T('Bavulunu yatağın altına koy', 'Slide your suitcase under the bed'), hint: T('10 dk', '10 min'),
          run: () => { st.once.luggage = true; ctx.advance(10); ctx.gain({ xp: 10, mood: 5 }); ctx.toast(T('Bavulun yerleşti. Şimdi kampüsü keşfet!', 'Suitcase stowed. Now go and explore the campus!'), 'good'); },
        }],
      }],
    };
  }
  return {
    title: T('Yatağın', 'Your bed'), sub: dormAddress(ctx), status: status(ctx),
    rooms: [{
      id: 'bed', name: T('Yatağın', 'Your bed'),
      note: phase === 'night' ? T('Işıklar söndü. Herkes uyuyor…', 'Lights are out. Everyone is asleep…') : T('Battaniyen düzgünce katlanmış.', 'Your blanket is neatly folded.'),
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
  const keep = capitalize(keepsakeName(ctx.ch.cause, ctx.ch.loss));
  return {
    title: T('Dolabın', 'Your locker'), sub: dormAddress(ctx), status: status(ctx),
    rooms: [{
      id: 'locker', name: T('Dolabın', 'Your locker'),
      note: T('Üniforman, montun ve en değerli eşyan burada.', 'Your uniform, your coat and your most precious thing are in here.'),
      actions: [
        {
          id: 'keepsake', label: T(`Hatıranı tut: ${keep}`, `Hold your keepsake: ${keep}`), hint: T('+20 moral (günde bir)', '+20 mood (once a day)'),
          locked: doneToday(ctx, 'keepsake') ? T('Bugün zaten tuttun.', 'Already today.') : undefined,
          run: () => { markToday(ctx, 'keepsake'); ctx.advance(5); ctx.gain({ mood: 20 }); ctx.toast(T('Bir an gözlerini kapatıyorsun. İçin ısınıyor.', 'You close your eyes for a moment. It warms your heart.'), 'good'); },
        },
        {
          id: 'letter', label: T('Eve mektup yaz', 'Write a letter home'), hint: T('20 dk · +8 moral (günde bir)', '20 min · +8 mood (once a day)'),
          locked: doneToday(ctx, 'letter') ? T('Bugün zaten yazdın.', 'Already today.') : undefined,
          run: () => { markToday(ctx, 'letter'); ctx.advance(20); ctx.gain({ mood: 8, attrs: { creativity: 1 } }); ctx.toast(T('Mektubun yarın postaya verilecek.', 'Your letter goes out with tomorrow\'s post.'), 'good'); },
        },
      ],
    }],
  };
}

export function tvPanel(ctx: GameCtx): PanelView {
  const phase = phaseOf(ctx.clock.minutes);
  return {
    title: T('Televizyon köşesi', 'TV corner'), status: status(ctx),
    rooms: [{
      id: 'tv', name: 'TV', note: T('Eski bir televizyon ve yumuşak bir halı.', 'An old TV and a soft rug.'),
      actions: [{
        id: 'tv', label: T('Biraz televizyon izle', 'Watch some TV'), hint: T('30 dk · +5 moral · +3 enerji', '30 min · +5 mood · +3 energy'),
        locked: phase === 'etut' ? T(`${belletmenName(ctx)}: "Etütte televizyon yok!"`, `${belletmenName(ctx)}: "No TV during study time!"`) : phase === 'night' ? T('Işıklar söndü.', 'Lights are out.') : undefined,
        run: () => { ctx.advance(30); ctx.gain({ mood: 5, energy: 3 }); },
      }],
    }],
  };
}

/** the door out of the dorm: shut during study time and at night */
export function exitPanel(ctx: GameCtx): PanelView {
  const st = ctx.st;
  const phase = phaseOf(ctx.clock.minutes);
  const bel = belletmenName(ctx);
  const canEscape = st.year >= ESCAPE_FROM_YEAR || DEV;
  const actions: ActionView[] = [];
  if (phase === 'night') {
    actions.push({
      id: 'escape', label: T('🌙 Gizlice yurttan kaç', '🌙 Sneak out of the dorm'),
      hint: T('Çok zor · belletmenin nöbet sırasını tahmin et (1–10, 2 hak)', 'Very hard · guess the belletmen\'s patrol turn (1–10, 2 tries)'),
      locked: !canEscape ? T(`Bunu ancak 6. sınıftan itibaren deneyebilirsin (şu an ${grade(st.year)}. sınıf).`, `Only from grade 6 on (you're in grade ${grade(st.year)}).`) : undefined,
      run: async () => {
        const ok = await ctx.panel.guess(T('Kaçış: belletmen kaçıncı turda kapıdan uzaklaşacak?', 'Escape: on which round will the belletmen leave the door?'), 10, 2);
        if (ok) { st.escapes++; ctx.panel.close(); ctx.escape(); }
        else { ctx.penalize(10, T(`${bel} seni kapıda yakaladı! Hemen yatağa.`, `${bel} caught you at the door! Straight to bed.`)); ctx.gain({ mood: -8 }); }
      },
    });
  } else {
    actions.push({
      id: 'leave', label: T('Dışarı çık', 'Go outside'), hint: phase === 'plaza' ? T('22:00\'ye kadar yalnızca yurtların çevresi', 'Only around the dorms until 22:00') : T('Kampüse', 'To the campus'),
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
  const caring = ctx.ch.cause === 'illness';
  return {
    title: 'Revir', sub: T('Hemşire Gül Hanım · gece gündüz açık', 'Nurse Gül · open day and night'), status: status(ctx),
    rooms: [{
      id: 'revir', name: 'Revir',
      note: caring ? T('Gül Hanım seni hemen tanıyor: "Gel bakalım, yardımcı hemşirem!"', 'Nurse Gül recognises you right away: "Come in, my little assistant!"') : T('Temiz çarşaflar ve hafif bir kolonya kokusu.', 'Clean sheets and a faint smell of cologne.'),
      actions: [
        ...(ctx.st.sick ? [{
          id: 'treat', label: T('Tedavi ol', 'Get treated'), hint: T('3 saat yatak istirahati', '3 hours of bed rest'),
          run: async () => {
            ctx.st.sick = false; ctx.st.health = Math.max(ctx.st.health, 75);
            ctx.advance(180); ctx.gain({ energy: 20, mood: 5 });
            await ctx.panel.message('Gül Hanım', T('"Ateşin düştü. Bol sıvı iç, ellerini yıka ve geceleri dışarıda kalma!"', '"Your fever is down. Drink plenty, wash your hands and don\'t stay out at night!"'));
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
              `Gül Hanım boyunu ölçtü, kulaklarına ve dişlerine baktı, aşı kartını kontrol etti. Göz testi: 10 üzerinden ${vision}. "Sağlığın yerinde! Bol su iç, öğünlerini atlama. Kendini kötü hissedersen gece gündüz buradayım."`,
              `Nurse Gül measured your height, checked your ears and teeth and looked over your vaccination card. Eye test: ${vision}/10. "You're healthy! Drink plenty of water and don't skip meals. If you ever feel unwell, I'm here day and night."`));
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
          id: 'nurse', label: T('Hemşireyle sohbet et', 'Chat with the nurse'), hint: T('10 dk · +5 moral', '10 min · +5 mood'),
          locked: doneToday(ctx, 'nurse') ? T('Bugün zaten konuştunuz.', 'You already talked today.') : undefined,
          run: () => { markToday(ctx, 'nurse'); ctx.advance(10); ctx.gain({ mood: caring ? 10 : 5 }); },
        },
      ],
    }],
  };
}

function spor(ctx: GameCtx): PanelView {
  const st = ctx.st;
  const sport = SPORTS.find((x) => x.id === st.sport);
  const { day, minutes } = ctx.clock;
  const trainingTime = isWeekend(day) ? minutes >= 10 * 60 && minutes < 17 * 60 : minutes >= 15.5 * 60 && minutes < 17 * 60;
  const enroll: ActionView = {
    id: 'enroll', label: T('Bir spora yazıl', 'Join a sport'), hint: T('Seçmeler · 3 deneme · 2 isabet gerekli', 'Try-out · 3 attempts · 2 hits needed'),
    locked: needMission(ctx, 'spora_basla') ?? sickLock(ctx) ?? (!st.school.kit ? T('Spor ayakkabın yok. Ambar\'dan al.', 'You have no sports shoes. Get them at the Ambar.')
      : doneToday(ctx, 'tryout') ? T('Antrenör: "Yarın tekrar dene!"', 'Coach: "Try again tomorrow!"') : undefined),
    run: async () => {
      const id = await ctx.panel.choose(T('Hangi spor?', 'Which sport?'), SPORTS.map((x) => ({ id: x.id, label: L(x.name), hint: `${L(x.where)} · ${L(x.tryout)}` })));
      if (!id) return;
      const sp = SPORTS.find((x) => x.id === id)!;
      const hits = await ctx.panel.timing(`${L(sp.name)}: ${L(sp.tryout)}`, 3, sp.zone, sp.speed);
      ctx.advance(30);
      if (hits >= 2) {
        st.sport = sp.id;
        ctx.gain({ xp: 100, attrs: { fitness: 2 }, mood: 8, energy: -10 });
        await ctx.panel.message(T('Takımdasın!', "You're on the team!"), T(`Antrenör Kemal Bey: "Hoş geldin! ${L(sp.name)} antrenmanları hafta içi 15:30–17:00 arası."`, `Coach Kemal: "Welcome aboard! ${L(sp.name)} training is on weekdays 15:30–17:00."`));
      } else {
        markToday(ctx, 'tryout');
        ctx.gain({ energy: -10 });
        await ctx.panel.message(T('Bu sefer olmadı', 'Not this time'), T('Antrenör Kemal Bey: "Fena değildi! Yarın tekrar gel."', 'Coach Kemal: "Not bad! Come back tomorrow."'));
      }
    },
  };
  const train: ActionView = {
    id: 'train', label: sport ? T(`Antrenman: ${L(sport.name)}`, `Training: ${L(sport.name)}`) : T('Antrenman', 'Training'),
    hint: T('1 saat · −15 enerji · +2 Kondisyon · +15 XP', '1 hour · −15 energy · +2 Fitness · +15 XP'),
    locked: sickLock(ctx) ?? (!trainingTime ? T('Antrenmanlar hafta içi 15:30–17:00 (hafta sonu 10:00–17:00).', 'Training is weekdays 15:30–17:00 (weekends 10:00–17:00).')
      : ctx.st.energy < 15 ? T('Çok yorgunsun.', "You're too tired.") : undefined),
    run: () => {
      ctx.st.health = clamp(ctx.st.health + 2);
      st.trainings++; ctx.advance(60); ctx.gain({ xp: 15, energy: -15, mood: 4, attrs: { fitness: 2 } });
      ctx.toast(T(`Antrenman tamam (${st.trainings}).`, `Training done (${st.trainings}).`), 'good');
    },
  };
  return {
    title: 'Spor Salonu', sub: T('Salon · havuz · eskrim', 'Hall · pool · fencing'), status: status(ctx),
    rooms: [
      {
        id: 'antrenor', name: T('Antrenör odası', "Coaches' office"),
        note: sport ? T(`Takımın: ${L(sport.name)} (${L(sport.where)}).`, `Your team: ${L(sport.name)} (${L(sport.where)}).`) : T('Antrenör Kemal Bey: "Bir spor seç, seçmelere gir!"', 'Coach Kemal: "Pick a sport and try out!"'),
        actions: sport ? [train] : [enroll],
      },
      { id: 'salon', name: T('Ana salon', 'Main hall'), note: T('Basketbol, voleybol ve futsal sahaları. Ayakkabı gıcırtıları yankılanıyor.', 'Basketball, volleyball and futsal courts. Squeaking shoes echo everywhere.'), actions: [] },
      { id: 'havuz', name: T('Havuz', 'Pool'), note: T('Klor kokusu ve mavi kulvarlar.', 'The smell of chlorine and blue lanes.'), actions: [] },
      { id: 'eskrim', name: T('Eskrim salonu', 'Fencing room'), note: T('Beyaz kıyafetler, maskeler ve parlayan pistler.', 'White suits, masks and gleaming pistes.'), actions: [] },
    ],
  };
}

function teknik(ctx: GameCtx): PanelView {
  return {
    title: 'Teknik Alan', sub: T('Hüseyin Usta\'nın atölyesi', "Hüseyin Usta's workshop"), status: status(ctx),
    rooms: [{
      id: 'atolye', name: T('Atölye', 'Workshop'),
      note: T('Takım tezgâhı, yağ kokusu ve her yerde vidalar.', 'A workbench, the smell of oil and screws everywhere.'),
      actions: [{
        id: 'help', label: T('Hüseyin Usta\'ya yardım et', 'Help Hüseyin Usta'), hint: T('45 dk · +2 Yaratıcılık · +15 XP (günde bir)', '45 min · +2 Creativity · +15 XP (once a day)'),
        locked: doneToday(ctx, 'workshop') ? T('Usta: "Yarın yine gel evlat."', 'Usta: "Come back tomorrow, kid."') : undefined,
        run: () => { markToday(ctx, 'workshop'); ctx.advance(45); ctx.gain({ xp: 15, attrs: { creativity: 2 } }); ctx.toast(T('Birlikte bozuk bir sandalyeyi tamir ettiniz.', 'Together you fixed a broken chair.'), 'good'); },
      }],
    }],
  };
}

const pickRandom = <X,>(a: readonly X[]) => a[Math.floor(Math.random() * a.length)];

/** the fun, risky and mean things you can do with another student (once a day each) */
function socialActions(npc: NpcDef, ctx: GameCtx, f: number, lock: string | undefined): ActionView[] {
  const st = ctx.st;
  const once = (key: string) => (doneToday(ctx, `${key}-${npc.id}`) ? T('Bugün zaten yaptın.', 'Already done today.') : undefined);
  const mark = (key: string) => markToday(ctx, `${key}-${npc.id}`);
  const others = NPCS.filter((n) => n.id !== npc.id && n.kind !== 'belletmen' && (st.friends[n.id] !== undefined || n.kind === 'classmate'));
  const say = (tr: string, en: string) => ctx.panel.message(npc.name, T(tr, en));
  const hw = st.school.homework[0];
  const list: ActionView[] = [
    {
      id: 'play', label: T('🎮 Birlikte oyun oyna', '🎮 Play a game together'), hint: T('Taş-kâğıt-makas, misket, yakar top, saklambaç', 'Rock-paper-scissors, marbles, dodgeball, hide-and-seek'),
      locked: lock ?? once('play'),
      run: async () => {
        const game = await ctx.panel.choose(T('Ne oynayalım?', 'What shall we play?'), [
          { id: 'rps', label: T('✊ Taş-kâğıt-makas', '✊ Rock-paper-scissors'), hint: T('5 dk', '5 min') },
          { id: 'misket', label: T('🔵 Misket', '🔵 Marbles'), hint: T('20 dk · misketini kaybedebilirsin', '20 min · you might lose a marble') },
          { id: 'yakar', label: T('🏐 Yakar top', '🏐 Dodgeball'), hint: T('30 dk · +Kondisyon · −enerji', '30 min · +Fitness · −energy') },
          { id: 'saklambac', label: T('🙈 Saklambaç', '🙈 Hide-and-seek'), hint: T('40 dk', '40 min') },
        ]);
        if (!game) return;
        mark('play');
        if (game === 'rps') {
          const moves = [{ id: 'tas', label: T('✊ Taş', '✊ Rock') }, { id: 'kagit', label: T('✋ Kâğıt', '✋ Paper') }, { id: 'makas', label: T('✌️ Makas', '✌️ Scissors') }];
          const mine = await ctx.panel.choose(T('Taş, kâğıt, makas…', 'Rock, paper, scissors…'), moves);
          if (!mine) return;
          const theirs = pickRandom(moves).id;
          const beats: Record<string, string> = { tas: 'makas', kagit: 'tas', makas: 'kagit' };
          const theirLabel = moves.find((m) => m.id === theirs)!.label;
          ctx.advance(5);
          if (mine === theirs) { ctx.befriend(npc.id, 8); await say(`İkiniz de ${theirLabel}! Berabere, bir daha!`, `You both picked ${theirLabel}! A draw, again!`); }
          else if (beats[mine] === theirs) { ctx.befriend(npc.id, 10); ctx.gain({ mood: 6 }); await say(`${npc.name} ${theirLabel} yaptı. Kazandın! 🎉`, `${npc.name} picked ${theirLabel}. You win! 🎉`); }
          else { ctx.befriend(npc.id, 6); ctx.gain({ mood: -1 }); await say(`${npc.name} ${theirLabel} yaptı ve kazandı. "Rövanş ister misin?" 😏`, `${npc.name} picked ${theirLabel} and won. "Want a rematch?" 😏`); }
        } else if (game === 'misket') {
          ctx.advance(20);
          if (Math.random() < 0.5) { ctx.befriend(npc.id, 6); ctx.gain({ mood: 6 }); await say('Tam isabet! Onun en güzel misketini kazandın.', 'Bullseye! You won their best marble.'); }
          else { ctx.befriend(npc.id, 9); ctx.gain({ mood: -2 }); await say(`${npc.name} senin mavi misketini kazandı ve çok sevindi.`, `${npc.name} won your blue marble and is over the moon.`); }
        } else if (game === 'yakar') {
          ctx.advance(30);
          ctx.befriend(npc.id, 10);
          ctx.gain({ energy: -8, attrs: { fitness: 1 } });
          if (Math.random() < 0.25) { ctx.gain({ mood: -3 }); await say('Top tam suratına geldi! Herkes güldü… sen de güldün sonunda. 😅', 'The ball hit you right in the face! Everyone laughed… eventually you did too. 😅'); }
          else { ctx.gain({ mood: 6 }); await say('Son kalan sen oldun ve takımını kurtardın!', 'You were the last one standing and saved your team!'); }
        } else {
          ctx.advance(40);
          ctx.befriend(npc.id, 12);
          if (Math.random() < 0.2) { ctx.gain({ mood: -2 }); await say(`O kadar iyi saklandın ki ${npc.name} seni aramayı unutup yemeğe gitti. 🙃`, `You hid so well that ${npc.name} forgot about you and went to eat. 🙃`); }
          else { ctx.gain({ mood: 6 }); await say('Ranzanın altında gizlendin; kimse bulamadı!', 'You hid under a bunk bed; nobody found you!'); }
        }
      },
    },
    {
      id: 'joke', label: T('😂 Şaka yap', '😂 Tell a joke'), hint: T('Güldürürsen +10 · tutmazsa −3', 'If they laugh +10 · if it flops −3'),
      locked: lock ?? once('joke'),
      run: async () => {
        mark('joke');
        ctx.advance(5);
        const jokes = [
          T('"Temel ile Dursun kantine gitmiş…" diye başladın.', 'You started with "So Temel and Dursun walk into the canteen…"'),
          T('Ahmet Bey\'in "Sessiz olun!" deyişini taklit ettin.', 'You did an impression of Mr. Ahmet saying "Quiet, please!"'),
          T('"Neden matematik kitabı üzgünmüş? Çünkü çok problemi varmış!" dedin.', '"Why was the maths book sad? It had too many problems!"'),
        ];
        const joke = pickRandom(jokes);
        if (Math.random() < 0.6) { ctx.befriend(npc.id, 10); ctx.gain({ mood: 4, attrs: { social: 1 } }); await ctx.panel.message(npc.name, `${joke} ${T(`${npc.name} gülmekten yere yattı! 😂`, `${npc.name} is rolling on the floor laughing! 😂`)}`); }
        else { ctx.befriend(npc.id, -3); ctx.gain({ mood: -2 }); await ctx.panel.message(npc.name, `${joke} ${T(`${npc.name}: "…Anlamadım." Cırcır böcekleri öttü. 🦗`, `${npc.name}: "…I don't get it." Crickets. 🦗`)}`); }
      },
    },
    {
      id: 'nickname', label: T('🏷️ Lakap tak', '🏷️ Give them a nickname'), hint: T('Ya bayılır (+8) ya da nefret eder (−12)', 'They either love it (+8) or hate it (−12)'),
      locked: lock ?? once('nickname'),
      run: async () => {
        mark('nickname');
        const nick = pickRandom(['Kirpi', 'Uzay Adam', 'Profesör', 'Turbo', 'Fasulye', 'Şimşek', 'Kaptan', 'Pamuk']);
        if (Math.random() < 0.5) { ctx.befriend(npc.id, 8); await say(`"${nick}" mı? Bayıldım! Artık herkes bana böyle desin!`, `"${nick}"? I love it! Everyone has to call me that now!`); }
        else { ctx.befriend(npc.id, -12); ctx.gain({ mood: -2 }); await say(`"${nick}" mı?! Bir daha sakın bana öyle deme!`, `"${nick}"?! Don't you dare call me that again!`); }
      },
    },
    {
      id: 'gossip', label: T('🗣️ Dedikodu yap', '🗣️ Gossip about someone'), hint: T('Dinleyen +6 · hedefin −8 · duyulursa daha kötü', 'Listener +6 · your target −8 · worse if it gets back to them'),
      locked: lock ?? once('gossip') ?? (others.length ? undefined : T('Dedikodu yapacak kimseyi tanımıyorsun.', "You don't know anyone to gossip about.")),
      run: async () => {
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
          await say(`${npc.name} kıkırdadı… ama dedikodu ${target.name}'e kadar gitti! Seninle konuşmuyor.`, `${npc.name} giggled… but the gossip got back to ${target.name}! They're not speaking to you.`);
        } else {
          await say(`${npc.name}: "Yok artık! Kimseye söylemem, söz." 🤭`, `${npc.name}: "No way! I won't tell anyone, promise." 🤭`);
        }
      },
    },
    {
      id: 'mock', label: T('😜 Dalga geç', '😜 Make fun of them'), hint: T('Etraftakiler güler · o seni sevmez (−20) · ⚠ disiplin', 'Others laugh · they won\'t like you (−20) · ⚠ discipline'),
      locked: lock ?? once('mock'),
      run: async () => {
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
      locked: lock ?? once('copy') ?? (f < 40 ? T(`${npc.name} ödevini sana vermez; yeterince yakın değilsiniz.`, `${npc.name} won't share; you're not close enough.`) : undefined),
      run: async () => {
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
  if (f >= 60) {
    list.push({
      id: 'secret', label: T('🤫 Bir sırrını paylaş', '🤫 Share a secret'), hint: T('Yakın arkadaşlar için · +15', 'For close friends · +15'),
      locked: lock ?? once('secret'),
      run: async () => { mark('secret'); ctx.befriend(npc.id, 15); ctx.gain({ mood: 6 }); await say('"Kimseye söylemeyeceğim. Sen de benimkini dinler misin?"', '"I won\'t tell a soul. Will you listen to mine too?"'); },
    });
  }
  if (f < 0) {
    list.push({
      id: 'sorry', label: T('🙏 Özür dile', '🙏 Apologize'), hint: T('+15 · araları düzeltir', '+15 · patches things up'),
      locked: lock ?? once('sorry'),
      run: async () => { mark('sorry'); ctx.befriend(npc.id, 15); await say('"…Peki. Unutalım gitsin."', '"…Fine. Let\'s forget about it."'); },
    });
  }
  return list;
}

/** talking to a classmate or an older student */
export function npcPanel(npc: NpcDef, ctx: GameCtx): PanelView {
  const f = Math.round(ctx.st.friends[npc.id] ?? 0);
  const line = npc.lines[ctx.clock.day % npc.lines.length];
  const talks = Object.keys(ctx.st.daily).filter((k) => k.startsWith(`talk-${npc.id}-`) && ctx.st.daily[k] === ctx.clock.day).length;
  const actions: ActionView[] = [];
  if (npc.kind === 'belletmen') {
    actions.push({
      id: 'hello', label: T('Selam ver', 'Say hello'),
      run: async () => { await ctx.panel.message(npc.name, `"${L(line)}"`); },
    });
    actions.push({
      id: 'help', label: T('Belletmene yardım et', 'Help the belletmen'), hint: T('15 dk · +8 ilişki (günde bir)', '15 min · +8 relationship (once a day)'),
      locked: doneToday(ctx, `help-${npc.id}`) ? T('Bugün zaten yardım ettin.', 'You already helped today.') : undefined,
      run: () => { markToday(ctx, `help-${npc.id}`); ctx.advance(15); ctx.befriend(npc.id, 8); ctx.toast(T(`${npc.name} ile koridordaki çamaşırları katladınız.`, `You helped ${npc.name} fold the laundry in the corridor.`), 'good'); },
    });
  } else if (npc.kind === 'classmate' || npc.kind === 'student') {
    const lock = ctx.st.once.classDrawn ? undefined : T('Önce sınıf kuranı çek; sonra tanışırsınız.', 'Do your class draw first, then you can get to know each other.');
    actions.push({
      id: 'chat', label: T('Sohbet et', 'Chat'), hint: T('+15 arkadaşlık · günde 2 kez', '+15 friendship · twice a day'),
      locked: lock ?? (talks >= 2 ? T(`${npc.name} şimdilik başka işlerle meşgul. Yarın tekrar konuş.`, `${npc.name} is busy for now. Talk again tomorrow.`) : undefined),
      run: async () => {
        const first = !ctx.st.once[`met-${npc.id}`];
        ctx.st.once[`met-${npc.id}`] = true;
        ctx.st.daily[`talk-${npc.id}-${talks + 1}`] = ctx.clock.day;
        ctx.advance(10);
        ctx.befriend(npc.id, first ? 25 : 15);
        ctx.gain({ attrs: { social: 1 }, mood: 2, xp: 5 });
        await ctx.panel.message(npc.name, first
          ? T(`"Merhaba! Ben ${npc.name}. Sen de mi ${ctx.st.school.classLabel}'dasın? Süper!" ${L(line)}`, `"Hi! I'm ${npc.name}. You're in ${ctx.st.school.classLabel} too? Great!" ${L(line)}`)
          : `"${L(line)}"`);
      },
    });
    actions.push({
      id: 'treat', label: T('Simit ikram et (5 ₺)', 'Share a simit (5 ₺)'), hint: T('+12 arkadaşlık · günde bir', '+12 friendship · once a day'),
      locked: lock ?? (doneToday(ctx, `treat-${npc.id}`) ? T('Bugün zaten ikram ettin.', 'You already shared a treat today.') : ctx.st.money < 5 ? T('Paran yetmiyor.', "You can't afford it.") : undefined),
      run: () => {
        markToday(ctx, `treat-${npc.id}`);
        ctx.gain({ money: -5, mood: 3 });
        ctx.befriend(npc.id, 12);
        ctx.toast(T(`${npc.name}: "Teşekkürler, çok naziksin!"`, `${npc.name}: "Thanks, that's so kind!"`), 'good');
      },
    });
    actions.push(...socialActions(npc, ctx, f, lock));
  } else {
    const st = ctx.st;
    const lock = needMission(ctx, 'abi_sandvic');
    const mine = st.favor.giver === npc.id;
    if (st.favor.stage === 'none') {
      actions.push({
        id: 'offer', label: T('Yardım teklif et', 'Offer to help'), hint: T('Bir rica', 'A small favor'),
        locked: lock,
        run: async () => {
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
  }
  return {
    title: npc.name, sub: L(npc.role), status: status(ctx),
    rooms: [{
      id: 'talk', name: npc.name,
      note: npc.kind === 'belletmen' ? T(`Gece öğretmeni · ilişkiniz: ${f}. Geç kalırsan bozulur; düşükse seni daha sıkı izler.`, `Night teacher · your relationship: ${f}. Being late hurts it; if it's low, they watch you more closely.`) : `${L(friendLevel(f))} · ${f}/100${npc.kind === 'classmate' && f < FRIEND_AT ? T(` (arkadaşlık için ${FRIEND_AT})`, ` (${FRIEND_AT} to be friends)`) : ''}`,
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
  } else {
    const visitTime = isSunday(day) && minutes >= VISIT_START && minutes < VISIT_END;
    actions.push({
      id: 'visit', label: T('👪 Ziyaretçini karşıla', '👪 Meet your visitor'), hint: T('Pazar 10:00–16:00 · +15 moral · harçlık', 'Sunday 10:00–16:00 · +15 mood · pocket money'),
      locked: !visitTime ? T('Ziyaret günü Pazar 10:00–16:00.', 'Visiting day is Sunday 10:00–16:00.') : doneToday(ctx, 'visit') ? T('Bugün ziyaretçin geldi.', 'Your visitor already came today.') : undefined,
      run: async () => {
        markToday(ctx, 'visit');
        ctx.advance(60);
        ctx.gain({ mood: 15, money: 15 });
        await ctx.panel.message(T('Ziyaret günü', 'Visiting day'), T(`${guardian} kapıda seni bekliyordu! Bahçede oturup sohbet ettiniz; sana ev yapımı kurabiye ve 15 ₺ harçlık getirdi.`, `${guardian} was waiting at the gate! You sat in the garden and talked; they brought homemade cookies and 15 ₺ pocket money.`));
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
        : T('Hafta sonları okuldasın. Pazar günleri ailen ziyarete gelir.', 'You stay at school at weekends. Your family visits on Sundays.'),
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
  if (!carsiNow(ctx.clock.day, ctx.clock.minutes)) return [];
  const g = guardianName(ctx);
  return [{
    id: 'wedvisit', label: T(`👪 ${g} seni bekliyor!`, `👪 ${g} is waiting for you!`), hint: T('Çarşı izni · 60 dk · +18 moral · harçlık', 'Wednesday visit · 60 min · +18 mood · pocket money'),
    locked: doneToday(ctx, 'wedvisit') ? T('Bugün ailenle zaten görüştün.', 'You already saw your family today.') : undefined,
    run: async () => {
      markToday(ctx, 'wedvisit');
      ctx.advance(60);
      ctx.gain({ mood: 18, money: 20, hunger: 30 });
      await ctx.panel.message(T('Çarşı izni', 'Wednesday visit'), T(
        `${g} kantinde seni bekliyordu. Şakir Abi'den iki sosisli aldınız, haftanı anlattın. Giderken eline 20 ₺ ve ev yapımı kurabiye tutuşturdu.`,
        `${g} was waiting at the canteen. You got two of Şakir's hot dogs and told them all about your week. On the way out they slipped you 20 ₺ and homemade cookies.`,
      ));
    },
  }];
}

/** from the 6th grade: a few hours in town on Wednesday afternoon */
function carsiAction(ctx: GameCtx): ActionView {
  const { day, minutes } = ctx.clock;
  const st = ctx.st;
  return {
    id: 'carsi', label: T('🛍️ Çarşıya çık', '🛍️ Go into town'), hint: T(`Çarşamba ${fmtTime(CARSI_START)}–${fmtTime(CARSI_END)} · 6. sınıftan itibaren`, `Wednesdays ${fmtTime(CARSI_START)}–${fmtTime(CARSI_END)} · from the 6th grade`),
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
      ctx.advance(120);
      await ctx.panel.message(T('Çarşı izni', 'Town leave'), T('İki saat dışarıdaydın. Kapıdaki görevli saatine baktı: "Tam zamanında, aferin."', 'You were out for two hours. The guard at the gate checked his watch: "Right on time, well done."'));
    },
  };
}

// ---------------- the dorm payphone ----------------

export function phonePanel(ctx: GameCtx): PanelView {
  const st = ctx.st;
  const g = guardianName(ctx);
  const night = phaseOf(ctx.clock.minutes) === 'night';
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
        run: async () => {
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
  if (!m.mandolinDone) {
    actions.push({
      id: 'mandolin', label: T(`🪕 Mandolin dersi (${m.mandolin}/${MANDOLIN_LESSONS})`, `🪕 Mandolin lesson (${m.mandolin}/${MANDOLIN_LESSONS})`),
      hint: T('4. sınıfta zorunlu · 45 dk · ritim oyunu', 'Compulsory in the 4th grade · 45 min · rhythm game'),
      locked: st.year > 1 ? T('Mandolin kursu sadece 4. sınıfta açılıyor; kaçırdın.', 'The mandolin course only runs in the 4th grade; you missed it.')
        : needRegistration(ctx) ?? (lessonNow ? T('Ders saatinde müzik odası boş değil.', 'The music room is busy during lessons.')
          : doneToday(ctx, 'mandolin') ? T('Bugünkü dersini aldın.', 'You had your lesson today.') : undefined),
      run: async () => {
        markToday(ctx, 'mandolin');
        const hits = await ctx.panel.rhythm(T('Mandolin', 'Mandolin'), T('Notalar çizgiye gelince BOŞLUK\'a bas.', 'Press SPACE as each note crosses the line.'), 8, 0.4);
        ctx.advance(45);
        m.mandolin++;
        ctx.gain({ xp: 15 + hits * 2, attrs: { creativity: hits >= 6 ? 2 : 1 } });
        if (m.mandolin >= MANDOLIN_LESSONS) {
          m.mandolinDone = true;
          await ctx.panel.message(T('Mandolin kursu bitti! 🎶', 'Mandolin course complete! 🎶'), T('Müzik öğretmeni Leyla Hanım sertifikanı verdi: "5. sınıftan itibaren istediğin enstrümanı seçebilirsin."', 'Your music teacher, Ms. Leyla, handed you the certificate: "From the 5th grade you can pick any instrument you like."'));
        } else ctx.toast(T(`Mandolin ${m.mandolin}/${MANDOLIN_LESSONS} · ${hits}/8 nota`, `Mandolin ${m.mandolin}/${MANDOLIN_LESSONS} · ${hits}/8 notes`), 'good');
      },
    });
  }
  if (!m.instrument) {
    actions.push({
      id: 'pick', label: T('🎸 Bir enstrüman seç', '🎸 Pick an instrument'), hint: T('5. sınıftan itibaren · mandolin sertifikası gerekir', 'From the 5th grade · needs the mandolin certificate'),
      locked: !m.mandolinDone ? T('Önce 4. sınıftaki mandolin kursunu bitirmelisin.', 'You need to finish the 4th-grade mandolin course first.')
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
      run: async () => {
        markToday(ctx, 'practice');
        const hits = await ctx.panel.rhythm(L(inst!.name), T('Ritmi yakala!', 'Catch the beat!'), 10, 0.42 + m.skill / 300);
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
          if (p) { m.path = p as 'band' | 'solo'; ctx.toast(p === 'band' ? T('Gruba katıldın! Provalar perşembe akşamüstü.', 'You joined the band! Rehearsals on Thursday afternoons.') : T('Solo yolunu seçtin.', 'You chose the solo path.'), 'good'); }
        },
      });
    } else {
      const band = m.path === 'band';
      actions.push({
        id: 'show', label: band ? T('🏆 Rock müzik yarışmasına katıl', '🏆 Enter the rock music competition') : T('🎤 Solo resital ver', '🎤 Give a solo recital'),
        hint: T(`Yılda bir · seviye ${SHOW_SKILL}+ · ilkbaharda`, `Once a year · level ${SHOW_SKILL}+ · in spring`),
        locked: m.shows.includes(st.year) ? T('Bu yılki sahneni yaptın.', "You've had your stage moment this year.")
          : m.skill < SHOW_SKILL ? T(`Önce seviye ${SHOW_SKILL}\'a ulaş (${m.skill}).`, `Reach level ${SHOW_SKILL} first (${m.skill}).`) : undefined,
        run: async () => {
          const hits = await ctx.panel.rhythm(band ? T('Final şarkısı', 'Final song') : T('Resital', 'Recital'), T('Sahnedesin, herkes seni izliyor!', "You're on stage, everyone is watching!"), 14, 0.5 + m.skill / 250);
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
    note: T('Duvarda mandolinler, köşede bir davul seti. Leyla Hanım: "4. sınıfta herkes mandolinle başlar."', 'Mandolins on the wall, a drum kit in the corner. Ms. Leyla: "In the 4th grade everyone starts with the mandolin."'),
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
  const hits = await ctx.panel.rhythm(T('Seçim konuşması', 'Election speech'), T('Kalabalığın alkış ritmini yakala!', "Catch the crowd's clapping rhythm!"), 8, 0.42);
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
    run: async () => {
      const how = await ctx.panel.choose(T('Nasıl kampanya yapacaksın?', 'How will you campaign?'), [
        { id: 'poster', label: T('🖍️ Afiş çiz ve koridora as', '🖍️ Draw posters for the corridor'), hint: T('Yaratıcılık', 'Creativity') },
        { id: 'talk', label: T('🗣️ Kantinde herkesle sohbet et', '🗣️ Chat with everyone at the canteen'), hint: T('Sosyallik', 'Social') },
        { id: 'help', label: T('📚 Arkadaşlarına ödevde yardım et', '📚 Help friends with homework'), hint: T('Bilgi', 'Knowledge') },
      ]);
      if (!how) return;
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
      locked: !st.once.classDrawn ? T('Önce sınıf kurasını çek.', 'Draw your class first.') : undefined,
      run: () => {
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
      run: async () => {
        const won = await runElection(ctx, 'class');
        if (won) {
          Object.assign(c, { stage: 'rep', day: schoolDayAfter(ctx.clock.day, 5), support: 0 });
          c.titles.push(`${st.school.classLabel} ${T('sınıf temsilcisi', 'class rep')}`);
          ctx.ch.respect += 15; ctx.gain({ xp: 60, mood: 12, attrs: { social: 2 } });
          ctx.toast(T(`Artık ${st.school.classLabel} sınıf temsilcisisin! Sınıf başkanlığı seçimi ${whenText(ctx, c.day)}, Konferans salonunda.`, `You're now class rep of ${st.school.classLabel}! The grade president vote is ${whenText(ctx, c.day)}, in the auditorium.`), 'good');
        } else { c.stage = 'lost'; ctx.gain({ xp: 15, mood: -5 }); }
      },
    });
  } else if (c.stage === 'rep') {
    note = T(`Sınıf temsilcisisin. ${g}. sınıfların başkanlık seçimi ${whenText(ctx, c.day)}, Konferans salonunda (Yemekhane).`, `You're class rep. The grade ${g} president vote is ${whenText(ctx, c.day)}, in the auditorium (dining hall).`);
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
          ctx.ch.respect += 30; ctx.gain({ xp: 120, mood: 15, attrs: { social: 3 } });
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
          ctx.ch.respect += 60; ctx.gain({ xp: 250, mood: 20, attrs: { social: 4 } });
        } else { c.stage = 'schoolLost'; ctx.gain({ xp: 30, mood: -5 }); }
      },
    });
  }
  return out;
}

// ---------------- Cemil Emmi (boys' dorm caretaker) ----------------

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
        await ctx.panel.message('Cemil Emmi', T('"Aferin aslanım! Al bakalım, bu şekerler senin. Dedikodular da yakında unutulur. Yakında sana yeni bir görevim olacak."', '"Well done, champ! Here, these sweets are yours. The gossip will die down soon. I\'ll have a new task for you before long."'));
      },
    });
  }
  const notes: Record<string, string> = {
    none: tooOld ? T('"Sen artık büyüdün evlat. Yeni görevler yakında."', '"You\'re a big kid now. New tasks soon."') : T('Yaşlı hademe Cemil Emmi, elinde süpürgesiyle seni süzüyor. "Gel bakalım, sana bir görevim var."', 'Old caretaker Cemil Emmi eyes you, broom in hand. "Come here, I have a task for you."'),
    assigned: c.peeFails > 0
      ? T(`"Olmadı ha? (${c.peeFails} gece) Üzülme evlat, bu gece yine dene. Ama çabuk ol, koğuşta laf yayılıyor…"`, `"Didn't make it, eh? (${c.peeFails} nights) Chin up, try again tonight. But hurry, the dorm is starting to talk…"`)
      : T('"Bu gece çişini tutacaksın, unutma! Yatağa erken gir."', '"Tonight you hold your pee, remember! Get to bed early."'),
    held: T('"Ooo, yüzünden belli, başardın galiba!"', '"Oho, I can see it on your face, you did it!"'),
    rewarded: T('"Yeni görevler yolda. Şimdilik dersine çalış."', '"New tasks are on the way. Study for now."'),
  };
  return {
    title: 'Cemil Emmi', sub: T('Erkek Yurdu · hademe', "Boys' dorm · caretaker"), status: status(ctx),
    rooms: [{ id: 'cemil', name: 'Cemil Emmi', note: notes[c.pee], actions }],
  };
}

// ---------------- pick-up games on the outdoor courts ----------------

const COURT_NAME: Record<CourtSport, Text> = { basketball: { tr: 'Basketbol sahası', en: 'Basketball court' }, football: { tr: 'Futbol sahası', en: 'Football pitch' } };

export function courtPanel(ctx: GameCtx, sport: CourtSport): PanelView {
  const st = ctx.st;
  const phase = phaseOf(ctx.clock.minutes);
  const need = COURT_PLAYERS[sport];
  return {
    title: L(COURT_NAME[sport]), sub: T(`Becerin: ${st.skills[sport]}/100`, `Your skill: ${st.skills[sport]}/100`), status: status(ctx),
    rooms: [{
      id: 'court', name: L(COURT_NAME[sport]),
      note: sport === 'basketball' ? T(`2'ye 2 maç için senin dışında ${need} kişi lazım.`, `For a 2-on-2 game you need ${need} more players.`) : T(`3'e 3 maç için senin dışında ${need} kişi lazım.`, `For a 3-on-3 game you need ${need} more players.`),
      actions: [{
        id: 'call', label: T('📣 Arkadaşlarını çağır', '📣 Call your friends over'), hint: T('Yakındaki arkadaşların gelir, sen bekle', 'Friends who are around will come; wait for them here'),
        locked: phase !== 'day' ? T('Akşam sahalar kapalı.', 'The courts are closed in the evening.')
          : currentPeriod(ctx.clock.day, ctx.clock.minutes)?.kind === 'lesson' && reached('derse_gir', ctx.mc()) ? T('Ders saatinde maç olmaz!', 'No games during lessons!')
            : st.energy < 25 ? T('Çok yorgunsun.', "You're too tired.") : undefined,
        run: () => {
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
  const skill = st.skills[sport];
  const zone = 0.16 + skill / 600 + ctx.ch.attributes.fitness / 800;
  const rounds = 5;
  const hits = await ctx.panel.timing(sport === 'basketball' ? T('Şut at!', 'Shoot!') : T('Gole vur!', 'Shoot at goal!'), rounds, zone, 1.3);
  const theirs = Math.floor(Math.random() * 4) + 1;
  const ours = hits + (Math.random() < 0.5 ? 1 : 0);
  const won = ours > theirs;
  ctx.advance(45);
  st.skills[sport] = Math.min(100, skill + 2 + hits);
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
  const weekendClosed = isWeekend(ctx.clock.day);
  switch (locId) {
    case 'cemiyet': return weekendClosed ? null : cemiyet(ctx);
    case 'muze': return weekendClosed ? null : muze(ctx);
    case 'egitim': return egitim(ctx);
    case 'kutuphane': return kutuphane(ctx);
    case 'yemekhane': return yemekhane(ctx);
    case 'revir': return revir(ctx);
    case 'spor': return spor(ctx);
    case 'teknik': return ctx.ch.cause === 'work' ? teknik(ctx) : null;
    default: return null;
  }
}


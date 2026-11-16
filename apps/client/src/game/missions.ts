// Year 1 missions (GDD §9). Main missions form a chain: each one is locked until its requirements are done,
// and finishing it unlocks the next part of school life.
import type { Text } from '../i18n';
import { NPCS } from '../content/npcs';
import type { CharacterData } from '../content/character';
import { FRIEND_AT, LESSONS_PER_SUBJECT, SUBJECTS, YEAR1_XP, lessonsLeft, type PlayerState } from './state';

export interface MissionCtx {
  st: PlayerState;
  ch: CharacterData;
  discovered: Set<string>;
}

export interface Objective {
  id: string;
  text: Text;
  done: (c: MissionCtx) => boolean;
  /** e.g. "3/5" */
  progress?: (c: MissionCtx) => string;
  /** where to go: location ids (the tracker points at the nearest one) */
  targets?: (c: MissionCtx) => string[];
}

export interface Mission {
  id: string;
  /** side = a side quest you take from the dorm's abi or abla; they change every school year */
  kind: 'main' | 'challenge' | 'side';
  title: Text;
  desc: Text;
  requires: string[];
  /** what finishing it opens up */
  unlocks?: Text;
  objectives: Objective[];
  reward: { xp: number; text?: Text };
  /** challenges can fail */
  failed?: (c: MissionCtx) => boolean;
  /** side quests: who hands it out (an npc id) and in which school year */
  giver?: string;
  /** where to find the giver */
  giverAt?: Text;
  year?: number;
}

const classmates = NPCS.filter((n) => n.kind === 'classmate');
const friendCount = (c: MissionCtx) => classmates.filter((n) => (c.st.friends[n.id] ?? 0) >= FRIEND_AT).length;
const LESSONS_TOTAL = SUBJECTS.length * LESSONS_PER_SUBJECT;
const at = (...ids: string[]) => () => ids;
const ownDorm = (c: MissionCtx) => [c.ch.gender === 'girl' ? 'kiz_yurdu' : 'erkek_yurdu'];
const mealDone = (c: MissionCtx, m: string) => c.st.meals.includes(m as never);

/** the side-quest givers: an abi at the boys' dorm door, an abla at the girls' */
export const QUEST_GIVERS = { abi: 'kerem', abla: 'selin' } as const;
export const GIVER_IDS: string[] = Object.values(QUEST_GIVERS);
/** the older boys (girl = false) or girls you could get to know, not counting the one who sent you */
export const oldersToMeet = (girl: boolean) => NPCS.filter((n) => n.kind === 'abi' && (n.gender === 'girl') === girl && !GIVER_IDS.includes(n.id));
const metCount = (c: MissionCtx, girl: boolean) => oldersToMeet(girl).filter((n) => c.st.once[`met-${n.id}`]).length;
export const handedIn = (c: MissionCtx, id: string) => c.st.side.handed.includes(id);

export const MISSIONS: Mission[] = [
  {
    id: 'bavul', kind: 'main',
    title: { tr: 'Bavulunu Yerleştir', en: 'Unpack Your Suitcase' },
    desc: { tr: 'Bavulunu yurduna götür ve yatakhanedeki dolabına yerleştir. Belletmen sana yatağını ve dolabını gösterecek.', en: 'Carry your suitcase to your dorm and unpack it into your locker in the sleeping room. The duty teacher will show you your bed and your locker.' },
    requires: [],
    unlocks: { tr: 'Yatağın ve dolabın (uyumak, kıyafetlerin, atıştırmalıkların)', en: 'Your bed and locker (sleep, your clothes, your snacks)' },
    objectives: [{ id: 'drop', text: { tr: 'Bavulunu dolabına yerleştir', en: 'Unpack your suitcase into your locker' }, done: (c) => c.st.once.luggage === true, targets: ownDorm }],
    reward: { xp: 30 },
  },
  {
    id: 'kayit', kind: 'main',
    title: { tr: 'Kayıt Dönemi', en: 'Registration Weekend' },
    desc: { tr: 'Cumartesi ve Pazar, bütün okul için kayıt dönemi. Pazar akşamına kadar okula kaydol, Revir\'de sağlık kontrolünden geç, Spor Salonu\'ndaki depodan kıyafetlerini ve Kütüphane\'den kitaplarını al. Süre dolunca kalan işlerini görevliler tamamlar; Pazartesi dersler başlar.', en: "Saturday and Sunday are registration weekend for the whole school. By Sunday evening, enrol, pass the health check at the infirmary, and collect your clothes from the stores in the Spor Salonu and your books at the library. When time runs out the staff finish whatever is left; lessons start on Monday." },
    requires: [],
    unlocks: { tr: 'Sınıf kurası ve Pazartesi günü dersler', en: 'The class draw, and lessons on Monday' },
    objectives: [
      { id: 'register', text: { tr: 'Cemiyet Binası danışmasında kayıt ol', en: 'Register at the Cemiyet building reception' }, done: (c) => c.st.school.registered, targets: at('cemiyet') },
      { id: 'health', text: { tr: 'Revir\'de sağlık kontrolünden geç (Kız Yurdu, −1. kat)', en: "Pass the health check at the infirmary (girls' dorm, floor −1)" }, done: (c) => c.st.once.healthCheck === true, targets: at('revir') },
      { id: 'kit', text: { tr: 'Spor Salonu\'ndaki depodan kıyafet ve ayakkabılarını al', en: 'Collect your clothes and shoes from the stores in the Spor Salonu' }, done: (c) => c.st.school.kit, targets: at('spor') },
      { id: 'books', text: { tr: 'Kütüphane\'den ders kitaplarını al', en: 'Collect your textbooks at the library' }, done: (c) => c.st.school.books, targets: at('kutuphane') },
    ],
    reward: { xp: 100 },
  },
  {
    id: 'derse_gir', kind: 'main',
    title: { tr: 'İlk Ders', en: 'First Lesson' },
    desc: { tr: 'Ders saatinde Eğitim Binası\'ndaki sınıfına git ve derse katıl. Zil çaldıktan sonra beş dakikadan fazla gecikirsen müdür yardımcısından geç kâğıdı alman gerekir; derse hiç girmezsen seni bulup sınıfa götürür.', en: "Go to your classroom in the Eğitim building during a lesson and take part. More than five minutes after the bell you need a late slip from the deputy head; skip the lesson altogether and she comes to find you and takes you to class." },
    requires: ['kayit'],
    unlocks: { tr: 'Ödevler ve etüt', en: 'Homework and study hall' },
    objectives: [{ id: 'attend', text: { tr: 'Bir derse gir (hafta içi 08:30–15:20)', en: 'Attend a lesson (weekdays 08:30–15:20)' }, done: (c) => c.st.school.attended.length >= 1, targets: at('egitim') }],
    reward: { xp: 60 },
  },
  {
    id: 'ilk_arkadas', kind: 'main',
    title: { tr: 'İlk Arkadaş', en: 'First Friend' },
    desc: { tr: 'Sınıf arkadaşlarından biriyle arkadaş ol: önce tanış, sonra sohbet et. Onları sınıfta, yemekhanede ve meydanlarda bulabilirsin (isimlerinin başında ★ var).', en: 'Make friends with one classmate: get to know them first, then chat. You\'ll find them in class, in the dining hall and on the plazas (a ★ by their name).' },
    requires: ['kayit'],
    unlocks: { tr: 'Arkadaşların yanına gelir ve haritada görünür', en: 'Your friends come to find you and show on the map' },
    objectives: [{
      id: 'one', text: { tr: 'Bir sınıf arkadaşınla "Arkadaş" ol', en: 'Become "Friends" with one classmate' },
      done: (c) => friendCount(c) >= 1, progress: (c) => `${Math.min(1, friendCount(c))}/1`, targets: at('merkez_meydan', 'yurt_meydani'),
    }],
    reward: { xp: 60 },
  },
  {
    id: 'uc_ogun', kind: 'main',
    title: { tr: 'Üç Öğün', en: 'Three Meals' },
    desc: { tr: 'Yemekhanede bir kahvaltı, bir öğle ve bir akşam yemeği ye.', en: 'Eat a breakfast, a lunch and a dinner in the dining hall.' },
    requires: ['derse_gir'],
    unlocks: { tr: 'Kütüphane, spor, abiler ve yıl sonu görevleri', en: 'The library, sports, the older students and the year-end missions' },
    objectives: [
      { id: 'breakfast', text: { tr: 'Kahvaltı (07:00–08:30)', en: 'Breakfast (07:00–08:30)' }, done: (c) => mealDone(c, 'breakfast'), targets: at('yemekhane') },
      { id: 'lunch', text: { tr: 'Öğle yemeği (12:20–13:30)', en: 'Lunch (12:20–13:30)' }, done: (c) => mealDone(c, 'lunch'), targets: at('yemekhane') },
      { id: 'dinner', text: { tr: 'Akşam yemeği (17:00–18:00)', en: 'Dinner (17:00–18:00)' }, done: (c) => mealDone(c, 'dinner'), targets: at('yemekhane') },
    ],
    reward: { xp: 60 },
  },
  {
    id: 'bes_arkadas', kind: 'main',
    title: { tr: 'Beş Arkadaş', en: 'Five Friends' },
    desc: { tr: 'Sohbet et, yemekte yanlarına otur, ikramda bulun. 5 sınıf arkadaşınla arkadaş ol.', en: 'Chat, sit together at meals, share a treat. Become friends with 5 classmates.' },
    requires: ['uc_ogun'],
    objectives: [{
      id: 'friends', text: { tr: '5 sınıf arkadaşınla arkadaş ol', en: 'Become friends with 5 classmates' },
      done: (c) => friendCount(c) >= 5, progress: (c) => `${friendCount(c)}/5`, targets: at('merkez_meydan', 'yurt_meydani'),
    }],
    reward: { xp: 120 },
  },
  {
    id: 'ilk_kitap', kind: 'main',
    title: { tr: 'İlk Kitabım', en: 'My First Book' },
    desc: { tr: 'Kütüphaneden bir kitap ödünç al, bitir ve kütüphaneciyle konuş.', en: 'Borrow a book from the library, finish it, and discuss it with the librarian.' },
    requires: ['uc_ogun'],
    objectives: [
      { id: 'borrow', text: { tr: 'Bir kitap ödünç al', en: 'Borrow a book' }, done: (c) => !!c.st.reading.book || c.st.reading.finished.length > 0, targets: at('kutuphane') },
      { id: 'read', text: { tr: 'Kitabı oku (3 oturum)', en: 'Read the book (3 sessions)' }, done: (c) => c.st.reading.finished.length > 0 || c.st.reading.sessions >= 3, progress: (c) => (c.st.reading.finished.length ? '3/3' : `${c.st.reading.sessions}/3`), targets: at('kutuphane') },
      { id: 'chat', text: { tr: 'Kütüphaneciyle kitap sohbeti', en: 'Book chat with the librarian' }, done: (c) => c.st.reading.finished.length > 0, targets: at('kutuphane') },
    ],
    reward: { xp: 80 },
  },
  {
    id: 'istiklal', kind: 'main',
    title: { tr: 'İstiklal Marşı', en: 'The National Anthem' },
    desc: { tr: 'Etüt saatlerinde İstiklal Marşı\'nın on kıtasını deftere yaz ve ezberle, sonra belletmenine ezberden oku.', en: 'During evening study, write out all ten stanzas of the İstiklal Marşı and learn them by heart, then recite it to your belletmen.' },
    requires: ['uc_ogun'],
    objectives: [
      { id: 'write', text: { tr: 'On kıtayı yaz ve ezberle (etütte, masanda)', en: 'Write out and memorise the ten stanzas (at study, at your desk)' }, done: (c) => c.st.anthem.stanzas >= 10, progress: (c) => `${c.st.anthem.stanzas}/10`, targets: ownDorm },
      { id: 'recite', text: { tr: 'Belletmenine ezberden oku', en: 'Recite it to your belletmen' }, done: (c) => c.st.anthem.recited, targets: ownDorm },
    ],
    reward: { xp: 60, text: { tr: 'Bayrak töreninde marşı sen başlatırsın (Pazartesi sabahı, Cuma öğleden sonra) · +10 saygınlık', en: 'You lead the anthem at the flag ceremony (Monday morning, Friday afternoon) · +10 respect' } },
  },
  {
    id: 'spora_basla', kind: 'main',
    title: { tr: 'Spora Başla', en: 'Join a Sport' },
    desc: { tr: 'Spor Salonu\'ndaki antrenörle konuş, seçmelere gir ve bir takıma katıl.', en: 'Talk to the coach at the sports hall, try out and join a team.' },
    requires: ['uc_ogun'],
    objectives: [{ id: 'enroll', text: { tr: 'Seçmeleri geç ve bir spora yazıl', en: 'Pass a try-out and join a sport' }, done: (c) => !!c.st.sport, targets: at('spor') }],
    reward: { xp: 60 },
  },
  {
    id: 'abi_sandvic', kind: 'main',
    title: { tr: 'Abi\'den Sandviç', en: 'A Sandwich from an Abi' },
    desc: { tr: 'Yurt Meydanı\'ndaki abilerden ya da ablalardan birine yardım et; teşekkür olarak bir sandviç kazan.', en: 'Help one of the older students on the dorm plaza and earn a sandwich as thanks.' },
    requires: ['uc_ogun'],
    objectives: [
      { id: 'meet', text: { tr: 'Yurt Meydanı\'nda bir abi ya da ablayla konuş (ders dışında)', en: 'Talk to an older student on the dorm plaza (outside lessons)' }, done: (c) => c.st.favor.stage !== 'none', targets: at('yurt_meydani') },
      { id: 'favor', text: { tr: 'Ricasını yerine getir: kitabı Kütüphane\'ye iade et', en: 'Do the favor: return the book to the library' }, done: (c) => c.st.favor.stage === 'done' || c.st.favor.stage === 'rewarded', targets: at('kutuphane') },
      { id: 'sandwich', text: { tr: 'Geri dön ve sandviçini al', en: 'Go back and get your sandwich' }, done: (c) => c.st.favor.stage === 'rewarded', targets: at('yurt_meydani') },
    ],
    reward: { xp: 80 },
  },
  {
    id: 'sinavlar', kind: 'main',
    title: { tr: 'Sınavları Geç', en: 'Pass the Exams' },
    desc: { tr: `Dokuz dersin her birine en az ${LESSONS_PER_SUBJECT} kere gir (Müzik, Beden Eğitimi, Din Kültürü ve Teknoloji ve Tasarım dahil), ödevlerini yap ve yıl sonu sınavını geç (en az %50).`, en: `Sit in on each of the nine subjects at least ${LESSONS_PER_SUBJECT} times (Music, PE, Religious Culture and Technology and Design included), do your homework and pass the year-end exam (at least 50%).` },
    requires: ['uc_ogun'],
    objectives: [
      { id: 'lessons', text: { tr: `Her dersten en az ${LESSONS_PER_SUBJECT} derse gir`, en: `Attend at least ${LESSONS_PER_SUBJECT} lessons of every subject` }, done: (c) => lessonsLeft(c.st) === 0, progress: (c) => `${LESSONS_TOTAL - lessonsLeft(c.st)}/${LESSONS_TOTAL}`, targets: at('egitim') },
      { id: 'exam', text: { tr: 'Yıl sonu sınavını geç (sınıfında)', en: 'Pass the year-end exam (in your classroom)' }, done: (c) => c.st.examPassed, targets: at('egitim') },
    ],
    reward: { xp: 200 },
  },
  {
    id: 'karne', kind: 'main',
    title: { tr: 'Karne Günü', en: 'Report Card Day' },
    desc: { tr: 'Yılı tamamla: yeterli deneyimi topla ve konferans salonundaki karne törenine katıl.', en: 'Finish the year: gather enough experience and attend the report card ceremony in the auditorium.' },
    requires: ['bes_arkadas', 'ilk_kitap', 'spora_basla', 'abi_sandvic', 'sinavlar', 'istiklal'],
    unlocks: { tr: '2. yıl (5. sınıf)', en: 'Year 2 (Grade 5)' },
    objectives: [
      { id: 'xp', text: { tr: `${YEAR1_XP} XP topla`, en: `Earn ${YEAR1_XP} XP` }, done: (c) => c.st.xp >= YEAR1_XP, progress: (c) => `${Math.min(c.st.xp, YEAR1_XP)}/${YEAR1_XP}` },
      { id: 'ceremony', text: { tr: 'Karne törenine katıl (TIM Gösteri Merkezi · konferans salonu)', en: 'Attend the ceremony (TIM hall · auditorium)' }, done: (c) => c.st.yearDone, targets: at('tim') },
    ],
    reward: { xp: 0 },
  },
  {
    id: 'cemil_cis', kind: 'challenge',
    title: { tr: 'Cemil Emmi\'nin Görevi: Çişini Tut', en: "Cemil Emmi's Task: Hold Your Pee" },
    desc: { tr: 'Erkek Yurdu\'nun hademesi Cemil Emmi\'nin ilk görevi. Bir gece yataktan kalkmadan sabaha kadar dayan. Başaramazsan her gece yeniden denersin; ne kadar çok başarısız olursan o kadar çok dalga geçilir ve saygınlığın düşer.', en: "The first task from Cemil Emmi, the boys' dorm caretaker. Last one night until morning without getting out of bed. Fail and you try again every night; the more you fail, the more you get teased and the more respect you lose." },
    requires: ['kayit'],
    objectives: [
      { id: 'meet', text: { tr: 'Erkek Yurdu önünde Cemil Emmi ile konuş (08:00–18:00)', en: "Talk to Cemil Emmi outside the boys' dorm (08:00–18:00)" }, done: (c) => c.st.cemil.pee !== 'none', targets: at('erkek_yurdu') },
      { id: 'hold', text: { tr: 'Yurdunda uyu ve gece sabaha kadar tut', en: 'Sleep in your dorm and hold it until morning' }, done: (c) => c.st.cemil.pee === 'held' || c.st.cemil.pee === 'rewarded', targets: ownDorm },
      { id: 'report', text: { tr: 'Cemil Emmi\'ye anlat', en: 'Tell Cemil Emmi' }, done: (c) => c.st.cemil.pee === 'rewarded', targets: at('erkek_yurdu') },
    ],
    reward: { xp: 50, text: { tr: 'Cemil Emmi\'nin şekerleri · yeni görevler yolda', en: "Cemil Emmi's sweets · more tasks to come" } },
  },
  {
    id: 'basket_maci', kind: 'challenge',
    title: { tr: 'Darüşşafaka – Banvit', en: 'Darüşşafaka v Banvit' },
    desc: { tr: 'İkinci Pazar akşamı saat 19:00\'da Spor Salonu\'nda Darüşşafaka\'nın basketbol maçı var: rakip Banvit. O akşam etüt yok, bütün okul tribünde olacak. Saat 7 civarı Spor Salonu\'na git ve maçı izle.', en: "On the second Sunday at 19:00 Darüşşafaka play a basketball match in the Spor Salonu, against Banvit. There's no evening study that night and the whole school will be in the stand. Get to the Spor Salonu around 7 and watch." },
    requires: ['kayit'],
    objectives: [{ id: 'watch', text: { tr: 'Pazar 19:00 · Spor Salonu\'nda maçı izle', en: 'Sunday 19:00 · watch the match in the Spor Salonu' }, done: (c) => c.st.once.matchWatched === true, targets: at('spor') }],
    failed: (c) => c.st.once.matchMissed === true && !c.st.once.matchWatched,
    reward: { xp: 60, text: { tr: 'Maç gecesinin anısı · +moral', en: 'A match night to remember · +mood' } },
  },
  {
    id: 'saglikli_yil', kind: 'challenge',
    title: { tr: 'Sağlıklı Bir Yıl', en: 'A Healthy Year' },
    desc: { tr: 'Yılı hiç hastalanmadan bitir. Öğünlerini atlama, uyu, yağmurda montsuz dolaşma, geceleri dışarıda kalma.', en: "Finish the year without getting sick. Don't skip meals, get your sleep, keep your coat on in the rain and don't stay out at night." },
    requires: [],
    objectives: [{ id: 'healthy', text: { tr: 'Karne gününe kadar hastalanma', en: "Don't get sick before report card day" }, done: (c) => c.st.yearDone && !c.st.everSick }],
    failed: (c) => c.st.everSick,
    reward: { xp: 150, text: { tr: '"Demir Gibi" madalyası · +10 Kondisyon · +50 Saygınlık', en: '"Iron Kid" medal · +10 Fitness · +50 Respect' } },
  },
  // ---- side quests: taken from Kerem Abi (boys' dorm door) and Selin Abla (girls' dorm door), new ones every year ----
  {
    id: 'abilerle_tanis', kind: 'side', giver: QUEST_GIVERS.abi, giverAt: { tr: 'Erkek Yurdu önü', en: "boys' dorm door" }, year: 1,
    title: { tr: 'Abilerini Tanı', en: 'Meet the Abis' },
    desc: { tr: 'Kerem Abi\'nin görevi: okulun abilerinden üçüyle tanış, seni bilsinler. Sonra Erkek Yurdu\'nun önüne dön ve Kerem Abi\'ye anlat.', en: "Kerem Abi's task: get to know three of the school's older boys, so they know who you are. Then go back to the boys' dorm door and tell Kerem Abi." },
    requires: [],
    objectives: [
      { id: 'meet', text: { tr: '3 abiyle tanış', en: 'Meet 3 abis' }, done: (c) => metCount(c, false) >= 3, progress: (c) => `${Math.min(3, metCount(c, false))}/3`, targets: at('yurt_meydani', 'merkez_meydan') },
      { id: 'report', text: { tr: 'Kerem Abi\'ye anlat (Erkek Yurdu önü)', en: "Tell Kerem Abi (boys' dorm door)" }, done: (c) => handedIn(c, 'abilerle_tanis'), targets: at('erkek_yurdu') },
    ],
    reward: { xp: 60 },
  },
  {
    id: 'ablalarla_tanis', kind: 'side', giver: QUEST_GIVERS.abla, giverAt: { tr: 'Kız Yurdu önü', en: "girls' dorm door" }, year: 1,
    title: { tr: 'Ablalarını Tanı', en: 'Meet the Ablas' },
    desc: { tr: 'Selin Abla\'nın görevi: okulun ablalarından üçüyle tanış, seni bilsinler. Sonra Kız Yurdu\'nun önüne dön ve Selin Abla\'ya anlat.', en: "Selin Abla's task: get to know three of the school's older girls, so they know who you are. Then go back to the girls' dorm door and tell Selin Abla." },
    requires: [],
    objectives: [
      { id: 'meet', text: { tr: '3 ablayla tanış', en: 'Meet 3 ablas' }, done: (c) => metCount(c, true) >= 3, progress: (c) => `${Math.min(3, metCount(c, true))}/3`, targets: at('yurt_meydani', 'merkez_meydan') },
      { id: 'report', text: { tr: 'Selin Abla\'ya anlat (Kız Yurdu önü)', en: "Tell Selin Abla (girls' dorm door)" }, done: (c) => handedIn(c, 'ablalarla_tanis'), targets: at('kiz_yurdu') },
    ],
    reward: { xp: 60 },
  },
];

export type MissionStatus = 'locked' | 'active' | 'done' | 'failed';

export function missionDone(st: PlayerState, id: string) { return st.missionsDone.includes(id); }

export function statusOf(m: Mission, c: MissionCtx): MissionStatus {
  if (missionDone(c.st, m.id)) return 'done';
  if (m.failed?.(c)) return 'failed';
  // a side quest is open once you've taken it from its giver, in its own school year
  if (m.kind === 'side') return m.year === c.st.year && c.st.side.taken.includes(m.id) ? 'active' : 'locked';
  if (!m.requires.every((r) => missionDone(c.st, r))) return 'locked';
  return 'active';
}

export function isActive(id: string, c: MissionCtx) {
  const m = MISSIONS.find((x) => x.id === id);
  return !!m && statusOf(m, c) === 'active';
}

/** reached = active or already done (i.e. the feature it gates is open) */
export function reached(id: string, c: MissionCtx) {
  const m = MISSIONS.find((x) => x.id === id);
  if (!m) return true; // a mission from an older version: whatever it gated is open
  const s = statusOf(m, c);
  return s === 'active' || s === 'done';
}

/** the mission the tracker follows: first active main mission, in list order */
export function trackedMission(c: MissionCtx): Mission | null {
  return MISSIONS.find((m) => m.kind === 'main' && statusOf(m, c) === 'active') ?? null;
}

export function nextObjective(m: Mission, c: MissionCtx): Objective | null {
  return m.objectives.find((o) => !o.done(c)) ?? null;
}

/** the side quests someone hands out this school year */
export function questsFrom(npcId: string, c: MissionCtx): Mission[] {
  return MISSIONS.filter((m) => m.kind === 'side' && m.giver === npcId && m.year === c.st.year);
}

/** what the marker over a giver's head says: a quest to take, or one ready to hand in */
export function questMark(npcId: string, c: MissionCtx): 'offer' | 'ready' | null {
  const qs = questsFrom(npcId, c);
  if (qs.some((m) => statusOf(m, c) === 'active' && m.objectives.every((o) => o.id === 'report' || o.done(c)))) return 'ready';
  if (qs.some((m) => !c.st.side.taken.includes(m.id) && !missionDone(c.st, m.id))) return 'offer';
  return null;
}

export function missionById(id: string): Mission {
  return MISSIONS.find((m) => m.id === id)!;
}

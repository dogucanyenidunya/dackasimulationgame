// Year 1 missions (GDD §9). Main missions form a chain: each one is locked until its requirements are done,
// and finishing it unlocks the next part of school life.
import type { Text } from '../i18n';
import { LOCATIONS } from '../content/campus';
import { NPCS } from '../content/npcs';
import type { CharacterData } from '../content/character';
import { FRIEND_AT, LESSONS_FOR_EXAM, YEAR1_XP, type PlayerState } from './state';

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
  kind: 'main' | 'challenge';
  title: Text;
  desc: Text;
  requires: string[];
  /** what finishing it opens up */
  unlocks?: Text;
  objectives: Objective[];
  reward: { xp: number; text?: Text };
  /** challenges can fail */
  failed?: (c: MissionCtx) => boolean;
}

const classmates = NPCS.filter((n) => n.kind === 'classmate');
const friendCount = (c: MissionCtx) => classmates.filter((n) => (c.st.friends[n.id] ?? 0) >= FRIEND_AT).length;
const exploreIds = LOCATIONS.map((l) => l.id);
const at = (...ids: string[]) => () => ids;
const ownDorm = (c: MissionCtx) => [c.ch.gender === 'girl' ? 'kiz_yurdu' : 'erkek_yurdu'];
const mealDone = (c: MissionCtx, m: string) => c.st.meals.includes(m as never);

export const MISSIONS: Mission[] = [
  {
    id: 'bavul', kind: 'main',
    title: { tr: 'Bavulunu Yerleştir', en: 'Drop Off Your Bag' },
    desc: { tr: 'Bavulunu yurduna götür. Belletmen sana yatağını gösterecek.', en: 'Carry your suitcase to your dorm. The duty teacher will show you your bed.' },
    requires: [],
    unlocks: { tr: 'Yatağın ve dolabın (uyumak, hatıran)', en: 'Your bed and locker (sleep, your keepsake)' },
    objectives: [{ id: 'drop', text: { tr: 'Bavulunu yurduna bırak', en: 'Leave your suitcase at your dorm' }, done: (c) => c.st.once.luggage === true, targets: ownDorm }],
    reward: { xp: 30 },
  },
  {
    id: 'kesfet', kind: 'main',
    title: { tr: 'Kampüsü Keşfet', en: 'Explore the Campus' },
    desc: { tr: 'Kampüsteki her binayı ve alanı keşfet: kapılarına git ve E\'ye bas. Kilitli yerleri dışarıdan keşfetmen yeterli. Kütüphane, Eğitim Binası\'nın içinde.', en: 'Discover every building and area: go to each door and press E. Locked places count from outside. The library is inside the academic building.' },
    requires: ['bavul'],
    unlocks: { tr: 'Kayıt', en: 'Registration' },
    objectives: [{
      id: 'all', text: { tr: 'Tüm yerleri keşfet', en: 'Discover every place' },
      done: (c) => exploreIds.every((id) => c.discovered.has(id)),
      progress: (c) => `${exploreIds.filter((id) => c.discovered.has(id)).length}/${exploreIds.length}`,
      targets: (c) => exploreIds.filter((id) => !c.discovered.has(id)),
    }],
    reward: { xp: 150 },
  },
  {
    id: 'kayit', kind: 'main',
    title: { tr: 'Kayıt', en: 'Registration' },
    desc: { tr: 'Okula resmen kaydol, Revir\'de sağlık kontrolünden geç; kıyafetlerini, ayakkabılarını ve kitaplarını al.', en: 'Officially enrol, pass the health check at the infirmary, then collect your clothes, shoes and books.' },
    requires: ['kesfet'],
    unlocks: { tr: 'Yemek kartın (yemekhane) ve sınıf kurası', en: 'Your meal card (dining hall) and the class draw' },
    objectives: [
      { id: 'register', text: { tr: 'Cemiyet Binası danışmasında kayıt ol', en: 'Register at the Cemiyet building reception' }, done: (c) => c.st.school.registered, targets: at('cemiyet') },
      { id: 'health', text: { tr: 'Revir\'de sağlık kontrolünden geç (Kız Yurdu, −1. kat)', en: "Pass the health check at the infirmary (girls' dorm, floor −1)" }, done: (c) => c.st.once.healthCheck === true, targets: at('revir') },
      { id: 'kit', text: { tr: 'Ambar\'dan kıyafet ve ayakkabılarını al', en: 'Collect your clothes and shoes from the Ambar' }, done: (c) => c.st.school.kit, targets: at('cemiyet') },
      { id: 'books', text: { tr: 'Kütüphane\'den ders kitaplarını al', en: 'Collect your textbooks at the library' }, done: (c) => c.st.school.books, targets: at('kutuphane') },
    ],
    reward: { xp: 100 },
  },
  {
    id: 'sinif', kind: 'main',
    title: { tr: 'Sınıf Kurası', en: 'The Class Draw' },
    desc: { tr: 'Cemiyet Binası\'nda kura çek ve hangi sınıfta okuyacağını öğren.', en: 'Draw lots at the Cemiyet building to find out which class you\'re in.' },
    requires: ['kayit'],
    unlocks: { tr: 'Sınıf arkadaşlarınla tanışmak', en: 'Meeting your classmates' },
    objectives: [{ id: 'draw', text: { tr: 'Danışmada sınıf kurası çek', en: 'Draw your class at the reception' }, done: (c) => c.st.once.classDrawn === true, targets: at('cemiyet') }],
    reward: { xp: 40 },
  },
  {
    id: 'ilk_arkadas', kind: 'main',
    title: { tr: 'İlk Arkadaş', en: 'First Friend' },
    desc: { tr: 'Sınıf arkadaşlarından biriyle arkadaş ol: sohbet et, tanış. Onları meydanlarda bulabilirsin.', en: 'Make friends with one classmate: chat and get to know each other. You\'ll find them on the plazas.' },
    requires: ['sinif'],
    unlocks: { tr: 'Dersler başlıyor', en: 'Lessons begin' },
    objectives: [{
      id: 'one', text: { tr: 'Bir sınıf arkadaşınla "Arkadaş" ol', en: 'Become "Friends" with one classmate' },
      done: (c) => friendCount(c) >= 1, progress: (c) => `${Math.min(1, friendCount(c))}/1`, targets: at('merkez_meydan', 'yurt_meydani'),
    }],
    reward: { xp: 60 },
  },
  {
    id: 'derse_gir', kind: 'main',
    title: { tr: 'İlk Ders', en: 'First Lesson' },
    desc: { tr: 'Ders saatinde Eğitim Binası\'ndaki sınıfına git ve derse katıl.', en: 'Go to your classroom in the academic building during a lesson and take part.' },
    requires: ['ilk_arkadas'],
    unlocks: { tr: 'Ödevler ve etüt', en: 'Homework and study hall' },
    objectives: [{ id: 'attend', text: { tr: 'Bir derse gir (hafta içi 08:30–15:20)', en: 'Attend a lesson (weekdays 08:30–15:20)' }, done: (c) => c.st.school.attended.length >= 1, targets: at('egitim') }],
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
    reward: { xp: 60, text: { tr: 'Pazartesi töreninde marşı sen okursun · +10 saygınlık', en: "You lead the anthem at Monday's ceremony · +10 respect" } },
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
      { id: 'meet', text: { tr: 'Yurt Meydanı\'nda bir abi ya da ablayla konuş', en: 'Talk to an older student on the dorm plaza' }, done: (c) => c.st.favor.stage !== 'none', targets: at('yurt_meydani') },
      { id: 'favor', text: { tr: 'Ricasını yerine getir: kitabı Kütüphane\'ye iade et', en: 'Do the favor: return the book to the library' }, done: (c) => c.st.favor.stage === 'done' || c.st.favor.stage === 'rewarded', targets: at('kutuphane') },
      { id: 'sandwich', text: { tr: 'Geri dön ve sandviçini al', en: 'Go back and get your sandwich' }, done: (c) => c.st.favor.stage === 'rewarded', targets: at('yurt_meydani') },
    ],
    reward: { xp: 80 },
  },
  {
    id: 'sinavlar', kind: 'main',
    title: { tr: 'Sınavları Geç', en: 'Pass the Exams' },
    desc: { tr: 'Derslere gir, ödevlerini yap ve yıl sonu sınavını geç (en az %50).', en: 'Attend lessons, do your homework and pass the year-end exam (at least 50%).' },
    requires: ['uc_ogun'],
    objectives: [
      { id: 'lessons', text: { tr: `En az ${LESSONS_FOR_EXAM} derse gir`, en: `Attend at least ${LESSONS_FOR_EXAM} lessons` }, done: (c) => c.st.school.attended.length >= LESSONS_FOR_EXAM, progress: (c) => `${Math.min(c.st.school.attended.length, LESSONS_FOR_EXAM)}/${LESSONS_FOR_EXAM}`, targets: at('egitim') },
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
      { id: 'ceremony', text: { tr: 'Karne törenine katıl (Yemekhane · konferans salonu)', en: 'Attend the ceremony (dining hall · auditorium)' }, done: (c) => c.st.yearDone, targets: at('yemekhane') },
    ],
    reward: { xp: 0 },
  },
  {
    id: 'cemil_cis', kind: 'challenge',
    title: { tr: 'Cemil Emmi\'nin Görevi: Çişini Tut', en: "Cemil Emmi's Task: Hold Your Pee" },
    desc: { tr: 'Erkek Yurdu\'nun hademesi Cemil Emmi\'nin ilk görevi. Bir gece yataktan kalkmadan sabaha kadar dayan. Başaramazsan her gece yeniden denersin; ne kadar çok başarısız olursan o kadar çok dalga geçilir ve saygınlığın düşer.', en: "The first task from Cemil Emmi, the boys' dorm caretaker. Last one night until morning without getting out of bed. Fail and you try again every night; the more you fail, the more you get teased and the more respect you lose." },
    requires: ['bavul'],
    objectives: [
      { id: 'meet', text: { tr: 'Erkek Yurdu önünde Cemil Emmi ile konuş (08:00–18:00)', en: "Talk to Cemil Emmi outside the boys' dorm (08:00–18:00)" }, done: (c) => c.st.cemil.pee !== 'none', targets: at('erkek_yurdu') },
      { id: 'hold', text: { tr: 'Yurdunda uyu ve gece sabaha kadar tut', en: 'Sleep in your dorm and hold it until morning' }, done: (c) => c.st.cemil.pee === 'held' || c.st.cemil.pee === 'rewarded', targets: ownDorm },
      { id: 'report', text: { tr: 'Cemil Emmi\'ye anlat', en: 'Tell Cemil Emmi' }, done: (c) => c.st.cemil.pee === 'rewarded', targets: at('erkek_yurdu') },
    ],
    reward: { xp: 50, text: { tr: 'Cemil Emmi\'nin şekerleri · yeni görevler yolda', en: "Cemil Emmi's sweets · more tasks to come" } },
  },
  {
    id: 'saglikli_yil', kind: 'challenge',
    title: { tr: 'Sağlıklı Bir Yıl', en: 'A Healthy Year' },
    desc: { tr: 'Yılı hiç hastalanmadan bitir. Öğünlerini atlama, uyu, yemekten önce ellerini yıka, kışın geceleri dışarıda kalma.', en: "Finish the year without getting sick. Don't skip meals, get your sleep, wash your hands before meals and don't stay out on winter nights." },
    requires: [],
    objectives: [{ id: 'healthy', text: { tr: 'Karne gününe kadar hastalanma', en: "Don't get sick before report card day" }, done: (c) => c.st.yearDone && !c.st.everSick }],
    failed: (c) => c.st.everSick,
    reward: { xp: 150, text: { tr: '"Demir Gibi" madalyası · +10 Kondisyon · +50 Saygınlık', en: '"Iron Kid" medal · +10 Fitness · +50 Respect' } },
  },
];

export type MissionStatus = 'locked' | 'active' | 'done' | 'failed';

export function missionDone(st: PlayerState, id: string) { return st.missionsDone.includes(id); }

export function statusOf(m: Mission, c: MissionCtx): MissionStatus {
  if (missionDone(c.st, m.id)) return 'done';
  if (m.failed?.(c)) return 'failed';
  if (!m.requires.every((r) => missionDone(c.st, r))) return 'locked';
  return 'active';
}

export function isActive(id: string, c: MissionCtx) {
  return statusOf(MISSIONS.find((m) => m.id === id)!, c) === 'active';
}

/** reached = active or already done (i.e. the feature it gates is open) */
export function reached(id: string, c: MissionCtx) {
  const s = statusOf(MISSIONS.find((m) => m.id === id)!, c);
  return s === 'active' || s === 'done';
}

/** the mission the tracker follows: first active main mission, in list order */
export function trackedMission(c: MissionCtx): Mission | null {
  return MISSIONS.find((m) => m.kind === 'main' && statusOf(m, c) === 'active') ?? null;
}

export function nextObjective(m: Mission, c: MissionCtx): Objective | null {
  return m.objectives.find((o) => !o.done(c)) ?? null;
}

export function missionById(id: string): Mission {
  return MISSIONS.find((m) => m.id === id)!;
}

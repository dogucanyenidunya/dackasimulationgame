// A lesson in three moments, so there's always something to do until the bell (online, the campus clock doesn't jump):
// the opening (the teacher starts the topic), the main part (the choice the lesson has always had: answer, notes,
// whisper, the mandolin…) and a classroom event near the end (called to the board, a note passed along, a surprise
// question, group work). Each moment gives a performance mark; the lesson's mark is their average.
import { L } from '../i18n';
import { askFor } from '../content/quiz';
import { NPCS, type NpcDef } from '../content/npcs';
import type { SubjectId } from './state';
import { shape } from './dilemmas';
import type { GameCtx } from './buildings';

const T = (tr: string, en: string): string => L({ tr, en });
const pick = <X,>(a: X[]) => a[Math.floor(Math.random() * a.length)];

/** what one moment of a lesson came to */
export interface MomentResult { score: number; xp: number; title: string; body: string }

/** while the lesson goes on between moments (shown in the panel) */
export function lessonFiller(teacher: string): string {
  return pick([
    T(`${teacher} tahtaya bir şema çiziyor…`, `${teacher} is drawing a diagram on the board…`),
    T('Arka sırada biri hapşırdı; herkes kıkırdıyor.', 'Someone at the back sneezed; everyone is giggling.'),
    T(`${teacher} konuyu bir örnekle anlatıyor…`, `${teacher} is explaining it with an example…`),
    T('Kalemler defterlerde hışırdıyor. Pencereden bahçedeki kuşlar görünüyor.', 'Pencils scratch on paper. You can see birds in the garden through the window.'),
    T(`${teacher} sınıfın arasında dolaşıp defterlere bakıyor…`, `${teacher} is walking between the desks, looking at notebooks…`),
  ]);
}

/** the opening: the teacher writes today's topic on the board */
export async function lessonOpening(ctx: GameCtx, subject: string, teacher: string): Promise<MomentResult | null> {
  const choice = await ctx.panel.choose(T(`${subject} · ${teacher} bugünün konusunu tahtaya yazıyor`, `${subject} · ${teacher} writes today's topic on the board`), [
    { id: 'listen', label: T('👀 Dikkatle dinle', '👀 Listen carefully'), hint: T('+1 Bilgi · güvenli', '+1 Knowledge · safe') },
    { id: 'ask', label: T('🙋 Bir soru sor', '🙋 Ask a question'), hint: T('Öğretmen sevinebilir… ya da "Bunu az önce anlattım" der', 'The teacher may be pleased… or say "I just explained that"') },
    { id: 'window', label: T('🪟 Pencereden dışarı bak', '🪟 Look out of the window'), hint: T('+moral · ⚠ yakalanabilirsin', '+mood · ⚠ you might get caught') },
  ]);
  if (!choice) return null;
  if (choice === 'listen') {
    shape(ctx.st, { rules: -1 });
    ctx.gain({ attrs: { knowledge: 1 } });
    return { score: 70, xp: 5, title: T('Dinledin', 'You listened'), body: T('Konuyu baştan yakaladın; neyin ne olduğu kafanda netleşti.', 'You caught the topic from the start; it all makes sense now.') };
  }
  if (choice === 'ask') {
    shape(ctx.st, { presence: 1, ambition: 1 });
    if (Math.random() < 0.65) {
      ctx.gain({ mood: 3, attrs: { knowledge: 1 } });
      return { score: 85, xp: 10, title: T('İyi soru!', 'Good question!'), body: T(`${teacher}: "Çok güzel bir soru, herkes dinlesin!"`, `${teacher}: "What a good question, everyone listen!"`) };
    }
    ctx.gain({ mood: -1 });
    return { score: 55, xp: 3, title: T('Hmm…', 'Hmm…'), body: T(`${teacher}: "Bunu az önce anlattım ama olsun, tekrar edelim."`, `${teacher}: "I just explained that, but fine, let's go over it again."`) };
  }
  shape(ctx.st, { rules: 1 });
  ctx.gain({ mood: 3 });
  if (Math.random() < 0.25) {
    ctx.penalize(1, T(`${teacher}: "Pencerede ne var? Tahta burada!"`, `${teacher}: "What's out of the window? The board is over here!"`));
    return { score: 35, xp: 0, title: T('Yakalandın', 'Caught'), body: T('Bahçedeki kediyi izlerken adın seslenildi.', 'Your name was called while you were watching the cat in the garden.') };
  }
  return { score: 45, xp: 0, title: T('Hayaller', 'Daydreams'), body: T('Bulutlar bir ejderhaya benziyordu. Konunun başını kaçırdın.', 'The clouds looked like a dragon. You missed the start of the topic.') };
}

/** near the end: something happens in class (not the board if you already answered the teacher's question) */
export async function lessonEvent(ctx: GameCtx, sub: SubjectId, subject: string, teacher: string, answeredAlready: boolean,
  pickMate: (q: string) => Promise<NpcDef>): Promise<MomentResult | null> {
  const mates = NPCS.filter((n) => n.kind === 'classmate');
  const kinds: Array<'board' | 'note' | 'group' | 'pop'> = answeredAlready ? ['note', 'group', 'pop'] : ['board', 'note', 'group'];
  const kind = pick(kinds);
  if (kind === 'board' || kind === 'pop') {
    const q = askFor(sub, Math.floor(Math.random() * 1000));
    const title = kind === 'board' ? T(`${teacher} seni tahtaya kaldırdı`, `${teacher} calls you to the board`) : T('Sürpriz soru!', 'Surprise question!');
    const ok = await ctx.panel.quiz(`${title} · ${subject}`, L(q.q), q.options.map(L), q.answer, kind === 'board' ? T('Bütün sınıf sana bakıyor…', 'The whole class is watching…') : T('Herkes kâğıdını çıkardı…', 'Everyone gets out a sheet of paper…'));
    if (ok) {
      ctx.gain({ mood: 4, attrs: { knowledge: 1 } });
      return { score: 95, xp: 25, title: T('Doğru!', 'Right!'), body: kind === 'board' ? T(`Tebeşiri bırakırken ${teacher} başını salladı: "Aferin."`, `As you put the chalk down, ${teacher} nodded: "Well done."`) : T('Kâğıdına kocaman bir artı aldın.', 'You got a big tick on your paper.') };
    }
    ctx.gain({ mood: -2 });
    return { score: 50, xp: 5, title: T('Olmadı', 'Not quite'), body: T(`${teacher}: "Doğrusunu birlikte bulalım." Bir dahakine hazırsın.`, `${teacher}: "Let's work out the right answer together." You'll be ready next time.`) };
  }
  if (kind === 'note') {
    const from = pick(mates);
    const choice = await ctx.panel.choose(T(`Arka sıradan ${from.name}'dan katlanmış bir not geldi`, `A folded note arrives from ${from.name} at the back`), [
      { id: 'reply', label: T('✍️ Oku ve cevap yaz', '✍️ Read it and write back'), hint: T('+arkadaşlık · ⚠ yakalanabilirsin', '+friendship · ⚠ you might get caught') },
      { id: 'ignore', label: T('🙈 Sonra okursun, derse dön', '🙈 Read it later, back to the lesson'), hint: T('Güvenli', 'Safe') },
      { id: 'teacher', label: T('🧑‍🏫 Öğretmene ver', '🧑‍🏫 Hand it to the teacher'), hint: T(`Kurallara uygun · ${from.name} kırılır`, `By the rules · ${from.name} will be hurt`) },
    ]);
    if (choice === 'reply') {
      shape(ctx.st, { loyalty: 1, rules: 1 });
      ctx.befriend(from.id, 6);
      if (Math.random() < 0.3) {
        ctx.penalize(2, T(`${teacher}: "Notlaşmak yok! Ver bakalım şunu."`, `${teacher}: "No passing notes! Hand that over."`));
        return { score: 40, xp: 0, title: T('Yakalandınız', 'Caught'), body: T(`Not ${teacher}'ın masasında kaldı ama ${from.name} ile göz göze gelip güldünüz.`, `The note ended up on ${teacher}'s desk, but you and ${from.name} caught each other's eye and laughed.`) };
      }
      return { score: 55, xp: 3, title: from.name, body: T(`Notta "Teneffüste yetimball?" yazıyordu. "Olur!" diye cevap verdin.`, `The note said "Yetimball at break?" You wrote back "Yes!"`) };
    }
    if (choice === 'teacher') {
      shape(ctx.st, { rules: -2, loyalty: -1 });
      ctx.befriend(from.id, -8);
      return { score: 70, xp: 5, title: T('Kurallar kuraldır', 'Rules are rules'), body: T(`${teacher} notu cebine koydu. ${from.name} sana kızgın bakıyor.`, `${teacher} pocketed the note. ${from.name} is glaring at you.`) };
    }
    return { score: 65, xp: 3, title: T('Derse döndün', 'Back to the lesson'), body: T('Notu sıranın altına koydun; teneffüste okursun.', 'You slid the note under your desk to read at break.') };
  }
  // group work: with whom?
  const mate = await pickMate(T(`${teacher}: "İkişerli grup olun!" Kiminle çalışacaksın?`, `${teacher}: "Get into pairs!" Who will you work with?`));
  shape(ctx.st, { warmth: -1, loyalty: 1 });
  ctx.befriend(mate.id, 6);
  ctx.gain({ attrs: { social: 1 } });
  const good = Math.random() < 0.7;
  return good
    ? { score: 80, xp: 10, title: T('Grup çalışması', 'Group work'), body: T(`${mate.name} ile ödevi birlikte bitirdiniz; ${teacher} ikinizi de övdü.`, `You and ${mate.name} finished the task together; ${teacher} praised you both.`) }
    : { score: 60, xp: 5, title: T('Grup çalışması', 'Group work'), body: T(`${mate.name} ile çok güldünüz ama iş yarım kaldı.`, `You and ${mate.name} laughed a lot, but the task is only half done.`) };
}

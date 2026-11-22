// Dönem odağı (term focus, after Popmundo's "Focus"): you choose what this term is about. That area grows
// faster and the rest a little slower, and each focus has a goal for the term. You can change your focus,
// but what you'd done towards the old goal is lost.
import { L, type Text } from '../i18n';
import type { AttrId } from '../content/character';
import type { PlayerState } from './state';
import type { GameCtx } from './buildings';

export type FocusId = 'study' | 'sport' | 'friends' | 'art' | 'order' | 'balanced';

export interface Focus {
  id: FocusId;
  icon: string;
  name: Text;
  /** the attribute that grows faster (none for Dengeli) */
  attr?: AttrId;
  /** how many times you need to do it this term */
  goal: number;
  /** what counts, as the player reads it */
  goalText: Text;
}

/** the focused attribute grows this much faster, the others this much slower */
export const FOCUS_BOOST = 1.3;
export const FOCUS_DRAG = 0.9;

export const FOCUSES: Focus[] = [
  { id: 'study', icon: '📚', name: { tr: 'Dersler', en: 'Lessons' }, attr: 'knowledge', goal: 10,
    goalText: { tr: '10 kez ders çalış: derse gir, ödev yap, kitap oku, marşı çalış', en: 'Study 10 times: lessons, homework, reading, the anthem' } },
  { id: 'sport', icon: '⚽', name: { tr: 'Spor', en: 'Sport' }, attr: 'fitness', goal: 4,
    goalText: { tr: '4 antrenman ya da maç', en: '4 trainings or games' } },
  { id: 'friends', icon: '🤝', name: { tr: 'Arkadaşlar', en: 'Friends' }, attr: 'social', goal: 10,
    goalText: { tr: '10 kez arkadaşlarınla vakit geçir: sohbet, oyun, birlikte yemek, ikram', en: 'Spend time with friends 10 times: chats, games, meals together, treats' } },
  { id: 'art', icon: '🎨', name: { tr: 'Sanat ve müzik', en: 'Art and music' }, attr: 'creativity', goal: 4,
    goalText: { tr: '4 kez sanat ya da müzik: çizim, mandolin, müzik çalışması, afiş', en: 'Art or music 4 times: drawing, mandolin, practice, posters' } },
  { id: 'order', icon: '🗂️', name: { tr: 'Düzen', en: 'Good conduct' }, attr: 'discipline', goal: 3,
    goalText: { tr: 'Hiç disiplin puanı almadan 3 gün geçir', en: 'Go 3 days without a single discipline point' } },
  { id: 'balanced', icon: '⚖️', name: { tr: 'Dengeli', en: 'Balanced' }, goal: 0,
    goalText: { tr: 'Her şeye biraz: ne bonus ne ceza, hedef de yok', en: 'A bit of everything: no bonus, no drag, no goal' } },
];

export const focusOf = (st: PlayerState): Focus | null => (st.focus ? FOCUSES.find((f) => f.id === st.focus!.id) ?? null : null);

/** gain multiplier for an attribute under your focus */
export function focusMult(st: PlayerState, attr: AttrId): number {
  const f = focusOf(st);
  if (!f?.attr) return 1;
  return f.attr === attr ? FOCUS_BOOST : FOCUS_DRAG;
}

const doneKey = (st: PlayerState, id: FocusId) => `${st.year}:${id}`;
/** this year's goal for this focus is already met */
export const focusGoalMet = (st: PlayerState, id: FocusId) => st.focusDone.includes(doneKey(st, id));

/** one step towards your focus's goal, if `kind` is what you're focused on; the goal pays out once a year */
export function focusTick(ctx: GameCtx, kind: FocusId) {
  const st = ctx.st, f = focusOf(st);
  if (!f || f.id !== kind || !f.goal || focusGoalMet(st, f.id)) return;
  st.focus!.progress = Math.min(f.goal, st.focus!.progress + 1);
  if (st.focus!.progress < f.goal) return;
  st.focusDone.push(doneKey(st, f.id));
  ctx.ch.respect += 10;
  ctx.gain({ xp: 60, mood: 10, ...(f.attr ? { attrs: { [f.attr]: 2 } } : {}) });
  ctx.toast(L({ tr: `${f.icon} Dönem hedefini tutturdun: ${L(f.name)}! +10 saygınlık`, en: `${f.icon} Term goal reached: ${L(f.name)}! +10 respect` }), 'good');
}

/** pick (or change) your focus; returns false if you backed out */
export async function chooseFocus(ctx: GameCtx): Promise<boolean> {
  const st = ctx.st, cur = focusOf(st);
  const pct = (n: number) => Math.round((n - 1) * 100);
  const id = await ctx.panel.choose(
    L(cur
      ? { tr: `Dönem odağın: ${cur.icon} ${L(cur.name)}. Değiştirirsen bu hedefteki ilerlemen sıfırlanır.`, en: `Your term focus: ${cur.icon} ${L(cur.name)}. If you change it, your progress towards its goal is lost.` }
      : { tr: 'Bu dönem neye odaklanacaksın?', en: 'What will this term be about?' }),
    FOCUSES.filter((f) => f.id !== cur?.id).map((f) => ({
      id: f.id,
      label: `${f.icon} ${L(f.name)}`,
      hint: f.attr
        ? L({ tr: `${attrName(f.attr)} +%${pct(FOCUS_BOOST)}, diğerleri −%${-pct(FOCUS_DRAG)} · Hedef: ${L(f.goalText)}${focusGoalMet(st, f.id) ? ' (bu yıl tutturdun)' : ''}`,
          en: `${attrName(f.attr)} +${pct(FOCUS_BOOST)}%, the rest −${-pct(FOCUS_DRAG)}% · Goal: ${L(f.goalText)}${focusGoalMet(st, f.id) ? ' (met this year)' : ''}` })
        : L(f.goalText),
    })),
  );
  const f = FOCUSES.find((x) => x.id === id);
  if (!f) return false;
  st.focus = { id: f.id, progress: 0, since: ctx.clock.day };
  await ctx.panel.message(`${f.icon} ${L(f.name)}`, f.goal
    ? L({ tr: `Bu dönem senin için ${L(f.name).toLocaleLowerCase('tr-TR')} öncelikli. Hedef: ${L(f.goalText)}. Profilinden ilerlemeni görebilirsin.`, en: `This term is about ${L(f.name).toLowerCase()}. Goal: ${L(f.goalText)}. Your profile shows how far you've got.` })
    : L({ tr: 'Bu dönem her şeyden biraz. Odak seçmek istersen masandan değiştirebilirsin.', en: 'A bit of everything this term. You can change it at your desk any time.' }));
  return true;
}

const ATTR_NAMES: Record<AttrId, Text> = {
  knowledge: { tr: 'Bilgi', en: 'Knowledge' }, fitness: { tr: 'Kondisyon', en: 'Fitness' }, social: { tr: 'Sosyallik', en: 'Social' },
  discipline: { tr: 'Disiplin', en: 'Discipline' }, creativity: { tr: 'Yaratıcılık', en: 'Creativity' },
};
const attrName = (a: AttrId) => L(ATTR_NAMES[a]);

/** e.g. "⚽ Spor · 2/4" or "⚽ Spor · ✓ hedef tuttu" */
export function focusLine(st: PlayerState): string {
  const f = focusOf(st);
  if (!f) return L({ tr: 'Henüz seçmedin (masandan seçebilirsin)', en: 'Not chosen yet (pick one at your desk)' });
  if (!f.goal) return `${f.icon} ${L(f.name)}`;
  return focusGoalMet(st, f.id)
    ? `${f.icon} ${L(f.name)} · ✓ ${L({ tr: 'hedef tuttu', en: 'goal met' })}`
    : `${f.icon} ${L(f.name)} · ${st.focus!.progress}/${f.goal}`;
}

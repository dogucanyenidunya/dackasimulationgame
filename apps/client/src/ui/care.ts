// The daily care card on the title screen (GDD §6.2.2): your character, how they're doing, and three small
// acts of care (a kumanya, a call from home, a note to a friend), plus your pigeonhole of friends' notes.
// It all works without loading the campus, so a one-minute visit is enough.
import './care.css';
import { paintCharacter } from '../art/textures';
import { GUARDIANS } from '../content/character';
import { care, careMood, doneToday, todaysCall, todaysKumanya, type CareAct } from '../game/care';
import { L, type Text } from '../i18n';
import { listFriends } from '../net/friends';
import { NOTE_MAX, blockPlayer, listNotes, markNotesRead, noteEmailsOn, sendNote, setNoteEmails, type Note } from '../net/notes';
import type { SaveData } from '../save';
import { askConfirm } from './confirm';

const S = {
  kumanya: { tr: 'Kumanya ver', en: 'Give a kumanya' },
  call: { tr: 'Evden arıyorlar', en: 'A call from home' },
  note: { tr: 'Arkadaşına not', en: 'Note to a friend' },
  doneHint: { tr: 'Bugün yapıldı, yarın yine', en: 'Done today, again tomorrow' },
  hold: { tr: 'Bugün ona iyi baktın. Yarına kadar keyfi yerinde kalacak.', en: "You looked after them today. They'll stay this way until tomorrow." },
  ask: { tr: 'Bugün küçük bir ilgi ona iyi gelir.', en: 'A little care today would do them good.' },
  missed: { tr: 'Bir süredir yoktun. Seni özlemiş!', en: "You've been away for a while. They missed you!" },
  mood: { tr: 'Moral', en: 'Mood' },
  energy: { tr: 'Enerji', en: 'Energy' },
  health: { tr: 'Sağlık', en: 'Health' },
  signInForNotes: { tr: 'Arkadaşlarına not bırakmak için e-postanla giriş yap.', en: 'Sign in with your email to leave notes for friends.' },
  noFriends: { tr: 'Henüz arkadaşın yok. Kampüste arkadaş edin ya da davet bağlantını gönder.', en: "You don't have friends here yet. Make some on campus or send your invite link." },
  notesOff: { tr: 'Notlar şu an açılamadı. Biraz sonra tekrar dene.', en: "Notes couldn't be opened just now. Try again in a bit." },
  to: { tr: 'Kime?', en: 'To whom?' },
  placeholder: { tr: 'Kısa bir not yaz…', en: 'Write a short note…' },
  send: { tr: 'Gönder', en: 'Send' },
  cancel: { tr: 'Vazgeç', en: 'Cancel' },
  limit: { tr: 'Bugün yeterince not bıraktın. Yarın yine yazabilirsin.', en: "You've left enough notes today. You can write again tomorrow." },
  notFriends: { tr: 'Bu oyuncuyla artık arkadaş değilsiniz.', en: "You're not friends with this player any more." },
  failed: { tr: 'Not gönderilemedi. Tekrar dene.', en: "The note couldn't be sent. Try again." },
  inbox: { tr: 'Posta kutun', en: 'Your pigeonhole' },
  empty: { tr: 'Henüz not yok.', en: 'No notes yet.' },
  reply: { tr: 'Yanıtla', en: 'Reply' },
  block: { tr: 'Engelle', en: 'Block' },
  blockAsk: { tr: 'Bu oyuncuyu engellemek istiyor musun? Arkadaşlığınız biter ve sana artık not bırakamaz.', en: "Block this player? Your friendship ends and they can't leave you notes any more." },
  blockYes: { tr: 'Engelle', en: 'Block' },
  emails: { tr: 'Bir arkadaşım not bırakınca bana e-posta gönder (günde en fazla bir)', en: 'Email me when a friend leaves a note (at most one a day)' },
  aFriend: { tr: 'Bir arkadaşın', en: 'A friend' },
};

const PRESETS: Text[] = [
  { tr: 'Seni özledim!', en: 'I miss you!' },
  { tr: 'Kahvaltıda görüşürüz!', en: 'See you at breakfast!' },
  { tr: 'Etütte yanına oturayım mı?', en: 'Can I sit next to you in study hall?' },
  { tr: 'Bugün harikaydın!', en: 'You were great today!' },
  { tr: 'Maçta görüşürüz!', en: 'See you at the match!' },
];

/** notes to friends (the button, the pigeonhole and the email switch) are switched off for now */
export const NOTES_ENABLED = false;

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));

let timer: number | null = null;

/**
 * Draws the care card into `slot`. `away` is how many hours your character drifted while you were gone
 * (shown as a warm welcome back); `persist` saves the game after a care act.
 */
export function mountCare(slot: HTMLElement, save: SaveData, net: { id: string } | null, away: number, persist: () => void) {
  const st = save.state;
  const who = GUARDIANS.find((g) => g.id === save.character.guardian)?.your ?? { tr: 'Ailen', en: 'Your family' };
  let message = '';
  let composing: { to: string } | null = null;
  let friends: Array<{ id: string; name: string }> | null = null;
  let notes: Note[] | null = null;
  let emailsOn: boolean | null = null;

  const bar = (icon: string, label: Text, v: number, kind: string) =>
    `<div class="care-bar ${kind}" title="${esc(L(label))}: ${Math.round(v)}"><span class="care-bar-icon">${icon}</span><div class="care-bar-track"><span style="width:${Math.round(v)}%"></span></div></div>`;

  const actBtn = (act: CareAct, icon: string, label: Text) => {
    const done = doneToday(st, act);
    // notes can be sent more than once a day (the care only counts once), so that button stays usable
    const disabled = done && act !== 'note';
    return `<button type="button" class="care-act${done ? ' done' : ''}" data-care="${act}" ${disabled ? 'disabled' : ''} title="${done ? esc(L(S.doneHint)) : ''}">
      <span class="care-icon">${done ? '✓' : icon}</span><span>${esc(L(label))}</span></button>`;
  };

  const updateCount = () => {
    const ta = slot.querySelector('[data-body]') as HTMLTextAreaElement | null;
    const c = slot.querySelector('.care-count');
    if (ta && c) c.textContent = `${ta.value.length}/${NOTE_MAX}`;
  };

  const render = () => {
    const caredToday = (['kumanya', 'call', 'note'] as CareAct[]).some((a) => doneToday(st, a));
    const status = caredToday ? S.hold : away > 0 ? S.missed : S.ask;
    const unread = notes?.filter((n) => !n.read).length ?? 0;
    // keep a half-written note when the card redraws (e.g. the pigeonhole finishing loading)
    const draft = (slot.querySelector('[data-body]') as HTMLTextAreaElement | null)?.value ?? '';
    slot.innerHTML = `
      <div class="care">
        <div class="care-head">
          <canvas class="care-bust" width="90" height="90"></canvas>
          <div class="care-who">
            <div class="care-name"></div>
            <div class="care-mood">${esc(L(careMood(st)))}</div>
            ${bar('🙂', S.mood, st.mood, 'mood')}${bar('⚡', S.energy, st.energy, 'energy')}${bar('❤️', S.health, st.health, 'health')}
          </div>
        </div>
        <div class="care-status">${esc(L(status))}</div>
        <div class="care-acts${NOTES_ENABLED ? '' : ' two'}">
          ${actBtn('kumanya', '🥪', S.kumanya)}${actBtn('call', '📞', S.call)}${NOTES_ENABLED ? actBtn('note', '✉️', S.note) : ''}
        </div>
        ${message ? `<div class="care-msg"></div>` : ''}
        ${composing && friends ? `
          <form class="care-compose" data-compose>
            <label>${esc(L(S.to))} <select data-to>${friends.map((f) => `<option value="${esc(f.id)}" ${f.id === composing!.to ? 'selected' : ''}>${esc(f.name || L(S.aFriend))}</option>`).join('')}</select></label>
            <div class="care-presets">${PRESETS.map((p, i) => `<button type="button" data-preset="${i}">${esc(L(p))}</button>`).join('')}</div>
            <textarea data-body maxlength="${NOTE_MAX}" rows="2" placeholder="${esc(L(S.placeholder))}"></textarea>
            <div class="care-compose-row"><span class="care-count">0/${NOTE_MAX}</span>
              <button type="button" class="secondary" data-cancel>${esc(L(S.cancel))}</button>
              <button type="submit" class="primary">${esc(L(S.send))}</button></div>
          </form>` : ''}
        ${NOTES_ENABLED && net && notes ? `
          <div class="care-inbox">
            <div class="care-inbox-title">📬 ${esc(L(S.inbox))}${unread ? ` <span class="care-badge">${unread}</span>` : ''}</div>
            ${notes.length ? notes.slice(0, 5).map((n) => `
              <div class="care-note${n.read ? '' : ' new'}" data-note="${n.id}">
                <div class="care-note-from"><b></b> <span class="care-note-time"></span></div>
                <div class="care-note-body"></div>
                <div class="care-note-btns"><button type="button" data-reply="${esc(n.sender)}">${esc(L(S.reply))}</button><button type="button" data-block="${esc(n.sender)}">${esc(L(S.block))}</button></div>
              </div>`).join('') : `<div class="care-empty">${esc(L(S.empty))}</div>`}
          </div>` : ''}
        ${NOTES_ENABLED && net && emailsOn !== null ? `<label class="care-emails"><input type="checkbox" data-emails ${emailsOn ? 'checked' : ''}> ${esc(L(S.emails))}</label>` : ''}
      </div>`;
    (slot.querySelector('.care-name') as HTMLElement).textContent = `${save.character.first} ${save.character.last}`.trim();
    const msg = slot.querySelector('.care-msg');
    if (msg) msg.textContent = message;
    // user-written text only ever goes in as text, never as markup
    for (const n of notes?.slice(0, 5) ?? []) {
      const el = slot.querySelector(`[data-note="${n.id}"]`);
      if (!el) continue;
      (el.querySelector('b') as HTMLElement).textContent = n.name || L(S.aFriend);
      (el.querySelector('.care-note-time') as HTMLElement).textContent = timeAgo(n.createdAt);
      (el.querySelector('.care-note-body') as HTMLElement).textContent = n.body;
    }
    const ta = slot.querySelector('[data-body]') as HTMLTextAreaElement | null;
    if (ta && draft) { ta.value = draft; updateCount(); }
    paintBust(false);
  };

  // the portrait blinks now and then; a tired character blinks more often and more slowly
  const bustCanvas = () => slot.querySelector('.care-bust') as HTMLCanvasElement | null;
  const paintBust = (blink: boolean) => { const cv = bustCanvas(); if (cv) paintCharacter(cv, save.character.look, 0, 0, { bust: true, blink }); };
  if (timer !== null) window.clearInterval(timer);
  let tick = 0;
  timer = window.setInterval(() => {
    if (!slot.isConnected) { window.clearInterval(timer!); timer = null; return; }
    tick++;
    const tired = st.energy < 55;
    const every = tired ? 9 : 17;
    const len = tired ? 3 : 1;
    if (tick % every < len) paintBust(true); else if (tick % every === len) paintBust(false);
  }, 180);

  const act = (a: CareAct, text: string) => {
    if (care(st, a)) persist();
    message = text;
    render();
  };

  const openCompose = async (to?: string) => {
    if (!net) { message = L(S.signInForNotes); render(); return; }
    const list = await listFriends();
    if (!list) { message = L(S.notesOff); render(); return; }
    friends = list.filter((f) => f.status === 'accepted').map((f) => ({ id: f.id, name: f.name }));
    if (!friends.length) { message = L(S.noFriends); composing = null; render(); return; }
    composing = { to: to && friends.some((f) => f.id === to) ? to : friends[0].id };
    message = '';
    render();
    (slot.querySelector('[data-body]') as HTMLTextAreaElement | null)?.focus();
  };

  slot.onclick = async (e) => {
    const target = (e.target as HTMLElement).closest('button, input') as HTMLElement | null;
    if (!target) return;
    const a = target.dataset.care as CareAct | undefined;
    if (a === 'kumanya') act('kumanya', L({ tr: `🥪 Kumanyanı yedin: ${todaysKumanya().tr}. Afiyet olsun!`, en: `🥪 You had your kumanya: ${todaysKumanya().en}. Enjoy!` }));
    else if (a === 'call') act('call', `📞 ${L(todaysCall(who))}`);
    else if (a === 'note' && NOTES_ENABLED) void openCompose();
    else if (target.dataset.reply) void openCompose(target.dataset.reply);
    else if (target.dataset.preset !== undefined) {
      const ta = slot.querySelector('[data-body]') as HTMLTextAreaElement;
      ta.value = L(PRESETS[Number(target.dataset.preset)]);
      updateCount();
      ta.focus();
    } else if (target.hasAttribute('data-cancel')) { composing = null; render(); }
    else if (target.dataset.block) {
      if (!(await askConfirm(L(S.blockAsk), L(S.blockYes), L(S.cancel)))) return;
      if (await blockPlayer(target.dataset.block)) notes = (notes ?? []).filter((n) => n.sender !== target.dataset.block);
      render();
    } else if (target.hasAttribute('data-emails')) {
      const on = (target as HTMLInputElement).checked;
      if (await setNoteEmails(on)) emailsOn = on; else (target as HTMLInputElement).checked = !on;
    }
  };

  slot.oninput = (e) => { if ((e.target as HTMLElement).hasAttribute('data-body')) updateCount(); };
  slot.onchange = (e) => { const sel = e.target as HTMLSelectElement; if (sel.hasAttribute('data-to') && composing) composing.to = sel.value; };

  slot.onsubmit = async (e) => {
    e.preventDefault();
    if (!composing) return;
    const ta = slot.querySelector('[data-body]') as HTMLTextAreaElement;
    const body = ta.value.trim();
    if (!body) { ta.focus(); return; }
    const btn = slot.querySelector('[data-compose] button[type=submit]') as HTMLButtonElement;
    btn.disabled = true;
    const r = await sendNote(composing.to, body);
    if (r === 'sent') {
      const name = friends?.find((f) => f.id === composing!.to)?.name || L(S.aFriend);
      composing = null;
      act('note', L({ tr: `✉️ Notun ${name} için bırakıldı.`, en: `✉️ Your note is waiting for ${name}.` }));
      return;
    }
    btn.disabled = false;
    message = L(r === 'limit' ? S.limit : r === 'not_friends' ? S.notFriends : S.failed);
    render();
  };

  render();
  if (net && NOTES_ENABLED) {
    // the pigeonhole and the email setting load in the background; notes count as read once you've seen them
    void listNotes().then((list) => {
      notes = list;
      render();
      if (list) void markNotesRead(list.slice(0, 5).filter((n) => !n.read).map((n) => n.id));
    });
    void noteEmailsOn().then((on) => { emailsOn = on; render(); });
  }
}

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return L({ tr: 'şimdi', en: 'just now' });
  if (mins < 60) return L({ tr: `${mins} dk önce`, en: `${mins} min ago` });
  const h = Math.round(mins / 60);
  if (h < 24) return L({ tr: `${h} saat önce`, en: `${h} h ago` });
  const d = Math.round(h / 24);
  return L({ tr: `${d} gün önce`, en: `${d} d ago` });
}

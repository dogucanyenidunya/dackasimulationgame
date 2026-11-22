// The lobby: before launch, players who've made their character wait here. It shows them their character, their
// place on the waitlist, a countdown if the owner has set a date, everyone else waiting right now (with a button to
// add them as a friend) and their invite link, and it turns into "the gates are open" the moment the owner opens the game.
import './lobby.css';
import { L, getLang, setLang, onLangChange, type Lang } from '../i18n';
import { drawCharacter } from '../art/character';
import { sfx } from '../audio';
import type { SaveData } from '../save';
import { LOBBY_CHAT_MAX, gameStatus, joinLobby, mustWait, type GameStatus, type LobbyMember } from '../net/launch';
import { mountLobbyBackdrop } from './lobbyBg';
import { inviteUrl, listFriends, myInviteCode, requestFriend, respondFriend, setMyName, type Friend } from '../net/friends';

interface LobbyOpts {
  save: SaveData;
  userId: string;
  status: GameStatus;
  /** the game is open: walk onto campus */
  onEnter: () => void;
  /** make a different character instead */
  onNewCharacter: () => void;
  onSignOut: () => void;
}

const T = (tr: string, en: string) => L({ tr, en });
/** how often the lobby asks again, besides the owner's nudge */
const RECHECK_MS = 60_000;
/** how many of the others waiting are drawn (the rest are counted) */
const SHOW_OTHERS = 24;
const esc = (x: string) => x.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

export function mountLobby(host: HTMLElement, o: LobbyOpts): () => void {
  let status = o.status;
  /** everyone else waiting in the lobby right now */
  let others: LobbyMember[] = [];
  /** your friends and requests (null: not loaded, or the friends tables aren't set up) */
  let friendList: Friend[] | null = null;
  /** players whose friend button is busy, and what went wrong last */
  const busy = new Set<string>();
  let friendError = '';
  let link = '';
  let copied = false;
  let open = !mustWait(status);
  const ch = o.save.character;

  const el = document.createElement('div');
  el.className = 'title-screen lobby-screen';
  // the card: a part that's redrawn as things change, the chat (built once, so typing and scrolling survive), the footer
  el.innerHTML = `<div class="card title-card lobby-card"><div class="lobby-dyn"></div>
    <div class="lobby-chat"><div class="lc-title"></div><div class="lc-log" role="log" aria-live="polite"></div>
      <form class="lc-form"><input maxlength="${LOBBY_CHAT_MAX}" autocomplete="off" enterkeyhint="send"><button type="submit" class="primary"></button></form>
      <div class="lc-note"></div></div>
    <div class="lobby-tail"></div></div>`;
  host.appendChild(el);
  const card = el.querySelector('.lobby-card') as HTMLElement;
  const dyn = el.querySelector('.lobby-dyn') as HTMLElement;
  const tail = el.querySelector('.lobby-tail') as HTMLElement;
  const chatBox = el.querySelector('.lobby-chat') as HTMLElement;
  const chatLog = el.querySelector('.lc-log') as HTMLElement;
  const chatInput = el.querySelector('.lc-form input') as HTMLInputElement;
  const removeBackdrop = mountLobbyBackdrop(el);

  const countdown = (): string => {
    if (!status.opensAt) return '';
    const ms = new Date(status.opensAt).getTime() - Date.now();
    if (!(ms > 0)) return T('Her an açılabilir…', 'Any moment now…');
    const d = Math.floor(ms / 86_400_000), h = Math.floor(ms / 3_600_000) % 24, m = Math.floor(ms / 60_000) % 60, s = Math.floor(ms / 1000) % 60;
    const parts = getLang() === 'tr' ? [d && `${d} gün`, (d || h) && `${h} sa`, `${m} dk`, !d && `${s} sn`] : [d && `${d}d`, (d || h) && `${h}h`, `${m}m`, !d && `${s}s`];
    return T(`Açılmasına ${parts.filter(Boolean).join(' ')}`, `Opens in ${parts.filter(Boolean).join(' ')}`);
  };

  const render = () => {
    card.classList.toggle('is-open', open);
    dyn.innerHTML = `
        <h1>Daçka</h1>
        <div class="sub">${open ? T('Kapılar açıldı!', 'The gates are open!') : T('Çok yakında açılıyor', 'Opening very soon')}</div>
        <div class="lobby-kid"><canvas width="128" height="128"></canvas><div class="lobby-shadow"></div></div>
        <div class="lobby-name"></div>
        ${open
          ? `<p class="lobby-line">${T('Bavulun hazır, kapıda biri seni bekliyor. Kayıt hafta sonu başlıyor!', 'Your suitcase is packed and someone is waiting at the gate. Registration weekend begins!')}</p>
             <button type="button" class="primary lobby-enter" data-act="enter">🎒 ${T('Okula gir', 'Walk in')}</button>`
          : `<div class="lobby-place">${status.position ? `<b>#${status.position}</b><span>${T(`${status.total} kişilik bekleme listesinde`, `on a waitlist of ${status.total}`)}</span>` : `<span>${T('Bekleme listesindesin', "You're on the waitlist")}</span>`}</div>
             ${status.opensAt ? `<div class="lobby-count" data-countdown></div>` : ''}
             <p class="lobby-line">${T('Karakterin hazır. Okul açılınca buradan doğrudan kayıt hafta sonuna gireceksin. Sayfayı açık bırakabilir ya da sonra gelebilirsin.', "Your character is ready. When the school opens you'll go straight from here into registration weekend. Leave this page open or come back later.")}</p>
             ${othersHtml()}
             <div class="lobby-invite">
               <div class="li-title">${friendNames().length ? esc(T(`Listedeki arkadaşların: ${friendNames().join(', ')}`, `Your friends on the list: ${friendNames().join(', ')}`)) : T('Arkadaşlarını davet et: açılışta birlikte başlayın', 'Invite your friends: start together on opening day')}</div>
               ${link ? `<div class="li-row"><input readonly value=""><button type="button" class="secondary" data-act="copy">${copied ? T('Kopyalandı ✓', 'Copied ✓') : T('Kopyala', 'Copy')}</button></div>` : ''}
             </div>`}`;
    tail.innerHTML = `
        <div class="lobby-foot">
          ${open ? '' : `<button type="button" class="linkish" data-act="new">${T('Karakterini değiştir', 'Change your character')}</button> · `}
          <button type="button" class="linkish" data-act="signout">${T('Çıkış', 'Sign out')}</button>
        </div>
        <div class="lang">
          <button data-lang="tr" class="${getLang() === 'tr' ? 'on' : ''}">Türkçe</button> ·
          <button data-lang="en" class="${getLang() === 'en' ? 'on' : ''}">English</button>
        </div>`;
    // the chat stays as it is; only its words follow the language, and it goes once the gates open
    chatBox.hidden = open;
    (chatBox.querySelector('.lc-title') as HTMLElement).textContent = T('💬 Lobi sohbeti', '💬 Lobby chat');
    chatInput.placeholder = T('Lobidekilere bir şey yaz…', 'Say something to everyone here…');
    (chatBox.querySelector('.lc-form button') as HTMLElement).textContent = T('Gönder', 'Send');
    if (!chatNote) (chatBox.querySelector('.lc-note') as HTMLElement).textContent = T('Yalnızca şu an lobide olanlar görür; hiçbir yere kaydedilmez.', "Only people in the lobby right now see it; it isn't saved anywhere.");
    el.querySelector('.lobby-name')!.textContent = `${ch.first} ${ch.last}`;
    const input = el.querySelector('.li-row input') as HTMLInputElement | null;
    if (input) input.value = link;
    // the others, drawn once each (only you move)
    el.querySelectorAll<HTMLCanvasElement>('.lo-kid canvas').forEach((cv) => {
      const m = others.find((x) => x.id === cv.dataset.id);
      if (!m) return;
      const c = cv.getContext('2d')!;
      c.save(); c.scale(2, 2);
      drawCharacter(c, 0, 0, m.look, 0, 0);
      c.restore();
    });
    tickCountdown();
  };

  const friendNames = () => (friendList ?? []).filter((f) => f.status === 'accepted').map((f) => f.name).filter(Boolean);
  const relation = (id: string): 'friends' | 'sent' | 'incoming' | 'none' => {
    const f = friendList?.find((x) => x.id === id);
    return !f ? 'none' : f.status === 'accepted' ? 'friends' : f.incoming ? 'incoming' : 'sent';
  };

  /** everyone else waiting, each with their character, name and a friend button */
  const othersHtml = () => {
    if (!others.length) return `<div class="lobby-now">${T('👥 Lobide şimdilik yalnızsın', "👥 You're alone in the lobby for now")}</div>`;
    const shown = others.slice(0, SHOW_OTHERS);
    const more = others.length - shown.length;
    const button = (m: LobbyMember) => {
      if (!friendList) return '';
      const r = relation(m.id);
      const wait = busy.has(m.id) ? ' disabled' : '';
      if (r === 'friends') return `<span class="lo-tag">⭐ ${T('Arkadaşsınız', 'Friends')}</span>`;
      if (r === 'sent') return `<span class="lo-tag">${T('İstek gönderildi', 'Request sent')}</span>`;
      if (r === 'incoming') return `<button type="button" class="primary lo-btn" data-act="friend" data-id="${esc(m.id)}"${wait}>🤝 ${T('Kabul et', 'Accept')}</button>`;
      return `<button type="button" class="secondary lo-btn" data-act="friend" data-id="${esc(m.id)}" title="${T('Arkadaş ekle', 'Add friend')}"${wait}>+ ${T('Arkadaş', 'Add friend')}</button>`;
    };
    return `<div class="lobby-others">
      <div class="lo-title">👥 ${T(`Şu an lobide bekleyenler (${others.length + 1} kişi, sen dahil)`, `Waiting in the lobby right now (${others.length + 1}, you included)`)}</div>
      <div class="lo-grid">${shown.map((m) => `
        <div class="lo-card">
          <div class="lo-kid"><canvas width="64" height="64" data-id="${esc(m.id)}"></canvas></div>
          <div class="lo-name">${esc(m.name || '?')}</div>
          ${button(m)}
        </div>`).join('')}</div>
      ${more > 0 ? `<div class="lo-more">${T(`ve ${more} kişi daha`, `and ${more} more`)}</div>` : ''}
      ${friendError ? `<div class="lo-err">${esc(friendError)}</div>` : ''}
    </div>`;
  };

  // ---------- lobby chat ----------
  let chatNote = '';
  let lastSent = 0;
  const addLine = (name: string, text: string, mine: boolean) => {
    const atBottom = chatLog.scrollTop + chatLog.clientHeight >= chatLog.scrollHeight - 8;
    const line = document.createElement('div');
    line.className = `lc-line${mine ? ' mine' : ''}`;
    const b = document.createElement('b');
    b.textContent = `${name || '?'}: `;
    line.append(b, document.createTextNode(text));
    chatLog.appendChild(line);
    while (chatLog.children.length > 60) chatLog.firstElementChild?.remove();
    if (atBottom || mine) chatLog.scrollTop = chatLog.scrollHeight;
  };
  const setNote = (text: string) => {
    chatNote = text;
    (chatBox.querySelector('.lc-note') as HTMLElement).textContent = text;
    if (text) window.setTimeout(() => { if (chatNote === text) { chatNote = ''; render(); } }, 2500);
  };
  (chatBox.querySelector('.lc-form') as HTMLFormElement).addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim().slice(0, LOBBY_CHAT_MAX);
    if (!text) return;
    // one message every second and a bit: enough to talk, not enough to flood
    if (Date.now() - lastSent < 1200) { setNote(T('Biraz yavaş: bir saniye bekle.', 'A bit slower: wait a second.')); return; }
    lastSent = Date.now();
    lobby.chat(text);
    addLine(ch.first, text, true);
    chatInput.value = '';
  });

  const loadFriends = async () => {
    const f = await listFriends();
    if (f) friendList = f;
    if (el.isConnected && !open) render();
  };

  /** add as a friend, or accept their request; they hear about it on the lobby channel */
  const befriend = async (id: string) => {
    const r = relation(id);
    if (busy.has(id) || r === 'friends' || r === 'sent') return;
    busy.add(id);
    friendError = '';
    render();
    let ok = true;
    if (r === 'incoming') ok = await respondFriend(id, true);
    else {
      const res = await requestFriend(id);
      ok = res === 'requested' || res === 'accepted' || res === 'pending' || res === 'already';
      if (res === 'limit') friendError = T('Çok fazla bekleyen isteğin var. Önce cevap gelsin.', 'You have too many requests waiting. Wait for some answers first.');
    }
    if (ok) lobby.nudgeFriend(id);
    else if (!friendError) friendError = T('İstek gönderilemedi. Biraz sonra tekrar dene.', "Couldn't send the request. Try again in a bit.");
    busy.delete(id);
    await loadFriends();
  };

  // the character, in the uniform, now and then looking about
  let raf = 0;
  const drawKid = (now: number) => {
    const cv = el.querySelector('.lobby-kid canvas') as HTMLCanvasElement | null;
    if (cv) {
      const c = cv.getContext('2d')!;
      c.clearRect(0, 0, 128, 128);
      c.save();
      c.scale(4, 4);
      const phase = Math.floor(now / 2400) % 6;
      const dir = phase === 2 ? 1 : phase === 4 ? 2 : 0;
      drawCharacter(c, 0, 0, ch.look, dir, 0, { blink: now % 3800 < 140 });
      c.restore();
    }
    raf = requestAnimationFrame(drawKid);
  };

  const tickCountdown = () => {
    const box = el.querySelector('[data-countdown]');
    if (box) box.textContent = countdown();
  };

  const recheck = async () => {
    const s = await gameStatus();
    if (!s) return;
    const wasOpen = open;
    status = s;
    open = !mustWait(s);
    if (open && !wasOpen) sfx.success();
    render();
  };

  el.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    const lang = target.dataset.lang as Lang | undefined;
    if (lang) { setLang(lang); return; }
    const act = target.dataset.act;
    if (act === 'enter') { leave(); o.onEnter(); }
    else if (act === 'new') { leave(); o.onNewCharacter(); }
    else if (act === 'signout') { leave(); o.onSignOut(); }
    else if (act === 'friend' && target.dataset.id) void befriend(target.dataset.id);
    else if (act === 'copy' && link) {
      try { await navigator.clipboard.writeText(link); copied = true; } catch { (el.querySelector('.li-row input') as HTMLInputElement | null)?.select(); }
      render();
    }
  });

  // (the language listener stays registered after leaving, so it checks the lobby is still there)
  onLangChange(() => { if (el.isConnected) render(); });
  const lobby = joinLobby({ id: o.userId, name: ch.first, look: ch.look }, {
    onNudge: () => void recheck(),
    onMembers: (m) => { others = m.filter((x) => x.id !== o.userId); if (!open) render(); },
    // someone added you or accepted you: look at the list again
    onFriend: () => void loadFriends(),
    // (the name shown is the one they're sharing in the lobby, when they're still here)
    onChat: (from, name, text) => { if (from !== o.userId) addLine(others.find((m) => m.id === from)?.name || name, text, false); },
  });
  const timers = [window.setInterval(() => void recheck(), RECHECK_MS), window.setInterval(tickCountdown, 1000)];
  // friends on the list and your invite link (both optional: the friends tables may not be set up)
  // (your name in other players' friends lists is your character's first name)
  void setMyName(ch.first).catch(() => {}).finally(() => void loadFriends());
  void myInviteCode().then((code) => { if (code) { link = inviteUrl(code); render(); } });

  function leave() {
    cancelAnimationFrame(raf);
    timers.forEach((t) => window.clearInterval(t));
    lobby.leave();
    removeBackdrop();
    el.remove();
  }

  // development only (left out of the real game): show made-up players and friends, to see the lobby without a server
  if (import.meta.env.DEV) Object.assign(el, { lobbyTest: { others: (m: LobbyMember[]) => { others = m; render(); }, friends: (f: Friend[]) => { friendList = f; render(); }, chat: (name: string, text: string) => addLine(name, text, false) } });

  render();
  raf = requestAnimationFrame(drawKid);
  return leave;
}

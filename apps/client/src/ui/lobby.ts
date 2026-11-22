// The lobby: before launch, players who've made their character wait here. It shows them their character, their
// place on the waitlist, a countdown if the owner has set a date, who else is waiting and their invite link, and it
// turns into "the gates are open" the moment the owner opens the game.
import './lobby.css';
import { L, getLang, setLang, onLangChange, type Lang } from '../i18n';
import { drawCharacter } from '../art/character';
import { sfx } from '../audio';
import type { SaveData } from '../save';
import { gameStatus, joinLobby, mustWait, type GameStatus } from '../net/launch';
import { inviteUrl, listFriends, myInviteCode } from '../net/friends';

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

export function mountLobby(host: HTMLElement, o: LobbyOpts): () => void {
  let status = o.status;
  let inLobby = 0;
  let friends: string[] | null = null;
  let link = '';
  let copied = false;
  let open = !mustWait(status);
  const ch = o.save.character;

  const el = document.createElement('div');
  el.className = 'title-screen lobby-screen';
  host.appendChild(el);

  const countdown = (): string => {
    if (!status.opensAt) return '';
    const ms = new Date(status.opensAt).getTime() - Date.now();
    if (!(ms > 0)) return T('Her an açılabilir…', 'Any moment now…');
    const d = Math.floor(ms / 86_400_000), h = Math.floor(ms / 3_600_000) % 24, m = Math.floor(ms / 60_000) % 60, s = Math.floor(ms / 1000) % 60;
    const parts = getLang() === 'tr' ? [d && `${d} gün`, (d || h) && `${h} sa`, `${m} dk`, !d && `${s} sn`] : [d && `${d}d`, (d || h) && `${h}h`, `${m}m`, !d && `${s}s`];
    return T(`Açılmasına ${parts.filter(Boolean).join(' ')}`, `Opens in ${parts.filter(Boolean).join(' ')}`);
  };

  const render = () => {
    el.innerHTML = `
      <div class="card title-card lobby-card ${open ? 'is-open' : ''}">
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
             <div class="lobby-now">${inLobby > 1 ? T(`👥 Şu an lobide ${inLobby} kişi bekliyor`, `👥 ${inLobby} people are waiting in the lobby right now`) : T('👥 Lobide şimdilik yalnızsın', "👥 You're alone in the lobby for now")}</div>
             <div class="lobby-invite">
               <div class="li-title">${friends && friends.length ? T(`Listedeki arkadaşların: ${friends.join(', ')}`, `Your friends on the list: ${friends.join(', ')}`) : T('Arkadaşlarını davet et: açılışta birlikte başlayın', 'Invite your friends: start together on opening day')}</div>
               ${link ? `<div class="li-row"><input readonly value=""><button type="button" class="secondary" data-act="copy">${copied ? T('Kopyalandı ✓', 'Copied ✓') : T('Kopyala', 'Copy')}</button></div>` : ''}
             </div>`}
        <div class="lobby-foot">
          ${open ? '' : `<button type="button" class="linkish" data-act="new">${T('Karakterini değiştir', 'Change your character')}</button> · `}
          <button type="button" class="linkish" data-act="signout">${T('Çıkış', 'Sign out')}</button>
        </div>
        <div class="lang">
          <button data-lang="tr" class="${getLang() === 'tr' ? 'on' : ''}">Türkçe</button> ·
          <button data-lang="en" class="${getLang() === 'en' ? 'on' : ''}">English</button>
        </div>
      </div>`;
    el.querySelector('.lobby-name')!.textContent = `${ch.first} ${ch.last}`;
    const input = el.querySelector('.li-row input') as HTMLInputElement | null;
    if (input) input.value = link;
    tickCountdown();
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
    else if (act === 'copy' && link) {
      try { await navigator.clipboard.writeText(link); copied = true; } catch { (el.querySelector('.li-row input') as HTMLInputElement | null)?.select(); }
      render();
    }
  });

  // (the language listener stays registered after leaving, so it checks the lobby is still there)
  onLangChange(() => { if (el.isConnected) render(); });
  const leaveChannel = joinLobby(o.userId, () => void recheck(), (n) => { inLobby = n; if (!open) render(); });
  const timers = [window.setInterval(() => void recheck(), RECHECK_MS), window.setInterval(tickCountdown, 1000)];
  // friends on the list and your invite link (both optional: the friends tables may not be set up)
  void listFriends().then((f) => { friends = f ? f.filter((x) => x.status === 'accepted').map((x) => x.name).filter(Boolean) : null; render(); });
  void myInviteCode().then((code) => { if (code) { link = inviteUrl(code); render(); } });

  function leave() {
    cancelAnimationFrame(raf);
    timers.forEach((t) => window.clearInterval(t));
    leaveChannel();
    el.remove();
  }

  render();
  raf = requestAnimationFrame(drawKid);
  return leave;
}

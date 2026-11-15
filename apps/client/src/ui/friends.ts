// Friends panel (F, online only): your invite link, friend requests, and your friends (who is on campus right now).
import { L, type Text } from '../i18n';
import { inviteUrl, type Friend } from '../net/friends';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** where a player is, from the room key their position updates carry */
const PLACES: Record<string, Text> = {
  campus: { tr: 'Kampüste', en: 'On campus' },
  dining: { tr: 'Yemekhanede', en: 'In the dining hall' },
  class: { tr: 'Sınıfta', en: 'In class' },
  'dorm-girl': { tr: 'Kız yurdunda', en: "In the girls' dorm" },
  'dorm-boy': { tr: 'Erkek yurdunda', en: "In the boys' dorm" },
  away: { tr: 'Evcide', en: 'Home for the weekend' },
};

export const friendName = (f: { name: string }) => f.name || L({ tr: 'Yeni oyuncu', en: 'New player' });

export interface FriendsCardDeps {
  /** current list (null = friends aren't available: the database isn't set up yet) */
  friends: () => Friend[] | null;
  /** online friends: their room key ('' while it isn't known yet); offline: undefined */
  whereIs: (id: string) => string | undefined;
  inviteCode: (reset: boolean) => Promise<string | null>;
  accept: (f: Friend) => Promise<void>;
  decline: (f: Friend) => Promise<void>;
  /** unfriend or take back a request (asks first) */
  remove: (f: Friend) => Promise<void>;
}

export function friendsCard(d: FriendsCardDeps): { el: HTMLElement; render: () => void } {
  const el = document.createElement('div');
  el.className = 'card missions-card friends-card';
  let code: string | null = null;
  let codeState: 'loading' | 'ready' | 'error' = 'loading';
  let copied = false;
  let busy = false;

  const loadCode = async (reset: boolean) => {
    codeState = 'loading'; render();
    code = await d.inviteCode(reset);
    codeState = code ? 'ready' : 'error';
    render();
  };

  const render = () => {
    const list = d.friends();
    const incoming = list?.filter((f) => f.status === 'pending' && f.incoming) ?? [];
    const outgoing = list?.filter((f) => f.status === 'pending' && !f.incoming) ?? [];
    const friends = (list?.filter((f) => f.status === 'accepted') ?? [])
      .map((f) => ({ f, at: d.whereIs(f.id) }))
      .sort((a, b) => Number(b.at !== undefined) - Number(a.at !== undefined) || friendName(a.f).localeCompare(friendName(b.f)));
    const url = code ? inviteUrl(code) : '';
    const canShare = typeof navigator.share === 'function';
    const row = (f: Friend, status: string, buttons: string, on = false) => `
      <div class="friend-row${on ? ' on' : ''}" data-id="${esc(f.id)}">
        <div class="rel-name"><b>${esc(friendName(f))}</b><span>${status}</span></div>
        <div class="friend-btns">${buttons}</div>
      </div>`;
    el.innerHTML = `
      <div class="panel-head">
        <div><h2>${L({ tr: 'Arkadaşlar', en: 'Friends' })}</h2><div class="modal-sub">${L({ tr: 'Gerçek oyuncular · kampüste adlarının yanında ★ görünür', en: 'Real players · they show with a ★ on campus' })}</div></div>
        <button type="button" class="primary">${L({ tr: 'Kapat', en: 'Close' })}</button>
      </div>
      ${list === null ? `<p class="nav-error" style="margin-top:12px">${L({ tr: 'Arkadaş listesi şu an açılamıyor. Biraz sonra tekrar dene.', en: "Your friends list can't be loaded right now. Try again in a bit." })}</p>` : ''}
      <div class="strength-card" style="margin-top:12px">
        <div class="sc-label">${L({ tr: 'Davet bağlantın', en: 'Your invite link' })}</div>
        <p>${L({ tr: 'Bu bağlantıyı bir arkadaşına gönder. Açıp giriş yapınca arkadaş olursunuz ve kampüste birbirinizi görürsünüz.', en: "Send this link to a friend. When they open it and sign in, you're friends and you'll see each other on campus." })}</p>
        <div class="invite-row">
          <input type="text" readonly aria-label="${L({ tr: 'Davet bağlantısı', en: 'Invite link' })}" value="${esc(codeState === 'ready' ? url : codeState === 'loading' ? L({ tr: 'Hazırlanıyor…', en: 'Getting your link…' }) : L({ tr: 'Bağlantı alınamadı', en: "Couldn't get a link" }))}">
          <button type="button" class="secondary" data-act="copy" ${codeState === 'ready' ? '' : 'disabled'}>${copied ? L({ tr: '✓ Kopyalandı', en: '✓ Copied' }) : L({ tr: 'Kopyala', en: 'Copy' })}</button>
          ${canShare ? `<button type="button" class="secondary" data-act="share" ${codeState === 'ready' ? '' : 'disabled'}>${L({ tr: 'Paylaş', en: 'Share' })}</button>` : ''}
        </div>
        ${codeState === 'error'
          ? `<button type="button" class="linkish" data-act="retry">${L({ tr: 'Tekrar dene', en: 'Try again' })}</button>`
          : `<button type="button" class="linkish" data-act="reset" ${codeState === 'ready' ? '' : 'disabled'}>${L({ tr: 'Yeni bağlantı oluştur (eskisi çalışmaz olur)', en: 'Make a new link (the old one stops working)' })}</button>`}
      </div>
      ${incoming.length ? `<div class="m-section">${L({ tr: 'Arkadaşlık istekleri', en: 'Friend requests' })} (${incoming.length})</div>
        ${incoming.map((f) => row(f, L({ tr: 'Seninle arkadaş olmak istiyor', en: 'Wants to be your friend' }),
          `<button type="button" class="secondary" data-act="accept">${L({ tr: 'Kabul et', en: 'Accept' })}</button><button type="button" class="linkish" data-act="decline">${L({ tr: 'Reddet', en: 'Decline' })}</button>`)).join('')}` : ''}
      <div class="m-section">${L({ tr: 'Arkadaşların', en: 'Your friends' })} (${friends.length})</div>
      ${friends.length
        ? friends.map(({ f, at }) => row(f,
            at === undefined ? L({ tr: 'Çevrimdışı', en: 'Offline' }) : `🟢 ${esc(L(PLACES[at] ?? { tr: 'Çevrimiçi', en: 'Online' }))}`,
            `<button type="button" class="linkish" data-act="remove">${L({ tr: 'Arkadaşlıktan çıkar', en: 'Unfriend' })}</button>`, at !== undefined)).join('')
        : `<p>${L({ tr: 'Henüz gerçek bir arkadaşın yok. Davet bağlantını gönder ya da kampüste bir oyuncunun yanına gidip E\'ye bas.', en: "No friends here yet. Send your invite link, or walk up to a player on campus and press E." })}</p>`}
      ${outgoing.length ? `<div class="m-section">${L({ tr: 'Gönderdiğin istekler', en: 'Requests you sent' })}</div>
        ${outgoing.map((f) => row(f, L({ tr: 'Cevap bekleniyor', en: 'Waiting for an answer' }),
          `<button type="button" class="linkish" data-act="remove">${L({ tr: 'Geri al', en: 'Take back' })}</button>`)).join('')}` : ''}
      <p class="modal-note">${L({ tr: 'Kampüste tanıştığın birini eklemek için yanına git ve E\'ye bas.', en: 'To add someone you meet on campus, walk up to them and press E.' })}</p>`;
    el.querySelectorAll<HTMLButtonElement>('.friend-btns button').forEach((b) => { b.disabled = busy; });
  };

  el.addEventListener('click', async (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-act]');
    if (!b || b.disabled) return;
    const act = b.dataset.act;
    if (act === 'copy' && code) {
      const input = el.querySelector('.invite-row input') as HTMLInputElement;
      try { await navigator.clipboard.writeText(inviteUrl(code)); } catch { input.select(); document.execCommand('copy'); }
      copied = true; render();
      setTimeout(() => { copied = false; if (el.isConnected) render(); }, 2000);
      return;
    }
    if (act === 'share' && code) {
      try {
        await navigator.share({ title: 'Daçka', text: L({ tr: 'Daçka\'da benimle oyna! Bu bağlantıyla arkadaş oluruz:', en: 'Play Daçka with me! This link makes us friends:' }), url: inviteUrl(code) });
      } catch { /* closed the share sheet */ }
      return;
    }
    if (act === 'retry') { void loadCode(false); return; }
    if (act === 'reset') { void loadCode(true); return; }
    const id = b.closest<HTMLElement>('.friend-row')?.dataset.id;
    const f = d.friends()?.find((x) => x.id === id);
    if (!f) return;
    busy = true; render();
    try {
      if (act === 'accept') await d.accept(f);
      else if (act === 'decline') await d.decline(f);
      else if (act === 'remove') await d.remove(f);
    } finally { busy = false; if (el.isConnected) render(); }
  });
  // select the whole link on click, so it's easy to copy by hand too
  el.addEventListener('focusin', (e) => { if ((e.target as HTMLElement).matches('.invite-row input')) (e.target as HTMLInputElement).select(); });

  render();
  void loadCode(false);
  return { el, render };
}

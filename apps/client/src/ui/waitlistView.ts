// For the game's owner: everyone on the waitlist, in order: their character's name, their email, when they joined,
// and whether they're in the lobby right now. Search, show only those in the lobby, copy all the emails.
import './lobby.css';
import { L } from '../i18n';
import { listWaitlist, watchLobby, type WaitlistEntry } from '../net/launch';

const T = (tr: string, en: string) => L({ tr, en });
const esc = (x: string) => x.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

/** "3 days ago", "just now" */
function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return T('az önce', 'just now');
  if (s < 3600) return T(`${Math.round(s / 60)} dk önce`, `${Math.round(s / 60)} min ago`);
  if (s < 86_400) return T(`${Math.round(s / 3600)} sa önce`, `${Math.round(s / 3600)} h ago`);
  return T(`${Math.round(s / 86_400)} gün önce`, `${Math.round(s / 86_400)} days ago`);
}

export function openWaitlist() {
  let rows: WaitlistEntry[] | null = null;
  let failed = false;
  let online = new Set<string>();
  let query = '';
  let onlyLobby = false;
  let copied = false;

  const wrap = document.createElement('div');
  wrap.className = 'overlay waitlist-overlay';
  wrap.innerHTML = `<div class="card modal-card waitlist-card" role="dialog" aria-modal="true">
    <div class="wl-head"><h2></h2><button type="button" class="linkish" data-act="close"></button></div>
    <div class="wl-sub"></div>
    <div class="wl-tools"><input type="search" autocomplete="off"><label><input type="checkbox" data-act="lobby"> <span></span></label><button type="button" class="secondary" data-act="copy"></button></div>
    <div class="wl-list"></div></div>`;
  document.body.appendChild(wrap);
  const search = wrap.querySelector('input[type=search]') as HTMLInputElement;

  const render = () => {
    (wrap.querySelector('h2') as HTMLElement).textContent = T(`⏳ Bekleme listesi${rows ? ` (${rows.length})` : ''}`, `⏳ Waitlist${rows ? ` (${rows.length})` : ''}`);
    (wrap.querySelector('[data-act=close]') as HTMLElement).textContent = T('Kapat', 'Close');
    const inLobby = rows ? rows.filter((r) => online.has(r.id)).length : 0;
    (wrap.querySelector('.wl-sub') as HTMLElement).textContent = rows ? T(`🟢 Şu an lobide ${inLobby} kişi`, `🟢 ${inLobby} in the lobby right now`) : '';
    search.placeholder = T('İsim ya da e-posta ara', 'Search name or email');
    (wrap.querySelector('label span') as HTMLElement).textContent = T('Sadece lobidekiler', 'Only those in the lobby');
    (wrap.querySelector('[data-act=copy]') as HTMLElement).textContent = copied ? T('Kopyalandı ✓', 'Copied ✓') : T('E-postaları kopyala', 'Copy emails');
    const list = wrap.querySelector('.wl-list') as HTMLElement;
    if (failed) { list.innerHTML = `<div class="wl-empty">${T('Liste alınamadı. supabase/schema.sql son hâliyle çalıştırıldı mı?', "Couldn't fetch the list. Has the latest supabase/schema.sql been run?")}</div>`; return; }
    if (!rows) { list.innerHTML = `<div class="wl-empty">${T('Yükleniyor…', 'Loading…')}</div>`; return; }
    const q = query.trim().toLocaleLowerCase('tr-TR');
    const shown = rows.filter((r) => (!onlyLobby || online.has(r.id)) && (!q || r.name.toLocaleLowerCase('tr-TR').includes(q) || r.email.toLowerCase().includes(q)));
    if (!shown.length) { list.innerHTML = `<div class="wl-empty">${rows.length ? T('Eşleşen kimse yok.', 'Nobody matches.') : T('Henüz kimse bekleme listesinde değil.', 'Nobody is on the waitlist yet.')}</div>`; return; }
    list.innerHTML = shown.map((r) => `
      <div class="wl-row">
        <span class="wl-pos">#${r.pos}</span>
        <span class="wl-who"><b>${esc(r.name || T('(isimsiz)', '(no name)'))}</b><small>${esc(r.email)}</small></span>
        <span class="wl-when">${online.has(r.id) ? `<i class="wl-on">● ${T('lobide', 'in lobby')}</i>` : ''}<small>${esc(ago(r.joinedAt))}</small></span>
      </div>`).join('');
  };

  const stopWatching = watchLobby((ids) => { online = ids; render(); });
  const close = () => { stopWatching(); window.removeEventListener('keydown', onKey, true); wrap.remove(); };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  window.addEventListener('keydown', onKey, true);
  wrap.addEventListener('click', async (e) => {
    const t = e.target as HTMLElement;
    if (t === wrap || t.dataset.act === 'close') { close(); return; }
    if (t.dataset.act === 'lobby') { onlyLobby = (t as HTMLInputElement).checked; render(); return; }
    if (t.dataset.act === 'copy' && rows) {
      const emails = rows.map((r) => r.email).filter(Boolean).join(', ');
      try { await navigator.clipboard.writeText(emails); copied = true; render(); } catch { /* clipboard blocked: nothing to do */ }
    }
  });
  search.addEventListener('input', () => { query = search.value; render(); });

  render();
  void listWaitlist().then((r) => { rows = r; failed = !r; render(); });
  // development only (left out of the real game): fill it with made-up rows to see it without a server
  if (import.meta.env.DEV) Object.assign(wrap, { waitlistTest: (r: WaitlistEntry[], ids: string[]) => { rows = r; failed = false; online = new Set(ids); render(); } });
}

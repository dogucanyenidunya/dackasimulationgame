// Relationships panel (R): a bar for everyone you know, your friend group and its rivals.
import { L } from '../i18n';
import { BELLETMENS, GROUPS, NPCS, friendLevel } from '../content/npcs';
import { groupLabel, myGroup } from '../game/social';
import { FRIEND_AT, type PlayerState } from '../game/state';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function bar(v: number): string {
  // -100…100 → a centred bar: red to the left, blue to the right
  const w = Math.min(50, Math.abs(v) / 2);
  return `<div class="rel-bar"><span class="mid"></span><i class="${v < 0 ? 'neg' : 'pos'}" style="${v < 0 ? `right:50%` : `left:50%`};width:${w}%"></i></div>`;
}

export function relationshipsCard(st: PlayerState, classDrawn: boolean, onRename: (name: string) => void): HTMLElement {
  const el = document.createElement('div');
  el.className = 'card missions-card rel-card';
  const gid = myGroup(st);
  const group = GROUPS.find((g) => g.id === gid);
  const rival = group ? GROUPS.find((g) => g.id === group.rival) : undefined;
  const known = [...NPCS, ...BELLETMENS].filter((n) => st.friends[n.id] !== undefined || (classDrawn && n.kind === 'classmate'));
  const members = (id: string) => NPCS.filter((n) => n.group === id && (st.friends[n.id] ?? 0) >= FRIEND_AT).map((n) => n.name).join(', ');
  const sorted = [...known].sort((a, b) => (st.friends[b.id] ?? 0) - (st.friends[a.id] ?? 0));
  const row = (id: string) => {
    const n = [...NPCS, ...BELLETMENS].find((x) => x.id === id)!;
    const v = Math.round(st.friends[id] ?? 0);
    const g = GROUPS.find((x) => x.id === n.group);
    return `<div class="rel-row ${v <= -15 ? 'bad' : v >= FRIEND_AT ? 'good' : ''}">
      <div class="rel-name"><b>${n.kind === 'classmate' ? '★ ' : ''}${esc(n.name)}</b><span>${esc(L(n.role))}${g ? ` · ${esc(groupLabel(g.id, st))}` : ''}</span></div>
      ${bar(v)}
      <div class="rel-level">${esc(L(friendLevel(v)))} <b>${v}</b></div>
    </div>`;
  };
  const groupCounts = GROUPS.map((g) => {
    const members = NPCS.filter((n) => n.group === g.id);
    const friends = members.filter((n) => (st.friends[n.id] ?? 0) >= FRIEND_AT).length;
    return `<div class="sum-row"><span>${esc(groupLabel(g.id, st))}${g.id === gid ? ` <small>· ${L({ tr: 'senin grubun', en: 'your group' })}</small>` : g.id === group?.rival ? ` <small>· ${L({ tr: 'rakip', en: 'rivals' })}</small>` : ''}</span><b>${friends}/${members.length}</b></div>`;
  }).join('');
  el.innerHTML = `
    <div class="panel-head">
      <div><h2>${L({ tr: 'İlişkiler', en: 'Relationships' })}</h2><div class="modal-sub">${L({ tr: '★ = sınıf arkadaşın · arkadaşlık 40\'tan başlar · −15 altı seni sevmez', en: "★ = classmate · friends from 40 · below −15 they don't like you" })}</div></div>
      <button type="button" class="primary">${L({ tr: 'Kapat', en: 'Close' })}</button>
    </div>
    <div class="strength-card" style="margin-top:12px">
      <div class="sc-label">${L({ tr: 'Grubun', en: 'Your group' })}</div>
      ${group
        ? `<div class="sc-name">${esc(st.groupName || L({ tr: 'İsimsiz grup', en: 'Unnamed group' }))}</div>
           <p>${esc(members(group.id))}</p>
           <p>${L({ tr: 'Grubundakilerle arkadaşlığın %25 daha hızlı gelişir ve seni kötü sürprizlere karşı korurlar.', en: 'Friendships with your group grow 25% faster, and they protect you from nasty surprises.' })}</p>
           <div class="rename"><input type="text" maxlength="20" placeholder="${L({ tr: 'Grubuna bir isim ver (isteğe bağlı)', en: 'Name your group (optional)' })}" value="${esc(st.groupName ?? '')}"><button type="button" class="secondary save-name">${L({ tr: 'Kaydet', en: 'Save' })}</button></div>
           <div class="sc-keep">⚔ ${L({ tr: 'Rakip grup', en: 'Rival group' })}: <b>${esc(groupLabel(rival!.id, st))}</b></div>`
        : `<p>${L({ tr: 'Henüz bir grubun yok. Aynı arkadaş grubundan en az 2 kişiyle arkadaş olunca o gruba katılırsın.', en: "You don't have a group yet. Become friends with at least 2 people from the same circle to join it." })}</p>`}
    </div>
    <div class="m-section">${L({ tr: 'Gruplardaki arkadaşların', en: 'Your friends in each group' })}</div>
    ${groupCounts}
    <div class="m-section">${L({ tr: 'Tanıdığın herkes', en: 'Everyone you know' })} (${sorted.length})</div>
    ${sorted.length ? sorted.map((n) => row(n.id)).join('') : `<p>${L({ tr: 'Henüz kimseyle tanışmadın.', en: "You haven't met anyone yet." })}</p>`}`;
  el.querySelector('.save-name')?.addEventListener('click', () => {
    const v = (el.querySelector('.rename input') as HTMLInputElement).value.trim().slice(0, 20);
    onRename(v);
    (el.querySelector('.sc-name') as HTMLElement).textContent = v || L({ tr: 'İsimsiz grup', en: 'Unnamed group' });
  });
  // typing in the name field shouldn't trigger game hotkeys
  el.querySelector('.rename input')?.addEventListener('keydown', (e) => e.stopPropagation());
  return el;
}

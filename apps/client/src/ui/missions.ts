// Mission panel (J), "new mission" announcement card and the tracker under the minimap.
import { L } from '../i18n';
import {
  MISSIONS, missionById, nextObjective, statusOf, trackedMission, type Mission, type MissionCtx, type MissionStatus,
} from '../game/missions';
import { NPCS, dativeTr, genitiveTr } from '../content/npcs';
import { LOCATIONS } from '../content/campus';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const BADGE: Record<MissionStatus, { tr: string; en: string }> = {
  locked: { tr: '🔒 Kilitli', en: '🔒 Locked' },
  active: { tr: '▶ Aktif', en: '▶ Active' },
  done: { tr: '✓ Tamamlandı', en: '✓ Done' },
  failed: { tr: '✕ Başarısız', en: '✕ Failed' },
};

function objectivesHtml(m: Mission, c: MissionCtx): string {
  return `<ul class="m-obj">${m.objectives.map((o) => {
    const ok = o.done(c);
    return `<li class="${ok ? 'ok' : ''}">${ok ? '☑' : '☐'} ${esc(L(o.text))}${o.progress ? `<span class="prog">${esc(o.progress(c))}</span>` : ''}</li>`;
  }).join('')}</ul>`;
}

const giverName = (m: Mission) => NPCS.find((n) => n.id === m.giver)?.name ?? '';

function missionHtml(m: Mission, c: MissionCtx): string {
  const s = statusOf(m, c);
  const taken = c.st.side.taken.includes(m.id);
  const req = m.kind === 'side'
    ? `<div class="m-req"><b>${L({ tr: 'Veren', en: 'From' })}:</b> ${esc(giverName(m))}${m.giverAt ? ` · ${esc(L(m.giverAt))}` : ''} · ${taken ? L({ tr: '✅ görevi aldın', en: '✅ you took it' }) : L({ tr: 'yanına git ve görevi al', en: 'go and take the quest' })}</div>`
    : m.requires.length
    ? `<div class="m-req"><b>${L({ tr: 'Gerekli', en: 'Requires' })}:</b> ${m.requires.map((r) => {
        const ok = statusOf(missionById(r), c) === 'done';
        return `${ok ? '✅' : '⬜'} ${esc(L(missionById(r).title))}`;
      }).join(' · ')}</div>`
    : `<div class="m-req"><b>${L({ tr: 'Gerekli', en: 'Requires' })}:</b> ${L({ tr: 'yok, hemen başlayabilirsin', en: 'nothing, you can start right away' })}</div>`;
  const reward = `<div class="m-reward"><b>${L({ tr: 'Ödül', en: 'Reward' })}:</b> ${m.reward.xp ? `+${m.reward.xp} XP` : ''}${m.reward.text ? `${m.reward.xp ? ' · ' : ''}${esc(L(m.reward.text))}` : ''}${!m.reward.xp && !m.reward.text ? L({ tr: 'Karne ve bir sonraki yıl', en: 'Your report card and the next year' }) : ''}</div>`;
  return `
    <div class="mission ${s}">
      <div class="m-head"><span class="m-title">${esc(L(m.title))}</span><span class="m-badge">${L(badgeOf(m, s))}</span></div>
      <div class="m-desc">${esc(L(m.desc))}</div>
      ${req}
      ${objectivesHtml(m, c)}
      ${m.unlocks ? `<div class="m-unlocks"><b>${L({ tr: 'Açar', en: 'Unlocks' })}:</b> ${esc(L(m.unlocks))}</div>` : ''}
      ${reward}
    </div>`;
}

 /** where an objective is done, by name ("Kütüphane", "Yurt Meydanı"…) */
function placesOf(targets: string[]): string {
  return targets.map((id) => { const l = LOCATIONS.find((x) => x.id === id); return l ? L(l.name) : ''; }).filter(Boolean).join(' / ');
}

/** the jobs you've taken on and haven't finished: side quests from Kerem Abi / Selin Abla, and a favor for an abi or abla
 *  (each with what to do next and where); a click shows the mission it belongs to */
function takenHtml(c: MissionCtx): string {
  const rows: string[] = [];
  const row = (id: string, who: string, what: string, next: string, where: string) => rows.push(`
    <button type="button" class="taken-row" data-id="${id}">
      <span class="tk-who">${esc(who)}</span>
      <span class="tk-what"><b>${esc(what)}</b><span>→ ${esc(next)}${where ? ` · 📍 ${esc(where)}` : ''}</span></span>
    </button>`);
  // a favor for an older student (the book to return, then the sandwich)
  const f = c.st.favor;
  if (f.giver && (f.stage === 'accepted' || f.stage === 'done')) {
    const g = NPCS.find((n) => n.id === f.giver)?.name ?? '';
    row('abi_sandvic', `🤝 ${g}`, L({ tr: `${genitiveTr(g)} ricası: kitap iadesi`, en: `A favor for ${g}: returning a book` }),
      f.stage === 'accepted' ? L({ tr: 'Kitabı Kütüphane\'ye iade et', en: 'Return the book to the library' }) : L({ tr: `${dativeTr(g)} dön ve sandviçini al`, en: `Go back to ${g} for your sandwich` }),
      f.stage === 'accepted' ? placesOf(['kutuphane']) : placesOf(['yurt_meydani']));
  }
  // an errand for an abi or abla (a soda from the canteen)
  const e = c.st.errand;
  if (e.giver && e.stage !== 'none') {
    const g = NPCS.find((n) => n.id === e.giver)?.name ?? '';
    row('', `🏃 ${g}`, L({ tr: `${genitiveTr(g)} ayak işi: gazoz`, en: `An errand for ${g}: a soda` }),
      e.stage === 'fetch' ? L({ tr: 'Şakir Abi\'nin kantininden gazoz al', en: "Buy a soda at Şakir's canteen" }) : L({ tr: `Gazozu ${dativeTr(g)} götür`, en: `Take the soda to ${g}` }),
      e.stage === 'fetch' ? placesOf(['spor']) : placesOf(['yurt_meydani']));
  }
  // side quests you've taken
  for (const id of c.st.side.taken) {
    const m = MISSIONS.find((x) => x.id === id);
    if (!m || statusOf(m, c) !== 'active') continue;
    const o = nextObjective(m, c);
    row(m.id, `📜 ${giverName(m)}`, L(m.title), o ? L(o.text) : L({ tr: 'Görevi verene dön', en: 'Go back to whoever gave it' }), o?.targets ? placesOf(o.targets(c)) : '');
  }
  return `
    <div class="taken-box">
      <div class="taken-head">${L({ tr: '📌 Üstlendiğin işler', en: '📌 Jobs you have taken on' })}</div>
      ${rows.length ? rows.join('') : `<div class="taken-empty">${L({ tr: 'Şu an üstlendiğin bir iş yok. Kerem Abi (Erkek Yurdu önü) ve Selin Abla (Kız Yurdu önü) yan görev verir; Yurt Meydanı\'ndaki öteki abi ve ablalara "Yardım teklif et" diyebilirsin.', en: 'Nothing on your plate right now. Kerem Abi (boys\' dorm door) and Selin Abla (girls\' dorm door) hand out side quests; you can offer to help the other older students on the dorm plaza.' })}</div>`}
    </div>`;
}

const ICON: Record<MissionStatus, string> = { locked: '🔒', active: '▶', done: '✓', failed: '✕' };
/** a side quest you haven't taken yet isn't locked: it's waiting for you at its giver */
const badgeOf = (m: Mission, s: MissionStatus) => (m.kind === 'side' && s === 'locked' ? { tr: '📜 Alınmadı', en: '📜 Not taken' } : BADGE[s]);
const KIND_ORDER: Record<Mission['kind'], number> = { main: 0, challenge: 1, side: 2 };
const COLUMN_NAMES = [
  { tr: 'Başlangıç', en: 'Getting started' }, { tr: 'İlk hafta', en: 'The first week' }, { tr: 'Okula alışmak', en: 'Settling in' },
  { tr: 'Yıl boyunca', en: 'Through the year' }, { tr: 'Yıl sonu', en: 'Year end' },
];

/** how far down the chain a mission sits: 0 with nothing required, else one more than its deepest requirement */
function depthOf(m: Mission, memo = new Map<string, number>()): number {
  const known = memo.get(m.id);
  if (known !== undefined) return known;
  const d = m.requires.length ? 1 + Math.max(...m.requires.map((r) => depthOf(missionById(r), memo))) : 0;
  memo.set(m.id, d);
  return d;
}

/** the missions as a tree: each column is a step further down the chain, lines join a mission to the ones it opens up,
 *  and the one you pick shows its details underneath */
export function missionsCard(c: MissionCtx): HTMLElement {
  const el = document.createElement('div');
  el.className = 'card missions-card tree-card';
  const mains = MISSIONS.filter((m) => m.kind === 'main');
  const done = mains.filter((m) => statusOf(m, c) === 'done').length;
  const memo = new Map<string, number>();
  const cols: Mission[][] = [];
  // (side quests change every year: only this year's are shown)
  const shown = MISSIONS.filter((m) => m.kind !== 'side' || m.year === c.st.year);
  for (const m of shown) (cols[depthOf(m, memo)] ??= []).push(m);
  // challenges and then side quests sit at the bottom of their column
  cols.forEach((col) => col.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]));
  const node = (m: Mission) => {
    const st = statusOf(m, c);
    const icon = m.kind === 'side' && st === 'locked' ? '📜' : ICON[st];
    const ok = m.objectives.filter((o) => o.done(c)).length;
    // (a mission with one counted objective shows the count itself: 6/16 rather than 0/1)
    const one = m.objectives.length === 1 ? m.objectives[0].progress?.(c) : undefined;
    return `<button type="button" class="tnode ${st} ${m.kind}" data-id="${m.id}">
      <span class="tn-icon">${icon}</span>
      <span class="tn-text"><b>${esc(L(m.title))}</b><span>${m.kind === 'challenge' ? `⚑ ${L({ tr: 'Meydan okuma', en: 'Challenge' })} · ` : m.kind === 'side' ? `✦ ${L({ tr: 'Yan görev', en: 'Side quest' })} · ` : ''}${one ?? `${ok}/${m.objectives.length}`}${m.reward.xp ? ` · +${m.reward.xp} XP` : ''}</span></span>
    </button>`;
  };
  el.innerHTML = `
    <div class="panel-head">
      <div><h2>${L({ tr: 'Görevler', en: 'Missions' })}</h2><div class="modal-sub">${L({ tr: '1. yıl · 4. sınıf', en: 'Year 1 · Grade 4' })} · ${done}/${mains.length} ${L({ tr: 'ana görev tamamlandı', en: 'main missions done' })} · ${L({ tr: 'bir göreve tıkla', en: 'click a mission' })}</div></div>
      <button type="button" class="primary">${L({ tr: 'Kapat', en: 'Close' })}</button>
    </div>
    ${takenHtml(c)}
    <div class="tree-legend"><span class="done">✓ ${L(BADGE.done).replace(/^\S+\s/, '')}</span><span class="active">▶ ${L(BADGE.active).replace(/^\S+\s/, '')}</span><span class="locked">🔒 ${L(BADGE.locked).replace(/^\S+\s/, '')}</span></div>
    <div class="tree-wrap">
      <svg class="tree-lines" aria-hidden="true"></svg>
      <div class="tree-cols">${cols.map((col, i) => `<div class="tree-col"><div class="tree-col-name">${esc(L(COLUMN_NAMES[i] ?? COLUMN_NAMES[COLUMN_NAMES.length - 1]))}</div><div class="tree-col-nodes">${col.map(node).join('')}</div></div>`).join('')}</div>
    </div>
    <div class="tree-detail"></div>`;
  const detail = el.querySelector('.tree-detail') as HTMLElement;
  const select = (id: string) => {
    el.querySelectorAll('.tnode').forEach((b) => b.classList.toggle('sel', (b as HTMLElement).dataset.id === id));
    detail.innerHTML = missionHtml(missionById(id), c);
    draw();
  };
  el.querySelectorAll<HTMLButtonElement>('.tnode').forEach((b) => b.addEventListener('click', () => select(b.dataset.id!)));
  el.querySelectorAll<HTMLButtonElement>('.taken-row').forEach((b) => b.addEventListener('click', () => {
    if (!b.dataset.id) return; // (an errand isn't a mission in the tree)
    select(b.dataset.id!);
    el.querySelector('.tnode.sel')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }));
  let drawn = false;
  // the connectors: from the right edge of a mission to the left edge of each one it unlocks, coloured by how far you are
  const draw = () => {
    const wrap = el.querySelector('.tree-wrap') as HTMLElement, svg = el.querySelector('.tree-lines') as SVGSVGElement;
    if (!wrap.isConnected) { if (drawn) window.removeEventListener('resize', draw); return; }
    drawn = true;
    const box = wrap.getBoundingClientRect();
    svg.setAttribute('width', String(wrap.scrollWidth)); svg.setAttribute('height', String(wrap.scrollHeight));
    const at = (id: string) => (el.querySelector(`.tnode[data-id="${id}"]`) as HTMLElement).getBoundingClientRect();
    const sel = (el.querySelector('.tnode.sel') as HTMLElement | null)?.dataset.id;
    let paths = '';
    for (const m of MISSIONS) for (const r of m.requires) {
      const a = at(r), b = at(m.id);
      const x1 = a.right - box.left + wrap.scrollLeft, y1 = a.top + a.height / 2 - box.top + wrap.scrollTop;
      const x2 = b.left - box.left + wrap.scrollLeft, y2 = b.top + b.height / 2 - box.top + wrap.scrollTop;
      const mid = (x1 + x2) / 2;
      const from = statusOf(missionById(r), c), to = statusOf(m, c);
      const cls = from === 'done' && to === 'done' ? 'done' : from === 'done' ? 'open' : 'locked';
      const hi = sel && (sel === r || sel === m.id) ? ' hi' : '';
      paths += `<path class="${cls}${hi}" d="M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}"/>`;
    }
    svg.innerHTML = paths;
  };
  const first = (trackedMission(c) ?? MISSIONS.find((m) => statusOf(m, c) === 'active') ?? MISSIONS[0]).id;
  // (wait until the card is on screen to measure where the boxes are)
  const ready = () => (el.isConnected ? select(first) : requestAnimationFrame(ready));
  requestAnimationFrame(ready);
  window.addEventListener('resize', draw);
  return el;
}

export function announceCard(m: Mission, c: MissionCtx): HTMLElement {
  const el = document.createElement('div');
  el.className = 'card announce-card';
  el.innerHTML = `
    <div class="m-label">${L({ tr: 'Yeni görev', en: 'New mission' })}</div>
    <h2>${esc(L(m.title))}</h2>
    <p class="m-desc">${esc(L(m.desc))}</p>
    ${objectivesHtml(m, c)}
    ${m.unlocks ? `<div class="m-unlocks"><b>${L({ tr: 'Açar', en: 'Unlocks' })}:</b> ${esc(L(m.unlocks))}</div>` : ''}
    <div class="announce-btns"><button type="button" class="secondary goto-missions">📋 ${L({ tr: 'Görevlere git', en: 'Go to missions' })}</button><button type="button" class="primary">${L({ tr: 'Tamam', en: 'Got it' })}</button></div>`;
  return el;
}

/** several missions unlocked at once → one card */
export function announceManyCard(ms: Mission[], c: MissionCtx): HTMLElement {
  if (ms.length === 1) return announceCard(ms[0], c);
  const el = document.createElement('div');
  el.className = 'card announce-card many';
  el.innerHTML = `
    <div class="m-label">${L({ tr: `${ms.length} yeni görev açıldı`, en: `${ms.length} new missions unlocked` })}</div>
    <h2>${L({ tr: 'Okul hayatı başlıyor!', en: 'School life begins!' })}</h2>
    <div class="announce-list">${ms.map((m) => `<div class="mission active"><div class="m-title">${esc(L(m.title))}</div><div class="m-desc">${esc(L(m.desc))}</div></div>`).join('')}</div>
    <div class="announce-foot"><p class="m-desc">${L({ tr: 'İstediğin sırayla yapabilirsin. Hepsini Görevler panelinde (J) görebilirsin.', en: 'Do them in any order. See them all in the Missions panel (J).' })}</p><div class="announce-btns"><button type="button" class="secondary goto-missions">📋 ${L({ tr: 'Görevlere git', en: 'Go to missions' })}</button><button type="button" class="primary">${L({ tr: 'Tamam', en: 'Got it' })}</button></div></div>`;
  return el;
}

export function trackerHtml(m: Mission, c: MissionCtx, where: string): string {
  const o = nextObjective(m, c);
  return `
    <span class="tr-label">📋 ${L({ tr: 'Görev', en: 'Mission' })} · J</span>
    <span class="tr-title">${esc(L(m.title))}</span>
    ${o ? `<span class="tr-step">→ ${esc(L(o.text))}${o.progress ? ` <b>${esc(o.progress(c))}</b>` : ''}</span>` : ''}
    ${where ? `<span class="tr-where">📍 ${esc(where)}</span>` : ''}`;
}

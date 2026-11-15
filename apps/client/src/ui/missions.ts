// Mission panel (J), "new mission" announcement card and the tracker under the minimap.
import { L } from '../i18n';
import {
  MISSIONS, missionById, nextObjective, statusOf, trackedMission, type Mission, type MissionCtx, type MissionStatus,
} from '../game/missions';

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

function missionHtml(m: Mission, c: MissionCtx): string {
  const s = statusOf(m, c);
  const req = m.requires.length
    ? `<div class="m-req"><b>${L({ tr: 'Gerekli', en: 'Requires' })}:</b> ${m.requires.map((r) => {
        const ok = statusOf(missionById(r), c) === 'done';
        return `${ok ? '✅' : '⬜'} ${esc(L(missionById(r).title))}`;
      }).join(' · ')}</div>`
    : `<div class="m-req"><b>${L({ tr: 'Gerekli', en: 'Requires' })}:</b> ${L({ tr: 'yok, hemen başlayabilirsin', en: 'nothing, you can start right away' })}</div>`;
  const reward = `<div class="m-reward"><b>${L({ tr: 'Ödül', en: 'Reward' })}:</b> ${m.reward.xp ? `+${m.reward.xp} XP` : ''}${m.reward.text ? `${m.reward.xp ? ' · ' : ''}${esc(L(m.reward.text))}` : ''}${!m.reward.xp && !m.reward.text ? L({ tr: 'Karne ve bir sonraki yıl', en: 'Your report card and the next year' }) : ''}</div>`;
  return `
    <div class="mission ${s}">
      <div class="m-head"><span class="m-title">${esc(L(m.title))}</span><span class="m-badge">${L(BADGE[s])}</span></div>
      <div class="m-desc">${esc(L(m.desc))}</div>
      ${req}
      ${objectivesHtml(m, c)}
      ${m.unlocks ? `<div class="m-unlocks"><b>${L({ tr: 'Açar', en: 'Unlocks' })}:</b> ${esc(L(m.unlocks))}</div>` : ''}
      ${reward}
    </div>`;
}

const ICON: Record<MissionStatus, string> = { locked: '🔒', active: '▶', done: '✓', failed: '✕' };
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
  for (const m of MISSIONS) (cols[depthOf(m, memo)] ??= []).push(m);
  // challenges sit at the bottom of their column
  cols.forEach((col) => col.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'challenge' ? 1 : -1)));
  const node = (m: Mission) => {
    const st = statusOf(m, c);
    const ok = m.objectives.filter((o) => o.done(c)).length;
    return `<button type="button" class="tnode ${st} ${m.kind}" data-id="${m.id}">
      <span class="tn-icon">${ICON[st]}</span>
      <span class="tn-text"><b>${esc(L(m.title))}</b><span>${m.kind === 'challenge' ? `⚑ ${L({ tr: 'Meydan okuma', en: 'Challenge' })} · ` : ''}${ok}/${m.objectives.length}${m.reward.xp ? ` · +${m.reward.xp} XP` : ''}</span></span>
    </button>`;
  };
  el.innerHTML = `
    <div class="panel-head">
      <div><h2>${L({ tr: 'Görevler', en: 'Missions' })}</h2><div class="modal-sub">${L({ tr: '1. yıl · 4. sınıf', en: 'Year 1 · Grade 4' })} · ${done}/${mains.length} ${L({ tr: 'ana görev tamamlandı', en: 'main missions done' })} · ${L({ tr: 'bir göreve tıkla', en: 'click a mission' })}</div></div>
      <button type="button" class="primary">${L({ tr: 'Kapat', en: 'Close' })}</button>
    </div>
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
    <div style="margin-top:14px;text-align:right"><button type="button" class="primary">${L({ tr: 'Tamam', en: 'Got it' })}</button></div>`;
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
    <div class="announce-foot"><p class="m-desc">${L({ tr: 'İstediğin sırayla yapabilirsin. Hepsini Görevler panelinde (J) görebilirsin.', en: 'Do them in any order. See them all in the Missions panel (J).' })}</p><button type="button" class="primary">${L({ tr: 'Tamam', en: 'Got it' })}</button></div>`;
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

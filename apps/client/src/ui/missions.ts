// Mission panel (J), "new mission" announcement card and the tracker under the minimap.
import { L } from '../i18n';
import {
  MISSIONS, missionById, nextObjective, statusOf, type Mission, type MissionCtx, type MissionStatus,
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

export function missionsCard(c: MissionCtx): HTMLElement {
  const el = document.createElement('div');
  el.className = 'card missions-card';
  const mains = MISSIONS.filter((m) => m.kind === 'main');
  const challenges = MISSIONS.filter((m) => m.kind === 'challenge');
  const done = mains.filter((m) => statusOf(m, c) === 'done').length;
  el.innerHTML = `
    <div class="panel-head">
      <div><h2>${L({ tr: 'Görevler', en: 'Missions' })}</h2><div class="modal-sub">${L({ tr: '1. yıl · 4. sınıf', en: 'Year 1 · Grade 4' })} · ${done}/${mains.length} ${L({ tr: 'ana görev tamamlandı', en: 'main missions done' })}</div></div>
      <button type="button" class="primary">${L({ tr: 'Kapat', en: 'Close' })}</button>
    </div>
    <div class="m-section">${L({ tr: 'Ana görevler (sırayla açılır)', en: 'Main missions (unlock in order)' })}</div>
    ${mains.map((m) => missionHtml(m, c)).join('')}
    <div class="m-section">${L({ tr: 'Meydan okuma', en: 'Challenge' })}</div>
    ${challenges.map((m) => missionHtml(m, c)).join('')}`;
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
  el.className = 'card announce-card';
  el.innerHTML = `
    <div class="m-label">${L({ tr: `${ms.length} yeni görev açıldı`, en: `${ms.length} new missions unlocked` })}</div>
    <h2>${L({ tr: 'Okul hayatı başlıyor!', en: 'School life begins!' })}</h2>
    ${ms.map((m) => `<div class="mission active" style="margin-top:8px"><div class="m-title">${esc(L(m.title))}</div><div class="m-desc">${esc(L(m.desc))}</div></div>`).join('')}
    <p class="m-desc">${L({ tr: 'İstediğin sırayla yapabilirsin. Hepsini Görevler panelinde (J) görebilirsin.', en: 'Do them in any order. See them all in the Missions panel (J).' })}</p>
    <div style="margin-top:14px;text-align:right"><button type="button" class="primary">${L({ tr: 'Tamam', en: 'Got it' })}</button></div>`;
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

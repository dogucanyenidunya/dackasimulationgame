import { LOCATIONS, MAP_H, MAP_W, T, doorStandTile, type Location } from '../content/campus';
import { L, t, getLang, setLang, onLangChange } from '../i18n';
import { drawCharacter } from '../art/textures';
import { sfx } from '../audio';
import { askConfirm } from './confirm';
import {
  ATTRS, CAUSES, TRAITS, capitalize, keepsakeName, type CharacterData,
} from '../content/character';
import { SUBJECTS, YEAR1_XP, average, behaviorGrade, type PlayerState } from '../game/state';

const TILE_COLORS: Record<number, [number, number, number]> = {
  [T.FOREST]: [47, 107, 69], [T.GROUND]: [231, 227, 218], [T.PATH]: [210, 200, 180], [T.PLAZA]: [183, 214, 160],
  [T.ROOF]: [201, 206, 211], [T.SKYLIGHT]: [159, 182, 201], [T.SOLAR]: [58, 95, 158], [T.GREEN_ROOF]: [127, 180, 102],
  [T.WALL]: [238, 240, 241], [T.DOOR]: [122, 78, 42], [T.COURT_RED]: [168, 72, 62], [T.COURT_BLUE]: [63, 127, 166],
  [T.FENCE]: [90, 95, 99], [T.GATE]: [138, 45, 45], [T.COURTYARD]: [157, 184, 138], [T.DOOR_REVIR]: [192, 57, 43],
};
const FOG_RGB: [number, number, number] = [132, 152, 142];

export interface MapView {
  revealed: Uint8Array;
  seen: Set<string>;
  discovered: Set<string>;
  player: { x: number; y: number };
  /** current mission target, tile coords (drawn as a ring when known) */
  target?: { x: number; y: number } | null;
}

/** where a location's "?" sits: its first door, or the label anchor for zones */
function markerPos(loc: Location): { x: number; y: number } {
  const d = loc.doors?.[0];
  if (d) { const s = doorStandTile(d); return { x: (d.x + s.x) / 2 + 0.5, y: (d.y + s.y) / 2 + 0.5 }; }
  return { x: loc.label?.x ?? loc.rect.x + loc.rect.w / 2, y: loc.label?.y ?? loc.rect.y + loc.rect.h / 2 };
}

class MapCanvas {
  private ctx: CanvasRenderingContext2D;
  private base: ImageData;
  private scratch: HTMLCanvasElement;
  /** zoom 1 = whole map fits; centre in tile coords */
  zoom = 1;
  cx = MAP_W / 2;
  cy = MAP_H / 2;

  constructor(readonly canvas: HTMLCanvasElement, private labels: boolean, map: number[][], w: number, h: number) {
    canvas.width = w;
    canvas.height = h;
    this.ctx = canvas.getContext('2d')!;
    this.scratch = document.createElement('canvas');
    this.scratch.width = MAP_W; this.scratch.height = MAP_H;
    this.base = new ImageData(MAP_W, MAP_H);
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const [r, g, b] = TILE_COLORS[map[y][x]] ?? [255, 0, 255];
      this.base.data.set([r, g, b, 255], (y * MAP_W + x) * 4);
    }
  }

  resize(w: number, h: number) { this.canvas.width = w; this.canvas.height = h; }

  /** screen pixels per tile, and the tile-space offset */
  view() {
    const fit = Math.min(this.canvas.width / MAP_W, this.canvas.height / MAP_H);
    const s = fit * this.zoom;
    const halfW = this.canvas.width / s / 2, halfH = this.canvas.height / s / 2;
    // keep the map inside the frame
    const cx = this.zoom <= 1 ? MAP_W / 2 : Math.min(MAP_W - halfW, Math.max(halfW, this.cx));
    const cy = this.zoom <= 1 ? MAP_H / 2 : Math.min(MAP_H - halfH, Math.max(halfH, this.cy));
    this.cx = cx; this.cy = cy;
    return { s, ox: this.canvas.width / 2 - cx * s, oy: this.canvas.height / 2 - cy * s };
  }

  render(v: MapView) {
    const img = new ImageData(new Uint8ClampedArray(this.base.data), MAP_W, MAP_H);
    for (let i = 0; i < v.revealed.length; i++) if (!v.revealed[i]) img.data.set([...FOG_RGB, 255], i * 4);
    this.scratch.getContext('2d')!.putImageData(img, 0, 0);
    const c = this.ctx;
    const { s, ox, oy } = this.view();
    const X = (tx: number) => ox + tx * s;
    const Y = (ty: number) => oy + ty * s;
    c.imageSmoothingEnabled = false;
    c.fillStyle = `rgb(${FOG_RGB.join(',')})`;
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    c.drawImage(this.scratch, X(0), Y(0), MAP_W * s, MAP_H * s);

    const qs: Array<{ x: number; y: number }> = [];
    for (const loc of LOCATIONS) {
      if (loc.kind === 'room') continue;
      const r = loc.rect;
      if (v.discovered.has(loc.id)) {
        if (loc.kind === 'building') {
          c.strokeStyle = loc.minimapColor; c.lineWidth = Math.max(1.5, s / 3);
          c.strokeRect(X(r.x) + 0.5, Y(r.y) + 0.5, r.w * s - 1, r.h * s - 1);
        }
        if (this.labels) {
          const lx = X(loc.label?.x ?? r.x + r.w / 2), ly = Y(loc.label?.y ?? r.y + r.h / 2);
          c.font = `bold ${Math.round(Math.min(22, 11 + this.zoom * 3))}px system-ui, sans-serif`;
          c.textAlign = 'center'; c.textBaseline = 'middle';
          c.lineJoin = 'round'; c.lineWidth = 4; c.strokeStyle = 'rgba(20,30,26,0.85)';
          c.strokeText(L(loc.name), lx, ly);
          c.fillStyle = '#fff'; c.fillText(L(loc.name), lx, ly);
        }
      } else if (v.seen.has(loc.id)) {
        // seen but not yet discovered: faint silhouette + "?" badge
        if (loc.kind === 'building') {
          c.setLineDash([4, 3]); c.strokeStyle = 'rgba(242, 193, 78, 0.9)'; c.lineWidth = 1.5;
          c.strokeRect(X(r.x) + 0.5, Y(r.y) + 0.5, r.w * s - 1, r.h * s - 1);
          c.setLineDash([]);
        }
        const p = markerPos(loc);
        qs.push({ x: X(p.x), y: Y(p.y) });
      }
    }
    // badges on top of everything so none get hidden
    const rad = this.labels ? Math.min(14, 8 + this.zoom * 2) : 7;
    for (const q of qs) {
      c.fillStyle = '#f2c14e'; c.strokeStyle = '#3a2a10'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(q.x, q.y, rad, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = '#3a2a10'; c.font = `bold ${Math.round(rad * 1.4)}px system-ui, sans-serif`;
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', q.x, q.y + 1);
    }
    // mission target
    if (v.target) {
      const tx = X(v.target.x), ty = Y(v.target.y);
      const pulse = 1 + 0.25 * Math.sin(performance.now() / 250);
      c.strokeStyle = '#e8453c'; c.lineWidth = 2.5;
      c.beginPath(); c.arc(tx, ty, (this.labels ? 13 : 8) * pulse, 0, Math.PI * 2); c.stroke();
    }
    // player
    const px = X(v.player.x), py = Y(v.player.y);
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(px, py, this.labels ? 7 : 4.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#e8453c'; c.beginPath(); c.arc(px, py, this.labels ? 5 : 3, 0, Math.PI * 2); c.fill();
  }

  /** zoom keeping the tile under (sx, sy) fixed on screen */
  zoomAt(factor: number, sx = this.canvas.width / 2, sy = this.canvas.height / 2) {
    const before = this.view();
    const tx = (sx - before.ox) / before.s, ty = (sy - before.oy) / before.s;
    this.zoom = Math.min(5, Math.max(1, this.zoom * factor));
    const fit = Math.min(this.canvas.width / MAP_W, this.canvas.height / MAP_H);
    const s = fit * this.zoom;
    this.cx = tx - (sx - this.canvas.width / 2) / s;
    this.cy = ty - (sy - this.canvas.height / 2) / s;
  }

  panBy(dxPx: number, dyPx: number) {
    const { s } = this.view();
    this.cx -= dxPx / s; this.cy -= dyPx / s;
  }
}

export class Hud {
  private root = document.getElementById('hud')!;
  private clockDay!: HTMLElement;
  private clockTime!: HTMLElement;
  private period!: HTMLElement;
  private discovery!: HTMLElement;
  private needs!: HTMLElement;
  private prompt!: HTMLElement;
  private toasts!: HTMLElement;
  private controls!: HTMLElement;
  private langBtn!: HTMLButtonElement;
  private mini!: MapCanvas;
  private big!: MapCanvas;
  private bigWrap!: HTMLElement;
  private bigTitle!: HTMLElement;
  private modal!: HTMLElement;
  private lastView: MapView | null = null;
  bigOpen = false;
  modalOpen = false;
  onReset: () => void = () => {};
  onProfile: () => void = () => {};
  onMissions: () => void = () => {};
  onChatSend: (text: string) => void = () => {};
  onViewToggle: () => void = () => {};

  /** the 2D/3D button shows the view you'd switch to */
  setViewMode(mode: '2d' | '3d') {
    const b = this.root.querySelector('.view-btn') as HTMLButtonElement;
    b.textContent = mode === '3d' ? '2D' : '3D β';
    b.title = mode === '3d' ? L({ tr: '2D görünüme geç', en: 'Switch to the 2D view' }) : L({ tr: '3D görünüme geç (deneme)', en: 'Switch to the 3D view (preview)' });
  }
  chatOpen = false;

  /** shows the chat box (online only) */
  enableChat() { this.root.querySelector('.chat')!.classList.remove('hidden'); }

  openChat() {
    const form = this.root.querySelector('.chat-form') as HTMLFormElement;
    const input = form.querySelector('input') as HTMLInputElement;
    this.chatOpen = true;
    form.classList.remove('hidden');
    input.placeholder = L({ tr: 'Mesaj yaz, Enter ile gönder (Esc: kapat)', en: 'Type a message, Enter to send (Esc: close)' });
    input.focus();
  }

  closeChat() {
    const form = this.root.querySelector('.chat-form') as HTMLFormElement;
    (form.querySelector('input') as HTMLInputElement).blur();
    form.classList.add('hidden');
    this.chatOpen = false;
  }

  addChatLine(name: string, text: string, mine = false) {
    const log = this.root.querySelector('.chat-log') as HTMLElement;
    const line = document.createElement('div');
    line.className = `chat-line${mine ? ' mine' : ''}`;
    const b = document.createElement('b'); b.textContent = `${name}: `;
    line.append(b, document.createTextNode(text));
    log.appendChild(line);
    while (log.children.length > 6) log.firstElementChild!.remove();
    setTimeout(() => line.classList.add('old'), 15_000);
  }
  onRelationships: () => void = () => {};

  /** the small "current mission" card under the minimap */
  setTracker(html: string | null) {
    const el = this.root.querySelector('.tracker') as HTMLElement;
    el.classList.toggle('hidden', !html);
    if (html) el.innerHTML = html;
  }

  constructor(map: number[][]) {
    this.root.innerHTML = `
      <div class="card hud-clock">
        <button class="collapse-btn" type="button" title="">▾</button>
        <div class="hud-name"></div>
        <div class="clock-day"></div>
        <div class="clock-time"></div>
        <div class="clock-period"></div>
        <div class="needs"></div>
        <div class="discovery"></div>
        <div class="hud-buttons">
          <button class="missions-btn" type="button"></button>
          <button class="rel-btn" type="button"></button>
          <button class="profile-btn" type="button"></button>
          <button class="lang-btn" type="button"></button>
          <button class="mute-btn" type="button"></button>
          <button class="view-btn" type="button"></button>
          <button class="reset-btn" type="button">↺</button>
        </div>
      </div>
      <div class="hud-right">
        <div class="card hud-mini"><canvas class="mini"></canvas></div>
        <button type="button" class="card tracker"></button>
      </div>
      <div class="hud-countdown hidden"></div>
      <div class="hud-toasts"></div>
      <div class="hud-prompt hidden"></div>
      <div class="hud-banner hidden"><span></span><button type="button" class="secondary"></button></div>
      <div class="chat hidden">
        <div class="chat-log"></div>
        <form class="chat-form hidden"><input type="text" maxlength="140" id="chat-input" autocomplete="off"><button type="submit" class="primary">↵</button></form>
      </div>
      <div class="hud-controls"></div>
      <div class="overlay big-map hidden">
        <div class="card big-card">
          <div class="big-head">
            <div class="big-title"></div>
            <div class="zoom-btns">
              <button type="button" data-zoom="out">−</button>
              <button type="button" data-zoom="reset">⤢</button>
              <button type="button" data-zoom="in">+</button>
              <button type="button" data-zoom="close">✕</button>
            </div>
          </div>
          <canvas class="big"></canvas>
          <div class="big-help"></div>
        </div>
      </div>
      <div class="overlay modal hidden"></div>
    `;
    const q = <E extends HTMLElement>(sel: string) => this.root.querySelector(sel) as E;
    this.clockDay = q('.clock-day');
    this.clockTime = q('.clock-time');
    this.period = q('.clock-period');
    this.needs = q('.needs');
    this.discovery = q('.discovery');
    this.prompt = q('.hud-prompt');
    this.toasts = q('.hud-toasts');
    this.controls = q('.hud-controls');
    this.langBtn = q<HTMLButtonElement>('.lang-btn');
    this.bigWrap = q('.big-map');
    this.bigTitle = q('.big-title');
    this.modal = q('.modal');
    this.mini = new MapCanvas(q<HTMLCanvasElement>('.mini'), false, map, 230, 178);
    this.big = new MapCanvas(q<HTMLCanvasElement>('.big'), true, map, 840, 650);
    this.setupBigMap();
    const chatForm = q<HTMLFormElement>('.chat-form');
    const chatInput = chatForm.querySelector('input') as HTMLInputElement;
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      chatInput.value = '';
      if (text) this.onChatSend(text);
      this.closeChat();
    });
    // typing must not move your character or trigger hotkeys
    chatInput.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') this.closeChat(); });
    chatInput.addEventListener('keyup', (e) => e.stopPropagation());

    this.langBtn.addEventListener('click', () => setLang(getLang() === 'tr' ? 'en' : 'tr'));
    q('.profile-btn').addEventListener('click', () => this.onProfile());
    const card = q('.hud-clock');
    const collapse = q<HTMLButtonElement>('.collapse-btn');
    const setCollapsed = (c: boolean) => {
      card.classList.toggle('collapsed', c);
      collapse.textContent = c ? '▸' : '▾';
      try { localStorage.setItem('dacka.hudCollapsed', c ? '1' : '0'); } catch { /* ignore */ }
    };
    collapse.addEventListener('click', () => setCollapsed(!card.classList.contains('collapsed')));
    setCollapsed((() => { try { return localStorage.getItem('dacka.hudCollapsed') === '1'; } catch { return false; } })());
    q('.missions-btn').addEventListener('click', () => this.onMissions());
    q('.rel-btn').addEventListener('click', () => this.onRelationships());
    const mute = q<HTMLButtonElement>('.mute-btn');
    const setMute = () => { mute.textContent = sfx.isMuted() ? '🔇' : '🔊'; };
    mute.addEventListener('click', () => { sfx.toggle(); setMute(); });
    setMute();
    q('.view-btn').addEventListener('click', () => this.onViewToggle());
    q('.tracker').addEventListener('click', () => this.onMissions());
    q('.reset-btn').addEventListener('click', async () => { if (await askConfirm(t('reset_confirm'), t('menu_reset'), L({ tr: 'Vazgeç', en: 'Cancel' }))) this.onReset(); });
    onLangChange(() => this.refreshStatic());
    this.refreshStatic();
  }

  /** wheel / buttons / drag on the big map */
  private setupBigMap() {
    const canvas = this.big.canvas;
    const redraw = () => { if (this.lastView) this.big.render(this.lastView); };
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const sx = (e.clientX - r.left) * (canvas.width / r.width), sy = (e.clientY - r.top) * (canvas.height / r.height);
      this.big.zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, sx, sy);
      redraw();
    }, { passive: false });
    let drag: { x: number; y: number } | null = null;
    canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); canvas.classList.add('dragging'); });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const r = canvas.getBoundingClientRect();
      const k = canvas.width / r.width;
      this.big.panBy((e.clientX - drag.x) * k, (e.clientY - drag.y) * k);
      drag = { x: e.clientX, y: e.clientY };
      redraw();
    });
    const end = () => { drag = null; canvas.classList.remove('dragging'); };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    this.bigWrap.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('[data-zoom]') as HTMLElement | null;
      if (b) {
        const z = b.dataset.zoom;
        if (z === 'in') this.big.zoomAt(1.4);
        if (z === 'out') this.big.zoomAt(1 / 1.4);
        if (z === 'reset') this.big.zoom = 1;
        if (z === 'close') this.toggleMap(false);
        redraw();
        return;
      }
      if (e.target === this.bigWrap) this.toggleMap(false);
    });
    window.addEventListener('keydown', (e) => {
      if (!this.bigOpen) return;
      if (e.key === '+' || e.key === '=') { this.big.zoomAt(1.4); redraw(); }
      if (e.key === '-' || e.key === '_') { this.big.zoomAt(1 / 1.4); redraw(); }
    });
  }

  private refreshStatic() {
    this.langBtn.textContent = getLang() === 'tr' ? 'EN' : 'TR';
    this.controls.textContent = t('controls');
    this.bigTitle.textContent = t('map_title');
    (this.root.querySelector('.big-help') as HTMLElement).textContent = L({ tr: 'Fare tekerleği veya +/− ile yakınlaştır · sürükleyerek gez', en: 'Scroll or press +/− to zoom · drag to pan' });
    const icon = (sel: string, glyph: string, title: string) => { const b = this.root.querySelector(sel) as HTMLElement; b.textContent = glyph; b.title = title; };
    icon('.missions-btn', '📋', L({ tr: 'Görevler (J)', en: 'Missions (J)' }));
    icon('.rel-btn', '👥', L({ tr: 'İlişkiler (R)', en: 'People (R)' }));
    icon('.profile-btn', '👤', L({ tr: 'Profil (C)', en: 'Profile (C)' }));
    (this.root.querySelector('.collapse-btn') as HTMLElement).title = L({ tr: 'Küçült / büyüt', en: 'Collapse / expand' });
  }

  setName(name: string) {
    (this.root.querySelector('.hud-name') as HTMLElement).textContent = name;
  }

  setClock(day: number, minutes: number, periodText: string, seasonText = '') {
    const names = t('days').split(',');
    this.clockDay.textContent = `${names[(day - 1) % 7]} · ${t('day_n', { n: day })}${seasonText ? ` · ${seasonText}` : ''}`;
    const h = Math.floor(minutes / 60) % 24;
    const m = Math.floor(minutes % 60);
    this.clockTime.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    this.period.textContent = periodText;
  }

  setNeeds(st: PlayerState) {
    const bar = (icon: string, label: string, v: number, cls: string) =>
      `<div class="need ${cls} ${v < 25 ? 'low' : ''}" title="${label}"><span>${icon}</span><div class="nbar"><i style="width:${Math.round(v)}%"></i></div></div>`;
    const xpPct = Math.min(100, (st.xp / YEAR1_XP) * 100);
    this.needs.innerHTML =
      bar('⚡', L({ tr: 'Enerji', en: 'Energy' }), st.energy, 'energy') +
      bar('🍽', L({ tr: 'Tokluk', en: 'Fullness' }), st.hunger, 'hunger') +
      bar('🙂', L({ tr: 'Moral', en: 'Mood' }), st.mood, 'mood') +
      bar(st.sick ? '🤒' : '❤️', L({ tr: 'Sağlık', en: 'Health' }), st.health, 'health') +
      `<div class="money-xp"><span>💰 ${st.money} ₺</span><span title="XP">⭐ ${st.xp} / ${YEAR1_XP}</span></div>` +
      `<div class="nbar xp"><i style="width:${xpPct}%"></i></div>`;
  }

  setDiscovery(found: number, total: number) {
    this.discovery.innerHTML = `${t('discovered')}: <b>${found}/${total}</b><div class="bar"><span style="width:${(found / total) * 100}%"></span></div>`;
  }

  /** a status strip at the top (sleeping, waiting for friends…), with an optional button */
  setBanner(text: string | null, button?: { label: string; onClick: () => void }) {
    const el = this.root.querySelector('.hud-banner') as HTMLElement;
    el.classList.toggle('hidden', !text);
    if (!text) return;
    const span = el.querySelector('span')!;
    if (span.textContent !== text) span.textContent = text;
    const b = el.querySelector('button') as HTMLButtonElement;
    b.classList.toggle('hidden', !button);
    if (button) { b.textContent = button.label; b.onclick = button.onClick; }
  }

  setCountdown(text: string | null, urgent = false) {
    const el = this.root.querySelector('.hud-countdown') as HTMLElement;
    el.classList.toggle('hidden', !text);
    el.classList.toggle('urgent', urgent);
    if (text && el.textContent !== text) el.textContent = text;
  }

  setPrompt(text: string | null) {
    if (!text) { this.prompt.classList.add('hidden'); return; }
    this.prompt.textContent = text;
    this.prompt.classList.remove('hidden');
  }

  toast(text: string, kind: 'info' | 'good' = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = text;
    this.toasts.appendChild(el);
    setTimeout(() => el.classList.add('out'), 2800);
    setTimeout(() => el.remove(), 3400);
  }

  renderMaps(v: MapView) {
    this.lastView = v;
    this.mini.render(v);
    if (this.bigOpen) this.big.render(v);
  }

  toggleMap(open = !this.bigOpen) {
    this.bigOpen = open;
    this.bigWrap.classList.toggle('hidden', !open);
    if (open && this.lastView) {
      this.big.cx = this.lastView.player.x; this.big.cy = this.lastView.player.y;
      this.big.render(this.lastView);
    }
  }

  get host(): HTMLElement { return this.root; }

  showModal(opts: { title: string; sub?: string; body: string; note?: string; button: string; onClose?: () => void }) {
    const card = document.createElement('div');
    card.className = 'card modal-card';
    card.innerHTML = `<h2></h2>${opts.sub ? '<div class="modal-sub"></div>' : ''}<p class="modal-body"></p>${opts.note ? '<p class="modal-note"></p>' : ''}<button type="button" class="primary"></button>`;
    card.querySelector('h2')!.textContent = opts.title;
    if (opts.sub) card.querySelector('.modal-sub')!.textContent = opts.sub;
    card.querySelector('.modal-body')!.textContent = opts.body;
    if (opts.note) card.querySelector('.modal-note')!.textContent = opts.note;
    card.querySelector('button')!.textContent = opts.button;
    this.openCustomModal(card, ['Enter', 'Escape', 'e', 'E', ' '], opts.onClose);
  }

  showProfile(c: CharacterData, st: PlayerState) {
    const cause = CAUSES.find((x) => x.id === c.cause)!;
    const trait = TRAITS.find((x) => x.id === c.trait)!;
    const body = document.createElement('div');
    body.className = 'card profile-card';
    const grades = SUBJECTS.map((s) => {
      const avg = average(st.school.scores[s.id]);
      return `<div class="sum-row"><span>${L(s.name)}</span><b>${avg === null ? '—' : avg}</b></div>`;
    }).join('');
    body.innerHTML = `
      <div class="profile-head"><canvas width="32" height="32"></canvas><div><h2></h2><div class="modal-sub age"></div></div></div>
      <div class="sum-row"><span>${L({ tr: 'Kişilik', en: 'Personality' })}</span><b class="trait"></b></div>
      <div class="strength-card">
        <div class="sc-label">${L({ tr: 'Gücün', en: 'Your strength' })}</div>
        <div class="sc-name"></div><p class="perk"></p>
        <div class="sc-keep">🎁 <b class="keep"></b></div>
      </div>
      ${ATTRS.map((a) => `<div class="attr"><span>${L(a.name)}</span><div class="attr-bar"><i style="width:${Math.min(100, c.attributes[a.id] * 2)}%"></i></div><b>${Math.round(c.attributes[a.id])}</b></div>`).join('')}
      <div class="attr"><span>${L({ tr: 'Saygınlık', en: 'Respect' })}</span><div class="attr-bar respect"><i style="width:${c.respect / 10}%"></i></div><b>${c.respect}</b></div>
      <div class="sum-row" style="margin-top:10px"><span>${L({ tr: 'Disiplin puanı (düşük iyidir)', en: 'Discipline points (lower is better)' })}</span><b>${st.discipline} · ${L(behaviorGrade(st.discipline))}</b></div>
      <div class="field-label" style="margin-top:14px">${L({ tr: 'Ders ortalamaları', en: 'Subject averages' })}</div>
      ${grades}
      <div style="margin-top:14px;text-align:right"><button type="button" class="primary">${t('close')}</button></div>`;
    body.querySelector('h2')!.textContent = `${c.first} ${c.last}`;
    body.querySelector('.age')!.textContent = t('age_line', { home: c.hometown });
    body.querySelector('.trait')!.textContent = L(trait.name);
    body.querySelector('.sc-name')!.textContent = L(cause.strength);
    body.querySelector('.perk')!.textContent = L(cause.perk);
    body.querySelector('.keep')!.textContent = capitalize(keepsakeName(c.cause, c.loss));
    drawCharacter(body.querySelector('canvas')!.getContext('2d')!, 0, 0, c.look, 0, 0);
    this.openCustomModal(body, ['Enter', 'Escape', 'c', 'C', ' ']);
  }

  /** shows any card as a modal (missions panel, announcements) */
  openCard(content: HTMLElement, closeKeys: string[], onClose?: () => void) { this.openCustomModal(content, closeKeys, onClose); }

  private openCustomModal(content: HTMLElement, closeKeys: string[], onClose?: () => void) {
    this.modalOpen = true;
    this.modal.innerHTML = '';
    this.modal.appendChild(content);
    const close = () => {
      this.modal.classList.add('hidden');
      this.modalOpen = false;
      window.removeEventListener('keydown', onKey, true);
      onClose?.();
    };
    const onKey = (e: KeyboardEvent) => {
      if (closeKeys.includes(e.key)) { e.preventDefault(); e.stopPropagation(); close(); }
    };
    content.querySelector('button.primary')?.addEventListener('click', close);
    // defer so the key press that opened the modal doesn't close it
    setTimeout(() => window.addEventListener('keydown', onKey, true), 150);
    this.modal.classList.remove('hidden');
  }
}

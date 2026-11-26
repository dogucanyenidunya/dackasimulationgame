import { LOCATIONS, MAP_H, MAP_W, T, doorStandTile, type Location } from '../content/campus';
import { L, t, getLang, setLang, onLangChange } from '../i18n';
import { paintCharacter } from '../art/textures';
import { sfx } from '../audio';
import { askConfirm } from './confirm';
import { isTouch, onTouchMode } from './touch';
import {
  ATTRS, mixLabel, traitMix, type AttrId, type CharacterData,
} from '../content/character';
import { ATTR_STEP, PERKS, XP_PER_LEVEL, attrPoints, levelOf, levelProgress, perkPoints, type PerkId } from '../game/growth';
import { SUBJECTS, YEAR1_XP, attrCap, average, behaviorGrade, grade, type PlayerState } from '../game/state';
import { SECRETS } from '../game/secrets';
import { focusLine } from '../game/focus';
import { weekday } from '../game/schedule';

const TILE_COLORS: Record<number, [number, number, number]> = {
  [T.FOREST]: [47, 107, 69], [T.GROUND]: [231, 227, 218], [T.PATH]: [210, 200, 180], [T.PLAZA]: [183, 214, 160],
  [T.ROOF]: [201, 206, 211], [T.SKYLIGHT]: [159, 182, 201], [T.SOLAR]: [58, 95, 158], [T.GREEN_ROOF]: [127, 180, 102],
  [T.WALL]: [238, 240, 241], [T.DOOR]: [122, 78, 42], [T.COURT_RED]: [168, 72, 62], [T.COURT_BLUE]: [63, 127, 166],
  [T.FENCE]: [143, 135, 120], [T.GATE]: [47, 107, 58], [T.COURTYARD]: [157, 184, 138], [T.DOOR_REVIR]: [192, 57, 43],
  [T.WALL_BASE]: [238, 240, 241], [T.ROAD]: [96, 100, 104], [T.HOUSES]: [168, 92, 70], [T.CAMPUS_WALL]: [120, 112, 100],
};
const FOG_RGB: [number, number, number] = [132, 152, 142];

export interface MapView {
  revealed: Uint8Array;
  seen: Set<string>;
  discovered: Set<string>;
  player: { x: number; y: number };
  /** current mission target, tile coords (drawn as a ring when known) */
  target?: { x: number; y: number } | null;
  /** your friends out on the campus (tile coords) */
  friends?: Array<{ x: number; y: number; name: string }>;
  /** the spot you marked on the big map yourself (tile coords) */
  waypoint?: { x: number; y: number } | null;
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
  /** the radar (minimap): stays centred on you, unless you're looking around it (until `browseUntil`) */
  follow = false;
  browseUntil = 0;

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
    // the radar keeps you in the middle; after you've dragged it around, it drifts back to you
    if (this.follow && performance.now() > this.browseUntil) {
      const back = performance.now() - this.browseUntil < 600 ? 0.35 : 1;
      this.cx += (v.player.x - this.cx) * back; this.cy += (v.player.y - this.cy) * back;
    }
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
    // friends: gold hearts you can find them by
    for (const f of v.friends ?? []) {
      const fx = X(f.x), fy = Y(f.y), r = this.labels ? 6 : 3.5;
      c.fillStyle = '#3a2a10'; c.beginPath(); c.arc(fx, fy, r + 1.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffd34d'; c.beginPath(); c.arc(fx, fy, r, 0, Math.PI * 2); c.fill();
      if (this.labels) {
        c.font = 'bold 12px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'bottom';
        c.lineWidth = 3; c.strokeStyle = 'rgba(20,30,26,0.85)'; c.strokeText(`💛 ${f.name}`, fx, fy - 8);
        c.fillStyle = '#ffe27a'; c.fillText(`💛 ${f.name}`, fx, fy - 8);
      }
    }
    // your own waypoint: a purple pin
    if (v.waypoint) {
      const wx = X(v.waypoint.x), wy = Y(v.waypoint.y), r = this.labels ? 9 : 6;
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(wx, wy + 1, r * 0.7, r * 0.3, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#9b4dca'; c.strokeStyle = '#fff'; c.lineWidth = 2;
      c.beginPath(); c.arc(wx, wy - r * 1.4, r, Math.PI * 0.85, Math.PI * 0.15); c.lineTo(wx, wy); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(wx, wy - r * 1.4, r * 0.38, 0, Math.PI * 2); c.fill();
    }
    // on the radar, whatever is off its edge gets an arrow on the rim pointing at it (as in GTA)
    if (this.follow) {
      const W = this.canvas.width, H = this.canvas.height, m = 9;
      const edge = (tx: number, ty: number, col: string) => {
        const sx = X(tx), sy = Y(ty);
        if (sx >= m && sx <= W - m && sy >= m && sy <= H - m) return;
        const dx = sx - W / 2, dy = sy - H / 2;
        const f = Math.min((W / 2 - m) / Math.abs(dx || 1e-6), (H / 2 - m) / Math.abs(dy || 1e-6));
        const ex = W / 2 + dx * f, ey = H / 2 + dy * f, a = Math.atan2(dy, dx);
        c.save(); c.translate(ex, ey); c.rotate(a);
        c.fillStyle = col; c.strokeStyle = '#fff'; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(7, 0); c.lineTo(-5, -5.5); c.lineTo(-2.5, 0); c.lineTo(-5, 5.5); c.closePath(); c.fill(); c.stroke();
        c.restore();
      };
      if (v.target) edge(v.target.x, v.target.y, '#e8453c');
      if (v.waypoint) edge(v.waypoint.x, v.waypoint.y, '#9b4dca');
      edge(v.player.x, v.player.y, '#ffffff');
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

/** your secret skills in the profile: the ones you've opened, and how many are still hidden */
function secretsHtml(st: PlayerState): string {
  const esc = (v: string) => v.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));
  const mine = SECRETS.filter((s) => st.secrets.includes(s.id));
  const head = `<div class="field-label" style="margin-top:12px">${L({ tr: 'Gizli yeteneklerin', en: 'Your secret skills' })} · ${mine.length}/${SECRETS.length}</div>`;
  if (!mine.length) return `${head}<div class="secret-none">${L({ tr: 'Henüz yok. Nasıl biri olduğun bazılarını açacak.', en: 'None yet. Who you become will open some.' })}</div>`;
  return head + mine.map((s) => `<div class="secret-row"><b>✨ ${esc(L(s.name))}</b><span>${esc(L(s.effect))}</span></div>`).join('');
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
  /** the spot you marked on the big map (tile coords), shown on both maps until you get there */
  private waypoint: { x: number; y: number } | null = null;
  bigOpen = false;
  modalOpen = false;
  onReset: () => void = () => {};
  onProfile: () => void = () => {};
  onMissions: () => void = () => {};
  onChatSend: (text: string) => void = () => {};

  chatOpen = false;

  /** shows the chat box (online only) */
  enableChat() { this.root.querySelector('.chat')!.classList.remove('hidden'); }

  openChat() {
    const form = this.root.querySelector('.chat-form') as HTMLFormElement;
    const input = form.querySelector('input') as HTMLInputElement;
    this.chatOpen = true;
    form.classList.remove('hidden');
    input.placeholder = isTouch()
      ? L({ tr: 'Mesaj yaz…', en: 'Type a message…' })
      : L({ tr: 'Mesaj yaz, Enter ile gönder (Esc: kapat)', en: 'Type a message, Enter to send (Esc: close)' });
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
  onFriends: () => void = () => {};
  private friendRequests = 0;

  /** shows the friends button (online only) */
  enableFriends() { this.root.querySelector('.friends-btn')!.classList.remove('hidden'); }

  /** the red number on the friends button: friend requests waiting for you */
  setFriendRequests(n: number) {
    this.friendRequests = n;
    const b = this.root.querySelector('.friends-btn') as HTMLElement;
    b.textContent = '🤝';
    if (n > 0) { const i = document.createElement('i'); i.className = 'badge'; i.textContent = String(Math.min(n, 9)); b.appendChild(i); }
    b.title = L({ tr: 'Arkadaşlar (F)', en: 'Friends (F)' }) + (n > 0 ? ` · ${L({ tr: `${n} istek`, en: `${n} request${n > 1 ? 's' : ''}` })}` : '');
  }

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
          <button class="friends-btn hidden" type="button"></button>
          <button class="profile-btn" type="button"></button>
          <button class="lang-btn" type="button"></button>
          <button class="music-btn" type="button"></button>
          <button class="mute-btn" type="button"></button>
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
    // the minimap is a close-up radar that follows you (GTA-style); drag or scroll it to look around the whole campus
    this.mini.follow = true;
    this.mini.zoom = 2.6;
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
    // touch screens have no Esc: tapping away from an empty chat box closes it
    chatInput.addEventListener('blur', () => { if (this.chatOpen && !chatInput.value.trim()) setTimeout(() => this.closeChat(), 0); });
    this.prompt.addEventListener('click', () => this.onPromptTap());
    this.setupMiniMap();

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
    q('.friends-btn').addEventListener('click', () => this.onFriends());
    const mute = q<HTMLButtonElement>('.mute-btn');
    const setMute = () => { mute.textContent = sfx.isMuted() ? '🔇' : '🔊'; };
    mute.addEventListener('click', () => { sfx.toggle(); setMute(); });
    setMute();
    // background music: off by default
    const musicBtn = q<HTMLButtonElement>('.music-btn');
    const setMusic = () => {
      musicBtn.textContent = '🎵';
      musicBtn.classList.toggle('off', !sfx.musicOn());
      musicBtn.title = sfx.musicOn() ? L({ tr: 'Müziği kapat', en: 'Turn the music off' }) : L({ tr: 'Müziği aç', en: 'Turn the music on' });
    };
    musicBtn.addEventListener('click', () => { sfx.toggleMusic(); setMusic(); });
    setMusic();
    onLangChange(setMusic);
    q('.tracker').addEventListener('click', () => this.onMissions());
    q('.reset-btn').addEventListener('click', async () => { if (await askConfirm(t('reset_confirm'), t('menu_reset'), L({ tr: 'Vazgeç', en: 'Cancel' }))) this.onReset(); });
    onLangChange(() => this.refreshStatic());
    onTouchMode(() => this.refreshStatic());
    this.refreshStatic();
  }

  /** the radar: drag to look around the campus, scroll to zoom, tap to open the big map; it comes back to you on its own */
  private setupMiniMap() {
    const canvas = this.mini.canvas;
    const browse = () => { this.mini.browseUntil = performance.now() + 4000; if (this.lastView) this.mini.render(this.lastView); };
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      this.mini.zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, (e.clientX - r.left) * (canvas.width / r.width), (e.clientY - r.top) * (canvas.height / r.height));
      this.mini.zoom = Math.max(1.3, this.mini.zoom);
      browse();
    }, { passive: false });
    let drag: { x: number; y: number; moved: number } | null = null;
    canvas.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      drag = { x: e.clientX, y: e.clientY, moved: 0 };
      try { canvas.setPointerCapture(e.pointerId); } catch { /* (the pointer is already gone) */ }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const k = canvas.width / canvas.getBoundingClientRect().width;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      drag.x = e.clientX; drag.y = e.clientY;
      if (drag.moved < 5) return;
      canvas.classList.add('dragging');
      this.mini.panBy(dx * k, dy * k);
      browse();
    });
    const end = () => {
      const tap = drag && drag.moved < 5;
      drag = null;
      canvas.classList.remove('dragging');
      // a tap (not a drag) opens the big map
      if (tap && !this.modalOpen && !this.chatOpen) this.toggleMap(true);
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', () => { drag = null; canvas.classList.remove('dragging'); });
    // double-click: straight back to you
    canvas.addEventListener('dblclick', () => { this.mini.browseUntil = 0; if (this.lastView) this.mini.render(this.lastView); });
  }

  /** marks (or, on the same spot, clears) your own waypoint */
  setWaypoint(p: { x: number; y: number } | null) {
    if (p && this.waypoint && Math.hypot(p.x - this.waypoint.x, p.y - this.waypoint.y) < 1.5) p = null;
    this.waypoint = p;
    this.toast(p ? L({ tr: '📍 Hedef işaretlendi. Haritada ve radarda mor iğne olarak görünür.', en: '📍 Waypoint set. It shows as a purple pin on the map and the radar.' }) : L({ tr: 'Hedef işareti kaldırıldı.', en: 'Waypoint cleared.' }));
    if (this.lastView) this.renderMaps(this.lastView);
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
    let moved = 0;
    // fingers on the map (two of them = pinch to zoom)
    const fingers = new Map<number, { x: number; y: number }>();
    let spread = 0;
    const pinchSpread = () => { const [a, b] = [...fingers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    canvas.addEventListener('pointerdown', (e) => {
      fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvas.setPointerCapture(e.pointerId);
      if (fingers.size === 2) { drag = null; spread = pinchSpread(); return; }
      drag = { x: e.clientX, y: e.clientY };
      moved = 0;
      canvas.classList.add('dragging');
    });
    canvas.addEventListener('pointermove', (e) => {
      if (fingers.has(e.pointerId)) fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const r = canvas.getBoundingClientRect();
      const k = canvas.width / r.width;
      if (fingers.size === 2 && spread) {
        const now = pinchSpread();
        const [a, b] = [...fingers.values()];
        this.big.zoomAt(now / spread, ((a.x + b.x) / 2 - r.left) * k, ((a.y + b.y) / 2 - r.top) * k);
        spread = now;
        redraw();
        return;
      }
      if (!drag) return;
      moved += Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y);
      this.big.panBy((e.clientX - drag.x) * k, (e.clientY - drag.y) * k);
      drag = { x: e.clientX, y: e.clientY };
      redraw();
    });
    const end = (e: PointerEvent) => {
      fingers.delete(e.pointerId);
      spread = 0;
      drag = null;
      canvas.classList.remove('dragging');
    };
    // a click that didn't drag the map marks a waypoint there (click it again to clear it)
    canvas.addEventListener('pointerup', (e) => {
      if (!drag || moved > 6 || fingers.size > 1) return;
      const r = canvas.getBoundingClientRect(), k = canvas.width / r.width;
      const { s, ox, oy } = this.big.view();
      const tx = ((e.clientX - r.left) * k - ox) / s, ty = ((e.clientY - r.top) * k - oy) / s;
      if (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H) this.setWaypoint({ x: tx, y: ty });
    });
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
    (this.root.querySelector('.big-help') as HTMLElement).textContent = isTouch()
      ? L({ tr: 'İki parmakla ya da +/− ile yakınlaştır · sürükleyerek gez · dokunarak hedef işaretle', en: 'Pinch or tap +/− to zoom · drag to pan · tap to set a waypoint' })
      : L({ tr: 'Fare tekerleği veya +/− ile yakınlaştır · sürükleyerek gez · tıklayarak hedef işaretle', en: 'Scroll or press +/− to zoom · drag to pan · click to set a waypoint' });
    const icon = (sel: string, glyph: string, title: string) => { const b = this.root.querySelector(sel) as HTMLElement; b.textContent = glyph; b.title = title; };
    icon('.missions-btn', '📋', L({ tr: 'Görevler (J)', en: 'Missions (J)' }));
    icon('.rel-btn', '👥', L({ tr: 'İlişkiler (R)', en: 'People (R)' }));
    icon('.profile-btn', '👤', L({ tr: 'Profil (C)', en: 'Profile (C)' }));
    this.setFriendRequests(this.friendRequests);
    (this.root.querySelector('.collapse-btn') as HTMLElement).title = L({ tr: 'Küçült / büyüt', en: 'Collapse / expand' });
  }

  setName(name: string) {
    (this.root.querySelector('.hud-name') as HTMLElement).textContent = name;
  }

  setClock(day: number, minutes: number, periodText: string, weatherText = '') {
    const names = t('days').split(',');
    this.clockDay.textContent = `${names[weekday(day)]}${weatherText ? ` · ${weatherText}` : ''}`;
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
      bar('❤️', L({ tr: 'Sağlık', en: 'Health' }), st.health, 'health') +
      `<div class="money-xp"><span>💰 ${st.money} ₺</span><span title="XP">⭐ ${st.xp} / ${YEAR1_XP}</span></div>` +
      `<div class="lvl-tag${attrPoints(st.growth) + perkPoints(st.growth) ? ' pts' : ''}" title="${L({ tr: 'Profilinde (C) harca', en: 'Spend in your profile (C)' })}">${L({ tr: 'Seviye', en: 'Level' })} ${levelOf(st.growth)}${attrPoints(st.growth) + perkPoints(st.growth) ? ` · ${L({ tr: 'puanın var', en: 'points to spend' })} ●` : ''}</div>` +
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

  /** the strip at the top; `progress` (0–1) adds a time bar that runs down, `button` an action */
  setCountdown(text: string | null, urgent = false, progress?: number, button?: { label: string; onClick: () => void }) {
    const el = this.root.querySelector('.hud-countdown') as HTMLElement;
    el.classList.toggle('hidden', !text);
    el.classList.toggle('urgent', urgent);
    el.classList.toggle('with-bar', progress !== undefined);
    if (!text) return;
    if (!el.querySelector('.cd-text')) el.innerHTML = '<span class="cd-text"></span><div class="cd-bar"><i></i></div><button type="button" class="secondary cd-btn hidden"></button>';
    const tx = el.querySelector('.cd-text') as HTMLElement;
    if (tx.textContent !== text) tx.textContent = text;
    (el.querySelector('.cd-bar i') as HTMLElement).style.width = `${Math.max(0, Math.min(1, progress ?? 0)) * 100}%`;
    const b = el.querySelector('.cd-btn') as HTMLButtonElement;
    b.classList.toggle('hidden', !button);
    if (button) { if (b.textContent !== button.label) b.textContent = button.label; b.onclick = button.onClick; }
  }

  /** the prompt was tapped (touch screens: same as pressing E) */
  onPromptTap: () => void = () => {};

  setPrompt(text: string | null) {
    this.root.classList.toggle('has-prompt', !!text);
    if (!text) { this.prompt.classList.add('hidden'); return; }
    // on a touch screen there's no E key: the prompt itself (and the ✋ button) does it
    const shown = isTouch() ? text.replace(/^E — /, '') : text;
    if (this.prompt.textContent !== shown) this.prompt.textContent = shown;
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
    // made it to your waypoint: it's done its job
    if (this.waypoint && Math.hypot(v.player.x - this.waypoint.x, v.player.y - this.waypoint.y) < 1.6) {
      this.waypoint = null;
      this.toast(L({ tr: '📍 İşaretlediğin yere vardın.', en: '📍 You reached your waypoint.' }), 'good');
    }
    v = { ...v, waypoint: this.waypoint };
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

  /** `grow`: spending development points (returns why it couldn't, or null); the card redraws itself after each one */
  showProfile(c: CharacterData, st: PlayerState, grow?: { spendAttr: (id: AttrId) => string | null; pickPerk: (id: PerkId) => string | null }) {
    const body = document.createElement('div');
    body.className = 'card profile-card';
    const esc = (v: string) => v.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));
    const grades = SUBJECTS.map((s) => {
      const avg = average(st.school.scores[s.id]);
      return `<div class="sum-row"><span>${L(s.name)}</span><b>${avg === null ? '—' : avg}</b></div>`;
    }).join('');
    let note = '';
    const render = () => {
      const g = st.growth, pts = attrPoints(g), perkPts = perkPoints(g), cap = attrCap(grade(st.year));
      const attrRow = (a: (typeof ATTRS)[number]) => {
        const v = c.attributes[a.id];
        const can = !!grow && pts > 0 && v < cap;
        const btn = grow ? `<button type="button" class="grow-btn" data-attr="${a.id}" ${can ? '' : 'disabled'} title="${esc(v >= cap ? L({ tr: `Bu yılın sınırı: ${cap}`, en: `This year's ceiling: ${cap}` }) : `+${ATTR_STEP}`)}">+${ATTR_STEP}</button>` : '';
        return `<div class="attr${grow ? ' has-btn' : ''}"><span>${L(a.name)}</span><div class="attr-bar"><i style="width:${Math.min(100, v * 2)}%"></i></div><b>${Math.round(v)}</b>${btn}</div>`;
      };
      const perkRow = (p: (typeof PERKS)[number]) => {
        const owned = g.perks.includes(p.id);
        const attrName = L(ATTRS.find((a) => a.id === p.attr)!.name);
        const meets = c.attributes[p.attr] >= p.need;
        const state = owned ? `<b class="perk-owned">✓</b>`
          : grow ? `<button type="button" class="grow-btn" data-perk="${p.id}" ${perkPts > 0 && meets ? '' : 'disabled'}>${L({ tr: 'Seç', en: 'Pick' })}</button>` : '';
        return `<div class="perk-row${owned ? ' owned' : ''}"><div><b>${p.icon} ${esc(L(p.name))}</b><span>${esc(L(p.desc))} · ${esc(attrName)} ${p.need}${meets ? '' : ` (${Math.round(c.attributes[p.attr])})`}</span></div>${state}</div>`;
      };
      body.innerHTML = `
        <div class="profile-head"><canvas width="144" height="144"></canvas><div><h2></h2><div class="modal-sub age"></div></div></div>
        <div class="sum-row"><span>${L({ tr: 'Kişilik', en: 'Personality' })}</span><b class="trait"></b></div>
        <div class="sum-row"><span>${L({ tr: 'Dönem odağı', en: 'Term focus' })}</span><b>${focusLine(st)}</b></div>
        <div class="field-label" style="margin-top:12px">⭐ ${L({ tr: 'Gelişim', en: 'Development' })} · ${L({ tr: 'Seviye', en: 'Level' })} ${levelOf(g)}</div>
        <div class="lvl-line"><div class="attr-bar lvl"><i style="width:${(levelProgress(g) / XP_PER_LEVEL) * 100}%"></i></div><span>${levelProgress(g)}/${XP_PER_LEVEL} XP</span></div>
        <div class="sum-row"><span>${L({ tr: 'Gelişim puanı', en: 'Development points' })}</span><b class="${pts ? 'pts-on' : ''}">${pts}</b></div>
        <div class="grow-help">${L({ tr: `Her ${XP_PER_LEVEL} XP bir seviye: bir özelliğine +${ATTR_STEP} ver (bu yılın sınırı ${cap}). Her 3 seviyede bir yetenek seçersin. XP'n azalmaz.`, en: `Every ${XP_PER_LEVEL} XP is a level: give one attribute +${ATTR_STEP} (this year's ceiling is ${cap}). Every 3 levels you pick a perk. Your XP doesn't go down.` })}</div>
        ${ATTRS.map(attrRow).join('')}
        <div class="attr"><span>${L({ tr: 'Saygınlık', en: 'Respect' })}</span><div class="attr-bar respect"><i style="width:${c.respect / 10}%"></i></div><b>${c.respect}</b></div>
        <div class="field-label" style="margin-top:12px">${L({ tr: 'Yetenekler', en: 'Perks' })} · ${g.perks.length}/${PERKS.length}${perkPts ? ` · <span class="pts-on">${L({ tr: `${perkPts} seçim hakkın var`, en: `${perkPts} to pick` })}</span>` : ''}</div>
        ${PERKS.map(perkRow).join('')}
        ${note ? `<div class="grow-note">${esc(note)}</div>` : ''}
        ${secretsHtml(st)}
        <div class="sum-row" style="margin-top:10px"><span>${L({ tr: 'Disiplin puanı (düşük iyidir)', en: 'Discipline points (lower is better)' })}</span><b>${st.discipline} · ${L(behaviorGrade(st.discipline))}</b></div>
        <div class="field-label" style="margin-top:14px">${L({ tr: 'Ders ortalamaları', en: 'Subject averages' })}</div>
        ${grades}
        <div style="margin-top:14px;text-align:right"><button type="button" class="primary" data-close>${t('close')}</button></div>`;
      body.querySelector('h2')!.textContent = `${c.first} ${c.last}`;
      body.querySelector('.age')!.textContent = t('age_line', { home: c.hometown });
      body.querySelector('.trait')!.textContent = mixLabel(traitMix(c));
      paintCharacter(body.querySelector('canvas')!, c.look, 0, 0, { bust: true });
      body.querySelectorAll<HTMLButtonElement>('[data-attr]').forEach((b) => b.addEventListener('click', () => { note = grow!.spendAttr(b.dataset.attr as AttrId) ?? ''; render(); }));
      body.querySelectorAll<HTMLButtonElement>('[data-perk]').forEach((b) => b.addEventListener('click', () => { note = grow!.pickPerk(b.dataset.perk as PerkId) ?? ''; render(); }));
    };
    render();
    this.openCustomModal(body, ['Enter', 'Escape', 'c', 'C', ' ']);
  }

  /** shows any card as a modal (missions panel, announcements) */
  openCard(content: HTMLElement, closeKeys: string[], onClose?: () => void) { this.openCustomModal(content, closeKeys, onClose); }

  private openCustomModal(content: HTMLElement, closeKeys: string[], onClose?: () => void) {
    this.modalOpen = true;
    this.modal.innerHTML = '';
    this.modal.appendChild(content);
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      this.modal.classList.add('hidden');
      this.modalOpen = false;
      window.removeEventListener('keydown', onKey, true);
      onClose?.();
    };
    const onKey = (e: KeyboardEvent) => {
      if (closeKeys.includes(e.key)) { e.preventDefault(); e.stopPropagation(); close(); }
    };
    content.querySelector('button.primary')?.addEventListener('click', close);
    // a card that redraws itself (its first button gets replaced) marks its close button with data-close instead
    content.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('[data-close]')) close(); });
    // defer so the key press that opened the modal doesn't close it
    setTimeout(() => window.addEventListener('keydown', onKey, true), 150);
    this.modal.classList.remove('hidden');
  }
}

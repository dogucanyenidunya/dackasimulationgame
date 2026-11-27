// Saklambaç in a corner of the campus garden: sheds, walls, bushes and trees, and the "sobe" tree where the ebe
// counts. Either you hide and a classmate is ebe, or you're ebe and they hide.
// The ebe sees in a cone in front of them, and nothing behind a wall, a shed or a bush. Seen? Then it's a race to the
// tree: if the ebe touches it first, you're caught ("sobe!"); if you get there first, you're safe. A hider the ebe
// hasn't seen can also creep to the tree while the ebe is off searching and touch it to be safe.
// WASD / the arrow keys (or drag) to move.
import { L } from '../i18n';
import { sfx } from '../audio';
import { injectPeerGameStyles } from './yetimball';
import type { BallerInfo } from './basketball';

export type HideRole = 'hide' | 'seek';
export interface HideOpts { role: HideRole; me: BallerInfo & { speed: number }; /** the ebe (when you hide) or the other hiders */ others: BallerInfo[] }
export interface HideResult { role: HideRole; /** hiding: you got home safe; seeking: how many you caught, of how many */ safe: boolean; caught: number; of: number; quit: boolean }

const W = 520, H = 420;
const R = 9;
const BASE: [number, number] = [260, 372];
const SIGHT = 150, HALF_FOV = 0.6, NEAR = 26;
const COUNT_MS = 8000;
const GAME_MS = 120_000;

interface Rect { x: number; y: number; w: number; h: number; kind: 'shed' | 'wall' | 'bench' }
interface Bush { x: number; y: number; r: number; kind: 'bush' | 'tree' }
const RECTS: Rect[] = [
  { x: 50, y: 50, w: 96, h: 50, kind: 'shed' }, { x: 380, y: 44, w: 104, h: 26, kind: 'wall' }, { x: 196, y: 160, w: 128, h: 16, kind: 'bench' },
  { x: 34, y: 220, w: 26, h: 120, kind: 'wall' }, { x: 452, y: 190, w: 30, h: 120, kind: 'wall' }, { x: 312, y: 250, w: 64, h: 44, kind: 'shed' },
];
const BUSHES: Bush[] = [
  { x: 150, y: 210, r: 26, kind: 'bush' }, { x: 362, y: 150, r: 22, kind: 'bush' }, { x: 118, y: 336, r: 24, kind: 'bush' }, { x: 420, y: 345, r: 26, kind: 'bush' },
  { x: 262, y: 84, r: 20, kind: 'tree' }, { x: 214, y: 262, r: 18, kind: 'bush' },
];
/** places behind things, out of sight of the tree */
const SPOTS: Array<[number, number]> = [[98, 36], [98, 116], [432, 30], [260, 146], [20, 280], [496, 250], [344, 236], [344, 310], [150, 180], [362, 124], [96, 336], [446, 366], [262, 58], [214, 238], [180, 60], [470, 120]];

interface Kid extends BallerInfo { x: number; y: number; vx: number; vy: number; speed: number; me: boolean; face: number; state: 'hiding' | 'running' | 'safe' | 'caught'; spot: [number, number]; plan: number }

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const angDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/** does the segment a→b pass through anything that blocks sight? */
function blocked(ax: number, ay: number, bx: number, by: number): boolean {
  for (const b of BUSHES) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
    const t = clamp(((b.x - ax) * dx + (b.y - ay) * dy) / l2, 0, 1);
    if (dist(ax + dx * t, ay + dy * t, b.x, b.y) < b.r - 3) return true;
  }
  for (const r of RECTS) {
    if (r.kind === 'bench') continue; // you can see over a bench
    // Liang–Barsky against the rectangle
    let t0 = 0, t1 = 1;
    const dx = bx - ax, dy = by - ay;
    const p = [-dx, dx, -dy, dy], q = [ax - r.x, r.x + r.w - ax, ay - r.y, r.y + r.h - ay];
    let hit = true;
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) { hit = false; break; } continue; }
      const t = q[i] / p[i];
      if (p[i] < 0) { if (t > t1) { hit = false; break; } if (t > t0) t0 = t; } else { if (t < t0) { hit = false; break; } if (t < t1) t1 = t; }
    }
    if (hit && t0 <= t1) return true;
  }
  return false;
}

/** out of walls, sheds and bushes, inside the garden */
function pushOut(k: { x: number; y: number }) {
  k.x = clamp(k.x, R, W - R); k.y = clamp(k.y, R, H - R);
  for (const b of BUSHES) { const d = dist(k.x, k.y, b.x, b.y), m = b.r + R - 4; if (d < m && d > 0.01) { k.x = b.x + ((k.x - b.x) / d) * m; k.y = b.y + ((k.y - b.y) / d) * m; } }
  for (const r of RECTS) {
    const cx = clamp(k.x, r.x, r.x + r.w), cy = clamp(k.y, r.y, r.y + r.h), d = dist(k.x, k.y, cx, cy);
    if (d < R) {
      if (d > 0.01) { k.x = cx + ((k.x - cx) / d) * R; k.y = cy + ((k.y - cy) / d) * R; }
      else { const l = k.x - r.x, rr = r.x + r.w - k.x, t = k.y - r.y, bb = r.y + r.h - k.y, m = Math.min(l, rr, t, bb); if (m === l) k.x = r.x - R; else if (m === rr) k.x = r.x + r.w + R; else if (m === t) k.y = r.y - R; else k.y = r.y + r.h + R; }
    }
  }
}

export class HideSeekView {
  readonly el: HTMLElement;
  private cv: HTMLCanvasElement;
  private c: CanvasRenderingContext2D;
  private ebe: Kid;
  private hiders: Kid[];
  private me: Kid;
  private phase: 'count' | 'seek' | 'over' = 'count';
  private startAt = performance.now();
  private last = performance.now();
  /** the hider the ebe is racing to the tree */
  private race: Kid | null = null;
  private checked = new Set<number>();
  private keys = new Set<string>();
  private joy: { ox: number; oy: number; x: number; y: number; id: number } | null = null;
  private msg = ''; private msgUntil = 0;
  private flash = ''; private flashUntil = 0;
  private ended = false;
  private raf = 0;
  private done!: (r: HideResult) => void;
  readonly result: Promise<HideResult>;
  private onKey = (e: KeyboardEvent) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(k)) return;
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'keydown') { this.keys.add(k); if (k === 'Enter' && this.ended) this.close(); } else this.keys.delete(k);
  };

  constructor(host: HTMLElement, private o: HideOpts) {
    injectPeerGameStyles();
    injectStyles();
    this.result = new Promise((r) => { this.done = r; });
    const kid = (i: BallerInfo, me: boolean, speed: number): Kid => ({ ...i, x: BASE[0] + (Math.random() - 0.5) * 60, y: BASE[1] - 14 - Math.random() * 20, vx: 0, vy: 0, speed, me, face: -Math.PI / 2, state: 'hiding', spot: BASE, plan: 0 });
    const ai = (s: number) => 112 + s * 36;
    if (o.role === 'hide') {
      this.me = kid(o.me, true, o.me.speed);
      this.ebe = kid(o.others[0], false, ai(o.others[0].skill) + 6);
      this.hiders = [this.me, ...o.others.slice(1).map((x) => kid(x, false, ai(x.skill)))];
    } else {
      this.me = kid(o.me, true, o.me.speed);
      this.ebe = this.me;
      this.hiders = o.others.map((x) => kid(x, false, ai(x.skill)));
    }
    this.ebe.x = BASE[0]; this.ebe.y = BASE[1] - 4; this.ebe.face = Math.PI / 2; // facing the tree
    // everyone else picks somewhere to hide
    const free = [...SPOTS].sort(() => Math.random() - 0.5);
    for (const h of this.hiders) if (!h.me) h.spot = free.pop()!;
    this.el = document.createElement('div');
    this.el.className = 'pg-overlay';
    this.el.innerHTML = `
      <div class="pg-card hs-card">
        <div class="yb-head"><b>🙈 ${L({ tr: 'Saklambaç', en: 'Hide-and-seek' })}</b><span class="hs-time"></span></div>
        <div class="pg-score hs-score"></div>
        <canvas width="${W}" height="${H}"></canvas>
        <div class="pg-status hs-status"></div>
        <div class="pg-row"><button type="button" class="secondary pg-quit"></button></div>
      </div>`;
    this.cv = this.el.querySelector('canvas')!;
    this.c = this.cv.getContext('2d')!;
    (this.el.querySelector('.pg-quit') as HTMLElement).textContent = L({ tr: 'Oyundan çık', en: 'Leave the game' });
    this.el.querySelector('.pg-quit')!.addEventListener('click', () => { if (!this.ended) this.finish(true); this.close(); });
    this.cv.addEventListener('pointerdown', (e) => { const [x, y] = this.local(e); this.joy = { ox: x, oy: y, x, y, id: e.pointerId }; this.cv.setPointerCapture(e.pointerId); });
    this.cv.addEventListener('pointermove', (e) => { if (this.joy?.id === e.pointerId) { const [x, y] = this.local(e); this.joy.x = x; this.joy.y = y; } });
    const endJoy = (e: PointerEvent) => { if (this.joy?.id === e.pointerId) this.joy = null; };
    this.cv.addEventListener('pointerup', endJoy);
    this.cv.addEventListener('pointercancel', endJoy);
    window.addEventListener('keydown', this.onKey, true);
    window.addEventListener('keyup', this.onKey, true);
    host.appendChild(this.el);
    this.say(o.role === 'hide'
      ? L({ tr: `${this.ebe.name} ağaçta sayıyor: çabuk saklan! Ebenin görüş konisinden ve duvarların önünden uzak dur. Fırsat bulursan ağaca koş, kendini sobele.`, en: `${this.ebe.name} is counting at the tree: hide, quick! Keep out of the ebe's line of sight. If you get the chance, run to the tree and touch it to be safe.` })
      : L({ tr: 'Sen ebesin: ağaçta sayıyorsun, ötekiler saklanıyor… Sonra ara! Birini görünce ağaca ondan önce koş.', en: "You're ebe: you count at the tree while the others hide… Then go looking! When you see someone, beat them back to the tree." }), 6500);
    const loop = () => { this.tick(); this.draw(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
    if (import.meta.env.DEV) (window as unknown as { dackaHide: HideSeekView }).dackaHide = this;
  }

  close() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('keyup', this.onKey, true);
    this.el.remove();
    if (!this.ended) this.finish(true);
  }
  private finish(quit: boolean) {
    if (this.ended) return;
    this.ended = true;
    this.phase = 'over';
    const caught = this.hiders.filter((h) => h.state === 'caught').length;
    this.done({ role: this.o.role, safe: this.me.state === 'safe', caught, of: this.hiders.length, quit });
    const q = this.el.querySelector('.pg-quit') as HTMLElement;
    q.textContent = L({ tr: 'Kapat (Enter)', en: 'Close (Enter)' });
    q.className = 'primary pg-quit';
  }
  private say(t: string, ms = 2500) { this.msg = t; this.msgUntil = performance.now() + ms; }
  private flashText(t: string) { this.flash = t; this.flashUntil = performance.now() + 1300; }
  private local(e: PointerEvent): [number, number] { const r = this.cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]; }

  /** can the ebe see this hider right now? */
  private sees(h: Kid): boolean {
    const e = this.ebe, d = dist(e.x, e.y, h.x, h.y);
    if (d < NEAR) return true;
    if (d > SIGHT) return false;
    if (Math.abs(angDiff(Math.atan2(h.y - e.y, h.x - e.x), e.face)) > HALF_FOV) return false;
    return !blocked(e.x, e.y, h.x, h.y);
  }

  // ---------- the loop ----------

  private tick() {
    const now = performance.now();
    const dt = Math.min(0.04, (now - this.last) / 1000);
    this.last = now;
    if (this.ended) return;
    const t = now - this.startAt;
    if (this.phase === 'count' && t > COUNT_MS) {
      this.phase = 'seek';
      this.ebe.face = -Math.PI / 2;
      this.flashText(this.o.role === 'hide' ? L({ tr: '"Önüm arkam sağım solum sobe! Saklanmayan ebe!"', en: '"Ready or not, here I come!"' }) : L({ tr: 'Ara bakalım!', en: 'Go and find them!' }));
      sfx.bell();
    }
    if (t > GAME_MS) {
      // time's up: whoever's still hidden got away with it
      for (const h of this.hiders) if (h.state === 'hiding' || h.state === 'running') h.state = 'safe';
      this.say(L({ tr: '⏱ Süre bitti: saklananlar kurtuldu!', en: "⏱ Time's up: everyone still hidden got away!" }), 999_999);
      this.finish(false);
      return;
    }
    this.moveMe(dt);
    // the ebe stands still at the tree while counting (you, too, if you're ebe)
    if (this.phase === 'count' && this.ebe.me) { this.me.vx = 0; this.me.vy = 0; }
    if (!this.ebe.me) this.ebeAi(dt, now);
    for (const h of this.hiders) if (!h.me) this.hiderAi(h, dt, now);
    for (const k of [this.ebe, ...this.hiders]) {
      if (k.state === 'caught' || (k.state === 'safe' && !k.me)) continue;
      k.x += k.vx * dt; k.y += k.vy * dt;
      pushOut(k);
      if (Math.hypot(k.vx, k.vy) > 10 && !(k === this.ebe && this.phase === 'count')) k.face = Math.atan2(k.vy, k.vx);
    }
    if (this.phase !== 'seek') return;
    // spotting: the ebe sees a hider who isn't home yet
    if (!this.race) {
      for (const h of this.hiders) {
        if (h.state !== 'hiding' && h.state !== 'running') continue;
        if (!this.sees(h)) continue;
        this.race = h; h.state = 'running';
        this.flashText(L({ tr: `"${h.me ? this.o.me.name : h.name}, gördüm!"`, en: `"${h.me ? this.o.me.name : h.name}, I see you!"` }));
        this.say(h.me ? L({ tr: 'Seni gördü! Ağaca ondan önce koş!', en: 'Spotted! Beat them to the tree!' }) : this.ebe.me ? L({ tr: `${h.name}'i gördün! Ağaca ondan önce koş!`, en: `You spotted ${h.name}! Beat them back to the tree!` }) : L({ tr: `${this.ebe.name}, ${h.name}'i gördü!`, en: `${this.ebe.name} spotted ${h.name}!` }), 1800);
        sfx.warn();
        break;
      }
    }
    // the tree: whoever touches it first
    const home = (k: Kid) => dist(k.x, k.y, BASE[0], BASE[1]) < 22;
    for (const h of this.hiders) {
      if (h.state !== 'hiding' && h.state !== 'running') continue;
      if (home(h)) {
        h.state = 'safe'; if (this.race === h) this.race = null;
        this.flashText(L({ tr: `"Sobe!" ${h.me ? '' : h.name} kurtuldu`, en: `"Home free!" ${h.me ? 'you' : h.name}` }));
        if (h.me) sfx.success(); else sfx.hop();
      }
    }
    if (this.race && home(this.ebe)) {
      const h = this.race;
      h.state = 'caught'; this.race = null;
      this.flashText(L({ tr: `"Sobe ${h.me ? this.o.me.name : h.name}!"`, en: `"Got you, ${h.me ? this.o.me.name : h.name}!"` }));
      sfx.bump();
    }
    // (hiding, it's over for you once you're home or caught)
    if (this.hiders.every((h) => h.state === 'safe' || h.state === 'caught') || (this.o.role === 'hide' && (this.me.state === 'safe' || this.me.state === 'caught'))) this.endGame();
  }

  private endGame() {
    const caught = this.hiders.filter((h) => h.state === 'caught').length;
    if (this.o.role === 'hide') this.say(this.me.state === 'safe' ? L({ tr: '🏆 Kendini sobeledin: kurtuldun!', en: '🏆 Home free: you got away!' }) : L({ tr: `${this.ebe.name} seni sobeledi. Bir dahakine ebe sensin!`, en: `${this.ebe.name} caught you. You're ebe next time!` }), 999_999);
    else this.say(caught * 2 >= this.hiders.length ? L({ tr: `🏆 ${this.hiders.length} kişiden ${caught} tanesini sobeledin!`, en: `🏆 You caught ${caught} of ${this.hiders.length}!` }) : L({ tr: `${this.hiders.length} kişiden yalnızca ${caught} tanesini yakalayabildin.`, en: `You only caught ${caught} of ${this.hiders.length}.` }), 999_999);
    if ((this.o.role === 'hide' && this.me.state === 'safe') || (this.o.role === 'seek' && caught * 2 >= this.hiders.length)) sfx.success();
    this.finish(false);
  }

  private moveMe(dt: number) {
    const me = this.me;
    if (me.state === 'caught' || (me.state === 'safe' && !this.ebe.me)) { me.vx = me.vy = 0; return; }
    let x = 0, y = 0;
    if (this.keys.has('a') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('w') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('s') || this.keys.has('ArrowDown')) y += 1;
    if (!x && !y && this.joy) {
      const dx = this.joy.x - this.joy.ox, dy = this.joy.y - this.joy.oy, d = Math.hypot(dx, dy);
      if (d > 8) { x = dx / Math.max(d, 40); y = dy / Math.max(d, 40); }
    }
    const len = Math.hypot(x, y), sp = me.speed, k = Math.min(1, dt * 14);
    me.vx += ((len ? (x / Math.max(1, len)) * sp : 0) - me.vx) * k;
    me.vy += ((len ? (y / Math.max(1, len)) * sp : 0) - me.vy) * k;
  }

  private steer(k: Kid, tx: number, ty: number, dt: number, pace = 1) {
    let dx = tx - k.x, dy = ty - k.y;
    const d = Math.hypot(dx, dy);
    // round whatever is in the way: lean off to the side when the straight line is blocked
    if (d > 30 && blocked(k.x, k.y, k.x + (dx / d) * 30, k.y + (dy / d) * 30)) { const s = (k.plan % 2 ? 1 : -1); const nx = -dy * s, ny = dx * s; dx = dx * 0.3 + nx; dy = dy * 0.3 + ny; }
    const n = Math.hypot(dx, dy) || 1, sp = d < 3 ? 0 : k.speed * pace * Math.min(1, d / 24), kk = Math.min(1, dt * 9);
    k.vx += ((dx / n) * sp - k.vx) * kk; k.vy += ((dy / n) * sp - k.vy) * kk;
  }

  /** a classmate as ebe: counts, then checks the hiding places one by one, keeping half an eye on the tree */
  private ebeAi(dt: number, now: number) {
    const e = this.ebe;
    if (this.phase === 'count') { e.vx = e.vy = 0; return; }
    if (this.race) { this.steer(e, BASE[0], BASE[1], dt, 1.05); return; }
    if (now > e.plan || dist(e.x, e.y, e.spot[0], e.spot[1]) < 14) {
      // the nearest hiding place not looked at yet (or back by the tree now and then)
      const open = SPOTS.map((s, i) => ({ s, i })).filter(({ i }) => !this.checked.has(i));
      if (!open.length) this.checked.clear();
      const pick = Math.random() < 0.18 ? { s: [BASE[0] + (Math.random() - 0.5) * 80, BASE[1] - 60] as [number, number], i: -1 }
        : open.sort((a, b) => dist(e.x, e.y, a.s[0], a.s[1]) - dist(e.x, e.y, b.s[0], b.s[1]))[Math.floor(Math.random() * Math.min(2, open.length))] ?? { s: BASE, i: -1 };
      if (pick.i >= 0) this.checked.add(pick.i);
      e.spot = [pick.s[0], pick.s[1]];
      e.plan = now + 4500;
    }
    this.steer(e, e.spot[0], e.spot[1], dt, 0.8);
    // look round as they go
    if (Math.hypot(e.vx, e.vy) < 20) e.face += dt * 2.2;
  }

  /** a classmate hiding: go to their spot and keep still; creep home when the ebe is far off; sprint when spotted */
  private hiderAi(h: Kid, dt: number, now: number) {
    if (h.state === 'safe' || h.state === 'caught') { h.vx = h.vy = 0; return; }
    if (h.state === 'running') { this.steer(h, BASE[0], BASE[1], dt, 1.05); return; }
    if (this.phase === 'seek' && now > h.plan) {
      h.plan = now + 1000;
      const e = this.ebe;
      const far = dist(e.x, e.y, BASE[0], BASE[1]) > 200 && dist(e.x, e.y, h.x, h.y) > 120;
      if (far && Math.random() < 0.08 + h.skill * 0.1) h.state = 'running';
    }
    this.steer(h, h.spot[0], h.spot[1], dt, this.phase === 'count' ? 1 : 0.5);
  }

  // ---------- drawing ----------

  private draw() {
    const c = this.c, now = performance.now();
    c.fillStyle = '#6f9e55'; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(40,70,30,0.15)'; for (let i = 0; i < 90; i++) c.fillRect((i * 83) % W, (i * 47 + (i % 5) * 29) % H, 2, 2);
    // the sobe tree's trunk and the worn ground round it
    c.fillStyle = '#b8955f'; c.beginPath(); c.arc(BASE[0], BASE[1], 26, 0, Math.PI * 2); c.fill();
    for (const r of RECTS) {
      c.fillStyle = r.kind === 'shed' ? '#8d6b4a' : r.kind === 'wall' ? '#a89f8e' : '#7a5434';
      c.fillRect(r.x, r.y, r.w, r.h);
      c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(r.x, r.y, r.w, 3);
      if (r.kind === 'shed') { c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1; for (let x = r.x + 8; x < r.x + r.w; x += 8) { c.beginPath(); c.moveTo(x, r.y); c.lineTo(x, r.y + r.h); c.stroke(); } }
    }
    // the sobe tree (drawn small, so whoever touches it still shows)
    c.fillStyle = '#5a3d22'; c.fillRect(BASE[0] - 4, BASE[1] - 22, 8, 16);
    c.fillStyle = '#2f6b45'; c.beginPath(); c.arc(BASE[0], BASE[1] - 30, 14, 0, Math.PI * 2); c.fill();
    c.font = 'bold 10px system-ui, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#fff6c8'; c.fillText(L({ tr: 'SOBE', en: 'HOME' }), BASE[0], BASE[1] + 24);
    const people = [this.ebe, ...this.hiders.filter((h) => h !== this.ebe)];
    // the ebe's cone (seeking, a classmate as ebe: you see where they're looking)
    if (this.phase === 'seek' && !this.ebe.me) {
      const e = this.ebe;
      c.fillStyle = 'rgba(255,240,150,0.22)'; c.beginPath(); c.moveTo(e.x, e.y); c.arc(e.x, e.y, SIGHT, e.face - HALF_FOV, e.face + HALF_FOV); c.closePath(); c.fill();
    }
    for (const k of people.sort((a, b) => a.y - b.y)) {
      // you're ebe: you only see whoever's in your sight (and anyone already home or caught)
      if (this.ebe.me && !k.me && (k.state === 'hiding') && !this.sees(k) && this.phase !== 'over') continue;
      this.person(k);
    }
    for (const b of BUSHES) {
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.beginPath(); c.ellipse(b.x + 4, b.y + 6, b.r, b.r * 0.7, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = b.kind === 'tree' ? '#2f6b45' : '#3d8052'; c.beginPath(); c.arc(b.x, b.y, b.r, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(160,220,140,0.35)'; c.beginPath(); c.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.5, 0, Math.PI * 2); c.fill();
    }
    // you're ebe: the dark outside your cone
    if (this.ebe.me && this.phase !== 'over') {
      const e = this.ebe;
      c.fillStyle = this.phase === 'count' ? 'rgba(8,10,16,0.88)' : 'rgba(8,10,16,0.55)';
      c.beginPath(); c.rect(0, 0, W, H);
      if (this.phase === 'seek') { c.moveTo(e.x, e.y); c.arc(e.x, e.y, SIGHT, e.face + HALF_FOV, e.face - HALF_FOV, true); c.closePath(); }
      c.fill('evenodd');
      if (this.phase === 'seek') { c.fillStyle = 'rgba(8,10,16,0.55)'; c.beginPath(); c.arc(e.x, e.y, NEAR, 0, Math.PI * 2); c.fill(); }
    }
    // counting
    if (this.phase === 'count') {
      const n = Math.min(10, Math.floor(((now - this.startAt) / COUNT_MS) * 10) + 1);
      c.font = 'bold 40px system-ui, sans-serif'; c.textAlign = 'center';
      c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 5; c.strokeText(`${n}…`, W / 2, H / 2);
      c.fillStyle = '#fff6c8'; c.fillText(`${n}…`, W / 2, H / 2);
    }
    if (now < this.flashUntil) {
      c.font = 'bold 20px system-ui, sans-serif'; c.textAlign = 'center';
      c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 5; c.strokeText(this.flash, W / 2, 30);
      c.fillStyle = '#fff6c8'; c.fillText(this.flash, W / 2, 30);
    }
    if (this.joy) {
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 2; c.beginPath(); c.arc(this.joy.ox, this.joy.oy, 32, 0, Math.PI * 2); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.4)'; c.beginPath(); c.arc(this.joy.x, this.joy.y, 13, 0, Math.PI * 2); c.fill();
    }
    const left = Math.max(0, Math.ceil((GAME_MS - (now - this.startAt)) / 1000));
    (this.el.querySelector('.hs-time') as HTMLElement).textContent = `⏱ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    const safe = this.hiders.filter((h) => h.state === 'safe').length, caught = this.hiders.filter((h) => h.state === 'caught').length;
    (this.el.querySelector('.hs-score') as HTMLElement).textContent = `${L({ tr: 'Ebe', en: 'Ebe' })}: ${this.ebe.me ? this.o.me.name : this.ebe.name} · ${L({ tr: 'Kurtulan', en: 'Home free' })}: ${safe} · ${L({ tr: 'Sobelenen', en: 'Caught' })}: ${caught} / ${this.hiders.length}`;
    let line = now < this.msgUntil ? this.msg : '';
    if (!line) {
      if (this.phase === 'count') line = this.ebe.me ? L({ tr: 'Sayıyorsun… gözlerin kapalı.', en: "You're counting… eyes shut." }) : L({ tr: 'Ebe sayıyor: saklan!', en: 'The ebe is counting: hide!' });
      else if (this.ebe.me) line = this.race ? L({ tr: `Ağaca koş, ${this.race.name}'den önce!`, en: `Run to the tree before ${this.race.name}!` }) : L({ tr: 'Ara: duvarların, barakaların, çalıların arkasına bak. Ağaçtan çok uzaklaşırsan kaçıp sobelerler!', en: "Look behind the walls, sheds and bushes. Stray too far from the tree and they'll sneak home!" });
      else if (this.me.state === 'running') line = L({ tr: 'Koş! Ağaca ebeden önce dokun!', en: 'Run! Touch the tree before the ebe!' });
      else if (this.me.state === 'safe') line = L({ tr: 'Kurtuldun. Ötekileri izle…', en: "You're home free. Watch the others…" });
      else line = L({ tr: 'Ebenin sarı görüş alanından uzak dur. Ebe uzaktayken ağaca koşup kendini sobeleyebilirsin.', en: "Keep out of the ebe's yellow line of sight. When they're far off, run to the tree to be safe." });
    }
    (this.el.querySelector('.hs-status') as HTMLElement).textContent = line;
  }

  private person(k: Kid) {
    const c = this.c;
    const isEbe = k === this.ebe;
    c.globalAlpha = k.state === 'caught' ? 0.45 : 1;
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(k.x, k.y + 8, 10, 4, 0, 0, Math.PI * 2); c.fill();
    if (k.me) { c.strokeStyle = '#f2c14e'; c.lineWidth = 2; c.beginPath(); c.ellipse(k.x, k.y + 8, 13, 5.5, 0, 0, Math.PI * 2); c.stroke(); }
    c.fillStyle = isEbe ? '#c0392b' : k.me ? '#6e1f2d' : '#2e6fb0'; c.beginPath(); c.roundRect(k.x - 7, k.y - 9, 14, 12, 4); c.fill();
    c.fillStyle = k.skin; c.beginPath(); c.arc(k.x, k.y - 15, 6, 0, Math.PI * 2); c.fill();
    c.fillStyle = k.hair; c.beginPath(); c.arc(k.x, k.y - 17, 6, Math.PI, Math.PI * 2); c.fill();
    c.font = 'bold 10px system-ui, sans-serif'; c.textAlign = 'center';
    c.strokeStyle = 'rgba(0,0,0,0.65)'; c.lineWidth = 3; c.lineJoin = 'round';
    const tag = isEbe ? ' 👁' : k.state === 'safe' ? ' ✓' : k.state === 'caught' ? ' ✗' : '';
    const name = (k.me ? this.o.me.name : k.name) + tag;
    c.strokeText(name, k.x, k.y - 26); c.fillStyle = k.me ? '#f2c14e' : '#ffffff'; c.fillText(name, k.x, k.y - 26);
    c.globalAlpha = 1;
  }
}

let styled = false;
function injectStyles() {
  if (styled) return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = `
.hs-card { width: min(560px, 100%); }
.hs-card canvas { width: 100%; height: auto; display: block; border-radius: 8px; touch-action: none; }
.hs-time { font-size: 12px; opacity: 0.8; }
.hs-score { font-size: 14px !important; }
`;
  document.head.appendChild(s);
}

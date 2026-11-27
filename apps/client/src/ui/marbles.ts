// Misket, the ring game: a circle scratched in the dirt with the marbles both of you put in at its middle. Take turns
// flicking your shooter ("atıcı") from the line; every marble you knock out of the ring is yours, and while you keep
// knocking them out you go again from wherever your shooter stopped. Knock none out and it's their turn. When the
// ring is empty, whoever has more wins. Aim by pulling the shooter back like a slingshot with the mouse or a finger,
// or with the keys: W/S to move round the line, A/D to aim, hold Space and let go for the strength.
import { L } from '../i18n';
import { sfx } from '../audio';
import { injectPeerGameStyles } from './yetimball';

export interface MarblesOpts { me: string; them: string; /** their skill, 0–1 */ skill: number }
export interface MarblesResult { mine: number; theirs: number; quit: boolean }

const W = 440, H = 440, CX = W / 2, CY = H / 2;
const RING = 150;
const MR = 7, SR = 9;
const PULL = 120;
const METER_MS = 1100;

interface Marble { x: number; y: number; vx: number; vy: number; r: number; m: number; color: string; shooter?: 0 | 1; out?: boolean }

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const COLORS = ['#3b7dd8', '#2f9a6a', '#d8a63b', '#c0392b', '#8e5bd1', '#e07a5f'];

export class MarblesView {
  readonly el: HTMLElement;
  private cv: HTMLCanvasElement;
  private c: CanvasRenderingContext2D;
  private marbles: Marble[] = [];
  private shooter: Marble | null = null;
  /** whose turn it is (0 = you) and what's happening */
  private turn: 0 | 1 = 0;
  private phase: 'aim' | 'rolling' | 'thinking' | 'over' = 'aim';
  /** where on the line you shoot from (an angle round the ring), and which way you aim */
  private at = Math.PI / 2;
  private aim = -Math.PI / 2;
  private fromLine = true;
  private charging: number | null = null;
  private drag: { x: number; y: number; id: number } | null = null;
  private keys = new Set<string>();
  private won: [number, number] = [0, 0];
  private outThisShot = 0;
  private msg = ''; private msgUntil = 0;
  private last = performance.now();
  private raf = 0;
  private ended = false;
  private done!: (r: MarblesResult) => void;
  readonly result: Promise<MarblesResult>;
  private onKey = (e: KeyboardEvent) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter'].includes(k)) return;
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'keydown') {
      if (e.repeat) return;
      this.keys.add(k);
      if (k === ' ' && this.myAim()) this.charging = performance.now();
      if (k === 'Enter' && this.ended) this.close();
    } else {
      this.keys.delete(k);
      if (k === ' ' && this.charging !== null) { const p = this.meterAt(performance.now()); this.charging = null; if (this.myAim()) this.shoot(this.aim, p); }
    }
  };

  constructor(host: HTMLElement, private o: MarblesOpts) {
    injectPeerGameStyles();
    injectStyles();
    this.result = new Promise((r) => { this.done = r; });
    // three each in the middle, in a little cross
    const spots: Array<[number, number]> = [[0, 0], [-20, 0], [20, 0], [0, -20], [0, 20], [14, 14]];
    spots.forEach(([dx, dy], i) => this.marbles.push({ x: CX + dx, y: CY + dy, vx: 0, vy: 0, r: MR, m: 1, color: COLORS[i] }));
    this.el = document.createElement('div');
    this.el.className = 'pg-overlay';
    this.el.innerHTML = `
      <div class="pg-card mb-card">
        <div class="yb-head"><b>🔵 ${L({ tr: 'Misket · halka', en: 'Marbles · the ring' })}</b><span class="yb-vs"></span></div>
        <div class="pg-score mb-score"></div>
        <canvas width="${W}" height="${H}"></canvas>
        <div class="pg-status mb-status"></div>
        <div class="pg-row"><button type="button" class="secondary pg-quit"></button><button type="button" class="primary mb-shoot"></button></div>
      </div>`;
    this.cv = this.el.querySelector('canvas')!;
    this.c = this.cv.getContext('2d')!;
    this.el.querySelector('.yb-vs')!.textContent = `${o.me} · ${o.them}`;
    (this.el.querySelector('.pg-quit') as HTMLElement).textContent = L({ tr: 'Oyundan çık', en: 'Leave the game' });
    (this.el.querySelector('.mb-shoot') as HTMLElement).textContent = L({ tr: 'At (Boşluk, basılı tut)', en: 'Flick (hold Space)' });
    const btn = this.el.querySelector('.mb-shoot') as HTMLButtonElement;
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); if (this.myAim()) this.charging = performance.now(); });
    btn.addEventListener('pointerup', (e) => { e.preventDefault(); if (this.charging !== null) { const p = this.meterAt(performance.now()); this.charging = null; if (this.myAim()) this.shoot(this.aim, p); } });
    this.el.querySelector('.pg-quit')!.addEventListener('click', () => { if (!this.ended) this.finish(true); this.close(); });
    this.cv.addEventListener('pointerdown', (e) => this.pointerDown(e));
    this.cv.addEventListener('pointermove', (e) => this.pointerMove(e));
    this.cv.addEventListener('pointerup', (e) => this.pointerUp(e));
    this.cv.addEventListener('pointercancel', () => { this.drag = null; });
    window.addEventListener('keydown', this.onKey, true);
    window.addEventListener('keyup', this.onKey, true);
    host.appendChild(this.el);
    this.placeShooter();
    this.say(L({ tr: 'Sıra sende. Atıcını çizgide istediğin yere koy (çizgiye tıkla ya da W/S), sonra sapan gibi geri çek ve bırak. Klavyeyle: A/D nişan, Boşluk güç.', en: "Your turn. Put your shooter anywhere on the line (click the line, or W/S), then pull it back like a slingshot and let go. Keys: A/D aim, Space for strength." }), 7000);
    const loop = () => { this.tick(); this.draw(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
    if (import.meta.env.DEV) (window as unknown as { dackaMarbles: MarblesView }).dackaMarbles = this;
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
    this.done({ mine: this.won[0], theirs: this.won[1], quit });
    const q = this.el.querySelector('.pg-quit') as HTMLElement;
    q.textContent = L({ tr: 'Kapat (Enter)', en: 'Close (Enter)' });
    q.className = 'primary pg-quit';
    (this.el.querySelector('.mb-shoot') as HTMLElement).style.display = 'none';
  }
  private say(t: string, ms = 2500) { this.msg = t; this.msgUntil = performance.now() + ms; }
  private local(e: PointerEvent): [number, number] { const r = this.cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]; }
  private myAim() { return !this.ended && this.turn === 0 && this.phase === 'aim'; }
  private meterAt(now: number) { const t = ((now - (this.charging ?? now)) % METER_MS) / METER_MS; return t < 0.5 ? t * 2 : 2 - t * 2; }

  // ---------- turns ----------

  /** the shooter on the line (a new turn), or left where it stopped (going again) */
  private placeShooter() {
    if (this.fromLine || !this.shooter) {
      const color = this.turn === 0 ? '#f4f0e6' : '#2b2b30';
      this.shooter = { x: CX + Math.cos(this.at) * RING, y: CY + Math.sin(this.at) * RING, vx: 0, vy: 0, r: SR, m: 1.4, color, shooter: this.turn };
      this.aim = Math.atan2(CY - this.shooter.y, CX - this.shooter.x);
    }
    this.phase = this.turn === 0 ? 'aim' : 'thinking';
    if (this.turn === 1) window.setTimeout(() => this.botShot(), 900 + Math.random() * 700);
  }

  private moveOnLine(a: number) {
    if (!this.fromLine || !this.shooter) return;
    this.at = a;
    this.shooter.x = CX + Math.cos(a) * RING; this.shooter.y = CY + Math.sin(a) * RING;
  }

  private shoot(aim: number, power: number) {
    const s = this.shooter!;
    const speed = 140 + 620 * clamp(power, 0, 1);
    s.vx = Math.cos(aim) * speed; s.vy = Math.sin(aim) * speed;
    this.outThisShot = 0;
    this.phase = 'rolling';
    sfx.click();
  }

  /** everything has stopped: who keeps what, and whose go it is */
  private settled() {
    const s = this.shooter!;
    const left = this.marbles.filter((m) => !m.out);
    if (!left.length) { this.end(); return; }
    if (this.outThisShot > 0) {
      // knocked one out: go again, from where the shooter stopped (or back on the line if it rolled out)
      this.fromLine = dist(s.x, s.y, CX, CY) > RING;
      if (this.fromLine) this.at = Math.atan2(s.y - CY, s.x - CX);
      this.say(this.turn === 0 ? L({ tr: `Çıkardın! ${this.outThisShot > 1 ? `${this.outThisShot} misket! ` : ''}Bir daha at.`, en: `Knocked out! ${this.outThisShot > 1 ? `${this.outThisShot} marbles! ` : ''}Go again.` }) : L({ tr: `${this.o.them} bir misket çıkardı, yine atıyor.`, en: `${this.o.them} knocked one out and goes again.` }));
    } else {
      this.turn = this.turn === 0 ? 1 : 0;
      this.fromLine = true;
      this.at = this.turn === 0 ? Math.PI / 2 : -Math.PI / 2;
      this.say(this.turn === 0 ? L({ tr: 'Sıra sende.', en: 'Your turn.' }) : L({ tr: `Hiçbirini çıkaramadın. Sıra ${this.o.them}'da.`, en: `Nothing out. ${this.o.them}'s turn.` }));
    }
    this.placeShooter();
  }

  private end() {
    const [a, b] = this.won;
    this.say(a > b ? L({ tr: `🏆 Kazandın! ${a}–${b}`, en: `🏆 You win! ${a}–${b}` }) : a < b ? L({ tr: `${this.o.them} kazandı: ${b}–${a}`, en: `${this.o.them} wins: ${b}–${a}` }) : L({ tr: `Berabere: ${a}–${b}`, en: `A draw: ${a}–${b}` }), 999_999);
    if (a > b) sfx.success();
    this.finish(false);
  }

  // ---------- the classmate's go ----------

  private botShot() {
    if (this.ended || this.turn !== 1) return;
    const s = this.shooter!, skill = this.o.skill;
    const left = this.marbles.filter((m) => !m.out);
    // from the line: stand opposite the marble nearest the edge, so it goes straight out; from inside: whichever lines up best
    let target = left[0], best = -Infinity;
    for (const m of left) {
      const fromC = dist(m.x, m.y, CX, CY);
      if (this.fromLine) { const sc = fromC + Math.random() * 20; if (sc > best) { best = sc; target = m; } }
      else {
        const ux = (m.x - s.x), uy = (m.y - s.y), d = Math.hypot(ux, uy), ox = m.x - CX, oy = m.y - CY, od = Math.hypot(ox, oy) || 1;
        const sc = ((ux * ox + uy * oy) / (d * od)) * 60 + fromC * 0.4 - d * 0.15;
        if (sc > best) { best = sc; target = m; }
      }
    }
    if (this.fromLine) {
      const a = Math.atan2(target.y - CY, target.x - CX) + Math.PI + (Math.random() - 0.5) * 0.25;
      this.moveOnLine(a);
    }
    const aim = Math.atan2(target.y - s.y, target.x - s.x) + (Math.random() - 0.5) * (0.02 + (1 - skill) * 0.16);
    const d = dist(s.x, s.y, target.x, target.y);
    const power = clamp(0.45 + d / 500 + (Math.random() - 0.5) * 0.2, 0.3, 1);
    this.aim = aim;
    this.say(L({ tr: `${this.o.them} nişan alıyor…`, en: `${this.o.them} is taking aim…` }), 800);
    window.setTimeout(() => { if (!this.ended && this.turn === 1 && this.phase === 'thinking') this.shoot(aim, power); }, 700);
  }

  // ---------- pointer: put the shooter on the line, then pull it back ----------

  private pointerDown(e: PointerEvent) {
    if (!this.myAim()) return;
    const [x, y] = this.local(e), s = this.shooter!;
    if (dist(x, y, s.x, s.y) < 28) { this.drag = { x, y, id: e.pointerId }; this.cv.setPointerCapture(e.pointerId); return; }
    // a click on the line moves the shooter there
    if (this.fromLine && Math.abs(dist(x, y, CX, CY) - RING) < 22) { this.moveOnLine(Math.atan2(y - CY, x - CX)); this.aim = Math.atan2(CY - s.y, CX - s.x); }
  }
  private pointerMove(e: PointerEvent) {
    if (this.drag?.id !== e.pointerId) return;
    const [x, y] = this.local(e); this.drag.x = x; this.drag.y = y;
    const s = this.shooter!;
    if (dist(x, y, s.x, s.y) > 6) this.aim = Math.atan2(s.y - y, s.x - x);
  }
  private pointerUp(e: PointerEvent) {
    if (this.drag?.id !== e.pointerId) return;
    const s = this.shooter!, d = dist(this.drag.x, this.drag.y, s.x, s.y);
    const aim = Math.atan2(s.y - this.drag.y, s.x - this.drag.x);
    this.drag = null;
    if (d < 12 || !this.myAim()) return;
    this.aim = aim;
    this.shoot(aim, Math.min(1, d / PULL));
  }

  // ---------- physics ----------

  private tick() {
    const now = performance.now();
    const dt = Math.min(0.04, (now - this.last) / 1000);
    this.last = now;
    if (this.ended) return;
    if (this.myAim()) {
      if (this.keys.has('a') || this.keys.has('ArrowLeft')) this.aim -= dt * 1.6;
      if (this.keys.has('d') || this.keys.has('ArrowRight')) this.aim += dt * 1.6;
      if (this.fromLine && (this.keys.has('w') || this.keys.has('ArrowUp'))) { this.moveOnLine(this.at - dt * 1.2); }
      if (this.fromLine && (this.keys.has('s') || this.keys.has('ArrowDown'))) { this.moveOnLine(this.at + dt * 1.2); }
    }
    if (this.phase !== 'rolling') return;
    const all = [...this.marbles.filter((m) => !m.out), this.shooter!];
    const steps = 4, h = dt / steps;
    for (let k = 0; k < steps; k++) {
      for (const m of all) {
        m.x += m.vx * h; m.y += m.vy * h;
        const f = Math.pow(0.32, h); m.vx *= f; m.vy *= f;
        if (Math.hypot(m.vx, m.vy) < 6) { m.vx = 0; m.vy = 0; }
        // the edge of the play area: they stop against it
        if (m.x < m.r || m.x > W - m.r) { m.x = clamp(m.x, m.r, W - m.r); m.vx = -m.vx * 0.3; }
        if (m.y < m.r || m.y > H - m.r) { m.y = clamp(m.y, m.r, H - m.r); m.vy = -m.vy * 0.3; }
      }
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) this.collide(all[i], all[j]);
    }
    // anything that has rolled out of the ring is out (it's the shooter's, unless it's the shooter itself)
    for (const m of this.marbles) {
      if (m.out || dist(m.x, m.y, CX, CY) <= RING + m.r * 0.2) continue;
      if (Math.hypot(m.vx, m.vy) > 40 && dist(m.x, m.y, CX, CY) < RING + 20) continue; // (wait until it's clearly over the line)
      this.knockOut(m);
      sfx.hop();
    }
    if (all.every((m) => m.vx === 0 && m.vy === 0)) {
      // the last ones over the line count once they've stopped
      for (const m of this.marbles) if (!m.out && dist(m.x, m.y, CX, CY) > RING) this.knockOut(m);
      this.settled();
    }
  }

  private knockOut(m: Marble) {
    m.out = true;
    this.outOrder.set(m, this.turn);
    this.won[this.turn]++;
    this.outThisShot++;
  }

  private collide(a: Marble, b: Marble) {
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = a.r + b.r;
    if (d >= min || d < 1e-6) return;
    const nx = dx / d, ny = dy / d;
    const overlap = (min - d) / (a.m + b.m);
    a.x -= nx * overlap * b.m; a.y -= ny * overlap * b.m; b.x += nx * overlap * a.m; b.y += ny * overlap * a.m;
    const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
    if (rel <= 0) return;
    const j = (1.85 * rel) / (1 / a.m + 1 / b.m);
    a.vx -= (j / a.m) * nx; a.vy -= (j / a.m) * ny; b.vx += (j / b.m) * nx; b.vy += (j / b.m) * ny;
    if (rel > 60) sfx.click();
  }

  // ---------- drawing ----------

  private draw() {
    const c = this.c, now = performance.now();
    // packed earth, a few pebbles, the ring scratched into it
    c.fillStyle = '#b08a5a'; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(80,55,30,0.18)';
    for (let i = 0; i < 70; i++) { const x = (i * 97) % W, y = (i * 61 + (i % 7) * 37) % H; c.beginPath(); c.arc(x, y, 1.5 + (i % 3), 0, Math.PI * 2); c.fill(); }
    c.strokeStyle = 'rgba(70,45,20,0.75)'; c.lineWidth = 3; c.beginPath(); c.arc(CX, CY, RING, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = 'rgba(255,240,210,0.25)'; c.lineWidth = 1; c.beginPath(); c.arc(CX, CY, RING + 2, 0, Math.PI * 2); c.stroke();
    for (const m of this.marbles) if (!m.out) this.marble(m);
    // the ones knocked out, in each player's pile
    const pile = (team: 0 | 1, y: number) => { let i = 0; for (const m of this.marbles) if (m.out && this.owner(m) === team) this.marble({ ...m, x: 22 + i++ * 18, y }); };
    pile(0, H - 18); pile(1, 18);
    const s = this.shooter;
    if (s) {
      // the aim: a dotted line (and how far you've pulled it back)
      if (this.myAim()) {
        const pull = this.drag ? Math.min(1, dist(this.drag.x, this.drag.y, s.x, s.y) / PULL) : this.charging !== null ? this.meterAt(now) : 0.35;
        c.setLineDash([4, 5]); c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x + Math.cos(this.aim) * (40 + pull * 120), s.y + Math.sin(this.aim) * (40 + pull * 120)); c.stroke(); c.setLineDash([]);
        if (this.drag) { c.strokeStyle = 'rgba(60,30,10,0.7)'; c.lineWidth = 2; c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(this.drag.x, this.drag.y); c.stroke(); }
        if (this.charging !== null) {
          const bx = s.x + 18, by = s.y - 40, bh = 36;
          c.fillStyle = 'rgba(20,24,28,0.75)'; c.fillRect(bx, by, 8, bh);
          c.fillStyle = '#f2c14e'; c.fillRect(bx + 1, by + bh * (1 - this.meterAt(now)), 6, bh * this.meterAt(now));
        }
      } else if (this.turn === 1 && this.phase === 'thinking') {
        c.setLineDash([3, 6]); c.strokeStyle = 'rgba(20,20,20,0.5)'; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x + Math.cos(this.aim) * 60, s.y + Math.sin(this.aim) * 60); c.stroke(); c.setLineDash([]);
      }
      this.marble(s);
    }
    (this.el.querySelector('.mb-score') as HTMLElement).textContent = `${this.o.me} ${this.won[0]} – ${this.won[1]} ${this.o.them} · ${L({ tr: 'halkada', en: 'in the ring' })}: ${this.marbles.filter((m) => !m.out).length}`;
    let line = now < this.msgUntil ? this.msg : '';
    if (!line) line = this.ended ? '' : this.turn === 0
      ? (this.phase === 'rolling' ? L({ tr: 'Yuvarlanıyor…', en: 'Rolling…' }) : this.fromLine ? L({ tr: 'Çizgide yerini seç (tıkla ya da W/S), atıcıyı geri çekip bırak (ya da A/D + Boşluk).', en: 'Pick your spot on the line (click or W/S), pull the shooter back and let go (or A/D + Space).' }) : L({ tr: 'Atıcının durduğu yerden at: geri çek ve bırak.', en: 'Shoot from where your shooter stopped: pull back and let go.' }))
      : L({ tr: `Sıra ${this.o.them}'da…`, en: `${this.o.them}'s turn…` });
    (this.el.querySelector('.mb-status') as HTMLElement).textContent = line;
  }

  /** who knocked each marble out */
  private outOrder = new Map<Marble, 0 | 1>();
  private owner(m: Marble): 0 | 1 { return this.outOrder.get(m) ?? 0; }

  private marble(m: Marble) {
    const c = this.c;
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(m.x + 2, m.y + 3, m.r, m.r * 0.6, 0, 0, Math.PI * 2); c.fill();
    const g = c.createRadialGradient(m.x - m.r * 0.4, m.y - m.r * 0.4, 1, m.x, m.y, m.r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, m.color); g.addColorStop(1, 'rgba(0,0,0,0.55)');
    c.fillStyle = m.color; c.beginPath(); c.arc(m.x, m.y, m.r, 0, Math.PI * 2); c.fill();
    c.fillStyle = g; c.beginPath(); c.arc(m.x, m.y, m.r, 0, Math.PI * 2); c.fill();
    if (m.shooter !== undefined) { c.strokeStyle = m.shooter === 0 ? '#f2c14e' : '#9cc6ef'; c.lineWidth = 2; c.beginPath(); c.arc(m.x, m.y, m.r + 2, 0, Math.PI * 2); c.stroke(); }
  }
}

let styled = false;
function injectStyles() {
  if (styled) return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = `
.mb-card { width: min(480px, 100%); }
.mb-card canvas { width: 100%; height: auto; display: block; border-radius: 8px; touch-action: none; max-height: 62vh; object-fit: contain; }
.mb-card .mb-shoot { user-select: none; -webkit-user-select: none; touch-action: none; }
`;
  document.head.appendChild(s);
}

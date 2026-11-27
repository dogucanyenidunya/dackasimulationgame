// Yetimball: Daçka's name for tetherball. A ball hangs on a rope from a pole; each player keeps to their own half of the
// circle and hits the ball as it swings past, to send it round the pole their way. Every turn round the pole winds the
// rope shorter, and a shorter rope swings faster. Whoever winds it YB_WIN times round their way wins.
// It runs in real time: you run about your half with WASD / the arrow keys (or by dragging), and press Space as the
// ball comes past you; the closer you are, the harder the hit. Hit it the other way round the pole to undo their turns.
// Against a real player, whoever invited ("host") runs the ball: the guest sends where they are and when they hit,
// the host sends back where the ball is, about ten times a second. Against a classmate it all runs here.
import { L } from '../i18n';
import { sfx } from '../audio';

/** net turns of rope to win */
export const YB_WIN = 5;
const W = 520, H = 420;
const CX = W / 2, CY = H / 2;
/** the rope at full length, the circle you play in, the pole */
const R0 = 140, RING = R0 + 46, POLE = 30;
const REACH = 34;
/** the fastest a hit sends it round (radians a second; a shorter rope can push it a little past) */
const MAX_SPIN = 6;
const BALL = 12, BODY = 12;
const GAME_MS = 3 * 60_000;
/** how often the two sides tell each other where things are */
const SYNC_MS = 90;
/** no word from the other player for this long: the connection is gone */
const LOST_MS = 12_000;

export type YbResult = 'win' | 'lose' | 'quit' | 'abandoned' | 'lost';

interface Opts {
  me: string;
  them: string;
  /** the one who invited runs the ball, plays the bottom half and winds the + way */
  host: boolean;
  /** a message to the other player (n counts up) */
  send: (n: number, v: number | string) => void;
  /** you pressed "leave" */
  quit: () => void;
  /** the game is over (called once) */
  onEnd: (r: YbResult) => void;
  /** playing a classmate, not a real player: their skill (0–1) */
  bot?: number;
}

interface Body { x: number; y: number; vx: number; vy: number; cd: number; seen?: number }

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export class YetimballView {
  readonly el: HTMLElement;
  private cv: HTMLCanvasElement;
  private c: CanvasRenderingContext2D;
  // everything is kept in the host's frame: the host at the bottom (+y), the guest at the top
  /** where the ball is round the pole (π/2 = the bottom), how fast it goes round (+ = the host's way), net turns */
  private theta = Math.PI / 2;
  private omega = 0;
  private wind = 0;
  private r = R0;
  private host: Body = { x: CX, y: CY + R0 + 18, vx: 0, vy: 0, cd: 0 };
  private guest: Body = { x: CX, y: CY - R0 - 18, vx: 0, vy: 0, cd: 0 };
  private keys = new Set<string>();
  private joy: { ox: number; oy: number; x: number; y: number; id: number } | null = null;
  private n = 0;
  private lastSync = 0;
  private lastHeard = performance.now();
  private lastState = -1;
  private startAt = performance.now();
  private last = performance.now();
  private status = ''; private statusUntil = 0;
  private flash = ''; private flashUntil = 0;
  private ended = false;
  private raf = 0;
  private onKey = (e: KeyboardEvent) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter'].includes(k)) return;
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'keydown') { if (e.repeat) return; this.keys.add(k); if (k === ' ' || k === 'Enter') this.press(); }
    else this.keys.delete(k);
  };

  constructor(host: HTMLElement, private o: Opts) {
    injectStyles();
    this.el = document.createElement('div');
    this.el.className = 'yb-overlay';
    this.el.innerHTML = `
      <div class="yb-card">
        <div class="yb-head"><b>🪢 Yetimball</b><span class="yb-vs"></span></div>
        <div class="yb-bar"><span class="yb-them"></span><div class="yb-track"><i class="yb-mid"></i><i class="yb-mark"></i></div><span class="yb-me"></span></div>
        <canvas width="${W}" height="${H}"></canvas>
        <div class="yb-status"></div>
        <div class="yb-row"><button type="button" class="secondary yb-quit"></button><button type="button" class="primary yb-hit"></button></div>
      </div>`;
    this.cv = this.el.querySelector('canvas')!;
    this.c = this.cv.getContext('2d')!;
    this.el.querySelector('.yb-vs')!.textContent = `${o.me} · ${o.them}`;
    this.el.querySelector('.yb-them')!.textContent = `◀ ${o.them}`;
    this.el.querySelector('.yb-me')!.textContent = `${o.me} ▶`;
    (this.el.querySelector('.yb-quit') as HTMLElement).textContent = L({ tr: 'Oyundan çık', en: 'Leave the game' });
    (this.el.querySelector('.yb-hit') as HTMLElement).textContent = L({ tr: 'Vur! (Boşluk)', en: 'Hit! (Space)' });
    this.el.querySelector('.yb-hit')!.addEventListener('pointerdown', (e) => { e.preventDefault(); this.press(); });
    this.el.querySelector('.yb-quit')!.addEventListener('click', () => {
      if (this.ended) { this.close(); return; }
      this.o.quit();
      this.finish('quit');
      this.close();
    });
    this.cv.addEventListener('pointerdown', (e) => { const [x, y] = this.local(e); this.joy = { ox: x, oy: y, x, y, id: e.pointerId }; this.cv.setPointerCapture(e.pointerId); });
    this.cv.addEventListener('pointermove', (e) => { if (this.joy?.id === e.pointerId) { const [x, y] = this.local(e); this.joy.x = x; this.joy.y = y; } });
    const endJoy = (e: PointerEvent) => { if (this.joy?.id === e.pointerId) this.joy = null; };
    this.cv.addEventListener('pointerup', endJoy);
    this.cv.addEventListener('pointercancel', endJoy);
    window.addEventListener('keydown', this.onKey, true);
    window.addEventListener('keyup', this.onKey, true);
    host.appendChild(this.el);
    this.say(o.host
      ? L({ tr: 'Top senin tarafında asılı. Yanına koş ve Boşluk ile vur! Top geçerken vurursan ipi kendi yönüne sararsın.', en: "The ball hangs on your side. Run up to it and hit it with Space! Hit it as it swings past to wind the rope your way." })
      : L({ tr: `${o.them} ilk vuruşu yapacak. Kendi yarında kal, top geçerken Boşluk ile geri çevir!`, en: `${o.them} hits first. Stay in your half and hit it back with Space as it comes past!` }), 5000);
    const loop = () => { this.tick(); this.draw(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
    if (import.meta.env.DEV) (window as unknown as { dackaYb: YetimballView }).dackaYb = this;
  }

  // ---------- frames: the guest sees the court turned round, so both play from the bottom ----------

  private get mine(): Body { return this.o.host ? this.host : this.guest; }
  private get theirs(): Body { return this.o.host ? this.guest : this.host; }
  private mySign() { return this.o.host ? 1 : -1; }
  private myWind() { return this.wind * this.mySign(); }
  private view(x: number, y: number): [number, number] { return this.o.host ? [x, y] : [2 * CX - x, 2 * CY - y]; }
  private local(e: PointerEvent): [number, number] { const r = this.cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]; }
  private ball(): [number, number] { return [CX + Math.cos(this.theta) * this.r, CY + Math.sin(this.theta) * this.r]; }
  private say(t: string, ms = 2200) { this.status = t; this.statusUntil = performance.now() + ms; }
  private flashText(t: string) { this.flash = t; this.flashUntil = performance.now() + 900; }

  // ---------- hitting ----------

  /** Space: a hit, if the ball is in your half and in reach */
  private press() {
    if (this.ended) return;
    const me = this.mine;
    if (me.cd > 0) return;
    const [bx, by] = this.ball();
    const d = dist(me.x, me.y, bx, by);
    const inHalf = this.o.host ? by > CY - 4 : by < CY + 4;
    if (!inHalf || d > REACH) { me.cd = 0.25; this.say(!inHalf ? L({ tr: 'Top karşı tarafta: senin yarına gelmesini bekle.', en: "The ball's on their side: wait for it to come round." }) : L({ tr: 'Ulaşamadın: topa daha yakın dur!', en: "Out of reach: get closer to the ball!" }), 1200); return; }
    const q = clamp(1.05 - (d / REACH) * 0.7, 0.2, 1);
    me.cd = 0.4;
    this.applyHit(this.mySign(), q);
    if (!this.o.host && !this.o.bot) this.o.send(this.n++, `h ${q.toFixed(3)} ${me.x.toFixed(0)} ${me.y.toFixed(0)}`);
    this.flashText(q > 0.85 ? L({ tr: 'Tam isabet! 💥', en: 'Smashed it! 💥' }) : q > 0.55 ? L({ tr: 'İyi vuruş!', en: 'Good hit!' }) : L({ tr: 'Sıyırdın…', en: 'Just clipped it…' }));
  }

  /** a hit sends the ball round `sign`'s way; with it already going that way it picks up speed, against it turns it round */
  private applyHit(sign: number, q: number) {
    const along = this.omega * sign > 0 ? Math.abs(this.omega) * 0.25 : 0;
    this.omega = sign * clamp(2.0 + 2.6 * q + along, 0, MAX_SPIN);
    sfx.click();
  }

  // ---------- the loop ----------

  private tick() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.ended) return;
    this.moveMe(dt);
    for (const b of [this.host, this.guest]) {
      b.cd = Math.max(0, b.cd - dt);
      if (b !== this.mine && !this.o.bot) continue; // (the other player moves themselves; we hear where they are)
      b.x += b.vx * dt; b.y += b.vy * dt;
      this.keepIn(b, b === this.host);
    }
    if (this.o.bot) this.botStep(dt);
    // the ball: the host (or this game, against a classmate) runs it; the guest runs it on between updates
    const runs = this.o.host || !!this.o.bot;
    const r0 = this.r;
    this.theta += this.omega * dt;
    this.wind += (this.omega * dt) / (Math.PI * 2);
    this.r = R0 * clamp(1 - (0.72 * Math.abs(this.wind)) / YB_WIN, 0.22, 1);
    // a shorter rope swings faster (and slower again as it unwinds)
    if (runs) this.omega = clamp(this.omega * Math.pow(r0 / this.r, 2) * Math.pow(0.8, dt), -MAX_SPIN - 1, MAX_SPIN + 1);
    if (runs && Math.abs(this.omega) < 0.25) this.omega = 0;
    if (runs) {
      if (Math.abs(this.wind) >= YB_WIN) { this.decide(Math.sign(this.wind)); return; }
      if (now - this.startAt > GAME_MS) { this.decide(Math.sign(this.wind) || 1); return; }
    }
    // talk to the other player
    if (!this.o.bot && now - this.lastSync > SYNC_MS) {
      this.lastSync = now;
      const me = this.mine;
      if (this.o.host) this.o.send(this.n++, `s ${this.theta.toFixed(3)} ${this.omega.toFixed(3)} ${this.wind.toFixed(4)} ${me.x.toFixed(0)} ${me.y.toFixed(0)}`);
      else this.o.send(this.n++, `p ${me.x.toFixed(0)} ${me.y.toFixed(0)}`);
    }
    if (!this.o.bot && now - this.lastHeard > LOST_MS) {
      this.say(L({ tr: `${this.o.them} ile bağlantı koptu.`, en: `Lost the connection to ${this.o.them}.` }), 999_999);
      this.finish('lost');
    }
  }

  private moveMe(dt: number) {
    let x = 0, y = 0;
    if (this.keys.has('a') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('w') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('s') || this.keys.has('ArrowDown')) y += 1;
    if (!x && !y && this.joy) {
      const dx = this.joy.x - this.joy.ox, dy = this.joy.y - this.joy.oy, d = Math.hypot(dx, dy);
      if (d > 8) { x = dx / Math.max(d, 40); y = dy / Math.max(d, 40); }
    }
    // (the guest's screen is turned round)
    if (!this.o.host) { x = -x; y = -y; }
    const len = Math.hypot(x, y), sp = 165;
    const me = this.mine, k = Math.min(1, dt * 14);
    me.vx += ((len ? (x / Math.max(1, len)) * sp : 0) - me.vx) * k;
    me.vy += ((len ? (y / Math.max(1, len)) * sp : 0) - me.vy) * k;
  }

  /** your own half of the ring, clear of the pole */
  private keepIn(b: Body, bottom: boolean) {
    b.y = bottom ? Math.max(b.y, CY + BODY) : Math.min(b.y, CY - BODY);
    const d = dist(b.x, b.y, CX, CY);
    if (d > RING - BODY) { b.x = CX + ((b.x - CX) / d) * (RING - BODY); b.y = CY + ((b.y - CY) / d) * (RING - BODY); }
    if (d < POLE + BODY) { const a = Math.atan2(b.y - CY, b.x - CX); b.x = CX + Math.cos(a) * (POLE + BODY); b.y = CY + Math.sin(a) * (POLE + BODY); }
  }

  /** a classmate on the top half: runs to meet the ball where it comes in, and hits it back */
  private botStep(dt: number) {
    const skill = this.o.bot ?? 0.5, b = this.guest;
    const [bx, by] = this.ball();
    // where to wait: just inside their half on the side the ball comes in from (or under it, if it's hanging there)
    let a = -Math.PI / 2;
    if (Math.abs(this.omega) > 0.3) a = this.omega > 0 ? -Math.PI + 0.55 : -0.55;
    if (by < CY && Math.abs(this.omega) < 3) a = Math.atan2(by - CY, bx - CX);
    const rr = this.r + 14;
    let tx = CX + Math.cos(a) * rr, ty = Math.min(CY - BODY, CY + Math.sin(a) * rr);
    // close to the ball in their half: go for it
    if (by < CY + 4 && dist(b.x, b.y, bx, by) < 70) { tx = bx; ty = Math.min(CY - BODY, by - 6); }
    const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy), sp = (125 + skill * 55) * Math.min(1, d / 25);
    const k = Math.min(1, dt * 9);
    b.vx += ((d ? (dx / d) * sp : 0) - b.vx) * k; b.vy += ((d ? (dy / d) * sp : 0) - b.vy) * k;
    // the hit: when it's in reach, with a moment to react (better players react sooner and hit cleaner)
    const reachD = dist(b.x, b.y, bx, by);
    const inReach = b.cd <= 0 && by < CY + 4 && reachD < REACH;
    const now = performance.now();
    if (!inReach) { b.seen = undefined; return; }
    // a moment to react (better players are quicker), and it's already going their way fast enough: let it go
    b.seen ??= now + (130 - skill * 90) * (0.6 + Math.random() * 0.8);
    if (now < b.seen || this.omega < -MAX_SPIN * 0.75) return;
    b.seen = undefined;
    b.cd = 0.4;
    if (Math.random() < 0.16 - skill * 0.1) return; // a miss
    this.applyHit(-1, clamp(skill * 0.7 + Math.random() * 0.35 - (reachD / REACH) * 0.2, 0.15, 1));
  }

  private decide(sign: number) {
    const mine = sign === this.mySign();
    if (this.o.host && !this.o.bot) this.o.send(this.n++, `e ${sign}`);
    this.finish(mine ? 'win' : 'lose');
  }

  // ---------- the other player ----------

  /** a message from the other player */
  receive(n: number, v: number | string) {
    if (this.ended || typeof v !== 'string') return;
    this.lastHeard = performance.now();
    const [k, ...rest] = v.split(' ');
    const a = rest.map(Number);
    if (k === 'p' && this.o.host) { this.guest.x = a[0]; this.guest.y = a[1]; this.keepIn(this.guest, false); }
    else if (k === 'h' && this.o.host) {
      // their hit counts if the ball is still about where they hit it (it has run on a little while the message came)
      if (a.length >= 3) { this.guest.x = a[1]; this.guest.y = a[2]; this.keepIn(this.guest, false); }
      const [bx, by] = this.ball();
      const slack = REACH * 1.3 + Math.abs(this.omega) * this.r * 0.3;
      if (by < CY + slack * 0.5 && dist(this.guest.x, this.guest.y, bx, by) < slack) this.applyHit(-1, clamp(a[0], 0, 1));
    } else if (k === 's' && !this.o.host && n > this.lastState) {
      this.lastState = n;
      this.theta = a[0]; this.omega = a[1]; this.wind = a[2]; this.host.x = a[3]; this.host.y = a[4];
      this.r = R0 * clamp(1 - (0.72 * Math.abs(this.wind)) / YB_WIN, 0.22, 1);
    } else if (k === 'e' && !this.o.host) this.finish(a[0] === this.mySign() ? 'win' : 'lose');
  }

  /** the other player left or closed the game */
  abandoned() {
    if (this.ended) return;
    // walking out while losing doesn't save you: whoever was ahead gets the win
    if (this.myWind() > 0) {
      this.finish('win');
      this.say(L({ tr: `🏆 ${this.o.them} sen öndeyken oyundan çıktı: kazandın!`, en: `🏆 ${this.o.them} left while you were ahead: you win!` }), 999_999);
      return;
    }
    this.say(L({ tr: `${this.o.them} oyundan çıktı.`, en: `${this.o.them} left the game.` }), 999_999);
    this.finish('abandoned');
  }

  private finish(r: YbResult) {
    if (this.ended) return;
    this.ended = true;
    if (r === 'win') { this.say(L({ tr: '🏆 Kazandın! İp tamamen senin tarafına sarıldı.', en: '🏆 You win! The rope is wound all the way round your way.' }), 999_999); sfx.success(); }
    if (r === 'lose') this.say(L({ tr: `${this.o.them} kazandı. Rövanş?`, en: `${this.o.them} wins. Rematch?` }), 999_999);
    (this.el.querySelector('.yb-hit') as HTMLElement).style.display = 'none';
    (this.el.querySelector('.yb-quit') as HTMLElement).textContent = L({ tr: 'Kapat', en: 'Close' });
    this.o.onEnd(r);
  }

  close() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('keyup', this.onKey, true);
    this.el.remove();
  }

  // ---------- drawing ----------

  private draw() {
    const c = this.c, now = performance.now();
    // the ground: a worn circle in the grass, a chalk line between the halves
    c.fillStyle = '#5f9a4c'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#c9a774'; c.beginPath(); c.arc(CX, CY, RING, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 2; c.setLineDash([6, 6]);
    c.beginPath(); c.moveTo(CX - RING, CY); c.lineTo(CX + RING, CY); c.stroke(); c.setLineDash([]);
    // the path the ball swings round on
    c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 1; c.beginPath(); c.arc(CX, CY, this.r, 0, Math.PI * 2); c.stroke();
    const [bx0, by0] = this.ball();
    const [bx, by] = this.view(bx0, by0);
    const me = this.view(this.mine.x, this.mine.y), them = this.view(this.theirs.x, this.theirs.y);
    // the far player behind the pole, the near one in front
    this.person(them[0], them[1], '#8c2f2f', this.o.them, false);
    // rope already wound round the pole: one ring per turn, gold when it's your way
    const coils = Math.floor(Math.abs(this.wind) * 2);
    c.strokeStyle = this.myWind() >= 0 ? '#f2c14e' : '#e07a5f'; c.lineWidth = 2;
    for (let i = 0; i < coils; i++) { c.beginPath(); c.arc(CX, CY, 9 + i * 1.6, 0, Math.PI * 2); c.stroke(); }
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(CX + 6, CY + 5, 9, 6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#6b6f74'; c.beginPath(); c.arc(CX, CY, 8, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#c4c8cc'; c.beginPath(); c.arc(CX - 2, CY - 2, 3, 0, Math.PI * 2); c.fill();
    // rope and ball (a ring round it when it's in reach for you)
    c.strokeStyle = '#f4f0e6'; c.lineWidth = 2; c.beginPath(); c.moveTo(CX, CY); c.lineTo(bx, by); c.stroke();
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(bx + 5, by + 7, BALL, 7, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#f2c14e'; c.beginPath(); c.arc(bx, by, BALL, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#b5862a'; c.lineWidth = 2; c.beginPath(); c.arc(bx, by, BALL, this.theta, this.theta + 2.3); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.arc(bx - 4, by - 5, 4, 0, Math.PI * 2); c.fill();
    if (dist(me[0], me[1], bx, by) < REACH && by > CY - 4 && !this.ended) { c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 2; c.beginPath(); c.arc(bx, by, BALL + 5, 0, Math.PI * 2); c.stroke(); }
    this.person(me[0], me[1], '#22365c', this.o.me, true);
    // which way is yours: an arrow round the ring (the host's way is clockwise; the guest, seeing it turned round, goes the other way)
    const [a0, a1] = this.o.host ? [Math.PI * 0.62, Math.PI * 0.92] : [Math.PI * 0.38, Math.PI * 0.08];
    c.strokeStyle = 'rgba(242,193,78,0.8)'; c.lineWidth = 3;
    c.beginPath(); c.arc(CX, CY, RING - 8, a0, a1, !this.o.host); c.stroke();
    const ex = CX + Math.cos(a1) * (RING - 8), ey = CY + Math.sin(a1) * (RING - 8);
    const tx = -Math.sin(a1) * (this.o.host ? 1 : -1), ty = Math.cos(a1) * (this.o.host ? 1 : -1);
    c.fillStyle = 'rgba(242,193,78,0.9)'; c.beginPath(); c.moveTo(ex + tx * 9, ey + ty * 9); c.lineTo(ex - ty * 6, ey + tx * 6); c.lineTo(ex + ty * 6, ey - tx * 6); c.fill();
    if (this.joy) {
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 2;
      c.beginPath(); c.arc(this.joy.ox, this.joy.oy, 32, 0, Math.PI * 2); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.4)'; c.beginPath(); c.arc(this.joy.x, this.joy.y, 13, 0, Math.PI * 2); c.fill();
    }
    if (now < this.flashUntil) {
      c.font = 'bold 24px system-ui, sans-serif'; c.textAlign = 'center';
      c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 5; c.strokeText(this.flash, CX, 40);
      c.fillStyle = '#fff6c8'; c.fillText(this.flash, CX, 40);
    }
    // the bar: how far the rope is wound, and the line under the court
    const pct = Math.max(-50, Math.min(50, (this.myWind() / YB_WIN) * 50));
    (this.el.querySelector('.yb-mark') as HTMLElement).style.left = `${50 + pct}%`;
    let line = now < this.statusUntil ? this.status : '';
    if (!line) {
      const turns = this.myWind();
      const left = Math.max(0, Math.ceil((GAME_MS - (now - this.startAt)) / 1000));
      line = `${turns >= 0 ? L({ tr: `İp senin yönüne ${turns.toFixed(1)} tur sarılı`, en: `${turns.toFixed(1)} turns your way` }) : L({ tr: `İp ${this.o.them} yönüne ${(-turns).toFixed(1)} tur sarılı`, en: `${(-turns).toFixed(1)} turns ${this.o.them}'s way` })} (${YB_WIN} ${L({ tr: 'turda biter', en: 'to win' })}) · ⏱ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} · ${L({ tr: 'Top yanından geçerken Boşluk!', en: 'Space as the ball comes past!' })}`;
    }
    (this.el.querySelector('.yb-status') as HTMLElement).textContent = line;
  }

  private person(x: number, y: number, shirt: string, name: string, you: boolean) {
    const c = this.c;
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(x, y + 12, 13, 5, 0, 0, Math.PI * 2); c.fill();
    if (you) { c.strokeStyle = '#f2c14e'; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y + 12, 16, 6.5, 0, 0, Math.PI * 2); c.stroke(); }
    c.fillStyle = shirt; c.beginPath(); c.roundRect(x - 10, y - 6, 20, 17, 4); c.fill();
    c.fillStyle = '#e8b98f'; c.beginPath(); c.arc(x, y - 13, 8, 0, Math.PI * 2); c.fill();
    c.font = 'bold 12px system-ui, sans-serif'; c.textAlign = 'center';
    c.fillStyle = you ? '#f2c14e' : '#ffffff'; c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 3; c.lineJoin = 'round';
    c.strokeText(name, x, y - 26); c.fillText(name, x, y - 26);
  }
}

let styled = false;
function injectStyles() {
  if (styled) return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = `
.yb-overlay, .pg-overlay { position: fixed; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center; padding: max(12px, env(safe-area-inset-top, 0px)) 12px max(12px, env(safe-area-inset-bottom, 0px)); background: rgba(6, 8, 14, 0.78); overflow-y: auto; overscroll-behavior: contain; }
.yb-overlay > *, .pg-overlay > * { margin: auto; }
.yb-card, .pg-card { background: #1d2326; color: #f4f0e6; border-radius: 12px; padding: 14px; width: min(548px, 100%); box-shadow: 0 12px 40px rgba(0,0,0,0.5); font-family: system-ui, sans-serif; }
.yb-card canvas { width: 100%; height: auto; display: block; border-radius: 8px; touch-action: none; }
.yb-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; font-size: 18px; }
.yb-vs { font-size: 13px; opacity: 0.75; }
.yb-bar { display: flex; align-items: center; gap: 8px; font-size: 12px; margin-bottom: 8px; }
.yb-bar span { white-space: nowrap; max-width: 30%; overflow: hidden; text-overflow: ellipsis; }
.yb-track { position: relative; flex: 1; height: 10px; border-radius: 5px; background: linear-gradient(90deg, #e07a5f, #444 50%, #f2c14e); }
.yb-mid { position: absolute; left: 50%; top: -3px; width: 2px; height: 16px; background: #fff; opacity: 0.6; }
.yb-mark { position: absolute; top: -4px; width: 6px; height: 18px; margin-left: -3px; border-radius: 3px; background: #fff; box-shadow: 0 0 6px #fff; transition: left 0.1s linear; }
.yb-status, .pg-status { min-height: 2.6em; margin: 10px 2px 8px; font-size: 14px; line-height: 1.3; }
.yb-row, .pg-row { display: flex; gap: 8px; justify-content: space-between; flex-wrap: wrap; }
.yb-row button { user-select: none; -webkit-user-select: none; touch-action: none; }
.pg-picks { display: flex; gap: 8px; justify-content: center; margin: 12px 0; }
.pg-picks button { font-size: 28px; padding: 10px 16px; }
.pg-score { text-align: center; font-size: 22px; font-weight: 800; margin: 6px 0; }
`;
  document.head.appendChild(s);
}
export { injectStyles as injectPeerGameStyles };

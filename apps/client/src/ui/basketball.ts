// A pick-up game of streetball on the half court: you and a friend against two others, first to 11 (baskets from
// inside the arc count 1, from outside it 2). You run your player with WASD / the arrow keys (or by dragging on the
// court), hold and release Space to shoot (let go when the meter is in the green), pass with E, and on defence press
// Space next to whoever has the ball to try to steal it. Misses come off the rim for anyone to grab; a team that wins
// the ball on a defensive rebound or a steal has to take it back out past the arc before it can score.
// The other three are run by simple AI that drives, passes, shoots, rebounds and guards.
import { L } from '../i18n';
import { sfx } from '../audio';
import { injectPeerGameStyles } from './yetimball';

export interface BallerInfo { name: string; skill: number; skin: string; hair: string }
export interface BasketOpts {
  me: BallerInfo & { speed: number };
  mate: BallerInfo;
  opps: [BallerInfo, BallerInfo];
  /** a wider sweet spot on the shot meter (the Team Player perk) */
  bonus?: number;
}
export interface BasketResult { us: number; them: number; made: number; shots: number; quit: boolean }

const W = 520, H = 470;
/** the court: baseline at the top, the hoop just in front of it, the half-way line at the bottom */
const CL = 18, CR = W - 18, CT = 26, CB = H - 18;
const HOOP: [number, number] = [W / 2, 70];
const ARC = 176, CORNER_X = 168;
const KEY = { x: W / 2 - 62, y: CT, w: 124, h: 160 };
const CHECK: [number, number] = [W / 2, HOOP[1] + ARC + 44];
const R = 11;
const TARGET = 11;
const GAME_MS = 4 * 60_000;
const SHOT_CLOCK = 12;

interface Baller extends BallerInfo {
  team: 0 | 1; me: boolean;
  x: number; y: number; vx: number; vy: number;
  speed: number; face: number;
  think: number; spot: [number, number]; spotAt: number; stealCd: number;
}
type Ball =
  | { kind: 'held'; by: Baller }
  | { kind: 'shot'; x0: number; y0: number; t: number; dur: number; by: Baller; made: boolean; pts: number }
  | { kind: 'pass'; x0: number; y0: number; x1: number; y1: number; t: number; dur: number; to: Baller; team: 0 | 1 }
  | { kind: 'loose'; x: number; y: number; z: number; vx: number; vy: number; vz: number };

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const isTwo = (x: number, y: number) => dist(x, y, HOOP[0], HOOP[1]) > ARC || Math.abs(x - HOOP[0]) > CORNER_X;
const clampX = (x: number) => Math.max(CL + R, Math.min(CR - R, x));
const clampY = (y: number) => Math.max(CT + R, Math.min(CB - R, y));
/** the shot meter: a triangle wave 0 → 1 → 0, one sweep every METER_MS */
const METER_MS = 1100;
const SWEET = 0.86;

export class BasketballView {
  readonly el: HTMLElement;
  private cv: HTMLCanvasElement;
  private c: CanvasRenderingContext2D;
  private p: Baller[];
  private me: Baller;
  private ball: Ball;
  private score: [number, number] = [0, 0];
  /** the team with the ball has taken it out past the arc since winning it on defence */
  private cleared = true;
  private shotClock = SHOT_CLOCK;
  private startAt = performance.now();
  private last = performance.now();
  private pauseUntil = 0;
  private afterPause: (() => void) | null = null;
  private keys = new Set<string>();
  private joy: { ox: number; oy: number; x: number; y: number; id: number } | null = null;
  private charging: number | null = null;
  private wantPass = false;
  private shotMeter = -1;
  private msg = ''; private msgUntil = 0;
  private flash = ''; private flashUntil = 0;
  private made = 0; private shots = 0;
  private suddenDeath = false;
  private over = false;
  private raf = 0;
  private done!: (r: BasketResult) => void;
  readonly result: Promise<BasketResult>;

  private onKey = (e: KeyboardEvent) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const watched = ['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'e', 'Enter'];
    if (!watched.includes(k)) return;
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'keydown') {
      if (e.repeat) return;
      this.keys.add(k);
      if (k === ' ') this.actionDown();
      if (k === 'e') this.passKey();
      if (k === 'Enter' && this.over) this.close();
    } else {
      this.keys.delete(k);
      if (k === ' ') this.actionUp();
    }
  };

  constructor(host: HTMLElement, private o: BasketOpts) {
    injectPeerGameStyles();
    injectStyles();
    this.result = new Promise((r) => { this.done = r; });
    const mk = (i: BallerInfo, team: 0 | 1, me: boolean, speed: number): Baller => ({
      ...i, team, me, x: 0, y: 0, vx: 0, vy: 0, speed, face: -Math.PI / 2, think: 0, spot: [W / 2, 200], spotAt: 0, stealCd: 0,
    });
    const aiSpeed = (s: number) => 128 + s * 40;
    this.me = mk(o.me, 0, true, o.me.speed);
    this.p = [this.me, mk(o.mate, 0, false, aiSpeed(o.mate.skill)), mk(o.opps[0], 1, false, aiSpeed(o.opps[0].skill)), mk(o.opps[1], 1, false, aiSpeed(o.opps[1].skill))];
    this.ball = { kind: 'held', by: this.me };
    this.el = document.createElement('div');
    this.el.className = 'yb-overlay';
    this.el.innerHTML = `
      <div class="yb-card bb-card">
        <div class="yb-head"><b>🏀 ${L({ tr: 'Sokak basketbolu · 2\'ye 2', en: 'Streetball · 2-on-2' })}</b><span class="bb-time"></span></div>
        <div class="bb-score"><span class="bb-us"></span><b class="bb-pts"></b><span class="bb-them"></span></div>
        <canvas width="${W}" height="${H}"></canvas>
        <div class="yb-status bb-status"></div>
        <div class="yb-row bb-row">
          <button type="button" class="secondary bb-quit"></button>
          <span class="bb-pad">
            <button type="button" class="secondary bb-pass"></button>
            <button type="button" class="primary bb-act"></button>
          </span>
        </div>
      </div>`;
    this.cv = this.el.querySelector('canvas')!;
    this.c = this.cv.getContext('2d')!;
    (this.el.querySelector('.bb-us') as HTMLElement).textContent = `${o.me.name} & ${o.mate.name}`;
    (this.el.querySelector('.bb-them') as HTMLElement).textContent = `${o.opps[0].name} & ${o.opps[1].name}`;
    (this.el.querySelector('.bb-quit') as HTMLElement).textContent = L({ tr: 'Oyundan çık', en: 'Leave the game' });
    const act = this.el.querySelector('.bb-act') as HTMLButtonElement;
    act.addEventListener('pointerdown', (e) => { e.preventDefault(); this.actionDown(); });
    act.addEventListener('pointerup', (e) => { e.preventDefault(); this.actionUp(); });
    act.addEventListener('pointerleave', () => { if (this.charging !== null) this.actionUp(); });
    this.el.querySelector('.bb-pass')!.addEventListener('click', () => this.passKey());
    this.el.querySelector('.bb-quit')!.addEventListener('click', () => {
      if (this.over) { this.close(); return; }
      this.finish(true);
      this.close();
    });
    // drag on the court to run (phones and tablets)
    this.cv.addEventListener('pointerdown', (e) => {
      const [x, y] = this.local(e);
      this.joy = { ox: x, oy: y, x, y, id: e.pointerId };
      this.cv.setPointerCapture(e.pointerId);
    });
    this.cv.addEventListener('pointermove', (e) => { if (this.joy?.id === e.pointerId) { const [x, y] = this.local(e); this.joy.x = x; this.joy.y = y; } });
    const endJoy = (e: PointerEvent) => { if (this.joy?.id === e.pointerId) this.joy = null; };
    this.cv.addEventListener('pointerup', endJoy);
    this.cv.addEventListener('pointercancel', endJoy);
    window.addEventListener('keydown', this.onKey, true);
    window.addEventListener('keyup', this.onKey, true);
    host.appendChild(this.el);
    this.lineUp(0);
    this.say(L({ tr: 'Top sizde! WASD ile koş, Boşluk\'u basılı tut ve yeşilde bırak: şut. E: pas.', en: 'Your ball! Run with WASD, hold Space and let go in the green to shoot. E passes.' }), 5000);
    const loop = () => { this.tick(); this.draw(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
    if (import.meta.env.DEV) (window as unknown as { dackaBasket: BasketballView }).dackaBasket = this;
  }

  close() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('keyup', this.onKey, true);
    this.el.remove();
    if (!this.over) this.finish(true);
  }

  private finish(quit: boolean) {
    if (this.over) return;
    this.over = true;
    this.done({ us: this.score[0], them: this.score[1], made: this.made, shots: this.shots, quit });
  }

  private local(e: PointerEvent): [number, number] {
    const r = this.cv.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  }

  private say(text: string, ms = 2200) { this.msg = text; this.msgUntil = performance.now() + ms; }

  // ---------- possessions ----------

  private holder(): Baller | null { return this.ball.kind === 'held' ? this.ball.by : null; }
  private offense(): 0 | 1 | null {
    const b = this.ball;
    return b.kind === 'held' ? b.by.team : b.kind === 'pass' ? b.team : b.kind === 'shot' ? b.by.team : null;
  }

  /** everyone back in place, `team` with the ball at the top of the key */
  private lineUp(team: 0 | 1) {
    const [a, b] = team === 0 ? [this.p[0], this.p[1]] : [this.p[2], this.p[3]];
    const [c, d] = team === 0 ? [this.p[2], this.p[3]] : [this.p[0], this.p[1]];
    const place = (q: Baller, x: number, y: number) => { q.x = x; q.y = y; q.vx = 0; q.vy = 0; q.face = -Math.PI / 2; };
    place(a, CHECK[0], CHECK[1]);
    place(b, W / 2 + 150, 150);
    place(c, CHECK[0], CHECK[1] - 46);
    place(d, W / 2 + 128, 128);
    for (const q of this.p) q.spotAt = 0;
    this.ball = { kind: 'held', by: a };
    this.cleared = true;
    this.shotClock = SHOT_CLOCK;
  }

  private turnover(team: 0 | 1, why: string) {
    this.say(why);
    this.pause(900, () => this.lineUp(team));
  }

  private pause(ms: number, then: () => void) { this.pauseUntil = performance.now() + ms; this.afterPause = then; this.charging = null; }

  private gain(q: Baller, fromDefence: boolean) {
    this.ball = { kind: 'held', by: q };
    if (fromDefence) this.cleared = false;
    this.shotClock = SHOT_CLOCK;
    if (fromDefence && q.team === 0) this.say(q.me ? L({ tr: 'Top sende! Önce çizginin dışına çıkar.', en: 'Your ball! Take it out past the arc first.' }) : L({ tr: `Top ${q.name}'de: çizgi dışına çıkarıyor.`, en: `${q.name} has it: taking it out past the arc.` }));
  }

  // ---------- your controls ----------

  private actionDown() {
    if (this.over || performance.now() < this.pauseUntil) return;
    const h = this.holder();
    if (h === this.me) {
      if (!this.cleared) { this.say(L({ tr: 'Önce topu üçlük çizgisinin dışına çıkar!', en: 'Take the ball out past the arc first!' })); return; }
      this.charging = performance.now();
      return;
    }
    // on defence: a swipe at the ball
    if (h && h.team === 1 && this.me.stealCd <= 0) {
      this.me.stealCd = 0.7;
      if (dist(this.me.x, this.me.y, h.x, h.y) > 30) { this.say(L({ tr: 'Çok uzaktasın: topu çalmak için yanına git.', en: 'Too far: get right up to them to steal it.' }), 1400); return; }
      if (Math.random() < 0.3 + this.o.me.skill * 0.3 - h.skill * 0.2) { this.gain(this.me, true); sfx.hop(); this.flashText(L({ tr: 'Top çalındı!', en: 'Stolen!' })); }
      else this.say(L({ tr: 'Elin boşa gitti!', en: 'Missed it!' }), 1200);
    }
  }

  private actionUp() {
    if (this.charging === null) return;
    const q = this.meterQuality(performance.now());
    this.charging = null;
    if (this.holder() === this.me) this.shoot(this.me, q);
  }

  private passKey() {
    if (this.over || performance.now() < this.pauseUntil) return;
    const h = this.holder();
    if (h === this.me) { this.charging = null; this.pass(this.me, this.p[1]); return; }
    if (h === this.p[1]) { this.wantPass = true; this.say(L({ tr: `"${this.o.mate.name}, pas!"`, en: `"${this.o.mate.name}, here!"` }), 1000); }
  }

  private meterAt(now: number) { const t = ((now - (this.charging ?? now)) % METER_MS) / METER_MS; return t < 0.5 ? t * 2 : 2 - t * 2; }
  private meterQuality(now: number) {
    const half = 0.05 + this.o.me.skill * 0.06 + (this.o.bonus ?? 0);
    const off = Math.abs(this.meterAt(now) - SWEET);
    return off <= half ? 1 : Math.max(0, 1 - (off - half) / 0.3);
  }

  // ---------- shots and passes ----------

  private nearestDefender(q: Baller) {
    let best = Infinity;
    for (const d of this.p) if (d.team !== q.team) best = Math.min(best, dist(d.x, d.y, q.x, q.y));
    return best;
  }

  private shoot(q: Baller, quality: number) {
    const d = dist(q.x, q.y, HOOP[0], HOOP[1]);
    const two = isTwo(q.x, q.y);
    const base = d < 48 ? 0.82 : two ? 0.36 : 0.66 - ((d - 48) / (ARC - 48)) * 0.2;
    const contest = Math.max(0.4, Math.min(1, 0.35 + this.nearestDefender(q) / 75));
    const pMake = Math.max(0.03, Math.min(0.95, base * (0.3 + 0.7 * quality) * contest * (0.85 + q.skill * 0.3)));
    const made = Math.random() < pMake;
    if (q.team === 0 && q.me) { this.shots++; if (made) this.made++; }
    this.ball = { kind: 'shot', x0: q.x, y0: q.y, t: 0, dur: 0.5 + d / 520, by: q, made, pts: two ? 2 : 1 };
    if (q.me) this.say(quality >= 1 ? L({ tr: 'Tam zamanında!', en: 'Perfect release!' }) : quality > 0.5 ? L({ tr: 'Fena değil…', en: 'Not bad…' }) : L({ tr: 'Erken/geç bıraktın…', en: 'Off the timing…' }), 1200);
  }

  private pass(from: Baller, to: Baller) {
    // a lead pass to where they're heading
    const x1 = clampX(to.x + to.vx * 0.15), y1 = clampY(to.y + to.vy * 0.15);
    const d = dist(from.x, from.y, x1, y1);
    // anyone standing in the lane may pick it off
    for (const q of this.p) {
      if (q.team === from.team) continue;
      const t = Math.max(0, Math.min(1, ((q.x - from.x) * (x1 - from.x) + (q.y - from.y) * (y1 - from.y)) / Math.max(1, d * d)));
      const px = from.x + (x1 - from.x) * t, py = from.y + (y1 - from.y) * t;
      if (t > 0.15 && t < 0.9 && dist(q.x, q.y, px, py) < 16 && Math.random() < 0.3 + q.skill * 0.3) {
        this.ball = { kind: 'pass', x0: from.x, y0: from.y, x1: px, y1: py, t: 0, dur: Math.max(0.08, (d * t) / 430), to: q, team: from.team };
        return;
      }
    }
    this.ball = { kind: 'pass', x0: from.x, y0: from.y, x1, y1, t: 0, dur: Math.max(0.15, d / 430), to, team: from.team };
  }

  private flashText(t: string) { this.flash = t; this.flashUntil = performance.now() + 1100; }

  // ---------- the game loop ----------

  private tick() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.over) return;
    if (now < this.pauseUntil) return;
    if (this.afterPause) { const f = this.afterPause; this.afterPause = null; f(); return; }
    const elapsed = now - this.startAt;
    if (elapsed >= GAME_MS && !this.suddenDeath) {
      if (this.score[0] !== this.score[1]) { this.end(); return; }
      this.suddenDeath = true;
      this.say(L({ tr: 'Süre bitti, berabere: sıradaki sayı kazanır!', en: "Time's up and it's level: next basket wins!" }), 3500);
    }
    for (const q of this.p) q.stealCd = Math.max(0, q.stealCd - dt);
    if (this.ball.kind === 'held') {
      this.shotClock -= dt;
      if (this.shotClock <= 0) {
        const t = this.ball.by.team;
        this.turnover(t === 0 ? 1 : 0, L({ tr: 'Şut saati doldu! Top rakibe geçti.', en: 'Shot clock! The ball goes over.' }));
        return;
      }
    }
    this.moveMe(dt);
    for (const q of this.p) if (!q.me) this.ai(q, dt, now);
    for (const q of this.p) {
      q.x = clampX(q.x + q.vx * dt); q.y = clampY(q.y + q.vy * dt);
      if (Math.hypot(q.vx, q.vy) > 5) q.face = Math.atan2(q.vy, q.vx);
    }
    this.separate();
    this.updateBall(dt);
    // the ball out past the arc again: it's live for that team
    const h = this.holder();
    if (h && !this.cleared && isTwo(h.x, h.y) && dist(h.x, h.y, HOOP[0], HOOP[1]) > ARC + 6) {
      this.cleared = true;
      if (h.team === 0) this.say(L({ tr: 'Çizgi dışında: artık hücum edebilirsin!', en: 'Past the arc: now attack!' }), 1500);
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
    const len = Math.hypot(x, y);
    const sp = this.me.speed * (this.charging !== null ? 0.3 : 1) * (this.holder() === this.me ? 0.92 : 1);
    const tx = len ? (x / Math.max(1, len)) * sp : 0, ty = len ? (y / Math.max(1, len)) * sp : 0;
    const k = Math.min(1, dt * 12);
    this.me.vx += (tx - this.me.vx) * k; this.me.vy += (ty - this.me.vy) * k;
  }

  private steer(q: Baller, tx: number, ty: number, dt: number, pace = 1) {
    const dx = tx - q.x, dy = ty - q.y, d = Math.hypot(dx, dy);
    const sp = d < 6 ? 0 : q.speed * pace * Math.min(1, d / 40);
    const vx = d ? (dx / d) * sp : 0, vy = d ? (dy / d) * sp : 0;
    const k = Math.min(1, dt * 8);
    q.vx += (vx - q.vx) * k; q.vy += (vy - q.vy) * k;
  }

  private ai(q: Baller, dt: number, now: number) {
    const b = this.ball;
    const mates = this.p.filter((x) => x.team === q.team && x !== q);
    const foes = this.p.filter((x) => x.team !== q.team);
    // a loose ball, or one in the air: the nearest of each team goes for it, the other heads in for the rebound
    if (b.kind === 'loose' || b.kind === 'shot') {
      const [bx, by] = b.kind === 'loose' ? [b.x, b.y] : [HOOP[0], HOOP[1] + 40];
      const mine = [q, ...mates].sort((a, c) => dist(a.x, a.y, bx, by) - dist(c.x, c.y, bx, by))[0];
      if (mine === q && !(mates[0]?.me && dist(mates[0].x, mates[0].y, bx, by) < dist(q.x, q.y, bx, by) - 20)) this.steer(q, bx, by, dt, 1.05);
      else { const a = Math.atan2(q.y - HOOP[1], q.x - HOOP[0]); this.steer(q, HOOP[0] + Math.cos(a) * 70, HOOP[1] + Math.max(20, Math.sin(a) * 70), dt); }
      return;
    }
    const off = this.offense();
    if (off === q.team) {
      if (b.kind === 'held' && b.by === q) { this.handle(q, mates[0], foes, dt, now); return; }
      // off the ball: find an open spot (now and then a cut to the rim), and get open for a pass
      if (now > q.spotAt) {
        const spots: Array<[number, number]> = [[90, 110], [W - 90, 110], [120, 300], [W - 120, 300], [W / 2, 330], [W / 2 - 40, 150], [W / 2 + 40, 150]];
        const h = this.holder();
        const score = (s: [number, number]) => Math.min(...foes.map((f) => dist(f.x, f.y, s[0], s[1]))) + (h ? Math.min(120, dist(h.x, h.y, s[0], s[1])) : 0) + Math.random() * 40;
        q.spot = spots.sort((a, c) => score(c) - score(a))[0];
        q.spotAt = now + 1800 + Math.random() * 1500;
      }
      // the friend you asked for the ball passes it
      this.steer(q, q.spot[0], q.spot[1], dt);
      return;
    }
    // defence: stay between your man and the rim, and have a go at the ball when it's close
    const marks = foes.slice().sort((a, c) => dist(q.x, q.y, a.x, a.y) - dist(q.x, q.y, c.x, c.y));
    let mark = marks[0];
    const partner = mates[0];
    if (partner && marks.length > 1) {
      // split the two attackers between the two defenders (you, if you're the partner, take whoever's nearest you)
      const pm = foes.slice().sort((a, c) => dist(partner.x, partner.y, a.x, a.y) - dist(partner.x, partner.y, c.x, c.y))[0];
      if (pm === mark && dist(partner.x, partner.y, pm.x, pm.y) < dist(q.x, q.y, mark.x, mark.y)) mark = marks[1];
    }
    const a = Math.atan2(HOOP[1] - mark.y, HOOP[0] - mark.x);
    const gap = mark === this.holder() ? 26 : 38;
    this.steer(q, mark.x + Math.cos(a) * gap, mark.y + Math.sin(a) * gap, dt);
    const h = this.holder();
    if (h && h === mark && q.stealCd <= 0 && dist(q.x, q.y, h.x, h.y) < 26) {
      q.stealCd = 1;
      if (Math.random() < Math.max(0.05, 0.22 * q.skill + 0.08 - h.skill * 0.12)) {
        this.gain(q, true); sfx.hop();
        if (h.team === 0) this.flashText(L({ tr: `${q.name} topu çaldı!`, en: `${q.name} stole it!` }));
      }
    }
  }

  /** an AI with the ball: clear it, then drive, pass or shoot */
  private handle(q: Baller, mate: Baller, foes: Baller[], dt: number, now: number) {
    if (!this.cleared) {
      const a = Math.atan2(q.y - HOOP[1], q.x - HOOP[0]);
      this.steer(q, HOOP[0] + Math.cos(a) * (ARC + 40), Math.min(CB - 30, HOOP[1] + Math.max(0.3, Math.sin(a)) * (ARC + 40)), dt);
      return;
    }
    const d = dist(q.x, q.y, HOOP[0], HOOP[1]);
    const open = this.nearestDefender(q);
    if (now > q.think) {
      q.think = now + 280 + Math.random() * 200;
      const mateOpen = this.nearestDefender(mate);
      // you asked for it
      if (mate.me && this.wantPass) { this.wantPass = false; this.pass(q, mate); return; }
      if (d < 46 || (open > 55 && d < ARC + 30 && Math.random() < 0.35) || this.shotClock < 1.6 || (open > 70 && Math.random() < 0.2)) {
        this.shoot(q, Math.max(0, Math.min(1, q.skill + (Math.random() - 0.4) * 0.5)));
        return;
      }
      if (mateOpen > open + 20 && Math.random() < (mate.me ? 0.3 : 0.4)) { this.pass(q, mate); return; }
      // drive at the rim, round whoever is in the way
      const block = foes.sort((a, c) => dist(q.x, q.y, a.x, a.y) - dist(q.x, q.y, c.x, c.y))[0];
      const side = Math.sign(q.x - block.x) || (Math.random() < 0.5 ? -1 : 1);
      q.spot = [HOOP[0] + side * (20 + Math.random() * 50), HOOP[1] + 30 + Math.random() * 40];
    }
    this.steer(q, q.spot[0], q.spot[1], dt, 0.92);
  }

  /** nobody stands on anybody */
  private separate() {
    for (let i = 0; i < this.p.length; i++) for (let j = i + 1; j < this.p.length; j++) {
      const a = this.p[i], b = this.p[j];
      const d = dist(a.x, a.y, b.x, b.y), min = R * 2;
      if (d >= min || d < 1e-3) continue;
      const push = (min - d) / 2, nx = (b.x - a.x) / d, ny = (b.y - a.y) / d;
      a.x = clampX(a.x - nx * push); a.y = clampY(a.y - ny * push);
      b.x = clampX(b.x + nx * push); b.y = clampY(b.y + ny * push);
    }
  }

  private updateBall(dt: number) {
    const b = this.ball;
    if (b.kind === 'pass') {
      b.t += dt;
      if (b.t >= b.dur) {
        const stolen = b.to.team !== b.team;
        this.gain(b.to, stolen);
        if (stolen) { sfx.hop(); this.flashText(b.to.team === 0 ? L({ tr: 'Pas arası!', en: 'Picked off!' }) : L({ tr: `${b.to.name} pası kesti!`, en: `${b.to.name} cut out the pass!` })); }
      }
      return;
    }
    if (b.kind === 'shot') {
      b.t += dt;
      if (b.t < b.dur) return;
      if (b.made) this.scored(b.by.team, b.pts);
      else {
        // off the rim, any which way
        const a = Math.random() * Math.PI * 0.9 + Math.PI * 0.05;
        const s = 110 + Math.random() * 130;
        this.ball = { kind: 'loose', x: HOOP[0], y: HOOP[1] + 6, z: 34, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: 90 };
        this.lastShooter = b.by.team;
        if (b.by.team === 0) this.say(L({ tr: 'Çemberden döndü! Ribaund!', en: 'Off the rim! Rebound!' }), 1200);
      }
      return;
    }
    if (b.kind === 'loose') {
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.vz -= 420 * dt; b.z += b.vz * dt;
      if (b.z < 0) { b.z = 0; b.vz = Math.abs(b.vz) * 0.45; if (b.vz < 20) b.vz = 0; }
      const f = Math.pow(0.35, dt); b.vx *= f; b.vy *= f;
      if (b.x < CL + 4 || b.x > CR - 4) { b.vx = -b.vx; b.x = Math.max(CL + 4, Math.min(CR - 4, b.x)); }
      if (b.y < CT + 4 || b.y > CB - 4) { b.vy = -b.vy; b.y = Math.max(CT + 4, Math.min(CB - 4, b.y)); }
      if (b.z > 24) return;
      const grab = this.p.filter((q) => dist(q.x, q.y, b.x, b.y) < R + 7).sort((p1, p2) => dist(p1.x, p1.y, b.x, b.y) - dist(p2.x, p2.y, b.x, b.y))[0];
      if (grab) {
        const defensive = grab.team !== this.lastShooter;
        this.gain(grab, defensive);
        if (grab.team === 0 && !defensive) this.say(L({ tr: 'Hücum ribaundu! Tekrar dene.', en: 'Offensive rebound! Go again.' }), 1300);
        if (grab.team === 1 && grab !== this.me) this.say(L({ tr: `${grab.name} ribaundu aldı.`, en: `${grab.name} got the rebound.` }), 1300);
      }
    }
  }
  private lastShooter: 0 | 1 = 0;

  private scored(team: 0 | 1, pts: number) {
    this.score[team] += pts;
    if (team === 0) sfx.success(); else sfx.bump();
    this.flashText(`+${pts}${pts === 2 ? ' 🔥' : ''}`);
    if (this.score[team] >= TARGET || this.suddenDeath) { this.pause(1100, () => this.end()); return; }
    this.say(team === 0 ? L({ tr: 'Sayı! Top rakipte.', en: 'Bucket! Their ball.' }) : L({ tr: 'Sayı yediniz. Top sizde.', en: 'They scored. Your ball.' }), 1500);
    this.pause(1000, () => this.lineUp(team === 0 ? 1 : 0));
  }

  private end() {
    const [us, them] = this.score;
    this.finish(false);
    this.say(us > them ? L({ tr: `Kazandınız! ${us}–${them}`, en: `You won! ${us}–${them}` }) : L({ tr: `Kaybettiniz: ${us}–${them}`, en: `You lost: ${us}–${them}` }), 999_999);
    if (us > them) sfx.success();
    const quit = this.el.querySelector('.bb-quit') as HTMLElement;
    quit.textContent = L({ tr: 'Devam (Enter)', en: 'Continue (Enter)' });
    quit.className = 'primary bb-quit';
  }

  // ---------- drawing ----------

  private draw() {
    const c = this.c, now = performance.now();
    // the court: red asphalt, white lines
    c.fillStyle = '#3f6b3a'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#b5573f'; c.fillRect(CL, CT, CR - CL, CB - CT);
    c.fillStyle = '#386f92'; c.fillRect(KEY.x, KEY.y, KEY.w, KEY.h);
    c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 2.5;
    c.strokeRect(CL, CT, CR - CL, CB - CT);
    c.strokeRect(KEY.x, KEY.y, KEY.w, KEY.h);
    c.beginPath(); c.arc(W / 2, KEY.y + KEY.h, 48, 0, Math.PI); c.stroke();
    // the arc and its straight corner lines
    const ang = Math.asin(CORNER_X / ARC);
    const cornerY = HOOP[1] + Math.cos(ang) * ARC;
    c.beginPath();
    c.moveTo(HOOP[0] - CORNER_X, CT); c.lineTo(HOOP[0] - CORNER_X, cornerY);
    c.arc(HOOP[0], HOOP[1], ARC, Math.PI / 2 + ang, Math.PI / 2 - ang, true);
    c.lineTo(HOOP[0] + CORNER_X, CT); c.stroke();
    c.beginPath(); c.arc(W / 2, CB, 52, Math.PI, 0); c.stroke();
    // the hoop: backboard, rim, net
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(HOOP[0] - 30, HOOP[1] - 16, 60, 6);
    c.fillStyle = '#f4f4f2'; c.fillRect(HOOP[0] - 30, HOOP[1] - 20, 60, 5);
    c.strokeStyle = '#e8572a'; c.lineWidth = 3; c.beginPath(); c.arc(HOOP[0], HOOP[1], 9, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1;
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(HOOP[0] + i * 4, HOOP[1] + 6); c.lineTo(HOOP[0] + i * 2.5, HOOP[1] + 16); c.stroke(); }
    // where you have to take it after a defensive rebound
    const h = this.holder();
    if (h && !this.cleared) {
      c.strokeStyle = 'rgba(242,193,78,0.9)'; c.lineWidth = 4; c.setLineDash([10, 8]);
      c.beginPath(); c.arc(HOOP[0], HOOP[1], ARC, Math.PI / 2 + ang, Math.PI / 2 - ang, true); c.stroke();
      c.setLineDash([]);
    }
    // the players, back to front
    for (const q of [...this.p].sort((a, b) => a.y - b.y)) this.person(q, now);
    this.drawBall(now);
    // the shot meter beside you
    if (this.charging !== null) {
      const v = this.meterAt(now), half = 0.05 + this.o.me.skill * 0.06 + (this.o.bonus ?? 0);
      const bx = this.me.x + 20, by = this.me.y - 46, bh = 46, bw = 9;
      c.fillStyle = 'rgba(20,24,28,0.75)'; c.fillRect(bx, by, bw, bh);
      c.fillStyle = 'rgba(120,220,120,0.95)'; c.fillRect(bx, by + bh * (1 - SWEET - half), bw, bh * half * 2);
      c.fillStyle = '#f2c14e'; c.fillRect(bx + 2, by + bh * (1 - v) - 1, bw - 4, 3);
    }
    // the joystick (touch)
    if (this.joy) {
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 2;
      c.beginPath(); c.arc(this.joy.ox, this.joy.oy, 34, 0, Math.PI * 2); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.4)'; c.beginPath(); c.arc(this.joy.x, this.joy.y, 14, 0, Math.PI * 2); c.fill();
    }
    if (now < this.flashUntil) {
      c.font = 'bold 34px system-ui, sans-serif'; c.textAlign = 'center';
      c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 5; c.strokeText(this.flash, W / 2, H / 2);
      c.fillStyle = '#fff6c8'; c.fillText(this.flash, W / 2, H / 2);
    }
    this.hud(now);
  }

  private person(q: Baller, now: number) {
    const c = this.c;
    const shirt = q.team === 0 ? '#6e1f2d' : '#2e6fb0';
    c.fillStyle = 'rgba(0,0,0,0.28)'; c.beginPath(); c.ellipse(q.x, q.y + 9, 12, 5, 0, 0, Math.PI * 2); c.fill();
    if (q.me) { c.strokeStyle = '#f2c14e'; c.lineWidth = 2; c.beginPath(); c.ellipse(q.x, q.y + 9, 15, 7, 0, 0, Math.PI * 2); c.stroke(); }
    // legs mid-stride when running
    const run = Math.hypot(q.vx, q.vy) > 20 ? Math.sin(now / 70 + q.x) * 3 : 0;
    c.fillStyle = '#2a2a30'; c.fillRect(q.x - 6, q.y + 1 + run, 4, 8); c.fillRect(q.x + 2, q.y + 1 - run, 4, 8);
    c.fillStyle = shirt; c.beginPath(); c.roundRect(q.x - 9, q.y - 12, 18, 15, 4); c.fill();
    c.fillStyle = '#ffffff'; c.font = 'bold 8px system-ui, sans-serif'; c.textAlign = 'center';
    c.fillText(q.team === 0 ? '★' : '●', q.x, q.y - 2);
    c.fillStyle = q.skin; c.beginPath(); c.arc(q.x, q.y - 19, 7, 0, Math.PI * 2); c.fill();
    c.fillStyle = q.hair; c.beginPath(); c.arc(q.x, q.y - 21, 7, Math.PI, Math.PI * 2); c.fill();
    c.font = 'bold 11px system-ui, sans-serif';
    c.strokeStyle = 'rgba(0,0,0,0.65)'; c.lineWidth = 3; c.lineJoin = 'round';
    c.strokeText(q.name, q.x, q.y - 31);
    c.fillStyle = q.me ? '#f2c14e' : '#ffffff'; c.fillText(q.name, q.x, q.y - 31);
  }

  private drawBall(now: number) {
    const c = this.c, b = this.ball;
    let x: number, y: number, z: number;
    if (b.kind === 'held') {
      const q = b.by;
      const side = Math.cos(q.face) >= 0 ? 1 : -1;
      x = q.x + side * 11; y = q.y + 4;
      z = this.charging !== null && q.me ? 26 : Math.abs(Math.sin(now / 140)) * 14;
    } else if (b.kind === 'pass') {
      const t = Math.min(1, b.t / b.dur);
      x = b.x0 + (b.x1 - b.x0) * t; y = b.y0 + (b.y1 - b.y0) * t; z = 12 + Math.sin(t * Math.PI) * 8;
    } else if (b.kind === 'shot') {
      const t = Math.min(1, b.t / b.dur);
      x = b.x0 + (HOOP[0] - b.x0) * t; y = b.y0 + (HOOP[1] - b.y0) * t;
      z = 20 + Math.sin(t * Math.PI) * (40 + dist(b.x0, b.y0, HOOP[0], HOOP[1]) * 0.35) + t * 10;
    } else { x = b.x; y = b.y; z = b.z; }
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(x, y + 4, 6, 2.5, 0, 0, Math.PI * 2); c.fill();
    const by = y - z;
    c.fillStyle = '#e8762a'; c.beginPath(); c.arc(x, by, 6, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#5a2a10'; c.lineWidth = 1;
    c.beginPath(); c.arc(x, by, 6, 0, Math.PI * 2); c.moveTo(x - 6, by); c.lineTo(x + 6, by); c.moveTo(x, by - 6); c.lineTo(x, by + 6); c.stroke();
  }

  private hud(now: number) {
    const left = Math.max(0, GAME_MS - (now - this.startAt));
    const mm = Math.floor(left / 60000), ss = Math.floor((left % 60000) / 1000);
    (this.el.querySelector('.bb-time') as HTMLElement).textContent = this.suddenDeath ? L({ tr: 'Altın sayı', en: 'Next basket wins' })
      : `⏱ ${mm}:${String(ss).padStart(2, '0')} · ${L({ tr: 'şut saati', en: 'shot clock' })} ${Math.ceil(Math.max(0, this.shotClock))} · ${L({ tr: `${TARGET}'e kadar`, en: `to ${TARGET}` })}`;
    (this.el.querySelector('.bb-pts') as HTMLElement).textContent = `${this.score[0]} – ${this.score[1]}`;
    const h = this.holder();
    const act = this.el.querySelector('.bb-act') as HTMLButtonElement;
    const pass = this.el.querySelector('.bb-pass') as HTMLButtonElement;
    act.textContent = h === this.me ? L({ tr: '🏀 Şut (Boşluk, basılı tut)', en: '🏀 Shoot (hold Space)' }) : this.offense() === 1 ? L({ tr: '✋ Top çal (Boşluk)', en: '✋ Steal (Space)' }) : '🏀';
    pass.textContent = h === this.p[1] ? L({ tr: '🙋 Pas iste (E)', en: '🙋 Call for it (E)' }) : L({ tr: '↪ Pas (E)', en: '↪ Pass (E)' });
    let line = now < this.msgUntil ? this.msg : '';
    if (!line) {
      if (h === this.me) line = this.cleared ? L({ tr: 'Potaya sür, açıkta kalınca şut at. Çizgi dışından 2 sayı.', en: "Drive to the rim and shoot when you're open. Outside the arc counts 2." }) : L({ tr: 'Önce topu sarı çizginin dışına çıkar.', en: 'Take it out past the yellow line first.' });
      else if (this.offense() === 0) line = L({ tr: 'Boşa çık; topu istemek için E.', en: 'Get open; press E to call for the ball.' });
      else if (this.offense() === 1) line = L({ tr: 'Savunma: adamını kapat, yanına gelince Boşluk ile topu çal.', en: 'Defence: stay with your man, press Space next to the ball to steal.' });
      else line = L({ tr: 'Ribaund! Topa koş.', en: 'Rebound! Go get it.' });
    }
    (this.el.querySelector('.bb-status') as HTMLElement).textContent = line;
  }
}

let styled = false;
function injectStyles() {
  if (styled) return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = `
.bb-card { width: min(560px, 100%); }
.bb-card canvas { width: 100%; height: auto; display: block; border-radius: 8px; touch-action: none; }
.bb-time { font-size: 12px; opacity: 0.8; }
.bb-score { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px; margin-bottom: 8px; font-size: 13px; }
.bb-score span:first-child { color: #f2a7b4; } .bb-score span:last-child { color: #9cc6ef; text-align: right; }
.bb-pts { font-size: 24px; font-variant-numeric: tabular-nums; }
.bb-pad { display: flex; gap: 8px; }
.bb-pad button { user-select: none; -webkit-user-select: none; touch-action: none; }
`;
  document.head.appendChild(s);
}

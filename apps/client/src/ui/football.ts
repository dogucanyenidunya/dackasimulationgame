// A pick-up game of football on a small walled pitch ("halı saha"): you, a friend and a keeper against two players and
// a keeper, first to 5 goals. You attack the goal on the right. Run with WASD / the arrow keys (or drag on the pitch);
// the ball stays at your feet as you dribble. Hold Space and let go when the meter is in the green to shoot (hold W or
// S as you let go to aim high or low), E passes to your friend (or calls for the ball when they have it), and on
// defence Space next to whoever has the ball is a tackle. The ball comes off the walls; keepers dive for shots.
// The other five are run by simple AI that dribbles, passes, shoots, presses, marks and keeps goal.
import { L } from '../i18n';
import { sfx } from '../audio';
import { injectPeerGameStyles } from './yetimball';
import type { BallerInfo } from './basketball';

export interface FootballOpts {
  me: BallerInfo & { speed: number };
  /** your friend out on the pitch, and your keeper */
  mates: [BallerInfo, BallerInfo];
  /** their two outfield players, then their keeper */
  opps: [BallerInfo, BallerInfo, BallerInfo];
  bonus?: number;
}
export interface FootballResult { us: number; them: number; goals: number; shots: number; quit: boolean }

const W = 560, H = 360;
const CL = 26, CR = W - 26, CT = 18, CB = H - 18;
const MID_Y = H / 2;
const MOUTH = 50; // half the goal's width
const BOX = { d: 62, h: 84 }; // the keeper's area: depth, half height
const R = 10, BR = 5;
const TARGET = 5;
const GAME_MS = 4 * 60_000;
const METER_MS = 1000;
const SWEET: [number, number] = [0.72, 0.92];

interface Player extends BallerInfo {
  team: 0 | 1; me: boolean; keeper: boolean;
  x: number; y: number; vx: number; vy: number; face: number;
  speed: number; think: number; spot: [number, number]; spotAt: number; cd: number; stumble: number; holdSince: number;
}
interface Ball { x: number; y: number; vx: number; vy: number; owner: Player | null; lastKick: Player | null; kickAt: number; shot: boolean }

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** the goal a team attacks */
const goalX = (team: 0 | 1) => (team === 0 ? CR : CL);
const ownGoalX = (team: 0 | 1) => (team === 0 ? CL : CR);

export class FootballView {
  readonly el: HTMLElement;
  private cv: HTMLCanvasElement;
  private c: CanvasRenderingContext2D;
  private p: Player[];
  private me: Player;
  private ball: Ball;
  private score: [number, number] = [0, 0];
  private startAt = performance.now();
  private last = performance.now();
  private pauseUntil = 0;
  private afterPause: (() => void) | null = null;
  private keys = new Set<string>();
  private joy: { ox: number; oy: number; x: number; y: number; id: number } | null = null;
  private charging: number | null = null;
  private wantPass = false;
  private msg = ''; private msgUntil = 0;
  private flash = ''; private flashUntil = 0;
  private goals = 0; private shots = 0;
  private suddenDeath = false;
  /** the kick-off: the other team stays out of the centre circle until the ball is kicked or carried out of it */
  private kickoffTeam: 0 | 1 | null = null;
  private over = false;
  private raf = 0;
  private done!: (r: FootballResult) => void;
  readonly result: Promise<FootballResult>;

  private onKey = (e: KeyboardEvent) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'e', 'Enter'].includes(k)) return;
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

  constructor(host: HTMLElement, private o: FootballOpts) {
    injectPeerGameStyles();
    injectStyles();
    this.result = new Promise((r) => { this.done = r; });
    const mk = (i: BallerInfo, team: 0 | 1, me: boolean, keeper: boolean, speed: number): Player => ({
      ...i, team, me, keeper, x: 0, y: 0, vx: 0, vy: 0, face: team === 0 ? 0 : Math.PI, speed, think: 0, spot: [W / 2, MID_Y], spotAt: 0, cd: 0, stumble: 0, holdSince: 0,
    });
    const ai = (s: number) => 118 + s * 36;
    this.me = mk(o.me, 0, true, false, o.me.speed);
    this.p = [
      this.me, mk(o.mates[0], 0, false, false, ai(o.mates[0].skill)), mk(o.mates[1], 0, false, true, ai(o.mates[1].skill)),
      mk(o.opps[0], 1, false, false, ai(o.opps[0].skill)), mk(o.opps[1], 1, false, false, ai(o.opps[1].skill)), mk(o.opps[2], 1, false, true, ai(o.opps[2].skill)),
    ];
    this.ball = { x: W / 2, y: MID_Y, vx: 0, vy: 0, owner: null, lastKick: null, kickAt: 0, shot: false };
    this.el = document.createElement('div');
    this.el.className = 'yb-overlay';
    this.el.innerHTML = `
      <div class="yb-card fb-card">
        <div class="yb-head"><b>⚽ ${L({ tr: 'Halı saha · 3\'e 3', en: 'Five-a-side · 3-on-3' })}</b><span class="fb-time"></span></div>
        <div class="fb-score"><span class="fb-us"></span><b class="fb-pts"></b><span class="fb-them"></span></div>
        <canvas width="${W}" height="${H}"></canvas>
        <div class="yb-status fb-status"></div>
        <div class="yb-row fb-row">
          <button type="button" class="secondary fb-quit"></button>
          <span class="fb-pad">
            <button type="button" class="secondary fb-pass"></button>
            <button type="button" class="primary fb-act"></button>
          </span>
        </div>
      </div>`;
    this.cv = this.el.querySelector('canvas')!;
    this.c = this.cv.getContext('2d')!;
    (this.el.querySelector('.fb-us') as HTMLElement).textContent = `${o.me.name}, ${o.mates[0].name}, ${o.mates[1].name} 🧤 →`;
    (this.el.querySelector('.fb-them') as HTMLElement).textContent = `← ${o.opps[0].name}, ${o.opps[1].name}, ${o.opps[2].name} 🧤`;
    (this.el.querySelector('.fb-quit') as HTMLElement).textContent = L({ tr: 'Oyundan çık', en: 'Leave the game' });
    const act = this.el.querySelector('.fb-act') as HTMLButtonElement;
    act.addEventListener('pointerdown', (e) => { e.preventDefault(); this.actionDown(); });
    act.addEventListener('pointerup', (e) => { e.preventDefault(); this.actionUp(); });
    act.addEventListener('pointerleave', () => { if (this.charging !== null) this.actionUp(); });
    this.el.querySelector('.fb-pass')!.addEventListener('click', () => this.passKey());
    this.el.querySelector('.fb-quit')!.addEventListener('click', () => {
      if (this.over) { this.close(); return; }
      this.finish(true);
      this.close();
    });
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
    this.kickOff(0);
    this.say(L({ tr: 'Santra sizde, sağdaki kaleye hücum ediyorsunuz! WASD: koş · Boşluk basılı tut, yeşilde bırak: şut · E: pas.', en: 'Your kick-off, attacking the goal on the right! WASD: run · hold Space, let go in the green: shoot · E: pass.' }), 5500);
    const loop = () => { this.tick(); this.draw(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
    if (import.meta.env.DEV) (window as unknown as { dackaFootball: FootballView }).dackaFootball = this;
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
    this.done({ us: this.score[0], them: this.score[1], goals: this.goals, shots: this.shots, quit });
  }

  private local(e: PointerEvent): [number, number] {
    const r = this.cv.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  }
  private say(text: string, ms = 2200) { this.msg = text; this.msgUntil = performance.now() + ms; }
  private flashText(t: string) { this.flash = t; this.flashUntil = performance.now() + 1300; }
  private pause(ms: number, then: () => void) { this.pauseUntil = performance.now() + ms; this.afterPause = then; this.charging = null; }

  // ---------- set pieces ----------

  /** everyone in their own half, `team` on the ball in the centre circle */
  private kickOff(team: 0 | 1) {
    const side = (t: 0 | 1) => (t === 0 ? -1 : 1);
    const place = (q: Player, x: number, y: number) => { q.x = x; q.y = y; q.vx = 0; q.vy = 0; q.face = q.team === 0 ? 0 : Math.PI; q.spotAt = 0; q.stumble = 0; };
    for (const t of [0, 1] as const) {
      const [a, b, k] = this.p.filter((q) => q.team === t);
      const s = side(t);
      place(k, ownGoalX(t) - s * 14, MID_Y);
      if (t === team) { place(a, W / 2 + s * 12, MID_Y); place(b, W / 2 + s * 70, MID_Y - 80); }
      else { place(a, W / 2 + s * 70, MID_Y); place(b, W / 2 + s * 110, MID_Y + 70); }
    }
    const taker = this.p.find((q) => q.team === team && !q.keeper && (team === 0 ? q.me : true))!;
    this.kickoffTeam = team;
    this.ball = { x: taker.x, y: taker.y, vx: 0, vy: 0, owner: taker, lastKick: null, kickAt: 0, shot: false };
    taker.holdSince = performance.now();
  }

  // ---------- your controls ----------

  private actionDown() {
    if (this.over || performance.now() < this.pauseUntil) return;
    const owner = this.ball.owner;
    if (owner === this.me) { this.charging = performance.now(); return; }
    if (owner && owner.team === 1 && this.me.cd <= 0) {
      this.me.cd = 0.6;
      if (dist(this.me.x, this.me.y, owner.x, owner.y) > 28) { this.say(L({ tr: 'Çok uzaktasın: top kapmak için yanına git.', en: 'Too far: get close to win the ball.' }), 1300); return; }
      if (Math.random() < 0.32 + this.o.me.skill * 0.3 - owner.skill * 0.2) { this.take(this.me); sfx.hop(); this.flashText(L({ tr: 'Top kapıldı!', en: 'Won it!' })); }
      else { this.me.stumble = 0.45; this.say(L({ tr: 'Kayarak girdin ama top kaçtı!', en: 'You went in but missed the ball!' }), 1300); }
    }
  }

  private actionUp() {
    if (this.charging === null) return;
    const m = this.meterAt(performance.now());
    this.charging = null;
    if (this.ball.owner !== this.me) return;
    const aim = (this.keys.has('w') || this.keys.has('ArrowUp') ? -1 : 0) + (this.keys.has('s') || this.keys.has('ArrowDown') ? 1 : 0);
    this.shoot(this.me, m, aim);
  }

  private passKey() {
    if (this.over || performance.now() < this.pauseUntil) return;
    const owner = this.ball.owner;
    if (owner === this.me) { this.charging = null; this.pass(this.me, this.bestTarget(this.me)); return; }
    if (owner && owner.team === 0) { this.wantPass = true; this.say(L({ tr: `"${owner.name}, buraya!"`, en: `"${owner.name}, over here!"` }), 1000); }
  }

  private meterAt(now: number) { const t = ((now - (this.charging ?? now)) % METER_MS) / METER_MS; return t < 0.5 ? t * 2 : 2 - t * 2; }

  // ---------- kicking ----------

  private openness(q: Player) { let best = Infinity; for (const d of this.p) if (d.team !== q.team) best = Math.min(best, dist(d.x, d.y, q.x, q.y)); return best; }

  /** the teammate a pass should go to: open, and the further forward the better (the keeper only as a last resort) */
  private bestTarget(from: Player): Player {
    const mates = this.p.filter((q) => q.team === from.team && q !== from);
    const fwd = from.team === 0 ? 1 : -1;
    const score = (q: Player) => Math.min(90, this.openness(q)) + (q.x - from.x) * fwd * 0.3 - (q.keeper ? 60 : 0);
    return mates.sort((a, b) => score(b) - score(a))[0];
  }

  private kick(from: Player, vx: number, vy: number, shot: boolean) {
    const b = this.ball;
    b.owner = null; b.lastKick = from; b.kickAt = performance.now(); b.shot = shot;
    b.x = from.x + Math.cos(from.face) * (R + BR + 1); b.y = from.y + Math.sin(from.face) * (R + BR + 1);
    b.vx = vx; b.vy = vy;
    sfx.click();
  }

  /** `m`: the meter where you let go (0–1); `aim`: −1 high, 0 middle, 1 low */
  private shoot(q: Player, m: number, aim: number) {
    const tx = goalX(q.team) + (q.team === 0 ? 14 : -14);
    const ty = MID_Y + aim * (MOUTH - 12) + (aim === 0 ? (Math.random() - 0.5) * 30 : 0);
    const inSweet = m >= SWEET[0] && m <= SWEET[1];
    const acc = Math.min(1, q.skill * 0.45 + (inSweet ? 0.55 + (this.o.bonus ?? 0) * 4 : 0.25));
    let a = Math.atan2(ty - q.y, tx - q.x) + (Math.random() - 0.5) * (1 - acc) * 0.7;
    if (m > SWEET[1]) a += (Math.random() < 0.5 ? -1 : 1) * (0.12 + Math.random() * 0.2); // leaned back: it flies wide
    const speed = 200 + 400 * Math.min(1, m / SWEET[1]);
    q.face = a;
    this.kick(q, Math.cos(a) * speed, Math.sin(a) * speed, true);
    if (q.me) {
      this.shots++;
      this.say(inSweet ? L({ tr: 'Tam yerinden vurdun!', en: 'Struck it sweetly!' }) : m > SWEET[1] ? L({ tr: 'Fazla sert, havaya gidiyor…', en: 'Too much on it, it’s flying…' }) : L({ tr: 'Zayıf vuruş…', en: 'A weak one…' }), 1300);
    }
  }

  private pass(from: Player, to: Player) {
    const lead = 0.35;
    const tx = clamp(to.x + to.vx * lead, CL + R, CR - R), ty = clamp(to.y + to.vy * lead, CT + R, CB - R);
    const d = dist(from.x, from.y, tx, ty);
    const a = Math.atan2(ty - from.y, tx - from.x) + (Math.random() - 0.5) * (1 - from.skill) * 0.25;
    const speed = Math.min(420, 170 + d * 1.1);
    from.face = a;
    this.kick(from, Math.cos(a) * speed, Math.sin(a) * speed, false);
    if (from.team === 0 && !from.me && to.me) this.say(L({ tr: `${from.name} sana pas verdi!`, en: `${from.name} passed to you!` }), 1200);
  }

  private take(q: Player) {
    const b = this.ball;
    const prev = b.owner?.team ?? b.lastKick?.team;
    b.owner = q; b.vx = 0; b.vy = 0; b.shot = false;
    q.holdSince = performance.now();
    if (prev !== undefined && prev !== q.team && q.team === 0 && !q.me && !q.keeper) this.say(L({ tr: `${q.name} topu kaptı.`, en: `${q.name} won the ball.` }), 1200);
  }

  // ---------- the game loop ----------

  private tick() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.over || now < this.pauseUntil) return;
    if (this.afterPause) { const f = this.afterPause; this.afterPause = null; f(); return; }
    if (now - this.startAt >= GAME_MS && !this.suddenDeath) {
      if (this.score[0] !== this.score[1]) { this.end(); return; }
      this.suddenDeath = true;
      this.say(L({ tr: 'Süre bitti, berabere: altın gol!', en: "Time's up and it's level: golden goal!" }), 3500);
    }
    for (const q of this.p) { q.cd = Math.max(0, q.cd - dt); q.stumble = Math.max(0, q.stumble - dt); }
    this.moveMe(dt);
    for (const q of this.p) if (!q.me) this.ai(q, dt, now);
    for (const q of this.p) {
      q.x = clamp(q.x + q.vx * dt, CL + R - (q.keeper ? 8 : 0), CR - R + (q.keeper ? 8 : 0));
      q.y = clamp(q.y + q.vy * dt, CT + R, CB - R);
      if (Math.hypot(q.vx, q.vy) > 8) q.face = Math.atan2(q.vy, q.vx);
    }
    this.separate();
    if (this.kickoffTeam !== null) {
      const b = this.ball;
      if (!b.owner || dist(b.x, b.y, W / 2, MID_Y) > 46) this.kickoffTeam = null;
      else for (const q of this.p) {
        if (q.team === this.kickoffTeam) continue;
        const d = dist(q.x, q.y, W / 2, MID_Y);
        if (d < 50) { const a = d > 1 ? Math.atan2(q.y - MID_Y, q.x - W / 2) : (q.team === 0 ? Math.PI : 0); q.x = W / 2 + Math.cos(a) * 50; q.y = MID_Y + Math.sin(a) * 50; }
      }
    }
    this.updateBall(dt, now);
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
    const sp = this.me.speed * (this.me.stumble > 0 ? 0.3 : 1) * (this.charging !== null ? 0.45 : 1) * (this.ball.owner === this.me ? 0.9 : 1);
    const tx = len ? (x / Math.max(1, len)) * sp : 0, ty = len ? (y / Math.max(1, len)) * sp : 0;
    const k = Math.min(1, dt * 12);
    this.me.vx += (tx - this.me.vx) * k; this.me.vy += (ty - this.me.vy) * k;
  }

  private steer(q: Player, tx: number, ty: number, dt: number, pace = 1) {
    const dx = tx - q.x, dy = ty - q.y, d = Math.hypot(dx, dy);
    const sp = d < 5 ? 0 : q.speed * pace * (q.stumble > 0 ? 0.3 : 1) * Math.min(1, d / 36);
    const vx = d ? (dx / d) * sp : 0, vy = d ? (dy / d) * sp : 0;
    const k = Math.min(1, dt * 8);
    q.vx += (vx - q.vx) * k; q.vy += (vy - q.vy) * k;
  }

  private ai(q: Player, dt: number, now: number) {
    const b = this.ball;
    if (q.keeper) { this.keep(q, dt, now); return; }
    const mates = this.p.filter((x) => x.team === q.team && x !== q && !x.keeper);
    const foes = this.p.filter((x) => x.team !== q.team);
    const fwd = q.team === 0 ? 1 : -1;
    if (b.owner === q) { this.carry(q, dt, now, foes); return; }
    if (!b.owner) {
      // a loose ball: the nearer of the two outfield players chases it (where it's going, not where it is)
      const px = b.x + b.vx * 0.25, py = b.y + b.vy * 0.25;
      const chaser = [q, ...mates].sort((a, c) => dist(a.x, a.y, px, py) - dist(c.x, c.y, px, py))[0];
      if (chaser === q) { this.steer(q, px, py, dt, 1.05); return; }
      this.steer(q, clamp(b.x + fwd * 70, CL + 40, CR - 40), MID_Y + (q.y < MID_Y ? -70 : 70), dt);
      return;
    }
    if (b.owner.team === q.team) {
      // support: ahead of the ball and out wide, somewhere a pass can find you
      if (now > q.spotAt) {
        const lane = b.owner.y < MID_Y ? 1 : -1;
        q.spot = [clamp(b.owner.x + fwd * (50 + Math.random() * 70), CL + 50, CR - 50), clamp(MID_Y + lane * (50 + Math.random() * 60), CT + 30, CB - 30)];
        q.spotAt = now + 1200 + Math.random() * 1200;
      }
      this.steer(q, q.spot[0], q.spot[1], dt);
      return;
    }
    // defending: the outfield player nearer the ball presses it, the other marks the spare attacker goal-side
    const carrier = b.owner;
    const presser = [q, ...mates].sort((a, c) => dist(a.x, a.y, carrier.x, carrier.y) - dist(c.x, c.y, carrier.x, carrier.y))[0];
    if (presser === q) {
      this.steer(q, carrier.x, carrier.y, dt, 1.02);
      if (q.cd <= 0 && dist(q.x, q.y, carrier.x, carrier.y) < 20) {
        q.cd = 1;
        if (Math.random() < Math.max(0.06, 0.18 + q.skill * 0.25 - carrier.skill * 0.15)) {
          if (Math.random() < 0.5) this.take(q);
          else { const a = Math.atan2(carrier.y - q.y, carrier.x - q.x); this.kick(q, Math.cos(a) * 120, Math.sin(a) * 120, false); this.ball.lastKick = q; }
          sfx.hop();
          if (carrier.team === 0) this.flashText(L({ tr: `${q.name} topu kaptı!`, en: `${q.name} won the ball!` }));
        } else q.stumble = 0.3;
      }
      return;
    }
    const mark = foes.filter((f) => !f.keeper && f !== carrier)[0] ?? carrier;
    const own = ownGoalX(q.team);
    const a = Math.atan2(MID_Y - mark.y, own - mark.x);
    this.steer(q, mark.x + Math.cos(a) * 26, mark.y + Math.sin(a) * 26, dt);
  }

  /** an AI on the ball: run at goal, beat or avoid the nearest man, pass to someone open, shoot in range */
  private carry(q: Player, dt: number, now: number, foes: Player[]) {
    const gx = goalX(q.team), fwd = q.team === 0 ? 1 : -1;
    const toGoal = dist(q.x, q.y, gx, MID_Y);
    if (now > q.think) {
      q.think = now + 260 + Math.random() * 220;
      const mate = this.bestTarget(q);
      if (mate.me && this.wantPass) { this.wantPass = false; this.pass(q, mate); return; }
      const open = this.openness(q);
      if (toGoal < 80 || (toGoal < 175 && (open > 45 || Math.random() < 0.3))) {
        const m = SWEET[0] + Math.random() * (SWEET[1] - SWEET[0]) + (Math.random() < 0.25 ? 0.12 : 0);
        this.shoot(q, Math.min(1, m), Math.random() < 0.5 ? -1 : 1);
        return;
      }
      const mateAhead = (mate.x - q.x) * fwd > 10;
      if (!mate.keeper && ((open < 24 && Math.random() < 0.45) || (mateAhead && this.openness(mate) > open + 25 && Math.random() < 0.35) || (mate.me && Math.random() < 0.12))) { this.pass(q, mate); return; }
      const block = foes.filter((f) => !f.keeper).sort((a, c) => dist(q.x, q.y, a.x, a.y) - dist(q.x, q.y, c.x, c.y))[0];
      const side = block && Math.abs(block.y - q.y) < 30 ? (block.y > q.y ? -1 : 1) : 0;
      q.spot = [clamp(q.x + fwd * 90, CL + 20, CR - 20), clamp(q.y + side * 50 + (MID_Y - q.y) * 0.3, CT + 20, CB - 20)];
    }
    this.steer(q, q.spot[0], q.spot[1], dt, 0.9);
  }

  /** the keeper: along the line between the posts, out to a loose ball near goal, and the ball away when it's theirs */
  private keep(q: Player, dt: number, now: number) {
    const b = this.ball, own = ownGoalX(q.team), out = q.team === 0 ? 1 : -1;
    if (b.owner === q) {
      this.steer(q, own + out * 20, MID_Y, dt);
      if (now - q.holdSince > 700) this.pass(q, this.bestTarget(q));
      return;
    }
    const near = Math.abs(b.x - own) < BOX.d + 20 && Math.abs(b.y - MID_Y) < BOX.h;
    if (!b.owner && near && Math.hypot(b.vx, b.vy) < 160) { this.steer(q, b.x, b.y, dt, 1.1); return; }
    const ty = clamp(MID_Y + (b.y - MID_Y) * 0.45, MID_Y - MOUTH + 6, MID_Y + MOUTH - 6);
    this.steer(q, own + out * 16, ty, dt, 1.1);
  }

  private separate() {
    for (let i = 0; i < this.p.length; i++) for (let j = i + 1; j < this.p.length; j++) {
      const a = this.p[i], b = this.p[j];
      const d = dist(a.x, a.y, b.x, b.y), min = R * 2;
      if (d >= min || d < 1e-3) continue;
      const push = (min - d) / 2, nx = (b.x - a.x) / d, ny = (b.y - a.y) / d;
      a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
    }
  }

  private updateBall(dt: number, now: number) {
    const b = this.ball;
    if (b.owner) {
      // at the feet of whoever has it, a little ahead of them
      const q = b.owner;
      b.x = q.x + Math.cos(q.face) * (R + 3); b.y = q.y + Math.sin(q.face) * (R + 3) + 4;
      return;
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    const f = Math.pow(0.42, dt); b.vx *= f; b.vy *= f;
    if (Math.hypot(b.vx, b.vy) < 6) { b.vx = 0; b.vy = 0; b.shot = false; }
    // the goals
    const inMouth = Math.abs(b.y - MID_Y) < MOUTH;
    if (inMouth && b.x < CL - 2) { this.goal(1); return; }
    if (inMouth && b.x > CR + 2) { this.goal(0); return; }
    // the walls round the pitch (the ends only either side of the goals)
    if (b.y < CT + BR) { b.y = CT + BR; b.vy = Math.abs(b.vy) * 0.7; }
    if (b.y > CB - BR) { b.y = CB - BR; b.vy = -Math.abs(b.vy) * 0.7; }
    if (!inMouth && b.x < CL + BR) { b.x = CL + BR; b.vx = Math.abs(b.vx) * 0.7; }
    if (!inMouth && b.x > CR - BR) { b.x = CR - BR; b.vx = -Math.abs(b.vx) * 0.7; }
    // who gets to it: a keeper may save a shot; a fast ball can run past anyone else
    const speed = Math.hypot(b.vx, b.vy);
    for (const q of [...this.p].sort((a, c) => dist(a.x, a.y, b.x, b.y) - dist(c.x, c.y, b.x, b.y))) {
      if (q === b.lastKick && now - b.kickAt < 280) continue;
      const reach = q.keeper ? R + 11 : R + BR + 2;
      if (dist(q.x, q.y, b.x, b.y) > reach || q.cd > 0.95) continue;
      if (q.keeper && b.shot && b.lastKick?.team !== q.team) {
        const save = clamp(0.5 + q.skill * 0.35 - (speed - 300) / 900, 0.15, 0.92);
        q.cd = 1; // one go at it
        if (Math.random() < save) {
          if (speed > 420 && Math.random() < 0.5) { b.vx = -b.vx * 0.4 + (Math.random() - 0.5) * 120; b.vy = (Math.random() - 0.5) * 260; b.lastKick = q; b.kickAt = now; b.shot = false; }
          else this.take(q);
          sfx.hop();
          this.flashText(L({ tr: `${q.name} kurtardı! 🧤`, en: `Saved by ${q.name}! 🧤` }));
        }
        return;
      }
      if (speed > 330 && Math.random() < 0.55) { q.cd = 1; continue; } // too hot to control
      this.take(q);
      return;
    }
  }

  private goal(team: 0 | 1) {
    this.score[team]++;
    const scorer = this.ball.lastKick;
    if (team === 0 && scorer?.me) this.goals++;
    if (team === 0) sfx.success(); else sfx.bump();
    this.flashText(team === 0 ? `GOOOL! ${scorer?.name ?? ''}` : L({ tr: `Gol yediniz · ${scorer?.name ?? ''}`, en: `They scored · ${scorer?.name ?? ''}` }));
    this.ball.vx = 0; this.ball.vy = 0;
    if (this.score[team] >= TARGET || this.suddenDeath) { this.pause(1400, () => this.end()); return; }
    this.pause(1400, () => this.kickOff(team === 0 ? 1 : 0));
  }

  private end() {
    const [us, them] = this.score;
    this.finish(false);
    this.say(us > them ? L({ tr: `Kazandınız! ${us}–${them}`, en: `You won! ${us}–${them}` }) : L({ tr: `Kaybettiniz: ${us}–${them}`, en: `You lost: ${us}–${them}` }), 999_999);
    if (us > them) sfx.success();
    const quit = this.el.querySelector('.fb-quit') as HTMLElement;
    quit.textContent = L({ tr: 'Devam (Enter)', en: 'Continue (Enter)' });
    quit.className = 'primary fb-quit';
  }

  // ---------- drawing ----------

  private draw() {
    const c = this.c, now = performance.now();
    c.fillStyle = '#5b6168'; c.fillRect(0, 0, W, H);
    // the turf, mown in stripes
    for (let i = 0; i < 10; i++) { c.fillStyle = i % 2 ? '#3f8a45' : '#479a4d'; c.fillRect(CL + ((CR - CL) / 10) * i, CT, (CR - CL) / 10 + 1, CB - CT); }
    c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 2;
    c.strokeRect(CL, CT, CR - CL, CB - CT);
    c.beginPath(); c.moveTo(W / 2, CT); c.lineTo(W / 2, CB); c.stroke();
    c.beginPath(); c.arc(W / 2, MID_Y, 42, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(W / 2, MID_Y, 2.5, 0, Math.PI * 2); c.fill();
    for (const x of [CL, CR]) {
      const s = x === CL ? 1 : -1;
      c.beginPath(); c.moveTo(x, MID_Y - BOX.h); c.arc(x, MID_Y, BOX.h, -Math.PI / 2, Math.PI / 2, s < 0); c.stroke();
      // the goal and its net
      const gx = x === CL ? x - 16 : x;
      c.fillStyle = 'rgba(255,255,255,0.16)'; c.fillRect(gx, MID_Y - MOUTH, 16, MOUTH * 2);
      c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 1;
      for (let yy = MID_Y - MOUTH; yy <= MID_Y + MOUTH; yy += 6) { c.beginPath(); c.moveTo(gx, yy); c.lineTo(gx + 16, yy); c.stroke(); }
      for (let xx = gx; xx <= gx + 16; xx += 6) { c.beginPath(); c.moveTo(xx, MID_Y - MOUTH); c.lineTo(xx, MID_Y + MOUTH); c.stroke(); }
      c.strokeStyle = '#ffffff'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(x, MID_Y - MOUTH); c.lineTo(x - s * 16, MID_Y - MOUTH); c.lineTo(x - s * 16, MID_Y + MOUTH); c.lineTo(x, MID_Y + MOUTH); c.stroke();
      c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,0.9)';
    }
    for (const q of [...this.p].sort((a, b) => a.y - b.y)) this.person(q, now);
    this.drawBall();
    if (this.charging !== null) {
      const v = this.meterAt(now);
      const bx = this.me.x + 18, by = this.me.y - 44, bh = 42, bw = 8;
      c.fillStyle = 'rgba(20,24,28,0.75)'; c.fillRect(bx, by, bw, bh);
      c.fillStyle = 'rgba(120,220,120,0.95)'; c.fillRect(bx, by + bh * (1 - SWEET[1]), bw, bh * (SWEET[1] - SWEET[0]));
      c.fillStyle = 'rgba(224,122,95,0.9)'; c.fillRect(bx, by, bw, bh * (1 - SWEET[1]));
      c.fillStyle = '#f2c14e'; c.fillRect(bx + 1, by + bh * (1 - v) - 1, bw - 2, 3);
    }
    if (this.joy) {
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 2;
      c.beginPath(); c.arc(this.joy.ox, this.joy.oy, 32, 0, Math.PI * 2); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.4)'; c.beginPath(); c.arc(this.joy.x, this.joy.y, 13, 0, Math.PI * 2); c.fill();
    }
    if (now < this.flashUntil) {
      c.font = 'bold 30px system-ui, sans-serif'; c.textAlign = 'center';
      c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 5; c.strokeText(this.flash, W / 2, MID_Y - 60);
      c.fillStyle = '#fff6c8'; c.fillText(this.flash, W / 2, MID_Y - 60);
    }
    this.hud(now);
  }

  private person(q: Player, now: number) {
    const c = this.c;
    const shirt = q.keeper ? (q.team === 0 ? '#e0b030' : '#2f9a6a') : q.team === 0 ? '#6e1f2d' : '#2e6fb0';
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(q.x, q.y + 9, 11, 4.5, 0, 0, Math.PI * 2); c.fill();
    if (q.me) { c.strokeStyle = '#f2c14e'; c.lineWidth = 2; c.beginPath(); c.ellipse(q.x, q.y + 9, 14, 6, 0, 0, Math.PI * 2); c.stroke(); }
    const run = Math.hypot(q.vx, q.vy) > 20 ? Math.sin(now / 65 + q.x) * 3 : 0;
    c.fillStyle = '#f4f4f2'; c.fillRect(q.x - 5, q.y + 1 + run, 4, 7); c.fillRect(q.x + 1, q.y + 1 - run, 4, 7);
    c.fillStyle = shirt; c.beginPath(); c.roundRect(q.x - 8, q.y - 11, 16, 13, 4); c.fill();
    if (q.keeper) { c.fillStyle = '#ffffff'; c.font = 'bold 8px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('🧤', q.x, q.y - 1); }
    c.fillStyle = q.skin; c.beginPath(); c.arc(q.x, q.y - 17, 6.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = q.hair; c.beginPath(); c.arc(q.x, q.y - 19, 6.5, Math.PI, Math.PI * 2); c.fill();
    c.font = 'bold 10px system-ui, sans-serif'; c.textAlign = 'center';
    c.strokeStyle = 'rgba(0,0,0,0.65)'; c.lineWidth = 3; c.lineJoin = 'round';
    c.strokeText(q.name, q.x, q.y - 28);
    c.fillStyle = q.me ? '#f2c14e' : '#ffffff'; c.fillText(q.name, q.x, q.y - 28);
  }

  private drawBall() {
    const c = this.c, b = this.ball;
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(b.x + 1, b.y + 3, BR, 2, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(b.x, b.y, BR, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#333'; c.lineWidth = 1; c.stroke();
    c.fillStyle = '#333'; c.beginPath(); c.arc(b.x, b.y, 1.8, 0, Math.PI * 2); c.fill();
  }

  private hud(now: number) {
    const left = Math.max(0, GAME_MS - (now - this.startAt));
    const mm = Math.floor(left / 60000), ss = Math.floor((left % 60000) / 1000);
    (this.el.querySelector('.fb-time') as HTMLElement).textContent = this.suddenDeath ? L({ tr: 'Altın gol', en: 'Golden goal' }) : `⏱ ${mm}:${String(ss).padStart(2, '0')} · ${L({ tr: `${TARGET} gole kadar`, en: `first to ${TARGET}` })}`;
    (this.el.querySelector('.fb-pts') as HTMLElement).textContent = `${this.score[0]} – ${this.score[1]}`;
    const owner = this.ball.owner;
    const act = this.el.querySelector('.fb-act') as HTMLButtonElement;
    const pass = this.el.querySelector('.fb-pass') as HTMLButtonElement;
    act.textContent = owner === this.me ? L({ tr: '⚽ Şut (Boşluk, basılı tut)', en: '⚽ Shoot (hold Space)' }) : owner?.team === 1 ? L({ tr: '🦵 Top kap (Boşluk)', en: '🦵 Tackle (Space)' }) : '⚽';
    pass.textContent = owner && owner.team === 0 && owner !== this.me ? L({ tr: '🙋 Pas iste (E)', en: '🙋 Call for it (E)' }) : L({ tr: '↪ Pas (E)', en: '↪ Pass (E)' });
    let line = now < this.msgUntil ? this.msg : '';
    if (!line) {
      if (owner === this.me) line = L({ tr: 'Sağdaki kaleye sür. Şutta W/S basılıysa üst/alt köşeye vurursun.', en: 'Take it at the goal on the right. Hold W or S as you shoot to aim high or low.' });
      else if (owner?.team === 0) line = L({ tr: 'Boşa koş; topu istemek için E.', en: 'Run into space; press E to call for the ball.' });
      else if (owner?.team === 1) line = L({ tr: 'Savunma: topa bas, yanına gelince Boşluk ile top kap.', en: 'Defence: close them down, press Space next to the ball to tackle.' });
      else line = L({ tr: 'Top boşta! Kap onu.', en: 'Loose ball! Get it.' });
    }
    (this.el.querySelector('.fb-status') as HTMLElement).textContent = line;
  }
}

let styled = false;
function injectStyles() {
  if (styled) return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = `
.fb-card { width: min(600px, 100%); }
.fb-card canvas { width: 100%; height: auto; display: block; border-radius: 8px; touch-action: none; }
.fb-time { font-size: 12px; opacity: 0.8; }
.fb-score { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px; margin-bottom: 8px; font-size: 12px; }
.fb-score span:first-child { color: #f2a7b4; } .fb-score span:last-child { color: #9cc6ef; text-align: right; }
.fb-pts { font-size: 24px; font-variant-numeric: tabular-nums; }
.fb-pad { display: flex; gap: 8px; }
.fb-pad button { user-select: none; -webkit-user-select: none; touch-action: none; }
`;
  document.head.appendChild(s);
}

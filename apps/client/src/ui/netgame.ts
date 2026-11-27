// Games over a net in the Kapalı Saha: badminton (you against one other) and volleyball (you and a friend against two).
// Seen from above: your side is the bottom half. The shuttle or ball flies in an arc; its shadow on the floor shows where
// it's heading, so get under it and press Space as it comes down to hit it back (E for a short one: a drop shot, or a
// tip over the net). In volleyball each side gets up to three touches: whoever takes the first passes it up to their
// partner, the partner attacks over the net. Hold A or D as you hit to send it left or right. Rally scoring, first to 11.
import { L } from '../i18n';
import { sfx } from '../audio';
import { injectPeerGameStyles } from './yetimball';
import type { BallerInfo } from './basketball';

export type NetSport = 'badminton' | 'voleybol';
export interface NetOpts {
  sport: NetSport;
  me: BallerInfo & { speed: number };
  /** your partner (volleyball only) */
  mate?: BallerInfo;
  /** one opponent for badminton, two for volleyball */
  opps: BallerInfo[];
}
export interface NetResult { us: number; them: number; winners: number; quit: boolean }

const W = 420, H = 540;
const CL = 46, CR = W - 46, CT = 34, CB = H - 34;
const NET_Y = H / 2;
const R = 10;
const REACH = 26;
const TARGET = 11;
const GAME_MS = 5 * 60_000;

interface Player extends BallerInfo {
  team: 0 | 1; me: boolean; x: number; y: number; vx: number; vy: number; speed: number; home: [number, number];
}
interface Flight {
  x0: number; y0: number; x1: number; y1: number; h0: number; peak: number; t: number; dur: number;
  /** the side that hit it last, and how many touches that side has had in a row */
  by: 0 | 1; touches: number; last: Player | null;
  /** it's going into the net (the hitter's fault) */
  net: boolean;
}

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const inCourt = (x: number, y: number) => x >= CL && x <= CR && y >= CT && y <= CB;

export class NetGameView {
  readonly el: HTMLElement;
  private cv: HTMLCanvasElement;
  private c: CanvasRenderingContext2D;
  private p: Player[];
  private me: Player;
  private f: Flight | null = null;
  /** who is serving, and since when (the server waits a moment) */
  private server: Player;
  private serveAt = 0;
  private score: [number, number] = [0, 0];
  private winners = 0;
  private startAt = performance.now();
  private last = performance.now();
  private pauseUntil = 0;
  private afterPause: (() => void) | null = null;
  private keys = new Set<string>();
  private joy: { ox: number; oy: number; x: number; y: number; id: number } | null = null;
  private msg = ''; private msgUntil = 0;
  private flash = ''; private flashUntil = 0;
  private over = false;
  private raf = 0;
  private done!: (r: NetResult) => void;
  readonly result: Promise<NetResult>;
  private vb: boolean;

  private onKey = (e: KeyboardEvent) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'e', 'Enter'].includes(k)) return;
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'keydown') {
      if (e.repeat) return;
      this.keys.add(k);
      if (k === ' ') this.swing(false);
      if (k === 'e') this.swing(true);
      if (k === 'Enter' && this.over) this.close();
    } else this.keys.delete(k);
  };

  constructor(host: HTMLElement, private o: NetOpts) {
    injectPeerGameStyles();
    injectStyles();
    this.vb = o.sport === 'voleybol';
    this.result = new Promise((r) => { this.done = r; });
    const mk = (i: BallerInfo, team: 0 | 1, me: boolean, home: [number, number], speed: number): Player => ({ ...i, team, me, x: home[0], y: home[1], vx: 0, vy: 0, speed, home });
    const ai = (s: number) => 118 + s * 44;
    if (this.vb) {
      this.me = mk(o.me, 0, true, [W / 2 - 70, NET_Y + 150], o.me.speed);
      this.p = [this.me, mk(o.mate!, 0, false, [W / 2 + 70, NET_Y + 90], ai(o.mate!.skill)),
        mk(o.opps[0], 1, false, [W / 2 - 70, NET_Y - 150], ai(o.opps[0].skill)), mk(o.opps[1], 1, false, [W / 2 + 70, NET_Y - 90], ai(o.opps[1].skill))];
    } else {
      this.me = mk(o.me, 0, true, [W / 2, NET_Y + 150], o.me.speed);
      this.p = [this.me, mk(o.opps[0], 1, false, [W / 2, NET_Y - 150], ai(o.opps[0].skill))];
    }
    this.server = this.me;
    this.el = document.createElement('div');
    this.el.className = 'yb-overlay';
    this.el.innerHTML = `
      <div class="yb-card ng-card">
        <div class="yb-head"><b>${this.vb ? L({ tr: '🏐 Voleybol · 2\'ye 2', en: '🏐 Volleyball · 2-on-2' }) : L({ tr: '🏸 Badminton · tekler', en: '🏸 Badminton · singles' })}</b><span class="ng-time"></span></div>
        <div class="fb-score"><span class="ng-us"></span><b class="fb-pts ng-pts"></b><span class="ng-them"></span></div>
        <canvas width="${W}" height="${H}"></canvas>
        <div class="yb-status ng-status"></div>
        <div class="yb-row">
          <button type="button" class="secondary ng-quit"></button>
          <span class="fb-pad">
            <button type="button" class="secondary ng-soft"></button>
            <button type="button" class="primary ng-hit"></button>
          </span>
        </div>
      </div>`;
    this.cv = this.el.querySelector('canvas')!;
    this.c = this.cv.getContext('2d')!;
    (this.el.querySelector('.ng-us') as HTMLElement).textContent = [o.me.name, o.mate?.name].filter(Boolean).join(' & ');
    (this.el.querySelector('.ng-them') as HTMLElement).textContent = o.opps.map((x) => x.name).join(' & ');
    (this.el.querySelector('.ng-quit') as HTMLElement).textContent = L({ tr: 'Oyundan çık', en: 'Leave the game' });
    (this.el.querySelector('.ng-hit') as HTMLElement).textContent = this.vb ? L({ tr: '🏐 Vur (Boşluk)', en: '🏐 Hit (Space)' }) : L({ tr: '🏸 Vur (Boşluk)', en: '🏸 Hit (Space)' });
    (this.el.querySelector('.ng-soft') as HTMLElement).textContent = this.vb ? L({ tr: '👆 Plase (E)', en: '👆 Tip (E)' }) : L({ tr: '🪶 Kısa (E)', en: '🪶 Drop (E)' });
    this.el.querySelector('.ng-hit')!.addEventListener('pointerdown', (e) => { e.preventDefault(); this.swing(false); });
    this.el.querySelector('.ng-soft')!.addEventListener('pointerdown', (e) => { e.preventDefault(); this.swing(true); });
    this.el.querySelector('.ng-quit')!.addEventListener('click', () => { if (!this.over) this.finish(true); this.close(); });
    this.cv.addEventListener('pointerdown', (e) => { const [x, y] = this.local(e); this.joy = { ox: x, oy: y, x, y, id: e.pointerId }; this.cv.setPointerCapture(e.pointerId); });
    this.cv.addEventListener('pointermove', (e) => { if (this.joy?.id === e.pointerId) { const [x, y] = this.local(e); this.joy.x = x; this.joy.y = y; } });
    const endJoy = (e: PointerEvent) => { if (this.joy?.id === e.pointerId) this.joy = null; };
    this.cv.addEventListener('pointerup', endJoy);
    this.cv.addEventListener('pointercancel', endJoy);
    window.addEventListener('keydown', this.onKey, true);
    window.addEventListener('keyup', this.onKey, true);
    host.appendChild(this.el);
    this.toServe(this.me);
    this.say(this.vb
      ? L({ tr: 'Servis sende: Boşluk. Top gelince gölgesine koş ve inerken Boşluk: ilk dokunuşla arkadaşına pas verirsin, ondan gelen topu fileden vurursun. E: direkt plase.', en: "Your serve: Space. When the ball comes, run to its shadow and press Space as it drops: a first touch passes to your partner, their pass you hit over. E: tip it straight over." })
      : L({ tr: 'Servis sende: Boşluk. Top gelince gölgesine koş ve inerken Boşluk ile vur. E: fileye yakın kısa top. Vururken A/D ile sola/sağa yönlendir.', en: 'Your serve: Space. When the shuttle comes, run to its shadow and press Space as it drops. E: a short drop shot. Hold A/D as you hit to aim.' }), 6000);
    const loop = () => { this.tick(); this.draw(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
    if (import.meta.env.DEV) (window as unknown as { dackaNet: NetGameView }).dackaNet = this;
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
    this.done({ us: this.score[0], them: this.score[1], winners: this.winners, quit });
  }
  private local(e: PointerEvent): [number, number] { const r = this.cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]; }
  private say(t: string, ms = 2200) { this.msg = t; this.msgUntil = performance.now() + ms; }
  private flashText(t: string) { this.flash = t; this.flashUntil = performance.now() + 1100; }
  private pause(ms: number, then: () => void) { this.pauseUntil = performance.now() + ms; this.afterPause = then; }

  // ---------- serving and hitting ----------

  private toServe(q: Player) {
    this.f = null;
    this.server = q;
    this.serveAt = performance.now();
    for (const x of this.p) { x.x = x.home[0]; x.y = x.home[1]; x.vx = 0; x.vy = 0; }
    // the server stands at the back
    q.y = q.team === 0 ? CB - 22 : CT + 22;
  }

  /** where the ball is now: on the floor (x, y) and how high (z) */
  private pos(f: Flight) {
    const t = Math.min(1, f.t / f.dur);
    return { x: f.x0 + (f.x1 - f.x0) * t, y: f.y0 + (f.y1 - f.y0) * t, z: f.h0 * (1 - t) + f.peak * 4 * t * (1 - t), t };
  }

  /** a hit by `q`: `soft` = drop shot / tip; `aim` −1 left … 1 right (−2 = pick a spot away from the other side) */
  private hit(q: Player, soft: boolean, aim: number, quality: number) {
    const prev = this.f;
    const sameSide = !!prev && prev.by === q.team;
    const touches = sameSide ? prev!.touches + 1 : 1;
    const toward = q.team === 0 ? -1 : 1; // where the other side is (−1 = up)
    const partner = this.p.find((x) => x.team === q.team && x !== q);
    // volleyball: the first touch goes up to the partner, near the net; the second (or a soft one, or the third) goes over
    if (this.vb && partner && touches === 1 && !soft) {
      const tx = clamp(partner.x + (Math.random() - 0.5) * 20, CL + 30, CR - 30), ty = NET_Y - toward * (60 + Math.random() * 30);
      const err = (1 - quality) * 40;
      this.f = { x0: q.x, y0: q.y, x1: tx + (Math.random() - 0.5) * err, y1: ty + (Math.random() - 0.5) * err, h0: 26, peak: 120, t: 0, dur: 1.05, by: q.team, touches, last: q, net: false };
      sfx.click();
      return;
    }
    const foes = this.p.filter((x) => x.team !== q.team);
    let tx: number;
    if (aim === -2) {
      // the AI: away from whoever would have to reach it
      const left = CL + 40, right = CR - 40;
      tx = Math.abs(foes[0].x - left) > Math.abs(foes[0].x - right) ? left + Math.random() * 60 : right - Math.random() * 60;
      if (foes.length > 1) tx = W / 2 + (Math.random() - 0.5) * (CR - CL - 80);
    } else tx = W / 2 + aim * 110 + (Math.random() - 0.5) * 60;
    const deep = soft ? 50 + Math.random() * 40 : this.vb ? 120 + Math.random() * 90 : 170 + Math.random() * 50;
    let ty = NET_Y + toward * deep;
    // a mishit: off target, maybe long or wide, maybe into the net
    const err = (1 - quality) * 120;
    tx += (Math.random() - 0.5) * err; ty += toward * (Math.random() - 0.3) * err * 0.7;
    const netRisk = clamp(0.2 - quality * 0.22 + (soft ? 0.06 : 0), 0.01, 0.25);
    const net = Math.random() < netRisk;
    if (net) { ty = NET_Y - toward * 8; }
    const spike = this.vb && !soft && Math.abs(q.y - NET_Y) < 90 && touches >= 2;
    const dur = soft ? 0.95 : spike ? 0.55 : this.vb ? 1.0 : 1.25 + Math.random() * 0.2;
    const peak = soft ? 70 : spike ? 18 : this.vb ? 95 : 130;
    this.f = { x0: q.x, y0: q.y, x1: tx, y1: ty, h0: spike ? 46 : 26, peak, t: 0, dur, by: q.team, touches, last: q, net };
    sfx.click();
    if (spike && q.team === 0) this.flashText(L({ tr: 'Smaç!', en: 'Spike!' }));
  }

  private serve(q: Player) {
    const toward = q.team === 0 ? -1 : 1;
    const tx = W / 2 + (Math.random() - 0.5) * 160, ty = NET_Y + toward * (this.vb ? 150 : 170);
    const quality = q.me ? 0.85 : 0.7 + q.skill * 0.3;
    const net = Math.random() < 0.08 - quality * 0.05;
    this.f = { x0: q.x, y0: q.y, x1: tx, y1: net ? NET_Y - toward * 8 : ty, h0: 30, peak: this.vb ? 120 : 140, t: 0, dur: this.vb ? 1.25 : 1.4, by: q.team, touches: 1, last: q, net };
    sfx.click();
  }

  /** the ball is coming down on `q`'s side, for them to play (not the one who just touched it) */
  private comingTo(q: Player, f: Flight) {
    return !f.net && (f.y1 > NET_Y ? 0 : 1) === q.team && f.last !== q && !(f.by === q.team && f.touches >= 3);
  }

  /** your swing: a serve, or a hit if the ball is in reach and low enough */
  private swing(soft: boolean) {
    if (this.over || performance.now() < this.pauseUntil) return;
    if (!this.f) { if (this.server === this.me) this.serve(this.me); return; }
    const f = this.f, b = this.pos(f);
    if (!this.comingTo(this.me, f)) return;
    const d = dist(this.me.x, this.me.y, b.x, b.y);
    if (d > REACH || b.z > 60 || b.t < 0.3) { this.say(d > REACH ? L({ tr: 'Yetişemedin: gölgenin üstüne git!', en: "Out of reach: get onto the shadow!" }) : L({ tr: 'Erken! İnmesini bekle.', en: 'Too early! Let it drop.' }), 1100); return; }
    const aim = (this.keys.has('a') || this.keys.has('ArrowLeft') ? -1 : 0) + (this.keys.has('d') || this.keys.has('ArrowRight') ? 1 : 0);
    const quality = clamp(1 - d / REACH * 0.5 - Math.abs(b.z - 22) / 120 + this.o.me.skill * 0.25, 0.15, 1);
    this.hit(this.me, soft, aim, quality);
  }

  // ---------- the loop ----------

  private tick() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.over || now < this.pauseUntil) return;
    if (this.afterPause) { const fn = this.afterPause; this.afterPause = null; fn(); return; }
    if (now - this.startAt > GAME_MS && this.score[0] !== this.score[1] && !this.f) { this.end(); return; }
    this.moveMe(dt);
    // an AI serves after a moment
    if (!this.f && !this.server.me && now - this.serveAt > 1100) this.serve(this.server);
    const f = this.f;
    const b = f ? this.pos(f) : null;
    for (const q of this.p) {
      if (q.me) continue;
      let tx = q.home[0], ty = q.home[1];
      if (f && b) {
        const coming = this.comingTo(q, f);
        if (coming) {
          // the one of us nearer the landing spot goes for it (in volleyball, not whoever touched it last)
          const side = this.p.filter((x) => x.team === q.team && x !== f.last);
          const taker = side.sort((a, c) => dist(a.x, a.y, f.x1, f.y1) - dist(c.x, c.y, f.x1, f.y1))[0];
          if (taker === q) { tx = f.x1; ty = f.y1; }
        }
        // ready to hit: in reach as it comes down
        if (coming && dist(q.x, q.y, b.x, b.y) < REACH && b.z < 48 && b.t > 0.45) {
          const quality = clamp(q.skill * 0.6 + Math.random() * 0.4 - (dist(q.x, q.y, b.x, b.y) / REACH) * 0.15, 0.15, 1);
          const sameSide = f.by === q.team;
          // (volleyball: a first touch goes up to the partner, the second over; now and then a soft one)
          this.hit(q, Math.random() < 0.15 && (!this.vb || sameSide), -2, quality);
          continue;
        }
      }
      this.steer(q, tx, ty, dt);
    }
    for (const q of this.p) {
      q.x = clamp(q.x + q.vx * dt, CL - 20, CR + 20);
      q.y = q.team === 0 ? clamp(q.y + q.vy * dt, NET_Y + R + 4, CB + 20) : clamp(q.y + q.vy * dt, CT - 20, NET_Y - R - 4);
    }
    if (f) {
      f.t += dt;
      if (f.t >= f.dur) this.landed(f);
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
    // the server stays put until the serve
    if (!this.f && this.server === this.me) { x = 0; y = 0; }
    const len = Math.hypot(x, y), sp = this.me.speed;
    const tx = len ? (x / Math.max(1, len)) * sp : 0, ty = len ? (y / Math.max(1, len)) * sp : 0;
    const k = Math.min(1, dt * 14);
    this.me.vx += (tx - this.me.vx) * k; this.me.vy += (ty - this.me.vy) * k;
  }

  private steer(q: Player, tx: number, ty: number, dt: number) {
    const dx = tx - q.x, dy = ty - q.y, d = Math.hypot(dx, dy);
    const sp = d < 4 ? 0 : q.speed * Math.min(1, d / 30);
    const vx = d ? (dx / d) * sp : 0, vy = d ? (dy / d) * sp : 0;
    const k = Math.min(1, dt * 10);
    q.vx += (vx - q.vx) * k; q.vy += (vy - q.vy) * k;
  }

  /** it came down: whose point is it? */
  private landed(f: Flight) {
    const side: 0 | 1 = f.y1 > NET_Y ? 0 : 1;
    let winner: 0 | 1;
    let why: string;
    if (f.net) { winner = f.by === 0 ? 1 : 0; why = L({ tr: 'Fileye takıldı!', en: 'Into the net!' }); }
    else if (side === f.by) { winner = f.by === 0 ? 1 : 0; why = L({ tr: 'Yere düştü!', en: 'It hit the floor!' }); }
    else if (!inCourt(f.x1, f.y1)) { winner = f.by === 0 ? 1 : 0; why = L({ tr: 'Out!', en: 'Out!' }); }
    else { winner = f.by; why = L({ tr: 'Sayı!', en: 'Point!' }); }
    this.point(winner, why, f);
  }

  private point(winner: 0 | 1, why: string, f: Flight) {
    this.score[winner]++;
    if (winner === 0 && f.last?.me && f.by === 0) this.winners++;
    this.flashText(`${why} ${winner === 0 ? '✓' : '✗'}`);
    if (winner === 0) sfx.hop(); else sfx.bump();
    this.f = null;
    const [a, b] = this.score;
    if ((a >= TARGET || b >= TARGET) && Math.abs(a - b) >= 1) { this.pause(1100, () => this.end()); return; }
    // whoever won the point serves (in volleyball the side rotates who serves)
    const side = this.p.filter((x) => x.team === winner);
    const next = side.length > 1 && this.server.team === winner ? this.server : side[(a + b) % side.length];
    this.pause(1100, () => this.toServe(next));
  }

  private end() {
    const [us, them] = this.score;
    this.finish(false);
    this.say(us > them ? L({ tr: `Kazandınız! ${us}–${them}`, en: `You won! ${us}–${them}` }) : L({ tr: `Kaybettiniz: ${us}–${them}`, en: `You lost: ${us}–${them}` }), 999_999);
    if (us > them) sfx.success();
    const quit = this.el.querySelector('.ng-quit') as HTMLElement;
    quit.textContent = L({ tr: 'Devam (Enter)', en: 'Continue (Enter)' });
    quit.className = 'primary ng-quit';
  }

  // ---------- drawing ----------

  private draw() {
    const c = this.c, now = performance.now();
    c.fillStyle = '#7a5a3a'; c.fillRect(0, 0, W, H);
    c.fillStyle = this.vb ? '#d98b4a' : '#2f7d5b'; c.fillRect(CL, CT, CR - CL, CB - CT);
    c.strokeStyle = 'rgba(255,255,255,0.92)'; c.lineWidth = 2.5;
    c.strokeRect(CL, CT, CR - CL, CB - CT);
    if (this.vb) { for (const y of [NET_Y - 90, NET_Y + 90]) { c.beginPath(); c.moveTo(CL, y); c.lineTo(CR, y); c.stroke(); } }
    else {
      for (const y of [NET_Y - 60, NET_Y + 60]) { c.beginPath(); c.moveTo(CL, y); c.lineTo(CR, y); c.stroke(); }
      c.beginPath(); c.moveTo(W / 2, CT); c.lineTo(W / 2, NET_Y - 60); c.moveTo(W / 2, NET_Y + 60); c.lineTo(W / 2, CB); c.stroke();
    }
    const f = this.f, b = f ? this.pos(f) : null;
    // the far side's players are behind the net, then the net, then the near side
    const far = this.p.filter((q) => q.team === 1), near = this.p.filter((q) => q.team === 0);
    for (const q of far) this.person(q, now);
    if (b && b.y < NET_Y) this.drawBall(b);
    // the net: posts, the mesh band, the white tape on top
    c.fillStyle = '#444'; c.fillRect(CL - 12, NET_Y - 40, 5, 42); c.fillRect(CR + 7, NET_Y - 40, 5, 42);
    c.fillStyle = 'rgba(20,20,24,0.45)'; c.fillRect(CL - 8, NET_Y - 34, CR - CL + 16, 26);
    c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 1;
    for (let x = CL - 8; x < CR + 8; x += 6) { c.beginPath(); c.moveTo(x, NET_Y - 34); c.lineTo(x, NET_Y - 8); c.stroke(); }
    c.fillStyle = '#f4f4f2'; c.fillRect(CL - 8, NET_Y - 36, CR - CL + 16, 4);
    c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(CL - 8, NET_Y, CR - CL + 16, 3);
    if (b && b.y >= NET_Y) this.drawBall(b);
    // where it will land (your side only, so you can get there)
    if (f && !f.net && f.y1 > NET_Y) {
      c.strokeStyle = 'rgba(255,255,255,0.45)'; c.setLineDash([4, 4]); c.lineWidth = 1.5;
      c.beginPath(); c.ellipse(f.x1, f.y1, 12, 5, 0, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    }
    for (const q of near) this.person(q, now);
    if (this.joy) {
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 2;
      c.beginPath(); c.arc(this.joy.ox, this.joy.oy, 32, 0, Math.PI * 2); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.4)'; c.beginPath(); c.arc(this.joy.x, this.joy.y, 13, 0, Math.PI * 2); c.fill();
    }
    if (now < this.flashUntil) {
      c.font = 'bold 28px system-ui, sans-serif'; c.textAlign = 'center';
      c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 5; c.strokeText(this.flash, W / 2, NET_Y + 70);
      c.fillStyle = '#fff6c8'; c.fillText(this.flash, W / 2, NET_Y + 70);
    }
    this.hud(now);
  }

  private drawBall(b: { x: number; y: number; z: number }) {
    const c = this.c;
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(b.x, b.y + 2, this.vb ? 6 : 4, 2.5, 0, 0, Math.PI * 2); c.fill();
    const y = b.y - b.z;
    if (this.vb) {
      c.fillStyle = '#f7f3e6'; c.beginPath(); c.arc(b.x, y, 7, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#2e6fb0'; c.lineWidth = 2; c.beginPath(); c.arc(b.x, y, 7, 0.3, 1.6); c.stroke();
      c.strokeStyle = '#f2c14e'; c.beginPath(); c.arc(b.x, y, 7, 2.4, 3.8); c.stroke();
    } else {
      // a shuttlecock: the cork and the feathers
      c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(b.x - 5, y - 6); c.lineTo(b.x + 5, y - 6); c.lineTo(b.x + 2, y + 2); c.lineTo(b.x - 2, y + 2); c.closePath(); c.fill();
      c.fillStyle = '#e8c39a'; c.beginPath(); c.arc(b.x, y + 3, 2.5, 0, Math.PI * 2); c.fill();
    }
  }

  private person(q: Player, now: number) {
    const c = this.c;
    const shirt = q.team === 0 ? '#6e1f2d' : '#2e6fb0';
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(q.x, q.y + 9, 11, 4.5, 0, 0, Math.PI * 2); c.fill();
    if (q.me) { c.strokeStyle = '#f2c14e'; c.lineWidth = 2; c.beginPath(); c.ellipse(q.x, q.y + 9, 14, 6, 0, 0, Math.PI * 2); c.stroke(); }
    const run = Math.hypot(q.vx, q.vy) > 20 ? Math.sin(now / 65 + q.x) * 3 : 0;
    c.fillStyle = '#f4f4f2'; c.fillRect(q.x - 5, q.y + 1 + run, 4, 7); c.fillRect(q.x + 1, q.y + 1 - run, 4, 7);
    c.fillStyle = shirt; c.beginPath(); c.roundRect(q.x - 8, q.y - 11, 16, 13, 4); c.fill();
    if (!this.vb) { c.strokeStyle = '#ddd'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(q.x + 8, q.y - 6); c.lineTo(q.x + 16, q.y - 16); c.stroke(); c.beginPath(); c.ellipse(q.x + 18, q.y - 19, 4, 5, 0.6, 0, Math.PI * 2); c.stroke(); }
    c.fillStyle = q.skin; c.beginPath(); c.arc(q.x, q.y - 17, 6.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = q.hair; c.beginPath(); c.arc(q.x, q.y - 19, 6.5, Math.PI, Math.PI * 2); c.fill();
    c.font = 'bold 10px system-ui, sans-serif'; c.textAlign = 'center';
    c.strokeStyle = 'rgba(0,0,0,0.65)'; c.lineWidth = 3; c.lineJoin = 'round';
    c.strokeText(q.name, q.x, q.y - 28);
    c.fillStyle = q.me ? '#f2c14e' : '#ffffff'; c.fillText(q.name, q.x, q.y - 28);
  }

  private hud(now: number) {
    const left = Math.max(0, GAME_MS - (now - this.startAt));
    const mm = Math.floor(left / 60000), ss = Math.floor((left % 60000) / 1000);
    (this.el.querySelector('.ng-time') as HTMLElement).textContent = `⏱ ${mm}:${String(ss).padStart(2, '0')} · ${L({ tr: `${TARGET}'e kadar`, en: `to ${TARGET}` })}`;
    (this.el.querySelector('.ng-pts') as HTMLElement).textContent = `${this.score[0]} – ${this.score[1]}`;
    let line = now < this.msgUntil ? this.msg : '';
    if (!line) {
      const f = this.f;
      if (!f) line = this.server === this.me ? L({ tr: 'Servis sende: Boşluk.', en: 'Your serve: Space.' }) : L({ tr: `${this.server.name} servis atıyor…`, en: `${this.server.name} is serving…` });
      else if (f.by === 1 && this.comingTo(this.me, f)) line = L({ tr: 'Gölgeye koş, inerken Boşluk (E: kısa).', en: 'Run to the shadow, Space as it drops (E: short).' });
      else if (this.vb && f.by === 0 && this.comingTo(this.me, f)) line = L({ tr: 'Arkadaşın pas verdi: topun altına gir ve Boşluk ile fileden vur!', en: 'Your partner set it: get under it and hit it over with Space!' });
      else line = L({ tr: 'Geri çekil, karşılığı bekle.', en: 'Get back and wait for the return.' });
    }
    (this.el.querySelector('.ng-status') as HTMLElement).textContent = line;
  }
}

let styled = false;
function injectStyles() {
  if (styled) return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = `
.ng-card { width: min(460px, 100%); }
.ng-card canvas { width: 100%; height: auto; display: block; border-radius: 8px; touch-action: none; max-height: 62vh; object-fit: contain; }
.ng-time { font-size: 12px; opacity: 0.8; }
.fb-score { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px; margin-bottom: 8px; font-size: 12px; }
.fb-score span:first-child { color: #f2a7b4; } .fb-score span:last-child { color: #9cc6ef; text-align: right; }
.fb-pts { font-size: 24px; font-variant-numeric: tabular-nums; }
.fb-pad { display: flex; gap: 8px; }
.fb-pad button { user-select: none; -webkit-user-select: none; touch-action: none; }
`;
  document.head.appendChild(s);
}

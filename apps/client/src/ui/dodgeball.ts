// Yakar top, the way it's played in the schoolyard: two "ebe" at either end throw the ball across at everyone in the
// middle. Whoever it hits is out ("yandı"); catch it cleanly and you earn a life ("can"). The last one left in the
// middle wins, and so does anyone still in when the time is up. You dodge with WASD / the arrow keys (or by dragging)
// and press Space just as the ball reaches you to catch it. The throws get faster and sharper as the game goes on.
import { L } from '../i18n';
import { sfx } from '../audio';
import { injectPeerGameStyles } from './yetimball';
import type { BallerInfo } from './basketball';

export interface DodgeOpts {
  me: BallerInfo & { speed: number };
  /** the others in the middle with you */
  mates: BallerInfo[];
  /** the two throwers */
  ebes: [BallerInfo, BallerInfo];
}
export interface DodgeResult { won: boolean; last: boolean; seconds: number; catches: number; quit: boolean }

const W = 440, H = 520;
const ZL = 40, ZR = W - 40, ZT = 120, ZB = H - 120; // the middle
const TOP = 70, BOTTOM = H - 70; // the ebes' lines
const R = 10, BR = 7;
const GAME_MS = 75_000;
/** how long a catch is "on" after you press Space */
const CATCH_MS = 260;

interface Kid extends BallerInfo { x: number; y: number; vx: number; vy: number; speed: number; me: boolean; out: boolean; lives: number; plan: number; dodge: number | null; wander?: [number, number] }
interface Ebe extends BallerInfo { x: number; y: number; vx: number; side: -1 | 1 }
type Ball = { kind: 'held'; by: Ebe; since: number; wait: number } | { kind: 'fly'; x: number; y: number; vx: number; vy: number; from: Ebe } | { kind: 'loose'; x: number; y: number; to: Ebe; at: number };

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export class DodgeballView {
  readonly el: HTMLElement;
  private cv: HTMLCanvasElement;
  private c: CanvasRenderingContext2D;
  private kids: Kid[];
  private me: Kid;
  private ebes: [Ebe, Ebe];
  private ball: Ball;
  private startAt = performance.now();
  private last = performance.now();
  private catchUntil = 0;
  private catchCd = 0;
  private catches = 0;
  private outAt = 0;
  private keys = new Set<string>();
  private joy: { ox: number; oy: number; x: number; y: number; id: number } | null = null;
  private msg = ''; private msgUntil = 0;
  private flash = ''; private flashUntil = 0;
  private ended = false;
  private raf = 0;
  private done!: (r: DodgeResult) => void;
  readonly result: Promise<DodgeResult>;
  private onKey = (e: KeyboardEvent) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter'].includes(k)) return;
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'keydown') { if (e.repeat) return; this.keys.add(k); if (k === ' ') this.tryCatch(); if (k === 'Enter' && this.ended) this.close(); }
    else this.keys.delete(k);
  };

  constructor(host: HTMLElement, private o: DodgeOpts) {
    injectPeerGameStyles();
    injectStyles();
    this.result = new Promise((r) => { this.done = r; });
    const kid = (i: BallerInfo, me: boolean, x: number, y: number, speed: number): Kid => ({ ...i, x, y, vx: 0, vy: 0, speed, me, out: false, lives: 1, plan: 0, dodge: null });
    this.me = kid(o.me, true, W / 2, H / 2, o.me.speed);
    this.kids = [this.me, ...o.mates.map((m, i) => kid(m, false, ZL + 40 + ((i * 97) % (ZR - ZL - 80)), ZT + 40 + ((i * 61) % (ZB - ZT - 80)), 120 + m.skill * 50))];
    this.ebes = [{ ...o.ebes[0], x: W / 2, y: TOP, vx: 0, side: -1 }, { ...o.ebes[1], x: W / 2, y: BOTTOM, vx: 0, side: 1 }];
    this.ball = { kind: 'held', by: this.ebes[0], since: performance.now(), wait: 3200 };
    this.el = document.createElement('div');
    this.el.className = 'pg-overlay';
    this.el.innerHTML = `
      <div class="pg-card db-card">
        <div class="yb-head"><b>🏐 ${L({ tr: 'Yakar top', en: 'Dodgeball' })}</b><span class="db-time"></span></div>
        <div class="pg-score db-score"></div>
        <canvas width="${W}" height="${H}"></canvas>
        <div class="pg-status db-status"></div>
        <div class="pg-row"><button type="button" class="secondary pg-quit"></button><button type="button" class="primary db-catch"></button></div>
      </div>`;
    this.cv = this.el.querySelector('canvas')!;
    this.c = this.cv.getContext('2d')!;
    (this.el.querySelector('.pg-quit') as HTMLElement).textContent = L({ tr: 'Oyundan çık', en: 'Leave the game' });
    (this.el.querySelector('.db-catch') as HTMLElement).textContent = L({ tr: '🙌 Tut! (Boşluk)', en: '🙌 Catch! (Space)' });
    this.el.querySelector('.db-catch')!.addEventListener('pointerdown', (e) => { e.preventDefault(); this.tryCatch(); });
    this.el.querySelector('.pg-quit')!.addEventListener('click', () => { if (!this.ended) this.finish(true); this.close(); });
    this.cv.addEventListener('pointerdown', (e) => { const [x, y] = this.local(e); this.joy = { ox: x, oy: y, x, y, id: e.pointerId }; this.cv.setPointerCapture(e.pointerId); });
    this.cv.addEventListener('pointermove', (e) => { if (this.joy?.id === e.pointerId) { const [x, y] = this.local(e); this.joy.x = x; this.joy.y = y; } });
    const endJoy = (e: PointerEvent) => { if (this.joy?.id === e.pointerId) this.joy = null; };
    this.cv.addEventListener('pointerup', endJoy);
    this.cv.addEventListener('pointercancel', endJoy);
    window.addEventListener('keydown', this.onKey, true);
    window.addEventListener('keyup', this.onKey, true);
    host.appendChild(this.el);
    this.say(L({ tr: `${o.ebes[0].name} ve ${o.ebes[1].name} ebe! WASD ile kaç; top tam sana gelirken Boşluk'a basarsan tutarsın (+1 can).`, en: `${o.ebes[0].name} and ${o.ebes[1].name} are throwing! Dodge with WASD; press Space just as the ball reaches you to catch it (+1 life).` }), 5500);
    const loop = () => { this.tick(); this.draw(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
    if (import.meta.env.DEV) (window as unknown as { dackaDodge: DodgeballView }).dackaDodge = this;
  }

  close() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('keyup', this.onKey, true);
    this.el.remove();
    if (!this.ended) this.finish(true);
  }
  private finish(quit: boolean, won = false) {
    if (this.ended) return;
    this.ended = true;
    const alive = this.kids.filter((k) => !k.out);
    const seconds = Math.round(((this.outAt || performance.now()) - this.startAt) / 1000);
    this.done({ won, last: won && alive.length === 1, seconds, catches: this.catches, quit });
    const q = this.el.querySelector('.pg-quit') as HTMLElement;
    q.textContent = L({ tr: 'Kapat (Enter)', en: 'Close (Enter)' });
    q.className = 'primary pg-quit';
    (this.el.querySelector('.db-catch') as HTMLElement).style.display = 'none';
  }
  private say(t: string, ms = 2200) { this.msg = t; this.msgUntil = performance.now() + ms; }
  private flashText(t: string) { this.flash = t; this.flashUntil = performance.now() + 1000; }
  private local(e: PointerEvent): [number, number] { const r = this.cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]; }
  /** 0 at the start, 1 by the end: the throws get faster and sharper */
  private heat(now: number) { return clamp((now - this.startAt) / GAME_MS, 0, 1); }

  private tryCatch() {
    if (this.ended || this.me.out || this.catchCd > 0) return;
    this.catchUntil = performance.now() + CATCH_MS;
    this.catchCd = 0.7;
  }

  // ---------- the loop ----------

  private tick() {
    const now = performance.now();
    const dt = Math.min(0.04, (now - this.last) / 1000);
    this.last = now;
    if (this.ended) return;
    this.catchCd = Math.max(0, this.catchCd - dt);
    if (now - this.startAt >= GAME_MS) {
      this.say(L({ tr: '⏱ Süre bitti! Ortada kalanlar kazandı.', en: "⏱ Time's up! Everyone still in wins." }), 999_999);
      sfx.success();
      this.finish(false, true);
      return;
    }
    this.moveMe(dt);
    for (const k of this.kids) if (!k.me && !k.out) this.dodgeAi(k, dt, now);
    for (const k of this.kids) {
      if (k.out) continue;
      k.x = clamp(k.x + k.vx * dt, ZL + R, ZR - R); k.y = clamp(k.y + k.vy * dt, ZT + R, ZB - R);
    }
    for (const e of this.ebes) this.ebeStep(e, dt, now);
    this.ballStep(dt, now);
  }

  private moveMe(dt: number) {
    if (this.me.out) { this.me.vx = this.me.vy = 0; return; }
    let x = 0, y = 0;
    if (this.keys.has('a') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('w') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('s') || this.keys.has('ArrowDown')) y += 1;
    if (!x && !y && this.joy) {
      const dx = this.joy.x - this.joy.ox, dy = this.joy.y - this.joy.oy, d = Math.hypot(dx, dy);
      if (d > 8) { x = dx / Math.max(d, 40); y = dy / Math.max(d, 40); }
    }
    const len = Math.hypot(x, y), sp = this.me.speed, k = Math.min(1, dt * 16);
    this.me.vx += ((len ? (x / Math.max(1, len)) * sp : 0) - this.me.vx) * k;
    this.me.vy += ((len ? (y / Math.max(1, len)) * sp : 0) - this.me.vy) * k;
  }

  /** the others in the middle: drift about, and jump out of the way when the ball is coming at them */
  private dodgeAi(k: Kid, dt: number, now: number) {
    const b = this.ball;
    let tx = k.x, ty = k.y, pace = 0.45;
    if (b.kind === 'fly') {
      // where the ball passes closest, and when
      const rx = k.x - b.x, ry = k.y - b.y, v2 = b.vx * b.vx + b.vy * b.vy;
      const t = (rx * b.vx + ry * b.vy) / v2;
      const cx = b.x + b.vx * t, cy = b.y + b.vy * t, miss = dist(k.x, k.y, cx, cy);
      if (t > 0 && t < 0.9 && miss < R + BR + 14) {
        // seen it (sooner the better they are): step sideways off its line
        k.dodge ??= now + 160 + (1 - k.skill) * 260;
        if (now > k.dodge) {
          const nx = -b.vy, ny = b.vx, n = Math.hypot(nx, ny) || 1, side = Math.sign((k.x - cx) * nx + (k.y - cy) * ny) || 1;
          tx = k.x + (nx / n) * side * 60; ty = k.y + (ny / n) * side * 60; pace = 1;
        }
      } else k.dodge = null;
    } else k.dodge = null;
    if (pace < 1) {
      // otherwise wander, staying away from the ends and from everyone else
      if (now > k.plan) { k.plan = now + 900 + Math.random() * 1400; k.wander = [ZL + 30 + Math.random() * (ZR - ZL - 60), ZT + 60 + Math.random() * (ZB - ZT - 120)]; }
      const w = k.wander;
      if (w) { tx = w[0]; ty = w[1]; }
    }
    const dx = tx - k.x, dy = ty - k.y, d = Math.hypot(dx, dy), sp = d < 4 ? 0 : k.speed * pace * Math.min(1, d / 30), kk = Math.min(1, dt * 10);
    k.vx += ((d ? (dx / d) * sp : 0) - k.vx) * kk; k.vy += ((d ? (dy / d) * sp : 0) - k.vy) * kk;
  }

  /** an ebe: line up on a target while holding the ball, and throw */
  private ebeStep(e: Ebe, dt: number, now: number) {
    const b = this.ball;
    let tx = W / 2;
    if (b.kind === 'held' && b.by === e) {
      const target = this.target(e);
      if (target) tx = clamp(target.x + (Math.random() - 0.5) * 4, ZL, ZR);
      if (target && now - b.since > b.wait) this.throwAt(e, target, now);
    } else if (b.kind === 'fly' || b.kind === 'loose') tx = b.x;
    const dx = tx - e.x, k = Math.min(1, dt * 6);
    e.vx += (clamp(dx * 4, -190, 190) - e.vx) * k;
    e.x = clamp(e.x + e.vx * dt, ZL - 10, ZR + 10);
  }

  /** who to throw at: anyone still in, you a little more often */
  private target(_e: Ebe): Kid | null {
    const alive = this.kids.filter((k) => !k.out);
    if (!alive.length) return null;
    const b = this.ball as Extract<Ball, { kind: 'held' }>;
    const key = (b.since * 7) % 1;
    const meIn = !this.me.out;
    if (meIn && key < 0.4) return this.me;
    return alive[Math.floor(key * 997) % alive.length];
  }

  private throwAt(e: Ebe, t: Kid, now: number) {
    const heat = this.heat(now);
    const speed = 250 + heat * 170 + Math.random() * 40;
    // lead the target a little, more as the game goes on
    const d = dist(e.x, e.y, t.x, t.y), tt = d / speed, lead = 0.35 + heat * 0.45;
    const ax = t.x + t.vx * tt * lead + (Math.random() - 0.5) * (40 - heat * 25), ay = t.y + t.vy * tt * lead;
    const a = Math.atan2(ay - e.y, ax - e.x);
    this.ball = { kind: 'fly', x: e.x, y: e.y + e.side * -14, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, from: e };
    sfx.click();
  }

  private ballStep(dt: number, now: number) {
    const b = this.ball;
    if (b.kind === 'loose') {
      // rolling back to an ebe
      const e = b.to, dx = e.x - b.x, dy = e.y - b.y, d = Math.hypot(dx, dy);
      if (d < 12) { this.ball = { kind: 'held', by: e, since: now, wait: 500 + Math.random() * 700 * (1 - this.heat(now)) }; return; }
      b.x += (dx / d) * Math.min(d, 260 * dt); b.y += (dy / d) * Math.min(d, 260 * dt);
      return;
    }
    if (b.kind !== 'fly') return;
    b.x += b.vx * dt; b.y += b.vy * dt;
    // anyone in its way
    for (const k of this.kids) {
      if (k.out || dist(k.x, k.y, b.x, b.y) > R + BR) continue;
      if (k.me && now < this.catchUntil) {
        this.catches++; this.me.lives++;
        this.flashText(L({ tr: 'Tuttun! +1 can 🙌', en: 'Caught it! +1 life 🙌' }));
        sfx.success();
        this.ball = { kind: 'loose', x: b.x, y: b.y, to: this.other(b.from), at: now };
        return;
      }
      // the others catch now and then too
      if (!k.me && Math.random() < 0.08 + k.skill * 0.08) {
        k.lives++;
        this.say(L({ tr: `${k.name} topu tuttu! (+1 can)`, en: `${k.name} caught it! (+1 life)` }), 1400);
        this.ball = { kind: 'loose', x: b.x, y: b.y, to: this.other(b.from), at: now };
        return;
      }
      this.hit(k, now);
      this.ball = { kind: 'loose', x: b.x, y: b.y, to: this.nearestEbe(b.x, b.y), at: now };
      return;
    }
    // over the far line: the other ebe has it; out to the side: it's fetched
    if (b.y < TOP + 8 || b.y > BOTTOM - 8) { const e = b.y < H / 2 ? this.ebes[0] : this.ebes[1]; this.ball = { kind: 'held', by: e, since: now, wait: 400 + Math.random() * 900 * (1 - this.heat(now)) }; return; }
    if (b.x < 6 || b.x > W - 6) this.ball = { kind: 'loose', x: clamp(b.x, 6, W - 6), y: b.y, to: this.nearestEbe(b.x, b.y), at: now };
  }

  private other(e: Ebe) { return e === this.ebes[0] ? this.ebes[1] : this.ebes[0]; }
  private nearestEbe(x: number, y: number) { return dist(x, y, this.ebes[0].x, this.ebes[0].y) < dist(x, y, this.ebes[1].x, this.ebes[1].y) ? this.ebes[0] : this.ebes[1]; }

  private hit(k: Kid, now: number) {
    k.lives--;
    sfx.bump();
    if (k.lives > 0) {
      if (k.me) this.flashText(L({ tr: `Vuruldun ama canın vardı! (${k.lives} can)`, en: `Hit, but you had a spare life! (${k.lives} left)` }));
      else this.say(L({ tr: `${k.name} vuruldu, bir canını kullandı.`, en: `${k.name} was hit and used a life.` }), 1400);
      return;
    }
    k.out = true; k.vx = 0; k.vy = 0;
    const alive = this.kids.filter((x) => !x.out);
    if (k.me) {
      this.outAt = now;
      const place = alive.length + 1;
      this.flashText(L({ tr: 'Yandın! 🔥', en: "You're out! 🔥" }));
      this.say(L({ tr: `Yandın! ${Math.round((now - this.startAt) / 1000)} saniye dayandın, ${this.kids.length} kişiden ${place}. oldun.`, en: `Out! You lasted ${Math.round((now - this.startAt) / 1000)} seconds and came ${place} of ${this.kids.length}.` }), 999_999);
      this.finish(false, false);
      return;
    }
    this.say(L({ tr: `${k.name} yandı! 🔥`, en: `${k.name} is out! 🔥` }), 1400);
    if (alive.length === 1 && alive[0].me) {
      this.say(L({ tr: '🏆 Ortada son sen kaldın: kazandın!', en: "🏆 You're the last one in the middle: you win!" }), 999_999);
      sfx.success();
      this.finish(false, true);
    }
  }

  // ---------- drawing ----------

  private draw() {
    const c = this.c, now = performance.now();
    c.fillStyle = '#7d9a5a'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#c9a774'; c.fillRect(20, 30, W - 40, H - 60);
    c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 2;
    c.strokeRect(ZL, ZT, ZR - ZL, ZB - ZT);
    for (const y of [TOP, BOTTOM]) { c.setLineDash([6, 6]); c.beginPath(); c.moveTo(ZL, y); c.lineTo(ZR, y); c.stroke(); c.setLineDash([]); }
    for (const e of this.ebes) this.person(e.x, e.y, '#2e6fb0', e.skin, e.hair, e.name + ' 🎯', false, false);
    for (const k of [...this.kids].sort((a, b) => a.y - b.y)) this.person(k.x, k.y, k.me ? '#6e1f2d' : '#8a6d2f', k.skin, k.hair, k.name + (k.lives > 1 ? ` ❤️${k.lives}` : ''), k.me, k.out);
    // the ball
    const b = this.ball;
    let bx: number, by: number;
    if (b.kind === 'held') { bx = b.by.x + 12; by = b.by.y - (b.by.side === -1 ? -8 : 8); } else { bx = b.x; by = b.y; }
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(bx + 2, by + 5, BR, 3, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#d8453b'; c.beginPath(); c.arc(bx, by - (b.kind === 'fly' ? 6 : 0), BR, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#f4f0e6'; c.lineWidth = 1.5; c.beginPath(); c.arc(bx, by - (b.kind === 'fly' ? 6 : 0), BR - 2, 0.4, 2.2); c.stroke();
    // your catch, while it's on
    if (now < this.catchUntil && !this.me.out) { c.strokeStyle = 'rgba(242,193,78,0.9)'; c.lineWidth = 3; c.beginPath(); c.arc(this.me.x, this.me.y - 6, R + BR + 2, 0, Math.PI * 2); c.stroke(); }
    if (this.joy) {
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 2; c.beginPath(); c.arc(this.joy.ox, this.joy.oy, 32, 0, Math.PI * 2); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.4)'; c.beginPath(); c.arc(this.joy.x, this.joy.y, 13, 0, Math.PI * 2); c.fill();
    }
    if (now < this.flashUntil) {
      c.font = 'bold 26px system-ui, sans-serif'; c.textAlign = 'center';
      c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 5; c.strokeText(this.flash, W / 2, H / 2);
      c.fillStyle = '#fff6c8'; c.fillText(this.flash, W / 2, H / 2);
    }
    const left = Math.max(0, Math.ceil((GAME_MS - (now - this.startAt)) / 1000));
    (this.el.querySelector('.db-time') as HTMLElement).textContent = `⏱ ${left}s`;
    const alive = this.kids.filter((k) => !k.out).length;
    (this.el.querySelector('.db-score') as HTMLElement).textContent = `${L({ tr: 'Ortada', en: 'In the middle' })}: ${alive}/${this.kids.length} · ${L({ tr: 'Canın', en: 'Your lives' })}: ${this.me.out ? 0 : this.me.lives} · ${L({ tr: 'Tuttuğun', en: 'Caught' })}: ${this.catches}`;
    (this.el.querySelector('.db-status') as HTMLElement).textContent = now < this.msgUntil ? this.msg : L({ tr: 'Topun yolundan çekil ya da tam sana gelirken Boşluk ile tut!', en: 'Get out of its way, or press Space just as it reaches you to catch it!' });
  }

  private person(x: number, y: number, shirt: string, skin: string, hair: string, name: string, you: boolean, out: boolean) {
    const c = this.c;
    c.globalAlpha = out ? 0.35 : 1;
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(x, y + 9, 11, 4.5, 0, 0, Math.PI * 2); c.fill();
    if (you) { c.strokeStyle = '#f2c14e'; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y + 9, 14, 6, 0, 0, Math.PI * 2); c.stroke(); }
    c.fillStyle = shirt; c.beginPath(); c.roundRect(x - 8, y - 11, 16, 13, 4); c.fill();
    c.fillStyle = '#2a2a30'; c.fillRect(x - 5, y + 2, 4, 6); c.fillRect(x + 1, y + 2, 4, 6);
    c.fillStyle = skin; c.beginPath(); c.arc(x, y - 17, 6.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = hair; c.beginPath(); c.arc(x, y - 19, 6.5, Math.PI, Math.PI * 2); c.fill();
    c.font = 'bold 10px system-ui, sans-serif'; c.textAlign = 'center';
    c.strokeStyle = 'rgba(0,0,0,0.65)'; c.lineWidth = 3; c.lineJoin = 'round';
    const label = out ? `${name} 🔥` : name;
    c.strokeText(label, x, y - 28); c.fillStyle = you ? '#f2c14e' : '#ffffff'; c.fillText(label, x, y - 28);
    c.globalAlpha = 1;
  }
}

let styled = false;
function injectStyles() {
  if (styled) return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = `
.db-card { width: min(460px, 100%); }
.db-card canvas { width: 100%; height: auto; display: block; border-radius: 8px; touch-action: none; max-height: 62vh; object-fit: contain; }
.db-time { font-size: 12px; opacity: 0.8; }
.db-score { font-size: 15px !important; }
.db-card .db-catch { user-select: none; -webkit-user-select: none; touch-action: none; }
`;
  document.head.appendChild(s);
}

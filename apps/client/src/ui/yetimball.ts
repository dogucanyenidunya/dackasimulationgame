// Yetimball: Daçka's name for tetherball, played by two real players. A ball hangs on a rope from a pole; the two
// players stand on opposite sides and take turns hitting it. Each hit winds the rope round the pole in the hitter's
// direction, and the better the angle and the strength, the further it winds. The rope gets shorter and the meters
// faster as it winds. Whoever has it wound all the way round to their side (YB_WIN turns) at the end of a round wins:
// the one who hits second always gets a reply, so both get the same number of hits.
// Each player's client works out its own hits; both apply the same list of hits in the same order, so they agree.
import { L } from '../i18n';
import { sfx } from '../audio';

/** net turns of rope to win */
export const YB_WIN = 4;
/** how long you have for a hit before it counts as a miss */
const TURN_MS = 9000;
/** waiting this long for the other player's hit means the connection is gone */
const WAIT_MS = TURN_MS + 12000;
const W = 520, H = 420;
const CX = W / 2, CY = H / 2, R0 = 128;
/** where the two players stand: you at the bottom, them at the top */
const STAND = R0 + 46;
/** the sweet spots: angle within ±ANGLE_OK degrees, strength around POWER_BEST */
const ANGLE_MAX = 60, ANGLE_OK = 6;
const POWER_BEST = 0.8, POWER_OK = 0.05;

export type YbResult = 'win' | 'lose' | 'quit' | 'abandoned' | 'lost';

/** a long rally gets fiercer: after RALLY_FROM hits each, every round winds more, so evenly matched games still end */
const RALLY_FROM = 4;
/** how much hit number n winds the rope (turns), for a hit of quality q (0–1; −1 = missed the ball altogether).
 *  Both hits of a round (n = 2r, 2r + 1) get the same boost, so neither player gets the stronger one. */
export const wrapsFor = (q: number, n = 0) => (q < 0 ? -0.4 : 0.2 + 1.2 * q) * (1 + 0.5 * Math.max(0, Math.floor(n / 2) - RALLY_FROM));
/** quality of a hit: how close the angle was to straight and the strength to the sweet spot */
export function hitQuality(angle: number, power: number): number {
  const a = Math.max(0, 1 - Math.max(0, Math.abs(angle) - ANGLE_OK) / (ANGLE_MAX - 10 - ANGLE_OK));
  const p = Math.max(0, 1 - Math.max(0, Math.abs(power - POWER_BEST) - POWER_OK) / 0.45);
  return Math.round(a * p * 1000) / 1000;
}

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/** a computer opponent's hit: around its skill (0–1), now and then a miss (a little more often as the rope gets short) */
export function botHit(skill: number, tension: number): number {
  if (Math.random() < 0.04 + 0.005 * tension) return -1;
  const q = skill + (Math.random() - 0.5) * 0.4;
  return Math.round(Math.max(0, Math.min(1, q)) * 1000) / 1000;
}

interface Opts {
  me: string;
  them: string;
  /** the one who invited goes first and winds the "positive" way */
  host: boolean;
  /** your hit for turn n, to send to the other player */
  send: (n: number, q: number) => void;
  /** you pressed "leave" */
  quit: () => void;
  /** the game is over (called once) */
  onEnd: (r: YbResult) => void;
  /** playing a classmate, not a real player: their hit, worked out here when it's their turn */
  bot?: (tension: number) => number;
}

export class YetimballView {
  readonly el: HTMLElement;
  private cv: HTMLCanvasElement;
  private c: CanvasRenderingContext2D;
  /** net turns of rope; + = the host's way */
  private wind = 0;
  /** turn number: even turns are the host's */
  private n = 0;
  private phase: 'aim' | 'power' | 'flying' | 'waiting' | 'over' = 'waiting';
  private phaseAt = 0;
  private turnAt = 0;
  private aim = 0;
  /** where the ball is around the pole (radians; π/2 = your side, at the bottom) */
  private theta = Math.PI / 2;
  private fly: { from: number; to: number; w0: number; w1: number; at: number; dur: number } | null = null;
  private queued: Array<{ n: number; q: number }> = [];
  private status = '';
  private lastHit = '';
  private raf = 0;
  private ended = false;
  private onKey = (e: KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); this.press(); }
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
    this.el.querySelector('.yb-hit')!.addEventListener('click', () => this.press());
    this.cv.addEventListener('pointerdown', () => this.press());
    this.el.querySelector('.yb-quit')!.addEventListener('click', () => {
      if (this.phase === 'over') { this.close(); return; }
      this.o.quit();
      this.finish('quit');
      this.close();
    });
    window.addEventListener('keydown', this.onKey, true);
    host.appendChild(this.el);
    this.theta = this.myTurn() ? Math.PI / 2 : -Math.PI / 2;
    this.startTurn();
    const loop = () => { this.tick(); this.draw(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }

  // ---------- turns ----------

  private myTurn(n = this.n) { return (n % 2 === 0) === this.o.host; }
  /** + for the host's way, − for the guest's */
  private mySign() { return this.o.host ? 1 : -1; }
  /** how far the rope has gone your way, in turns (−YB_WIN … YB_WIN) */
  private myWind() { return this.wind * this.mySign(); }
  /** the meters speed up as the rope gets shorter */
  private tension() { return Math.min(YB_WIN, Math.abs(this.wind)); }

  private startTurn() {
    const now = performance.now();
    this.turnAt = now;
    this.phaseAt = now;
    this.phase = this.myTurn() ? 'aim' : 'waiting';
    if (this.phase === 'waiting' && this.o.bot) {
      // a classmate takes a moment to line up the hit
      const n = this.n, bot = this.o.bot;
      window.setTimeout(() => this.receive(n, bot(this.tension())), 900 + Math.random() * 1100);
    }
    if (this.phase === 'waiting') this.flushQueued();
  }

  /** Space / click / tap: lock the angle, then the strength */
  private press() {
    const now = performance.now();
    if (this.phase === 'aim') { this.aim = this.angleAt(now); this.phase = 'power'; this.phaseAt = now; sfx.click(); return; }
    if (this.phase === 'power') this.hit(hitQuality(this.aim, this.powerAt(now)));
  }

  private angleAt(now: number) { return ANGLE_MAX * Math.sin(((now - this.phaseAt) / 1000) * (2.4 + 0.45 * this.tension())); }
  private powerAt(now: number) { return (1 - Math.cos(((now - this.phaseAt) / 1000) * (3.2 + 0.5 * this.tension()))) / 2; }

  private hit(q: number) {
    this.o.send(this.n, q);
    this.lastHit = q < 0 ? L({ tr: 'Kaçırdın! Top karşıya geçti.', en: 'You missed! The ball swung across.' })
      : q > 0.85 ? L({ tr: 'Mükemmel vuruş! 💥', en: 'Perfect hit! 💥' }) : q > 0.5 ? L({ tr: 'İyi vuruş!', en: 'Good hit!' }) : L({ tr: 'Zayıf vuruş…', en: 'A weak hit…' });
    this.swing(this.n % 2 === 0 ? 1 : -1, q); // even turns are the host's: the + way
    sfx.click();
  }

  /** the other player's hit for turn n */
  receive(n: number, q: number) {
    if (this.ended || n < this.n) return;
    this.queued.push({ n, q });
    if (this.phase === 'waiting') this.flushQueued();
  }

  private flushQueued() {
    const i = this.queued.findIndex((m) => m.n === this.n);
    if (i < 0 || this.myTurn()) return;
    const { q } = this.queued.splice(i, 1)[0];
    this.lastHit = q < 0 ? L({ tr: `${this.o.them} kaçırdı!`, en: `${this.o.them} missed!` })
      : q > 0.85 ? L({ tr: `${this.o.them} çok sert vurdu! 💥`, en: `${this.o.them} smashed it! 💥` }) : q > 0.5 ? L({ tr: `${this.o.them} iyi vurdu.`, en: `${this.o.them} hit it well.` }) : L({ tr: `${this.o.them} zayıf vurdu.`, en: `${this.o.them} hit it weakly.` });
    this.swing(this.n % 2 === 0 ? 1 : -1, q); // even turns are the host's: the + way
  }

  /** the ball flies round the pole; `sign` is the hitter's way (+ host), and it winds the rope by wrapsFor(q) */
  private swing(sign: number, q: number) {
    const w = wrapsFor(q, this.n);
    // (no cap: it can run past the end mid-round, and the reply has to undo all of it; capping it favours one side)
    const w1 = this.wind + sign * w;
    // on screen you hit it clockwise from the bottom, they hit it anticlockwise from the top; it ends on the other side
    const mine = sign === this.mySign();
    const turns = Math.max(0, Math.round(Math.abs(w)));
    const travel = (Math.PI + 2 * Math.PI * turns) * (mine ? 1 : -1);
    this.fly = { from: this.theta, to: this.theta + travel, w0: this.wind, w1, at: performance.now(), dur: 900 + 450 * turns };
    this.phase = 'flying';
  }

  private tick() {
    if (this.ended) return;
    const now = performance.now();
    if (this.fly) {
      const t = Math.min(1, (now - this.fly.at) / this.fly.dur);
      const k = ease(t);
      this.theta = this.fly.from + (this.fly.to - this.fly.from) * k;
      this.wind = this.fly.w0 + (this.fly.w1 - this.fly.w0) * k;
      if (t >= 1) {
        this.wind = this.fly.w1;
        this.fly = null;
        // decided only when the round is over (the guest has replied)
        if (this.n % 2 === 1) {
          if (this.myWind() >= YB_WIN - 1e-6) { this.finish('win'); return; }
          if (this.myWind() <= -YB_WIN + 1e-6) { this.finish('lose'); return; }
        }
        this.n++;
        this.startTurn();
      }
      return;
    }
    if ((this.phase === 'aim' || this.phase === 'power') && now - this.turnAt > TURN_MS) this.hit(-1);
    else if (this.phase === 'waiting' && now - this.turnAt > WAIT_MS) {
      this.status = L({ tr: `${this.o.them} ile bağlantı koptu.`, en: `Lost the connection to ${this.o.them}.` });
      this.finish('lost');
    }
  }

  /** the other player left or closed the game */
  abandoned() {
    if (this.ended) return;
    // walking out while losing doesn't save you: whoever was ahead gets the win
    if (this.myWind() > 0) {
      this.finish('win');
      this.status = L({ tr: `🏆 ${this.o.them} sen öndeyken oyundan çıktı: kazandın!`, en: `🏆 ${this.o.them} left while you were ahead: you win!` });
      return;
    }
    this.status = L({ tr: `${this.o.them} oyundan çıktı.`, en: `${this.o.them} left the game.` });
    this.finish('abandoned');
  }

  private finish(r: YbResult) {
    if (this.ended) return;
    this.ended = true;
    this.phase = 'over';
    if (r === 'win') { this.status = L({ tr: '🏆 Kazandın! İp tamamen senin tarafına sarıldı.', en: '🏆 You win! The rope is wound all the way round your way.' }); sfx.success(); }
    if (r === 'lose') this.status = L({ tr: `${this.o.them} kazandı. Rövanş?`, en: `${this.o.them} wins. Rematch?` });
    (this.el.querySelector('.yb-hit') as HTMLElement).style.display = 'none';
    (this.el.querySelector('.yb-quit') as HTMLElement).textContent = L({ tr: 'Kapat', en: 'Close' });
    this.o.onEnd(r);
  }

  close() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKey, true);
    this.el.remove();
  }

  // ---------- drawing ----------

  private draw() {
    const c = this.c, now = performance.now();
    const tension = Math.min(1, Math.abs(this.wind) / YB_WIN);
    const r = R0 * (1 - 0.68 * tension);
    // the ground: a worn circle in the grass
    c.fillStyle = '#5f9a4c'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#c9a774'; c.beginPath(); c.arc(CX, CY, R0 + 34, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 2; c.setLineDash([6, 6]);
    c.beginPath(); c.moveTo(CX - R0 - 34, CY); c.lineTo(CX + R0 + 34, CY); c.stroke(); c.setLineDash([]);
    // the players: you at the bottom, them at the top
    this.person(CX, CY + STAND, '#22365c', this.o.me, this.myTurn() && this.phase !== 'over');
    this.person(CX, CY - STAND, '#8c2f2f', this.o.them, !this.myTurn() && this.phase !== 'over');
    // rope already wound round the pole: one ring per turn, in the colour of whoever is ahead
    const coils = Math.floor(Math.abs(this.wind) * 2);
    c.strokeStyle = this.myWind() >= 0 ? '#f2c14e' : '#e07a5f'; c.lineWidth = 2;
    for (let i = 0; i < coils; i++) { c.beginPath(); c.arc(CX, CY, 9 + i * 1.6, 0, Math.PI * 2); c.stroke(); }
    // the pole and its shadow
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(CX + 6, CY + 5, 9, 6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#6b6f74'; c.beginPath(); c.arc(CX, CY, 8, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#c4c8cc'; c.beginPath(); c.arc(CX - 2, CY - 2, 3, 0, Math.PI * 2); c.fill();
    // rope and ball
    const bx = CX + Math.cos(this.theta) * r, by = CY + Math.sin(this.theta) * r;
    c.strokeStyle = '#f4f0e6'; c.lineWidth = 2; c.beginPath(); c.moveTo(CX, CY); c.lineTo(bx, by); c.stroke();
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(bx + 5, by + 7, 12, 7, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#f2c14e'; c.beginPath(); c.arc(bx, by, 13, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#b5862a'; c.lineWidth = 2; c.beginPath(); c.arc(bx, by, 13, 0.3, 2.6); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.arc(bx - 4, by - 5, 4, 0, Math.PI * 2); c.fill();
    // your meters while it's your hit
    if (this.phase === 'aim' || this.phase === 'power') this.meters(now);
    // the bar and the line under the court
    const pct = Math.max(-50, Math.min(50, (this.myWind() / YB_WIN) * 50));
    (this.el.querySelector('.yb-mark') as HTMLElement).style.left = `${50 + pct}%`;
    let line = this.status;
    if (!line) {
      const left = Math.max(0, Math.ceil((TURN_MS - (now - this.turnAt)) / 1000));
      if (this.phase === 'aim') line = L({ tr: `Senin vuruşun: önce AÇI. İbre ortadayken bas! (${left})`, en: `Your hit: first the ANGLE. Press when the needle is in the middle! (${left})` });
      else if (this.phase === 'power') line = L({ tr: `Şimdi GÜÇ: çubuk yeşilde bas! (${left})`, en: `Now the STRENGTH: press when the bar is in the green! (${left})` });
      else if (this.phase === 'waiting') line = L({ tr: `${this.o.them} vuruyor…`, en: `${this.o.them} is hitting…` });
      else line = this.lastHit;
      if (this.n >= RALLY_FROM * 2 && this.phase !== 'flying') line = `🔥 ${L({ tr: 'Uzun ralli: vuruşlar güçleniyor!', en: 'Long rally: every hit winds more!' })} ${line}`;
      if (this.lastHit && this.phase !== 'flying') line = `${this.lastHit} · ${line}`;
      // the host has wound it all the way: the guest's reply is the last chance
      if (this.n % 2 === 1 && Math.abs(this.wind) >= YB_WIN && this.phase !== 'flying')
        line = this.myTurn() ? `⚠️ ${L({ tr: 'Son şans! İyi bir vuruşla ipi geri çevir.', en: 'Last chance! A good hit turns the rope back.' })} ${line}` : `⚠️ ${L({ tr: `${this.o.them}'ın son cevap vuruşu kaldı…`, en: `${this.o.them} has one reply left…` })}`;
    }
    (this.el.querySelector('.yb-status') as HTMLElement).textContent = line;
  }

  private person(x: number, y: number, shirt: string, name: string, up: boolean) {
    const c = this.c;
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(x, y + 16, 14, 5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = shirt; c.fillRect(x - 10, y - 4, 20, 18);
    c.fillStyle = '#e8b98f'; c.beginPath(); c.arc(x, y - 12, 9, 0, Math.PI * 2); c.fill();
    // the name beside them (whoever's turn it is gets the arrow)
    c.font = 'bold 13px system-ui, sans-serif'; c.textAlign = 'left';
    c.fillStyle = up ? '#fff6c8' : '#ffffff'; c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 3; c.lineJoin = 'round';
    const label = `${up ? '◀ ' : ''}${name}`;
    c.strokeText(label, x + 18, y + 4); c.fillText(label, x + 18, y + 4);
  }

  private meters(now: number) {
    const c = this.c;
    c.font = 'bold 11px system-ui, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ffffff';
    // the angle, bottom left: a fan with a swinging needle; straight up is best
    const ox = 72, oy = H - 22, rad = 54;
    c.fillText(L({ tr: 'AÇI', en: 'ANGLE' }), ox, oy - rad - 8);
    const toRad = (deg: number) => -Math.PI / 2 + (deg * Math.PI) / 180;
    c.fillStyle = 'rgba(20,24,28,0.55)'; c.beginPath(); c.moveTo(ox, oy); c.arc(ox, oy, rad, toRad(-ANGLE_MAX), toRad(ANGLE_MAX)); c.closePath(); c.fill();
    c.fillStyle = 'rgba(120,220,120,0.85)'; c.beginPath(); c.moveTo(ox, oy); c.arc(ox, oy, rad, toRad(-ANGLE_OK), toRad(ANGLE_OK)); c.closePath(); c.fill();
    const a = this.phase === 'aim' ? this.angleAt(now) : this.aim;
    c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.beginPath(); c.moveTo(ox, oy); c.lineTo(ox + Math.cos(toRad(a)) * rad, oy + Math.sin(toRad(a)) * rad); c.stroke();
    // the strength, bottom right: a bar, best just below the top (it runs once the angle is set)
    const bx = W - 52, bh = 92, by = H - 16 - bh, bw = 18;
    c.fillStyle = '#ffffff'; c.fillText(L({ tr: 'GÜÇ', en: 'STRENGTH' }), bx + bw / 2, by - 8);
    c.fillStyle = 'rgba(20,24,28,0.6)'; c.fillRect(bx, by, bw, bh);
    c.fillStyle = 'rgba(120,220,120,0.9)'; c.fillRect(bx, by + bh * (1 - POWER_BEST - POWER_OK), bw, bh * POWER_OK * 2);
    if (this.phase !== 'power') return;
    const p = this.powerAt(now);
    c.fillStyle = p > POWER_BEST + POWER_OK ? '#e07a5f' : '#f2c14e';
    c.fillRect(bx + 3, by + bh * (1 - p), bw - 6, bh * p);
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
.yb-card canvas { width: 100%; height: auto; display: block; border-radius: 8px; touch-action: manipulation; cursor: pointer; }
.yb-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; font-size: 18px; }
.yb-vs { font-size: 13px; opacity: 0.75; }
.yb-bar { display: flex; align-items: center; gap: 8px; font-size: 12px; margin-bottom: 8px; }
.yb-bar span { white-space: nowrap; max-width: 30%; overflow: hidden; text-overflow: ellipsis; }
.yb-track { position: relative; flex: 1; height: 10px; border-radius: 5px; background: linear-gradient(90deg, #e07a5f, #444 50%, #f2c14e); }
.yb-mid { position: absolute; left: 50%; top: -3px; width: 2px; height: 16px; background: #fff; opacity: 0.6; }
.yb-mark { position: absolute; top: -4px; width: 6px; height: 18px; margin-left: -3px; border-radius: 3px; background: #fff; box-shadow: 0 0 6px #fff; transition: left 0.1s linear; }
.yb-status, .pg-status { min-height: 2.6em; margin: 10px 2px 8px; font-size: 14px; line-height: 1.3; }
.yb-row, .pg-row { display: flex; gap: 8px; justify-content: space-between; flex-wrap: wrap; }
.pg-picks { display: flex; gap: 8px; justify-content: center; margin: 12px 0; }
.pg-picks button { font-size: 28px; padding: 10px 16px; }
.pg-score { text-align: center; font-size: 22px; font-weight: 800; margin: 6px 0; }
`;
  document.head.appendChild(s);
}
export { injectStyles as injectPeerGameStyles };

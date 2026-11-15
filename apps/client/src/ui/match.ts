// The basketball match on match night: Darüşşafaka v Banvit in the Spor Salonu, drawn on a canvas with the
// packed grandstand above the court, a scoreboard and a line of commentary. It plays a quarter at a time so the
// scene can stop it at half-time for a dilemma.
import { L, type Text } from '../i18n';
import { sfx } from '../audio';

const W = 760, H = 460;
const COURT = { x: 40, y: 190, w: 680, h: 250 };
const HOOP_Y = COURT.y + COURT.h / 2;
const HOOPS = [COURT.x + 34, COURT.x + COURT.w - 34];
const TEAMS = [
  { name: 'DARÜŞŞAFAKA', short: 'DAR', shirt: '#1d2f6b', trim: '#f2c14e', num: '#ffffff' },
  { name: 'BANVİT', short: 'BAN', shirt: '#d9542b', trim: '#ffffff', num: '#ffffff' },
];
const QUARTERS = 4;

interface P { team: 0 | 1; n: number; x: number; y: number; tx: number; ty: number; hx: number; hy: number }
interface Fan { x: number; y: number; head: string; body: string; ph: number; scarf: boolean }

const pick = <X,>(a: X[]) => a[Math.floor(Math.random() * a.length)];

const LINES = {
  three: (t: string): Text => ({ tr: `${t}'dan üçlük! 🔥`, en: `Three from ${t}! 🔥` }),
  two: (t: string): Text => pick([{ tr: `${t} turnikeyle iki sayı.`, en: `${t} lay it in for two.` }, { tr: `${t}'dan smaç! 💥`, en: `A dunk from ${t}! 💥` }, { tr: `${t} orta mesafeden buldu.`, en: `${t} hit it from mid-range.` }]),
  miss: (t: string): Text => pick([{ tr: `${t} kaçırdı, ribaund mücadelesi…`, en: `${t} miss, a scramble for the rebound…` }, { tr: `Çemberden döndü! ${t} üzgün.`, en: `It rattles out! ${t} can't believe it.` }]),
  pass: (t: string): Text => pick([{ tr: `${t} topu çevirdi.`, en: `${t} move the ball round.` }, { tr: `${t} hücumu kuruyor.`, en: `${t} set up their attack.` }, { tr: `${t} pick-and-roll deniyor.`, en: `${t} try a pick-and-roll.` }]),
};

export class MatchView {
  readonly el: HTMLElement;
  private cv: HTMLCanvasElement;
  private c: CanvasRenderingContext2D;
  private players: P[] = [];
  private fans: Fan[] = [];
  score: [number, number] = [0, 0];
  quarter = 1;
  /** game seconds left in the quarter (10:00 a quarter) */
  private clock = 600;
  /** a nudge to the home side's shooting (a loud crowd helps) */
  boost = 0;
  private attack: 0 | 1 = 0;
  private holder = 2;
  private passes = 0;
  private nextMove = 0;
  private shot: { from: [number, number]; to: [number, number]; t: number; dur: number; made: boolean; pts: number; team: 0 | 1 } | null = null;
  private cheer = 0;
  private flash: { text: string; t: number; team: 0 | 1 } | null = null;
  private raf = 0;
  private last = 0;
  private running: { until: number; msPerQuarter: number; done: () => void } | null = null;
  private skipping = false;

  constructor(host: HTMLElement, private you: string, private friends: string[]) {
    this.el = document.createElement('div');
    this.el.className = 'match-overlay';
    this.el.innerHTML = `
      <div class="match-card">
        <div class="match-board">
          <div class="mb-team home"><i style="background:${TEAMS[0].shirt};border-color:${TEAMS[0].trim}"></i><b>${TEAMS[0].name}</b></div>
          <div class="mb-score"><span class="s0">0</span><em>–</em><span class="s1">0</span></div>
          <div class="mb-team away"><b>${TEAMS[1].name}</b><i style="background:${TEAMS[1].shirt};border-color:${TEAMS[1].trim}"></i></div>
          <div class="mb-clock"><span class="q">1. ${L({ tr: 'çeyrek', en: 'quarter' })}</span> · <span class="t">10:00</span></div>
        </div>
        <canvas width="${W}" height="${H}"></canvas>
        <div class="match-foot"><p class="match-line">${L({ tr: 'Salon tıklım tıklım. Hakem topu havaya atıyor…', en: 'The hall is packed. The referee throws the ball up…' })}</p><button type="button" class="secondary match-skip">${L({ tr: 'Hızlandır ⏩', en: 'Speed up ⏩' })}</button></div>
      </div>`;
    host.appendChild(this.el);
    this.cv = this.el.querySelector('canvas')!;
    this.c = this.cv.getContext('2d')!;
    this.el.querySelector('.match-skip')!.addEventListener('click', () => { this.skipping = true; });
    this.setup();
    this.last = performance.now();
    const loop = (now: number) => { this.tick(Math.min(0.05, (now - this.last) / 1000)); this.last = now; this.draw(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }

  private setup() {
    // the grandstand: ten stepped rows of fans, most of them in the home colours
    for (let row = 0; row < 10; row++) {
      for (let x = 14 + (row % 2) * 7; x < W - 10; x += 15) {
        const home = Math.random() < 0.82;
        this.fans.push({
          x: x + Math.random() * 3, y: 22 + row * 15,
          head: pick(['#f1c9a5', '#e8b98f', '#d9a77d', '#c68e63', '#a8714a', '#f6d7bd']),
          body: home ? pick([TEAMS[0].shirt, TEAMS[0].shirt, TEAMS[0].trim, '#3a4a6b']) : pick([TEAMS[1].shirt, '#ffffff', '#7a3a2a']),
          ph: Math.random() * Math.PI * 2, scarf: home && Math.random() < 0.25,
        });
      }
    }
    // five a side, in a spread round the attacking end
    for (const team of [0, 1] as const) for (let i = 0; i < 5; i++) {
      const p: P = { team, n: [4, 7, 10, 12, 23][i] + team, x: W / 2, y: HOOP_Y, tx: 0, ty: 0, hx: 0, hy: 0 };
      this.players.push(p);
    }
    this.formation();
    for (const p of this.players) { p.x = p.tx; p.y = p.ty; }
  }

  /** spots for attack and defence round the hoop the attacking side is going at */
  private formation() {
    const hoop = HOOPS[this.attack === 0 ? 1 : 0];
    const dir = hoop > W / 2 ? -1 : 1;
    const spots: Array<[number, number]> = [[170, 0], [120, -85], [120, 85], [45, -100], [45, 100]];
    let i = 0, j = 0;
    for (const p of this.players) {
      if (p.team === this.attack) {
        const [dx, dy] = spots[i++];
        p.hx = hoop + dir * dx + (Math.random() - 0.5) * 30; p.hy = HOOP_Y + dy + (Math.random() - 0.5) * 24;
      } else {
        const [dx, dy] = spots[j++];
        p.hx = hoop + dir * (dx * 0.7) + (Math.random() - 0.5) * 16; p.hy = HOOP_Y + dy * 0.8;
      }
      p.tx = p.hx; p.ty = p.hy;
    }
  }

  private attackers() { return this.players.filter((p) => p.team === this.attack); }

  /** play on until the end of quarter `toQuarter` (1–4); `msPerQuarter` real milliseconds a quarter */
  play(toQuarter: number, msPerQuarter = 30000): Promise<void> {
    return new Promise((done) => {
      if (this.quarter > toQuarter) { done(); return; }
      this.running = { until: toQuarter, msPerQuarter, done };
    });
  }

  /** a quick simulation of quarters you weren't there for */
  presim(quarters: number) {
    for (let q = 0; q < quarters; q++) {
      this.score[0] += 12 + Math.floor(Math.random() * 9);
      this.score[1] += 11 + Math.floor(Math.random() * 9);
      this.quarter++;
    }
    this.updateBoard();
  }

  /** a line under the court */
  say(t: Text) { (this.el.querySelector('.match-line') as HTMLElement).textContent = L(t); }

  private updateBoard() {
    (this.el.querySelector('.s0') as HTMLElement).textContent = String(this.score[0]);
    (this.el.querySelector('.s1') as HTMLElement).textContent = String(this.score[1]);
    const m = Math.floor(this.clock / 60), s = Math.floor(this.clock % 60);
    (this.el.querySelector('.q') as HTMLElement).textContent = this.quarter > QUARTERS ? L({ tr: 'Maç sonu', en: 'Full time' }) : `${this.quarter}. ${L({ tr: 'çeyrek', en: 'quarter' })}`;
    (this.el.querySelector('.t') as HTMLElement).textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  private tick(dt: number) {
    for (const f of this.fans) f.ph += dt * (3 + this.cheer * 6);
    this.cheer = Math.max(0, this.cheer - dt * 0.6);
    if (this.flash) { this.flash.t -= dt; if (this.flash.t <= 0) this.flash = null; }
    for (const p of this.players) {
      const k = Math.min(1, dt * 6 * (this.skipping ? 3 : 1));
      p.x += (p.tx - p.x) * k;
      p.y += (p.ty - p.y) * k;
    }
    const r = this.running;
    if (!r) return;
    const speed = this.skipping ? 5 : 1;
    // game clock: 600 game seconds a quarter over msPerQuarter real ms
    this.clock -= dt * speed * (600 / (r.msPerQuarter / 1000));
    this.nextMove -= dt * speed;
    if (this.shot) {
      this.shot.t += dt * speed;
      if (this.shot.t >= this.shot.dur) this.finishShot();
    } else if (this.nextMove <= 0) this.move();
    // defenders shadow their men; the ball holder's man closes in
    const att = this.attackers(), def = this.players.filter((p) => p.team !== this.attack);
    def.forEach((d, i) => { const a = att[i]; const hoop = HOOPS[this.attack === 0 ? 1 : 0]; d.tx = a.x + (hoop - a.x) * 0.18; d.ty = a.y + (HOOP_Y - a.y) * 0.18; });
    if (this.clock <= 0) {
      this.clock = 600;
      this.quarter++;
      sfx.bell();
      this.say(this.quarter > QUARTERS ? { tr: 'Son düdük!', en: 'The final whistle!' } : this.quarter === 3 ? { tr: 'Devre arası!', en: 'Half-time!' } : { tr: `${this.quarter - 1}. çeyrek bitti.`, en: `End of the ${this.quarter - 1 === 1 ? 'first' : 'third'} quarter.` });
      if (this.quarter > r.until) { this.running = null; this.shot = null; this.updateBoard(); r.done(); return; }
    }
    this.updateBoard();
  }

  /** pass the ball round, and after a few passes take a shot */
  private move() {
    const att = this.attackers();
    const team = TEAMS[this.attack];
    if (this.passes >= 1 && Math.random() < 0.6) {
      const p = att[this.holder];
      const hoop = HOOPS[this.attack === 0 ? 1 : 0];
      const far = Math.abs(p.x - hoop) > 140;
      const chance = (far ? 0.38 : 0.56) + (this.attack === 0 ? 0.03 + this.boost : 0);
      this.shot = { from: [p.x, p.y - 10], to: [hoop, HOOP_Y - 30], t: 0, dur: 0.45, made: Math.random() < chance, pts: far ? 3 : 2, team: this.attack };
      return;
    }
    let next = this.holder;
    while (next === this.holder) next = Math.floor(Math.random() * att.length);
    this.holder = next;
    this.passes++;
    // the attackers drift into new spots
    for (const a of att) { a.tx = a.hx + (Math.random() - 0.5) * 40; a.ty = a.hy + (Math.random() - 0.5) * 30; }
    if (Math.random() < 0.3) this.say(LINES.pass(team.name));
    this.nextMove = 0.18 + Math.random() * 0.17;
  }

  private finishShot() {
    const s = this.shot!;
    this.shot = null;
    const team = TEAMS[s.team];
    if (s.made) {
      this.score[s.team] += s.pts;
      this.flash = { text: `+${s.pts} ${team.short}`, t: 1.2, team: s.team };
      this.say(s.pts === 3 ? LINES.three(team.name) : LINES.two(team.name));
      if (s.team === 0) { this.cheer = 1; sfx.success(); }
    } else if (Math.random() < 0.3) {
      // fouled on the shot: two free throws
      const ft = (Math.random() < 0.75 ? 1 : 0) + (Math.random() < 0.75 ? 1 : 0);
      this.score[s.team] += ft;
      if (ft) this.flash = { text: `+${ft} ${team.short}`, t: 1, team: s.team };
      this.say({ tr: `Faul! ${team.name} iki serbest atıştan ${ft} sayı buldu.`, en: `Foul! ${team.name} make ${ft} of two free throws.` });
      if (s.team === 0 && ft) this.cheer = 0.6;
      this.attack = (1 - this.attack) as 0 | 1;
      this.holder = 0; this.passes = 0;
      this.formation();
      this.nextMove = 0.35;
      this.updateBoard();
      return;
    } else this.say(LINES.miss(team.name));
    // the other side brings it up the court (after a miss, about a third of the time the shooters keep it)
    if (s.made || Math.random() > 0.33) this.attack = (1 - this.attack) as 0 | 1;
    this.holder = 0; this.passes = 0;
    this.formation();
    this.nextMove = 0.35;
    this.updateBoard();
  }

  /** the end: who won */
  finale(): Promise<void> {
    const [h, a] = this.score;
    const home = h > a;
    this.cheer = home ? 1.5 : 0;
    this.say(home ? { tr: `Darüşşafaka kazandı! ${h}–${a} 🎉 Tribünler ayakta!`, en: `Darüşşafaka win! ${h}–${a} 🎉 The stands are on their feet!` }
      : h === a ? { tr: `Berabere bitti: ${h}–${a}.`, en: `It finished level: ${h}–${a}.` }
        : { tr: `Banvit kazandı: ${a}–${h}. Tribün yine de takımını alkışlıyor.`, en: `Banvit win ${a}–${h}. The home crowd applaud their team anyway.` });
    const btn = this.el.querySelector('.match-skip') as HTMLButtonElement;
    btn.textContent = L({ tr: 'Salondan çık', en: 'Leave the hall' });
    btn.classList.replace('secondary', 'primary');
    return new Promise((done) => { btn.onclick = () => done(); });
  }

  close() { cancelAnimationFrame(this.raf); this.el.remove(); }

  // ---------- drawing ----------

  private draw() {
    const c = this.c;
    c.clearRect(0, 0, W, H);
    // the hall: dark walls, lights in the roof
    c.fillStyle = '#20232b'; c.fillRect(0, 0, W, H);
    for (let x = 40; x < W; x += 120) { const g = c.createRadialGradient(x, 0, 2, x, 0, 90); g.addColorStop(0, 'rgba(255,240,200,0.35)'); g.addColorStop(1, 'rgba(255,240,200,0)'); c.fillStyle = g; c.fillRect(x - 90, 0, 180, 90); }
    // the grandstand: stepped concrete rows with the crowd on them
    for (let row = 0; row < 10; row++) {
      c.fillStyle = row % 2 ? '#3a3f4a' : '#343944'; c.fillRect(0, 26 + row * 15, W, 15);
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, 40 + row * 15, W, 1);
    }
    for (const f of this.fans) {
      const jump = Math.max(0, Math.sin(f.ph)) * (1.5 + this.cheer * 4);
      c.fillStyle = f.body; c.fillRect(f.x - 4, f.y + 4 - jump, 8, 8);
      c.fillStyle = f.head; c.beginPath(); c.arc(f.x, f.y - jump, 3.6, 0, Math.PI * 2); c.fill();
      if (f.scarf && this.cheer > 0.2) { c.fillStyle = TEAMS[0].trim; c.fillRect(f.x - 7, f.y - 10 - jump, 14, 3); c.fillStyle = TEAMS[0].shirt; c.fillRect(f.x - 2, f.y - 10 - jump, 4, 3); }
    }
    // a banner along the front of the stand, and you with your friends in the front row
    c.fillStyle = TEAMS[0].shirt; c.fillRect(W / 2 - 150, 172, 300, 14);
    c.fillStyle = TEAMS[0].trim; c.font = 'bold 10px "Pixelify Sans", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('HAYDİ DARÜŞŞAFAKA!', W / 2, 179.5);
    const tag = [this.you, ...this.friends.slice(0, 3)].join(' · ');
    c.font = 'bold 11px system-ui, sans-serif';
    const tw = c.measureText(`▼ ${tag}`).width + 12;
    c.fillStyle = 'rgba(255, 226, 122, 0.95)'; c.fillRect(W / 2 - tw / 2, 151, tw, 15);
    c.fillStyle = '#1d2326'; c.fillText(`▼ ${tag}`, W / 2, 159);
    // the court: parquet, lines, keys, hoops
    const { x, y, w, h } = COURT;
    c.save(); c.beginPath(); c.rect(x - 1, y - 1, w + 2, h + 2); c.clip();
    c.fillStyle = '#d7a86e'; c.fillRect(x, y, w, h);
    c.fillStyle = 'rgba(120, 70, 30, 0.12)'; for (let px = x; px < x + w; px += 22) c.fillRect(px, y, 1, h);
    c.strokeStyle = '#fff'; c.lineWidth = 2; c.strokeRect(x, y, w, h);
    c.beginPath(); c.moveTo(x + w / 2, y); c.lineTo(x + w / 2, y + h); c.stroke();
    c.beginPath(); c.arc(x + w / 2, y + h / 2, 30, 0, Math.PI * 2); c.stroke();
    for (const [hx, side] of [[HOOPS[0], 1], [HOOPS[1], -1]] as const) {
      c.fillStyle = side > 0 ? 'rgba(29, 47, 107, 0.55)' : 'rgba(217, 84, 43, 0.5)';
      c.fillRect(side > 0 ? x : x + w - 110, HOOP_Y - 40, 110, 80);
      c.strokeRect(side > 0 ? x : x + w - 110, HOOP_Y - 40, 110, 80);
      c.beginPath(); c.arc(hx, HOOP_Y, 150, side > 0 ? -Math.PI / 2 : Math.PI / 2, side > 0 ? Math.PI / 2 : Math.PI * 1.5); c.stroke();
      // backboard and rim, raised above the floor
      c.fillStyle = '#f4f4f4'; c.fillRect(hx - (side > 0 ? 14 : -10) - 2, HOOP_Y - 54, 6, 36);
      c.strokeStyle = '#e8572b'; c.lineWidth = 3; c.beginPath(); c.ellipse(hx + side * 6, HOOP_Y - 30, 9, 4, 0, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = '#fff'; c.lineWidth = 2;
    }
    c.restore();
    // players (back to front), with the ball
    const sorted = [...this.players].sort((a, b) => a.y - b.y);
    const holder = this.shot ? null : this.attackers()[this.holder];
    for (const p of sorted) {
      const t = TEAMS[p.team];
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(p.x, p.y + 11, 9, 3.5, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#3b2a20'; c.fillRect(p.x - 4, p.y + 2, 3, 9); c.fillRect(p.x + 1, p.y + 2, 3, 9);
      c.fillStyle = t.shirt; c.fillRect(p.x - 7, p.y - 10, 14, 13);
      c.fillStyle = t.trim; c.fillRect(p.x - 7, p.y - 10, 14, 2);
      c.fillStyle = t.num; c.font = 'bold 8px system-ui, sans-serif'; c.fillText(String(p.n), p.x, p.y - 3);
      c.fillStyle = '#c68e63'; c.beginPath(); c.arc(p.x, p.y - 15, 5, 0, Math.PI * 2); c.fill();
      if (p === holder) { c.fillStyle = '#e8572b'; c.beginPath(); c.arc(p.x + 8, p.y + 1, 4, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#7a2a10'; c.lineWidth = 1; c.stroke(); c.lineWidth = 2; }
    }
    if (this.shot) {
      const s = this.shot, k = Math.min(1, s.t / s.dur);
      const bx = s.from[0] + (s.to[0] - s.from[0]) * k, by = s.from[1] + (s.to[1] - s.from[1]) * k - Math.sin(Math.PI * k) * 70;
      c.fillStyle = '#e8572b'; c.beginPath(); c.arc(bx, by, 5, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#7a2a10'; c.lineWidth = 1; c.stroke(); c.lineWidth = 2;
    }
    if (this.flash) {
      c.globalAlpha = Math.min(1, this.flash.t * 2);
      c.fillStyle = this.flash.team === 0 ? TEAMS[0].trim : '#ffffff';
      c.font = 'bold 34px "Pixelify Sans", monospace';
      c.fillText(this.flash.text, W / 2, COURT.y + 60 - (1.2 - this.flash.t) * 20);
      c.globalAlpha = 1;
    }
  }
}

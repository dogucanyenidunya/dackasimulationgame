// The corridor run: on one of the first nights the belletmen calls you to the phone, and the phone is at the far end
// of the dorm corridor. Three lanes, and everything a dorm corridor holds just before lights out: slippers and laundry
// baskets to jump over, towels hung on a line to duck under, mop buckets and kids brushing their teeth to go round.
// Bumping into something slows you down. The phone rings until you get there, or until the belletmen picks up and holds
// the line for you; either way the run ends at the phone, and the call comes after it.
import { L } from '../i18n';
import { sfx } from '../audio';

export interface PhoneRunResult {
  /** how many things you bumped into */
  stumbles: number;
  /** it stopped ringing before you got there: the belletmen picked up and kept the line open */
  late: boolean;
  seconds: number;
}

interface Opts {
  /** who is calling, e.g. "Annen" */
  caller: string;
  /** the belletmen on duty, e.g. "Ercan Hoca" */
  belletmen: string;
  look: { skin: string; hair: string };
  pyjamas: { top: string; bottom: string };
  /** you picked up the phone (called once) */
  onEnd: (r: PhoneRunResult) => void;
}

const W = 520, H = 420, CX = W / 2;
/** the vanishing point */
const HY = 128;
/** one world unit at distance 1 from the camera is F px */
const F = 390;
const CAM_H = 2;
/** how far behind the runner the camera is */
const CAM_BACK = 3.6;
const NEAR = 0.6, FAR = 72;
/** half the corridor's width, and its ceiling */
const HALF = 1.75, CEIL = 3.3;
/** the phone is this far down the corridor */
const TRACK = 430;
/** seconds between rings, and how many rings before the belletmen picks up */
const RING_S = 2.3, RINGS = 15;
const JUMP_S = 0.62, JUMP_H = 1.15, SLIDE_S = 0.62;
/** runner's speed (units/s): it picks up as you go */
const SPEED0 = 10, SPEED1 = 17;

type Kind = 'terlik' | 'sepet' | 'ip' | 'kova' | 'cocuk';
/** what gets you past it: jump over it, duck under it, or only going round it */
const NEED: Record<Kind, 'jump' | 'duck' | 'dodge'> = { terlik: 'jump', sepet: 'jump', ip: 'duck', kova: 'dodge', cocuk: 'dodge' };
/** how high you have to be off the floor to clear it */
const CLEAR: Partial<Record<Kind, number>> = { terlik: 0.22, sepet: 0.5 };
interface Ob { d: number; lane: number; kind: Kind; hit: boolean; seed: number }

const OUCH: Record<Kind, { tr: string; en: string }> = {
  terlik: { tr: 'Birinin terliklerine takıldın!', en: "You tripped over someone's slippers!" },
  sepet: { tr: 'Çamaşır sepetine çarptın; çoraplar havada uçuştu!', en: 'You crashed into a laundry basket; socks everywhere!' },
  ip: { tr: 'Islak havlular yüzüne dolandı!', en: 'Wet towels wrapped round your face!' },
  kova: { tr: 'Paspas kovasına çarptın, ıslak zeminde kaydın!', en: 'You hit the mop bucket and slid on the wet floor!' },
  cocuk: { tr: 'Diş fırçalayan biriyle çarpıştınız: "Hey, dikkat!"', en: 'You bumped into someone brushing their teeth: "Hey, watch it!"' },
};

const PYJAMA_KIDS = ['#c9a3d9', '#9fd0b0', '#f0b48a', '#a7b8e8', '#e8d38a', '#e8a7b5'];
const HAIRS = ['#2b1d14', '#4a3222', '#1d1a18', '#7a4e2a', '#3b2a20'];
const SKINS = ['#e8b98f', '#d9a378', '#f1c9a5', '#c68b5e'];
const pick = <X,>(xs: X[], seed: number) => xs[Math.abs(Math.floor(seed)) % xs.length];

const shuffle = <X,>(xs: X[]) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** the corridor's obstacles, row by row; every row leaves a way through (a free lane, or one move that clears it all) */
function layout(): Ob[] {
  const obs: Ob[] = [];
  const add = (d: number, lane: number, kind: Kind) => obs.push({ d, lane, kind, hit: false, seed: Math.floor(Math.random() * 1000) });
  const low = (): Kind => (Math.random() < 0.5 ? 'terlik' : 'sepet');
  const tall = (): Kind => (Math.random() < 0.5 ? 'kova' : 'cocuk');
  let d = 24;
  let row = 0;
  while (d < TRACK - 20) {
    const p = d / TRACK;
    const [a, b, c] = shuffle([-1, 0, 1]);
    const r = Math.random();
    // the first rows teach one thing at a time
    if (row === 0) add(d, 0, 'terlik');
    else if (row === 1) { add(d, -1, 'kova'); add(d, 0, 'cocuk'); }
    else if (row === 2) for (const l of [-1, 0, 1]) add(d, l, 'ip');
    else if (r < 0.3) add(d, a, ([low(), tall(), 'ip'] as Kind[])[Math.floor(Math.random() * 3)]);
    else if (r < 0.55) { add(d, a, tall()); add(d, b, tall()); }
    else if (r < 0.68) for (const l of [-1, 0, 1]) add(d, l, low());
    else if (r < 0.8) for (const l of [-1, 0, 1]) add(d, l, 'ip');
    else { add(d, a, tall()); add(d, b, Math.random() < 0.5 ? low() : 'ip'); if (p > 0.5 && Math.random() < 0.5) add(d, c, 'terlik'); }
    row++;
    d += 13 - 4 * p + Math.random() * 4;
  }
  return obs;
}

export class PhoneRunView {
  readonly el: HTMLElement;
  private cv: HTMLCanvasElement;
  private c: CanvasRenderingContext2D;
  private phase: 'ready' | 'run' | 'arrive' | 'over' = 'ready';
  private obs = layout();
  /** how far down the corridor you are */
  private dist = 0;
  private t = 0;
  /** lane you're heading for (−1, 0, 1) and where you are across the corridor */
  private lane = 0;
  private x = 0;
  private jumpT = -1;
  private slideT = -1;
  /** 0.3 right after a bump, back to 1 as you find your feet again */
  private pace = 1;
  private safe = 0;
  private shake = 0;
  private stumbles = 0;
  private rings = 0;
  private ringAt = RING_S - 0.4;
  private late = false;
  private arriveAt = 0;
  private status = '';
  private statusUntil = 0;
  private last = 0;
  private raf = 0;
  private ended = false;
  private swipe: { x: number; y: number; moved: boolean } | null = null;

  private onKey = (e: KeyboardEvent) => {
    const k = e.key;
    const used = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter', 'Escape', 'a', 'd', 'w', 's', 'A', 'D', 'W', 'S', 'e', 'E'];
    if (!used.includes(k)) return;
    e.preventDefault(); e.stopPropagation();
    if (e.repeat) return;
    if (this.phase === 'over') { if (k === 'Enter' || k === ' ' || k === 'e' || k === 'E') this.finish(); return; }
    if (this.phase === 'ready') { if (k !== 'Escape') this.start(); return; }
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') this.move(-1);
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') this.move(1);
    else if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ') this.jump();
    else if (k === 'ArrowDown' || k === 's' || k === 'S') this.duck();
  };
  /** the game keeps its keys while it's open (Phaser listens on the window too) */
  private onKeyUp = (e: KeyboardEvent) => { e.stopPropagation(); };

  constructor(host: HTMLElement, private o: Opts) {
    injectStyles();
    this.el = document.createElement('div');
    this.el.className = 'pr-overlay';
    this.el.innerHTML = `
      <div class="pr-card">
        <div class="pr-head"><b></b><span></span></div>
        <canvas width="${W}" height="${H}"></canvas>
        <div class="pr-status"></div>
        <div class="pr-row"><button type="button" class="primary pr-go"></button></div>
      </div>`;
    this.cv = this.el.querySelector('canvas')!;
    this.c = this.cv.getContext('2d')!;
    this.el.querySelector('.pr-head b')!.textContent = L({ tr: '📞 Telefona koş!', en: '📞 Run to the phone!' });
    this.el.querySelector('.pr-head span')!.textContent = L({ tr: `${o.caller} arıyor`, en: `${o.caller} is calling` });
    this.go.textContent = L({ tr: 'Koş! 🏃', en: 'Run! 🏃' });
    this.go.addEventListener('click', () => { if (this.phase === 'ready') this.start(); else if (this.phase === 'over') this.finish(); });
    this.cv.addEventListener('pointerdown', (e) => { this.swipe = { x: e.clientX, y: e.clientY, moved: false }; this.cv.setPointerCapture?.(e.pointerId); });
    this.cv.addEventListener('pointermove', (e) => this.swiped(e, false));
    this.cv.addEventListener('pointerup', (e) => this.swiped(e, true));
    this.cv.addEventListener('pointercancel', () => { this.swipe = null; });
    window.addEventListener('keydown', this.onKey, true);
    window.addEventListener('keyup', this.onKeyUp, true);
    host.appendChild(this.el);
    this.go.focus();
    const loop = (now: number) => {
      const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0;
      this.last = now;
      this.tick(dt);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private get go() { return this.el.querySelector('.pr-go') as HTMLButtonElement; }

  // ---------- controls ----------

  private start() {
    this.phase = 'run';
    this.go.style.visibility = 'hidden';
    this.go.blur();
    sfx.ring();
  }
  private move(dir: number) {
    const next = Math.max(-1, Math.min(1, this.lane + dir));
    if (next !== this.lane) { this.lane = next; sfx.click(); }
  }
  private jump() {
    if (this.jumpT >= 0) return;
    this.slideT = -1;
    this.jumpT = 0;
    sfx.hop();
  }
  private duck() {
    // ducking in mid-air drops you straight back down
    this.jumpT = -1;
    this.slideT = 0;
  }
  /** swipe left/right to change lanes, up (or a tap) to jump, down to duck */
  private swiped(e: PointerEvent, up: boolean) {
    const s = this.swipe;
    if (!s) return;
    if (this.phase === 'ready') { if (up) { this.swipe = null; this.start(); } return; }
    if (this.phase === 'over') { if (up) { this.swipe = null; this.finish(); } return; }
    if (this.phase !== 'run') return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    const far = Math.max(Math.abs(dx), Math.abs(dy)) > 26;
    if (far && !s.moved) {
      s.moved = true;
      if (Math.abs(dx) > Math.abs(dy)) this.move(dx < 0 ? -1 : 1);
      else if (dy < 0) this.jump();
      else this.duck();
    }
    if (up) { if (!s.moved) this.jump(); this.swipe = null; }
  }

  // ---------- the run ----------

  private jumpY() {
    if (this.jumpT < 0) return 0;
    const k = this.jumpT / JUMP_S;
    return 4 * JUMP_H * k * (1 - k);
  }

  private say(line: string, secs = 2.2) { this.status = line; this.statusUntil = this.t + secs; }

  private tick(dt: number) {
    if (this.ended) return;
    this.shake = Math.max(0, this.shake - dt);
    if (this.phase === 'ready' || this.phase === 'over') return;
    this.t += dt;
    if (this.phase === 'arrive') {
      this.dist += (TRACK - 1.4 - this.dist) * Math.min(1, dt * 5);
      this.x += (0 - this.x) * Math.min(1, dt * 6);
      this.jumpT = -1; this.slideT = -1;
      if (this.t - this.arriveAt > 0.9) {
        this.phase = 'over';
        this.go.textContent = L({ tr: '📞 Ahizeyi kaldır', en: '📞 Pick up the receiver' });
        this.go.style.visibility = 'visible';
        this.go.focus();
        sfx.success();
      }
      return;
    }
    // running
    this.pace = Math.min(1, this.pace + dt * 0.45);
    const speed = (SPEED0 + (SPEED1 - SPEED0) * (this.dist / TRACK)) * this.pace;
    this.dist += speed * dt;
    const dx = this.lane - this.x;
    this.x += Math.sign(dx) * Math.min(Math.abs(dx), dt * 9);
    if (this.jumpT >= 0) { this.jumpT += dt; if (this.jumpT >= JUMP_S) this.jumpT = -1; }
    if (this.slideT >= 0) { this.slideT += dt; if (this.slideT >= SLIDE_S) this.slideT = -1; }
    this.safe = Math.max(0, this.safe - dt);
    // the phone keeps ringing
    if (!this.late) {
      this.ringAt -= dt;
      if (this.ringAt <= 0) {
        this.ringAt += RING_S;
        this.rings++;
        if (this.rings >= RINGS) {
          this.late = true;
          this.say(L({ tr: `Zil sustu… ${this.o.belletmen} telefonu açtı: "Geliyor, koşarak geliyor!"`, en: `The ringing stopped… ${this.o.belletmen} picked up: "They're coming, running all the way!"` }), 4);
        } else sfx.ring();
      }
    }
    // bumping into things
    if (this.safe <= 0) {
      const y = this.jumpY();
      for (const ob of this.obs) {
        if (ob.hit || Math.abs(ob.d - this.dist) > 0.45 || Math.abs(ob.lane - this.x) > 0.55) continue;
        const need = NEED[ob.kind];
        const ok = need === 'jump' ? y > (CLEAR[ob.kind] ?? 0.4) : need === 'duck' ? this.slideT >= 0 : false;
        if (ok) continue;
        ob.hit = true;
        // the rest of that clothesline comes down with it
        if (ob.kind === 'ip') for (const o2 of this.obs) if (o2.kind === 'ip' && Math.abs(o2.d - ob.d) < 0.01) o2.hit = true;
        this.stumbles++;
        this.pace = 0.3;
        this.safe = 1.1;
        this.shake = 0.35;
        sfx.bump();
        this.say(L(OUCH[ob.kind]));
        break;
      }
    }
    if (this.dist >= TRACK - 1.6) { this.phase = 'arrive'; this.arriveAt = this.t; }
  }

  private finish() {
    if (this.ended) return;
    this.ended = true;
    this.close();
    this.o.onEnd({ stumbles: this.stumbles, late: this.late, seconds: Math.round(this.t) });
  }

  close() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('keyup', this.onKeyUp, true);
    this.el.remove();
  }

  // ---------- drawing ----------

  /** camera distance of a point `d` down the corridor */
  private zOf(d: number) { return d - this.dist + CAM_BACK; }
  private sx(x: number, z: number) { return CX + (x * F) / z; }
  private sy(y: number, z: number) { return HY + ((CAM_H - y) * F) / z; }

  private quad(pts: Array<[number, number, number]>, fill: string) {
    const c = this.c;
    c.fillStyle = fill;
    c.beginPath();
    pts.forEach(([x, y, z], i) => { const px = this.sx(x, z), py = this.sy(y, z); if (i) c.lineTo(px, py); else c.moveTo(px, py); });
    c.closePath();
    c.fill();
  }

  /** a strip of the corridor between two points down it, clipped to what the camera sees */
  private span(d1: number, d2: number): [number, number] | null {
    const z1 = Math.max(NEAR, this.zOf(d1)), z2 = Math.min(FAR, this.zOf(d2));
    return z2 > z1 ? [z1, z2] : null;
  }

  private wall(side: -1 | 1, d1: number, d2: number, y1: number, y2: number, fill: string) {
    const s = this.span(d1, d2);
    if (!s) return;
    const x = side * HALF;
    this.quad([[x, y1, s[0]], [x, y1, s[1]], [x, y2, s[1]], [x, y2, s[0]]], fill);
  }

  private draw() {
    const c = this.c;
    c.save();
    if (this.shake > 0) c.translate((Math.random() - 0.5) * 10 * this.shake, (Math.random() - 0.5) * 8 * this.shake);
    c.fillStyle = '#0e1118';
    c.fillRect(-10, -10, W + 20, H + 20);
    const endD = TRACK + 0.8;
    const zEnd = this.zOf(endD);
    const back = Math.min(FAR, zEnd);
    const from = this.dist - CAM_BACK + NEAR;
    // ceiling, walls (oil-painted green below, white above) and the floor
    this.quad([[-HALF, CEIL, NEAR], [HALF, CEIL, NEAR], [HALF, CEIL, back], [-HALF, CEIL, back]], '#c9c6bb');
    for (const side of [-1, 1] as const) {
      this.wall(side, from, from + back, 1.15, CEIL, side < 0 ? '#e9e4d6' : '#ded9ca');
      this.wall(side, from, from + back, 0, 1.15, side < 0 ? '#5f8f74' : '#557f68');
      this.wall(side, from, from + back, 1.12, 1.2, '#3f6650');
    }
    this.quad([[-HALF, 0, NEAR], [HALF, 0, NEAR], [HALF, 0, back], [-HALF, 0, back]], '#b9ad98');
    // floor tiles going by
    const BAND = 1.6;
    for (let n = Math.floor(from / BAND); n * BAND < from + back; n++) {
      if (n % 2) continue;
      const s = this.span(n * BAND, (n + 1) * BAND);
      if (s) this.quad([[-HALF, 0, s[0]], [HALF, 0, s[0]], [HALF, 0, s[1]], [-HALF, 0, s[1]]], '#a2957d');
    }
    // doors on both sides, windows on the left between them, lights along the ceiling
    for (let n = Math.floor(from / 9); n * 9 < from + back; n++) {
      const d = n * 9;
      if (d > TRACK - 2) break;
      const side = n % 2 ? 1 : -1;
      this.wall(side, d, d + 1.3, 0, 2.15, '#6b4528');
      this.wall(side, d + 0.08, d + 1.22, 0.05, 2.08, '#83552f');
      this.wall(side, d + 0.5, d + 0.8, 1.75, 1.95, '#e8e0c8');
      // a night window on the left; on the right, now and then the cork notice board
      this.wall(-1, d + 4, d + 6.2, 1.45, 2.65, '#1b2a48');
      if (side > 0) this.wall(1, d + 4.5, d + 6.3, 1.4, 2.4, '#c8b48a');
    }
    for (let n = Math.floor(from / 6); n * 6 < from + back; n++) {
      const d = n * 6 + 2;
      if (d > TRACK - 1) break;
      const s = this.span(d, d + 1.4);
      if (!s) continue;
      this.quad([[-0.55, 0, s[0]], [0.55, 0, s[0]], [0.55, 0, s[1]], [-0.55, 0, s[1]]], 'rgba(255,248,220,0.07)');
      this.quad([[-0.22, CEIL - 0.01, s[0]], [0.22, CEIL - 0.01, s[0]], [0.22, CEIL - 0.01, s[1]], [-0.22, CEIL - 0.01, s[1]]], '#fffbe8');
    }
    // the end of the corridor: the belletmen's door and the phone on the wall
    if (zEnd < FAR) this.endWall(zEnd);
    // it gets darker towards the far end
    const fog = zEnd < FAR ? Math.max(0, Math.min(1, (zEnd - 8) / 30)) : 1;
    if (fog > 0) {
      const g = c.createRadialGradient(CX, HY, 4, CX, HY, 190);
      g.addColorStop(0, `rgba(8,10,16,${0.95 * fog})`);
      g.addColorStop(0.35, `rgba(8,10,16,${0.55 * fog})`);
      g.addColorStop(1, 'rgba(8,10,16,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
    }
    // everything in the corridor, far to near, with you among them
    const items = this.obs.map((ob) => ({ z: this.zOf(ob.d), ob })).filter((i) => i.z > NEAR && i.z < FAR);
    items.sort((a, b) => b.z - a.z);
    let drewMe = false;
    for (const it of items) {
      if (!drewMe && it.z < CAM_BACK) { this.runner(); drewMe = true; }
      c.globalAlpha = Math.max(0, Math.min(1, (FAR - it.z) / 22)) * (it.ob.hit ? 0.4 : 1);
      this.obstacle(it.ob, it.z);
      c.globalAlpha = 1;
    }
    if (!drewMe) this.runner();
    c.restore();
    this.hud();
  }

  private endWall(z: number) {
    const c = this.c;
    this.quad([[-HALF, 0, z], [HALF, 0, z], [HALF, CEIL, z], [-HALF, CEIL, z]], '#e4dfd0');
    this.quad([[-HALF, 0, z], [HALF, 0, z], [HALF, 1.15, z], [-HALF, 1.15, z]], '#5a8a70');
    // the belletmen's door, with its name plate
    this.quad([[-1.45, 0, z], [-0.55, 0, z], [-0.55, 2.15, z], [-1.45, 2.15, z]], '#7a4e2a');
    this.quad([[-1.25, 1.7, z], [-0.75, 1.7, z], [-0.75, 1.9, z], [-1.25, 1.9, z]], '#efe6cc');
    // a light in the doorway (it's open a crack)
    this.quad([[-0.62, 0, z], [-0.55, 0, z], [-0.55, 2.15, z], [-0.62, 2.15, z]], '#ffe7a0');
    // the phone: a red wall phone on a little shelf, the receiver on its hook (or in the belletmen's hand)
    const ringing = !this.late && this.phase !== 'over' && this.ringAt > RING_S - 0.5;
    const wob = ringing ? Math.sin(this.t * 60) * 0.03 : 0;
    const s = F / z;
    this.quad([[0.15, 1.05, z], [0.95, 1.05, z], [0.95, 1.12, z], [0.15, 1.12, z]], '#6b4528');
    this.quad([[0.33 + wob, 1.23, z], [0.77 + wob, 1.23, z], [0.77 + wob, 1.77, z], [0.33 + wob, 1.77, z]], '#5a1414');
    this.quad([[0.35 + wob, 1.25, z], [0.75 + wob, 1.25, z], [0.75 + wob, 1.75, z], [0.35 + wob, 1.75, z]], '#b8322a');
    c.fillStyle = '#f1e6cf'; c.beginPath(); c.arc(this.sx(0.55 + wob, z), this.sy(1.45, z), 0.1 * s, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#5a1414'; c.beginPath(); c.arc(this.sx(0.55 + wob, z), this.sy(1.45, z), 0.035 * s, 0, Math.PI * 2); c.fill();
    if (!this.late) this.quad([[0.3 + wob, 1.7, z], [0.8 + wob, 1.7, z], [0.8 + wob, 1.84, z], [0.3 + wob, 1.84, z]], '#2a1010');
    // the coiled cord
    c.strokeStyle = '#2a2a2a'; c.lineWidth = Math.max(1, s * 0.025);
    c.beginPath(); c.moveTo(this.sx(0.42, z), this.sy(1.3, z)); c.quadraticCurveTo(this.sx(0.3, z), this.sy(1.05, z), this.sx(0.45, z), this.sy(1.0, z)); c.stroke();
    if (ringing) {
      c.font = `bold ${Math.max(10, s * 0.28)}px system-ui, sans-serif`; c.textAlign = 'center';
      c.fillStyle = '#ffe08a';
      c.fillText('♪', this.sx(1.05, z), this.sy(1.95, z));
      c.fillText('♪', this.sx(0.05, z), this.sy(2.05, z));
    }
    if (this.late) this.adult(z, 1.15);
  }

  /** the belletmen at the phone, holding the receiver */
  private adult(z: number, x: number) {
    const c = this.c, s = F / z;
    const px = this.sx(x, z), py = this.sy(0, z);
    c.fillStyle = '#3c4048'; c.fillRect(px - 0.2 * s, py - 0.85 * s, 0.4 * s, 0.85 * s);
    c.fillStyle = '#8a6d4c'; c.fillRect(px - 0.27 * s, py - 1.55 * s, 0.54 * s, 0.72 * s);
    c.fillStyle = '#e1b08a'; c.beginPath(); c.arc(px, py - 1.73 * s, 0.17 * s, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#5a5a5a'; c.beginPath(); c.arc(px, py - 1.8 * s, 0.17 * s, Math.PI, Math.PI * 2); c.fill();
    c.fillStyle = '#2a2a2a'; c.fillRect(px - 0.2 * s, py - 1.85 * s, 0.08 * s, 0.25 * s);
  }

  private obstacle(ob: Ob, z: number) {
    const c = this.c, s = F / z;
    const px = this.sx(ob.lane, z), py = this.sy(0, z);
    const tilt = ob.hit ? 0.35 : 0;
    c.save();
    c.translate(px, py);
    c.rotate(tilt);
    // a shadow on the floor
    c.fillStyle = 'rgba(0,0,0,0.18)';
    c.beginPath(); c.ellipse(0, 0, 0.42 * s, 0.07 * s, 0, 0, Math.PI * 2); c.fill();
    if (ob.kind === 'terlik') {
      const col = pick(['#3f7fd6', '#d64f6a', '#3aa476', '#e0a23a'], ob.seed);
      for (const k of [-1, 1]) {
        c.fillStyle = col;
        c.beginPath(); c.ellipse(k * 0.13 * s, -0.05 * s, 0.1 * s, 0.07 * s, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(k * 0.13 * s - 0.08 * s, -0.12 * s, 0.16 * s, 0.05 * s);
      }
    } else if (ob.kind === 'sepet') {
      const w = 0.4 * s, h = 0.55 * s;
      c.fillStyle = '#d4b98a';
      c.beginPath(); c.moveTo(-w, -h); c.lineTo(w, -h); c.lineTo(w * 0.8, 0); c.lineTo(-w * 0.8, 0); c.closePath(); c.fill();
      c.strokeStyle = '#a88a5c'; c.lineWidth = Math.max(1, s * 0.02);
      for (let i = 1; i < 4; i++) { const yy = -h + (h * i) / 4; c.beginPath(); c.moveTo(-w * (1 - 0.05 * i), yy); c.lineTo(w * (1 - 0.05 * i), yy); c.stroke(); }
      // clothes sticking out
      c.fillStyle = pick(PYJAMA_KIDS, ob.seed); c.fillRect(-w * 0.7, -h - 0.1 * s, 0.3 * s, 0.14 * s);
      c.fillStyle = '#f4f0e6'; c.fillRect(-0.02 * s, -h - 0.14 * s, 0.14 * s, 0.18 * s);
      c.fillStyle = pick(PYJAMA_KIDS, ob.seed + 3); c.fillRect(w * 0.35, -h - 0.08 * s, 0.12 * s, 0.1 * s);
    } else if (ob.kind === 'ip') {
      // a line strung across the corridor, with towels hanging off it (duck under)
      const top = -1.32 * s, low = -0.78 * s;
      c.strokeStyle = '#ece6d6'; c.lineWidth = Math.max(1, s * 0.02);
      c.beginPath(); c.moveTo(-0.5 * s, top); c.lineTo(0.5 * s, top); c.stroke();
      if (ob.lane === -1 || ob.lane === 1) {
        // the poles at the walls
        const wx = ob.lane * 0.75 * s;
        c.fillStyle = '#8a8f96'; c.fillRect(wx - 0.03 * s, top - 0.05 * s, 0.06 * s, 1.37 * s);
      }
      for (const k of [-0.28, 0.18]) {
        c.fillStyle = pick(['#e86a6a', '#6aa8e8', '#f0d36a', '#9be08a', '#f4f0e6'], ob.seed + k * 10);
        c.fillRect(k * s, top, 0.3 * s, top * -1 + low);
        c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(k * s, low - 0.06 * s, 0.3 * s, 0.03 * s);
      }
    } else if (ob.kind === 'kova') {
      // a mop bucket in a puddle, and the yellow sign
      c.fillStyle = 'rgba(150,190,220,0.35)'; c.beginPath(); c.ellipse(0, -0.01 * s, 0.48 * s, 0.09 * s, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#e2c22b'; c.fillRect(-0.3 * s, -0.42 * s, 0.4 * s, 0.42 * s);
      c.fillStyle = '#b8981a'; c.fillRect(-0.3 * s, -0.42 * s, 0.4 * s, 0.06 * s);
      c.strokeStyle = '#8b6a40'; c.lineWidth = Math.max(1, s * 0.04);
      c.beginPath(); c.moveTo(-0.1 * s, -0.4 * s); c.lineTo(-0.02 * s, -1.45 * s); c.stroke();
      c.fillStyle = '#efe7d2'; c.beginPath(); c.ellipse(-0.1 * s, -0.38 * s, 0.12 * s, 0.06 * s, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#f2c81e';
      c.beginPath(); c.moveTo(0.22 * s, 0); c.lineTo(0.32 * s, -0.9 * s); c.lineTo(0.44 * s, 0); c.closePath(); c.fill();
      c.fillStyle = '#222'; c.font = `bold ${Math.max(6, s * 0.2)}px system-ui, sans-serif`; c.textAlign = 'center';
      c.fillText('!', 0.33 * s, -0.25 * s);
    } else {
      // a kid in pyjamas, toothbrush in mouth, towel round the neck
      const bob = Math.sin(this.t * 6 + ob.seed) * 0.02 * s;
      const pj = pick(PYJAMA_KIDS, ob.seed);
      c.fillStyle = pj; c.fillRect(-0.16 * s, -0.5 * s, 0.13 * s, 0.5 * s); c.fillRect(0.03 * s, -0.5 * s, 0.13 * s, 0.5 * s);
      c.fillRect(-0.24 * s, -0.95 * s + bob, 0.48 * s, 0.5 * s);
      c.fillStyle = '#f4f0e6'; c.fillRect(-0.24 * s, -0.95 * s + bob, 0.48 * s, 0.1 * s);
      c.fillStyle = pick(SKINS, ob.seed); c.beginPath(); c.arc(0, -1.12 * s + bob, 0.17 * s, 0, Math.PI * 2); c.fill();
      c.fillStyle = pick(HAIRS, ob.seed); c.beginPath(); c.arc(0, -1.17 * s + bob, 0.17 * s, Math.PI, Math.PI * 2); c.fill();
      c.fillStyle = '#4fa3e0'; c.fillRect(0.02 * s, -1.08 * s + bob, 0.2 * s, 0.035 * s);
      c.fillStyle = '#fff'; c.fillRect(-0.06 * s, -1.03 * s + bob, 0.1 * s, 0.025 * s);
    }
    c.restore();
  }

  /** you, from behind, in your pyjamas */
  private runner() {
    const c = this.c, z = CAM_BACK, s = F / z;
    const px = this.sx(this.x, z), py = this.sy(0, z);
    const y = this.jumpY() * s;
    const sliding = this.slideT >= 0;
    const blink = this.safe > 0 && Math.floor(this.safe * 12) % 2 === 0;
    c.fillStyle = 'rgba(0,0,0,0.3)';
    const sh = Math.max(0.4, 1 - this.jumpY() / 1.6);
    c.beginPath(); c.ellipse(px, py, 0.3 * s * sh, 0.06 * s * sh, 0, 0, Math.PI * 2); c.fill();
    if (blink) return;
    const { skin, hair } = this.o.look, { top, bottom } = this.o.pyjamas;
    c.save();
    c.translate(px, py - y);
    if (sliding) {
      // knees up, sliding on your back on the polished floor
      c.fillStyle = bottom; c.fillRect(-0.28 * s, -0.2 * s, 0.56 * s, 0.18 * s);
      c.fillStyle = top; c.fillRect(-0.24 * s, -0.5 * s, 0.48 * s, 0.32 * s);
      c.fillStyle = skin; c.beginPath(); c.arc(0, -0.62 * s, 0.16 * s, 0, Math.PI * 2); c.fill();
      c.fillStyle = hair; c.beginPath(); c.arc(0, -0.64 * s, 0.16 * s, 0, Math.PI * 2); c.fill();
      c.restore();
      return;
    }
    const run = this.phase === 'run' || this.phase === 'arrive' ? Math.sin(this.t * 16) : 0;
    const air = this.jumpT >= 0;
    // legs
    c.fillStyle = bottom;
    const l1 = air ? 0.08 : Math.max(0, run) * 0.12, l2 = air ? 0.08 : Math.max(0, -run) * 0.12;
    c.fillRect(-0.17 * s, -0.48 * s, 0.14 * s, (0.48 - l1) * s);
    c.fillRect(0.03 * s, -0.48 * s, 0.14 * s, (0.48 - l2) * s);
    c.fillStyle = '#e8e2d4';
    c.fillRect(-0.18 * s, -l1 * s - 0.05 * s, 0.16 * s, 0.06 * s);
    c.fillRect(0.02 * s, -l2 * s - 0.05 * s, 0.16 * s, 0.06 * s);
    // arms swinging, then the body
    c.fillStyle = top;
    c.save(); c.translate(-0.25 * s, -0.86 * s); c.rotate(run * 0.5); c.fillRect(-0.06 * s, 0, 0.12 * s, 0.36 * s); c.restore();
    c.save(); c.translate(0.25 * s, -0.86 * s); c.rotate(-run * 0.5); c.fillRect(-0.06 * s, 0, 0.12 * s, 0.36 * s); c.restore();
    c.fillRect(-0.25 * s, -0.92 * s, 0.5 * s, 0.48 * s);
    c.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 3; i++) c.fillRect(-0.25 * s, (-0.84 + i * 0.14) * s, 0.5 * s, 0.04 * s);
    // the back of your head
    c.fillStyle = skin;
    c.beginPath(); c.arc(-0.17 * s, -1.08 * s, 0.05 * s, 0, Math.PI * 2); c.arc(0.17 * s, -1.08 * s, 0.05 * s, 0, Math.PI * 2); c.fill();
    c.fillRect(-0.06 * s, -0.98 * s, 0.12 * s, 0.08 * s);
    c.fillStyle = hair; c.beginPath(); c.arc(0, -1.1 * s, 0.18 * s, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  /** how far to go, the rings so far, and the line under the corridor */
  private hud() {
    const c = this.c;
    const k = Math.min(1, this.dist / (TRACK - 1.6));
    const x0 = 16, x1 = W - 52, y = 18;
    c.fillStyle = 'rgba(10,12,20,0.6)'; c.fillRect(0, 0, W, 50);
    c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(x0, y - 4, x1 - x0, 8);
    c.fillStyle = '#f2c14e'; c.fillRect(x0, y - 4, (x1 - x0) * k, 8);
    c.fillStyle = '#fff'; c.beginPath(); c.arc(x0 + (x1 - x0) * k, y, 7, 0, Math.PI * 2); c.fill();
    c.font = '20px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('📞', W - 30, y + 1);
    c.textBaseline = 'alphabetic';
    c.font = 'bold 13px system-ui, sans-serif'; c.textAlign = 'left';
    c.fillStyle = this.late ? '#ffb38a' : '#fff6c8';
    c.fillText(this.late
      ? L({ tr: `☎️ ${this.o.belletmen} hatta bekletiyor`, en: `☎️ ${this.o.belletmen} is holding the line` })
      : L({ tr: `🔔 Zil: ${this.rings}/${RINGS}`, en: `🔔 Rings: ${this.rings}/${RINGS}` }), x0, y + 24);
    if (this.phase === 'ready') {
      c.fillStyle = 'rgba(10,12,20,0.78)'; c.fillRect(40, 130, W - 80, 150);
      c.fillStyle = '#fff'; c.textAlign = 'center';
      c.font = 'bold 17px system-ui, sans-serif';
      c.fillText(L({ tr: 'Telefon koridorun ta sonunda!', en: 'The phone is at the very end of the corridor!' }), CX, 165);
      c.font = '14px system-ui, sans-serif';
      const touch = document.body.classList.contains('touch');
      const lines = touch
        ? [L({ tr: 'Sola / sağa kaydır: şerit değiştir', en: 'Swipe left / right: change lanes' }), L({ tr: 'Yukarı kaydır ya da dokun: zıpla', en: 'Swipe up or tap: jump' }), L({ tr: 'Aşağı kaydır: eğil, altından kay', en: 'Swipe down: duck and slide under' })]
        : [L({ tr: '← → : şerit değiştir', en: '← → : change lanes' }), L({ tr: '↑ ya da Boşluk: zıpla', en: '↑ or Space: jump' }), L({ tr: '↓ : eğil, altından kay', en: '↓ : duck and slide under' })];
      lines.forEach((ln, i) => c.fillText(ln, CX, 198 + i * 22));
      c.fillStyle = '#f2c14e'; c.font = '13px system-ui, sans-serif';
      c.fillText(L({ tr: 'Bir şeye çarparsan yavaşlarsın.', en: 'Bump into something and you slow down.' }), CX, 268);
    }
    let line = this.t < this.statusUntil ? this.status : '';
    if (!line) {
      if (this.phase === 'ready') line = L({ tr: `${this.o.belletmen}: "Koşma ama çabuk ol, ${this.o.caller.toLocaleLowerCase('tr-TR')} bekliyor!"`, en: `${this.o.belletmen}: "Don't run… but hurry, ${this.o.caller.toLowerCase()} is waiting!"` });
      else if (this.phase === 'over') line = this.late
        ? L({ tr: `${this.o.belletmen} ahizeyi sana uzattı: "Al bakalım, nefeslen biraz."`, en: `${this.o.belletmen} hands you the receiver: "Here you go. Catch your breath."` })
        : L({ tr: 'Telefon hâlâ çalıyor. Yetiştin!', en: "It's still ringing. You made it!" });
      else if (this.phase === 'arrive') line = L({ tr: 'Son birkaç adım…', en: 'Just a few more steps…' });
      else line = L({ tr: 'Koş! Terliklerin üstünden zıpla, havluların altından kay.', en: 'Run! Jump the slippers, slide under the towels.' });
    }
    (this.el.querySelector('.pr-status') as HTMLElement).textContent = line;
  }
}

let styled = false;
function injectStyles() {
  if (styled) return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = `
.pr-overlay { position: fixed; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center; padding: 12px; background: rgba(6, 8, 14, 0.82); }
.pr-card { background: #1d2326; color: #f4f0e6; border-radius: 12px; padding: 14px; width: min(548px, 100%); box-shadow: 0 12px 40px rgba(0,0,0,0.5); font-family: system-ui, sans-serif; }
.pr-card canvas { width: 100%; height: auto; display: block; border-radius: 8px; touch-action: none; user-select: none; -webkit-user-select: none; }
.pr-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 8px; font-size: 18px; }
.pr-head span { font-size: 13px; opacity: 0.75; }
.pr-status { min-height: 2.6em; margin: 10px 2px 8px; font-size: 14px; line-height: 1.3; }
.pr-row { display: flex; justify-content: flex-end; }
`;
  document.head.appendChild(s);
}

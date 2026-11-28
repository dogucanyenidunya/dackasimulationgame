// Teneffüs in the classroom. Between lessons the class comes alive: a couple of kids play tag around the
// desks, one throws a paper plane, a few kneel over a game of marbles at the back, others chat in little
// groups or stay at their desks, and one or two go up to the teacher's desk. When the bell rings everyone
// walks back to their seat. Kids walk on the floor grid only (never over desks, shelves or walls).
import Phaser from 'phaser';
import { TILE } from '../content/campus';
import { CLASS_DESKS, CLASS_OX, buildClassroom } from '../content/classroom';
import { RT } from '../content/dormroom';
import type { NpcDef } from '../content/npcs';
import { L, type Text } from '../i18n';

/** classroom tile coordinates (fractional allowed) */
type Pt = [number, number];
/** where a kid standing on tile (x, y) is drawn: seated kids use the same rule, one row below their desk */
const px = ([x, y]: Pt): Pt => [(CLASS_OX + x + 0.5) * TILE, (y + 0.35) * TILE];
const tileOf = (wx: number, wy: number): Pt => [Math.round(wx / TILE - CLASS_OX - 0.5), Math.round(wy / TILE - 0.35)];

// facing → first frame of that row in the character sheet (0 down, 1 left, 2 right, 3 up; 3 frames each)
const DOWN = 0, LEFT = 3, RIGHT = 6, UP = 9;

type Kind = 'sit' | 'chase' | 'plane' | 'floor' | 'teacher' | 'chat';
interface Role { kind: Kind; group: number; slot: number }

/** up at the teacher's desk (the teacher stands behind it) */
const TEACHER_AT: Array<[number, number, number]> = [[13.9, 4, UP], [15.1, 4, UP], [13, 3, RIGHT]];
/** little standing groups, between the desks and in the right-hand aisle */
const CHATS: Array<{ c: Pt; at: Pt[] }> = [
  { c: [15.8, 7], at: [[15.2, 6.4], [16.3, 6.5], [15.8, 7.6]] },
  { c: [11, 7.5], at: [[11, 6.6], [11, 8.4]] },
  { c: [13, 7.5], at: [[13, 6.6], [13, 8.4]] },
  { c: [4, 7.5], at: [[4, 6.6], [4, 8.4]] },
];
/** marbles in the back-right corner */
const MARBLES_C: Pt = [15.55, 10.7];
const MARBLES_AT: Array<[number, number, number]> = [[15, 10.6, RIGHT], [16.1, 10.6, LEFT], [15.55, 9.7, DOWN]];
/** the paper plane flies along the front, past the blackboard */
const PLANE_ENDS: [Pt, Pt] = [[2, 3], [10.5, 3]];
/** tag runs round the left-hand block of desks */
const LOOP: Pt[] = [[2, 4], [2, 11], [8.5, 11], [8.5, 4]];
const DOOR: Pt = [8.5, 11.2];

const WALK = 62, RUN = 2.5 * TILE, CHASE = 3.4 * TILE;

const LINES: Record<Exclude<Kind, 'teacher'>, Text[]> = {
  sit: [
    { tr: '📖', en: '📖' }, { tr: '✏️', en: '✏️' }, { tr: '🍎', en: '🍎' },
    { tr: 'Ödevi bitirmem lazım…', en: 'I have to finish my homework…' },
    { tr: 'Bana bir silgi verir misin?', en: 'Can I borrow an eraser?' },
  ],
  chat: [
    { tr: 'Teneffüs çok kısa…', en: 'Breaks are way too short…' },
    { tr: 'Ödevi yaptın mı?', en: 'Did you do the homework?' },
    { tr: 'Dün gece koridorda bir ses duydum!', en: 'I heard something in the corridor!' },
    { tr: 'Kimseye söyleme ama…', en: "Don't tell anyone, but…" },
    { tr: 'Akşam maç yapalım mı?', en: 'Shall we play a match tonight?' },
    { tr: 'Hafta sonu evci misin?', en: 'Are you going home this weekend?' },
    { tr: '😂', en: '😂' }, { tr: '💬', en: '💬' },
  ],
  chase: [
    { tr: 'Yakalayamazsın!', en: "You can't catch me!" },
    { tr: 'Dur, dur!', en: 'Wait, wait!' },
    { tr: '😆', en: '😆' },
  ],
  plane: [
    { tr: 'Uç bakalım! ✈️', en: 'Fly! ✈️' },
    { tr: 'Rekor!', en: 'A record!' },
    { tr: '✈️', en: '✈️' },
  ],
  floor: [
    { tr: 'Sıra bende!', en: 'My turn!' },
    { tr: 'Vurdum!', en: 'Got it!' },
    { tr: 'Hile yok!', en: 'No cheating!' },
    { tr: 'Bu misket benim!', en: "That marble's mine!" },
  ],
};
/** to the teacher: `sir` is "Sir" or "Miss" in English */
const ASK = (sir: string): Text[] => [
  { tr: 'Öğretmenim, bu soruyu anlamadım.', en: `${sir}, I didn't get this question.` },
  { tr: 'Öğretmenim, sınav ne zaman?', en: `${sir}, when is the test?` },
  { tr: 'Öğretmenim, ödevimi getirdim!', en: `${sir}, I brought my homework!` },
  { tr: 'Öğretmenim, tahtayı ben silebilir miyim?', en: `${sir}, can I wipe the board?` },
];
const REPLY: Text[] = [
  { tr: 'Aferin sana!', en: 'Well done!' },
  { tr: 'Gel, bir daha anlatayım.', en: 'Come, let me explain it again.' },
  { tr: 'Perşembe, unutmayın!', en: "Thursday, don't forget!" },
  { tr: 'Tabii, buyur.', en: 'Of course, go ahead.' },
];
const NO_RUNNING: Text = { tr: 'Sınıfta koşmayın çocuklar!', en: 'No running in the classroom, kids!' };
const TAG: Text = { tr: 'Ebe sensin!', en: "Tag, you're it!" };
const BREAK_START: Text[] = [{ tr: 'Teneffüs! 🎉', en: 'Break time! 🎉' }, { tr: 'Oh be, teneffüs!', en: 'Phew, break!' }];
const BELL: Text = { tr: 'Zil çaldı! 🔔', en: "There's the bell! 🔔" };
const TO_SEATS: Text = { tr: 'Hadi, herkes yerine!', en: 'Come on, everyone to your seats!' };

interface Kid {
  sp: Phaser.Physics.Arcade.Sprite;
  def: NpcDef;
  seat: Pt;
  shown: boolean;
  /** what they are heading for or doing: 'seat', 'out' (leaving the room) or a role key */
  aim: string;
  path: Pt[]; // world pixels
  speed: number;
  then: (() => void) | null;
  role: Role;
  /** the frame they show while standing still */
  face: number;
  /** next idle fidget */
  idleAt: number;
}

export interface ClassNow {
  /** the player is in the classroom (else everything snaps into place instead of walking) */
  inRoom: boolean;
  /** this break's key (a new one deals out new roles), or null in a lesson */
  breakKey: string | null;
  /** the teacher is in the room during this break */
  teacher: { name: string; look?: { skirt?: boolean } } | null;
  /** is this student in the Eğitim Binası right now */
  present: (def: NpcDef) => boolean;
  /** a real player has this classmate's desk: they're simply not in class (gone at once, no walking out) */
  evicted?: (def: NpcDef) => boolean;
}

/** a steady pseudo-random sequence for one break */
function seeded(key: string) {
  let s = 2166136261;
  for (let i = 0; i < key.length; i++) { s ^= key.charCodeAt(i); s = Math.imul(s, 16777619); }
  return () => { s = Math.imul(s ^ (s >>> 15), 2246822519) + 0x6d2b79f5 | 0; return ((s ^ (s >>> 13)) >>> 0) / 4294967296; };
}

export class ClassLife {
  private kids: Kid[];
  private grid = buildClassroom();
  private seatTiles = new Set(CLASS_DESKS.map(([x, y]) => `${x},${y + 1}`));
  private breakKey: string | null = null;
  private started = false;
  private chatterAt = 0;
  private chase = { s: [3.5, 0], dir: 1, it: 1, waitUntil: 0, nagged: false };
  private plane: { img: Phaser.GameObjects.Image; end: 0 | 1; state: 'aim' | 'air' | 'floor'; until: number };
  private ring: Phaser.GameObjects.Graphics;
  private marbles: Phaser.GameObjects.Arc[] = [];
  private flickAt = 0;
  private flickTurn = 0;

  constructor(
    private scene: Phaser.Scene,
    mates: Array<{ sp: Phaser.Physics.Arcade.Sprite; desk: Pt }>,
    private teacher: Phaser.Physics.Arcade.Sprite,
    private say: (sp: Phaser.GameObjects.Sprite, text: string) => void,
  ) {
    this.kids = mates.map(({ sp, desk }) => ({
      sp, def: sp.getData('def') as NpcDef, seat: [desk[0], desk[1] + 1], shown: true, aim: 'seat', path: [], speed: WALK, then: null,
      role: { kind: 'sit', group: 0, slot: 0 }, face: UP, idleAt: 0,
    }));
    if (!scene.textures.exists('paperplane')) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xf6f6f0).fillTriangle(0, 0, 12, 3, 0, 7);
      g.lineStyle(1, 0xb8bcc0).lineBetween(1, 3.5, 11, 3);
      g.generateTexture('paperplane', 12, 7);
      g.destroy();
    }
    this.plane = { img: scene.add.image(0, 0, 'paperplane').setVisible(false).setDepth(96_500), end: 0, state: 'aim', until: 0 };
    const [cx, cy] = this.ringCentre();
    this.ring = scene.add.graphics().lineStyle(1.5, 0xf4f1e6, 0.55).strokeCircle(cx, cy, 12).setDepth(2).setVisible(false);
    const colours = [0x4fa3e0, 0xe0574f, 0x5fc46a, 0xf0c64a, 0xb07ad8];
    for (const c of colours) this.marbles.push(scene.add.circle(cx, cy, 2.2, c).setStrokeStyle(1, 0x1d2326, 0.6).setDepth(3).setVisible(false));
    this.scatterMarbles();
  }

  update(time: number, delta: number, now: ClassNow) {
    const dt = Math.min(delta, 100) / 1000;
    const walk = now.inRoom && this.started;
    if (now.breakKey !== this.breakKey) {
      const wasBreak = this.breakKey !== null;
      this.breakKey = now.breakKey;
      if (now.breakKey) this.deal(now.breakKey, !!now.teacher);
      if (walk) this.announce(time, !!now.breakKey, wasBreak, now);
    }
    this.started = true;
    for (const k of this.kids) this.tickKid(k, time, dt, now, walk);
    this.tickChase(time, dt, now);
    this.tickPlane(time);
    this.tickMarbles(time);
    if (now.inRoom && now.breakKey && time > this.chatterAt) {
      this.chatterAt = time + 1700 + Math.random() * 1200;
      this.chatter(now);
    }
  }

  // ---------- who does what this break ----------

  private deal(key: string, teacherIn: boolean) {
    const r = seeded(key);
    const order = shuffle([...this.kids], r);
    // two or three stay at their desks; the rest: a word with the teacher, two games, then chatting groups
    let left = Math.max(0, order.length - 2 - Math.floor(r() * 2));
    type Group = { kind: Kind; group: number; n: number; min: number };
    const groups: Group[] = [];
    if (teacherIn) groups.push({ kind: 'teacher', group: 0, n: r() < 0.1 ? 3 : r() < 0.55 ? 1 : 2, min: 1 });
    const chase: Group = { kind: 'chase', group: 0, n: 2, min: 2 };
    const floor: Group = { kind: 'floor', group: 0, n: 2 + Math.floor(r() * 2), min: 2 };
    const plane: Group = { kind: 'plane', group: 0, n: 1, min: 1 };
    const [game, other] = r() < 0.5 ? [chase, floor] : [floor, chase];
    const second = r() < 0.5 ? other : plane;
    groups.push(game, second);
    groups.push(...shuffle(CHATS.map((_, i): Group => ({ kind: 'chat', group: i, n: i === 0 ? 2 + Math.floor(r() * 2) : 2, min: 2 })), r));
    const roles: Role[] = [];
    for (const g of groups) {
      if (left < g.min) continue;
      const n = Math.min(g.n, left);
      for (let s = 0; s < n; s++) roles.push({ kind: g.kind, group: g.group, slot: s });
      left -= n;
    }
    order.forEach((k, i) => { k.role = roles[i] ?? { kind: 'sit', group: 0, slot: 0 }; });
    this.chase = { s: [3.5, 0], dir: 1, it: 1, waitUntil: 0, nagged: false };
    Object.assign(this.plane, { state: 'aim', end: 0, until: 0 });
    this.plane.img.setVisible(false);
    this.scatterMarbles();
  }

  private roleKey(r: Role) { return r.kind === 'sit' ? 'seat' : `${r.kind}:${r.group}:${r.slot}`; }

  /** where a role stands, and which way they face there */
  private spot(k: Kid, aim: string): { at: Pt; face: number } {
    if (aim === 'seat') return { at: k.seat, face: UP };
    if (aim === 'out') return { at: DOOR, face: DOWN };
    const { kind, group, slot } = k.role;
    switch (kind) {
      case 'teacher': { const [x, y, f] = TEACHER_AT[slot]; return { at: [x, y], face: f }; }
      case 'floor': { const [x, y, f] = MARBLES_AT[slot]; return { at: [x, y], face: f }; }
      case 'plane': { const at = PLANE_ENDS[this.plane.end]; return { at, face: this.plane.end === 0 ? RIGHT : LEFT }; }
      case 'chase': return { at: this.loopAt(this.chase.s[slot]), face: DOWN };
      case 'chat': {
        const c = CHATS[group], at = c.at[slot];
        return { at, face: facing(c.c[0] - at[0], c.c[1] - at[1]) };
      }
      default: return { at: k.seat, face: UP };
    }
  }

  // ---------- each kid ----------

  private tickKid(k: Kid, time: number, dt: number, now: ClassNow, walk: boolean) {
    if (now.evicted?.(k.def)) { if (k.shown) this.place(k, 'out'); return; }
    const present = now.present(k.def);
    if (!present && !k.shown) return;
    const want = !present ? 'out' : now.breakKey ? this.roleKey(k.role) : 'seat';
    if (present && !k.shown) {
      this.show(k, true);
      if (walk) { k.sp.setPosition(...px(DOOR)); k.aim = ''; } // walks in at the door
      else this.place(k, want);
    }
    if (k.aim !== want) { if (walk) this.go(k, want); else this.place(k, want); }
    if (!k.shown) return;

    const sp = k.sp;
    if (k.path.length) {
      const [gx, gy] = k.path[0];
      const dx = gx - sp.x, dy = gy - sp.y, d = Math.hypot(dx, dy), step = k.speed * dt;
      if (d <= step) { sp.setPosition(gx, gy); k.path.shift(); }
      else sp.setPosition(sp.x + (dx / d) * step, sp.y + (dy / d) * step);
      sp.setFrame(facing(dx, dy) + [1, 0, 2, 0][Math.floor(time / (k.speed > WALK ? 110 : 170)) % 4]);
      if (!k.path.length) { const then = k.then; k.then = null; then?.(); }
    }
    else if (k.aim === 'seat') {
      // in a lesson: eyes on the board (and a blink now and then); at a break: turning round to the neighbours
      if (!now.breakKey) k.face = UP;
      else if (time > k.idleAt) { k.idleAt = time + 1500 + Math.random() * 2500; k.face = [UP, UP, LEFT, RIGHT, DOWN][Math.floor(Math.random() * 5)]; }
      sp.setFrame(k.face + (k.face === UP && Math.floor(time / 650 + sp.x) % 6 === 0 ? 1 : 0));
    }
    else if (k.role.kind !== 'chase') sp.setFrame(k.face);
    sp.setDepth(k.aim === 'seat' && !k.path.length ? k.seat[1] * TILE + 16 : sp.y + 16);
  }

  private show(k: Kid, on: boolean) {
    k.shown = on;
    k.sp.setVisible(on);
    k.sp.body!.enable = on;
    if (!on) { k.path = []; k.then = null; k.aim = 'out'; }
  }

  /** straight into place (the player isn't watching) */
  private place(k: Kid, aim: string) {
    this.scene.tweens.killTweensOf(k.sp);
    k.aim = aim; k.path = []; k.then = null;
    if (aim === 'out') { this.show(k, false); return; }
    const { at, face } = this.spot(k, aim);
    k.sp.setPosition(...px(at));
    k.face = face;
    k.sp.setFrame(face);
  }

  /** walk there along the aisles */
  private go(k: Kid, aim: string, then?: () => void) {
    this.scene.tweens.killTweensOf(k.sp);
    k.aim = aim;
    const { at, face } = this.spot(k, aim);
    k.speed = aim.startsWith('chase') ? RUN : WALK;
    k.path = this.route(k.sp.x, k.sp.y, at);
    k.then = () => {
      k.face = face;
      if (aim === 'out') this.show(k, false);
      then?.();
    };
    if (!k.path.length) { const t = k.then; k.then = null; t(); }
  }

  /** a path over floor tiles (no desks, shelves, walls, or other kids' chairs) to an exact spot */
  private route(wx: number, wy: number, goal: Pt): Pt[] {
    const [sx, sy] = tileOf(wx, wy);
    const gx = Math.round(goal[0]), gy = Math.round(goal[1]);
    const free = (x: number, y: number) => this.grid[y]?.[x] === RT.FLOOR && ((x === gx && y === gy) || !this.seatTiles.has(`${x},${y}`));
    const prev = new Map<string, string | null>([[`${sx},${sy}`, null]]);
    const queue: Pt[] = [[sx, sy]];
    let found = sx === gx && sy === gy;
    while (queue.length && !found) {
      const [x, y] = queue.shift()!;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as Pt[]) {
        const key = `${nx},${ny}`;
        if (prev.has(key) || !free(nx, ny)) continue;
        prev.set(key, `${x},${y}`);
        if (nx === gx && ny === gy) { found = true; break; }
        queue.push([nx, ny]);
      }
    }
    const out: Pt[] = [px(goal)];
    if (!found) return out;
    for (let key = prev.get(`${gx},${gy}`) ?? null; key && key !== `${sx},${sy}`; key = prev.get(key) ?? null) {
      const [x, y] = key.split(',').map(Number);
      out.unshift(px([x, y]));
    }
    return out;
  }

  private hop(sp: Phaser.GameObjects.Sprite) {
    this.scene.tweens.add({ targets: sp, y: sp.y - 3, duration: 110, yoyo: true });
  }

  // ---------- tag ----------

  private loopLen() { let n = 0; for (let i = 0; i < LOOP.length; i++) n += dist(LOOP[i], LOOP[(i + 1) % LOOP.length]); return n; }
  private loopAt(s: number): Pt {
    const len = this.loopLen();
    s = ((s % len) + len) % len;
    for (let i = 0; i < LOOP.length; i++) {
      const a = LOOP[i], b = LOOP[(i + 1) % LOOP.length], d = dist(a, b);
      if (s <= d) return [a[0] + (b[0] - a[0]) * (s / d), a[1] + (b[1] - a[1]) * (s / d)];
      s -= d;
    }
    return LOOP[0];
  }

  private tickChase(time: number, dt: number, now: ClassNow) {
    const runners = this.kids.filter((k) => k.shown && k.role.kind === 'chase' && k.aim === this.roleKey(k.role));
    if (!runners.length || runners.some((k) => k.path.length)) return;
    const c = this.chase, len = this.loopLen();
    for (const k of runners) {
      const slot = k.role.slot;
      const it = runners.length > 1 && slot === c.it;
      if (it && time < c.waitUntil) { k.sp.setFrame(k.face); continue; }
      c.s[slot] += c.dir * ((it ? CHASE : RUN) / TILE) * dt;
      const [x, y] = px(this.loopAt(c.s[slot]));
      const dx = x - k.sp.x, dy = y - k.sp.y;
      k.sp.setPosition(x, y).setDepth(y + 16);
      if (Math.abs(dx) + Math.abs(dy) > 0.01) k.face = facing(dx, dy);
      k.sp.setFrame(k.face + [1, 0, 2, 0][Math.floor(time / 110) % 4]);
    }
    if (runners.length < 2 || time < c.waitUntil) return; // (the new "it" counts to three first)
    const tagger = runners.find((k) => k.role.slot === c.it)!, runner = runners.find((k) => k.role.slot !== c.it)!;
    const gap = ((((c.s[runner.role.slot] - c.s[tagger.role.slot]) * c.dir) % len) + len) % len;
    if (gap < 0.55) {
      // caught: the other one is "it" now, and the chase turns round
      c.it = runner.role.slot; c.dir = -c.dir; c.waitUntil = time + 900;
      if (now.inRoom) {
        this.say(tagger.sp, L(TAG));
        this.hop(tagger.sp);
        if (now.teacher && !c.nagged && Math.random() < 0.5) { c.nagged = true; this.scene.time.delayedCall(900, () => this.teacher.visible && this.say(this.teacher, L(NO_RUNNING))); }
      }
    }
  }

  // ---------- the paper plane ----------

  private tickPlane(time: number) {
    const p = this.plane;
    const k = this.kids.find((x) => x.shown && x.role.kind === 'plane' && x.aim === this.roleKey(x.role));
    if (!k || !this.breakKey) { p.img.setVisible(false); p.state = 'aim'; p.until = 0; return; }
    if (k.path.length) return;
    if (p.state === 'aim' && time > p.until) {
      if (p.until === 0) { p.until = time + 700 + Math.random() * 800; return; }
      // throw it to the other end of the front
      const from = PLANE_ENDS[p.end], to = PLANE_ENDS[1 - p.end];
      const [x0, y0] = px(from), [x1, y1] = px(to);
      const land = y1 + 10, flip = x1 < x0;
      p.img.setVisible(true).setFlipX(flip).setPosition(x0, y0 - 6).setDepth(96_500);
      this.hop(k.sp);
      if (Math.random() < 0.35 && k.sp.visible) this.say(k.sp, L(pick(LINES.plane)));
      p.state = 'air';
      const dur = 1300 + Math.random() * 300, lift = 24 + Math.random() * 14;
      this.scene.tweens.addCounter({
        from: 0, to: 1, duration: dur,
        onUpdate: (tw) => {
          const t = tw.getValue() ?? 0;
          p.img.setPosition(x0 + (x1 - x0) * t, y0 - 6 + (land - y0 + 6) * t - Math.sin(Math.PI * t) * lift);
          p.img.setRotation((flip ? -1 : 1) * Math.cos(Math.PI * t) * -0.35);
        },
        onComplete: () => {
          if (p.state !== 'air') return;
          p.state = 'floor';
          p.img.setRotation(0).setDepth(land);
          // go and pick it up, then throw it back
          const kid = this.kids.find((x) => x.shown && x.role.kind === 'plane' && x.aim === this.roleKey(x.role));
          if (!kid) return;
          p.end = (1 - p.end) as 0 | 1;
          this.go(kid, kid.aim, () => { p.img.setVisible(false); p.state = 'aim'; p.until = this.scene.time.now + 600 + Math.random() * 900; });
        },
      });
    }
  }

  // ---------- marbles ----------

  private ringCentre(): Pt { const [x, y] = px(MARBLES_C); return [x, y + 14]; }

  private scatterMarbles() {
    const [cx, cy] = this.ringCentre();
    for (const m of this.marbles) { const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 7; m.setPosition(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.7); }
  }

  private tickMarbles(time: number) {
    const players = this.kids.filter((k) => k.shown && k.role.kind === 'floor' && k.aim === this.roleKey(k.role) && !k.path.length);
    const on = !!this.breakKey && players.length > 0;
    this.ring.setVisible(on);
    for (const m of this.marbles) m.setVisible(on);
    if (!on || time < this.flickAt) return;
    this.flickAt = time + 1100 + Math.random() * 900;
    const k = players[this.flickTurn++ % players.length];
    this.hop(k.sp);
    const [cx, cy] = this.ringCentre();
    const m = pick(this.marbles), a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 9;
    this.scene.tweens.add({ targets: m, x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.7, duration: 380, ease: 'Cubic.Out' });
  }

  // ---------- speech ----------

  private chatter(now: ClassNow) {
    const standing = this.kids.filter((k) => k.shown && !k.path.length);
    const active = standing.filter((k) => k.aim !== 'seat' && k.role.kind !== 'chase');
    const pool = Math.random() < 0.2 ? standing.filter((k) => k.aim === 'seat') : active;
    if (!pool.length) return;
    const k = pick(pool);
    const kind = k.aim === 'seat' ? 'sit' : k.role.kind;
    if (kind === 'teacher') {
      const sir = now.teacher?.look?.skirt ? 'Miss' : 'Sir';
      this.say(k.sp, L(pick(ASK(sir))));
      this.scene.time.delayedCall(1300, () => this.teacher.visible && this.say(this.teacher, L(pick(REPLY))));
      return;
    }
    if (kind === 'chase') return;
    this.say(k.sp, L(pick(LINES[kind])));
    if (kind === 'chat' || kind === 'floor') this.hop(k.sp);
  }

  private announce(time: number, isBreak: boolean, wasBreak: boolean, now: ClassNow) {
    const here = this.kids.filter((k) => k.shown);
    if (!here.length) return;
    this.chatterAt = time + 2200;
    if (isBreak && !wasBreak) this.say(pick(here).sp, L(pick(BREAK_START)));
    if (!isBreak && wasBreak) {
      this.say(pick(here).sp, L(BELL));
      if (this.teacher.visible || now.teacher) this.scene.time.delayedCall(500, () => this.teacher.visible && this.say(this.teacher, L(TO_SEATS)));
    }
  }
}

const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const facing = (dx: number, dy: number) => (Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? LEFT : RIGHT) : dy < 0 ? UP : DOWN);
function pick<T>(xs: T[]): T { return xs[Math.floor(Math.random() * xs.length)]; }
function shuffle<T>(xs: T[], r: () => number): T[] {
  for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]]; }
  return xs;
}

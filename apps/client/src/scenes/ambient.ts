// Life around the campus in the 2D view: trees in three shapes with shadows that match the
// sun (long in the morning and evening, short at noon), pole shadows, cloud shadows drifting over the campus,
// gulls crossing overhead, pigeons that scatter when you come close, puddles and ripples in the rain, a colour
// grade that follows the time of day, and a camera that leans a little ahead of where you walk.
import Phaser from 'phaser';
import { ART_RES, TREE_SHAPES, treeKey, type TreeShape } from '../art/textures';
import type { GroundInfo } from '../art/ground';
import { MAP_H, MAP_W, TILE } from '../content/campus';

export interface AmbientEnv {
  player: Phaser.Physics.Arcade.Sprite;
  /** in a room: nothing outdoors needs to run */
  inside: boolean;
  rain: boolean;
  /** 0 by day, towards 1 at night */
  dark: number;
  /** hour of the day (0–24), for shadow lengths and the colour grade */
  hour: number;
}

interface Cloud { s: Phaser.GameObjects.Image; vx: number; vy: number }
const CLOUDS = 7;
/** the wind that carries the cloud shadows (px/s), roughly from the north-west */
const WIND_X = 7, WIND_Y = 2.6;

interface Pigeon { s: Phaser.GameObjects.Sprite; state: 'peck' | 'fly' | 'gone'; t: number; vx: number; vy: number }
interface Gull { s: Phaser.GameObjects.Sprite; shadow: Phaser.GameObjects.Ellipse; vx: number; vy: number; phase: number }

const PIGEONS = 8;
/** sun from the north-west: a point h px up casts its shadow this far east and south */
const SUN_X = 0.45, SUN_Y = 0.26;

export class Ambient {
  private trees: Array<{ s: Phaser.GameObjects.Sprite; shadow: Phaser.GameObjects.Image; shape: TreeShape; tone: number }> = [];
  private puddles: Phaser.GameObjects.Image[] = [];
  private wet = 0;
  private ripples: Array<{ x: number; y: number; t: number }> = [];
  private rippleG: Phaser.GameObjects.Graphics;
  private pigeons: Pigeon[] = [];
  private gulls: Gull[] = [];
  private nextFlock = 6000;
  private poleShadows: Phaser.GameObjects.Graphics;
  /** how strongly the sun casts shadows right now (none at night, faint in rain) */
  private sun = -1;
  private look = { x: 0, y: 0 };
  private clouds: Cloud[] = [];
  private shadowLen = -1;
  private grade: Phaser.FX.ColorMatrix | null = null;
  private gradeKey = '';

  constructor(private scene: Phaser.Scene, private ground: GroundInfo) {
    const sprites = scene.children.list.filter((o): o is Phaser.GameObjects.Sprite => o instanceof Phaser.GameObjects.Sprite);
    // trees: a shape and colour per spot, fixed so a tree always stays the same tree
    for (const s of sprites.filter((o) => o.texture.key === 'tree')) {
      const h = (Math.imul(Math.round(s.x), 73856093) ^ Math.imul(Math.round(s.y), 19349663)) >>> 0;
      const shape = TREE_SHAPES[h % TREE_SHAPES.length], tone = (h >>> 8) % 3;
      const shadow = scene.add.image(s.x, s.y + 30, `treeshadow-${shape}`).setOrigin(10 / 80, 6 / 40).setScale(1 / ART_RES).setDepth(1.05).setAlpha(0.2);
      s.setTexture(treeKey(shape, tone));
      this.trees.push({ s, shadow, shape, tone });
    }
    // long thin shadows of the lamp posts and the flagpole
    const g = this.poleShadows = scene.add.graphics().setDepth(1.05).fillStyle(0x000000, 0.17);
    const pole = (bx: number, by: number, h: number) => g.fillPoints([{ x: bx - 1, y: by }, { x: bx + 2, y: by }, { x: bx + 2 + SUN_X * h, y: by + SUN_Y * h }, { x: bx - 1 + SUN_X * h, y: by + SUN_Y * h }], true);
    for (const s of sprites) {
      if (s.texture.key === 'lamp') {
        const bx = s.x + 1, by = s.y + 25;
        pole(bx, by, 40);
        g.fillRect(Math.round(bx + SUN_X * 46) - 4, Math.round(by + SUN_Y * 46) - 2, 9, 5);
      } else if (s.texture.key === 'flag') {
        const bx = s.x - 15.5, by = s.y + 44;
        pole(bx, by, 86);
        g.fillPoints([[2, 84], [36, 84], [36, 62], [2, 62]].map(([dx, h]) => ({ x: bx + dx + SUN_X * h, y: by + SUN_Y * h })), true);
      }
    }
    this.rippleG = scene.add.graphics().setDepth(0.3);
    // cloud shadows: big soft blobs sliding over everything outdoors
    if (!scene.textures.exists('cloudshadow')) {
      const t = scene.textures.createCanvas('cloudshadow', 256, 160)!;
      const c = t.getContext();
      const r = (() => { let x = 4242; return () => ((x = (x * 16807) % 2147483647) / 2147483647); })();
      for (let i = 0; i < 9; i++) {
        const cx = 60 + r() * 136, cy = 50 + r() * 60, rad = 30 + r() * 40;
        const g = c.createRadialGradient(cx, cy, 0, cx, cy, rad);
        g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.6, 'rgba(0,0,0,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.fillRect(0, 0, 256, 160);
      }
      t.refresh();
      t.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    for (let i = 0; i < CLOUDS; i++) {
      const s = scene.add.image(Math.random() * MAP_W * TILE, Math.random() * MAP_H * TILE, 'cloudshadow')
        .setScale(1.8 + Math.random() * 1.6, 1.5 + Math.random() * 1.2).setDepth(90_000).setAlpha(0);
      this.clouds.push({ s, vx: WIND_X * (0.85 + Math.random() * 0.3), vy: WIND_Y * (0.85 + Math.random() * 0.3) });
    }
    // pigeons on the plazas
    for (let i = 0; i < PIGEONS && ground.plazaSpots.length; i++) {
      const s = scene.add.sprite(0, 0, 'pigeon', 0).setScale(1 / ART_RES);
      const p: Pigeon = { s, state: 'peck', t: Math.random() * 3000, vx: 0, vy: 0 };
      this.land(p);
      this.pigeons.push(p);
    }
  }

  update(time: number, delta: number, env: AmbientEnv) {
    const cam = this.scene.cameras.main;
    if (!cam.visible) return; // the 3D view is on
    const sun = Math.round((1 - Math.min(1, env.dark * 1.4)) * (env.rain ? 0.4 : 1) * 20) / 20;
    if (sun !== this.sun) { this.sun = sun; this.shade(); }
    this.updateCamera(delta, env);
    const outdoors = !env.inside;
    this.updateClouds(delta, outdoors);
    this.updateShadowLength(env.hour);
    this.updateGrade(env, outdoors);
    this.updateRain(time, delta, env.rain && outdoors, cam.worldView);
    this.updatePigeons(time, delta, env, outdoors && !env.rain && env.dark < 0.45);
    this.updateGulls(time, delta, outdoors && !env.rain && env.dark < 0.4, cam.worldView);
  }

  private shade() {
    const k = Math.max(0, this.sun);
    for (const t of this.trees) t.shadow.setAlpha(k * 0.2).setVisible(k > 0);
    this.poleShadows.setAlpha(k).setVisible(k > 0);
  }

  /** cloud shadows drift with the wind and wrap round the campus; they only show when the sun casts shadows */
  private updateClouds(delta: number, outdoors: boolean) {
    const k = outdoors ? Math.max(0, this.sun) : 0;
    const W = MAP_W * TILE, H = MAP_H * TILE;
    for (const c of this.clouds) {
      c.s.x += (c.vx * delta) / 1000; c.s.y += (c.vy * delta) / 1000;
      const hw = c.s.displayWidth / 2, hh = c.s.displayHeight / 2;
      if (c.s.x - hw > W) c.s.x = -hw;
      if (c.s.y - hh > H) c.s.y = -hh;
      c.s.setAlpha(k * 0.42).setVisible(k > 0);
    }
  }

  /** a low sun throws long shadows: longest early and late, shortest around midday */
  private updateShadowLength(hour: number) {
    const fromNoon = Math.min(1, Math.abs(hour - 13) / 6);
    const len = Math.round((0.75 + fromNoon * fromNoon * 0.95) * 20) / 20;
    if (len === this.shadowLen) return;
    this.shadowLen = len;
    for (const t of this.trees) t.shadow.setScale(len / ART_RES, (0.85 + len * 0.15) / ART_RES);
  }

  /** a gentle colour grade: crisper and a touch more saturated by day, warm and bright at golden hour, flat in the rain */
  private updateGrade(env: AmbientEnv, outdoors: boolean) {
    const cam = this.scene.cameras.main;
    if (!cam.postFX) return; // canvas renderer: no grade
    if (!this.grade) this.grade = cam.postFX.addColorMatrix();
    const h = env.hour;
    const golden = outdoors ? Math.max(0, 1 - Math.abs(h - 18.2) / 1.6) + Math.max(0, 1 - Math.abs(h - 7) / 1.2) * 0.6 : 0;
    const day = outdoors ? Math.max(0, 1 - env.dark * 2) : 0;
    const sat = env.rain && outdoors ? -0.25 : day * 0.1 + golden * 0.12;
    const con = env.rain && outdoors ? -0.05 : day * 0.06;
    const bri = 1 + golden * 0.05;
    const key = `${sat.toFixed(2)}|${con.toFixed(2)}|${bri.toFixed(3)}`;
    if (key === this.gradeKey) return;
    this.gradeKey = key;
    this.grade.reset();
    this.grade.saturate(sat, true);
    this.grade.contrast(con, true);
    this.grade.brightness(bri, true);
  }

  /** the camera leads a little in the direction you walk */
  private updateCamera(delta: number, env: AmbientEnv) {
    const cam = this.scene.cameras.main, body = env.player.body as Phaser.Physics.Arcade.Body | null;
    const vx = env.inside || !body ? 0 : body.velocity.x, vy = env.inside || !body ? 0 : body.velocity.y;
    const tx = Phaser.Math.Clamp(-vx * 0.22, -36, 36), ty = Phaser.Math.Clamp(-vy * 0.16, -24, 24);
    if (env.inside) { this.look.x = 0; this.look.y = 0; }
    else { const k = 1 - Math.exp(-delta / 700); this.look.x += (tx - this.look.x) * k; this.look.y += (ty - this.look.y) * k; }
    cam.setFollowOffset(Math.round(this.look.x), Math.round(this.look.y));
  }

  private updateRain(time: number, delta: number, raining: boolean, view: Phaser.Geom.Rectangle) {
    this.wet += ((raining ? 1 : 0) - this.wet) * Math.min(1, delta / 2500);
    if (this.wet > 0.01 && !this.puddles.length) {
      this.puddles = this.ground.puddles.map((p) => this.scene.add.image(p.x, p.y, p.key).setScale(1 / ART_RES).setDepth(0.25).setAlpha(0));
    }
    for (const p of this.puddles) p.setAlpha(this.wet * 0.95).setVisible(this.wet > 0.01);
    const g = this.rippleG;
    g.clear();
    if (raining) {
      const inView = this.puddles.filter((p) => view.contains(p.x, p.y));
      for (let n = delta * 0.03; n > 0; n--) {
        if (n < 1 && Math.random() > n) break;
        const p = inView.length && Math.random() < 0.6 ? inView[Math.floor(Math.random() * inView.length)] : null;
        this.ripples.push(p ? { x: p.x + (Math.random() - 0.5) * 22, y: p.y + (Math.random() - 0.5) * 6, t: time } : { x: view.x + Math.random() * view.width, y: view.y + Math.random() * view.height, t: time });
      }
    }
    this.ripples = this.ripples.filter((r) => time - r.t < 520);
    for (const r of this.ripples) {
      const k = (time - r.t) / 520;
      g.lineStyle(1, 0xdcebf5, (1 - k) * 0.55).strokeEllipse(r.x, r.y, 2 + k * 9, 1 + k * 4);
    }
  }

  /** puts a pigeon down somewhere on a plaza, out of your way */
  private land(p: Pigeon, away?: { x: number; y: number }) {
    const spots = this.ground.plazaSpots;
    let spot = spots[Math.floor(Math.random() * spots.length)];
    for (let i = 0; away && i < 12 && Math.hypot(spot[0] - away.x, spot[1] - away.y) < 320; i++) spot = spots[Math.floor(Math.random() * spots.length)];
    const x = spot[0] + (Math.random() - 0.5) * 24, y = spot[1] + (Math.random() - 0.5) * 24;
    p.s.setPosition(x, y).setDepth(y + 4).setAlpha(1).setFrame(0).setFlipX(Math.random() < 0.5);
    p.state = 'peck'; p.t = 1000 + Math.random() * 3000;
  }

  private updatePigeons(time: number, delta: number, env: AmbientEnv, on: boolean) {
    const pl = env.player;
    this.pigeons.forEach((p, i) => {
      if (!on) { p.s.setVisible(false); if (p.state === 'fly') { p.state = 'gone'; p.t = 4000; } return; }
      if (p.state === 'gone') {
        p.s.setVisible(false);
        p.t -= delta;
        if (p.t <= 0) this.land(p, pl);
        return;
      }
      p.s.setVisible(true);
      if (p.state === 'peck') {
        const dx = p.s.x - pl.x, dy = p.s.y - (pl.y + 10), d = Math.hypot(dx, dy);
        if (d < 56) {
          // startled: off and away from you, climbing
          p.state = 'fly'; p.t = 1600;
          p.vx = (dx / (d || 1)) * 110 + (Math.random() - 0.5) * 30; p.vy = (dy / (d || 1)) * 50 - 80;
          p.s.setFlipX(p.vx < 0).setDepth(150_300);
          return;
        }
        p.s.setFrame((time + i * 377) % 1500 < 230 ? 1 : 0);
        p.t -= delta;
        if (p.t <= 0) {
          p.t = 900 + Math.random() * 2600;
          if (Math.random() < 0.5) p.s.setFlipX(!p.s.flipX);
          else { const nx = p.s.x + (p.s.flipX ? -4 : 4); p.s.setX(nx); }
        }
        return;
      }
      p.t -= delta;
      p.s.x += (p.vx * delta) / 1000; p.s.y += (p.vy * delta) / 1000;
      p.vy -= (20 * delta) / 1000;
      p.s.setFrame(Math.floor(time / 70) % 2 ? 2 : 0).setAlpha(Math.min(1, p.t / 600));
      if (p.t <= 0) { p.state = 'gone'; p.t = 12_000 + Math.random() * 18_000; }
    });
  }

  private updateGulls(time: number, delta: number, on: boolean, view: Phaser.Geom.Rectangle) {
    if (on) this.nextFlock -= delta;
    if (this.nextFlock <= 0) {
      this.nextFlock = 16_000 + Math.random() * 26_000;
      const fromLeft = Math.random() < 0.5, n = 2 + Math.floor(Math.random() * 4);
      const vx = (fromLeft ? 1 : -1) * (42 + Math.random() * 18), vy = (Math.random() - 0.5) * 16;
      const y0 = view.y + view.height * (0.1 + Math.random() * 0.55);
      for (let i = 0; i < n; i++) {
        const x = fromLeft ? view.x - 30 - i * 22 : view.right + 30 + i * 22, y = y0 + (i % 2 ? 14 : -10) * Math.ceil(i / 2);
        const s = this.scene.add.sprite(x, y, 'gull', 0).setScale(1 / ART_RES).setDepth(150_400).setFlipX(!fromLeft);
        const shadow = this.scene.add.ellipse(x + 30, y + 74, 9, 3, 0x000000, 0.13).setDepth(2);
        this.gulls.push({ s, shadow, vx, vy, phase: Math.random() * 1000 });
      }
    }
    this.gulls = this.gulls.filter((g) => {
      g.s.x += (g.vx * delta) / 1000;
      g.s.y += (g.vy * delta) / 1000 + Math.sin((time + g.phase) / 600) * 0.15;
      // flap for a while, then glide
      g.s.setFrame((time + g.phase) % 2400 < 1500 && Math.floor((time + g.phase) / 160) % 2 ? 1 : 0);
      g.shadow.setPosition(g.s.x + 30, g.s.y + 74).setVisible(on);
      g.s.setVisible(on);
      const gone = g.s.x < view.x - 160 || g.s.x > view.right + 160 || g.s.y < view.y - 160 || g.s.y > view.bottom + 160;
      if (gone) { g.s.destroy(); g.shadow.destroy(); }
      return !gone;
    });
  }
}

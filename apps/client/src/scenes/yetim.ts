// Yetim, the cat who lives on the Merkez Meydan in front of the Eğitim Binası: wanders between the pyramid,
// the bust and the flag, naps in the sun, sleeps by the steps at night and in the rain, keeps its distance from
// strangers and comes to say hello to the kids it knows.
import Phaser from 'phaser';
import { CAT_FRAMES, CAT_H, CAT_KEY, makeCatTexture } from '../art/cat';
import { CHAR_RES } from '../art/character';
import { BUST, FLAGPOLE, FLOWERS, LAMPS, PYRAMID, TILE, TREES } from '../content/campus';
import { BODY_FONT } from '../ui/fonts';

/** where the cat may go (tiles): the Merkez Meydan, a little in from its edges */
const AREA = { x0: 41.4, y0: 25.4, x1: 53.6, y1: 36.6 }; // (off the tunnel stairwell, the road and the south steps)
/** curled up by the steps up to the Eğitim corridor, out of the way, at night and when it rains */
const BED = { x: 41.75, y: 28.6 };
const WALK = 26, TROT = 70;

type Mode = 'sit' | 'walk' | 'nap' | 'sleep' | 'purr' | 'greet' | 'follow' | 'flee' | 'zoom';

export interface CatEnv {
  player: Phaser.Physics.Arcade.Sprite;
  inside: boolean;
  dark: number;
  rain: boolean;
  /** how well the cat knows you, 0–100 */
  bond: number;
  /** you're busy with the cat (its card is open): it stays put */
  engaged: boolean;
}

export class YetimCat {
  readonly sprite: Phaser.GameObjects.Sprite;
  private label: Phaser.GameObjects.Text;
  private mode: Mode = 'sit';
  private until = 0;
  private target = { x: 0, y: 0 };
  private followUntil = 0;
  private zoomLeft = 0;
  private obstacles: Array<{ x: number; y: number; r: number }>;

  constructor(private scene: Phaser.Scene) {
    makeCatTexture(scene);
    this.obstacles = [
      { x: PYRAMID.x, y: PYRAMID.y, r: PYRAMID.w * 0.8 },
      { x: BUST[0], y: BUST[1], r: 1.1 },
      { x: FLAGPOLE[0], y: FLAGPOLE[1], r: 0.7 },
      ...LAMPS.map(([x, y]) => ({ x, y, r: 0.5 })),
      ...TREES.map(([x, y]) => ({ x: x + 0.5, y: y + 0.75, r: 0.6 })),
      ...FLOWERS.map(([x, y]) => ({ x: x + 0.5, y: y + 0.4, r: 0.9 })),
    ].map((o) => ({ x: o.x * TILE, y: o.y * TILE, r: o.r * TILE }));
    const start = this.pick();
    this.sprite = scene.add.sprite(start.x, start.y, CAT_KEY, CAT_FRAMES.sit).setOrigin(0.5, 17 / CAT_H).setScale(1 / CHAR_RES);
    this.label = scene.add.text(0, 0, 'Yetim', {
      fontFamily: BODY_FONT, fontSize: '11px', fontStyle: 'bold', color: '#ffe7a8', stroke: '#1d2326', strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(95_000).setVisible(false);
    this.sit(2000);
  }

  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }

  /** close enough to pet */
  near(p: { x: number; y: number }) {
    return this.sprite.visible && Phaser.Math.Distance.Between(this.x, this.y, p.x, p.y + 10) < 1.5 * TILE;
  }

  /** after a pat: purr for a bit; a cat that knows you then tags along */
  purr(follow: boolean) {
    this.mode = 'purr';
    this.until = this.scene.time.now + 2600;
    if (follow) this.followUntil = this.scene.time.now + 30_000;
  }

  /** after playing: a mad dash round the plaza */
  zoomies() {
    this.zoomLeft = 4;
    this.go(this.pick(), 'zoom');
  }

  /** startled: hops away from you */
  startle(from: { x: number; y: number }) {
    const a = Math.atan2(this.y - from.y, this.x - from.x);
    this.go(this.clampToArea({ x: this.x + Math.cos(a) * 3 * TILE, y: this.y + Math.sin(a) * 3 * TILE }), 'flee');
  }

  update(time: number, delta: number, env: CatEnv) {
    const s = this.sprite;
    s.setVisible(!env.inside);
    if (env.inside) { this.label.setVisible(false); return; }
    const p = env.player;
    const pd = Phaser.Math.Distance.Between(this.x, this.y, p.x, p.y + 10);
    const night = env.dark > 0.55 || env.rain;
    const playerMoving = (p.body as Phaser.Physics.Arcade.Body | null)?.velocity.length() ?? 0;

    if (env.engaged) {
      if (this.mode !== 'purr') { this.mode = 'sit'; this.until = time + 1500; }
      this.face(p.x);
    } else if (night && this.mode !== 'sleep') {
      // off to bed by the steps
      if (Phaser.Math.Distance.Between(this.x, this.y, BED.x * TILE, BED.y * TILE) < 6) { this.mode = 'sleep'; }
      else if (this.mode !== 'walk' || this.target.x !== BED.x * TILE) this.go({ x: BED.x * TILE, y: BED.y * TILE }, 'walk');
    } else if (!night && this.mode === 'sleep') {
      this.sit(1500);
    } else if (this.mode !== 'flee' && this.mode !== 'zoom' && this.mode !== 'purr') {
      // a stranger running up makes it bolt; a friend gets a greeting
      if (pd < 1.6 * TILE && playerMoving > 140 && env.bond < 25 && this.mode !== 'sleep') this.startle(p);
      else if (time < this.followUntil && this.inArea(p.x, p.y)) {
        if (pd > 1.4 * TILE) this.go(this.clampToArea({ x: p.x + (this.x < p.x ? -18 : 18), y: p.y + 8 }), 'follow');
        else if (this.mode === 'follow') this.sit(1200);
      } else if (env.bond >= 40 && pd < 4.5 * TILE && pd > 1.3 * TILE && playerMoving < 10 && this.inArea(p.x, p.y) && this.mode !== 'greet' && this.mode !== 'nap' && this.mode !== 'sleep' && Math.random() < delta / 4000) {
        this.go(this.clampToArea({ x: p.x + (this.x < p.x ? -20 : 20), y: p.y + 8 }), 'greet');
      } else if (pd < 2.2 * TILE && (this.mode === 'sit' || this.mode === 'nap')) {
        // you're close: it sits up and watches you
        if (this.mode === 'nap') this.mode = 'sit';
        this.until = Math.max(this.until, time + 800);
        this.face(p.x);
      }
    }

    switch (this.mode) {
      case 'walk': case 'greet': case 'follow': case 'flee': case 'zoom': {
        const speed = this.mode === 'flee' || this.mode === 'zoom' ? TROT : this.mode === 'follow' || this.mode === 'greet' ? WALK * 1.6 : WALK;
        const dx = this.target.x - this.x, dy = this.target.y - this.y, d = Math.hypot(dx, dy);
        const step = (speed * delta) / 1000;
        if (d <= step) {
          s.setPosition(this.target.x, this.target.y);
          if (this.mode === 'zoom' && --this.zoomLeft > 0) { this.go(this.pick(), 'zoom'); break; }
          if (night && Math.hypot(this.x - BED.x * TILE, this.y - BED.y * TILE) < 6) { this.mode = 'sleep'; break; }
          if (this.mode === 'greet' || this.mode === 'follow') this.face(p.x);
          this.sit(this.mode === 'flee' ? 2500 : 2500 + Math.random() * 4000);
        } else {
          let nx = this.x + (dx / d) * step, ny = this.y + (dy / d) * step;
          // slide round the pyramid, the bust and the lamp posts instead of walking through them
          for (const o of this.obstacles) {
            const od = Math.hypot(nx - o.x, ny - o.y);
            if (od < o.r) { const a = Math.atan2(ny - o.y, nx - o.x); nx = o.x + Math.cos(a) * o.r; ny = o.y + Math.sin(a) * o.r; }
          }
          s.setPosition(nx, ny);
          s.setFlipX(dx < 0);
          const fr = CAT_FRAMES.walk;
          s.setFrame([fr[0], fr[1], fr[2], fr[1]][Math.floor(time / (speed > WALK * 1.5 ? 90 : 150)) % 4]);
        }
        break;
      }
      case 'purr':
        s.setFrame(CAT_FRAMES.purr);
        if (time > this.until) this.sit(1500);
        break;
      case 'sleep':
        s.setFrame(CAT_FRAMES.sleep);
        break;
      case 'nap':
        s.setFrame(CAT_FRAMES.sleep);
        if (time > this.until) this.sit(1200);
        break;
      default: // sit: blinks now and then, then naps or wanders off
        s.setFrame((time % 3800) < 180 ? CAT_FRAMES.purr : CAT_FRAMES.sit);
        if (time > this.until) {
          if (Math.random() < 0.18) { this.mode = 'nap'; this.until = time + 8000 + Math.random() * 10_000; }
          else this.go(this.pick(), 'walk');
        }
    }
    s.setDepth(this.y + 2);
    const showName = pd < 3 * TILE;
    this.label.setVisible(showName);
    if (showName) this.label.setText(env.bond >= 60 ? 'Yetim ♥' : 'Yetim').setPosition(Math.round(this.x), Math.round(this.y - 20));
  }

  private sit(ms: number) { this.mode = 'sit'; this.until = this.scene.time.now + ms; }
  private face(x: number) { if (Math.abs(x - this.x) > 4) this.sprite.setFlipX(x < this.x); }
  private go(t: { x: number; y: number }, mode: Mode) { this.target = t; this.mode = mode; }

  private inArea(x: number, y: number) {
    return x >= AREA.x0 * TILE - 16 && x <= AREA.x1 * TILE + 16 && y >= AREA.y0 * TILE - 16 && y <= AREA.y1 * TILE + 16;
  }
  private clampToArea(t: { x: number; y: number }) {
    let x = Phaser.Math.Clamp(t.x, AREA.x0 * TILE, AREA.x1 * TILE), y = Phaser.Math.Clamp(t.y, AREA.y0 * TILE, AREA.y1 * TILE);
    for (const o of this.obstacles) {
      const d = Math.hypot(x - o.x, y - o.y);
      if (d < o.r) { const a = Math.atan2(y - o.y, x - o.x); x = o.x + Math.cos(a) * (o.r + 2); y = o.y + Math.sin(a) * (o.r + 2); }
    }
    return { x, y };
  }
  private blocked(x: number, y: number) { return this.obstacles.some((o) => Math.hypot(x - o.x, y - o.y) < o.r); }
  /** a free spot on the plaza that can be reached in a straight line */
  private pick() {
    const sx = this.sprite?.x, sy = this.sprite?.y;
    let best = { x: (AREA.x0 + 1) * TILE, y: (AREA.y0 + 1) * TILE };
    for (let i = 0; i < 24; i++) {
      const x = Phaser.Math.FloatBetween(AREA.x0, AREA.x1) * TILE, y = Phaser.Math.FloatBetween(AREA.y0, AREA.y1) * TILE;
      if (this.blocked(x, y)) continue;
      best = { x, y };
      if (sx === undefined) break;
      let clear = true;
      for (let k = 1; k < 12 && clear; k++) clear = !this.blocked(sx + ((x - sx) * k) / 12, sy + ((y - sy) * k) / 12);
      if (clear && Math.hypot(x - sx, y - sy) > 2 * TILE) break;
    }
    return best;
  }
}

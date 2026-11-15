// Yetim, the campus cat: a grey tabby (tekir) with a white chest and white socks, drawn in the same shaded
// style as the characters. Frames face right (flip the sprite for left):
// 0 sitting (looking at you), 1 sitting with eyes shut (purring), 2–4 walking, 5 asleep, curled up.
import Phaser from 'phaser';
import { CHAR_RES, addOutline, mix } from './character';

export const CAT_KEY = 'cat';
/** one frame, in world pixels */
export const CAT_W = 24, CAT_H = 18;
export const CAT_FRAMES = { sit: 0, purr: 1, walk: [2, 3, 4], sleep: 5 } as const;

const FUR = '#9a8f84', STRIPE = '#4b423b', WHITE = '#f4f0e8', PINK = '#e3999a', EYE = '#c3cb4f';
const dk = (c: string, t: number) => mix(c, '#140c12', t);
const lt = (c: string, t: number) => mix(c, '#fff8ec', t);

function drawCat(c: CanvasRenderingContext2D, frame: number) {
  const P = () => new Path2D();
  const el = (x: number, y: number, rx: number, ry: number, rot = 0) => { const p = P(); p.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); return p; };
  const rr = (x: number, y: number, w: number, h: number, r: number) => { const p = P(); p.roundRect(x, y, w, h, r); return p; };
  const fill = (p: Path2D, s: string | CanvasGradient) => { c.fillStyle = s; c.fill(p); };
  const stroke = (p: Path2D, s: string, w: number) => { c.strokeStyle = s; c.lineWidth = w; c.stroke(p); };
  const fur = (p: Path2D, base: string, x0: number, y0: number, x1: number, y1: number) => {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, lt(base, 0.2)); g.addColorStop(0.5, base); g.addColorStop(1, dk(base, 0.3));
    fill(p, g);
  };
  const clip = (p: Path2D, fn: () => void) => { c.save(); c.clip(p); fn(); c.restore(); };
  const curve = (pts: number[], s: string, w: number) => { const p = P(); p.moveTo(pts[0], pts[1]); p.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]); stroke(p, s, w); };
  const stripes = (p: Path2D, list: number[][], w = 0.65) => clip(p, () => { for (const s of list) curve(s, 'rgba(60,50,44,0.75)', w); });
  const tail = (pts: number[], w = 1.5) => {
    const p = P(); p.moveTo(pts[0], pts[1]); p.bezierCurveTo(pts[2], pts[3], pts[4], pts[5], pts[6], pts[7]);
    stroke(p, FUR, w);
    c.setLineDash([0.75, 0.85]); stroke(p, 'rgba(60,50,44,0.8)', w); c.setLineDash([]);
    fill(el(pts[6], pts[7], w * 0.55, w * 0.55), STRIPE);
  };
  const whiskers = (x: number, y: number, dir: number) => {
    for (const dy of [-0.35, 0.25, 0.8]) curve([x, y + dy * 0.4, x + dir * 1.3, y + dy * 0.7, x + dir * 2.6, y + dy], 'rgba(255,255,255,0.75)', 0.12);
  };
  c.lineCap = 'round'; c.lineJoin = 'round';
  // shadow
  c.save(); c.translate(12, 17.1); c.scale(1, 0.18);
  const sg = c.createRadialGradient(0, 0, 0, 0, 0, 7.5); sg.addColorStop(0, 'rgba(10,14,12,0.32)'); sg.addColorStop(1, 'rgba(10,14,12,0)');
  fill(el(0, 0, 7.5, 7.5), sg);
  c.restore();

  if (frame === CAT_FRAMES.sit || frame === CAT_FRAMES.purr) {
    tail([6.4, 15.8, 6.8, 17.6, 11, 17.4, 15.6, 16.7]);
    const haunch = el(9.6, 13.4, 4.4, 3.6);
    fur(haunch, FUR, 6, 10, 13, 17);
    stripes(haunch, [[7, 10, 6.4, 13, 7.4, 16], [9, 9.8, 8.6, 13, 9.4, 16.4], [11, 10, 10.8, 13, 11.6, 16]]);
    fill(el(11.6, 16.6, 1.4, 0.6), WHITE);
    const chest = el(12.8, 10.8, 3.0, 4.3);
    fur(chest, FUR, 10, 7, 16, 15);
    fill(el(13.8, 11.4, 1.7, 3.1), WHITE);
    fur(rr(14.2, 11.8, 1.5, 5.1, 0.7), dk(FUR, 0.2), 14, 12, 16, 17);
    fur(rr(12.5, 11.8, 1.5, 5.2, 0.7), lt(FUR, 0.1), 12, 12, 14, 17);
    fill(el(13.25, 16.7, 0.95, 0.55), WHITE); fill(el(14.95, 16.6, 0.9, 0.5), mix(WHITE, FUR, 0.15));
    // head, turned towards you
    const ears = [[11.1, 4.6, 11.4, 1.3, 13.2, 3.4], [14.4, 3.4, 16.2, 1.3, 16.5, 4.6]];
    for (const [a, b, x, y, e, f] of ears) {
      const p = P(); p.moveTo(a, b); p.lineTo(x, y); p.lineTo(e, f); p.closePath(); fur(p, FUR, a, y, e, b);
      const q = P(); q.moveTo(a + (x - a) * 0.3 + 0.3, b - 0.4); q.lineTo(x + (x < 13 ? 0.35 : -0.35), y + 1.0); q.lineTo(e - (e - x) * 0.3 - 0.3, f - 0.4); q.closePath(); fill(q, PINK);
    }
    const head = el(13.8, 5.6, 3.3, 2.9);
    fur(head, FUR, 11, 3, 17, 8.5);
    stripes(head, [[12.6, 2.9, 12.9, 3.6, 13.1, 4.4], [13.8, 2.7, 13.8, 3.6, 13.8, 4.4], [15.0, 2.9, 14.7, 3.6, 14.5, 4.4], [10.7, 5.4, 11.4, 5.6, 11.9, 6.0], [16.9, 5.4, 16.2, 5.6, 15.7, 6.0]], 0.45);
    fill(el(13.8, 7.0, 1.7, 1.15), WHITE);
    for (const ex of [12.55, 15.05]) {
      if (frame === CAT_FRAMES.purr) { curve([ex - 0.7, 5.3, ex, 5.9, ex + 0.7, 5.3], '#2a2420', 0.3); continue; }
      fill(el(ex, 5.35, 0.78, 0.62), EYE);
      fill(el(ex, 5.35, 0.2, 0.55), '#0b0908');
      fill(el(ex - 0.25, 5.1, 0.14, 0.14), '#ffffff');
      curve([ex - 0.8, 5.25, ex, 4.6, ex + 0.8, 5.25], '#2a2420', 0.22);
    }
    const nose = P(); nose.moveTo(13.35, 6.35); nose.lineTo(14.25, 6.35); nose.lineTo(13.8, 6.95); nose.closePath(); fill(nose, PINK);
    curve([13.8, 6.95, 13.5, 7.55, 13.1, 7.35], 'rgba(70,50,50,0.7)', 0.16); curve([13.8, 6.95, 14.1, 7.55, 14.5, 7.35], 'rgba(70,50,50,0.7)', 0.16);
    whiskers(12.6, 7.0, -1); whiskers(15.0, 7.0, 1);
    return;
  }

  if (frame === CAT_FRAMES.sleep) {
    tail([6.0, 14.6, 6.4, 17.4, 10.5, 17.4, 15.4, 16.6]);
    const loaf = el(11.8, 13.8, 6.2, 3.2);
    fur(loaf, FUR, 6, 10.6, 18, 17);
    stripes(loaf, [[8, 10.7, 7.4, 13.4, 8.2, 16.8], [10.2, 10.6, 9.8, 13.4, 10.4, 17], [12.4, 10.6, 12.2, 13.4, 12.8, 17], [14.6, 10.8, 14.6, 13.4, 15.2, 16.6]]);
    fill(el(15.4, 16.1, 1.2, 0.6), WHITE);
    for (const [a, b, x, y, e, f] of [[15.3, 11.8, 15.7, 9.8, 16.9, 11.2], [17.0, 11.1, 18.3, 9.7, 18.9, 11.6]]) {
      const p = P(); p.moveTo(a, b); p.lineTo(x, y); p.lineTo(e, f); p.closePath(); fur(p, FUR, a, y, e, b);
    }
    const head = el(17.0, 13.0, 2.8, 2.3);
    fur(head, FUR, 14.5, 10.8, 19.5, 15.3);
    fill(el(18.4, 14.0, 1.3, 0.9), WHITE);
    curve([16.9, 12.6, 17.5, 13.15, 18.2, 12.75], '#2a2420', 0.28);
    fill(el(19.45, 13.6, 0.32, 0.24), PINK);
    return;
  }

  // walking, side view: the legs swing in diagonal pairs
  const ph = frame === CAT_FRAMES.walk[0] ? 1 : frame === CAT_FRAMES.walk[2] ? -1 : 0;
  const leg = (x: number, y: number, a: number, far: boolean, thigh: boolean) => {
    c.save(); c.translate(x, y); c.rotate(a);
    const col = far ? dk(FUR, 0.25) : FUR;
    if (thigh) fur(el(0.2, 0.6, 2.2, 2.7), col, -2, -2, 2, 3);
    fur(rr(-0.8, 0, 1.6, 5.8, 0.75), col, -1, 0, 1, 6);
    fill(el(0.15, 5.8, 1.0, 0.55), far ? mix(WHITE, FUR, 0.3) : WHITE);
    c.restore();
  };
  leg(15.0, 11.0, -ph * 0.35, true, false);
  leg(7.8, 11.2, ph * 0.35, true, true);
  tail([5.3, 9.6, 2.0 + ph * 0.3, 9.4, 1.2 - ph * 0.4, 6.0, 2.4 - ph * 0.3, 3.6]);
  const body = P(); body.addPath(el(11.2, 10.6, 6.4, 3.3)); body.addPath(el(15.6, 9.7, 2.6, 2.9));
  fur(body, FUR, 6, 7, 16, 14);
  clip(body, () => fill(el(11.8, 13.6, 5.2, 1.7), WHITE));
  stripes(body, [[7.0, 7.3, 6.4, 9.6, 6.8, 12.4], [9.0, 7.2, 8.4, 9.6, 8.8, 12.6], [11.0, 7.2, 10.6, 9.6, 11.0, 12.6], [13.0, 7.3, 12.8, 9.4, 13.4, 12]]);
  fill(el(17.0, 10.4, 1.5, 1.9), WHITE);
  leg(16.2, 11.2, ph * 0.35, false, false);
  leg(7.0, 11.4, -ph * 0.35, false, true);
  // head, in profile
  for (const [a, b, x, y, e, f, far] of [[16.9, 4.6, 17.3, 1.7, 18.7, 4.0, 1], [18.7, 4.0, 20.0, 1.6, 20.9, 4.4, 0]]) {
    const p = P(); p.moveTo(a, b); p.lineTo(x, y); p.lineTo(e, f); p.closePath(); fur(p, far ? dk(FUR, 0.2) : FUR, a, y, e, b);
    if (!far) { const q = P(); q.moveTo(19.2, 3.9); q.lineTo(20.0, 2.6); q.lineTo(20.4, 4.1); q.closePath(); fill(q, PINK); }
  }
  const head = el(18.7, 6.7 + Math.abs(ph) * 0.15, 3.2, 2.8);
  fur(head, FUR, 16, 4, 21.5, 9.5);
  stripes(head, [[17.4, 4.1, 17.7, 4.8, 17.8, 5.5], [18.6, 3.9, 18.7, 4.7, 18.8, 5.4], [16.0, 6.3, 16.8, 6.5, 17.4, 6.9]], 0.45);
  fill(el(20.6, 8.0, 1.6, 1.15), WHITE);
  fill(el(19.95, 6.2, 0.72, 0.55), EYE);
  fill(el(20.1, 6.2, 0.18, 0.5), '#0b0908');
  fill(el(19.75, 6.0, 0.13, 0.13), '#ffffff');
  curve([19.2, 6.1, 19.9, 5.5, 20.7, 6.0], '#2a2420', 0.22);
  const nose = P(); nose.moveTo(21.55, 7.0); nose.lineTo(22.05, 7.25); nose.lineTo(21.6, 7.65); nose.closePath(); fill(nose, PINK);
  curve([21.6, 7.65, 21.3, 8.25, 20.8, 8.15], 'rgba(70,50,50,0.7)', 0.16);
  whiskers(21.2, 7.9, 1);
}

/** the cat's spritesheet: 6 frames in a row, drawn CHAR_RES times finer than the world */
export function makeCatTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(CAT_KEY)) return;
  const W = CAT_W * CHAR_RES, H = CAT_H * CHAR_RES, N = 6;
  const tex = scene.textures.createCanvas(CAT_KEY, W * N, H)!;
  const ctx = tex.getContext();
  const tmp = document.createElement('canvas');
  tmp.width = W; tmp.height = H;
  const t = tmp.getContext('2d', { willReadFrequently: true })!;
  for (let f = 0; f < N; f++) {
    t.setTransform(1, 0, 0, 1, 0, 0);
    t.clearRect(0, 0, W, H);
    t.setTransform(CHAR_RES, 0, 0, CHAR_RES, 0, 0);
    drawCat(t, f);
    addOutline(t, W, H, 1.2);
    ctx.drawImage(tmp, f * W, 0);
  }
  tex.refresh();
  tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
  for (let f = 0; f < N; f++) tex.add(f, 0, f * W, 0, W, H);
}

/** paints one frame into a canvas of any size (the cat's card) */
export function paintCat(cv: HTMLCanvasElement, frame: number) {
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  const s = Math.min(cv.width / CAT_W, cv.height / CAT_H);
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, cv.width, cv.height);
  c.setTransform(s, 0, 0, s, (cv.width - CAT_W * s) / 2, (cv.height - CAT_H * s) / 2);
  drawCat(c, frame);
  c.setTransform(1, 0, 0, 1, 0, 0);
  addOutline(c, cv.width, cv.height, Math.max(1, s * 0.25));
}

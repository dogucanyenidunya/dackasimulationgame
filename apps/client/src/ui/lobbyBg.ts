// The lobby's backdrop: Istanbul at golden hour, in a warm neon-sunset palette (purple sky melting into pink and
// orange) — a nod to the mood of modern open-world trailers, drawn entirely our own way. A skyline of domes and
// minarets and a tower, a lit Bosphorus bridge whose lights run in colour, a ferry crossing, seagulls, umbrella pines.
// One canvas behind the lobby card; it sleeps with the tab and stands still for people who prefer less motion.

/** a small steady random generator, so the skyline is the same every time */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

interface Scene {
  w: number; h: number; horizon: number;
  hills: Path2D; skyline: Path2D; pines: Path2D;
  windows: Array<{ x: number; y: number; ph: number }>;
  stars: Array<{ x: number; y: number; r: number; ph: number }>;
  clouds: Array<{ x: number; y: number; w: number; h: number; v: number }>;
  bridge: { x1: number; x2: number; deck: number; top: number; left: number; right: number };
}

function build(w: number, h: number): Scene {
  const r = rng(1923);
  const horizon = Math.round(h * 0.64);
  // far hills on the Asian side
  const hills = new Path2D();
  hills.moveTo(0, horizon);
  for (let x = 0; x <= w; x += 8) hills.lineTo(x, horizon - 18 - 14 * Math.sin(x / 140) - 8 * Math.sin(x / 47 + 1));
  hills.lineTo(w, horizon); hills.closePath();

  // the old city: a low ridge with domes, minarets, a tower and houses
  const skyline = new Path2D();
  const windows: Scene['windows'] = [];
  const ridge = (x: number) => horizon - 10 - 10 * Math.sin(x / 210 + 0.6);
  skyline.moveTo(w * 0.5, horizon);
  for (let x = w * 0.5; x <= w; x += 6) skyline.lineTo(x, ridge(x));
  skyline.lineTo(w, horizon); skyline.closePath();
  const scale = Math.max(0.7, Math.min(1.4, w / 1200));
  const mosque = (cx: number, size: number, minarets: number) => {
    const base = ridge(cx);
    const dome = 26 * size * scale;
    skyline.rect(cx - dome * 1.5, base - dome * 0.9, dome * 3, dome * 0.9);
    skyline.moveTo(cx + dome, base - dome * 0.9);
    skyline.arc(cx, base - dome * 0.9, dome, 0, Math.PI, true);
    for (const side of [-1, 1]) {
      const sx = cx + side * dome * 1.15;
      skyline.moveTo(sx + dome * 0.55, base - dome * 0.9);
      skyline.arc(sx, base - dome * 0.9, dome * 0.55, 0, Math.PI, true);
    }
    skyline.rect(cx - 1.5 * scale, base - dome * 2.1, 3 * scale, dome * 0.3); // the finial
    const spread = dome * 2.1;
    for (let i = 0; i < minarets; i++) {
      const mx = cx + (i % 2 ? 1 : -1) * spread * (i < 2 ? 1 : 1.35);
      const mh = dome * (i < 2 ? 3.1 : 2.6);
      const mw = 4 * scale;
      skyline.rect(mx - mw / 2, base - mh, mw, mh);
      skyline.rect(mx - mw * 0.9, base - mh * 0.72, mw * 1.8, 2 * scale); // balcony
      skyline.moveTo(mx - mw / 2, base - mh);
      skyline.lineTo(mx, base - mh - 12 * scale);
      skyline.lineTo(mx + mw / 2, base - mh);
    }
  };
  const tower = (cx: number) => {
    const base = ridge(cx), tw = 14 * scale, th = 70 * scale;
    skyline.rect(cx - tw / 2, base - th, tw, th);
    skyline.moveTo(cx - tw * 0.7, base - th);
    skyline.lineTo(cx, base - th - 26 * scale);
    skyline.lineTo(cx + tw * 0.7, base - th);
    for (let i = 0; i < 3; i++) windows.push({ x: cx - tw / 4 + (i % 2) * tw / 2, y: base - th + 10 * scale + i * 12 * scale, ph: r() * 6 });
  };
  // houses packed along the ridge, with lit windows
  for (let x = w * 0.5; x < w; x += (10 + r() * 16) * scale) {
    const bw = (10 + r() * 18) * scale, bh = (8 + r() * 22) * scale, base = ridge(x);
    skyline.rect(x, base - bh, bw, bh + 2);
    if (r() < 0.55) windows.push({ x: x + bw * (0.2 + r() * 0.6), y: base - bh * (0.3 + r() * 0.5), ph: r() * 6 });
  }
  mosque(w * 0.6, 1.15, 4);
  mosque(w * 0.83, 0.85, 2);
  tower(w * 0.72);
  mosque(w * 0.95, 0.6, 2);

  // the bridge across the strait, on the left
  const bridge = { x1: w * 0.12, x2: w * 0.4, deck: horizon - 14 * scale, top: horizon - 120 * scale, left: -w * 0.02, right: w * 0.5 };

  // umbrella pines in the near corners
  const pines = new Path2D();
  const pine = (x: number, y: number, s: number) => {
    pines.moveTo(x - 3 * s, y);
    pines.lineTo(x - 1.5 * s, y - 60 * s); pines.lineTo(x + 1.5 * s, y - 60 * s); pines.lineTo(x + 3 * s, y); pines.closePath();
    for (let i = 0; i < 9; i++) {
      const a = (i / 8) * Math.PI, rx = 30 * s * (0.55 + r() * 0.5), ry = 11 * s * (0.7 + r() * 0.4);
      pines.ellipse(x + Math.cos(a) * 34 * s, y - 62 * s - Math.sin(a) * 10 * s + r() * 6 * s, rx, ry, 0, 0, Math.PI * 2);
    }
  };
  const ps = Math.max(0.9, Math.min(1.8, w / 900));
  pine(w * 0.04, h + 4, ps * 1.25); pine(w * 0.17, h + 14, ps * 0.95);
  pine(w * 0.97, h + 6, ps * 1.15); pine(w * 0.86, h + 18, ps * 0.85);
  pines.rect(0, h - 10, w, 12);

  const stars = Array.from({ length: 70 }, () => ({ x: r() * w, y: r() * horizon * 0.45, r: 0.4 + r() * 1.1, ph: r() * 6 }));
  const clouds = Array.from({ length: 6 }, (_, i) => ({ x: r() * w, y: horizon * (0.22 + i * 0.09), w: (160 + r() * 260) * scale, h: (5 + r() * 9) * scale, v: 4 + r() * 8 }));
  return { w, h, horizon, hills, skyline, pines, windows, stars, clouds, bridge };
}

function draw(c: CanvasRenderingContext2D, s: Scene, t: number) {
  const { w, h, horizon } = s;
  const sec = t / 1000;
  // sky
  const sky = c.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#1b0a36'); sky.addColorStop(0.28, '#46125f'); sky.addColorStop(0.55, '#9c2370');
  sky.addColorStop(0.74, '#e8486f'); sky.addColorStop(0.9, '#ff8a4a'); sky.addColorStop(1, '#ffc56a');
  c.fillStyle = sky; c.fillRect(0, 0, w, horizon);
  for (const st of s.stars) { c.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(sec * 1.3 + st.ph)); c.fillStyle = '#fff'; c.beginPath(); c.arc(st.x, st.y, st.r, 0, Math.PI * 2); c.fill(); }
  c.globalAlpha = 1;
  // the sun, low over the old city
  // (on narrower screens further right, so the card doesn't cover it)
  const sx = w * (w < 1000 ? 0.84 : 0.7), sr = Math.min(w, h) * 0.11, sy = horizon - sr * 0.45;
  const halo = c.createRadialGradient(sx, sy, sr * 0.6, sx, sy, sr * 4.5);
  halo.addColorStop(0, 'rgba(255, 210, 120, 0.55)'); halo.addColorStop(1, 'rgba(255, 120, 90, 0)');
  c.fillStyle = halo; c.fillRect(0, 0, w, horizon);
  const disc = c.createLinearGradient(0, sy - sr, 0, sy + sr);
  disc.addColorStop(0, '#fff2c0'); disc.addColorStop(1, '#ff9a4d');
  c.fillStyle = disc; c.beginPath(); c.arc(sx, sy, sr, 0, Math.PI * 2); c.fill();
  // long pink clouds drifting
  for (const cl of s.clouds) {
    const x = ((cl.x + sec * cl.v) % (w + cl.w)) - cl.w;
    const g = c.createLinearGradient(x, 0, x + cl.w, 0);
    g.addColorStop(0, 'rgba(255, 150, 170, 0)'); g.addColorStop(0.5, 'rgba(255, 170, 160, 0.45)'); g.addColorStop(1, 'rgba(255, 150, 170, 0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(x + cl.w / 2, cl.y, cl.w / 2, cl.h, 0, 0, Math.PI * 2); c.fill();
  }
  // hills, then the city
  c.fillStyle = 'rgba(110, 32, 96, 0.85)'; c.fill(s.hills);
  c.fillStyle = '#2a0f3d'; c.fill(s.skyline);
  for (const wn of s.windows) { c.globalAlpha = 0.55 + 0.45 * Math.sin(sec * 0.7 + wn.ph); c.fillStyle = '#ffd27a'; c.fillRect(wn.x, wn.y, 2.2, 2.2); }
  c.globalAlpha = 1;
  drawBridge(c, s, sec);
  // the strait
  const sea = c.createLinearGradient(0, horizon, 0, h);
  sea.addColorStop(0, '#5b1b5e'); sea.addColorStop(0.35, '#2f0f45'); sea.addColorStop(1, '#12061f');
  c.fillStyle = sea; c.fillRect(0, horizon, w, h - horizon);
  // the sun's path on the water, shimmering
  for (let i = 0; i < 26; i++) {
    const y = horizon + 4 + i * i * 0.55 + i * 3;
    if (y > h) break;
    const half = sr * (1.1 - i * 0.03) * (0.6 + 0.4 * Math.sin(sec * 2 + i * 1.7));
    c.globalAlpha = Math.max(0, 0.7 - i * 0.026);
    c.fillStyle = i < 6 ? '#ffd38a' : '#ff9a5a';
    c.fillRect(sx - half + Math.sin(sec * 1.4 + i) * 6, y, half * 2, 2 + i * 0.12);
  }
  c.globalAlpha = 1;
  drawFerry(c, s, sec);
  drawGulls(c, s, sec);
  c.fillStyle = '#12061f'; c.fill(s.pines);
  // a soft vignette keeps the card readable
  const v = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(10, 4, 20, 0)'); v.addColorStop(1, 'rgba(10, 4, 20, 0.5)');
  c.fillStyle = v; c.fillRect(0, 0, w, h);
}

/** the suspension bridge: towers, cables, hangers, and a deck of lights running through the colours */
function drawBridge(c: CanvasRenderingContext2D, s: Scene, sec: number) {
  const b = s.bridge;
  c.strokeStyle = '#2a0f3d'; c.fillStyle = '#2a0f3d';
  c.fillRect(b.left, b.deck, b.right - b.left, 4);
  for (const x of [b.x1, b.x2]) { c.fillRect(x - 3, b.top, 6, b.deck - b.top + 16); c.fillRect(x - 6, b.top + 18, 12, 3); }
  // main cable: sags between the towers, falls to the banks on each side
  const cable = (x: number) => {
    if (x < b.x1) return b.top + ((b.x1 - x) / (b.x1 - b.left)) * (b.deck - b.top - 4);
    if (x > b.x2) return b.top + ((x - b.x2) / (b.right - b.x2)) * (b.deck - b.top - 4);
    const u = (x - b.x1) / (b.x2 - b.x1);
    return b.top + 4 * u * (1 - u) * (b.deck - b.top - 10) * 0.92;
  };
  c.lineWidth = 2; c.beginPath();
  for (let x = b.left; x <= b.right; x += 4) { if (x === b.left) c.moveTo(x, cable(x)); else c.lineTo(x, cable(x)); }
  c.stroke();
  c.lineWidth = 1; c.globalAlpha = 0.7;
  for (let x = b.left + 8; x < b.right; x += 9) { c.beginPath(); c.moveTo(x, cable(x)); c.lineTo(x, b.deck); c.stroke(); }
  c.globalAlpha = 1;
  // the lights: a slow wave of colour along the deck and up the cable
  for (let x = b.left + 4; x < b.right; x += 7) {
    const hue = (x * 0.4 + sec * 40) % 360;
    c.fillStyle = `hsl(${hue}, 90%, 65%)`;
    c.globalAlpha = 0.85; c.fillRect(x, b.deck - 1.5, 2.5, 2.5);
    c.globalAlpha = 0.6; c.fillRect(x, cable(x) - 1, 2, 2);
    // and their smear on the water
    c.globalAlpha = 0.18; c.fillRect(x, s.horizon + 6 + (x % 13), 2, 10 + (x % 7));
  }
  c.globalAlpha = 1;
}

/** a city ferry crossing the strait, windows lit */
function drawFerry(c: CanvasRenderingContext2D, s: Scene, sec: number) {
  const span = s.w + 260;
  const x = ((sec * 14) % span) - 130;
  const y = s.horizon + (s.h - s.horizon) * 0.32;
  const k = Math.max(0.8, Math.min(1.5, s.w / 1000));
  c.fillStyle = '#16081f';
  c.beginPath();
  c.moveTo(x - 60 * k, y); c.lineTo(x + 66 * k, y); c.lineTo(x + 56 * k, y + 9 * k); c.lineTo(x - 54 * k, y + 9 * k); c.closePath(); c.fill();
  c.fillRect(x - 42 * k, y - 12 * k, 80 * k, 12 * k);
  c.fillRect(x - 24 * k, y - 21 * k, 40 * k, 9 * k);
  c.fillRect(x + 2 * k, y - 32 * k, 7 * k, 12 * k); // funnel
  c.fillStyle = '#ffd27a';
  for (let i = 0; i < 9; i++) c.fillRect(x - 38 * k + i * 8.6 * k, y - 8 * k, 3.4 * k, 3 * k);
  c.globalAlpha = 0.25; c.fillRect(x - 40 * k, y + 11 * k, 80 * k, 2 * k); c.globalAlpha = 1;
}

/** a few seagulls gliding over the water */
function drawGulls(c: CanvasRenderingContext2D, s: Scene, sec: number) {
  c.strokeStyle = '#1c0a2c'; c.lineWidth = 1.6; c.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const span = s.w + 200;
    const x = ((sec * (18 + i * 5) + i * 300) % span) - 100;
    const y = s.horizon * (0.42 + 0.09 * i) + Math.sin(sec * 0.8 + i) * 10;
    const flap = Math.sin(sec * (5 + i) + i) * 4;
    const sz = 7 + (i % 3) * 2;
    c.beginPath();
    c.moveTo(x - sz, y - flap); c.quadraticCurveTo(x - sz / 2, y - sz / 2 - flap, x, y);
    c.quadraticCurveTo(x + sz / 2, y - sz / 2 - flap, x + sz, y - flap);
    c.stroke();
  }
}

/** puts the backdrop behind `host` (the lobby); returns a function that removes it */
export function mountLobbyBackdrop(host: HTMLElement): () => void {
  const cv = document.createElement('canvas');
  cv.className = 'lobby-bg';
  cv.setAttribute('aria-hidden', 'true');
  host.prepend(cv);
  const c = cv.getContext('2d')!;
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let scene: Scene | null = null, raf = 0, last = 0;
  const size = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth, h = window.innerHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    scene = build(w, h);
    draw(c, scene, performance.now());
  };
  const frame = (t: number) => {
    // about 30 frames a second is plenty for a backdrop
    if (scene && t - last > 33) { last = t; draw(c, scene, t); }
    raf = requestAnimationFrame(frame);
  };
  size();
  window.addEventListener('resize', size);
  if (!still) raf = requestAnimationFrame(frame);
  return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', size); cv.remove(); };
}

// HD-2D view: a real 3D campus (Three.js) with the pixel-art kids standing in it as flat sprites.
// The Phaser scene keeps running the whole game (movement, collisions, NPCs, rooms, rules); this
// class only draws. Static things (ground, buildings, trees, rooms) are built once from the same
// map data; moving things (people, items, labels) are mirrored from Phaser's display list each frame.
// 1 tile = 1 unit; Phaser x → three x, Phaser y → three z, height is three y.
import * as THREE from 'three';
import type Phaser from 'phaser';
import {
  BENCHES, BUILDINGS, BUST, COURTS, FLAGPOLE, FLOWERS, FOUNTAIN, GATE, LAMPS, MAP_H, MAP_W, T, TILE, TREES, type Building, type Rect,
} from '../content/campus';
import { ROOM_OX, ROOM_W, ROOM_H, ROOM_SOLID, RT, buildRoom } from '../content/dormroom';
import { CLASS_OX, CLASS_W, CLASS_H, buildClassroom } from '../content/classroom';
import { DINING_OX, DINING_W, DINING_H, DINING_SOLID, DT, buildDining } from '../content/dining';
import { TILESET_KEY, TILESET_MARGIN, TILESET_SPACING } from '../art/textures';
import { entrances } from '../art/buildings3d';

export type RoomKey = 'dorm' | 'class' | 'dining' | null;

/** what the 3D view needs to know from the game scene */
export interface Host3D {
  scene: Phaser.Scene;
  map: number[][];
  room(): RoomKey;
  player(): Phaser.GameObjects.Sprite;
  /** 0 clear, 1 thin fog, 2 thick fog */
  fogAt(x: number, y: number): 0 | 1 | 2;
  /** sky tint (multiply colour), darkness 0..1, current weather */
  light(): { tint: [number, number, number]; dark: number; weather: string };
  lightSpots(): Array<{ x: number; y: number; r: number }>;
  zoom(): number;
}

const FLOORS: Record<string, [number, number]> = {
  // [floors, floor height]
  kiz_yurdu: [4, 1.15], erkek_yurdu: [4, 1.15], egitim: [3, 1.2], kutuphane: [2, 1.4], yemekhane: [2, 1.35], cemiyet: [2, 1.25], spor: [1, 2.9], teknik: [2, 1.2],
};
const PITCH = THREE.MathUtils.degToRad(52);
const FOV = 34;
const PIXEL = 2; // render at half resolution, scaled up crisp: the pixel-art look

const BUILDING_TILES = new Set<number>([T.ROOF, T.SKYLIGHT, T.SOLAR, T.GREEN_ROOF, T.WALL, T.WALL_BASE, T.DOOR, T.DOOR_REVIR]);
const SKIP_KEYS = new Set(['bust', 'gatepost', 'tree', 'lamp', 'bench', 'flowers', 'bush', 'fountain', 'flag', 'warm', 'glow', '__DEFAULT', '__MISSING', '__WHITE']);

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return { c, g: c.getContext('2d')! };
}

function pixelTex(src: HTMLCanvasElement, repeat = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(src);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapLinearFilter;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

type Mirror = { sprite: THREE.Sprite; source: CanvasImageSource; frameKey: string; textKey: string; overlay: boolean };

export class World3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 400);
  private hemi = new THREE.HemisphereLight(0xffffff, 0x5a7050, 1);
  private sun = new THREE.DirectionalLight(0xfff2dc, 1.6);
  private target = new THREE.Vector3();
  private lastRoom: RoomKey | 'none' = 'none';
  private mirrors = new Map<Phaser.GameObjects.GameObject, Mirror>();
  private baseTex = new Map<CanvasImageSource, THREE.Texture>();
  private buildings: Array<{ b: Building; group: THREE.Group; box: THREE.Box3; mats: THREE.Material[]; faded: boolean; height: number }> = [];
  private windowMats: THREE.MeshLambertMaterial[] = [];
  private glowMats: THREE.MeshBasicMaterial[] = [];
  private pools: THREE.Mesh[] = [];
  private torch!: THREE.Mesh;
  private fog!: { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D; tex: THREE.CanvasTexture; timer: number; hideables: Array<{ obj: THREE.Object3D; x: number; y: number }> };
  private flag!: { mesh: THREE.Mesh; base: Float32Array };
  private weather: { kind: string; points: THREE.Points | THREE.LineSegments | null; vel: Float32Array | null } = { kind: '', points: null, vel: null };
  private ray = new THREE.Raycaster();
  private disposed = false;

  constructor(private host: Host3D, parent: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const el = this.renderer.domElement;
    el.className = 'view-3d';
    parent.appendChild(el);

    this.scene.background = new THREE.Color(0x1c2e28);
    this.scene.add(this.hemi);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 120;
    this.sun.shadow.bias = -0.0008;
    this.scene.add(this.sun, this.sun.target);

    this.buildGround();
    this.buildFog();
    for (const b of BUILDINGS) this.buildBuilding(b);
    this.buildDecor();
    this.buildForestAndFence();
    this.buildRoom(buildRoom(), ROOM_OX, ROOM_W, ROOM_H);
    this.buildRoom(buildClassroom(), CLASS_OX, CLASS_W, CLASS_H);
    this.buildRoom(buildDining(), DINING_OX, DINING_W, DINING_H);
    this.resize();
  }

  // ---------- static world ----------

  private tileset(): HTMLCanvasElement {
    return this.host.scene.textures.get(TILESET_KEY).getSourceImage() as HTMLCanvasElement;
  }

  /** copies one painted tile from Phaser's (extruded) tileset */
  private drawTile(g: CanvasRenderingContext2D, id: number, dx: number, dy: number) {
    const sx = TILESET_MARGIN + id * (TILE + TILESET_SPACING);
    g.drawImage(this.tileset(), sx, TILESET_MARGIN, TILE, TILE, dx, dy, TILE, TILE);
  }

  private buildGround() {
    const { c, g } = canvas(MAP_W * TILE, MAP_H * TILE);
    const m = this.host.map;
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      let t = m[y][x];
      if (BUILDING_TILES.has(t)) t = T.GROUND;
      if (t === T.FENCE) t = T.GROUND;
      this.drawTile(g, t, x * TILE, y * TILE);
    }
    // basketball court and football pitch lines (same as the 2D view)
    g.strokeStyle = 'rgba(242,242,234,0.9)'; g.lineWidth = 2;
    const b = COURTS.basketball;
    {
      const x = b.x * TILE + 8, y = b.y * TILE + 8, w = b.w * TILE - 16, h = b.h * TILE - 16;
      g.strokeRect(x, y, w, h);
      g.beginPath(); g.moveTo(x + w / 2, y); g.lineTo(x + w / 2, y + h); g.stroke();
      g.beginPath(); g.arc((b.x + b.w / 2) * TILE, (b.y + b.h / 2) * TILE, 28, 0, Math.PI * 2); g.stroke();
    }
    const fb = COURTS.football;
    {
      const x = fb.x * TILE + 6, y = fb.y * TILE + 6, w = fb.w * TILE - 12, h = fb.h * TILE - 12;
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.strokeRect(x, y, w, h);
      g.beginPath(); g.moveTo(x + w / 2, y); g.lineTo(x + w / 2, y + h); g.stroke();
      g.beginPath(); g.arc(x + w / 2, y + h / 2, 30, 0, Math.PI * 2); g.stroke();
      g.strokeRect(x, y + h / 2 - 48, 64, 96); g.strokeRect(x + w - 64, y + h / 2 - 48, 64, 96);
    }
    const tex = pixelTex(c);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W, MAP_H), new THREE.MeshLambertMaterial({ map: tex }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(MAP_W / 2, 0, MAP_H / 2);
    ground.receiveShadow = true;
    this.scene.add(ground);
    // the forest goes on beyond the map
    const outside = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W + 200, MAP_H + 200), new THREE.MeshLambertMaterial({ color: 0x214f34 }));
    outside.rotation.x = -Math.PI / 2;
    outside.position.set(MAP_W / 2, -0.02, MAP_H / 2);
    this.scene.add(outside);
    // basketball hoops and a tennis net
    const metal = new THREE.MeshLambertMaterial({ color: 0x3d4246 });
    const board = new THREE.MeshLambertMaterial({ color: 0xf4f4f0 });
    for (const [hx, flip] of [[b.x + 0.6, 1], [b.x + b.w - 0.6, -1]] as const) {
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.6, 0.1), metal);
      pole.position.set(hx, 1.3, b.y + b.h / 2); pole.castShadow = true;
      const bb = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 1.1), board);
      bb.position.set(hx + 0.12 * flip, 2.5, b.y + b.h / 2); bb.castShadow = true;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 4, 12), new THREE.MeshLambertMaterial({ color: 0xd9582b }));
      ring.rotation.x = Math.PI / 2; ring.position.set(hx + 0.38 * flip, 2.3, b.y + b.h / 2);
      this.scene.add(pole, bb, ring);
    }
    // football goals at both ends of the pitch
    const white = new THREE.MeshLambertMaterial({ color: 0xffffff });
    for (const [gx, side] of [[fb.x + 0.2, -1], [fb.x + fb.w - 0.2, 1]] as const) {
      const gz = fb.y + fb.h / 2;
      for (const dz of [-0.75, 0.75]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), white);
        post.position.set(gx, 0.45, gz + dz); post.castShadow = true; this.scene.add(post);
      }
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.58), white);
      bar.position.set(gx, 0.9, gz); bar.castShadow = true;
      const netBox = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.85, 1.5), new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
      netBox.position.set(gx + side * 0.25, 0.43, gz);
      this.scene.add(bar, netBox);
    }
  }

  private buildFog() {
    const { c, g } = canvas(MAP_W, MAP_H);
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W, MAP_H), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(MAP_W / 2, 0.06, MAP_H / 2);
    plane.renderOrder = 5;
    this.scene.add(plane);
    this.fog = { canvas: c, g, tex, timer: 1e9, hideables: [] };
  }

  /** the white façade module: 4 windows wide, one floor high (plus a matching "lit windows" map) */
  private facadeTextures(style: 'ribbon' | 'glass', seed: number) {
    const W = 128, H = 40;
    const { c, g } = canvas(W, H);
    const { c: e, g: eg } = canvas(W, H);
    eg.fillStyle = '#000'; eg.fillRect(0, 0, W, H);
    const r = rng(seed);
    g.fillStyle = '#f1f2f0'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#dcdfe0'; g.fillRect(0, H - 3, W, 3);
    if (style === 'glass') {
      g.fillStyle = '#5f819f'; g.fillRect(0, 3, W, H - 8);
      g.fillStyle = '#a9c9e2'; g.fillRect(0, 3, W, 4);
      g.fillStyle = '#e8ecef'; for (let x = 0; x < W; x += 16) g.fillRect(x, 3, 2, H - 8);
      g.fillRect(0, H / 2, W, 2);
      eg.fillStyle = '#ffd57e'; eg.fillRect(0, 7, W, H - 12);
    } else {
      for (let i = 0; i < 4; i++) {
        const x = i * 32 + 4;
        g.fillStyle = '#4f6f8c'; g.fillRect(x, 8, 20, 24);
        g.fillStyle = '#9cc0dd'; g.fillRect(x, 8, 20, 4); g.fillRect(x + 3, 15, 5, 2);
        g.fillStyle = '#e8ecef'; g.fillRect(x + 9, 8, 2, 24);
        g.fillStyle = '#c9ced2'; g.fillRect(x - 1, 32, 22, 2);
        g.fillStyle = '#c98a4b'; g.fillRect(x + 22, 5, 4, 31);
        g.fillStyle = '#9c6633'; g.fillRect(x + 25, 5, 1, 31);
        if (r() < 0.7) { eg.fillStyle = r() < 0.25 ? '#fff0c4' : '#ffd57e'; eg.fillRect(x, 11, 20, 21); }
      }
    }
    return { map: pixelTex(c, true), emissive: pixelTex(e, true) };
  }

  private roofTexture(b: Building, w: number, h: number) {
    const { c, g } = canvas(w * TILE, h * TILE);
    const r = rng(b.rect.x * 13 + b.rect.y * 7);
    const pal = b.roof === 'green' ? ['#79ae5f', '#62964b', '#93c477'] : b.roof === 'white' ? ['#dfe3e6', '#c9cfd4', '#eef1f3'] : ['#bcc3c9', '#a6aeb5', '#d3d9de'];
    g.fillStyle = pal[0]; g.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < w * h * 6; i++) { g.fillStyle = r() < 0.5 ? pal[1] : pal[2]; g.fillRect(r() * c.width, r() * c.height, 2, 1); }
    g.fillStyle = pal[1];
    for (let x = 32; x < c.width; x += 32) g.fillRect(x, 0, 1, c.height);
    for (let y = 32; y < c.height; y += 32) g.fillRect(0, y, c.width, 1);
    const at = (s: Rect) => ({ x: (s.x - b.rect.x) * TILE, y: (s.y - b.rect.y) * TILE, w: s.w * TILE, h: s.h * TILE });
    for (const p of b.greenPatches ?? []) {
      const q = at(p); g.fillStyle = '#7fb466'; g.fillRect(q.x, q.y, q.w, q.h);
      for (let i = 0; i < q.w * q.h / 25; i++) { g.fillStyle = r() < 0.5 ? '#94c77a' : '#679d50'; g.fillRect(q.x + r() * q.w, q.y + r() * q.h, 2, 2); }
    }
    for (const s of b.skylights ?? []) {
      const q = at(s); g.fillStyle = '#8fb6d4'; g.fillRect(q.x, q.y + 4, q.w, q.h - 8);
      g.fillStyle = '#cfe5f4'; g.fillRect(q.x, q.y + 4, q.w, 4);
      g.fillStyle = '#6d8fac'; for (let x = q.x; x < q.x + q.w; x += 16) g.fillRect(x, q.y + 4, 2, q.h - 8);
    }
    return pixelTex(c);
  }

  private buildBuilding(b: Building) {
    const r = b.rect;
    const [floors, fh] = FLOORS[b.id] ?? [2, 1.2];
    const H = floors * fh + 0.2;
    const group = new THREE.Group();
    const mats: THREE.Material[] = [];
    const tex = this.facadeTextures(b.id === 'spor' ? 'glass' : 'ribbon', r.x * 31 + r.y);
    const roofTex = this.roofTexture(b, r.w, r.h);
    const wallMat = (len: number) => {
      const map = tex.map.clone(); map.repeat.set(len / 4, floors); map.needsUpdate = true;
      const em = tex.emissive.clone(); em.repeat.set(len / 4, floors); em.needsUpdate = true;
      const m = new THREE.MeshLambertMaterial({ map, emissiveMap: em, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0 });
      this.windowMats.push(m); mats.push(m);
      return m;
    };
    const roofMat = new THREE.MeshLambertMaterial({ map: roofTex }); mats.push(roofMat);
    const plain = new THREE.MeshLambertMaterial({ color: 0xd9dcdc }); mats.push(plain);
    // footprint minus the open courtyard
    const parts: Rect[] = [];
    const cy = b.courtyard;
    if (cy) {
      parts.push({ x: r.x, y: r.y, w: r.w, h: cy.y - r.y });
      parts.push({ x: r.x, y: cy.y + cy.h, w: r.w, h: r.y + r.h - (cy.y + cy.h) });
      parts.push({ x: r.x, y: cy.y, w: cy.x - r.x, h: cy.h });
      parts.push({ x: cy.x + cy.w, y: cy.y, w: r.x + r.w - (cy.x + cy.w), h: cy.h });
    } else parts.push(r);
    const rim = new THREE.MeshLambertMaterial({ color: b.roof === 'white' ? 0xf7f8f9 : 0xe6eaed }); mats.push(rim);
    const stone = new THREE.MeshLambertMaterial({ color: 0x9aa1a6 }); mats.push(stone);
    for (const p of parts) {
      if (p.w <= 0 || p.h <= 0) continue;
      const geo = new THREE.BoxGeometry(p.w, H, p.h);
      // top face (+y, vertices 8..11) samples its part of the whole roof texture
      const pos = geo.attributes.position, uv = geo.attributes.uv;
      for (let i = 8; i < 12; i++) {
        const wx = p.x + p.w / 2 + pos.getX(i), wz = p.y + p.h / 2 + pos.getZ(i);
        uv.setXY(i, (wx - r.x) / r.w, 1 - (wz - r.y) / r.h);
      }
      const mesh = new THREE.Mesh(geo, [wallMat(p.h), wallMat(p.h), roofMat, plain, wallMat(p.w), wallMat(p.w)]);
      mesh.position.set(p.x + p.w / 2, H / 2, p.y + p.h / 2);
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
      // parapet and plinth
      const lip = (w: number, d: number, x: number, z: number) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, d), rim);
        m.position.set(x, H + 0.11, z); m.castShadow = true; group.add(m);
      };
      lip(p.w, 0.16, p.x + p.w / 2, p.y + 0.08); lip(p.w, 0.16, p.x + p.w / 2, p.y + p.h - 0.08);
      lip(0.16, p.h, p.x + 0.08, p.y + p.h / 2); lip(0.16, p.h, p.x + p.w - 0.08, p.y + p.h / 2);
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(p.w + 0.06, 0.22, p.h + 0.06), stone);
      plinth.position.set(p.x + p.w / 2, 0.11, p.y + p.h / 2);
      group.add(plinth);
    }
    // solar panels: tilted rows
    const solarMat = new THREE.MeshLambertMaterial({ color: 0x2f4f84 }); mats.push(solarMat);
    for (const s of b.solar ?? []) {
      for (let z = s.y + 0.3; z < s.y + s.h; z += 0.55) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(s.w - 0.2, 0.05, 0.42), solarMat);
        panel.position.set(s.x + s.w / 2, H + 0.25, z + 0.2); panel.rotation.x = -0.35; panel.castShadow = true;
        group.add(panel);
      }
    }
    // rooftop units
    const r2 = rng(r.x * 7 + r.y * 3);
    const unitMat = new THREE.MeshLambertMaterial({ color: 0xc4cacf }); mats.push(unitMat);
    for (let i = 0, placed = 0; i < 30 && placed < Math.max(2, Math.floor(r.w / 5)); i++) {
      const ux = r.x + 1 + r2() * (r.w - 2), uz = r.y + 1 + r2() * (r.h - 2);
      const blocked = [cy, ...(b.solar ?? []), ...(b.skylights ?? []), ...(b.greenPatches ?? [])].some((f) => f && ux > f.x - 0.8 && ux < f.x + f.w + 0.8 && uz > f.y - 0.8 && uz < f.y + f.h + 0.8);
      if (blocked) continue;
      const u = new THREE.Mesh(new THREE.BoxGeometry(0.5 + r2() * 0.5, 0.35 + r2() * 0.3, 0.4 + r2() * 0.3), unitMat);
      u.position.set(ux, H + 0.25, uz); u.castShadow = true; group.add(u);
      placed++;
    }
    // entrances
    const frame = new THREE.MeshLambertMaterial({ color: 0x3e4a52 }); mats.push(frame);
    const glass = new THREE.MeshLambertMaterial({ color: 0x6f93ad, emissive: new THREE.Color(0xfff0c4), emissiveIntensity: 0 }); mats.push(glass);
    this.windowMats.push(glass);
    const canopyMat = new THREE.MeshLambertMaterial({ color: 0x7f878d }); mats.push(canopyMat);
    for (const e of entrances(b)) {
      const along = e.side === 'n' || e.side === 's';
      const len = e.n - 0.15;
      const out = e.side === 's' || e.side === 'e' ? 1 : -1;
      const cx = along ? e.x + e.n / 2 : e.side === 'e' ? r.x + r.w : r.x;
      const cz = along ? (e.side === 's' ? r.y + r.h : r.y) : e.y + e.n / 2;
      const door = new THREE.Mesh(new THREE.BoxGeometry(along ? len : 0.1, 1.25, along ? 0.1 : len), frame);
      door.position.set(cx, 0.63, cz); group.add(door);
      const pane = new THREE.Mesh(new THREE.BoxGeometry(along ? len - 0.12 : 0.12, 1.1, along ? 0.12 : len - 0.12), e.revir ? new THREE.MeshLambertMaterial({ color: 0xd8e8f0 }) : glass);
      pane.position.set(cx, 0.62, cz); group.add(pane);
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(along ? e.n + 0.3 : 0.7, 0.1, along ? 0.7 : e.n + 0.3), canopyMat);
      canopy.position.set(cx + (along ? 0 : out * 0.35), 1.45, cz + (along ? out * 0.35 : 0)); canopy.castShadow = true; group.add(canopy);
      if (e.revir) {
        const red = new THREE.MeshBasicMaterial({ color: 0xc0392b });
        const a = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.04), red), c2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.36, 0.04), red);
        a.position.set(cx, 1.75, cz + 0.08 * out); c2.position.copy(a.position); group.add(a, c2);
      }
    }
    this.scene.add(group);
    const box = new THREE.Box3().setFromObject(group);
    this.buildings.push({ b, group, box, mats, faded: false, height: H + 0.2 });
    this.fog.hideables.push({ obj: group, x: r.x + r.w / 2, y: r.y + r.h / 2 });
  }

  private buildDecor() {
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5e4027 });
    const leaves = [0x2f6b3b, 0x3d7f47, 0x4a9152].map((c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true }));
    const tree = (x: number, z: number, s = 1) => {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * s, 0.15 * s, 1.3 * s, 6), trunkMat);
      trunk.position.y = 0.65 * s; trunk.castShadow = true; g.add(trunk);
      const blobs: Array<[number, number, number, number, number]> = [[0, 1.75, 0, 0.85, 0], [-0.35, 1.55, 0.2, 0.6, 1], [0.38, 1.6, -0.1, 0.58, 1], [0.05, 2.25, 0.05, 0.55, 2]];
      for (const [bx, by, bz, br, ci] of blobs) {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(br * s, 0), leaves[ci]);
        m.position.set(bx * s, by * s, bz * s); m.castShadow = true; g.add(m);
      }
      g.position.set(x, 0, z);
      this.scene.add(g);
      this.fog.hideables.push({ obj: g, x, y: z });
    };
    for (const [x, y] of TREES) tree(x + 0.5, y + 0.85);

    // lamps with glowing heads and light pools
    const pole = new THREE.MeshLambertMaterial({ color: 0x2f3438 });
    const bulb = new THREE.MeshBasicMaterial({ color: 0xfff3c4 });
    this.glowMats.push(bulb);
    for (const [x, y] of LAMPS) {
      const g = new THREE.Group();
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.2, 6), pole); p.position.y = 1.1; p.castShadow = true;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.34), pole); head.position.y = 2.25;
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.24), bulb); light.position.y = 2.15;
      g.add(p, head, light); g.position.set(x + 0.5, 0, y + 0.9);
      this.scene.add(g);
    }
    const poolTex = (() => {
      const { c, g } = canvas(64, 64);
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, 'rgba(255,214,140,1)'); grd.addColorStop(0.5, 'rgba(255,200,120,0.45)'); grd.addColorStop(1, 'rgba(255,190,110,0)');
      g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })();
    const poolMat = () => new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
    for (const l of this.host.lightSpots()) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(l.r * 2, l.r * 2), poolMat());
      m.rotation.x = -Math.PI / 2; m.position.set(l.x / TILE, 0.08, l.y / TILE + 0.4); m.renderOrder = 6;
      this.scene.add(m); this.pools.push(m);
    }
    this.torch = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), poolMat());
    this.torch.rotation.x = -Math.PI / 2; this.torch.renderOrder = 6;
    this.scene.add(this.torch);

    // benches
    const wood = new THREE.MeshLambertMaterial({ color: 0x8a5a32 });
    for (const [x, y] of BENCHES) {
      const g = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 0.32), wood); seat.position.y = 0.36;
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.3, 0.06), wood); back.position.set(0, 0.6, -0.15);
      const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.36, 0.28), pole); l1.position.set(-0.4, 0.18, 0);
      const l2 = l1.clone(); l2.position.x = 0.4;
      for (const m of [seat, back, l1, l2]) { m.castShadow = true; g.add(m); }
      g.position.set(x + 0.5, 0, y + 0.55);
      this.scene.add(g);
    }
    // flower planters
    const planter = new THREE.MeshLambertMaterial({ color: 0x7a5434 });
    const petals = [0xf4b6c8, 0xf2c14e, 0xffffff, 0xd9582b].map((c) => new THREE.MeshLambertMaterial({ color: c }));
    for (const [x, y] of FLOWERS) {
      const g = new THREE.Group();
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 0.45), planter); box.position.y = 0.14; box.castShadow = true; g.add(box);
      for (let i = 0; i < 8; i++) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), petals[i % 4]);
        f.position.set(-0.36 + (i % 4) * 0.24, 0.34, i < 4 ? -0.1 : 0.1); g.add(f);
      }
      g.position.set(x + 0.5, 0, y + 0.5);
      this.scene.add(g);
    }
    // bushes along building fronts (same rule as the 2D view)
    const bushMat = new THREE.MeshLambertMaterial({ color: 0x3f8048, flatShading: true });
    for (const b of BUILDINGS) {
      const yb = b.rect.y + b.rect.h;
      for (let x = b.rect.x; x < b.rect.x + b.rect.w; x += 3) {
        if (this.host.map[yb]?.[x] !== T.GROUND || this.host.map[yb]?.[x + 1] !== T.GROUND) continue;
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), bushMat);
        m.position.set(x + 1, 0.3, yb + 0.35); m.scale.set(1.3, 0.8, 0.9); m.castShadow = true;
        this.scene.add(m);
      }
    }
    // fountain
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0xcfc8b9 });
    const water = new THREE.MeshLambertMaterial({ color: 0x7fc4e8, emissive: new THREE.Color(0x3a7fb0), emissiveIntensity: 0.25 });
    const [fx, fz] = [FOUNTAIN[0], FOUNTAIN[1] + 0.5];
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, 0.4, 16), stoneMat); basin.position.set(fx, 0.2, fz); basin.castShadow = true;
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.05, 16), water); pool.position.set(fx, 0.38, fz);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.9, 8), stoneMat); col.position.set(fx, 0.75, fz);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.2, 0.18, 12), stoneMat); bowl.position.set(fx, 1.2, fz);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, 0.5, 6), water); spout.position.set(fx, 1.45, fz);
    this.scene.add(basin, pool, col, bowl, spout);
    // flag on its pole
    const fp = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 4.6, 6), new THREE.MeshLambertMaterial({ color: 0xdcdfe0 }));
    fp.position.set(FLAGPOLE[0] + 0.5, 2.3, FLAGPOLE[1] + 0.9); fp.castShadow = true;
    this.scene.add(fp);
    const { c: fc, g: fg } = canvas(96, 64);
    fg.fillStyle = '#e30a17'; fg.fillRect(0, 0, 96, 64);
    fg.fillStyle = '#ffffff'; fg.beginPath(); fg.arc(36, 32, 16, 0, Math.PI * 2); fg.fill();
    fg.fillStyle = '#e30a17'; fg.beginPath(); fg.arc(40, 32, 13, 0, Math.PI * 2); fg.fill();
    fg.fillStyle = '#ffffff'; fg.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 3 : 7; fg.lineTo(56 + Math.cos(a) * rr, 32 + Math.sin(a) * rr); }
    fg.fill();
    const fgeo = new THREE.PlaneGeometry(1.4, 0.93, 10, 4);
    const flag = new THREE.Mesh(fgeo, new THREE.MeshLambertMaterial({ map: pixelTex(fc), side: THREE.DoubleSide }));
    flag.position.set(FLAGPOLE[0] + 0.5 + 0.72, 4.1, FLAGPOLE[1] + 0.9);
    flag.castShadow = true;
    this.scene.add(flag);
    this.flag = { mesh: flag, base: Float32Array.from(fgeo.attributes.position.array as ArrayLike<number>) };
    // the main gate: two brick pillars and a sign over the gateway
    const brick = new THREE.MeshLambertMaterial({ color: 0x8a2d2d });
    const vertical = GATE.h > GATE.w;
    const ends = vertical
      ? [[GATE.x + 0.5, GATE.y - 0.25], [GATE.x + 0.5, GATE.y + GATE.h + 0.25]]
      : [[GATE.x - 0.25, GATE.y + 0.5], [GATE.x + GATE.w + 0.25, GATE.y + 0.5]];
    for (const [gx, gz] of ends) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.3, 0.6), brick); p.position.set(gx, 1.15, gz); p.castShadow = true;
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.15, 0.75), new THREE.MeshLambertMaterial({ color: 0xa94040 })); cap.position.set(gx, 2.35, gz);
      this.scene.add(p, cap);
    }
    const { c: sc, g: sg } = canvas(160, 24);
    sg.fillStyle = '#2d3a44'; sg.fillRect(0, 0, 160, 24);
    sg.fillStyle = '#f2c14e'; sg.font = '8px "Public Pixel", monospace'; sg.textAlign = 'center'; sg.textBaseline = 'middle';
    sg.fillText('DARÜŞŞAFAKA', 80, 13);
    const span = (vertical ? GATE.h : GATE.w) + 0.9;
    const signFace = new THREE.MeshLambertMaterial({ map: pixelTex(sc) });
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(vertical ? 0.12 : span, 0.42, vertical ? span : 0.12),
      vertical ? [signFace, signFace, brick, brick, brick, brick] : [brick, brick, brick, brick, signFace, signFace],
    );
    sign.position.set(vertical ? GATE.x + 0.5 : GATE.x + GATE.w / 2, 2.55, vertical ? GATE.y + GATE.h / 2 : GATE.y + 0.5);
    this.scene.add(sign);
    // the Atatürk bust: marble pedestal with a plaque, bronze bust on top
    const marble = new THREE.MeshLambertMaterial({ color: 0xe4dfd3 });
    const bronze = new THREE.MeshLambertMaterial({ color: 0x6e5a42 });
    const [bx, bz] = [BUST[0], BUST[1] + 0.2];
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.2, 1.5), new THREE.MeshLambertMaterial({ color: 0xb9b2a3 }));
    step.position.set(bx, 0.1, bz);
    const { c: pc, g: pg } = canvas(64, 64);
    pg.fillStyle = '#e4dfd3'; pg.fillRect(0, 0, 64, 64);
    pg.fillStyle = '#b08d3c'; pg.fillRect(10, 26, 44, 16);
    pg.fillStyle = '#3a2a10'; pg.font = '8px "Public Pixel", monospace'; pg.textAlign = 'center'; pg.textBaseline = 'middle';
    pg.fillText('ATATÜRK', 32, 34);
    const plaque = new THREE.MeshLambertMaterial({ map: pixelTex(pc) });
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(1, 1.3, 1), [marble, marble, marble, marble, plaque, marble]);
    pedestal.position.set(bx, 0.85, bz);
    const shoulders = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.5, 0.45, 10), bronze);
    shoulders.position.set(bx, 1.73, bz);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.2, 8), bronze);
    neck.position.set(bx, 2.03, bz);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), bronze);
    head.scale.set(0.9, 1.15, 1); head.position.set(bx, 2.32, bz);
    for (const m of [step, pedestal, shoulders, neck, head]) { m.castShadow = true; m.receiveShadow = true; this.scene.add(m); }
  }

  private buildForestAndFence() {
    const m = this.host.map;
    const forest: Array<[number, number]> = [];
    const fence: Array<[number, number]> = [];
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      if (m[y][x] === T.FOREST) forest.push([x, y]);
      if (m[y][x] === T.FENCE) fence.push([x, y]);
    }
    // forest: instanced low-poly pines and round trees
    const r = rng(42);
    const cone = new THREE.ConeGeometry(0.75, 2.0, 6);
    const trunk = new THREE.CylinderGeometry(0.1, 0.12, 0.6, 5);
    const canopy = new THREE.InstancedMesh(cone, new THREE.MeshLambertMaterial({ flatShading: true }), forest.length);
    const trunks = new THREE.InstancedMesh(trunk, new THREE.MeshLambertMaterial({ color: 0x4a321e }), forest.length);
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const col = new THREE.Color();
    forest.forEach(([x, y], i) => {
      const k = 0.8 + r() * 0.6;
      p.set(x + 0.2 + r() * 0.6, 0.3 * k, y + 0.2 + r() * 0.6); s.set(k, k, k);
      trunks.setMatrixAt(i, mtx.compose(p, q, s));
      p.y = (0.6 + 1.0) * k;
      canopy.setMatrixAt(i, mtx.compose(p, q, s));
      canopy.setColorAt(i, col.setHSL(0.36 + r() * 0.05, 0.4 + r() * 0.15, 0.2 + r() * 0.1));
    });
    canopy.castShadow = true;
    this.scene.add(canopy, trunks);
    // iron fence: posts and two rails per tile
    const iron = new THREE.MeshLambertMaterial({ color: 0x2b3033 });
    const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 0.9, 0.07), iron, fence.length * 2);
    const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.05, 0.05), iron, fence.length * 2);
    const isFence = (x: number, y: number) => m[y]?.[x] === T.FENCE;
    let n = 0;
    fence.forEach(([x, y], i) => {
      const horizontal = isFence(x - 1, y) || isFence(x + 1, y);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), horizontal ? 0 : Math.PI / 2);
      s.set(1, 1, 1);
      for (const h of [0.35, 0.75]) { p.set(x + 0.5, h, y + 0.5); rails.setMatrixAt(n++, mtx.compose(p, q, s)); }
      p.set(x + 0.5, 0.45, y + 0.5); posts.setMatrixAt(i * 2, mtx.compose(p, new THREE.Quaternion(), s));
      p.set(horizontal ? x : x + 0.5, 0.45, horizontal ? y + 0.5 : y); posts.setMatrixAt(i * 2 + 1, mtx.compose(p, new THREE.Quaternion(), s));
    });
    posts.castShadow = rails.castShadow = true;
    this.scene.add(posts, rails);
  }

  /** an interior from its tile map: floor, walls (the back wall shows its painted face), furniture as blocks */
  private buildRoom(map: number[][], ox: number, W: number, H: number) {
    const solid = new Set<number>([...ROOM_SOLID, ...DINING_SOLID]);
    const heights: Record<number, number> = {
      [RT.DESK]: 0.45, [RT.BED]: 0.45, [RT.LOCKER]: 1.5, [RT.SHELF]: 1.6, [RT.TV]: 0.9,
      [DT.COUNTER]: 0.6, [DT.TABLE]: 0.45, [DT.SINK]: 0.6, [DT.KANTIN]: 0.95,
    };
    // floor
    const { c, g } = canvas(W * TILE, H * TILE);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = map[y][x];
      this.drawTile(g, solid.has(t) || y < 2 ? RT.FLOOR : t, x * TILE, y * TILE);
    }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshLambertMaterial({ map: pixelTex(c) }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(ox + W / 2, 0, H / 2); floor.receiveShadow = true;
    this.scene.add(floor);
    const dark = new THREE.Mesh(new THREE.PlaneGeometry(W + 40, H + 40), new THREE.MeshBasicMaterial({ color: 0x14100c }));
    dark.rotation.x = -Math.PI / 2; dark.position.set(ox + W / 2, -0.03, H / 2);
    this.scene.add(dark);
    // back wall: rows 0–1 are painted as the wall's face (boards, windows) — stand it up
    const { c: wc, g: wg } = canvas(W * TILE, 2 * TILE);
    for (let x = 0; x < W; x++) { this.drawTile(wg, map[0][x], x * TILE, 0); this.drawTile(wg, map[1][x], x * TILE, TILE); }
    const wallH = 2.6;
    const wallColor = new THREE.MeshLambertMaterial({ color: 0xe9e4da });
    const back = new THREE.Mesh(new THREE.BoxGeometry(W, wallH, 0.3), [wallColor, wallColor, wallColor, wallColor, new THREE.MeshLambertMaterial({ map: pixelTex(wc) }), wallColor]);
    back.position.set(ox + W / 2, wallH / 2, 1.85); back.receiveShadow = true;
    this.scene.add(back);
    // side, inner and front (cut-away) walls, furniture
    const cache = new Map<number, THREE.Material[]>();
    const furnitureMats = (t: number) => {
      if (cache.has(t)) return cache.get(t)!;
      const { c: tc, g: tg } = canvas(TILE, TILE);
      this.drawTile(tg, t, 0, 0);
      const d = tg.getImageData(0, 0, TILE, TILE).data;
      let rr = 0, gg = 0, bb = 0;
      for (let i = 0; i < d.length; i += 4) { rr += d[i]; gg += d[i + 1]; bb += d[i + 2]; }
      const n = d.length / 4;
      const side = new THREE.MeshLambertMaterial({ color: new THREE.Color(rr / n / 255 * 0.75, gg / n / 255 * 0.75, bb / n / 255 * 0.75).convertSRGBToLinear() });
      const top = new THREE.MeshLambertMaterial({ map: pixelTex(tc) });
      const mats = [side, side, top, side, side, side];
      cache.set(t, mats);
      return mats;
    };
    for (let y = 2; y < H; y++) for (let x = 0; x < W; x++) {
      const t = map[y][x];
      if (t === RT.WALL) {
        const edgeX = x === 0 || x === W - 1, front = y === H - 1;
        const h = front ? 0.35 : wallH;
        const w = edgeX ? 0.35 : front ? 1 : 0.35, d = front ? 0.35 : 1;
        const px = x === 0 ? x + 1 - w / 2 : x === W - 1 ? x + w / 2 : x + 0.5;
        const pz = front ? y + d / 2 : y + 0.5;
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallColor);
        m.position.set(ox + px, h / 2, pz); m.castShadow = m.receiveShadow = true;
        this.scene.add(m);
      } else if (solid.has(t) && t !== RT.DOOR) {
        const h = heights[t] ?? 0.5;
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.98, h, 0.98), furnitureMats(t));
        m.position.set(ox + x + 0.5, h / 2, y + 0.5); m.castShadow = m.receiveShadow = true;
        this.scene.add(m);
      }
    }
  }

  // ---------- each frame ----------

  private resize() {
    const el = this.renderer.domElement.parentElement!;
    const w = el.clientWidth || window.innerWidth, h = el.clientHeight || window.innerHeight;
    const rw = Math.max(1, Math.round(w / PIXEL)), rh = Math.max(1, Math.round(h / PIXEL));
    const cur = this.renderer.getSize(new THREE.Vector2());
    if (cur.x === rw && cur.y === rh) return;
    this.renderer.setSize(rw, rh, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private heightAt(x: number, z: number): number {
    for (const b of this.buildings) {
      const r = b.b.rect;
      if (x >= r.x && x < r.x + r.w && z >= r.y && z < r.y + r.h) return b.height;
    }
    return 0;
  }

  private baseTexture(src: CanvasImageSource): THREE.Texture {
    let t = this.baseTex.get(src);
    if (!t) {
      t = new THREE.CanvasTexture(src as HTMLCanvasElement);
      t.colorSpace = THREE.SRGBColorSpace;
      t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
      this.baseTex.set(src, t);
    }
    return t;
  }

  /** copies people, items and labels from Phaser into the 3D scene */
  private mirror(tint: THREE.Color) {
    const seen = new Set<Phaser.GameObjects.GameObject>();
    const visit = (o: Phaser.GameObjects.GameObject, ox: number, oy: number, alpha: number, depth: number) => {
      const go = o as unknown as {
        type: string; visible: boolean; alpha: number; x: number; y: number; depth: number; list?: Phaser.GameObjects.GameObject[];
        texture?: Phaser.Textures.Texture; frame?: Phaser.Textures.Frame; originX: number; originY: number; displayWidth: number; displayHeight: number;
        flipX?: boolean; canvas?: HTMLCanvasElement; text?: string; scaleX: number;
      };
      if (!go.visible) return;
      const a = alpha * (go.alpha ?? 1);
      if (a < 0.02) return;
      const d = Math.max(depth, go.depth ?? 0);
      if (go.type === 'Container') { for (const ch of go.list ?? []) visit(ch, ox + go.x, oy + go.y, a, d); return; }
      const isText = go.type === 'Text';
      if (!isText && go.type !== 'Sprite' && go.type !== 'Image') return;
      const key = go.texture?.key ?? '';
      if (!isText && (SKIP_KEYS.has(key) || key.startsWith('bld-'))) return;
      const overlay = isText || d >= 90_000 || key === 'qmark';
      const source = isText ? go.canvas! : go.frame!.source.image as CanvasImageSource;
      if (!source) return;
      seen.add(o);
      let m = this.mirrors.get(o);
      const textKey = isText ? `${go.text}|${go.canvas!.width}x${go.canvas!.height}` : '';
      if (m && (m.source !== source || m.textKey !== textKey)) { this.dropMirror(o, m); m = undefined; }
      if (!m) {
        let map: THREE.Texture;
        if (isText) {
          map = new THREE.CanvasTexture(go.canvas!);
          map.colorSpace = THREE.SRGBColorSpace; map.minFilter = THREE.LinearFilter; map.generateMipmaps = false;
        } else map = this.baseTexture(source).clone();
        const mat = new THREE.SpriteMaterial({ map, transparent: true, alphaTest: overlay ? 0.02 : 0.5, depthTest: !overlay, depthWrite: !overlay, fog: false });
        const sprite = new THREE.Sprite(mat);
        sprite.renderOrder = overlay ? 1000 + d / 1000 : 0;
        this.scene.add(sprite);
        m = { sprite, source, frameKey: '', textKey, overlay };
        this.mirrors.set(o, m);
      }
      const mat = m.sprite.material;
      const dw = go.displayWidth, dh = go.displayHeight;
      if (!isText) {
        const f = go.frame!;
        const fk = `${f.name}|${go.flipX ? 1 : 0}`;
        if (fk !== m.frameKey) {
          m.frameKey = fk;
          const sw = f.source.width, sh = f.source.height;
          const tex = mat.map!;
          tex.repeat.set((go.flipX ? -1 : 1) * f.cutWidth / sw, f.cutHeight / sh);
          tex.offset.set((go.flipX ? f.cutX + f.cutWidth : f.cutX) / sw, 1 - (f.cutY + f.cutHeight) / sh);
        }
      }
      const cx = ox + go.x + (0.5 - go.originX) * dw;
      if (m.overlay) {
        const cy = oy + go.y + (0.5 - go.originY) * dh;
        const X = cx / TILE, Z = cy / TILE;
        m.sprite.center.set(0.5, 0.5);
        m.sprite.position.set(X, this.heightAt(X, Z) + 0.05, Z);
        mat.color.setRGB(1, 1, 1);
      } else {
        const by = oy + go.y + (1 - go.originY) * dh;
        const X = cx / TILE, Z = by / TILE;
        m.sprite.center.set(0.5, 0);
        m.sprite.position.set(X, 0.02, Z);
        mat.color.copy(tint);
        // people hidden in thick fog stay hidden
        m.sprite.visible = this.host.room() !== null || this.host.fogAt(Math.floor(X), Math.floor(Z - 0.1)) < 2;
      }
      m.sprite.scale.set(dw / TILE, dh / TILE, 1);
      mat.opacity = a;
    };
    for (const o of this.host.scene.children.list) visit(o, 0, 0, 1, 0);
    for (const [o, m] of this.mirrors) if (!seen.has(o)) this.dropMirror(o, m);
  }

  private dropMirror(o: Phaser.GameObjects.GameObject, m: Mirror) {
    this.scene.remove(m.sprite);
    if (m.textKey) m.sprite.material.map?.dispose();
    m.sprite.material.dispose();
    this.mirrors.delete(o);
  }

  private updateFog(dt: number) {
    this.fog.timer += dt;
    if (this.fog.timer < 250) return;
    this.fog.timer = 0;
    const { g, tex } = this.fog;
    const img = g.createImageData(MAP_W, MAP_H);
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const f = this.host.fogAt(x, y);
      const i = (y * MAP_W + x) * 4;
      img.data[i] = 150; img.data[i + 1] = 172; img.data[i + 2] = 160;
      img.data[i + 3] = f === 2 ? 242 : f === 1 ? 140 : 0;
    }
    g.putImageData(img, 0, 0);
    tex.needsUpdate = true;
    for (const h of this.fog.hideables) h.obj.visible = this.host.fogAt(Math.floor(h.x), Math.floor(h.y)) < 2;
  }

  private updateLighting(time: number) {
    const { tint, dark } = this.host.light();
    const room = this.host.room();
    const t = new THREE.Color(tint[0] / 255, tint[1] / 255, tint[2] / 255);
    const lum = (tint[0] + tint[1] + tint[2]) / 765;
    this.hemi.color.copy(t);
    this.hemi.groundColor.setRGB(0.35 * t.r, 0.42 * t.g, 0.32 * t.b);
    this.hemi.intensity = room ? 1.5 : 0.5 + 1.1 * lum;
    this.sun.intensity = room ? 0.9 * lum : Math.max(0, 2.2 * lum * lum - 0.1);
    this.sun.color.setRGB(1, 0.92 + 0.08 * lum, 0.8 + 0.2 * lum);
    this.scene.background = new THREE.Color(0x1c2e28).multiply(t);
    const night = room ? 0 : Math.max(0, Math.min(1, (dark - 0.25) * 2.5));
    for (const m of this.windowMats) m.emissiveIntensity = night * 1.1;
    for (const p of this.pools) (p.material as THREE.MeshBasicMaterial).opacity = night * 0.55;
    const pl = this.host.player();
    this.torch.position.set(pl.x / TILE, 0.09, pl.y / TILE + 0.4);
    (this.torch.material as THREE.MeshBasicMaterial).opacity = night * 0.3;
    for (const g of this.glowMats) g.color.setRGB(1, 0.95, 0.77).multiplyScalar(0.55 + 0.45 * night);
    // the flag waves
    const pos = this.flag.mesh.geometry.attributes.position;
    const base = this.flag.base;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3] + 0.7;
      pos.setZ(i, Math.sin(time / 260 + x * 4) * 0.08 * x);
    }
    pos.needsUpdate = true;
    // sprites are unlit: tint them with the sky, but keep them readable at night
    return new THREE.Color(Math.max(0.42, t.r), Math.max(0.45, t.g), Math.max(0.55, t.b)).multiplyScalar(room === 'dorm' && dark > 0.4 ? 0.85 : 1);
  }

  private updateCamera() {
    const room = this.host.room();
    const pl = this.host.player();
    let goal: THREE.Vector3, dist: number;
    if (room) {
      const [ox, W, H] = { dorm: [ROOM_OX, ROOM_W, ROOM_H], class: [CLASS_OX, CLASS_W, CLASS_H], dining: [DINING_OX, DINING_W, DINING_H] }[room];
      goal = new THREE.Vector3(ox + W / 2, 0, H / 2 + 0.6);
      const vh = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
      dist = Math.max((W / 2 + 0.8) / (vh * this.camera.aspect), (H / 2 + 1.2) / vh * 0.95);
    } else {
      goal = new THREE.Vector3(pl.x / TILE, 0.5, pl.y / TILE);
      dist = 30 / Math.max(0.5, this.host.zoom());
    }
    if (room !== this.lastRoom) { this.target.copy(goal); this.lastRoom = room; }
    else this.target.lerp(goal, 0.15);
    const off = new THREE.Vector3(0, Math.sin(PITCH), Math.cos(PITCH)).multiplyScalar(dist);
    this.camera.position.copy(this.target).add(off);
    this.camera.lookAt(this.target);
    // the sun follows along so shadows stay sharp near you
    this.sun.position.copy(this.target).add(new THREE.Vector3(-14, 30, -10));
    this.sun.target.position.copy(this.target);
  }

  /** buildings between the camera and you turn see-through */
  private updateOcclusion() {
    if (this.host.room()) return;
    const pl = this.host.player();
    const head = new THREE.Vector3(pl.x / TILE, 0.6, pl.y / TILE);
    const dir = head.clone().sub(this.camera.position);
    const len = dir.length();
    this.ray.set(this.camera.position, dir.normalize());
    for (const b of this.buildings) {
      const hit = this.ray.ray.intersectBox(b.box, new THREE.Vector3());
      const fade = !!hit && hit.distanceTo(this.camera.position) < len - 0.2;
      if (fade === b.faded) continue;
      b.faded = fade;
      for (const m of b.mats) { m.transparent = fade; m.opacity = fade ? 0.3 : 1; m.depthWrite = !fade; m.needsUpdate = true; }
    }
  }

  private updateWeather(dt: number) {
    const { weather } = this.host.light();
    const kind = this.host.room() ? 'none' : weather;
    if (kind !== this.weather.kind) {
      if (this.weather.points) { this.scene.remove(this.weather.points); this.weather.points.geometry.dispose(); (this.weather.points.material as THREE.Material).dispose(); }
      this.weather = { kind, points: null, vel: null };
      if (kind === 'none') return;
      const rain = kind === 'rain';
      const n = rain ? 900 : kind === 'blizzard' ? 700 : 220;
      const pos = new Float32Array(n * (rain ? 6 : 3));
      const vel = new Float32Array(n);
      const r = rng(9);
      for (let i = 0; i < n; i++) {
        const x = (r() - 0.5) * 44, y = r() * 14, z = (r() - 0.5) * 36;
        vel[i] = rain ? 18 + r() * 6 : 0.6 + r() * (kind === 'blizzard' ? 2.5 : 0.8);
        if (rain) pos.set([x, y, z, x - 0.08, y + 0.45, z], i * 6);
        else pos.set([x, y, z], i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      if (rain) {
        this.weather.points = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xbfd4e6, transparent: true, opacity: 0.55 }));
      } else {
        const key = kind === 'winter' || kind === 'blizzard' ? 'snow' : kind === 'autumn' ? 'leaf' : 'petal';
        const src = this.host.scene.textures.exists(key) ? this.host.scene.textures.get(key).getSourceImage() as HTMLCanvasElement : undefined;
        this.weather.points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.22, map: src ? this.baseTexture(src) : null, transparent: true, alphaTest: 0.3, color: 0xffffff }));
      }
      this.weather.vel = vel;
      this.weather.points.frustumCulled = false;
      this.scene.add(this.weather.points);
    }
    const p = this.weather.points;
    if (!p || !this.weather.vel) return;
    p.position.set(this.target.x, 0, this.target.z);
    const arr = p.geometry.attributes.position.array as Float32Array;
    const rain = this.weather.kind === 'rain';
    const step = dt / 1000;
    for (let i = 0; i < this.weather.vel.length; i++) {
      const v = this.weather.vel[i] * step;
      if (rain) {
        const k = i * 6;
        arr[k + 1] -= v; arr[k + 4] -= v; arr[k] -= v * 0.15; arr[k + 3] -= v * 0.15;
        if (arr[k + 1] < 0) { arr[k + 1] += 14; arr[k + 4] += 14; arr[k] += 2; arr[k + 3] += 2; }
      } else {
        const k = i * 3;
        arr[k + 1] -= v; arr[k] += Math.sin((arr[k + 1] + i) * 1.3) * step * 0.6;
        if (arr[k + 1] < 0) arr[k + 1] += 14;
      }
    }
    p.geometry.attributes.position.needsUpdate = true;
  }

  update(time: number, dt: number) {
    if (this.disposed) return;
    this.resize();
    this.updateCamera();
    const tint = this.updateLighting(time);
    this.updateFog(dt);
    this.mirror(tint);
    this.updateOcclusion();
    this.updateWeather(dt);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const m of mats) { (m as THREE.MeshBasicMaterial).map?.dispose(); m.dispose(); }
    });
    for (const t of this.baseTex.values()) t.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

import Phaser from 'phaser';
import {
  BENCHES, COURTS, FLAGPOLE, FLOWERS, FOUNTAIN, GATE, LAMPS, SPAWN, LOCATIONS, MAP_H, MAP_W, PATROL_ROUTE, PLAZA_ALLOWED, PLAZA_EVENING, SOLID_TILES, T, TILE, TREES, BUILDINGS,
  AGE_ZONES, CENTER_ZONES, EVENING_CENTER, EVENING_ZONES, buildMap, doorStandTile, type Location, type Rect,
} from '../content/campus';
import {
  DEFAULT_LOOK, FOG_FULL, FOG_KEY, FOG_SOFT, TILESET_KEY, TILESET_MARGIN, TILESET_SPACING, generateTextures, makeCharacterTexture,
} from '../art/textures';
import { L, t, getLang, onLangChange } from '../i18n';
import { Hud } from '../ui/hud';
import { sfx } from '../audio';
import { Multiplayer, type PeerProfile, type PeerPos } from '../net/multiplayer';
import { saveToCloud } from '../net/cloudSave';
import type { NetUser } from '../main';
import { Panel } from '../ui/panel';
import { bedPanel, buildingPanel, deskPanel, exitPanel, lockerPanel, matePanel, npcPanel, tvPanel, type GameCtx, type Gain } from '../game/buildings';
import {
  BELLETMEN_ROUTE, DESKS, EXIT, MY_BED, MY_DESK, MY_LOCKER, ROOM_H, ROOM_OX, ROOM_SOLID, ROOM_SPAWN, ROOM_W, TV_SPOT, buildRoom,
} from '../content/dormroom';
import { CLASS_DESKS, CLASS_EXIT, CLASS_H, CLASS_OX, CLASS_SPAWN, CLASS_W, MY_CLASS_DESK, TEACHERS, TEACHER_ROUTE, buildClassroom } from '../content/classroom';
import { currentMeal, eatMeal, egitim, gatePanel, trayLock, washHands, yemekhane } from '../game/buildings';
import { BACK_ON_SUNDAY, BUS_BOARDING, BUS_LEAVES, awayForWeekend, isFriday, npcIsEvci, weekday } from '../game/weekend';
import { COOKS, COUNTER_TILES, DINING_EXIT, DINING_H, DINING_OX, DINING_SOLID, DINING_SPAWN, DINING_W, KANTIN_TILES, SEATS, SINKS, buildDining } from '../content/dining';
import { BELLETMENS, GROUPS, NPCS, ageGroup, type NpcDef } from '../content/npcs';
import { myGroup, dislikers, groupLabel, SURPRISES } from '../game/social';
import { relationshipsCard } from '../ui/relationships';
import { LIGHTS_OUT, WAKE_UP, phaseOf, type DayPhase } from '../game/schedule';
import {
  MISSIONS, missionById, nextObjective, reached, statusOf, trackedMission, type MissionCtx,
} from '../game/missions';
import { announceManyCard, missionsCard, trackerHtml } from '../ui/missions';
import { ATTRS, CAUSES } from '../content/character';
import { SUBJECTS, average, season, SEASON_NAME, FRIEND_AT, behaviorGrade } from '../game/state';
import { PERIODS, currentPeriod, isWeekend, periodLabel, subjectFor } from '../game/schedule';
import { clamp } from '../game/state';
import { GUARDIANS, TRAITS, type AttrId } from '../content/character';
import { backupSave, clearSave, decodeFog, encodeFog, writeSave, type SaveData } from '../save';

const REVEAL_RADIUS = 7;
const SEEN_RADIUS = 9;
const SPEED = 150;
/** real milliseconds per game minute: day (07:00–22:30) ≈ 1 game hour per 40 s; night is compressed */
const MS_PER_MIN_DAY = 40_000 / 60;
const MS_PER_MIN_NIGHT = 120_000 / (8.5 * 60);

const DIRS = { down: 0, left: 1, right: 2, up: 3 } as const;
const PLAZA_RECT = PLAZA_EVENING;

export class CampusScene extends Phaser.Scene {
  private save!: SaveData;
  private map!: number[][];
  private hud!: Hud;
  private panel!: Panel;
  private hungerWarnedAt = -1;
  private player!: Phaser.Physics.Arcade.Sprite;
  private dir = 0;
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'e' | 'm' | 't' | 'shift', Phaser.Input.Keyboard.Key>;
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private emoteTimer = 0;
  private fogLayer!: Phaser.Tilemaps.TilemapLayer;
  private revealed!: Uint8Array;
  private seen = new Set<string>();
  private discovered = new Set<string>();
  private labels = new Map<string, Phaser.GameObjects.Container>();
  private qmarks = new Map<string, Phaser.GameObjects.Image>();
  /** night overlay: a 2D canvas above the game (below the HUD) with soft holes cut around lights */
  private nightCanvas!: HTMLCanvasElement;
  private warmLights!: Phaser.GameObjects.Group;
  private darkAlpha = 0;
  private lightSpots: Array<{ x: number; y: number; r: number }> = [];
  private particles: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private particleSeason = '';
  private lastTile = { x: -1, y: -1 };
  private nearDoor: Location | null = null;
  private fast = false;
  private minuteAcc = 0;
  private saveTimer = 0;
  private mapTimer = 0;
  private npcs: Phaser.Physics.Arcade.Sprite[] = [];
  private npcNames = new Map<Phaser.Physics.Arcade.Sprite, Phaser.GameObjects.Text>();
  private nearNpc: NpcDef | null = null;
  private suitcase!: Phaser.GameObjects.Image;
  private announceQueue: string[] = [];
  private checking = false;
  private trackerTimer = 0;
  private target: { x: number; y: number } | null = null;
  private lastAllowed: { x: number; y: number } | null = null;
  private lastCurfewToast = 0;
  private groupId: string | null = null;
  private sleeping = false;
  /** online play (null = offline) */
  private net: NetUser | null = null;
  private mp: Multiplayer | null = null;
  private peers = new Map<string, { sprite: Phaser.GameObjects.Sprite; label: Phaser.GameObjects.Text; profile: PeerProfile; tx: number; ty: number; dir: number; moving: boolean; room: string; seen: boolean }>();
  /** which walkable interior you're in, if any */
  private room: 'dorm' | 'class' | 'dining' | null = null;
  private diners: Phaser.Physics.Arcade.Sprite[] = [];
  private cooks: Phaser.GameObjects.Sprite[] = [];
  private dinerKey = '';
  private tray: { meal: import('../game/state').MealId; name: string } | null = null;
  private trayImg!: Phaser.GameObjects.Image;
  private get inside() { return this.room !== null; }
  private classMates: Phaser.Physics.Arcade.Sprite[] = [];
  private teacher!: Phaser.Physics.Arcade.Sprite;
  private classLabels: Phaser.GameObjects.Text[] = [];
  private outdoorZoom = 1;
  private roomMates: Phaser.Physics.Arcade.Sprite[] = [];
  private roomBelletmen!: Phaser.Physics.Arcade.Sprite;
  private roomLabels: Phaser.GameObjects.Text[] = [];
  private nearRoomThing: string | null = null;
  private lastBell = -10_000;

  constructor() { super('campus'); }

  init(data: { save: SaveData; net?: NetUser | null }) {
    this.save = data.save;
    this.net = data.net ?? null;
    this.seen = new Set(this.save.seen);
    this.discovered = new Set(this.save.discovered);
  }

  create() {
    generateTextures(this);
    makeCharacterTexture(this, 'player', this.save.character.look);
    this.map = buildMap();

    // world tiles
    const tilemap = this.make.tilemap({ data: this.map, tileWidth: TILE, tileHeight: TILE });
    const tileset = tilemap.addTilesetImage(TILESET_KEY, TILESET_KEY, TILE, TILE, TILESET_MARGIN, TILESET_SPACING)!;
    const ground = tilemap.createLayer(0, tileset, 0, 0)!;
    ground.setCollision(SOLID_TILES);
    this.drawCourtLines();

    this.drawBuildingShading();

    // decor
    const trees = this.physics.add.staticGroup();
    for (const [x, y] of TREES) {
      const tree = trees.create(x * TILE + 16, y * TILE + 4, 'tree') as Phaser.Physics.Arcade.Sprite;
      tree.setDepth(y * TILE + 30);
      tree.body!.setSize(12, 8).setOffset(18, 44);
    }
    for (const [x, y] of BENCHES) this.add.image(x * TILE + 16, y * TILE + 16, 'bench').setDepth(y * TILE + 10);
    for (const [x, y] of FLOWERS) this.add.image(x * TILE + 16, y * TILE + 16, 'flowers').setDepth(y * TILE + 4);
    for (const [x, y] of LAMPS) {
      const lamp = trees.create(x * TILE + 16, y * TILE + 4, 'lamp') as Phaser.Physics.Arcade.Sprite;
      lamp.setDepth(y * TILE + 30);
      lamp.body!.setSize(6, 4).setOffset(5, 48);
      this.lightSpots.push({ x: x * TILE + 16, y: y * TILE - 12, r: 3 });
    }
    // landmarks: fountain on the central plaza crossing, flag for ceremonies
    if (!this.anims.exists('fountain-flow')) {
      this.anims.create({ key: 'fountain-flow', frames: this.anims.generateFrameNumbers('fountain', { frames: [0, 1] }), frameRate: 3, repeat: -1 });
      this.anims.create({ key: 'flag-wave', frames: this.anims.generateFrameNumbers('flag', { frames: [0, 1, 2, 1] }), frameRate: 5, repeat: -1 });
    }
    const fountain = trees.create(FOUNTAIN[0] * TILE, FOUNTAIN[1] * TILE + 8, 'fountain') as Phaser.Physics.Arcade.Sprite;
    fountain.setDepth(FOUNTAIN[1] * TILE + 30).play('fountain-flow');
    fountain.body!.setSize(56, 18).setOffset(8, 30);
    const flag = trees.create(FLAGPOLE[0] * TILE + 16, FLAGPOLE[1] * TILE - 16, 'flag') as Phaser.Physics.Arcade.Sprite;
    flag.setDepth(FLAGPOLE[1] * TILE + 40).play('flag-wave');
    flag.body!.setSize(6, 6).setOffset(5, 86);
    this.lightSpots.push({ x: FOUNTAIN[0] * TILE, y: FOUNTAIN[1] * TILE, r: 2.5 });
    // bushes along the building fronts, door lights
    for (const b of BUILDINGS) {
      const yb = b.rect.y + b.rect.h;
      for (let x = b.rect.x; x < b.rect.x + b.rect.w; x += 3) {
        if (this.map[yb]?.[x] === T.GROUND && this.map[yb]?.[x + 1] === T.GROUND) this.add.image(x * TILE + 32, yb * TILE + 10, 'bush').setDepth(yb * TILE + 12);
      }
    }
    for (const loc of LOCATIONS) { const d = loc.doors?.[0]; if (d) this.lightSpots.push({ x: d.x * TILE + 16, y: d.y * TILE + 24, r: 1.6 }); }
    this.warmLights = this.add.group();
    for (const l of this.lightSpots) this.warmLights.add(this.add.image(l.x, l.y, 'warm').setScale(l.r / 2.5).setDepth(200_001).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0));

    // player
    const p = this.save.player;
    this.player = this.physics.add.sprite(p.x * TILE, p.y * TILE, 'player', p.dir * 3);
    this.player.body!.setSize(16, 10).setOffset(8, 21);
    this.player.setCollideWorldBounds(true);
    this.dir = p.dir;
    this.physics.world.setBounds(0, 0, (DINING_OX + DINING_W) * TILE, MAP_H * TILE);
    this.physics.add.collider(this.player, ground);
    this.physics.add.collider(this.player, trees);
    this.createAnims();
    this.suitcase = this.add.image(0, 0, 'suitcase').setOrigin(0.5, 1);
    this.dust = this.add.particles(0, 0, 'puff', {
      lifespan: 450, speed: { min: 4, max: 14 }, angle: { min: 200, max: 340 }, scale: { start: 1, end: 0.2 }, alpha: { start: 0.55, end: 0 },
      frequency: 140, emitting: false,
    });
    this.dust.startFollow(this.player, 0, 13);
    this.spawnNpcs(ground, trees);
    this.createRoom(tileset);
    this.createClassroom();
    this.createDining();

    // building labels + "?" markers (hidden until seen/discovered)
    for (const loc of LOCATIONS) if (loc.kind !== 'room') this.createLabel(loc);

    // fog of war
    const fogMap = this.make.tilemap({ width: MAP_W, height: MAP_H, tileWidth: TILE, tileHeight: TILE });
    const fogTiles = fogMap.addTilesetImage(FOG_KEY, FOG_KEY, TILE, TILE, 0, 0)!;
    this.fogLayer = fogMap.createBlankLayer('fog', fogTiles)!;
    this.fogLayer.setDepth(100_000);
    this.revealed = decodeFog(this.save.fog);
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      if (!this.revealed[y * MAP_W + x]) this.fogLayer.putTileAt(FOG_FULL, x, y);
    }
    this.softenFogEdges(0, 0, MAP_W - 1, MAP_H - 1);

    // night: a dark layer with light holes cut out around lamps, doors and you
    this.nightCanvas = document.createElement('canvas');
    this.nightCanvas.className = 'night-layer';
    document.getElementById('game')!.appendChild(this.nightCanvas);
    this.events.once('shutdown', () => this.nightCanvas.remove());

    // camera
    const saved = this.save.player.inside;
    this.room = saved === true || saved === 'dorm' ? 'dorm' : saved === 'class' ? 'class' : saved === 'dining' ? 'dining' : null;
    // rooms can move between versions: resume at the room's entrance
    if (this.room === 'dorm') this.player.setPosition((ROOM_OX + ROOM_SPAWN[0]) * TILE, ROOM_SPAWN[1] * TILE);
    if (this.room === 'class') this.player.setPosition((CLASS_OX + CLASS_SPAWN[0]) * TILE, CLASS_SPAWN[1] * TILE);
    if (this.room === 'dining') this.player.setPosition((DINING_OX + DINING_SPAWN[0]) * TILE, DINING_SPAWN[1] * TILE);
    this.scale.on('resize', () => this.setCameraArea());
    this.setCameraArea();
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.outdoorZoom = 1; // 100% outdoors by default; the mouse wheel zooms
    this.setCameraArea();
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      if (this.blocked() || this.room) return; // rooms stay at 100%
      const cam = this.cameras.main;
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), 1, 2.5));
      if (!this.room) this.outdoorZoom = cam.zoom;
    });

    // input
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys({
      up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT', w: 'W', a: 'A', s: 'S', d: 'D', e: 'E', m: 'M', t: 'T', shift: 'SHIFT',
    }) as typeof this.keys;
    kb.on('keydown-E', () => this.interact());
    kb.on('keydown-M', () => { if (!this.hud.modalOpen && !this.panel.isOpen) this.hud.toggleMap(); });
    kb.on('keydown-C', () => { if (!this.blocked()) this.hud.showProfile(this.save.character, this.save.state); });
    kb.on('keydown-J', () => { if (!this.blocked()) this.showMissions(); });
    kb.on('keydown-R', () => { if (!this.blocked()) this.showRelationships(); });
    kb.on('keydown-ESC', () => this.hud.toggleMap(false));
    kb.on('keydown-T', () => {
      this.fast = !this.fast;
      this.hud.toast(this.fast ? t('fast_on') : t('fast_off'));
    });

    // HUD
    this.hud = new Hud(this.map);
    this.hud.onReset = () => { this.persist(); backupSave(); clearSave(); window.location.reload(); };
    this.hud.onProfile = () => { if (!this.blocked()) this.hud.showProfile(this.save.character, this.save.state); };
    void ATTRS; void CAUSES;
    this.hud.onMissions = () => { if (!this.blocked()) this.showMissions(); };
    this.hud.onRelationships = () => { if (!this.blocked()) this.showRelationships(); };
    this.panel = new Panel(this.hud.host, (open) => { this.player.setVelocity(0, 0); if (!open) this.checkMissions(); });
    this.panel.onRefuse = (why) => this.hud.toast(why);
    this.groupId = myGroup(this.save.state);
    this.panel.onRoomChange = (roomId) => {
      const room = LOCATIONS.find((l) => l.id === roomId && l.kind === 'room');
      if (room) this.discover(room);
    };
    this.hud.setName(`${this.save.character.first} ${this.save.character.last}`);
    onLangChange(() => this.refreshTexts());
    this.refreshTexts();

    if (!this.inside) this.revealAround(true);
    if (!this.discovered.has('ana_kapi')) this.discover(LOCATIONS.find((l) => l.id === 'ana_kapi')!, true);
    this.checkMissions();
    this.updateTracker();
    this.updateMaps();
    if (this.net) void this.goOnline();
  }

  // ---------- online: other real players ----------

  private roomKey(): string {
    return this.room === 'dorm' ? `dorm-${this.save.character.gender}` : this.room ?? 'campus';
  }

  private async goOnline() {
    const ch = this.save.character;
    const me: PeerProfile = { id: this.net!.id, name: ch.first, look: ch.look, grade: this.save.state.year + 3, gender: ch.gender };
    this.mp = new Multiplayer(me, {
      onJoin: (p) => {
        makeCharacterTexture(this, `peer-${p.id}`, { ...DEFAULT_LOOK, ...p.look });
        const sprite = this.add.sprite(0, 0, `peer-${p.id}`, 0).setVisible(false);
        const label = this.add.text(0, 0, `● ${p.name}`, {
          fontFamily: '"Pixelify Sans", system-ui, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#a8e6b0', stroke: '#1d2326', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(95_000).setVisible(false);
        this.peers.set(p.id, { sprite, label, profile: p, tx: 0, ty: 0, dir: 0, moving: false, room: '', seen: false });
        this.hud.toast(L({ tr: `🟢 ${p.name} oyuna katıldı`, en: `🟢 ${p.name} joined` }));
      },
      onLeave: (id) => {
        const peer = this.peers.get(id);
        if (!peer) return;
        this.hud.toast(L({ tr: `${peer.profile.name} oyundan çıktı`, en: `${peer.profile.name} left` }));
        peer.sprite.destroy(); peer.label.destroy();
        this.peers.delete(id);
      },
      onPos: (p: PeerPos) => {
        const peer = this.peers.get(p.id);
        if (!peer) return;
        peer.tx = p.x * TILE; peer.ty = p.y * TILE; peer.dir = p.dir; peer.moving = p.moving; peer.room = p.room;
        if (!peer.seen) { peer.sprite.setPosition(peer.tx, peer.ty); peer.seen = true; }
      },
      onChat: (id, name, text) => { this.hud.addChatLine(name, text); this.bubbleAbove(this.peers.get(id)?.sprite, text); },
      onEmote: (id, e) => this.bubbleAbove(this.peers.get(id)?.sprite, e),
    });
    const ok = await this.mp.connect();
    if (!ok) { this.hud.toast(L({ tr: 'Çevrimiçi bağlantı kurulamadı; tek başına oynuyorsun.', en: "Couldn't connect online; you're playing solo." })); this.mp = null; return; }
    this.hud.enableChat();
    this.hud.onChatSend = (text) => { this.mp?.chat(text); this.hud.addChatLine(ch.first, text, true); this.bubbleAbove(this.player, text); };
    this.input.keyboard!.on('keydown-ENTER', () => { if (!this.blocked()) { this.player.setVelocity(0, 0); this.hud.openChat(); } });
    this.hud.toast(L({ tr: '🟢 Çevrimiçisin. Enter ile sohbet et.', en: "🟢 You're online. Press Enter to chat." }), 'good');
  }

  private updatePeers(time: number) {
    if (!this.mp) return;
    const moving = (this.player.body?.velocity.length() ?? 0) > 1;
    this.mp.sendPos({ x: this.player.x / TILE, y: this.player.y / TILE, dir: this.dir, moving, room: this.roomKey() }, time);
    const here = this.roomKey();
    for (const peer of this.peers.values()) {
      const show = peer.seen && peer.room === here;
      peer.sprite.setVisible(show);
      peer.label.setVisible(show);
      if (!show) continue;
      // smooth towards the last reported position
      peer.sprite.x += (peer.tx - peer.sprite.x) * 0.2;
      peer.sprite.y += (peer.ty - peer.sprite.y) * 0.2;
      const step = peer.moving ? [1, 0, 2, 0][Math.floor(time / 130) % 4] : 0;
      peer.sprite.setFrame(peer.dir * 3 + step).setDepth(peer.sprite.y + 16);
      peer.label.setPosition(peer.sprite.x, peer.sprite.y - 24);
    }
  }

  private nearPeer() {
    for (const peer of this.peers.values()) {
      if (peer.sprite.visible && Phaser.Math.Distance.Between(peer.sprite.x, peer.sprite.y, this.player.x, this.player.y) < 1.7 * TILE) return peer;
    }
    return null;
  }

  /** a short speech bubble above someone (chat or emote) */
  private bubbleAbove(target: Phaser.GameObjects.Sprite | undefined, text: string) {
    if (!target || !target.visible) return;
    const b = this.add.text(target.x, target.y - 44, text.length > 40 ? `${text.slice(0, 38)}…` : text, {
      fontFamily: 'system-ui, sans-serif', fontSize: '12px', backgroundColor: '#ffffffee', color: '#1d2326', padding: { x: 5, y: 3 }, wordWrap: { width: 180 },
    }).setOrigin(0.5, 1).setDepth(97_000);
    this.tweens.add({ targets: b, alpha: 0, delay: 3500, duration: 400, onComplete: () => b.destroy() });
    this.time.addEvent({ delay: 16, repeat: 240, callback: () => b.active && b.setPosition(target.x, target.y - 44) });
  }

  // ---------- world building helpers ----------

  // ---------- dorm room (walkable interior) ----------

  private createRoom(tileset: Phaser.Tilemaps.Tileset) {
    const roomMap = this.make.tilemap({ data: buildRoom(), tileWidth: TILE, tileHeight: TILE });
    const ts = roomMap.addTilesetImage(TILESET_KEY, TILESET_KEY, TILE, TILE, TILESET_MARGIN, TILESET_SPACING)!;
    const layer = roomMap.createLayer(0, ts, ROOM_OX * TILE, 0)!;
    layer.setCollision(ROOM_SOLID as unknown as number[]);
    this.physics.add.collider(this.player, layer);
    void tileset;
    // your desk and bed get a little name tag
    const tag = (x: number, y: number, text: string) => this.roomLabels.push(this.add.text((ROOM_OX + x + 0.5) * TILE, (y + 0.1) * TILE, text, {
      fontFamily: 'system-ui, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#ffe7a8', stroke: '#1d2326', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(95_000));
    tag(MY_DESK[0], MY_DESK[1], L({ tr: 'Senin masan', en: 'Your desk' }));
    tag(MY_BED[0], MY_BED[1], L({ tr: 'Yatağın', en: 'Your bed' }));
    tag(MY_LOCKER[0], MY_LOCKER[1], L({ tr: 'Dolabın', en: 'Your locker' }));
    // classmates from your dorm sit at the other desks during study time
    const sameDorm = NPCS.filter((n) => (n.kind === 'classmate' || n.kind === 'student') && n.gender === this.save.character.gender);
    const seats = DESKS.filter(([x, y]) => !(x === MY_DESK[0] && y === MY_DESK[1]));
    seats.forEach(([x, y], i) => {
      const def = sameDorm[i % sameDorm.length];
      if (!def || i >= sameDorm.length) return;
      const sp = this.physics.add.sprite((ROOM_OX + x + 0.5) * TILE, (y + 1.35) * TILE, `npc-${def.id}`, 9).setDepth((y + 1) * TILE + 16);
      sp.body!.setSize(16, 10).setOffset(8, 21);
      sp.setImmovable(true);
      sp.setData('def', def);
      this.physics.add.collider(this.player, sp);
      this.roomMates.push(sp);
    });
    const belDef = BELLETMENS.find((b) => b.id === (this.save.character.gender === 'girl' ? 'bel-hatice' : 'bel-mehmet'))!;
    this.roomBelletmen = this.physics.add.sprite((ROOM_OX + BELLETMEN_ROUTE[0][0]) * TILE, BELLETMEN_ROUTE[0][1] * TILE, `npc-${belDef.id}`, 0);
    this.roomBelletmen.setData('def', belDef).setData('leg', 0);
  }

  private setCameraArea() {
    const cam = this.cameras.main;
    if (this.room) {
      // rooms at 100%, centred: pad the camera bounds evenly where the room is smaller than the window
      const dims = { dorm: [ROOM_OX, ROOM_W, ROOM_H], class: [CLASS_OX, CLASS_W, CLASS_H], dining: [DINING_OX, DINING_W, DINING_H] }[this.room];
      const ox = dims[0] * TILE, w = dims[1] * TILE, h = dims[2] * TILE;
      cam.setZoom(1);
      const vw = this.scale.width, vh = this.scale.height;
      const bw = Math.max(w, vw), bh = Math.max(h, vh);
      cam.setBounds(ox - (bw - w) / 2, -(bh - h) / 2, bw, bh);
    } else {
      cam.setZoom(this.outdoorZoom);
      cam.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
    }
  }

  private ownDormLoc() {
    return LOCATIONS.find((l) => l.id === (this.save.character.gender === 'girl' ? 'kiz_yurdu' : 'erkek_yurdu'))!;
  }

  // ---------- dining hall (Yemekhane) ----------

  private createDining() {
    const map = this.make.tilemap({ data: buildDining(), tileWidth: TILE, tileHeight: TILE });
    const ts = map.addTilesetImage(TILESET_KEY, TILESET_KEY, TILE, TILE, TILESET_MARGIN, TILESET_SPACING)!;
    const layer = map.createLayer(0, ts, DINING_OX * TILE, 0)!;
    layer.setCollision([...ROOM_SOLID, ...DINING_SOLID] as unknown as number[]);
    this.physics.add.collider(this.player, layer);
    // a pool of diners; who sits where is reshuffled every meal
    for (let i = 0; i < 26; i++) {
      const sp = this.physics.add.sprite(0, 0, `npc-${NPCS[i % NPCS.length].id}`, 0).setVisible(false);
      sp.body!.setSize(16, 10).setOffset(8, 21);
      sp.setImmovable(true);
      sp.body!.enable = false;
      this.physics.add.collider(this.player, sp);
      this.diners.push(sp);
    }
    const cookLook = { skin: '#d9a77d', hair: '#f4f4f0', hairStyle: 1 as const, top: '#f4f4f0', bottom: '#8b9196', skirt: false };
    makeCharacterTexture(this, 'cook', { ...DEFAULT_LOOK, ...cookLook });
    for (const [x, y] of COOKS) this.cooks.push(this.add.sprite((DINING_OX + x + 0.5) * TILE, y * TILE, 'cook', 0).setDepth(y * TILE + 16));
    this.trayImg = this.add.image(0, 0, 'tray').setVisible(false);
  }

  /** seats the diners for the current meal (or empties the hall) */
  private seatDiners() {
    const m = currentMeal(this.gameCtx());
    const key = m ? `${this.save.clock.day}-${m.meal}` : '';
    if (key === this.dinerKey) return;
    this.dinerKey = key;
    this.diners.forEach((d) => { d.setVisible(false); d.body!.enable = false; d.setData('def', null); });
    if (!m) return;
    // classmates more likely, then everyone else; leave plenty of seats free
    const away = awayForWeekend(this.save.clock.day, this.save.clock.minutes);
    const pool = NPCS.filter((n) => !(away && npcIsEvci(n))).sort(() => Math.random() - 0.5).sort((a, b) => (a.kind === 'classmate' ? -1 : 0) - (b.kind === 'classmate' ? -1 : 0));
    const seats = [...SEATS].sort(() => Math.random() - 0.5).slice(0, this.diners.length);
    this.diners.forEach((sp, i) => {
      const def = pool[i], seat = seats[i];
      if (!def || !seat) return;
      sp.setTexture(`npc-${def.id}`, seat.faces * 3).setPosition((DINING_OX + seat.x + 0.5) * TILE, (seat.y + 0.35) * TILE)
        .setDepth((seat.y + 0.4) * TILE + 16).setVisible(true);
      sp.body!.enable = true;
      sp.setData('def', def).setData('seat', seat);
    });
  }

  private enterDining() {
    if (!this.room) this.outdoorZoom = this.cameras.main.zoom;
    this.room = 'dining';
    this.player.setPosition((DINING_OX + DINING_SPAWN[0]) * TILE, DINING_SPAWN[1] * TILE).setVelocity(0, 0);
    this.dir = 3;
    this.setCameraArea();
    this.cameras.main.fadeIn(280, 10, 14, 20);
    this.hud.setPrompt(null);
    const m = currentMeal(this.gameCtx());
    this.hud.toast(m
      ? L({ tr: `${m.name} servisi var: ellerini yıka, tezgâhtan tepsini al ve boş bir yere otur.`, en: `${m.name} is being served: wash your hands, get a tray at the counter and find a free seat.` })
      : L({ tr: 'Şu an servis yok. Kantin sağ köşede.', en: 'Nothing is being served right now. The canteen is in the right corner.' }));
    this.persist();
  }

  private updateDining(time: number) {
    this.seatDiners();
    const serving = !!currentMeal(this.gameCtx());
    for (const d of this.diners) {
      if (!d.visible) continue;
      const seat = d.getData('seat') as { faces: number };
      d.setFrame(seat.faces * 3 + (Math.floor(time / 500 + d.x) % 7 === 0 ? 1 : 0)); // munching
    }
    this.cooks.forEach((c, i) => c.setVisible(serving).setFrame(Math.floor(time / 900 + i) % 5 === 0 ? 1 : 0));
    // carry your tray
    this.trayImg.setVisible(this.room === 'dining' && !!this.tray);
    if (this.tray) this.trayImg.setPosition(this.player.x, this.player.y + 4).setDepth(this.player.y + 18);
    if (this.tray && !serving) { this.tray = null; this.hud.toast(L({ tr: 'Servis bitti; tepsini geri bıraktın.', en: 'Serving is over; you put your tray back.' })); }
  }

  private freeSeatNear(): { x: number; y: number; faces: 0 | 3 } | null {
    const px = this.player.x / TILE - DINING_OX, py = this.player.y / TILE;
    let best: { x: number; y: number; faces: 0 | 3 } | null = null, bestD = 1.2;
    for (const seat of SEATS) {
      const taken = this.diners.some((d) => d.visible && d.getData('seat') === seat);
      if (taken) continue;
      const d = Math.hypot(px - (seat.x + 0.5), py - (seat.y + 0.5));
      if (d < bestD) { bestD = d; best = seat; }
    }
    return best;
  }

  private diningThingNear(): { id: string; label: string; npc?: NpcDef } | null {
    const px = this.player.x / TILE - DINING_OX, py = this.player.y / TILE + 0.3;
    const near = (x: number, y: number, r = 1.3) => Math.hypot(px - (x + 0.5), py - (y + 0.5)) < r;
    if (this.tray && this.freeSeatNear()) return { id: 'seat', label: L({ tr: 'Otur ve ye', en: 'Sit down and eat' }) };
    if (COUNTER_TILES.some(([x, y]) => near(x, y + 0.9, 1))) return { id: 'counter', label: this.tray ? L({ tr: 'Tepsin elinde: boş bir yere otur', en: 'You have your tray: find a free seat' }) : L({ tr: 'Tepsini al', en: 'Get a tray' }) };
    if (SINKS.some(([x, y]) => near(x + 0.8, y, 1.1))) return { id: 'sink', label: L({ tr: 'Ellerini yıka', en: 'Wash your hands' }) };
    if (KANTIN_TILES.some(([x, y]) => near(x, y - 0.8, 1.1))) return { id: 'kantin', label: L({ tr: 'Kantin', en: 'Canteen' }) };
    for (const d of this.diners) {
      if (d.visible && Phaser.Math.Distance.Between(d.x, d.y, this.player.x, this.player.y) < 1.4 * TILE) {
        const def = d.getData('def') as NpcDef;
        return { id: 'diner', label: def.name, npc: def };
      }
    }
    if (DINING_EXIT.some(([x, y]) => near(x, y - 0.6, 1.3))) return { id: 'exit', label: L({ tr: 'Kapı · merdivenler', en: 'Door · stairs' }) };
    return null;
  }

  private interactDining() {
    const th = this.diningThingNear();
    if (!th) return;
    this.player.setVelocity(0, 0);
    const ctx = this.gameCtx();
    switch (th.id) {
      case 'counter': {
        if (this.tray) { this.hud.toast(th.label); break; }
        const lock = trayLock(ctx);
        if (lock) { this.hud.toast(lock); break; }
        this.tray = currentMeal(ctx);
        sfx.click();
        this.hud.toast(L({ tr: `${this.tray!.name} tepsin hazır! Boş bir yere otur.`, en: `Your ${this.tray!.name.toLowerCase()} tray is ready! Find a free seat.` }), 'good');
        break;
      }
      case 'seat': {
        const seat = this.freeSeatNear()!;
        const mates = this.diners.filter((d) => d.visible && Math.abs((d.getData('seat') as { x: number }).x - seat.x) <= 1
          && Math.abs((d.getData('seat') as { y: number }).y - seat.y) <= 2).map((d) => d.getData('def') as NpcDef).slice(0, 4);
        const tray = this.tray!;
        this.tray = null;
        this.player.setPosition((DINING_OX + seat.x + 0.5) * TILE, (seat.y + 0.35) * TILE);
        this.dir = seat.faces;
        eatMeal(ctx, tray.meal, tray.name, mates);
        break;
      }
      case 'sink': washHands(ctx); break;
      case 'kantin': this.panel.open(() => yemekhane(ctx, 'kantin')); break;
      case 'diner': this.nearNpc = th.npc!; this.panel.open(() => npcPanel(th.npc!, ctx)); break;
      case 'exit': this.panel.open(() => yemekhane(ctx, 'exit')); break;
    }
  }

  // ---------- classroom (Eğitim Binası) ----------

  private createClassroom() {
    const map = this.make.tilemap({ data: buildClassroom(), tileWidth: TILE, tileHeight: TILE });
    const ts = map.addTilesetImage(TILESET_KEY, TILESET_KEY, TILE, TILE, TILESET_MARGIN, TILESET_SPACING)!;
    const layer = map.createLayer(0, ts, CLASS_OX * TILE, 0)!;
    layer.setCollision(ROOM_SOLID as unknown as number[]);
    this.physics.add.collider(this.player, layer);
    this.classLabels.push(this.add.text((CLASS_OX + MY_CLASS_DESK[0] + 0.5) * TILE, (MY_CLASS_DESK[1] + 0.1) * TILE, L({ tr: 'Senin sıran', en: 'Your desk' }), {
      fontFamily: 'system-ui, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#ffe7a8', stroke: '#1d2326', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(95_000));
    const mates = NPCS.filter((n) => n.kind === 'classmate');
    const seats = CLASS_DESKS.filter(([x, y]) => !(x === MY_CLASS_DESK[0] && y === MY_CLASS_DESK[1]));
    mates.forEach((def, i) => {
      const [x, y] = seats[i % seats.length];
      const sp = this.physics.add.sprite((CLASS_OX + x + 0.5) * TILE, (y + 1.35) * TILE, `npc-${def.id}`, 9).setDepth((y + 1) * TILE + 16);
      sp.body!.setSize(16, 10).setOffset(8, 21);
      sp.setImmovable(true);
      sp.setData('def', def);
      this.physics.add.collider(this.player, sp);
      this.classMates.push(sp);
    });
    for (const [id, tch] of Object.entries(TEACHERS)) makeCharacterTexture(this, `teacher-${id}`, { ...DEFAULT_LOOK, ...tch.look });
    this.teacher = this.physics.add.sprite((CLASS_OX + TEACHER_ROUTE[0][0]) * TILE, TEACHER_ROUTE[0][1] * TILE, 'teacher-matematik', 0);
    this.teacher.setData('leg', 0);
  }

  private currentLesson() {
    const c = this.save.clock;
    const p = currentPeriod(c.day, c.minutes);
    if (p?.kind !== 'lesson') return null;
    const subject = subjectFor(c.day, p.id);
    return { p, subject, teacher: TEACHERS[subject] };
  }

  private enterClass() {
    if (!this.room) this.outdoorZoom = this.cameras.main.zoom;
    this.room = 'class';
    this.player.setPosition((CLASS_OX + CLASS_SPAWN[0]) * TILE, CLASS_SPAWN[1] * TILE).setVelocity(0, 0);
    this.dir = 3;
    this.setCameraArea();
    this.cameras.main.fadeIn(280, 10, 14, 20);
    this.hud.setPrompt(null);
    const les = this.currentLesson();
    if (les && reached('derse_gir', this.mc())) {
      const sname = L(SUBJECTS.find((x) => x.id === les.subject)!.name);
      this.hud.toast(L({ tr: `${sname} dersi · ${les.teacher.name}. Sırana otur!`, en: `${sname} with ${les.teacher.name}. Take your seat!` }));
    }
    this.persist();
  }

  private updateClass(time: number) {
    const les = this.currentLesson();
    const inClass = !!les && !!this.save.state.once.classDrawn;
    for (const sp of this.classMates) {
      sp.setVisible(inClass);
      sp.body!.enable = inClass;
      sp.setFrame(9 + (inClass && Math.floor(time / 650 + sp.x) % 6 === 0 ? 1 : 0));
    }
    this.classLabels.forEach((l) => l.setVisible(this.room === 'class'));
    const t = this.teacher;
    t.setVisible(!!les);
    if (!les) { t.setVelocity(0, 0); return; }
    if (t.texture.key !== `teacher-${les.subject}`) t.setTexture(`teacher-${les.subject}`, 0);
    const leg = t.getData('leg') as number;
    const [tx, ty] = TEACHER_ROUTE[leg % TEACHER_ROUTE.length];
    const gx = (CLASS_OX + tx) * TILE, gy = ty * TILE;
    if (Math.hypot(gx - t.x, gy - t.y) < 6) { t.setData('leg', leg + 1); t.setData('pause', time + 2500); }
    if ((t.getData('pause') ?? 0) > time) { t.setVelocity(0, 0); t.setFrame(0); }
    else {
      const a = Math.atan2(gy - t.y, gx - t.x);
      t.setVelocity(Math.cos(a) * 35, Math.sin(a) * 35);
      t.setFrame((t.body!.velocity.x < 0 ? 1 : 2) * 3 + [1, 0, 2, 0][Math.floor(time / 170) % 4]);
    }
    t.setDepth(t.y + 16);
  }

  private classThingNear(): { id: string; label: string; npc?: NpcDef } | null {
    const px = this.player.x / TILE - CLASS_OX, py = this.player.y / TILE + 0.3;
    const near = (x: number, y: number, r = 1.3) => Math.hypot(px - (x + 0.5), py - (y + 0.5)) < r;
    const les = this.currentLesson();
    if (les && this.teacher.visible && Phaser.Math.Distance.Between(this.teacher.x, this.teacher.y, this.player.x, this.player.y) < 1.7 * TILE) {
      return { id: 'teacher', label: L({ tr: `${les.teacher.name} ile konuş`, en: `talk to ${les.teacher.name}` }) };
    }
    for (const sp of this.classMates) {
      if (sp.visible && Phaser.Math.Distance.Between(sp.x, sp.y, this.player.x, this.player.y) < 1.5 * TILE) {
        const def = sp.getData('def') as NpcDef;
        return { id: 'mate', label: def.name, npc: def };
      }
    }
    if (near(MY_CLASS_DESK[0], MY_CLASS_DESK[1] + 0.8)) return { id: 'desk', label: L({ tr: 'Sırana otur', en: 'Sit at your desk' }) };
    if (CLASS_EXIT.some(([x, y]) => near(x, y - 0.6, 1.3))) return { id: 'exit', label: L({ tr: 'Koridora çık', en: 'Go to the corridor' }) };
    return null;
  }

  private interactClass() {
    const th = this.classThingNear();
    if (!th) return;
    this.player.setVelocity(0, 0);
    const ctx = this.gameCtx();
    const les = this.currentLesson();
    switch (th.id) {
      case 'desk': this.panel.open(() => egitim(ctx, 'desk')); break;
      case 'exit': this.panel.open(() => egitim(ctx, 'corridor')); break;
      case 'teacher':
        this.hud.showModal({
          title: les!.teacher.name, sub: L(SUBJECTS.find((x) => x.id === les!.subject)!.name),
          body: L({ tr: '"Ders başladı! Hadi sırana geç, bugün güzel bir konumuz var."', en: '"Class has started! Go to your desk, we have a great topic today."' }),
          button: L({ tr: 'Tamam', en: 'OK' }),
        });
        break;
      case 'mate':
        this.hud.toast(L({ tr: `${th.npc!.name}: "Şşş! Ders var, sonra konuşuruz."`, en: `${th.npc!.name}: "Shh! We're in class, talk later."` }));
        break;
    }
  }

  /** walk into your dorm room */
  private enterDorm() {
    if (!this.room) this.outdoorZoom = this.cameras.main.zoom;
    this.room = 'dorm';
    this.player.setPosition((ROOM_OX + ROOM_SPAWN[0]) * TILE, ROOM_SPAWN[1] * TILE).setVelocity(0, 0);
    this.dir = 3;
    this.setCameraArea();
    this.cameras.main.fadeIn(280, 10, 14, 20);
    this.hud.setPrompt(null);
    if (!this.save.state.once.luggage) this.hud.toast(L({ tr: 'Yatağın sağdaki yatakhanede (sarı etiket). Bavulunu oraya götür.', en: 'Your bed is in the sleeping room on the right (yellow tag). Take your suitcase there.' }));
    else if (phaseOf(this.save.clock.minutes) === 'night') {
      const mm = this.save.clock.minutes;
      const late = mm >= 22 * 60 ? mm - 22 * 60 : mm + 120;
      const bel = this.save.character.gender === 'girl' ? 'Hatice Hanım' : 'Mehmet Bey';
      if (late >= 5) this.hud.toast(L({ tr: `${bel} kapıda bekliyordu: "${late} dakika geç! Hemen yatağına."`, en: `${bel} was waiting at the door: "${late} minutes late! Straight to bed."` }));
    }
    else if (phaseOf(this.save.clock.minutes) === 'etut') {
      const late = this.save.clock.minutes - 18 * 60;
      const bel = this.save.character.gender === 'girl' ? 'Hatice Hanım' : 'Mehmet Bey';
      this.hud.toast(late >= 5
        ? L({ tr: `${bel} saatine bakıyor: "${late} dakika geç kaldın. Otur yerine."`, en: `${bel} checks the time: "You're ${late} minutes late. Sit down."` })
        : L({ tr: 'Etüt saati: masana otur ya da sınıf arkadaşlarınla (dikkatli) konuş.', en: 'Study time: sit at your desk, or (carefully) talk to your classmates.' }));
    }
    this.persist();
  }

  /** step out of whichever room you're in */
  private leaveDorm() {
    const from = this.room;
    this.room = null;
    const loc = from === 'class' ? LOCATIONS.find((l) => l.id === 'egitim')! : from === 'dining' ? LOCATIONS.find((l) => l.id === 'yemekhane')! : this.ownDormLoc();
    this.tray = null;
    const stand = doorStandTile(loc.doors![0]);
    this.player.setPosition((stand.x + 0.5) * TILE, (stand.y + 0.5) * TILE).setVelocity(0, 0);
    this.setCameraArea();
    this.cameras.main.fadeIn(280, 10, 14, 20);
    this.lastTile = { x: -1, y: -1 };
    this.persist();
  }

  /** where you are on the campus map (your dorm door while inside) */
  private campusPos(): { x: number; y: number } {
    if (!this.inside) return { x: this.player.x / TILE, y: this.player.y / TILE };
    const s = doorStandTile((this.room === 'class' ? LOCATIONS.find((l) => l.id === 'egitim')! : this.room === 'dining' ? LOCATIONS.find((l) => l.id === 'yemekhane')! : this.ownDormLoc()).doors![0]);
    return { x: s.x + 0.5, y: s.y + 0.5 };
  }

  private updateRoom(time: number) {
    const phase = phaseOf(this.save.clock.minutes);
    const study = phase === 'etut';
    const awayNow = awayForWeekend(this.save.clock.day, this.save.clock.minutes);
    for (const sp of this.roomMates) {
      const here = study && !(awayNow && npcIsEvci(sp.getData('def') as NpcDef));
      sp.setVisible(here);
      sp.body!.enable = here;
      // heads down, writing: a tiny bob now and then
      sp.setFrame(9 + (study && Math.floor(time / 700 + sp.x) % 5 === 0 ? 1 : 0));
    }
    const bel = this.roomBelletmen;
    const onDuty = phase !== 'day';
    bel.setVisible(onDuty);
    if (!onDuty) { bel.setVelocity(0, 0); return; }
    const leg = bel.getData('leg') as number;
    const [tx, ty] = BELLETMEN_ROUTE[leg % BELLETMEN_ROUTE.length];
    const gx = (ROOM_OX + tx) * TILE, gy = ty * TILE;
    const d = Math.hypot(gx - bel.x, gy - bel.y);
    if (d < 6) bel.setData('leg', leg + 1);
    const a = Math.atan2(gy - bel.y, gx - bel.x);
    const speed = phase === 'night' ? 30 : 42;
    bel.setVelocity(Math.cos(a) * speed, Math.sin(a) * speed);
    const vx = bel.body!.velocity.x, vy = bel.body!.velocity.y;
    const dir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 1 : 2) : vy < 0 ? 3 : 0;
    bel.setFrame(dir * 3 + [1, 0, 2, 0][Math.floor(time / 160) % 4]).setDepth(bel.y + 16);
    this.roomLabels.forEach((l) => l.setVisible(this.room === 'dorm'));
  }

  /** what you can interact with inside the room */
  private roomThingNear(): { id: string; label: string; npc?: NpcDef } | null {
    const px = this.player.x / TILE - ROOM_OX, py = this.player.y / TILE + 0.3;
    const near = (x: number, y: number, r = 1.3) => Math.hypot(px - (x + 0.5), py - (y + 0.5)) < r;
    const bel = this.roomBelletmen;
    if (bel.visible && Phaser.Math.Distance.Between(bel.x, bel.y, this.player.x, this.player.y) < 1.6 * TILE) {
      const def = bel.getData('def') as NpcDef;
      return { id: 'belletmen', label: L({ tr: `${def.name} ile konuş`, en: `talk to ${def.name}` }), npc: def };
    }
    for (const sp of this.roomMates) {
      if (!sp.visible) continue;
      if (Phaser.Math.Distance.Between(sp.x, sp.y, this.player.x, this.player.y) < 1.5 * TILE) {
        const def = sp.getData('def') as NpcDef;
        return { id: 'mate', label: L({ tr: `${def.name} ile…`, en: `${def.name}…` }), npc: def };
      }
    }
    if (near(MY_DESK[0], MY_DESK[1] + 0.8)) return { id: 'desk', label: L({ tr: 'Masana otur', en: 'Sit at your desk' }) };
    if (near(MY_BED[0], MY_BED[1], 1.6)) return { id: 'bed', label: L({ tr: 'Yatağın', en: 'Your bed' }) };
    if (near(MY_LOCKER[0], MY_LOCKER[1] - 0.6, 1.5)) return { id: 'locker', label: L({ tr: 'Dolabın', en: 'Your locker' }) };
    if (near(TV_SPOT[0], TV_SPOT[1] - 0.4, 1.5)) return { id: 'tv', label: L({ tr: 'Televizyon', en: 'TV' }) };
    if (EXIT.some(([x, y]) => near(x, y - 0.6, 1.3))) return { id: 'exit', label: L({ tr: 'Kapı', en: 'Door' }) };
    return null;
  }

  private interactRoom() {
    const thing = this.roomThingNear();
    if (!thing) return;
    this.player.setVelocity(0, 0);
    const ctx = this.gameCtx();
    switch (thing.id) {
      case 'belletmen': this.nearNpc = thing.npc!; this.panel.open(() => npcPanel(thing.npc!, ctx)); break;
      case 'mate': this.panel.open(() => matePanel(thing.npc!, ctx)); break;
      case 'desk': this.panel.open(() => deskPanel(ctx)); break;
      case 'bed': this.panel.open(() => bedPanel(ctx)); break;
      case 'locker': this.panel.open(() => lockerPanel(ctx)); break;
      case 'tv': this.panel.open(() => tvPanel(ctx)); break;
      case 'exit': this.panel.open(() => exitPanel(ctx)); break;
    }
  }

  private drawCourtLines() {
    const g = this.add.graphics().setDepth(1);
    g.lineStyle(2, 0xf2f2ea, 0.9);
    for (const r of [COURTS.basketball, COURTS.tennis]) {
      const x = r.x * TILE + 8, y = r.y * TILE + 8, w = r.w * TILE - 16, h = r.h * TILE - 16;
      g.strokeRect(x, y, w, h);
      g.lineBetween(x + w / 2, y, x + w / 2, y + h);
    }
    const b = COURTS.basketball;
    g.strokeCircle((b.x + b.w / 2) * TILE, (b.y + b.h / 2) * TILE, 40);
    const tn = COURTS.tennis;
    g.lineBetween(tn.x * TILE + 8, (tn.y + 2) * TILE, (tn.x + tn.w) * TILE - 8, (tn.y + 2) * TILE);
    g.lineBetween(tn.x * TILE + 8, (tn.y + tn.h - 2) * TILE, (tn.x + tn.w) * TILE - 8, (tn.y + tn.h - 2) * TILE);
    g.lineStyle(3, 0xffffff, 1);
    g.lineBetween((tn.x + tn.w / 2) * TILE, tn.y * TILE + 4, (tn.x + tn.w / 2) * TILE, (tn.y + tn.h) * TILE - 4);
  }

  private createAnims() {
    const names = ['down', 'left', 'right', 'up'] as const;
    names.forEach((n, dir) => {
      const key = `player-walk-${n}`;
      if (this.anims.exists(key)) return;
      this.anims.create({ key, frames: this.anims.generateFrameNumbers('player', { frames: [dir * 3 + 1, dir * 3, dir * 3 + 2, dir * 3] }), frameRate: 8, repeat: -1 });
    });
  }

  /** nearest walkable tile to (x, y) */
  private walkable(x: number, y: number): [number, number] {
    for (let r = 0; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const tx = Math.round(x + dx), ty = Math.round(y + dy);
      if (tx > 4 && ty > 4 && tx < MAP_W - 5 && ty < MAP_H - 5 && !SOLID_TILES.includes(this.map[ty][tx] as never)) return [tx, ty];
    }
    return [x, y];
  }

  private spawnNpcs(ground: Phaser.Tilemaps.TilemapLayer, trees: Phaser.Physics.Arcade.StaticGroup) {
    const plaza = PLAZA_RECT;
    for (const def of [...NPCS, ...BELLETMENS]) {
      const key = `npc-${def.id}`;
      makeCharacterTexture(this, key, { ...DEFAULT_LOOK, ...def.look });
      const [x, y] = this.walkable(def.home[0], def.home[1]);
      const npc = this.physics.add.sprite(x * TILE, y * TILE, key, 0);
      npc.body!.setSize(16, 10).setOffset(8, 21);
      npc.setCollideWorldBounds(true);
      this.physics.add.collider(npc, ground);
      this.physics.add.collider(npc, trees);
      npc.setData('def', def);
      npc.setData('next', 0);
      npc.setData('dayHome', [x, y]);
      npc.setData('dayRoam', def.roam);
      if (def.kind !== 'belletmen' && !def.fixed) this.pickDayHome(npc);
      // evening spot around the dorms (20:00–22:00)
      this.pickEveningHome(npc);
      void plaza;
      this.npcs.push(npc);
      const name = this.add.text(npc.x, npc.y - 26, def.name, {
        fontFamily: '"Pixelify Sans", system-ui, sans-serif', fontSize: '12px', fontStyle: 'bold',
        color: def.kind === 'belletmen' ? '#ffb3a8' : def.kind === 'abi' ? '#ffe7a8' : '#ffffff',
        stroke: '#1d2326', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(95_000);
      this.npcNames.set(npc, name);
    }
  }

  /** by day students stay near their age group's lawn; about a third drift to the mixed plazas in the middle */
  private pickDayHome(npc: Phaser.Physics.Arcade.Sprite) {
    const def = npc.getData('def') as NpcDef;
    const centre = Math.random() < 0.35;
    const zones = centre ? CENTER_ZONES : AGE_ZONES[ageGroup(def)];
    const z = zones[Math.floor(Math.random() * zones.length)];
    const home = this.walkable(z.x + Math.random() * (z.w - 1), z.y + Math.random() * (z.h - 1));
    npc.setData('dayHome', home);
    npc.setData('dayRoam', centre ? 3 : 2);
  }

  /** 20:00–22:00: each grade has its own spot around the dorms; about a third join the mixed crowd on the dorm plaza */
  private pickEveningHome(npc: Phaser.Physics.Arcade.Sprite) {
    const def = npc.getData('def') as NpcDef;
    const g = def.grade ?? 4;
    const z = def.fixed || Math.random() < 0.35 ? EVENING_CENTER : EVENING_ZONES[g >= 9 ? 'lise' : (String(g) as '4' | '5' | '6' | '7' | '8')];
    npc.setData('plazaHome', this.walkable(z.x + Math.random() * (z.w - 1), z.y + Math.random() * (z.h - 1)));
  }

  /** little speech bubbles above students' heads */
  private showEmote() {
    if (this.room) return;
    const view = this.cameras.main.worldView;
    const visible = this.npcs.filter((n) => n.visible && view.contains(n.x, n.y) && (n.getData('def') as NpcDef).kind !== 'belletmen');
    if (!visible.length) return;
    const npc = visible[Math.floor(Math.random() * visible.length)];
    const phase = phaseOf(this.save.clock.minutes);
    const sets = { day: ['💬', '⚽', '😂', '📚', '🎵', '❗', '🍎', '👋'], plaza: ['😂', '💬', '🌙', '🃏', '🎶', '🤫'], etut: ['📖'], night: ['💤'] } as const;
    const pool = sets[phase];
    const bubble = this.add.text(npc.x, npc.y - 40, pool[Math.floor(Math.random() * pool.length)], {
      fontSize: '15px', backgroundColor: '#ffffffee', padding: { x: 4, y: 2 }, color: '#1d2326',
    }).setOrigin(0.5).setDepth(96_000).setAlpha(0);
    this.tweens.add({ targets: bubble, alpha: 1, y: npc.y - 46, duration: 250 });
    this.tweens.add({ targets: bubble, alpha: 0, delay: 1900, duration: 300, onComplete: () => bubble.destroy() });
  }

  /** where an NPC should be right now (null = indoors / asleep) */
  private npcPlan(def: NpcDef, phase: DayPhase, lessonNow: boolean, npc: Phaser.Physics.Arcade.Sprite): { home: [number, number]; roam: number } | null {
    if (def.kind === 'belletmen') {
      if (phase === 'day') return null;
      if (def.id === 'bel-selim') return phase === 'night' ? { home: npc.getData('patrol') ?? PATROL_ROUTE[0], roam: 0 } : { home: [37, 12], roam: 5 };
      return { home: npc.getData('dayHome'), roam: 1 };
    }
    if (npcIsEvci(def) && awayForWeekend(this.save.clock.day, this.save.clock.minutes)) return null; // home for the weekend
    if (phase === 'etut' || phase === 'night') return null;
    if (phase === 'plaza') return { home: npc.getData('plazaHome'), roam: 3 };
    if (lessonNow && def.kind === 'classmate' && this.save.state.once.classDrawn) return null; // they're in class
    return { home: npc.getData('dayHome'), roam: npc.getData('dayRoam') ?? def.roam };
  }

  private updateNpcs(time: number) {
    const c = this.save.clock;
    const phase = phaseOf(c.minutes);
    const lessonNow = currentPeriod(c.day, c.minutes)?.kind === 'lesson';
    // the night patrol walks a loop around the campus
    const route = PATROL_ROUTE;
    const leg = Math.floor(time / 9000) % route.length;
    for (const npc of this.npcs) {
      const def = npc.getData('def') as NpcDef;
      if (def.id === 'bel-selim') npc.setData('patrol', route[leg]);
      const plan = this.npcPlan(def, phase, lessonNow, npc);
      const label = this.npcNames.get(npc)!;
      if (!plan) {
        if (npc.visible) { npc.setVisible(false); npc.body!.enable = false; npc.setVelocity(0, 0); }
        label.setVisible(false);
        continue;
      }
      if (!npc.visible) {
        // reappear at their spot instead of walking across campus
        npc.setPosition(plan.home[0] * TILE, plan.home[1] * TILE).setVisible(true);
        npc.body!.enable = true;
      }
      const talking = this.panel.isOpen && this.nearNpc?.id === def.id;
      const hx = plan.home[0] * TILE, hy = plan.home[1] * TILE;
      if (talking) {
        npc.setVelocity(0, 0);
      } else if (plan.roam === 0 || Math.hypot(npc.x - hx, npc.y - hy) > (plan.roam + 3) * TILE) {
        // walk (back) to the spot
        const d = Math.hypot(npc.x - hx, npc.y - hy);
        if (d < 6) npc.setVelocity(0, 0);
        else { const a = Math.atan2(hy - npc.y, hx - npc.x); npc.setVelocity(Math.cos(a) * 70, Math.sin(a) * 70); }
      } else if (time > npc.getData('next')) {
        const idle = Math.random() < (def.kind === 'abi' || def.kind === 'belletmen' ? 0.7 : 0.4);
        if (idle) npc.setVelocity(0, 0);
        else {
          const tx = (plan.home[0] + Phaser.Math.Between(-plan.roam, plan.roam)) * TILE;
          const ty = (plan.home[1] + Phaser.Math.Between(-plan.roam, plan.roam)) * TILE;
          const a = Phaser.Math.Angle.Between(npc.x, npc.y, tx, ty);
          npc.setVelocity(Math.cos(a) * 55, Math.sin(a) * 55);
        }
        npc.setData('next', time + Phaser.Math.Between(1200, 3200));
      }
      const vx = npc.body!.velocity.x, vy = npc.body!.velocity.y;
      const moving = Math.abs(vx) + Math.abs(vy) > 1;
      let dir = !moving ? npc.getData('dir') ?? 0 : Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 1 : 2) : vy < 0 ? 3 : 0;
      if (talking) { const dx = this.player.x - npc.x, dy = this.player.y - npc.y; dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0; }
      npc.setData('dir', dir);
      const step = moving ? [1, 0, 2, 0][Math.floor(time / 130) % 4] : 0;
      npc.setFrame(dir * 3 + step);
      npc.setDepth(npc.y + 16);
      const star = def.kind === 'classmate' && this.save.state.once.classDrawn ? '★ ' : '';
      if (label.text !== star + def.name) label.setText(star + def.name);
      label.setPosition(npc.x, npc.y - 24);
      const near = Phaser.Math.Distance.Between(npc.x, npc.y, this.player.x, this.player.y) < 4 * TILE;
      label.setVisible(near && this.revealed[Math.floor(npc.y / TILE) * MAP_W + Math.floor(npc.x / TILE)] === 1);
    }
  }

  private createLabel(loc: Location) {
    const r = loc.rect;
    const cx = (loc.label?.x ?? r.x + r.w / 2) * TILE;
    const cy = (loc.label?.y ?? r.y + r.h / 2) * TILE;
    const name = this.add.text(0, 0, '', {
      fontFamily: '"Pixelify Sans", system-ui, sans-serif', fontSize: loc.kind === 'building' ? '22px' : '18px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#1d2326', strokeThickness: 5,
    }).setOrigin(0.5);
    const sub = this.add.text(0, 18, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#ffffff', stroke: '#1d2326', strokeThickness: 4,
    }).setOrigin(0.5);
    const c = this.add.container(cx, cy, [name, sub]).setDepth(90_000).setVisible(this.discovered.has(loc.id));
    this.labels.set(loc.id, c);

    const door = loc.doors?.[0];
    if (door) {
      const q = this.add.image(door.x * TILE + 16, door.y * TILE - 14, 'qmark').setDepth(150_000)
        .setVisible(this.seen.has(loc.id) && !this.discovered.has(loc.id));
      this.tweens.add({ targets: q, y: q.y - 5, yoyo: true, repeat: -1, duration: 600, ease: 'Sine.inOut' });
      this.qmarks.set(loc.id, q);
    }
  }

  private refreshTexts() {
    for (const loc of LOCATIONS) {
      const c = this.labels.get(loc.id);
      if (!c) continue;
      (c.list[0] as Phaser.GameObjects.Text).setText(L(loc.name));
      (c.list[1] as Phaser.GameObjects.Text).setText(L(loc.sub));
    }
    this.hud.setDiscovery(this.discovered.size, LOCATIONS.length);
    this.refreshClockAndNeeds();
    this.updatePrompt(true);
    this.panel?.refresh();
  }

  /** soft drop shadows to the south-east and darker roof edges, so buildings read as 3D blocks */
  private drawBuildingShading() {
    const g = this.add.graphics().setDepth(1);
    for (const b of BUILDINGS) {
      const r = b.rect;
      const x = r.x * TILE, y = r.y * TILE, w = r.w * TILE, h = r.h * TILE;
      g.fillStyle(0x000000, 0.16);
      g.fillRect(x + w, y + 10, 12, h - 4);
      g.fillRect(x + 12, y + h, w, 10);
      g.fillStyle(0x000000, 0.08);
      g.fillRect(x + w + 12, y + 18, 6, h - 8);
      g.fillRect(x + 18, y + h + 10, w, 5);
    }
    const top = this.add.graphics().setDepth(2);
    for (const b of BUILDINGS) {
      const r = b.rect;
      const x = r.x * TILE, y = r.y * TILE, w = r.w * TILE, roofH = (r.h - 2) * TILE;
      top.lineStyle(3, b.roof === 'green' ? 0x4f7d3e : 0x8b939a, 1);
      top.strokeRect(x + 1.5, y + 1.5, w - 3, roofH - 1);
      top.lineStyle(1, 0xffffff, 0.45);
      top.lineBetween(x + 4, y + 4, x + w - 4, y + 4);
      top.fillStyle(0x000000, 0.22);
      top.fillRect(x, y + roofH, w, 4); // eave shadow over the façade
    }
  }

  /** sky colour for the time of day, as a multiply tint (white = no change) */
  private skyTint(minutes: number): [number, number, number] {
    const keys: Array<[number, [number, number, number]]> = [
      [0, [30, 50, 105]], [5, [40, 58, 110]], [6, [200, 170, 195]], [7, [255, 230, 222]], [8, [255, 255, 255]],
      [17, [255, 255, 255]], [18, [255, 222, 178]], [19, [232, 168, 140]], [20, [120, 115, 165]], [22, [48, 62, 118]], [24, [30, 50, 105]],
    ];
    const h = minutes / 60;
    for (let i = 0; i < keys.length - 1; i++) {
      const [h0, c0] = keys[i], [h1, c1] = keys[i + 1];
      if (h >= h0 && h <= h1) {
        const t = (h - h0) / (h1 - h0);
        return [0, 1, 2].map((k) => Math.round(c0[k] + (c1[k] - c0[k]) * t)) as [number, number, number];
      }
    }
    return [255, 255, 255];
  }

  /** redraws the night layer: sky tint everywhere except around lights */
  private drawNight() {
    const cv = this.nightCanvas;
    const w = this.scale.width, h = this.scale.height;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const c = cv.getContext('2d')!;
    c.clearRect(0, 0, w, h);
    const nightIn = phaseOf(this.save.clock.minutes) === 'night';
    let tint: [number, number, number];
    if (this.room) tint = this.room === 'dorm' && nightIn ? [70, 80, 130] : [255, 255, 255];
    else {
      tint = this.skyTint(this.save.clock.minutes);
      if (this.isRaining()) tint = tint.map((v) => Math.round(v * 0.82)) as [number, number, number];
    }
    const lum = (tint[0] + tint[1] + tint[2]) / 765;
    const a = 1 - lum;
    this.darkAlpha = a;
    this.warmLights.getChildren().forEach((o) => (o as Phaser.GameObjects.Image).setAlpha(!this.room && a > 0.3 ? Math.min(0.32, a * 0.45) : 0));
    if (a <= 0.01) return;
    const cam = this.cameras.main;
    const view = cam.worldView;
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = `rgb(${tint[0]}, ${tint[1]}, ${tint[2]})`; // multiply blend (see .night-layer)
    c.fillRect(0, 0, w, h);
    if (a < 0.3) return; // daylight / dusk: no light pools yet
    c.globalCompositeOperation = 'destination-out';
    const cut = (x: number, y: number, r: number, k = 1) => {
      const sx = (x - view.x) * cam.zoom, sy = (y - view.y) * cam.zoom, rad = r * TILE * cam.zoom;
      if (sx < -rad || sy < -rad || sx > w + rad || sy > h + rad) return;
      const g = c.createRadialGradient(sx, sy, 0, sx, sy, rad);
      g.addColorStop(0, `rgba(0,0,0,${k})`); g.addColorStop(0.5, `rgba(0,0,0,${k * 0.6})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(sx - rad, sy - rad, rad * 2, rad * 2);
    };
    if (!this.room) for (const l of this.lightSpots) cut(l.x, l.y, l.r, 0.85);
    cut(this.player.x, this.player.y, 2, 0.6);
    for (const npc of this.npcs) {
      const def = npc.getData('def') as NpcDef;
      if (def.id === 'bel-selim' && npc.visible) cut(npc.x, npc.y, 3.2, 0.9); // his torch
    }
    c.globalCompositeOperation = 'source-over';
  }

  /** about one day in four is rainy (more in autumn and winter); deterministic per day */
  private isRaining(day = this.save.clock.day): boolean {
    let h = day * 2654435761 >>> 0;
    h ^= h >>> 13;
    const chance = season(day) === 'spring' ? 20 : 30;
    return h % 100 < chance;
  }

  /** falling leaves / snow / petals by season */
  private updateParticles() {
    this.particles?.setVisible(!this.inside);
    const base = season(this.save.clock.day);
    const sname = this.isRaining() ? (base === 'winter' ? 'blizzard' : 'rain') : base;
    if (sname === this.particleSeason) {
      const v = this.cameras.main.worldView;
      this.particles?.setPosition(v.x, v.y - 20);
      return;
    }
    this.particleSeason = sname;
    this.particles?.destroy();
    const v = this.cameras.main.worldView;
    const rain = sname === 'rain';
    const key = rain ? 'raindrop' : sname === 'winter' || sname === 'blizzard' ? 'snow' : sname === 'autumn' ? 'leaf' : 'petal';
    this.particles = this.add.particles(v.x, v.y - 20, key, {
      x: { min: 0, max: Math.max(400, v.width) }, y: 0,
      lifespan: rain ? 1600 : 9000,
      speedY: rain ? { min: 520, max: 680 } : { min: 18, max: sname === 'blizzard' ? 70 : sname === 'winter' ? 45 : 32 },
      speedX: rain ? { min: -60, max: -40 } : { min: -14, max: 14 },
      rotate: rain ? 0 : { min: 0, max: 360 }, alpha: { start: 0.95, end: rain ? 0.6 : 0.2 },
      frequency: rain ? 12 : sname === 'blizzard' ? 40 : sname === 'winter' ? 120 : 380, quantity: rain ? 2 : 1,
    }).setDepth(150_500);
  }

  // ---------- fog & discovery ----------

  private revealAround(force = false) {
    if (this.inside) return;
    const tx = Math.floor(this.player.x / TILE);
    const ty = Math.floor(this.player.y / TILE);
    if (!force && tx === this.lastTile.x && ty === this.lastTile.y) return;
    this.lastTile = { x: tx, y: ty };
    let changed = false;
    const r = REVEAL_RADIUS;
    for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) {
      if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
      if ((x - tx) ** 2 + (y - ty) ** 2 > r * r + 1) continue;
      const i = y * MAP_W + x;
      if (!this.revealed[i]) { this.revealed[i] = 1; this.fogLayer.removeTileAt(x, y); changed = true; }
    }
    if (changed) this.softenFogEdges(tx - r - 1, ty - r - 1, tx + r + 1, ty + r + 1);

    // seen: within SEEN_RADIUS of the location footprint
    for (const loc of LOCATIONS) {
      if (this.seen.has(loc.id) || loc.kind === 'room') continue;
      const rc = loc.rect;
      const dx = Math.max(rc.x - tx, 0, tx - (rc.x + rc.w - 1));
      const dy = Math.max(rc.y - ty, 0, ty - (rc.y + rc.h - 1));
      if (dx * dx + dy * dy <= SEEN_RADIUS * SEEN_RADIUS) {
        this.seen.add(loc.id);
        if (!this.discovered.has(loc.id)) this.qmarks.get(loc.id)?.setVisible(true);
      }
    }

    // zones are discovered by walking into them
    for (const loc of LOCATIONS) {
      if (loc.kind !== 'zone' || this.discovered.has(loc.id)) continue;
      const rc = loc.rect;
      if (tx >= rc.x && tx < rc.x + rc.w && ty >= rc.y && ty < rc.y + rc.h) this.discover(loc);
    }
  }

  private softenFogEdges(x0: number, y0: number, x1: number, y1: number) {
    for (let y = Math.max(0, y0); y <= Math.min(MAP_H - 1, y1); y++) {
      for (let x = Math.max(0, x0); x <= Math.min(MAP_W - 1, x1); x++) {
        if (this.revealed[y * MAP_W + x]) continue;
        let edge = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < MAP_W && ny < MAP_H && this.revealed[ny * MAP_W + nx]) edge = true;
        }
        this.fogLayer.putTileAt(edge ? FOG_SOFT : FOG_FULL, x, y);
      }
    }
  }

  /** clears fog over a whole area (plus a margin) with a short dissolve */
  private revealArea(r: Rect, margin = 2) {
    const x0 = Math.max(0, r.x - margin), y0 = Math.max(0, r.y - margin);
    const x1 = Math.min(MAP_W - 1, r.x + r.w - 1 + margin), y1 = Math.min(MAP_H - 1, r.y + r.h - 1 + margin);
    const fading: Phaser.Tilemaps.Tile[] = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * MAP_W + x;
      if (this.revealed[i]) continue;
      this.revealed[i] = 1;
      const tile = this.fogLayer.getTileAt(x, y);
      if (tile) fading.push(tile);
    }
    if (!fading.length) return;
    this.tweens.addCounter({
      from: 1, to: 0, duration: 700, ease: 'Sine.out',
      onUpdate: (tw) => fading.forEach((tile) => { tile.alpha = tw.getValue() ?? 0; }),
      onComplete: () => {
        fading.forEach((tile) => this.fogLayer.removeTileAt(tile.x, tile.y));
        this.softenFogEdges(x0 - 1, y0 - 1, x1 + 1, y1 + 1);
      },
    });
  }

  private discover(loc: Location, silent = false) {
    if (this.discovered.has(loc.id)) return;
    this.discovered.add(loc.id);
    this.revealArea(loc.revealRect ?? loc.rect);
    this.seen.add(loc.id);
    this.qmarks.get(loc.id)?.setVisible(false);
    const label = this.labels.get(loc.id);
    if (label) {
      label.setVisible(true).setAlpha(0).setScale(0.6);
      this.tweens.add({ targets: label, alpha: 1, scale: 1, duration: 450, ease: 'Back.out' });
    }
    this.hud.setDiscovery(this.discovered.size, LOCATIONS.length);
    this.updatePrompt(true);
    if (!silent) { this.hud.toast(t('discovered_toast', { name: L(loc.name) }), 'good'); sfx.discover(); }
    if (this.discovered.size === LOCATIONS.length) this.time.delayedCall(900, () => this.hud.toast(t('all_found'), 'good'));
    if (!silent) this.save.state.xp += 20;
    this.checkMissions();
    this.persist();
  }

  // ---------- interaction ----------

  private findNearDoor(): Location | null {
    const px = this.player.x / TILE, py = this.player.y / TILE + 0.3;
    for (const loc of LOCATIONS) {
      for (const d of loc.doors ?? []) {
        const s = doorStandTile(d);
        if (Math.abs(px - (s.x + 0.5)) < 1.1 && Math.abs(py - (s.y + 0.5)) < 1.1) return loc;
      }
    }
    return null;
  }

  private updatePrompt(force = false) {
    if (this.panel?.isOpen) { this.hud.setPrompt(null); this.nearDoor = null; return; }
    const peer = this.peers.size ? this.nearPeer() : null;
    if (peer) { this.nearDoor = null; this.hud.setPrompt(L({ tr: `E — ${peer.profile.name} (oyuncu)`, en: `E — ${peer.profile.name} (player)` })); return; }
    if (this.room === 'dining') {
      const th = this.diningThingNear();
      const key = th ? `${th.id}-${th.npc?.id ?? ''}-${this.tray ? 1 : 0}` : null;
      if (!force && key === this.nearRoomThing) return;
      this.nearRoomThing = key;
      this.hud.setPrompt(th ? `E — ${th.label}` : null);
      return;
    }
    if (this.room === 'class') {
      const th = this.classThingNear();
      const key = th ? `${th.id}-${th.npc?.id ?? ''}` : null;
      if (!force && key === this.nearRoomThing) return;
      this.nearRoomThing = key;
      this.hud.setPrompt(th ? `E — ${th.label}` : null);
      return;
    }
    if (this.inside) {
      const th = this.roomThingNear();
      const key = th?.id === 'mate' ? `mate-${th.npc!.id}` : th?.id ?? null;
      if (!force && key === this.nearRoomThing) return;
      this.nearRoomThing = key;
      this.hud.setPrompt(th ? `E — ${th.label}` : null);
      return;
    }
    const npc = this.findNearNpc();
    if (npc) {
      this.nearDoor = null;
      this.hud.setPrompt(L({ tr: `E — ${npc.name} ile konuş`, en: `E — talk to ${npc.name}` }));
      return;
    }
    if (this.nearGate()) { this.nearDoor = null; this.hud.setPrompt(L({ tr: 'E — Ana Kapı', en: 'E — Main gate' })); return; }
    const near = this.findNearDoor();
    if (!force && near === this.nearDoor) return;
    this.nearDoor = near;
    if (!near) { this.hud.setPrompt(null); return; }
    this.hud.setPrompt(this.discovered.has(near.id) ? t('press_e', { name: L(near.name) }) : t('unknown_door'));
  }

  private nearGate(): boolean {
    if (this.room) return false;
    return Math.hypot(this.player.x / TILE - (GATE.x + GATE.w / 2), this.player.y / TILE - (GATE.y - 0.5)) < 2;
  }

  /** evci: the weekend at home; you're back at the gate on Sunday at 17:40 */
  private goHome(summary: string) {
    const c = this.save.clock;
    const st = this.save.state;
    const guardian = L(GUARDIANS.find((g) => g.id === this.save.character.guardian)!.your);
    this.sleeping = true;
    this.cameras.main.fadeOut(500, 8, 14, 24);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.sleeping = false;
      c.day += (6 - weekday(c.day) + 7) % 7; // to Sunday
      c.minutes = BACK_ON_SUNDAY;
      st.hunger = 85; st.energy = 95;
      st.daily.weekendHome = c.day;
      this.room = null;
      this.player.setPosition(SPAWN.x * TILE, SPAWN.y * TILE).setVelocity(0, 0);
      this.dir = 3;
      this.setCameraArea();
      this.refreshClockAndNeeds();
      this.persist();
      this.cameras.main.fadeIn(600, 8, 14, 24);
      this.hud.showModal({
        title: L({ tr: '🏠 Evde bir hafta sonu', en: '🏠 A weekend at home' }), sub: L({ tr: 'Pazar 17:40 · okula döndün', en: 'Sunday 17:40 · back at school' }),
        body: summary,
        note: L({ tr: `${guardian} seni kapıya bıraktı. Etüt 18:00'de: yurduna yetiş!`, en: `${guardian} dropped you at the gate. Study time is at 18:00: hurry to your dorm!` }),
        button: L({ tr: 'Yurda koş', en: 'Run to the dorm' }),
      });
    });
  }

  private blocked() { return this.hud.modalOpen || this.hud.bigOpen || this.panel.isOpen || this.hud.chatOpen; }

  private findNearNpc(): NpcDef | null {
    let best: NpcDef | null = null, bestD = 1.7 * TILE;
    for (const npc of this.npcs) {
      if (!npc.visible) continue;
      const d = Phaser.Math.Distance.Between(npc.x, npc.y, this.player.x, this.player.y);
      if (d < bestD) { bestD = d; best = npc.getData('def') as NpcDef; }
    }
    return best;
  }

  private interact() {
    if (this.blocked()) return;
    const peer = this.nearPeer();
    if (peer) {
      this.player.setVelocity(0, 0);
      const pick = ['👋', '😂', '❤️', '⚽', '🤝'];
      this.panel.open(() => ({
        title: peer.profile.name, sub: L({ tr: `Gerçek oyuncu · ${peer.profile.grade}. sınıf`, en: `Real player · grade ${peer.profile.grade}` }),
        rooms: [{ id: 'peer', name: peer.profile.name, note: L({ tr: 'Bir tepki gönder ya da Enter ile sohbet et.', en: 'Send a reaction, or press Enter to chat.' }),
          actions: pick.map((e) => ({ id: e, label: e, run: () => { this.mp?.emote(e); this.bubbleAbove(this.player, e); this.panel.close(); } })) }],
      }));
      return;
    }
    if (this.room === 'dining') { this.interactDining(); return; }
    if (this.room === 'class') { this.interactClass(); return; }
    if (this.room === 'dorm') { this.interactRoom(); return; }
    const npc = this.findNearNpc();
    if (npc) {
      this.nearNpc = npc;
      this.player.setVelocity(0, 0);
      const ctx = this.gameCtx();
      this.panel.open(() => npcPanel(npc, ctx));
      return;
    }
    if (this.nearGate()) { this.player.setVelocity(0, 0); const gctx = this.gameCtx(); this.panel.open(() => gatePanel(gctx)); return; }
    const loc = this.findNearDoor();
    if (!loc) return;
    this.discover(loc);
    this.player.setVelocity(0, 0);
    const ctx = this.gameCtx();
    const ownDorm = this.save.character.gender === 'girl' ? 'kiz_yurdu' : 'erkek_yurdu';
    if (this.save.state.escaped) {
      if (loc.id !== ownDorm) { this.hud.toast(L({ tr: 'Kapı kilitli. Gece herkes uyuyor…', en: 'Locked. Everyone is asleep…' })); return; }
      const st = this.save.state;
      st.escaped = false;
      st.xp += 30;
      this.save.character.respect += 10;
      this.hud.toast(L({ tr: '🌙 Yakalanmadan geri döndün! +30 XP · +10 saygınlık', en: '🌙 You made it back unseen! +30 XP · +10 respect' }), 'good');
      this.enterDorm();
      return;
    }
    if (loc.id === ownDorm) { this.enterDorm(); return; }
    if (loc.id === 'egitim') { this.enterClass(); return; }
    if (loc.id === 'yemekhane') { this.enterDining(); return; }
    // in the evening only your own dorm is reachable anyway; outside study hours other doors stay shut
    if (phaseOf(this.save.clock.minutes) !== 'day' && loc.id !== ownDorm && loc.id !== 'revir' && this.save.state.missionsDone.includes('kayit')) {
      this.hud.toast(L({ tr: 'Bu saatte kapalı.', en: 'Closed at this hour.' }));
      return;
    }
    if (buildingPanel(loc.id, ctx)) {
      this.panel.open(() => buildingPanel(loc.id, ctx)!);
      return;
    }
    this.hud.showModal({ title: L(loc.name), sub: L(loc.sub), body: L(loc.info), note: this.doorNote(loc), button: t('close') });
  }

  /** the API building menus use to change the game */
  private gameCtx(): GameCtx {
    return {
      st: this.save.state,
      ch: this.save.character,
      clock: this.save.clock,
      panel: this.panel,
      advance: (m) => this.advance(m),
      sleep: () => this.sleep(),
      gain: (g) => this.gain(g),
      toast: (msg, kind) => this.hud.toast(msg, kind),
      discover: (id) => { const l = LOCATIONS.find((x) => x.id === id); if (l) this.discover(l); },
      mc: () => this.mc(),
      befriend: (id, amount) => this.befriend(id, amount),
      yearEnd: () => this.showYearEnd(),
      penalize: (p, why) => this.penalize(p, why),
      escape: () => this.startEscape(),
      leaveDorm: () => this.leaveDorm(),
      goHome: (summary) => this.goHome(summary),
      beltNear: () => this.roomBelletmen.visible && Phaser.Math.Distance.Between(this.roomBelletmen.x, this.roomBelletmen.y, this.player.x, this.player.y) < 4 * TILE,
    };
  }

  private penalize(points: number, why: string) {
    const st = this.save.state;
    st.discipline = Math.min(100, st.discipline + points);
    st.lastPenaltyDay = this.save.clock.day;
    sfx.warn();
    this.hud.toast(`⚠ ${why} (+${points} ${L({ tr: 'disiplin puanı', en: 'discipline points' })})`);
    this.refreshClockAndNeeds();
  }

  private badSurprise(who: NpcDef) {
    const st = this.save.state;
    const sp = SURPRISES[Math.floor(Math.random() * SURPRISES.length)];
    const e = sp.effect;
    if (e.mood) this.changeMood(e.mood);
    if (e.minutes) this.advance(e.minutes);
    if (e.discipline) { st.discipline = Math.min(100, st.discipline + e.discipline); st.lastPenaltyDay = this.save.clock.day; }
    if (e.homeworkHit) { const h = st.school.homework[0]; if (h) st.school.scores[h.s].push(30); }
    if (e.gossip) NPCS.filter((n) => n.kind === 'classmate' && n.id !== who.id).sort(() => Math.random() - 0.5).slice(0, 2).forEach((n) => this.befriend(n.id, -5));
    const show = () => this.hud.showModal({
      title: L({ tr: '😠 Kötü sürpriz', en: '😠 A nasty surprise' }), sub: who.name,
      body: L(sp.text(who.name)),
      note: L({ tr: `${who.name} seninle iyi anlaşmıyor (${Math.round(st.friends[who.id] ?? 0)}). Araları düzeltmek için onunla konuşabilir ya da ona bir şey ikram edebilirsin.`, en: `${who.name} doesn't get along with you (${Math.round(st.friends[who.id] ?? 0)}). Talk to them or share a treat to patch things up.` }),
      button: L({ tr: 'Tamam', en: 'OK' }),
    });
    if (this.blocked()) this.time.delayedCall(1500, () => (this.blocked() ? this.hud.toast(L(sp.text(who.name))) : show())); else show();
    this.refreshClockAndNeeds();
  }

  /** teleports you to your dorm door and opens the dorm (curfew) */
  private sendToDorm() {
    this.save.state.escaped = false;
    this.enterDorm();
  }

  private startEscape() {
    const st = this.save.state;
    st.escaped = true;
    this.leaveDorm();
    this.hud.showModal({
      title: L({ tr: '🌙 Dışarıdasın!', en: "🌙 You're out!" }),
      body: L({ tr: 'Belletmen Selim Bey fenerle kampüsü dolaşıyor. Ona yaklaşma! Kampüsü gez, sonra yakalanmadan yurduna dön ve kapında E\'ye bas.', en: 'Mr. Selim is patrolling the campus with a torch. Keep your distance! Explore, then get back to your dorm door without being seen and press E.' }),
      button: L({ tr: 'Sessizce…', en: 'Quietly…' }),
    });
  }

  /** evening rules: study in the dorm 18–20, dorm plaza only 20–22, bed after 22 (GDD §6.6) */
  private enforceCurfew() {
    if (this.blocked() || this.sleeping) return;
    const st = this.save.state;
    const c = this.save.clock;
    if (!st.once.luggage || !st.missionsDone.includes('kayit')) return; // the rules start once you're settled in
    if (this.room === 'dorm') return; // from the classroom you still have to go back to the dorm in the evening
    const phase = phaseOf(c.minutes);
    const day = c.day;
    const belletmen = this.save.character.gender === 'girl' ? 'Hatice Hanım' : 'Mehmet Bey';
    if (st.escaped) {
      if (phase !== 'night') { st.escaped = false; this.penalize(10, L({ tr: 'Sabah yoklamasında yatağında değildin!', en: "You weren't in bed at the morning roll call!" })); return; }
      const patrol = this.npcs.find((n) => (n.getData('def') as NpcDef).id === 'bel-selim');
      if (patrol?.visible && Phaser.Math.Distance.Between(patrol.x, patrol.y, this.player.x, this.player.y) < 3.5 * TILE) {
        this.penalize(15, L({ tr: 'Selim Bey seni fenerle yakaladı! Doğru yatağa.', en: 'Mr. Selim caught you in his torchlight! Straight to bed.' }));
        this.changeMood(-10);
        this.sendToDorm();
      }
      return;
    }
    const belId = this.save.character.gender === 'girl' ? 'bel-hatice' : 'bel-mehmet';
    if ((this.save.character.boarding ?? 'daimi') === 'evci' && isFriday(day) && c.minutes >= BUS_LEAVES && st.daily.busMissed !== day && st.daily.weekendHome !== day) {
      st.daily.busMissed = day;
      this.hud.toast(L({ tr: '🚌 Servisi kaçırdın! Bu hafta sonu okuldasın.', en: '🚌 You missed the bus! You\'re staying at school this weekend.' }));
    }
    if (phase === 'etut') {
      // you walk to the dorm yourself; being 5+ minutes late costs discipline and your belletmen's goodwill
      if (c.minutes >= 18 * 60 + 5 && st.daily.lateEtut !== day) {
        st.daily.lateEtut = day;
        this.penalize(5, L({ tr: `${belletmen}: "Etüte geç kaldın!"`, en: `${belletmen}: "You're late for study time!"` }));
        this.befriend(belId, -10);
      }
      if (c.minutes >= 19 * 60 && st.daily.missedEtut !== day) {
        st.daily.missedEtut = day;
        this.penalize(5, L({ tr: `${belletmen}: "Etütü tamamen kaçırdın! Bunu müdüre bildireceğim."`, en: `${belletmen}: "You've missed study time altogether! I'm reporting this."` }));
        this.befriend(belId, -10);
      }
    }
    if ((phase === 'plaza' || phase === 'night') && !this.room) {
      const tx = this.player.x / TILE, ty = this.player.y / TILE;
      const inside = PLAZA_ALLOWED.some((r) => tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h);
      if (!inside) {
        const last = this.lastAllowed;
        if (last && Math.hypot(last.x - this.player.x, last.y - this.player.y) < 3 * TILE) this.player.setPosition(last.x, last.y).setVelocity(0, 0);
        else this.player.setPosition((PLAZA_RECT.x + PLAZA_RECT.w / 2) * TILE, (PLAZA_RECT.y + 10) * TILE).setVelocity(0, 0);
        if (this.time.now - this.lastCurfewToast > 2500) {
          this.lastCurfewToast = this.time.now;
          this.hud.toast(L({ tr: `${belletmen}: "Bu saatte yurtların çevresinden ayrılmak yok!"`, en: `${belletmen}: "Nobody leaves the dorm area at this hour!"` }));
        }
      } else this.lastAllowed = { x: this.player.x, y: this.player.y };
    }
    if (phase === 'night') {
      // lights out works like study time: you walk back yourself; 5+ minutes late costs discipline and goodwill
      const lateNight = c.minutes >= LIGHTS_OUT ? c.minutes - LIGHTS_OUT : c.minutes + 24 * 60 - LIGHTS_OUT;
      const nightKey = c.minutes >= LIGHTS_OUT ? day : day - 1; // after midnight it's still the same night
      if (lateNight >= 5 && st.daily.lateBed !== nightKey) {
        st.daily.lateBed = nightKey;
        this.penalize(5, L({ tr: `${belletmen}: "Işıklar söndü, neredesin? Hemen yurda!"`, en: `${belletmen}: "Lights are out, where are you? Back to the dorm now!"` }));
        this.befriend(belId, -10);
      }
      if (lateNight >= 60 && st.daily.missedBed !== nightKey) {
        st.daily.missedBed = nightKey;
        this.penalize(5, L({ tr: `${belletmen}: "Bir saattir dışarıdasın! Bunu müdüre bildireceğim."`, en: `${belletmen}: "You've been out for an hour! I'm reporting this."` }));
        this.befriend(belId, -10);
      }
    }
  }

  /** the countdown banner at the top: study time at 18:00, lights out at 22:00 */
  private updateCountdown() {
    const st = this.save.state;
    const m = this.save.clock.minutes;
    if (this.room === 'dorm' || st.escaped || !st.once.luggage || !st.missionsDone.includes('kayit')) { this.hud.setCountdown(null); return; }
    const phase = phaseOf(m);
    const evci = (this.save.character.boarding ?? 'daimi') === 'evci';
    if (evci && isFriday(this.save.clock.day) && m >= BUS_BOARDING && m < BUS_LEAVES) {
      this.hud.setCountdown(L({ tr: `🚌 Servis 17:00'de Ana Kapı'dan kalkıyor · ${BUS_LEAVES - m} dk`, en: `🚌 The bus leaves the main gate at 17:00 · ${BUS_LEAVES - m} min` }), m >= BUS_LEAVES - 20);
      return;
    }
    if (phase === 'day' && m >= 17 * 60 + 30) {
      this.hud.setCountdown(L({ tr: `⏰ Etüt 18:00'de · ${18 * 60 - m} dk kaldı · yurduna git`, en: `⏰ Study time at 18:00 · ${18 * 60 - m} min left · go to your dorm` }), m >= 17 * 60 + 50);
    } else if (phase === 'etut') {
      const late = m - 18 * 60;
      this.hud.setCountdown(late < 5
        ? L({ tr: `🏃 Etüt başladı! ${5 - late} dk içinde yurdunda ol`, en: `🏃 Study time has started! Be in your dorm within ${5 - late} min` })
        : L({ tr: `⚠ Etüte ${late} dk geç kaldın · hemen yurduna git`, en: `⚠ You're ${late} min late for study time · get to your dorm` }), true);
    } else if (phase === 'plaza' && m >= 21 * 60 + 30) {
      this.hud.setCountdown(L({ tr: `🌙 Işıklar 22:00'de sönüyor · ${22 * 60 - m} dk kaldı`, en: `🌙 Lights out at 22:00 · ${22 * 60 - m} min left` }), m >= 21 * 60 + 50);
    } else if (phase === 'night') {
      const late = m >= 22 * 60 ? m - 22 * 60 : m + 120;
      this.hud.setCountdown(late < 5
        ? L({ tr: `🌙 Işıklar söndü! ${5 - late} dk içinde yurdunda ol`, en: `🌙 Lights are out! Be in your dorm within ${5 - late} min` })
        : L({ tr: `⚠ Işıklar söneli ${late} dk oldu · hemen yurduna dön`, en: `⚠ Lights went out ${late} min ago · get back to your dorm` }), true);
    } else this.hud.setCountdown(null);
  }

  private showRelationships() {
    this.player.setVelocity(0, 0);
    this.hud.openCard(relationshipsCard(this.save.state, !!this.save.state.once.classDrawn, (name) => { this.save.state.groupName = name || undefined; this.persist(); }), ['Escape']);
  }

  private mc(): MissionCtx {
    return { st: this.save.state, ch: this.save.character, discovered: this.discovered };
  }

  private befriend(id: string, amount: number) {
    const st = this.save.state;
    const before = st.friends[id] ?? 0;
    const def = NPCS.find((n) => n.id === id);
    let bonus = 1;
    if (amount > 0 && this.save.character.cause === 'illness') bonus *= 1.15; // Compassion
    if (amount > 0 && def?.group && def.group === myGroup(st)) bonus *= 1.25; // your group
    st.friends[id] = Math.max(-100, Math.min(100, Math.round(before + amount * bonus)));
    const g = myGroup(st);
    if (g !== this.groupId) {
      const prev = this.groupId;
      this.groupId = g;
      const info = GROUPS.find((x) => x.id === g);
      if (info) {
        st.groupName = undefined; // a new circle starts unnamed
        const names = NPCS.filter((n) => n.group === info.id && (st.friends[n.id] ?? 0) >= FRIEND_AT).map((n) => n.name);
        this.hud.toast(L({ tr: `👥 Artık bir arkadaş grubun var: ${names.join(', ')}. İstersen ona bir isim ver (R).`, en: `👥 You have a friend group now: ${names.join(', ')}. Give it a name if you like (R).` }), 'good');
        sfx.friend();
        const rival = GROUPS.find((x) => x.id === info.rival)!;
        if (!st.once[`rival-${rival.id}`]) {
          st.once[`rival-${rival.id}`] = true;
          NPCS.filter((n) => n.group === rival.id).forEach((n) => { st.friends[n.id] = Math.max(-100, (st.friends[n.id] ?? 0) - 10); });
          this.hud.toast(L({ tr: `⚔ ${groupLabel(rival.id, st)} bundan pek hoşlanmadı.`, en: `⚔ ${groupLabel(rival.id, st)} didn't like that much.` }));
        }
      }
      void prev;
    }
    if (def && before > -15 && st.friends[id] <= -15) this.hud.toast(L({ tr: `😠 ${def.name} artık seninle anlaşamıyor.`, en: `😠 ${def.name} doesn't get along with you anymore.` }));
    if (def?.kind === 'classmate' && before < FRIEND_AT && st.friends[id] >= FRIEND_AT) {
      this.hud.toast(L({ tr: `🤝 ${def.name} artık arkadaşın!`, en: `🤝 ${def.name} is now your friend!` }), 'good');
      sfx.friend();
    }
    this.checkMissions();
  }

  // ---------- missions ----------

  /** completes finished missions, grants rewards and queues "new mission" cards */
  private checkMissions() {
    if (this.checking || !this.hud) return;
    this.checking = true;
    try {
      const c = this.mc();
      const st = this.save.state;
      let changed = true;
      while (changed) {
        changed = false;
        for (const m of MISSIONS) {
          if (statusOf(m, c) !== 'active' || !m.objectives.every((o) => o.done(c))) continue;
          st.missionsDone.push(m.id);
          st.xp += m.reward.xp;
          if (m.id === 'saglikli_yil') {
            this.save.character.attributes.fitness = Math.min(100, this.save.character.attributes.fitness + 10);
            this.save.character.respect += 50;
          }
          sfx.success();
          this.hud.toast(L({ tr: `✓ Görev tamamlandı: ${m.title.tr}${m.reward.xp ? ` (+${m.reward.xp} XP)` : ''}`, en: `✓ Mission complete: ${m.title.en}${m.reward.xp ? ` (+${m.reward.xp} XP)` : ''}` }), 'good');
          changed = true;
        }
      }
      for (const m of MISSIONS) {
        const s = statusOf(m, c);
        if (s === 'failed' && !st.once[`failed-${m.id}`]) {
          st.once[`failed-${m.id}`] = true;
          this.hud.toast(L({ tr: `✕ Meydan okuma kaçtı: ${m.title.tr}`, en: `✕ Challenge failed: ${m.title.en}` }));
        }
        if (s === 'active' && !st.announced.includes(m.id) && !this.announceQueue.includes(m.id)) {
          if (m.kind === 'challenge') { st.announced.push(m.id); continue; }
          this.announceQueue.push(m.id);
        }
      }
      this.refreshClockAndNeeds();
      this.updateTracker();
      this.panel?.refresh();
    } finally {
      this.checking = false;
    }
  }

  private showNextAnnouncement() {
    if (!this.announceQueue.length || this.blocked()) return;
    const ids = this.announceQueue.splice(0);
    this.save.state.announced.push(...ids);
    this.player.setVelocity(0, 0);
    this.hud.openCard(announceManyCard(ids.map(missionById), this.mc()), ['Enter', 'Escape', ' ']);
    this.persist();
  }

  private showMissions() {
    this.player.setVelocity(0, 0);
    this.hud.openCard(missionsCard(this.mc()), ['Escape', 'j', 'J']);
  }

  /** tracker text + direction to the nearest target of the next objective */
  private updateTracker() {
    if (!this.hud) return;
    const c = this.mc();
    const m = trackedMission(c);
    if (!m) { this.target = null; this.hud.setTracker(null); return; }
    const o = nextObjective(m, c);
    const ids = o?.targets?.(c) ?? [];
    let best: { x: number; y: number; id: string } | null = null, bestD = Infinity;
    const { x: px, y: py } = this.campusPos();
    for (const id of ids) {
      const loc = LOCATIONS.find((l) => l.id === id);
      if (!loc) continue;
      const d0 = loc.doors?.[0];
      const pos = d0 ? doorStandTile(d0) : { x: loc.label?.x ?? loc.rect.x + loc.rect.w / 2, y: loc.label?.y ?? loc.rect.y + loc.rect.h / 2 };
      const d = Math.hypot(pos.x - px, pos.y - py);
      if (d < bestD) { bestD = d; best = { x: pos.x + 0.5, y: pos.y + 0.5, id }; }
    }
    let where = '';
    if (best) {
      const known = this.discovered.has(best.id) || this.seen.has(best.id);
      this.target = known ? { x: best.x, y: best.y } : null;
      const name = this.discovered.has(best.id) ? L(LOCATIONS.find((l) => l.id === best!.id)!.name) : '???';
      if (bestD < 3) where = L({ tr: `${name} · buradasın`, en: `${name} · you're here` });
      else {
        const ang = (Math.atan2(best.y - py, best.x - px) * 180) / Math.PI;
        const i = ((Math.round(ang / 45) % 8) + 8) % 8;
        const arrows = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
        const tr = ['doğuda', 'güneydoğuda', 'güneyde', 'güneybatıda', 'batıda', 'kuzeybatıda', 'kuzeyde', 'kuzeydoğuda'];
        const en = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
        where = `${name} · ${arrows[i]} ${L({ tr: tr[i], en: en[i] })}`;
      }
    } else this.target = null;
    this.hud.setTracker(trackerHtml(m, c, where));
  }

  private showYearEnd() {
    const st = this.save.state;
    const ch = this.save.character;
    this.checkMissions();
    const avgs = SUBJECTS.map((s) => ({ s, a: average(st.school.scores[s.id]) ?? 0 }));
    const gpa = Math.round(avgs.reduce((x, y) => x + y.a, 0) / avgs.length);
    const cert = gpa >= 85 ? L({ tr: '🏅 Takdir Belgesi', en: '🏅 Certificate of Honor (Takdir)' }) : gpa >= 70 ? L({ tr: '🎖 Teşekkür Belgesi', en: '🎖 Certificate of Thanks (Teşekkür)' }) : '';
    const friends = NPCS.filter((n) => n.kind === 'classmate' && (st.friends[n.id] ?? 0) >= FRIEND_AT).map((n) => n.name);
    const el = document.createElement('div');
    el.className = 'card yearend-card';
    el.innerHTML = `
      <div class="m-label" style="font-size:12px;font-weight:800;letter-spacing:.08em;color:var(--accent-dark)">${L({ tr: 'KARNE · 1. YIL', en: 'REPORT CARD · YEAR 1' })}</div>
      <h2></h2>
      <div class="modal-sub">${st.school.classLabel} · ${L({ tr: 'Davranış', en: 'Behavior' })}: ${L(behaviorGrade(st.discipline))}</div>
      <div style="margin-top:12px">${avgs.map(({ s, a }) => `<div class="sum-row"><span>${L(s.name)}</span><b>${a}</b></div>`).join('')}
      <div class="sum-row"><span><b>${L({ tr: 'Ortalama', en: 'Average' })}</b></span><b>${gpa}</b></div></div>
      ${cert ? `<div class="cert">${cert}</div>` : ''}
      <div class="sum-row"><span>${L({ tr: 'Arkadaşların', en: 'Your friends' })}</span><b>${friends.join(', ') || '—'}</b></div>
      <div class="sum-row"><span>${L({ tr: 'Sağlıklı Bir Yıl', en: 'A Healthy Year' })}</span><b>${st.everSick ? L({ tr: '✕ Hastalandın', en: '✕ You got sick' }) : L({ tr: '✓ Demir Gibi madalyası!', en: '✓ Iron Kid medal!' })}</b></div>
      <p style="line-height:1.5">${L({ tr: 'Yaz tatili başlıyor. 2. yıl (5. sınıf) bir sonraki güncellemede geliyor!', en: 'Summer break begins. Year 2 (Grade 5) arrives in a future update!' })}</p>
      <div style="text-align:right"><button type="button" class="primary">${L({ tr: 'Harika!', en: 'Great!' })}</button></div>`;
    el.querySelector('h2')!.textContent = `${ch.first} ${ch.last}`;
    this.hud.openCard(el, ['Enter', 'Escape']);
    this.persist();
  }

  private gain(g: Gain) {
    const st = this.save.state;
    const ch = this.save.character;
    if (g.xp) st.xp += g.xp;
    if (g.money) st.money = Math.max(0, st.money + g.money);
    if (g.energy) st.energy = clamp(st.energy + g.energy);
    if (g.hunger) st.hunger = clamp(st.hunger + g.hunger);
    if (g.mood) this.changeMood(g.mood);
    const traitAttr = TRAITS.find((x) => x.id === ch.trait)!.attr;
    for (const [k, v] of Object.entries(g.attrs ?? {}) as Array<[AttrId, number]>) {
      const bonus = k === traitAttr ? 1.1 : 1;
      ch.attributes[k] = Math.min(100, Math.round((ch.attributes[k] + v * bonus) * 10) / 10);
    }
    this.refreshClockAndNeeds();
    this.checkMissions();
    this.persist();
  }

  private changeMood(delta: number) {
    const st = this.save.state;
    const cause = this.save.character.cause;
    const d = delta < 0 && cause === 'private' ? delta * 0.9 : delta;
    st.mood = clamp(st.mood + d);
    if (cause === 'disaster') st.mood = Math.max(25, st.mood); // Resilience
  }

  /** what happens at a door depends on who you are (dorms by gender, Teknik Alan for the Handy story) */
  private doorNote(loc: Location): string {
    const c = this.save.character;
    if (loc.id === 'kiz_yurdu' || loc.id === 'erkek_yurdu') {
      const own = (loc.id === 'kiz_yurdu') === (c.gender === 'girl');
      if (!own) return t(loc.id === 'kiz_yurdu' ? 'locked_girls' : 'locked_boys');
      return t('own_dorm');
    }
    if (loc.id === 'teknik') return c.cause === 'work' ? t('teknik_open') : t('teknik_locked');
    if ((loc.id === 'cemiyet' || loc.id === 'muze') && isWeekend(this.save.clock.day)) return L({ tr: 'Hafta sonu kapalı. Pazartesi 08:00\'de açılır.', en: 'Closed at weekends. Opens Monday at 08:00.' });
    return '';
  }

  // ---------- clock ----------

  private tickClock(delta: number) {
    if (this.panel.isOpen) return; // time stands still while you're inside a menu (single-player prototype)
    const c = this.save.clock;
    const night = c.minutes >= LIGHTS_OUT || c.minutes < WAKE_UP;
    const msPerMin = (night ? MS_PER_MIN_NIGHT : MS_PER_MIN_DAY) / (this.fast ? 6 : 1);
    this.minuteAcc += delta;
    let changed = false;
    while (this.minuteAcc >= msPerMin) {
      this.minuteAcc -= msPerMin;
      this.stepMinute();
      changed = true;
    }
    if (changed) this.refreshClockAndNeeds();
  }

  /** one game minute: clock, needs, day roll */
  private stepMinute() {
    const c = this.save.clock;
    const st = this.save.state;
    const before = c.minutes;
    c.minutes += 1;
    if (c.minutes >= 24 * 60) { c.minutes = 0; c.day += 1; }
    if (before < LIGHTS_OUT && c.minutes >= LIGHTS_OUT) this.hud.toast(t('lights_out'));
    if (before < 7 * 60 && c.minutes >= 7 * 60) this.onMorning();
    // the school bell rings at the start of every lesson
    if (PERIODS.some((p) => p.kind === 'lesson' && p.start === c.minutes) && !isWeekend(c.day) && reached('derse_gir', this.mc()) && this.time.now - this.lastBell > 2000) {
      this.lastBell = this.time.now;
      sfx.bell();
    }

    const awakeLate = c.minutes >= LIGHTS_OUT || c.minutes < WAKE_UP;
    st.hunger = clamp(st.hunger - 0.1);
    st.energy = clamp(st.energy - (awakeLate ? 0.06 : 0.035));
    // health (GDD §6.2.1)
    const winter = season(c.day) === 'winter';
    let dh = 0;
    if (st.hunger < 20) dh -= 0.08;
    if (st.energy < 10) dh -= 0.04;
    if (awakeLate) dh -= winter ? 0.05 : 0.02;
    if (winter && !st.school.kit) dh -= 0.03; // no coat yet
    if (this.isRaining() && !this.room && !st.school.kit) dh -= 0.02; // soaked without a coat
    if (st.hunger > 50 && st.energy > 30 && !awakeLate) dh += 0.01;
    st.health = clamp(st.health + dh);
    if (st.sick) st.energy = Math.min(st.energy, 50);
    if (st.hunger < 25 || st.energy < 15) this.changeMood(-0.03);
    else if (st.mood < 60) this.changeMood(0.01);
    if (st.hunger <= 0 && !st.sick) {
      st.sick = true;
      st.everSick = true;
      this.changeMood(-10);
      this.hud.toast(L({ tr: '🤒 Açlıktan hastalandın! Hemen Revir\'e git (Kız Yurdu, −1. kat).', en: "🤒 You got sick from hunger! Go to the infirmary now (girls' dorm, floor −1)." }));
      this.checkMissions();
    }
    if (st.hunger < 15 && Math.floor(c.minutes / 60) !== this.hungerWarnedAt) {
      this.hungerWarnedAt = Math.floor(c.minutes / 60);
      this.hud.toast(L({ tr: 'Karnın gurulduyor… Yemekhane\'ye ya da kantine git.', en: 'Your stomach is growling… head to the dining hall or canteen.' }));
    }
  }

  private onMorning() {
    const c = this.save.clock;
    const st = this.save.state;
    this.hud.toast(t('morning'), 'good');
    if (this.isRaining()) this.hud.toast(L(season(c.day) === 'winter' ? { tr: '🌨 Bugün kar fırtınası var. Montunu unutma!', en: '🌨 A snowstorm today. Don\'t forget your coat!' } : { tr: '🌧 Bugün yağmurlu. Montun yanında olsun!', en: '🌧 It\'s rainy today. Keep your coat handy!' }));
    if (this.room !== 'dorm' && !st.escaped && st.once.luggage && st.missionsDone.includes('kayit')) {
      this.penalize(10, L({ tr: 'Sabah yoklamasında yatağında değildin!', en: "You weren't in bed at the morning roll call!" }));
      this.befriend(this.save.character.gender === 'girl' ? 'bel-hatice' : 'bel-mehmet', -10);
    }
    for (const npc of this.npcs) {
      const def = npc.getData('def') as NpcDef;
      if (def.kind !== 'belletmen' && !def.fixed) this.pickDayHome(npc);
      if (def.kind !== 'belletmen') this.pickEveningHome(npc);
    }
    // waking up sick? (the lower your health, the likelier)
    if (!st.sick && st.health < 40 && Math.random() < (40 - st.health) / 80) {
      st.sick = true;
      st.everSick = true;
      this.changeMood(-10);
      this.hud.toast(L({ tr: '🤒 Hastalandın! Revir\'e git (Kız Yurdu, −1. kat).', en: "🤒 You're sick! Go to the infirmary (girls' dorm, floor −1)." }));
      this.checkMissions();
    }
    // homework not done by the morning after it was given
    const late = st.school.homework.filter((h) => h.day < c.day);
    if (late.length) {
      st.school.homework = st.school.homework.filter((h) => h.day >= c.day);
      late.forEach((h) => st.school.scores[h.s].push(0));
      this.penalize(late.length * 3, L({ tr: `Ahmet Bey: "Ödevin nerede?" (${late.length} yapılmamış ödev → 0 puan)`, en: `Mr. Ahmet: "Where's your homework?" (${late.length} missing → 0 points)` }));
      this.changeMood(-4);
    } else if (st.discipline > 0 && st.lastPenaltyDay < c.day - 1) {
      st.discipline = Math.max(0, st.discipline - 2); // a clean day helps your record
    }
    // people who don't like you sometimes make your life harder
    const foes = dislikers(st);
    const shield = myGroup(st) ? 0.5 : 1;
    if (foes.length && Math.random() < 0.45 * shield) this.time.delayedCall(1200, () => this.badSurprise(foes[Math.floor(Math.random() * foes.length)]));
    // weekly pocket money every Monday
    const week = Math.floor((c.day - 1) / 7) + 1;
    if ((c.day - 1) % 7 === 0 && st.lastAllowanceWeek < week) {
      st.lastAllowanceWeek = week;
      st.money += 25;
      this.hud.toast(L({ tr: 'Haftalık harçlık: +25 ₺', en: 'Weekly pocket money: +25 ₺' }), 'good');
    }
  }

  /** time passes because of an action (lesson, meal, reading…) */
  private advance(minutes: number) {
    for (let i = 0; i < Math.round(minutes); i++) this.stepMinute();
    this.refreshClockAndNeeds();
  }

  private sleep() {
    const c = this.save.clock;
    const st = this.save.state;
    const toMorning = c.minutes >= 7 * 60 ? 24 * 60 - c.minutes + 7 * 60 : 7 * 60 - c.minutes;
    this.sleeping = true;
    this.cameras.main.fadeOut(400, 8, 14, 24);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.sleeping = false;
      if (c.minutes >= 7 * 60) c.day += 1;
      c.minutes = 7 * 60;
      st.hunger = clamp(st.hunger - toMorning * 0.03);
      st.health = clamp(st.health + (st.energy < 15 ? -8 : 6));
      st.energy = 100;
      this.changeMood(st.hunger < 25 ? -5 : 5);
      this.onMorning();
      this.refreshClockAndNeeds();
      this.persist();
      this.cameras.main.fadeIn(600, 8, 14, 24);
    });
  }

  private refreshClockAndNeeds() {
    const c = this.save.clock;
    const p = currentPeriod(c.day, c.minutes);
    const lessonsLocked = !reached('derse_gir', this.mc());
    const label = p?.kind === 'lesson' && lessonsLocked
      ? L({ tr: 'Okulun ilk günleri · dersler henüz başlamadı', en: 'First days · lessons have not started yet' })
      : L(periodLabel(c.day, c.minutes));
    this.hud.setClock(c.day, c.minutes, label, `${L(SEASON_NAME[season(c.day)])}${this.isRaining() ? (season(c.day) === 'winter' ? ' · 🌨' : ' · 🌧') : ''}`);
    this.hud.setNeeds(this.save.state);
    this.darkAlpha = this.darkness(c.minutes);
  }

  private darkness(min: number): number {
    const h = min / 60;
    const keys: Array<[number, number]> = [[0, 0.7], [5, 0.65], [7, 0.15], [8, 0], [18, 0.08], [20, 0.4], [22, 0.62], [24, 0.7]];
    for (let i = 0; i < keys.length - 1; i++) {
      const [h0, a0] = keys[i], [h1, a1] = keys[i + 1];
      if (h >= h0 && h <= h1) return a0 + ((h - h0) / (h1 - h0)) * (a1 - a0);
    }
    return 0;
  }

  // ---------- loop ----------

  update(time: number, delta: number) {
    const k = this.keys;
    const blocked = this.blocked();
    let vx = 0, vy = 0;
    if (!blocked) {
      if (k.left.isDown || k.a.isDown) vx -= 1;
      if (k.right.isDown || k.d.isDown) vx += 1;
      if (k.up.isDown || k.w.isDown) vy -= 1;
      if (k.down.isDown || k.s.isDown) vy += 1;
    }
    const len = Math.hypot(vx, vy) || 1;
    const running = k.shift.isDown && this.save.state.energy > 10 && (vx !== 0 || vy !== 0);
    if (running) this.save.state.energy = clamp(this.save.state.energy - delta * 0.0008); // running tires you out
    const speed = this.save.state.energy < 10 ? SPEED * 0.6 : running ? SPEED * 1.6 : SPEED;
    this.dust.setDepth(this.player.y + 15);
    this.dust.emitting = (vx !== 0 || vy !== 0) && !this.room;
    this.dust.frequency = running ? 70 : 160;
    this.player.setVelocity((vx / len) * speed, (vy / len) * speed);
    if (vx || vy) {
      this.dir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? DIRS.left : DIRS.right) : vy < 0 ? DIRS.up : DIRS.down;
      this.player.anims.play(`player-walk-${['down', 'left', 'right', 'up'][this.dir]}`, true);
    } else {
      this.player.anims.stop();
      this.player.setFrame(this.dir * 3);
    }
    this.player.setDepth(this.player.y + 16);
    const carrying = !this.save.state.once.luggage;
    this.suitcase.setVisible(carrying);
    if (carrying) this.suitcase.setPosition(this.player.x + (this.dir === 1 ? -11 : 11), this.player.y + 15).setDepth(this.player.y + (this.dir === 3 ? 15 : 17));
    this.showNextAnnouncement();
    this.enforceCurfew();
    this.updateCountdown();
    this.trackerTimer += delta;
    if (this.trackerTimer > 400) { this.trackerTimer = 0; this.updateTracker(); }

    this.updateNpcs(time);
    this.updatePeers(time);
    this.emoteTimer += delta;
    if (this.emoteTimer > 1400) { this.emoteTimer = 0; this.showEmote(); }
    this.updateRoom(time);
    this.updateClass(time);
    this.updateDining(time);
    this.revealAround();
    this.updatePrompt();
    this.tickClock(delta);

    this.drawNight();
    this.updateParticles();
    this.mapTimer += delta;
    if (this.mapTimer > 200) { this.mapTimer = 0; this.updateMaps(); }
    this.saveTimer += delta;
    if (this.saveTimer > 5000) { this.saveTimer = 0; this.persist(); }
  }

  private updateMaps() {
    this.hud.renderMaps({
      revealed: this.revealed, seen: this.seen, discovered: this.discovered,
      player: this.campusPos(),
      target: this.target,
    });
  }

  private persist() {
    this.save.player = { x: this.player.x / TILE, y: this.player.y / TILE, dir: this.dir, inside: this.room ?? undefined };
    this.save.fog = encodeFog(this.revealed);
    this.save.seen = [...this.seen];
    this.save.discovered = [...this.discovered];
    this.save.lang = getLang();
    this.save.state.daily = Object.fromEntries(Object.entries(this.save.state.daily).filter(([, d]) => d >= this.save.clock.day - 1));
    writeSave(this.save);
    if (this.net) saveToCloud(this.net.id, this.save);
  }
}

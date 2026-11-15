import Phaser from 'phaser';
import {
  AQUEDUCT, AQUEDUCT_PIER, BENCHES, BLOCK_TILES, BUST, CABIN, CEMIL_OUT, STAIRS, COURTS, EXTRA_COURTS, PLAY_COURTS, FLAGPOLE, FLOWERS, FOUNTAIN, GATE, GATES, GATE_IN, LAYOUT, SCHOOL_FRONT, LAMPS, SPAWN, LOCATIONS, MAP_H, MAP_W, PATROL_ROUTE, PLAZA_ALLOWED, PLAZA_EVENING, SOLID_TILES, T, TILE, TREES, BUILDINGS, wallAt,
  MEYDAN_STAIRS, PYRAMID, TRIBUNE,
  AGE_ZONES, CENTER_ZONES, EVENING_CENTER, EVENING_ZONES, buildMap, doorInPassage, doorStandTile, inPoly, nearestEdge, passageAt, type Building, type Location, type Rect,
} from '../content/campus';
import {
  DEFAULT_LOOK, FOG_FULL, FOG_KEY, FOG_SOFT, TILESET_KEY, TILESET_MARGIN, TILESET_SPACING, generateTextures, makeCharacterTexture,
} from '../art/textures';
import { L, t, getLang, onLangChange } from '../i18n';
import { Hud } from '../ui/hud';
import { sfx } from '../audio';
import { bushSpots, frontAt, makeBuildingArt, makeShadowArt, type BuildingArt } from '../art/buildingArt';
import { CABIN_SIZE, GATE_LEAF_SIZE, PYRAMID_SIZE, TRIBUNE_LIFT, WALL_FACE, makeGatewayTextures, tribuneKey } from '../art/gateway';
import { dressGround } from '../art/ground';
import { Ambient } from './ambient';
import { ClassLife } from './classLife';
import { Multiplayer, type PeerProfile, type PeerPos } from '../net/multiplayer';
import { saveToCloud } from '../net/cloudSave';
import type { NetUser } from '../main';
import { Panel } from '../ui/panel';
import { attendLesson, bedPanel, buildingPanel, cemilPanel, courtPanel, deskPanel, dormBestFriend, exitPanel, lockerPanel, mateLockerPanel, matePanel, npcPanel, phonePanel, playMatch, tvPanel, type GameCtx, type Gain } from '../game/buildings';
import {
  BELLETMEN_ROUTE, BEDS, CEMIL_IN, DESKS, EXIT, PHONE_SPOT, MY_BED, MY_DESK, MY_LOCKER, ROOM_H, ROOM_OX, ROOM_SOLID, ROOM_SPAWN, ROOM_W, TV_SPOT, buildRoom,
} from '../content/dormroom';
import { CLASS_DESKS, CLASS_EXIT, CLASS_H, CLASS_OX, CLASS_SPAWN, CLASS_W, MY_CLASS_DESK, TEACHERS, TEACHER_ROUTE, buildClassroom } from '../content/classroom';
import { araOgun, currentMeal, eatMeal, egitim, gatePanel, trayLock, washHands, yemekhane, yemekhaneClosed } from '../game/buildings';
import { BACK_ON_SUNDAY, BUS_BOARDING, BUS_LEAVES, CARSI_START, carsiNow, isFriday, isWednesday, weekday } from '../game/weekend';
import { DRESS_MINUTES, activityOf, teacherActivity, wakeTime, type Activity, type Indoors, type RoutineClock } from '../game/routine';
import { dilemmaDone, runDilemma, shape, temperLabel, type DilemmaId } from '../game/dilemmas';
import { COOKS, COUNTER_TILES, DINING_EXIT, DINING_H, DINING_OX, DINING_SOLID, DINING_SPAWN, DINING_W, SEATS, SINKS, buildDining } from '../content/dining';
import { BELLETMENS, DEPUTY, GROUPS, NPCS, TEACHER_NPCS, ageGroup, genitiveTr, type NpcDef } from '../content/npcs';
import { BORROWED, PYJAMAS, wornLook } from '../content/wardrobe';
import { myGroup, dislikers, groupLabel, SURPRISES } from '../game/social';
import { relationshipsCard } from '../ui/relationships';
import { CEREMONY, ETUT_START, LATE_AFTER, LIGHTS_OUT, RUSH_DAYS, RUSH_END, RUSH_MORNING, RUSH_NIGHT, RUSH_TOTAL, WAKE_UP, ceremonyNow, ceremonyWindow, diningOpen, phaseOf, rushLeft, weekOf, weekday as weekdayOf, type DayPhase } from '../game/schedule';
import {
  MISSIONS, missionById, nextObjective, reached, statusOf, trackedMission, type MissionCtx,
} from '../game/missions';
import { announceManyCard, missionsCard, trackerHtml } from '../ui/missions';
import { ATTRS, CAUSES } from '../content/character';
import { CLASS_LETTERS, SUBJECTS, average, FRIEND_AT, behaviorGrade, COURT_PLAYERS, PEE_LAST_YEAR, councilTitle, grade, type CourtSport, type SubjectId } from '../game/state';
import { PERIODS, classBreak, currentPeriod, fmtTime, hasEtut, isSnackTime, isWeekend, periodLabel, subjectFor } from '../game/schedule';
import { clamp } from '../game/state';
import { GUARDIANS, TRAITS, type AttrId } from '../content/character';
import { backupSave, clearSave, decodeFog, encodeFog, writeSave, type SaveData } from '../save';

const REVEAL_RADIUS = 7;
const SEEN_RADIUS = 9;
const SPEED = 150;
/** real milliseconds per game minute: day (07:00–22:30) ≈ 1 game hour per 80 s; night is compressed */
const MS_PER_MIN_DAY = 80_000 / 60;
const MS_PER_MIN_NIGHT = 240_000 / (8.5 * 60);
/** the registration weekend runs fast (it's a rush); evening study drags, so it runs at double speed too */
const RUSH_SPEED = 4;
const ETUT_SPEED = 2;
/** a night's sleep fast-forwards in about this many real milliseconds */
const SLEEP_MS = 20_000;
/** how long a meal takes at the table (game minutes), and how fast it goes by */
const MEAL_MINUTES = 25;
const MEAL_MS_PER_MIN = 320;
/** a lesson you haven't gone to: after this many minutes the deputy head comes looking for you */
const TRUANT_AFTER = 8;
/** how many of your closest friends come and hang around near you in their free time */
const FOLLOWERS = 3;

const DIRS = { down: 0, left: 1, right: 2, up: 3 } as const;
const PLAZA_RECT = PLAZA_EVENING;
/** belletmens on the search: they walk at first, then speed up until they can outpace you */
const SEARCH_SPEED = 80;
const SEARCH_SPEED_MAX = 230;
/** how close (tiles) a searching belletmen has to be to see you */
const SPOT_RANGE = 7;
const ESCORT_SPEED = 85;

/** where an NPC should be: a spot outdoors (maybe facing something), or inside a building (then `home` is its door) */
interface NpcPlan { home: [number, number]; roam: number; inside?: string; face?: [number, number] }

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
  /** birds, pigeons, rain puddles, trees (2D only) */
  private ambient!: Ambient;
  /** cached screen vignette for the night layer */
  private vignette: HTMLCanvasElement | null = null;
  /** 2.5D buildings: the painted image, its night windows, and where it stands */
  /** each building is drawn as narrow column slices (see drawBuildings); `alpha` fades them all together */
  private buildingArt: Array<{ art: BuildingArt; b: Building; imgs: Phaser.GameObjects.Image[]; lits: Phaser.GameObjects.Image[]; alpha: number }> = [];
  private darkAlpha = 0;
  private lightSpots: Array<{ x: number; y: number; r: number }> = [];
  private particles: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private weather = '';
  private lastTile = { x: -1, y: -1 };
  private nearDoor: Location | null = null;
  private fast = false;
  private minuteAcc = 0;
  private saveTimer = 0;
  private mapTimer = 0;
  private npcs: Phaser.Physics.Arcade.Sprite[] = [];
  private npcById = new Map<string, Phaser.Physics.Arcade.Sprite>();
  /** game minute the NPCs were last updated at: a jump means a lesson, a night's sleep or a loaded save */
  private npcClock = -1;
  /** game minute (since day 1) before which no dilemma moment starts (one set aside comes back later) */
  private dilemmaWait = 0;
  /** this frame's clock for the students' routine */
  private rc: RoutineClock | null = null;
  /** where students leave the campus and come back: just inside the main gate */
  private gateTile: [number, number] = [GATE_IN[0], GATE_IN[1]];
  private npcNames = new Map<Phaser.Physics.Arcade.Sprite, Phaser.GameObjects.Text>();
  private nearNpc: NpcDef | null = null;
  /** per tile: 1 = an NPC can stand here (no building, fence or decor) */
  private npcGrid = new Uint8Array(MAP_W * MAP_H);
  /** per tile: 1 = an open tile NPCs can walk to from the main gate */
  private npcReach = new Uint8Array(MAP_W * MAP_H);
  /** per tile: 1 = in front of a door, where NPCs shouldn't hang around */
  private doorClear = new Uint8Array(MAP_W * MAP_H);
  private suitcase!: Phaser.GameObjects.Image;
  private announceQueue: string[] = [];
  private checking = false;
  private trackerTimer = 0;
  private target: { x: number; y: number } | null = null;
  private lastAllowed: { x: number; y: number } | null = null;
  private lastCurfewToast = 0;
  /** out at study time or after lights out: belletmens search for you (t = ms of searching, seen = where you were last seen) */
  private hunt: { kind: 'curfew' | 'truant'; t: number; npcs: Phaser.Physics.Arcade.Sprite[]; seen: { x: number; y: number }; tipAt: number; cutAt: number; spotted: boolean } | null = null;
  /** real time you've been out of place (the grace period before the search starts) */
  private outFor = 0;
  /** caught: the belletmen walks you back to your dorm (walking = the scolding is over) */
  private escort: { kind: 'curfew' | 'truant'; npc: Phaser.Physics.Arcade.Sprite; t: number; walking: boolean; done: boolean } | null = null;
  /** the registration weekend: what's due once nothing is in the way (a modal, a menu) */
  private rushDue: 'night' | 'end' | null = null;
  private drawing = false;
  /** the door you went in by (its outside step, in tiles): you come back out there */
  private lastDoor: { x: number; y: number } | null = null;
  /** where each friend who is keeping you company is heading, and when they last picked the spot */
  private followAt = new Map<string, { x: number; y: number; t: number }>();
  private groupId: string | null = null;
  private sleeping = false;
  private layoutReset = false;
  /** the HD-2D view (null = classic 2D) */
  /** the dorm payphone, Cemil Emmi (in the boys' dorm and at its door by day), your Wednesday visitor */
  private payphone!: Phaser.GameObjects.Image;
  private cemilIn!: Phaser.GameObjects.Sprite;
  private cemilOut!: Phaser.Physics.Arcade.Sprite;
  /** a pick-up game: friends on their way to the court */
  private match: { sport: CourtSport; court: Rect; mates: Phaser.Physics.Arcade.Sprite[]; until: number; ready: boolean } | null = null;
  /** the court whose panel was opened last (there's more than one basketball court) */
  private courtAt: Rect | null = null;
  /** time running fast while you stay put: asleep (the night goes by in about 20 seconds; night challenges can
   *  interrupt it), killing time at your desk, or eating at the table */
  private sleepRun: { kind: 'sleep' | 'idle' | 'eat'; msPerMin: number; acc: number; left: number; total: number; busy: boolean; events: Array<{ at: number; done: boolean; run: () => Promise<void> }>; onDone?: () => void } | null = null;
  private zzz: Phaser.GameObjects.Text[] = [];
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
  /** your tray on the table while you eat */
  private trayAt: { x: number; y: number } | null = null;
  private trayImg!: Phaser.GameObjects.Image;
  private get inside() { return this.room !== null; }
  private classMates: Phaser.Physics.Arcade.Sprite[] = [];
  private teacher!: Phaser.Physics.Arcade.Sprite;
  /** teneffüs in the classroom: games, chats, a word with the teacher */
  private classLife!: ClassLife;
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
    // buildings moved since this save: keep the progress, reset the fog and walk in from the gate
    this.layoutReset = this.save.layout !== LAYOUT;
    if (this.layoutReset) {
      // the calendar now starts on the Saturday of registration weekend: older saves keep their weekdays
      if ((this.save.layout ?? 0) < 7) {
        this.save.clock.day += 2;
        for (const h of this.save.state.school.homework) h.day += 2;
        for (const k of Object.keys(this.save.state.daily)) this.save.state.daily[k] += 2;
      }
      this.save.fog = '';
      if (!this.save.player.inside) Object.assign(this.save.player, { x: SPAWN.x, y: SPAWN.y, dir: 2 });
      this.save.layout = LAYOUT;
    }
    this.net = data.net ?? null;
    const known = (id: string) => LOCATIONS.some((l) => l.id === id);
    this.seen = new Set(this.save.seen.filter(known));
    this.discovered = new Set(this.save.discovered.filter(known));
    const door = this.save.player.door;
    this.lastDoor = door ? { x: door[0], y: door[1] } : null;
  }

  create() {
    generateTextures(this);
    makeCharacterTexture(this, 'player', wornLook(this.save.character.look, this.save.state));
    this.map = buildMap();

    // world tiles
    const tilemap = this.make.tilemap({ data: this.map, tileWidth: TILE, tileHeight: TILE });
    const tileset = tilemap.addTilesetImage(TILESET_KEY, TILESET_KEY, TILE, TILE, TILESET_MARGIN, TILESET_SPACING)!;
    const ground = tilemap.createLayer(0, tileset, 0, 0)!;
    ground.setCollision(BLOCK_TILES); // buildings collide through their outlines (see pushOutOfBuildings)
    this.drawCourtLines();
    makeGatewayTextures(this);
    this.add.image(STAIRS.x * TILE, STAIRS.y * TILE, 'stairs').setOrigin(0).setDepth(3);
    // the steps down from the first-floor corridor through Eğitim to the Merkez Meydan
    this.add.image(MEYDAN_STAIRS.x * TILE, MEYDAN_STAIRS.y * TILE - 4, 'stairs-ew').setOrigin(0).setDepth(3);

    this.drawBuildings();

    // decor
    const trees = this.physics.add.staticGroup();
    for (const [x, y] of TREES) {
      const tree = trees.create(x * TILE + 16, y * TILE - 4, 'tree') as Phaser.Physics.Arcade.Sprite;
      tree.setDepth(y * TILE + 30);
      tree.body!.setSize(12, 8).setOffset(18, 60);
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
    // the big green main gate: stone pillars, a green arch with the school's name, the leaves slid open
    // along the fence, and the guards' cabin just inside
    for (const gate of GATES) {
      for (const gx of [gate.x - 0.5, gate.x + gate.w + 0.5]) {
        const post = trees.create(gx * TILE, (gate.y + 0.5) * TILE - 34, 'gatepost') as Phaser.Physics.Arcade.Sprite;
        post.setDepth((gate.y + 0.5) * TILE + 16);
        post.body!.setSize(24, 12).setOffset(4, 86);
      }
      const gy = gate.y + 0.5;
      this.add.image((gate.x + gate.w / 2) * TILE, gy * TILE - 70, gate === GATE ? 'gatearch' : 'gatearch-tim').setOrigin(0.5, 1).setDepth(gy * TILE + 20);
      // the two leaves stand swung open into the campus, hinged on the pillars
      const hinge = (gate.y + 0.3) * TILE, ox = 1 / GATE_LEAF_SIZE.w;
      this.add.image(gate.x * TILE, hinge, 'gateleaf').setOrigin(ox, 1).setDepth(hinge);
      this.add.image((gate.x + gate.w) * TILE, hinge, 'gateleaf').setOrigin(1 - ox, 1).setFlipX(true).setDepth(hinge);
      this.lightSpots.push({ x: (gate.x + gate.w / 2) * TILE, y: (gate.y - 0.4) * TILE, r: 2 });
    }
    const cabin = trees.create(CABIN.x * TILE, (CABIN.y + CABIN.h) * TILE, 'cabin') as Phaser.Physics.Arcade.Sprite;
    cabin.setOrigin(0, 1).setDepth((CABIN.y + CABIN.h) * TILE).refreshBody();
    cabin.body!.setSize(CABIN_SIZE.w, CABIN.h * TILE).setOffset(0, CABIN_SIZE.h - CABIN.h * TILE);
    this.lightSpots.push({ x: (CABIN.x + CABIN.w / 2) * TILE, y: (CABIN.y + CABIN.h) * TILE - 20, r: 1.4 });
    // the tall perimeter wall, a block per fence tile; its stone face shows wherever nothing walls it in to the south
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      if (!wallAt(this.map, x, y)) continue;
      const face = !wallAt(this.map, x, y + 1);
      this.add.image(x * TILE, (y + 1) * TILE - (face ? 0 : WALL_FACE), face ? 'wallblock' : 'walltop').setOrigin(0, 1).setDepth((y + 1) * TILE);
    }
    // the aqueduct over the main street: walk through its big arch; its two piers stand against the walls
    const aqFront = (AQUEDUCT.y + AQUEDUCT.h) * TILE;
    this.add.image(AQUEDUCT.x * TILE, aqFront, 'aqueduct').setOrigin(0, 1).setDepth(aqFront + 1);
    for (const px of [AQUEDUCT.x, AQUEDUCT.x + AQUEDUCT.w - AQUEDUCT_PIER]) {
      const pier = this.add.rectangle((px + AQUEDUCT_PIER / 2) * TILE, (AQUEDUCT.y + AQUEDUCT.h / 2) * TILE, AQUEDUCT_PIER * TILE, AQUEDUCT.h * TILE).setVisible(false);
      trees.add(pier);
    }
    // Cemil Emmi sweeps in front of the boys' dorm by day
    this.cemilOut = trees.create(CEMIL_OUT[0] * TILE, CEMIL_OUT[1] * TILE, 'player', 0) as Phaser.Physics.Arcade.Sprite;
    // the three-sided pyramid in the very centre of the Merkez Meydan
    const pyr = trees.create(PYRAMID.x * TILE, PYRAMID.y * TILE, 'pyramid') as Phaser.Physics.Arcade.Sprite;
    pyr.setOrigin(0.5, 1 - PYRAMID_SIZE.foot / 2 / PYRAMID_SIZE.h).setDepth(PYRAMID.y * TILE + 6).refreshBody();
    pyr.body!.setSize(PYRAMID_SIZE.w - 20, PYRAMID_SIZE.foot - 8).setOffset(10, PYRAMID_SIZE.h - PYRAMID_SIZE.foot + 2);
    this.lightSpots.push({ x: PYRAMID.x * TILE, y: PYRAMID.y * TILE - 20, r: 2.6 });
    // the grandstand along the Spor Salonu's east wall, facing the pitch (solid: you watch from the path in front)
    TRIBUNE.forEach((r, i) => {
      this.add.image(r.x * TILE, r.y * TILE - TRIBUNE_LIFT, tribuneKey(i)).setOrigin(0).setDepth((r.y + r.h) * TILE - 2);
      const block = this.add.rectangle((r.x + r.w / 2) * TILE, (r.y + r.h / 2) * TILE, r.w * TILE, r.h * TILE).setVisible(false);
      trees.add(block);
    });
    // the Atatürk bust in the south-west corner of the Merkez Meydan
    const bust = trees.create(BUST[0] * TILE, BUST[1] * TILE - 8, 'bust') as Phaser.Physics.Arcade.Sprite;
    bust.setDepth(BUST[1] * TILE + 28);
    bust.body!.setSize(30, 12).setOffset(5, 50);
    this.lightSpots.push({ x: BUST[0] * TILE, y: BUST[1] * TILE + 6, r: 2.2 });
    // bushes along the building fronts, door lights
    for (const b of BUILDINGS) {
      for (const [x, y] of bushSpots(b, this.map)) this.add.image(x * TILE, y * TILE, 'bush').setDepth(y * TILE + 12);
    }
    for (const loc of LOCATIONS) { const d = loc.doors?.[0]; if (d) this.lightSpots.push({ x: d.x * TILE + 16, y: d.y * TILE + 24, r: 1.6 }); }
    this.warmLights = this.add.group();
    for (const l of this.lightSpots) this.warmLights.add(this.add.image(l.x, l.y, 'warm').setScale(l.r / 2.5).setDepth(200_001).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0));
    // ground detail (lawn, worn edges, plaza outlines, court markings) and the living bits on top
    this.ambient = new Ambient(this, dressGround(this, this.map));

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
    // the campus was rebuilt: places you already know stay uncovered at their new spots
    if (this.layoutReset) for (const id of this.save.discovered) {
      const loc = LOCATIONS.find((l) => l.id === id);
      if (loc) this.revealArea(loc.revealRect ?? loc.rect);
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
    try { localStorage.removeItem('dacka.view'); } catch { /* private mode */ }
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
    // your room is your year's: the classmates from your dorm sit at the other desks
    const sameDorm = NPCS.filter((n) => n.kind === 'classmate' && n.gender === this.save.character.gender);
    const seats = DESKS.filter(([x, y]) => !(x === MY_DESK[0] && y === MY_DESK[1]));
    seats.forEach(([x, y], i) => {
      const def = sameDorm[i % sameDorm.length];
      if (!def || i >= sameDorm.length) return;
      const sp = this.physics.add.sprite((ROOM_OX + x + 0.5) * TILE, (y + 1.35) * TILE, `npc-${def.id}`, 9).setDepth((y + 1) * TILE + 16);
      sp.body!.setSize(16, 10).setOffset(8, 21);
      sp.setImmovable(true);
      sp.setData('def', def).setData('slot', this.roomMates.length);
      // (they sleep in pyjamas, and change at their lockers when they get up)
      makeCharacterTexture(this, `npc-${def.id}-pj`, { ...DEFAULT_LOOK, ...def.look, ...PYJAMAS, skirt: false });
      this.physics.add.collider(this.player, sp);
      this.roomMates.push(sp);
    });
    // the payphone on the back wall
    this.payphone = this.add.image((ROOM_OX + PHONE_SPOT[0] + 0.5) * TILE, 2.05 * TILE, 'payphone').setOrigin(0.5, 1).setDepth(2 * TILE + 2);
    tag(PHONE_SPOT[0], 1.2, L({ tr: 'Telefon', en: 'Phone' }));
    // Cemil Emmi, the old caretaker of the boys' dorm
    makeCharacterTexture(this, 'cemil', { ...DEFAULT_LOOK, skin: '#d9a77d', hair: '#c9c9c9', hairStyle: 1, skirt: false, top: '#6b5a44', bottom: '#3a3a3a', glasses: true });
    this.cemilOut.setTexture('cemil', 0).setScale(1.12).setDepth(CEMIL_OUT[1] * TILE + 16);
    this.cemilOut.refreshBody();
    (this.cemilOut.body as Phaser.Physics.Arcade.StaticBody).setSize(16, 10).setOffset(10, 24);
    this.cemilIn = this.add.sprite((ROOM_OX + CEMIL_IN[0]) * TILE, CEMIL_IN[1] * TILE, 'cemil', 1).setScale(1.12).setDepth(CEMIL_IN[1] * TILE + 16).setVisible(false);
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
    // a pool of diners: whoever the routine says is eating right now takes a seat
    for (let i = 0; i < NPCS.length; i++) {
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

  /** seats whoever is in the dining hall right now: people arrive and leave through the meal */
  private seatDiners() {
    const here = NPCS.filter((n) => this.whereIs(n) === 'yemekhane');
    const key = here.map((n) => n.id).join(',');
    if (key === this.dinerKey) return;
    this.dinerKey = key;
    const ids = new Set(here.map((n) => n.id));
    // those who have finished get up
    for (const d of this.diners) {
      const def = d.getData('def') as NpcDef | null;
      if (d.visible && !(def && ids.has(def.id))) { d.setVisible(false); d.body!.enable = false; d.setData('def', null).setData('seat', null); }
    }
    const seated = new Set(this.diners.filter((d) => d.visible).map((d) => (d.getData('def') as NpcDef).id));
    const taken = new Set(this.diners.filter((d) => d.visible).map((d) => d.getData('seat')));
    // nobody sits down on top of you
    const px = this.player.x / TILE - DINING_OX, py = this.player.y / TILE;
    const free = SEATS.filter((s) => !taken.has(s) && !(this.room === 'dining' && Math.hypot(px - (s.x + 0.5), py - (s.y + 0.35)) < 0.8)).sort(() => Math.random() - 0.5);
    for (const def of here) {
      if (seated.has(def.id)) continue;
      const sp = this.diners.find((d) => !d.visible), seat = free.pop();
      if (!sp || !seat) break;
      sp.setTexture(`npc-${def.id}`, seat.faces * 3).setPosition((DINING_OX + seat.x + 0.5) * TILE, (seat.y + 0.35) * TILE)
        .setDepth((seat.y + 0.4) * TILE + 16).setVisible(true);
      sp.body!.enable = true;
      sp.setData('def', def).setData('seat', seat);
    }
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
    if (m || isSnackTime(this.save.clock.minutes)) this.hud.toast(m
      ? L({ tr: `${m.name} servisi var: ellerini yıka, tezgâhtan tepsini al ve boş bir yere otur.`, en: `${m.name} is being served: wash your hands, get a tray at the counter and find a free seat.` })
      : L({ tr: 'Ara öğün saati: tezgâhta poğaça, simit ve kek var.', en: 'Snack time: poğaça, simit and cake at the counter.' }));
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
    const snack = isSnackTime(this.save.clock.minutes);
    this.cooks.forEach((c, i) => c.setVisible(serving || snack).setFrame(Math.floor(time / 900 + i) % 5 === 0 ? 1 : 0));
    // carry your tray
    this.trayImg.setVisible(this.room === 'dining' && (!!this.tray || !!this.trayAt));
    if (this.tray) this.trayImg.setPosition(this.player.x, this.player.y + 4).setDepth(this.player.y + 18);
    else if (this.trayAt) this.trayImg.setPosition(this.trayAt.x, this.trayAt.y).setDepth(this.trayAt.y + 20);
    if (this.tray && !serving) { this.tray = null; this.hud.toast(L({ tr: 'Servis bitti; tepsini geri bıraktın.', en: 'Serving is over; you put your tray back.' })); }
    // the hall shuts between meals: whoever is still inside is shown out (once they've finished eating)
    if (this.room === 'dining' && !diningOpen(this.save.clock.minutes) && !this.blocked() && !this.sleeping) {
      this.leaveDorm();
      this.hud.toast(L({ tr: 'Yemekhane kapandı; görevli seni kapının önüne çıkardı.', en: 'The dining hall has closed; the staff showed you out to the door.' }));
    }
  }

  /** sit down with your tray: the meal takes a while (the hall goes on around you), then you're full */
  private startMeal(seat: { x: number; y: number; faces: 0 | 3 }) {
    const ctx = this.gameCtx();
    const tray = this.tray!;
    this.tray = null;
    this.player.setPosition((DINING_OX + seat.x + 0.5) * TILE, (seat.y + 0.35) * TILE).setVelocity(0, 0);
    this.player.anims.stop();
    this.dir = seat.faces;
    // whoever is at your table when you finish is who you ate with
    const tablemates = () => this.diners.filter((d) => d.visible && Math.abs((d.getData('seat') as { x: number }).x - seat.x) <= 1
      && Math.abs((d.getData('seat') as { y: number }).y - seat.y) <= 2).map((d) => d.getData('def') as NpcDef).slice(0, 4);
    this.trayAt = { x: this.player.x, y: this.player.y + (seat.faces === 0 ? 14 : -14) };
    this.sleeping = true;
    this.sleepRun = {
      kind: 'eat', msPerMin: MEAL_MS_PER_MIN, acc: 0, left: MEAL_MINUTES, total: MEAL_MINUTES, busy: false, events: [],
      onDone: () => { this.trayAt = null; eatMeal(ctx, tray.meal, tray.name, tablemates()); this.persist(); },
    };
    this.hud.toast(L({ tr: `${tray.name}: afiyet olsun!`, en: `${tray.name}: enjoy your meal!` }), 'good');
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
    if (COUNTER_TILES.some(([x, y]) => near(x, y + 0.9, 1))) return { id: 'counter', label: this.tray ? L({ tr: 'Tepsin elinde: boş bir yere otur', en: 'You have your tray: find a free seat' })
      : !currentMeal(this.gameCtx()) && isSnackTime(this.save.clock.minutes) ? L({ tr: 'Ara öğün', en: 'Afternoon snack' }) : L({ tr: 'Tepsini al', en: 'Get a tray' }) };
    if (SINKS.some(([x, y]) => near(x + 0.8, y, 1.1))) return { id: 'sink', label: L({ tr: 'Ellerini yıka', en: 'Wash your hands' }) };
    for (const d of this.diners) {
      if (d.visible && Phaser.Math.Distance.Between(d.x, d.y, this.player.x, this.player.y) < 1.4 * TILE) {
        const def = d.getData('def') as NpcDef;
        return { id: 'diner', label: this.tagged(def), npc: def };
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
        if (!currentMeal(ctx) && isSnackTime(ctx.clock.minutes)) { this.panel.open(() => araOgun(ctx)); break; }
        const lock = trayLock(ctx);
        if (lock) { this.hud.toast(lock); break; }
        this.tray = currentMeal(ctx);
        sfx.click();
        this.hud.toast(L({ tr: `${this.tray!.name} tepsin hazır! Boş bir yere otur.`, en: `Your ${this.tray!.name.toLowerCase()} tray is ready! Find a free seat.` }), 'good');
        break;
      }
      case 'seat': {
        this.startMeal(this.freeSeatNear()!);
        break;
      }
      case 'sink': washHands(ctx); break;
      case 'diner': this.nearNpc = th.npc!; this.panel.open(() => npcPanel(th.npc!, ctx)); break;
      case 'exit': this.panel.open(() => yemekhane(ctx)); break;
    }
  }

  /** a friend's name carries a heart, so you can tell them from everyone else at a glance */
  private isFriend(def: NpcDef): boolean {
    return def.kind !== 'belletmen' && def.kind !== 'teacher' && (this.save.state.friends[def.id] ?? 0) >= FRIEND_AT;
  }
  private tagged(def: NpcDef): string {
    return `${this.isFriend(def) ? '💛 ' : ''}${def.name}`;
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
    this.classLife = new ClassLife(this, this.classMates.map((sp, i) => ({ sp, desk: seats[i % seats.length] })), this.teacher, (sp, text) => this.bubbleAbove(sp, text));
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
    if (les && this.lessonsOn()) {
      const sname = L(SUBJECTS.find((x) => x.id === les.subject)!.name);
      const late = this.save.clock.minutes - les.p.start;
      const slip = this.save.state.daily[`slip-${les.p.id}`] === this.save.clock.day;
      if (this.save.state.school.attended.includes(`${this.save.clock.day}-${les.p.id}`)) { /* you've had this lesson */ }
      else if (this.save.state.sick) this.hud.toast(L({ tr: `${les.teacher.name}: "Hastasın sen! Seni derse alamam, doğru Revir'e git."`, en: `${les.teacher.name}: "You're ill! I can't have you in class. Go straight to the infirmary."` }));
      else if (late > LATE_AFTER && !slip) this.hud.toast(L({ tr: `${les.teacher.name}: "${late} dakika geç kaldın! Önce müdür yardımcısından geç kâğıdı al." (kapıdan koridora çık)`, en: `${les.teacher.name}: "You're ${late} minutes late! Get a late slip from the deputy head first." (go out to the corridor)` }));
      else this.hud.toast(L({ tr: `${sname} dersi · ${les.teacher.name}. Sırana otur!`, en: `${sname} with ${les.teacher.name}. Take your seat!` }));
    }
    this.persist();
  }

  /** the break the class is on (null in a lesson, or when there are no lessons yet) */
  private classBreakNow() {
    const c = this.save.clock;
    return this.routineClock().lessonsOn ? classBreak(c.day, c.minutes) : null;
  }

  /** who's at the front: the lesson's teacher, or in a short break the one whose lesson just ended (they stay at their desk) */
  private classTeacher(): { subject: SubjectId; name: string; lesson: boolean } | null {
    const les = this.currentLesson();
    if (les) return { subject: les.subject, name: les.teacher.name, lesson: true };
    const brk = this.classBreakNow();
    if (!brk?.short || !brk.prev) return null;
    const subject = subjectFor(this.save.clock.day, brk.prev.id);
    return { subject, name: TEACHERS[subject].name, lesson: false };
  }

  private updateClass(time: number, delta: number) {
    const brk = this.classBreakNow();
    const tch = this.classTeacher();
    this.classLife.update(time, delta, {
      inRoom: this.room === 'class',
      breakKey: brk?.key ?? null,
      teacher: tch && !tch.lesson ? { name: tch.name } : null,
      present: (def) => this.whereIs(def) === 'egitim',
    });
    this.classLabels.forEach((l) => l.setVisible(this.room === 'class'));
    const t = this.teacher;
    t.setVisible(!!tch);
    if (!tch) { t.setVelocity(0, 0); t.setData('shown', false); return; }
    if (t.texture.key !== `teacher-${tch.subject}`) t.setTexture(`teacher-${tch.subject}`, 0);
    if (!t.getData('shown')) {
      // just come in: start at the left end of the blackboard
      t.setPosition((CLASS_OX + TEACHER_ROUTE[0][0]) * TILE, TEACHER_ROUTE[0][1] * TILE);
    }
    t.setData('shown', true);
    const leg = t.getData('leg') as number;
    // at a break the teacher goes round behind their desk and stays there for anyone who comes up
    const [tx, ty] = tch.lesson ? TEACHER_ROUTE[leg % TEACHER_ROUTE.length] : t.x < (CLASS_OX + 13) * TILE - 4 ? [13, 2.3] : [15, 2.3];
    const gx = (CLASS_OX + tx) * TILE, gy = ty * TILE;
    const there = Math.hypot(gx - t.x, gy - t.y) < 6;
    if (tch.lesson && there) { t.setData('leg', leg + 1); t.setData('pause', time + 2500); }
    if (!tch.lesson && there && tx === 15) { t.setPosition(gx, gy).setVelocity(0, 0); t.setFrame(0); }
    else if (tch.lesson && (t.getData('pause') ?? 0) > time) { t.setVelocity(0, 0); t.setFrame(0); }
    else {
      const a = Math.atan2(gy - t.y, gx - t.x), v = tch.lesson ? 35 : 60;
      t.setVelocity(Math.cos(a) * v, Math.sin(a) * v);
      t.setFrame((t.body!.velocity.x < 0 ? 1 : 2) * 3 + [1, 0, 2, 0][Math.floor(time / 170) % 4]);
    }
    t.setDepth(t.y + 16);
  }

  private classThingNear(): { id: string; label: string; npc?: NpcDef } | null {
    const px = this.player.x / TILE - CLASS_OX, py = this.player.y / TILE + 0.3;
    const near = (x: number, y: number, r = 1.3) => Math.hypot(px - (x + 0.5), py - (y + 0.5)) < r;
    const tch = this.classTeacher();
    if (tch && this.teacher.visible && Phaser.Math.Distance.Between(this.teacher.x, this.teacher.y, this.player.x, this.player.y) < 1.7 * TILE) {
      return { id: 'teacher', label: L({ tr: `${tch.name} ile konuş`, en: `talk to ${tch.name}` }) };
    }
    for (const sp of this.classMates) {
      if (sp.visible && Phaser.Math.Distance.Between(sp.x, sp.y, this.player.x, this.player.y) < 1.5 * TILE) {
        const def = sp.getData('def') as NpcDef;
        return { id: 'mate', label: this.tagged(def), npc: def };
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
    const tch = this.classTeacher();
    switch (th.id) {
      case 'desk': this.panel.open(() => egitim(ctx, 'desk')); break;
      case 'exit': this.panel.open(() => egitim(ctx, 'corridor')); break;
      case 'teacher':
        this.hud.showModal({
          title: tch!.name, sub: L(SUBJECTS.find((x) => x.id === tch!.subject)!.name),
          body: L(tch!.lesson
            ? { tr: '"Ders başladı! Hadi sırana geç, bugün güzel bir konumuz var."', en: '"Class has started! Go to your desk, we have a great topic today."' }
            : { tr: '"Teneffüs, biraz dinlen! Bir sorun olursa çekinme, sor."', en: '"It\'s break time, have a rest! If you have a question, just ask."' }),
          button: L({ tr: 'Tamam', en: 'OK' }),
        });
        break;
      case 'mate':
        // at a break you can actually talk; in a lesson they shush you
        if (this.classBreakNow()) { this.nearNpc = th.npc!; this.panel.open(() => npcPanel(th.npc!, ctx)); }
        else this.hud.toast(L({ tr: `${th.npc!.name}: "Şşş! Ders var, sonra konuşuruz."`, en: `${th.npc!.name}: "Shh! We're in class, talk later."` }));
        break;
    }
  }

  /** walk into your dorm room */
  /** `escortedBy`: a belletmen caught you outside and brought you in */
  private enterDorm(escortedBy?: string) {
    if (!this.room) this.outdoorZoom = this.cameras.main.zoom;
    this.room = 'dorm';
    this.player.setPosition((ROOM_OX + ROOM_SPAWN[0]) * TILE, ROOM_SPAWN[1] * TILE).setVelocity(0, 0);
    this.dir = 3;
    this.setCameraArea();
    this.cameras.main.fadeIn(280, 10, 14, 20);
    this.hud.setPrompt(null);
    if (escortedBy) {
      this.hud.toast(phaseOf(this.save.clock.minutes, this.save.clock.day) === 'etut'
        ? L({ tr: `${escortedBy}: "Masana otur ve ders çalış. Gözüm üstünde!"`, en: `${escortedBy}: "Sit at your desk and study. I'm watching you!"` })
        : L({ tr: `${escortedBy}: "Doğru yatağına! Bir daha olmasın."`, en: `${escortedBy}: "Straight to bed! Don't let it happen again."` }));
    }
    else if (!this.save.state.once.luggage) this.hud.toast(L({ tr: 'Dolabın sağdaki yatakhanede, alt duvarda (sarı etiket). Bavulunu oraya götür ve dolabına yerleştir.', en: 'Your locker is in the sleeping room on the right, on the bottom wall (yellow tag). Take your suitcase there and unpack it.' }));
    else if (!this.settled()) { /* registration weekend: come and go as you please */ }
    else if (phaseOf(this.save.clock.minutes, this.save.clock.day) === 'night') {
      const mm = this.save.clock.minutes;
      const late = mm >= 22 * 60 ? mm - 22 * 60 : mm + 120;
      const bel = this.save.character.gender === 'girl' ? 'Hatice Hanım' : 'Mehmet Bey';
      if (late >= 5) this.hud.toast(L({ tr: `${bel} kapıda bekliyordu: "${late} dakika geç! Hemen yatağına."`, en: `${bel} was waiting at the door: "${late} minutes late! Straight to bed."` }));
    }
    else if (phaseOf(this.save.clock.minutes, this.save.clock.day) === 'etut') {
      const late = this.save.clock.minutes - 18 * 60;
      const bel = this.save.character.gender === 'girl' ? 'Hatice Hanım' : 'Mehmet Bey';
      this.hud.toast(late >= 5
        ? L({ tr: `${bel} saatine bakıyor: "${late} dakika geç kaldın. Otur yerine."`, en: `${bel} checks the time: "You're ${late} minutes late. Sit down."` })
        : L({ tr: 'Etüt saati: masana otur ya da sınıf arkadaşlarınla (dikkatli) konuş.', en: 'Study time: sit at your desk, or (carefully) talk to your classmates.' }));
    }
    this.persist();
  }

  /** step out of whichever room you're in, by the door you came in at */
  private leaveDorm() {
    const from = this.room;
    if (!from) return; // (menus of buildings you never walk into have nothing to step out of)
    this.room = null;
    this.tray = null; this.trayAt = null;
    const stand = this.exitTile(from);
    this.player.setPosition((stand.x + 0.5) * TILE, (stand.y + 0.5) * TILE).setVelocity(0, 0);
    this.setCameraArea();
    this.cameras.main.fadeIn(280, 10, 14, 20);
    this.lastTile = { x: -1, y: -1 };
    this.persist();
  }

  private roomLoc(room: 'dorm' | 'class' | 'dining') {
    return room === 'class' ? LOCATIONS.find((l) => l.id === 'egitim')! : room === 'dining' ? LOCATIONS.find((l) => l.id === 'yemekhane')! : this.ownDormLoc();
  }

  /** the step outside the door you used to get into this room (its first door if that isn't known) */
  private exitTile(room: 'dorm' | 'class' | 'dining'): { x: number; y: number } {
    const stands = this.roomLoc(room).doors!.map(doorStandTile);
    const last = this.lastDoor;
    return (last && stands.find((d) => d.x === last.x && d.y === last.y)) || stands[0];
  }

  /** the door of a place nearest to you (its outside step) */
  private nearestStand(loc: Location): { x: number; y: number } {
    const px = this.player.x / TILE, py = this.player.y / TILE;
    return loc.doors!.map(doorStandTile).reduce((a, b) => (Math.hypot(a.x + 0.5 - px, a.y + 0.5 - py) <= Math.hypot(b.x + 0.5 - px, b.y + 0.5 - py) ? a : b));
  }

  /** where you are on the campus map (the door you went in by while inside) */
  private campusPos(): { x: number; y: number } {
    if (!this.room) return { x: this.player.x / TILE, y: this.player.y / TILE };
    const s = this.exitTile(this.room);
    return { x: s.x + 0.5, y: s.y + 0.5 };
  }

  /** little z's float up from everyone asleep in the room */
  private updateZzz(on: boolean, time: number) {
    const sleepers = on ? [...this.roomMates.filter((s) => s.visible && s.angle !== 0), ...(this.sleepRun?.kind === 'sleep' ? [this.player] : [])] : [];
    while (this.zzz.length < sleepers.length) {
      this.zzz.push(this.add.text(0, 0, 'z', { fontFamily: '"Pixelify Sans", monospace', fontSize: '13px', fontStyle: 'bold', color: '#dfe8ff', stroke: '#1d2326', strokeThickness: 3 }).setOrigin(0.5).setDepth(95_500));
    }
    this.zzz.forEach((z, i) => {
      const s = sleepers[i];
      if (!s) { z.setVisible(false); return; }
      const t = ((time / 1600) + i * 0.37) % 1;
      z.setVisible(true).setText(t < 0.33 ? 'z' : t < 0.66 ? 'zz' : 'zZz').setAlpha(1 - t * 0.8).setPosition(s.x + 6 + t * 8, s.y - 14 - t * 16);
    });
  }

  /** word of wet sheets gets around: the more nights you failed, the likelier someone mocks you (and the more respect it costs) */
  private peeGossip() {
    const st = this.save.state;
    const c = st.cemil;
    if (c.peeFails <= 0 || c.pee === 'held' || c.pee === 'rewarded') return;
    const freshNight = c.wetDay === this.save.clock.day;
    const chance = Math.min(0.92, 0.15 + 0.18 * c.peeFails + (freshNight ? 0.2 : 0));
    if (Math.random() > chance) return;
    const me = this.save.character;
    const pool = NPCS.filter((n) => (n.kind === 'classmate' || n.kind === 'student') && n.gender === me.gender);
    const mocker = pool[Math.floor(Math.random() * pool.length)];
    if (!mocker) return;
    const loss = 3 + c.peeFails * 2;
    me.respect = Math.max(0, me.respect - loss);
    this.changeMood(-6);
    this.befriend(mocker.id, -3);
    const lines = [
      { tr: `${mocker.name} kahvaltıda herkesin önünde "Çişli ${me.first}!" diye bağırdı. 😖 −${loss} saygınlık`, en: `${mocker.name} shouted "Wet-bed ${me.first}!" in front of everyone at breakfast. 😖 −${loss} respect` },
      { tr: `${mocker.name} yatağının önüne "dikkat, ıslak zemin" yazısı koymuş. 😖 −${loss} saygınlık`, en: `${mocker.name} put a "caution: wet floor" sign by your bed. 😖 −${loss} respect` },
      { tr: `Koridorda ${mocker.name} ve arkadaşları seni görünce kıkırdadı. 😖 −${loss} saygınlık`, en: `${mocker.name} and friends giggled when you walked down the corridor. 😖 −${loss} respect` },
    ];
    this.hud.toast(L(lines[Math.floor(Math.random() * lines.length)]));
  }

  /** where the special characters stand right now */
  private updateCharacters() {
    const c = this.save.clock;
    const m = c.minutes;
    const boy = this.save.character.gender === 'boy';
    this.cemilIn.setVisible(this.room === 'dorm' && boy && m >= 7 * 60 && m < LIGHTS_OUT);
    const outDay = m >= 8 * 60 && m < 18 * 60;
    this.cemilOut.setVisible(outDay);
    (this.cemilOut.body as Phaser.Physics.Arcade.StaticBody).enable = outDay;
    if (outDay) this.cemilOut.setFrame(Math.floor(this.time.now / 900) % 2 ? 1 : 2);
  }

  /** E-interactions outdoors that aren't doors or students: Cemil Emmi, the courts */
  private outdoorSpot(): { label: string; open: () => void } | null {
    if (this.room) return null;
    const ctx = () => this.gameCtx();
    if (this.cemilOut.visible && Phaser.Math.Distance.Between(this.cemilOut.x, this.cemilOut.y, this.player.x, this.player.y) < 1.6 * TILE) {
      return { label: 'Cemil Emmi', open: () => { const g = ctx(); this.panel.open(() => cemilPanel(g)); } };
    }
    if (this.match) return null;
    const px = this.player.x / TILE, py = this.player.y / TILE;
    for (const { sport, rect: r } of PLAY_COURTS) {
      if (px >= r.x - 0.5 && px <= r.x + r.w + 0.5 && py >= r.y - 0.5 && py <= r.y + r.h + 0.5) {
        return { label: L(sport === 'basketball' ? { tr: 'Basketbol sahası', en: 'Basketball court' } : { tr: 'Futbol sahası', en: 'Football pitch' }), open: () => { this.courtAt = r; const g = ctx(); this.panel.open(() => courtPanel(g, sport)); } };
      }
    }
    return null;
  }

  /** ask friends who are around to come and play; they walk over while you wait */
  private callFriends(sport: CourtSport): string | null {
    if (this.match) return L({ tr: 'Zaten arkadaşlarını bekliyorsun.', en: "You're already waiting for your friends." });
    const need = COURT_PLAYERS[sport];
    const st = this.save.state;
    const court = this.courtAt ?? COURTS[sport];
    const cx = court.x + court.w / 2, cy = court.y + court.h / 2;
    const pals = this.npcs.filter((n) => {
      const def = n.getData('def') as NpcDef;
      return n.visible && n.body!.enable && def.kind !== 'belletmen' && (st.friends[def.id] ?? 0) >= FRIEND_AT / 2;
    }).sort((a, b) => (st.friends[(b.getData('def') as NpcDef).id] ?? 0) - (st.friends[(a.getData('def') as NpcDef).id] ?? 0)).slice(0, need);
    if (pals.length < need) {
      return L({ tr: `Çağıracak kadar yakın arkadaşın yok (${pals.length}/${need}). Önce biraz daha arkadaş edin!`, en: `Not enough good friends around to call (${pals.length}/${need}). Make some more friends first!` });
    }
    pals.forEach((n, i) => {
      const a = (i / need) * Math.PI * 2;
      n.setData('summon', [cx + Math.cos(a) * (court.w / 2 - 1.2), cy + Math.sin(a) * (court.h / 2 - 1)]);
      n.setData('arriveAt', this.time.now + 3000 + Math.random() * 9000);
    });
    this.match = { sport, court, mates: pals, until: this.time.now + 75_000, ready: false };
    const names = pals.map((n) => (n.getData('def') as NpcDef).name).join(', ');
    this.hud.toast(L({ tr: `📣 ${names}: "Geliyoruz!"`, en: `📣 ${names}: "On our way!"` }), 'good');
    return null;
  }

  private updateMatch(time: number) {
    const m = this.match;
    if (!m) return;
    if (m.ready) { if (!this.panel.isOpen) this.endMatch(); return; }
    const court = m.court;
    const cx = (court.x + court.w / 2) * TILE, cy = (court.y + court.h / 2) * TILE;
    if (this.room || Phaser.Math.Distance.Between(this.player.x, this.player.y, cx, cy) > 12 * TILE) {
      this.endMatch(); this.hud.toast(L({ tr: 'Sahadan ayrıldın; arkadaşların dağıldı.', en: 'You left the court; your friends wandered off.' })); return;
    }
    let arrived = 0;
    for (const n of m.mates) {
      const [tx, ty] = n.getData('summon') as [number, number];
      const d = Phaser.Math.Distance.Between(n.x, n.y, tx * TILE, ty * TILE);
      // friends who are far away (or stuck behind a building) come round along the path
      if (d > 7 * TILE && time > (n.getData('arriveAt') as number)) n.setPosition((tx + (Math.random() - 0.5) * 4) * TILE, (court.y - 1.2) * TILE);
      if (d < 1.2 * TILE) arrived++;
    }
    const need = m.mates.length;
    const left = Math.max(0, Math.ceil((m.until - time) / 1000));
    this.hud.setBanner(L({ tr: `${m.sport === 'basketball' ? '🏀' : '⚽'} Arkadaşların geliyor: ${arrived}/${need} · ${left}s`, en: `${m.sport === 'basketball' ? '🏀' : '⚽'} Friends on their way: ${arrived}/${need} · ${left}s` }),
      { label: L({ tr: 'Vazgeç', en: 'Cancel' }), onClick: () => this.endMatch() });
    if (arrived >= need) {
      m.ready = true;
      this.hud.setBanner(null);
      const ctx = this.gameCtx();
      const defs = m.mates.map((n) => n.getData('def') as NpcDef);
      this.player.setVelocity(0, 0);
      this.panel.open(() => ({
        title: L({ tr: 'Herkes geldi!', en: "Everyone's here!" }), sub: defs.map((d) => d.name).join(' · '),
        rooms: [{ id: 'match', name: L({ tr: 'Maç', en: 'Match' }), note: L({ tr: 'Takımlar kuruldu. Hazır mısın?', en: 'Teams are picked. Ready?' }),
          actions: [{ id: 'play', label: L({ tr: '▶️ Maça başla', en: '▶️ Kick off' }), hint: L({ tr: '45 dk · −18 enerji · beceri ve Kondisyon', en: '45 min · −18 energy · skill and Fitness' }),
            run: async () => { await playMatch(ctx, m.sport, defs); this.endMatch(); this.panel.close(); } }] }],
      }));
    } else if (time > m.until) {
      this.endMatch();
      this.hud.toast(L({ tr: 'Herkes gelemedi; maç başka sefere.', en: "Not everyone made it; the game's off for now." }));
    }
  }

  private endMatch() {
    if (!this.match) return;
    for (const n of this.match.mates) { n.setData('summon', undefined); n.setData('arriveAt', undefined); }
    this.match = null;
    this.hud.setBanner(null);
  }

  private updateRoom(time: number, delta: number) {
    const c = this.save.clock;
    const phase = phaseOf(c.minutes, c.day);
    const study = phase === 'etut';
    const night = phase === 'night' || this.sleepRun?.kind === 'sleep';
    const early = c.minutes < 9 * 60; // still in the dorm in the morning = not up yet
    const beds = BEDS.filter(([x, y]) => !(x === MY_BED[0] && y === MY_BED[1]));
    const step = (Math.min(delta, 100) / 1000) * 75 * (this.fast ? 3 : 1);
    this.roomMates.forEach((sp, i) => {
      const def = sp.getData('def') as NpcDef;
      const home = this.whereIs(def) === 'dorm';
      if (!sp.getData('desk')) sp.setData('desk', [sp.x, sp.y]);
      const wake = wakeTime(def, c.day);
      const tex = (pj: boolean) => { const key = pj ? `npc-${def.id}-pj` : `npc-${def.id}`; if (sp.texture.key !== key) sp.setTexture(key, 0); };
      // just up: over to the lockers in pyjamas, a few minutes changing, then off to breakfast in uniform
      if (home && early && !night && c.minutes >= wake && c.minutes < wake + DRESS_MINUTES && !this.rushOn()) {
        const lx = (ROOM_OX + 21 + (i % 4) + 0.5) * TILE, ly = 11.35 * TILE;
        if (sp.angle !== 0) sp.setAngle(0);
        sp.setVisible(this.room === 'dorm'); sp.body!.enable = false;
        const dx = lx - sp.x, dy = ly - sp.y, d = Math.hypot(dx, dy);
        const changed = c.minutes >= wake + DRESS_MINUTES / 2;
        if (d > 2) {
          // (straight across the sleeping room: beds are low enough to walk round in a blink)
          sp.setPosition(sp.x + (dx / d) * Math.min(d, step), sp.y + (dy / d) * Math.min(d, step));
          tex(true);
          sp.setFrame((Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0) * 3 + [1, 0, 2, 0][Math.floor(time / 150) % 4]);
        } else {
          tex(!changed);
          // rummaging in the locker, pulling a sweater over their head
          sp.setFrame(Math.floor(time / 260 + i) % 3 === 0 ? 1 : 0);
          if (!changed && !sp.getData('dressSaid') && this.room === 'dorm' && Math.random() < 0.01) { sp.setData('dressSaid', true); this.bubbleAbove(sp, L({ tr: 'Kazağım nerede?', en: "Where's my sweater?" })); }
        }
        sp.setDepth(sp.y + 16);
        return;
      }
      sp.setData('dressSaid', false);
      if ((night || early) && home) {
        // asleep in the bunks next to yours (there are more of them than beds in this corner: the rest sleep next door)
        const b = beds[i];
        if (!b) { sp.setVisible(false); sp.body!.enable = false; return; }
        tex(true);
        sp.setPosition((ROOM_OX + b[0] + 0.5) * TILE, (b[1] + 0.45) * TILE).setAngle(i % 2 ? 90 : -90).setFrame(0).setDepth((b[1] + 1) * TILE + 4);
        sp.setVisible(this.room === 'dorm'); sp.body!.enable = false;
        return;
      }
      const [dx, dy] = sp.getData('desk') as [number, number];
      tex(false);
      if (sp.angle !== 0 || sp.x !== dx || sp.y !== dy) sp.setAngle(0).setPosition(dx, dy).setDepth(dy + 16);
      sp.setVisible(home);
      sp.body!.enable = home;
      // heads down, writing: a tiny bob now and then
      sp.setFrame(9 + (study && Math.floor(time / 700 + sp.x) % 5 === 0 ? 1 : 0));
    });
    this.updateZzz(night && this.room === 'dorm', time);
    const bel = this.roomBelletmen;
    // in the room for study time and through the night; from 20:00 to 22:00 they watch the plaza outside
    const onDuty = phase === 'etut' || phase === 'night';
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
        return { id: 'mate', label: L({ tr: `${this.tagged(def)} ile…`, en: `${this.tagged(def)}…` }), npc: def };
      }
    }
    if (this.cemilIn.visible && Phaser.Math.Distance.Between(this.cemilIn.x, this.cemilIn.y, this.player.x, this.player.y) < 1.6 * TILE) return { id: 'cemil', label: 'Cemil Emmi' };
    if (near(PHONE_SPOT[0], 2.2, 1.2)) return { id: 'phone', label: L({ tr: 'Telefon', en: 'Phone' }) };
    if (near(MY_DESK[0], MY_DESK[1] + 0.8)) return { id: 'desk', label: L({ tr: 'Masana otur', en: 'Sit at your desk' }) };
    if (near(MY_BED[0], MY_BED[1], 1.6)) return { id: 'bed', label: L({ tr: 'Yatağın', en: 'Your bed' }) };
    if (near(MY_LOCKER[0], MY_LOCKER[1] - 0.6, 1.3)) return { id: 'locker', label: this.save.state.once.luggage ? L({ tr: 'Dolabın', en: 'Your locker' }) : L({ tr: 'Dolabın: bavulunu yerleştir', en: 'Your locker: unpack your suitcase' }) };
    // the lockers next to yours belong to your classmates
    if ([22, 23, 24].some((x) => near(x, MY_LOCKER[1] - 0.6, 1.1))) {
      const pal = dormBestFriend(this.gameCtx());
      return { id: 'matelocker', label: pal ? L({ tr: `${genitiveTr(pal.name)} dolabı · kıyafet iste`, en: `${pal.name}'s locker · borrow clothes` }) : L({ tr: 'Arkadaşının dolabı', en: "A friend's locker" }) };
    }
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
      case 'matelocker': this.panel.open(() => mateLockerPanel(ctx)); break;
      case 'tv': this.panel.open(() => tvPanel(ctx)); break;
      case 'exit': this.panel.open(() => exitPanel(ctx)); break;
      case 'phone': this.panel.open(() => phonePanel(ctx)); break;
      case 'cemil': this.panel.open(() => cemilPanel(ctx)); break;
    }
  }

  private drawCourtLines() {
    const g = this.add.graphics().setDepth(1);
    // basketball courts: outline, halfway line, centre circle, three-point arcs (across the long side)
    for (const bk of [COURTS.basketball, ...EXTRA_COURTS]) {
      const x = bk.x * TILE + 8, y = bk.y * TILE + 8, w = bk.w * TILE - 16, h = bk.h * TILE - 16;
      g.lineStyle(2, 0xf2f2ea, 0.9);
      g.strokeRect(x, y, w, h);
      if (w >= h) g.lineBetween(x + w / 2, y, x + w / 2, y + h); else g.lineBetween(x, y + h / 2, x + w, y + h / 2);
      g.strokeCircle(x + w / 2, y + h / 2, Math.min(28, Math.min(w, h) / 3));
    }
    // football pitch: touchlines, halfway line, centre circle, penalty boxes and goals at both ends
    const fb = COURTS.football;
    const x = fb.x * TILE + 6, y = fb.y * TILE + 6, w = fb.w * TILE - 12, h = fb.h * TILE - 12;
    g.lineStyle(2, 0xffffff, 0.85);
    g.strokeRect(x, y, w, h);
    g.strokeCircle(x + w / 2, y + h / 2, 30);
    if (w >= h) {
      g.lineBetween(x + w / 2, y, x + w / 2, y + h);
      g.strokeRect(x, y + h / 2 - 48, 64, 96);
      g.strokeRect(x + w - 64, y + h / 2 - 48, 64, 96);
      g.lineStyle(3, 0xffffff, 1);
      g.strokeRect(x - 10, y + h / 2 - 24, 10, 48);
      g.strokeRect(x + w, y + h / 2 - 24, 10, 48);
    } else {
      g.lineBetween(x, y + h / 2, x + w, y + h / 2);
      g.strokeRect(x + w / 2 - 64, y, 128, 64);
      g.strokeRect(x + w / 2 - 64, y + h - 64, 128, 64);
      g.strokeRect(x + w / 2 - 28, y, 56, 22);
      g.strokeRect(x + w / 2 - 28, y + h - 22, 56, 22);
      g.lineStyle(3, 0xffffff, 1);
      g.strokeRect(x + w / 2 - 28, y - 10, 56, 10);
      g.strokeRect(x + w / 2 - 28, y + h, 56, 10);
    }
  }



  private createAnims() {
    const names = ['down', 'left', 'right', 'up'] as const;
    names.forEach((n, dir) => {
      const key = `player-walk-${n}`;
      if (this.anims.exists(key)) return;
      this.anims.create({ key, frames: this.anims.generateFrameNumbers('player', { frames: [dir * 3 + 1, dir * 3, dir * 3 + 2, dir * 3] }), frameRate: 8, repeat: -1 });
    });
  }

  /** nearest tile to (x, y) where an NPC can hang out (open ground, not in front of a door) */
  private walkable(x: number, y: number): [number, number] {
    let fallback: [number, number] | null = null;
    for (let r = 0; r < 9; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const tx = Math.round(x + dx), ty = Math.round(y + dy);
      if (tx <= 4 || ty <= 4 || tx >= MAP_W - 5 || ty >= MAP_H - 5 || !this.npcReach[ty * MAP_W + tx]) continue;
      if (!this.doorClear[ty * MAP_W + tx]) return [tx, ty];
      fallback ??= [tx, ty];
    }
    return fallback ?? [x, y];
  }

  /** which tiles NPCs can walk on, and which ones (in front of doors) they should keep clear */
  private buildNpcGrid(obstacles: Phaser.Physics.Arcade.StaticGroup) {
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      this.npcGrid[y * MAP_W + x] = SOLID_TILES.includes(this.map[y][x] as never) ? 0 : 1;
    }
    // slanted and round walls cut across tiles: keep NPCs off tiles a wall runs through
    for (const b of BUILDINGS) {
      const r = b.rect;
      for (let y = Math.floor(r.y) - 1; y <= Math.ceil(r.y + r.h); y++) for (let x = Math.floor(r.x) - 1; x <= Math.ceil(r.x + r.w); x++) {
        if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
        if (passageAt(x + 0.5, y + 0.5, b)) continue; // its corridor stays open
        if (inPoly(x + 0.5, y + 0.5, b.shape) || nearestEdge(x + 0.5, y + 0.5, b.shape).d < 0.45) this.npcGrid[y * MAP_W + x] = 0;
      }
    }
    for (const o of obstacles.getChildren()) {
      const b = (o as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.StaticBody | null;
      if (!b) continue;
      for (let ty = Math.floor(b.top / TILE); ty <= Math.floor((b.bottom - 1) / TILE); ty++) {
        for (let tx = Math.floor(b.left / TILE); tx <= Math.floor((b.right - 1) / TILE); tx++) {
          if (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H) this.npcGrid[ty * MAP_W + tx] = 0;
        }
      }
    }
    // the open tiles you can actually walk to from the main gate (pockets closed in by walls don't count)
    this.npcReach.fill(0);
    let from = -1;
    for (let y = GATE_IN[1]; y > GATE_IN[1] - 8 && from < 0; y--) if (this.npcGrid[y * MAP_W + GATE_IN[0]]) from = y * MAP_W + GATE_IN[0];
    const queue = from < 0 ? [] : [from];
    if (from >= 0) this.npcReach[from] = 1;
    for (let qi = 0; qi < queue.length; qi++) {
      const cur = queue[qi], x = cur % MAP_W;
      for (const n of [x > 0 ? cur - 1 : -1, x < MAP_W - 1 ? cur + 1 : -1, cur - MAP_W, cur + MAP_W]) {
        if (n < 0 || n >= this.npcGrid.length || !this.npcGrid[n] || this.npcReach[n]) continue;
        this.npcReach[n] = 1;
        queue.push(n);
      }
    }
    for (const loc of LOCATIONS) for (const d of loc.doors ?? []) {
      const s = doorStandTile(d);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const tx = s.x + dx, ty = s.y + dy;
        if (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H) this.doorClear[ty * MAP_W + tx] = 1;
      }
    }
  }

  /** the tile under an NPC's feet (sprites are centred; the feet are 10px below the centre) */
  private npcTile(x: number, y: number): number {
    return Phaser.Math.Clamp(Math.floor((y + 10) / TILE), 0, MAP_H - 1) * MAP_W + Phaser.Math.Clamp(Math.floor(x / TILE), 0, MAP_W - 1);
  }

  /** sprite position that puts an NPC's feet in the middle of tile (tx, ty); fractional tiles allowed */
  private npcSpot(tx: number, ty: number): [number, number] {
    return [(tx + 0.5) * TILE, (ty + 0.5) * TILE - 10];
  }

  /** shortest 4-way route over open tiles (tile indices, start included); null if there's none */
  private findPath(from: number, to: number): number[] | null {
    if (!this.npcGrid[to]) {
      // the goal is inside something: aim for the nearest open tile instead
      const gx = to % MAP_W, gy = Math.floor(to / MAP_W);
      let best = -1, bestD = Infinity;
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const x = gx + dx, y = gy + dy;
        if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H || !this.npcGrid[y * MAP_W + x]) continue;
        if (dx * dx + dy * dy < bestD) { bestD = dx * dx + dy * dy; best = y * MAP_W + x; }
      }
      if (best < 0) return null;
      to = best;
    }
    const prev = new Int32Array(MAP_W * MAP_H).fill(-1);
    prev[from] = from;
    const queue = [from];
    for (let qi = 0; qi < queue.length; qi++) {
      const cur = queue[qi];
      if (cur === to) {
        const path = [cur];
        for (let c = cur; c !== from; c = prev[c]) path.push(prev[c]);
        return path.reverse();
      }
      const x = cur % MAP_W;
      for (const n of [x > 0 ? cur - 1 : -1, x < MAP_W - 1 ? cur + 1 : -1, cur - MAP_W, cur + MAP_W]) {
        if (n < 0 || n >= prev.length || prev[n] !== -1 || !this.npcGrid[n]) continue;
        prev[n] = cur;
        queue.push(n);
      }
    }
    return null;
  }

  /** walk an NPC towards (gx, gy) in sprite pixels, going round buildings; true once it's there */
  private steerNpc(npc: Phaser.Physics.Arcade.Sprite, gx: number, gy: number, speed: number): boolean {
    const goal = this.npcTile(gx, gy);
    let path = npc.getData('path') as number[] | undefined;
    if (!path || npc.getData('pathGoal') !== goal) {
      path = this.findPath(this.npcTile(npc.x, npc.y), goal) ?? [];
      if (path.length > 1) {
        // skip the centre of the tile we're on when we're already lined up with the next step (no back-step)
        const [sx, sy] = this.npcSpot(path[0] % MAP_W, Math.floor(path[0] / MAP_W));
        const vertical = path[1] % MAP_W === path[0] % MAP_W;
        if (Math.abs(vertical ? npc.x - sx : npc.y - sy) < 8) path.shift();
      }
      npc.setData('path', path).setData('pathGoal', goal);
    }
    // drop the waypoints already reached; the last stretch goes to the exact spot
    while (path.length) {
      const [wx, wy] = this.npcSpot(path[0] % MAP_W, Math.floor(path[0] / MAP_W));
      if (Math.hypot(wx - npc.x, wy - npc.y) < 5 || (path.length === 1 && path[0] === goal)) path.shift();
      else break;
    }
    const [tx, ty] = path.length ? this.npcSpot(path[0] % MAP_W, Math.floor(path[0] / MAP_W)) : [gx, gy];
    const d = Math.hypot(tx - npc.x, ty - npc.y);
    // (a spot inside a wall counts as reached once we're on the nearest open tile)
    if (!path.length && (d < 6 || !this.npcGrid[goal])) { npc.setVelocity(0, 0); npc.setData('wantMove', false); return true; }
    const a = Math.atan2(ty - npc.y, tx - npc.x);
    npc.setVelocity(Math.cos(a) * speed, Math.sin(a) * speed);
    npc.setData('wantMove', true);
    return false;
  }

  /** a random open spot within `roam` tiles of home, away from doors */
  private wanderSpot(home: [number, number], roam: number): [number, number] | null {
    for (let i = 0; i < 8; i++) {
      const tx = Math.round(home[0]) + Phaser.Math.Between(-roam, roam), ty = Math.round(home[1]) + Phaser.Math.Between(-roam, roam);
      if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) continue;
      const i2 = ty * MAP_W + tx;
      if (this.npcGrid[i2] && !this.doorClear[i2]) return this.npcSpot(tx, ty);
    }
    return null;
  }

  /** NPCs that haven't moved although they're trying to: re-route, and in the end put them back on track */
  private checkNpcStuck(npc: Phaser.Physics.Arcade.Sprite, time: number, goal: [number, number]) {
    const last = npc.getData('lastPos') as [number, number, number] | undefined;
    if (!last) { npc.setData('lastPos', [npc.x, npc.y, time]); return; }
    if (time - last[2] < 700) return;
    const moved = Math.hypot(npc.x - last[0], npc.y - last[1]);
    npc.setData('lastPos', [npc.x, npc.y, time]);
    if (!npc.getData('wantMove') || moved > 4) { npc.setData('stuck', 0); return; }
    const stuck = ((npc.getData('stuck') as number) ?? 0) + 1;
    npc.setData('stuck', stuck);
    // try a fresh route (or, when wandering, a new spot right away)
    npc.setData('path', undefined).setData('wander', undefined).setData('next', 0).setData('wantMove', false);
    npc.setVelocity(0, 0);
    if (stuck < 4) return;
    npc.setData('stuck', 0);
    if (!this.cameras.main.worldView.contains(npc.x, npc.y)) npc.setPosition(goal[0], goal[1]);
    else {
      // wedged on a corner in view: hop onto the nearest open tile
      const t = this.npcTile(npc.x, npc.y);
      const [ox, oy] = this.walkable(t % MAP_W, Math.floor(t / MAP_W));
      npc.setPosition(...this.npcSpot(ox, oy));
    }
  }

  private spawnNpcs(ground: Phaser.Tilemaps.TilemapLayer, trees: Phaser.Physics.Arcade.StaticGroup) {
    const plaza = PLAZA_RECT;
    this.buildNpcGrid(trees);
    this.gateTile = this.walkable(GATE_IN[0], GATE_IN[1] - 2);
    // the line-up for the flag ceremony: three columns facing the flag, the little ones at the front, the teachers beside the flag
    const lineUp = [...NPCS].sort((a, b) => (a.grade ?? 4) - (b.grade ?? 4));
    for (const def of [...NPCS, ...BELLETMENS, ...TEACHER_NPCS, DEPUTY]) {
      const key = `npc-${def.id}`;
      makeCharacterTexture(this, key, { ...DEFAULT_LOOK, ...def.look });
      const [x, y] = this.walkable(def.home[0], def.home[1]);
      const npc = this.physics.add.sprite(...this.npcSpot(x, y), key, 0);
      npc.body!.setSize(16, 10).setOffset(8, 21);
      npc.setCollideWorldBounds(true);
      this.physics.add.collider(npc, ground);
      this.physics.add.collider(npc, trees);
      npc.setData('def', def);
      npc.setData('next', 0);
      npc.setData('dayHome', [x, y]);
      npc.setData('dayRoam', def.roam);
      if (def.kind !== 'belletmen' && def.kind !== 'teacher' && !def.fixed) this.pickDayHome(npc);
      const li = lineUp.indexOf(def), ti = TEACHER_NPCS.indexOf(def);
      if (ti >= 0) npc.setData('ceremonyHome', this.walkable(52 + (ti % 2), 27 + Math.floor(ti / 2)));
      else if (def === DEPUTY) npc.setData('ceremonyHome', this.walkable(51, 27));
      else if (li >= 0) npc.setData('ceremonyHome', this.walkable(45.2 - (li % 4) * 1.2, 25 + Math.floor(li / 4)));
      // evening spot around the dorms (20:00–22:00)
      this.pickEveningHome(npc);
      // where they wait for the bell
      npc.setData('schoolHome', this.walkable(SCHOOL_FRONT.x + Math.random() * (SCHOOL_FRONT.w - 1), SCHOOL_FRONT.y + Math.random() * (SCHOOL_FRONT.h - 1)));
      void plaza;
      this.npcs.push(npc);
      this.npcById.set(def.id, npc);
      const name = this.add.text(npc.x, npc.y - 26, def.name, {
        fontFamily: '"Pixelify Sans", system-ui, sans-serif', fontSize: '12px', fontStyle: 'bold',
        color: def.kind === 'belletmen' ? '#ffb3a8' : def.kind === 'teacher' ? '#cfe8ff' : def.kind === 'abi' ? '#ffe7a8' : '#ffffff',
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
    // (most of them are out on the Yurt Meydanı itself; a few keep to their own year's corner)
    const z = def.fixed || Math.random() < 0.7 ? EVENING_CENTER : EVENING_ZONES[g >= 9 ? 'lise' : (String(g) as '4' | '5' | '6' | '7' | '8')];
    npc.setData('plazaHome', this.walkable(z.x + Math.random() * (z.w - 1), z.y + Math.random() * (z.h - 1)));
  }

  /** little speech bubbles above students' heads */
  private showEmote() {
    if (this.room || ceremonyNow(this.save.clock.day, this.save.clock.minutes)) return;
    const view = this.cameras.main.worldView;
    const visible = this.npcs.filter((n) => n.visible && view.contains(n.x, n.y) && !['belletmen', 'teacher'].includes((n.getData('def') as NpcDef).kind));
    if (!visible.length) return;
    const npc = visible[Math.floor(Math.random() * visible.length)];
    const phase = phaseOf(this.save.clock.minutes, this.save.clock.day);
    const sets = { day: ['💬', '⚽', '😂', '📚', '🎵', '❗', '🍎', '👋'], plaza: ['😂', '💬', '🌙', '🃏', '🎶', '🤫'], etut: ['📖'], night: ['💤'] } as const;
    const pool = sets[phase];
    const bubble = this.add.text(npc.x, npc.y - 40, pool[Math.floor(Math.random() * pool.length)], {
      fontSize: '15px', backgroundColor: '#ffffffee', padding: { x: 4, y: 2 }, color: '#1d2326',
    }).setOrigin(0.5).setDepth(96_000).setAlpha(0);
    this.tweens.add({ targets: bubble, alpha: 1, y: npc.y - 46, duration: 250 });
    this.tweens.add({ targets: bubble, alpha: 0, delay: 1900, duration: 300, onComplete: () => bubble.destroy() });
  }

  private routineClock(): RoutineClock {
    const c = this.save.clock;
    return this.rc ?? { day: c.day, minutes: c.minutes, lessonsOn: this.lessonsOn(), raining: this.isRaining(), rush: this.rushOn() };
  }

  /** the registration weekend is still on */
  private rushOn(): boolean { return !this.save.state.once.rushDone; }
  /** registered and moved in: from the first Monday the school's rules apply to you */
  private settled(): boolean { return !this.rushOn(); }
  /** lessons run from the first Monday */
  private lessonsOn(): boolean { return this.settled(); }

  /** the building a student is inside right now (null = outdoors, or called over to a game) */
  private whereIs(def: NpcDef): Indoors | null {
    if (this.npcById.get(def.id)?.getData('summon')) return null;
    return activityOf(def, this.routineClock()).in ?? null;
  }

  /** the tile an NPC walks to, and comes back out at, for a place indoors ('dorm' = their own; 'away' = the main gate) */
  private doorTile(place: string, def: NpcDef): [number, number] {
    const id = place === 'dorm' ? (def.gender === 'girl' ? 'kiz_yurdu' : 'erkek_yurdu') : place;
    const doors = LOCATIONS.find((l) => l.id === id)?.doors;
    if (!doors?.length) return this.gateTile;
    // (a door whose step is blocked for NPCs, by a wall's edge or the caretaker, isn't used)
    const steps = doors.map(doorStandTile);
    const open = steps.filter((s) => this.npcReach[s.y * MAP_W + s.x]);
    if (!open.length) return this.walkable(steps[0].x, steps[0].y);
    let h = 0;
    for (const ch of def.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const s = open[h % open.length];
    return [s.x, s.y];
  }

  /** where an NPC should be right now: a spot outdoors, or inside a building (then `home` is its door) */
  private npcPlan(def: NpcDef, phase: DayPhase, npc: Phaser.Physics.Arcade.Sprite): NpcPlan {
    const indoors = (place: string) => ({ home: this.doorTile(place, def), roam: 0, inside: place });
    if (def.kind === 'belletmen') {
      // the night patrol: in the office by day, on the central plaza in the evening, round the campus at night
      if (def.id === 'bel-selim') return phase === 'day' ? indoors('cemiyet') : phase === 'night' ? { home: npc.getData('patrol') ?? PATROL_ROUTE[0], roam: 0 } : { home: [47, 27], roam: 5 };
      // the dorm belletmens watch the plaza while everyone is out on it; for study time and at night they are in the dorm
      return phase === 'plaza' ? { home: npc.getData('dayHome'), roam: 1 } : indoors('dorm');
    }
    const summon = npc.getData('summon') as [number, number] | undefined;
    if (summon) return { home: summon, roam: 0 };
    if (def === DEPUTY) {
      // in his office on school days (and through the registration weekend); at the flag for the ceremony
      const c = this.save.clock, rc = this.routineClock();
      const cer = rc.raining ? null : ceremonyWindow(c.day);
      if (cer && c.minutes >= cer[0] - 6 && c.minutes < cer[1]) return { home: npc.getData('ceremonyHome'), roam: 0, face: FLAGPOLE };
      return (rc.rush || weekdayOf(c.day) < 5) && c.minutes >= 7 * 60 + 40 && c.minutes < 17 * 60 ? indoors('egitim') : indoors('away');
    }
    const ti = def.kind === 'teacher' ? TEACHER_NPCS.indexOf(def) : -1;
    const act: Activity = ti >= 0 ? teacherActivity(ti, this.routineClock()) : activityOf(def, this.routineClock());
    if (act.in) return indoors(act.in);
    // your closest friends spend their free time near you
    if ((act.out === 'lawn' || act.out === 'plaza') && !this.room && this.followers().includes(def.id)) {
      const spot = this.followSpot(def.id);
      if (spot) return { home: [spot.x, spot.y], roam: 2 };
    }
    // lined up at the flag, standing still and facing it
    if (act.out === 'ceremony') return { home: npc.getData('ceremonyHome'), roam: 0, face: FLAGPOLE };
    if (act.out === 'plaza') return { home: npc.getData('plazaHome'), roam: 3 };
    if (act.out === 'school' && !def.fixed) return { home: npc.getData('schoolHome'), roam: 2 };
    return { home: npc.getData('dayHome'), roam: npc.getData('dayRoam') ?? def.roam };
  }

  /** the friends who keep you company: your closest few, once you're friends */
  private followers(): string[] {
    if (this.followIds) return this.followIds;
    const st = this.save.state;
    this.followIds = NPCS.filter((n) => !n.fixed && (st.friends[n.id] ?? 0) >= FRIEND_AT)
      .sort((a, b) => (st.friends[b.id] ?? 0) - (st.friends[a.id] ?? 0)).slice(0, FOLLOWERS).map((n) => n.id);
    return this.followIds;
  }
  private followIds: string[] | null = null;

  /** somewhere to stand a few tiles from you; they pick a new spot when you've walked off, not at every step */
  private followSpot(id: string): { x: number; y: number } | null {
    const px = this.player.x / TILE, py = this.player.y / TILE;
    const cur = this.followAt.get(id);
    const now = this.time.now;
    if (cur && (Math.hypot(cur.x - px, cur.y - py) < 6 || now - cur.t < 2500)) return cur;
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 2.5;
      const tx = Math.round(px + Math.cos(a) * r), ty = Math.round(py + Math.sin(a) * r);
      if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) continue;
      const k = ty * MAP_W + tx;
      if (!this.npcReach[k] || this.doorClear[k]) continue;
      const spot = { x: tx, y: ty, t: now };
      this.followAt.set(id, spot);
      return spot;
    }
    return cur ?? null;
  }

  private updateNpcs(time: number) {
    const c = this.save.clock;
    const phase = phaseOf(c.minutes, c.day);
    this.rc = { day: c.day, minutes: c.minutes, lessonsOn: this.lessonsOn(), raining: this.isRaining(), rush: this.rushOn() };
    // after a jump in time (a lesson, a night's sleep, a loaded save) nobody walks: they are simply where they should be
    const now = c.day * 1440 + c.minutes;
    const first = this.npcClock < 0;
    const jumped = first || Math.abs(now - this.npcClock) > 6;
    this.npcClock = now;
    const view = this.cameras.main.worldView;
    const pace = this.fast ? 3 : 1;
    // the night patrol walks a loop around the campus
    const route = PATROL_ROUTE;
    const leg = Math.floor(time / 9000) % route.length;
    for (const npc of this.npcs) {
      const def = npc.getData('def') as NpcDef;
      if (def.id === 'bel-selim') npc.setData('patrol', route[leg]);
      // belletmens searching for you (or walking you back) leave their usual spots
      const onDuty = !!this.hunt?.npcs.includes(npc) || this.escort?.npc === npc;
      const plan: NpcPlan = onDuty ? { home: [npc.x / TILE - 0.5, (npc.y + 10) / TILE - 0.5], roam: 0 } : this.npcPlan(def, phase, npc);
      const label = this.npcNames.get(npc)!;
      const [hx, hy] = this.npcSpot(plan.home[0], plan.home[1]);
      const goIn = (place: string) => {
        npc.setVisible(false).setVelocity(0, 0);
        npc.body!.enable = false;
        npc.setData('in', place).setData('wantMove', false).setData('wander', undefined);
        label.setVisible(false);
      };
      const comeOut = (x: number, y: number) => {
        npc.setPosition(x, y).setVisible(true);
        npc.setData('in', undefined).setData('path', undefined).setData('wander', undefined).setData('lastPos', undefined);
        npc.body!.enable = true;
      };
      let inside = npc.getData('in') as string | undefined;
      // (someone you can see keeps walking instead of vanishing)
      const watched = !first && !this.room && inside === undefined && npc.visible && view.contains(npc.x, npc.y);
      if (jumped && !onDuty && !watched) {
        if (plan.inside) { goIn(plan.inside); continue; }
        if (inside !== undefined || !npc.visible || Math.hypot(npc.x - hx, npc.y - hy) > (plan.roam + 3) * TILE) comeOut(hx, hy);
        inside = undefined;
      }
      if (inside !== undefined && plan.inside === inside) { label.setVisible(false); continue; } // still indoors
      // they come out of the door they went in by
      if (inside !== undefined) comeOut(...this.npcSpot(...this.doorTile(inside, def)));
      else if (!npc.visible) comeOut(hx, hy);
      const talking = this.panel.isOpen && this.nearNpc?.id === def.id;
      if (onDuty) this.dutyStep(npc, time);
      else if (talking) {
        npc.setVelocity(0, 0);
        npc.setData('wantMove', false);
      } else if (plan.inside) {
        // on the way in: walk to the door and through it
        npc.setData('wander', undefined);
        if (this.steerNpc(npc, hx, hy, 85 * pace) || Math.hypot(npc.x - hx, npc.y - hy) < 0.9 * TILE) { goIn(plan.inside); continue; }
      } else if (plan.roam === 0 || Math.hypot(npc.x - hx, npc.y - hy) > (plan.roam + 3) * TILE) {
        // walk (back) to the spot, round the buildings
        npc.setData('wander', undefined);
        this.steerNpc(npc, hx, hy, 80 * pace);
      } else {
        const wander = npc.getData('wander') as [number, number] | undefined;
        // never loiter in front of a door: people need to get in and out
        const atDoor = !wander && this.doorClear[this.npcTile(npc.x, npc.y)] === 1;
        if (wander) {
          if (this.steerNpc(npc, wander[0], wander[1], 55)) npc.setData('wander', undefined);
        } else if (atDoor || time > npc.getData('next')) {
          const idle = !atDoor && Math.random() < (def.kind === 'abi' || def.kind === 'belletmen' || def.kind === 'teacher' ? 0.7 : 0.4);
          const spot = idle ? null : this.wanderSpot(plan.home, Math.max(1, plan.roam));
          if (spot) npc.setData('wander', spot);
          else { npc.setVelocity(0, 0); npc.setData('wantMove', false); }
          npc.setData('next', time + Phaser.Math.Between(1200, 3200));
        }
      }
      this.checkNpcStuck(npc, time, [hx, hy]);
      const vx = npc.body!.velocity.x, vy = npc.body!.velocity.y;
      const moving = Math.abs(vx) + Math.abs(vy) > 1;
      let dir = !moving ? npc.getData('dir') ?? 0 : Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 1 : 2) : vy < 0 ? 3 : 0;
      if (!moving && plan.face) { const dx = (plan.face[0] + 0.5) * TILE - npc.x, dy = (plan.face[1] + 0.5) * TILE - npc.y; dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0; }
      if (talking || (this.escort?.npc === npc && !this.escort.walking)) { const dx = this.player.x - npc.x, dy = this.player.y - npc.y; dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0; }
      npc.setData('dir', dir);
      const step = moving ? [1, 0, 2, 0][Math.floor(time / 130) % 4] : 0;
      npc.setFrame(dir * 3 + step);
      npc.setDepth(npc.y + 16);
      // friends carry a heart and a gold name you can read from right across the screen
      const friend = this.isFriend(def);
      const star = (friend ? '💛 ' : '') + (def.kind === 'classmate' && this.save.state.once.classDrawn ? '★ ' : '');
      if (label.text !== star + def.name) label.setText(star + def.name);
      if (label.getData('friend') !== friend) { label.setData('friend', friend); label.setColor(friend ? '#ffe27a' : def.kind === 'belletmen' ? '#ffb3a8' : def.kind === 'teacher' ? '#cfe8ff' : def.kind === 'abi' ? '#ffe7a8' : '#ffffff').setFontSize(friend ? 13 : 12); }
      label.setPosition(npc.x, npc.y - 24);
      const near = Phaser.Math.Distance.Between(npc.x, npc.y, this.player.x, this.player.y) < (friend ? 16 : 4) * TILE;
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

  /** 2.5D buildings: a ground shadow, the painted building and its windows, which light up at night.
   *  Slanted and round walls mean the building's front edge isn't one line, so the picture is cut into
   *  narrow columns, each sorted by where the footprint ends in that column: you can stand in front
   *  of one part of a wall and behind another. */
  private drawBuildings() {
    // lawn under the footprints (only seen while a building is see-through)
    const under = this.add.graphics().setDepth(0.5);
    under.fillStyle(0x8cbd68, 1);
    for (const b of BUILDINGS) under.fillPoints(b.shape.map(([x, y]) => ({ x: x * TILE, y: y * TILE })), true);
    // corridors through buildings (also only seen while see-through): paving, side walls and the doors off them
    const hall = this.add.graphics().setDepth(0.6);
    // ...clipped to the footprints, so a corridor ending at a slanted wall doesn't spill onto the lawn
    const footprints = this.make.graphics({}, false).fillStyle(0xffffff, 1);
    for (const b of BUILDINGS) footprints.fillPoints(b.shape.map(([x, y]) => ({ x: x * TILE, y: y * TILE })), true);
    hall.setMask(footprints.createGeometryMask());
    for (const b of BUILDINGS) for (const p of b.passages ?? []) {
      const x0 = p.x * TILE, y0 = p.y * TILE, w = p.w * TILE, h = p.h * TILE;
      hall.fillStyle(0xd9d1c2, 1).fillRect(x0, y0, w, h);
      hall.fillStyle(0xc4baa7, 1);
      for (let x = x0 + 16; x < x0 + w; x += 32) hall.fillRect(x, y0, 1, h);
      hall.fillStyle(0xe9ebe8, 1).fillRect(x0, y0 - 8, w, 8).fillRect(x0, y0 + h - 3, w, 3);
      hall.fillStyle(0x000000, 0.15).fillRect(x0, y0, w, 4);
      for (const loc of LOCATIONS) for (const d of loc.doors ?? []) {
        if (!doorInPassage(d, b)) continue;
        const dx = d.x * TILE + 4, north = d.side === 's';
        hall.fillStyle(0x3e4a52, 1).fillRect(dx, north ? y0 - 8 : y0 + h - 4, TILE - 8, north ? 10 : 6);
        hall.fillStyle(0x6f93ad, 1).fillRect(dx + 2, north ? y0 - 6 : y0 + h - 3, TILE - 12, north ? 6 : 3);
      }
    }
    const steps = this.add.graphics().setDepth(1.5);
    for (const b of BUILDINGS) {
      // sun from the north-west: a soft outer shadow and a darker inner one, falling east and a little south
      for (const [reach, alpha] of [[0.95, 0.1], [0.7, 0.2]] as const) {
        const sh = makeShadowArt(this, b, reach);
        this.add.image(sh.x, sh.y, sh.key).setOrigin(0, 0).setDepth(1).setAlpha(alpha);
      }
      const art = makeBuildingArt(this, b);
      const imgs: Phaser.GameObjects.Image[] = [], lits: Phaser.GameObjects.Image[] = [];
      const SLICE = 8;
      let last = art.base;
      for (let sx = 0; sx < art.w; sx += SLICE) {
        const fronts = [1, SLICE / 2, SLICE - 1].map((d) => frontAt(b.shape, (art.x + sx + d) / TILE)).filter((v): v is number => v !== null);
        const base = fronts.length ? Math.max(...fronts) * TILE : last;
        last = base;
        imgs.push(this.add.image(art.x, art.y, art.key).setOrigin(0, 0).setCrop(sx, 0, SLICE, art.h).setDepth(base));
        lits.push(this.add.image(art.x, art.y, art.litKey).setOrigin(0, 0).setCrop(sx, 0, SLICE, art.h).setDepth(base + 0.5).setAlpha(0));
      }
      this.buildingArt.push({ art, b, imgs, lits, alpha: 1 });
    }
    // front steps for entrances that face north (drawn on the ground outside the building)
    for (const loc of LOCATIONS) for (const d of loc.doors ?? []) {
      if (d.side !== 'n' || BUILDINGS.some((b) => doorInPassage(d, b))) continue;
      const s = doorStandTile(d);
      steps.fillStyle(0xcfc8b9, 1).fillRect(s.x * TILE - 6, s.y * TILE + 18, TILE + 12, 14);
      steps.fillStyle(0xb3ab9a, 1).fillRect(s.x * TILE - 6, s.y * TILE + 24, TILE + 12, 2);
    }
  }

  /** see-through buildings while someone walks behind them */
  private updateBuildingFade() {
    const px = this.player.x, py = this.player.y;
    for (const entry of this.buildingArt) {
      const { art, b } = entry;
      const front = px > art.x - 8 && px < art.x + art.w + 8 ? frontAt(b.shape, px / TILE) : null;
      const behind = !this.room && front !== null && py < front * TILE - 8 && py > art.y - 24;
      const target = behind ? 0.45 : 1;
      if (entry.alpha === target) continue;
      entry.alpha = Math.abs(entry.alpha - target) < 0.05 ? target : entry.alpha + (target - entry.alpha) * 0.25;
      for (const img of entry.imgs) img.setAlpha(entry.alpha);
      for (const l of entry.lits) l.setVisible(entry.alpha > 0.9);
    }
  }

  /** buildings collide through their real outlines: anyone standing in one is pushed back out to its wall */
  private pushOutOfBuildings(sp: Phaser.Physics.Arcade.Sprite) {
    const body = sp.body as Phaser.Physics.Arcade.Body | null;
    if (!body?.enable) return;
    const R = 7 / TILE; // the feet are about 14px across
    for (const b of BUILDINGS) {
      const cx = body.center.x / TILE, cy = body.center.y / TILE, r = b.rect;
      if (cx < r.x - 1 || cx > r.x + r.w + 1 || cy < r.y - 1 || cy > r.y + r.h + 1) continue;
      const inside = inPoly(cx, cy, b.shape);
      const e = nearestEdge(cx, cy, b.shape);
      if (!inside && e.d >= R) continue;
      // in a corridor through the building: free to walk along it, its side walls keep you in
      const half = 6 / TILE; // half the feet's height
      const pass = b.passages?.find((p) => cx >= p.x && cx <= p.x + p.w && cy >= p.y - 0.7 && cy <= p.y + p.h + 0.7);
      if (pass) {
        const y = Math.min(pass.y + pass.h - half, Math.max(pass.y + half, cy));
        if (y === cy) continue;
        if (inside) {
          body.position.y += (y - cy) * TILE; body.updateCenter();
          if ((y - cy) * body.velocity.y < 0) body.velocity.y = 0;
          continue;
        }
      }
      // out along the nearest wall's normal, to one feet-radius clear of it
      const dx = e.d > 1e-4 ? (inside ? e.x - cx : cx - e.x) / e.d : e.nx, dy = e.d > 1e-4 ? (inside ? e.y - cy : cy - e.y) / e.d : e.ny;
      const push = (inside ? e.d + R : R - e.d) * TILE;
      body.position.x += dx * push; body.position.y += dy * push;
      body.updateCenter();
      const vn = body.velocity.x * dx + body.velocity.y * dy;
      if (vn < 0) body.velocity.set(body.velocity.x - vn * dx, body.velocity.y - vn * dy);
    }
  }

  /** sky colour for the time of day, as a multiply tint (white = no change) */
  private skyTint(minutes: number): [number, number, number] {
    const keys: Array<[number, [number, number, number]]> = [
      [0, [30, 50, 105]], [5, [40, 58, 110]], [6, [200, 170, 195]], [7, [255, 230, 222]], [8, [255, 250, 240]], [9, [255, 255, 255]],
      [15.5, [255, 255, 255]], [17, [255, 241, 214]], [18, [255, 222, 178]], [19, [232, 168, 140]], [20, [120, 115, 165]], [22, [48, 62, 118]], [24, [30, 50, 105]],
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
    const nightIn = phaseOf(this.save.clock.minutes, this.save.clock.day) === 'night';
    let tint: [number, number, number];
    if (this.room) tint = this.room === 'dorm' && nightIn ? [70, 80, 130] : [255, 255, 255];
    else {
      tint = this.skyTint(this.save.clock.minutes);
      if (this.isRaining()) tint = tint.map((v) => Math.round(v * 0.82)) as [number, number, number];
    }
    const lum = (tint[0] + tint[1] + tint[2]) / 765;
    const a = 1 - lum;
    this.darkAlpha = a;
    this.warmLights.getChildren().forEach((o) => (o as Phaser.GameObjects.Image).setAlpha(!this.room && a > 0.3 ? Math.min(0.5, a * 0.65) : 0));
    const windows = this.room || a < 0.25 ? 0 : Math.min(1, (a - 0.25) * 2.5);
    for (const b of this.buildingArt) for (const l of b.lits) l.setAlpha(windows);
    const cam = this.cameras.main;
    const view = cam.worldView;
    if (a > 0.01) {
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = `rgb(${tint[0]}, ${tint[1]}, ${tint[2]})`; // multiply blend (see .night-layer)
      c.fillRect(0, 0, w, h);
    }
    if (a >= 0.3) { // after dusk: pools of light
      // a light keeps the brighter of its colour and the night tint, so lamps glow warm, not white
      c.globalCompositeOperation = 'lighten';
      const cut = (x: number, y: number, r: number, k = 1, rgb = '255, 206, 140') => {
        const sx = (x - view.x) * cam.zoom, sy = (y - view.y) * cam.zoom, rad = r * TILE * cam.zoom;
        if (sx < -rad || sy < -rad || sx > w + rad || sy > h + rad) return;
        const g = c.createRadialGradient(sx, sy, 0, sx, sy, rad);
        g.addColorStop(0, `rgba(${rgb},${k})`); g.addColorStop(0.3, `rgba(${rgb},${k * 0.8})`); g.addColorStop(0.65, `rgba(${rgb},${k * 0.35})`); g.addColorStop(1, `rgba(${rgb},0)`);
        c.fillStyle = g;
        c.fillRect(sx - rad, sy - rad, rad * 2, rad * 2);
      };
      if (!this.room) for (const l of this.lightSpots) cut(l.x, l.y, l.r * 1.15, 0.92);
      // lit windows punch through the darkness
      if (!this.room) {
        c.globalCompositeOperation = 'destination-out';
        c.imageSmoothingEnabled = false;
        c.globalAlpha = Math.min(0.9, (a - 0.25) * 2);
        for (const { art, alpha } of this.buildingArt) {
          if (alpha < 0.9) continue;
          const sx = (art.x - view.x) * cam.zoom, sy = (art.y - view.y) * cam.zoom;
          if (sx > w || sy > h || sx + art.w * cam.zoom < 0 || sy + art.h * cam.zoom < 0) continue;
          c.drawImage(this.textures.get(art.litKey).getSourceImage() as HTMLCanvasElement, sx, sy, art.w * cam.zoom, art.h * cam.zoom);
        }
        c.globalAlpha = 1;
        c.globalCompositeOperation = 'lighten';
      }
      cut(this.player.x, this.player.y, 2, 0.5, '214, 222, 246');
      for (const npc of this.npcs) {
        const def = npc.getData('def') as NpcDef;
        if (def.id === 'bel-selim' && npc.visible) cut(npc.x, npc.y, 3.2, 0.9, '255, 240, 205'); // his torch
      }
    }
    // a soft vignette outdoors: barely there by day, deeper at night
    c.globalCompositeOperation = 'source-over';
    if (!this.room) {
      if (!this.vignette || this.vignette.width !== w || this.vignette.height !== h) {
        const v = this.vignette = document.createElement('canvas');
        v.width = w; v.height = h;
        const vc = v.getContext('2d')!, g = vc.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) / 2);
        g.addColorStop(0, 'rgba(14, 18, 40, 0)'); g.addColorStop(1, 'rgba(14, 18, 40, 0.42)');
        vc.fillStyle = g; vc.fillRect(0, 0, w, h);
      }
      c.globalAlpha = 0.3 + a * 0.7;
      c.drawImage(this.vignette, 0, 0);
      c.globalAlpha = 1;
    }
  }

  /** about one day in four is rainy; deterministic per day */
  private isRaining(day = this.save.clock.day): boolean {
    let h = day * 2654435761 >>> 0;
    h ^= h >>> 13;
    return h % 100 < 25;
  }

  /** rain on rainy days; nothing falls otherwise */
  private updateParticles() {
    this.particles?.setVisible(!this.inside);
    const weather = this.isRaining() ? 'rain' : 'none';
    if (weather === this.weather) {
      const v = this.cameras.main.worldView;
      this.particles?.setPosition(v.x, v.y - 20);
      return;
    }
    this.weather = weather;
    this.particles?.destroy();
    this.particles = null;
    if (weather === 'none') return;
    const v = this.cameras.main.worldView;
    this.particles = this.add.particles(v.x, v.y - 20, 'raindrop', {
      x: { min: 0, max: Math.max(400, v.width) }, y: 0,
      lifespan: 1600,
      speedY: { min: 520, max: 680 },
      speedX: { min: -60, max: -40 },
      rotate: 0, alpha: { start: 0.95, end: 0.6 },
      frequency: 12, quantity: 2,
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
    // areas can have fractional edges (round and slanted buildings): cover every tile they touch
    const x0 = Math.max(0, Math.floor(r.x - margin)), y0 = Math.max(0, Math.floor(r.y - margin));
    const x1 = Math.min(MAP_W - 1, Math.ceil(r.x + r.w - 1 + margin)), y1 = Math.min(MAP_H - 1, Math.ceil(r.y + r.h - 1 + margin));
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
    if (!silent) this.save.state.xp += 20;
    // nobody makes you explore, but finding every corner of the campus is worth something
    if (LOCATIONS.every((l) => this.discovered.has(l.id)) && !this.save.state.once.exploredAll) {
      this.save.state.once.exploredAll = true;
      this.save.character.respect += 5;
      this.time.delayedCall(900, () => { this.gain({ xp: 150, mood: 10 }); sfx.success(); this.hud.toast(t('all_found'), 'good'); });
    }
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
    if (this.panel?.isOpen || this.sleepRun || this.escort) { this.hud.setPrompt(null); this.nearDoor = null; this.nearRoomThing = null; return; }
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
      this.hud.setPrompt(L({ tr: `E — ${this.tagged(npc)} ile konuş`, en: `E — talk to ${this.tagged(npc)}` }));
      return;
    }
    const spot = this.outdoorSpot();
    if (spot) { this.nearDoor = null; this.hud.setPrompt(`E — ${spot.label}`); return; }
    if (this.nearGate()) { this.nearDoor = null; this.hud.setPrompt(L({ tr: 'E — Ana Kapı', en: 'E — Main gate' })); return; }
    const near = this.findNearDoor();
    if (!force && near === this.nearDoor) return;
    this.nearDoor = near;
    if (!near) { this.hud.setPrompt(null); return; }
    this.hud.setPrompt(this.discovered.has(near.id) ? t('press_e', { name: L(near.name) }) : t('unknown_door'));
  }

  private nearGate(): boolean {
    if (this.room) return false;
    return Math.hypot(this.player.x / TILE - (GATE_IN[0] + 0.5), this.player.y / TILE - (GATE_IN[1] + 0.5)) < 2;
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

  private blocked() { return this.hud.modalOpen || this.hud.bigOpen || this.panel.isOpen || this.hud.chatOpen || this.sleepRun !== null || this.escort !== null; }

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
    const spot = this.outdoorSpot();
    if (spot) { this.player.setVelocity(0, 0); spot.open(); return; }
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
      this.lastDoor = this.nearestStand(loc);
      this.enterDorm();
      return;
    }
    if (loc.id === ownDorm || loc.id === 'egitim' || (loc.id === 'yemekhane' && diningOpen(this.save.clock.minutes))) this.lastDoor = this.nearestStand(loc);
    if (loc.id === ownDorm) { this.enterDorm(); return; }
    if (loc.id === 'egitim') { this.enterClass(); return; }
    // the dining hall is open only while something is being served
    if (loc.id === 'yemekhane') { if (diningOpen(this.save.clock.minutes)) this.enterDining(); else this.panel.open(() => yemekhaneClosed(ctx)); return; }
    // in the evening only your own dorm is reachable anyway; outside study hours other doors stay shut (the Revir never does)
    if (phaseOf(this.save.clock.minutes, this.save.clock.day) !== 'day' && loc.id !== ownDorm && loc.id !== 'revir' && this.settled()) {
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
      raining: this.isRaining(),
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
      callFriends: (sport) => this.callFriends(sport),
      place: () => (this.room === 'class' ? 'class' : this.room === 'dining' ? 'dining' : this.room === 'dorm' ? 'dorm' : 'out'),
      rush: () => this.rushOn(),
      dress: () => this.dress(),
      killTime: (until) => this.killTime(until),
      beltNear: () => this.roomBelletmen.visible && Phaser.Math.Distance.Between(this.roomBelletmen.x, this.roomBelletmen.y, this.player.x, this.player.y) < 4 * TILE,
    };
  }

  /** you changed clothes: repaint the player's sprite sheet (and the walk cycles cut from it) */
  private dress() {
    makeCharacterTexture(this, 'player', wornLook(this.save.character.look, this.save.state));
    for (const n of ['down', 'left', 'right', 'up']) this.anims.remove(`player-walk-${n}`);
    this.createAnims();
    this.player.setTexture('player', this.dir * 3);
    this.persist();
  }

  /** stay where you are while the clock runs fast until `until` (minutes of the day): nothing gained, just time gone */
  private killTime(until: number) {
    const left = until - this.save.clock.minutes;
    if (left <= 0 || this.sleepRun) return;
    this.sleeping = true;
    this.player.setVelocity(0, 0);
    this.player.anims.stop();
    if (this.room === 'dorm') { this.player.setPosition((ROOM_OX + MY_DESK[0] + 0.5) * TILE, (MY_DESK[1] + 1.35) * TILE); this.dir = 3; }
    this.sleepRun = { kind: 'idle', msPerMin: Math.min(90, 8000 / left), acc: 0, left, total: left, busy: false, events: [] };
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
    if (!this.settled()) return; // the rules start once you're settled in
    const day = c.day;
    if ((this.save.character.boarding ?? 'daimi') === 'evci' && isFriday(day) && c.minutes >= BUS_LEAVES && st.daily.busMissed !== day && st.daily.weekendHome !== day) {
      st.daily.busMissed = day;
      this.hud.toast(L({ tr: '🚌 Servisi kaçırdın! Bu hafta sonu okuldasın.', en: '🚌 You missed the bus! You\'re staying at school this weekend.' }));
    }
    if (this.room === 'dorm') return; // from the classroom you still have to go back to the dorm in the evening
    const phase = phaseOf(c.minutes, c.day);
    const belletmen = this.save.character.gender === 'girl' ? 'Hatice Hanım' : 'Mehmet Bey';
    if (st.escaped) {
      if (phase !== 'night') { st.escaped = false; this.penalize(10, L({ tr: 'Sabah yoklamasında yatağında değildin!', en: "You weren't in bed at the morning roll call!" })); return; }
      const patrol = this.npcs.find((n) => (n.getData('def') as NpcDef).id === 'bel-selim');
      // sneaking out is the one time you can stay out: only Selim Bey's torch ends it, and then he walks you back
      if (patrol?.visible && Phaser.Math.Distance.Between(patrol.x, patrol.y, this.player.x, this.player.y) < 3.5 * TILE) {
        this.caught(patrol, 15, L({ tr: 'Selim Bey seni fenerle yakaladı! Doğru yatağa.', en: 'Mr. Selim caught you in his torchlight! Straight to bed.' }));
      }
      return;
    }
    const belId = this.save.character.gender === 'girl' ? 'bel-hatice' : 'bel-mehmet';
    if (phase === 'etut') {
      // you walk to the dorm yourself; being 5+ minutes late costs discipline and your belletmen's goodwill
      if (c.minutes >= 18 * 60 + 5 && st.daily.lateEtut !== day) {
        st.daily.lateEtut = day;
        shape(st, { rules: 1 });
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
        shape(st, { rules: 1 });
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

  // ---------- belletmens out looking for you ----------

  /** settled in, and not where you should be: out of your dorm at study time or after lights out (sneaking out
   *  is Selim Bey's patrol's business), or not in class while a lesson is on */
  private outOfPlace(): 'curfew' | 'truant' | null {
    const st = this.save.state;
    if (!this.settled() || st.escaped || this.sleeping) return null;
    const phase = phaseOf(this.save.clock.minutes, this.save.clock.day);
    if (phase === 'etut' || phase === 'night') return this.room === 'dorm' ? null : 'curfew';
    return this.skipping() && this.room !== 'class' ? 'truant' : null;
  }

  /** a lesson is on that you should be in and haven't been to (the sick are excused: they belong in the infirmary) */
  private skipping(): { p: { id: string; start: number; end: number }; subject: SubjectId } | null {
    const st = this.save.state;
    if (!this.lessonsOn() || st.sick) return null;
    const les = this.currentLesson();
    if (!les || st.school.attended.includes(`${this.save.clock.day}-${les.p.id}`)) return null;
    return les;
  }

  /** minutes since study time started / the lights went out */
  private minutesLate(): number {
    const m = this.save.clock.minutes;
    const phase = phaseOf(m, this.save.clock.day);
    if (phase === 'day') { const les = this.currentLesson(); return les ? m - les.p.start : 0; }
    if (phase === 'etut') return m - ETUT_START;
    return m >= LIGHTS_OUT ? m - LIGHTS_OUT : m + 24 * 60 - LIGHTS_OUT;
  }

  /** where the belletmens head for you: you, or the door of the building you're hiding in */
  private playerSpot(): { x: number; y: number } {
    if (!this.room) return { x: this.player.x, y: this.player.y };
    const p = this.campusPos();
    const [x, y] = this.npcSpot(p.x - 0.5, p.y - 0.5);
    return { x, y };
  }

  private updateHunt(delta: number) {
    if (this.escort) { if (this.escort.walking) this.escort.t += delta; return; }
    const why = this.outOfPlace();
    if (!why || (this.hunt && this.hunt.kind !== why)) { if (this.hunt) this.endHunt(); this.outFor = 0; if (!why) return; }
    if (this.blocked()) return;
    this.outFor += delta;
    if (!this.hunt) {
      // a short grace period: the few minutes the countdown gives you, and a few real seconds on top
      if (this.minutesLate() >= (why === 'truant' ? TRUANT_AFTER : 5) && this.outFor > 4000) this.startHunt(why);
      return;
    }
    const h = this.hunt;
    h.t += delta;
    // Selim Bey joins in at night, or once study time has gone on a while (lessons are the deputy head's business alone)
    if (h.kind === 'curfew' && h.npcs.length < 2 && (phaseOf(this.save.clock.minutes, this.save.clock.day) === 'night' || h.t > 20_000)) {
      const selim = this.npcs.find((n) => (n.getData('def') as NpcDef).id === 'bel-selim');
      if (selim && !h.npcs.includes(selim)) {
        h.npcs.push(selim);
        if (h.t > 0) this.hud.toast(L({ tr: '🔦 Selim Bey de fenerini alıp aramaya katıldı!', en: '🔦 Mr. Selim has grabbed his torch and joined the search!' }));
      }
    }
    // other students tip them off now and then
    if (h.t >= h.tipAt) { h.tipAt = h.t + 6000; h.seen = this.playerSpot(); }
    // a search that drags on ends with someone cutting you off round a corner
    if (h.t >= h.cutAt) { h.cutAt = h.t + 15_000; this.cutOff(); }
  }

  private startHunt(kind: 'curfew' | 'truant') {
    const belId = kind === 'truant' ? DEPUTY.id : this.save.character.gender === 'girl' ? 'bel-hatice' : 'bel-mehmet';
    const own = this.npcs.find((n) => (n.getData('def') as NpcDef).id === belId);
    if (!own) return;
    this.hunt = { kind, t: 0, npcs: [own], seen: this.playerSpot(), tipAt: 6000, cutAt: kind === 'truant' ? 35_000 : 60_000, spotted: false };
    const name = (own.getData('def') as NpcDef).name;
    sfx.warn();
    if (kind === 'truant') {
      const sub = L(SUBJECTS.find((x) => x.id === this.currentLesson()!.subject)!.name);
      this.hud.toast(L({ tr: `🔎 Yoklamada yoksun! Müdür yardımcısı ${name} seni aramaya çıktı (${sub} dersi).`, en: `🔎 You're missing from the register! ${name}, the deputy head, has come out to look for you (${sub}).` }));
      return;
    }
    this.hud.toast(phaseOf(this.save.clock.minutes, this.save.clock.day) === 'night'
      ? L({ tr: `🔦 ${name} boş yatağını fark etti ve seni aramaya çıktı!`, en: `🔦 ${name} found your bed empty and has come looking for you!` })
      : L({ tr: `🔦 ${name} etütte yokluğunu fark etti ve seni aramaya çıktı!`, en: `🔦 ${name} noticed you're missing from study time and has come looking for you!` }));
  }

  private endHunt() {
    for (const n of this.hunt!.npcs) n.setData('huntGoal', undefined).setData('path', undefined);
    this.hunt = null;
  }

  /** one frame of a belletmen on the search or walking you back (instead of their usual plan) */
  private dutyStep(npc: Phaser.Physics.Arcade.Sprite, time: number) {
    const stop = () => { npc.setVelocity(0, 0); npc.setData('wantMove', false); };
    const e = this.escort;
    if (e?.npc === npc) {
      if (!e.walking) { stop(); return; }
      // back to your dorm, or (caught skipping a lesson) to the nearest door of the Eğitim Binası
      const stands = (e.kind === 'truant' ? LOCATIONS.find((l) => l.id === 'egitim')! : this.ownDormLoc()).doors!.map(doorStandTile).filter((d) => this.npcReach[d.y * MAP_W + d.x]);
      const door = stands.reduce((a, b) => (Math.hypot((a.x + 0.5) * TILE - npc.x, (a.y + 0.5) * TILE - npc.y) <= Math.hypot((b.x + 0.5) * TILE - npc.x, (b.y + 0.5) * TILE - npc.y) ? a : b));
      const there = this.steerNpc(npc, ...this.npcSpot(door.x, door.y), ESCORT_SPEED);
      // a long walk ends in a fade; so does getting wedged apart
      const apart = Phaser.Math.Distance.Between(npc.x, npc.y, this.player.x, this.player.y) > 5 * TILE;
      if (there || e.t > (e.kind === 'truant' ? 12_000 : 9000) || apart) this.finishEscort();
      return;
    }
    const h = this.hunt!;
    if (this.blocked()) { stop(); return; }
    const out = !this.room;
    const me = this.playerSpot();
    const d = Math.hypot(me.x - npc.x, me.y - npc.y);
    if (d < (out ? 1.3 : 1.6) * TILE) { this.caught(npc); return; }
    if (out && d < SPOT_RANGE * TILE) { h.spotted = true; h.seen = me; }
    // they start at a walk and keep speeding up, so in the end they outpace you
    const speed = Math.min(SEARCH_SPEED_MAX, SEARCH_SPEED + h.t / 400 + (h.spotted ? 40 : 0));
    if (d < 2 * TILE) {
      const a = Math.atan2(me.y - npc.y, me.x - npc.x);
      npc.setVelocity(Math.cos(a) * speed, Math.sin(a) * speed);
      npc.setData('wantMove', true);
      return;
    }
    if (d < SPOT_RANGE * TILE) { npc.setData('huntGoal', undefined); this.steerNpc(npc, me.x, me.y, speed); return; }
    // otherwise comb the area where you were last seen, in ever smaller circles
    let goal = npc.getData('huntGoal') as [number, number] | undefined;
    if (!goal || time > (npc.getData('huntUntil') ?? 0)) {
      goal = this.searchSpot(h.seen, Math.max(0, 10 * (1 - h.t / 40_000)));
      npc.setData('huntGoal', goal).setData('huntUntil', time + 5000);
    }
    if (this.steerNpc(npc, goal[0], goal[1], speed)) npc.setData('huntGoal', undefined);
  }

  /** an open spot up to `r` tiles from `at` (sprite pixels) */
  private searchSpot(at: { x: number; y: number }, r: number): [number, number] {
    const t = this.npcTile(at.x, at.y);
    const cx = t % MAP_W, cy = Math.floor(t / MAP_W);
    for (let i = 0; i < 10; i++) {
      const x = Math.round(cx + (Math.random() * 2 - 1) * r), y = Math.round(cy + (Math.random() * 2 - 1) * r);
      if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && this.npcGrid[y * MAP_W + x]) return this.npcSpot(x, y);
    }
    return [at.x, at.y];
  }

  /** the nearest searcher, if still far off, turns up just out of sight near you */
  private cutOff() {
    const h = this.hunt!;
    const me = this.playerSpot();
    const far = (n: Phaser.Physics.Arcade.Sprite) => Math.hypot(n.x - me.x, n.y - me.y);
    const npc = h.npcs.reduce((a, b) => (far(a) < far(b) ? a : b));
    if (far(npc) < 12 * TILE) return;
    const t = this.npcTile(me.x, me.y);
    const cx = t % MAP_W, cy = Math.floor(t / MAP_W);
    const view = this.cameras.main.worldView;
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 3;
      const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
      if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H || !this.npcGrid[y * MAP_W + x]) continue;
      const [sx, sy] = this.npcSpot(x, y);
      if (view.contains(sx, sy)) continue;
      npc.setPosition(sx, sy).setData('path', undefined).setData('huntGoal', undefined);
      h.seen = me;
      return;
    }
  }

  /** a belletmen has you: a telling-off, discipline points, then they walk you back to your dorm (no arguing).
   *  The deputy head does the same for a skipped lesson, and marches you into class */
  private caught(npc: Phaser.Physics.Arcade.Sprite, points = 10, why?: string) {
    const st = this.save.state;
    const def = npc.getData('def') as NpcDef;
    const kind = this.hunt?.kind ?? 'curfew';
    const night = phaseOf(this.save.clock.minutes, this.save.clock.day) === 'night';
    if (this.hunt) this.endHunt();
    this.outFor = 0;
    st.escaped = false;
    this.escort = { kind, npc, t: 0, walking: false, done: false };
    this.player.setVelocity(0, 0);
    npc.setVelocity(0, 0).setData('path', undefined);
    if (kind === 'truant') {
      // skipping lessons says something about you: more of a rule-breaker, less of a striver
      shape(st, { rules: 3, ambition: -1 });
      st.daily.truant = this.save.clock.day;
      st.once.truantCount = true;
      this.penalize(6, L({ tr: `${def.name} seni ders saatinde dışarıda yakaladı!`, en: `${def.name} caught you out of class during a lesson!` }));
      this.save.character.attributes.discipline = Math.max(0, this.save.character.attributes.discipline - 1);
      this.changeMood(-6);
      const lines = [
        { tr: '"Ders saatinde burada ne işin var? Herkes sınıfta, sen ortalıkta! Yürü bakalım, doğru sınıfına."', en: '"What are you doing out here during a lesson? Everyone is in class and you\'re wandering about! Come on, straight to your classroom."' },
        { tr: '"Yoklamada adın okundu, sen yoktun. Bu, defterine yazıldı. Önüme düş, sınıfa gidiyoruz."', en: '"Your name was called at the register and you weren\'t there. That has gone in your record. In front of me: we\'re going to class."' },
      ];
      this.hud.showModal({
        title: L({ tr: '🔎 Yakalandın!', en: '🔎 Caught!' }), sub: `${def.name} · ${L(def.role)}`,
        body: L(lines[Math.floor(Math.random() * lines.length)]),
        note: L({ tr: 'Seni sınıfına kadar götürüyor. Derse girmemek disiplin puanı getirir ve karakterine işler: "Haylaz" yönüne kayıyorsun.', en: 'He is walking you to your classroom. Skipping lessons costs discipline points and it shapes who you are: you lean towards "Mischievous".' }),
        button: L({ tr: 'Sınıfa', en: 'To class' }),
        onClose: () => {
          if (!this.escort) return;
          if (this.room) this.finishEscort(); else this.escort.walking = true;
        },
      });
      return;
    }
    shape(st, { rules: 2 });
    this.penalize(points, why ?? (night
      ? L({ tr: `${def.name} seni ışıklar söndükten sonra dışarıda yakaladı!`, en: `${def.name} caught you outside after lights out!` })
      : L({ tr: `${def.name} seni etüt saatinde dışarıda yakaladı!`, en: `${def.name} caught you outside during study time!` })));
    this.befriend(def.id, -5);
    this.changeMood(night ? -10 : -6);
    const lines = night ? [
      { tr: '"Işıklar söneli kaç dakika oldu, haberin var mı? Herkes uyurken senin burada ne işin var? Doğru yatağa!"', en: '"Do you know how long ago the lights went out? Everyone\'s asleep, what are you doing out here? Straight to bed!"' },
      { tr: '"Gecenin bu saatinde dışarıda dolaşmak ha? Bu, defterine yazılacak. Yürü bakalım!"', en: '"Wandering about at this time of night? That\'s going in your record. Come on, move!"' },
    ] : [
      { tr: '"Etüt saatinde dışarıda ne arıyorsun? Kitapların seni bekliyor. Yürü, yurda!"', en: '"What are you doing outside during study time? Your books are waiting. Come on, back to the dorm!"' },
      { tr: '"Herkes masasında çalışırken sen ortalıkta geziyorsun. Bu son olsun! Haydi, önüme düş."', en: '"Everyone\'s at their desk studying and you\'re wandering about. That\'s the last time! Go on, in front of me."' },
    ];
    this.hud.showModal({
      title: L({ tr: '🔦 Yakalandın!', en: '🔦 Caught!' }), sub: def.name,
      body: L(lines[Math.floor(Math.random() * lines.length)]),
      note: L({ tr: 'Seni yurduna kadar götürüyor. İtiraz etmek yok.', en: "They're walking you back to your dorm. No arguing." }),
      button: L({ tr: 'Yurda dön', en: 'Back to the dorm' }),
      onClose: () => {
        if (!this.escort) return;
        if (this.room) this.finishEscort(); // found at a door: straight over to the dorm
        else this.escort.walking = true;
      },
    });
  }

  /** while you're being walked back you just follow the belletmen */
  private escortFollow(): [number, number] {
    const e = this.escort!;
    if (!e.walking || this.room) return [0, 0];
    const dx = e.npc.x - this.player.x, dy = e.npc.y - this.player.y;
    return Math.hypot(dx, dy) < 1.1 * TILE ? [0, 0] : [dx, dy];
  }

  private finishEscort() {
    const e = this.escort;
    if (!e || e.done) return;
    e.done = true;
    e.walking = false;
    const name = (e.npc.getData('def') as NpcDef).name;
    this.screenFade(() => {
      this.escort = null;
      e.npc.setData('path', undefined).setData('wander', undefined);
      this.tray = null; this.trayAt = null;
      if (e.kind === 'truant') this.marchedToClass(name); else this.enterDorm(name);
    });
  }

  /** the deputy head sits you down in class: the lesson counts, with a poor performance mark and nothing learnt */
  private marchedToClass(name: string) {
    const les = this.currentLesson();
    this.lastDoor = doorStandTile(LOCATIONS.find((l) => l.id === 'egitim')!.doors![0]);
    this.enterClass();
    this.player.setPosition((CLASS_OX + MY_CLASS_DESK[0] + 0.5) * TILE, (MY_CLASS_DESK[1] + 1.35) * TILE);
    this.dir = 3;
    if (!les) return; // the bell went on the way: nothing left to sit through
    const ctx = this.gameCtx();
    const sname = L(SUBJECTS.find((x) => x.id === les.subject)!.name);
    attendLesson(ctx, `${this.save.clock.day}-${les.p.id}`, les.subject, 30);
    this.gain({ energy: -8 });
    this.advance(Math.max(0, les.p.end - this.save.clock.minutes));
    this.hud.showModal({
      title: L({ tr: `${sname} dersi`, en: sname }), sub: les.teacher.name,
      body: L({ tr: `${name} seni kapıdan içeri soktu: "Öğretmenim, bu öğrenci dersten kaçıyordu." Bütün sınıf sana baktı. Dersin kalanını kıpırdamadan dinledin.`, en: `${name} put you through the door: "This one was skipping your lesson." The whole class stared at you. You sat through the rest of it without moving a muscle.` }),
      note: L({ tr: 'Performans notu: 30/100 · ödevin akşam etütte.', en: 'Performance mark: 30/100 · your homework is due at evening study.' }),
      button: L({ tr: 'Tamam', en: 'OK' }),
    });
  }

  /** a quick fade to black and back */
  private screenFade(mid: () => void) {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;background:#0a0e14;opacity:0;transition:opacity 0.35s;pointer-events:none;z-index:1';
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = '1'; });
    this.time.delayedCall(400, () => {
      mid();
      el.style.opacity = '0';
      this.time.delayedCall(450, () => el.remove());
    });
  }

  /** the countdown banner at the top: study time at 18:00, lights out at 22:00 */
  private updateCountdown() {
    const st = this.save.state;
    const m = this.save.clock.minutes;
    if (this.escort) {
      const name = (this.escort.npc.getData('def') as NpcDef).name;
      this.hud.setCountdown(L({ tr: `🚶 ${name} seni yurduna götürüyor…`, en: `🚶 ${name} is walking you back to your dorm…` }), true);
      return;
    }
    if (this.hunt) {
      const names = this.hunt.npcs.map((n) => (n.getData('def') as NpcDef).name);
      this.hud.setCountdown(this.hunt.spotted
        ? L({ tr: `👀 ${names.join(' ve ')} seni gördü! Kaçamazsın…`, en: `👀 ${names.join(' and ')} spotted you! There's no getting away…` })
        : L({ tr: `🔦 ${names.join(' ve ')} seni arıyor! Bulunmadan yurduna dön.`, en: `🔦 ${names.join(' and ')} ${names.length > 1 ? 'are' : 'is'} looking for you! Get back to your dorm before you're found.` }), true);
      return;
    }
    // the weekend bus: shown in the dorm too, so you don't miss it
    const evci = (this.save.character.boarding ?? 'daimi') === 'evci';
    if (evci && st.school.registered && isFriday(this.save.clock.day) && m >= BUS_BOARDING && m < BUS_LEAVES) {
      this.hud.setCountdown(L({ tr: `🚌 Servis 17:00'de Ana Kapı'dan kalkıyor · ${BUS_LEAVES - m} dk`, en: `🚌 The bus leaves the main gate at 17:00 · ${BUS_LEAVES - m} min` }), m >= BUS_LEAVES - 20);
      return;
    }
    if (this.rushOn()) { this.rushCountdown(); return; }
    if (this.room === 'dorm' || st.escaped || !this.settled()) { this.hud.setCountdown(null); return; }
    const phase = phaseOf(m, this.save.clock.day);
    if (phase === 'day' && m >= 17 * 60 + 30 && !hasEtut(this.save.clock.day)) {
      this.hud.setCountdown(L({ tr: `🌙 Bugün etüt yok · 18:00'den sonra yalnızca yurtların çevresi serbest · ${18 * 60 - m} dk`, en: `🌙 No study tonight · from 18:00 it's free time around the dorms only · ${18 * 60 - m} min` }), false);
    } else if (phase === 'day' && m >= 17 * 60 + 30) {
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

  // ---------- the registration weekend ("kayıt dönemi") ----------

  /** the four desks, and how many are done */
  private rushTasks() {
    const st = this.save.state;
    return [
      { done: st.school.registered, name: L({ tr: 'Kayıt', en: 'Enrol' }) },
      { done: !!st.once.healthCheck, name: L({ tr: 'Sağlık', en: 'Health check' }) },
      { done: st.school.kit, name: L({ tr: 'Kıyafet', en: 'Clothes' }) },
      { done: st.school.books, name: L({ tr: 'Kitap', en: 'Books' }) },
    ];
  }

  private rushCountdown() {
    const c = this.save.clock;
    const left = rushLeft(c.day, c.minutes);
    const tasks = this.rushTasks();
    const done = tasks.filter((t) => t.done).length;
    const hh = Math.floor(left / 60), mm = left % 60;
    const day = L(c.day === 1 ? { tr: 'Cumartesi', en: 'Saturday' } : { tr: 'Pazar', en: 'Sunday' });
    const list = tasks.map((t) => `${t.done ? '✓' : '○'} ${t.name}`).join(' · ');
    const all = done === tasks.length;
    if (left <= 0) { this.hud.setCountdown(L({ tr: '📋 Kayıt dönemi bitti · Pazartesi geliyor…', en: '📋 Registration weekend is over · Monday is coming…' }), false, 0); return; }
    this.hud.setCountdown(all
      ? L({ tr: `📋 Kayıt dönemi · işlemlerin tamam! · Pazartesiye ${hh} sa ${mm} dk`, en: `📋 Registration weekend · you're all done! · ${hh} h ${mm} min to Monday` })
      : L({ tr: `📋 Kayıt dönemi · ${day} · kalan süre ${hh} sa ${mm} dk · ${list}`, en: `📋 Registration weekend · ${day} · ${hh} h ${mm} min left · ${list}` }),
    !all && left < 120, left / RUSH_TOTAL,
    all ? { label: L({ tr: 'Pazartesiye geç ⏭', en: 'Skip to Monday ⏭' }), onClick: () => { if (!this.blocked()) this.rushDue = 'end'; } } : undefined);
  }

  /** the weekend's checkpoints: Saturday night (the desks shut until Sunday morning), every desk done (the class
   *  draw), and the end (whatever is left gets done for you, then it's Monday) */
  private updateRush() {
    if (!this.rushOn() || this.blocked() || this.sleeping || this.drawing) return;
    const st = this.save.state;
    if (this.rushTasks().every((t) => t.done) && !st.once.classDrawn) { this.classDraw(false); return; }
    if (this.rushDue === 'night') {
      this.rushDue = null;
      const c = this.save.clock;
      if (c.day !== 1) return;
      this.screenFade(() => {
        c.day = 2; c.minutes = RUSH_MORNING;
        st.energy = 100; st.hunger = Math.max(st.hunger, 60);
        this.npcClock = -1;
        this.lastDoor = this.nearestStand(this.ownDormLoc());
        this.room = null; this.enterDorm();
        this.player.setPosition((ROOM_OX + MY_BED[0] + 0.5) * TILE, (MY_BED[1] + 1.4) * TILE);
        this.refreshClockAndNeeds();
        this.hud.showModal({
          title: L({ tr: '🌙 Kayıt dönemi · ilk gün bitti', en: '🌙 Registration weekend · day one is over' }), sub: L({ tr: 'Pazar 08:00', en: 'Sunday 08:00' }),
          body: L({ tr: 'Cumartesi akşamı masalar kapandı; yorgun ama heyecanlı uyudun. Bugün Pazar: kalan işlerini akşam 18:00\'e kadar bitir. Süre dolarsa görevliler eksikleri tamamlar.', en: "On Saturday evening the desks closed, and you fell asleep tired but excited. It's Sunday: finish what's left by 18:00. If time runs out the staff finish the rest for you." }),
          note: this.rushTasks().filter((t) => !t.done).map((t) => `○ ${t.name}`).join(' · ') || L({ tr: 'Her şey tamam!', en: 'All done!' }),
          button: L({ tr: 'Güne başla', en: 'Start the day' }),
        });
      });
      return;
    }
    if (this.rushDue === 'end') { this.rushDue = null; this.endRush(); }
  }

  /** time's up (or you asked to skip ahead): the staff finish your paperwork, the class is drawn, and it's Monday morning */
  private endRush() {
    const st = this.save.state;
    const missing = this.rushTasks().filter((t) => !t.done).map((t) => t.name);
    if (!st.school.registered) st.school.registered = true;
    if (!st.once.healthCheck) st.once.healthCheck = true;
    if (!st.school.kit) { st.school.kit = true; if (st.wardrobe.wearing === 'sivil') st.wardrobe.wearing = 'uniforma'; }
    if (!st.school.books) st.school.books = true;
    if (!st.once.luggage) st.once.luggage = true;
    const goMonday = () => {
      this.drawing = false;
      this.screenFade(() => {
        const c = this.save.clock;
        // to Monday morning (an older save already in the middle of a week just carries on)
        const wd = weekdayOf(c.day);
        if (wd >= 5) { c.day += 7 - wd; c.minutes = WAKE_UP; }
        st.once.rushDone = true;
        st.energy = 100; st.hunger = Math.max(st.hunger, 60);
        if (st.wardrobe.wearing === 'pijama' || st.wardrobe.wearing === 'sivil') st.wardrobe.wearing = 'uniforma';
        this.dress();
        this.npcClock = -1;
        this.lastDoor = this.nearestStand(this.ownDormLoc());
        this.room = null; this.enterDorm();
        this.player.setPosition((ROOM_OX + MY_BED[0] + 0.5) * TILE, (MY_BED[1] + 1.4) * TILE);
        this.checkMissions();
        this.refreshClockAndNeeds();
        this.persist();
        this.hud.showModal({
          title: L({ tr: '☀️ Pazartesi · okul başlıyor!', en: '☀️ Monday · school begins!' }), sub: `${this.save.state.school.classLabel} · ${L({ tr: 'Kahvaltı 07:00–08:30 · ilk ders 08:30', en: 'Breakfast 07:00–08:30 · first lesson 08:30' })}`,
          body: missing.length
            ? L({ tr: `Kayıt dönemi bitti. Yetişemediğin işleri (${missing.join(', ')}) görevliler senin yerine tamamladı. Bugün dersler başlıyor: zil 08:30'da. Geç kalırsan müdür yardımcısından geç kâğıdı alman gerekir.`, en: `Registration weekend is over. The staff finished what you didn't get to (${missing.join(', ')}). Lessons start today: the bell goes at 08:30. If you're late you'll need a late slip from the deputy head.` })
            : L({ tr: 'Kayıt dönemi bitti; her şeyi kendin halletin. Bugün dersler başlıyor: zil 08:30\'da. Geç kalırsan müdür yardımcısından geç kâğıdı alman gerekir.', en: "Registration weekend is over, and you did it all yourself. Lessons start today: the bell goes at 08:30. If you're late you'll need a late slip from the deputy head." }),
          note: L({ tr: 'Üzerinde pijama varsa dolabından üniformanı giymeyi unutma.', en: "If you're still in your pyjamas, don't forget to put your uniform on at your locker." }),
          button: L({ tr: 'Günaydın!', en: 'Good morning!' }),
        });
      });
    };
    if (!st.once.classDrawn) this.classDraw(true, goMonday); else goMonday();
  }

  /** your registration is complete: a popup spins through the classes and lands on yours */
  private classDraw(auto: boolean, then?: () => void) {
    const st = this.save.state;
    this.drawing = true;
    this.player.setVelocity(0, 0);
    const g = grade(st.year);
    const classes = CLASS_LETTERS.map((l) => `${g}-${l}`);
    const pick = classes[Math.floor(Math.random() * classes.length)];
    const el = document.createElement('div');
    el.className = 'card draw-card';
    el.innerHTML = `
      <div class="m-label">${L({ tr: 'Kayıt tamam · sınıf kurası', en: 'Registration complete · the class draw' })}</div>
      <h2>${L({ tr: 'Hangi sınıftasın?', en: 'Which class are you in?' })}</h2>
      <p class="modal-body">${L(auto ? { tr: 'Kayıt dönemi bitti; sıra sınıf kurasında. Torbadan senin adına bir kâğıt çekiliyor…', en: 'Registration weekend is over; time for the class draw. A slip is drawn from the bag for you…' } : { tr: 'Bütün kayıt işlemlerin tamam! Müdür yardımcısı torbadan senin adına bir kâğıt çekiyor…', en: 'All your registration is done! The deputy head draws a slip from the bag for you…' })}</p>
      <div class="roulette">?</div>
      <p class="modal-note hidden"></p>
      <div style="text-align:right"><button type="button" class="primary hidden">${L({ tr: 'Harika!', en: 'Great!' })}</button></div>`;
    const box = el.querySelector('.roulette') as HTMLElement, btn = el.querySelector('button') as HTMLButtonElement, note = el.querySelector('.modal-note') as HTMLElement;
    let i = 0, delay = 60;
    const spin = () => {
      box.textContent = classes[i++ % classes.length];
      delay *= 1.12;
      if (delay < 420) { setTimeout(spin, delay); return; }
      box.textContent = pick; box.classList.add('landed');
      st.school.classLabel = pick;
      st.once.classDrawn = true;
      this.gain({ xp: 10, mood: 5 });
      sfx.success();
      note.textContent = L({ tr: `Sınıfın ${pick}! Sınıf arkadaşlarının isimlerinin önünde ★ var. Onlarla tanış: her biri sana kendini anlatacak.`, en: `You're in ${pick}! Your classmates have a ★ by their names. Go and meet them: each one will tell you about themselves.` });
      note.classList.remove('hidden'); btn.classList.remove('hidden');
    };
    this.hud.openCard(el, [], () => { if (then) then(); else { this.drawing = false; this.checkMissions(); this.persist(); } });
    spin();
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

  /** the evening dilemma moments: the payphone queue in the dorm, and what you see behind the dorm */
  private checkDilemmas() {
    const st = this.save.state, c = this.save.clock;
    if (this.blocked() || this.sleeping || !this.settled()) return;
    const now = c.day * 1440 + c.minutes;
    if (now < this.dilemmaWait || st.memories.some((m) => m.day === c.day)) return; // one a day
    const m = c.minutes;
    if (this.room === 'dorm' && !dilemmaDone(st, 'telefon') && st.daily.call !== c.day && m >= 21 * 60 && m < 21 * 60 + 50) this.openDilemma('telefon');
    else if (!this.room && c.day >= 2 && !dilemmaDone(st, 'arka') && phaseOf(m, c.day) === 'plaza' && m >= 20 * 60 + 20 && m < 21 * 60 + 40) {
      const tx = this.player.x / TILE, ty = this.player.y / TILE, r = PLAZA_EVENING;
      if (tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) this.openDilemma('arka');
    }
  }

  private openDilemma(id: DilemmaId) {
    const c = this.save.clock;
    this.dilemmaWait = c.day * 1440 + c.minutes + 20;
    this.player.setVelocity(0, 0);
    const where = id === 'telefon' ? L({ tr: 'Yurt koridoru', en: 'Dorm corridor' }) : L({ tr: 'Yurdun arkası', en: 'Behind the dorm' });
    this.panel.open(() => ({ title: where, rooms: [{ id: 'dilemma', name: where, actions: [] }] }));
    void runDilemma(this.gameCtx(), id).then(() => { if (this.panel.isOpen) this.panel.close(); this.persist(); });
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
      <div class="sum-row"><span>${L({ tr: 'Kim oluyorsun', en: "Who you're becoming" })}</span><b>${temperLabel(st) ?? L({ tr: 'Henüz belli değil', en: 'Not clear yet' })}</b></div>
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
    const phase = phaseOf(c.minutes, c.day);
    const speed = (this.fast ? 6 : 1) * (this.rushOn() && !night ? RUSH_SPEED : phase === 'etut' ? ETUT_SPEED : 1);
    const msPerMin = (night ? MS_PER_MIN_NIGHT : MS_PER_MIN_DAY) / speed;
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
    const cer = this.isRaining() ? null : ceremonyWindow(c.day);
    if (cer && c.minutes === cer[0] - 5) this.hud.toast(L({ tr: '🇹🇷 Bayrak töreni birazdan Merkez Meydan\'da başlıyor.', en: '🇹🇷 The flag ceremony starts soon on the Merkez Meydan.' }));
    if (cer && c.minutes === cer[2]) this.flagCeremony();
    if (before < BUS_BOARDING && c.minutes >= BUS_BOARDING && isFriday(c.day) && (this.save.character.boarding ?? 'daimi') === 'evci' && st.school.registered) {
      this.hud.toast(L({ tr: '🚌 Hafta sonu servisi Ana Kapı\'da! 17:00\'de kalkıyor.', en: '🚌 The weekend bus is at the main gate! It leaves at 17:00.' }), 'good');
    }
    if (before < CARSI_START && c.minutes >= CARSI_START && isWednesday(c.day)) {
      const guardian = L(GUARDIANS.find((g) => g.id === this.save.character.guardian)!.your);
      this.hud.toast(L({ tr: `📅 Çarşı izni! ${guardian} kantinde seni bekliyor (Spor Salonu).`, en: `📅 Wednesday visit! ${guardian} is waiting for you at the canteen (in the Spor Salonu).` }), 'good');
    }
    // the school bell rings at the start of every lesson
    if (PERIODS.some((p) => p.kind === 'lesson' && p.start === c.minutes) && !isWeekend(c.day) && this.lessonsOn() && this.time.now - this.lastBell > 2000) {
      this.lastBell = this.time.now;
      sfx.bell();
    }

    const asleep = this.sleepRun !== null;
    const awakeLate = !asleep && (c.minutes >= LIGHTS_OUT || c.minutes < WAKE_UP);
    st.hunger = clamp(st.hunger - (asleep ? 0.03 : 0.1));
    st.energy = clamp(st.energy + (asleep ? 110 / Math.max(60, this.sleepRun!.total) : -(awakeLate ? 0.06 : 0.035)));
    // health (GDD §6.2.1)
    let dh = 0;
    if (st.hunger < 20) dh -= 0.08;
    if (st.energy < 10) dh -= 0.04;
    if (awakeLate) dh -= 0.02;
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
    if (this.rushOn()) {
      if (c.day === 1 && c.minutes >= RUSH_NIGHT) this.rushDue ??= 'night';
      if (c.day > RUSH_DAYS || (c.day === RUSH_DAYS && c.minutes >= RUSH_END)) this.rushDue = 'end';
    }
    // (no growling stomach notices while you're asleep)
    if (st.hunger < 15 && !asleep && Math.floor(c.minutes / 60) !== this.hungerWarnedAt) {
      this.hungerWarnedAt = Math.floor(c.minutes / 60);
      this.hud.toast(L({ tr: 'Karnın gurulduyor… Yemekhane\'ye git, kantine uğra ya da dolabındaki atıştırmalıklardan ye.', en: 'Your stomach is growling… head to the dining hall, the canteen or the snacks in your locker.' }));
    }
  }

  /** the İstiklal Marşı at the flag: being in line counts, and whoever has learnt it by heart leads it */
  private flagCeremony() {
    const z = CENTER_ZONES[0], tx = this.player.x / TILE, ty = this.player.y / TILE;
    if (this.room || tx < z.x || tx >= z.x + z.w || ty < z.y || ty >= z.y + z.h) return;
    sfx.success();
    if (this.save.state.anthem.recited && !this.panel.isOpen) {
      this.save.character.respect += 5;
      this.gain({ xp: 30, mood: 10 });
      this.hud.showModal({
        title: L({ tr: '🇹🇷 Bayrak töreni', en: '🇹🇷 Flag ceremony' }), sub: 'Merkez Meydan',
        body: L({ tr: 'Müdür yardımcısı seni öne çağırdı. İlk kıtayı sen başlattın, bütün okul arkandan okudu. +5 saygınlık', en: 'The deputy head called you to the front. You started the first stanza and the whole school joined in. +5 respect' }),
        button: t('close'),
      });
    } else {
      this.gain({ xp: 10, mood: 3 });
      this.hud.toast(L({ tr: '🇹🇷 İstiklal Marşı okundu; sen de sıradaydın.', en: '🇹🇷 The İstiklal Marşı was sung, and you were in line.' }), 'good');
    }
  }

  private onMorning() {
    const c = this.save.clock;
    const st = this.save.state;
    this.hud.toast(t('morning'), 'good');
    this.peeGossip();
    if (this.isRaining()) this.hud.toast(L({ tr: '🌧 Bugün yağmurlu. Montun yanında olsun!', en: '🌧 It\'s rainy today. Keep your coat handy!' }));
    if (this.room !== 'dorm' && !st.escaped && this.settled() && !this.sleepRun) {
      this.penalize(10, L({ tr: 'Sabah yoklamasında yatağında değildin!', en: "You weren't in bed at the morning roll call!" }));
      this.befriend(this.save.character.gender === 'girl' ? 'bel-hatice' : 'bel-mehmet', -10);
    }
    // a borrowed outfit goes back to its owner first thing
    const w = st.wardrobe;
    if (w.borrowed && w.borrowed.day < c.day) {
      const owner = NPCS.find((n) => n.id === w.borrowed!.from);
      this.hud.toast(L({ tr: `${owner?.name ?? 'Arkadaşın'} ödünç verdiği kıyafeti geri aldı: "Sağ ol, iyi bakmışsın!"`, en: `${owner?.name ?? 'Your friend'} took back the clothes they lent you: "Thanks, you looked after them!"` }));
      if (w.wearing === BORROWED) w.wearing = st.school.kit ? 'uniforma' : 'sivil';
      w.borrowed = null;
      this.dress();
    }
    this.followIds = null;
    for (const npc of this.npcs) {
      const def = npc.getData('def') as NpcDef;
      if (def.kind !== 'belletmen' && def.kind !== 'teacher' && !def.fixed) this.pickDayHome(npc);
      if (def.kind !== 'belletmen' && def.kind !== 'teacher') this.pickEveningHome(npc);
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
    const week = weekOf(c.day);
    if (weekdayOf(c.day) === 0 && st.lastAllowanceWeek < week) {
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

  /** into bed: the night fast-forwards in about 40 seconds (your roommates are asleep around you) */
  private sleep() {
    if (this.sleepRun) return;
    const c = this.save.clock;
    const toMorning = c.minutes >= 7 * 60 ? 24 * 60 - c.minutes + 7 * 60 : 7 * 60 - c.minutes;
    this.sleeping = true;
    this.player.setVelocity(0, 0);
    this.player.anims.stop();
    this.player.setFrame(0);
    this.player.body!.enable = false;
    if (this.room === 'dorm') this.player.setPosition((ROOM_OX + MY_BED[0] + 0.5) * TILE, (MY_BED[1] + 0.45) * TILE).setAngle(-90);
    // into your pyjamas, if you have them
    if (this.save.state.school.kit && this.save.state.wardrobe.wearing !== 'pijama' && this.save.state.wardrobe.wearing !== BORROWED) { this.save.state.wardrobe.wearing = 'pijama'; this.dress(); }
    this.sleepRun = { kind: 'sleep', msPerMin: Math.min(50, SLEEP_MS / toMorning), acc: 0, left: toMorning, total: toMorning, busy: false, events: this.nightEvents(toMorning) };
    this.hud.toast(L({ tr: '😴 İyi geceler…', en: '😴 Good night…' }));
  }

  /** things that can happen while you sleep (more night challenges can be added here) */
  private nightEvents(toMorning: number): Array<{ at: number; done: boolean; run: () => Promise<void> }> {
    const st = this.save.state;
    const out: Array<{ at: number; done: boolean; run: () => Promise<void> }> = [];
    const c = this.save.clock;
    // the minute of the night (from now) when it happens
    const after = (hhmm: number) => { const m = (hhmm - c.minutes + 24 * 60) % (24 * 60); return m > 0 && m < toMorning ? m : -1; };
    if (this.room === 'dorm' && st.cemil.pee === 'assigned' && st.year <= PEE_LAST_YEAR) {
      const at = after(3 * 60 + Math.floor(Math.random() * 40));
      if (at > 0) out.push({ at, done: false, run: () => this.peeChallenge() });
    }
    return out;
  }

  private async peeChallenge() {
    const st = this.save.state;
    const ctx = this.gameCtx();
    let ok = false;
    await new Promise<void>((resolve) => {
      this.panel.open(() => ({
        title: L({ tr: 'Gece yarısı…', en: 'Middle of the night…' }), sub: L({ tr: 'Cemil Emmi\'nin görevi', en: "Cemil Emmi's task" }),
        rooms: [{ id: 'night', name: L({ tr: 'Yatağın', en: 'Your bed' }),
          note: L({ tr: 'Gözlerini açtın. O koca bardak su… çişin geldi! Kalkarsan belletmen yakalar. Sabaha kadar tutmalısın.', en: 'Your eyes snap open. That big glass of water… you need to pee! Get up and the belletmen will catch you. Hold it until morning.' }),
          actions: [{ id: 'hold', label: L({ tr: '😬 Tut!', en: '😬 Hold it!' }), run: async () => {
            ok = await this.panel.holdOn(L({ tr: 'Çiş Barajı', en: 'Hold It!' }), L({ tr: 'Ok yeşile gelince BOŞLUK\'a bas: sık ve dayan!', en: 'Press SPACE when the marker is in the green: squeeze and hang on!' }), 14);
            this.panel.close();
          } }] }],
        canClose: () => (ok ? undefined : L({ tr: 'Kaçış yok, tutman lazım!', en: 'No escape, you have to hold it!' })),
      }));
      const done = () => { if (!this.panel.isOpen) resolve(); else this.time.delayedCall(200, done); };
      this.time.delayedCall(200, done);
    });
    if (ok) { st.cemil.pee = 'held'; ctx.gain({ xp: 30 }); this.hud.toast(L({ tr: '💪 Sabaha kadar tuttun! Cemil Emmi\'ye anlat.', en: '💪 You held it until morning! Go tell Cemil Emmi.' }), 'good'); }
    else {
      st.cemil.peeFails++;
      st.cemil.wetDay = this.save.clock.minutes >= 7 * 60 ? this.save.clock.day + 1 : this.save.clock.day;
      ctx.gain({ mood: -12 });
      this.hud.toast(L({ tr: `😳 Çarşaflar ıslandı… (${st.cemil.peeFails}. gece) Bu gece yine denemen gerek.`, en: `😳 The sheets are wet… (night ${st.cemil.peeFails}) You'll have to try again tonight.` }));
    }
  }

  private updateSleep(delta: number) {
    const s = this.sleepRun!;
    if (s.busy) return;
    s.acc += delta;
    let changed = false;
    while (s.acc >= s.msPerMin && s.left > 0) {
      s.acc -= s.msPerMin;
      s.left--;
      this.stepMinute();
      changed = true;
      const ev = s.events.find((e) => !e.done && s.total - s.left >= e.at);
      if (ev) {
        ev.done = true; s.busy = true;
        void ev.run().finally(() => { s.busy = false; s.acc = 0; });
        break;
      }
    }
    if (changed) this.refreshClockAndNeeds();
    const c = this.save.clock;
    const pct = Math.round(((s.total - s.left) / s.total) * 100);
    if (s.kind === 'sleep') this.hud.setBanner(L({ tr: `😴 Uyuyorsun… ${fmtTime(c.minutes)} · ${pct}%`, en: `😴 Sleeping… ${fmtTime(c.minutes)} · ${pct}%` }), { label: L({ tr: 'Uyan', en: 'Wake up' }), onClick: () => this.wakeUp(true) });
    else if (s.kind === 'idle') this.hud.setBanner(L({ tr: `⏳ Vakit öldürüyorsun… ${fmtTime(c.minutes)} · ${pct}%`, en: `⏳ Killing time… ${fmtTime(c.minutes)} · ${pct}%` }), { label: L({ tr: 'Bırak', en: 'Stop' }), onClick: () => this.wakeUp(true) });
    else this.hud.setBanner(L({ tr: `🍽 Yemek yiyorsun… ${s.left} dk`, en: `🍽 Eating… ${s.left} min` }));
    if (s.left <= 0) this.wakeUp(false);
  }

  private wakeUp(early: boolean) {
    const s = this.sleepRun;
    if (!s || s.busy) return;
    const st = this.save.state;
    this.sleepRun = null;
    this.hud.setBanner(null);
    if (s.kind !== 'sleep') {
      this.sleeping = false;
      if (s.kind === 'eat' && early) return;
      s.onDone?.();
      if (s.kind === 'idle' && !early) this.hud.toast(L({ tr: 'Etüt bitti. Hiçbir şey yapmadan zaman geçti.', en: 'Study time is over. The time went by and you did nothing at all.' }));
      this.refreshClockAndNeeds();
      return;
    }
    this.sleeping = false;
    this.player.setAngle(0);
    this.player.body!.enable = true;
    if (this.room === 'dorm') this.player.setPosition((ROOM_OX + MY_BED[0] + 0.5) * TILE, (MY_BED[1] + 1.4) * TILE);
    if (!early) {
      st.health = clamp(st.health + 6);
      st.energy = 100;
      this.changeMood(st.hunger < 25 ? -5 : 5);
    } else this.hud.toast(L({ tr: 'Uyandın. Etraf karanlık ve sessiz…', en: "You're awake. It's dark and quiet…" }));
    this.refreshClockAndNeeds();
    this.persist();
  }

  private refreshClockAndNeeds() {
    const c = this.save.clock;
    const p = currentPeriod(c.day, c.minutes);
    const lessonsLocked = !this.lessonsOn();
    const label = ceremonyNow(c.day, c.minutes) && !this.isRaining() ? L(CEREMONY) : p?.kind === 'lesson' && lessonsLocked
      ? L({ tr: 'Okulun ilk günleri · dersler henüz başlamadı', en: 'First days · lessons have not started yet' })
      : L(periodLabel(c.day, c.minutes));
    this.hud.setClock(c.day, c.minutes, label, this.isRaining() ? '🌧' : '');
    this.hud.setNeeds(this.save.state);
    const title = councilTitle(this.save.state);
    this.hud.setName(`${this.save.character.first} ${this.save.character.last}${title ? ` · ${L(title)}` : ''}`);
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
    if (this.escort) [vx, vy] = this.escortFollow();
    else if (!blocked) {
      if (k.left.isDown || k.a.isDown) vx -= 1;
      if (k.right.isDown || k.d.isDown) vx += 1;
      if (k.up.isDown || k.w.isDown) vy -= 1;
      if (k.down.isDown || k.s.isDown) vy += 1;
    }
    const len = Math.hypot(vx, vy) || 1;
    const running = k.shift.isDown && this.save.state.energy > 10 && (vx !== 0 || vy !== 0);
    if (running) this.save.state.energy = clamp(this.save.state.energy - delta * 0.0008); // running tires you out
    const speed = this.escort ? ESCORT_SPEED : this.save.state.energy < 10 ? SPEED * 0.6 : running ? SPEED * 1.6 : SPEED;
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
    this.updateBuildingFade();
    const carrying = !this.save.state.once.luggage;
    this.suitcase.setVisible(carrying);
    if (carrying) this.suitcase.setPosition(this.player.x + (this.dir === 1 ? -11 : 11), this.player.y + 15).setDepth(this.player.y + (this.dir === 3 ? 15 : 17));
    this.showNextAnnouncement();
    this.updateRush();
    this.checkDilemmas();
    this.enforceCurfew();
    this.updateHunt(delta);
    this.updateCountdown();
    this.trackerTimer += delta;
    if (this.trackerTimer > 400) { this.trackerTimer = 0; this.updateTracker(); }

    this.updateNpcs(time);
    if (!this.room) { this.pushOutOfBuildings(this.player); for (const n of this.npcs) if (n.visible) this.pushOutOfBuildings(n); }
    this.updatePeers(time);
    this.emoteTimer += delta;
    if (this.emoteTimer > 1400) { this.emoteTimer = 0; this.showEmote(); }
    this.updateRoom(time, delta);
    this.updateClass(time, delta);
    this.updateDining(time);
    this.revealAround();
    this.updatePrompt();
    if (this.sleepRun) this.updateSleep(delta); else this.tickClock(delta);
    this.updateMatch(time);
    this.updateCharacters();

    this.drawNight();
    this.updateParticles();
    this.ambient.update(time, delta, { player: this.player, inside: this.inside, rain: this.isRaining(), dark: this.darkAlpha });
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
      friends: this.npcs.filter((n) => n.visible && this.isFriend(n.getData('def') as NpcDef)).map((n) => ({ x: n.x / TILE, y: (n.y + 10) / TILE, name: (n.getData('def') as NpcDef).name })),
    });
  }

  private persist() {
    this.save.player = { x: this.player.x / TILE, y: this.player.y / TILE, dir: this.dir, inside: this.room ?? undefined, door: this.lastDoor ? [this.lastDoor.x, this.lastDoor.y] : undefined };
    this.save.fog = encodeFog(this.revealed);
    this.save.seen = [...this.seen];
    this.save.discovered = [...this.discovered];
    this.save.lang = getLang();
    this.save.state.daily = Object.fromEntries(Object.entries(this.save.state.daily).filter(([, d]) => d >= this.save.clock.day - 1));
    writeSave(this.save);
    if (this.net) saveToCloud(this.net.id, this.save);
  }
}

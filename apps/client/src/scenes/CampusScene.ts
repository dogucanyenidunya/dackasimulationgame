import Phaser from 'phaser';
import { TouchControls, isTouch, onTouchMode } from '../ui/touch';
import { onboardingCard } from '../ui/onboarding';
import {
  AQUEDUCT, AQUEDUCT_PIER, BENCHES, BLOCK_TILES, BUST, CABIN, CEMIL_OUT, STAIRS, COURTS, EXTRA_COURTS, PLAY_COURTS, FLAGPOLE, FLOWERS, PULLUP_BARS, GATE, GATES, GATE_IN, LAYOUT, SCHOOL_FRONT, LAMPS, SPAWN, LOCATIONS, MAP_H, MAP_W, PATROL_ROUTE, PLAZA_ALLOWED, PLAZA_EVENING, SOLID_TILES, T, TILE, TREES, BUILDINGS, timWallAt, wallAt,
  MEYDAN_STAIRS, PYRAMID, TRIBUNE, inPeArea, BARRIERS, CAGES, MEYDAN_RAMP, SOUTH_STAIRS, SOUTH_WALL, TUNNEL, TUNNEL_IN, TUNNEL_STAIRS,
  AGE_ZONES, CENTER_ZONES, inDormBacks, liseYard, EVENING_CENTER, EVENING_ZONES, buildMap, doorInPassage, doorStandTile, inPoly, nearestEdge, passageAt, type Building, type Location, type Rect,
} from '../content/campus';
import {
  ART_RES, DEFAULT_LOOK, FOG_FULL, FOG_KEY, FOG_SOFT, TILESET_KEY, TILESET_MARGIN, TILESET_SPACING, generateTextures, makeCharacterTexture, fitCharacter, footBody,
} from '../art/textures';
import { L, t, getLang, onLangChange } from '../i18n';
import { Hud } from '../ui/hud';
import { sfx } from '../audio';
import { bushSpots, frontAt, makeBuildingArt, makeShadowArt, type BuildingArt } from '../art/buildingArt';
import { CABIN_SIZE, GATE_LEAF_SIZE, PYRAMID_SIZE, SOUTH_FACE, TRIBUNE_LIFT, TUNNEL_ARCH_SIZE, TUNNEL_WALL, WALL_FACE, lowWallMask, makeGatewayTextures, tribuneKey } from '../art/gateway';
import { dressGround } from '../art/ground';
import { bakeRoom } from '../art/interior';
import { drawFences } from '../art/fences';
import { Ambient } from './ambient';
import { YetimCat } from './yetim';
import { yetimPanel } from '../game/yetimCat';
import { ClassLife } from './classLife';
import { Multiplayer, type FriendNudge, type PeerProfile, type PeerPos } from '../net/multiplayer';
import { PeerPlay } from '../game/peerPlay';
import { CLASSIC, NPC_BEDS, NPC_CLASS_DESKS, settle, spotKey, storeSpots, storedSpots, readSpots, type Spots } from '../game/spots';
import { QUIET_MS, cancelLeaving, leftMessage, showAway, startLeaving, stepLeaving, type Leaving } from './peerExit';
import { YetimballView, botHit, type YbResult } from '../ui/yetimball';
import { PhoneRunView, type PhoneRunResult } from '../ui/phoneRun';
import { listFriends, myInviteCode, removeFriend, requestFriend, respondFriend, setMyName, type Friend } from '../net/friends';
import { friendName, friendsCard } from '../ui/friends';
import { askConfirm } from '../ui/confirm';
import { flushCloudSave, saveToCloud } from '../net/cloudSave';
import { MS_PER_MIN_DAY, MS_PER_MIN_NIGHT, absMinutes, alignOffset, worldNow } from '../game/worldClock';
import type { NetUser } from '../main';
import { Panel, type ActionView } from '../ui/panel';
import { attendLesson, lessonNow, pePanel, bedPanel, buildingPanel, cemilPanel, courtPanel, deskPanel, dormBestFriend, exitPanel, lockerPanel, mateLockerPanel, matePanel, npcPanel, phonePanel, playMatch, tvPanel, type GameCtx, type Gain } from '../game/buildings';
import {
  BELLETMEN_ROUTE, CEMIL_IN, SEATS as DORM_SEATS, EXIT, PHONE_SPOT, MY_LOCKER, ROOM_H, ROOM_OX, ROOM_SOLID, ROOM_SPAWN, ROOM_W, TV_SPOT, buildRoom,
} from '../content/dormroom';
import { CLASS_EXIT, CLASS_H, CLASS_OX, CLASS_SPAWN, CLASS_W, TEACHERS, TEACHER_ROUTE, buildClassroom } from '../content/classroom';
import { araOgun, currentMeal, eatMeal, egitim, gatePanel, trayLock, washHands, yemekhane, yemekhaneClosed } from '../game/buildings';
import { BACK_ON_SUNDAY, BUS_BOARDING, BUS_LEAVES, CARSI_END, CARSI_START, VISIT_END, VISIT_START, carsiNow, isFriday, isSunday, isWednesday, weekday } from '../game/weekend';
import { MATCH_END, MATCH_FREE, MATCH_OPEN, MATCH_TIP, getMatchDay, isMatchDay, matchFree, matchOn, setMatchDay } from '../game/schedule';
import { MatchView } from '../ui/match';
import { DRESS_MINUTES, activityOf, teacherActivity, wakeTime, type Activity, type Indoors, type RoutineClock } from '../game/routine';
import { SECRETS, dueSecrets, hasSecret } from '../game/secrets';
import { chooseFocus, focusLine, focusMult, focusTick } from '../game/focus';
import { AXES, arcLine, dilemmaDone, matchState, runDilemma, shape, type DilemmaId } from '../game/dilemmas';
import { COOKS, COUNTER_TILES, DINING_EXIT, DINING_H, DINING_OX, DINING_SOLID, DINING_SPAWN, DINING_W, SEATS, SINKS, TABLES, buildDining } from '../content/dining';
import { BELLETMENS, DEPUTY, GROUPS, NPCS, TEACHER_NPCS, ageGroup, genitiveTr, type NpcDef } from '../content/npcs';
import { BORROWED, PYJAMAS, wornLook } from '../content/wardrobe';
import { writeDiary, type DiaryEvent } from '../content/diary';
import { myGroup, dislikers, groupLabel, SURPRISES } from '../game/social';
import { relationshipsCard } from '../ui/relationships';
import { CEREMONY, ETUT_START, FIRST_MONDAY, LIGHTS_OUT, presentKey, RUSH_DAYS, RUSH_END, RUSH_MORNING, RUSH_NIGHT, RUSH_TOTAL, WAKE_UP, ceremonyNow, ceremonyWindow, diningOpen, phaseOf, rushLeft, weekOf, weekday as weekdayOf, type DayPhase } from '../game/schedule';
import {
  GIVER_IDS, MISSIONS, missionById, nextObjective, questMark, reached, statusOf, trackedMission, type MissionCtx,
} from '../game/missions';
import { announceManyCard, missionsCard, trackerHtml } from '../ui/missions';
import { ATTRS, CAUSES } from '../content/character';
import { CLASS_LETTERS, SUBJECTS, average, FRIEND_AT, behaviorGrade, COURT_PLAYERS, PEE_LAST_YEAR, councilTitle, grade, type CourtSport, type SubjectId } from '../game/state';
import { PERIODS, classBreak, currentPeriod, fmtTime, hasEtut, isSnackTime, isWeekend, periodLabel, subjectFor } from '../game/schedule';
import { clamp, growAttr, growRespect } from '../game/state';
import { GUARDIANS, mixBonus, mixLean, mixName, moodGuard, traitMix, weeklyAllowance, type AttrId } from '../content/character';
import { backupSave, clearSave, decodeFog, encodeFog, writeSave, type SaveData } from '../save';

const REVEAL_RADIUS = 7;
const SEEN_RADIUS = 9;
const SPEED = 150;
/** this long without a key, click or touch and you're inactive: the game stops (online you're AFK, and come back at the main gate) */
const AFK_MS = 2 * 60 * 1000;
/** a gap in the campus clock longer than this (game minutes) is jumped over instead of played through */
const CATCH_UP_MAX = 360;
/** the registration weekend runs fast (it's a rush); evening study drags, so it runs at double speed too */
const RUSH_SPEED = 4;
const ETUT_SPEED = 2;
/** a night's sleep fast-forwards in about this many real milliseconds */
const SLEEP_MS = 10_000 / 3;
/** how close you have to stand to someone to talk to them (centre to centre: about a step between you) */
const TALK_RANGE = 1.25 * TILE;
/** how many students there are in each devre (school year); a big one splits into its friend groups when it gathers */
const DEVRE_SIZE = new Map<number, number>();
for (const n of NPCS) DEVRE_SIZE.set(n.grade ?? 4, (DEVRE_SIZE.get(n.grade ?? 4) ?? 0) + 1);
/** how much of a classmate shows above a study table when they sit on its far side */
const DESK_CROP = 0.72;
/** in bed only the head and the top of the shoulders show above the blanket */
const BED_CROP = 0.42;
/** where a sleeper stands in a bed tile (tile rows): seen from above, head on the pillow at the top */
const BED_Y = 0.53;

/** into bed: upright as seen from above, head on the pillow, the blanket over the rest */
function tuckIn(sp: Phaser.GameObjects.Sprite, x: number, y: number) {
  sp.setAngle(0).setFrame(0).setPosition(x, y);
  sp.setCrop(0, 0, sp.frame.realWidth, sp.frame.realHeight * BED_CROP);
  sp.setData('inBed', true);
}

/** out of bed: the whole of them shows again */
function getUp(sp: Phaser.GameObjects.Sprite) {
  if (!sp.getData('inBed')) return;
  sp.setData('inBed', false);
  sp.setCrop();
}
/** how long a meal takes at the table (game minutes), and how fast it goes by */
const MEAL_MINUTES = 25;

type DiningSeat = { x: number; y: number; faces: 0 | 3 };
/** where someone sits on a dining seat (tile rows): facing you, right up behind the table (only head and shoulders
 *  show above it, like the far side of the study tables); with their back to you, on the chair below the table */
const seatedY = (s: DiningSeat) => s.y + (s.faces === 0 ? 0.8 : 0.35);
/** their tray on the table in front of them (world px) */
const trayOn = (s: DiningSeat) => ({ x: (DINING_OX + s.x + 0.5) * TILE, y: (s.y + (s.faces === 0 ? 1 : -1)) * TILE + (s.faces === 0 ? 10 : 19) });
/** behind the table the legs don't show (and away from it, the whole of them again) */
function sitAtTable(sp: Phaser.GameObjects.Sprite, behind: boolean) {
  if (behind) sp.setCrop(0, 0, sp.frame.realWidth, sp.frame.realHeight * DESK_CROP);
  else if (sp.isCropped) sp.setCrop();
}
/** one spoonful: up to the mouth, a chew, back down for more (ms) */
const EAT_MS = 2200;
const MEAL_MS_PER_MIN = 320;
/** a lesson you haven't gone to: after this many minutes the deputy head comes looking for you */
const TRUANT_AFTER = 8;
/** home rings you before bed on one of the first nights: the first evening up to this day you're in the dorm */
const HOME_CALLS_BY = 5;
/** how many of your closest friends come and hang around near you in their free time */
const FOLLOWERS = 3;

const DIRS = { down: 0, left: 1, right: 2, up: 3 } as const;
/** the PE lesson's menu title (its activities write their own diary line) */
const T_PE = () => L({ tr: 'Beden Eğitimi', en: 'Physical Education' });
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
  /** the cat on the Merkez Meydan */
  private yetim!: YetimCat;
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
  /** moves NPCs can't make across a retaining wall or railing: bit 1 = to the tile east, bit 2 = to the tile south */
  private npcLedge = new Uint8Array(MAP_W * MAP_H);
  /** down in the tunnel under the Merkez Meydan */
  private inTunnel = false;
  /** the tunnel's inside and the square's paving over it, faded in while you're down there (0–1) */
  private tunnelView = 0;
  private tunnelImgs: { inside: Phaser.GameObjects.Image; roof: Phaser.GameObjects.Image } | null = null;
  private suitcase!: Phaser.GameObjects.Image;
  private announceQueue: string[] = [];
  /** the first-visit tour is open */
  private touring = false;
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
  private sleepRun: { kind: 'sleep' | 'idle' | 'eat' | 'busy' | 'home'; label?: string; msPerMin: number; acc: number; left: number; total: number; busy: boolean; events: Array<{ at: number; done: boolean; run: () => Promise<void> }>; onDone?: () => void } | null = null;
  private zzz: Phaser.GameObjects.Text[] = [];
  /** your bed, study chair and classroom desk (online they're whichever were free when you came on) */
  private spots: Spots = CLASSIC;
  /** online: the beds, study chairs (as table tiles) and desks other players in your dorm / class hold */
  private held = { bed: new Set<string>(), desk: new Set<string>(), seat: new Set<string>() };
  /** when you came online this session (whoever came first keeps a spot two players picked) */
  private onlineSince = 0;
  /** the name tags on your bed, study chair and desk */
  private spotTags: { bed?: Phaser.GameObjects.Text; desk?: Phaser.GameObjects.Text; seat?: Phaser.GameObjects.Text } = {};
  /** which classroom desk each classmate sits at */
  private classDeskOf = new Map<string, string>();
  /** online play (null = offline) */
  private net: NetUser | null = null;
  /** online: campus day number minus your own (null until this session has lined your clock up with the campus) */
  private worldOffset: number | null = null;
  /** paused: the tab is in the background, or you've been AFK */
  private away = false;
  /** when you last pressed, clicked, touched or moved the mouse (performance.now) */
  private lastActive = performance.now();
  private mp: Multiplayer | null = null;
  /** things to do with other players: treats, jokes, Yetimball and other two-player games */
  private peerPlay: PeerPlay | null = null;
  /** online: your real-player friends and friend requests, by user id (friendsReady = the list has loaded) */
  private friends = new Map<string, Friend>();
  private friendsReady = false;
  /** the friends panel while it's open, so it can update live */
  private friendsUi: { render: () => void } | null = null;
  private friendsTimer: number | null = null;
  /** `lastPos`: when their last position came (performance.now) · `away`: paused or gone quiet · `leaving`: walking off after they left */
  private peers = new Map<string, { sprite: Phaser.GameObjects.Sprite; label: Phaser.GameObjects.Text; profile: PeerProfile; tx: number; ty: number; dir: number; moving: boolean; lying: boolean; room: string; seen: boolean; lastPos: number; away: boolean; leaving: Leaving | null }>();
  /** which walkable interior you're in, if any */
  private room: 'dorm' | 'class' | 'dining' | null = null;
  private diners: Phaser.Physics.Arcade.Sprite[] = [];
  private cooks: Phaser.GameObjects.Sprite[] = [];
  private dinerKey = '';
  /** while you eat: everyone who has sat beside you or across from you so far (they stay put until you've finished) */
  private mealMates: { near: (d: Phaser.GameObjects.Sprite) => boolean; met: Map<string, NpcDef> } | null = null;
  private tray: { meal: import('../game/state').MealId; name: string } | null = null;
  /** your tray on the table while you eat */
  private trayAt: { x: number; y: number } | null = null;
  private trayImg!: Phaser.GameObjects.Image;
  /** your spoon while you eat */
  private spoonImg!: Phaser.GameObjects.Image;
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
    const st0 = this.save.state, c0 = this.save.clock;
    if (st0.once.matchDay === undefined) {
      const past = c0.day > 9 || (c0.day === 9 && c0.minutes >= MATCH_END);
      st0.daily.matchDay = past ? c0.day + ((6 - weekday(c0.day) + 7) % 7 || 7) : 9;
      st0.once.matchDay = true;
    }
    setMatchDay(st0.daily.matchDay ?? 9);
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
    this.add.image(STAIRS.x * TILE, STAIRS.y * TILE, 'stairs').setScale(1 / ART_RES).setOrigin(0).setDepth(3);
    // the steps down from the first-floor corridor through Eğitim to the Merkez Meydan
    this.add.image(MEYDAN_STAIRS.x * TILE, MEYDAN_STAIRS.y * TILE - 4, 'stairs-ew').setScale(1 / ART_RES).setOrigin(0).setDepth(3);
    // the Merkez Meydan's terrace: the stairwell down into the tunnel, the road down its east side, the steps down its
    // south edge (the picture starts on the landing a tile west of the flight) and the tunnel's arch in the east wall
    this.add.image(TUNNEL_STAIRS.x * TILE, TUNNEL_STAIRS.y * TILE, 'tunnel-stairs').setScale(1 / ART_RES).setOrigin(0).setDepth(3);
    this.add.image(MEYDAN_RAMP.x * TILE, MEYDAN_RAMP.y * TILE, 'meydan-ramp').setScale(1 / ART_RES).setOrigin(0).setDepth(2);
    this.add.image(SOUTH_WALL.x0 * TILE, SOUTH_WALL.y * TILE - SOUTH_FACE, 'south-wall').setScale(1 / ART_RES).setOrigin(0).setDepth(3);
    this.add.image(SOUTH_STAIRS.x * TILE, SOUTH_STAIRS.y * TILE, 'south-stairs').setScale(1 / ART_RES).setOrigin(0).setDepth(3);
    // inside the tunnel, under the square's paving: both only show (the paving see-through) while you're down there
    const ty = TUNNEL.y * TILE - TUNNEL_WALL;
    this.tunnelImgs = {
      inside: this.add.image(TUNNEL.x * TILE, ty, 'tunnel-inside').setScale(1 / ART_RES).setOrigin(0).setDepth(TUNNEL.y * TILE + 1).setAlpha(0),
      // (you're drawn between the two; anyone up on the square is drawn over the paving, walking on it)
      roof: this.add.image(TUNNEL.x * TILE, ty, 'tunnel-roof').setScale(1 / ART_RES).setOrigin(0).setDepth(TUNNEL.y * TILE + 3).setAlpha(0),
    };
    this.add.image(TUNNEL_IN.east * TILE - 6, (TUNNEL_IN.y + 0.5) * TILE, 'tunnel-arch').setScale(1 / ART_RES).setOrigin(0, 0.5).setDepth((TUNNEL_IN.y + 1) * TILE + TUNNEL_ARCH_SIZE.h / 2 - 16);

    this.drawBuildings();
    // the wire round the courts on the south lawn
    drawFences(this, CAGES);

    // decor
    const trees = this.physics.add.staticGroup();
    for (const [x, y] of TREES) {
      const tree = trees.create(x * TILE + 16, y * TILE - 4, 'tree') as Phaser.Physics.Arcade.Sprite;
      tree.setScale(1 / ART_RES).setDepth(y * TILE + 30).refreshBody();
      tree.body!.setSize(12, 8).setOffset(18, 60);
    }
    for (const [x, y] of BENCHES) this.add.image(x * TILE + 16, y * TILE + 16, 'bench').setScale(1 / ART_RES).setDepth(y * TILE + 10);
    for (const [x, y] of FLOWERS) this.add.image(x * TILE + 16, y * TILE + 16, 'flowers').setScale(1 / ART_RES).setDepth(y * TILE + 4);
    for (const [x, y] of LAMPS) {
      const lamp = trees.create(x * TILE + 16, y * TILE + 4, 'lamp') as Phaser.Physics.Arcade.Sprite;
      lamp.setScale(1 / ART_RES).setDepth(y * TILE + 30).refreshBody();
      lamp.body!.setSize(6, 4).setOffset(5, 48);
      this.lightSpots.push({ x: x * TILE + 16, y: y * TILE - 12, r: 3 });
    }
    // landmarks: the flag for ceremonies, and the pull-up bars behind the boys' dorm
    if (!this.anims.exists('flag-wave')) {
      this.anims.create({ key: 'flag-wave', frames: this.anims.generateFrameNumbers('flag', { frames: [0, 1, 2, 1] }), frameRate: 5, repeat: -1 });
    }
    const bars = trees.create(PULLUP_BARS[0] * TILE, PULLUP_BARS[1] * TILE, 'pullup') as Phaser.Physics.Arcade.Sprite;
    bars.setScale(1 / ART_RES).setOrigin(0.5, 1).setDepth(PULLUP_BARS[1] * TILE + 2).refreshBody();
    bars.body!.setSize(72, 8).setOffset(4, 48);
    const flag = trees.create(FLAGPOLE[0] * TILE + 16, FLAGPOLE[1] * TILE - 16, 'flag') as Phaser.Physics.Arcade.Sprite;
    flag.setScale(1 / ART_RES).setDepth(FLAGPOLE[1] * TILE + 40).play('flag-wave').refreshBody();
    flag.body!.setSize(6, 6).setOffset(5, 86);
    // the big green main gate: stone pillars, a green arch with the school's name, the leaves slid open
    // along the fence, and the guards' cabin just inside
    for (const gate of GATES) {
      for (const gx of [gate.x - 0.5, gate.x + gate.w + 0.5]) {
        const post = trees.create(gx * TILE, (gate.y + 0.5) * TILE - 34, 'gatepost') as Phaser.Physics.Arcade.Sprite;
        post.setScale(1 / ART_RES).setDepth((gate.y + 0.5) * TILE + 16).refreshBody();
        post.body!.setSize(24, 12).setOffset(4, 86);
      }
      const gy = gate.y + 0.5;
      this.add.image((gate.x + gate.w / 2) * TILE, gy * TILE - 70, gate === GATE ? 'gatearch' : 'gatearch-tim').setScale(1 / ART_RES).setOrigin(0.5, 1).setDepth(gy * TILE + 20);
      // the two leaves stand swung open into the campus, hinged on the pillars
      const hinge = (gate.y + 0.3) * TILE, ox = 1 / GATE_LEAF_SIZE.w;
      this.add.image(gate.x * TILE, hinge, 'gateleaf').setScale(1 / ART_RES).setOrigin(ox, 1).setDepth(hinge);
      this.add.image((gate.x + gate.w) * TILE, hinge, 'gateleaf').setScale(1 / ART_RES).setOrigin(1 - ox, 1).setFlipX(true).setDepth(hinge);
      this.lightSpots.push({ x: (gate.x + gate.w / 2) * TILE, y: (gate.y - 0.4) * TILE, r: 2 });
    }
    const cabin = trees.create(CABIN.x * TILE, (CABIN.y + CABIN.h) * TILE, 'cabin') as Phaser.Physics.Arcade.Sprite;
    cabin.setScale(1 / ART_RES).setOrigin(0, 1).setDepth((CABIN.y + CABIN.h) * TILE).refreshBody();
    cabin.body!.setSize(CABIN_SIZE.w, CABIN.h * TILE).setOffset(0, CABIN_SIZE.h - CABIN.h * TILE);
    this.lightSpots.push({ x: (CABIN.x + CABIN.w / 2) * TILE, y: (CABIN.y + CABIN.h) * TILE - 20, r: 1.4 });
    // the tall perimeter wall, a block per fence tile; its stone face shows wherever nothing walls it in to the south
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      if (!wallAt(this.map, x, y)) continue;
      // the TIM yard's wall is a low garden wall, not the tall perimeter wall
      if (timWallAt(x, y)) {
        const low = (dx: number, dy: number) => timWallAt(x + dx, y + dy) && wallAt(this.map, x + dx, y + dy);
        this.add.image(x * TILE, (y + 1) * TILE, `lowwall-${lowWallMask(low(0, -1), low(1, 0), low(0, 1), low(-1, 0))}`).setScale(1 / ART_RES).setOrigin(0, 1).setDepth((y + 1) * TILE);
        continue;
      }
      const face = !wallAt(this.map, x, y + 1) || timWallAt(x, y + 1);
      this.add.image(x * TILE, (y + 1) * TILE - (face ? 0 : WALL_FACE), face ? 'wallblock' : 'walltop').setScale(1 / ART_RES).setOrigin(0, 1).setDepth((y + 1) * TILE);
    }
    // the aqueduct over the main street: walk through its big arch; its two piers stand against the walls
    const aqFront = (AQUEDUCT.y + AQUEDUCT.h) * TILE;
    this.add.image(AQUEDUCT.x * TILE, aqFront, 'aqueduct').setScale(1 / ART_RES).setOrigin(0, 1).setDepth(aqFront + 1);
    for (const px of [AQUEDUCT.x, AQUEDUCT.x + AQUEDUCT.w - AQUEDUCT_PIER]) {
      const pier = this.add.rectangle((px + AQUEDUCT_PIER / 2) * TILE, (AQUEDUCT.y + AQUEDUCT.h / 2) * TILE, AQUEDUCT_PIER * TILE, AQUEDUCT.h * TILE).setVisible(false);
      trees.add(pier);
    }
    // Cemil Emmi sweeps in front of the boys' dorm by day
    this.cemilOut = trees.create(CEMIL_OUT[0] * TILE, CEMIL_OUT[1] * TILE, 'player', 0) as Phaser.Physics.Arcade.Sprite;
    // the three-sided pyramid in the very centre of the Merkez Meydan
    const pyr = trees.create(PYRAMID.x * TILE, PYRAMID.y * TILE, 'pyramid') as Phaser.Physics.Arcade.Sprite;
    pyr.setScale(1 / ART_RES).setOrigin(0.5, 1 - PYRAMID_SIZE.foot / 2 / PYRAMID_SIZE.h).setDepth(PYRAMID.y * TILE + 6).refreshBody();
    pyr.body!.setSize(PYRAMID_SIZE.w - 20, PYRAMID_SIZE.foot - 8).setOffset(10, PYRAMID_SIZE.h - PYRAMID_SIZE.foot + 2);
    this.lightSpots.push({ x: PYRAMID.x * TILE, y: PYRAMID.y * TILE - 20, r: 2.6 });
    // the grandstand along the Spor Salonu's east wall, facing the pitch (solid: you watch from the path in front)
    TRIBUNE.forEach((r, i) => {
      this.add.image(r.x * TILE, r.y * TILE - TRIBUNE_LIFT, tribuneKey(i)).setScale(1 / ART_RES).setOrigin(0).setDepth((r.y + r.h) * TILE - 2);
      const block = this.add.rectangle((r.x + r.w / 2) * TILE, (r.y + r.h / 2) * TILE, r.w * TILE, r.h * TILE).setVisible(false);
      trees.add(block);
    });
    // the Atatürk bust among its trees in the south-east corner of the Merkez Meydan
    const bust = trees.create(BUST[0] * TILE, BUST[1] * TILE - 8, 'bust') as Phaser.Physics.Arcade.Sprite;
    bust.setScale(1 / ART_RES).setDepth(BUST[1] * TILE + 28).refreshBody();
    bust.body!.setSize(30, 12).setOffset(5, 50);
    this.lightSpots.push({ x: BUST[0] * TILE, y: BUST[1] * TILE + 6, r: 2.2 });
    // bushes along the building fronts, door lights
    for (const b of BUILDINGS) {
      for (const [x, y] of bushSpots(b, this.map)) this.add.image(x * TILE, y * TILE, 'bush').setScale(1 / ART_RES).setDepth(y * TILE + 12);
    }
    for (const loc of LOCATIONS) { const d = loc.doors?.[0]; if (d) this.lightSpots.push({ x: d.x * TILE + 16, y: d.y * TILE + 24, r: 1.6 }); }
    this.warmLights = this.add.group();
    for (const l of this.lightSpots) this.warmLights.add(this.add.image(l.x, l.y, 'warm').setScale(l.r / 2.5).setDepth(200_001).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0));
    // ground detail (lawn, worn edges, plaza outlines, court markings) and the living bits on top
    this.ambient = new Ambient(this, dressGround(this, this.map));
    this.yetim = new YetimCat(this);

    // player
    const p = this.save.player;
    this.player = fitCharacter(this.physics.add.sprite(p.x * TILE, p.y * TILE, 'player', p.dir * 3));
    footBody(this.player);
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
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.zoomBy(dy > 0 ? 0.9 : 1.1));

    // input
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys({
      up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT', w: 'W', a: 'A', s: 'S', d: 'D', e: 'E', m: 'M', t: 'T', shift: 'SHIFT',
    }) as typeof this.keys;
    kb.on('keydown-E', () => this.interact());
    kb.on('keydown-M', () => { if (!this.hud.modalOpen && !this.panel.isOpen) this.hud.toggleMap(); });
    kb.on('keydown-C', () => { if (!this.menuBlocked()) this.hud.showProfile(this.save.character, this.save.state); });
    kb.on('keydown-J', () => { if (!this.menuBlocked()) this.showMissions(); });
    kb.on('keydown-R', () => { if (!this.menuBlocked()) this.showRelationships(); });
    kb.on('keydown-F', () => { if (!this.menuBlocked()) this.showFriends(); });
    kb.on('keydown-ESC', () => this.hud.toggleMap(false));
    kb.on('keydown-T', () => this.toggleFast());

    // HUD
    this.hud = new Hud(this.map);
    this.hud.onReset = () => { this.persist(); backupSave(); clearSave(); window.location.reload(); };
    this.hud.onProfile = () => { if (!this.menuBlocked()) this.hud.showProfile(this.save.character, this.save.state); };
    void ATTRS; void CAUSES;
    this.hud.onMissions = () => { if (!this.menuBlocked()) this.showMissions(); };
    this.hud.onRelationships = () => { if (!this.menuBlocked()) this.showRelationships(); };
    this.hud.onFriends = () => { if (!this.menuBlocked()) this.showFriends(); };
    this.panel = new Panel(this.hud.host, (open) => { this.player.setVelocity(0, 0); if (!open) this.checkMissions(); });
    this.panel.onRefuse = (why) => this.hud.toast(why);
    this.panel.onAction = (title, a) => this.logAction(title, a);
    this.panel.onActionStart = (a) => { this.actionStamp = this.stamp(); this.actionLabel = a.label; };
    this.panel.onActionEnd = () => { this.actionLabel = ''; };
    this.groupId = myGroup(this.save.state);
    this.panel.onRoomChange = (roomId) => {
      const room = LOCATIONS.find((l) => l.id === roomId && l.kind === 'room');
      if (room) this.discover(room);
    };
    this.hud.setName(`${this.save.character.first} ${this.save.character.last}`);
    // phones and tablets: a joystick and buttons stand in for the keyboard
    onTouchMode(() => {
      if (this.touch) return;
      const tc = new TouchControls(this.hud.host);
      tc.onAct = () => this.interact();
      tc.onMap = () => { if (!this.hud.modalOpen && !this.panel.isOpen) this.hud.toggleMap(); };
      tc.onFast = () => { if (!this.blocked()) this.toggleFast(); };
      tc.onChat = () => { if (this.mp && !this.chatBlocked()) { this.player.setVelocity(0, 0); this.hud.openChat(); } };
      tc.onPinch = (f) => this.zoomBy(f);
      if (this.mp) tc.enableChat();
      this.touch = tc;
    });
    this.hud.onPromptTap = () => this.interact();
    onLangChange(() => this.refreshTexts());
    this.refreshTexts();

    if (!this.inside) this.revealAround(true);
    if (!this.discovered.has('ana_kapi')) this.discover(LOCATIONS.find((l) => l.id === 'ana_kapi')!, true);
    this.checkMissions();
    this.updateTracker();
    this.updateMaps();
    if (this.net) void this.goOnline();
    try { localStorage.removeItem('dacka.view'); } catch { /* private mode */ }
    // switching to another tab or app pauses the game quietly; it picks up again when you're back
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.goAway();
      else this.comeBack();
    });
    // any key, click, touch or mouse move counts as being here; the key that wakes the game up goes no further
    const active = (e: Event) => {
      this.lastActive = performance.now();
      if (!this.away || document.visibilityState === 'hidden') return;
      if (e.type === 'keydown') { e.preventDefault(); e.stopImmediatePropagation(); }
      this.comeBack();
    };
    for (const ev of ['keydown', 'pointerdown', 'pointermove', 'wheel', 'touchstart']) window.addEventListener(ev, active, { capture: true, passive: ev !== 'keydown' });
    this.events.once('shutdown', () => { for (const ev of ['keydown', 'pointerdown', 'pointermove', 'wheel', 'touchstart']) window.removeEventListener(ev, active, { capture: true }); });
  }

  /** zooms the campus view (mouse wheel, or pinch on a touch screen); rooms stay at 100% */
  private zoomBy(factor: number) {
    if (this.blocked() || this.room) return;
    const cam = this.cameras.main;
    cam.setZoom(Phaser.Math.Clamp(cam.zoom * factor, 1, 2.5));
    this.outdoorZoom = cam.zoom;
  }

  /** T: speeds the clock up (offline only) */
  private toggleFast() {
    if (this.synced()) { this.fast = false; this.hud.toast(L({ tr: 'Çevrimiçiyken kampüs saati herkes için aynı; hızlandırılamaz.', en: "Online, the campus clock is the same for everyone, so it can't be sped up." })); return; }
    this.fast = !this.fast;
    this.hud.toast(this.fast ? t('fast_on') : t('fast_off'));
  }

  // ---------- away (another tab, or AFK) ----------

  /** sleeping, the weekend at home, a match or being marched to the dorm: you're meant to sit back, so it isn't AFK */
  private afkExempt() { return this.sleepRun !== null || this.watching || this.escort !== null; }

  /** the tab went to the background, or you did nothing for AFK_MS: everything stops, the clock too (online, others see you as away) */
  private goAway() {
    if (this.away) return;
    this.away = true;
    this.player.setVelocity(0, 0);
    this.persist();
    flushCloudSave(); // the tab may be closing: don't leave the last save waiting on a timer
    this.mp?.status(true);
    this.scene.pause();
    sfx.pauseMusic();
  }

  /** back on the tab, or moving again: carry on where you were; online, after AFK_MS without you, you start again at the main gate */
  private comeBack() {
    if (!this.away || document.visibilityState === 'hidden') return;
    this.away = false;
    const afk = this.net !== null && performance.now() - this.lastActive >= AFK_MS && !this.afkExempt();
    this.lastActive = performance.now();
    // keys held when you left would otherwise still count as held
    this.input.keyboard?.resetKeys();
    this.scene.resume();
    sfx.music();
    this.mp?.status(false);
    // online: straight to the campus time, like coming back to the game, with nothing played through
    if (this.synced() && this.worldOffset !== null) this.jumpToWorld(false, afk);
    this.minuteAcc = 0;
    if (afk) this.restartAfterAfk();
  }

  /** online, after being AFK: whatever you had open closes and you start again just inside the main gate, or,
   *  if it's sleep time (lights out to wake-up), in your dorm room by your bed */
  private restartAfterAfk() {
    if (this.panel.isOpen && !this.panel.working) this.panel.close();
    if (this.hud.bigOpen) this.hud.toggleMap(false);
    if (this.hud.chatOpen) this.hud.closeChat();
    this.setTunnel(false);
    this.lastTile = { x: -1, y: -1 };
    if (phaseOf(this.save.clock.minutes, this.save.clock.day) === 'night') {
      this.placeInDorm();
      this.cameras.main.fadeIn(400, 8, 14, 24);
      this.persist();
      this.hud.toast(L({ tr: '💤 Bir süredir yoktun; uyku saati, yatakhanendesin.', en: "💤 You were away for a while. It's bedtime, so you're in your dorm room." }));
      return;
    }
    this.room = null;
    this.tray = null; this.trayAt = null;
    this.player.setPosition(SPAWN.x * TILE, SPAWN.y * TILE).setVelocity(0, 0);
    this.dir = 3;
    this.setCameraArea();
    this.cameras.main.fadeIn(400, 8, 14, 24);
    this.revealAround(true);
    this.persist();
    this.hud.toast(L({ tr: '💤 Bir süredir yoktun; Ana Kapı\'dan devam ediyorsun.', en: "💤 You were away for a while, so you're back at the main gate." }));
  }

  // ---------- online: other real players ----------

  /** someone came, went or moved: keep your bed and desks, or move to free ones if someone who came first holds them */
  private settleSpots() {
    if (!this.mp || !this.net) return;
    const ch = this.save.character;
    const others = [...this.mp.peers.values()].map((p) => ({ id: String(p.id), since: typeof p.since === 'number' ? p.since : 0, gender: String(p.gender), spots: readSpots(p.spots) }));
    const next = settle({ id: this.net.id, since: this.onlineSince, gender: ch.gender, spots: this.spots }, others, { roommates: this.roomMates.length, classmates: this.classDeskOf.size });
    // (yours count too: a roommate never ends up in the bed you're in)
    const dorm = [...others.filter((o) => o.gender === ch.gender).map((o) => o.spots), next];
    this.held = {
      bed: new Set(dorm.map((x) => spotKey(x.bed))),
      desk: new Set(dorm.map((x) => spotKey(x.desk))),
      seat: new Set([...others.map((o) => o.spots), next].map((x) => spotKey(x.seat))),
    };
    if (spotKey(next.bed) !== spotKey(this.spots.bed) || spotKey(next.desk) !== spotKey(this.spots.desk) || spotKey(next.seat) !== spotKey(this.spots.seat)) {
      this.setSpots(next);
      this.mp.setSpots(next);
    }
  }

  /** your bed and desks are these now: the name tags move with them (you stay where you are until you next go to bed or sit down) */
  private setSpots(s: Spots) {
    this.spots = s;
    if (this.net) storeSpots(this.net.id, s);
    this.spotTags.bed?.setPosition((ROOM_OX + s.bed[0] + 0.5) * TILE, (s.bed[1] + 0.1) * TILE);
    this.spotTags.desk?.setPosition((ROOM_OX + s.desk[0] + 0.5) * TILE, (s.desk[1] + 0.1) * TILE);
    this.spotTags.seat?.setPosition((CLASS_OX + s.seat[0] + 0.5) * TILE, (s.seat[1] + 0.1) * TILE);
  }

  private roomKey(): string {
    if (this.sleepRun?.kind === 'home') return 'away';
    if (this.inTunnel && !this.room) return 'tunnel';
    return this.room === 'dorm' ? `dorm-${this.save.character.gender}` : this.room ?? 'campus';
  }

  /** a real player left (their goodbye, or presence noticing): if you can see them, they walk off first */
  private peerGone(id: string, byBye: boolean) {
    this.peerPlay?.peerLeft(id);
    const peer = this.peers.get(id);
    if (!peer) return;
    if (!peer.leaving) this.hud.toast(L({ tr: `${peer.profile.name} oyundan çıktı`, en: `${peer.profile.name} left` }));
    this.friendsUi?.render();
    if (peer.sprite.visible && peer.seen && peer.room === this.roomKey()) { startLeaving(peer, performance.now(), byBye); return; }
    peer.sprite.destroy(); peer.label.destroy();
    this.peers.delete(id);
    this.friendsUi?.render();
  }

  /** a real player came online (or came back while walking off) */
  private addPeer(p: PeerProfile, quiet = false) {
    const old = this.peers.get(p.id);
    if (old) { cancelLeaving(old); old.away = false; old.profile = p; this.labelPeer(p.id); this.friendsUi?.render(); return; }
    makeCharacterTexture(this, `peer-${p.id}`, { ...DEFAULT_LOOK, ...p.look });
    const sprite = fitCharacter(this.add.sprite(0, 0, `peer-${p.id}`, 0)).setVisible(false);
    const label = this.add.text(0, 0, `● ${p.name}`, {
      fontFamily: '"Pixelify Sans", system-ui, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#a8e6b0', stroke: '#1d2326', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(95_000).setVisible(false);
    this.peers.set(p.id, { sprite, label, profile: p, tx: 0, ty: 0, dir: 0, moving: false, lying: false, room: '', seen: false, lastPos: performance.now(), away: false, leaving: null });
    this.labelPeer(p.id);
    const friend = this.friends.get(p.id)?.status === 'accepted';
    if (!quiet) this.hud.toast(friend ? L({ tr: `⭐ Arkadaşın ${p.name} oyuna katıldı`, en: `⭐ Your friend ${p.name} joined` }) : L({ tr: `🟢 ${p.name} oyuna katıldı`, en: `🟢 ${p.name} joined` }), friend ? 'good' : 'info');
    // someone new may have just become your friend through your invite link
    if (this.friendsReady && !this.friends.has(p.id)) this.refreshFriendsSoon();
    this.friendsUi?.render();
  }

  private async goOnline() {
    const ch = this.save.character;
    this.onlineSince = Date.now();
    this.setSpots(storedSpots(this.net!.id));
    const me: PeerProfile = { id: this.net!.id, name: ch.first, look: ch.look, grade: this.save.state.year + 3, gender: ch.gender, spots: this.spots, since: this.onlineSince };
    this.mp = new Multiplayer(me, {
      onJoin: (p) => this.addPeer(p),
      onSync: () => this.settleSpots(),
      onLeave: (id) => this.peerGone(id, false),
      onBye: (id) => this.peerGone(id, true),
      onStatus: (id, away) => { const peer = this.peers.get(id); if (peer) showAway(peer, away, () => this.labelPeer(id)); },
      onPos: (p: PeerPos) => {
        let peer = this.peers.get(p.id);
        // back after a goodbye that presence never noticed (a quick reload): they're themselves again
        if (!peer && this.mp?.peers.has(p.id)) { this.addPeer(this.mp.peers.get(p.id)!, true); peer = this.peers.get(p.id); }
        if (!peer) return;
        if (peer.leaving) {
          if (!peer.leaving.byBye || performance.now() - peer.leaving.started < 1500) return;
          cancelLeaving(peer); this.labelPeer(p.id);
        }
        peer.lastPos = performance.now();
        if (peer.away) showAway(peer, false, () => this.labelPeer(p.id));
        const moved = peer.room !== p.room; // (into or out of somewhere: no gliding across the map)
        peer.tx = p.x * TILE; peer.ty = p.y * TILE; peer.dir = p.dir; peer.moving = p.moving; peer.lying = p.lying === true; peer.room = p.room;
        if (!peer.seen || moved) { peer.sprite.setPosition(peer.tx, peer.ty); peer.seen = true; }
      },
      onChat: (id, name, text) => { this.hud.addChatLine(name, text); this.bubbleAbove(this.peers.get(id)?.sprite, text); },
      onEmote: (id, e) => this.bubbleAbove(this.peers.get(id)?.sprite, e),
      onFriend: (from, kind) => void this.onFriendNudge(from, kind),
      onPeer: (from, msg) => void this.peerPlay?.onMessage(from, msg),
    });
    const ok = await this.mp.connect();
    if (!ok) { this.hud.toast(L({ tr: 'Çevrimiçi bağlantı kurulamadı; tek başına oynuyorsun.', en: "Couldn't connect online; you're playing solo." })); this.mp = null; return; }
    this.hud.enableChat();
    this.touch?.enableChat();
    this.hud.onChatSend = (text) => { this.mp?.chat(text); this.hud.addChatLine(ch.first, text, true); this.bubbleAbove(this.player, text); };
    this.peerPlay = new PeerPlay({
      me: () => ({ id: me.id, name: ch.first }),
      send: (to, msg) => this.mp?.toPeer(to, msg),
      ctx: () => this.gameCtx(),
      name: (id) => this.peers.get(id)?.profile.name,
      bubble: (id, text) => this.bubbleAbove(id === 'me' ? this.player : this.peers.get(id)?.sprite, text),
      busy: () => this.blocked() || this.sleeping,
      // a game screen holds you still (like the match screen); online, your clock catches up afterwards
      setPlaying: (on) => { this.watching = on; this.player.setVelocity(0, 0); if (!on) this.refreshClockAndNeeds(); },
      openChat: () => { this.player.setVelocity(0, 0); this.hud.openChat(); },
      uiHost: document.body,
    });
    this.peerPlay.emote = (e) => { this.mp?.emote(e); this.bubbleAbove(this.player, e); };
    this.input.keyboard!.on('keydown-ENTER', (e: KeyboardEvent) => {
      if (this.chatBlocked()) return;
      // the chat box takes focus during this key press: without this the same Enter would "send" the empty box and close it again
      e.preventDefault();
      this.player.setVelocity(0, 0);
      this.hud.openChat();
    });
    this.hud.toast(isTouch()
      ? L({ tr: '🟢 Çevrimiçisin. 💬 ile sohbet et.', en: "🟢 You're online. Tap 💬 to chat." })
      : L({ tr: '🟢 Çevrimiçisin. Enter ile sohbet et.', en: "🟢 You're online. Press Enter to chat." }), 'good');
    void this.startFriends();
  }

  // ---------- online: friends (real players) ----------

  private async startFriends() {
    await setMyName(this.save.character.first).catch(() => undefined);
    await this.refreshFriends();
    if (!this.friendsReady) return; // friends aren't set up in the database yet: the rest of online play still works
    const waiting = [...this.friends.values()].filter((f) => f.status === 'pending' && f.incoming).length;
    if (waiting) this.hud.toast(L({ tr: `🤝 ${waiting} arkadaşlık isteğin var. F ile bak.`, en: `🤝 You have ${waiting} friend request${waiting > 1 ? 's' : ''}. Press F to see.` }), 'good');
  }

  /** reloads your friends list; returns what it was before (null if it couldn't load) */
  private async refreshFriends(): Promise<Map<string, Friend> | null> {
    const list = await listFriends();
    if (!list) return null;
    const before = this.friends;
    this.friends = new Map(list.map((f) => [f.id, f]));
    if (!this.friendsReady) { this.friendsReady = true; this.hud.enableFriends(); }
    this.hud.setFriendRequests(list.filter((f) => f.status === 'pending' && f.incoming).length);
    for (const id of this.peers.keys()) this.labelPeer(id);
    this.friendsUi?.render();
    this.panel.refresh();
    return before;
  }

  private refreshFriendsSoon() {
    if (this.friendsTimer !== null) return;
    this.friendsTimer = window.setTimeout(() => { this.friendsTimer = null; void this.refreshFriends(); }, 1500);
  }

  /** another player says they sent you a request or answered yours; the database has the real answer */
  private async onFriendNudge(from: string, kind: FriendNudge) {
    const before = await this.refreshFriends();
    if (!before) return;
    const f = this.friends.get(from);
    const was = before.get(from);
    if (kind === 'request' && f?.status === 'pending' && f.incoming && !was) {
      this.hud.toast(L({ tr: `🤝 ${friendName(f)} seninle arkadaş olmak istiyor. F ile cevap ver.`, en: `🤝 ${friendName(f)} wants to be your friend. Press F to answer.` }), 'good');
    } else if (kind === 'accepted' && f?.status === 'accepted' && was?.status !== 'accepted') {
      this.hud.toast(L({ tr: `⭐ ${friendName(f)} ile artık arkadaşsınız!`, en: `⭐ You and ${friendName(f)} are friends now!` }), 'good');
    }
  }

  /** friends get a gold star over their head; everyone else a green dot */
  private labelPeer(id: string) {
    const peer = this.peers.get(id);
    if (!peer || peer.leaving) return;
    const friend = this.friends.get(id)?.status === 'accepted';
    if (peer.away) { peer.label.setText(`💤 ${peer.profile.name}`); return; }
    peer.label.setText(`${friend ? '★' : '●'} ${peer.profile.name}`).setColor(friend ? '#ffe08a' : '#a8e6b0');
  }

  /** the friend button in a real player's panel: add, accept, or already friends */
  private friendAction(peer: { profile: PeerProfile }): ActionView | null {
    if (!this.friendsReady) return null;
    const id = peer.profile.id;
    const name = peer.profile.name;
    const f = this.friends.get(id);
    if (f?.status === 'accepted') return { id: 'friend', label: L({ tr: '⭐ Arkadaşsınız', en: '⭐ Friends' }), locked: L({ tr: 'Arkadaş listende (F)', en: 'In your friends list (F)' }), run: () => {} };
    if (f && !f.incoming) return { id: 'friend', label: L({ tr: '➕ Arkadaş ekle', en: '➕ Add friend' }), locked: L({ tr: 'İstek gönderildi, cevap bekleniyor', en: 'Request sent, waiting for an answer' }), run: () => {} };
    if (f) return { id: 'friend', label: L({ tr: '🤝 Arkadaşlık isteğini kabul et', en: '🤝 Accept friend request' }), hint: L({ tr: `${name} seni eklemek istedi`, en: `${name} asked to add you` }), run: () => this.acceptFriend(f) };
    return {
      id: 'friend', label: L({ tr: '➕ Arkadaş ekle', en: '➕ Add friend' }), hint: L({ tr: 'Kabul ederse arkadaş listene girer', en: 'If they accept, they join your friends list' }),
      run: async () => {
        const r = await requestFriend(id);
        if (r === 'requested') { this.mp?.nudgeFriend(id, 'request'); this.hud.toast(L({ tr: `${name} kişisine arkadaşlık isteği gönderildi`, en: `Friend request sent to ${name}` }), 'good'); }
        else if (r === 'accepted') { this.mp?.nudgeFriend(id, 'accepted'); this.hud.toast(L({ tr: `⭐ ${name} ile artık arkadaşsınız!`, en: `⭐ You and ${name} are friends now!` }), 'good'); }
        else if (r === 'limit') this.hud.toast(L({ tr: 'Çok fazla bekleyen isteğin var. Önce cevap gelsin.', en: 'You have too many requests waiting. Wait for some answers first.' }));
        else if (r === 'error') this.hud.toast(L({ tr: 'İstek gönderilemedi. Biraz sonra tekrar dene.', en: "Couldn't send the request. Try again in a bit." }));
        await this.refreshFriends();
      },
    };
  }

  private async acceptFriend(f: Friend) {
    if (!(await respondFriend(f.id, true))) { this.hud.toast(L({ tr: 'Olmadı. Biraz sonra tekrar dene.', en: "That didn't work. Try again in a bit." })); return; }
    this.mp?.nudgeFriend(f.id, 'accepted');
    this.hud.toast(L({ tr: `⭐ ${friendName(f)} ile artık arkadaşsınız!`, en: `⭐ You and ${friendName(f)} are friends now!` }), 'good');
    await this.refreshFriends();
  }

  private showFriends() {
    if (!this.net) { this.hud.toast(L({ tr: 'Gerçek arkadaşlarla oynamak için ana ekranda e-postanla giriş yap.', en: 'Sign in with your email on the title screen to play with real friends.' })); return; }
    if (!this.mp || !this.friendsReady) { this.hud.toast(L({ tr: 'Arkadaş listesi şu an açılamıyor.', en: "Your friends list isn't available right now." })); return; }
    this.player.setVelocity(0, 0);
    const ui = friendsCard({
      friends: () => (this.friendsReady ? [...this.friends.values()] : null),
      whereIs: (id) => { const p = this.peers.get(id); return p && !p.leaving ? p.room : undefined; },
      inviteCode: (reset) => myInviteCode(reset),
      accept: (f) => this.acceptFriend(f),
      decline: async (f) => { await respondFriend(f.id, false); await this.refreshFriends(); },
      remove: async (f) => {
        const mine = f.status === 'pending';
        const ok = await askConfirm(
          mine ? L({ tr: `${friendName(f)} kişisine gönderdiğin isteği geri al?`, en: `Take back your request to ${friendName(f)}?` })
            : L({ tr: `${friendName(f)} arkadaş listenden çıkarılsın mı?`, en: `Remove ${friendName(f)} from your friends?` }),
          mine ? L({ tr: 'Geri al', en: 'Take back' }) : L({ tr: 'Çıkar', en: 'Remove' }), L({ tr: 'Vazgeç', en: 'Cancel' }));
        if (!ok) return;
        if (await removeFriend(f.id)) this.mp?.nudgeFriend(f.id, 'removed');
        await this.refreshFriends();
      },
    });
    this.friendsUi = ui;
    this.hud.openCard(ui.el, ['Escape', 'f', 'F'], () => { this.friendsUi = null; });
    void this.refreshFriends();
  }

  private updatePeers(time: number) {
    if (!this.mp) return;
    const moving = (this.player.body?.velocity.length() ?? 0) > 1;
    this.mp.sendPos({ x: this.player.x / TILE, y: this.player.y / TILE, dir: this.dir, moving, room: this.roomKey(), lying: this.player.getData('inBed') === true }, time);
    const here = this.roomKey();
    const now = performance.now();
    for (const [id, peer] of this.peers) {
      if (peer.leaving) {
        if (stepLeaving(peer, now, this.game.loop.delta, time)) { peer.sprite.destroy(); peer.label.destroy(); this.peers.delete(id); this.friendsUi?.render(); }
        continue;
      }
      // nothing from them for a while: paused, or the connection is going
      if (!peer.away && now - peer.lastPos > QUIET_MS) showAway(peer, true, () => this.labelPeer(id));
      const show = peer.seen && peer.room === here;
      peer.sprite.setVisible(show);
      peer.label.setVisible(show);
      if (!show) continue;
      // smooth towards the last reported position
      peer.sprite.x += (peer.tx - peer.sprite.x) * 0.2;
      peer.sprite.y += (peer.ty - peer.sprite.y) * 0.2;
      // asleep: in bed like you and your roommates, head on the pillow (drawn over the bed, as they are)
      if (peer.lying) {
        if (!peer.sprite.getData('inBed')) tuckIn(peer.sprite, peer.sprite.x, peer.sprite.y);
        peer.sprite.setDepth(peer.sprite.y + 16);
        peer.label.setPosition(peer.sprite.x, peer.sprite.y - 20);
        continue;
      }
      getUp(peer.sprite);
      const step = peer.moving ? [1, 0, 2, 0][Math.floor(time / 130) % 4] : 0;
      peer.sprite.setFrame(peer.dir * 3 + step).setDepth(peer.sprite.y + 16);
      peer.label.setPosition(peer.sprite.x, peer.sprite.y - 24);
    }
  }

  private nearPeer(leaving = false) {
    for (const peer of this.peers.values()) {
      if (!!peer.leaving !== leaving) continue;
      if (peer.sprite.visible && Phaser.Math.Distance.Between(peer.sprite.x, peer.sprite.y, this.player.x, this.player.y) < TALK_RANGE) return peer;
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
    const roomData = buildRoom();
    const roomMap = this.make.tilemap({ data: roomData, tileWidth: TILE, tileHeight: TILE });
    const ts = roomMap.addTilesetImage(TILESET_KEY, TILESET_KEY, TILE, TILE, TILESET_MARGIN, TILESET_SPACING)!;
    const layer = roomMap.createLayer(0, ts, ROOM_OX * TILE, 0)!;
    layer.setCollision(ROOM_SOLID as unknown as number[]);
    // what you see is the smooth baked room; the tile layer stays for collisions
    layer.setVisible(false);
    this.add.image(ROOM_OX * TILE, 0, bakeRoom(this, 'room-dorm', roomData)).setOrigin(0).setScale(1 / ART_RES).setDepth(0.01);
    this.physics.add.collider(this.player, layer);
    void tileset;
    // your desk and bed get a little name tag
    const tag = (x: number, y: number, text: string) => { const t = this.add.text((ROOM_OX + x + 0.5) * TILE, (y + 0.1) * TILE, text, {
      fontFamily: 'system-ui, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#ffe7a8', stroke: '#1d2326', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(95_000); this.roomLabels.push(t); return t; };
    this.spotTags.desk = tag(this.spots.desk[0], this.spots.desk[1], L({ tr: 'Senin masan', en: 'Your desk' }));
    this.spotTags.bed = tag(this.spots.bed[0], this.spots.bed[1], L({ tr: 'Yatağın', en: 'Your bed' }));
    tag(MY_LOCKER[0], MY_LOCKER[1], L({ tr: 'Dolabın', en: 'Your locker' }));
    // your room is your year's: the classmates from your dorm sit at the other desks
    const sameDorm = NPCS.filter((n) => n.kind === 'classmate' && n.gender === this.save.character.gender);
    // (round the study tables, nearest yours first: the near side faces the table from below, the far side from above)
    DORM_SEATS.forEach((seat, i) => {
      const def = sameDorm[i % sameDorm.length];
      if (!def || i >= sameDorm.length) return;
      const sy = seat.face === 'up' ? seat.y + 0.35 : seat.y + 0.8;
      const sp = fitCharacter(this.physics.add.sprite((ROOM_OX + seat.x + 0.5) * TILE, sy * TILE, `npc-${def.id}`, seat.face === 'up' ? 9 : 0)).setDepth(seat.face === 'up' ? (seat.y + 1) * TILE + 16 : seat.y * TILE + 8);
      sp.setData('face', seat.face);
      if (seat.face === 'down') sp.setCrop(0, 0, sp.frame.realWidth, sp.frame.realHeight * DESK_CROP); // (legs behind the table)
      footBody(sp);
      sp.setImmovable(true);
      sp.setData('def', def).setData('slot', this.roomMates.length).setData('chair', spotKey([seat.x, seat.y - 1]));
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
    fitCharacter(this.cemilOut.setTexture('cemil', 0), 1.12).setDepth(CEMIL_OUT[1] * TILE + 16);
    this.cemilOut.refreshBody();
    (this.cemilOut.body as Phaser.Physics.Arcade.StaticBody).setSize(16, 10).setOffset(10, 24);
    this.cemilIn = fitCharacter(this.add.sprite((ROOM_OX + CEMIL_IN[0]) * TILE, CEMIL_IN[1] * TILE, 'cemil', 1), 1.12).setDepth(CEMIL_IN[1] * TILE + 16).setVisible(false);
    const belDef = BELLETMENS.find((b) => b.id === (this.save.character.gender === 'girl' ? 'bel-hatice' : 'bel-mehmet'))!;
    this.roomBelletmen = fitCharacter(this.physics.add.sprite((ROOM_OX + BELLETMEN_ROUTE[0][0]) * TILE, BELLETMEN_ROUTE[0][1] * TILE, `npc-${belDef.id}`, 0));
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
    const diningData = buildDining();
    const map = this.make.tilemap({ data: diningData, tileWidth: TILE, tileHeight: TILE });
    const ts = map.addTilesetImage(TILESET_KEY, TILESET_KEY, TILE, TILE, TILESET_MARGIN, TILESET_SPACING)!;
    const layer = map.createLayer(0, ts, DINING_OX * TILE, 0)!;
    layer.setCollision([...ROOM_SOLID, ...DINING_SOLID] as unknown as number[]);
    layer.setVisible(false);
    this.add.image(DINING_OX * TILE, 0, bakeRoom(this, 'room-dining', diningData)).setOrigin(0).setScale(1 / ART_RES).setDepth(0.01);
    this.physics.add.collider(this.player, layer);
    // a pool of diners: whoever the routine says is eating right now takes a seat
    for (let i = 0; i < NPCS.length; i++) {
      const sp = fitCharacter(this.physics.add.sprite(0, 0, `npc-${NPCS[i % NPCS.length].id}`, 0)).setVisible(false);
      footBody(sp);
      sp.setImmovable(true);
      sp.body!.enable = false;
      this.physics.add.collider(this.player, sp);
      // a name tag over each diner, so you can see who's at which table before you sit down
      sp.setData('label', this.add.text(0, 0, '', {
        fontFamily: '"Pixelify Sans", system-ui, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#ffffff', stroke: '#1d2326', strokeThickness: 3,
      }).setOrigin(0.5, 1).setDepth(95_000).setVisible(false));
      // their tray on the table in front of them, and the spoon going between it and their mouth
      sp.setData('tray', this.add.image(0, 0, 'tray').setVisible(false));
      sp.setData('spoon', this.add.image(0, 0, 'spoon').setOrigin(0.5, 0.18).setScale(0.5).setVisible(false));
      this.diners.push(sp);
    }
    const cookLook = { skin: '#d9a77d', hair: '#f4f4f0', hairStyle: 1 as const, top: '#f4f4f0', bottom: '#8b9196', skirt: false };
    makeCharacterTexture(this, 'cook', { ...DEFAULT_LOOK, ...cookLook });
    for (const [x, y] of COOKS) this.cooks.push(fitCharacter(this.add.sprite((DINING_OX + x + 0.5) * TILE, y * TILE, 'cook', 0)).setDepth(y * TILE + 16));
    this.trayImg = this.add.image(0, 0, 'tray').setVisible(false);
    this.spoonImg = this.add.image(0, 0, 'spoon').setOrigin(0.5, 0.18).setScale(0.5).setVisible(false);
  }

  /** the meal is over (or you got up): out of your chair and back on your feet beside the table */
  private standUpFromTable() {
    const chair = this.player.getData('chair') as { x: number; y: number } | null;
    this.player.setData('chair', null);
    sitAtTable(this.player, false);
    if (this.room === 'dining' && chair) this.player.setPosition(chair.x, chair.y);
    this.player.body!.enable = true;
  }

  /** a spoonful every couple of seconds: up from the tray to the mouth, a moment there while they chew, back down for
   *  more. faces 0 = facing you (the table is below them, the spoon in front of their face); 3 = their back to you
   *  (the table is above them: the spoon mostly disappears behind their head). `at` = where their tray sits. */
  private spoonful(sp: Phaser.GameObjects.Sprite, spoon: Phaser.GameObjects.Image, at: { x: number; y: number }, front: boolean, time: number, offset: number) {
    const p = ((time + offset) % EAT_MS) / EAT_MS;
    const ease = (t: number) => t * t * (3 - 2 * t);
    // up 0–0.3, at the mouth 0.3–0.55, down 0.55–0.8, scooping 0.8–1
    const k = p < 0.3 ? ease(p / 0.3) : p < 0.55 ? 1 : p < 0.8 ? 1 - ease((p - 0.55) / 0.25) : 0;
    const scoop = p >= 0.8 ? Math.sin(((p - 0.8) / 0.2) * Math.PI) : 0; // (a little dip into the plate)
    const fx = at.x + 3, fy = at.y + (front ? -2 : 1) + scoop;
    const tx = sp.x + (front ? 1 : 3), ty = sp.y + (front ? -5 : -9);
    spoon.setPosition(fx + (tx - fx) * k, fy + (ty - fy) * k).setAngle(front ? 55 * (1 - k) : -40 * (1 - k))
      .setDepth(front ? Math.max(sp.depth, at.y + 20) + 1 : sp.depth - 0.5).setVisible(true); // (over the tray, then in front of the face)
  }

  /** devrecilik at meals: you sit with your own year. Next to someone from your devre if there's room at their table,
   *  otherwise at an empty table (the devre spills over to the next one), and only when the hall is full anywhere at all */
  private devreSeat(def: NpcDef, free: Array<(typeof SEATS)[number]>): (typeof SEATS)[number] | undefined {
    if (!free.length) return undefined;
    const table = (s: { x: number; y: number; faces: 0 | 3 }) => TABLES.findIndex(([tx, ty, len]) => s.x >= tx && s.x < tx + len && s.y === ty + (s.faces === 0 ? -1 : 1));
    const g = def.grade ?? 4;
    const seated = this.diners.filter((d) => d.visible && d.getData('def')).map((d) => ({ g: (d.getData('def') as NpcDef).grade ?? 4, seat: d.getData('seat') as (typeof SEATS)[number] }));
    const mates = seated.filter((o) => o.g === g);
    const others = new Set(seated.filter((o) => o.g !== g).map((o) => table(o.seat)));
    // 1) beside the nearest devre-mate, at their table
    const mateTables = new Set(mates.map((o) => table(o.seat)));
    const byMates = free.filter((s) => mateTables.has(table(s)));
    if (byMates.length) {
      const gap = (s: { x: number; y: number }) => Math.min(...mates.map((o) => Math.abs(o.seat.x - s.x) + Math.abs(o.seat.y - s.y) * 0.6));
      return byMates.reduce((a, b) => (gap(b) < gap(a) ? b : a));
    }
    // 2) a table nobody else is at, starting at its end
    const empty = free.filter((s) => !others.has(table(s)) && !mateTables.has(table(s)));
    if (empty.length) {
      const t = table(empty[Math.floor(Math.random() * empty.length)]);
      return empty.filter((s) => table(s) === t).reduce((a, b) => (b.x < a.x || (b.x === a.x && b.faces < a.faces) ? b : a));
    }
    // 3) no empty table left: share one, as far from the other devres as you can get (the far end of the table), so your devre can sit round you
    const far = (s: { x: number; y: number }) => Math.min(99, ...seated.filter((o) => o.g !== g).map((o) => Math.abs(o.seat.x - s.x) + Math.abs(o.seat.y - s.y) * 3));
    return free.reduce((a, b) => (far(b) > far(a) ? b : a));
  }

  /** seats whoever is in the dining hall right now: people arrive and leave through the meal */
  private seatDiners() {
    const here = NPCS.filter((n) => this.whereIs(n) === 'yemekhane');
    const key = here.map((n) => n.id).join(',');
    if (key === this.dinerKey) return;
    this.dinerKey = key;
    const ids = new Set(here.map((n) => n.id));
    this.noteMealMates(); // (before anyone gets up from your table)
    const meal = this.mealMates;
    // those who have finished get up, except whoever is beside you or across from you: they wait until you've finished too
    for (const d of this.diners) {
      const def = d.getData('def') as NpcDef | null;
      if (d.visible && !(def && ids.has(def.id)) && !(meal && def && meal.met.has(def.id) && meal.near(d))) { d.setVisible(false); d.body!.enable = false; d.setData('def', null).setData('seat', null); }
    }
    const seated = new Set(this.diners.filter((d) => d.visible).map((d) => (d.getData('def') as NpcDef).id));
    const taken = new Set(this.diners.filter((d) => d.visible).map((d) => d.getData('seat')));
    // nobody sits down on top of you
    const px = this.player.x / TILE - DINING_OX, py = this.player.y / TILE;
    const free = SEATS.filter((s) => !taken.has(s) && !(this.room === 'dining' && Math.hypot(px - (s.x + 0.5), py - (s.y + 0.35)) < 0.8)).sort(() => Math.random() - 0.5);
    // (sit down devre by devre, the biggest first, so a devre that arrives all at once takes a table together)
    const count = new Map<number, number>();
    for (const n of here) count.set(n.grade ?? 4, (count.get(n.grade ?? 4) ?? 0) + 1);
    const order = [...here].sort((a, b) => count.get(b.grade ?? 4)! - count.get(a.grade ?? 4)! || (a.grade ?? 4) - (b.grade ?? 4));
    for (const def of order) {
      if (seated.has(def.id)) continue;
      const sp = this.diners.find((d) => !d.visible), seat = this.devreSeat(def, free);
      if (!sp || !seat) break;
      free.splice(free.indexOf(seat), 1);
      sp.setTexture(`npc-${def.id}`, seat.faces * 3).setPosition((DINING_OX + seat.x + 0.5) * TILE, seatedY(seat) * TILE)
        .setDepth((seat.y + 0.4) * TILE + 16).setVisible(true);
      sitAtTable(sp, seat.faces === 0);
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
    // (the first time: how the tables work)
    if (m && !this.save.state.once.devreTip) {
      this.save.state.once.devreTip = true;
      const g = grade(this.save.state.year);
      this.hud.toast(L({ tr: `🍽 Devrecilik: yemekhanede herkes kendi devresiyle oturur. Senin devren ${g}. sınıflar; abiler ve ablalar kendi masalarında.`, en: `🍽 Devrecilik: in the dining hall everyone sits with their own year, their "devre". Yours is grade ${g}; the older students have their own tables.` }));
    }
    this.persist();
  }

  private updateDining(time: number) {
    if (this.mealMates && this.sleepRun?.kind !== 'eat') this.endMealHold(); // (you got up before finishing)
    this.seatDiners();
    const serving = !!currentMeal(this.gameCtx());
    for (const d of this.diners) {
      const label = d.getData('label') as Phaser.GameObjects.Text;
      const def = d.getData('def') as NpcDef | null;
      label.setVisible(this.room === 'dining' && d.visible && !!def);
      if (!d.visible || !def) {
        (d.getData('tray') as Phaser.GameObjects.Image).setVisible(false);
        (d.getData('spoon') as Phaser.GameObjects.Image).setVisible(false);
        continue;
      }
      const seat = d.getData('seat') as { x: number; y: number; faces: 0 | 3 };
      d.setFrame(seat.faces * 3);
      // eating: their tray on the table, a spoonful now and then (each at their own pace)
      const front = seat.faces === 0;
      const at = trayOn(seat);
      (d.getData('tray') as Phaser.GameObjects.Image).setPosition(at.x, at.y).setDepth(at.y + 20).setVisible(this.room === 'dining');
      this.spoonful(d, d.getData('spoon') as Phaser.GameObjects.Image, at, front, time, (d.x * 37 + d.y * 11) % EAT_MS);
      // friends in gold with a heart, classmates with a star; neighbours' tags sit at two heights so they don't overlap
      const friend = this.isFriend(def);
      const text = `${friend ? '💛 ' : ''}${def.kind === 'classmate' && this.save.state.once.classDrawn ? '★ ' : ''}${def.name}`;
      if (label.text !== text) label.setText(text).setColor(friend ? '#ffe27a' : def.kind === 'abi' ? '#ffe7a8' : '#ffffff');
      label.setPosition(d.x, d.y - 14 - (seat.x % 2 ? 11 : 0));
    }
    const snack = isSnackTime(this.save.clock.minutes);
    this.cooks.forEach((c, i) => c.setVisible(serving || snack).setFrame(Math.floor(time / 900 + i) % 5 === 0 ? 1 : 0));
    // carry your tray
    this.trayImg.setVisible(this.room === 'dining' && (!!this.tray || !!this.trayAt));
    if (this.tray) this.trayImg.setPosition(this.player.x, this.player.y + 4).setDepth(this.player.y + 18);
    else if (this.trayAt) this.trayImg.setPosition(this.trayAt.x, this.trayAt.y).setDepth(this.trayAt.y + 20);
    // and eat from it, like everyone else
    const eating = this.room === 'dining' && !!this.trayAt && this.sleepRun?.kind === 'eat';
    if (eating) this.spoonful(this.player, this.spoonImg, this.trayAt!, this.dir === 0, time, 0);
    else this.spoonImg.setVisible(false);
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
    // sit down at the table (your feet off the floor grid for the meal: you get up from your chair afterwards)
    this.player.setVelocity(0, 0);
    this.player.body!.enable = false;
    this.player.setPosition((DINING_OX + seat.x + 0.5) * TILE, seatedY(seat) * TILE);
    this.player.anims.stop();
    this.dir = seat.faces;
    this.player.setFrame(seat.faces * 3);
    sitAtTable(this.player, seat.faces === 0);
    this.player.setData('chair', { x: (DINING_OX + seat.x + 0.5) * TILE, y: (seat.y + 0.35) * TILE });
    // whoever sits beside you or across from you at the same table when you finish is who you ate with
    type Seat = { x: number; y: number; faces: 0 | 3 };
    const tableOf = (s: Seat) => s.y + (s.faces === 0 ? 1 : -1);
    const near = (s: Seat) => tableOf(s) === tableOf(seat) && (s.faces === seat.faces ? Math.abs(s.x - seat.x) === 1 : Math.abs(s.x - seat.x) <= 1);
    const seated = () => this.diners.filter((d) => d.visible && d.getData('def'));
    const meal = { near: (d: Phaser.GameObjects.Sprite) => near(d.getData('seat') as Seat), met: new Map<string, NpcDef>() };
    // (at the end your meal is already over, so the last look round is done here)
    const tablemates = () => {
      for (const d of seated()) if (meal.near(d)) meal.met.set((d.getData('def') as NpcDef).id, d.getData('def') as NpcDef);
      if (this.mealMates === meal) this.endMealHold();
      return [...meal.met.values()].slice(0, 4);
    };
    // friends of yours eating somewhere else in the hall (and who never sat with you)
    const elsewhere = () => seated().filter((d) => !meal.met.has((d.getData('def') as NpcDef).id) && this.isFriend(d.getData('def') as NpcDef)).map((d) => d.getData('def') as NpcDef);
    this.trayAt = trayOn(seat);
    this.sleeping = true;
    this.sleepRun = {
      kind: 'eat', msPerMin: MEAL_MS_PER_MIN, acc: 0, left: MEAL_MINUTES, total: MEAL_MINUTES, busy: false, events: [],
      onDone: () => { this.trayAt = null; const mates = tablemates(); eatMeal(ctx, tray.meal, tray.name, mates, elsewhere()); this.persist(); },
    };
    // (once the meal has started: noting who's at your table checks that you're still eating)
    this.mealMates = meal;
    this.noteMealMates();
    this.hud.toast(L({ tr: `${tray.name}: afiyet olsun!`, en: `${tray.name}: enjoy your meal!` }), 'good');
  }

  /** whoever sits beside you or across from you right now joins the people you ate with */
  private noteMealMates() {
    const m = this.mealMates;
    if (!m) return;
    if (this.sleepRun?.kind !== 'eat') { this.endMealHold(); return; } // (you got up before finishing)
    for (const d of this.diners) {
      const def = d.getData('def') as NpcDef | null;
      if (d.visible && def && m.near(d)) m.met.set(def.id, def);
    }
  }

  /** your meal is over (or you got up): whoever waited for you at your table can go now */
  private endMealHold() {
    this.mealMates = null;
    this.dinerKey = '#'; // (no real list looks like this, an empty hall included: the hall is seated afresh, without them if they're done)
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
    const classData = buildClassroom();
    const map = this.make.tilemap({ data: classData, tileWidth: TILE, tileHeight: TILE });
    const ts = map.addTilesetImage(TILESET_KEY, TILESET_KEY, TILE, TILE, TILESET_MARGIN, TILESET_SPACING)!;
    const layer = map.createLayer(0, ts, CLASS_OX * TILE, 0)!;
    layer.setCollision(ROOM_SOLID as unknown as number[]);
    layer.setVisible(false);
    this.add.image(CLASS_OX * TILE, 0, bakeRoom(this, 'room-class', classData)).setOrigin(0).setScale(1 / ART_RES).setDepth(0.01);
    this.physics.add.collider(this.player, layer);
    this.spotTags.seat = this.add.text((CLASS_OX + this.spots.seat[0] + 0.5) * TILE, (this.spots.seat[1] + 0.1) * TILE, L({ tr: 'Senin sıran', en: 'Your desk' }), {
      fontFamily: 'system-ui, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#ffe7a8', stroke: '#1d2326', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(95_000);
    this.classLabels.push(this.spotTags.seat);
    const mates = NPCS.filter((n) => n.kind === 'classmate');
    const seats = NPC_CLASS_DESKS;
    mates.forEach((def, i) => {
      const [x, y] = seats[i % seats.length];
      this.classDeskOf.set(def.id, spotKey([x, y]));
      const sp = fitCharacter(this.physics.add.sprite((CLASS_OX + x + 0.5) * TILE, (y + 1.35) * TILE, `npc-${def.id}`, 9)).setDepth((y + 1) * TILE + 16);
      footBody(sp);
      sp.setImmovable(true);
      sp.setData('def', def);
      this.physics.add.collider(this.player, sp);
      this.classMates.push(sp);
    });
    for (const [id, tch] of Object.entries(TEACHERS)) makeCharacterTexture(this, `teacher-${id}`, { ...DEFAULT_LOOK, ...tch.look });
    this.teacher = fitCharacter(this.physics.add.sprite((CLASS_OX + TEACHER_ROUTE[0][0]) * TILE, TEACHER_ROUTE[0][1] * TILE, 'teacher-matematik', 0));
    this.teacher.setData('leg', 0);
    this.classLife = new ClassLife(this, this.classMates.map((sp, i) => ({ sp, desk: seats[i % seats.length] })), this.teacher, (sp, text) => this.bubbleAbove(sp, text));
  }

  /** your class has Beden Eğitimi right now */
  private peNow(): boolean {
    return this.lessonsOn() && this.currentLesson()?.subject === 'beden';
  }

  /** out on the football pitch or the basketball court beside it */
  private onPeGround(): boolean {
    return !this.room && inPeArea(this.player.x / TILE, this.player.y / TILE);
  }

  /** after PE: back inside the Eğitim Binası, in your classroom */
  private backToClass() {
    this.screenFade(() => {
      // (in by the door facing the Merkez Meydan, the nearer one to the pitch)
      const egitim = LOCATIONS.find((l) => l.id === 'egitim')!;
      const stands = egitim.doors!.map(doorStandTile);
      this.lastDoor = stands.reduce((a, b) => (b.x > a.x ? b : a));
      this.room = null;
      this.enterClass();
    });
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
      const now = lessonNow(this.gameCtx());
      if (this.save.state.school.attended.includes(`${this.save.clock.day}-${les.p.id}`)) { /* you've had this lesson */ }
      else if (les.subject === 'beden') this.hud.toast(L({ tr: `Bugün Beden Eğitimi var: sınıf sahada! ${les.teacher.name} futbol sahasında bekliyor.`, en: `It's PE today: the class is outside! ${les.teacher.name} is waiting on the football pitch.` }));
      else if (this.save.state.sick) this.hud.toast(L({ tr: `${les.teacher.name}: "Hastasın sen! Seni derse alamam, doğru Revir'e git."`, en: `${les.teacher.name}: "You're ill! I can't have you in class. Go straight to the infirmary."` }));
      else if (now?.late && !now.slip) this.hud.toast(L({ tr: `${les.teacher.name}: "${late} dakika geç kaldın! Önce müdür yardımcısından geç kâğıdı al." (kapıdan koridora çık)`, en: `${les.teacher.name}: "You're ${late} minutes late! Get a late slip from the deputy head first." (go out to the corridor)` }));
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
      teacher: tch && !tch.lesson ? { name: tch.name, look: TEACHERS[tch.subject].look } : null,
      // (a classmate whose desk another player took today isn't in class)
      present: (def) => this.whereIs(def) === 'egitim' && !this.held.seat.has(this.classDeskOf.get(def.id) ?? ''),
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
      if (sp.visible && Phaser.Math.Distance.Between(sp.x, sp.y, this.player.x, this.player.y) < TALK_RANGE) {
        const def = sp.getData('def') as NpcDef;
        return { id: 'mate', label: this.tagged(def), npc: def };
      }
    }
    if (near(this.spots.seat[0], this.spots.seat[1] + 0.8)) return { id: 'desk', label: L({ tr: 'Sırana otur', en: 'Sit at your desk' }) };
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
      const bel = this.save.character.gender === 'girl' ? 'Ayşe Hoca' : 'Ercan Hoca';
      if (late >= 5) this.hud.toast(L({ tr: `${bel} kapıda bekliyordu: "${late} dakika geç! Hemen yatağına."`, en: `${bel} was waiting at the door: "${late} minutes late! Straight to bed."` }));
    }
    else if (phaseOf(this.save.clock.minutes, this.save.clock.day) === 'etut') {
      const late = this.save.clock.minutes - 18 * 60;
      const bel = this.save.character.gender === 'girl' ? 'Ayşe Hoca' : 'Ercan Hoca';
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
    const sleepers = on ? [...this.roomMates.filter((s) => s.visible && s.getData('inBed')), ...(this.sleepRun?.kind === 'sleep' ? [this.player] : [])] : [];
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
    if (this.yetim.near(this.player)) {
      const cat = { purr: (f: boolean) => this.yetim.purr(f), zoomies: () => this.yetim.zoomies(), startle: () => this.yetim.startle(this.player) };
      return { label: L({ tr: 'Yetim (kedi)', en: 'Yetim (cat)' }), open: () => { const g = ctx(); this.panel.open(() => yetimPanel(g, cat)); } };
    }
    if (this.cemilOut.visible && Phaser.Math.Distance.Between(this.cemilOut.x, this.cemilOut.y, this.player.x, this.player.y) < TALK_RANGE) {
      return { label: 'Cemil Emmi', open: () => { const g = ctx(); this.panel.open(() => cemilPanel(g)); } };
    }
    // in a PE lesson the pitch and the court are the classroom
    const pe = this.npcById.get('ogr-beden');
    const nearPe = pe?.visible && Phaser.Math.Distance.Between(pe.x, pe.y, this.player.x, this.player.y) < 1.8 * TILE;
    if (this.peNow() && (nearPe || this.onPeGround())) {
      return { label: L({ tr: `Beden Eğitimi dersi · ${TEACHERS.beden.name}`, en: `PE lesson · ${TEACHERS.beden.name}` }), open: () => { const g = ctx(); this.panel.open(() => pePanel(g)); } };
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
    const beds = NPC_BEDS;
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
        getUp(sp);
        if (sp.isCropped) sp.setCrop();
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
        // (a roommate whose bed another player took sleeps next door tonight)
        if (!b || this.held.bed.has(spotKey(b))) { sp.setVisible(false); sp.body!.enable = false; return; }
        tex(true);
        if (!sp.getData('inBed')) tuckIn(sp, (ROOM_OX + b[0] + 0.5) * TILE, (b[1] + BED_Y) * TILE);
        sp.setDepth((b[1] + 1) * TILE + 4);
        sp.setVisible(this.room === 'dorm'); sp.body!.enable = false;
        return;
      }
      const [dx, dy] = sp.getData('desk') as [number, number];
      getUp(sp);
      tex(false);
      // on the far side of a table only head and shoulders show above it
      if (sp.getData('face') === 'down' && !sp.isCropped) sp.setCrop(0, 0, sp.frame.realWidth, sp.frame.realHeight * DESK_CROP);
      if (sp.angle !== 0 || sp.x !== dx || sp.y !== dy) sp.setAngle(0).setPosition(dx, dy).setDepth(sp.getData('face') === 'down' ? dy - 2 : dy + 16);
      // (nor does one whose chair another player took study here)
      const here = home && !this.held.desk.has(sp.getData('chair') as string);
      sp.setVisible(here);
      sp.body!.enable = here;
      // heads down, writing: a tiny bob now and then
      sp.setFrame((sp.getData('face') === 'down' ? 0 : 9) + (study && Math.floor(time / 700 + sp.x) % 5 === 0 ? 1 : 0));
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
    if (bel.visible && Phaser.Math.Distance.Between(bel.x, bel.y, this.player.x, this.player.y) < TALK_RANGE) {
      const def = bel.getData('def') as NpcDef;
      return { id: 'belletmen', label: L({ tr: `${def.name} ile konuş`, en: `talk to ${def.name}` }), npc: def };
    }
    for (const sp of this.roomMates) {
      if (!sp.visible) continue;
      if (Phaser.Math.Distance.Between(sp.x, sp.y, this.player.x, this.player.y) < TALK_RANGE) {
        const def = sp.getData('def') as NpcDef;
        return { id: 'mate', label: L({ tr: `${this.tagged(def)} ile…`, en: `${this.tagged(def)}…` }), npc: def };
      }
    }
    if (this.cemilIn.visible && Phaser.Math.Distance.Between(this.cemilIn.x, this.cemilIn.y, this.player.x, this.player.y) < TALK_RANGE) return { id: 'cemil', label: 'Cemil Emmi' };
    if (near(PHONE_SPOT[0], 2.2, 1.2)) return { id: 'phone', label: L({ tr: 'Telefon', en: 'Phone' }) };
    if (near(this.spots.desk[0], this.spots.desk[1] + 0.8)) return { id: 'desk', label: L({ tr: 'Masana otur', en: 'Sit at your desk' }) };
    if (near(this.spots.bed[0], this.spots.bed[1], 1.6)) return { id: 'bed', label: L({ tr: 'Yatağın', en: 'Your bed' }) };
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
    // the Meydan's retaining walls and railings run along tile edges; NPCs don't take the tunnel, so its stairwell is shut to them
    for (const [x0, y0, x1, y1] of BARRIERS) {
      if (x0 === x1) for (let ty = y0; ty < y1; ty++) { if (x0 > 0) this.npcLedge[ty * MAP_W + x0 - 1] |= 1; }
      else for (let tx = x0; tx < x1; tx++) { if (y0 > 0) this.npcLedge[(y0 - 1) * MAP_W + tx] |= 2; }
    }
    for (let tx = TUNNEL_STAIRS.x; tx < TUNNEL_STAIRS.x + TUNNEL_STAIRS.w; tx++) this.npcGrid[TUNNEL_STAIRS.y * MAP_W + tx] = 0;
    // the open tiles you can actually walk to from the main gate (pockets closed in by walls don't count)
    this.npcReach.fill(0);
    let from = -1;
    for (let y = GATE_IN[1]; y > GATE_IN[1] - 8 && from < 0; y--) if (this.npcGrid[y * MAP_W + GATE_IN[0]]) from = y * MAP_W + GATE_IN[0];
    const queue = from < 0 ? [] : [from];
    if (from >= 0) this.npcReach[from] = 1;
    for (let qi = 0; qi < queue.length; qi++) {
      const cur = queue[qi], x = cur % MAP_W;
      for (const n of [x > 0 ? cur - 1 : -1, x < MAP_W - 1 ? cur + 1 : -1, cur - MAP_W, cur + MAP_W]) {
        if (n < 0 || n >= this.npcGrid.length || !this.npcGrid[n] || this.npcReach[n] || this.ledgeBetween(cur, n)) continue;
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

  /** is there a retaining wall or railing between these two neighbouring tiles? */
  private ledgeBetween(a: number, b: number): boolean {
    const lo = Math.min(a, b), d = Math.abs(a - b);
    return (this.npcLedge[lo] & (d === 1 ? 1 : 2)) !== 0;
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
        if (n < 0 || n >= prev.length || prev[n] !== -1 || !this.npcGrid[n] || this.ledgeBetween(cur, n)) continue;
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

  /** a random open spot within `roam` tiles of home, away from doors (and, unless you're in high school, not behind the dorms) */
  private wanderSpot(home: [number, number], roam: number, lise = true): [number, number] | null {
    for (let i = 0; i < 8; i++) {
      const tx = Math.round(home[0]) + Phaser.Math.Between(-roam, roam), ty = Math.round(home[1]) + Phaser.Math.Between(-roam, roam);
      if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) continue;
      if (!lise && inDormBacks(tx + 0.5, ty + 0.5)) continue;
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
      const npc = fitCharacter(this.physics.add.sprite(...this.npcSpot(x, y), key, 0));
      footBody(npc);
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
      // where they wait for the bell (with their devre)
      npc.setData('schoolHome', this.devreHome('school', def, () => this.inRect(SCHOOL_FRONT, 2)).home);
      // at PE: most of the class on the pitch, a few on the basketball court beside it
      const court = Math.random() < 0.3 ? COURTS.basketball : COURTS.football;
      npc.setData('peHome', this.walkable(court.x + 1 + Math.random() * (court.w - 2), court.y + 1 + Math.random() * (court.h - 2)));
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

  /** devrecilik: a devre (everyone in the same school year) hangs out together. Each day the devre picks where it gathers,
   *  a big devre splits into its friend groups standing side by side, and each member stands close to their own group */
  private devreSpots = new Map<string, { x: number; y: number; roam: number }>();
  private devreSpotsDay = -1;
  private devreSpot(key: string, pick: () => { x: number; y: number; roam: number }) {
    if (this.devreSpotsDay !== this.save.clock.day) { this.devreSpots.clear(); this.devreSpotsDay = this.save.clock.day; }
    let s = this.devreSpots.get(key);
    if (!s) { s = pick(); this.devreSpots.set(key, s); }
    return s;
  }
  /** where this student stands within their devre's spot: by their friend group in a big devre, then a step or two apart */
  private devreHome(kind: string, def: NpcDef, pick: () => { x: number; y: number; roam: number }): { home: [number, number]; roam: number } {
    const g = def.grade ?? 4;
    const zone = this.devreSpot(`${kind}|${g}`, pick);
    const spot = DEVRE_SIZE.get(g)! > 8 && def.group
      ? this.devreSpot(`${kind}|${g}|${def.group}`, () => ({ x: zone.x + (Math.random() - 0.5) * 5, y: zone.y + (Math.random() - 0.5) * 3, roam: zone.roam }))
      : zone;
    return { home: this.walkable(spot.x + (Math.random() - 0.5) * 1.8, spot.y + (Math.random() - 0.5) * 1.8), roam: spot.roam };
  }
  private inRect(z: Rect, roam: number) { return { x: z.x + Math.random() * (z.w - 1), y: z.y + Math.random() * (z.h - 1), roam }; }

  /** by day each devre gathers by its age group's lawn, or now and then out on the mixed plazas in the middle; a few wander off alone */
  private pickDayHome(npc: Phaser.Physics.Arcade.Sprite) {
    const def = npc.getData('def') as NpcDef;
    // the lise devres spend their free time on their own yard behind one of the dorms
    if ((def.grade ?? 4) >= 9) { npc.setData('dayHome', this.devreHome('day', def, () => this.inRect(liseYard(def.grade!), 1.5)).home); npc.setData('dayRoam', 1.5); return; }
    const pick = () => {
      const centre = Math.random() < 0.35;
      const zones = centre ? CENTER_ZONES : AGE_ZONES[ageGroup(def)];
      return this.inRect(zones[Math.floor(Math.random() * zones.length)], centre ? 3 : 2);
    };
    if (Math.random() < 0.12) { const s = pick(); npc.setData('dayHome', this.walkable(s.x, s.y)); npc.setData('dayRoam', s.roam); return; }
    const { home } = this.devreHome('day', def, pick);
    npc.setData('dayHome', home);
    npc.setData('dayRoam', 1.5);
  }

  /** 20:00–22:00: most devres are out on the Yurt Meydanı itself, some keep to their own year's corner, always together */
  private pickEveningHome(npc: Phaser.Physics.Arcade.Sprite) {
    const def = npc.getData('def') as NpcDef;
    const g = def.grade ?? 4;
    const pick = () => this.inRect(Math.random() < 0.6 ? EVENING_CENTER : EVENING_ZONES[g >= 9 ? 'lise' : (String(g) as '4' | '5' | '6' | '7' | '8')], 2);
    // (the abi and abla who keep an eye on the little ones stay out in the middle of it)
    if (def.fixed) { const s = this.inRect(EVENING_CENTER, 3); npc.setData('plazaHome', this.walkable(s.x, s.y)); return; }
    // the lise devres: out on their own yard behind the boys' or the girls' dorm
    if (g >= 9) { npc.setData('plazaHome', this.devreHome('evening', def, () => this.inRect(liseYard(g), 1.5)).home); return; }
    npc.setData('plazaHome', this.devreHome('evening', def, pick).home);
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
  private lessonsOn(): boolean { return this.settled() && this.save.clock.day >= FIRST_MONDAY; }

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
    // the PE teacher takes the class out on the pitch, whistle in hand
    if (def.id === 'ogr-beden' && this.peNow()) return { home: this.walkable(76, 26), roam: 0, face: [83, 26] };
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
    if (act.out === 'pe') return { home: npc.getData('peHome'), roam: 2 };
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
          // (the backs of the dorms are the high schoolers'; younger ones and the grown-ups don't hang about there)
          const spot = idle ? null : this.wanderSpot(plan.home, Math.max(1, plan.roam), (def.grade ?? 0) >= 9);
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
      // the dorm's abi and abla show when they have a quest for you (📜) or one to hand in (✅)
      const mark = GIVER_IDS.includes(def.id) ? questMark(def.id, this.mc()) : null;
      const star = (mark === 'ready' ? '✅ ' : mark === 'offer' ? '📜 ' : '') + (friend ? '💛 ' : '') + (def.kind === 'classmate' && this.save.state.once.classDrawn ? '★ ' : '');
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
        this.add.image(sh.x, sh.y, sh.key).setOrigin(0, 0).setScale(1 / ART_RES).setDepth(1).setAlpha(alpha);
      }
      const art = makeBuildingArt(this, b);
      const imgs: Phaser.GameObjects.Image[] = [], lits: Phaser.GameObjects.Image[] = [];
      const SLICE = 8;
      let last = art.base;
      for (let sx = 0; sx < art.w; sx += SLICE) {
        const fronts = [1, SLICE / 2, SLICE - 1].map((d) => frontAt(b.shape, (art.x + sx + d) / TILE)).filter((v): v is number => v !== null);
        const base = fronts.length ? Math.max(...fronts) * TILE : last;
        last = base;
        // (the building's picture is ART_RES times finer than the world: crop in its pixels, show it scaled down)
        imgs.push(this.add.image(art.x, art.y, art.key).setOrigin(0, 0).setScale(1 / ART_RES).setCrop(sx * ART_RES, 0, SLICE * ART_RES, art.h * ART_RES).setDepth(base));
        lits.push(this.add.image(art.x, art.y, art.litKey).setOrigin(0, 0).setScale(1 / ART_RES).setCrop(sx * ART_RES, 0, SLICE * ART_RES, art.h * ART_RES).setDepth(base + 0.5).setAlpha(0));
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

  /** the Merkez Meydan's terrace: nobody crosses its retaining walls or railings (nor the wire round the south courts); the player can also walk down the
   *  stairwell into the tunnel under its north edge and come out at the arch in the east wall, or the
   *  other way round. `prev` is where the feet were last frame, so a long frame can't step over a wall. */
  private updateTerrace(sp: Phaser.Physics.Arcade.Sprite, isPlayer: boolean) {
    const body = sp.body as Phaser.Physics.Arcade.Body | null;
    if (!body?.enable) return;
    const R = 7, half = 6;
    const cx = body.center.x, cy = body.center.y, vx = body.velocity.x;
    const prev = (sp.getData('terracePrev') as [number, number] | undefined) ?? [cx, cy];
    const W = TUNNEL_IN.west * TILE, E = TUNNEL_IN.east * TILE, y0 = TUNNEL_IN.y * TILE, y1 = y0 + TILE;
    if (isPlayer) {
      const inRow = cy > y0 - 4 && cy < y1 + 4;
      // moved far off all at once (sent somewhere by the story): not in the tunnel any more
      if (this.inTunnel && (cy < y0 - TILE || cy > y1 + TILE)) this.setTunnel(false);
      if (!this.inTunnel && inRow) {
        // into the tunnel: from the bottom of the stairwell, or in through the arch from the street beside the Spor Salonu
        if (prev[0] < W && prev[0] > TUNNEL_STAIRS.x * TILE && cx > W - R - 1 && vx > 0) this.setTunnel(true);
        else if (prev[0] > E && cx < E + R + 1 && vx < 0) this.setTunnel(true);
      }
      if (this.inTunnel) {
        // along the tunnel, nothing up on the square in the way; out at either end
        const y = Phaser.Math.Clamp(cy, y0 + half, y1 - half);
        if (y !== cy) { body.position.y += y - cy; body.updateCenter(); }
        if (cx < W - R - 4 || cx > E + R + 4) this.setTunnel(false);
        sp.setData('terracePrev', [body.center.x, body.center.y]);
        return;
      }
    }
    for (const [lx0, ly0, lx1, ly1] of BARRIERS) {
      const ax = lx0 * TILE, ay = ly0 * TILE, bx = lx1 * TILE, by = ly1 * TILE;
      const vertical = ax === bx;
      const px = body.center.x, py = body.center.y;
      // along the wall: is the body level with it (with a feet-radius of slack round the ends)?
      const along = vertical ? py : px, a0 = vertical ? ay : ax, a1 = vertical ? by : bx;
      if (along < a0 - R || along > a1 + R) continue;
      const line = vertical ? ax : ay, cur = vertical ? px : py, was = vertical ? prev[0] : prev[1];
      const side = Math.sign(was - line) || Math.sign(cur - line) || 1;
      // past the end of the wall: only a round push off its end, if at all
      if (along < a0 || along > a1) {
        const ex = vertical ? ax : along < a0 ? ax : bx, ey = vertical ? (along < a0 ? ay : by) : ay;
        const d = Math.hypot(px - ex, py - ey);
        if (d >= R || d < 1e-3 || Math.sign(cur - line) !== side) continue;
        body.position.x += ((px - ex) / d) * (R - d); body.position.y += ((py - ey) / d) * (R - d); body.updateCenter();
        continue;
      }
      // keep the feet on the side they were on, a feet-radius clear of the wall
      const off = (cur - line) * side;
      if (off >= R) continue;
      const push = (R - off) * side;
      if (vertical) { body.position.x += push; if (body.velocity.x * side < 0) body.velocity.x = 0; }
      else { body.position.y += push; if (body.velocity.y * side < 0) body.velocity.y = 0; }
      body.updateCenter();
    }
    sp.setData('terracePrev', [body.center.x, body.center.y]);
  }

  /** down into the tunnel or back out of it */
  private setTunnel(on: boolean) {
    this.inTunnel = on;
  }

  /** while you're in the tunnel you see yourself inside it, through the square's paving (like the Eğitim corridor) */
  private updateTunnelView() {
    if (!this.tunnelImgs) return;
    const target = this.inTunnel ? 1 : 0;
    if (this.tunnelView === target) return;
    this.tunnelView = Math.abs(this.tunnelView - target) < 0.05 ? target : this.tunnelView + (target - this.tunnelView) * 0.25;
    this.tunnelImgs.inside.setAlpha(this.tunnelView);
    this.tunnelImgs.roof.setAlpha(this.tunnelView * 0.45);
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
        c.imageSmoothingEnabled = true;
        c.globalAlpha = Math.min(0.9, (a - 0.25) * 2);
        for (const { art, alpha } of this.buildingArt) {
          if (alpha < 0.9) continue;
          const sx = (art.x - view.x) * cam.zoom, sy = (art.y - view.y) * cam.zoom;
          if (sx > w || sy > h || sx + art.w * cam.zoom < 0 || sy + art.h * cam.zoom < 0) continue;
          c.drawImage(this.textures.get(art.litKey).getSourceImage() as HTMLCanvasElement, sx, sy, art.w * cam.zoom, art.h * cam.zoom);
        }
        // and spill a warm halo onto the walls and the ground round them
        c.globalCompositeOperation = 'lighten';
        c.globalAlpha = Math.min(0.8, (a - 0.25) * 1.8);
        for (const { art, alpha } of this.buildingArt) {
          if (alpha < 0.9 || !art.glow) continue;
          const sx = (art.x - view.x) * cam.zoom, sy = (art.y - view.y) * cam.zoom;
          if (sx > w || sy > h || sx + art.w * cam.zoom < 0 || sy + art.h * cam.zoom < 0) continue;
          c.drawImage(art.glow, sx, sy, art.w * cam.zoom, art.h * cam.zoom);
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
    // online, the campus day decides (your day numbers are your own, the weather is everyone's)
    if (this.synced() && this.worldOffset !== null) day += this.worldOffset;
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
    if (!silent) { this.hud.toast(t('discovered_toast', { name: L(loc.name) }), 'good'); sfx.discover(); this.log({ kind: 'discover', a: L(loc.name) }); }
    if (!silent) this.save.state.xp += 20;
    // nobody makes you explore, but finding every corner of the campus is worth something
    if (LOCATIONS.every((l) => this.discovered.has(l.id)) && !this.save.state.once.exploredAll) {
      this.save.state.once.exploredAll = true;
      this.save.character.respect = growRespect(this.save.character.respect, 5, this.save.state.year);
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
    if (this.panel?.isOpen || this.sleepRun || this.escort || this.inTunnel) { this.hud.setPrompt(null); this.nearDoor = null; this.nearRoomThing = null; return; }
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
    // in a PE lesson, the teacher and the pitch mean the lesson itself
    const peSpot = this.peNow() ? this.outdoorSpot() : null;
    if (peSpot) { this.nearDoor = null; this.hud.setPrompt(`E — ${peSpot.label}`); return; }
    // standing on a door's step, the door wins over anyone loitering beside it (step off it to talk to them)
    const npc = this.findNearDoor() ? null : this.findNearNpc();
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

  /** evci: the weekend at home; you're back at the gate on Sunday at 17:40 (online, the weekend goes by on the campus clock) */
  private goHome(summary: string) {
    const c = this.save.clock;
    this.sleeping = true;
    this.cameras.main.fadeOut(500, 8, 14, 24);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      const back = (c.day + (6 - weekday(c.day) + 7) % 7) * 24 * 60 + BACK_ON_SUNDAY; // Sunday 17:40
      if (!this.synced()) {
        this.sleeping = false;
        c.day = Math.floor(back / (24 * 60));
        c.minutes = BACK_ON_SUNDAY;
        this.backFromHome(summary);
        return;
      }
      const left = back - absMinutes(c);
      this.player.setVisible(false).setVelocity(0, 0);
      this.player.body!.enable = false;
      this.sleepRun = { kind: 'home', msPerMin: 0, acc: 0, left, total: left, busy: false, events: [], onDone: () => this.backFromHome(summary) };
    });
  }

  private backFromHome(summary: string) {
    const c = this.save.clock;
    const st = this.save.state;
    const guardian = L(GUARDIANS.find((g) => g.id === this.save.character.guardian)!.your);
    this.player.setVisible(true);
    this.player.body!.enable = true;
    const onTime = isSunday(c.day) && c.minutes >= BACK_ON_SUNDAY - 5;
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
      title: L({ tr: '🏠 Evde bir hafta sonu', en: '🏠 A weekend at home' }),
      sub: onTime ? L({ tr: 'Pazar 17:40 · okula döndün', en: 'Sunday 17:40 · back at school' }) : L({ tr: `${fmtTime(c.minutes)} · okula erken döndün`, en: `${fmtTime(c.minutes)} · back at school early` }),
      body: summary,
      note: onTime ? L({ tr: `${guardian} seni kapıya bıraktı. Etüt 18:00'de: yurduna yetiş!`, en: `${guardian} dropped you at the gate. Study time is at 18:00: hurry to your dorm!` })
        : L({ tr: `${guardian} seni kapıya bıraktı.`, en: `${guardian} dropped you at the gate.` }),
      button: onTime ? L({ tr: 'Yurda koş', en: 'Run to the dorm' }) : t('close'),
    });
  }

  /** watching the match on match night */
  private watching = false;
  /** on-screen joystick and buttons (touch screens only) */
  private touch: TouchControls | null = null;
  private blocked() { return this.watching || this.hud.modalOpen || this.hud.bigOpen || this.panel.isOpen || this.hud.chatOpen || this.sleepRun !== null || this.escort !== null; }
  /** the menu pages (profile, missions, relationships, friends) only look things up, so they open while you sleep or
   *  wait something out too; just not over another window, the chat, or while you're being marched back to the dorm */
  /** the chat box opens whenever nothing else on screen wants your keys: while time goes by too (asleep, killing time,
   *  eating, busy, the weekend at home), but not over a panel, a card, the big map, a match or a game with someone */
  private chatBlocked() { return this.watching || this.hud.modalOpen || this.hud.bigOpen || this.panel.isOpen || this.hud.chatOpen || this.escort !== null; }

  private menuBlocked() { return this.watching || this.hud.modalOpen || this.hud.bigOpen || this.panel.isOpen || this.hud.chatOpen || this.escort !== null; }

  // ---------- the backs of the dorms: the lise's turf ----------

  /** where you last stood outside the dorm backs (px), to put you back when a lise student turns you away */
  private yardSafe: [number, number] | null = null;
  private yardWarnAt = 0;

  /** until you're in lise yourself, the high schoolers out on their yards won't let you in: the nearest one comes over,
   *  tells you so and you're back where you came from. With no lise student outside (at night, in lessons) nobody stops you. */
  private guardDormBacks(time: number) {
    if (this.room || this.escort || this.sleepRun || this.watching) return;
    const px = this.player.x / TILE, py = this.player.y / TILE + 0.3;
    if (grade(this.save.state.year) >= 9 || !inDormBacks(px, py)) { this.yardSafe = [this.player.x, this.player.y]; return; }
    const guard = this.npcs.filter((n) => n.visible && n.body!.enable && ((n.getData('def') as NpcDef).grade ?? 0) >= 9 && !this.match?.mates.includes(n))
      .sort((a, b) => Phaser.Math.Distance.Between(a.x, a.y, this.player.x, this.player.y) - Phaser.Math.Distance.Between(b.x, b.y, this.player.x, this.player.y))[0];
    if (!guard) { this.yardSafe = [this.player.x, this.player.y]; return; }
    // back out you go (or, if you somehow started in there, out onto the Yurt Meydanı)
    const [sx, sy] = this.yardSafe ?? [12 * TILE, 23 * TILE];
    this.player.setPosition(sx, sy).setVelocity(0, 0);
    if (time < this.yardWarnAt) return;
    this.yardWarnAt = time + 5000;
    const def = guard.getData('def') as NpcDef;
    const lines = [
      { tr: 'Hop, ufaklık! Burası liselilerin yeri. Liseye geçince gelirsin.', en: "Whoa, little one! This is the high schoolers' spot. Come back when you're in lise." },
      { tr: 'Nereye böyle? Arka taraf liselilerin, sen meydanda takıl.', en: 'Where are you off to? Back here is for the lise lot; you hang out on the square.' },
      { tr: 'Dur bakalım! Buraya ancak lisede girersin.', en: "Hold it! You don't come back here till you're in lise." },
    ];
    const line = L(lines[Math.floor(Math.random() * lines.length)]);
    this.hud.toast(`${def.name}: "${line}"`);
    this.bubbleAbove(guard, line);
    // they come over to where you tried to get in, and stay a moment before going back to their devre
    const spot: [number, number] = [px, py - 0.3];
    guard.setData('summon', spot);
    this.time.delayedCall(7000, () => { if (guard.getData('summon') === spot) guard.setData('summon', undefined); });
  }

  private findNearNpc(): NpcDef | null {
    let best: NpcDef | null = null, bestD = TALK_RANGE;
    for (const npc of this.npcs) {
      if (!npc.visible) continue;
      const d = Phaser.Math.Distance.Between(npc.x, npc.y, this.player.x, this.player.y);
      if (d < bestD) { bestD = d; best = npc.getData('def') as NpcDef; }
    }
    return best;
  }

  private interact() {
    if (this.blocked()) return;
    const ghost = this.peers.size ? this.nearPeer(true) : null;
    if (ghost) { this.hud.toast(leftMessage(ghost.profile.name)); return; }
    const peer = this.nearPeer();
    if (peer) {
      this.player.setVelocity(0, 0);
      this.panel.open(() => {
        const add = this.friendAction(peer);
        const friend = this.friends.get(peer.profile.id)?.status === 'accepted';
        return {
          title: peer.profile.name, sub: friend ? L({ tr: `⭐ Arkadaşın · ${peer.profile.grade}. sınıf`, en: `⭐ Your friend · grade ${peer.profile.grade}` }) : L({ tr: `Gerçek oyuncu · ${peer.profile.grade}. sınıf`, en: `Real player · grade ${peer.profile.grade}` }),
          rooms: [{ id: 'peer', name: peer.profile.name, note: L({ tr: 'Gerçek bir oyuncu: ne yaparsan kendisi cevap verir.', en: 'A real player: they answer for themselves.' }),
            actions: [
              ...(this.peerPlay?.actions(peer.profile.id) ?? []),
              ...(add ? [add] : []),
            ] }],
        };
      });
      return;
    }
    if (this.room === 'dining') { this.interactDining(); return; }
    if (this.room === 'class') { this.interactClass(); return; }
    if (this.room === 'dorm') { this.interactRoom(); return; }
    const peSpot = this.peNow() ? this.outdoorSpot() : null;
    if (peSpot) { this.player.setVelocity(0, 0); peSpot.open(); return; }
    const npc = this.findNearDoor() ? null : this.findNearNpc();
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
      const r0 = this.save.character.respect;
      this.save.character.respect = growRespect(r0, 10, st.year);
      const won = this.save.character.respect - r0;
      this.hud.toast(L({ tr: `🌙 Yakalanmadan geri döndün! +30 XP${won ? ` · +${won} saygınlık` : ''}`, en: `🌙 You made it back unseen! +30 XP${won ? ` · +${won} respect` : ''}` }), 'good');
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
    if (phaseOf(this.save.clock.minutes, this.save.clock.day) !== 'day' && loc.id !== ownDorm && loc.id !== 'revir' && this.settled() && !(loc.id === 'spor' && matchFree(this.save.clock.day, this.save.clock.minutes))) {
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
      advance: (m, o) => this.advance(m, o?.label ?? (this.actionLabel ? `⏳ ${this.actionLabel.replace(/^[^\p{L}\d"]+/u, '')}` : undefined), undefined, o?.wait ?? false),
      pass: (m, label) => new Promise<void>((resolve) => this.advance(m, label, resolve, true)),
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
      toClass: () => this.backToClass(),
      log: (e) => this.log(e),
      watchMatch: () => void this.watchMatch(),
      playYetimball: (opponent, skill) => this.playYetimball(opponent, skill),
      runToPhone: (caller, belletmen) => this.runToPhone(caller, belletmen),
      beltNear: () => this.roomBelletmen.visible && Phaser.Math.Distance.Between(this.roomBelletmen.x, this.roomBelletmen.y, this.player.x, this.player.y) < 4 * TILE,
    };
  }

  /** Yetimball against a classmate: you hit first; the game screen holds you still until you close it */
  private playYetimball(opponent: string, skill: number): Promise<YbResult> {
    this.watching = true;
    this.player.setVelocity(0, 0);
    this.player.anims.stop();
    return new Promise((resolve) => {
      const view = new YetimballView(document.body, {
        me: this.save.character.first, them: opponent, host: true,
        send: () => {}, quit: () => {},
        bot: (tension) => botHit(skill, tension),
        onEnd: resolve,
      });
      const close = view.close.bind(view);
      view.close = () => { close(); this.watching = false; this.refreshClockAndNeeds(); };
    });
  }

  /** the run down the dorm corridor to the phone; the clock waits while you run, like at the match */
  private runToPhone(caller: string, belletmen: string): Promise<PhoneRunResult> {
    this.watching = true;
    this.player.setVelocity(0, 0);
    this.player.anims.stop();
    return new Promise((resolve) => {
      new PhoneRunView(document.body, {
        caller, belletmen, look: this.save.character.look, pyjamas: PYJAMAS,
        onEnd: (r) => { this.watching = false; this.refreshClockAndNeeds(); resolve(r); },
      });
    });
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
    this.log({ kind: 'act', a: 'idle' });
    this.player.setVelocity(0, 0);
    this.player.anims.stop();
    if (this.room === 'dorm') { this.player.setPosition((ROOM_OX + this.spots.desk[0] + 0.5) * TILE, (this.spots.desk[1] + 1.35) * TILE); this.dir = 3; }
    this.sleepRun = { kind: 'idle', msPerMin: Math.min(90, 8000 / left), acc: 0, left, total: left, busy: false, events: [] };
  }

  /** a note for today's diary (the same thing twice in a row is noted once) */
  private log(e: DiaryEvent) {
    const j = this.save.state.journal;
    const c = this.save.clock;
    const last = j[j.length - 1];
    if (last && last.kind === e.kind && last.a === e.a && last.b === e.b) return;
    j.push({ at: c.day * 1440 + c.minutes, ...e });
    if (j.length > 80) j.splice(0, j.length - 80);
  }

  /** actions in the menus the diary notes on its own (the ones with a richer line of their own, and comings and goings, are left out) */
  private logAction(title: string, a: { id: string; label: string }) {
    if (title === T_PE() || this.actionStamp === this.stamp()) return; // (PE writes its own; a cancelled choice changed nothing)
    this.log({ kind: 'act', a: a.id, b: a.label });
  }

  private actionStamp = '';
  /** what you're doing right now (the button you pressed), so the "busy" banner can say so */
  private actionLabel = '';
  /** a fingerprint of the things an action changes: if it's the same afterwards, the action was called off */
  private stamp(): string {
    const st = this.save.state, c = this.save.clock;
    return `${c.day * 1440 + c.minutes}|${st.money}|${st.xp}|${st.mood}|${st.wardrobe.wearing}|${st.food.bag.length}|${st.phoneUnits}|${Object.values(st.friends).reduce((a, b) => a + b, 0)}`;
  }

  /** the diary page for the day, at bedtime: a short entry in your own words; then you go to sleep */
  private showDiary(then: () => void) {
    const st = this.save.state, c = this.save.clock;
    const entries = st.journal.splice(0).filter((e) => e.kind) as DiaryEvent[];
    if (!entries.length) { then(); return; }
    const day = c.minutes < WAKE_UP ? c.day - 1 : c.day;
    const names = t('days').split(',');
    const paras = writeDiary(entries, st.mood, getLang(), `${this.save.character.first}${day}`);
    const esc = (x: string) => x.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
    const el = document.createElement('div');
    el.className = 'card diary-card';
    el.innerHTML = `
      <div class="diary-head"><div class="diary-tag">📖 ${L({ tr: 'Günlüğüm', en: 'My diary' })}</div><h2>${names[weekdayOf(day)]}</h2></div>
      <div class="diary-body">
        <p class="diary-dear">${L({ tr: 'Sevgili günlük,', en: 'Dear diary,' })}</p>
        ${paras.map((p) => `<p>${esc(p)}</p>`).join('')}
        <p class="diary-sign">— ${esc(this.save.character.first)}</p>
      </div>
      <div style="text-align:right"><button type="button" class="primary">${L({ tr: 'Günlüğü kapat, uyu 😴', en: 'Close the diary and sleep 😴' })}</button></div>`;
    this.player.setVelocity(0, 0);
    this.hud.openCard(el, ['Escape', 'Enter'], then);
  }

  private penalize(points: number, why: string) {
    const st = this.save.state;
    st.discipline = Math.min(100, st.discipline + points);
    st.lastPenaltyDay = this.save.clock.day;
    sfx.warn();
    this.log({ kind: 'penalty', a: why });
    this.hud.toast(`⚠ ${why} (+${points} ${L({ tr: 'disiplin puanı', en: 'discipline points' })})`);
    this.refreshClockAndNeeds();
  }

  private badSurprise(who: NpcDef) {
    const st = this.save.state;
    const sp = SURPRISES[Math.floor(Math.random() * SURPRISES.length)];
    const e = sp.effect;
    if (e.mood) this.changeMood(e.mood * (hasSecret(st, 'icKale') ? 0.5 : 1));
    if (e.minutes) this.advance(e.minutes, undefined, undefined, false);
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
      body: L({ tr: 'Belletmen Selim Hoca fenerle kampüsü dolaşıyor. Ona yaklaşma! Kampüsü gez, sonra yakalanmadan yurduna dön ve kapında E\'ye bas.', en: 'Mr. Selim is patrolling the campus with a torch. Keep your distance! Explore, then get back to your dorm door without being seen and press E.' }),
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
    const belletmen = this.save.character.gender === 'girl' ? 'Ayşe Hoca' : 'Ercan Hoca';
    if (st.escaped) {
      if (phase !== 'night') { st.escaped = false; this.penalize(10, L({ tr: 'Sabah yoklamasında yatağında değildin!', en: "You weren't in bed at the morning roll call!" })); return; }
      const patrol = this.npcs.find((n) => (n.getData('def') as NpcDef).id === 'bel-selim');
      // sneaking out is the one time you can stay out: only Selim Hoca's torch ends it, and then he walks you back
      if (patrol?.visible && Phaser.Math.Distance.Between(patrol.x, patrol.y, this.player.x, this.player.y) < (hasSecret(st, 'sessizAdim') ? 2.5 : 3.5) * TILE) {
        this.caught(patrol, 15, L({ tr: 'Selim Hoca seni fenerle yakaladı! Doğru yatağa.', en: 'Mr. Selim caught you in his torchlight! Straight to bed.' }));
      }
      return;
    }
    const belId = this.save.character.gender === 'girl' ? 'bel-hatice' : 'bel-mehmet';
    if (phase === 'etut') {
      // you walk to the dorm yourself; being 5+ minutes late costs discipline and your belletmen's goodwill
      // (leave from your belletmen: not late until 18:30)
      if (c.minutes >= 18 * 60 + (st.daily.etutPass === day ? 30 : 5) && st.daily.lateEtut !== day) {
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
    // (match night: the whole campus is open until 21:00)
    if ((phase === 'plaza' || phase === 'night') && !this.room && !matchFree(c.day, c.minutes)) {
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
   *  is Selim Hoca's patrol's business), or not in class while a lesson is on */
  private outOfPlace(): 'curfew' | 'truant' | null {
    const st = this.save.state;
    if (!this.settled() || st.escaped || this.sleeping) return null;
    const phase = phaseOf(this.save.clock.minutes, this.save.clock.day);
    if (phase === 'etut' || phase === 'night') return this.room === 'dorm' ? null : 'curfew';
    const les = this.skipping();
    if (!les || this.room === 'class') return null;
    return les.subject === 'beden' && this.onPeGround() ? null : 'truant';
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
    // Selim Hoca joins in at night, or once study time has gone on a while (lessons are the deputy head's business alone)
    if (h.kind === 'curfew' && h.npcs.length < 2 && (phaseOf(this.save.clock.minutes, this.save.clock.day) === 'night' || h.t > 20_000)) {
      const selim = this.npcs.find((n) => (n.getData('def') as NpcDef).id === 'bel-selim');
      if (selim && !h.npcs.includes(selim)) {
        h.npcs.push(selim);
        if (h.t > 0) this.hud.toast(L({ tr: '🔦 Selim Hoca de fenerini alıp aramaya katıldı!', en: '🔦 Mr. Selim has grabbed his torch and joined the search!' }));
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
      const stands = e.kind === 'truant' && this.peNow() ? [{ x: 74, y: 26 }]
        : (e.kind === 'truant' ? LOCATIONS.find((l) => l.id === 'egitim')! : this.ownDormLoc()).doors!.map(doorStandTile).filter((d) => this.npcReach[d.y * MAP_W + d.x]);
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
    // (down in the tunnel under the Meydan you're out of sight, and out of reach of anyone up on the square)
    if (!this.inTunnel && d < (out ? 1.3 : 1.6) * TILE) { this.caught(npc); return; }
    if (out && !this.inTunnel && d < this.spotRange() * TILE) { h.spotted = true; h.seen = me; }
    // they start at a walk and keep speeding up, so in the end they outpace you
    const speed = Math.min(SEARCH_SPEED_MAX, SEARCH_SPEED + h.t / 400 + (h.spotted ? 40 : 0));
    if (d < 2 * TILE) {
      const a = Math.atan2(me.y - npc.y, me.x - npc.x);
      npc.setVelocity(Math.cos(a) * speed, Math.sin(a) * speed);
      npc.setData('wantMove', true);
      return;
    }
    if (d < this.spotRange() * TILE) { npc.setData('huntGoal', undefined); this.steerNpc(npc, me.x, me.y, speed); return; }
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
        note: L({ tr: 'Seni sınıfına kadar götürüyor. Derse girmemek disiplin puanı getirir ve karakterine işler: "Haylaz" yönüne kayıyorsun.', en: 'She is walking you to your classroom. Skipping lessons costs discipline points and it shapes who you are: you lean towards "Mischievous".' }),
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
    if (les?.subject === 'beden') {
      // handed over to the PE teacher: laps on the touchline for the rest of the lesson, then back in with everyone
      const ctx = this.gameCtx();
      attendLesson(ctx, `${this.save.clock.day}-${les.p.id}`, 'beden', 30);
      this.gain({ energy: -15, attrs: { fitness: 1 } });
      this.advance(Math.max(0, les.p.end - this.save.clock.minutes), L({ tr: '🏃 Saha kenarında tur', en: '🏃 Laps of the touchline' }), () => this.backToClass());
      this.hud.showModal({
        title: L({ tr: 'Beden Eğitimi', en: 'Physical Education' }), sub: les.teacher.name,
        body: L({ tr: `${name} seni sahaya getirdi: "Bu öğrenci dersi asıyordu." ${les.teacher.name} düdüğünü öttürdü: "Ders bitene kadar saha kenarında tur atacaksın!"`, en: `${name} brought you out to the pitch: "This one was skipping your lesson." ${les.teacher.name} blew his whistle: "Laps of the touchline until the bell!"` }),
        note: L({ tr: 'Performans notu: 30/100 · zil çalınca herkesle Eğitim Binası\'na döndün.', en: 'Performance mark: 30/100 · at the bell you went back to the Eğitim Binası with everyone.' }),
        button: L({ tr: 'Tamam', en: 'OK' }),
      });
      return;
    }
    this.lastDoor = doorStandTile(LOCATIONS.find((l) => l.id === 'egitim')!.doors![0]);
    this.enterClass();
    this.player.setPosition((CLASS_OX + this.spots.seat[0] + 0.5) * TILE, (this.spots.seat[1] + 1.35) * TILE);
    this.dir = 3;
    if (!les) return; // the bell went on the way: nothing left to sit through
    const ctx = this.gameCtx();
    const sname = L(SUBJECTS.find((x) => x.id === les.subject)!.name);
    attendLesson(ctx, `${this.save.clock.day}-${les.p.id}`, les.subject, 30);
    this.gain({ energy: -8 });
    this.advance(Math.max(0, les.p.end - this.save.clock.minutes), L({ tr: '📚 Derstesin', en: '📚 In class' }));
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
    if (this.rushOn()) { this.rushCountdown(); return; }
    // visits, the weekend bus, match night, the flag ceremony: shown wherever you are, with the time running down
    const ev = this.timedEvent();
    if (ev) { this.hud.setCountdown(ev.text, ev.urgent, ev.progress); return; }
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

  // ---------- match night: Darüşşafaka v Banvit ----------

  private async watchMatch() {
    if (this.watching) return;
    const st = this.save.state, c = this.save.clock;
    this.player.setVelocity(0, 0);
    this.player.anims.stop();
    // early: the wait in the stand until tip-off
    if (c.minutes < MATCH_TIP && !this.synced()) this.advance(MATCH_TIP - c.minutes);
    this.watching = true;
    this.hud.setPrompt(null);
    const friends = NPCS.filter((n) => this.isFriend(n)).sort((a, b) => (st.friends[b.id] ?? 0) - (st.friends[a.id] ?? 0)).map((n) => n.name);
    const view = new MatchView(this.hud.host, this.save.character.first, friends);
    // late: what you missed went by without you (each quarter, breaks included, takes about 26 minutes)
    const missed = Math.max(0, Math.min(3, Math.floor((c.minutes - MATCH_TIP) / 26)));
    view.presim(missed);
    if (missed < 2) await view.play(2);
    // half-time: the dilemma, over the match screen
    Object.assign(matchState, { home: view.score[0], away: view.score[1] });
    this.panel.open(() => ({ title: L({ tr: 'Devre arası', en: 'Half-time' }), rooms: [{ id: 'mac', name: L({ tr: 'Devre arası', en: 'Half-time' }), actions: [] }] }));
    await runDilemma(this.gameCtx(), 'mac');
    if (this.panel.isOpen) this.panel.close();
    const choice = st.memories.find((m) => m.id === 'mac')?.choice;
    view.boost = choice === 'cheer' ? 0.1 : choice === 'watch' ? 0.03 : 0;
    if (choice === 'cheer') view.say({ tr: 'Tribün senin başlattığın tezahüratla inliyor!', en: 'The stand is roaring with the chant you started!' });
    await view.play(4);
    const [h, a] = view.score;
    st.once.matchWatched = true;
    this.log({ kind: 'match', n: h, m: a });
    this.gain({ xp: 30, mood: h > a ? 12 : 4 });
    await view.finale();
    view.close();
    this.watching = false;
    // out of the hall with everyone; the belletmens want you all back round the dorms by 21:00
    if (c.minutes < MATCH_END && !this.synced()) this.advance(MATCH_END - c.minutes);
    this.screenFade(() => {
      const spor = LOCATIONS.find((l) => l.id === 'spor')!;
      const stand = doorStandTile(spor.doors![0]);
      this.player.setPosition((stand.x + 0.5) * TILE, (stand.y + 0.5) * TILE).setVelocity(0, 0);
      this.npcClock = -1;
      this.checkMissions();
      this.persist();
      this.hud.toast(L({ tr: `Maç bitti! Saat ${fmtTime(MATCH_FREE)}'e kadar yurtların çevresine dön.`, en: `The match is over! Get back round the dorms by ${fmtTime(MATCH_FREE)}.` }));
    });
  }

  /** time-limited things worth a strip at the top of the screen, with a bar running down (most pressing first) */
  private timedEvent(): { text: string; urgent: boolean; progress: number } | null {
    const st = this.save.state, c = this.save.clock, m = c.minutes;
    if (!this.settled() || this.watching) return null;
    const g = L(GUARDIANS.find((x) => x.id === this.save.character.guardian)!.your);
    const bar = (end: number, start: number) => Math.max(0, Math.min(1, (end - m) / (end - start)));
    if (isMatchDay(c.day) && !st.once.matchWatched && m >= 17 * 60 && m < MATCH_END) {
      return m < MATCH_TIP
        ? { text: L({ tr: `🏀 Bu akşam 19:00 · Darüşşafaka – Banvit · Spor Salonu'na git · ${MATCH_TIP - m} dk`, en: `🏀 Tonight at 19:00 · Darüşşafaka v Banvit · go to the Spor Salonu · ${MATCH_TIP - m} min` }), urgent: m >= MATCH_TIP - 15, progress: bar(MATCH_TIP, 17 * 60) }
        : { text: L({ tr: `🏀 Maç başladı! Spor Salonu'na koş · bitmesine ${MATCH_END - m} dk`, en: `🏀 The match is on! Run to the Spor Salonu · ${MATCH_END - m} min to go` }), urgent: true, progress: bar(MATCH_END, MATCH_TIP) };
    }
    const evci = (this.save.character.boarding ?? 'daimi') === 'evci';
    if (evci && isFriday(c.day) && m >= BUS_BOARDING && m < BUS_LEAVES && st.daily.weekendHome !== c.day) {
      return { text: L({ tr: `🚌 Hafta sonu servisi Ana Kapı'da · 17:00'de kalkıyor · ${BUS_LEAVES - m} dk`, en: `🚌 The weekend bus is at the main gate · leaves at 17:00 · ${BUS_LEAVES - m} min` }), urgent: m >= BUS_LEAVES - 20, progress: bar(BUS_LEAVES, BUS_BOARDING) };
    }
    if (carsiNow(c.day, m) && st.daily.wedvisit !== c.day) {
      return { text: L({ tr: `👪 Çarşı izni: ${g} kantinde (Spor Salonu) seni bekliyor · ${fmtTime(CARSI_END)}'e kadar · ${CARSI_END - m} dk`, en: `👪 Wednesday visit: ${g} is waiting at the canteen (Spor Salonu) · until ${fmtTime(CARSI_END)} · ${CARSI_END - m} min` }), urgent: CARSI_END - m <= 30, progress: bar(CARSI_END, CARSI_START) };
    }
    if (!evci && isSunday(c.day) && m >= VISIT_START && m < VISIT_END && st.daily.visit !== c.day) {
      return { text: L({ tr: `👪 Ziyaret günü: ${g} Ana Kapı'da seni bekliyor · ${fmtTime(VISIT_END)}'ya kadar · ${VISIT_END - m} dk`, en: `👪 Visiting day: ${g} is waiting at the main gate · until ${fmtTime(VISIT_END)} · ${VISIT_END - m} min` }), urgent: VISIT_END - m <= 30, progress: bar(VISIT_END, VISIT_START) };
    }
    const cer = this.isRaining() ? null : ceremonyWindow(c.day);
    if (cer && m >= cer[0] - 15 && m < cer[1]) {
      return { text: m < cer[0] ? L({ tr: `🇹🇷 Bayrak töreni ${fmtTime(cer[0])}'da Merkez Meydan'da · ${cer[0] - m} dk`, en: `🇹🇷 Flag ceremony at ${fmtTime(cer[0])} on the Merkez Meydan · ${cer[0] - m} min` }) : L({ tr: '🇹🇷 Bayrak töreni sürüyor · Merkez Meydan\'da sıraya gir', en: '🇹🇷 The flag ceremony is on · line up on the Merkez Meydan' }), urgent: m >= cer[0], progress: m < cer[0] ? bar(cer[0], cer[0] - 15) : bar(cer[1], cer[0]) };
    }
    return null;
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
    const hh = Math.floor(left / 60), mm = left % 60;
    const day = t('days').split(',')[weekdayOf(c.day)];
    const list = tasks.map((x) => `${x.done ? '✓' : '○'} ${x.name}`).join(' · ');
    if (left <= 0) { this.hud.setCountdown(L({ tr: '📋 Kayıt dönemi bitti', en: '📋 Registration is over' }), false, 0); return; }
    this.hud.setCountdown(L({ tr: `📋 Kayıt dönemi · ${day} · kalan süre ${hh} sa ${mm} dk · ${list}`, en: `📋 Registration · ${day} · ${hh} h ${mm} min left · ${list}` }),
      left < 120, left / RUSH_TOTAL);
  }

  /** the registration days' checkpoints: each evening (the desks shut until the next morning), every desk done (the
   *  class draw, and the day simply carries on), and the end on Sunday evening (whatever is left gets done for you) */
  private updateRush() {
    if (!this.rushOn() || this.blocked() || this.sleeping || this.drawing) return;
    const st = this.save.state;
    if (this.rushTasks().every((x) => x.done)) {
      this.rushDue = null;
      if (!st.once.classDrawn) this.classDraw(false, () => this.finishRush([])); else this.finishRush([]);
      return;
    }
    if (this.rushDue === 'night') {
      this.rushDue = null;
      const c = this.save.clock;
      if (c.day >= RUSH_DAYS) return;
      const names = t('days').split(',');
      const was = names[weekdayOf(c.day)], next = names[weekdayOf(c.day + 1)], last = c.day + 1 >= RUSH_DAYS;
      this.screenFade(() => {
        c.day += 1; c.minutes = RUSH_MORNING;
        st.energy = 100; st.hunger = Math.max(st.hunger, 60);
        this.npcClock = -1;
        this.lastDoor = this.nearestStand(this.ownDormLoc());
        this.room = null; this.enterDorm();
        this.player.setPosition((ROOM_OX + this.spots.bed[0] + 0.5) * TILE, (this.spots.bed[1] + 1.4) * TILE);
        this.refreshClockAndNeeds();
        this.hud.showModal({
          title: L({ tr: `🌙 Kayıt dönemi · ${was} bitti`, en: `🌙 Registration · ${was} is over` }), sub: `${next} 08:00`,
          body: last
            ? L({ tr: `${was} akşamı masalar kapandı; yorgun ama heyecanlı uyudun. Bugün ${next}, kaydın son günü: kalan işlerini akşam 18:00'e kadar bitir. Süre dolarsa görevliler eksikleri tamamlar.`, en: `On ${was} evening the desks closed, and you fell asleep tired but excited. It's ${next}, the last registration day: finish what's left by 18:00. If time runs out the staff finish the rest for you.` })
            : L({ tr: `${was} akşamı masalar kapandı; yorgun ama heyecanlı uyudun. Bugün ${next}: masalar 08:00'den 20:00'ye kadar açık. Kaydın Pazar 18:00'de bitiyor.`, en: `On ${was} evening the desks closed, and you fell asleep tired but excited. It's ${next}: the desks are open 08:00–20:00. Registration ends on Sunday at 18:00.` }),
          note: this.rushTasks().filter((x) => !x.done).map((x) => `○ ${x.name}`).join(' · ') || L({ tr: 'Her şey tamam!', en: 'All done!' }),
          button: L({ tr: 'Güne başla', en: 'Start the day' }),
        });
      });
      return;
    }
    if (this.rushDue === 'end') { this.rushDue = null; this.endRush(); }
  }

  /** time's up on Sunday evening: the staff finish your paperwork, the class is drawn, and the evening carries on */
  private endRush() {
    const st = this.save.state;
    const missing = this.rushTasks().filter((x) => !x.done).map((x) => x.name);
    if (!st.school.registered) st.school.registered = true;
    if (!st.once.healthCheck) st.once.healthCheck = true;
    if (!st.school.kit) { st.school.kit = true; if (st.wardrobe.wearing === 'sivil') st.wardrobe.wearing = 'uniforma'; this.dress(); }
    if (!st.school.books) st.school.books = true;
    if (!st.once.luggage) st.once.luggage = true;
    if (!st.once.classDrawn) this.classDraw(true, () => this.finishRush(missing)); else this.finishRush(missing);
  }

  /** registration is over: no jump in time, the day just goes on (lessons start on the first Monday) */
  private finishRush(missing: string[]) {
    const st = this.save.state, c = this.save.clock;
    this.drawing = false;
    st.once.rushDone = true;
    st.once.luggage = true;
    this.npcClock = -1;
    this.checkMissions();
    this.refreshClockAndNeeds();
    this.persist();
    const before = c.day < FIRST_MONDAY;
    const tomorrow = c.day + 1 >= FIRST_MONDAY;
    const evening = c.minutes >= ETUT_START;
    const goOn = evening
      ? L({ tr: 'Akşam oldu: ışıklar sönene kadar yurtların çevresinde serbestsin. ', en: "It's evening: you're free around the dorms until lights out. " })
      : L({ tr: 'Gün devam ediyor: kampüsü gez, arkadaşlarınla tanış. ', en: 'The day goes on: explore the campus and meet your classmates. ' });
    this.hud.showModal({
      title: L({ tr: '✅ Kayıt tamam!', en: '✅ Registration done!' }), sub: `${st.school.classLabel} · ${t('days').split(',')[weekdayOf(c.day)]} ${fmtTime(c.minutes)}`,
      body: (missing.length
        ? L({ tr: `Kayıt süresi doldu; yetişemediğin işleri (${missing.join(', ')}) görevliler senin yerine tamamladı. `, en: `Registration time ran out; the staff finished what you didn't get to (${missing.join(', ')}). ` })
        : L({ tr: 'Bütün işlerini kendin hallettin. ', en: 'You did it all yourself. ' }))
        + (before
          ? goOn + L(tomorrow ? { tr: 'Yarın dersler başlıyor, zil 08:30\'da.', en: 'Lessons start tomorrow; the bell goes at 08:30.' }
            : { tr: 'Dersler Pazartesi başlıyor, zil 08:30\'da.', en: 'Lessons start on Monday; the bell goes at 08:30.' })
          : goOn.trim()),
      note: st.wardrobe.wearing === 'sivil' ? L({ tr: 'Dolabından üniformanı giymeyi unutma.', en: "Don't forget to put your uniform on at your locker." }) : undefined,
      button: L({ tr: 'Harika!', en: 'Great!' }),
    });
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
      this.log({ kind: 'classdraw', a: pick });
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
    if (amount > 0 && def?.group && def.group === myGroup(st)) bonus *= 1.25; // your group
    if (amount > 0 && hasSecret(st, 'devre')) bonus *= 1.15; // Devre Ruhu
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
    if (def && before > -15 && st.friends[id] <= -15) this.log({ kind: 'fallout', a: def.name });
    if (def && before < FRIEND_AT && st.friends[id] >= FRIEND_AT) this.log({ kind: 'friend', a: def.name });
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
          this.log({ kind: 'mission', a: L(m.title) });
          st.xp += m.reward.xp;
          if (m.id === 'saglikli_yil') {
            this.save.character.attributes.fitness = growAttr(this.save.character.attributes.fitness, 10, st.year);
            this.save.character.respect = growRespect(this.save.character.respect, 50, st.year);
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
          // (challenges start quietly, and a side quest's giver has just told you about it)
          if (m.kind !== 'main') { st.announced.push(m.id); continue; }
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
    // one of the first nights, home rings you before bed (before you'd queue for the payphone yourself)
    if (this.room === 'dorm' && c.day <= HOME_CALLS_BY && !dilemmaDone(st, 'arama') && st.daily.call !== c.day && m >= 20 * 60 + 30 && m < 21 * 60 + 40) this.openDilemma('arama');
    else if (this.room === 'dorm' && !dilemmaDone(st, 'telefon') && st.daily.call !== c.day && m >= 21 * 60 && m < 21 * 60 + 50) this.openDilemma('telefon');
    else if (!this.room && c.day >= 2 && !dilemmaDone(st, 'arka') && phaseOf(m, c.day) === 'plaza' && m >= 20 * 60 + 20 && m < 21 * 60 + 40) {
      const tx = this.player.x / TILE, ty = this.player.y / TILE, r = PLAZA_EVENING;
      if (tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) this.openDilemma('arka');
    }
  }

  /** once you know your class, you're asked what this term will be about (once; later, at your desk) */
  private checkFocus() {
    const st = this.save.state;
    if (st.focus || st.once.focusAsked || !st.once.classDrawn || this.drawing || this.blocked() || this.sleeping) return;
    st.once.focusAsked = true;
    this.player.setVelocity(0, 0);
    const title = L({ tr: '🎯 Dönem odağı', en: '🎯 Term focus' });
    this.panel.open(() => ({ title, rooms: [{ id: 'focus', name: title, actions: [] }] }));
    void chooseFocus(this.gameCtx()).then(() => { if (this.panel.isOpen) this.panel.close(); this.persist(); });
  }

  /** how close a searching belletmen has to be to see you (Sessiz Adım shortens it) */
  private spotRange(): number {
    return SPOT_RANGE - (hasSecret(this.save.state, 'sessizAdim') ? 2 : 0);
  }

  /** who you are becoming opens secret skills: one at a time, when nothing else is on screen */
  private checkSecrets() {
    if (this.blocked() || this.sleeping) return;
    const st = this.save.state;
    const s = dueSecrets(st)[0];
    if (!s) return;
    st.secrets.push(s.id);
    const axis = AXES.find((a) => a.id === s.axis)!;
    const pole = L(s.dir > 0 ? axis.hi : axis.lo);
    sfx.success();
    this.hud.showModal({
      title: `✨ ${L({ tr: 'Gizli yetenek', en: 'Secret skill' })}: ${L(s.name)}`,
      sub: L({ tr: `${pole} yanın sana bir şey öğretti`, en: `Being ${pole.toLowerCase()} taught you something` }),
      body: L(s.effect),
      note: L({ tr: `Bu yetenek gizli: başkaları göremez. (${st.secrets.length}/${SECRETS.length})`, en: `This skill is secret: nobody else can see it. (${st.secrets.length}/${SECRETS.length})` }),
      button: t('close'),
    });
    this.persist();
  }

  private openDilemma(id: DilemmaId) {
    const c = this.save.clock;
    this.dilemmaWait = c.day * 1440 + c.minutes + 20;
    this.player.setVelocity(0, 0);
    const where = id === 'telefon' || id === 'arama' ? L({ tr: 'Yurt koridoru', en: 'Dorm corridor' }) : L({ tr: 'Yurdun arkası', en: 'Behind the dorm' });
    this.panel.open(() => ({ title: where, rooms: [{ id: 'dilemma', name: where, actions: [] }] }));
    void runDilemma(this.gameCtx(), id).then(() => { if (this.panel.isOpen) this.panel.close(); this.persist(); });
  }

  /** the first time on the campus: a short tour of the controls and the screen (once per save) */
  private showOnboarding(): boolean {
    if (this.save.flags.onboarded) return false;
    if (this.blocked() || this.drawing) return true;
    this.save.flags.onboarded = true;
    this.player.setVelocity(0, 0);
    this.touring = true;
    this.hud.openCard(onboardingCard(), ['Escape'], () => { this.touring = false; this.persist(); });
    return true;
  }

  private showNextAnnouncement() {
    if (this.showOnboarding()) return;
    if (!this.announceQueue.length || this.blocked()) return;
    const ids = this.announceQueue.splice(0);
    this.save.state.announced.push(...ids);
    this.player.setVelocity(0, 0);
    const card = announceManyCard(ids.map(missionById), this.mc());
    this.hud.openCard(card, ['Enter', 'Escape', ' ']);
    // "Görevlere git": close the card and open the Missions panel straight away
    card.querySelector('.goto-missions')?.addEventListener('click', () => {
      card.querySelector<HTMLButtonElement>('button.primary')?.click();
      this.showMissions();
    });
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
      <div class="sum-row"><span>${L({ tr: 'Dönem odağı', en: 'Term focus' })}</span><b>${focusLine(st)}</b></div>
      <div class="sum-row"><span>${L({ tr: 'Kim oluyorsun', en: "Who you're becoming" })}</span><b>${(() => { const mix = traitMix(ch); return arcLine(st, mixName(mix), mixLean(mix)); })()}</b></div>
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
    const mix = traitMix(ch);
    for (const [k, v] of Object.entries(g.attrs ?? {}) as Array<[AttrId, number]>) {
      const bonus = mixBonus(mix, k) * focusMult(st, k);
      // (it slows down near this year's ceiling: you're in the 4th grade with years to grow, see growAttr)
      ch.attributes[k] = growAttr(ch.attributes[k], v * bonus, st.year);
    }
    this.refreshClockAndNeeds();
    this.checkMissions();
    this.persist();
  }

  private changeMood(delta: number) {
    const st = this.save.state;
    // a carefree streak in your personality takes the edge off bad moments (Tasasız)
    if (delta < 0) delta *= moodGuard(traitMix(this.save.character));
    const next = clamp(st.mood + delta);
    // Kendi Kendine Yeter: never below 20 (unless it already was)
    st.mood = delta < 0 && hasSecret(st, 'yalniz') ? Math.max(next, Math.min(st.mood, 20)) : next;
  }

  /** what happens at a door depends on who you are (dorms by gender) */
  private doorNote(loc: Location): string {
    const c = this.save.character;
    if (loc.id === 'kiz_yurdu' || loc.id === 'erkek_yurdu') {
      const own = (loc.id === 'kiz_yurdu') === (c.gender === 'girl');
      if (!own) return t(loc.id === 'kiz_yurdu' ? 'locked_girls' : 'locked_boys');
      return t('own_dorm');
    }
    if (loc.id === 'teknik') return t('teknik_locked');
    if ((loc.id === 'cemiyet' || loc.id === 'muze') && isWeekend(this.save.clock.day)) return L({ tr: 'Hafta sonu kapalı. Pazartesi 08:00\'de açılır.', en: 'Closed at weekends. Opens Monday at 08:00.' });
    return '';
  }

  // ---------- clock ----------

  private tickClock(delta: number) {
    if (this.watching) return; // the match screen keeps its own time (online, you catch up afterwards)
    if (this.synced()) {
      // the campus doesn't wait for anyone: menus don't stop it either
      const n = this.worldLag();
      for (let i = 0; i < n; i++) this.stepMinute();
      if (n) this.refreshClockAndNeeds();
      return;
    }
    if (this.panel.isOpen || this.touring) return; // time stands still while you're inside a menu or the first tour (single-player prototype)
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
    // in class when a lesson begins (out on the pitch for PE): you can sit down any time in it without a late slip
    const lp = currentPeriod(c.day, c.minutes);
    if (lp?.kind === 'lesson' && c.minutes <= lp.start + 5 && (this.room === 'class' || (subjectFor(c.day, lp.id) === 'beden' && this.onPeGround()))) st.daily[presentKey(lp.id)] = c.day;
    if (before < LIGHTS_OUT && c.minutes >= LIGHTS_OUT) this.hud.toast(t('lights_out'));
    if (before < 7 * 60 && c.minutes >= 7 * 60) this.onMorning();
    const cer = this.isRaining() ? null : ceremonyWindow(c.day);
    if (cer && c.minutes === cer[0] - 5) this.hud.toast(L({ tr: '🇹🇷 Bayrak töreni birazdan Merkez Meydan\'da başlıyor.', en: '🇹🇷 The flag ceremony starts soon on the Merkez Meydan.' }));
    if (cer && c.minutes === cer[2]) this.flagCeremony();
    if (before < BUS_BOARDING && c.minutes >= BUS_BOARDING && isFriday(c.day) && (this.save.character.boarding ?? 'daimi') === 'evci' && st.school.registered) {
      this.hud.toast(L({ tr: '🚌 Hafta sonu servisi Ana Kapı\'da! 17:00\'de kalkıyor.', en: '🚌 The weekend bus is at the main gate! It leaves at 17:00.' }), 'good');
    }
    if (isMatchDay(c.day) && !st.once.matchWatched && this.settled()) {
      if (c.minutes === 9 * 60) this.hud.toast(L({ tr: '🏀 Bu akşam 19:00\'da Spor Salonu\'nda Darüşşafaka – Banvit maçı var! Etüt yok, herkes tribünde.', en: '🏀 Darüşşafaka v Banvit tonight at 19:00 in the Spor Salonu! No evening study, everyone will be in the stand.' }), 'good');
      if (c.minutes === MATCH_OPEN) { this.hud.toast(L({ tr: '🏀 Spor Salonu\'nun kapıları açıldı: maç 19:00\'da!', en: '🏀 The Spor Salonu doors are open: tip-off at 19:00!' }), 'good'); sfx.bell(); }
      if (c.minutes === MATCH_END) { st.once.matchMissed = true; this.hud.toast(L({ tr: '🏀 Maç bitti; sen kaçırdın.', en: "🏀 The match is over, and you missed it." })); }
    }
    if (c.day > getMatchDay() && !st.once.matchWatched && !st.once.matchMissed && this.settled()) st.once.matchMissed = true;
    if (before < CARSI_START && c.minutes >= CARSI_START && isWednesday(c.day)) {
      const guardian = L(GUARDIANS.find((g) => g.id === this.save.character.guardian)!.your);
      this.hud.toast(L({ tr: `📅 Çarşı izni! ${guardian} kantinde seni bekliyor (Spor Salonu).`, en: `📅 Wednesday visit! ${guardian} is waiting for you at the canteen (in the Spor Salonu).` }), 'good');
    }
    // the school bell rings at the start of every lesson
    if (PERIODS.some((p) => p.kind === 'lesson' && p.start === c.minutes) && !isWeekend(c.day) && this.lessonsOn() && this.time.now - this.lastBell > 2000) {
      this.lastBell = this.time.now;
      sfx.bell();
    }

    const asleep = this.sleepRun !== null && this.sleepRun.kind !== 'busy' && this.sleepRun.kind !== 'home';
    const awakeLate = !asleep && (c.minutes >= LIGHTS_OUT || c.minutes < WAKE_UP);
    st.hunger = clamp(st.hunger - (asleep ? 0.03 : 0.1));
    st.energy = clamp(st.energy + (asleep ? 110 / Math.max(60, this.sleepRun!.total) : -(awakeLate ? 0.06 : 0.035) * (hasSecret(st, 'keyif') ? 0.75 : 1)));
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
      if (c.day < RUSH_DAYS && c.minutes >= RUSH_NIGHT) this.rushDue ??= 'night';
      if (c.day > RUSH_DAYS || (c.day === RUSH_DAYS && c.minutes >= RUSH_END)) this.rushDue = 'end';
    }
    // (no growling stomach notices while you're asleep)
    if (st.hunger < 15 && !asleep && Math.floor(c.minutes / 60) !== this.hungerWarnedAt) {
      this.hungerWarnedAt = Math.floor(c.minutes / 60);
      this.hud.toast(L({ tr: 'Karnın gurulduyor… Yemekhane\'ye git, kantine uğra ya da dolabındaki atıştırmalıklardan ye.', en: 'Your stomach is growling… head to the dining hall, the canteen or the snacks in your locker.' }));
    }
  }

  /** the İstiklal Marşı at the flag: being in line counts */
  private flagCeremony() {
    const z = CENTER_ZONES[0], tx = this.player.x / TILE, ty = this.player.y / TILE;
    if (this.room || tx < z.x || tx >= z.x + z.w || ty < z.y || ty >= z.y + z.h) return;
    sfx.success();
    this.gain({ xp: 10, mood: 3 });
    this.hud.toast(L({ tr: '🇹🇷 İstiklal Marşı okundu; sen de sıradaydın.', en: '🇹🇷 The İstiklal Marşı was sung, and you were in line.' }), 'good');
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
      this.penalize(late.length * 3, L({ tr: `Murat Hoca: "Ödevin nerede?" (${late.length} yapılmamış ödev → 0 puan)`, en: `Mr. Murat: "Where's your homework?" (${late.length} missing → 0 points)` }));
      this.changeMood(-4);
    } else if (st.discipline > 0 && st.lastPenaltyDay < c.day - 1) {
      st.discipline = Math.max(0, st.discipline - (hasSecret(st, 'gozde') ? 4 : 2)); // a clean day helps your record
    }
    // a whole day under your focus without a discipline point counts towards Düzen
    if (st.lastPenaltyDay < c.day - 1 && st.focus && st.focus.since <= c.day - 1) focusTick(this.gameCtx(), 'order');
    // people who don't like you sometimes make your life harder
    const foes = dislikers(st);
    const shield = myGroup(st) ? 0.5 : 1;
    // (an abi or abla who has your back keeps them off you for a week)
    if (foes.length && !hasSecret(st, 'kalkan') && !((st.daily.protectedUntil ?? 0) >= c.day) && Math.random() < 0.45 * shield) this.time.delayedCall(1200, () => this.badSurprise(foes[Math.floor(Math.random() * foes.length)]));
    // every Sunday the family sends pocket money: how much depends on whether you're evci or daimi and who you lost
    const week = weekOf(c.day);
    if (weekdayOf(c.day) === 6 && st.lastAllowanceWeek < week) {
      st.lastAllowanceWeek = week;
      const ch = this.save.character;
      const amount = weeklyAllowance(ch.boarding ?? 'daimi', ch.loss);
      st.money += amount;
      const from = GUARDIANS.find((g) => g.id === ch.guardian)?.your ?? { tr: 'Ailen', en: 'Your family' };
      this.hud.toast(L({ tr: `💌 ${L(from)} harçlık gönderdi: +${amount} ₺`, en: `💌 ${L(from)} sent pocket money: +${amount} ₺` }), 'good');
    }
  }

  /** time passes because of an action. Offline the clock jumps ahead. Online there's one shared clock: you only wait it
   *  out when `wait` (a lesson until the bell); everything else is simply done, there and then */
  private advance(minutes: number, label?: string, onDone?: () => void, wait = true) {
    if (this.synced()) { if (wait) this.busyFor(minutes, label, onDone); else onDone?.(); return; }
    for (let i = 0; i < Math.round(minutes); i++) this.stepMinute();
    this.refreshClockAndNeeds();
    onDone?.();
  }

  /** online: you stay put while the campus clock runs on (several actions in a row add up) */
  private busyFor(minutes: number, label?: string, onDone?: () => void) {
    const m = Math.round(minutes);
    const s = this.sleepRun;
    if (s) {
      // already busy: the time adds on; asleep, eating or away, it's passing anyway
      if (s.kind === 'busy' && m > 0) { s.left += m; s.total += m; }
      if (onDone) { const prev = s.onDone; s.onDone = () => { prev?.(); onDone(); }; }
      return;
    }
    if (m <= 0) { onDone?.(); return; }
    this.sleeping = true;
    this.player.setVelocity(0, 0);
    this.player.anims.stop();
    this.sleepRun = { kind: 'busy', label, msPerMin: 0, acc: 0, left: m, total: m, busy: false, events: [], onDone };
  }

  // ---------- the campus clock (online) ----------

  /** online and moved in: your clock is the campus clock (registration weekend and solo play keep their own) */
  private synced(): boolean {
    // the registration days (and the rest of them, once you're done) stay on your own clock: the day carries on, and
    // you join the campus clock on the first Monday morning
    const c = this.save.clock;
    return this.net !== null && this.settled() && c.day * 24 * 60 + c.minutes >= FIRST_MONDAY * 24 * 60 + WAKE_UP;
  }

  /** the campus time in your own day numbers */
  private worldTarget(): number {
    const w = worldNow();
    this.worldOffset ??= alignOffset(this.save.clock, w);
    return absMinutes(w) - this.worldOffset * 24 * 60;
  }

  /**
   * How many game minutes your clock is behind the campus clock, to be played through now.
   * The first time in a session, or after a long gap (a hidden tab), it jumps straight there instead.
   * Ahead of the campus (it shouldn't happen), your clock simply waits for it.
   */
  private worldLag(): number {
    const fresh = this.worldOffset === null;
    let lag = this.worldTarget() - absMinutes(this.save.clock);
    if (lag < -24 * 60) { this.worldOffset = null; lag = this.worldTarget() - absMinutes(this.save.clock); }
    if (fresh || lag > CATCH_UP_MAX) { this.jumpToWorld(fresh); return 0; }
    return Math.max(0, lag);
  }

  /** straight to the campus time: nothing happens in between (no penalties, no hunger), it just went by */
  private jumpToWorld(arriving: boolean, toGate = false) {
    const c = this.save.clock;
    const to = this.worldTarget();
    const gap = to - absMinutes(c);
    this.fast = false;
    this.minuteAcc = 0;
    if (gap <= 0) { this.refreshClockAndNeeds(); return; }
    c.day = Math.floor(to / (24 * 60));
    c.minutes = to - c.day * 24 * 60;
    // whatever you were doing (sleep, a meal, the weekend at home…) has had that much time; night events you slept through are skipped
    const s = this.sleepRun;
    if (s && !s.busy) {
      s.left = Math.max(0, s.left - gap);
      for (const e of s.events) if (s.total - s.left >= e.at) e.done = true;
    }
    // after lessons it's dorm time: you're back in your dorm
    const toDorm = !toGate && !s && phaseOf(c.minutes, c.day) !== 'day' && this.room !== 'dorm' && !this.escort;
    if (toDorm) this.placeInDorm();
    this.npcClock = -1;
    this.refreshClockAndNeeds();
    if (gap >= 15) {
      const day = t('days').split(',')[weekdayOf(c.day)];
      this.hud.toast(arriving
        ? L({ tr: `🕒 Kampüs saatindesin: ${day} ${fmtTime(c.minutes)}.`, en: `🕒 You're on campus time: ${day} ${fmtTime(c.minutes)}.` })
        : L({ tr: `🕒 Kampüs saatine yetiştin: ${day} ${fmtTime(c.minutes)}.`, en: `🕒 Caught up with the campus clock: ${day} ${fmtTime(c.minutes)}.` }) + (toDorm ? L({ tr: ' Yurt saati: yatakhanendesin.', en: " It's dorm time: you're in your dorm room." }) : ''), 'good');
    }
    this.persist();
  }

  /** quietly into your dorm room, by your bed */
  private placeInDorm() {
    if (!this.room) this.outdoorZoom = this.cameras.main.zoom;
    this.tray = null; this.trayAt = null;
    this.lastDoor = this.nearestStand(this.ownDormLoc());
    this.room = 'dorm';
    this.player.setPosition((ROOM_OX + this.spots.bed[0] + 0.5) * TILE, (this.spots.bed[1] + 1.4) * TILE).setVelocity(0, 0);
    this.dir = 3;
    this.setCameraArea();
  }

  /** into bed: the night fast-forwards in about 3 seconds (online: on the campus clock, under a minute) (your roommates are asleep around you) */
  private sleep() {
    if (this.sleepRun || this.hud.modalOpen) return;
    this.showDiary(() => this.fallAsleep());
  }

  private fallAsleep() {
    if (this.sleepRun) return;
    const c = this.save.clock;
    const toMorning = c.minutes >= 7 * 60 ? 24 * 60 - c.minutes + 7 * 60 : 7 * 60 - c.minutes;
    this.sleeping = true;
    this.player.setVelocity(0, 0);
    this.player.anims.stop();
    this.player.setFrame(0);
    this.player.body!.enable = false;
    // into your pyjamas, if you have them (first: changing clothes picks a fresh frame)
    if (this.save.state.school.kit && this.save.state.wardrobe.wearing !== 'pijama' && this.save.state.wardrobe.wearing !== BORROWED) { this.save.state.wardrobe.wearing = 'pijama'; this.dress(); }
    if (this.room === 'dorm') { this.dir = 0; tuckIn(this.player, (ROOM_OX + this.spots.bed[0] + 0.5) * TILE, (this.spots.bed[1] + BED_Y) * TILE); } // (face up out of the pillow)
    this.sleepRun = { kind: 'sleep', msPerMin: Math.min(25 / 3, SLEEP_MS / toMorning), acc: 0, left: toMorning, total: toMorning, busy: false, events: this.nightEvents(toMorning) };
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
    // online: as many minutes as the campus clock has moved on (worldLag can also end the run outright)
    let steps = this.synced() ? Math.min(s.left, this.worldLag()) : -1;
    if (steps < 0) s.acc += delta;
    let changed = false;
    while (s.left > 0 && (steps < 0 ? s.acc >= s.msPerMin : steps-- > 0)) {
      if (steps < 0) s.acc -= s.msPerMin;
      s.left--;
      this.stepMinute();
      changed = true;
      // (something that happens in the night waits until you've closed the menu or the map you're looking at)
      const ev = this.hud.modalOpen || this.hud.bigOpen ? undefined : s.events.find((e) => !e.done && s.total - s.left >= e.at);
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
    // online every action takes its time on the shared campus clock: you wait it out here, or cut it short (what you did still counts)
    else if (s.kind === 'busy') this.hud.setBanner(`${s.label ?? L({ tr: '⏳ Meşgulsün', en: '⏳ Busy' })} · ${fmtTime(c.minutes)} → ${fmtTime((c.minutes + s.left) % (24 * 60))}`, { label: L({ tr: 'Erken bitir', en: 'Finish early' }), onClick: () => this.wakeUp(true) });
    else if (s.kind === 'home') this.hud.setBanner(L({ tr: `🏠 Evde hafta sonu… ${t('days').split(',')[weekdayOf(c.day)]} ${fmtTime(c.minutes)} · dönüş Pazar 17:40`, en: `🏠 Weekend at home… ${t('days').split(',')[weekdayOf(c.day)]} ${fmtTime(c.minutes)} · back Sunday 17:40` }), { label: L({ tr: 'Okula dön', en: 'Back to school' }), onClick: () => this.wakeUp(true) });
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
    getUp(this.player);
    this.player.body!.enable = true;
    if (this.room === 'dorm') this.player.setPosition((ROOM_OX + this.spots.bed[0] + 0.5) * TILE, (this.spots.bed[1] + 1.4) * TILE);
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
    // inactive: nothing pressed, clicked or touched for AFK_MS (the game stops until you're back)
    if (this.afkExempt()) this.lastActive = performance.now();
    else if (performance.now() - this.lastActive >= AFK_MS) { this.goAway(); return; }
    const k = this.keys;
    const blocked = this.blocked();
    let vx = 0, vy = 0;
    if (this.escort) [vx, vy] = this.escortFollow();
    else if (!blocked) {
      if (k.left.isDown || k.a.isDown) vx -= 1;
      if (k.right.isDown || k.d.isDown) vx += 1;
      if (k.up.isDown || k.w.isDown) vy -= 1;
      if (k.down.isDown || k.s.isDown) vy += 1;
      if (this.touch && !vx && !vy) { vx = this.touch.vector.x; vy = this.touch.vector.y; }
    }
    this.touch?.setHidden(blocked);
    const len = Math.hypot(vx, vy) || 1;
    const running = (k.shift.isDown || !!this.touch?.running) && this.save.state.energy > 10 && (vx !== 0 || vy !== 0);
    if (running) this.save.state.energy = clamp(this.save.state.energy - delta * 0.0008); // running tires you out
    const speed = this.escort ? ESCORT_SPEED : this.save.state.energy < 10 ? SPEED * 0.6 : running ? SPEED * 1.6 : SPEED;
    this.dust.setDepth(this.player.y + 15);
    this.dust.emitting = (vx !== 0 || vy !== 0) && !this.room && !this.inTunnel;
    this.dust.frequency = running ? 70 : 160;
    this.player.setVelocity((vx / len) * speed, (vy / len) * speed);
    if (vx || vy) {
      this.dir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? DIRS.left : DIRS.right) : vy < 0 ? DIRS.up : DIRS.down;
      this.player.anims.play(`player-walk-${['down', 'left', 'right', 'up'][this.dir]}`, true);
    } else {
      this.player.anims.stop();
      this.player.setFrame(this.dir * 3);
    }
    this.player.setDepth(this.inTunnel ? TUNNEL.y * TILE + 2 : this.player.y + 16);
    this.updateBuildingFade();
    const carrying = !this.save.state.once.luggage;
    this.suitcase.setVisible(carrying);
    if (carrying) this.suitcase.setPosition(this.player.x + (this.dir === 1 ? -11 : 11), this.player.y + 15).setDepth(this.inTunnel ? TUNNEL.y * TILE + 2 + (this.dir === 3 ? -0.5 : 0.5) : this.player.y + (this.dir === 3 ? 15 : 17));
    this.showNextAnnouncement();
    this.updateRush();
    this.checkDilemmas();
    this.checkSecrets();
    this.checkFocus();
    this.enforceCurfew();
    this.updateHunt(delta);
    this.updateCountdown();
    this.trackerTimer += delta;
    if (this.trackerTimer > 400) { this.trackerTimer = 0; this.updateTracker(); }

    this.updateNpcs(time);
    if (!this.room) {
      this.pushOutOfBuildings(this.player); for (const n of this.npcs) if (n.visible) this.pushOutOfBuildings(n);
      this.updateTerrace(this.player, true); for (const n of this.npcs) if (n.visible) this.updateTerrace(n, false);
    } else if (this.inTunnel) this.setTunnel(false);
    this.updateTunnelView();
    this.updatePeers(time);
    this.emoteTimer += delta;
    if (this.emoteTimer > 1400) { this.emoteTimer = 0; this.showEmote(); }
    this.updateRoom(time, delta);
    this.updateClass(time, delta);
    this.updateDining(time);
    this.revealAround();
    this.updatePrompt();
    this.guardDormBacks(time);
    if (this.sleepRun) this.updateSleep(delta); else this.tickClock(delta);
    if (this.player.getData('chair') && this.sleepRun?.kind !== 'eat') this.standUpFromTable(); // (however the meal ended)
    this.updateMatch(time);
    this.updateCharacters();

    this.drawNight();
    this.updateParticles();
    this.ambient.update(time, delta, { player: this.player, inside: this.inside, rain: this.isRaining(), dark: this.darkAlpha, hour: this.save.clock.minutes / 60 });
    this.yetim.update(time, delta, {
      player: this.player, inside: this.inside, rain: this.isRaining(), dark: this.darkAlpha,
      bond: this.save.state.friends.yetim ?? 0, engaged: !!this.panel?.isOpen && this.yetim.near(this.player),
    });
    this.mapTimer += delta;
    if (this.mapTimer > 100) { this.mapTimer = 0; this.updateMaps(); } // (the radar follows you, so it redraws often)
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
    this.save.state.daily = Object.fromEntries(Object.entries(this.save.state.daily).filter(([k, d]) => k === 'matchDay' || d >= this.save.clock.day - 1));
    writeSave(this.save);
    if (this.net) saveToCloud(this.net.id, this.save);
  }
}

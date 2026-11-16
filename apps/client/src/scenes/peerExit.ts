// When a real player leaves, the others don't see them blink out: for a few seconds they become an ordinary
// student, walk to the nearest door (or out of the room they were in) and fade away there, the way a disconnected
// player wanders off in GTA Online. A player whose game is paused, or who has gone quiet, shows as away (💤).
import Phaser from 'phaser';
import { L } from '../i18n';
import { LOCATIONS, TILE, doorStandTile } from '../content/campus';
import { EXIT, ROOM_OX } from '../content/dormroom';
import { CLASS_EXIT, CLASS_OX } from '../content/classroom';
import { DINING_EXIT, DINING_OX } from '../content/dining';
import type { PeerProfile } from '../net/multiplayer';

/** no position for this long (they send one at least every 3 s) and they're shown as away */
export const QUIET_MS = 10_000;
/** walking pace while leaving (px/s): a stroll, slower than a player */
const STROLL = 70;
/** the longest a leaving player stays on screen */
const LEAVE_MS = 8000;
const FADE_MS = 900;
/** a door further than this (tiles) is too far: they just walk off the way they were facing */
const DOOR_RANGE = 9;

export interface Leaving {
  /** where they're walking to (px) */
  x: number; y: number;
  started: number;
  /** it came from their goodbye, before presence noticed (then a fresh position means they're back) */
  byBye: boolean;
  fading: number | null;
}

/** the parts of a real player on screen that this needs */
export interface PeerOnScreen {
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  profile: PeerProfile;
  dir: number;
  room: string;
  seen: boolean;
  lastPos: number;
  away: boolean;
  leaving: Leaving | null;
}

/** where a leaving player heads: the way out of the room they're in, or the nearest door on the campus */
function exitPoint(p: PeerOnScreen): { x: number; y: number } {
  const sx = p.sprite.x, sy = p.sprite.y;
  const roomExit = (ox: number, tiles: Array<[number, number]>) => ({ x: (ox + (tiles[0][0] + tiles[1][0]) / 2 + 0.5) * TILE, y: (tiles[0][1] + 0.5) * TILE });
  if (p.room.startsWith('dorm')) return roomExit(ROOM_OX, EXIT);
  if (p.room === 'class') return roomExit(CLASS_OX, CLASS_EXIT);
  if (p.room === 'dining') return roomExit(DINING_OX, DINING_EXIT);
  let best: { x: number; y: number } | null = null, bestD = DOOR_RANGE * TILE;
  for (const loc of LOCATIONS) for (const d of loc.doors ?? []) {
    const s = doorStandTile(d);
    const x = (s.x + 0.5) * TILE, y = (s.y + 0.5) * TILE;
    const dist = Math.hypot(x - sx, y - sy);
    if (dist < bestD) { bestD = dist; best = { x, y }; }
  }
  if (best) return best;
  // no door near: a few steps on the way they were facing (down, left, right, up)
  const [dx, dy] = [[0, 1], [-1, 0], [1, 0], [0, -1]][p.dir] ?? [0, 1];
  return { x: sx + dx * 5 * TILE, y: sy + dy * 5 * TILE };
}

/** they left: from now on they're just a student walking away (no green dot, no menu) */
export function startLeaving(p: PeerOnScreen, now: number, byBye: boolean) {
  if (p.leaving) return;
  const to = exitPoint(p);
  p.leaving = { x: to.x, y: to.y, started: now, byBye, fading: null };
  p.away = false;
  p.label.setText(p.profile.name).setColor('#c9cdd0');
  p.sprite.setAlpha(1);
}

/** they came back before they were gone: they're themselves again */
export function cancelLeaving(p: PeerOnScreen) {
  if (!p.leaving) return;
  p.leaving = null;
  p.sprite.setAlpha(1);
  p.label.setAlpha(1);
}

/** one frame of walking off; true once they've faded away and can be removed */
export function stepLeaving(p: PeerOnScreen, now: number, delta: number, time: number): boolean {
  const l = p.leaving!;
  const dx = l.x - p.sprite.x, dy = l.y - p.sprite.y;
  const dist = Math.hypot(dx, dy);
  const arrived = dist < 4;
  if (!arrived && l.fading === null) {
    const step = Math.min(dist, (STROLL * Math.min(delta, 100)) / 1000);
    p.sprite.x += (dx / dist) * step;
    p.sprite.y += (dy / dist) * step;
    p.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0;
    p.sprite.setFrame(p.dir * 3 + [1, 0, 2, 0][Math.floor(time / 150) % 4]);
  } else p.sprite.setFrame(p.dir * 3);
  // through the door, or out of time: fade
  if (l.fading === null && (arrived || now - l.started > LEAVE_MS - FADE_MS)) l.fading = now;
  const a = l.fading === null ? 1 : Math.max(0, 1 - (now - l.fading) / FADE_MS);
  p.sprite.setAlpha(a).setDepth(p.sprite.y + 16);
  p.label.setAlpha(a).setPosition(p.sprite.x, p.sprite.y - 24);
  return a <= 0;
}

/** paused or gone quiet: a little 💤 and faded; back to normal when they move again */
export function showAway(p: PeerOnScreen, away: boolean, normalLabel: () => void) {
  if (p.leaving || p.away === away) return;
  p.away = away;
  if (away) { p.label.setText(`💤 ${p.profile.name}`).setColor('#c9cdd0'); p.sprite.setAlpha(0.6); }
  else { normalLabel(); p.sprite.setAlpha(1); }
}

/** E on someone who's walking off */
export function leftMessage(name: string) {
  return L({ tr: `${name} oyundan çıktı.`, en: `${name} has left the game.` });
}

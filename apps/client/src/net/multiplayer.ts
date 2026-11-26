// Live campus: everyone online in the same world sees each other move, chat and react.
// Supabase Realtime: presence = who is here (name + look), broadcast = movement, chat and emotes.
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { CharacterLook } from '../art/textures';
import { sb } from './supabase';
import type { Spots } from '../game/spots';

/** spots/since: the bed and desks you hold, and when you came online (older versions of the game send neither) */
export interface PeerProfile { id: string; name: string; look: CharacterLook; grade: number; gender: 'girl' | 'boy'; spots?: Spots; since?: number }
/** lying: asleep in bed (older versions of the game don't send it) */
export interface PeerPos { id: string; x: number; y: number; dir: number; moving: boolean; room: string; lying?: boolean }

type Handlers = {
  onJoin?: (p: PeerProfile) => void;
  /** presence changed (someone came, went, or took another bed or desk) */
  onSync?: () => void;
  onLeave?: (id: string) => void;
  onPos?: (p: PeerPos) => void;
  onChat?: (from: string, name: string, text: string) => void;
  onEmote?: (from: string, emoji: string) => void;
  /** someone sent you a friend request or accepted yours (only a nudge: check the database for what's true) */
  onFriend?: (from: string, kind: FriendNudge) => void;
  /** someone is closing the game on purpose (presence notices a little later) */
  onBye?: (id: string) => void;
  /** someone's game is paused (their tab is in the background) or running again */
  onStatus?: (id: string, away: boolean) => void;
  /** a message meant only for you from another player (a treat, an invitation to play, a move in a game…) */
  onPeer?: (from: string, msg: PeerMsg) => void;
};

export type FriendNudge = 'request' | 'accepted' | 'removed';

/** two-player games played over the channel */
export type PeerGame = 'yetimball' | 'rps';

/** one player to another (everyone receives it, only `to` acts on it; it's play, not anything that must stay secret) */
export type PeerMsg =
  | { kind: 'invite'; gid: string; game: PeerGame; name: string }
  | { kind: 'reply'; gid: string; ok: boolean; busy?: boolean }
  | { kind: 'cancel'; gid: string }
  | { kind: 'move'; gid: string; n: number; v: number | string }
  | { kind: 'social'; act: 'treat' | 'joke' | 'nick'; name: string; text?: string }
  | { kind: 'borrow'; name: string }
  | { kind: 'lend'; ok: boolean; name: string };

export class Multiplayer {
  private channel: RealtimeChannel | null = null;
  private lastSent = 0;
  private lastKey = '';
  readonly peers = new Map<string, PeerProfile>();

  constructor(private me: PeerProfile, private h: Handlers) {}

  async connect(world = 'world-1') {
    const c = sb();
    if (!c) return false;
    const ch = c.channel(world, { config: { presence: { key: this.me.id }, broadcast: { self: false } } });
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState<PeerProfile>();
      const now = new Set<string>();
      for (const [id, metas] of Object.entries(state)) {
        if (id === this.me.id || !metas[0]) continue;
        now.add(id);
        const p = metas[0] as unknown as PeerProfile;
        const isNew = !this.peers.has(id);
        this.peers.set(id, p);
        if (isNew) this.h.onJoin?.(p);
      }
      for (const id of [...this.peers.keys()]) if (!now.has(id)) { this.peers.delete(id); this.h.onLeave?.(id); }
      this.h.onSync?.();
    });
    ch.on('broadcast', { event: 'pos' }, ({ payload }) => this.h.onPos?.(payload as PeerPos));
    ch.on('broadcast', { event: 'chat' }, ({ payload }) => {
      const p = payload as { id: string; name: string; text: string };
      this.h.onChat?.(p.id, p.name, String(p.text).slice(0, 140));
    });
    ch.on('broadcast', { event: 'emote' }, ({ payload }) => this.h.onEmote?.((payload as { id: string }).id, (payload as { e: string }).e));
    ch.on('broadcast', { event: 'bye' }, ({ payload }) => { const id = (payload as { id: string }).id; if (typeof id === 'string') this.h.onBye?.(id); });
    ch.on('broadcast', { event: 'status' }, ({ payload }) => {
      const p = payload as { id: string; away: boolean };
      if (typeof p.id === 'string') this.h.onStatus?.(p.id, !!p.away);
    });
    ch.on('broadcast', { event: 'peer' }, ({ payload }) => {
      const p = payload as { to: string; from: string; msg: PeerMsg };
      if (p.to === this.me.id && typeof p.from === 'string' && p.msg && typeof p.msg.kind === 'string') this.h.onPeer?.(p.from, p.msg);
    });
    ch.on('broadcast', { event: 'friend' }, ({ payload }) => {
      const p = payload as { to: string; from: string; kind: FriendNudge };
      if (p.to === this.me.id && typeof p.from === 'string') this.h.onFriend?.(p.from, p.kind);
    });
    const ok = await new Promise<boolean>((resolve) => ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') { await ch.track(this.me); resolve(true); }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') resolve(false);
    }));
    if (!ok) { void c.removeChannel(ch); return false; }
    this.channel = ch;
    // say goodbye first, so the others see you walk off at once rather than when the server notices
    window.addEventListener('pagehide', () => { this.bye(); void this.disconnect(); });
    return true;
  }

  /** you took another bed or desk: everyone sees it in your presence */
  setSpots(spots: Spots) {
    this.me = { ...this.me, spots };
    void this.channel?.track(this.me);
  }

  /** sends your position at most ~5 times a second, and only when something changed */
  sendPos(p: Omit<PeerPos, 'id'>, now: number) {
    if (!this.channel) return;
    const key = `${Math.round(p.x * 4)}|${Math.round(p.y * 4)}|${p.dir}|${p.moving}|${p.room}|${!!p.lying}`;
    if (key === this.lastKey && now - this.lastSent < 3000) return; // heartbeat every 3 s while idle
    if (now - this.lastSent < 200) return;
    this.lastKey = key;
    this.lastSent = now;
    void this.channel.send({ type: 'broadcast', event: 'pos', payload: { id: this.me.id, ...p } });
  }

  chat(text: string) {
    void this.channel?.send({ type: 'broadcast', event: 'chat', payload: { id: this.me.id, name: this.me.name, text: text.slice(0, 140) } });
  }

  emote(e: string) {
    void this.channel?.send({ type: 'broadcast', event: 'emote', payload: { id: this.me.id, e } });
  }

  /** a message for one other player */
  toPeer(to: string, msg: PeerMsg) {
    void this.channel?.send({ type: 'broadcast', event: 'peer', payload: { to, from: this.me.id, msg } });
  }

  /** tells another player (if they're online) to look at their friends list again */
  nudgeFriend(to: string, kind: FriendNudge) {
    void this.channel?.send({ type: 'broadcast', event: 'friend', payload: { to, from: this.me.id, kind } });
  }

  /** you're closing the game */
  bye() {
    void this.channel?.send({ type: 'broadcast', event: 'bye', payload: { id: this.me.id } });
  }

  /** your game paused (away) or running again */
  status(away: boolean) {
    void this.channel?.send({ type: 'broadcast', event: 'status', payload: { id: this.me.id, away } });
  }

  async disconnect() {
    if (this.channel) await sb()?.removeChannel(this.channel);
    this.channel = null;
  }
}

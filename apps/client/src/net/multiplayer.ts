// Live campus: everyone online in the same world sees each other move, chat and react.
// Supabase Realtime: presence = who is here (name + look), broadcast = movement, chat and emotes.
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { CharacterLook } from '../art/textures';
import { sb } from './supabase';

export interface PeerProfile { id: string; name: string; look: CharacterLook; grade: number; gender: 'girl' | 'boy' }
export interface PeerPos { id: string; x: number; y: number; dir: number; moving: boolean; room: string }

type Handlers = {
  onJoin?: (p: PeerProfile) => void;
  onLeave?: (id: string) => void;
  onPos?: (p: PeerPos) => void;
  onChat?: (from: string, name: string, text: string) => void;
  onEmote?: (from: string, emoji: string) => void;
};

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
        if (!this.peers.has(id)) { const p = metas[0] as unknown as PeerProfile; this.peers.set(id, p); this.h.onJoin?.(p); }
      }
      for (const id of [...this.peers.keys()]) if (!now.has(id)) { this.peers.delete(id); this.h.onLeave?.(id); }
    });
    ch.on('broadcast', { event: 'pos' }, ({ payload }) => this.h.onPos?.(payload as PeerPos));
    ch.on('broadcast', { event: 'chat' }, ({ payload }) => {
      const p = payload as { id: string; name: string; text: string };
      this.h.onChat?.(p.id, p.name, String(p.text).slice(0, 140));
    });
    ch.on('broadcast', { event: 'emote' }, ({ payload }) => this.h.onEmote?.((payload as { id: string }).id, (payload as { e: string }).e));
    const ok = await new Promise<boolean>((resolve) => ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') { await ch.track(this.me); resolve(true); }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') resolve(false);
    }));
    if (!ok) { void c.removeChannel(ch); return false; }
    this.channel = ch;
    window.addEventListener('pagehide', () => void this.disconnect());
    return true;
  }

  /** sends your position at most ~5 times a second, and only when something changed */
  sendPos(p: Omit<PeerPos, 'id'>, now: number) {
    if (!this.channel) return;
    const key = `${Math.round(p.x * 4)}|${Math.round(p.y * 4)}|${p.dir}|${p.moving}|${p.room}`;
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

  async disconnect() {
    if (this.channel) await sb()?.removeChannel(this.channel);
    this.channel = null;
  }
}

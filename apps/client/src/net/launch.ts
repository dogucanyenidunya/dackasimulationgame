// The waitlist and the launch switch (tables staff, game_settings and waitlist; see supabase/schema.sql).
// While the game is closed, players make their character and wait in the lobby; owners and testers play as usual.
// The switch lives in the database, so it's the same for everyone; the lobby hears about it on the 'lobby' channel.
import type { RealtimeChannel } from '@supabase/supabase-js';
import { sb } from './supabase';
import type { CharacterLook } from '../art/textures';

export interface GameStatus {
  open: boolean;
  /** when it opens, if the owner has said (ISO time), for the lobby's countdown */
  opensAt: string | null;
  role: 'owner' | 'tester' | null;
  /** your place on the waitlist (null until you've joined) */
  position: number | null;
  total: number;
}

/**
 * The game's state for you. null when it can't be told (offline build, the database not set up yet, no connection):
 * the game then behaves as it did before the waitlist existed, so nobody is shut out by mistake.
 */
export async function gameStatus(): Promise<GameStatus | null> {
  const c = sb();
  if (!c) return null;
  const { data, error } = await c.rpc('game_status');
  if (error || !data) { if (error) console.warn('[launch]', error.message); return null; }
  const d = data as { open: boolean; opens_at: string | null; role: string | null; position: number | null; total: number };
  return {
    open: !!d.open,
    opensAt: d.opens_at ?? null,
    role: d.role === 'owner' || d.role === 'tester' ? d.role : null,
    position: d.position ?? null,
    total: Number(d.total) || 0,
  };
}

/** you can't play yet: the game is closed and you're not an owner or tester */
export const mustWait = (s: GameStatus | null) => !!s && !s.open && !s.role;

/** onto the waitlist (once); returns your place */
export async function joinWaitlist(): Promise<number | null> {
  const c = sb();
  if (!c) return null;
  const { data, error } = await c.rpc('join_waitlist');
  return error ? null : (data as number);
}

/** owners only: open or close the game (and the launch time shown in the lobby); returns an error message or null */
export async function setGameOpen(open: boolean, opensAt: string | null): Promise<string | null> {
  const c = sb();
  if (!c) return 'offline';
  const { error } = await c.rpc('set_game_open', { p_open: open, p_opens_at: opensAt });
  if (error) return error.message;
  await nudgeLobby();
  return null;
}

/** tells everyone waiting in the lobby to look again (only a nudge: what counts is the database) */
async function nudgeLobby() {
  const c = sb();
  if (!c) return;
  const ch = c.channel('lobby');
  await new Promise<void>((resolve) => {
    const t = window.setTimeout(resolve, 4000);
    ch.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return;
      void ch.send({ type: 'broadcast', event: 'launch', payload: {} }).finally(() => { window.clearTimeout(t); resolve(); });
    });
  });
  await c.removeChannel(ch);
}

/** someone waiting in the lobby, as the others see them */
export interface LobbyMember { id: string; name: string; look: CharacterLook }

/** longest lobby chat message */
export const LOBBY_CHAT_MAX = 140;

export interface LobbyLink {
  leave: () => void;
  /** a chat line to everyone in the lobby right now (nothing is stored: people who come later don't see it) */
  chat: (text: string) => void;
  /** tells another player in the lobby to look at their friends list again (a request, or an accepted one) */
  nudgeFriend: (to: string) => void;
}

/**
 * In the lobby: you're shown to the others (name and look), `onMembers` with everyone waiting right now (you included),
 * `onNudge` when the owner opens or closes the game, `onFriend` when someone sends you a friend request or accepts yours.
 */
export function joinLobby(me: LobbyMember, h: { onNudge: () => void; onMembers: (m: LobbyMember[]) => void; onFriend: (from: string) => void; onChat: (from: string, name: string, text: string) => void }): LobbyLink {
  const c = sb();
  if (!c) return { leave: () => {}, chat: () => {}, nudgeFriend: () => {} };
  const ch: RealtimeChannel = c.channel('lobby', { config: { presence: { key: me.id } } });
  ch.on('broadcast', { event: 'launch' }, () => h.onNudge());
  ch.on('broadcast', { event: 'friend' }, ({ payload }) => {
    const p = payload as { to: string; from: string };
    if (p.to === me.id && typeof p.from === 'string') h.onFriend(p.from);
  });
  ch.on('broadcast', { event: 'chat' }, ({ payload }) => {
    const p = payload as { id: string; name: string; text: string };
    if (typeof p.id !== 'string' || typeof p.text !== 'string' || !p.text.trim()) return;
    h.onChat(p.id, String(p.name ?? '').slice(0, 40), p.text.trim().slice(0, LOBBY_CHAT_MAX));
  });
  ch.on('presence', { event: 'sync' }, () => {
    const out: LobbyMember[] = [];
    for (const [id, metas] of Object.entries(ch.presenceState<{ name?: unknown; look?: unknown }>())) {
      const m = metas[0];
      if (!m) continue;
      out.push({ id, name: typeof m.name === 'string' ? m.name.slice(0, 40) : '', look: (m.look && typeof m.look === 'object' ? m.look : {}) as CharacterLook });
    }
    h.onMembers(out);
  });
  ch.subscribe((status) => { if (status === 'SUBSCRIBED') void ch.track({ name: me.name, look: me.look }); });
  return {
    leave: () => { void c.removeChannel(ch); },
    chat: (text) => { void ch.send({ type: 'broadcast', event: 'chat', payload: { id: me.id, name: me.name, text: text.trim().slice(0, LOBBY_CHAT_MAX) } }); },
    nudgeFriend: (to) => { void ch.send({ type: 'broadcast', event: 'friend', payload: { to, from: me.id } }); },
  };
}

/** one person on the waitlist, as the owner sees them */
export interface WaitlistEntry { pos: number; id: string; name: string; email: string; joinedAt: string; look: CharacterLook | null }

/** owners only: everyone on the waitlist, in order; null if it can't be fetched (not an owner, or not set up) */
export async function listWaitlist(): Promise<WaitlistEntry[] | null> {
  const c = sb();
  if (!c) return null;
  const { data, error } = await c.rpc('list_waitlist');
  if (error) { console.warn('[launch]', error.message); return null; }
  return (data as Array<{ pos: number; user_id: string; name: string; email: string; joined_at: string; look: unknown }>).map((r) => ({
    pos: Number(r.pos), id: r.user_id, name: r.name ?? '', email: r.email ?? '', joinedAt: r.joined_at,
    look: r.look && typeof r.look === 'object' ? (r.look as CharacterLook) : null,
  }));
}

/** who is in the lobby right now, without showing up there yourself (for the owner); returns a function that stops */
export function watchLobby(onIds: (ids: Set<string>) => void): () => void {
  const c = sb();
  if (!c) return () => {};
  const ch = c.channel('lobby');
  ch.on('presence', { event: 'sync' }, () => onIds(new Set(Object.keys(ch.presenceState()))));
  ch.subscribe();
  return () => { void c.removeChannel(ch); };
}

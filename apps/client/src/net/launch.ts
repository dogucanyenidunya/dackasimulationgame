// The waitlist and the launch switch (tables staff, game_settings and waitlist; see supabase/schema.sql).
// While the game is closed, players make their character and wait in the lobby; owners and testers play as usual.
// The switch lives in the database, so it's the same for everyone; the lobby hears about it on the 'lobby' channel.
import type { RealtimeChannel } from '@supabase/supabase-js';
import { sb } from './supabase';

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

/**
 * In the lobby: `onNudge` when the owner opens or closes the game, `onCount` with how many are waiting in the lobby
 * right now. Returns a function that leaves.
 */
export function joinLobby(me: string, onNudge: () => void, onCount: (n: number) => void): () => void {
  const c = sb();
  if (!c) return () => {};
  const ch: RealtimeChannel = c.channel('lobby', { config: { presence: { key: me } } });
  ch.on('broadcast', { event: 'launch' }, () => onNudge());
  ch.on('presence', { event: 'sync' }, () => onCount(Object.keys(ch.presenceState()).length));
  ch.subscribe((status) => { if (status === 'SUBSCRIBED') void ch.track({ at: Date.now() }); });
  return () => { void c.removeChannel(ch); };
}

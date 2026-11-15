// Friends and invite links (Supabase tables `profiles`, `invites`, `friendships`; see supabase/schema.sql).
// Everything goes through database functions that check who is asking, so a player can only change their own friendships.
import { sb } from './supabase';

export interface Friend {
  id: string;
  name: string;
  /** pending = a request; accepted = friends */
  status: 'pending' | 'accepted';
  /** for a request: true if they asked you */
  incoming: boolean;
}

export type RequestResult = 'requested' | 'accepted' | 'pending' | 'already' | 'limit' | 'error';
export interface RedeemResult { status: 'friends' | 'already' | 'self' | 'invalid'; id?: string; name?: string }

const INVITE_KEY = 'dacka.invite';

/** your friends and requests; null if the friends tables aren't set up (or you're offline) */
export async function listFriends(): Promise<Friend[] | null> {
  const c = sb();
  if (!c) return null;
  const { data, error } = await c.rpc('list_friends');
  if (error) { console.warn('[friends]', error.message); return null; }
  return (data as Friend[]).map((f) => ({ id: f.id, name: f.name, status: f.status, incoming: f.incoming }));
}

/** the name friends see for you (your character's first name) */
export async function setMyName(name: string) {
  await sb()?.rpc('set_my_name', { p_name: name.slice(0, 40) });
}

export async function requestFriend(id: string): Promise<RequestResult> {
  const c = sb();
  if (!c) return 'error';
  const { data, error } = await c.rpc('request_friend', { p_other: id });
  return error ? 'error' : (data as RequestResult);
}

export async function respondFriend(id: string, accept: boolean): Promise<boolean> {
  const { error } = (await sb()?.rpc('respond_friend', { p_other: id, p_accept: accept })) ?? { error: true };
  return !error;
}

/** unfriend, or take back a request you sent */
export async function removeFriend(id: string): Promise<boolean> {
  const { error } = (await sb()?.rpc('remove_friend', { p_other: id })) ?? { error: true };
  return !error;
}

/** your personal invite code; `reset` makes a new one and switches the old link off */
export async function myInviteCode(reset = false): Promise<string | null> {
  const c = sb();
  if (!c) return null;
  const { data, error } = await c.rpc('my_invite_code', { p_reset: reset });
  return error ? null : (data as string);
}

export function inviteUrl(code: string): string {
  return `${location.origin}${location.pathname}?invite=${encodeURIComponent(code)}`;
}

/** the inviter's name ('' if they haven't named a character yet), null if the code is unknown, undefined on an error */
export async function inviteInfo(code: string): Promise<string | null | undefined> {
  const c = sb();
  if (!c) return undefined;
  const { data, error } = await c.rpc('invite_info', { p_code: code });
  if (error) return undefined;
  return (data as string | null) ?? null;
}

export async function redeemInvite(code: string): Promise<RedeemResult | null> {
  const c = sb();
  if (!c) return null;
  const { data, error } = await c.rpc('redeem_invite', { p_code: code });
  return error ? null : (data as RedeemResult);
}

/**
 * Picks up `?invite=CODE` from the address and keeps it until it's used, so it survives signing in
 * (the email link brings you back without it). Only the invite part of the address is removed:
 * the sign-in link's own parameters must stay for Supabase to read.
 */
export function pendingInvite(): string | null {
  const params = new URLSearchParams(location.search);
  const fromUrl = params.get('invite')?.trim();
  if (fromUrl && /^[A-Za-z0-9_-]{4,40}$/.test(fromUrl)) {
    try { localStorage.setItem(INVITE_KEY, fromUrl); } catch { /* private mode: still used for this visit */ }
  }
  if (params.has('invite')) {
    params.delete('invite');
    const q = params.toString();
    history.replaceState(null, '', `${location.pathname}${q ? `?${q}` : ''}${location.hash}`);
  }
  try { return localStorage.getItem(INVITE_KEY) ?? fromUrl ?? null; } catch { return fromUrl ?? null; }
}

export function clearPendingInvite() {
  try { localStorage.removeItem(INVITE_KEY); } catch { /* ignore */ }
}

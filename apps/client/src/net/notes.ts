// Notes between friends (Supabase table `notes`, see supabase/schema.sql), blocking, and the note-email setting.
// As with friends, everything goes through database functions that check who is asking.
import { sb } from './supabase';

export interface Note { id: number; sender: string; name: string; body: string; createdAt: string; read: boolean }
export type SendResult = 'sent' | 'not_friends' | 'empty' | 'limit' | 'error';

export const NOTE_MAX = 140;

/** your pigeonhole, newest first; null if notes aren't set up (or you're offline) */
export async function listNotes(limit = 30): Promise<Note[] | null> {
  const c = sb();
  if (!c) return null;
  const { data, error } = await c.rpc('list_notes', { p_limit: limit });
  if (error) { console.warn('[notes]', error.message); return null; }
  return (data as Array<{ id: number; sender: string; name: string; body: string; created_at: string; read: boolean }>)
    .map((n) => ({ id: n.id, sender: n.sender, name: n.name, body: n.body, createdAt: n.created_at, read: n.read }));
}

export async function sendNote(to: string, body: string): Promise<SendResult> {
  const c = sb();
  if (!c) return 'error';
  const { data, error } = await c.rpc('send_note', { p_to: to, p_body: body.slice(0, NOTE_MAX) });
  return error ? 'error' : (data as SendResult);
}

export async function markNotesRead(ids: number[]) {
  if (ids.length) await sb()?.rpc('mark_notes_read', { p_ids: ids });
}

/** ends the friendship, removes their notes and stops them reaching you again */
export async function blockPlayer(id: string): Promise<boolean> {
  const { error } = (await sb()?.rpc('block_player', { p_other: id })) ?? { error: true };
  return !error;
}

export async function noteEmailsOn(): Promise<boolean | null> {
  const c = sb();
  if (!c) return null;
  const { data, error } = await c.rpc('note_emails_on');
  return error ? null : (data as boolean);
}

export async function setNoteEmails(on: boolean): Promise<boolean> {
  const { error } = (await sb()?.rpc('set_note_emails', { p_on: on })) ?? { error: true };
  return !error;
}

/** the `?unsubscribe=TOKEN` from a note email's "stop these emails" link, if we arrived from one */
export function pendingUnsubscribe(): string | null {
  const token = new URLSearchParams(location.search).get('unsubscribe');
  return token && /^[0-9a-f-]{36}$/i.test(token) ? token : null;
}

export function clearUnsubscribe() {
  const url = new URL(location.href);
  url.searchParams.delete('unsubscribe');
  history.replaceState(null, '', url.pathname + url.search + url.hash);
}

/** switches note emails off with the token from the email (no sign-in needed) */
export async function unsubscribeNoteEmails(token: string): Promise<boolean> {
  const c = sb();
  if (!c) return false;
  const { data, error } = await c.functions.invoke('note-email', { body: { unsubscribe: token } });
  return !error && (data as { ok?: boolean } | null)?.ok === true;
}

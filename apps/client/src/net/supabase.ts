// Supabase connection. Online features switch on only when the build has a project URL and public key
// (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY); without them the game runs exactly as before, offline.
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const online = !!url && !!key;

let client: SupabaseClient | null = null;
export function sb(): SupabaseClient | null {
  if (!online) return null;
  client ??= createClient(url!, key!, { auth: { persistSession: true, detectSessionInUrl: true, flowType: 'pkce' } });
  return client;
}

export async function currentSession(): Promise<Session | null> {
  const c = sb();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data.session;
}

/** emails a one-click sign-in link that brings the player back to this page */
export async function sendSignInLink(email: string): Promise<string | null> {
  const c = sb();
  if (!c) return 'offline';
  const redirect = `${location.origin}${location.pathname}`;
  const { error } = await c.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
  return error ? error.message : null;
}

/** signs in with the one-time code from the same email. Works in any browser, and survives mail scanners
 *  (e.g. Outlook Safe Links) that open the link first and use it up. */
export async function verifySignInCode(email: string, code: string): Promise<string | null> {
  const c = sb();
  if (!c) return 'offline';
  const { error } = await c.auth.verifyOtp({ email, token: code, type: 'email' });
  return error ? error.message : null;
}

/** if we arrived from an email link that failed (expired / already used), returns its error code and tidies the URL */
export function takeLinkError(): string | null {
  const params = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.slice(1));
  const code = params.get('error_code') ?? hash.get('error_code') ?? params.get('error') ?? hash.get('error');
  if (code) history.replaceState(null, '', location.pathname);
  return code;
}

export async function signOut() {
  await sb()?.auth.signOut();
}

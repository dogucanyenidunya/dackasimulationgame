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

/** the sign-in token from an email link (…?token_hash=…&type=email), if we arrived from one. Reading it
 *  doesn't use it up: that waits for the player's button press, so a mail scanner that only opens the
 *  page can't spend it. */
export function pendingLinkToken(): { tokenHash: string; type: 'email' | 'magiclink' | 'signup' } | null {
  const params = new URLSearchParams(location.search);
  const tokenHash = params.get('token_hash');
  if (!tokenHash) return null;
  const t = params.get('type');
  return { tokenHash, type: t === 'magiclink' || t === 'signup' ? t : 'email' };
}

export async function verifyLinkToken(link: { tokenHash: string; type: 'email' | 'magiclink' | 'signup' }): Promise<string | null> {
  const c = sb();
  if (!c) return 'offline';
  const { error } = await c.auth.verifyOtp({ token_hash: link.tokenHash, type: link.type });
  return error ? error.message : null;
}

/** takes the email-link token out of the address (keeping anything else there) */
export function clearLinkToken() {
  const url = new URL(location.href);
  url.searchParams.delete('token_hash');
  url.searchParams.delete('type');
  history.replaceState(null, '', url.pathname + url.search + url.hash);
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

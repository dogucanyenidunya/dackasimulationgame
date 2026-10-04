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

export async function signOut() {
  await sb()?.auth.signOut();
}

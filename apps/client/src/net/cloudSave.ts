// Saves in Supabase (table `saves`, one row per player, protected by row-level security).
import { restConfig, sb } from './supabase';
import { upgradeSave, type SaveData } from '../save';

export async function loadCloudSave(userId: string): Promise<SaveData | null> {
  const c = sb();
  if (!c) return null;
  const { data, error } = await c.from('saves').select('data').eq('user_id', userId).maybeSingle();
  if (error || !data) return null;
  const save = data.data as SaveData;
  if (!save || save.v !== 2 || !save.character) return null;
  // saves made by an older version are brought up to date, as for a save in this browser
  return upgradeSave(save);
}

let pending: SaveData | null = null;
let timer: number | null = null;
let lastUser = '';
/** the signed-in player's token, kept at hand: when the page is closing there's no time to look it up */
let token = '';

async function flush() {
  timer = null;
  const c = sb();
  if (!c || !pending || !lastUser) return;
  const data = pending;
  pending = null;
  await c.from('saves').upsert({ user_id: lastUser, data, updated_at: new Date().toISOString() });
}

/** queues a cloud save; writes at most every 15 seconds, and right away when the tab is hidden */
export function saveToCloud(userId: string, data: SaveData) {
  void sb()?.auth.getSession().then(({ data: auth }) => { if (auth.session) token = auth.session.access_token; });
  if (!sb()) return;
  lastUser = userId;
  pending = JSON.parse(JSON.stringify(data)) as SaveData;
  if (timer === null) timer = window.setTimeout(() => void flush(), 15_000);
}

/** writes the waiting save now, in a way that survives the page closing (the tab is going to the background or away) */
export function flushCloudSave() {
  if (timer === null) return;
  window.clearTimeout(timer);
  timer = null;
  const cfg = restConfig();
  const body = pending && lastUser ? JSON.stringify({ user_id: lastUser, data: pending, updated_at: new Date().toISOString() }) : '';
  // a keepalive request carries on after the page is gone, but only up to 64 KB: a bigger save goes the usual way
  if (!cfg || !token || !body || body.length > 60_000) { void flush(); return; }
  pending = null;
  try {
    void fetch(`${cfg.url}/rest/v1/saves?on_conflict=user_id`, {
      method: 'POST', keepalive: true, body,
      headers: { apikey: cfg.key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    });
  } catch { /* the save in this browser still has it */ }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushCloudSave(); });
  window.addEventListener('pagehide', () => flushCloudSave());
}

export async function deleteCloudSave(userId: string) {
  await sb()?.from('saves').delete().eq('user_id', userId);
}

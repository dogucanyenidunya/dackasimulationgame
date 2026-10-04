// Saves in Supabase (table `saves`, one row per player, protected by row-level security).
import { sb } from './supabase';
import type { SaveData } from '../save';

export async function loadCloudSave(userId: string): Promise<SaveData | null> {
  const c = sb();
  if (!c) return null;
  const { data, error } = await c.from('saves').select('data').eq('user_id', userId).maybeSingle();
  if (error || !data) return null;
  return data.data as SaveData;
}

let pending: SaveData | null = null;
let timer: number | null = null;
let lastUser = '';

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
  if (!sb()) return;
  lastUser = userId;
  pending = JSON.parse(JSON.stringify(data)) as SaveData;
  if (timer === null) timer = window.setTimeout(() => void flush(), 15_000);
}

export function flushCloudSave() {
  if (timer !== null) { window.clearTimeout(timer); void flush(); }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushCloudSave(); });
}

export async function deleteCloudSave(userId: string) {
  await sb()?.from('saves').delete().eq('user_id', userId);
}

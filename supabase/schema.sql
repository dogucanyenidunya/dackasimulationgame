-- Daçka: run this once in your Supabase project (SQL Editor → New query → Run).
-- One save per player. Row-level security makes sure each player can only read and write their own save.

create table if not exists public.saves (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;

drop policy if exists "read own save"   on public.saves;
drop policy if exists "insert own save" on public.saves;
drop policy if exists "update own save" on public.saves;
drop policy if exists "delete own save" on public.saves;

create policy "read own save"   on public.saves for select using (auth.uid() = user_id);
create policy "insert own save" on public.saves for insert with check (auth.uid() = user_id);
create policy "update own save" on public.saves for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own save" on public.saves for delete using (auth.uid() = user_id);

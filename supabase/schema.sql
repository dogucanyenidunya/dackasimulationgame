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

-- ---------------------------------------------------------------------------------------------
-- Friends and invite links. Safe to run again: it only adds what's missing and replaces the functions.
-- Players never write these tables directly; everything goes through the functions below,
-- which check who is asking (auth.uid()).

-- the name other players see in your friends list (your character's first name)
create table if not exists public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  name       text not null default '' check (char_length(name) <= 40),
  updated_at timestamptz not null default now()
);

-- one personal invite code per player; making a new one switches the old link off
create table if not exists public.invites (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  code       text not null unique,
  created_at timestamptz not null default now()
);

-- a friend request (pending) or a friendship (accepted); one row per pair, whichever way round
create table if not exists public.friendships (
  requester  uuid not null references auth.users (id) on delete cascade,
  addressee  uuid not null references auth.users (id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);
create unique index if not exists friendships_pair on public.friendships (least(requester, addressee), greatest(requester, addressee));

alter table public.profiles    enable row level security;
alter table public.invites     enable row level security;
alter table public.friendships enable row level security;

drop policy if exists "read own profile"     on public.profiles;
drop policy if exists "read own invite"      on public.invites;
drop policy if exists "read own friendships" on public.friendships;
create policy "read own profile"     on public.profiles    for select using (auth.uid() = user_id);
create policy "read own invite"      on public.invites     for select using (auth.uid() = user_id);
create policy "read own friendships" on public.friendships for select using (auth.uid() in (requester, addressee));

create or replace function public.set_my_name(p_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.profiles (user_id, name, updated_at) values (auth.uid(), left(coalesce(p_name, ''), 40), now())
  on conflict (user_id) do update set name = excluded.name, updated_at = now();
end $$;

-- your invite code (made the first time you ask); p_reset = true makes a new one and the old link stops working
create or replace function public.my_invite_code(p_reset boolean default false) returns text
language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select code into v_code from public.invites where user_id = auth.uid();
  if v_code is null or p_reset then
    v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
    insert into public.invites (user_id, code) values (auth.uid(), v_code)
    on conflict (user_id) do update set code = excluded.code, created_at = now();
  end if;
  return v_code;
end $$;

-- who sent this invite (their name), so the title screen can say so before you sign in; null if the code is unknown
create or replace function public.invite_info(p_code text) returns text
language sql security definer set search_path = '' stable as $$
  select coalesce(p.name, '') from public.invites i left join public.profiles p on p.user_id = i.user_id where i.code = p_code;
$$;

-- opening a friend's invite link makes you friends straight away (they asked by sending it, you by opening it)
create or replace function public.redeem_invite(p_code text) returns json
language plpgsql security definer set search_path = '' as $$
declare v_from uuid; v_name text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select i.user_id, coalesce(p.name, '') into v_from, v_name
    from public.invites i left join public.profiles p on p.user_id = i.user_id where i.code = p_code;
  if v_from is null then return json_build_object('status', 'invalid'); end if;
  if v_from = auth.uid() then return json_build_object('status', 'self', 'id', v_from, 'name', v_name); end if;
  if exists (select 1 from public.friendships where status = 'accepted'
             and least(requester, addressee) = least(v_from, auth.uid()) and greatest(requester, addressee) = greatest(v_from, auth.uid())) then
    return json_build_object('status', 'already', 'id', v_from, 'name', v_name);
  end if;
  -- a request either way between you two becomes a friendship; otherwise start one
  update public.friendships set status = 'accepted'
    where least(requester, addressee) = least(v_from, auth.uid()) and greatest(requester, addressee) = greatest(v_from, auth.uid());
  if not found then
    insert into public.friendships (requester, addressee, status) values (v_from, auth.uid(), 'accepted');
  end if;
  return json_build_object('status', 'friends', 'id', v_from, 'name', v_name);
end $$;

-- ask someone you met on campus to be friends. If they already asked you, you're friends now.
-- returns 'requested' | 'accepted' | 'pending' (you already asked) | 'already' | 'limit'
create or replace function public.request_friend(p_other uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare r public.friendships;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_other is null or p_other = auth.uid() then raise exception 'not a valid player'; end if;
  select * into r from public.friendships
    where least(requester, addressee) = least(p_other, auth.uid()) and greatest(requester, addressee) = greatest(p_other, auth.uid());
  if found then
    if r.status = 'accepted' then return 'already'; end if;
    if r.requester = auth.uid() then return 'pending'; end if;
    update public.friendships set status = 'accepted' where requester = p_other and addressee = auth.uid();
    return 'accepted';
  end if;
  if (select count(*) from public.friendships where requester = auth.uid() and status = 'pending') >= 50 then return 'limit'; end if;
  insert into public.friendships (requester, addressee) values (auth.uid(), p_other);
  return 'requested';
end $$;

-- accept or decline a request someone sent you
create or replace function public.respond_friend(p_other uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_accept then
    update public.friendships set status = 'accepted' where requester = p_other and addressee = auth.uid() and status = 'pending';
  else
    delete from public.friendships where requester = p_other and addressee = auth.uid() and status = 'pending';
  end if;
end $$;

-- unfriend, or take back a request you sent
create or replace function public.remove_friend(p_other uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.friendships
    where (requester = auth.uid() and addressee = p_other) or (requester = p_other and addressee = auth.uid());
end $$;

-- your friends and requests, with their names
create or replace function public.list_friends()
returns table (id uuid, name text, status text, incoming boolean, since timestamptz)
language sql security definer set search_path = '' stable as $$
  select case when f.requester = auth.uid() then f.addressee else f.requester end,
         coalesce(p.name, ''), f.status, f.addressee = auth.uid(), f.created_at
    from public.friendships f
    left join public.profiles p on p.user_id = case when f.requester = auth.uid() then f.addressee else f.requester end
   where auth.uid() in (f.requester, f.addressee)
   order by f.created_at;
$$;

revoke all on function public.set_my_name(text), public.my_invite_code(boolean), public.invite_info(text), public.redeem_invite(text),
  public.request_friend(uuid), public.respond_friend(uuid, boolean), public.remove_friend(uuid), public.list_friends() from public, anon;
grant execute on function public.set_my_name(text), public.my_invite_code(boolean), public.invite_info(text), public.redeem_invite(text),
  public.request_friend(uuid), public.respond_friend(uuid, boolean), public.remove_friend(uuid), public.list_friends() to authenticated;
-- the invite banner on the title screen shows who invited you before you sign in
grant execute on function public.invite_info(text) to anon;

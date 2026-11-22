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
  if exists (select 1 from public.blocks where (blocker = auth.uid() and blocked = v_from) or (blocker = v_from and blocked = auth.uid())) then
    return json_build_object('status', 'invalid');
  end if;
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
  -- a block either way: say nothing about it, just don't connect them
  if exists (select 1 from public.blocks where (blocker = auth.uid() and blocked = p_other) or (blocker = p_other and blocked = auth.uid())) then
    return 'pending';
  end if;
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

-- ---------------------------------------------------------------------------------------------
-- Daily care: notes between friends, blocking, and the "a friend left you a note" email (GDD §6.2.2).
-- Safe to run again. As with friends, players only go through the functions below.

-- a short note from one friend to another; it shows in the recipient's pigeonhole straight away
create table if not exists public.notes (
  id         bigint generated always as identity primary key,
  sender     uuid not null references auth.users (id) on delete cascade,
  recipient  uuid not null references auth.users (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 140),
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index if not exists notes_inbox on public.notes (recipient, created_at desc);
create index if not exists notes_sent  on public.notes (sender, created_at desc);

-- a block ends the friendship and stops notes and friend requests, either way round
create table if not exists public.blocks (
  blocker    uuid not null references auth.users (id) on delete cascade,
  blocked    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);

-- note emails: on unless you switch them off; at most one a day (the email function keeps track)
create table if not exists public.email_prefs (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  note_emails        boolean not null default true,
  unsubscribe_token  uuid not null unique default gen_random_uuid(),
  last_note_email_at timestamptz
);

alter table public.notes       enable row level security;
alter table public.blocks      enable row level security;
alter table public.email_prefs enable row level security;

drop policy if exists "read own notes"       on public.notes;
drop policy if exists "read own blocks"      on public.blocks;
drop policy if exists "read own email prefs" on public.email_prefs;
create policy "read own notes"       on public.notes       for select using (auth.uid() in (sender, recipient));
create policy "read own blocks"      on public.blocks      for select using (auth.uid() = blocker);
create policy "read own email prefs" on public.email_prefs for select using (auth.uid() = user_id);

-- leave a note for a friend. Returns 'sent' | 'not_friends' | 'empty' | 'limit'
create or replace function public.send_note(p_to uuid, p_body text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_body text := btrim(coalesce(p_body, ''));
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if char_length(v_body) = 0 then return 'empty'; end if;
  v_body := left(v_body, 140);
  if not exists (select 1 from public.friendships where status = 'accepted'
                 and least(requester, addressee) = least(p_to, auth.uid()) and greatest(requester, addressee) = greatest(p_to, auth.uid())) then
    return 'not_friends';
  end if;
  if exists (select 1 from public.blocks where (blocker = auth.uid() and blocked = p_to) or (blocker = p_to and blocked = auth.uid())) then
    return 'not_friends';
  end if;
  -- no flooding: 30 notes a day in all, 5 a day to the same friend
  if (select count(*) from public.notes where sender = auth.uid() and created_at > now() - interval '24 hours') >= 30
     or (select count(*) from public.notes where sender = auth.uid() and recipient = p_to and created_at > now() - interval '24 hours') >= 5 then
    return 'limit';
  end if;
  insert into public.notes (sender, recipient, body) values (auth.uid(), p_to, v_body);
  return 'sent';
end $$;

-- your pigeonhole: the latest notes friends left you, newest first
create or replace function public.list_notes(p_limit int default 30)
returns table (id bigint, sender uuid, name text, body text, created_at timestamptz, read boolean)
language sql security definer set search_path = '' stable as $$
  select n.id, n.sender, coalesce(p.name, ''), n.body, n.created_at, n.read_at is not null
    from public.notes n left join public.profiles p on p.user_id = n.sender
   where n.recipient = auth.uid()
   order by n.created_at desc
   limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

create or replace function public.mark_notes_read(p_ids bigint[]) returns void
language sql security definer set search_path = '' as $$
  update public.notes set read_at = now() where recipient = auth.uid() and read_at is null and id = any(p_ids);
$$;

-- block someone: ends any friendship or request and removes the notes they left you
create or replace function public.block_player(p_other uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_other is null or p_other = auth.uid() then raise exception 'not a valid player'; end if;
  insert into public.blocks (blocker, blocked) values (auth.uid(), p_other) on conflict do nothing;
  delete from public.friendships
    where (requester = auth.uid() and addressee = p_other) or (requester = p_other and addressee = auth.uid());
  delete from public.notes where sender = p_other and recipient = auth.uid();
end $$;

create or replace function public.unblock_player(p_other uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.blocks where blocker = auth.uid() and blocked = p_other;
$$;

-- whether you get an email when a friend leaves you a note (on unless you switched it off)
create or replace function public.note_emails_on() returns boolean
language sql security definer set search_path = '' stable as $$
  select coalesce((select note_emails from public.email_prefs where user_id = auth.uid()), true);
$$;

create or replace function public.set_note_emails(p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.email_prefs (user_id, note_emails) values (auth.uid(), coalesce(p_on, true))
  on conflict (user_id) do update set note_emails = excluded.note_emails;
end $$;

-- for the email function only (service role): may we email this player about a note now?
-- Yes at most once every 20 hours, and never if they switched note emails off. Returns their unsubscribe token, or null.
create or replace function public.claim_note_email(p_user uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_token uuid;
begin
  insert into public.email_prefs (user_id) values (p_user) on conflict (user_id) do nothing;
  update public.email_prefs set last_note_email_at = now()
   where user_id = p_user and note_emails
     and (last_note_email_at is null or last_note_email_at < now() - interval '20 hours')
  returning unsubscribe_token into v_token;
  return v_token;
end $$;

-- for the email function only: the "stop these emails" link
create or replace function public.unsubscribe_note_emails(p_token uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.email_prefs set note_emails = false where unsubscribe_token = p_token;
  return found;
end $$;

revoke all on function public.send_note(uuid, text), public.list_notes(int), public.mark_notes_read(bigint[]),
  public.block_player(uuid), public.unblock_player(uuid), public.note_emails_on(), public.set_note_emails(boolean),
  public.claim_note_email(uuid), public.unsubscribe_note_emails(uuid) from public, anon, authenticated;
grant execute on function public.send_note(uuid, text), public.list_notes(int), public.mark_notes_read(bigint[]),
  public.block_player(uuid), public.unblock_player(uuid), public.note_emails_on(), public.set_note_emails(boolean) to authenticated;
grant execute on function public.claim_note_email(uuid), public.unsubscribe_note_emails(uuid) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Waitlist and the launch switch. Safe to run again.
-- While the game is closed, players sign in, make their character and wait in the lobby;
-- owners and testers play as usual. Only an owner can open or close the game.
--
-- ⚠ Running this closes the game for everyone who isn't an owner or tester. Add yourself first:
--   insert into public.staff (user_id, role) select id, 'owner' from auth.users where email = 'YOUR EMAIL'
--   on conflict (user_id) do update set role = excluded.role;
-- and friends who already play (role 'tester') the same way.

-- who may play before launch: 'owner' (and can open or close the game) or 'tester'. Edited only in the dashboard.
create table if not exists public.staff (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  role     text not null check (role in ('owner', 'tester')),
  added_at timestamptz not null default now()
);

-- one row: is the game open to everyone, and (optionally) when it opens, for the lobby's countdown
create table if not exists public.game_settings (
  id         boolean primary key default true check (id),
  is_open    boolean not null default false,
  opens_at   timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.game_settings (id) values (true) on conflict (id) do nothing;

-- everyone who made their character while the game was closed, in the order they joined
create table if not exists public.waitlist (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now()
);

alter table public.staff         enable row level security;
alter table public.game_settings enable row level security;
alter table public.waitlist      enable row level security;
-- (no policies: nobody reads or writes these directly; the functions below do it)

-- the state of the game for whoever asks: open or not, the launch time, your role, your place on the waitlist
create or replace function public.game_status() returns json
language sql security definer set search_path = '' stable as $$
  select json_build_object(
    'open',     s.is_open,
    'opens_at', s.opens_at,
    'role',     (select role from public.staff where user_id = auth.uid()),
    'position', (select n from (select user_id, row_number() over (order by joined_at, user_id) as n from public.waitlist) w where w.user_id = auth.uid()),
    'total',    (select count(*) from public.waitlist))
  from public.game_settings s where s.id;
$$;

-- you made your character while the game is closed: you're on the list (once); returns your place
create or replace function public.join_waitlist() returns int
language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.waitlist (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  select n into v_n from (select user_id, row_number() over (order by joined_at, user_id) as n from public.waitlist) w where w.user_id = auth.uid();
  return v_n;
end $$;

-- owners only: open or close the game, and set (or clear) the launch time shown in the lobby
create or replace function public.set_game_open(p_open boolean, p_opens_at timestamptz default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.staff where user_id = auth.uid() and role = 'owner') then raise exception 'owners only'; end if;
  update public.game_settings set is_open = p_open, opens_at = p_opens_at, updated_at = now() where id;
end $$;

revoke all on function public.game_status(), public.join_waitlist(), public.set_game_open(boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.game_status() to anon, authenticated;
grant execute on function public.join_waitlist(), public.set_game_open(boolean, timestamptz) to authenticated;

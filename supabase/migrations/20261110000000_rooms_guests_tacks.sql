-- Challenge rooms, guest players, and thumbtacks.
--
-- What's new:
--   * Guests: anyone can play with just a nickname (Supabase anonymous
--     sign-in; turn it on in the dashboard, see supabase/README.md). Guests
--     are real users, so everything below works the same for them.
--   * Rooms: a creator shares a "base" (their room, desk, and what's already
--     there) plus a wishlist; friends join with the link and each submit one
--     entry designed on top of the base. The creator crowns a winner.
--   * Thumbtacks: the board's currency. One tack per person per setup, never
--     your own. Counts only change through toggle_tack(), like points.

-- ---------- Names ----------

-- Usernames come from sign-up metadata (GitHub, or the nickname a guest
-- typed); keep them a sane length.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'user_name'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'preferred_username'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
        'desk-maxxer'
      ),
      40
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Rename yourself (guests pick a nickname; anyone can change theirs).
create function public.set_username(name text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  clean text := regexp_replace(trim(coalesce(name, '')), '\s+', ' ', 'g');
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if char_length(clean) not between 1 and 24 or clean !~ '^[[:alnum:] _.''-]+$' then
    raise exception 'Names are 1–24 letters, numbers, spaces, or - _ . ''' using errcode = '22023';
  end if;
  update public.profiles set username = clean where id = auth.uid();
  return clean;
end;
$$;

revoke execute on function public.set_username(text) from public;
grant execute on function public.set_username(text) to authenticated;

-- ---------- Rooms ----------

-- Short, easy-to-type room codes (no 0/o, 1/l/i).
create function public.make_room_code() returns text
language sql volatile set search_path = '' as $$
  select string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', 1 + floor(random() * 31)::int, 1), '')
  from generate_series(1, 6)
$$;

create function public.valid_setup(setup jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(setup -> 'desk') = 'object'
    and jsonb_typeof(setup -> 'items') = 'array'
    and jsonb_array_length(setup -> 'items') <= 200
    and coalesce(jsonb_typeof(setup -> 'wallItems'), 'array') = 'array'
    and coalesce(jsonb_array_length(setup -> 'wallItems'), 0) <= 100
    and pg_column_size(setup) < 200000
$$;

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default public.make_room_code() check (code ~ '^[a-z0-9]{6}$'),
  owner_id uuid not null default auth.uid() references public.profiles on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  brief text not null default '' check (char_length(brief) <= 280),
  -- [{ assetId: string | null, label: string, qty: number }]
  wishlist jsonb not null default '[]' check (
    jsonb_typeof(wishlist) = 'array'
    and jsonb_array_length(wishlist) <= 30
    and pg_column_size(wishlist) < 20000
  ),
  -- The creator's setup everyone designs on top of ({ room, desk, items, wallItems }).
  base jsonb not null check (public.valid_setup(base)),
  thumbnail_path text,
  winner_id uuid, -- an entry in this room (constraint added below)
  created_at timestamptz not null default now()
);

create index rooms_owner_idx on public.rooms (owner_id);

alter table public.rooms enable row level security;
-- Anyone with the link can see a room.
create policy "Rooms are public" on public.rooms for select using (true);
create policy "Create your own rooms" on public.rooms for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "Edit your own rooms" on public.rooms for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Delete your own rooms" on public.rooms for delete to authenticated
  using (owner_id = (select auth.uid()));

-- The base is fixed once the room exists (everyone's entry builds on it).
revoke insert, update on public.rooms from anon, authenticated;
grant insert (title, brief, wishlist, base, thumbnail_path) on public.rooms to authenticated;
grant update (title, brief, wishlist, winner_id) on public.rooms to authenticated;

-- Who has joined which room (so "my rooms" can list them).
create table public.room_members (
  room_id uuid not null references public.rooms on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index room_members_user_idx on public.room_members (user_id);

alter table public.room_members enable row level security;
create policy "Room members are public" on public.room_members for select using (true);
create policy "Join rooms yourself" on public.room_members for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Leave rooms yourself" on public.room_members for delete to authenticated
  using (user_id = (select auth.uid()));
revoke update on public.room_members from anon, authenticated;

-- ---------- Entries and tacks on setups ----------

-- An entry is a setup with a room. One per person per room (resubmitting
-- updates it). If the room is deleted, entries stay on the board.
alter table public.setups
  add column room_id uuid references public.rooms on delete set null,
  add column tacks integer not null default 0;

alter table public.setups drop constraint setups_setup_check;
alter table public.setups add constraint setups_setup_check check (public.valid_setup(setup));

create unique index setups_one_entry_per_room_idx on public.setups (room_id, owner_id);
create index setups_tacks_idx on public.setups (tacks desc);

grant insert (room_id) on public.setups to authenticated;

alter table public.rooms
  add constraint rooms_winner_fk foreign key (winner_id) references public.setups on delete set null;

-- The winner has to be an entry in that room.
create function public.check_room_winner() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.winner_id is not null and not exists (
    select 1 from public.setups where id = new.winner_id and room_id = new.id
  ) then
    raise exception 'The winner has to be an entry in this room.' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger rooms_check_winner
  before insert or update of winner_id on public.rooms
  for each row execute function public.check_room_winner();

-- ---------- Thumbtacks ----------

create table public.tacks (
  setup_id uuid not null references public.setups on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (setup_id, user_id)
);

create index tacks_created_idx on public.tacks (created_at desc);
create index tacks_user_recent_idx on public.tacks (user_id, created_at desc);

-- You can see your own tacks (to show which setups you tacked); they're only
-- written by toggle_tack().
alter table public.tacks enable row level security;
revoke all on public.tacks from anon, authenticated;
grant select on public.tacks to anon, authenticated; -- anon sees none (no policy for anon)
create policy "See your own tacks" on public.tacks for select to authenticated
  using (user_id = (select auth.uid()));

-- Tack a setup, or take your tack back. Returns { tacked, tacks }.
create function public.toggle_tack(target uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  setup_owner uuid;
  new_count integer;
begin
  if me is null then
    raise exception 'Pick a name first, then you can tack.' using errcode = '42501';
  end if;

  -- 60 tacks a minute is plenty for a real person.
  if (select count(*) from public.tacks where user_id = me and created_at > now() - interval '1 minute') >= 60 then
    raise exception 'Whoa, slow down! Try again in a minute.' using errcode = 'P0001';
  end if;

  select owner_id into setup_owner from public.setups where id = target for update;
  if setup_owner is null then
    raise exception 'That setup no longer exists.' using errcode = 'P0002';
  end if;
  if setup_owner = me then
    raise exception 'You can''t tack your own setup.' using errcode = '42501';
  end if;

  delete from public.tacks where setup_id = target and user_id = me;
  if found then
    update public.setups set tacks = greatest(0, tacks - 1) where id = target returning tacks into new_count;
    return jsonb_build_object('tacked', false, 'tacks', new_count);
  end if;

  insert into public.tacks (setup_id, user_id) values (target, me);
  update public.setups set tacks = tacks + 1 where id = target returning tacks into new_count;
  return jsonb_build_object('tacked', true, 'tacks', new_count);
end;
$$;

revoke execute on function public.toggle_tack(uuid) from public;
grant execute on function public.toggle_tack(uuid) to authenticated;

-- The most-tacked setups this week (weeks start Monday, UTC), with how many
-- tacks each got this week. Ties go to the one with more tacks overall.
create function public.top_of_week(lim integer default 24)
returns table (setup_id uuid, week_tacks integer)
language sql stable security definer set search_path = '' as $$
  select t.setup_id, count(*)::integer as week_tacks
  from public.tacks t
  join public.setups s on s.id = t.setup_id
  where t.created_at >= date_trunc('week', now())
  group by t.setup_id, s.tacks
  order by count(*) desc, s.tacks desc, t.setup_id
  limit least(greatest(lim, 1), 100)
$$;

revoke execute on function public.top_of_week(integer) from public;
grant execute on function public.top_of_week(integer) to anon, authenticated;

-- ---------- Views ----------

-- Board cards gain tacks, the room they were made for, and whether you
-- tacked them. (New columns go at the end: get_matchup returns this type.)
create or replace view public.setup_cards with (security_invoker = on) as
select
  s.id, s.owner_id, s.title, s.description, s.tags, s.setup, s.thumbnail_path,
  s.points, s.wins, s.losses, s.created_at,
  p.username, p.avatar_url,
  s.tacks, s.room_id,
  exists (select 1 from public.tacks t where t.setup_id = s.id and t.user_id = (select auth.uid())) as tacked_by_me
from public.setups s
join public.profiles p on p.id = s.owner_id;

-- Rooms with their creator and how many entries they have.
create view public.room_cards with (security_invoker = on) as
select
  r.id, r.code, r.owner_id, r.title, r.brief, r.wishlist, r.base, r.thumbnail_path,
  r.winner_id, r.created_at,
  p.username, p.avatar_url,
  (select count(*) from public.setups s where s.room_id = r.id)::integer as entry_count
from public.rooms r
join public.profiles p on p.id = r.owner_id;

grant select on public.room_cards to anon, authenticated;

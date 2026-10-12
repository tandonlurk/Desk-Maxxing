-- Published setups, the inspiration board, and 1v1 voting.
--
-- Who can do what:
--   * Anyone (even signed out) can see published setups and vote in 1v1s.
--   * Signed-in users can publish, edit, and delete their own setups.
--   * Points only change through cast_vote(); nobody can write them directly.

-- ---------- Profiles (one per GitHub sign-in) ----------

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "Profiles are public" on public.profiles for select using (true);
-- Filled in by the trigger below; clients never write profiles.
revoke insert, update, delete on public.profiles from anon, authenticated;

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'user_name',
      new.raw_user_meta_data ->> 'preferred_username',
      new.raw_user_meta_data ->> 'name',
      'desk-maxxer'
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Anyone who signed up before this migration ran.
insert into public.profiles (id, username, avatar_url)
select
  id,
  coalesce(raw_user_meta_data ->> 'user_name', raw_user_meta_data ->> 'name', 'desk-maxxer'),
  raw_user_meta_data ->> 'avatar_url'
from auth.users
on conflict (id) do nothing;

-- ---------- Setups ----------

-- Tags are short lowercase slugs ("gaming", "dual-monitor"), at most 5.
create function public.valid_tags(tags text[]) returns boolean
language sql immutable set search_path = '' as $$
  select cardinality(tags) <= 5
    and coalesce(bool_and(tag ~ '^[a-z0-9-]{1,24}$'), true)
  from unnest(tags) as tag
$$;

create table public.setups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  description text not null default '' check (char_length(description) <= 280),
  tags text[] not null default '{}' check (public.valid_tags(tags)),
  -- { desk: {...}, items: [...] }, the same shape the planner edits.
  setup jsonb not null check (
    jsonb_typeof(setup -> 'desk') = 'object'
    and jsonb_typeof(setup -> 'items') = 'array'
    and jsonb_array_length(setup -> 'items') <= 200
    and pg_column_size(setup) < 200000
  ),
  -- Path inside the "thumbnails" storage bucket.
  thumbnail_path text,
  points integer not null default 1000,
  wins integer not null default 0,
  losses integer not null default 0,
  created_at timestamptz not null default now()
);

create index setups_tags_idx on public.setups using gin (tags);
create index setups_points_idx on public.setups (points desc);
create index setups_created_at_idx on public.setups (created_at desc);
create index setups_owner_idx on public.setups (owner_id);

alter table public.setups enable row level security;
create policy "Setups are public" on public.setups for select using (true);
create policy "Publish your own setups" on public.setups for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "Edit your own setups" on public.setups for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Delete your own setups" on public.setups for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Clients may only write these columns; owner_id comes from the default and
-- points/wins/losses only change through cast_vote().
revoke insert, update on public.setups from anon, authenticated;
grant insert (title, description, tags, setup, thumbnail_path) on public.setups to authenticated;
grant update (title, description, tags, setup, thumbnail_path) on public.setups to authenticated;

-- Setups with their author, for the board.
create view public.setup_cards with (security_invoker = on) as
select
  s.id, s.owner_id, s.title, s.description, s.tags, s.setup, s.thumbnail_path,
  s.points, s.wins, s.losses, s.created_at,
  p.username, p.avatar_url
from public.setups s
join public.profiles p on p.id = s.owner_id;

grant select on public.setup_cards to anon, authenticated;

-- ---------- 1v1 votes ----------

create table public.votes (
  id bigint generated always as identity primary key,
  winner_id uuid not null references public.setups on delete cascade,
  loser_id uuid not null references public.setups on delete cascade,
  -- 'user:<id>' when signed in, otherwise 'anon:<random id kept in the browser>'.
  voter_key text not null,
  -- Hashed IP address, only used for rate limiting.
  ip_hash text,
  created_at timestamptz not null default now(),
  check (winner_id <> loser_id)
);

-- One vote per person per pair (in either order).
create unique index votes_one_per_pair_idx on public.votes
  (voter_key, least(winner_id, loser_id), greatest(winner_id, loser_id));
create index votes_voter_recent_idx on public.votes (voter_key, created_at desc);
create index votes_ip_recent_idx on public.votes (ip_hash, created_at desc);
create index votes_loser_idx on public.votes (loser_id);
create index votes_winner_idx on public.votes (winner_id);

-- No policies: votes are only read and written by the functions below.
alter table public.votes enable row level security;
revoke all on public.votes from anon, authenticated;

-- Who's voting: the signed-in user, or the browser's anonymous key.
create function public.voter_key(anon_key text) returns text
language plpgsql stable set search_path = '' as $$
begin
  if auth.uid() is not null then
    return 'user:' || auth.uid();
  end if;
  if anon_key is null or anon_key !~ '^[A-Za-z0-9-]{16,64}$' then
    raise exception 'A voter key is needed to vote without signing in.' using errcode = '22023';
  end if;
  return 'anon:' || anon_key;
end;
$$;

-- Two setups to compare: random, matching any of the given tags (or any
-- setup when no tags are given), close in points, never your own, and never a
-- pair you've already voted on. Returns fewer than 2 rows when there's no
-- pair left.
create function public.get_matchup(filter_tags text[] default '{}', anon_key text default null)
returns setof public.setup_cards
language plpgsql security definer set search_path = '' as $$
declare
  me text := public.voter_key(anon_key);
  first_card public.setup_cards;
  second_card public.setup_cards;
begin
  for attempt in 1..8 loop
    select * into first_card
    from public.setup_cards s
    where (cardinality(filter_tags) = 0 or s.tags && filter_tags)
      and s.owner_id is distinct from auth.uid()
    order by random()
    limit 1;

    if first_card.id is null then
      return;
    end if;

    select * into second_card
    from public.setup_cards s
    where (cardinality(filter_tags) = 0 or s.tags && filter_tags)
      and s.owner_id is distinct from auth.uid()
      and s.id <> first_card.id
      and not exists (
        select 1 from public.votes v
        where v.voter_key = me
          and least(v.winner_id, v.loser_id) = least(s.id, first_card.id)
          and greatest(v.winner_id, v.loser_id) = greatest(s.id, first_card.id)
      )
    -- Prefer a close match, with some randomness so it isn't always the same one.
    order by abs(s.points - first_card.points) + random() * 150
    limit 1;

    if second_card.id is not null then
      return next first_card;
      return next second_card;
      return;
    end if;
  end loop;
end;
$$;

-- Records a 1v1 vote and moves points Elo-style: beating a higher-ranked
-- setup earns more. Returns both setups' new points and how many changed hands.
create function public.cast_vote(winner uuid, loser uuid, anon_key text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me text := public.voter_key(anon_key);
  forwarded text := current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for';
  ip text := nullif(trim(split_part(coalesce(forwarded, ''), ',', 1)), '');
  hashed_ip text := case when ip is null then null else md5('desk-maxxing:' || ip) end;
  winner_points integer;
  loser_points integer;
  expected double precision;
  delta integer;
begin
  if winner = loser then
    raise exception 'Pick two different setups.' using errcode = '22023';
  end if;

  -- Rate limits: 30 votes a minute per voter, 120 per IP (people can share one).
  if (select count(*) from public.votes
      where voter_key = me and created_at > now() - interval '1 minute') >= 30
    or (hashed_ip is not null and (select count(*) from public.votes
      where ip_hash = hashed_ip and created_at > now() - interval '1 minute') >= 120)
  then
    raise exception 'Whoa, slow down! Try again in a minute.' using errcode = 'P0001';
  end if;

  -- Lock both rows (always in the same order, so two votes can't deadlock).
  perform 1 from public.setups where id in (winner, loser) order by id for update;
  select points into winner_points from public.setups where id = winner;
  select points into loser_points from public.setups where id = loser;
  if winner_points is null or loser_points is null then
    raise exception 'That setup no longer exists.' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.setups where id in (winner, loser) and owner_id = auth.uid()) then
    raise exception 'You can''t vote on your own setup.' using errcode = '42501';
  end if;

  begin
    insert into public.votes (winner_id, loser_id, voter_key, ip_hash)
    values (winner, loser, me, hashed_ip);
  exception when unique_violation then
    raise exception 'You already voted on this pair.' using errcode = '23505';
  end;

  expected := 1 / (1 + power(10, (loser_points - winner_points) / 400.0));
  delta := greatest(1, round(32 * (1 - expected))::integer);

  update public.setups set points = points + delta, wins = wins + 1 where id = winner;
  update public.setups set points = points - delta, losses = losses + 1 where id = loser;

  return jsonb_build_object(
    'delta', delta,
    'winnerPoints', winner_points + delta,
    'loserPoints', loser_points - delta
  );
end;
$$;

revoke execute on function public.get_matchup(text[], text) from public;
revoke execute on function public.cast_vote(uuid, uuid, text) from public;
grant execute on function public.get_matchup(text[], text) to anon, authenticated;
grant execute on function public.cast_vote(uuid, uuid, text) to anon, authenticated;

-- ---------- Thumbnails (public images, uploaded into your own folder) ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('thumbnails', 'thumbnails', true, 1048576, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

create policy "Upload thumbnails to your own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'thumbnails' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- Removing a file needs select as well as delete.
create policy "See your own thumbnails" on storage.objects for select to authenticated
  using (bucket_id = 'thumbnails' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Delete your own thumbnails" on storage.objects for delete to authenticated
  using (bucket_id = 'thumbnails' and (storage.foldername(name))[1] = (select auth.uid())::text);

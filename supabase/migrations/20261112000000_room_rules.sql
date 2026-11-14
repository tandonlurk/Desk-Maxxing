-- Challenge rules: which items challengers may use and how many they may add.
-- Shape: { allow: 'all' | 'categories' | 'items', categories: [], items: [], maxItems: number | null }
alter table public.rooms
  add column rules jsonb not null default '{}' check (
    jsonb_typeof(rules) = 'object' and pg_column_size(rules) < 20000
  );

grant insert (rules) on public.rooms to authenticated;

-- New columns go at the end of a view.
create or replace view public.room_cards with (security_invoker = on) as
select
  r.id, r.code, r.owner_id, r.title, r.brief, r.wishlist, r.base, r.thumbnail_path,
  r.winner_id, r.created_at,
  p.username, p.avatar_url,
  (select count(*) from public.setups s where s.room_id = r.id)::integer as entry_count,
  r.rules
from public.rooms r
join public.profiles p on p.id = r.owner_id;

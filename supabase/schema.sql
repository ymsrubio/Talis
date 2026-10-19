-- Run in the Supabase SQL editor. Safe to re-run.

-- Every Card read the reader posts. Repeat reads are kept here; the Tap rule
-- (one Tap per Card per minute) is applied when Taps are read, not on insert.
create table if not exists public.scans (
  id bigint generated always as identity primary key,
  uid text not null,
  scanned_at timestamptz not null default now()
);

alter table public.scans enable row level security;

-- Open for now: anyone with the publishable key can add scans.
drop policy if exists "anon can insert scans" on public.scans;
create policy "anon can insert scans" on public.scans
  for insert to anon with check (true);

-- The website reads with the same key.
drop policy if exists "anon can read scans" on public.scans;
create policy "anon can read scans" on public.scans
  for select to anon using (true);

-- Push new rows to the website live.
do $$
begin
  alter publication supabase_realtime add table public.scans;
exception when duplicate_object then null;
end $$;

-- Bus Layout: one row per cell of the seat map, front of the bus at row 0.
-- A cell is either a Seat (seat number) or a fixture; col_span widens it across
-- columns. Edit these rows in Supabase to change the drawn map.
create table if not exists public.bus_layout (
  grid_row smallint not null check (grid_row >= 0),
  grid_col smallint not null check (grid_col >= 1),
  col_span smallint not null default 1 check (col_span >= 1),
  seat smallint unique check (seat >= 1),
  fixture text check (fixture in ('driver', 'door', 'toilet', 'fridge')),
  primary key (grid_row, grid_col),
  check ((seat is null) <> (fixture is null))
);

alter table public.bus_layout enable row level security;

drop policy if exists "anon can read bus layout" on public.bus_layout;
create policy "anon can read bus layout" on public.bus_layout
  for select to anon using (true);

-- Seed the real 46-seat bus once; later edits in Supabase are kept.
-- Columns 1-2 are the left pair, 3 the aisle, 4-5 the right pair.
-- Rows 1-11: 4k-3 (window), 4k-2 (aisle) | 4k (aisle), 4k-1 (window).
insert into public.bus_layout (grid_row, grid_col, col_span, seat, fixture)
select * from (
  select 0::smallint, 1::smallint, 1::smallint, null::smallint, 'driver'
  union all select 0, 5, 1, null, 'door'
  union all
  select k, c, 1, case c when 1 then 4*k - 3 when 2 then 4*k - 2 when 4 then 4*k else 4*k - 1 end, null
  from generate_series(1, 11) k, unnest(array[1, 2, 4, 5]) c
  union all select 12, 1, 1, 45, null
  union all select 12, 2, 1, 46, null
  union all select 12, 4, 2, null, 'toilet'
  union all select 13, 2, 3, null, 'fridge'
) seed
where not exists (select 1 from public.bus_layout);

-- Riders: a Card linked to a name and exactly one Seat.
create table if not exists public.riders (
  id bigint generated always as identity primary key,
  card_uid text not null unique,
  name text not null check (btrim(name) <> ''),
  seat smallint not null unique
    references public.bus_layout (seat) on update cascade
);

alter table public.riders drop constraint if exists riders_name_length;
alter table public.riders add constraint riders_name_length
  check (char_length(name) <= 80);

alter table public.riders enable row level security;

drop policy if exists "anon can read riders" on public.riders;
create policy "anon can read riders" on public.riders
  for select to anon using (true);

-- /admin is open for now: anyone with the publishable key can register a Rider.
-- The unique constraints on card_uid and seat reject clashes.
drop policy if exists "anon can register riders" on public.riders;
create policy "anon can register riders" on public.riders
  for insert to anon with check (true);

-- Push Rider changes to /admin live.
do $$
begin
  alter publication supabase_realtime add table public.riders;
exception when duplicate_object then null;
end $$;

-- Also open for now: anyone with the publishable key can rename, move or remove a Rider.
-- The unique constraints on seat and the name check still apply to updates.
drop policy if exists "anon can edit riders" on public.riders;
create policy "anon can edit riders" on public.riders
  for update to anon using (true) with check (true);

drop policy if exists "anon can remove riders" on public.riders;
create policy "anon can remove riders" on public.riders
  for delete to anon using (true);

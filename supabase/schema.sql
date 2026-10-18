-- Run in the Supabase SQL editor. Safe to re-run.

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

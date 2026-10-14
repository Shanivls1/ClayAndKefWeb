-- App settings (Settings page): one row holding the owner's choices as JSON.
-- Run once in Supabase → SQL Editor. Safe to run again.

create table if not exists public.app_settings (
  id         int primary key default 1 check (id = 1), -- always exactly one row
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id) values (1) on conflict (id) do nothing;

-- The dashboard can read and change the settings row, but not add or delete rows.
alter table public.app_settings enable row level security;

drop policy if exists "Dashboard can read settings" on public.app_settings;
create policy "Dashboard can read settings" on public.app_settings
  for select to anon, authenticated using (true);

drop policy if exists "Dashboard can change settings" on public.app_settings;
create policy "Dashboard can change settings" on public.app_settings
  for update to anon, authenticated using (true) with check (id = 1);

grant select, update on public.app_settings to anon, authenticated;

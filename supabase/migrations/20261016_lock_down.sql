-- Lock the database to signed-in staff.
--
-- Before this, the public (anon) key could read and change everything — anyone with the site's address could.
-- After it:
--   • anon can do nothing: every grant is revoked and new tables don't get any by default;
--   • signed-in users only get data if their account is in public.staff (so even an account created by
--     someone else through Supabase sign-up sees nothing);
--   • every view runs with the caller's rights, so the table rules apply to it;
--   • the object-type images bucket can only be written by staff (images stay publicly viewable by URL).
--
-- Add the owner's account: Supabase → Authentication → Users → Add user (email + password), then
--   insert into public.staff (user_id, email) select id, email from auth.users where email = 'owner@example.com';
-- Run once in Supabase → SQL Editor. Safe to run again.

-- ─── Who is staff ─────────────────────────────────────────────────────────────
create table if not exists public.staff (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  email    text,
  added_at timestamptz not null default now()
);
alter table public.staff enable row level security;
revoke all on public.staff from anon, authenticated;
grant select on public.staff to authenticated;
drop policy if exists "Staff can see their own row" on public.staff;
create policy "Staff can see their own row" on public.staff for select to authenticated using (user_id = auth.uid());

-- true when the signed-in user is staff. security definer: reads staff without needing rights on it.
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;
revoke all on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;

-- ─── Shop tables: staff only ──────────────────────────────────────────────────
do $$
declare
  t text;
  p record;
begin
  foreach t in array array['customers', 'orders', 'objects', 'object_types'] loop
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('create policy "Staff only" on public.%I for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()))', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- ─── Activity log: staff read it and add app events; nobody edits or deletes ───
alter table public.activity_log enable row level security;
drop policy if exists "Dashboard can read the log" on public.activity_log;
drop policy if exists "Dashboard can report app events" on public.activity_log;
drop policy if exists "Staff can read the log" on public.activity_log;
drop policy if exists "Staff can report app events" on public.activity_log;
create policy "Staff can read the log" on public.activity_log for select to authenticated using ((select public.is_staff()));
create policy "Staff can report app events" on public.activity_log for insert to authenticated
  with check ((select public.is_staff()) and source = 'app');
revoke all on public.activity_log from anon, authenticated;
grant select, insert on public.activity_log to authenticated;

-- ─── Settings: staff read and change the one row ──────────────────────────────
alter table public.app_settings enable row level security;
drop policy if exists "Dashboard can read settings" on public.app_settings;
drop policy if exists "Dashboard can change settings" on public.app_settings;
drop policy if exists "Staff can read settings" on public.app_settings;
drop policy if exists "Staff can change settings" on public.app_settings;
create policy "Staff can read settings" on public.app_settings for select to authenticated using ((select public.is_staff()));
create policy "Staff can change settings" on public.app_settings for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()) and id = 1);
revoke all on public.app_settings from anon, authenticated;
grant select, update on public.app_settings to authenticated;

-- ─── Views: run as the caller (so the rules above apply), staff read only ─────
do $$
declare v text;
begin
  for v in select viewname from pg_views where schemaname = 'public' loop
    execute format('alter view public.%I set (security_invoker = true)', v);
    execute format('revoke all on public.%I from anon, authenticated', v);
    execute format('grant select on public.%I to authenticated', v);
  end loop;
end $$;

-- ─── Functions and sequences ──────────────────────────────────────────────────
revoke all on function public.delete_order(uuid, boolean), public.delete_customer(uuid), public.delete_object_type(uuid) from public, anon;
grant execute on function public.delete_order(uuid, boolean), public.delete_customer(uuid), public.delete_object_type(uuid) to authenticated;
revoke all on all sequences in schema public from anon;
grant usage, select on all sequences in schema public to authenticated;   -- order / piece numbers are drawn by triggers

-- Anything created later starts closed to anon too
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;

-- ─── Image storage: anyone can view an image by its URL, only staff upload ────
drop policy if exists "Allow anon uploads" on storage.objects;
drop policy if exists "Allow public reads" on storage.objects;
drop policy if exists "Staff upload object type images" on storage.objects;
drop policy if exists "Staff manage object type images" on storage.objects;
drop policy if exists "Staff read object type images" on storage.objects;
create policy "Staff upload object type images" on storage.objects for insert to authenticated
  with check (bucket_id = 'object-type-images' and (select public.is_staff()));
create policy "Staff manage object type images" on storage.objects for update to authenticated
  using (bucket_id = 'object-type-images' and (select public.is_staff()));
create policy "Staff read object type images" on storage.objects for select to authenticated
  using (bucket_id = 'object-type-images' and (select public.is_staff()));

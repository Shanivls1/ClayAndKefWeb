-- Activity log: a permanent history of every change in the shop, plus errors reported by the dashboard.
-- Run once in the Supabase dashboard → SQL Editor. Safe to run again.

create table if not exists public.activity_log (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  source      text not null check (source in ('db', 'app')), -- 'db' = recorded by trigger, 'app' = sent by the dashboard
  table_name  text,          -- customers / orders / objects / object_types (db rows only)
  record_id   uuid,          -- id of the changed row (db rows only)
  action      text not null, -- INSERT / UPDATE / DELETE, or error / warning / info for app rows
  changed     text[],        -- UPDATE only: names of the columns that changed
  old_data    jsonb,         -- row before the change (UPDATE, DELETE)
  new_data    jsonb,         -- row after the change (INSERT, UPDATE)
  message     text,          -- app rows: what happened
  details     jsonb          -- app rows: extra context (page, error stack…)
);

create index if not exists activity_log_created_at_idx on public.activity_log (created_at desc);
create index if not exists activity_log_record_idx     on public.activity_log (table_name, record_id);

-- Records one row per change. Logging must never block the shop: if writing the log
-- fails, the original change still goes through and Postgres only raises a warning.
create or replace function public.log_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  n jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  cols text[];
begin
  if tg_op = 'UPDATE' then
    select array_agg(e.key order by e.key) into cols
    from jsonb_each(n) e
    where e.value is distinct from o -> e.key;
    if cols is null then return new; end if; -- nothing actually changed
  end if;

  begin
    insert into public.activity_log (source, table_name, record_id, action, changed, old_data, new_data)
    values ('db', tg_table_name, coalesce(n ->> 'id', o ->> 'id')::uuid, tg_op, cols, o, n);
  exception when others then
    raise warning 'activity_log: could not record % on %: %', tg_op, tg_table_name, sqlerrm;
  end;

  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['customers', 'orders', 'objects', 'object_types'] loop
    execute format('drop trigger if exists log_activity on public.%I', t);
    execute format(
      'create trigger log_activity after insert or update or delete on public.%I
         for each row execute function public.log_activity()', t);
  end loop;
end $$;

-- The dashboard can read the log and add its own error reports, but can never edit or delete entries.
alter table public.activity_log enable row level security;

drop policy if exists "Dashboard can read the log" on public.activity_log;
create policy "Dashboard can read the log" on public.activity_log
  for select to anon, authenticated using (true);

drop policy if exists "Dashboard can report app events" on public.activity_log;
create policy "Dashboard can report app events" on public.activity_log
  for insert to anon, authenticated with check (source = 'app');

grant select, insert on public.activity_log to anon, authenticated;

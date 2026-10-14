-- Order numbers go 1 → 1000 and then start again at 1 (the number is written on the pieces).
-- A number is skipped while it still belongs to an order with pieces that haven't been collected,
-- so two orders on the shelf never share a number. Run once in Supabase → SQL Editor. Safe to run again.

-- 1. Numbers now repeat over time, so they can't be unique across all orders.
do $$
declare r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = 'public.orders'::regclass and c.contype = 'u' and a.attname = 'order_number'
  loop
    execute format('alter table public.orders drop constraint %I', r.conname);
  end loop;
  for r in
    select i.indexrelid::regclass as idx
    from pg_index i
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
    where i.indrelid = 'public.orders'::regclass and i.indisunique and not i.indisprimary and a.attname = 'order_number'
  loop
    execute format('drop index %s', r.idx);
  end loop;
end $$;

-- 2. The counter cycles 1..1000 (if it's already past 1000, continue from the matching spot).
do $$
declare v bigint;
begin
  select last_value into v from public.orders_order_number_seq;
  perform setval('public.orders_order_number_seq', ((v - 1) % 1000) + 1);
end $$;
alter sequence public.orders_order_number_seq minvalue 1 maxvalue 1000 cycle;

-- 3. Take the next number that isn't on the shelf right now.
create or replace function public.set_order_number() returns trigger
language plpgsql as $$
declare
  n     int;
  tries int := 0;
begin
  loop
    n := nextval('public.orders_order_number_seq');
    exit when not exists (
      select 1
      from public.orders o
      where o.order_number = n
        and exists (select 1 from public.objects x where x.order_id = o.id and x.status <> 'picked_up')
    );
    tries := tries + 1;
    if tries >= 1000 then
      raise exception 'All order numbers 1–1000 are taken by orders that haven''t been collected yet.';
    end if;
  end loop;
  new.order_number := n;
  return new;
end;
$$;

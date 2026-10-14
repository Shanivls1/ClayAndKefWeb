-- Fixes two stale triggers on public.objects. Run once in Supabase → SQL Editor. Safe to run again.

-- 1. trg_is_returning still read objects.customer_id, which moved to orders. Every insert or delete
--    of an object failed with: record "new" has no field "customer_id" (New Order left empty orders).
--    Rewritten to find the customer through orders; recomputes customers.is_returning
--    ("more than one object across all their orders").
create or replace function public.update_is_returning() returns trigger
language plpgsql as $$
declare
  cid uuid;
begin
  select customer_id into cid from public.orders where id = coalesce(new.order_id, old.order_id);
  if cid is not null then
    update public.customers c
    set is_returning = (
      select count(*) > 1
      from public.objects o
      join public.orders r on r.id = o.order_id
      where r.customer_id = cid
    )
    where c.id = cid;
  end if;
  return coalesce(new, old);
end;
$$;

-- Bring every customer's flag up to date once
update public.customers c
set is_returning = (
  select count(*) > 1
  from public.objects o
  join public.orders r on r.id = o.order_id
  where r.customer_id = c.id
);

-- 2. "on-object-ready" was the database webhook that called the notify-customer Edge Function
--    (Meta WhatsApp API). The dashboard now uses WhatsApp click-to-chat links instead.
drop trigger if exists "on-object-ready" on public.objects;

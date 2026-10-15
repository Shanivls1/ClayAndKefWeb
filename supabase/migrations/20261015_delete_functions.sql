-- Deleting orders, customers and object types from the app. Each runs as one step (all or nothing) with the
-- caller's permissions. Every deleted row is still recorded in activity_log by the log_activity trigger.
-- Run once in Supabase → SQL Editor. Safe to run again.

-- An order and its pieces. With p_restock, pieces still waiting (blanks never painted) go back into stock.
create or replace function public.delete_order(p_order_id uuid, p_restock boolean default false)
returns table (deleted_pieces int, restocked int)
language plpgsql security invoker set search_path = public as $$
declare
  n int;
  r int := 0;
begin
  if not exists (select 1 from orders where id = p_order_id) then
    raise exception 'This order no longer exists.';
  end if;
  if p_restock then
    select count(*) into r from objects where order_id = p_order_id and status = 'received';
    update object_types t
    set raw_stock = coalesce(t.raw_stock, 0) + w.c
    from (select object_type_id, count(*)::int c from objects
          where order_id = p_order_id and status = 'received' group by 1) w
    where t.id = w.object_type_id;
  end if;
  delete from objects where order_id = p_order_id;
  get diagnostics n = row_count;
  delete from orders where id = p_order_id;
  return query select n, r;
end;
$$;

-- A customer, with all their orders and pieces.
create or replace function public.delete_customer(p_customer_id uuid)
returns table (deleted_orders int, deleted_pieces int)
language plpgsql security invoker set search_path = public as $$
declare
  o int;
  n int;
begin
  if not exists (select 1 from customers where id = p_customer_id) then
    raise exception 'This customer no longer exists.';
  end if;
  delete from objects where order_id in (select id from orders where customer_id = p_customer_id);
  get diagnostics n = row_count;
  delete from orders where customer_id = p_customer_id;
  get diagnostics o = row_count;
  delete from customers where id = p_customer_id;
  return query select o, n;
end;
$$;

-- An object type — only when no piece uses it (otherwise order history would lose its pieces).
create or replace function public.delete_object_type(p_type_id uuid)
returns void
language plpgsql security invoker set search_path = public as $$
declare
  n int;
begin
  select count(*) into n from objects where object_type_id = p_type_id;
  if n > 0 then
    raise exception 'It is used by % piece(s) in orders, so it can''t be deleted.', n;
  end if;
  delete from object_types where id = p_type_id;
  if not found then
    raise exception 'This object type no longer exists.';
  end if;
end;
$$;

grant execute on function public.delete_order(uuid, boolean), public.delete_customer(uuid), public.delete_object_type(uuid)
  to anon, authenticated;

-- Removing one piece from an order (Orders page → opened order → bin next to the piece).
-- All or nothing, with the caller's rights (staff only, like delete_order). With p_restock, a piece still waiting
-- (an unpainted blank) goes back into stock. The last piece of an order can't be removed — delete the order instead.
-- The deleted row stays in activity_log (log_activity trigger). Run once in Supabase → SQL Editor. Safe to run again.

create or replace function public.delete_object(p_object_id uuid, p_restock boolean default false)
returns table (order_id uuid, restocked int)
language plpgsql security invoker set search_path = public as $$
declare
  v_order  uuid;
  v_type   uuid;
  v_status text;
  r        int := 0;
begin
  select x.order_id, x.object_type_id, x.status into v_order, v_type, v_status
  from objects x where x.id = p_object_id
  for update;
  if not found then
    raise exception 'This piece no longer exists.';
  end if;
  if (select count(*) from objects x where x.order_id = v_order) <= 1 then
    raise exception 'This is the only piece in the order — delete the whole order instead.';
  end if;
  if p_restock and v_status = 'received' then
    update object_types t set raw_stock = coalesce(t.raw_stock, 0) + 1 where t.id = v_type;
    r := 1;
  end if;
  delete from objects x where x.id = p_object_id;
  return query select v_order, r;
end;
$$;

revoke all on function public.delete_object(uuid, boolean) from public, anon;
grant execute on function public.delete_object(uuid, boolean) to authenticated;

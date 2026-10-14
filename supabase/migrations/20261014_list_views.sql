-- Summary views behind the Orders and Customers lists, so they can be filtered, sorted and paged in the
-- database (only the visible page is sent to the browser). security_invoker: the app's normal access rules apply.
-- Run once in Supabase → SQL Editor. Safe to run again.

-- One row per order: who, when, and where its pieces stand
create or replace view public.order_list with (security_invoker = true) as
select
  o.id,
  o.order_number,
  o.received_at,
  o.created_at,
  o.notes,
  o.customer_id,
  c.name  as customer_name,
  c.phone as customer_phone,
  count(x.id)                                                        as pieces,
  count(x.id) filter (where x.status = 'received')                   as waiting,
  count(x.id) filter (where x.status = 'ready')                      as ready,
  count(x.id) filter (where x.status = 'picked_up')                  as collected,
  count(x.id) filter (where x.status = 'ready' and x.notified_at is null) as ready_untold,
  -- waiting: something still being fired · ready: all fired, not all collected · collected: everything picked up
  case
    when count(x.id) = 0                                          then 'empty'
    when count(x.id) filter (where x.status = 'received') > 0     then 'waiting'
    when count(x.id) filter (where x.status = 'ready') > 0        then 'ready'
    else 'collected'
  end as stage,
  -- ' MGY2 PLT1 ' — padded so a filter can match one whole code: ilike '% MGY2 %'
  ' ' || coalesce(string_agg(distinct t.code, ' '), '') || ' '     as codes
from public.orders o
join public.customers c        on c.id = o.customer_id
left join public.objects x     on x.order_id = o.id
left join public.object_types t on t.id = x.object_type_id
group by o.id, c.id;

-- One row per customer: visits, pieces, last visit, orders not yet collected
create or replace view public.customer_list with (security_invoker = true) as
select
  c.id,
  c.name,
  c.phone,
  c.notes,
  c.created_at,
  count(distinct o.id)                                        as visits,
  count(x.id)                                                 as pieces,
  max(o.received_at)                                          as last_visit,
  count(distinct o.id) filter (where x.status <> 'picked_up') as open_orders
from public.customers c
left join public.orders o  on o.customer_id = c.id
left join public.objects x on x.order_id = o.id
group by c.id;

grant select on public.order_list, public.customer_list to anon, authenticated;

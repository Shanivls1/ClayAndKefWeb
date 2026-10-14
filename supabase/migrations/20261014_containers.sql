-- Containers: when a piece is marked ready, the owner puts it in a container (A, B, C…, מחסן שחור…).
-- Run once in Supabase → SQL Editor. Safe to run again.

alter table public.objects add column if not exists container text;

-- order_list gains the containers its uncollected pieces are in (' F G ' — padded for whole-name filtering)
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
  case
    when count(x.id) = 0                                          then 'empty'
    when count(x.id) filter (where x.status = 'received') > 0     then 'waiting'
    when count(x.id) filter (where x.status = 'ready') > 0        then 'ready'
    else 'collected'
  end as stage,
  ' ' || coalesce(string_agg(distinct t.code, ' '), '') || ' '     as codes,
  ' ' || coalesce(string_agg(distinct x.container, ' ') filter (where x.status = 'ready'), '') || ' ' as containers
from public.orders o
join public.customers c        on c.id = o.customer_id
left join public.objects x     on x.order_id = o.id
left join public.object_types t on t.id = x.object_type_id
group by o.id, c.id;

grant select on public.order_list to anon, authenticated;

-- One-time: open orders imported from the spreadsheet kept their Box (container) in the order notes.
-- Where the note clearly names a container, put it on the order's ready pieces.
with named as (
  select o.id,
    case
      when lower(trim(o.notes)) = 'cbis'                                     then 'Cbis'
      when trim(o.notes) in ('מחסן שחור', 'מחסן שקוף', 'מדף', 'שקית בקופה')  then trim(o.notes)
      when upper(trim(o.notes)) ~ '^[A-J]$'                                  then upper(trim(o.notes))
      when o.notes ~ '^\s*[A-J]\s*-'                                         then upper(substring(o.notes from '^\s*([A-J])'))
      when o.notes ~ '[-/]\s*[A-J]\s*$'                                      then upper(substring(o.notes from '([A-J])\s*$'))
      when o.notes ~ '-\s*מחסן (שחור|שקוף)\s*$'                              then substring(o.notes from '(מחסן (שחור|שקוף))\s*$')
    end as container
  from public.orders o
  where o.notes is not null
)
update public.objects x
set container = n.container
from named n
where x.order_id = n.id and n.container is not null and x.status = 'ready' and x.container is null;

-- Pickup reminders: when a customer was told their order is ready but hasn't come, the Orders page offers
-- reminder 1 (N days after the "ready" message) and reminder 2 (N days after reminder 1). N = app_settings
-- reminderDays, default 14. The owner sends them from WhatsApp Web like the first message.
-- Run once in Supabase → SQL Editor. Safe to run again.

alter table public.orders add column if not exists reminder1_at timestamptz; -- reminder 1 confirmed sent
alter table public.orders add column if not exists reminder2_at timestamptz; -- reminder 2 confirmed sent

-- order_list (same columns as before, in the same order) gains:
--   notified_last – when the customer was told the order is ready (all ready pieces notified), else null
--   reminder1_at, reminder2_at
--   reminder_due  – 1 or 2 when that reminder is due now, else 0. A newer "ready" message ("Send again")
--                   starts the count over, so reminders sent before it no longer count.
create or replace view public.order_list with (security_invoker = true) as
with base as (
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
    ' ' || coalesce(string_agg(distinct x.container, ' ') filter (where x.status = 'ready'), '') || ' ' as containers,
    case
      when count(x.id) filter (where x.status = 'received') = 0
       and count(x.id) filter (where x.status = 'ready') > 0
       and count(x.id) filter (where x.status = 'ready' and x.notified_at is null) = 0
      then max(x.notified_at) filter (where x.status = 'ready')
    end as notified_last,
    o.reminder1_at,
    o.reminder2_at
  from public.orders o
  join public.customers c        on c.id = o.customer_id
  left join public.objects x     on x.order_id = o.id
  left join public.object_types t on t.id = x.object_type_id
  group by o.id, c.id
),
-- settings, read defensively: a missing or malformed value falls back to the default instead of breaking the view
raw as (
  select data ->> 'reminders' as on_txt, data ->> 'reminderDays' as days_txt from public.app_settings where id = 1
),
cfg as (
  select
    coalesce((select on_txt <> 'false' from raw), true) as on_,
    make_interval(days => coalesce(
      (select least(greatest(days_txt::int, 1), 365) from raw where days_txt ~ '^\s*\d{1,4}\s*$'), 14)) as gap
)
select
  b.*,
  case
    when not cfg.on_ or b.notified_last is null                                        then 0
    when b.reminder1_at is null or b.reminder1_at < b.notified_last
      then case when now() >= b.notified_last + cfg.gap then 1 else 0 end
    when b.reminder2_at is null or b.reminder2_at < b.reminder1_at
      then case when now() >= b.reminder1_at + cfg.gap then 2 else 0 end
    else 0
  end as reminder_due
from base b cross join cfg;

grant select on public.order_list to anon, authenticated;

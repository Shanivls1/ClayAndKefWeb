-- Fixes found in QA. Run once in Supabase → SQL Editor. Safe to run again.

-- 1. Dashboard "Customer retention": a customer's first month now counts them as NEW and only later months as
--    returning. Before, anyone who ever came twice was counted as "returning" even in the month of their first visit.
create or replace view public.customer_retention with (security_invoker = true) as
with visits as (
  select distinct date_trunc('month', received_at) as month, customer_id from public.orders
),
firsts as (
  select customer_id, min(month) as first_month from visits group by customer_id
)
select
  v.month,
  count(*) filter (where v.month = f.first_month) as new_customers,
  count(*) filter (where v.month > f.first_month) as returning_customers
from visits v
join firsts f using (customer_id)
group by v.month
order by v.month;

revoke all on public.customer_retention from anon;
grant select on public.customer_retention to authenticated;

-- 2. Object type codes are unique (the app checks too). Only added when no two types already share a code —
--    otherwise this lists them and changes nothing, so they can be fixed on the Stock page first.
do $$
declare dupes text;
begin
  select string_agg(format('%s (%s types)', code, n), ', ') into dupes
  from (select upper(code) as code, count(*) n from public.object_types where code is not null group by 1 having count(*) > 1) d;
  if dupes is null then
    create unique index if not exists object_types_code_unique on public.object_types (upper(code));
  else
    raise notice 'Codes used by more than one object type: %. Fix them on the Stock page, then run this file again.', dupes;
  end if;
end $$;

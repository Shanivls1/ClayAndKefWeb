-- Order numbers always go up by one (1 → 1000, then 1 again) — never skipped.
-- Before, a number was skipped while an older order with that number still had pieces in the shop, so the
-- owner saw jumps (e.g. #95 → #97). Now the next number is always the next one, even if an old order with
-- the same number is still open; orders are told apart by customer and date (the app identifies them by id).
-- Run once in Supabase → SQL Editor. Safe to run again. Replaces set_order_number from 20261014_order_numbers_1_to_1000.sql.

create or replace function public.set_order_number() returns trigger
language plpgsql as $$
begin
  new.order_number := nextval('public.orders_order_number_seq');  -- the sequence cycles 1..1000
  return new;
end;
$$;

-- Object types get the owner's catalogue details (from "Stock Bisques.xlsx"), and pieces remember the code they
-- were entered with when their type is changed (e.g. an old code that isn't in the catalogue → UNKNOWN).
-- Covered by the existing "Staff only" rules on these tables. Run once in Supabase → SQL Editor. Safe to run again.

alter table public.object_types
  add column if not exists supplier        text,     -- e.g. Bialika, Minerco
  add column if not exists supplier_ref    text,     -- the supplier's own reference
  add column if not exists cost_price      numeric,  -- what the shop pays, before VAT ("Prix")
  add column if not exists cost_price_ttc  numeric,  -- what the shop pays, with VAT ("Prix TTC")
  add column if not exists pieces_per_box  integer,
  add column if not exists boxes_ordered   integer,  -- last order: boxes, pieces, total before VAT, pieces received, delivery
  add column if not exists pieces_ordered  integer,
  add column if not exists order_total_ht  numeric,
  add column if not exists pieces_received integer,
  add column if not exists delivered       text,     -- e.g. "Feb 2025"
  add column if not exists notes           text;
-- price stays the customer price ("Prix public")

alter table public.objects add column if not exists original_code text;

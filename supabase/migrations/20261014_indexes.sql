-- Indexes for the lookups the dashboard makes. Without them, listing orders with their pieces scans every
-- piece for every order and runs past Supabase's 3-second limit for the app's key once there's real data.
-- Adds indexes only — no data changes. Safe to run again.

create extension if not exists pg_trgm; -- fast "contains" search (ilike '%dana%')

-- Links between tables (Postgres doesn't index foreign keys by itself)
create index if not exists orders_customer_id_idx      on public.orders  (customer_id);
create index if not exists objects_order_id_idx        on public.objects (order_id);
create index if not exists objects_object_type_id_idx  on public.objects (object_type_id);

-- Orders page sort (newest first) and "which number is still on the shelf" check
drop index if exists public.orders_received_at_idx;   -- was (received_at, order_number): wrong after 999 → 1
create index if not exists orders_received_created_idx on public.orders  (received_at desc, created_at desc);
create index if not exists orders_order_number_idx     on public.orders  (order_number);
create index if not exists objects_not_collected_idx   on public.objects (order_id) where status <> 'picked_up';
create index if not exists objects_status_idx          on public.objects (status);

-- Customers page (sorted by name) and searches by name / phone
create index if not exists customers_name_idx          on public.customers (name);
create index if not exists customers_name_trgm_idx     on public.customers using gin (name gin_trgm_ops);
create index if not exists customers_phone_trgm_idx    on public.customers using gin (phone gin_trgm_ops);

-- WhatsApp history lookups (opened / not sent, per order)
create index if not exists activity_log_app_kind_idx
  on public.activity_log ((details ->> 'kind'), (details ->> 'order_id'), created_at desc)
  where source = 'app';

analyze public.customers, public.orders, public.objects, public.object_types, public.activity_log;

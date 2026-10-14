-- Clay & Kef mock data.
-- WARNING: deletes ALL customers, orders, objects, object types and log entries, then inserts mock data.
-- Run in Supabase → SQL Editor, after migrations/20261014_fix_object_triggers.sql. Everything runs in one
-- transaction: if any statement fails, nothing changes.
-- Mock phone numbers (+972-50-000-1xxx) are fake — don't send WhatsApp messages to them.

begin;

delete from public.objects;
delete from public.orders;
delete from public.customers;
delete from public.object_types;

-- Numbering starts again at #001
alter sequence public.orders_order_number_seq restart with 1;
do $$
declare seq text := pg_get_serial_sequence('public.objects', 'object_number');
begin
  if seq is not null then execute format('alter sequence %s restart with 1', seq); end if;
end $$;

insert into public.object_types (id, code, name, category, price, raw_stock, low_stock_alert) values
  ('98c063fe-0329-4fe0-a3fd-109ba986a0f2', 'SMLCUP', 'Small Cup', 'Cups', 20, 34, 10),
  ('58afc608-0db8-4034-9b2c-24556471df56', 'MDCUP', 'Medium Cup', 'Cups', 25, 41, 10),
  ('2fa9fcbf-9dc5-46e5-a29c-a761d04f6ed8', 'LRGCUP', 'Large Cup', 'Cups', 30, 6, 8),
  ('3339bff0-e59f-471c-8a1a-4f2bd5b98c7f', 'SMLPLT', 'Small Plate', 'Plates', 30, 27, 8),
  ('949899ab-05a8-41aa-a5ee-f7149899d975', 'MDPLT', 'Medium Plate', 'Plates', 35, 22, 8),
  ('bb1efdec-2a63-4eee-8134-1f07776371e7', 'LRGPLT', 'Large Plate', 'Plates', 40, 3, 6),
  ('6fbcc710-cc04-4602-97f8-07fca7dbd385', 'BOWL', 'Bowl', 'Bowls', 35, 18, 6),
  ('18c6e1fd-214a-4de6-b782-5f42ac5a46e6', 'VASE', 'Small Vase', 'Decor', 45, 9, 4);

insert into public.customers (id, name, phone, notes, created_at) values
  ('d1ba1afc-174d-491b-ba79-2e77912ecc80', 'Noa Levi', '+972-50-000-1001', 'Comes with her daughters, likes pastel colours', '2026-04-10T07:29:00.000Z'),
  ('d506513a-61fc-443c-9e7b-692b930b694d', 'Maya Cohen', '+972-50-000-1002', null, '2026-06-15T07:33:00.000Z'),
  ('81375d57-7acf-4a37-92a9-26f191394f2f', 'Yael Mizrahi', '+972-50-000-1003', null, '2026-07-05T07:24:00.000Z'),
  ('2a62d5b9-25d0-4f05-b74a-9d9800eea671', 'Tamar Peretz', '+972-50-000-1004', null, '2026-04-26T07:50:00.000Z'),
  ('6428d5fc-ddf7-4285-897a-c51d4420c9e0', 'Shira Biton', '+972-50-000-1005', null, '2026-04-30T07:37:00.000Z'),
  ('86352567-594a-440e-b4f3-2a8078b57482', 'Roni Avraham', '+972-50-000-1006', null, '2026-04-18T07:12:00.000Z'),
  ('77b79f39-c290-4ff2-80be-563989130bda', 'Michal Friedman', '+972-50-000-1007', null, '2026-05-16T07:04:00.000Z'),
  ('37fd4486-ccc0-4883-bd13-43e3c57f63ea', 'Dana Shapiro', '+972-50-000-1008', null, '2026-03-05T07:49:00.000Z'),
  ('68ead0de-c82f-4a9f-b98e-6cc2f3600e2e', 'Inbar Katz', '+972-50-000-1009', 'Teacher — sometimes books groups', '2026-08-08T07:14:00.000Z'),
  ('4b84689b-3fa6-4d67-8ed7-c76b481549dc', 'Hila Azoulay', '+972-50-000-1010', null, '2026-05-03T07:18:00.000Z'),
  ('a552af01-4525-4841-ade5-916f08653fa3', 'Lior Ben David', '+972-50-000-1011', null, '2026-05-21T07:52:00.000Z'),
  ('35645652-07be-410f-b45b-0f636bec80db', 'Gal Dahan', '+972-50-000-1012', null, '2026-08-25T07:35:00.000Z'),
  ('ec113e97-ab34-4d3f-a11d-5258d14e22be', 'Omer Golan', '+972-50-000-1013', null, '2026-04-29T07:53:00.000Z'),
  ('7549005c-cb66-49db-8d5c-c7317a540f5e', 'Itai Rosen', '+972-50-000-1014', 'Prefers a phone call over WhatsApp', '2026-05-31T07:04:00.000Z'),
  ('090ffc07-14e4-4d46-a2af-993a5b5f092d', 'Adi Malka', '+972-50-000-1015', null, '2026-09-27T07:05:00.000Z'),
  ('97f8c8e9-cdc6-4ad2-b211-bdc30d735e64', 'Yonatan Segal', '+972-50-000-1016', null, '2026-05-07T07:52:00.000Z'),
  ('d13bc322-0da0-4336-a6a2-d2897a1ae9bc', 'Eden Hadad', '+972-50-000-1017', null, '2026-04-30T07:54:00.000Z'),
  ('136a111d-1437-4bdd-9904-ab5a28e8e1ed', 'Tal Ohana', '+972-50-000-1018', null, '2026-05-11T07:31:00.000Z'),
  ('9d62f5fd-1073-4098-a41e-dde68ab9ebfc', 'Neta Weiss', '+972-50-000-1019', null, '2026-08-23T07:29:00.000Z'),
  ('4eb22a25-1b92-46c6-a613-af18618c589e', 'Amit Gabay', '+972-50-000-1020', null, '2026-07-15T07:01:00.000Z'),
  ('356de5ad-45a4-4380-aefe-eacf332a1e4e', 'Sivan Barak', '+972-50-000-1021', null, '2026-06-16T07:17:00.000Z'),
  ('edee145e-badd-4b9f-ae1a-75c07114371f', 'Keren Ashkenazi', '+972-50-000-1022', null, '2026-04-09T07:28:00.000Z'),
  ('50318ae5-b0bb-481f-944e-b0a779b2f08e', 'Ori Navon', '+972-50-000-1023', null, '2026-07-04T07:52:00.000Z'),
  ('0e13c1af-2163-49d2-8aa3-f3b3f00d7b64', 'Liat Shalom', '+972-50-000-1024', null, '2026-03-22T07:41:00.000Z');

-- Orders and their pieces, oldest first so numbers follow the calendar
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('6eed2de7-ae50-4e64-b4e6-684aca81fcc2', '37fd4486-ccc0-4883-bd13-43e3c57f63ea', '2026-03-05T16:50:00.000Z', '2026-03-05T16:50:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('6eed2de7-ae50-4e64-b4e6-684aca81fcc2', '98c063fe-0329-4fe0-a3fd-109ba986a0f2', 'picked_up', '2026-03-14T03:36:58.629Z', '2026-03-20T13:20:00.000Z', null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('9206036a-f422-4b43-8a05-ce38ff5b71e9', '0e13c1af-2163-49d2-8aa3-f3b3f00d7b64', '2026-03-22T11:46:00.000Z', '2026-03-22T11:46:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('9206036a-f422-4b43-8a05-ce38ff5b71e9', '58afc608-0db8-4034-9b2c-24556471df56', 'ready', null, null, null),
  ('9206036a-f422-4b43-8a05-ce38ff5b71e9', 'bb1efdec-2a63-4eee-8134-1f07776371e7', 'ready', null, null, null),
  ('9206036a-f422-4b43-8a05-ce38ff5b71e9', '2fa9fcbf-9dc5-46e5-a29c-a761d04f6ed8', 'ready', null, null, 'Extra coat of glaze'),
  ('9206036a-f422-4b43-8a05-ce38ff5b71e9', '6fbcc710-cc04-4602-97f8-07fca7dbd385', 'ready', null, null, null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('e63db5de-a8c3-4618-915a-95a2c5261c46', 'edee145e-badd-4b9f-ae1a-75c07114371f', '2026-04-09T13:55:00.000Z', '2026-04-09T13:55:00.000Z', 'Will collect after the holiday');
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('e63db5de-a8c3-4618-915a-95a2c5261c46', '6fbcc710-cc04-4602-97f8-07fca7dbd385', 'picked_up', '2026-04-18T13:33:11.802Z', '2026-04-25T10:00:00.000Z', null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('8508a55b-42c7-436a-8843-341317ade956', 'd1ba1afc-174d-491b-ba79-2e77912ecc80', '2026-04-10T09:05:00.000Z', '2026-04-10T09:05:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('8508a55b-42c7-436a-8843-341317ade956', '18c6e1fd-214a-4de6-b782-5f42ac5a46e6', 'picked_up', '2026-04-20T11:07:04.231Z', '2026-05-03T07:03:00.000Z', null),
  ('8508a55b-42c7-436a-8843-341317ade956', '6fbcc710-cc04-4602-97f8-07fca7dbd385', 'picked_up', '2026-04-20T11:07:04.231Z', '2026-05-03T09:04:00.000Z', null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('82e6f8f5-95cf-4fb9-9477-d5f843da761a', '86352567-594a-440e-b4f3-2a8078b57482', '2026-04-18T11:23:00.000Z', '2026-04-18T11:23:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('82e6f8f5-95cf-4fb9-9477-d5f843da761a', '6fbcc710-cc04-4602-97f8-07fca7dbd385', 'picked_up', '2026-04-25T11:12:32.387Z', '2026-04-26T11:10:00.000Z', null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('6251fc00-d1a8-49e1-a7f2-471a3251138f', '2a62d5b9-25d0-4f05-b74a-9d9800eea671', '2026-04-26T14:26:00.000Z', '2026-04-26T14:26:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('6251fc00-d1a8-49e1-a7f2-471a3251138f', '6fbcc710-cc04-4602-97f8-07fca7dbd385', 'picked_up', '2026-05-06T01:06:40.974Z', '2026-05-12T12:30:00.000Z', null),
  ('6251fc00-d1a8-49e1-a7f2-471a3251138f', '949899ab-05a8-41aa-a5ee-f7149899d975', 'picked_up', '2026-05-06T01:06:40.974Z', '2026-05-12T12:22:00.000Z', null),
  ('6251fc00-d1a8-49e1-a7f2-471a3251138f', '18c6e1fd-214a-4de6-b782-5f42ac5a46e6', 'picked_up', '2026-05-06T01:06:40.974Z', '2026-05-12T09:27:00.000Z', null),
  ('6251fc00-d1a8-49e1-a7f2-471a3251138f', '3339bff0-e59f-471c-8a1a-4f2bd5b98c7f', 'picked_up', '2026-05-06T01:06:40.974Z', '2026-05-12T08:16:00.000Z', null),
  ('6251fc00-d1a8-49e1-a7f2-471a3251138f', '6fbcc710-cc04-4602-97f8-07fca7dbd385', 'picked_up', '2026-05-06T01:06:40.974Z', '2026-05-12T12:05:00.000Z', null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('2548392a-859f-4068-aab3-5e5b9ee98057', 'ec113e97-ab34-4d3f-a11d-5258d14e22be', '2026-04-29T16:22:00.000Z', '2026-04-29T16:22:00.000Z', 'Wants a glossy glaze');
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('2548392a-859f-4068-aab3-5e5b9ee98057', '949899ab-05a8-41aa-a5ee-f7149899d975', 'picked_up', '2026-05-09T02:33:38.171Z', '2026-05-22T11:43:00.000Z', 'Extra coat of glaze'),
  ('2548392a-859f-4068-aab3-5e5b9ee98057', '949899ab-05a8-41aa-a5ee-f7149899d975', 'picked_up', '2026-05-09T02:33:38.171Z', '2026-05-22T09:05:00.000Z', null),
  ('2548392a-859f-4068-aab3-5e5b9ee98057', 'bb1efdec-2a63-4eee-8134-1f07776371e7', 'picked_up', '2026-05-09T02:33:38.171Z', '2026-05-22T07:18:00.000Z', null),
  ('2548392a-859f-4068-aab3-5e5b9ee98057', '6fbcc710-cc04-4602-97f8-07fca7dbd385', 'picked_up', '2026-05-09T02:33:38.171Z', '2026-05-22T10:15:00.000Z', null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('4254910e-f246-4b2c-87b7-31a6cacfb5d3', '6428d5fc-ddf7-4285-897a-c51d4420c9e0', '2026-04-30T13:35:00.000Z', '2026-04-30T13:35:00.000Z', 'Will collect after the holiday');
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('4254910e-f246-4b2c-87b7-31a6cacfb5d3', '2fa9fcbf-9dc5-46e5-a29c-a761d04f6ed8', 'picked_up', '2026-05-07T16:53:52.448Z', '2026-05-18T12:39:00.000Z', null),
  ('4254910e-f246-4b2c-87b7-31a6cacfb5d3', '3339bff0-e59f-471c-8a1a-4f2bd5b98c7f', 'picked_up', '2026-05-07T16:53:52.448Z', '2026-05-18T07:43:00.000Z', null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('40034dab-e1f5-4a5e-9417-a3aaad7bac99', 'd13bc322-0da0-4336-a6a2-d2897a1ae9bc', '2026-04-30T14:21:00.000Z', '2026-04-30T14:21:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('40034dab-e1f5-4a5e-9417-a3aaad7bac99', '6fbcc710-cc04-4602-97f8-07fca7dbd385', 'picked_up', '2026-05-08T21:41:04.250Z', '2026-05-20T14:26:00.000Z', null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('fd51e11e-ad36-4de2-8d75-66eaffbfc6e9', 'd1ba1afc-174d-491b-ba79-2e77912ecc80', '2026-05-02T12:36:00.000Z', '2026-05-02T12:36:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('fd51e11e-ad36-4de2-8d75-66eaffbfc6e9', '98c063fe-0329-4fe0-a3fd-109ba986a0f2', 'picked_up', '2026-05-08T09:17:17.128Z', '2026-05-19T13:32:00.000Z', null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('67731963-8d6a-409b-a36a-309e39512d0a', '4b84689b-3fa6-4d67-8ed7-c76b481549dc', '2026-05-03T07:25:00.000Z', '2026-05-03T07:25:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('67731963-8d6a-409b-a36a-309e39512d0a', '2fa9fcbf-9dc5-46e5-a29c-a761d04f6ed8', 'picked_up', '2026-05-10T16:18:51.113Z', '2026-05-19T16:35:00.000Z', null),
  ('67731963-8d6a-409b-a36a-309e39512d0a', '18c6e1fd-214a-4de6-b782-5f42ac5a46e6', 'picked_up', '2026-05-10T16:18:51.113Z', '2026-05-19T15:16:00.000Z', 'Name on the bottom');
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('cd433cec-600e-4751-8880-27862c5dd727', '97f8c8e9-cdc6-4ad2-b211-bdc30d735e64', '2026-05-07T15:13:00.000Z', '2026-05-07T15:13:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('cd433cec-600e-4751-8880-27862c5dd727', 'bb1efdec-2a63-4eee-8134-1f07776371e7', 'picked_up', '2026-05-16T21:55:37.274Z', '2026-05-19T07:02:00.000Z', null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('dc9868e3-3a4f-47d2-819e-456f3b6e56a9', '136a111d-1437-4bdd-9904-ab5a28e8e1ed', '2026-05-11T10:21:00.000Z', '2026-05-11T10:21:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('dc9868e3-3a4f-47d2-819e-456f3b6e56a9', '98c063fe-0329-4fe0-a3fd-109ba986a0f2', 'ready', '2026-05-18T07:26:38.155Z', null, null),
  ('dc9868e3-3a4f-47d2-819e-456f3b6e56a9', 'bb1efdec-2a63-4eee-8134-1f07776371e7', 'picked_up', '2026-05-18T07:26:38.155Z', '2026-05-19T13:07:00.000Z', null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('530c457b-b09f-4aad-9878-9245296fb43e', '77b79f39-c290-4ff2-80be-563989130bda', '2026-05-16T12:18:00.000Z', '2026-05-16T12:18:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('530c457b-b09f-4aad-9878-9245296fb43e', '3339bff0-e59f-471c-8a1a-4f2bd5b98c7f', 'picked_up', '2026-05-26T05:40:23.176Z', '2026-05-28T16:40:00.000Z', null),
  ('530c457b-b09f-4aad-9878-9245296fb43e', '2fa9fcbf-9dc5-46e5-a29c-a761d04f6ed8', 'picked_up', '2026-05-26T05:40:23.176Z', '2026-05-28T08:08:00.000Z', null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('adc2dae3-2624-43e7-a268-89c1030db405', 'a552af01-4525-4841-ade5-916f08653fa3', '2026-05-21T16:36:00.000Z', '2026-05-21T16:36:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('adc2dae3-2624-43e7-a268-89c1030db405', '58afc608-0db8-4034-9b2c-24556471df56', 'picked_up', '2026-05-31T13:25:17.493Z', '2026-06-06T15:54:00.000Z', null),
  ('adc2dae3-2624-43e7-a268-89c1030db405', '98c063fe-0329-4fe0-a3fd-109ba986a0f2', 'picked_up', '2026-05-31T13:25:17.493Z', '2026-06-06T07:29:00.000Z', null),
  ('adc2dae3-2624-43e7-a268-89c1030db405', '98c063fe-0329-4fe0-a3fd-109ba986a0f2', 'picked_up', '2026-05-31T13:25:17.493Z', '2026-06-06T12:45:00.000Z', null),
  ('adc2dae3-2624-43e7-a268-89c1030db405', '2fa9fcbf-9dc5-46e5-a29c-a761d04f6ed8', 'picked_up', '2026-05-31T13:25:17.493Z', '2026-06-06T15:45:00.000Z', null),
  ('adc2dae3-2624-43e7-a268-89c1030db405', '58afc608-0db8-4034-9b2c-24556471df56', 'picked_up', '2026-05-31T13:25:17.493Z', '2026-06-06T12:13:00.000Z', null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('fc5a3d23-40e7-44fb-aec0-f0b44dae577f', '77b79f39-c290-4ff2-80be-563989130bda', '2026-05-30T11:28:00.000Z', '2026-05-30T11:28:00.000Z', 'Date night');
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('fc5a3d23-40e7-44fb-aec0-f0b44dae577f', '18c6e1fd-214a-4de6-b782-5f42ac5a46e6', 'picked_up', '2026-06-09T01:31:06.580Z', '2026-06-15T07:57:00.000Z', 'Extra coat of glaze');
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('2e96a08e-2340-4bba-b26f-1eeb1c24c5ba', '7549005c-cb66-49db-8d5c-c7317a540f5e', '2026-05-31T09:48:00.000Z', '2026-05-31T09:48:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('2e96a08e-2340-4bba-b26f-1eeb1c24c5ba', '98c063fe-0329-4fe0-a3fd-109ba986a0f2', 'ready', null, null, null),
  ('2e96a08e-2340-4bba-b26f-1eeb1c24c5ba', '6fbcc710-cc04-4602-97f8-07fca7dbd385', 'ready', null, null, 'Slight chip on rim before painting');
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('30d0b218-82c8-4b62-b2de-ec607f2678d4', '2a62d5b9-25d0-4f05-b74a-9d9800eea671', '2026-06-04T15:28:00.000Z', '2026-06-04T15:28:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('30d0b218-82c8-4b62-b2de-ec607f2678d4', '18c6e1fd-214a-4de6-b782-5f42ac5a46e6', 'picked_up', '2026-06-14T04:26:57.186Z', '2026-06-24T13:47:00.000Z', null),
  ('30d0b218-82c8-4b62-b2de-ec607f2678d4', 'bb1efdec-2a63-4eee-8134-1f07776371e7', 'picked_up', '2026-06-14T04:26:57.186Z', '2026-06-24T12:00:00.000Z', null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('565d3a61-b319-4b01-87ae-abe5d7251967', '86352567-594a-440e-b4f3-2a8078b57482', '2026-06-05T14:48:00.000Z', '2026-06-05T14:48:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('565d3a61-b319-4b01-87ae-abe5d7251967', '98c063fe-0329-4fe0-a3fd-109ba986a0f2', 'picked_up', '2026-06-10T16:55:23.329Z', '2026-06-15T09:45:00.000Z', null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('88407e7d-dfe3-41fa-84f8-914536f9d0d0', '86352567-594a-440e-b4f3-2a8078b57482', '2026-06-11T10:15:00.000Z', '2026-06-11T10:15:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('88407e7d-dfe3-41fa-84f8-914536f9d0d0', '58afc608-0db8-4034-9b2c-24556471df56', 'picked_up', '2026-06-20T08:24:16.686Z', '2026-06-25T15:16:00.000Z', null),
  ('88407e7d-dfe3-41fa-84f8-914536f9d0d0', '2fa9fcbf-9dc5-46e5-a29c-a761d04f6ed8', 'picked_up', '2026-06-20T08:24:16.686Z', '2026-06-25T10:25:00.000Z', null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('6451c4f6-aabd-4526-86ce-6aa0e8ca9ef9', 'd506513a-61fc-443c-9e7b-692b930b694d', '2026-06-15T12:28:00.000Z', '2026-06-15T12:28:00.000Z', 'Birthday party — 4 kids');
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('6451c4f6-aabd-4526-86ce-6aa0e8ca9ef9', 'bb1efdec-2a63-4eee-8134-1f07776371e7', 'picked_up', '2026-06-23T08:28:34.073Z', '2026-07-04T15:52:00.000Z', null),
  ('6451c4f6-aabd-4526-86ce-6aa0e8ca9ef9', '6fbcc710-cc04-4602-97f8-07fca7dbd385', 'picked_up', '2026-06-23T08:28:34.073Z', '2026-07-04T09:30:00.000Z', null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('0fcda3ff-8cfa-4afa-8002-3c5ba4d07810', '356de5ad-45a4-4380-aefe-eacf332a1e4e', '2026-06-16T08:16:00.000Z', '2026-06-16T08:16:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('0fcda3ff-8cfa-4afa-8002-3c5ba4d07810', '6fbcc710-cc04-4602-97f8-07fca7dbd385', 'picked_up', '2026-06-22T13:07:56.309Z', '2026-07-04T12:23:00.000Z', null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('02679a10-2fff-439a-8b05-b11b281a7d27', '77b79f39-c290-4ff2-80be-563989130bda', '2026-06-23T11:59:00.000Z', '2026-06-23T11:59:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('02679a10-2fff-439a-8b05-b11b281a7d27', '18c6e1fd-214a-4de6-b782-5f42ac5a46e6', 'picked_up', '2026-07-01T01:16:28.461Z', '2026-07-07T12:35:00.000Z', null),
  ('02679a10-2fff-439a-8b05-b11b281a7d27', '98c063fe-0329-4fe0-a3fd-109ba986a0f2', 'picked_up', '2026-07-01T01:16:28.461Z', '2026-07-07T11:48:00.000Z', null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('4ae7f1e6-c820-42fe-ad61-5a3023639750', '6428d5fc-ddf7-4285-897a-c51d4420c9e0', '2026-06-23T10:33:00.000Z', '2026-06-23T10:33:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('4ae7f1e6-c820-42fe-ad61-5a3023639750', '949899ab-05a8-41aa-a5ee-f7149899d975', 'picked_up', '2026-07-02T08:24:27.669Z', '2026-07-13T09:36:00.000Z', null),
  ('4ae7f1e6-c820-42fe-ad61-5a3023639750', '58afc608-0db8-4034-9b2c-24556471df56', 'picked_up', '2026-07-02T08:24:27.669Z', '2026-07-13T13:59:00.000Z', null),
  ('4ae7f1e6-c820-42fe-ad61-5a3023639750', '3339bff0-e59f-471c-8a1a-4f2bd5b98c7f', 'picked_up', '2026-07-02T08:24:27.669Z', '2026-07-13T09:03:00.000Z', null),
  ('4ae7f1e6-c820-42fe-ad61-5a3023639750', '58afc608-0db8-4034-9b2c-24556471df56', 'picked_up', '2026-07-02T08:24:27.669Z', '2026-07-13T08:13:00.000Z', null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('3c41134d-d9df-46b0-9137-48e8a94b248a', '50318ae5-b0bb-481f-944e-b0a779b2f08e', '2026-07-04T14:56:00.000Z', '2026-07-04T14:56:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('3c41134d-d9df-46b0-9137-48e8a94b248a', 'bb1efdec-2a63-4eee-8134-1f07776371e7', 'picked_up', '2026-07-11T08:41:22.066Z', '2026-07-14T13:46:00.000Z', null),
  ('3c41134d-d9df-46b0-9137-48e8a94b248a', '949899ab-05a8-41aa-a5ee-f7149899d975', 'picked_up', '2026-07-11T08:41:22.066Z', '2026-07-14T09:28:00.000Z', null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('31841cd7-4b95-4915-bc1e-3443a80c78b7', '81375d57-7acf-4a37-92a9-26f191394f2f', '2026-07-05T12:54:00.000Z', '2026-07-05T12:54:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('31841cd7-4b95-4915-bc1e-3443a80c78b7', '949899ab-05a8-41aa-a5ee-f7149899d975', 'picked_up', '2026-07-13T21:00:49.390Z', '2026-07-17T09:36:00.000Z', null),
  ('31841cd7-4b95-4915-bc1e-3443a80c78b7', '98c063fe-0329-4fe0-a3fd-109ba986a0f2', 'picked_up', '2026-07-13T21:00:49.390Z', '2026-07-17T15:38:00.000Z', null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('b9062c91-40cc-4cd2-872b-b20b0058e640', '4eb22a25-1b92-46c6-a613-af18618c589e', '2026-07-15T15:25:00.000Z', '2026-07-15T15:25:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('b9062c91-40cc-4cd2-872b-b20b0058e640', '2fa9fcbf-9dc5-46e5-a29c-a761d04f6ed8', 'picked_up', '2026-07-24T05:03:49.963Z', '2026-07-25T10:03:00.000Z', null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('d69e2d70-ea89-44fb-a863-f321773e58f7', '68ead0de-c82f-4a9f-b98e-6cc2f3600e2e', '2026-08-08T11:57:00.000Z', '2026-08-08T11:57:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('d69e2d70-ea89-44fb-a863-f321773e58f7', '949899ab-05a8-41aa-a5ee-f7149899d975', 'picked_up', '2026-08-16T20:31:53.657Z', '2026-08-26T10:41:00.000Z', null),
  ('d69e2d70-ea89-44fb-a863-f321773e58f7', '949899ab-05a8-41aa-a5ee-f7149899d975', 'picked_up', '2026-08-16T20:31:53.657Z', '2026-08-26T10:11:00.000Z', null),
  ('d69e2d70-ea89-44fb-a863-f321773e58f7', '58afc608-0db8-4034-9b2c-24556471df56', 'picked_up', '2026-08-16T20:31:53.657Z', '2026-08-26T15:25:00.000Z', 'Slight chip on rim before painting'),
  ('d69e2d70-ea89-44fb-a863-f321773e58f7', '2fa9fcbf-9dc5-46e5-a29c-a761d04f6ed8', 'picked_up', '2026-08-16T20:31:53.657Z', '2026-08-26T16:23:00.000Z', null),
  ('d69e2d70-ea89-44fb-a863-f321773e58f7', '98c063fe-0329-4fe0-a3fd-109ba986a0f2', 'picked_up', '2026-08-16T20:31:53.657Z', '2026-08-26T07:21:00.000Z', null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('f0d74455-729e-44b5-9d57-73e27e8f4eae', '81375d57-7acf-4a37-92a9-26f191394f2f', '2026-08-13T07:06:00.000Z', '2026-08-13T07:06:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('f0d74455-729e-44b5-9d57-73e27e8f4eae', '6fbcc710-cc04-4602-97f8-07fca7dbd385', 'picked_up', '2026-08-19T12:02:25.596Z', '2026-08-29T07:12:00.000Z', null),
  ('f0d74455-729e-44b5-9d57-73e27e8f4eae', '3339bff0-e59f-471c-8a1a-4f2bd5b98c7f', 'picked_up', '2026-08-19T12:02:25.596Z', '2026-08-29T09:33:00.000Z', null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('d6379b0b-2815-42bc-a3cb-cd2ad26a6ba9', '86352567-594a-440e-b4f3-2a8078b57482', '2026-08-19T14:32:00.000Z', '2026-08-19T14:32:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('d6379b0b-2815-42bc-a3cb-cd2ad26a6ba9', 'bb1efdec-2a63-4eee-8134-1f07776371e7', 'picked_up', '2026-08-29T07:40:45.239Z', '2026-09-09T16:15:00.000Z', null),
  ('d6379b0b-2815-42bc-a3cb-cd2ad26a6ba9', '2fa9fcbf-9dc5-46e5-a29c-a761d04f6ed8', 'picked_up', '2026-08-29T07:40:45.239Z', '2026-09-09T08:20:00.000Z', null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('bc14bfb4-5e10-4db1-a0bf-913855f4af58', '9d62f5fd-1073-4098-a41e-dde68ab9ebfc', '2026-08-23T12:37:00.000Z', '2026-08-23T12:37:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('bc14bfb4-5e10-4db1-a0bf-913855f4af58', '3339bff0-e59f-471c-8a1a-4f2bd5b98c7f', 'picked_up', '2026-08-31T15:35:30.599Z', '2026-09-08T08:09:00.000Z', null),
  ('bc14bfb4-5e10-4db1-a0bf-913855f4af58', '58afc608-0db8-4034-9b2c-24556471df56', 'picked_up', '2026-08-31T15:35:30.599Z', '2026-09-08T09:12:00.000Z', null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('cafd8954-19e0-475a-94e2-f16d0ed82d4a', '35645652-07be-410f-b45b-0f636bec80db', '2026-08-25T11:21:00.000Z', '2026-08-25T11:21:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('cafd8954-19e0-475a-94e2-f16d0ed82d4a', '6fbcc710-cc04-4602-97f8-07fca7dbd385', 'picked_up', '2026-09-01T15:18:25.340Z', '2026-09-08T11:10:00.000Z', null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('ddda65c2-27dc-4e30-871c-a760123f1dc6', '37fd4486-ccc0-4883-bd13-43e3c57f63ea', '2026-08-28T14:51:00.000Z', '2026-08-28T14:51:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('ddda65c2-27dc-4e30-871c-a760123f1dc6', '58afc608-0db8-4034-9b2c-24556471df56', 'picked_up', '2026-09-06T03:18:02.831Z', '2026-09-08T16:33:00.000Z', null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('8284fbd9-2d38-4b01-9777-fb8cea73efb5', 'd1ba1afc-174d-491b-ba79-2e77912ecc80', '2026-09-04T14:00:00.000Z', '2026-09-04T14:00:00.000Z', 'Gift, please wrap');
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('8284fbd9-2d38-4b01-9777-fb8cea73efb5', '18c6e1fd-214a-4de6-b782-5f42ac5a46e6', 'picked_up', '2026-09-14T07:12:03.714Z', '2026-09-24T15:50:00.000Z', null),
  ('8284fbd9-2d38-4b01-9777-fb8cea73efb5', '58afc608-0db8-4034-9b2c-24556471df56', 'picked_up', '2026-09-14T07:12:03.714Z', '2026-09-24T15:59:00.000Z', null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('1410ff82-e9b8-455e-8fea-0c91f2b8ff15', 'd506513a-61fc-443c-9e7b-692b930b694d', '2026-09-08T16:15:00.000Z', '2026-09-08T16:15:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('1410ff82-e9b8-455e-8fea-0c91f2b8ff15', '58afc608-0db8-4034-9b2c-24556471df56', 'ready', null, null, null),
  ('1410ff82-e9b8-455e-8fea-0c91f2b8ff15', '58afc608-0db8-4034-9b2c-24556471df56', 'ready', null, null, null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('f1bb64c0-41cf-46bf-8e3b-5effbd7549c2', '090ffc07-14e4-4d46-a2af-993a5b5f092d', '2026-09-27T15:08:00.000Z', '2026-09-27T15:08:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('f1bb64c0-41cf-46bf-8e3b-5effbd7549c2', '6fbcc710-cc04-4602-97f8-07fca7dbd385', 'picked_up', '2026-10-04T15:16:03.762Z', '2026-10-12T07:39:00.000Z', null),
  ('f1bb64c0-41cf-46bf-8e3b-5effbd7549c2', '58afc608-0db8-4034-9b2c-24556471df56', 'picked_up', '2026-10-04T15:16:03.762Z', '2026-10-12T09:49:00.000Z', null),
  ('f1bb64c0-41cf-46bf-8e3b-5effbd7549c2', '949899ab-05a8-41aa-a5ee-f7149899d975', 'picked_up', '2026-10-04T15:16:03.762Z', '2026-10-12T09:49:00.000Z', null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('98bfe942-3820-4223-8f6a-ad00f5ba1091', '0e13c1af-2163-49d2-8aa3-f3b3f00d7b64', '2026-10-03T12:51:00.000Z', '2026-10-03T12:51:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('98bfe942-3820-4223-8f6a-ad00f5ba1091', '98c063fe-0329-4fe0-a3fd-109ba986a0f2', 'ready', '2026-10-12T19:03:31.596Z', null, null),
  ('98bfe942-3820-4223-8f6a-ad00f5ba1091', '58afc608-0db8-4034-9b2c-24556471df56', 'ready', '2026-10-12T19:03:31.596Z', null, null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('52e754eb-cc2f-4501-a9b7-a316871231f3', '50318ae5-b0bb-481f-944e-b0a779b2f08e', '2026-10-04T16:48:00.000Z', '2026-10-04T16:48:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('52e754eb-cc2f-4501-a9b7-a316871231f3', '58afc608-0db8-4034-9b2c-24556471df56', 'ready', null, null, null),
  ('52e754eb-cc2f-4501-a9b7-a316871231f3', '98c063fe-0329-4fe0-a3fd-109ba986a0f2', 'ready', null, null, null),
  ('52e754eb-cc2f-4501-a9b7-a316871231f3', '949899ab-05a8-41aa-a5ee-f7149899d975', 'ready', null, null, null),
  ('52e754eb-cc2f-4501-a9b7-a316871231f3', '18c6e1fd-214a-4de6-b782-5f42ac5a46e6', 'ready', null, null, null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('b8e5ca78-52b0-4a2e-ba29-65ba14e07091', '2a62d5b9-25d0-4f05-b74a-9d9800eea671', '2026-10-05T07:33:00.000Z', '2026-10-05T07:33:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('b8e5ca78-52b0-4a2e-ba29-65ba14e07091', '2fa9fcbf-9dc5-46e5-a29c-a761d04f6ed8', 'ready', '2026-10-12T13:32:43.806Z', null, 'Slight chip on rim before painting'),
  ('b8e5ca78-52b0-4a2e-ba29-65ba14e07091', '949899ab-05a8-41aa-a5ee-f7149899d975', 'ready', '2026-10-12T13:32:43.806Z', null, null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('e1c97dc2-0b4c-455f-9b77-7a6d083cca0c', 'd506513a-61fc-443c-9e7b-692b930b694d', '2026-10-05T16:24:00.000Z', '2026-10-05T16:24:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('e1c97dc2-0b4c-455f-9b77-7a6d083cca0c', '949899ab-05a8-41aa-a5ee-f7149899d975', 'ready', null, null, null),
  ('e1c97dc2-0b4c-455f-9b77-7a6d083cca0c', '18c6e1fd-214a-4de6-b782-5f42ac5a46e6', 'ready', null, null, null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('46ac7690-14a1-48f3-94e0-2d449a5a57a1', '35645652-07be-410f-b45b-0f636bec80db', '2026-10-06T09:22:00.000Z', '2026-10-06T09:22:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('46ac7690-14a1-48f3-94e0-2d449a5a57a1', '2fa9fcbf-9dc5-46e5-a29c-a761d04f6ed8', 'ready', null, null, null),
  ('46ac7690-14a1-48f3-94e0-2d449a5a57a1', '6fbcc710-cc04-4602-97f8-07fca7dbd385', 'received', null, null, null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('a09ffeb4-25ab-460b-9a5e-9cc7c358f077', 'd13bc322-0da0-4336-a6a2-d2897a1ae9bc', '2026-10-06T07:37:00.000Z', '2026-10-06T07:37:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('a09ffeb4-25ab-460b-9a5e-9cc7c358f077', '6fbcc710-cc04-4602-97f8-07fca7dbd385', 'ready', '2026-10-12T19:02:09.693Z', null, null),
  ('a09ffeb4-25ab-460b-9a5e-9cc7c358f077', '2fa9fcbf-9dc5-46e5-a29c-a761d04f6ed8', 'ready', '2026-10-12T19:02:09.693Z', null, null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('e3e499ef-94a5-43b0-b133-31fd82d0e2b5', '37fd4486-ccc0-4883-bd13-43e3c57f63ea', '2026-10-07T16:44:00.000Z', '2026-10-07T16:44:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('e3e499ef-94a5-43b0-b133-31fd82d0e2b5', '98c063fe-0329-4fe0-a3fd-109ba986a0f2', 'ready', null, null, null),
  ('e3e499ef-94a5-43b0-b133-31fd82d0e2b5', '949899ab-05a8-41aa-a5ee-f7149899d975', 'received', null, null, null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('11923065-69c7-400e-8dc4-f67745a2c68b', 'd1ba1afc-174d-491b-ba79-2e77912ecc80', '2026-10-07T12:29:00.000Z', '2026-10-07T12:29:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('11923065-69c7-400e-8dc4-f67745a2c68b', '98c063fe-0329-4fe0-a3fd-109ba986a0f2', 'ready', null, null, null),
  ('11923065-69c7-400e-8dc4-f67745a2c68b', '58afc608-0db8-4034-9b2c-24556471df56', 'received', null, null, null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('7774b0ad-cc6a-4528-bcea-e71cdfdca6a1', '4eb22a25-1b92-46c6-a613-af18618c589e', '2026-10-08T15:04:00.000Z', '2026-10-08T15:04:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('7774b0ad-cc6a-4528-bcea-e71cdfdca6a1', '58afc608-0db8-4034-9b2c-24556471df56', 'received', null, null, null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('e1ff6a01-406c-455c-bc69-474a337b3c16', 'd506513a-61fc-443c-9e7b-692b930b694d', '2026-10-09T14:59:00.000Z', '2026-10-09T14:59:00.000Z', 'Birthday party — 4 kids');
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('e1ff6a01-406c-455c-bc69-474a337b3c16', '2fa9fcbf-9dc5-46e5-a29c-a761d04f6ed8', 'received', null, null, null),
  ('e1ff6a01-406c-455c-bc69-474a337b3c16', '2fa9fcbf-9dc5-46e5-a29c-a761d04f6ed8', 'received', null, null, null);
insert into public.orders (id, customer_id, received_at, created_at, notes) values ('ec0b3bd4-66a0-478b-bd40-b7d75dedccd9', '9d62f5fd-1073-4098-a41e-dde68ab9ebfc', '2026-10-11T15:33:00.000Z', '2026-10-11T15:33:00.000Z', null);
insert into public.objects (order_id, object_type_id, status, notified_at, picked_up_at, notes) values
  ('ec0b3bd4-66a0-478b-bd40-b7d75dedccd9', '2fa9fcbf-9dc5-46e5-a29c-a761d04f6ed8', 'received', null, null, null),
  ('ec0b3bd4-66a0-478b-bd40-b7d75dedccd9', '949899ab-05a8-41aa-a5ee-f7149899d975', 'received', null, null, null);

-- Recompute "returning customer" flags, then start the activity log fresh
update public.customers c set is_returning = (
  select count(*) > 1 from public.objects o join public.orders r on r.id = o.order_id where r.customer_id = c.id
);
delete from public.activity_log;

commit;

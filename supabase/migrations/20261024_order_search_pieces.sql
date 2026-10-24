-- Orders search finds orders by what's in them: piece code (MGY2), type name (Mug) or the code a piece was entered
-- with ("was OLD9"). order_list gains one column at the end, pieces_text; everything else is unchanged.
-- Run once in Supabase → SQL Editor. Safe to run again.

CREATE OR REPLACE VIEW public.order_list WITH (security_invoker='true') AS
 WITH base AS (
         SELECT o.id,
            o.order_number,
            o.received_at,
            o.created_at,
            o.notes,
            o.customer_id,
            c.name AS customer_name,
            c.phone AS customer_phone,
            count(x.id) AS pieces,
            count(x.id) FILTER (WHERE (x.status = 'received'::text)) AS waiting,
            count(x.id) FILTER (WHERE (x.status = 'ready'::text)) AS ready,
            count(x.id) FILTER (WHERE (x.status = 'picked_up'::text)) AS collected,
            count(x.id) FILTER (WHERE ((x.status = 'ready'::text) AND (x.notified_at IS NULL))) AS ready_untold,
                CASE
                    WHEN (count(x.id) = 0) THEN 'empty'::text
                    WHEN (count(x.id) FILTER (WHERE (x.status = 'received'::text)) > 0) THEN 'waiting'::text
                    WHEN (count(x.id) FILTER (WHERE (x.status = 'ready'::text)) > 0) THEN 'ready'::text
                    ELSE 'collected'::text
                END AS stage,
            ((' '::text || COALESCE(string_agg(DISTINCT t.code, ' '::text), ''::text)) || ' '::text) AS codes,
            ((' '::text || COALESCE(string_agg(DISTINCT x.container, ' '::text) FILTER (WHERE (x.status = 'ready'::text)), ''::text)) || ' '::text) AS containers,
                CASE
                    WHEN ((count(x.id) FILTER (WHERE (x.status = 'received'::text)) = 0) AND (count(x.id) FILTER (WHERE (x.status = 'ready'::text)) > 0) AND (count(x.id) FILTER (WHERE ((x.status = 'ready'::text) AND (x.notified_at IS NULL))) = 0)) THEN max(x.notified_at) FILTER (WHERE (x.status = 'ready'::text))
                    ELSE NULL::timestamp with time zone
                END AS notified_last,
            o.reminder1_at,
            o.reminder2_at,
            ((' '::text || COALESCE(string_agg(DISTINCT concat_ws(' '::text, t.code, t.name, x.original_code), ' '::text), ''::text)) || ' '::text) AS pieces_text
           FROM (((public.orders o
             JOIN public.customers c ON ((c.id = o.customer_id)))
             LEFT JOIN public.objects x ON ((x.order_id = o.id)))
             LEFT JOIN public.object_types t ON ((t.id = x.object_type_id)))
          GROUP BY o.id, c.id
        ), raw AS (
         SELECT (app_settings.data ->> 'reminders'::text) AS on_txt,
            (app_settings.data ->> 'reminderDays'::text) AS days_txt
           FROM public.app_settings
          WHERE (app_settings.id = 1)
        ), cfg AS (
         SELECT COALESCE(( SELECT (raw.on_txt <> 'false'::text)
                   FROM raw), true) AS on_,
            make_interval(days => COALESCE(( SELECT LEAST(GREATEST((raw.days_txt)::integer, 1), 365) AS "least"
                   FROM raw
                  WHERE (raw.days_txt ~ '^\s*\d{1,4}\s*$'::text)), 14)) AS gap
        )
 SELECT b.id,
    b.order_number,
    b.received_at,
    b.created_at,
    b.notes,
    b.customer_id,
    b.customer_name,
    b.customer_phone,
    b.pieces,
    b.waiting,
    b.ready,
    b.collected,
    b.ready_untold,
    b.stage,
    b.codes,
    b.containers,
    b.notified_last,
    b.reminder1_at,
    b.reminder2_at,
        CASE
            WHEN ((NOT cfg.on_) OR (b.notified_last IS NULL)) THEN 0
            WHEN ((b.reminder1_at IS NULL) OR (b.reminder1_at < b.notified_last)) THEN
            CASE
                WHEN (now() >= (b.notified_last + cfg.gap)) THEN 1
                ELSE 0
            END
            WHEN ((b.reminder2_at IS NULL) OR (b.reminder2_at < b.reminder1_at)) THEN
            CASE
                WHEN (now() >= (b.reminder1_at + cfg.gap)) THEN 2
                ELSE 0
            END
            ELSE 0
        END AS reminder_due,
    b.pieces_text
   FROM (base b
     CROSS JOIN cfg);

grant select on public.order_list to authenticated;

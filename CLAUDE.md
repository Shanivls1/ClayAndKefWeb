# Clay And Kef — owner dashboard

## What this project is

An internal web dashboard for the owner of Clay And Kef, a ceramic painting shop.
Customers come in, pick an object (plate, mug, bowl...), paint it, and leave it at the shop.
When an object is ready, the owner marks it as done and sends the customer a WhatsApp message from the dashboard (one click opens the chat with the message typed in).

The app is **only used by the shop owner** — there is no customer-facing interface.

---

## Core features

1. **Order tracking** — a customer visit creates one order; each order can have multiple objects (physical ceramic pieces)
2. **Status updates** — advance each object's status individually; once objects are "ready", one click opens a WhatsApp chat to notify the customer
3. **Stock management** — track raw unpainted blanks per object type, and see painted in-progress counts
4. **Analytics dashboard** — most popular object types, revenue, returning vs new customers

---

## Data model

Five core tables in Supabase (PostgreSQL):

### `customers`

| column     | type      | notes                                   |
| ---------- | --------- | --------------------------------------- |
| id         | uuid PK   |                                         |
| name       | text      |                                         |
| phone      | text      | include country code, used for WhatsApp |
| notes      | text      | optional                                |
| created_at | timestamp |                                         |

Edited on the Customers page (pencil → name, phone, notes). The phone must be usable for WhatsApp (`normalizePhone`);
a number that already belongs to another customer only warns (families share phones) — pressing Save again goes ahead.

### `orders`

One row per customer visit. A single order groups all objects a customer leaves in one visit.
| column       | type      | notes                              |
| ------------ | --------- | ---------------------------------- |
| id           | uuid PK   |                                    |
| order_number | int       | 1–1000, then starts again at 1 (trigger `set_order_number`); skips numbers whose order still has uncollected pieces. **Not unique** over time — sort by `received_at`, identify by `id` |
| customer_id  | uuid FK → customers |                       |
| received_at  | timestamp | when the customer came in          |
| notes        | text      | optional order-level notes         |
| reminder1_at | timestamptz | pickup reminder 1 confirmed sent (see Pickup reminders) |
| reminder2_at | timestamptz | pickup reminder 2 confirmed sent   |
| created_at   | timestamp |                                    |

### `object_types`

The catalog of paintable items the shop sells.
| column          | type    | notes                                                           |
| --------------- | ------- | --------------------------------------------------------------- |
| id              | uuid PK |                                                                 |
| code            | text    | short uppercase identifier e.g. "BPLT", "SGYME" — very important to the owner |
| name            | text    | e.g. "large plate", "mug", "small bowl"                         |
| category        | text    | optional grouping                                               |
| price           | decimal | price charged to the customer                                   |
| raw_stock       | int     | unpainted blanks currently on the shelf                         |
| low_stock_alert | int     | threshold to highlight low stock in UI                          |
| supplier, supplier_ref | text | who sells it, and their reference                        |
| cost_price, cost_price_ttc | numeric | what the shop pays, before / with VAT                |
| pieces_per_box  | int     |                                                                 |
| boxes_ordered, pieces_ordered, order_total_ht, pieces_received, delivered | | the last supplier order |
| notes           | text    |                                                                 |

The catalogue comes from the owner's "Stock Bisques.xlsx" (git-ignored; `migrations/20261016_object_type_details.sql`
adds the columns). `price` is the customer price ("Prix public"). A type **UNKNOWN** holds past pieces whose code
wasn't in the catalogue; it isn't offered for new orders. Conflicts and the old-code mapping are listed for the owner
in "Stock conflicts for the owner.xlsx" (git-ignored). Edited on the Stock page (pencil → Edit).

### `objects`

One row per individual ceramic piece within an order.
| column         | type                | notes                                  |
| -------------- | ------------------- | -------------------------------------- |
| id             | uuid PK             |                                        |
| order_id       | uuid FK → orders    |                                        |
| object_type_id | uuid FK → object_types |                                     |
| object_number  | int                 | auto-assigned internal number — **not shown in the UI**; the owner writes the **order number** on every piece |
| status         | text                | see status lifecycle below             |
| notes          | text                | optional notes about this piece        |
| photo_url      | text                | optional photo stored in Supabase Storage |
| notified_at    | timestamp           | when the WhatsApp was sent             |
| original_code  | text                | the code the piece was entered with, when its type was changed to a catalogue code or UNKNOWN (shown as "was …") |
| container      | text                | where the piece is kept once ready (A–J, Cbis, מחסן שחור…) — chosen when marking ready |
| picked_up_at   | timestamp           | when the customer collected it         |

### Object status lifecycle

```
received → ready → picked_up
```

- `received`: object is at the shop, waiting to be fired
- `ready`: firing done — the owner can now send the customer a WhatsApp message
- `picked_up`: customer has collected it

Status is per individual object, not per order. An order may have objects in different statuses simultaneously.

---

## Backend: Supabase

- Database: PostgreSQL hosted on Supabase
- API: auto-generated REST API from Supabase (use the JS client `@supabase/supabase-js`)
- Realtime: Supabase Realtime for live dashboard updates
- Storage: Supabase Storage bucket `object-photos` for object photos
- Edge Functions: none used. (`notify-customer`, the old Meta Cloud API sender, is no longer called and can be deleted.)

### SQL files (`supabase/`)

Run by hand in the Supabase SQL Editor — the app's anon key can't change the schema.

- `migrations/` — schema changes, in date order. Each is safe to run more than once.
- `seed.sql` — **deletes all shop data and logs**, then inserts mock data (one transaction, numbering restarts at #001).
- `import_data1/` — the owner's real spreadsheet, as numbered parts (each small enough for the SQL Editor). Run them in
  order: `01_setup` (private staging schema `import_tmp`), the `0x_data` parts (staging only, re-runnable), then
  `xx_replace_live_data` — one transaction that **deletes all shop data and logs**, loads the staged data and drops staging;
  it refuses to run if a part is missing. Generated by `scripts/import_data1.py` from `data1.xlsx`; the spreadsheet,
  the parts and the not-imported report hold customer data and are git-ignored.
- Triggers: `trg_set_order_number` (orders; numbers 1–1000 cycling, see `migrations/20261014_order_numbers_1_to_1000.sql`), `trg_is_returning` (objects → keeps `customers.is_returning` current, via orders),
  `log_activity` (all four tables). There is no WhatsApp webhook trigger anymore.
- Deleting (`migrations/20261015_delete_functions.sql`, RPCs, all-or-nothing): `delete_order(p_order_id, p_restock)` — the order
  and its pieces, optionally putting waiting blanks back in stock; `delete_customer(p_customer_id)` — with all their orders
  and pieces; `delete_object_type(p_type_id)` — refused while any piece uses it. The app confirms each with `confirm.js`
  (`confirmDanger`); every deleted row stays in `activity_log`.

### Sign-in and access (security)

The dashboard is on the public internet (Vercel), so **the database is the lock, not the page**
(`migrations/20261016_lock_down.sql`):
- The anon (public) key can do **nothing**: all grants revoked from `anon`, also for objects created later.
- Every table has row-level security with one rule: allowed only when `public.is_staff()` — the signed-in user
  (Supabase Auth, email + password) is listed in `public.staff`. A signed-in account that isn't listed sees 0 rows.
- All views are `security_invoker`, so the table rules apply through them. `delete_*` functions: `authenticated` only.
- `activity_log`: staff read it and insert `source = 'app'` rows; the `log_activity` trigger (security definer) writes the rest.
- Storage bucket `object-type-images`: images are viewable by URL; only staff upload or change them.
- **Any new table, view or function must follow the same pattern** (RLS + `is_staff()` policy, no anon grant, views with
  `security_invoker = true`) or it is either unreachable or open.
- Add a staff member: create their account in Supabase → Authentication → Users → Add user, then **Settings → People with
  access** → their email → Give access (`add_staff` / `remove_staff` / `list_staff`, `migrations/20261016_staff_admin.sql`:
  staff only; you can't remove yourself or the last person). Creating accounts needs the admin key, so it stays in Supabase.
- In the app, `auth.js` shows the sign-in screen until a staff member is signed in (`requireStaff()` in `app.js` runs
  before the router); Sign out (bottom of the sidebar) reloads the page so nothing stays in memory.

### Environment variables

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Locally they live in `env.js` (git-ignored; copy `env.example.js`). On Vercel they are project Environment Variables;
the build (`vercel.json` → `scripts/write-env.mjs`) writes `env.js` from them. Without them the page says so.

### WhatsApp notification logic

No WhatsApp API — the dashboard uses click-to-chat links to WhatsApp Web (`https://web.whatsapp.com/send?phone=…&text=…`).
All of it lives in `whatsapp.js` so it can later be swapped for an automated sender without touching the pages.

- Marking an object `ready` does not message anyone by itself.
- **One message per order, only once every piece is ready** (no object still `received`). Until then the opened order
  shows "Send the WhatsApp once all N pieces are ready · X of N ready".
- When the whole order is ready and some `ready` object has `notified_at IS NULL`, the order shows **Send WhatsApp**
  (in the row and in the opened order; the toast after marking the last piece ready offers it too). The message (Hebrew)
  names the order number and the pieces grouped by type, opens in a single reused browser tab, and sets `notified_at`
  on the order's `ready` objects.
- **Opening the chat is not "sent".** After Send WhatsApp the order waits for the owner's answer ("Sent? ✓ ✕" in the
  row, "Opened in WhatsApp — did the message go out?" in the opened order, and a tray at the bottom collecting every
  unanswered chat with **All sent** / Review). Only ✓ sets `notified_at` (to the time the chat was opened).
- Every opening is logged (`activity_log`, `details.kind='wa_opened'`, `details.opened_at`), so unanswered chats come
  back after a reload or days later: an order is "waiting for an answer" when its latest WhatsApp event is
  `wa_opened`, it still has `ready` pieces, and none has `notified_at >= opened_at`. Each shows when it was opened.
- A **check** button (WhatsApp icon, next to ✓ ✕, and "Check chat" in the opened order) opens the customer's chat
  with nothing typed, so the owner can see whether the message is really there before answering.
- ✕ asks "Why didn't it go out?" — preset reasons or a typed one. It's logged to `activity_log`
  (`source='app'`, `details.kind='wa_not_sent'`, `details.order_id`, `details.reason`), shown on the order until a later
  message is confirmed, and typed reasons become quick choices next time.
- Once sent, the order shows "WhatsApp sent <date> · **Send again**" (re-sends for the whole order).
- Pieces are identified to the owner by type + order number only — never by `object_number`.
- The owner presses Enter in WhatsApp to actually send — `notified_at` means "chat opened", not "delivered".
- Phones are normalized to international digits: a leading `0` becomes `972`.

### Pickup reminders

`migrations/20261015_reminders.sql`. For orders whose customer was told (all `ready` pieces have `notified_at`) but
that still have `ready` pieces: **reminder 1** is due `reminderDays` (default 14) after the latest `notified_at`,
**reminder 2** `reminderDays` after reminder 1, then nothing more. A reminder sent before a newer "ready" message
(Send again) no longer counts, so the count starts over. The rule is in two places that must agree:
`order_list.reminder_due` (0/1/2, used for the "N orders need a pickup reminder" banner and the WhatsApp → Reminder due
filter) and `reminderInfo()` in `pages/orders.js` (row button "Send reminder" / "Send reminder 2", bell pin, opened-order strip).
Sending works like the first message: the chat opens with `reminder1Template` / `reminder2Template`, the `wa_opened`
log event carries `details.message` = `reminder1` / `reminder2`, and only ✓ saves `orders.reminder1_at` / `reminder2_at`
(✕ records a reason as usual). Nothing is sent automatically.
The sidebar shows the number of orders with a reminder due as a blue badge on **Orders** (`navbadge.js`): loaded at
start, on every page change, when the tab comes back into view and every 10 minutes; the Orders page pushes its own
count with `setRemindBadge()`, and Settings refreshes it after changing reminders or days. Hidden at 0, "99+" above 99.

---

## Analytics: Supabase views

These views exist in Supabase.
All views join through `objects → orders → customers` (never directly through objects.customer_id, which no longer exists).

- `popular_object_types` — count of objects per type, last 90 days
- `revenue_per_customer` — columns: `customer_id`, `customer_name`, `object_count`, `total_revenue`
- `customer_retention` — new vs returning customer counts per month

The dashboard only reads `customer_retention`. "Top object types" and "Top customers by spend" are computed
in the browser from `objects` (joined through orders) so they follow the selected date range (30 days / 90 days / 1 year / all time); the two fixed-range views can't.

Supabase returns at most 1000 rows per request — use `fetchAllRows()` from `utils.js` for any query that reads a whole table.

Queries made with the anon key are cancelled after **3 seconds** (`statement_timeout`). With real data (~4k orders,
~11k pieces) that only holds because of the indexes in `migrations/20261014_indexes.sql` — when adding a query that
filters, sorts or embeds on a new column, add an index for it too.

### Lists: paging and filters

Every list page uses the shared controls in `listui.js` (filter bar: search, chips, selects, date range,
"Clear filters"; pager: page buttons + 10/25/50/100 per page).
- **Orders** and **Customers** filter, sort and page in the database through two views
  (`migrations/20261014_list_views.sql`, `security_invoker`): `order_list` (per order: customer, `stage` =
  waiting/ready/collected/empty, `ready_untold`, padded `codes`) and `customer_list` (visits, pieces, last_visit,
  open_orders). Orders fetches the page's ids from the view, then those orders in full.
- **Stock** filters/sorts/pages in the browser (all types are loaded anyway). **Logs** filters on `activity_log`.
- Orders search: 1–4 digits (or `#12`) = order number, longer digits = phone, text = name or phone.
- Orders: search and sort are always visible; the other filters (Status: All / Waiting / Ready / Collected,
  WhatsApp, object type, container, dates) sit behind a **Filters** button, collapsed when the page opens. Its badge
  counts the hidden filters that are on (`filterToggle` / `updateToggle` in `listui.js`).

---

## Home page

`pages/home.js`, route `#/home` — the page the app opens on (router default) and the first sidebar item. The everyday jobs:
- **New order** in three steps: customer (instant search over all customers by name or phone digits — `050…`, `+972-50…`
  and `0501…` all match — or "+ New customer" prefilled from what was typed, with a duplicate-phone check), pieces
  (quick picks = the 10 types used most in the latest 300 orders, a type search with Enter to add, − / + amounts),
  optional note and date. A new customer is saved first, then the order; on success the order number is shown large
  ("write this on every piece") with **Start the next order**. Order creation is shared with the Orders page: `neworder.js`
  (`createOrder` — inserts the order and pieces, removes an empty order if pieces fail, lowers stock).
- **Customer collecting?** — open orders (stage waiting/ready) by order number, phone or name; **Collect** marks the ready
  pieces collected, with Undo.
- **To do** — pieces waiting to be fired, WhatsApp to send, pickup reminders due; each links to Orders already filtered.
  The Orders page reads `#/orders?stage=…&wa=…&q=…` once on load (the router ignores the `?…` part when choosing the page).

## Settings

Table `app_settings` (one row, `id = 1`, JSON in `data`; created by `supabase/migrations/20261014_settings.sql`).
`settings.js` loads/saves it; until the table exists the defaults apply and the Settings page shows how to set it up.

| key               | default | effect |
| ----------------- | ------- | ------ |
| `messageTemplate` | `DEFAULT_MESSAGE` in `whatsapp.js` | WhatsApp text; placeholders `{name}` (first name), `{order}` (#012), `{pieces}` ("Medium Cup ×2, Bowl"), `{count}` |
| `confirmSent`     | true    | ask "Sent? ✓ ✕" after opening WhatsApp; off → opening counts as told immediately |
| `askWhyNotSent`   | true    | ✕ asks for a reason; off → records "Not sent" (only matters when `confirmSent` is on) |
| `undoBar`         | true    | bar with Undo / Send WhatsApp after status changes; off → no bar (errors still show) |
| `reminders`       | true    | offer pickup reminders (off → no banner, buttons or "due" orders) |
| `reminderDays`    | 14      | days before reminder 1 (after the ready message) and reminder 2 (after reminder 1) |
| `reminder1Template` / `reminder2Template` | `DEFAULT_REMINDER1` / `2` in `whatsapp.js` | reminder texts, same placeholders; edited in the Reminder 1 / 2 tabs |
| `containers`      | A–J, Cbis, מחסן שחור, מחסן שקוף, מדף, שקית בקופה | choices in the container picker (Settings → Containers) |

The Orders page reads settings with `loadSettings({ fresh: true })` on mount. Changes are logged as app `info` events.

---

## Logging

Table `activity_log` (created by `supabase/migrations/20261014_activity_log.sql`, run in the Supabase SQL Editor):

- **Database changes** (`source = 'db'`): a trigger on `customers`, `orders`, `objects` and `object_types` records every
  INSERT / UPDATE / DELETE with `old_data`, `new_data` and the `changed` column names. Updates that change nothing are skipped.
  If writing the log fails, the original change still succeeds.
- **App events** (`source = 'app'`, `action` = error / warning / info): sent by `logEvent()` in `log.js`. Call it wherever
  the UI shows an error from Supabase. `installErrorLogging()` also catches uncaught errors and rejected promises.
- The dashboard may read the log and insert `source = 'app'` rows only — RLS blocks editing or deleting entries.
- The **Logs** page (`pages/logs.js`) shows it newest first with filters, in plain sentences; click a row for before/after values.

---

## Key business rules

- Decrement `object_types.raw_stock` by 1 for each object inserted when a new order is created
- "Painted in progress" count = objects with status `received`, grouped by object_type_id (derived, no extra column)
- A customer is "returning" if they have more than one object across all their orders
- WhatsApp is per order: only offered when no object in the order is still `received`; re-sending is an explicit "Send again"
- Objects cannot skip statuses — enforce order: received → ready → picked_up
- Marking pieces ready always asks for a **container** (picker: click, press the letter, or type another); it's
  saved on `objects.container`, shown on the piece and the order row, can be moved later, and Undo clears it.
  `order_list.containers` lists the containers of an order's ready pieces (Orders → Container filter)
- Customer and date live on the `orders` table, not on individual objects. Always join through orders to get these fields.

---

## Frontend rules

### Always do first

- **Invoke the `frontend-design` skill** before writing any frontend code, every session, no exceptions.

### Reference images

- If a reference image is provided: match layout, spacing, typography, and color exactly. Swap in placeholder content (images via `https://placehold.co/`, generic copy). Do not improve or add to the design.
- If no reference image: design from scratch with high craft (see guardrails below).
- Screenshot your output, compare against reference, fix mismatches, re-screenshot. Do at least 2 comparison rounds. Stop only when no visible differences remain or user says so.

### Local server

- **Always serve on localhost** — never screenshot a `file:///` URL.
- Start the dev server: `node serve.mjs` (serves the project root at `http://localhost:3000`)
- `serve.mjs` lives in the project root. Start it in the background before taking any screenshots.
- If the server is already running, do not start a second instance.

### Screenshot workflow

- Puppeteer is installed at `C:/Users/nateh/AppData/Local/Temp/puppeteer-test/`. Chrome cache is at `C:/Users/nateh/.cache/puppeteer/`.
- **Always screenshot from localhost:** `node screenshot.mjs http://localhost:3000`
- Screenshots are saved automatically to `./temporary screenshots/screenshot-N.png` (auto-incremented, never overwritten).
- Optional label suffix: `node screenshot.mjs http://localhost:3000 label` → saves as `screenshot-N-label.png`
- `screenshot.mjs` lives in the project root. Use it as-is.
- After screenshotting, read the PNG from `temporary screenshots/` with the Read tool — Claude can see and analyze the image directly.
- When comparing, be specific: "heading is 32px but reference shows ~24px", "card gap is 16px but should be 24px"
- Check: spacing/padding, font size/weight/line-height, colors (exact hex), alignment, border-radius, shadows, image sizing

### Output defaults

- Single `index.html` file, all styles inline, unless user says otherwise
- Tailwind CSS via CDN: `<script src="https://cdn.tailwindcss.com"></script>`
- Placeholder images: `https://placehold.co/WIDTHxHEIGHT`
- Mobile-first responsive

### Brand assets

- Always check the `brand_assets/` folder before designing. It may contain logos, color guides, style guides, or images.
- If assets exist there, use them. Do not use placeholders where real assets are available.
- If a logo is present, use it. If a color palette is defined, use those exact values — do not invent brand colors.

### Anti-generic guardrails

- **Colors:** Never use default Tailwind palette (indigo-500, blue-600, etc.). Pick a custom brand color and derive from it.
- **Shadows:** Never use flat `shadow-md`. Use layered, color-tinted shadows with low opacity.
- **Typography:** Never use the same font for headings and body. Pair a display/serif with a clean sans. Apply tight tracking (`-0.03em`) on large headings, generous line-height (`1.7`) on body.
- **Gradients:** Layer multiple radial gradients. Add grain/texture via SVG noise filter for depth.
- **Animations:** Only animate `transform` and `opacity`. Never `transition-all`. Use spring-style easing.
- **Interactive states:** Every clickable element needs hover, focus-visible, and active states. No exceptions.
- **Images:** Add a gradient overlay (`bg-gradient-to-t from-black/60`) and a color treatment layer with `mix-blend-multiply`.
- **Spacing:** Use intentional, consistent spacing tokens — not random Tailwind steps.
- **Depth:** Surfaces should have a layering system (base → elevated → floating), not all sit at the same z-plane.

### Hard rules

- Do not add sections, features, or content not in the reference
- Do not "improve" a reference design — match it
- Do not stop after one screenshot pass
- Do not use `transition-all`
- Do not use default Tailwind blue/indigo as primary color

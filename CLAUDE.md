# Clay And Kef — owner dashboard

## What this project is

An internal web dashboard for the owner of Clay And Kef, a ceramic painting shop.
Customers come in, pick an object (plate, mug, bowl...), paint it, and leave it at the shop.
When an object is ready, the owner marks it as done and a WhatsApp message is automatically sent to the customer.

The app is **only used by the shop owner** — there is no customer-facing interface.

---

## Core features

1. **Object tracking** — add and manage customer objects through their full lifecycle
2. **Status updates** — advance an object's status; marking it "ready" triggers a WhatsApp notification
3. **Stock management** — track raw unpainted blanks per object type, and see painted in-progress counts
4. **Analytics dashboard** — most popular object types, revenue, returning vs new customers

---

## Data model

Four core tables in Supabase (PostgreSQL):

### `customers`

| column       | type      | notes                                     |
| ------------ | --------- | ----------------------------------------- |
| id           | uuid PK   |                                           |
| name         | text      |                                           |
| phone        | text      | include country code, used for WhatsApp   |
| notes        | text      | optional                                  |
| created_at   | timestamp |                                           |
| is_returning | boolean   | derived: true if has more than one object |

### `object_types`

The catalog of paintable items the shop sells.
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| name | text | e.g. "large plate", "mug", "small bowl" |
| category | text | optional grouping |
| price | decimal | price charged to the customer |
| raw_stock | int | unpainted blanks currently on the shelf |
| low_stock_alert | int | threshold to highlight low stock in UI |

### `objects`

One row per object a customer has brought in to paint.
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| customer_id | uuid FK → customers | |
| object_type_id | uuid FK → object_types | |
| status | text | see status lifecycle below |
| notes | text | optional notes about this object |
| photo_url | text | optional photo stored in Supabase Storage |
| received_at | timestamp | when the object arrived |
| notified_at | timestamp | when the WhatsApp was sent |
| picked_up_at | timestamp | when the customer collected it |

### Object status lifecycle

```
received → ready → picked_up
```

- `received`: object is at the shop, waiting to be fired
- `ready`: firing done — **triggers WhatsApp message to customer**
- `picked_up`: customer has collected it

---

## Backend: Supabase

- Database: PostgreSQL hosted on Supabase
- API: auto-generated REST API from Supabase (use the JS client `@supabase/supabase-js`)
- Realtime: Supabase Realtime for live dashboard updates
- Storage: Supabase Storage bucket `object-photos` for object photos
- Edge Functions: one function `notify-customer` called by the frontend when `status` changes to `ready`

### Environment variables

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### WhatsApp notification logic

When the owner advances an object to `ready`, the frontend calls the `notify-customer` Edge Function with the object id.
The function reads the object's customer phone number and sends a message via the Meta Cloud API (WhatsApp Business).
The `notified_at` timestamp is set by the frontend after successful delivery. The Edge Function checks `notified_at IS NULL` before sending to prevent double-sends.

---

## Analytics: Supabase views

These views are pre-computed in Supabase and fetched directly by the frontend:

- `popular_object_types` — count of objects per type, last 90 days
- `revenue_per_customer` — sum of object_type prices per customer
- `customer_retention` — new vs returning customer counts per month

---

## Key business rules

- Decrement `object_types.raw_stock` by 1 when a new object row is created
- "Painted in progress" count = objects with status `received`, grouped by object_type_id (derived, no extra column)
- A customer is "returning" if they have more than one object row across all time
- WhatsApp notification must only fire once: check `notified_at IS NULL` before sending
- Objects cannot skip statuses — enforce order: received → ready → picked_up

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

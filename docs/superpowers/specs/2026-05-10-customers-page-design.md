# Clay & Kef — Customers Page Design

**Date:** 2026-05-10
**Scope:** Customers page — searchable table, add customer modal, router lifecycle extension

---

## Decisions

| Question | Decision |
|---|---|
| Async data in sync router | Extend router with optional `mount(el)` hook called after innerHTML |
| Data aggregation | Client-side from nested Supabase join (total_objects, last_visit) |
| Search | Client-side filter on in-memory array; re-renders tbody only |
| is_returning | Derived client-side: `objects.length > 1` |
| Add customer | Modal overlay; INSERT then re-fetch full list |
| Delete | Not implemented per spec |

---

## Architecture

### Router extension (`router.js`)

Add one call after `el.innerHTML = page.render()`:

```js
if (page.mount) page.mount(el);
```

No breaking changes — existing pages with no `mount` export are unaffected.

### `pages/customers.js`

Exports two functions:

**`render()`** — synchronous, returns HTML string with:
- Page header (title + "Add Customer" button)
- Search input
- Table with thead and a tbody showing skeleton placeholder rows

**`mount(el)`** — async, runs after render:
1. Fetches all customers with nested objects join
2. Builds and injects real table rows into `#customers-tbody`
3. Wires search input to client-side filter
4. Wires "Add Customer" button to open modal
5. Wires modal form submit to INSERT + re-fetch

### Data query

```js
supabase
  .from('customers')
  .select('id, name, phone, notes, objects(id, received_at)')
  .order('name')
```

Derived per customer row:
- `total_objects` = `objects.length`
- `last_visit` = `max(objects.map(o => o.received_at))` or `null`
- `is_returning` = `objects.length > 1`

### Search

- Triggered on `input` event of the search field
- Filters the in-memory `customers` array against name and phone (case-insensitive substring)
- Re-renders only `#customers-tbody` innerHTML — no re-fetch

### Add Customer modal

Fields:
- **Name** — text input, required
- **Phone** — text input, required, include country code hint
- **Notes** — textarea, optional

On submit:
1. Validate name and phone are non-empty
2. `supabase.from('customers').insert({ name, phone, notes })`
3. Close modal
4. Re-fetch full customer list and re-render table

No `raw_stock` changes — stock is decremented only when an object is created, not a customer.

---

## UI Spec

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  Customers                          [+ Add Customer]    │
│  ─────────────────────────────────────────────────────  │
│  🔍 Search by name or phone...                          │
│  ─────────────────────────────────────────────────────  │
│  Name        Phone        Objects  Last Visit  Status   │
│  ─────────────────────────────────────────────────────  │
│  Dana Cohen  +972-50-...  4        12 Apr 2026  ◆ Ret.  │
│  Miri Levi   +972-52-...  1        3 May 2026           │
│  ...                                                    │
└─────────────────────────────────────────────────────────┘
```

### Table columns

| Column | Source | Format |
|---|---|---|
| Name | `customers.name` | Plain text |
| Phone | `customers.phone` | Plain text |
| Objects | `objects.length` | Number |
| Last Visit | `max(objects.received_at)` | "DD MMM YYYY" or "—" |
| Status | `is_returning` | Terracotta pill "Returning" if true; empty if false |

### Returning badge

Small pill: `background: rgba(196,149,106,0.15)`, `color: #c4956a`, `border-radius: 999px`, text "Returning", font-size 12px, font-weight 500.

### Empty state

When search returns no results: full-width row spanning all columns with centered muted text "No customers found."

### Skeleton loading

Three placeholder rows with animated shimmer (`background: linear-gradient(90deg, #f0ebe4 25%, #e8e1d8 50%, #f0ebe4 75%)`) while data loads.

### Add Customer button

Terracotta filled (`background: #c4956a`, `color: white`), hover darkens to `#b3845a`. Positioned top-right of the page header.

### Modal

- Semi-transparent backdrop (`background: rgba(26,18,11,0.4)`)
- Centered card, white background, `border-radius: 12px`, `padding: 32px`, max-width 420px
- Close button (×) top-right corner
- Primary action button: terracotta filled, full width, "Add Customer"
- Cancel link below

---

## Error handling

- Supabase fetch failure: replace skeleton with a muted error message in tbody
- Insert failure: show inline error below the form submit button; keep modal open

---

## Out of scope

- Delete customer
- Edit customer details
- Pagination (ceramic shop has a small customer count)
- Server-side search

# Clay & Kef — Objects Page Design

**Date:** 2026-05-11
**Scope:** Objects page — table with lifecycle status, filters, per-row advance dropdown, Add Object modal, WhatsApp notification indicator

---

## Decisions

| Question | Decision |
|---|---|
| Status lifecycle | `received` → `ready` → `picked_up` only. `in_oven` kept in DB schema but not used in this UI. No batches. |
| Status display labels | `received` → "Waiting", `ready` → "Ready", `picked_up` → "Picked Up" |
| WhatsApp indicator | Inline under the Ready badge: green if `notified_at` is set, red if null |
| Data loading | Single join query, all rows in memory, client-side filtering — same pattern as customers page |
| Add Object form | Customer + Object Type + Date In (defaults today) + Notes (optional) |
| raw_stock decrement | Separate UPDATE on `object_types` immediately after INSERT |
| Notify Edge Function | Called client-side on status → ready; `notified_at` set after successful response |

---

## Architecture

### `pages/objects.js`

Exports two functions matching the existing page pattern:

**`render()`** — synchronous, returns HTML string with:
- Page header (title + "+ Add Object" button)
- Filter bar (search input + status select + object type select)
- Table with thead and skeleton placeholder rows
- Add Object modal (hidden)

**`mount(el)`** — async, runs after render:
1. Fetch all object types (for filter dropdown + Add Object form)
2. Fetch all customers (for Add Object form)
3. Fetch all objects with joined customer name and object type name, ordered by `received_at DESC`
4. Render table rows
5. Wire search + filter inputs to client-side filter function
6. Wire "+ Add Object" button to open modal
7. Wire modal form submit
8. Wire per-row advance dropdowns

---

## Data Queries

### Main object list

```js
supabase
  .from('objects')
  .select(`
    id,
    status,
    received_at,
    notified_at,
    customers ( id, name ),
    object_types ( id, name )
  `)
  .order('received_at', { ascending: false })
```

### Object types (for filter + form)

```js
supabase
  .from('object_types')
  .select('id, name, raw_stock')
  .order('name')
```

### Customers (for form)

```js
supabase
  .from('customers')
  .select('id, name')
  .order('name')
```

---

## Status Lifecycle

```
received → ready → picked_up
```

Display labels:

| DB value | Display label | Badge color |
|---|---|---|
| `received` | Waiting | Terracotta — `rgba(196,149,106,0.12)` bg, `#b3845a` text |
| `ready` | Ready ✓ | Green — `rgba(80,160,80,0.12)` bg, `#3a8a3a` text |
| `picked_up` | Picked Up | Grey — `#ede8e2` bg, `#8a7560` text |

The advance dropdown for each row only offers the one valid next status:
- Waiting → offers "Ready"
- Ready → offers "Picked Up"
- Picked Up → no dropdown ("— complete —" text, row at 50% opacity)

Statuses cannot be skipped or reversed. The `<select>` only exposes one option.

---

## WhatsApp Notification Indicator

Rendered inline below the Ready badge (Status column). Only shown when `status = 'ready'`.

| Condition | Display |
|---|---|
| `notified_at` is set | Green WhatsApp icon + "Message sent" (font-size 11px, color `#25D366`) |
| `notified_at` is null | Red WhatsApp icon + "Message not sent" (font-size 11px, color `#c0392b`) |
| Status is not `ready` | Nothing |

---

## Status Advance — Logic

When the advance dropdown changes to a new status:

1. Immediately update the badge UI (optimistic)
2. `supabase.from('objects').update({ status: newStatus }).eq('id', objectId)`
3. If `newStatus === 'ready'`:
   a. Call Supabase Edge Function `notify-customer` with the object id. The Edge Function checks `notified_at IS NULL` server-side before sending — double-send is safe.
   b. On success: `supabase.from('objects').update({ notified_at: new Date().toISOString() }).eq('id', objectId)` then update WhatsApp indicator to green
   c. On failure: update WhatsApp indicator to red ("Message not sent")
4. If DB update fails: revert the badge to the previous status, show an alert

---

## Filters

Three controls above the table, applied client-side to the in-memory array:

| Control | Behaviour |
|---|---|
| Search input | Case-insensitive substring match on customer name OR object type name |
| Status select | "All statuses" (default) or one of: Waiting / Ready / Picked Up |
| Object type select | "All types" (default) or a specific object type name — populated from `object_types` at mount |

All three filters compose (AND). Re-renders table body only, no re-fetch.

---

## Add Object Modal

**Fields:**

| Field | Type | Notes |
|---|---|---|
| Customer | `<select>` populated from customers | Required |
| Object Type | `<select>` populated from object_types | Required |
| Date In | `<input type="date">` | Required, defaults to today |
| Notes | `<textarea>` | Optional |

**On submit:**

1. Validate customer, object type, and date are set
2. `supabase.from('objects').insert({ customer_id, object_type_id, status: 'received', received_at, notes })`
3. `supabase.from('object_types').update({ raw_stock: currentStock - 1 }).eq('id', object_type_id)`
4. Close modal, re-fetch full object list and re-render table

The current `raw_stock` for the chosen object type is read from the already-fetched `objectTypes` array in memory — no extra round trip.

---

## UI Spec

### Table columns

| Column | Width | Source |
|---|---|---|
| Customer | 2fr | `customers.name` |
| Object Type | 1.5fr | `object_types.name` |
| Status | 110px | `objects.status` (with WhatsApp indicator below for Ready) |
| Date In | 1fr | `objects.received_at` formatted as "D MMM YYYY" |
| Advance | 140px | Status dropdown or "— complete —" |

### Visual treatments

- Table: white card, `border-radius: 12px`, subtle layered shadow, `border: 1px solid #e8e1d8`
- Header row: `background: #f5f0eb`, uppercase labels 11px
- Ready rows: subtle `background: #f9fdf7` green tint
- Picked Up rows: `opacity: 0.5`
- Row hover: `background: #faf7f4`
- Status legend strip below table

### Skeleton loading

Four placeholder rows with shimmer animation while data loads (same `ck-shimmer` keyframe as customers page).

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Initial fetch fails | Replace skeleton with centered muted error message |
| Status update fails | Revert badge to previous status; `alert()` with error message |
| Edge Function fails | `notified_at` stays null; red indicator shows "Message not sent" |
| Insert fails | Inline error below form submit button; modal stays open |
| raw_stock UPDATE fails | Log to console; do not block the UI (stock page will show the discrepancy) |

---

## Out of Scope

- Delete or edit an object
- Photo upload
- Batch assignment
- `in_oven` status in the UI
- Pagination (shop scale doesn't require it)
- Retry button for failed WhatsApp notifications

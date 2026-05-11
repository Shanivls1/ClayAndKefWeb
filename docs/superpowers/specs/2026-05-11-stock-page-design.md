# Stock Page — Design Spec

**Date:** 2026-05-11
**Status:** Approved

---

## Overview

The Stock page lets the shop owner manage raw unpainted blanks (raw stock) per object type, and see how many of each type are currently being painted (in-progress). It replaces the current stub in `pages/stock.js`.

---

## Architecture

`pages/stock.js` follows the same module pattern as the rest of the app:
- `render()` — returns the full HTML string (page shell + card grid skeleton + modal)
- `mount(el)` — async; fetches data, renders cards, wires +/− buttons and modal

No new files needed. All logic lives in `pages/stock.js`.

---

## Page Structure

- **Header row:** Playfair Display "Stock" title (32px, `#1a120b`) + subtitle ("Manage raw stock per object type.", Inter 15px, `#8a7560`) left-aligned. `+ Add Object Type` button top-right (same style as Objects page: `#c4956a` fill, white text, `border-radius: 8px`, hover darkens to `#b3845a`).
- **Card grid:** responsive, `repeat(auto-fill, minmax(260px, 1fr))` with `gap: 20px`.
- **Background:** SVG grain texture (opacity 0.04) + top-right radial gradient — carried over from Objects page. Both are `position: fixed`, `pointer-events: none`, `z-index: 0`. Content area is `position: relative; z-index: 1`.

---

## Card Anatomy

Each card is a white rounded container (`border-radius: 14px`, `border: 1px solid #e8e1d8`, `box-shadow: 0 2px 6px rgba(45,31,20,0.08), 0 8px 24px rgba(45,31,20,0.05)`, `padding: 20px`).

### Normal state

| Area | Content |
|---|---|
| Top | Object type name — Playfair Display, 18px, 700, `#1a120b` |
| Below name | Category pill — small, `background: #f0ebe4`, `color: #8a7560`, `border-radius: 999px`, `font-size: 11px`. If no category, pill is omitted. |
| Price row | Price formatted as currency (e.g. `₪45`), Inter 22px, `#c4956a`, font-weight 600. |
| Stat: Raw stock | Label "Raw stock" (Inter 11px uppercase, `#8a7560`) + count (Inter 20px bold, `#1a120b`) + `−` / `+` buttons flanking the count. |
| Stat: In progress | Label "In progress" (same label style) + read-only count (same count style, `#5a4a3a`). No buttons. |

### Low-stock state (raw_stock ≤ low_stock_alert)

- Left border: `4px solid #d97706`
- Background tint: `#fffbf5`
- Category pill replaced by amber "Low stock" warning pill (`background: rgba(217,119,6,0.12)`, `color: #b45309`, same size/radius as category pill)

### +/− button spec

- Size: 28×28px, `border-radius: 6px`, `border: 1px solid #e0d8cf`, `background: #fff`
- Hover: `background: #f5f0eb`, `border-color: #c4956a`
- Active: `background: #ede8e2`
- Minus button disabled (opacity 0.35, cursor not-allowed, no hover effect) when `raw_stock === 0`
- On click: optimistic DOM update → `supabase.from('object_types').update({ raw_stock: newValue }).eq('id', typeId)`. On error: revert count, show inline error text below the stat row (`color: #b94040`, `font-size: 12px`).
- Low-stock state re-evaluated after every successful update.

---

## Skeleton Loading

While data loads, render 6 skeleton cards: same card dimensions, with shimmer rectangles for name, pill, price, and stat rows. Uses the existing `.ck-skel` shimmer animation from the Objects page (extracted into the `<style>` block inside `render()`).

---

## Data Fetching

Both queries fired in parallel via `Promise.all` inside `mount()`:

1. **Object types:**
   ```js
   supabase.from('object_types').select('*').order('category').order('name')
   ```

2. **In-progress counts:**
   ```js
   supabase.from('objects')
     .select('object_type_id')
     .eq('status', 'received')
   ```
   Result is reduced client-side into a `Map<object_type_id, count>`.

Sorting: cards rendered sorted by category (nulls last) then name, both ascending — consistent with the query order.

---

## Add Object Type Modal

Same modal pattern as the Objects page (`position: fixed`, backdrop, white card, Playfair title, Inter form fields).

**Fields:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| Name | text input | yes | — |
| Category | text input | no | — |
| Price | number input | yes | min 0, step 0.01 |
| Initial Stock | number input | yes | min 0, integer |
| Alert Threshold | number input | yes | min 0, integer |

**Submit flow:**
1. Validate required fields client-side; show inline error if missing.
2. Disable button, show "Adding…"
3. `supabase.from('object_types').insert({ name, category: category || null, price, raw_stock: initialStock, low_stock_alert: alertThreshold })`
4. On success: close modal, re-fetch and re-render all cards.
5. On error: re-enable button, show error message.

---

## Error States

- **Load failure:** replace card grid with a centred message ("Failed to load stock. Please try again.") in the same muted style as the Objects page.
- **+/− update failure:** inline error text on the affected card, auto-clears on next successful update.
- **Add modal submit failure:** inline error inside the modal above the submit button.

---

## What is NOT in scope

- Editing an existing object type's name, category, price, or alert threshold (future feature)
- Deleting object types
- Category grouping / collapsible sections
- Filters or search on the stock page

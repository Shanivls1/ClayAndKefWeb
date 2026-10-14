# Clay & Kef — UI Redesign: Sidebar + Customers Page

**Date:** 2026-05-11
**Scope:** Sidebar nav (`index.html`) + Customers page (`pages/customers.js`)

---

## Decisions

| Area | Decision |
|---|---|
| Sidebar width | 72px (was 56px) |
| Sidebar nav items | Icon centered, short label below — always visible, no tooltip |
| Active indicator | 2px terracotta left-edge bar + icon/label in `#c4956a` + subtle bg highlight |
| Customers layout | Avatar row list (replaces columnar table) |
| Avatar | 32px circle, initials, warm tonal background derived from name |
| Row info | Name bold top, phone + object count muted below; Returning pill or last-visit date on right |
| Background | SVG grain texture on body + faint terracotta radial glow top-right |
| Card shadows | Two-layer: `0 2px 6px rgba(45,31,20,0.08), 0 8px 24px rgba(45,31,20,0.05)` |
| Search bar | Full pill border-radius, cleaner terracotta focus ring |
| Modal | Same structure, inputs get consistent `border-radius:10px` |

---

## Sidebar spec (`index.html`)

### Dimensions

- Width: `72px` (was 56px)
- `margin-left` on `#content`: `72px`

### Logo

- Unchanged: 36px square, `#c4956a` bg, fire icon, `border-radius:10px`
- `margin-bottom: 24px`

### Nav items

```
┌─────────────┐
│    [icon]   │  ← 20px icon, centered
│    Label    │  ← 9px, font-weight 500, letter-spacing 0.01em
└─────────────┘
```

- Container: `width: 64px`, `height: 52px`, `border-radius: 10px`, `margin: 0 auto`
- Inactive: icon stroke `rgba(255,255,255,0.32)`, label `rgba(255,255,255,0.32)`
- Hover: icon + label `#c4956a`, bg `rgba(196,149,106,0.12)`
- Active: icon + label `#c4956a`, bg `rgba(196,149,106,0.18)`, plus a `2px` left-edge indicator bar (`position:absolute; left:0; top:50%; transform:translateY(-50%); height:24px; width:2px; background:#c4956a; border-radius:0 2px 2px 0`)
- Remove tooltips (labels make them redundant)
- Transition: `color 0.15s ease, background 0.15s ease`

### Labels

| Route | Icon | Label |
|---|---|---|
| /dashboard | grid rect icon | Dash |
| /objects | layers icon | Objects |
| /stock | archive icon | Stock |
| /customers | people icon | Customers |

---

## Customers page spec (`pages/customers.js`)

### Background treatment

Add to the `<style>` block inside `render()`:

```css
.ck-page-bg {
  position: relative;
}
.ck-page-bg::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background:
    radial-gradient(ellipse 500px 380px at top right, rgba(196,149,106,0.09), transparent);
}
.ck-grain {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  opacity: 0.04;
}
```

Add an inline SVG with `feTurbulence` fractalNoise filter (baseFrequency 0.75, 4 octaves) as a fixed overlay inside the render HTML — append it as a sibling to the page `<div>`. All page content must have `position: relative; z-index: 1` so it sits above the grain layer.

### Page header

```
Customers                              [+ Add Customer]
All registered customers and their visit history.
```

- Title: Playfair Display, 32px, `#1a120b`, `letter-spacing: -0.03em`
- Subtitle: Inter, 15px, `#8a7560`, `line-height: 1.7`
- Button: unchanged (`#c4956a`, white text, `border-radius: 8px`, hover darkens)

### Search bar

- `border-radius: 99px` (full pill)
- `padding: 10px 16px 10px 42px`
- Focus: `border-color: #c4956a`, `box-shadow: 0 0 0 3px rgba(196,149,106,0.15)`
- Search icon stays on the left

### Avatar row list

Replace `<table>` with a `<div>` list inside the same white card container.

**Card container:**
```css
background: #fff;
border-radius: 14px;
border: 1px solid #e8e1d8;
overflow: hidden;
box-shadow: 0 2px 6px rgba(45,31,20,0.08), 0 8px 24px rgba(45,31,20,0.05);
```

**Each row:**
```
┌──────────────────────────────────────────────────────────┐
│  [DC]  Dana Cohen              [Returning] or [12 Apr]   │
│        +972-50-123 · 4 objects                           │
└──────────────────────────────────────────────────────────┘
```

- Row padding: `16px 20px`
- Border between rows: `1px solid #f5f0eb`
- Hover: `background: #faf7f4`, `transition: background 0.1s ease`
- Last row: no bottom border

**Avatar circle:**
- Size: `36px`, `border-radius: 50%`
- Background: derived from name using `name.charCodeAt(0) % 5` to index into `['#e8d5c0','#dcc9b4','#d4bfaa','#c8b49e','#bda892']`
- Text: initials = first char of first word + first char of last word (split on space), uppercased. If single word, use first two chars. `font-size: 13px`, `font-weight: 600`, `color: #7a5530`

**Row content (right of avatar):**
- Name: `font-size: 15px`, `font-weight: 600`, `color: #1a120b`
- Subline: `font-size: 13px`, `color: #8a7560`, `margin-top: 2px` — format: `{phone} · {n} object{s}`

**Right-side element:**
- If returning: `<span>` pill — `background: rgba(196,149,106,0.15)`, `color: #c4956a`, `border-radius: 999px`, `font-size: 12px`, `font-weight: 500`, `padding: 3px 10px`, text "Returning"
- Else: last visit date — `font-size: 13px`, `color: #b0a090`

### Empty states

- No customers found: centered muted text with a small ceramic icon glyph (unicode 🏺 or SVG), 14px, `#8a7560`
- Loading skeleton: 4 rows, avatar circle + two line bars shimmer

### Add Customer modal

Unchanged structure. Updates:
- Input `border-radius: 10px` (was 8px)
- Textarea `border-radius: 10px`
- Submit button: add `letter-spacing: 0.01em`
- Backdrop: unchanged

---

## Files changed

| File | Change |
|---|---|
| `index.html` | Sidebar: width → 72px, nav items → icon+label, remove tooltips, add active bar |
| `pages/customers.js` | Replace table with avatar row list, pill search, grain bg, deeper shadows |

---

## Out of scope

- Other pages (dashboard, objects, stock) — unchanged
- New data columns or business logic
- Pagination or sorting

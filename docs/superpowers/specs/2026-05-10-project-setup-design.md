# Clay & Kef Dashboard — Project Setup Design

**Date:** 2026-05-10  
**Scope:** Initial project scaffold — file structure, routing, Supabase client, sidebar nav, placeholder pages

---

## Decisions

| Question | Decision |
|---|---|
| Tech stack | Pure CDN, no build step. Single `index.html` shell, Tailwind via CDN, Supabase via CDN ESM |
| Routing | Hash-based (`#/dashboard`, `#/objects`, etc.) — back/forward works, pages are bookmarkable |
| Nav layout | Slim icon rail (56px), dark sidebar, icons only, tooltip on hover |
| Config | Gitignored `env.js` sets `window.ENV`; committed `env.example.js` shows shape |

---

## File Structure

```
ClayAndKefWeb/
├── index.html          # App shell: sidebar + <div id="content"> router outlet
├── app.js              # Entry point — imports router, wires nav active state
├── router.js           # Hash router (~40 lines vanilla JS)
├── supabase.js         # Supabase client singleton (reads window.ENV)
├── env.js              # GITIGNORED — real Supabase credentials
├── env.example.js      # Committed — shows window.ENV shape, no real values
├── .gitignore          # Ignores env.js
├── pages/
│   ├── dashboard.js    # export function render() → HTML string
│   ├── objects.js
│   ├── stock.js
│   └── customers.js
├── serve.mjs           # Static file server on port 3000 — must be created
└── screenshot.mjs      # Puppeteer screenshot helper — must be created
```

---

## Architecture

### `index.html`
- Loads Google Fonts (Playfair Display, Inter)
- Loads Tailwind CSS via CDN
- Loads `env.js` as a plain `<script>` (before any modules)
- Loads `app.js` as `<script type="module">`
- Contains the sidebar markup (static — icons never change)
- Contains `<div id="content">` — router swaps content here

### `router.js`
- Exports a `Router` class (or plain object)
- `routes` map: hash path → page module import function
- On `hashchange` + `DOMContentLoaded`: reads `location.hash`, resolves page, calls `render()`, writes to `#content`
- Defaults to `#/dashboard` for empty or unknown hashes
- Exposes a `navigate(path)` helper for programmatic navigation

### `supabase.js`
- Imports `createClient` from the Supabase CDN ESM URL
- Reads `window.ENV.SUPABASE_URL` and `window.ENV.SUPABASE_ANON_KEY`
- Exports a single `supabase` client instance
- All pages import from this module — one shared connection

### `env.js` (gitignored)
```js
window.ENV = {
  SUPABASE_URL: 'https://your-project.supabase.co',
  SUPABASE_ANON_KEY: 'your-anon-key-here'
};
```

### `env.example.js` (committed)
```js
window.ENV = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: ''
};
```

### Page modules (`pages/*.js`)
Each exports a single `render()` function that returns an HTML string. At setup stage, each page returns a placeholder layout with the page title and a "coming soon" message. Real content is added in future sessions.

### Sidebar
- Fixed left rail, 56px wide, `#2d1f14` background
- Logo placeholder at top
- 4 icon buttons: Dashboard, Objects, Stock, Customers
- Icons via `https://unpkg.com/lucide@latest` (CDN)
- Active icon: terracotta `#c4956a` tint background + colored icon
- Inactive: white at 35% opacity
- Tooltip: page name appears to the right of the icon via a CSS absolute-positioned `<span>`, shown on `hover` with a `translateX` transition

---

## Color Palette

| Token | Value | Usage |
|---|---|---|
| `espresso` | `#2d1f14` | Sidebar background |
| `terracotta` | `#c4956a` | Active nav, accents |
| `cream` | `#faf7f4` | Page background |
| `surface` | `#ffffff` | Cards, panels |
| `ink` | `#1a120b` | Primary text |
| `muted` | `#8a7560` | Secondary text, labels |

---

## Typography

- Headings: **Playfair Display** (Google Fonts, serif)
- Body / UI: **Inter** (Google Fonts, sans-serif)
- Large heading tracking: `-0.03em`
- Body line-height: `1.7`

---

## What's Out of Scope for This Session

- Real page content (tables, forms, charts) — placeholder only
- Supabase row-level security setup
- WhatsApp notification flow
- Any analytics views

# Clay & Kef Dashboard — Project Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Clay & Kef owner dashboard with a working hash router, Supabase client singleton, slim icon sidebar, and four placeholder pages — all served by a simple Node.js static server, no build step.

**Architecture:** Single `index.html` shell with a fixed 56px dark sidebar. Page content is rendered into `<div id="content">` by a vanilla JS hash router. Each page is a JS ES module exporting `render()` → HTML string. Supabase client is a singleton that reads credentials from a gitignored `env.js` that sets `window.ENV`.

**Tech Stack:** Vanilla JS ES modules (no bundler), Tailwind CSS via CDN, `@supabase/supabase-js@2` via esm.sh CDN, Node.js built-in `http` module for dev server, Puppeteer for screenshots.

---

## File Map

| File | Responsibility |
|---|---|
| `.gitignore` | Excludes `env.js`, `temporary screenshots/`, `.superpowers/` |
| `env.example.js` | Committed — shows `window.ENV` shape with empty values |
| `env.js` | Gitignored — sets `window.ENV` with real Supabase credentials |
| `serve.mjs` | Static file server on port 3000 |
| `router.js` | Hash router — maps `#/path` to page modules, updates active nav state |
| `supabase.js` | `createClient` singleton, reads from `window.ENV` |
| `pages/dashboard.js` | `render()` → Dashboard placeholder HTML string |
| `pages/objects.js` | `render()` → Objects placeholder HTML string |
| `pages/stock.js` | `render()` → Stock placeholder HTML string |
| `pages/customers.js` | `render()` → Customers placeholder HTML string |
| `index.html` | App shell: Google Fonts, Tailwind CDN, fixed sidebar, `#content` outlet |
| `app.js` | Entry point — imports all pages, registers routes, calls `router.init()` |
| `screenshot.mjs` | Puppeteer screenshot helper — saves to `temporary screenshots/` |

---

### Task 1: Git init + project scaffolding

**Files:**
- Create: `.gitignore`
- Create: `env.example.js`
- Create: `env.js`
- Create: `serve.mjs`

- [ ] **Step 1: Initialize git**

```bash
git init
```

Expected output: `Initialized empty Git repository in .../.git/`

- [ ] **Step 2: Create `.gitignore`**

```
env.js
temporary screenshots/
.superpowers/
```

- [ ] **Step 3: Create `env.example.js`**

```js
// Copy this file to env.js and fill in your Supabase credentials.
window.ENV = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: ''
};
```

- [ ] **Step 4: Create `env.js`**

```js
window.ENV = {
  SUPABASE_URL: 'https://your-project.supabase.co',
  SUPABASE_ANON_KEY: 'your-anon-key-here'
};
```

- [ ] **Step 5: Create `serve.mjs`**

```js
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 3000;
const ROOT = fileURLToPath(new URL('.', import.meta.url));
const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = join(ROOT, pathname);
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] ?? 'text/plain' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(PORT, () => console.log(`Clay & Kef → http://localhost:${PORT}`));
```

- [ ] **Step 6: Verify the server starts**

```bash
node serve.mjs
```

Expected: `Clay & Kef → http://localhost:3000`

Press Ctrl+C to stop.

- [ ] **Step 7: Commit**

```bash
git add .gitignore env.example.js serve.mjs
git commit -m "feat: project scaffolding — gitignore, env template, static dev server"
```

---

### Task 2: Hash router

**Files:**
- Create: `router.js`

- [ ] **Step 1: Create `router.js`**

```js
const routes = new Map();

export function register(path, page) {
  routes.set(path, page);
}

export function navigate(path) {
  location.hash = path;
}

function resolve() {
  const hash = location.hash.slice(1) || '/dashboard';
  const page = routes.get(hash) ?? routes.get('/dashboard');
  if (!page) return;
  document.getElementById('content').innerHTML = page.render();
  document.querySelectorAll('[data-route]').forEach(el => {
    el.classList.toggle('active', el.dataset.route === hash);
  });
}

export function init() {
  window.addEventListener('hashchange', resolve);
  resolve(); // modules are deferred — DOM is ready when this runs
}
```

- [ ] **Step 2: Commit**

```bash
git add router.js
git commit -m "feat: hash router — maps #/path to page modules, syncs active nav state"
```

---

### Task 3: Supabase client singleton

**Files:**
- Create: `supabase.js`

- [ ] **Step 1: Create `supabase.js`**

```js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.ENV;
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

- [ ] **Step 2: Commit**

```bash
git add supabase.js
git commit -m "feat: Supabase client singleton — reads credentials from window.ENV"
```

---

### Task 4: Placeholder page modules

**Files:**
- Create: `pages/dashboard.js`
- Create: `pages/objects.js`
- Create: `pages/stock.js`
- Create: `pages/customers.js`

- [ ] **Step 1: Create `pages/dashboard.js`**

```js
export function render() {
  return `
    <div style="padding: 40px;">
      <h1 style="font-family: 'Playfair Display', serif; font-size: 32px; font-weight: 700; letter-spacing: -0.03em; color: #1a120b; margin-bottom: 8px;">Dashboard</h1>
      <p style="font-family: 'Inter', sans-serif; color: #8a7560; font-size: 15px; line-height: 1.7;">Analytics overview — coming soon.</p>
    </div>
  `;
}
```

- [ ] **Step 2: Create `pages/objects.js`**

```js
export function render() {
  return `
    <div style="padding: 40px;">
      <h1 style="font-family: 'Playfair Display', serif; font-size: 32px; font-weight: 700; letter-spacing: -0.03em; color: #1a120b; margin-bottom: 8px;">Objects</h1>
      <p style="font-family: 'Inter', sans-serif; color: #8a7560; font-size: 15px; line-height: 1.7;">Track customer objects through their lifecycle — coming soon.</p>
    </div>
  `;
}
```

- [ ] **Step 3: Create `pages/stock.js`**

```js
export function render() {
  return `
    <div style="padding: 40px;">
      <h1 style="font-family: 'Playfair Display', serif; font-size: 32px; font-weight: 700; letter-spacing: -0.03em; color: #1a120b; margin-bottom: 8px;">Stock</h1>
      <p style="font-family: 'Inter', sans-serif; color: #8a7560; font-size: 15px; line-height: 1.7;">Manage raw unpainted blanks per object type — coming soon.</p>
    </div>
  `;
}
```

- [ ] **Step 4: Create `pages/customers.js`**

```js
export function render() {
  return `
    <div style="padding: 40px;">
      <h1 style="font-family: 'Playfair Display', serif; font-size: 32px; font-weight: 700; letter-spacing: -0.03em; color: #1a120b; margin-bottom: 8px;">Customers</h1>
      <p style="font-family: 'Inter', sans-serif; color: #8a7560; font-size: 15px; line-height: 1.7;">View and manage customer records — coming soon.</p>
    </div>
  `;
}
```

- [ ] **Step 5: Commit**

```bash
git add pages/
git commit -m "feat: placeholder page modules — Dashboard, Objects, Stock, Customers"
```

---

### Task 5: App shell (index.html)

**Files:**
- Create: `index.html`

- [ ] **Step 1: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Clay & Kef</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Playfair+Display:wght@700&display=swap" rel="stylesheet" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="env.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      display: flex;
      min-height: 100vh;
      background: #faf7f4;
      font-family: 'Inter', sans-serif;
    }

    /* ── Sidebar ── */
    #sidebar {
      width: 56px;
      min-height: 100vh;
      background: #2d1f14;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px 0 20px;
      flex-shrink: 0;
      position: fixed;
      top: 0;
      left: 0;
      z-index: 50;
    }

    #logo {
      width: 36px;
      height: 36px;
      background: #c4956a;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 28px;
      flex-shrink: 0;
      text-decoration: none;
    }

    #logo svg {
      width: 20px;
      height: 20px;
      stroke: #2d1f14;
      fill: none;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    nav {
      display: flex;
      flex-direction: column;
      gap: 4px;
      width: 100%;
      padding: 0 8px;
    }

    .nav-item {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 10px;
      margin: 0 auto;
      text-decoration: none;
      color: rgba(255, 255, 255, 0.35);
      transition: background 0.15s ease, color 0.15s ease;
    }

    .nav-item svg {
      width: 20px;
      height: 20px;
      stroke: currentColor;
      fill: none;
      stroke-width: 1.75;
      stroke-linecap: round;
      stroke-linejoin: round;
      flex-shrink: 0;
    }

    .nav-item:hover {
      background: rgba(196, 149, 106, 0.15);
      color: #c4956a;
    }

    .nav-item.active {
      background: rgba(196, 149, 106, 0.2);
      color: #c4956a;
    }

    /* Tooltip — slides in from left */
    .nav-tooltip {
      position: absolute;
      left: calc(100% + 10px);
      top: 50%;
      transform: translateY(-50%) translateX(-6px);
      background: #1a120b;
      color: #faf7f4;
      font-size: 12px;
      font-weight: 500;
      font-family: 'Inter', sans-serif;
      padding: 5px 10px;
      border-radius: 6px;
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s ease, transform 0.15s ease;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
    }

    .nav-item:hover .nav-tooltip {
      opacity: 1;
      transform: translateY(-50%) translateX(0);
    }

    /* ── Main content ── */
    #content {
      flex: 1;
      margin-left: 56px;
      min-height: 100vh;
      overflow-y: auto;
    }
  </style>
</head>
<body>

  <aside id="sidebar">

    <!-- Logo -->
    <a href="#/dashboard" id="logo" title="Clay & Kef">
      <svg viewBox="0 0 24 24">
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
      </svg>
    </a>

    <nav>

      <!-- Dashboard -->
      <a href="#/dashboard" data-route="/dashboard" class="nav-item">
        <svg viewBox="0 0 24 24">
          <rect width="7" height="9" x="3" y="3" rx="1"/>
          <rect width="7" height="5" x="14" y="3" rx="1"/>
          <rect width="7" height="9" x="14" y="12" rx="1"/>
          <rect width="7" height="5" x="3" y="16" rx="1"/>
        </svg>
        <span class="nav-tooltip">Dashboard</span>
      </a>

      <!-- Objects -->
      <a href="#/objects" data-route="/objects" class="nav-item">
        <svg viewBox="0 0 24 24">
          <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/>
          <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/>
          <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>
        </svg>
        <span class="nav-tooltip">Objects</span>
      </a>

      <!-- Stock -->
      <a href="#/stock" data-route="/stock" class="nav-item">
        <svg viewBox="0 0 24 24">
          <rect width="20" height="5" x="2" y="3" rx="1"/>
          <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/>
          <path d="M10 12h4"/>
        </svg>
        <span class="nav-tooltip">Stock</span>
      </a>

      <!-- Customers -->
      <a href="#/customers" data-route="/customers" class="nav-item">
        <svg viewBox="0 0 24 24">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <span class="nav-tooltip">Customers</span>
      </a>

    </nav>
  </aside>

  <main id="content"></main>

  <script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: app shell — fixed sidebar icon rail with SVG icons and tooltip, router outlet"
```

---

### Task 6: App entry point

**Files:**
- Create: `app.js`

- [ ] **Step 1: Create `app.js`**

```js
import { register, init } from './router.js';
import * as dashboard from './pages/dashboard.js';
import * as objects   from './pages/objects.js';
import * as stock     from './pages/stock.js';
import * as customers from './pages/customers.js';

register('/dashboard', dashboard);
register('/objects',   objects);
register('/stock',     stock);
register('/customers', customers);

init();
```

- [ ] **Step 2: Commit**

```bash
git add app.js
git commit -m "feat: app entry point — registers all page routes and starts router"
```

---

### Task 7: Screenshot helper

**Files:**
- Create: `screenshot.mjs`

- [ ] **Step 1: Create `screenshot.mjs`**

```js
import { createRequire } from 'node:module';
import { readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = fileURLToPath(new URL('.', import.meta.url));
const SCREENSHOTS_DIR = join(ROOT, 'temporary screenshots');

// Try known Puppeteer install paths — update if neither matches your machine
const PUPPETEER_PATHS = [
  'C:/Users/nateh/AppData/Local/Temp/puppeteer-test/node_modules/puppeteer',
  'C:/Users/shani/AppData/Local/Temp/puppeteer-test/node_modules/puppeteer',
];

let puppeteer;
for (const p of PUPPETEER_PATHS) {
  try { puppeteer = require(p); break; } catch {}
}
if (!puppeteer) {
  throw new Error('Puppeteer not found. Update PUPPETEER_PATHS in screenshot.mjs.');
}

const [,, url = 'http://localhost:3000', label] = process.argv;

if (!existsSync(SCREENSHOTS_DIR)) await mkdir(SCREENSHOTS_DIR, { recursive: true });

const existing = (await readdir(SCREENSHOTS_DIR)).filter(f => f.endsWith('.png'));
const next = existing.length + 1;
const filename = label ? `screenshot-${next}-${label}.png` : `screenshot-${next}.png`;
const outPath = join(SCREENSHOTS_DIR, filename);

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
await page.goto(url, { waitUntil: 'networkidle0' });
await page.screenshot({ path: outPath });
await browser.close();

console.log(`Screenshot saved: temporary screenshots/${filename}`);
```

- [ ] **Step 2: Commit**

```bash
git add screenshot.mjs
git commit -m "feat: screenshot helper — Puppeteer, auto-incremented PNG to 'temporary screenshots/'"
```

---

### Task 8: End-to-end verification

- [ ] **Step 1: Start the dev server**

```bash
node serve.mjs
```

Expected: `Clay & Kef → http://localhost:3000`

- [ ] **Step 2: Open http://localhost:3000 in a browser and verify the shell**

Expected:
- Dark sidebar (56px, `#2d1f14`) fixed on the left
- Flame logo in terracotta (`#c4956a`) at top of sidebar
- Four icon buttons below the logo
- Content area to the right shows "Dashboard" heading
- URL auto-updates to `http://localhost:3000/#/dashboard`
- Dashboard icon is highlighted in terracotta

- [ ] **Step 3: Click each nav icon and verify routing**

| Click | Expected URL hash | Expected heading |
|---|---|---|
| Objects icon | `#/objects` | Objects |
| Stock icon | `#/stock` | Stock |
| Customers icon | `#/customers` | Customers |
| Dashboard icon | `#/dashboard` | Dashboard |

Also verify: hovering any icon shows the tooltip label sliding in from the right.

- [ ] **Step 4: Verify browser back/forward**

Navigate to Objects (`#/objects`), then Stock (`#/stock`), then press browser Back.
Expected: returns to Objects page with Objects icon highlighted.

- [ ] **Step 5: Take a screenshot (server must still be running)**

In a second terminal:

```bash
node screenshot.mjs http://localhost:3000 setup
```

Expected console output: `Screenshot saved: temporary screenshots/screenshot-1-setup.png`

Read `temporary screenshots/screenshot-1-setup.png` with the Read tool and verify:
- Sidebar is visible on the left with the flame logo
- Dashboard page content ("Dashboard" heading) is visible on the right
- Dashboard icon appears highlighted

# UI Redesign: Sidebar + Customers Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the sidebar from a 56px icon-only rail to a 72px icon+label rail, and replace the customers page table with warmer avatar rows, grain background, and pill search.

**Architecture:** Pure HTML/CSS/JS edits across two files — `index.html` (sidebar) and `pages/customers.js` (customers page). No new files, no data model changes. Verification is visual: start `node serve.mjs`, take a screenshot with `node screenshot.mjs http://localhost:3000`, read the PNG.

**Tech Stack:** Vanilla JS, inline CSS, Google Fonts (Inter + Playfair Display), Supabase JS client

---

## File map

| File | Change |
|---|---|
| `index.html` | Sidebar width 56→72px, nav items icon+label stacked, remove tooltips, add active bar |
| `pages/customers.js` | Replace `<table>` with avatar row list, grain SVG + radial bg, pill search, deeper shadows, modal input radius |

---

### Task 1: Sidebar — update styles

**Files:**
- Modify: `index.html` (the `<style>` block inside `<head>`)

- [ ] **Step 1: Update `#sidebar` width and `#content` margin**

In `index.html`, find and replace these two CSS rules:

```css
/* BEFORE */
#sidebar {
  width: 56px;
  ...
}
#content {
  ...
  margin-left: 56px;
  ...
}

/* AFTER */
#sidebar {
  width: 72px;
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

#content {
  flex: 1;
  margin-left: 72px;
  min-height: 100vh;
  overflow-y: auto;
}
```

- [ ] **Step 2: Replace `.nav-item` and related styles**

Remove the old `.nav-item`, `.nav-item svg`, `.nav-item:hover`, `.nav-item.active`, `.nav-tooltip` rules entirely. Replace with:

```css
nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: 0 4px;
}

.nav-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 52px;
  border-radius: 10px;
  margin: 0 auto;
  text-decoration: none;
  color: rgba(255, 255, 255, 0.32);
  transition: background 0.15s ease, color 0.15s ease;
  gap: 4px;
}

.nav-item svg {
  width: 18px;
  height: 18px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
  flex-shrink: 0;
}

.nav-label {
  font-size: 9px;
  font-weight: 500;
  font-family: 'Inter', sans-serif;
  letter-spacing: 0.01em;
  line-height: 1;
}

.nav-item:hover {
  background: rgba(196, 149, 106, 0.12);
  color: #c4956a;
}

.nav-item.active {
  background: rgba(196, 149, 106, 0.18);
  color: #c4956a;
}

.nav-active-bar {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 2px;
  height: 24px;
  background: #c4956a;
  border-radius: 0 2px 2px 0;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.nav-item.active .nav-active-bar {
  opacity: 1;
}
```

- [ ] **Step 3: Commit styles**

```bash
git add index.html
git commit -m "style: expand sidebar to 72px with icon+label nav items"
```

---

### Task 2: Sidebar — update HTML

**Files:**
- Modify: `index.html` (the `<nav>` block inside `<aside>`)

- [ ] **Step 1: Replace the entire `<nav>` block**

Replace the existing `<nav>...</nav>` with:

```html
<nav>

  <!-- Dashboard -->
  <a href="#/dashboard" data-route="/dashboard" class="nav-item">
    <div class="nav-active-bar"></div>
    <svg viewBox="0 0 24 24">
      <rect width="7" height="9" x="3" y="3" rx="1"/>
      <rect width="7" height="5" x="14" y="3" rx="1"/>
      <rect width="7" height="9" x="14" y="12" rx="1"/>
      <rect width="7" height="5" x="3" y="16" rx="1"/>
    </svg>
    <span class="nav-label">Dash</span>
  </a>

  <!-- Objects -->
  <a href="#/objects" data-route="/objects" class="nav-item">
    <div class="nav-active-bar"></div>
    <svg viewBox="0 0 24 24">
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/>
      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/>
      <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>
    </svg>
    <span class="nav-label">Objects</span>
  </a>

  <!-- Stock -->
  <a href="#/stock" data-route="/stock" class="nav-item">
    <div class="nav-active-bar"></div>
    <svg viewBox="0 0 24 24">
      <rect width="20" height="5" x="2" y="3" rx="1"/>
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/>
      <path d="M10 12h4"/>
    </svg>
    <span class="nav-label">Stock</span>
  </a>

  <!-- Customers -->
  <a href="#/customers" data-route="/customers" class="nav-item">
    <div class="nav-active-bar"></div>
    <svg viewBox="0 0 24 24">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
    <span class="nav-label">Customers</span>
  </a>

</nav>
```

- [ ] **Step 2: Start dev server (if not already running)**

```bash
node serve.mjs
```

Server runs at http://localhost:3000.

- [ ] **Step 3: Screenshot and verify sidebar**

```bash
node screenshot.mjs http://localhost:3000 sidebar
```

Read `temporary screenshots/screenshot-N-sidebar.png`. Check:
- Sidebar is wider (~72px)
- Each nav item shows icon above a short label
- Active item has terracotta color + left-edge bar
- No tooltips on hover (labels are always visible)

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "style: add icon+label nav items and active indicator bar to sidebar"
```

---

### Task 3: Customers page — avatar row list

**Files:**
- Modify: `pages/customers.js`

- [ ] **Step 1: Add `AVATAR_COLORS` constant and `getInitials` helper at module level**

Add these two declarations immediately after the `import` line at the top of `pages/customers.js`:

```js
const AVATAR_COLORS = ['#e8d5c0', '#dcc9b4', '#d4bfaa', '#c8b49e', '#bda892'];

function getInitials(name) {
  const parts = String(name ?? '').trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
```

- [ ] **Step 2: Replace `render()` — return new HTML**

Replace the entire `render()` function with:

```js
export function render() {
  return `
    <style>
      @keyframes ck-shimmer {
        0%   { opacity: 1; }
        50%  { opacity: 0.45; }
        100% { opacity: 1; }
      }
      .ck-skel {
        display: inline-block;
        background: #e8e1d8;
        border-radius: 4px;
        animation: ck-shimmer 1.4s ease-in-out infinite;
      }
      #add-customer-form input,
      #add-customer-form textarea {
        box-sizing: border-box;
      }
    </style>

    <!-- Grain texture overlay -->
    <svg style="position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;opacity:0.04;" xmlns="http://www.w3.org/2000/svg">
      <filter id="ck-noise">
        <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch"/>
        <feColorMatrix type="saturate" values="0"/>
      </filter>
      <rect width="100%" height="100%" filter="url(#ck-noise)"/>
    </svg>
    <!-- Radial glow top-right -->
    <div style="position:fixed;top:0;right:0;width:600px;height:400px;background:radial-gradient(ellipse at top right,rgba(196,149,106,0.08),transparent);pointer-events:none;z-index:0;"></div>

    <div style="padding:40px;max-width:980px;position:relative;z-index:1;">

      <!-- Header -->
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:28px;">
        <div>
          <h1 style="font-family:'Playfair Display',serif;font-size:32px;font-weight:700;letter-spacing:-0.03em;color:#1a120b;margin-bottom:4px;">Customers</h1>
          <p style="font-family:'Inter',sans-serif;color:#8a7560;font-size:15px;line-height:1.7;">All registered customers and their visit history.</p>
        </div>
        <button id="btn-add-customer" style="
          flex-shrink:0;margin-top:4px;
          background:#c4956a;color:#fff;border:none;cursor:pointer;
          font-family:'Inter',sans-serif;font-size:14px;font-weight:500;
          padding:10px 18px;border-radius:8px;letter-spacing:0.01em;
          box-shadow:0 2px 8px rgba(196,149,106,0.3);
          transition:background 0.15s ease,box-shadow 0.15s ease;
        "
          onmouseover="this.style.background='#b3845a';this.style.boxShadow='0 2px 12px rgba(196,149,106,0.4)'"
          onmouseout="this.style.background='#c4956a';this.style.boxShadow='0 2px 8px rgba(196,149,106,0.3)'"
        >+ Add Customer</button>
      </div>

      <!-- Search -->
      <div style="margin-bottom:20px;position:relative;">
        <input id="customer-search" type="text" placeholder="Search by name or phone…" style="
          width:100%;padding:10px 16px 10px 42px;
          font-family:'Inter',sans-serif;font-size:14px;color:#1a120b;
          background:#fff;border:1px solid #e0d8cf;border-radius:99px;
          outline:none;box-shadow:0 1px 3px rgba(0,0,0,0.04);
          transition:border-color 0.15s ease,box-shadow 0.15s ease;
        "
          onfocus="this.style.borderColor='#c4956a';this.style.boxShadow='0 0 0 3px rgba(196,149,106,0.15)'"
          onblur="this.style.borderColor='#e0d8cf';this.style.boxShadow='0 1px 3px rgba(0,0,0,0.04)'"
        />
        <svg style="position:absolute;left:16px;top:50%;transform:translateY(-50%);width:16px;height:16px;stroke:#8a7560;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;pointer-events:none;" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
      </div>

      <!-- Customer list -->
      <div style="background:#fff;border-radius:14px;border:1px solid #e8e1d8;overflow:hidden;box-shadow:0 2px 6px rgba(45,31,20,0.08),0 8px 24px rgba(45,31,20,0.05);">
        <div id="customers-list">
          ${skeletonRows()}
        </div>
      </div>

    </div>

    <!-- Add Customer Modal -->
    <div id="modal-backdrop" style="
      display:none;position:fixed;inset:0;
      background:rgba(26,18,11,0.4);z-index:100;
      align-items:center;justify-content:center;
    ">
      <div style="
        background:#fff;border-radius:12px;padding:32px;
        width:100%;max-width:420px;position:relative;margin:16px;
        box-shadow:0 8px 40px rgba(45,31,20,0.18);
      ">
        <button id="modal-close" style="
          position:absolute;top:16px;right:16px;
          background:none;border:none;cursor:pointer;
          font-size:20px;color:#8a7560;line-height:1;
          width:28px;height:28px;display:flex;align-items:center;justify-content:center;
          border-radius:6px;transition:background 0.15s;
        "
          onmouseover="this.style.background='#f0ebe4'"
          onmouseout="this.style.background='none'"
        >×</button>

        <h2 style="font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:#1a120b;margin-bottom:24px;">Add Customer</h2>

        <form id="add-customer-form" autocomplete="off">
          <div style="margin-bottom:16px;">
            <label style="display:block;font-size:13px;font-weight:500;color:#5a4a3a;margin-bottom:6px;">
              Name <span style="color:#c4956a">*</span>
            </label>
            <input name="name" type="text" required placeholder="e.g. Dana Cohen" style="
              width:100%;padding:10px 14px;font-family:'Inter',sans-serif;font-size:14px;
              border:1px solid #e0d8cf;border-radius:10px;outline:none;color:#1a120b;
              transition:border-color 0.15s;
            "
              onfocus="this.style.borderColor='#c4956a'"
              onblur="this.style.borderColor='#e0d8cf'"
            />
          </div>

          <div style="margin-bottom:16px;">
            <label style="display:block;font-size:13px;font-weight:500;color:#5a4a3a;margin-bottom:6px;">
              Phone <span style="color:#c4956a">*</span>
              <span style="font-weight:400;color:#8a7560">(include country code)</span>
            </label>
            <input name="phone" type="tel" required placeholder="e.g. +972-50-123-4567" style="
              width:100%;padding:10px 14px;font-family:'Inter',sans-serif;font-size:14px;
              border:1px solid #e0d8cf;border-radius:10px;outline:none;color:#1a120b;
              transition:border-color 0.15s;
            "
              onfocus="this.style.borderColor='#c4956a'"
              onblur="this.style.borderColor='#e0d8cf'"
            />
          </div>

          <div style="margin-bottom:24px;">
            <label style="display:block;font-size:13px;font-weight:500;color:#5a4a3a;margin-bottom:6px;">
              Notes <span style="font-weight:400;color:#8a7560">(optional)</span>
            </label>
            <textarea name="notes" placeholder="Any notes about this customer…" rows="3" style="
              width:100%;padding:10px 14px;font-family:'Inter',sans-serif;font-size:14px;
              border:1px solid #e0d8cf;border-radius:10px;outline:none;color:#1a120b;
              resize:vertical;transition:border-color 0.15s;
            "
              onfocus="this.style.borderColor='#c4956a'"
              onblur="this.style.borderColor='#e0d8cf'"
            ></textarea>
          </div>

          <div id="form-error" style="display:none;color:#b94040;font-size:13px;margin-bottom:12px;"></div>

          <button type="submit" id="btn-submit" style="
            width:100%;padding:12px;background:#c4956a;color:#fff;border:none;cursor:pointer;
            font-family:'Inter',sans-serif;font-size:14px;font-weight:600;letter-spacing:0.01em;
            border-radius:8px;box-shadow:0 2px 8px rgba(196,149,106,0.3);
            transition:background 0.15s ease;
          "
            onmouseover="this.style.background='#b3845a'"
            onmouseout="this.style.background='#c4956a'"
          >Add Customer</button>
        </form>
      </div>
    </div>
  `;
}
```

- [ ] **Step 3: Replace `skeletonRows()`**

Replace the old `skeletonRows()` function with:

```js
function skeletonRows() {
  return [1, 2, 3, 4].map(() => `
    <div style="display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid #f5f0eb;">
      <span class="ck-skel" style="width:36px;height:36px;border-radius:50%;flex-shrink:0;"></span>
      <div style="flex:1;">
        <span class="ck-skel" style="display:block;width:130px;height:13px;margin-bottom:6px;border-radius:3px;"></span>
        <span class="ck-skel" style="display:block;width:170px;height:11px;border-radius:3px;"></span>
      </div>
      <span class="ck-skel" style="width:72px;height:22px;border-radius:99px;"></span>
    </div>
  `).join('');
}
```

- [ ] **Step 4: Replace `buildRow()`**

Replace the old `buildRow(c)` function with:

```js
function buildRow(c, isLast) {
  const objects     = c.objects ?? [];
  const total       = objects.length;
  const isReturning = total > 1;

  const initials  = getInitials(c.name);
  const avatarBg  = AVATAR_COLORS[c.name.charCodeAt(0) % AVATAR_COLORS.length];
  const objLabel  = `${total} object${total !== 1 ? 's' : ''}`;

  let lastVisit = '';
  if (objects.length > 0) {
    const maxMs = Math.max(...objects.map(o => new Date(o.received_at).getTime()));
    lastVisit = new Date(maxMs).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  }

  const rightEl = isReturning
    ? `<span style="display:inline-block;padding:3px 10px;background:rgba(196,149,106,0.15);color:#c4956a;border-radius:999px;font-size:12px;font-weight:500;white-space:nowrap;">Returning</span>`
    : lastVisit
      ? `<span style="font-size:13px;color:#b0a090;white-space:nowrap;">${lastVisit}</span>`
      : '';

  const borderBottom = isLast ? 'none' : '1px solid #f5f0eb';

  return `
    <div style="display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:${borderBottom};background:#fff;transition:background 0.1s ease;"
         onmouseover="this.style.background='#faf7f4'"
         onmouseout="this.style.background='#fff'">
      <div style="width:36px;height:36px;border-radius:50%;background:${avatarBg};display:flex;align-items:center;justify-content:center;font-family:'Inter',sans-serif;font-size:13px;font-weight:600;color:#7a5530;flex-shrink:0;user-select:none;">${escHtml(initials)}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-family:'Inter',sans-serif;font-size:15px;font-weight:600;color:#1a120b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(c.name)}</div>
        <div style="font-family:'Inter',sans-serif;font-size:13px;color:#8a7560;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(c.phone)} · ${objLabel}</div>
      </div>
      <div style="flex-shrink:0;">${rightEl}</div>
    </div>`;
}
```

- [ ] **Step 5: Update `renderRows()` — use `#customers-list` div, pass `isLast` to `buildRow`**

Replace the old `renderRows(tbody, customers)` function with:

```js
function renderRows(list, customers) {
  if (customers.length === 0) {
    list.innerHTML = `
      <div style="padding:48px 20px;text-align:center;font-family:'Inter',sans-serif;font-size:14px;color:#8a7560;">
        No customers found.
      </div>`;
    return;
  }
  list.innerHTML = customers.map((c, i) => buildRow(c, i === customers.length - 1)).join('');
}
```

- [ ] **Step 6: Update `loadCustomers()` — query `#customers-list` instead of `#customers-tbody`**

Replace the old `loadCustomers(el)` function with:

```js
async function loadCustomers(el) {
  allCustomers = [];
  const list = el.querySelector('#customers-list');

  const { data, error } = await supabase
    .from('customers')
    .select('id, name, phone, notes, objects(id, received_at)')
    .order('name');

  if (error) {
    list.innerHTML = `
      <div style="padding:32px 20px;text-align:center;font-family:'Inter',sans-serif;font-size:14px;color:#8a7560;">
        Failed to load customers. Please try again.
      </div>`;
    return;
  }

  allCustomers = data ?? [];
  renderRows(list, allCustomers);
}
```

- [ ] **Step 7: Update `wireSearch()` — query `#customers-list` instead of `#customers-tbody`**

Replace the old `wireSearch(el)` function with:

```js
function wireSearch(el) {
  const input = el.querySelector('#customer-search');
  const list  = el.querySelector('#customers-list');
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    const filtered = q
      ? allCustomers.filter(c =>
          c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q)
        )
      : allCustomers;
    renderRows(list, filtered);
  });
}
```

- [ ] **Step 8: Screenshot and verify customers page**

Navigate to http://localhost:3000/#/customers in the browser, then:

```bash
node screenshot.mjs http://localhost:3000 customers
```

Read `temporary screenshots/screenshot-N-customers.png`. Check:
- Avatar circles with initials appear in each row
- Name bold on top, phone + object count muted below
- "Returning" pill in terracotta for multi-object customers
- Pill-shaped search bar
- Card has deeper shadows and 14px border-radius
- Subtle grain on background (faint paper texture)
- Faint warm glow in top-right corner

- [ ] **Step 9: Commit**

```bash
git add pages/customers.js
git commit -m "feat: replace customer table with avatar rows, add grain bg and pill search"
```

---

## Self-review notes

- `#customers-tbody` → `#customers-list` rename is consistent across `render()`, `loadCustomers()`, `wireSearch()`, and `skeletonRows()` ✓
- `buildRow(c, isLast)` signature matches all call sites in `renderRows()` ✓
- `AVATAR_COLORS` and `getInitials` defined at module level, used in `buildRow` ✓
- `escHtml` is unchanged and still present in the file ✓
- Modal `wireModal()` is unchanged — still references `#modal-backdrop`, `#modal-close`, `#btn-add-customer`, `#add-customer-form`, `#form-error`, `#btn-submit` — all still present in the new `render()` HTML ✓
- Grain SVG uses `id="ck-noise"` — unique within the customers page ✓
- All page content inside the main `<div>` has `position:relative; z-index:1` so it sits above the fixed grain/glow layers ✓

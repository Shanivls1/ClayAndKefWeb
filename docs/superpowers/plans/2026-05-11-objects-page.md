# Objects Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `pages/objects.js` — a fully functional object tracking page with a filterable table, per-row status advance, WhatsApp notification indicator, and Add Object modal.

**Architecture:** Single-file page module (`render` + `mount`) following the exact pattern of `pages/customers.js`. All data fetched at mount into module-level arrays, filtered client-side. No pagination, no realtime subscription.

**Tech Stack:** Vanilla JS ES modules, Supabase JS v2 (`supabase.js` singleton), inline styles, hash router (`router.js`). No test runner — browser verification after each task.

**Note on `notes` column:** The `objects` table in CLAUDE.md does not have a `notes` column. Task 1 adds it via Supabase SQL before any code is written. Skip Task 1 if the column already exists.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `pages/objects.js` | Rewrite | Full page: render shell, data fetch, filters, status advance, WhatsApp indicator, Add Object modal |

No other files need changes.

---

### Task 1: Add `notes` column to `objects` table in Supabase

**Files:**
- No code files — run SQL in Supabase dashboard

- [ ] **Step 1: Open Supabase SQL editor**

Navigate to your Supabase project → SQL Editor → New Query.

- [ ] **Step 2: Run migration**

```sql
ALTER TABLE objects ADD COLUMN IF NOT EXISTS notes text;
```

- [ ] **Step 3: Verify**

In the Supabase Table Editor, open the `objects` table and confirm `notes` column appears.

---

### Task 2: Static render shell

**Files:**
- Rewrite: `pages/objects.js`

- [ ] **Step 1: Replace the stub with the full render shell**

Replace the entire contents of `pages/objects.js` with:

```js
import { supabase } from '../supabase.js';

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_LABEL = {
  received:  'Waiting',
  ready:     'Ready',
  picked_up: 'Picked Up',
};

const STATUS_NEXT = {
  received:  'ready',
  ready:     'picked_up',
  picked_up: null,
};

const STATUS_BADGE = {
  received:  'background:rgba(196,149,106,0.12);color:#b3845a;',
  ready:     'background:rgba(80,160,80,0.12);color:#3a8a3a;',
  picked_up: 'background:#ede8e2;color:#8a7560;',
};

// ─── State ─────────────────────────────────────────────────────────────────────

let allObjects     = [];
let allObjectTypes = [];
let allCustomers   = [];

// ─── Render ────────────────────────────────────────────────────────────────────

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
      .obj-row { transition: background 0.1s ease; }
      .obj-row:hover { background: #faf7f4 !important; }
      #add-object-form select,
      #add-object-form input,
      #add-object-form textarea { box-sizing: border-box; }
    </style>

    <svg style="position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;opacity:0.04;" xmlns="http://www.w3.org/2000/svg">
      <filter id="ck-noise-objects">
        <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch"/>
        <feColorMatrix type="saturate" values="0"/>
      </filter>
      <rect width="100%" height="100%" filter="url(#ck-noise-objects)"/>
    </svg>
    <div style="position:fixed;top:0;right:0;width:600px;height:400px;background:radial-gradient(ellipse at top right,rgba(196,149,106,0.08),transparent);pointer-events:none;z-index:0;"></div>

    <div style="padding:40px;position:relative;z-index:1;">

      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;">
        <div>
          <h1 style="font-family:'Playfair Display',serif;font-size:32px;font-weight:700;letter-spacing:-0.03em;color:#1a120b;margin-bottom:4px;">Objects</h1>
          <p style="font-family:'Inter',sans-serif;color:#8a7560;font-size:15px;line-height:1.7;">Track customer objects through their full lifecycle.</p>
        </div>
        <button id="btn-add-object" style="
          flex-shrink:0;margin-top:4px;
          background:#c4956a;color:#fff;border:none;cursor:pointer;
          font-family:'Inter',sans-serif;font-size:14px;font-weight:500;
          padding:10px 18px;border-radius:8px;letter-spacing:0.01em;
          box-shadow:0 2px 8px rgba(196,149,106,0.3);
          transition:background 0.15s ease,box-shadow 0.15s ease;
        "
          onmouseover="this.style.background='#b3845a';this.style.boxShadow='0 2px 12px rgba(196,149,106,0.4)'"
          onmouseout="this.style.background='#c4956a';this.style.boxShadow='0 2px 8px rgba(196,149,106,0.3)'"
        >+ Add Object</button>
      </div>

      <div style="display:flex;gap:10px;margin-bottom:16px;align-items:center;">
        <div style="flex:1;position:relative;">
          <input id="obj-search" type="text" placeholder="Search by customer or object type…" style="
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
        <select id="obj-filter-status" style="
          padding:10px 14px;border:1px solid #e0d8cf;border-radius:8px;
          font-family:'Inter',sans-serif;font-size:14px;color:#5a4a3a;
          background:#fff;cursor:pointer;outline:none;transition:border-color 0.15s;
        "
          onfocus="this.style.borderColor='#c4956a'"
          onblur="this.style.borderColor='#e0d8cf'"
        >
          <option value="">All statuses</option>
          <option value="received">Waiting</option>
          <option value="ready">Ready</option>
          <option value="picked_up">Picked Up</option>
        </select>
        <select id="obj-filter-type" style="
          padding:10px 14px;border:1px solid #e0d8cf;border-radius:8px;
          font-family:'Inter',sans-serif;font-size:14px;color:#5a4a3a;
          background:#fff;cursor:pointer;outline:none;transition:border-color 0.15s;
        "
          onfocus="this.style.borderColor='#c4956a'"
          onblur="this.style.borderColor='#e0d8cf'"
        >
          <option value="">All types</option>
        </select>
      </div>

      <div style="background:#fff;border-radius:14px;border:1px solid #e8e1d8;overflow:hidden;box-shadow:0 2px 6px rgba(45,31,20,0.08),0 8px 24px rgba(45,31,20,0.05);">
        <div style="display:grid;grid-template-columns:2fr 1.5fr 140px 1fr 150px;padding:10px 20px;background:#f5f0eb;border-bottom:1px solid #e8e1d8;">
          ${['Customer','Object Type','Status','Date In','Advance'].map(h => `
            <div style="font-family:'Inter',sans-serif;font-size:11px;font-weight:600;color:#8a7560;text-transform:uppercase;letter-spacing:0.06em;">${h}</div>
          `).join('')}
        </div>
        <div id="objects-body">${skeletonRows()}</div>
      </div>

      <div style="display:flex;gap:16px;margin-top:12px;align-items:center;">
        <span style="font-family:'Inter',sans-serif;font-size:11px;color:#b0a090;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;">Legend:</span>
        <span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:500;background:rgba(196,149,106,0.12);color:#b3845a;">Waiting</span>
        <span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:500;background:rgba(80,160,80,0.12);color:#3a8a3a;">Ready</span>
        <span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:500;background:#ede8e2;color:#8a7560;">Picked Up</span>
      </div>

    </div>

    <div id="obj-modal-backdrop" style="
      display:none;position:fixed;inset:0;
      background:rgba(26,18,11,0.4);z-index:100;
      align-items:center;justify-content:center;
    ">
      <div style="
        background:#fff;border-radius:12px;padding:32px;
        width:100%;max-width:440px;position:relative;margin:16px;
        box-shadow:0 8px 40px rgba(45,31,20,0.18);
      ">
        <button id="obj-modal-close" style="
          position:absolute;top:16px;right:16px;
          background:none;border:none;cursor:pointer;
          font-size:20px;color:#8a7560;line-height:1;
          width:28px;height:28px;display:flex;align-items:center;justify-content:center;
          border-radius:6px;transition:background 0.15s;
        "
          onmouseover="this.style.background='#f0ebe4'"
          onmouseout="this.style.background='none'"
        >×</button>

        <h2 style="font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:#1a120b;margin-bottom:24px;">Add Object</h2>

        <form id="add-object-form" autocomplete="off">
          <div style="margin-bottom:16px;">
            <label style="display:block;font-size:13px;font-weight:500;color:#5a4a3a;margin-bottom:6px;">Customer <span style="color:#c4956a">*</span></label>
            <select name="customer_id" required style="width:100%;padding:10px 14px;font-family:'Inter',sans-serif;font-size:14px;border:1px solid #e0d8cf;border-radius:10px;outline:none;color:#1a120b;transition:border-color 0.15s;"
              onfocus="this.style.borderColor='#c4956a'"
              onblur="this.style.borderColor='#e0d8cf'"
            >
              <option value="">Select customer…</option>
            </select>
          </div>

          <div style="margin-bottom:16px;">
            <label style="display:block;font-size:13px;font-weight:500;color:#5a4a3a;margin-bottom:6px;">Object Type <span style="color:#c4956a">*</span></label>
            <select name="object_type_id" required style="width:100%;padding:10px 14px;font-family:'Inter',sans-serif;font-size:14px;border:1px solid #e0d8cf;border-radius:10px;outline:none;color:#1a120b;transition:border-color 0.15s;"
              onfocus="this.style.borderColor='#c4956a'"
              onblur="this.style.borderColor='#e0d8cf'"
            >
              <option value="">Select type…</option>
            </select>
          </div>

          <div style="margin-bottom:16px;">
            <label style="display:block;font-size:13px;font-weight:500;color:#5a4a3a;margin-bottom:6px;">Date In <span style="color:#c4956a">*</span></label>
            <input name="received_at" type="date" required style="width:100%;padding:10px 14px;font-family:'Inter',sans-serif;font-size:14px;border:1px solid #e0d8cf;border-radius:10px;outline:none;color:#1a120b;transition:border-color 0.15s;"
              onfocus="this.style.borderColor='#c4956a'"
              onblur="this.style.borderColor='#e0d8cf'"
            />
          </div>

          <div style="margin-bottom:24px;">
            <label style="display:block;font-size:13px;font-weight:500;color:#5a4a3a;margin-bottom:6px;">Notes <span style="font-weight:400;color:#8a7560">(optional)</span></label>
            <textarea name="notes" rows="3" placeholder="Any notes about this object…" style="width:100%;padding:10px 14px;font-family:'Inter',sans-serif;font-size:14px;border:1px solid #e0d8cf;border-radius:10px;outline:none;color:#1a120b;resize:vertical;transition:border-color 0.15s;"
              onfocus="this.style.borderColor='#c4956a'"
              onblur="this.style.borderColor='#e0d8cf'"
            ></textarea>
          </div>

          <div id="obj-form-error" style="display:none;color:#b94040;font-size:13px;margin-bottom:12px;"></div>

          <button type="submit" id="obj-btn-submit" style="
            width:100%;padding:12px;background:#c4956a;color:#fff;border:none;cursor:pointer;
            font-family:'Inter',sans-serif;font-size:14px;font-weight:600;letter-spacing:0.01em;
            border-radius:8px;box-shadow:0 2px 8px rgba(196,149,106,0.3);
            transition:background 0.15s ease;
          "
            onmouseover="this.style.background='#b3845a'"
            onmouseout="this.style.background='#c4956a'"
          >Add Object</button>
        </form>
      </div>
    </div>
  `;
}

function skeletonRows() {
  return [1, 2, 3, 4].map(() => `
    <div style="display:grid;grid-template-columns:2fr 1.5fr 140px 1fr 150px;padding:14px 20px;border-bottom:1px solid #f5f0eb;align-items:center;">
      <span class="ck-skel" style="width:120px;height:13px;border-radius:3px;"></span>
      <span class="ck-skel" style="width:80px;height:13px;border-radius:3px;"></span>
      <span class="ck-skel" style="width:60px;height:22px;border-radius:999px;"></span>
      <span class="ck-skel" style="width:80px;height:13px;border-radius:3px;"></span>
      <span class="ck-skel" style="width:100px;height:28px;border-radius:6px;"></span>
    </div>
  `).join('');
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escAttr(str) {
  return String(str ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export async function mount(el) {
  // stub — wired in later tasks
}
```

- [ ] **Step 2: Start the dev server (if not already running)**

```bash
node serve.mjs
```

Expected: `Serving on http://localhost:3000`

- [ ] **Step 3: Screenshot to verify layout**

```bash
node screenshot.mjs http://localhost:3000/#/objects task2-shell
```

Open `temporary screenshots/screenshot-N-task2-shell.png`. Verify:
- "Objects" heading and "+ Add Object" button in header
- Search input + two filter selects in filter bar
- Table with 5 column headers and 4 shimmer skeleton rows
- Legend strip (Waiting / Ready / Picked Up) below table

- [ ] **Step 4: Commit**

```bash
git add pages/objects.js
git commit -m "feat(objects): render shell with table, filters, and add-object modal"
```

---

### Task 3: Data fetching and real rows

**Files:**
- Modify: `pages/objects.js`

Add all data-fetching functions and replace the `mount` stub. Append the following to `pages/objects.js` (replacing the stub `mount`):

- [ ] **Step 1: Replace mount and add data functions**

Replace the stub `export async function mount(el) { ... }` at the bottom of `pages/objects.js` with:

```js
// ─── Lifecycle ────────────────────────────────────────────────────────────────

export async function mount(el) {
  await Promise.all([
    loadObjectTypes(el),
    loadCustomers(),
  ]);
  await loadObjects(el);
  wireFilters(el);
  wireModal(el);
}

// ─── Data ────────────────────────────────────────────────────────────────────

async function loadObjectTypes(el) {
  const { data } = await supabase
    .from('object_types')
    .select('id, name, raw_stock')
    .order('name');

  allObjectTypes = data ?? [];

  const typeFilter = el.querySelector('#obj-filter-type');
  allObjectTypes.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    typeFilter.appendChild(opt);
  });
}

async function loadCustomers() {
  const { data } = await supabase
    .from('customers')
    .select('id, name')
    .order('name');

  allCustomers = data ?? [];
}

async function loadObjects(el) {
  const body = el.querySelector('#objects-body');

  const { data, error } = await supabase
    .from('objects')
    .select('id, status, received_at, notified_at, notes, customers(id, name), object_types(id, name)')
    .order('received_at', { ascending: false });

  if (error) {
    body.innerHTML = `
      <div style="padding:32px 20px;text-align:center;font-family:'Inter',sans-serif;font-size:14px;color:#8a7560;">
        Failed to load objects. Please try again.
      </div>`;
    return;
  }

  allObjects = data ?? [];
  renderRows(el, allObjects);
}

// ─── Rows ─────────────────────────────────────────────────────────────────────

function renderRows(el, objects) {
  const body = el.querySelector('#objects-body');

  if (objects.length === 0) {
    body.innerHTML = `
      <div style="padding:48px 20px;text-align:center;font-family:'Inter',sans-serif;font-size:14px;color:#8a7560;">
        No objects found.
      </div>`;
    return;
  }

  body.innerHTML = objects.map((o, i) => buildRow(o, i === objects.length - 1)).join('');
  wireAdvanceDropdowns(el);
}

function buildRow(o, isLast) {
  const customerName = o.customers?.name ?? '—';
  const typeName     = o.object_types?.name ?? '—';
  const dateIn       = o.received_at
    ? new Date(o.received_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  const isReady    = o.status === 'ready';
  const isPickedUp = o.status === 'picked_up';

  const rowBg = isReady ? '#f9fdf7' : '#fff';

  const badge = `<span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:500;font-family:'Inter',sans-serif;${STATUS_BADGE[o.status]}">${STATUS_LABEL[o.status] ?? o.status}</span>`;

  let waIndicator = '';
  if (isReady) {
    if (o.notified_at) {
      waIndicator = `
        <div style="margin-top:5px;display:flex;align-items:center;gap:4px;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#25D366" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21"/><path d="m9 10 2 2 4-4"/></svg>
          <span style="font-size:11px;color:#25D366;font-weight:500;font-family:'Inter',sans-serif;">Message sent</span>
        </div>`;
    } else {
      waIndicator = `
        <div style="margin-top:5px;display:flex;align-items:center;gap:4px;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c0392b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span style="font-size:11px;color:#c0392b;font-weight:500;font-family:'Inter',sans-serif;">Message not sent</span>
        </div>`;
    }
  }

  const nextStatus = STATUS_NEXT[o.status];
  const advanceCell = nextStatus
    ? `<select data-object-id="${escAttr(o.id)}" data-current-status="${escAttr(o.status)}" class="advance-select" style="
        padding:6px 10px;border:1px solid #e0d8cf;border-radius:6px;
        font-family:'Inter',sans-serif;font-size:12px;color:#5a4a3a;
        background:#fff;cursor:pointer;outline:none;transition:border-color 0.15s;
      "
        onfocus="this.style.borderColor='#c4956a'"
        onblur="this.style.borderColor='#e0d8cf'"
      >
        <option value="">Advance →</option>
        <option value="${escAttr(nextStatus)}">${STATUS_LABEL[nextStatus]}</option>
      </select>`
    : `<span style="font-size:12px;color:#b0a090;font-style:italic;font-family:'Inter',sans-serif;">— complete —</span>`;

  return `
    <div class="obj-row" style="
      display:grid;grid-template-columns:2fr 1.5fr 140px 1fr 150px;
      padding:14px 20px;border-bottom:${isLast ? 'none' : '1px solid #f5f0eb'};
      align-items:center;background:${rowBg};${isPickedUp ? 'opacity:0.5;' : ''}
    ">
      <div style="font-family:'Inter',sans-serif;font-size:14px;font-weight:600;color:#1a120b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(customerName)}</div>
      <div style="font-family:'Inter',sans-serif;font-size:13px;color:#5a4a3a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(typeName)}</div>
      <div>${badge}${waIndicator}</div>
      <div style="font-family:'Inter',sans-serif;font-size:13px;color:#8a7560;">${escHtml(dateIn)}</div>
      <div>${advanceCell}</div>
    </div>`;
}

// ─── Filters ──────────────────────────────────────────────────────────────────

function wireFilters(el) {
  const search    = el.querySelector('#obj-search');
  const statusSel = el.querySelector('#obj-filter-status');
  const typeSel   = el.querySelector('#obj-filter-type');
  [search, statusSel, typeSel].forEach(ctrl => {
    ctrl.addEventListener('input',  () => applyFilters(el));
    ctrl.addEventListener('change', () => applyFilters(el));
  });
}

function applyFilters(el) {
  const q      = el.querySelector('#obj-search').value.trim().toLowerCase();
  const status = el.querySelector('#obj-filter-status').value;
  const typeId = el.querySelector('#obj-filter-type').value;

  const filtered = allObjects.filter(o => {
    const name = (o.customers?.name ?? '').toLowerCase();
    const type = (o.object_types?.name ?? '').toLowerCase();
    if (q && !name.includes(q) && !type.includes(q)) return false;
    if (status && o.status !== status) return false;
    if (typeId && o.object_types?.id !== typeId) return false;
    return true;
  });

  renderRows(el, filtered);
}

// ─── Advance dropdowns ────────────────────────────────────────────────────────

function wireAdvanceDropdowns(el) {
  el.querySelectorAll('.advance-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const objectId   = sel.dataset.objectId;
      const prevStatus = sel.dataset.currentStatus;
      const newStatus  = sel.value;
      if (!newStatus) return;

      const obj = allObjects.find(o => o.id === objectId);
      if (!obj) return;

      obj.status = newStatus;
      applyFilters(el);

      const updatePayload = { status: newStatus };
      if (newStatus === 'picked_up') updatePayload.picked_up_at = new Date().toISOString();

      const { error } = await supabase
        .from('objects')
        .update(updatePayload)
        .eq('id', objectId);

      if (error) {
        obj.status = prevStatus;
        applyFilters(el);
        alert('Failed to update status: ' + error.message);
        return;
      }

      if (newStatus === 'ready') {
        await notifyCustomer(objectId, obj, el);
      }
    });
  });
}

async function notifyCustomer(objectId, obj, el) {
  try {
    const { error: fnError } = await supabase.functions.invoke('notify-customer', {
      body: { object_id: objectId },
    });
    if (fnError) throw fnError;

    const now = new Date().toISOString();
    await supabase.from('objects').update({ notified_at: now }).eq('id', objectId);
    obj.notified_at = now;
  } catch {
    // notified_at stays null → red indicator shown
  }
  applyFilters(el);
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function wireModal(el) {
  const backdrop  = el.querySelector('#obj-modal-backdrop');
  const closeBtn  = el.querySelector('#obj-modal-close');
  const addBtn    = el.querySelector('#btn-add-object');
  const form      = el.querySelector('#add-object-form');
  const errorDiv  = el.querySelector('#obj-form-error');
  const submitBtn = el.querySelector('#obj-btn-submit');

  function openModal() {
    const customerSel = form.elements.customer_id;
    customerSel.innerHTML = '<option value="">Select customer…</option>';
    allCustomers.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      customerSel.appendChild(opt);
    });

    const typeSel = form.elements.object_type_id;
    typeSel.innerHTML = '<option value="">Select type…</option>';
    allObjectTypes.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.raw_stock <= 0 ? `${t.name} (out of stock)` : t.name;
      typeSel.appendChild(opt);
    });

    form.reset();
    form.elements.received_at.value = new Date().toISOString().slice(0, 10);
    errorDiv.style.display = 'none';
    backdrop.style.display = 'flex';
  }

  function closeModal() { backdrop.style.display = 'none'; }

  addBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const customerId   = form.elements.customer_id.value;
    const objectTypeId = form.elements.object_type_id.value;
    const receivedAt   = form.elements.received_at.value;
    const notes        = form.elements.notes.value.trim();

    if (!customerId || !objectTypeId || !receivedAt) {
      errorDiv.textContent = 'Customer, object type, and date are required.';
      errorDiv.style.display = 'block';
      return;
    }

    errorDiv.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding…';

    const { error: insertError } = await supabase
      .from('objects')
      .insert({
        customer_id:    customerId,
        object_type_id: objectTypeId,
        status:         'received',
        received_at:    receivedAt,
        notes:          notes || null,
      });

    if (insertError) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Add Object';
      errorDiv.textContent = 'Failed to add object: ' + insertError.message;
      errorDiv.style.display = 'block';
      return;
    }

    const objType = allObjectTypes.find(t => t.id === objectTypeId);
    if (objType && objType.raw_stock > 0) {
      await supabase
        .from('object_types')
        .update({ raw_stock: objType.raw_stock - 1 })
        .eq('id', objectTypeId);
      objType.raw_stock -= 1;
    }

    submitBtn.disabled = false;
    submitBtn.textContent = 'Add Object';
    closeModal();
    await loadObjects(el);
  });
}
```

- [ ] **Step 2: Screenshot to verify real data loads**

```bash
node screenshot.mjs http://localhost:3000/#/objects task3-data
```

Open the screenshot. Verify:
- Real customer names and object type names appear in the table
- Status badges show "Waiting", "Ready", or "Picked Up" correctly
- "Ready" rows have a faint green background
- "Picked Up" rows are dimmed
- Ready rows with `notified_at` show green "Message sent"; those without show red "Message not sent"

- [ ] **Step 3: Test filters in browser**

In the browser at `http://localhost:3000/#/objects`:
- Type a customer name in the search box → table filters in real time
- Select "Waiting" from the status dropdown → only Waiting rows show
- Select an object type → only that type shows
- Clear all filters → all rows return

- [ ] **Step 4: Test status advance in browser**

Find a "Waiting" row. Select "Ready" from its Advance dropdown.
- Row badge should immediately change to "Ready" (green)
- Row background should become green-tinted
- WhatsApp indicator should appear (green if Edge Function succeeds, red if it fails)
- Supabase `objects` table should show `status = 'ready'`

Find a "Ready" row. Select "Picked Up".
- Row should dim immediately
- Advance cell should change to "— complete —"
- Supabase should show `status = 'picked_up'` and `picked_up_at` set

- [ ] **Step 5: Test Add Object modal in browser**

Click "+ Add Object":
- Modal opens with customer and object type dropdowns populated
- Date In defaults to today
- Fill all fields and submit
- Row appears in table with "Waiting" status
- In Supabase, `object_types.raw_stock` for the chosen type is decremented by 1

- [ ] **Step 6: Commit**

```bash
git add pages/objects.js
git commit -m "feat(objects): full objects page — table, filters, status advance, WhatsApp indicator, add-object modal"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Covered |
|---|---|
| Table: customer name, object type, status badge, date in, batch label | ✓ (batch removed per design decision) |
| Filter by status | ✓ `#obj-filter-status` |
| Filter by object type | ✓ `#obj-filter-type` + `#obj-search` |
| Status dropdown per row — next status only | ✓ `STATUS_NEXT` map, only one option in dropdown |
| Enforce order, no skipping | ✓ dropdown only exposes one valid next status |
| On ready: call notify-customer Edge Function | ✓ `notifyCustomer()` |
| On ready: set notified_at | ✓ after Edge Function success |
| WhatsApp indicator inline under Ready badge | ✓ `waIndicator` in `buildRow` |
| Add Object: decrement raw_stock | ✓ in modal submit handler |
| Add Object form: customer, type, date, notes | ✓ all four fields |
| Skeleton loading | ✓ `skeletonRows()` shown until `loadObjects` resolves |
| Empty state | ✓ "No objects found." message |
| Fetch error state | ✓ error message in table body |
| Status update failure → revert | ✓ in `wireAdvanceDropdowns` |
| picked_up_at set on pickup | ✓ `updatePayload.picked_up_at` |

**Placeholder scan:** No TBDs or incomplete steps. All code blocks are complete. ✓

**Type consistency:** `STATUS_LABEL`, `STATUS_NEXT`, `STATUS_BADGE` defined once at top and used consistently throughout. `obj.object_types?.id` used for type filter match, `allObjectTypes` populated in `loadObjectTypes`. ✓

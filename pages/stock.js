import { supabase } from '../supabase.js';
import { escHtml, countBy, fetchAllRows, debounce } from '../utils.js';
import { LIST_CSS, searchBox, chipGroup, selectBox, clearButton, wireFilters, activeCount, updateClear, renderPager } from '../listui.js';
import { logEvent } from '../log.js';

// ─── State ───────────────────────────────────────────────────────────────────
let allTypes = [];
let inProgressMap = new Map();
let stockErrors = new Map();
let savingIds = new Set();
let editing   = null;       // { id, mode: 'add' | 'remove' } — the card whose amount box is open
let stockNotes = new Map(); // typeId → short success note ("Added 5"), cleared after a moment
const DEFAULTS = { q: '', category: '', level: 'all', sort: 'name' };
let filters     = { ...DEFAULTS };
let currentPage = 1;
let pageSize    = 25;

const SORTS = {
  name:     { label: 'Name',              cmp: (a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')) },
  code:     { label: 'Code',              cmp: (a, b) => String(a.code ?? '').localeCompare(String(b.code ?? ''), undefined, { numeric: true }) },
  stock:    { label: 'Stock, lowest first', cmp: (a, b) => (a.raw_stock ?? 0) - (b.raw_stock ?? 0) },
  progress: { label: 'Most in progress',  cmp: (a, b) => (inProgressMap.get(b.id) ?? 0) - (inProgressMap.get(a.id) ?? 0) },
};
const isLow = t => t.low_stock_alert != null && t.raw_stock <= t.low_stock_alert;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatPrice(price) {
  return `₪${Number(price ?? 0).toFixed(0)}`;
}

function skeletonCards() {
  return Array(6).fill(null).map(() => `
    <div style="background:#fff;border-radius:14px;border:1px solid #e8e1d8;padding:20px;
      box-shadow:0 2px 6px rgba(45,31,20,0.08),0 8px 24px rgba(45,31,20,0.05);">
      <span class="ck-skel" style="display:block;width:120px;height:16px;border-radius:4px;margin-bottom:8px;"></span>
      <span class="ck-skel" style="display:block;width:60px;height:20px;border-radius:999px;margin-bottom:16px;"></span>
      <span class="ck-skel" style="display:block;width:70px;height:22px;border-radius:4px;margin-bottom:20px;"></span>
      <span class="ck-skel" style="display:block;width:100%;height:32px;border-radius:6px;margin-bottom:8px;"></span>
      <span class="ck-skel" style="display:block;width:100%;height:32px;border-radius:6px;"></span>
    </div>
  `).join('');
}

// ─── Render ──────────────────────────────────────────────────────────────────
export function render() {
  return `
    ${LIST_CSS}
    <style>
      @keyframes ck-shimmer-stock {
        0%   { opacity: 1; }
        50%  { opacity: 0.45; }
        100% { opacity: 1; }
      }
      .ck-skel {
        display: inline-block;
        background: #e8e1d8;
        border-radius: 4px;
        animation: ck-shimmer-stock 1.4s ease-in-out infinite;
      }
      .stock-btn {
        width: 28px; height: 28px;
        border-radius: 6px;
        border: 1px solid #e0d8cf;
        background: #fff;
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        display: flex; align-items: center; justify-content: center;
        transition: background 0.1s ease, border-color 0.1s ease;
        flex-shrink: 0;
      }
      .stock-btn:hover:not(:disabled) { background: #f5f0eb; border-color: #9C1A4D; }
      .stock-btn:active:not(:disabled) { background: #ede8e2; }
      .stock-btn:disabled { opacity: 0.35; cursor: not-allowed; }
      .stock-btn:focus-visible { outline: 2px solid #9C1A4D; outline-offset: 2px; }

      /* Amount box that opens from + / − */
      .adj-form {
        display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:10px;
        background:#faf7f4;border:1px solid #ece4da;font-family:'Inter',sans-serif;font-size:13px;
      }
      .adj-form.add    { border-color:#bfe3cb;background:#f1faf4; }
      .adj-form.remove { border-color:#ecc7cf;background:#fdf3f5; }
      .adj-mode { font-weight:600;min-width:58px; }
      .adj-form.add .adj-mode    { color:#2f8a4a; }
      .adj-form.remove .adj-mode { color:#9C1A4D; }
      .adj-form.set    { border-color:#b9d5e8;background:#f2f8fc; }
      .adj-form.set .adj-mode { color:#2D7CAD; }
      .stock-count {
        background:none;border:1px dashed transparent;border-radius:6px;padding:0 6px;cursor:text;
        transition:transform .18s cubic-bezier(.34,1.56,.64,1);
      }
      .stock-count:hover:not(:disabled) { border-color:#c9b9a8;background:#fff; }
      .stock-count:active:not(:disabled) { transform:scale(.95); }
      .stock-count:focus-visible { outline:2px solid #9C1A4D;outline-offset:2px; }
      .stock-count:disabled { cursor:default; }
      .adj-input {
        width:64px;padding:6px 8px;border:1px solid #d8cdc0;border-radius:8px;background:#fff;
        font-family:'Inter',sans-serif;font-size:14px;font-weight:600;color:#1a120b;text-align:center;outline:none;
      }
      .adj-input:focus { border-color:#9C1A4D;box-shadow:0 0 0 3px rgba(156,26,77,.12); }
      .adj-preview { flex:1;color:#8a7560;white-space:nowrap; }
      .adj-preview b { color:#1a120b; }
      .adj-preview.bad { color:#b94040; }
      .adj-ok { color:#2f8a4a; }
      .adj-ok:not(:disabled):hover { background:#2f8a4a !important;border-color:#2f8a4a !important;color:#fff; }
      .stock-note { font-family:'Inter',sans-serif;font-size:12px;color:#2f8a4a; }
      #add-type-form input { box-sizing: border-box; }
    </style>

    <svg style="position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;opacity:0.04;" xmlns="http://www.w3.org/2000/svg">
      <filter id="ck-noise-stock">
        <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch"/>
        <feColorMatrix type="saturate" values="0"/>
      </filter>
      <rect width="100%" height="100%" filter="url(#ck-noise-stock)"/>
    </svg>
    <div style="position:fixed;top:0;right:0;width:600px;height:400px;
      background:radial-gradient(ellipse at top right,rgba(156,26,77,0.08),transparent);
      pointer-events:none;z-index:0;"></div>

    <div style="padding:40px;position:relative;z-index:1;">

      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:32px;">
        <div>
          <h1 style="font-family:'Caveat',cursive;font-size:42px;font-weight:700;
            letter-spacing:-0.01em;color:#1a120b;margin-bottom:4px;">Stock</h1>
          <p style="font-family:'Inter',sans-serif;color:#8a7560;font-size:15px;line-height:1.7;">
            Manage raw stock per object type.</p>
        </div>
        <button id="btn-add-type" style="
          flex-shrink:0;margin-top:4px;
          background:#9C1A4D;color:#fff;border:none;cursor:pointer;
          font-family:'Inter',sans-serif;font-size:14px;font-weight:500;
          padding:10px 18px;border-radius:8px;letter-spacing:0.01em;
          box-shadow:0 2px 8px rgba(156,26,77,0.3);
          transition:background 0.15s ease,box-shadow 0.15s ease;"
          onmouseover="this.style.background='#7D1540';this.style.boxShadow='0 2px 12px rgba(156,26,77,0.4)'"
          onmouseout="this.style.background='#9C1A4D';this.style.boxShadow='0 2px 8px rgba(156,26,77,0.3)'"
        >+ Add Object Type</button>
      </div>

      <div id="stock-filters" class="fbar"></div>

      <div id="stock-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px;">
        ${skeletonCards()}
      </div>
      <div id="stock-pagination"></div>

    </div>

    <div id="type-modal-backdrop" style="
      display:none;position:fixed;inset:0;
      background:rgba(26,18,11,0.4);z-index:100;
      align-items:center;justify-content:center;">
      <div style="
        background:#fff;border-radius:12px;padding:32px;
        width:100%;max-width:440px;position:relative;margin:16px;
        box-shadow:0 8px 40px rgba(45,31,20,0.18);">
        <button id="type-modal-close" style="
          position:absolute;top:16px;right:16px;
          background:none;border:none;cursor:pointer;
          font-size:20px;color:#8a7560;line-height:1;
          width:28px;height:28px;display:flex;align-items:center;justify-content:center;
          border-radius:6px;transition:background 0.15s;"
          onmouseover="this.style.background='#f0ebe4'"
          onmouseout="this.style.background='none'"
        >×</button>

        <h2 style="font-family:'Inter',sans-serif;font-size:22px;font-weight:700;
          color:#1a120b;margin-bottom:24px;">Add Object Type</h2>

        <form id="add-type-form" autocomplete="off">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
            <div>
              <label style="display:block;font-size:13px;font-weight:500;color:#5a4a3a;margin-bottom:6px;">
                Name <span style="color:#9C1A4D">*</span></label>
              <input name="name" type="text" required placeholder="e.g. Large Plate" style="
                width:100%;padding:10px 14px;font-family:'Inter',sans-serif;font-size:14px;
                border:1px solid #e0d8cf;border-radius:10px;outline:none;color:#1a120b;
                transition:border-color 0.15s;"
                onfocus="this.style.borderColor='#9C1A4D'"
                onblur="this.style.borderColor='#e0d8cf'"/>
            </div>
            <div>
              <label style="display:block;font-size:13px;font-weight:500;color:#5a4a3a;margin-bottom:6px;">
                Code <span style="color:#9C1A4D">*</span></label>
              <input name="code" type="text" required placeholder="e.g. BPLT" style="
                width:100%;padding:10px 14px;font-family:'Inter',sans-serif;font-size:14px;
                border:1px solid #e0d8cf;border-radius:10px;outline:none;color:#1a120b;
                text-transform:uppercase;letter-spacing:0.05em;
                transition:border-color 0.15s;"
                onfocus="this.style.borderColor='#9C1A4D'"
                onblur="this.style.borderColor='#e0d8cf'"
                oninput="this.value=this.value.toUpperCase()"/>
            </div>
          </div>

          <div style="margin-bottom:16px;">
            <label style="display:block;font-size:13px;font-weight:500;color:#5a4a3a;margin-bottom:6px;">
              Category <span style="font-weight:400;color:#8a7560">(optional)</span></label>
            <input name="category" type="text" placeholder="e.g. Plates" style="
              width:100%;padding:10px 14px;font-family:'Inter',sans-serif;font-size:14px;
              border:1px solid #e0d8cf;border-radius:10px;outline:none;color:#1a120b;
              transition:border-color 0.15s;"
              onfocus="this.style.borderColor='#9C1A4D'"
              onblur="this.style.borderColor='#e0d8cf'"/>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
            <div>
              <label style="display:block;font-size:13px;font-weight:500;color:#5a4a3a;margin-bottom:6px;">
                Price <span style="color:#9C1A4D">*</span></label>
              <input name="price" type="number" min="0" step="0.01" required placeholder="0" style="
                width:100%;padding:10px 14px;font-family:'Inter',sans-serif;font-size:14px;
                border:1px solid #e0d8cf;border-radius:10px;outline:none;color:#1a120b;
                transition:border-color 0.15s;"
                onfocus="this.style.borderColor='#9C1A4D'"
                onblur="this.style.borderColor='#e0d8cf'"/>
            </div>
            <div>
              <label style="display:block;font-size:13px;font-weight:500;color:#5a4a3a;margin-bottom:6px;">
                Initial Stock <span style="color:#9C1A4D">*</span></label>
              <input name="raw_stock" type="number" min="0" step="1" required placeholder="0" style="
                width:100%;padding:10px 14px;font-family:'Inter',sans-serif;font-size:14px;
                border:1px solid #e0d8cf;border-radius:10px;outline:none;color:#1a120b;
                transition:border-color 0.15s;"
                onfocus="this.style.borderColor='#9C1A4D'"
                onblur="this.style.borderColor='#e0d8cf'"/>
            </div>
          </div>

          <div style="margin-bottom:24px;">
            <label style="display:block;font-size:13px;font-weight:500;color:#5a4a3a;margin-bottom:6px;">
              Alert Threshold <span style="color:#9C1A4D">*</span></label>
            <input name="low_stock_alert" type="number" min="0" step="1" required placeholder="e.g. 3" style="
              width:100%;padding:10px 14px;font-family:'Inter',sans-serif;font-size:14px;
              border:1px solid #e0d8cf;border-radius:10px;outline:none;color:#1a120b;
              transition:border-color 0.15s;"
              onfocus="this.style.borderColor='#9C1A4D'"
              onblur="this.style.borderColor='#e0d8cf'"/>
          </div>

          <div style="margin-bottom:24px;">
            <label style="display:block;font-size:13px;font-weight:500;color:#5a4a3a;margin-bottom:6px;">
              Image <span style="font-weight:400;color:#8a7560">(optional)</span></label>
            <input name="image" type="file" accept="image/*" style="
              width:100%;padding:8px 14px;font-family:'Inter',sans-serif;font-size:14px;
              border:1px solid #e0d8cf;border-radius:10px;outline:none;color:#1a120b;
              cursor:pointer;background:#fff;transition:border-color 0.15s;"
              onfocus="this.style.borderColor='#9C1A4D'"
              onblur="this.style.borderColor='#e0d8cf'"
            />
          </div>

          <div id="type-form-error" style="display:none;color:#b94040;font-size:13px;margin-bottom:12px;"></div>

          <button type="submit" id="type-btn-submit" style="
            width:100%;padding:12px;background:#9C1A4D;color:#fff;border:none;cursor:pointer;
            font-family:'Inter',sans-serif;font-size:14px;font-weight:600;letter-spacing:0.01em;
            border-radius:8px;box-shadow:0 2px 8px rgba(156,26,77,0.3);
            transition:background 0.15s ease;"
            onmouseover="this.style.background='#7D1540'"
            onmouseout="this.style.background='#9C1A4D'"
          >Add Object Type</button>
        </form>
      </div>
    </div>
  `;
}

export async function mount(el, signal) {
  allTypes = [];
  stockErrors = new Map();
  savingIds = new Set();
  editing = null;
  stockNotes = new Map();
  filters     = { ...DEFAULTS };
  currentPage = 1;
  wireModal(el, signal);

  const error = await loadStock();
  if (signal.aborted) return;
  if (error) {
    logEvent('error', `Couldn't load stock: ${error.message}`);
    el.querySelector('#stock-grid').innerHTML = `
      <div style="grid-column:1/-1;padding:48px 0;text-align:center;
        font-family:'Inter',sans-serif;font-size:14px;color:#8a7560;">
        Couldn't load stock. Refresh the page to try again.
      </div>`;
    return;
  }
  renderFilters(el);
  renderCards(el);
}

// Loads object types and the "in progress" (status = received) count per type.
// Returns an error, or null on success.
async function loadStock() {
  const [typesResult, progressResult] = await Promise.all([
    supabase.from('object_types').select('*').order('category').order('name'),
    fetchAllRows(() => supabase.from('objects').select('object_type_id').eq('status', 'received')),
  ]);
  if (typesResult.error) return typesResult.error;
  allTypes = typesResult.data ?? [];
  inProgressMap = countBy(progressResult.data ?? [], r => r.object_type_id);
  return null;
}

// ─── Card rendering ───────────────────────────────────────────────────────────

function renderCards(el) {
  const grid = el.querySelector('#stock-grid');
  if (!grid) return;

  if (allTypes.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;padding:48px 0;text-align:center;
        font-family:'Inter',sans-serif;font-size:14px;color:#8a7560;">
        No object types yet. Use "+ Add Object Type" to create one.
      </div>`;
    return;
  }

  const q = filters.q.toLowerCase().trim();
  const filtered = allTypes.filter(t =>
    (!q || [t.name, t.code, t.category].some(v => String(v ?? '').toLowerCase().includes(q))) &&
    (filters.category === '' || (filters.category === '__none' ? !t.category : t.category === filters.category)) &&
    (filters.level === 'all' ||
      (filters.level === 'low' && isLow(t)) ||
      (filters.level === 'out' && (t.raw_stock ?? 0) <= 0) ||
      (filters.level === 'progress' && (inProgressMap.get(t.id) ?? 0) > 0))
  ).sort((a, b) => SORTS[filters.sort].cmp(a, b) || String(a.name ?? '').localeCompare(String(b.name ?? '')));

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  currentPage = Math.min(currentPage, pages);
  renderPager(el.querySelector('#stock-pagination'), {
    page: currentPage, pageSize, total: filtered.length, noun: 'object types',
    onPage: n => { currentPage = n; renderCards(el); el.querySelector('#stock-filters')?.scrollIntoView({ block: 'start' }); },
    onPageSize: n => { pageSize = n; currentPage = 1; renderCards(el); },
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;padding:48px 0;text-align:center;
        font-family:'Inter',sans-serif;font-size:14px;color:#8a7560;">
        No object types match these filters.
      </div>`;
    return;
  }

  const from = (currentPage - 1) * pageSize;
  grid.innerHTML = filtered.slice(from, from + pageSize).map(t => buildCard(t)).join('');
  wireStockButtons(el);
}

function buildCard(t) {
  const inProgress = inProgressMap.get(t.id) ?? 0;
  const isLowStock = t.low_stock_alert != null && t.raw_stock <= t.low_stock_alert;
  const error      = stockErrors.get(t.id);
  const isEditing  = editing?.id === t.id;

  const cardStyle = isLowStock
    ? 'background:#fffbf5;border-left:4px solid #d97706;'
    : 'background:#fff;';

  const pill = isLowStock
    ? `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;
        font-weight:500;background:rgba(217,119,6,0.12);color:#b45309;">Low stock</span>`
    : t.category
      ? `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;
          font-weight:500;background:#f0ebe4;color:#8a7560;">${escHtml(t.category)}</span>`
      : '';

  const labelStyle = `font-family:'Inter',sans-serif;font-size:11px;font-weight:600;` +
    `text-transform:uppercase;letter-spacing:0.06em;color:#8a7560;`;
  const countStyle = `font-family:'Inter',sans-serif;font-size:20px;font-weight:700;` +
    `color:#1a120b;min-width:28px;text-align:center;`;

  return `
    <div style="${cardStyle}border-radius:14px;border:1px solid #e8e1d8;overflow:hidden;
      box-shadow:0 2px 6px rgba(45,31,20,0.08),0 8px 24px rgba(45,31,20,0.05);">

      ${t.image_url ? `<img src="${escHtml(t.image_url)}" alt="${escHtml(t.name)}" style="width:100%;height:140px;object-fit:cover;display:block;" />` : ''}

      <div style="padding:20px;">
      <div style="margin-bottom:6px;">
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:6px;">
          <div style="font-family:'Inter',sans-serif;font-size:18px;font-weight:700;color:#1a120b;">${escHtml(t.name)}</div>
          ${t.code && t.code !== t.name ? `<span style="font-family:'Inter',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.08em;color:#9C1A4D;background:rgba(156,26,77,0.08);padding:2px 7px;border-radius:4px;">${escHtml(t.code)}</span>` : ''}
        </div>
        ${pill}
      </div>

      <div style="font-family:'Inter',sans-serif;font-size:22px;font-weight:600;
        color:#9C1A4D;margin:14px 0 18px;">${formatPrice(t.price)}</div>

      <div style="display:flex;flex-direction:column;gap:12px;">

        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span style="${labelStyle}">Raw stock</span>
          <div style="display:flex;align-items:center;gap:8px;">
            <button class="stock-btn stock-minus" data-id="${escHtml(t.id)}" aria-label="Remove stock"
              ${(t.raw_stock <= 0 || savingIds.has(t.id) || isEditing) ? 'disabled' : ''}>−</button>
            <button type="button" class="stock-count" id="stock-count-${escHtml(t.id)}" data-id="${escHtml(t.id)}"
              title="Click to type the exact number" aria-label="Edit the number in stock (now ${t.raw_stock})"
              style="${countStyle}" ${(savingIds.has(t.id) || isEditing) ? 'disabled' : ''}>${savingIds.has(t.id) ? '…' : t.raw_stock}</button>
            <button class="stock-btn stock-plus" data-id="${escHtml(t.id)}" aria-label="Add stock"
              ${(savingIds.has(t.id) || isEditing) ? 'disabled' : ''}>+</button>
          </div>
        </div>

        ${isEditing ? buildAdjustForm(t) : ''}
        ${error ? `<div style="font-family:'Inter',sans-serif;font-size:12px;color:#b94040;">${escHtml(error)}</div>` : ''}
        ${stockNotes.has(t.id) ? `<div class="stock-note">✓ ${escHtml(stockNotes.get(t.id))}</div>` : ''}

        <div style="display:flex;align-items:center;justify-content:space-between;
          padding-top:12px;border-top:1px solid #f5f0eb;">
          <span style="${labelStyle}">In progress</span>
          <span style="font-family:'Inter',sans-serif;font-size:20px;font-weight:700;
            color:#5a4a3a;min-width:28px;text-align:center;">${inProgress}</span>
        </div>

      </div>
      </div>
    </div>`;
}

// The amount box under a card's stock row: add, remove, or set the exact count.
const ADJUST = {
  add:    { label: 'Add',    aria: 'How many to add' },
  remove: { label: 'Remove', aria: 'How many to remove' },
  set:    { label: 'Set to', aria: 'Exact number in stock' },
};

function buildAdjustForm(t) {
  const mode = ADJUST[editing.mode];
  const isSet = editing.mode === 'set';
  return `
    <form class="adj-form ${editing.mode}" data-id="${escHtml(t.id)}" novalidate>
      <span class="adj-mode">${mode.label}</span>
      <input class="adj-input" type="number" min="${isSet ? 0 : 1}" step="1" inputmode="numeric"
        ${editing.mode === 'remove' ? `max="${t.raw_stock}"` : ''} ${isSet ? `value="${t.raw_stock}"` : ''}
        aria-label="${mode.aria}" />
      <span class="adj-preview" aria-live="polite"></span>
      <button type="submit" class="stock-btn adj-ok" aria-label="Save" disabled>✓</button>
      <button type="button" class="stock-btn adj-cancel" aria-label="Cancel">✕</button>
    </form>`;
}

function wireStockButtons(el) {
  const open = (id, mode) => {
    editing = { id, mode };
    stockErrors.delete(id);
    stockNotes.delete(id);
    renderCards(el);
  };
  el.querySelectorAll('.stock-minus, .stock-plus').forEach(btn =>
    btn.addEventListener('click', () => open(btn.dataset.id, btn.classList.contains('stock-plus') ? 'add' : 'remove')));
  el.querySelectorAll('.stock-count').forEach(btn =>
    btn.addEventListener('click', () => open(btn.dataset.id, 'set')));

  const form = el.querySelector('.adj-form');
  if (!form) return;
  const type    = allTypes.find(t => t.id === form.dataset.id);
  const input   = form.querySelector('.adj-input');
  const preview = form.querySelector('.adj-preview');
  const ok      = form.querySelector('.adj-ok');
  const mode    = editing.mode;

  // The typed number: an amount for add/remove (1+), the new count for set (0+). null if not valid.
  const value = () => {
    if (input.value.trim() === '') return null;
    const n = Number(input.value);
    if (!Number.isInteger(n) || n < 0 || (mode !== 'set' && n === 0)) return null;
    return n;
  };
  const refresh = () => {
    const n = value();
    let html = '', bad = false, valid = n !== null;
    if (valid && mode === 'set') {
      const diff = n - type.raw_stock;
      html = diff === 0 ? 'no change' : `<b>${diff > 0 ? '+' : '−'}${Math.abs(diff)}</b>`;
      valid = diff !== 0;
    } else if (valid) {
      const next = type.raw_stock + (mode === 'add' ? n : -n);
      bad = next < 0;
      html = bad ? `Only ${type.raw_stock} in stock` : `→ <b>${next}</b>`;
      valid = !bad;
    }
    preview.classList.toggle('bad', bad);
    preview.innerHTML = html;
    ok.disabled = !valid;
  };
  const close = () => { editing = null; renderCards(el); };

  input.addEventListener('input', refresh);
  input.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); close(); } });
  form.querySelector('.adj-cancel').addEventListener('click', close);
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (ok.disabled) return;
    const n = value();
    editing = null;
    if (mode === 'set') changeStock(el, type, { set: n });
    else changeStock(el, type, { delta: mode === 'add' ? n : -n });
  });
  refresh();
  input.focus();
  if (mode === 'set') input.select(); // type straight over the current count
}

// { delta }: adds/removes from the stock as it is in the database right now, so a change made
// elsewhere since the page loaded isn't overwritten. { set }: writes the exact count (e.g. after counting the shelf).
async function changeStock(el, type, { delta, set }) {
  if (savingIds.has(type.id)) return;
  savingIds.add(type.id);
  renderCards(el);

  let error = null, next = null, before = type.raw_stock;
  if (set !== undefined) {
    next = set;
    const { error: upError } = await supabase.from('object_types').update({ raw_stock: next }).eq('id', type.id);
    if (upError) error = upError.message;
  } else {
    const { data: fresh, error: readError } = await supabase
      .from('object_types').select('raw_stock').eq('id', type.id).single();
    if (readError) error = readError.message;
    else {
      before = fresh.raw_stock ?? 0;
      next = before + delta;
      if (next < 0) error = `Only ${before} in stock now — nothing was removed.`;
      else {
        const { error: upError } = await supabase.from('object_types').update({ raw_stock: next }).eq('id', type.id);
        if (upError) error = upError.message;
      }
    }
  }

  savingIds.delete(type.id);
  if (error) {
    type.raw_stock = before;
    stockErrors.set(type.id, `Couldn't update — ${error}`);
    logEvent('error', `Couldn't change ${type.name} stock (${set !== undefined ? `set to ${set}` : `by ${delta}`}): ${error}`);
  } else {
    type.raw_stock = next;
    const note = new String(set !== undefined ? `Set to ${set}` : `${delta > 0 ? 'Added' : 'Removed'} ${Math.abs(delta)}`);
    stockNotes.set(type.id, note);
    // clear this note only — a newer save may have replaced it already
    setTimeout(() => {
      if (stockNotes.get(type.id) !== note) return;
      stockNotes.delete(type.id);
      if (!editing) renderCards(el);
    }, 2500);
  }
  renderCards(el);
}

function renderFilters(el) {
  const box = el.querySelector('#stock-filters');
  const cats = [...new Set(allTypes.map(t => t.category).filter(Boolean))].sort();
  const catOptions = [['', 'All categories'], ...cats.map(c => [c, c]),
    ...(allTypes.some(t => !t.category) ? [['__none', 'No category']] : [])];
  box.innerHTML = `
    <div class="fbar-row">
      ${searchBox('stock-search', 'Search by name, code, or category…', filters.q)}
      ${selectBox('sort', 'Sort', Object.entries(SORTS).map(([k, v]) => [k, v.label]), filters.sort)}
    </div>
    <div class="fbar-row">
      ${chipGroup('level', 'Show', [['all', 'All'], ['low', 'Low stock'], ['out', 'Out of stock'], ['progress', 'In progress']], filters.level)}
      ${cats.length ? selectBox('category', 'Category', catOptions, filters.category) : ''}
      ${clearButton(activeCount(filters, DEFAULTS))}
    </div>`;
  const update = () => { currentPage = 1; updateClear(box, activeCount(filters, DEFAULTS)); renderCards(el); };
  box.querySelector('#stock-search').addEventListener('input', debounce(e => { filters.q = e.target.value; update(); }, 150));
  wireFilters(box, (name, value) => { filters[name] = value; update(); }, () => {
    filters = { ...DEFAULTS, sort: filters.sort };
    renderFilters(el);
    currentPage = 1;
    renderCards(el);
  });
}

function wireModal(el, signal) {
  const backdrop  = el.querySelector('#type-modal-backdrop');
  const closeBtn  = el.querySelector('#type-modal-close');
  const addBtn    = el.querySelector('#btn-add-type');
  const form      = el.querySelector('#add-type-form');
  const errorDiv  = el.querySelector('#type-form-error');
  const submitBtn = el.querySelector('#type-btn-submit');

  function openModal() {
    form.reset();
    errorDiv.style.display = 'none';
    backdrop.style.display = 'flex';
  }

  function closeModal() {
    backdrop.style.display = 'none';
  }

  addBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });

  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); }, { signal });

  form.addEventListener('submit', async e => {
    e.preventDefault();

    const name            = form.elements.name.value.trim();
    const code            = form.elements.code.value.trim().toUpperCase();
    const category        = form.elements.category.value.trim();
    const price           = parseFloat(form.elements.price.value);
    const raw_stock       = parseInt(form.elements.raw_stock.value, 10);
    const low_stock_alert = parseInt(form.elements.low_stock_alert.value, 10);

    if (!name || !code || isNaN(price) || isNaN(raw_stock) || isNaN(low_stock_alert)) {
      errorDiv.textContent = 'Name, code, price, initial stock, and alert threshold are required.';
      errorDiv.style.display = 'block';
      return;
    }

    if (price < 0 || raw_stock < 0 || low_stock_alert < 0) {
      errorDiv.textContent = 'Price, stock, and alert threshold must be 0 or greater.';
      errorDiv.style.display = 'block';
      return;
    }

    errorDiv.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding…';

    let image_url = null;
    const imageFile = form.elements.image.files[0];
    if (imageFile) {
      const ext = imageFile.name.split('.').pop().toLowerCase();
      const { data: upData, error: upError } = await supabase.storage
        .from('object-type-images')
        .upload(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`, imageFile);
      if (upError) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add Object Type';
        logEvent('error', `Image upload for new type ${name} failed: ${upError.message}`);
        errorDiv.textContent = 'Image upload failed: ' + upError.message;
        errorDiv.style.display = 'block';
        return;
      }
      const { data: { publicUrl } } = supabase.storage
        .from('object-type-images')
        .getPublicUrl(upData.path);
      image_url = publicUrl;
    }

    const { error } = await supabase.from('object_types').insert({
      name,
      code,
      category:        category || null,
      price,
      raw_stock,
      low_stock_alert,
      ...(image_url ? { image_url } : {}),
    });

    submitBtn.disabled = false;
    submitBtn.textContent = 'Add Object Type';

    if (error) {
      logEvent('error', `Couldn't add object type ${name}: ${error.message}`);
      errorDiv.textContent = 'Failed to add: ' + error.message;
      errorDiv.style.display = 'block';
      return;
    }

    closeModal();

    if (!(await loadStock()) && !signal.aborted) {
      stockErrors = new Map();
      renderFilters(el);
      renderCards(el);
    }
  });
}

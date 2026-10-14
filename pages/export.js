import { supabase } from '../supabase.js';
import { fetchAllRows, countBy } from '../utils.js';
import { logEvent } from '../log.js';

// ─── SheetJS loader ──────────────────────────────────────────────────────────

let _xlsxReady = null;
function loadXlsx() {
  if (_xlsxReady) return _xlsxReady;
  _xlsxReady = new Promise((resolve, reject) => {
    if (window.XLSX) { resolve(window.XLSX); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    s.onload  = () => resolve(window.XLSX);
    s.onerror = () => { _xlsxReady = null; reject(new Error("Couldn't load the Excel library. Check your connection and try again.")); };
    document.head.appendChild(s);
  });
  return _xlsxReady;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function downloadWorkbook(wb, filename) {
  const XLSX = window.XLSX;
  XLSX.writeFile(wb, filename);
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function setBtn(el, id, { loading, error, success } = {}) {
  const btn   = el.querySelector(`#${id}`);
  const label = el.querySelector(`#${id}-label`);
  const spin  = el.querySelector(`#${id}-spin`);
  const err   = el.querySelector(`#${id}-err`);

  if (loading) {
    btn.disabled = true;
    label.textContent = 'Preparing…';
    spin.style.display = 'block';
    if (err) err.style.display = 'none';
  } else if (error) {
    btn.disabled = false;
    label.textContent = 'Download';
    spin.style.display = 'none';
    if (err) { err.textContent = error; err.style.display = 'block'; }
  } else if (success) {
    btn.disabled = false;
    label.textContent = '✓ Downloaded';
    spin.style.display = 'none';
    if (err) err.style.display = 'none';
    setTimeout(() => { label.textContent = 'Download'; }, 2500);
  }
}

// ─── Render ──────────────────────────────────────────────────────────────────

export function render() {
  return `
    <style>
      .export-card {
        background: #fff;
        border-radius: 16px;
        border: 1px solid #e8e1d8;
        padding: 28px;
        box-shadow: 0 2px 6px rgba(45,31,20,0.07), 0 8px 24px rgba(45,31,20,0.04);
        display: flex;
        flex-direction: column;
        gap: 0;
      }
      .export-dl-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        padding: 11px 0;
        background: #9C1A4D;
        color: #fff;
        border: none;
        border-radius: 9px;
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        letter-spacing: 0.01em;
        box-shadow: 0 2px 8px rgba(156,26,77,0.28);
        transition: background 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
        margin-top: 22px;
      }
      .export-dl-btn:hover:not(:disabled) {
        background: #7D1540;
        box-shadow: 0 2px 12px rgba(156,26,77,0.38);
      }
      .export-dl-btn:disabled {
        opacity: 0.6;
        cursor: default;
      }
      .export-dl-btn svg {
        width: 16px; height: 16px;
        stroke: currentColor; fill: none;
        stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
        flex-shrink: 0;
      }
      @keyframes ck-spin {
        to { transform: rotate(360deg); }
      }
      .export-spin {
        display: none;
        width: 14px; height: 14px;
        border: 2px solid rgba(255,255,255,0.35);
        border-top-color: #fff;
        border-radius: 50%;
        animation: ck-spin 0.6s linear infinite;
        flex-shrink: 0;
      }
      .export-err {
        display: none;
        margin-top: 10px;
        font-family: 'Inter', sans-serif;
        font-size: 12px;
        color: #b94040;
      }
      .export-field-list {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 14px;
      }
      .export-field-tag {
        font-family: 'Inter', sans-serif;
        font-size: 11.5px;
        font-weight: 500;
        color: #6b5544;
        background: #f5f0eb;
        border-radius: 6px;
        padding: 3px 8px;
        letter-spacing: 0.01em;
      }
    </style>

    <!-- Grain overlay -->
    <svg style="position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;opacity:0.04;" xmlns="http://www.w3.org/2000/svg">
      <filter id="ck-noise-export">
        <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch"/>
        <feColorMatrix type="saturate" values="0"/>
      </filter>
      <rect width="100%" height="100%" filter="url(#ck-noise-export)"/>
    </svg>
    <div style="position:fixed;top:0;right:0;width:600px;height:400px;background:radial-gradient(ellipse at top right,rgba(156,26,77,0.07),transparent);pointer-events:none;z-index:0;"></div>

    <div style="padding:40px;position:relative;z-index:1;max-width:960px;">

      <!-- Header -->
      <div style="margin-bottom:32px;">
        <h1 style="font-family:'Caveat',cursive;font-size:42px;font-weight:700;letter-spacing:-0.01em;color:#1a120b;margin-bottom:4px;">Export Data</h1>
        <p style="font-family:'Inter',sans-serif;color:#8a7560;font-size:15px;line-height:1.7;">Download your shop data as Excel spreadsheets (.xlsx).</p>
      </div>

      <!-- Cards grid -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px;">

        <!-- Customers card -->
        <div class="export-card">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:4px;">
            <div style="width:38px;height:38px;background:rgba(156,26,77,0.1);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg style="width:20px;height:20px;stroke:#9C1A4D;fill:none;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round;" viewBox="0 0 24 24">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div>
              <div style="font-family:'Inter',sans-serif;font-size:16px;font-weight:700;color:#1a120b;">Customers</div>
              <div style="font-family:'Inter',sans-serif;font-size:12px;color:#8a7560;margin-top:1px;">All registered customers</div>
            </div>
          </div>
          <div class="export-field-list">
            ${['Name','Phone','Notes','Total Objects','Returning?','Last Visit'].map(f=>`<span class="export-field-tag">${f}</span>`).join('')}
          </div>
          <button id="btn-dl-customers" class="export-dl-btn">
            <div class="export-spin" id="btn-dl-customers-spin"></div>
            <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span id="btn-dl-customers-label">Download</span>
          </button>
          <div class="export-err" id="btn-dl-customers-err"></div>
        </div>

        <!-- Objects card -->
        <div class="export-card">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:4px;">
            <div style="width:38px;height:38px;background:rgba(156,26,77,0.1);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg style="width:20px;height:20px;stroke:#9C1A4D;fill:none;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round;" viewBox="0 0 24 24">
                <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/>
                <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/>
                <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>
              </svg>
            </div>
            <div>
              <div style="font-family:'Inter',sans-serif;font-size:16px;font-weight:700;color:#1a120b;">Objects</div>
              <div style="font-family:'Inter',sans-serif;font-size:12px;color:#8a7560;margin-top:1px;">All customer objects</div>
            </div>
          </div>
          <div class="export-field-list">
            ${['Customer','Object Type','Status','Received','Notified','Picked Up','Notes'].map(f=>`<span class="export-field-tag">${f}</span>`).join('')}
          </div>
          <button id="btn-dl-objects" class="export-dl-btn">
            <div class="export-spin" id="btn-dl-objects-spin"></div>
            <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span id="btn-dl-objects-label">Download</span>
          </button>
          <div class="export-err" id="btn-dl-objects-err"></div>
        </div>

        <!-- Stock card -->
        <div class="export-card">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:4px;">
            <div style="width:38px;height:38px;background:rgba(156,26,77,0.1);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg style="width:20px;height:20px;stroke:#9C1A4D;fill:none;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round;" viewBox="0 0 24 24">
                <rect width="20" height="5" x="2" y="3" rx="1"/>
                <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/>
                <path d="M10 12h4"/>
              </svg>
            </div>
            <div>
              <div style="font-family:'Inter',sans-serif;font-size:16px;font-weight:700;color:#1a120b;">Stock</div>
              <div style="font-family:'Inter',sans-serif;font-size:12px;color:#8a7560;margin-top:1px;">Object types & inventory</div>
            </div>
          </div>
          <div class="export-field-list">
            ${['Name','Category','Price','Raw Stock','Low Stock Alert','In Progress'].map(f=>`<span class="export-field-tag">${f}</span>`).join('')}
          </div>
          <button id="btn-dl-stock" class="export-dl-btn">
            <div class="export-spin" id="btn-dl-stock-spin"></div>
            <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span id="btn-dl-stock-label">Download</span>
          </button>
          <div class="export-err" id="btn-dl-stock-err"></div>
        </div>

      </div>
    </div>
  `;
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

export async function mount(el) {
  el.querySelector('#btn-dl-customers').addEventListener('click', () => downloadCustomers(el));
  el.querySelector('#btn-dl-objects').addEventListener('click',   () => downloadObjects(el));
  el.querySelector('#btn-dl-stock').addEventListener('click',     () => downloadStock(el));
}

// ─── Download handlers ────────────────────────────────────────────────────────

async function downloadCustomers(el) {
  setBtn(el, 'btn-dl-customers', { loading: true });
  try {
    const XLSX = await loadXlsx();

    const { data, error } = await fetchAllRows(() => supabase
      .from('customers')
      .select('id, name, phone, notes, orders(id, received_at, objects(id))')
      .order('name')
      .order('id'));

    if (error) throw new Error(error.message);

    const rows = (data ?? []).map(c => {
      const customerOrders = c.orders ?? [];
      const total       = customerOrders.reduce((sum, o) => sum + (o.objects?.length ?? 0), 0);
      const isReturning = total > 1;
      let lastVisit = '';
      if (customerOrders.length > 0) {
        const maxMs = Math.max(...customerOrders.map(o => new Date(o.received_at).getTime()));
        lastVisit = fmtDate(maxMs);
      }
      return {
        'Name':           c.name ?? '',
        'Phone':          c.phone ?? '',
        'Notes':          c.notes ?? '',
        'Total Objects':  total,
        'Returning?':     isReturning ? 'Yes' : 'No',
        'Last Visit':     lastVisit,
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customers');
    downloadWorkbook(wb, 'clay-and-kef-customers.xlsx');

    setBtn(el, 'btn-dl-customers', { success: true });
  } catch (err) {
    logEvent('error', `Customers export failed: ${err.message}`);
    setBtn(el, 'btn-dl-customers', { error: err.message });
  }
}

async function downloadObjects(el) {
  setBtn(el, 'btn-dl-objects', { loading: true });
  try {
    const XLSX = await loadXlsx();

    const { data, error } = await fetchAllRows(() => supabase
      .from('objects')
      .select('id, status, container, notes, notified_at, picked_up_at, object_types(name, code), orders!inner(order_number, received_at, customers(name, phone))')
      .order('id'));

    if (error) throw new Error(error.message);

    const STATUS_LABEL = { received: 'Waiting', ready: 'Ready', picked_up: 'Picked Up' };

    // Newest orders first (by date — order numbers restart after 100)
    const sorted = (data ?? []).sort((a, b) => String(b.orders?.received_at ?? '').localeCompare(String(a.orders?.received_at ?? '')));
    const rows = sorted.map(o => ({
      'Order #':     o.orders?.order_number ?? '',
      'Customer':    o.orders?.customers?.name ?? '',
      'Phone':       o.orders?.customers?.phone ?? '',
      'Code':        o.object_types?.code ?? '',
      'Object Type': o.object_types?.name ?? '',
      'Status':      STATUS_LABEL[o.status] ?? o.status ?? '',
      'Container':   o.container ?? '',
      'Received':    fmtDate(o.orders?.received_at),
      'Notified':    fmtDate(o.notified_at),
      'Picked Up':   fmtDate(o.picked_up_at),
      'Notes':       o.notes ?? '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Objects');
    downloadWorkbook(wb, 'clay-and-kef-objects.xlsx');

    setBtn(el, 'btn-dl-objects', { success: true });
  } catch (err) {
    logEvent('error', `Objects export failed: ${err.message}`);
    setBtn(el, 'btn-dl-objects', { error: err.message });
  }
}

async function downloadStock(el) {
  setBtn(el, 'btn-dl-stock', { loading: true });
  try {
    const XLSX = await loadXlsx();

    const [typesRes, inProgressRes] = await Promise.all([
      supabase
        .from('object_types')
        .select('id, code, name, category, price, raw_stock, low_stock_alert')
        .order('name'),
      fetchAllRows(() => supabase
        .from('objects')
        .select('object_type_id')
        .eq('status', 'received')
        .order('id')),
    ]);

    if (typesRes.error) throw new Error(typesRes.error.message);
    if (inProgressRes.error) throw new Error(inProgressRes.error.message);

    const inProgressCount = countBy(inProgressRes.data ?? [], o => o.object_type_id);

    const rows = (typesRes.data ?? []).map(t => ({
      'Code':             t.code ?? '',
      'Name':             t.name ?? '',
      'Category':         t.category ?? '',
      'Price (₪)':        t.price != null ? Number(t.price) : '',
      'Raw Stock':        t.raw_stock ?? 0,
      'Low Stock Alert':  t.low_stock_alert ?? '',
      'In Progress':      inProgressCount.get(t.id) ?? 0,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock');
    downloadWorkbook(wb, 'clay-and-kef-stock.xlsx');

    setBtn(el, 'btn-dl-stock', { success: true });
  } catch (err) {
    logEvent('error', `Stock export failed: ${err.message}`);
    setBtn(el, 'btn-dl-stock', { error: err.message });
  }
}

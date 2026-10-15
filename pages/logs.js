import { supabase } from '../supabase.js';
import { escHtml, fmtNum, fetchAllRows } from '../utils.js';
import { LIST_CSS, chipGroup, dateRange, clearButton, wireFilters, activeCount, updateClear, renderPager } from '../listui.js';

// ─── Config ───────────────────────────────────────────────────────────────────

const DEFAULTS = { kind: 'all', action: 'all', from: '', to: '' };

const FILTERS = [
  { id: 'all',          label: 'All' },
  { id: 'orders',       label: 'Orders' },
  { id: 'objects',      label: 'Pieces' },
  { id: 'customers',    label: 'Customers' },
  { id: 'object_types', label: 'Stock & types' },
  { id: 'app',          label: 'App errors' },
];

const CATEGORY = {
  orders:       { label: 'Order',    style: 'background:rgba(156,26,77,0.10);color:#9C1A4D;' },
  objects:      { label: 'Piece',    style: 'background:rgba(80,160,80,0.12);color:#3a8a3a;' },
  customers:    { label: 'Customer', style: 'background:#f0ebe4;color:#7a5530;' },
  object_types: { label: 'Stock',    style: 'background:rgba(45,124,173,0.10);color:#2D7CAD;' },
  error:        { label: 'Error',    style: 'background:rgba(192,57,43,0.12);color:#c0392b;' },
  warning:      { label: 'Warning',  style: 'background:rgba(217,119,6,0.12);color:#b45309;' },
  info:         { label: 'Info',     style: 'background:#ede8e2;color:#8a7560;' },
};

const STATUS_LABEL = { received: 'Waiting', ready: 'Ready', picked_up: 'Collected' };
const HIDDEN_FIELDS = new Set(['id', 'created_at']);

// ─── State ────────────────────────────────────────────────────────────────────

let filters     = { ...DEFAULTS };
let currentPage = 1;
let pageSize    = 50;
let totalCount  = 0;
let entries     = [];
let expandedIds = new Set();
let loadSeq     = 0;
let pageSignal  = null;
// Lookups for readable descriptions: id → row
let typesById = new Map(), customersById = new Map(), ordersById = new Map();

// ─── Render ───────────────────────────────────────────────────────────────────

export function render() {
  return `
    ${LIST_CSS}
    <style>
      @keyframes ck-shimmer { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } }
      .ck-skel { display:inline-block;background:#e8e1d8;border-radius:4px;animation:ck-shimmer 1.4s ease-in-out infinite; }
      .log-row { transition:background .1s ease; }
      .log-row:hover { background:#faf7f4; }
    </style>

    <svg style="position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;opacity:0.04;" xmlns="http://www.w3.org/2000/svg">
      <filter id="ck-noise-logs">
        <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch"/>
        <feColorMatrix type="saturate" values="0"/>
      </filter>
      <rect width="100%" height="100%" filter="url(#ck-noise-logs)"/>
    </svg>
    <div style="position:fixed;top:0;right:0;width:600px;height:400px;background:radial-gradient(ellipse farthest-side at top right,rgba(156,26,77,0.08),transparent);pointer-events:none;z-index:0;"></div>

    <div style="padding:40px;position:relative;z-index:1;">
      <div style="margin-bottom:24px;">
        <h1 style="font-family:'Caveat',cursive;font-size:42px;font-weight:700;letter-spacing:-0.01em;color:#1a120b;margin-bottom:4px;">Logs</h1>
        <p style="font-family:'Inter',sans-serif;color:#8a7560;font-size:15px;line-height:1.7;">Every change in the shop and every app error, newest first.</p>
      </div>

      <div id="log-filters" class="fbar"></div>

      <div style="background:#fff;border-radius:14px;border:1px solid #e8e1d8;overflow:hidden;box-shadow:0 2px 6px rgba(45,31,20,0.08),0 8px 24px rgba(45,31,20,0.05);">
        <div id="log-list">${skeletonRows()}</div>
      </div>

      <div id="log-pagination"></div>
    </div>
  `;
}

function skeletonRows() {
  return [1, 2, 3, 4, 5].map(() => `
    <div style="display:flex;align-items:center;gap:16px;padding:14px 20px;border-bottom:1px solid #f5f0eb;">
      <span class="ck-skel" style="width:90px;height:12px;"></span>
      <span class="ck-skel" style="width:64px;height:20px;border-radius:999px;"></span>
      <span class="ck-skel" style="width:280px;height:13px;"></span>
    </div>`).join('');
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

export async function mount(el, signal) {
  pageSignal  = signal;
  filters     = { ...DEFAULTS };
  currentPage = 1;
  expandedIds = new Set();
  renderFilters(el);

  await loadLookups();
  if (signal.aborted) return;
  await loadEntries(el);
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function loadLookups() {
  const [types, customers, orders] = await Promise.all([
    supabase.from('object_types').select('id, name, code'),
    supabase.from('customers').select('id, name'),
    fetchAllRows(() => supabase.from('orders').select('id, order_number, customer_id').order('id')),
  ]);
  typesById     = new Map((types.data ?? []).map(r => [r.id, r]));
  customersById = new Map((customers.data ?? []).map(r => [r.id, r]));
  ordersById    = new Map((orders.data ?? []).map(r => [r.id, r]));
}

async function loadEntries(el) {
  const list = el.querySelector('#log-list');
  list.innerHTML = skeletonRows();

  const from = (currentPage - 1) * pageSize;
  let query = supabase
    .from('activity_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + pageSize - 1);

  if (filters.kind === 'app') query = query.eq('source', 'app');
  else if (filters.kind !== 'all') query = query.eq('table_name', filters.kind);
  if (filters.action !== 'all') query = query.eq('source', 'db').eq('action', filters.action);
  if (filters.from) query = query.gte('created_at', new Date(filters.from + 'T00:00:00').toISOString());
  if (filters.to) {
    const end = new Date(filters.to + 'T00:00:00');
    end.setDate(end.getDate() + 1);
    query = query.lt('created_at', end.toISOString());
  }

  const seq = ++loadSeq;
  const { data, error, count } = await query;
  if (seq !== loadSeq || pageSignal?.aborted) return;

  if (error) {
    const missing = error.code === '42P01' || error.code === 'PGRST205' || /activity_log/.test(error.message);
    list.innerHTML = `
      <div style="padding:40px 24px;text-align:center;font-family:'Inter',sans-serif;font-size:14px;color:#8a7560;line-height:1.7;">
        ${missing
          ? `Logging isn't set up yet. In Supabase, open <strong style="color:#1a120b;">SQL Editor</strong>, paste the contents of
             <code style="background:#f5f0eb;padding:1px 6px;border-radius:4px;">supabase/migrations/20261014_activity_log.sql</code> and run it.`
          : `Couldn't load the logs: ${escHtml(error.message)}`}
      </div>`;
    el.querySelector('#log-pagination').innerHTML = '';
    return;
  }

  entries    = data ?? [];
  totalCount = count ?? 0;
  renderEntries(el);
  renderPagination(el);
}

// ─── Rows ─────────────────────────────────────────────────────────────────────

function renderEntries(el) {
  const list = el.querySelector('#log-list');
  if (entries.length === 0) {
    list.innerHTML = `
      <div style="padding:48px 20px;text-align:center;font-family:'Inter',sans-serif;font-size:14px;color:#8a7560;">
        Nothing logged here yet. Changes appear as soon as you make them.
      </div>`;
    return;
  }

  list.innerHTML = entries.map((e, i) => buildRow(e, i === entries.length - 1)).join('');
  list.querySelectorAll('.log-row').forEach(row => {
    const toggle = () => {
      const id = Number(row.dataset.id);
      if (expandedIds.has(id)) expandedIds.delete(id); else expandedIds.add(id);
      renderEntries(el);
      el.querySelector(`.log-row[data-id="${id}"]`)?.focus();
    };
    row.addEventListener('click', toggle);
    row.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  });
}

function buildRow(entry, isLast) {
  const isApp    = entry.source === 'app';
  const category = CATEGORY[isApp ? entry.action : entry.table_name] ?? CATEGORY.info;
  const expanded = expandedIds.has(entry.id);
  const when     = new Date(entry.created_at);
  const date     = when.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const time     = when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return `
    <div style="border-bottom:${isLast && !expanded ? 'none' : '1px solid #f5f0eb'};">
      <div class="log-row" data-id="${entry.id}" role="button" tabindex="0" style="
        display:grid;grid-template-columns:150px 100px 1fr 16px;gap:16px;align-items:center;
        padding:12px 20px;cursor:pointer;">
        <div style="font-family:'Inter',sans-serif;font-size:12px;color:#8a7560;line-height:1.4;">
          ${escHtml(date)}<br><span style="color:#b0a090;">${escHtml(time)}</span>
        </div>
        <div><span style="display:inline-block;padding:2px 9px;border-radius:999px;font-family:'Inter',sans-serif;font-size:11px;font-weight:600;${category.style}">${category.label}</span></div>
        <div style="font-family:'Inter',sans-serif;font-size:14px;color:#1a120b;line-height:1.5;min-width:0;overflow-wrap:anywhere;">${describe(entry)}</div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${expanded ? '#9C1A4D' : '#b0a090'}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          ${expanded ? '<polyline points="6 9 12 15 18 9"/>' : '<polyline points="9 6 15 12 9 18"/>'}
        </svg>
      </div>
      ${expanded ? buildDetails(entry) : ''}
    </div>`;
}

// ─── Plain-language descriptions ──────────────────────────────────────────────

const b = s => `<strong style="font-weight:600;">${escHtml(s)}</strong>`;
const arrow = (from, to) => `${escHtml(from)} <span style="color:#b0a090;">→</span> ${escHtml(to)}`;

// Pieces have no number of their own for the owner — the order number is written on them.
function pieceLabel(row) {
  const type  = typesById.get(row?.object_type_id)?.name ?? 'Piece';
  const order = ordersById.get(row?.order_id)?.order_number;
  return order != null ? `${type} (order ${fmtNum(order)})` : type;
}
function orderLabel(row) {
  return `Order ${fmtNum(row?.order_number ?? ordersById.get(row?.id)?.order_number)}`;
}
function customerOfOrder(orderId) {
  return customersById.get(ordersById.get(orderId)?.customer_id)?.name;
}

function describe(e) {
  if (e.source === 'app') return escHtml(e.message ?? '');

  const row = e.new_data ?? e.old_data ?? {};
  const changed = (e.changed ?? []).filter(c => !HIDDEN_FIELDS.has(c));
  const others = cols => cols.length ? ` <span style="color:#8a7560;">(${escHtml(cols.join(', '))} changed)</span>` : '';

  switch (e.table_name) {
    case 'objects': {
      const who = customerOfOrder(row.order_id);
      if (e.action === 'INSERT') return `${b(typesById.get(row.object_type_id)?.name ?? 'Piece')} added to ${escHtml(orderLabel(ordersById.get(row.order_id)))}${who ? ` for ${escHtml(who)}` : ''}`;
      if (e.action === 'DELETE') return `${b(pieceLabel(row))} deleted`;
      const parts = [];
      if (changed.includes('status')) {
        parts.push(`${b(pieceLabel(row))}: ${arrow(STATUS_LABEL[e.old_data.status] ?? e.old_data.status, STATUS_LABEL[e.new_data.status] ?? e.new_data.status)}`);
      }
      if (changed.includes('notified_at')) {
        parts.push(e.new_data.notified_at
          ? `WhatsApp opened for ${b(pieceLabel(row))}${who ? ` (${escHtml(who)})` : ''}`
          : `WhatsApp mark cleared for ${b(pieceLabel(row))}`);
      }
      const rest = changed.filter(c => !['status', 'notified_at', 'picked_up_at'].includes(c));
      if (!parts.length) return `${b(pieceLabel(row))} updated${others(rest)}`;
      return parts.join(' · ') + others(rest);
    }
    case 'orders': {
      const who = customersById.get(row.customer_id)?.name;
      if (e.action === 'INSERT') return `${b(orderLabel(row))} created${who ? ` for ${escHtml(who)}` : ''}`;
      if (e.action === 'DELETE') return `${b(orderLabel(row))} deleted${who ? ` (${escHtml(who)})` : ''}`;
      const reminders = ['reminder1_at', 'reminder2_at'].filter(c => changed.includes(c));
      if (reminders.length) {
        const n = reminders.includes('reminder2_at') ? 2 : 1;
        const text = row[`reminder${n}_at`] ? `Pickup reminder ${n} sent` : `Pickup reminder ${n} cleared`;
        return `${b(orderLabel(row))}: ${text}${who ? ` (${escHtml(who)})` : ''}` + others(changed.filter(c => !reminders.includes(c)));
      }
      return `${b(orderLabel(row))} updated${others(changed)}`;
    }
    case 'customers': {
      if (e.action === 'INSERT') return `New customer ${b(row.name ?? '')}`;
      if (e.action === 'DELETE') return `Customer ${b(row.name ?? '')} deleted`;
      return `Customer ${b(row.name ?? '')} updated${others(changed)}`;
    }
    case 'object_types': {
      const name = `${row.name ?? 'Object type'}${row.code ? ` (${row.code})` : ''}`;
      if (e.action === 'INSERT') return `New object type ${b(name)} with ${escHtml(row.raw_stock ?? 0)} in stock`;
      if (e.action === 'DELETE') return `Object type ${b(name)} deleted`;
      if (changed.includes('raw_stock')) {
        const diff = (e.new_data.raw_stock ?? 0) - (e.old_data.raw_stock ?? 0);
        const sign = diff > 0 ? `+${diff}` : `−${Math.abs(diff)}`;
        return `${b(name)} stock: ${arrow(e.old_data.raw_stock, e.new_data.raw_stock)} <span style="color:#8a7560;">(${sign})</span>` +
          others(changed.filter(c => c !== 'raw_stock'));
      }
      return `${b(name)} updated${others(changed)}`;
    }
    default:
      return `${escHtml(e.table_name ?? '')} ${escHtml(e.action)}`;
  }
}

// ─── Expanded details ─────────────────────────────────────────────────────────

function fmtValue(v) {
  if (v == null || v === '') return '<span style="color:#c0b0a0;">—</span>';
  if (typeof v === 'object') return `<code style="font-size:12px;">${escHtml(JSON.stringify(v))}</code>`;
  return escHtml(v);
}

function buildDetails(e) {
  let rows;
  if (e.source === 'app') {
    rows = Object.entries(e.details ?? {}).map(([k, v]) => [k, null, v]);
  } else if (e.action === 'UPDATE') {
    rows = (e.changed ?? []).map(k => [k, e.old_data?.[k], e.new_data?.[k]]);
  } else {
    const data = e.new_data ?? e.old_data ?? {};
    rows = Object.entries(data).filter(([k]) => !HIDDEN_FIELDS.has(k)).map(([k, v]) => [k, null, v]);
  }
  const showBefore = e.source === 'db' && e.action === 'UPDATE';

  return `
    <div style="background:#faf7f4;padding:12px 20px 16px 186px;overflow-x:auto;">
      <table style="border-collapse:collapse;font-family:'Inter',sans-serif;font-size:13px;color:#5a4a3a;">
        <thead><tr>
          <th style="text-align:left;padding:4px 16px 6px 0;font-size:11px;font-weight:600;color:#8a7560;">Field</th>
          ${showBefore ? `<th style="text-align:left;padding:4px 16px 6px 0;font-size:11px;font-weight:600;color:#8a7560;">Before</th>` : ''}
          <th style="text-align:left;padding:4px 0 6px;font-size:11px;font-weight:600;color:#8a7560;">${showBefore ? 'After' : 'Value'}</th>
        </tr></thead>
        <tbody>
          ${rows.map(([k, before, after]) => `
            <tr>
              <td style="padding:3px 16px 3px 0;color:#8a7560;white-space:nowrap;vertical-align:top;">${escHtml(k)}</td>
              ${showBefore ? `<td style="padding:3px 16px 3px 0;vertical-align:top;">${fmtValue(before)}</td>` : ''}
              <td style="padding:3px 0;vertical-align:top;white-space:pre-wrap;">${fmtValue(after)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function renderPagination(el) {
  renderPager(el.querySelector('#log-pagination'), {
    page: currentPage, pageSize, total: totalCount, noun: 'entries',
    onPage: n => { currentPage = n; loadEntries(el); },
    onPageSize: n => { pageSize = n; currentPage = 1; loadEntries(el); },
  });
}

// ─── Filters ──────────────────────────────────────────────────────────────────

function renderFilters(el) {
  const box = el.querySelector('#log-filters');
  box.innerHTML = `
    <div class="fbar-row">
      ${chipGroup('kind', 'Show', FILTERS.map(f => [f.id, f.label]), filters.kind)}
    </div>
    <div class="fbar-row">
      ${chipGroup('action', 'Change', [['all', 'Any'], ['INSERT', 'Added'], ['UPDATE', 'Changed'], ['DELETE', 'Deleted']], filters.action)}
      ${dateRange('Date', filters.from, filters.to)}
      ${clearButton(activeCount(filters, DEFAULTS))}
    </div>`;
  wireFilters(box, (name, value) => {
    filters[name] = value;
    currentPage = 1;
    updateClear(box, activeCount(filters, DEFAULTS));
    loadEntries(el);
  }, () => {
    filters = { ...DEFAULTS };
    renderFilters(el);
    currentPage = 1;
    loadEntries(el);
  });
}

import { supabase } from '../supabase.js';
import { escHtml, fmtDate, pgQuote, debounce, phonePattern, looksLikePhone } from '../utils.js';
import { normalizePhone } from '../whatsapp.js';
import { logEvent } from '../log.js';
import { confirmDanger, deleteStyles, ICON_TRASH } from '../confirm.js';
import { LIST_CSS, searchBox, chipGroup, selectBox, clearButton, wireFilters, activeCount, updateClear, renderPager } from '../listui.js';

const AVATAR_COLORS = ['#e8d5c0', '#dcc9b4', '#d4bfaa', '#c8b49e', '#bda892'];

function getInitials(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── Render ───────────────────────────────────────────────────────────────────

export function render() {
  return `
    ${LIST_CSS}
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
      <filter id="ck-noise-customers">
        <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch"/>
        <feColorMatrix type="saturate" values="0"/>
      </filter>
      <rect width="100%" height="100%" filter="url(#ck-noise-customers)"/>
    </svg>
    <!-- Radial glow top-right -->
    <div style="position:fixed;top:0;right:0;width:600px;height:400px;background:radial-gradient(ellipse farthest-side at top right,rgba(156,26,77,0.08),transparent);pointer-events:none;z-index:0;"></div>

    <div style="padding:40px;position:relative;z-index:1;">

      <!-- Header -->
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:28px;">
        <div>
          <h1 style="font-family:'Caveat',cursive;font-size:42px;font-weight:700;letter-spacing:-0.01em;color:#1a120b;margin-bottom:4px;">Customers</h1>
          <p style="font-family:'Inter',sans-serif;color:#8a7560;font-size:15px;line-height:1.7;">All registered customers and their visit history.</p>
        </div>
        <button id="btn-add-customer" style="
          flex-shrink:0;margin-top:4px;
          background:#9C1A4D;color:#fff;border:none;cursor:pointer;
          font-family:'Inter',sans-serif;font-size:14px;font-weight:500;
          padding:10px 18px;border-radius:8px;letter-spacing:0.01em;
          box-shadow:0 2px 8px rgba(156,26,77,0.3);
          transition:background 0.15s ease,box-shadow 0.15s ease;
        "
          onmouseover="this.style.background='#7D1540';this.style.boxShadow='0 2px 12px rgba(156,26,77,0.4)'"
          onmouseout="this.style.background='#9C1A4D';this.style.boxShadow='0 2px 8px rgba(156,26,77,0.3)'"
        >+ Add Customer</button>
      </div>

      <!-- Filters -->
      <div id="cust-filters" class="fbar"></div>

      <!-- Customer list -->
      <div style="background:#fff;border-radius:14px;border:1px solid #e8e1d8;overflow:hidden;box-shadow:0 2px 6px rgba(45,31,20,0.08),0 8px 24px rgba(45,31,20,0.05);">
        <div id="customers-list">
          ${skeletonRows()}
        </div>
      </div>

      <div id="customers-pagination"></div>

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

        <h2 style="font-family:'Inter',sans-serif;font-size:22px;font-weight:700;color:#1a120b;margin-bottom:24px;">Add Customer</h2>

        <form id="add-customer-form" autocomplete="off">
          <div style="margin-bottom:16px;">
            <label style="display:block;font-size:13px;font-weight:500;color:#5a4a3a;margin-bottom:6px;">
              Name <span style="color:#9C1A4D">*</span>
            </label>
            <input name="name" type="text" required placeholder="e.g. Dana Cohen" style="
              width:100%;padding:10px 14px;font-family:'Inter',sans-serif;font-size:14px;
              border:1px solid #e0d8cf;border-radius:10px;outline:none;color:#1a120b;
              transition:border-color 0.15s;
            "
              onfocus="this.style.borderColor='#9C1A4D'"
              onblur="this.style.borderColor='#e0d8cf'"
            />
          </div>

          <div style="margin-bottom:16px;">
            <label style="display:block;font-size:13px;font-weight:500;color:#5a4a3a;margin-bottom:6px;">
              Phone <span style="color:#9C1A4D">*</span>
              <span style="font-weight:400;color:#8a7560">(include country code)</span>
            </label>
            <input name="phone" type="tel" required placeholder="e.g. +972-50-123-4567" style="
              width:100%;padding:10px 14px;font-family:'Inter',sans-serif;font-size:14px;
              border:1px solid #e0d8cf;border-radius:10px;outline:none;color:#1a120b;
              transition:border-color 0.15s;
            "
              onfocus="this.style.borderColor='#9C1A4D'"
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
              onfocus="this.style.borderColor='#9C1A4D'"
              onblur="this.style.borderColor='#e0d8cf'"
            ></textarea>
          </div>

          <div id="form-error" style="display:none;color:#b94040;font-size:13px;margin-bottom:12px;"></div>

          <button type="submit" id="btn-submit" style="
            width:100%;padding:12px;background:#9C1A4D;color:#fff;border:none;cursor:pointer;
            font-family:'Inter',sans-serif;font-size:14px;font-weight:600;letter-spacing:0.01em;
            border-radius:8px;box-shadow:0 2px 8px rgba(156,26,77,0.3);
            transition:background 0.15s ease;
          "
            onmouseover="this.style.background='#7D1540'"
            onmouseout="this.style.background='#9C1A4D'"
          >Add Customer</button>
        </form>
      </div>
    </div>
  `;
}

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

// ─── State ────────────────────────────────────────────────────────────────────

const DEFAULTS = { q: '', kind: 'all', open: 'all', sort: 'name' };
let filters      = { ...DEFAULTS };
let currentPage  = 1;
let pageSize     = 10;
let totalCount   = 0;
let loadSeq      = 0; // ignores responses from superseded searches
let pageSignal   = null;
let shownRows    = []; // the customers on the current page

const SORTS = {
  name:   { label: 'Name A–Z',    apply: q => q.order('name') },
  recent: { label: 'Last visit',  apply: q => q.order('last_visit', { ascending: false, nullsFirst: false }).order('name') },
  visits: { label: 'Most visits', apply: q => q.order('visits', { ascending: false }).order('name') },
};

// ─── Lifecycle ────────────────────────────────────────────────────────────────

export async function mount(el, signal) {
  pageSignal  = signal;
  currentPage = 1;
  filters     = { ...DEFAULTS };
  deleteStyles();
  renderFilters(el);
  wireModal(el, signal);
  el.querySelector('#customers-list').addEventListener('click', e => {
    const btn = e.target.closest('.cust-del');
    if (btn) deleteCustomer(el, shownRows.find(c => c.id === btn.dataset.id));
  });
  await loadCustomers(el);
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function loadCustomers(el) {
  const list = el.querySelector('#customers-list');
  list.innerHTML = skeletonRows();

  const q    = filters.q.trim().toLowerCase();
  const from = (currentPage - 1) * pageSize;

  // customer_list: one row per customer with visits, pieces, last visit and uncollected orders
  let query = supabase
    .from('customer_list')
    .select('id, name, phone, notes, visits, pieces, last_visit, open_orders', { count: 'exact' });
  if (q && looksLikePhone(q)) query = query.filter('phone', 'match', phonePattern(q) ?? 'a^'); // any way the number was written
  else if (q) query = query.or(`name.ilike.${pgQuote(`%${q}%`)},phone.ilike.${pgQuote(`%${q}%`)}`);
  if (filters.kind === 'returning') query = query.gt('pieces', 1);   // returning = more than one piece overall
  if (filters.kind === 'new')       query = query.lte('pieces', 1);
  if (filters.open === 'yes')       query = query.gt('open_orders', 0);
  query = SORTS[filters.sort].apply(query).order('id').range(from, from + pageSize - 1);

  const seq = ++loadSeq;
  const { data, error, count } = await query;
  if (seq !== loadSeq || pageSignal?.aborted) return;

  if (error) {
    logEvent('error', `Couldn't load customers: ${error.message}`);
    list.innerHTML = `
      <div style="padding:32px 20px;text-align:center;font-family:'Inter',sans-serif;font-size:14px;color:#8a7560;">
        Failed to load customers. Please try again.
      </div>`;
    return;
  }

  totalCount = count ?? 0;
  renderRows(list, data ?? []);
  renderPagination(el);
}

function renderRows(list, customers) {
  if (customers.length === 0) {
    list.innerHTML = `
      <div style="padding:48px 20px;text-align:center;font-family:'Inter',sans-serif;font-size:14px;color:#8a7560;">
        No customers found.
      </div>`;
    return;
  }
  shownRows = customers;
  list.innerHTML = customers.map((c, i) => buildRow(c, i === customers.length - 1)).join('');
}

function buildRow(c, isLast) {
  const pieces      = Number(c.pieces ?? 0);
  const visits      = Number(c.visits ?? 0);
  const open        = Number(c.open_orders ?? 0);
  const isReturning = pieces > 1;

  const initials  = getInitials(c.name);
  const avatarBg  = AVATAR_COLORS[(c.name?.charCodeAt(0) ?? 65) % AVATAR_COLORS.length];
  const objLabel  = `${visits} visit${visits !== 1 ? 's' : ''} · ${pieces} piece${pieces !== 1 ? 's' : ''}`;
  const lastVisit = fmtDate(c.last_visit);

  const pill = (text, style) => `<span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:500;white-space:nowrap;${style}">${text}</span>`;
  const rightEl = `<div style="display:flex;align-items:center;gap:8px;">
      ${open ? pill(`${open} to collect`, 'background:rgba(47,138,74,0.12);color:#2f8a4a;') : ''}
      ${isReturning ? pill('Returning', 'background:rgba(156,26,77,0.12);color:#9C1A4D;') : ''}
      ${lastVisit ? `<span style="font-size:13px;color:#b0a090;white-space:nowrap;min-width:92px;text-align:right;">${escHtml(lastVisit)}</span>` : ''}
    </div>`;

  const borderBottom = isLast ? 'none' : '1px solid #f5f0eb';

  return `
    <div style="display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:${borderBottom};background:#fff;transition:background 0.1s ease;"
         onmouseover="this.style.background='#faf7f4'"
         onmouseout="this.style.background='#fff'">
      <div style="width:36px;height:36px;border-radius:50%;background:${avatarBg};display:flex;align-items:center;justify-content:center;font-family:'Inter',sans-serif;font-size:13px;font-weight:600;color:#7a5530;flex-shrink:0;user-select:none;">${escHtml(initials)}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-family:'Inter',sans-serif;font-size:15px;font-weight:600;color:#1a120b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(c.name)}</div>
        <div style="font-family:'Inter',sans-serif;font-size:13px;color:#8a7560;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(c.phone || 'No phone')} · ${objLabel}</div>
      </div>
      <div style="flex-shrink:0;">${rightEl}</div>
      <button type="button" class="del-btn cust-del" data-id="${escHtml(c.id)}" style="flex-shrink:0;"
        title="Delete customer" aria-label="Delete ${escHtml(c.name)}">${ICON_TRASH}</button>
    </div>`;
}

// ─── Delete ───────────────────────────────────────────────────────────────────

// A customer with orders goes with all of them — so that needs an extra tick.
async function deleteCustomer(el, c) {
  if (!c) return;
  const visits = Number(c.visits ?? 0);
  const pieces = Number(c.pieces ?? 0);
  const name   = escHtml(c.name || 'this customer');
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const deleted = await confirmDanger({
    title: `Delete ${c.name || 'this customer'}?`,
    body: visits
      ? `<b>${name}</b> has <b>${plural(visits, 'order')}</b> with <b>${plural(pieces, 'piece')}</b>. They're deleted too, and drop out of the dashboard numbers. This can't be undone.`
      : `<b>${name}</b> has no orders. This can't be undone.`,
    check: visits ? { label: `Also delete their ${plural(visits, 'order')}`, required: true } : null,
    confirmLabel: 'Delete customer',
    run: async () => {
      const { data, error } = await supabase.rpc('delete_customer', { p_customer_id: c.id });
      if (error) {
        logEvent('error', `Couldn't delete customer ${c.name}: ${error.message}`);
        return `Couldn't delete — ${error.message}`;
      }
      const r = data?.[0] ?? {};
      logEvent('info', `Deleted customer ${c.name} (${r.deleted_orders ?? 0} orders, ${r.deleted_pieces ?? 0} pieces)`);
      return null;
    },
  });
  if (!deleted) return;
  // step back a page if that was the last customer on this one
  if (shownRows.length === 1 && currentPage > 1) currentPage--;
  loadCustomers(el);
}

function renderPagination(el) {
  renderPager(el.querySelector('#customers-pagination'), {
    page: currentPage, pageSize, total: totalCount, noun: 'customers',
    onPage: n => { currentPage = n; loadCustomers(el); },
    onPageSize: n => { pageSize = n; currentPage = 1; loadCustomers(el); },
  });
}

// ─── Filters ──────────────────────────────────────────────────────────────────

function renderFilters(el) {
  const box = el.querySelector('#cust-filters');
  box.innerHTML = `
    <div class="fbar-row">
      ${searchBox('customer-search', 'Search by name or phone…', filters.q)}
      ${selectBox('sort', 'Sort', Object.entries(SORTS).map(([k, v]) => [k, v.label]), filters.sort)}
    </div>
    <div class="fbar-row">
      ${chipGroup('kind', 'Customers', [['all', 'All'], ['returning', 'Returning'], ['new', 'New']], filters.kind)}
      ${chipGroup('open', 'Pieces to collect', [['all', 'Any'], ['yes', 'Has pieces waiting']], filters.open)}
      ${clearButton(activeCount(filters, DEFAULTS))}
    </div>`;
  const reload = () => { currentPage = 1; updateClear(box, activeCount(filters, DEFAULTS)); loadCustomers(el); };
  box.querySelector('#customer-search').addEventListener('input', debounce(e => { filters.q = e.target.value; reload(); }, 250));
  wireFilters(box, (name, value) => { filters[name] = value; reload(); }, () => {
    filters = { ...DEFAULTS, sort: filters.sort };
    renderFilters(el);
    currentPage = 1;
    loadCustomers(el);
  });
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function wireModal(el, signal) {
  const backdrop  = el.querySelector('#modal-backdrop');
  const closeBtn  = el.querySelector('#modal-close');
  const addBtn    = el.querySelector('#btn-add-customer');
  const form      = el.querySelector('#add-customer-form');
  const errorDiv  = el.querySelector('#form-error');
  const submitBtn = el.querySelector('#btn-submit');

  function openModal() {
    backdrop.style.display = 'flex';
    form.reset();
    errorDiv.style.display = 'none';
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
    const name  = form.elements.name.value.trim();
    const phone = form.elements.phone.value.trim();
    const notes = form.elements.notes.value.trim();

    if (!name || !phone) {
      errorDiv.textContent = 'Name and phone are required.';
      errorDiv.style.display = 'block';
      return;
    }
    if (!normalizePhone(phone)) {
      errorDiv.textContent = 'This phone number can’t be used for WhatsApp. Type it like 050-123-4567 or +972 50-123-4567.';
      errorDiv.style.display = 'block';
      return;
    }

    errorDiv.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding…';

    const { error } = await supabase
      .from('customers')
      .insert({ name, phone, notes: notes || null });

    submitBtn.disabled = false;
    submitBtn.textContent = 'Add Customer';

    if (error) {
      logEvent('error', `Couldn't add customer ${name}: ${error.message}`);
      errorDiv.textContent = 'Failed to add customer: ' + error.message;
      errorDiv.style.display = 'block';
      return;
    }

    closeModal();
    filters = { ...DEFAULTS, sort: filters.sort };
    renderFilters(el);
    currentPage = 1;
    await loadCustomers(el);
  });
}

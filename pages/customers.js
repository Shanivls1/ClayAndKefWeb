import { supabase } from '../supabase.js';

const AVATAR_COLORS = ['#e8d5c0', '#dcc9b4', '#d4bfaa', '#c8b49e', '#bda892'];

function getInitials(name) {
  const parts = String(name ?? '').trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── Render ───────────────────────────────────────────────────────────────────

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

let allCustomers = [];

// ─── Lifecycle ────────────────────────────────────────────────────────────────

export async function mount(el) {
  await loadCustomers(el);
  wireSearch(el);
  wireModal(el);
}

// ─── Data ─────────────────────────────────────────────────────────────────────

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

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ─── Search ───────────────────────────────────────────────────────────────────

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

// ─── Modal ────────────────────────────────────────────────────────────────────

function wireModal(el) {
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

    errorDiv.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding…';

    const { error } = await supabase
      .from('customers')
      .insert({ name, phone, notes: notes || null });

    submitBtn.disabled = false;
    submitBtn.textContent = 'Add Customer';

    if (error) {
      errorDiv.textContent = 'Failed to add customer: ' + error.message;
      errorDiv.style.display = 'block';
      return;
    }

    closeModal();
    const searchInput = el.querySelector('#customer-search');
    if (searchInput) searchInput.value = '';
    await loadCustomers(el);
  });
}

import { supabase } from '../supabase.js';

// ─── State ───────────────────────────────────────────────────────────────────
let allTypes = [];
let inProgressMap = new Map();
let stockErrors = new Map();

// ─── Helpers ─────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

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
      .stock-btn:hover:not(:disabled) { background: #f5f0eb; border-color: #c4956a; }
      .stock-btn:active:not(:disabled) { background: #ede8e2; }
      .stock-btn:disabled { opacity: 0.35; cursor: not-allowed; }
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
      background:radial-gradient(ellipse at top right,rgba(196,149,106,0.08),transparent);
      pointer-events:none;z-index:0;"></div>

    <div style="padding:40px;position:relative;z-index:1;">

      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:32px;">
        <div>
          <h1 style="font-family:'Playfair Display',serif;font-size:32px;font-weight:700;
            letter-spacing:-0.03em;color:#1a120b;margin-bottom:4px;">Stock</h1>
          <p style="font-family:'Inter',sans-serif;color:#8a7560;font-size:15px;line-height:1.7;">
            Manage raw stock per object type.</p>
        </div>
        <button id="btn-add-type" style="
          flex-shrink:0;margin-top:4px;
          background:#c4956a;color:#fff;border:none;cursor:pointer;
          font-family:'Inter',sans-serif;font-size:14px;font-weight:500;
          padding:10px 18px;border-radius:8px;letter-spacing:0.01em;
          box-shadow:0 2px 8px rgba(196,149,106,0.3);
          transition:background 0.15s ease,box-shadow 0.15s ease;"
          onmouseover="this.style.background='#b3845a';this.style.boxShadow='0 2px 12px rgba(196,149,106,0.4)'"
          onmouseout="this.style.background='#c4956a';this.style.boxShadow='0 2px 8px rgba(196,149,106,0.3)'"
        >+ Add Object Type</button>
      </div>

      <div id="stock-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px;">
        ${skeletonCards()}
      </div>

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

        <h2 style="font-family:'Playfair Display',serif;font-size:22px;font-weight:700;
          color:#1a120b;margin-bottom:24px;">Add Object Type</h2>

        <form id="add-type-form" autocomplete="off">
          <div style="margin-bottom:16px;">
            <label style="display:block;font-size:13px;font-weight:500;color:#5a4a3a;margin-bottom:6px;">
              Name <span style="color:#c4956a">*</span></label>
            <input name="name" type="text" required placeholder="e.g. Large Plate" style="
              width:100%;padding:10px 14px;font-family:'Inter',sans-serif;font-size:14px;
              border:1px solid #e0d8cf;border-radius:10px;outline:none;color:#1a120b;
              transition:border-color 0.15s;"
              onfocus="this.style.borderColor='#c4956a'"
              onblur="this.style.borderColor='#e0d8cf'"/>
          </div>

          <div style="margin-bottom:16px;">
            <label style="display:block;font-size:13px;font-weight:500;color:#5a4a3a;margin-bottom:6px;">
              Category <span style="font-weight:400;color:#8a7560">(optional)</span></label>
            <input name="category" type="text" placeholder="e.g. Plates" style="
              width:100%;padding:10px 14px;font-family:'Inter',sans-serif;font-size:14px;
              border:1px solid #e0d8cf;border-radius:10px;outline:none;color:#1a120b;
              transition:border-color 0.15s;"
              onfocus="this.style.borderColor='#c4956a'"
              onblur="this.style.borderColor='#e0d8cf'"/>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
            <div>
              <label style="display:block;font-size:13px;font-weight:500;color:#5a4a3a;margin-bottom:6px;">
                Price <span style="color:#c4956a">*</span></label>
              <input name="price" type="number" min="0" step="0.01" required placeholder="0" style="
                width:100%;padding:10px 14px;font-family:'Inter',sans-serif;font-size:14px;
                border:1px solid #e0d8cf;border-radius:10px;outline:none;color:#1a120b;
                transition:border-color 0.15s;"
                onfocus="this.style.borderColor='#c4956a'"
                onblur="this.style.borderColor='#e0d8cf'"/>
            </div>
            <div>
              <label style="display:block;font-size:13px;font-weight:500;color:#5a4a3a;margin-bottom:6px;">
                Initial Stock <span style="color:#c4956a">*</span></label>
              <input name="raw_stock" type="number" min="0" step="1" required placeholder="0" style="
                width:100%;padding:10px 14px;font-family:'Inter',sans-serif;font-size:14px;
                border:1px solid #e0d8cf;border-radius:10px;outline:none;color:#1a120b;
                transition:border-color 0.15s;"
                onfocus="this.style.borderColor='#c4956a'"
                onblur="this.style.borderColor='#e0d8cf'"/>
            </div>
          </div>

          <div style="margin-bottom:24px;">
            <label style="display:block;font-size:13px;font-weight:500;color:#5a4a3a;margin-bottom:6px;">
              Alert Threshold <span style="color:#c4956a">*</span></label>
            <input name="low_stock_alert" type="number" min="0" step="1" required placeholder="e.g. 3" style="
              width:100%;padding:10px 14px;font-family:'Inter',sans-serif;font-size:14px;
              border:1px solid #e0d8cf;border-radius:10px;outline:none;color:#1a120b;
              transition:border-color 0.15s;"
              onfocus="this.style.borderColor='#c4956a'"
              onblur="this.style.borderColor='#e0d8cf'"/>
          </div>

          <div id="type-form-error" style="display:none;color:#b94040;font-size:13px;margin-bottom:12px;"></div>

          <button type="submit" id="type-btn-submit" style="
            width:100%;padding:12px;background:#c4956a;color:#fff;border:none;cursor:pointer;
            font-family:'Inter',sans-serif;font-size:14px;font-weight:600;letter-spacing:0.01em;
            border-radius:8px;box-shadow:0 2px 8px rgba(196,149,106,0.3);
            transition:background 0.15s ease;"
            onmouseover="this.style.background='#b3845a'"
            onmouseout="this.style.background='#c4956a'"
          >Add Object Type</button>
        </form>
      </div>
    </div>
  `;
}

export async function mount(el) {
  stockErrors = new Map();
  const [typesResult, progressResult] = await Promise.all([
    supabase.from('object_types').select('*').order('category').order('name'),
    supabase.from('objects').select('object_type_id').eq('status', 'received'),
  ]);

  if (typesResult.error) {
    const grid = el.querySelector('#stock-grid');
    if (!grid) return;
    grid.innerHTML = `
      <div style="grid-column:1/-1;padding:48px 0;text-align:center;
        font-family:'Inter',sans-serif;font-size:14px;color:#8a7560;">
        Failed to load stock. Please try again.
      </div>`;
    return;
  }

  allTypes = typesResult.data ?? [];
  inProgressMap = (progressResult.data ?? []).reduce((m, r) => {
    m.set(r.object_type_id, (m.get(r.object_type_id) ?? 0) + 1);
    return m;
  }, new Map());

  renderCards(el);
  wireModal(el);
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

  grid.innerHTML = allTypes.map(t => buildCard(t)).join('');
  wireStockButtons(el);
}

function buildCard(t) {
  const inProgress = inProgressMap.get(t.id) ?? 0;
  const isLowStock = t.low_stock_alert != null && t.raw_stock <= t.low_stock_alert;
  const error      = stockErrors.get(t.id);

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
    <div style="${cardStyle}border-radius:14px;border:1px solid #e8e1d8;padding:20px;
      box-shadow:0 2px 6px rgba(45,31,20,0.08),0 8px 24px rgba(45,31,20,0.05);">

      <div style="margin-bottom:6px;">
        <div style="font-family:'Playfair Display',serif;font-size:18px;font-weight:700;
          color:#1a120b;margin-bottom:6px;">${escHtml(t.name)}</div>
        ${pill}
      </div>

      <div style="font-family:'Inter',sans-serif;font-size:22px;font-weight:600;
        color:#c4956a;margin:14px 0 18px;">${formatPrice(t.price)}</div>

      <div style="display:flex;flex-direction:column;gap:12px;">

        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span style="${labelStyle}">Raw stock</span>
          <div style="display:flex;align-items:center;gap:8px;">
            <button class="stock-btn stock-minus" data-id="${escHtml(t.id)}"
              ${t.raw_stock <= 0 ? 'disabled' : ''}>−</button>
            <span id="stock-count-${escHtml(t.id)}" style="${countStyle}">${t.raw_stock}</span>
            <button class="stock-btn stock-plus" data-id="${escHtml(t.id)}">+</button>
          </div>
        </div>

        ${error ? `<div style="font-family:'Inter',sans-serif;font-size:12px;color:#b94040;">${escHtml(error)}</div>` : ''}

        <div style="display:flex;align-items:center;justify-content:space-between;
          padding-top:12px;border-top:1px solid #f5f0eb;">
          <span style="${labelStyle}">In progress</span>
          <span style="font-family:'Inter',sans-serif;font-size:20px;font-weight:700;
            color:#5a4a3a;min-width:28px;text-align:center;">${inProgress}</span>
        </div>

      </div>
    </div>`;
}

function wireStockButtons(el) {
  // stub — filled in Task 3
}

function wireModal(el) {
  // stub — filled in Task 4
}

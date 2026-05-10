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

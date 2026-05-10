import { supabase } from '../supabase.js';

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
    </style>

    <div style="padding: 40px; max-width: 980px;">

      <!-- Header -->
      <div style="display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:28px;">
        <div>
          <h1 style="font-family:'Playfair Display',serif; font-size:32px; font-weight:700; letter-spacing:-0.03em; color:#1a120b; margin-bottom:4px;">Customers</h1>
          <p style="font-family:'Inter',sans-serif; color:#8a7560; font-size:15px; line-height:1.7;">All registered customers and their visit history.</p>
        </div>
        <button id="btn-add-customer" style="
          flex-shrink:0; margin-top:4px;
          background:#c4956a; color:#fff; border:none; cursor:pointer;
          font-family:'Inter',sans-serif; font-size:14px; font-weight:500;
          padding:10px 18px; border-radius:8px; letter-spacing:0.01em;
          box-shadow:0 2px 8px rgba(196,149,106,0.3);
          transition:background 0.15s ease, box-shadow 0.15s ease;
        "
          onmouseover="this.style.background='#b3845a';this.style.boxShadow='0 2px 12px rgba(196,149,106,0.4)'"
          onmouseout="this.style.background='#c4956a';this.style.boxShadow='0 2px 8px rgba(196,149,106,0.3)'"
        >+ Add Customer</button>
      </div>

      <!-- Search -->
      <div style="margin-bottom:20px; position:relative;">
        <input id="customer-search" type="text" placeholder="Search by name or phone…" style="
          width:100%; padding:10px 16px 10px 40px;
          font-family:'Inter',sans-serif; font-size:14px; color:#1a120b;
          background:#fff; border:1px solid #e0d8cf; border-radius:8px;
          outline:none; box-shadow:0 1px 3px rgba(0,0,0,0.04);
          transition:border-color 0.15s ease;
        "
          onfocus="this.style.borderColor='#c4956a'"
          onblur="this.style.borderColor='#e0d8cf'"
        />
        <svg style="position:absolute;left:14px;top:50%;transform:translateY(-50%);width:16px;height:16px;stroke:#8a7560;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;pointer-events:none;" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
      </div>

      <!-- Table -->
      <div style="background:#fff; border-radius:12px; border:1px solid #e8e1d8; overflow:hidden; box-shadow:0 1px 4px rgba(45,31,20,0.06),0 4px 16px rgba(45,31,20,0.04);">
        <table style="width:100%; border-collapse:collapse; font-family:'Inter',sans-serif; font-size:14px;">
          <thead>
            <tr style="background:#faf7f4; border-bottom:1px solid #e8e1d8;">
              <th style="text-align:left;padding:12px 20px;font-size:12px;font-weight:600;color:#8a7560;text-transform:uppercase;letter-spacing:0.06em;">Name</th>
              <th style="text-align:left;padding:12px 20px;font-size:12px;font-weight:600;color:#8a7560;text-transform:uppercase;letter-spacing:0.06em;">Phone</th>
              <th style="text-align:left;padding:12px 20px;font-size:12px;font-weight:600;color:#8a7560;text-transform:uppercase;letter-spacing:0.06em;">Objects</th>
              <th style="text-align:left;padding:12px 20px;font-size:12px;font-weight:600;color:#8a7560;text-transform:uppercase;letter-spacing:0.06em;">Last Visit</th>
              <th style="text-align:left;padding:12px 20px;font-size:12px;font-weight:600;color:#8a7560;text-transform:uppercase;letter-spacing:0.06em;">Status</th>
            </tr>
          </thead>
          <tbody id="customers-tbody">
            ${skeletonRows()}
          </tbody>
        </table>
      </div>

    </div>

    <!-- Add Customer Modal -->
    <div id="modal-backdrop" style="
      display:none; position:fixed; inset:0;
      background:rgba(26,18,11,0.4); z-index:100;
      align-items:center; justify-content:center;
    ">
      <div style="
        background:#fff; border-radius:12px; padding:32px;
        width:100%; max-width:420px; position:relative; margin:16px;
        box-shadow:0 8px 40px rgba(45,31,20,0.18);
      ">
        <button id="modal-close" style="
          position:absolute; top:16px; right:16px;
          background:none; border:none; cursor:pointer;
          font-size:20px; color:#8a7560; line-height:1;
          width:28px; height:28px; display:flex; align-items:center; justify-content:center;
          border-radius:6px; transition:background 0.15s;
        "
          onmouseover="this.style.background='#f0ebe4'"
          onmouseout="this.style.background='none'"
        >×</button>

        <h2 style="font-family:'Playfair Display',serif; font-size:22px; font-weight:700; color:#1a120b; margin-bottom:24px;">Add Customer</h2>

        <form id="add-customer-form" autocomplete="off">
          <div style="margin-bottom:16px;">
            <label style="display:block; font-size:13px; font-weight:500; color:#5a4a3a; margin-bottom:6px;">
              Name <span style="color:#c4956a">*</span>
            </label>
            <input name="name" type="text" required placeholder="e.g. Dana Cohen" style="
              width:100%; padding:10px 14px; font-family:'Inter',sans-serif; font-size:14px;
              border:1px solid #e0d8cf; border-radius:8px; outline:none; color:#1a120b;
              transition:border-color 0.15s;
            "
              onfocus="this.style.borderColor='#c4956a'"
              onblur="this.style.borderColor='#e0d8cf'"
            />
          </div>

          <div style="margin-bottom:16px;">
            <label style="display:block; font-size:13px; font-weight:500; color:#5a4a3a; margin-bottom:6px;">
              Phone <span style="color:#c4956a">*</span>
              <span style="font-weight:400; color:#8a7560">(include country code)</span>
            </label>
            <input name="phone" type="tel" required placeholder="e.g. +972-50-123-4567" style="
              width:100%; padding:10px 14px; font-family:'Inter',sans-serif; font-size:14px;
              border:1px solid #e0d8cf; border-radius:8px; outline:none; color:#1a120b;
              transition:border-color 0.15s;
            "
              onfocus="this.style.borderColor='#c4956a'"
              onblur="this.style.borderColor='#e0d8cf'"
            />
          </div>

          <div style="margin-bottom:24px;">
            <label style="display:block; font-size:13px; font-weight:500; color:#5a4a3a; margin-bottom:6px;">
              Notes <span style="font-weight:400; color:#8a7560">(optional)</span>
            </label>
            <textarea name="notes" placeholder="Any notes about this customer…" rows="3" style="
              width:100%; padding:10px 14px; font-family:'Inter',sans-serif; font-size:14px;
              border:1px solid #e0d8cf; border-radius:8px; outline:none; color:#1a120b;
              resize:vertical; transition:border-color 0.15s;
            "
              onfocus="this.style.borderColor='#c4956a'"
              onblur="this.style.borderColor='#e0d8cf'"
            ></textarea>
          </div>

          <div id="form-error" style="display:none; color:#b94040; font-size:13px; margin-bottom:12px;"></div>

          <button type="submit" id="btn-submit" style="
            width:100%; padding:12px; background:#c4956a; color:#fff; border:none; cursor:pointer;
            font-family:'Inter',sans-serif; font-size:14px; font-weight:600;
            border-radius:8px; box-shadow:0 2px 8px rgba(196,149,106,0.3);
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
  return [1, 2, 3].map(() => `
    <tr style="border-bottom:1px solid #f0ebe4;">
      <td style="padding:16px 20px;"><span class="ck-skel" style="width:110px;height:14px;"></span></td>
      <td style="padding:16px 20px;"><span class="ck-skel" style="width:130px;height:14px;"></span></td>
      <td style="padding:16px 20px;"><span class="ck-skel" style="width:24px;height:14px;"></span></td>
      <td style="padding:16px 20px;"><span class="ck-skel" style="width:90px;height:14px;"></span></td>
      <td style="padding:16px 20px;"></td>
    </tr>
  `).join('');
}

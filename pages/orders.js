import { supabase } from '../supabase.js';
import { initCombobox } from '../combobox.js';
import { escHtml, fmtNum, fmtDate, todayLocal, countBy, debounce, fetchAllRows, pgQuote } from '../utils.js';
import { LIST_CSS, searchBox, chipGroup, selectBox, dateRange, clearButton, wireFilters as wireFilterControls,
         activeCount, updateClear, renderPager } from '../listui.js';
import { buildReadyMessage, openWhatsApp } from '../whatsapp.js';
import { logEvent } from '../log.js';
import { loadSettings, settings, DEFAULTS as SETTING_DEFAULTS } from '../settings.js';

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUSES = ['received', 'ready', 'picked_up'];

const STATUS_LABEL = {
  received:  'Waiting',
  ready:     'Ready',
  picked_up: 'Picked up',
};

const STATUS_NEXT = {
  received:  'ready',
  ready:     'picked_up',
  picked_up: null,
};

// Colour of the progress track for each current status
const STATUS_TONE = {
  received:  'tone-waiting',
  ready:     'tone-ready',
  picked_up: 'tone-done',
};

// ─── State ─────────────────────────────────────────────────────────────────────

let allOrders      = [];
let allObjectTypes = [];
let allCustomers   = [];
let currentPage    = 1;
let totalCount     = 0;
let pageSize       = 10;
const FILTER_DEFAULTS = { q: '', stage: 'all', wa: 'all', type: '', container: '', from: '', to: '', sort: 'newest' };
let filters        = { ...FILTER_DEFAULTS };
let expandedIds    = new Set();
let savingIds      = new Set(); // pieces whose status change is being saved
let toastTimer     = null;

// WhatsApp chats opened but not yet confirmed as sent: orderId → { openedAt, orderNumber, name, phone, itemIds }.
// Each opening is also logged (activity_log, details.kind = 'wa_opened'), so unanswered chats come back after
// a reload or days later — see loadPendingWa().
const pendingWa  = new Map();
let waIssues     = new Map(); // orderId → { reason, at } — latest "not sent" reason, from the activity log
let trayOpen     = false;
const DEFAULT_REASONS = ["Number isn't on WhatsApp", 'Wrong number', "WhatsApp didn't open", 'Will send later'];
let waReasons    = [...DEFAULT_REASONS];
let loadSeq        = 0;         // ignores responses from superseded searches
let pageSignal     = null;

// ─── Render ────────────────────────────────────────────────────────────────────

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
        display:inline-block;background:#e8e1d8;border-radius:4px;
        animation:ck-shimmer 1.4s ease-in-out infinite;
      }
      .order-header-row { transition:background 0.1s ease; }
      .order-header-row:hover { background:#faf7f4 !important; }

      /* Pieces inside an opened order */
      .pc-well { background:#f6f1eb;padding:12px 20px 14px 68px;border-bottom:1px solid #ede6dd;display:flex;flex-direction:column;gap:8px; }
      .pc-card {
        display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1.5fr) 168px;align-items:center;gap:16px;
        background:#fff;border:1px solid #ece4da;border-radius:12px;padding:12px 16px;
        box-shadow:0 1px 2px rgba(45,31,20,0.05),0 4px 14px rgba(45,31,20,0.04);
      }
      .pc-card.is-done { background:#fcfaf8;box-shadow:none; }

      /* Order-level WhatsApp strip at the top of an opened order */
      .ord-strip {
        display:flex;align-items:center;gap:12px;flex-wrap:wrap;
        padding:10px 14px;border-radius:12px;font-family:'Inter',sans-serif;font-size:13px;line-height:1.5;
      }
      .ord-strip svg { flex-shrink:0; }
      .ord-strip.waiting { background:#fff;border:1px dashed #d8cdc0;color:#6b5a4a; }
      .ord-strip.ready   { background:#e9f6ee;border:1px solid #bfe3cb;color:#1f6b38; }
      .ord-strip.sent    { background:transparent;color:#1e9e50;padding:2px 2px 0; }
      .ord-strip-text { flex:1;min-width:200px; }
      .ord-strip-meter { display:inline-flex;gap:3px;vertical-align:middle;margin-left:6px; }
      .ord-strip-meter i { width:14px;height:5px;border-radius:3px;background:#e6ddd2; }
      .ord-strip-meter i.on { background:#2f8a4a; }
      .wa-btn {
        display:inline-flex;align-items:center;gap:7px;padding:8px 16px;border-radius:999px;border:none;cursor:pointer;
        background:#25D366;color:#fff;font-family:'Inter',sans-serif;font-size:13px;font-weight:600;
        box-shadow:0 1px 2px rgba(37,211,102,.3),0 4px 12px rgba(37,211,102,.25);
        transition:transform .18s cubic-bezier(.34,1.56,.64,1);
      }
      .wa-btn:hover { background:#1ebe5a; }
      .wa-btn:active { transform:scale(.96); }
      .wa-btn:focus-visible { outline:2px solid #1f6b38;outline-offset:3px; }
      .wa-btn.small { padding:4px 11px;font-size:11px;margin-top:6px;box-shadow:0 1px 4px rgba(37,211,102,.35); }
      .wa-told { margin-top:6px;display:inline-flex;align-items:center;gap:4px;font-family:'Inter',sans-serif;font-size:11px;font-weight:500;color:#1e9e50; }
      .pc-name { display:flex;align-items:center;gap:8px;min-width:0; }
      .pc-name span:last-child { font-family:'Inter',sans-serif;font-size:14px;font-weight:600;color:#1a120b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
      .pc-code { flex-shrink:0;font-family:'Inter',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.06em;color:#9C1A4D;background:rgba(156,26,77,0.08);padding:2px 6px;border-radius:4px; }
      .pc-link { background:none;border:none;padding:0 2px;cursor:pointer;font:inherit;font-weight:600;color:#9C1A4D;text-decoration:underline;text-underline-offset:2px;border-radius:3px; }
      .pc-link:hover { color:#7D1540; }
      .pc-link:focus-visible { outline:2px solid #9C1A4D;outline-offset:2px; }

      /* Progress track: Waiting → Ready → Picked up */
      .st { display:flex;align-items:center;gap:6px;font-family:'Inter',sans-serif;font-size:12px;--tone:#9C1A4D; }
      .st.tone-ready { --tone:#2f8a4a; }
      .st.tone-done  { --tone:#a89582; }
      .st-step { display:flex;align-items:center;gap:6px;color:#b8aa9a;white-space:nowrap; }
      .st-dot { width:10px;height:10px;border-radius:50%;border:2px solid #ddd3c7;background:#fff;flex-shrink:0; }
      .st-step.past .st-dot { background:var(--tone);border-color:var(--tone); }
      .st-step.past { color:#8a7560; }
      .st-step.now .st-dot { background:var(--tone);border-color:var(--tone);box-shadow:0 0 0 3px color-mix(in srgb, var(--tone) 22%, transparent); }
      .st-step.now { color:var(--tone);font-weight:700; }
      .st-line { width:20px;height:2px;border-radius:2px;background:#e6ddd2;flex-shrink:0; }
      .st-line.past { background:var(--tone); }

      /* Next-step buttons */
      .act {
        justify-self:end;display:inline-flex;align-items:center;justify-content:center;gap:7px;min-width:150px;
        padding:9px 16px;border-radius:999px;cursor:pointer;
        font-family:'Inter',sans-serif;font-size:13px;font-weight:600;letter-spacing:0.005em;
        transition:transform .18s cubic-bezier(.34,1.56,.64,1);
      }
      .act:active:not(:disabled) { transform:scale(.96); }
      .act:focus-visible { outline:2px solid #9C1A4D;outline-offset:3px; }
      .act:disabled { cursor:progress;opacity:.6; }
      .act-ready { background:#2f8a4a;color:#fff;border:1px solid #2f8a4a;box-shadow:0 1px 2px rgba(47,138,74,.25),0 4px 12px rgba(47,138,74,.22); }
      .act-ready:hover:not(:disabled) { background:#277a40;border-color:#277a40; }
      .act-pickup { background:#fff;color:#4a3a2c;border:1px solid #d8cdc0;box-shadow:0 1px 2px rgba(45,31,20,.06); }
      .act-pickup:hover:not(:disabled) { background:#f7f2ec;border-color:#c4b5a4; }
      .act.act-sm { min-width:0;padding:6px 13px;font-size:12px;gap:6px; }
      .act-done { justify-self:end;display:inline-flex;align-items:center;gap:6px;font-family:'Inter',sans-serif;font-size:12px;color:#a09080;padding-right:4px;white-space:nowrap; }


      /* Undo toast */
      .ck-toast {
        position:fixed;left:calc(50% + 36px);bottom:24px;z-index:200;
        display:flex;align-items:center;gap:4px;max-width:calc(100vw - 120px);
        padding:8px 8px 8px 18px;border-radius:14px;background:#2b1a14;color:#fff;
        font-family:'Inter',sans-serif;font-size:13.5px;font-weight:500;
        box-shadow:0 12px 32px rgba(43,26,20,.28),0 2px 6px rgba(43,26,20,.18);
        opacity:0;transform:translate(-50%,16px) scale(.98);pointer-events:none;
        transition:opacity .18s ease,transform .38s cubic-bezier(.34,1.56,.64,1);
      }
      .ck-toast.show { opacity:1;transform:translate(-50%,0) scale(1);pointer-events:auto; }
      .ck-toast.error { background:#7a1f2b; }
      .ck-toast-text { padding-right:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
      .ck-toast-btn {
        border:none;background:transparent;color:#f6d6e2;border-radius:9px;padding:7px 11px;cursor:pointer;
        font-family:'Inter',sans-serif;font-size:13px;font-weight:600;white-space:nowrap;
        transition:transform .18s cubic-bezier(.34,1.56,.64,1);
      }
      .ck-toast-btn:hover { background:rgba(255,255,255,.1); }
      .ck-toast-btn:active { transform:scale(.95); }
      .ck-toast-btn:focus-visible { outline:2px solid #fff;outline-offset:1px; }
      .ck-toast-btn.wa { background:#25D366;color:#fff; }
      .ck-toast-btn.wa:hover { background:#1ebe5a; }
      .ck-toast-x { color:rgba(255,255,255,.55);font-size:16px;padding:5px 9px; }

      /* "Did it go out?" — inline in the order row and strip */
      .wa-ask { margin-top:6px;display:inline-flex;align-items:center;gap:4px;font-family:'Inter',sans-serif;font-size:11px;font-weight:600;color:#8a5a00; }
      .ask-chip {
        width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;
        border:1px solid #d8cdc0;background:#fff;color:#5a4a3a;font-size:12px;line-height:1;
        transition:transform .18s cubic-bezier(.34,1.56,.64,1);
      }
      .ask-chip.yes { border-color:#2f8a4a;color:#2f8a4a; }
      .ask-chip.yes:hover { background:#2f8a4a;color:#fff; }
      .ask-chip.no:hover { background:#f6e9ec;border-color:#b0485f;color:#9C1A4D; }
      .ask-chip.check { color:#2D7CAD;border-color:#b9d5e8;font-weight:700;font-size:13px; }
      .ask-chip.check:hover { background:#2D7CAD;border-color:#2D7CAD;color:#fff; }
      .ask-btn.check { color:#2D7CAD;border-color:#b9d5e8; }
      .ask-btn.check:hover { background:#eaf3f9; }
      .ask-btn.check b { font-size:14px;line-height:1; }
      .wa-ask-when { font-weight:500;color:#a08850;margin-left:2px; }
      .tray-item .when { color:#a08850;font-size:12px;white-space:nowrap; }
      .ask-chip:active { transform:scale(.9); }
      .ask-chip:focus-visible { outline:2px solid #9C1A4D;outline-offset:2px; }
      .ord-strip.pending { background:#fff8e8;border:1px solid #f0d9a4;color:#6b4e12; }
      .ask-btn {
        display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:999px;cursor:pointer;
        font-family:'Inter',sans-serif;font-size:13px;font-weight:600;border:1px solid #d8cdc0;background:#fff;color:#5a4a3a;
        transition:transform .18s cubic-bezier(.34,1.56,.64,1);
      }
      .ask-btn.yes { background:#2f8a4a;border-color:#2f8a4a;color:#fff; }
      .ask-btn.yes:hover { background:#277a40; }
      .ask-btn:not(.yes):hover { background:#f7f2ec; }
      .ask-btn:active { transform:scale(.96); }
      .ask-btn:focus-visible { outline:2px solid #9C1A4D;outline-offset:2px; }
      .wa-issue { margin-top:5px;font-family:'Inter',sans-serif;font-size:11px;font-weight:500;color:#b0485f; }
      .wa-issue-line { display:block;margin-top:2px;font-size:12px;color:#a2384f;font-weight:500; }

      /* Tray of chats waiting for a "sent?" answer */
      .wa-tray {
        position:fixed;left:calc(50% + 36px);bottom:24px;z-index:190;transform:translateX(-50%);
        display:flex;flex-direction:column;gap:6px;min-width:360px;max-width:calc(100vw - 120px);
        padding:10px 10px 10px 16px;border-radius:16px;background:#fff;border:1px solid #f0d9a4;
        box-shadow:0 12px 32px rgba(107,78,18,.18),0 2px 6px rgba(107,78,18,.10);
        font-family:'Inter',sans-serif;font-size:13.5px;color:#4a3a2c;
      }
      .wa-tray[hidden] { display:none; }
      .wa-tray.nudge { animation:tray-nudge .55s cubic-bezier(.34,1.56,.64,1); }
      @keyframes tray-nudge { 0% { transform:translateX(-50%) scale(1); } 40% { transform:translateX(-50%) scale(1.04) translateY(-4px); } 100% { transform:translateX(-50%) scale(1); } }
      .tray-row { display:flex;align-items:center;gap:8px; }
      .tray-row > svg { color:#c08a1e;flex-shrink:0; }
      .tray-text { flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
      .tray-list { display:flex;flex-direction:column;gap:2px;border-top:1px solid #f3ead8;padding-top:6px;max-height:220px;overflow-y:auto; }
      .tray-item { display:flex;align-items:center;gap:8px;padding:4px 2px;font-size:13px; }
      .tray-item .num { font-weight:700;color:#9C1A4D;min-width:42px; }
      .tray-item .who { flex:1;color:#5a4a3a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
      .wa-tray:not([hidden]) ~ .ck-toast { bottom:96px; }

      /* "Why didn't it go out?" */
      .why-backdrop { position:fixed;inset:0;z-index:250;background:rgba(26,18,11,.35);display:flex;align-items:center;justify-content:center;padding:16px; }
      .why-backdrop[hidden] { display:none; }
      .why-card {
        width:100%;max-width:400px;background:#fff;border-radius:16px;padding:22px 22px 18px;font-family:'Inter',sans-serif;
        box-shadow:0 20px 50px rgba(45,31,20,.25),0 4px 12px rgba(45,31,20,.12);
      }
      .why-card h3 { font-size:17px;font-weight:700;color:#1a120b;margin:0 0 2px; }
      .why-sub { font-size:13px;color:#8a7560;margin:0 0 16px; }
      .why-chips { display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px; }
      .why-chip {
        padding:8px 13px;border-radius:999px;border:1px solid #e0d6ca;background:#faf7f4;color:#4a3a2c;cursor:pointer;
        font-family:'Inter',sans-serif;font-size:13px;font-weight:500;transition:transform .18s cubic-bezier(.34,1.56,.64,1);
      }
      .why-chip:hover { border-color:#9C1A4D;color:#9C1A4D;background:#fff; }
      .why-chip:active { transform:scale(.95); }
      .why-chip:focus-visible { outline:2px solid #9C1A4D;outline-offset:2px; }
      .why-other { display:flex;gap:8px; }
      .why-other input {
        flex:1;padding:9px 12px;border:1px solid #e0d8cf;border-radius:10px;font-family:'Inter',sans-serif;font-size:13px;color:#1a120b;outline:none;
      }
      .why-other input:focus { border-color:#9C1A4D;box-shadow:0 0 0 3px rgba(156,26,77,.12); }
      .why-save { padding:9px 16px;border-radius:10px;border:none;background:#9C1A4D;color:#fff;font-family:'Inter',sans-serif;font-size:13px;font-weight:600;cursor:pointer; }
      .why-save:disabled { opacity:.4;cursor:not-allowed; }
      .why-save:not(:disabled):hover { background:#7D1540; }
      .why-save:focus-visible { outline:2px solid #9C1A4D;outline-offset:2px; }
      .why-cancel { margin-top:12px;background:none;border:none;color:#8a7560;font-family:'Inter',sans-serif;font-size:12px;cursor:pointer;padding:2px; }
      .why-cancel:hover { color:#1a120b; }

      /* Containers (where a ready piece is kept) */
      .pc-box, .ord-box {
        display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:7px;cursor:pointer;
        font-family:'Inter',sans-serif;font-size:12px;font-weight:600;color:#6b4e12;
        background:#fbf3e2;border:1px solid #ecd9ad;transition:transform .18s cubic-bezier(.34,1.56,.64,1);
      }
      .pc-box:hover, .ord-box:hover { background:#f6e7c6; }
      .pc-box:active, .ord-box:active { transform:scale(.95); }
      .pc-box:focus-visible, .ord-box:focus-visible { outline:2px solid #9C1A4D;outline-offset:2px; }
      .pc-box.none, .ord-box.none { background:#fff;border-style:dashed;color:#b45309;font-weight:500; }
      .ord-box { margin-top:6px;font-size:11px;padding:2px 8px; }
      .cont-pop {
        position:fixed;z-index:260;width:300px;padding:14px;border-radius:14px;background:#fff;border:1px solid #ece4da;
        box-shadow:0 16px 40px rgba(45,31,20,.22),0 3px 10px rgba(45,31,20,.10);font-family:'Inter',sans-serif;
      }
      .cont-pop[hidden] { display:none; }
      .cp-head { display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;font-size:13px;font-weight:700;color:#1a120b; }
      .cp-x { background:none;border:none;font-size:18px;line-height:1;color:#8a7560;cursor:pointer;padding:2px 6px;border-radius:6px; }
      .cp-x:hover { background:#f5f0eb; }
      .cp-chips { display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px; }
      .cp-chip {
        min-width:38px;height:36px;padding:0 10px;border-radius:9px;border:1px solid #e0d6ca;background:#faf7f4;cursor:pointer;
        font-family:'Inter',sans-serif;font-size:14px;font-weight:700;color:#4a3a2c;transition:transform .18s cubic-bezier(.34,1.56,.64,1);
      }
      .cp-chip:hover { border-color:#9C1A4D;color:#9C1A4D;background:#fff; }
      .cp-chip:active { transform:scale(.92); }
      .cp-chip:focus-visible, .cp-x:focus-visible { outline:2px solid #9C1A4D;outline-offset:2px; }
      .cp-chip.suggested { border-color:#2f8a4a;background:#e9f6ee;color:#1f6b38; }
      .cp-chip.current { background:#9C1A4D;border-color:#9C1A4D;color:#fff; }
      .cp-other { display:flex;gap:6px; }
      .cp-other input { flex:1;min-width:0;padding:7px 10px;border:1px solid #e0d8cf;border-radius:9px;font-family:'Inter',sans-serif;font-size:13px;outline:none; }
      .cp-other input:focus { border-color:#9C1A4D;box-shadow:0 0 0 3px rgba(156,26,77,.12); }
      .cp-other button { padding:7px 12px;border-radius:9px;border:none;background:#9C1A4D;color:#fff;font-weight:600;font-size:12px;cursor:pointer; }
      .cp-other button:disabled { opacity:.4;cursor:not-allowed; }
      .cp-hint { margin-top:8px;font-size:11.5px;color:#8a7560; }

      @media (prefers-reduced-motion: reduce) {
        .pc-box, .ord-box, .cp-chip { transition:none; }
        .wa-tray.nudge { animation:none; }
        .ask-chip, .ask-btn, .why-chip { transition:none; }
        .act, .ck-toast, .ck-toast-btn, .wa-btn { transition:none; }
      }
    </style>

    <svg style="position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;opacity:0.04;" xmlns="http://www.w3.org/2000/svg">
      <filter id="ck-noise-orders">
        <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch"/>
        <feColorMatrix type="saturate" values="0"/>
      </filter>
      <rect width="100%" height="100%" filter="url(#ck-noise-orders)"/>
    </svg>
    <div style="position:fixed;top:0;right:0;width:600px;height:400px;background:radial-gradient(ellipse at top right,rgba(156,26,77,0.08),transparent);pointer-events:none;z-index:0;"></div>

    <div style="padding:40px 40px 140px;position:relative;z-index:1;">

      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;">
        <div>
          <h1 style="font-family:'Caveat',cursive;font-size:42px;font-weight:700;letter-spacing:-0.01em;color:#1a120b;margin-bottom:4px;">Orders</h1>
          <p style="font-family:'Inter',sans-serif;color:#8a7560;font-size:15px;line-height:1.7;">Track customer orders and each object through its lifecycle.</p>
        </div>
        <button id="btn-add-order" style="
          flex-shrink:0;margin-top:4px;
          background:#9C1A4D;color:#fff;border:none;cursor:pointer;
          font-family:'Inter',sans-serif;font-size:14px;font-weight:500;
          padding:10px 18px;border-radius:8px;letter-spacing:0.01em;
          box-shadow:0 2px 8px rgba(156,26,77,0.3);
          transition:background 0.15s ease,box-shadow 0.15s ease;
        "
          onmouseover="this.style.background='#7D1540';this.style.boxShadow='0 2px 12px rgba(156,26,77,0.4)'"
          onmouseout="this.style.background='#9C1A4D';this.style.boxShadow='0 2px 8px rgba(156,26,77,0.3)'"
        >+ New Order</button>
      </div>

      <div id="ord-filters" class="fbar"></div>

      <div style="background:#fff;border-radius:14px;border:1px solid #e8e1d8;overflow:hidden;box-shadow:0 2px 6px rgba(45,31,20,0.08),0 8px 24px rgba(45,31,20,0.05);">
        <div style="display:grid;grid-template-columns:28px 60px minmax(0,2fr) minmax(0,2fr) 190px 110px 176px;padding:10px 20px;background:#f5f0eb;border-bottom:1px solid #e8e1d8;">
          ${['','#','Customer','Objects','Status','Date In',''].map(h => `
            <div style="font-family:'Inter',sans-serif;font-size:11px;font-weight:600;color:#8a7560;text-transform:uppercase;letter-spacing:0.06em;">${h}</div>
          `).join('')}
        </div>
        <div id="orders-body">${skeletonRows()}</div>
      </div>

      <div id="orders-pagination"></div>

    </div>

    <!-- Add Order Modal -->
    <div id="ord-modal-backdrop" style="
      display:none;position:fixed;inset:0;
      background:rgba(26,18,11,0.4);z-index:100;
      align-items:center;justify-content:center;
    ">
      <div style="
        background:#fff;border-radius:12px;padding:32px;
        width:100%;max-width:480px;position:relative;margin:16px;
        box-shadow:0 8px 40px rgba(45,31,20,0.18);
        max-height:calc(100vh - 32px);overflow-y:auto;
      ">
        <button id="ord-modal-close" style="
          position:absolute;top:16px;right:16px;
          background:none;border:none;cursor:pointer;
          font-size:20px;color:#8a7560;line-height:1;
          width:28px;height:28px;display:flex;align-items:center;justify-content:center;
          border-radius:6px;transition:background 0.15s;
        "
          onmouseover="this.style.background='#f0ebe4'"
          onmouseout="this.style.background='none'"
        >×</button>

        <div id="ord-modal-title" style="margin-bottom:24px;">
          <h2 style="font-family:'Inter',sans-serif;font-size:22px;font-weight:700;color:#1a120b;margin:0 0 4px;">New Order</h2>
          <p style="font-family:'Inter',sans-serif;font-size:13px;color:#8a7560;margin:0;">One customer visit — add all their objects below.</p>
        </div>

        <div id="ord-success-panel" style="display:none;text-align:center;padding:8px 0 16px;">
          <div style="
            display:inline-flex;align-items:center;justify-content:center;
            width:72px;height:72px;border-radius:50%;
            background:rgba(156,26,77,0.08);margin-bottom:20px;
          ">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9C1A4D" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <p style="font-family:'Inter',sans-serif;font-size:14px;color:#5a4a3a;margin-bottom:12px;">Order added! Write this number on every piece:</p>
          <div id="ord-success-numbers" style="
            font-family:'Caveat',cursive;font-size:60px;font-weight:700;
            color:#9C1A4D;line-height:1.1;margin-bottom:24px;letter-spacing:-0.01em;
          "></div>
          <div id="ord-success-warning" style="display:none;font-family:'Inter',sans-serif;font-size:13px;color:#b45309;
            background:rgba(217,119,6,0.08);border-radius:8px;padding:10px 12px;margin-bottom:20px;line-height:1.5;"></div>
          <div style="display:flex;gap:10px;justify-content:center;">
            <button id="ord-success-close" style="
              padding:10px 20px;background:#9C1A4D;color:#fff;border:none;cursor:pointer;
              font-family:'Inter',sans-serif;font-size:14px;font-weight:600;border-radius:8px;
              box-shadow:0 2px 8px rgba(156,26,77,0.3);transition:background 0.15s;
            "
              onmouseover="this.style.background='#7D1540'"
              onmouseout="this.style.background='#9C1A4D'"
            >Done</button>
            <button id="ord-success-another" style="
              padding:10px 20px;background:#fff;color:#5a4a3a;border:1px solid #e0d8cf;cursor:pointer;
              font-family:'Inter',sans-serif;font-size:14px;font-weight:500;border-radius:8px;
              transition:background 0.15s,border-color 0.15s;
            "
              onmouseover="this.style.background='#f5f0eb'"
              onmouseout="this.style.background='#fff'"
            >Add Another Order</button>
          </div>
        </div>

        <form id="add-order-form" autocomplete="off">

          <div style="margin-bottom:8px;">
            <label style="display:block;font-size:13px;font-weight:500;color:#5a4a3a;margin-bottom:6px;">Customer <span style="color:#9C1A4D">*</span></label>
            <select name="customer_id" required style="width:100%;padding:10px 14px;font-family:'Inter',sans-serif;font-size:14px;border:1px solid #e0d8cf;border-radius:10px;outline:none;color:#1a120b;transition:border-color 0.15s;"
              onfocus="this.style.borderColor='#9C1A4D'"
              onblur="this.style.borderColor='#e0d8cf'"
            >
              <option value="">Select customer…</option>
            </select>
            <div style="display:flex;justify-content:flex-end;margin-top:6px;">
              <button type="button" id="btn-toggle-new-cust" style="
                background:none;border:none;cursor:pointer;
                font-family:'Inter',sans-serif;font-size:12px;font-weight:500;
                color:#9C1A4D;padding:2px 0;letter-spacing:0.01em;
                text-decoration:underline;text-underline-offset:2px;
              ">+ New customer</button>
            </div>
          </div>

          <div id="new-cust-section" style="display:none;margin-bottom:16px;">
            <div style="border:1px solid #e0d8cf;border-radius:10px;padding:16px;background:#faf7f4;">
              <div style="font-family:'Inter',sans-serif;font-size:11px;font-weight:700;color:#8a7560;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:12px;">New Customer</div>
              <div id="new-cust-dupe-notice" style="display:none;align-items:flex-start;gap:8px;background:rgba(156,26,77,0.06);border:1px solid rgba(156,26,77,0.2);border-radius:8px;padding:10px 12px;margin-bottom:12px;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9C1A4D" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <div id="new-cust-dupe-text" style="font-family:'Inter',sans-serif;font-size:13px;color:#7D1540;line-height:1.5;"></div>
              </div>
              <div style="margin-bottom:10px;">
                <label style="display:block;font-size:12px;font-weight:500;color:#5a4a3a;margin-bottom:4px;">Name <span style="color:#9C1A4D">*</span></label>
                <input id="new-cust-name" type="text" placeholder="Full name" style="width:100%;box-sizing:border-box;padding:9px 12px;font-family:'Inter',sans-serif;font-size:13px;border:1px solid #e0d8cf;border-radius:8px;outline:none;color:#1a120b;transition:border-color 0.15s;"
                  onfocus="this.style.borderColor='#9C1A4D'" onblur="this.style.borderColor='#e0d8cf'"/>
              </div>
              <div style="margin-bottom:10px;">
                <label style="display:block;font-size:12px;font-weight:500;color:#5a4a3a;margin-bottom:4px;">Phone <span style="color:#9C1A4D">*</span></label>
                <input id="new-cust-phone" type="tel" placeholder="+972…" style="width:100%;box-sizing:border-box;padding:9px 12px;font-family:'Inter',sans-serif;font-size:13px;border:1px solid #e0d8cf;border-radius:8px;outline:none;color:#1a120b;transition:border-color 0.15s;"
                  onfocus="this.style.borderColor='#9C1A4D'" onblur="this.style.borderColor='#e0d8cf'"/>
              </div>
              <div style="margin-bottom:12px;">
                <label style="display:block;font-size:12px;font-weight:500;color:#5a4a3a;margin-bottom:4px;">Notes <span style="font-weight:400;color:#8a7560;">(optional)</span></label>
                <input id="new-cust-notes-input" type="text" placeholder="Optional notes" style="width:100%;box-sizing:border-box;padding:9px 12px;font-family:'Inter',sans-serif;font-size:13px;border:1px solid #e0d8cf;border-radius:8px;outline:none;color:#1a120b;transition:border-color 0.15s;"
                  onfocus="this.style.borderColor='#9C1A4D'" onblur="this.style.borderColor='#e0d8cf'"/>
              </div>
              <div id="new-cust-error" style="display:none;color:#b94040;font-size:12px;margin-bottom:10px;"></div>
              <button type="button" id="btn-create-customer" style="
                width:100%;padding:9px;background:#9C1A4D;color:#fff;border:none;cursor:pointer;
                font-family:'Inter',sans-serif;font-size:13px;font-weight:600;
                border-radius:8px;box-shadow:0 2px 6px rgba(156,26,77,0.25);transition:background 0.15s;
              " onmouseover="this.style.background='#7D1540'" onmouseout="this.style.background='#9C1A4D'">Create Customer</button>
            </div>
          </div>

          <div style="margin-bottom:16px;">
            <label style="display:block;font-size:13px;font-weight:500;color:#5a4a3a;margin-bottom:6px;">Date In <span style="color:#9C1A4D">*</span></label>
            <input name="received_at" type="date" required style="width:100%;padding:10px 14px;font-family:'Inter',sans-serif;font-size:14px;border:1px solid #e0d8cf;border-radius:10px;outline:none;color:#1a120b;transition:border-color 0.15s;"
              onfocus="this.style.borderColor='#9C1A4D'" onblur="this.style.borderColor='#e0d8cf'"/>
          </div>

          <div style="margin-bottom:16px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
              <label style="font-size:13px;font-weight:500;color:#5a4a3a;">Objects <span style="color:#9C1A4D">*</span></label>
              <span style="font-family:'Inter',sans-serif;font-size:11px;color:#8a7560;">Add one or more</span>
            </div>
            <div id="items-container"></div>
            <button type="button" id="btn-add-item" style="
              margin-top:8px;width:100%;padding:9px;
              border:1px dashed #d0c8bf;border-radius:8px;
              background:none;cursor:pointer;
              font-family:'Inter',sans-serif;font-size:13px;font-weight:500;color:#8a7560;
              transition:border-color 0.15s,color 0.15s,background 0.15s;
            "
              onmouseover="this.style.borderColor='#9C1A4D';this.style.color='#9C1A4D';this.style.background='rgba(156,26,77,0.03)'"
              onmouseout="this.style.borderColor='#d0c8bf';this.style.color='#8a7560';this.style.background='none'"
            >+ Add another object</button>
          </div>

          <div style="margin-bottom:24px;">
            <label style="display:block;font-size:13px;font-weight:500;color:#5a4a3a;margin-bottom:6px;">Order Notes <span style="font-weight:400;color:#8a7560">(optional)</span></label>
            <textarea name="notes" rows="2" placeholder="Any notes about this order…" style="width:100%;padding:10px 14px;font-family:'Inter',sans-serif;font-size:14px;border:1px solid #e0d8cf;border-radius:10px;outline:none;color:#1a120b;resize:vertical;transition:border-color 0.15s;"
              onfocus="this.style.borderColor='#9C1A4D'" onblur="this.style.borderColor='#e0d8cf'"></textarea>
          </div>

          <div id="ord-form-error" style="display:none;color:#b94040;font-size:13px;margin-bottom:12px;"></div>

          <button type="submit" id="ord-btn-submit" style="
            width:100%;padding:12px;background:#9C1A4D;color:#fff;border:none;cursor:pointer;
            font-family:'Inter',sans-serif;font-size:14px;font-weight:600;letter-spacing:0.01em;
            border-radius:8px;box-shadow:0 2px 8px rgba(156,26,77,0.3);
            transition:background 0.15s ease;
          " onmouseover="this.style.background='#7D1540'" onmouseout="this.style.background='#9C1A4D'">Create Order</button>
        </form>
      </div>
    </div>

    <div id="wa-tray" class="wa-tray" role="region" aria-label="WhatsApp messages to confirm" hidden></div>
    <div id="ord-toast" class="ck-toast" role="status" aria-live="polite"></div>
    <div id="cont-pop" class="cont-pop" role="dialog" aria-label="Choose a container" hidden></div>

    <div id="why-backdrop" class="why-backdrop" hidden>
      <div class="why-card" role="dialog" aria-modal="true" aria-labelledby="why-title">
        <h3 id="why-title">Why didn't it go out?</h3>
        <p class="why-sub" id="why-sub"></p>
        <div class="why-chips" id="why-chips"></div>
        <form class="why-other" id="why-form">
          <input id="why-input" type="text" maxlength="120" placeholder="Other reason…" autocomplete="off" />
          <button type="submit" class="why-save" id="why-save" disabled>Save</button>
        </form>
        <button type="button" class="why-cancel" id="why-cancel">Cancel — I'll decide later</button>
      </div>
    </div>
  `;
}

function skeletonRows() {
  return [1, 2, 3].map(() => `
    <div style="display:grid;grid-template-columns:28px 60px minmax(0,2fr) minmax(0,2fr) 190px 110px 176px;padding:16px 20px;border-bottom:1px solid #f5f0eb;align-items:center;gap:8px;">
      <span class="ck-skel" style="width:12px;height:12px;border-radius:2px;"></span>
      <span class="ck-skel" style="width:36px;height:20px;border-radius:6px;"></span>
      <span class="ck-skel" style="width:130px;height:13px;border-radius:3px;"></span>
      <span class="ck-skel" style="width:100px;height:13px;border-radius:3px;"></span>
      <span class="ck-skel" style="width:120px;height:20px;border-radius:999px;"></span>
      <span class="ck-skel" style="width:80px;height:13px;border-radius:3px;"></span>
      <span class="ck-skel" style="width:130px;height:30px;border-radius:999px;justify-self:end;"></span>
    </div>
  `).join('');
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

export async function mount(el, signal) {
  pageSignal  = signal;
  currentPage = 1;
  filters     = { ...FILTER_DEFAULTS };
  expandedIds = new Set();
  savingIds   = new Set();
  await Promise.all([loadObjectTypes(), loadCustomers(), loadSettings({ fresh: true })]);
  if (!settings().confirmSent) pendingWa.clear();
  if (signal.aborted) return;
  renderFilters(el, signal);
  wireModal(el, signal);
  wireWhyDialog(el, signal);
  loadWaReasons();
  if (settings().confirmSent) loadPendingWa(el);
  // Coming back from WhatsApp: draw the eye to the chats waiting for an answer
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !pendingWa.size) return;
    const tray = el.querySelector('#wa-tray');
    tray?.classList.remove('nudge');
    void tray?.offsetWidth; // restart the animation
    tray?.classList.add('nudge');
  }, { signal });
  await loadOrders(el);
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function loadObjectTypes() {
  const { data, error } = await supabase
    .from('object_types')
    .select('id, name, code, raw_stock')
    .order('name');
  if (error) logEvent('error', `Couldn't load object types for orders: ${error.message}`);
  allObjectTypes = data ?? [];
}

async function loadCustomers() {
  const { data, error } = await fetchAllRows(() => supabase
    .from('customers')
    .select('id, name, phone')
    .order('name')
    .order('id'));
  if (error) logEvent('error', `Couldn't load customers for orders: ${error.message}`);
  allCustomers = data ?? [];
}

async function loadOrders(el) {
  const body = el.querySelector('#orders-body');
  body.innerHTML = skeletonRows();

  const from = (currentPage - 1) * pageSize;

  // 1. Which orders: filtered, sorted and paged in the database (order_list view)
  let query = supabase.from('order_list').select('id', { count: 'exact' });
  const q = filters.q.trim();
  if (q) {
    const num = q.replace(/^#/, '');
    const like = pgQuote(`%${q}%`);
    // 1–4 digits (optionally "#12") = order number; longer digit strings = part of a phone number
    if (/^\d{1,4}$/.test(num))      query = query.eq('order_number', Number(num));
    else if (/^[\d\s-]+$/.test(q)) query = query.ilike('customer_phone', `%${q.replace(/\D/g, '')}%`);
    else                            query = query.or(`customer_name.ilike.${like},customer_phone.ilike.${like}`);
  }
  if (filters.stage === 'open')            query = query.in('stage', ['waiting', 'ready']);
  else if (filters.stage !== 'all')        query = query.eq('stage', filters.stage);
  if (filters.wa === 'to_tell')            query = query.eq('stage', 'ready').gt('ready_untold', 0);
  if (filters.wa === 'told')               query = query.eq('stage', 'ready').eq('ready_untold', 0);
  if (filters.type)                        query = query.ilike('codes', `% ${filters.type} %`);
  if (filters.container)                   query = query.ilike('containers', `% ${filters.container} %`);
  if (filters.from)                        query = query.gte('received_at', filters.from);
  if (filters.to)                          query = query.lt('received_at', nextDay(filters.to));
  const asc = filters.sort === 'oldest';
  query = query
    .order('received_at', { ascending: asc })
    .order('created_at', { ascending: asc }) // same day: order of entry (numbers restart after 999)
    .range(from, from + pageSize - 1);

  const seq = ++loadSeq;
  const { data: page, error: pageError, count } = await query;
  if (seq !== loadSeq || pageSignal?.aborted) return;

  // 2. Those orders in full, with customer and pieces
  let data = [], error = pageError;
  if (!error && page?.length) {
    const res = await supabase
      .from('orders')
      .select(`id, order_number, received_at, notes,
               customers(id, name, phone),
               objects(id, status, notified_at, picked_up_at, container, object_types(id, name, code))`)
      .in('id', page.map(r => r.id));
    if (seq !== loadSeq || pageSignal?.aborted) return;
    error = res.error;
    const byId = new Map((res.data ?? []).map(o => [o.id, o]));
    data = page.map(r => byId.get(r.id)).filter(Boolean);
  }

  if (error) {
    logEvent('error', `Couldn't load orders: ${error.message}`);
    body.innerHTML = `
      <div style="padding:32px 20px;text-align:center;font-family:'Inter',sans-serif;font-size:14px;color:#8a7560;">
        Couldn't load orders. Refresh the page to try again.
      </div>`;
    return;
  }

  allOrders  = data ?? [];
  loadWaIssues(el); // fills in "not sent" reasons, then re-renders
  totalCount = count ?? 0;
  renderOrders(el, allOrders);
  renderPagination(el);
}

// ─── Render rows ──────────────────────────────────────────────────────────────

function renderOrders(el, orders) {
  const body = el.querySelector('#orders-body');
  renderTray(el);

  if (orders.length === 0) {
    const filtered = activeCount(filters, FILTER_DEFAULTS) > 0;
    body.innerHTML = `
      <div style="padding:48px 20px;text-align:center;font-family:'Inter',sans-serif;font-size:14px;color:#8a7560;">
        ${filtered ? 'No orders match these filters.' : 'No orders yet. Use “+ New Order” to add the first one.'}
      </div>`;
    return;
  }

  body.innerHTML = orders.map((o, i) => buildOrderBlock(o, i === orders.length - 1)).join('');
  wireExpandToggles(el);
  wireStatusButtons(el);
  wireWhatsAppButtons(el);
}

function buildOrderBlock(order, isLast) {
  const customer  = order.customers;
  const items     = order.objects ?? [];
  const isExpanded = expandedIds.has(order.id);

  const counts = { received: 0, ready: 0, picked_up: 0 };
  items.forEach(item => { counts[item.status] = (counts[item.status] || 0) + 1; });

  const dateIn = fmtDate(order.received_at) || '—';
  const ordNum = fmtNum(order.order_number);

  const codes = items
    .map(i => i.object_types?.code || i.object_types?.name || '?')
    .join(', ');
  const itemsSummary = items.length === 0
    ? 'No objects'
    : `${items.length} object${items.length !== 1 ? 's' : ''}${codes ? ': ' + codes : ''}`;

  let statusBadges = '';
  if (counts.received) statusBadges += `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:500;background:rgba(156,26,77,0.10);color:#9C1A4D;margin-right:4px;">${counts.received} waiting</span>`;
  if (counts.ready)    statusBadges += `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:500;background:rgba(47,138,74,0.12);color:#2f8a4a;margin-right:4px;">${counts.ready} ready</span>`;
  if (counts.picked_up) statusBadges += `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:500;background:#ede8e2;color:#8a7560;margin-right:4px;">${counts.picked_up} picked up</span>`;

  const allPickedUp = items.length > 0 && items.every(i => i.status === 'picked_up');
  const wa          = whatsAppState(order);
  const oid = escHtml(order.id);
  let sendButton = '';
  if (wa.state === 'to_send') {
    sendButton = `<button type="button" class="wa-btn small wa-send-order" data-order-id="${oid}">${ICON_WA} Send WhatsApp</button>` +
      (wa.issue ? `<div class="wa-issue">Not sent: ${escHtml(wa.issue.reason)}</div>` : '');
  } else if (wa.state === 'pending') {
    sendButton = `<span class="wa-ask">Sent?
      <button type="button" class="ask-chip check wa-check" data-order-id="${oid}" aria-label="Open the chat to check" title="Open the chat to check">?</button>
      <button type="button" class="ask-chip yes wa-yes" data-order-id="${oid}" aria-label="Yes, the message was sent" title="Yes, sent">✓</button>
      <button type="button" class="ask-chip no wa-no" data-order-id="${oid}" aria-label="No, it wasn't sent" title="Not sent">✕</button></span>
      <div class="wa-ask-when" style="font-family:'Inter',sans-serif;font-size:11px;margin-top:3px;">opened ${escHtml(fmtWhen(pendingWa.get(order.id)?.openedAt))}</div>`;
  } else if (wa.state === 'sent') {
    sendButton = `<span class="wa-told">${ICON_CHECK_SM} Told ${escHtml(fmtShortDate(wa.sentAt))}</span>`;
  }

  const expandedSection = isExpanded ? buildItemsSection(order) : '';

  const chevron = isExpanded
    ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9C1A4D" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`
    : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#b0a090" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>`;

  const borderBottom = isLast && !isExpanded ? 'none' : '1px solid #f5f0eb';

  return `
    <div>
      <div class="order-header-row" data-order-id="${escHtml(order.id)}" style="
        display:grid;grid-template-columns:28px 60px minmax(0,2fr) minmax(0,2fr) 190px 110px 176px;
        padding:14px 20px;border-bottom:${borderBottom};
        align-items:start;background:#fff;cursor:pointer;
        ${allPickedUp ? 'opacity:0.55;' : ''}
      ">
        <div style="display:flex;align-items:center;padding-top:2px;">${chevron}</div>
        <div style="font-family:'Inter',sans-serif;font-size:12px;font-weight:700;color:#9C1A4D;letter-spacing:0.02em;padding-top:2px;">${escHtml(ordNum)}</div>
        <div style="overflow:hidden;">
          <div style="font-family:'Inter',sans-serif;font-size:14px;font-weight:600;color:#1a120b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(customer?.name ?? '—')}</div>
          ${order.notes ? `<div style="font-family:'Inter',sans-serif;font-size:12px;color:#a09080;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;">${escHtml(order.notes)}</div>` : ''}
        </div>
        <div style="font-family:'Inter',sans-serif;font-size:13px;color:#5a4a3a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-top:2px;">${escHtml(itemsSummary)}</div>
        <div style="padding-top:2px;">
          <div style="display:flex;flex-wrap:wrap;gap:2px;">${statusBadges || '<span style="font-size:12px;color:#b0a090;font-style:italic;font-family:Inter,sans-serif;">—</span>'}</div>
          ${buildOrderBox(order)}
          ${sendButton}
        </div>
        <div style="font-family:'Inter',sans-serif;font-size:13px;color:#8a7560;padding-top:2px;">${escHtml(dateIn)}</div>
        <div style="justify-self:end;">${buildOrderNextButton(order)}</div>
      </div>
      ${expandedSection}
    </div>`;
}

const ICON_CHECK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const ICON_BAG   = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l1 13H5L6 7z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>`;
const ICON_BOX = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/></svg>`;
const ICON_CHECK_SM = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const ICON_WA    = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21"/></svg>`;

// Where the order stands for the WhatsApp message, which goes out once every piece is ready.
//   waiting – some pieces still being fired      to_send – all ready, customer not told yet
//   pending – chat opened, owner hasn't said if it went out
//   sent    – customer told (sentAt = latest)    done    – everything collected
// issue: the latest "not sent" reason, if it's newer than the last successful message.
function whatsAppState(order) {
  const items   = order.objects ?? [];
  const waiting = items.filter(i => i.status === 'received').length;
  const ready   = items.filter(i => i.status === 'ready');
  if (!items.length) return { state: 'empty' };
  if (waiting)       return { state: 'waiting', readyCount: items.length - waiting, total: items.length };
  if (!ready.length) return { state: 'done' };
  if (settings().confirmSent && pendingWa.has(order.id)) return { state: 'pending', total: items.length };
  const sentAt = ready.every(i => i.notified_at) ? ready.map(i => i.notified_at).sort().at(-1) : null;
  const issue  = waIssues.get(order.id);
  const freshIssue = issue && (!sentAt || issue.at > sentAt) ? issue : null;
  if (!sentAt) return { state: 'to_send', total: items.length, issue: freshIssue };
  return { state: 'sent', sentAt, issue: freshIssue };
}

function fmtShortDate(iso) {
  return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
}

function buildOrderStrip(order) {
  const wa = whatsAppState(order);
  const first = escHtml(String(order.customers?.name ?? 'the customer').split(' ')[0]);
  const id = escHtml(order.id);
  if (wa.state === 'waiting') {
    const meter = Array.from({ length: wa.total }, (_, n) => `<i class="${n < wa.readyCount ? 'on' : ''}"></i>`).join('');
    return `<div class="ord-strip waiting">${ICON_WA}
      <span class="ord-strip-text">Send the WhatsApp once ${wa.total === 1 ? 'the piece is' : `all ${wa.total} pieces are`} ready
        <span style="color:#a09080;">· ${wa.readyCount} of ${wa.total} ready</span><span class="ord-strip-meter" aria-hidden="true">${meter}</span></span>
    </div>`;
  }
  const issueLine = wa.issue
    ? `<span class="wa-issue-line">Not sent ${escHtml(fmtShortDate(wa.issue.at))} — ${escHtml(wa.issue.reason)}</span>` : '';
  if (wa.state === 'to_send') {
    return `<div class="ord-strip ready">${ICON_CHECK}
      <span class="ord-strip-text"><strong>${wa.total === 1 ? 'The piece is' : `All ${wa.total} pieces are`} ready</strong> — let ${first} know.${issueLine}</span>
      <button type="button" class="wa-btn wa-send-order" data-order-id="${id}">${ICON_WA} ${wa.issue ? 'Try again' : 'Send WhatsApp'}</button>
    </div>`;
  }
  if (wa.state === 'pending') {
    return `<div class="ord-strip pending">${ICON_WA}
      <span class="ord-strip-text"><strong>Opened in WhatsApp ${escHtml(fmtWhen(pendingWa.get(order.id)?.openedAt))}</strong> — did the message go out?
        <span style="display:block;font-size:12px;color:#8a6a2a;">Not sure? Open the chat and look.</span></span>
      <button type="button" class="ask-btn check wa-check" data-order-id="${id}"><b>?</b> Check chat</button>
      <button type="button" class="ask-btn yes wa-yes" data-order-id="${id}">${ICON_CHECK} Yes, sent</button>
      <button type="button" class="ask-btn wa-no" data-order-id="${id}">Not sent</button>
    </div>`;
  }
  if (wa.state === 'sent') {
    return `<div class="ord-strip sent">${ICON_WA}
      <span>WhatsApp sent ${escHtml(fmtShortDate(wa.sentAt))} ·</span>
      <button type="button" class="pc-link wa-send-order" data-order-id="${id}" data-again="1">Send again</button>
      ${wa.issue ? `<span class="wa-issue-line" style="width:100%;">Later try ${escHtml(fmtShortDate(wa.issue.at))} didn't go out — ${escHtml(wa.issue.reason)}</span>` : ''}
    </div>`;
  }
  return '';
}

function buildItemsSection(order) {
  const items   = order.objects ?? [];
  if (items.length === 0) {
    return `
      <div class="pc-well" style="font-family:'Inter',sans-serif;font-size:13px;color:#8a7560;">
        No pieces in this order.
      </div>`;
  }

  return `
    <div class="pc-well">
      ${buildOrderStrip(order)}
      ${items.map(buildItemRow).join('')}
    </div>`;
}

// Moves the whole order to its next stage: waiting pieces → ready, or (once all are ready) → picked up.
function buildOrderNextButton(order) {
  const items   = order.objects ?? [];
  if (!items.length) return '';
  const waiting = items.filter(i => i.status === 'received').length;
  const ready   = items.filter(i => i.status === 'ready').length;
  const busy    = items.some(i => savingIds.has(i.id));
  const id      = escHtml(order.id);
  const all     = n => (n > 1 ? `all ${n} ` : '');
  if (waiting) {
    return `<button type="button" class="act act-sm act-ready" data-bulk="ready" data-order-id="${id}" ${busy ? 'disabled' : ''}>
      ${busy ? 'Saving…' : `${ICON_CHECK} Mark ${all(waiting)}ready`}</button>`;
  }
  if (ready) {
    return `<button type="button" class="act act-sm act-pickup" data-bulk="picked_up" data-order-id="${id}" ${busy ? 'disabled' : ''}>
      ${busy ? 'Saving…' : `${ICON_BAG} Mark ${all(ready)}picked up`}</button>`;
  }
  return `<span class="act-done">${ICON_CHECK} Collected</span>`;
}

// "Box F" / "Boxes F, G" / "No container" for the order's ready pieces (click to set or move them all)
function buildOrderBox(order) {
  const ready = (order.objects ?? []).filter(i => i.status === 'ready');
  if (!ready.length) return '';
  const boxes = [...new Set(ready.map(i => i.container).filter(Boolean))];
  const missing = ready.some(i => !i.container);
  const id = escHtml(order.id);
  if (!boxes.length) return `<button type="button" class="ord-box none" data-order-id="${id}">${ICON_BOX} No container</button>`;
  return `<button type="button" class="ord-box" data-order-id="${id}" title="Move the ready pieces">${ICON_BOX} ${boxes.length > 1 ? 'Boxes' : 'Box'} ${escHtml(boxes.join(', '))}${missing ? ' + ?' : ''}</button>`;
}

function buildTrack(status) {
  const at = STATUSES.indexOf(status);
  const parts = [];
  STATUSES.forEach((st, n) => {
    if (n > 0) parts.push(`<span class="st-line${n <= at ? ' past' : ''}"></span>`);
    const cls = n < at ? 'past' : n === at ? 'now' : '';
    parts.push(`<span class="st-step ${cls}"><span class="st-dot"></span>${STATUS_LABEL[st]}</span>`);
  });
  return `<div class="st ${STATUS_TONE[status] ?? ''}" aria-label="Status: ${STATUS_LABEL[status] ?? status}">${parts.join('')}</div>`;
}

function buildItemRow(item) {
  const code   = item.object_types?.code;
  const name   = item.object_types?.name ?? 'Piece';
  const saving = savingIds.has(item.id);
  const id     = escHtml(item.id);

  let action;
  if (item.status === 'received') {
    action = `<button type="button" class="act act-ready status-btn" data-object-id="${id}" data-next="ready" ${saving ? 'disabled' : ''}>
      ${saving ? 'Saving…' : `${ICON_CHECK} Mark ready`}</button>`;
  } else if (item.status === 'ready') {
    action = `<button type="button" class="act act-pickup status-btn" data-object-id="${id}" data-next="picked_up" ${saving ? 'disabled' : ''}>
      ${saving ? 'Saving…' : `${ICON_BAG} Mark picked up`}</button>`;
  } else {
    const when = fmtDate(item.picked_up_at);
    action = `<span class="act-done">${ICON_CHECK} Collected${when ? ` ${escHtml(when)}` : ''}</span>`;
  }

  return `
    <div class="pc-card${item.status === 'picked_up' ? ' is-done' : ''}">
      <div class="pc-name">${code ? `<span class="pc-code">${escHtml(code)}</span>` : ''}<span>${escHtml(name)}</span>
        ${item.status === 'ready' ? (item.container
          ? `<button type="button" class="pc-box" data-object-id="${id}" title="Move to another container">${ICON_BOX} ${escHtml(item.container)}</button>`
          : `<button type="button" class="pc-box none" data-object-id="${id}">${ICON_BOX} Set container</button>`) : ''}</div>
      ${buildTrack(item.status)}
      ${action}
    </div>`;
}

// ─── Expand / collapse ────────────────────────────────────────────────────────

function wireExpandToggles(el) {
  el.querySelectorAll('.order-header-row').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.closest('button, select')) return;
      const id = row.dataset.orderId;
      if (expandedIds.has(id)) expandedIds.delete(id);
      else expandedIds.add(id);
      renderOrders(el, allOrders);
    });
  });
}

// ─── Status changes ───────────────────────────────────────────────────────────

function wireStatusButtons(el) {
  // Marking ready = putting the piece in a container, so "ready" always asks which one
  const ready = (btn, order, items) => openContainerPicker(el, btn, {
    title: items.length > 1 ? `Which container for these ${items.length} pieces?` : 'Which container is it in?',
    suggested: suggestContainer(order),
    onPick: c => changeStatus(el, items, 'ready', { container: c }),
  });
  el.querySelectorAll('.status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = findItem(btn.dataset.objectId);
      if (!item) return;
      if (btn.dataset.next === 'ready') ready(btn, findOrderOf(item.id), [item]);
      else changeStatus(el, [item], btn.dataset.next);
    });
  });
  el.querySelectorAll('[data-bulk]').forEach(btn => {
    btn.addEventListener('click', () => {
      const order = allOrders.find(o => o.id === btn.dataset.orderId);
      const next  = btn.dataset.bulk;
      const items = (order?.objects ?? []).filter(i => STATUS_NEXT[i.status] === next);
      if (!items.length) return;
      if (next === 'ready') ready(btn, order, items);
      else changeStatus(el, items, next);
    });
  });
  // Move pieces that are already ready (or give a container to ones that have none)
  el.querySelectorAll('.pc-box').forEach(btn => btn.addEventListener('click', () => {
    const item = findItem(btn.dataset.objectId);
    if (!item) return;
    openContainerPicker(el, btn, { title: 'Move to container', current: item.container, suggested: suggestContainer(findOrderOf(item.id), item),
      onPick: c => moveToContainer(el, [item], c) });
  }));
  el.querySelectorAll('.ord-box').forEach(btn => btn.addEventListener('click', () => {
    const order = allOrders.find(o => o.id === btn.dataset.orderId);
    const items = (order?.objects ?? []).filter(i => i.status === 'ready');
    if (!items.length) return;
    const boxes = [...new Set(items.map(i => i.container).filter(Boolean))];
    openContainerPicker(el, btn, { title: `Container for order ${fmtNum(order.order_number)}`, current: boxes.length === 1 ? boxes[0] : undefined,
      onPick: c => moveToContainer(el, items, c) });
  }));
}

// The container most of the order's other ready pieces are in — usually where the rest should go
function suggestContainer(order, except) {
  const counts = countBy((order?.objects ?? []).filter(i => i.status === 'ready' && i.container && i !== except), i => i.container);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
}

async function moveToContainer(el, items, container) {
  const before = items.map(i => i.container ?? null);
  if (items.every(i => i.container === container)) return;
  items.forEach(i => { savingIds.add(i.id); i.container = container; });
  renderOrders(el, allOrders);
  const { error } = await supabase.from('objects').update({ container }).in('id', items.map(i => i.id));
  items.forEach(i => savingIds.delete(i.id));
  if (error) items.forEach((i, n) => { i.container = before[n]; });
  if (pageSignal?.aborted) return;
  renderOrders(el, allOrders);
  if (error) {
    logEvent('error', `Couldn't move pieces to container ${container}: ${error.message}`);
    showToast(el, { html: `Couldn't save — ${escHtml(error.message)}`, tone: 'error' });
    return;
  }
  if (!settings().undoBar) return;
  showToast(el, { html: `${items.length === 1 ? escHtml(items[0].object_types?.name ?? 'Piece') : `${items.length} pieces`} moved to <strong>${escHtml(container)}</strong>`,
    actions: [{ label: 'Undo', run: async () => {
      items.forEach((i, n) => { i.container = before[n]; });
      renderOrders(el, allOrders);
      for (const prev of new Set(before)) {
        await supabase.from('objects').update({ container: prev }).in('id', items.filter((_, n) => before[n] === prev).map(i => i.id));
      }
    } }] });
}

// ─── Container picker ─────────────────────────────────────────────────────────

let pickerAbort = null;

function closeContainerPicker(el) {
  pickerAbort?.abort();
  pickerAbort = null;
  const pop = el.querySelector('#cont-pop');
  if (pop) pop.hidden = true;
}

// Small popover under `anchor`: one button per container (or press its letter), or type another one.
function openContainerPicker(el, anchor, { title, suggested, current, onPick }) {
  closeContainerPicker(el);
  const pop  = el.querySelector('#cont-pop');
  const list = settings().containers?.length ? settings().containers : SETTING_DEFAULTS.containers;
  pop.innerHTML = `
    <div class="cp-head"><span>${escHtml(title)}</span><button type="button" class="cp-x" aria-label="Cancel">×</button></div>
    <div class="cp-chips">${list.map(c => `<button type="button" class="cp-chip${c === suggested ? ' suggested' : ''}${c === current ? ' current' : ''}" data-c="${escHtml(c)}">${escHtml(c)}</button>`).join('')}</div>
    <form class="cp-other"><input type="text" maxlength="30" placeholder="Other container…" aria-label="Other container" /><button type="submit" disabled>OK</button></form>
    <div class="cp-hint">${suggested ? `The order's other pieces are in <b>${escHtml(suggested)}</b>.` : 'Tip: press a letter to choose it.'}</div>`;
  pop.hidden = false;

  // Under the button, kept inside the window
  const r = anchor.getBoundingClientRect();
  const left = Math.max(12, Math.min(r.right - pop.offsetWidth, innerWidth - pop.offsetWidth - 12));
  let top = r.bottom + 8;
  if (top + pop.offsetHeight > innerHeight - 12) top = Math.max(12, r.top - pop.offsetHeight - 8);
  pop.style.left = `${left}px`;
  pop.style.top  = `${top}px`;

  pickerAbort = new AbortController();
  const { signal } = pickerAbort;
  const pick = c => { closeContainerPicker(el); onPick(c); };
  pop.querySelectorAll('.cp-chip').forEach(b => b.addEventListener('click', () => pick(b.dataset.c), { signal }));
  pop.querySelector('.cp-x').addEventListener('click', () => closeContainerPicker(el), { signal });
  const input = pop.querySelector('.cp-other input');
  const ok = pop.querySelector('.cp-other button');
  input.addEventListener('input', () => { ok.disabled = !input.value.trim(); }, { signal });
  pop.querySelector('.cp-other').addEventListener('submit', e => { e.preventDefault(); if (input.value.trim()) pick(input.value.trim()); }, { signal });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeContainerPicker(el); anchor.focus(); return; }
    if (e.target === input || e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
    const hit = list.find(c => c.length === 1 && c.toLowerCase() === e.key.toLowerCase());
    if (hit) { e.preventDefault(); pick(hit); }
  }, { signal });
  document.addEventListener('mousedown', e => {
    if (!pop.contains(e.target) && !anchor.contains(e.target)) closeContainerPicker(el);
  }, { signal });
  (pop.querySelector('.cp-chip.suggested') ?? pop.querySelector('.cp-chip.current') ?? pop.querySelector('.cp-chip'))?.focus();
}

// Moves pieces one step forward (or back, for Undo) and shows a toast with Undo.
// All pieces passed in share the same current status.
async function changeStatus(el, items, newStatus, { isUndo = false, container } = {}) {
  items = items.filter(i => !savingIds.has(i.id));
  if (!isUndo) items = items.filter(i => STATUS_NEXT[i.status] === newStatus); // never skip a step
  if (!items.length) return;

  const before  = items.map(i => ({ status: i.status, picked_up_at: i.picked_up_at ?? null, container: i.container ?? null }));
  const payload = {
    status: newStatus,
    picked_up_at: newStatus === 'picked_up' ? new Date().toISOString() : null,
  };
  if (container !== undefined) payload.container = container; // ready → which container it went in

  items.forEach(i => { savingIds.add(i.id); Object.assign(i, payload); });
  renderOrders(el, allOrders);

  const { error } = await supabase.from('objects').update(payload).in('id', items.map(i => i.id));

  items.forEach(i => savingIds.delete(i.id));
  if (error) items.forEach((i, n) => Object.assign(i, before[n]));
  if (pageSignal?.aborted) return;
  renderOrders(el, allOrders);

  const order = findOrderOf(items[0].id);
  const label = items.length === 1 ? (items[0].object_types?.name ?? 'Piece') : `${items.length} pieces`;

  if (error) {
    logEvent('error', `Couldn't mark ${label} as ${STATUS_LABEL[newStatus].toLowerCase()}: ${error.message}`);
    showToast(el, { html: `Couldn't save — ${escHtml(error.message)}`, tone: 'error' });
    return;
  }
  if (!settings().undoBar) return; // turned off in Settings (errors above still show)
  if (isUndo) {
    showToast(el, { html: `Undone — ${escHtml(label)} back to ${STATUS_LABEL[newStatus].toLowerCase()}`, duration: 3500 });
    return;
  }

  const ordNum = escHtml(fmtNum(order?.order_number));
  const undo   = { label: 'Undo', run: () => changeStatus(el, items, before[0].status,
    { isUndo: true, ...(container !== undefined ? { container: before[0].container } : {}) }) };
  const inBox  = container ? ` · in <strong>${escHtml(container)}</strong>` : '';
  const wa     = order ? whatsAppState(order) : { state: 'empty' };
  let html;
  const actions = [];

  if (newStatus === 'ready' && wa.state === 'to_send') {
    // That was the last piece — the order is complete, time to tell the customer
    html = `<strong>Order ${ordNum}</strong> is all ready${inBox}`;
    actions.push({ label: `${ICON_WA} Send WhatsApp`, cls: 'wa', run: () => sendWhatsApp(el, order) });
  } else if (newStatus === 'ready') {
    const left = (order?.objects ?? []).filter(i => i.status === 'received').length;
    html = `<strong>${escHtml(label)}</strong> ${items.length === 1 ? 'is' : 'are'} ready${inBox} · ${left} more to go`;
  } else {
    html = `<strong>${escHtml(label)}</strong> picked up${wa.state === 'done' ? ` · order ${ordNum} complete` : ''}`;
  }
  actions.push(undo);
  showToast(el, { html, actions });
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function showToast(el, { html, actions = [], tone = 'info', duration = 8000 }) {
  const toast = el.querySelector('#ord-toast');
  if (!toast) return;
  clearTimeout(toastTimer);

  toast.classList.toggle('error', tone === 'error');
  toast.innerHTML = `
    <span class="ck-toast-text">${html}</span>
    ${actions.map((a, n) => `<button type="button" class="ck-toast-btn ${a.cls ?? ''}" data-n="${n}" style="display:inline-flex;align-items:center;gap:6px;">${a.label}</button>`).join('')}
    <button type="button" class="ck-toast-btn ck-toast-x" aria-label="Dismiss">×</button>`;

  toast.querySelectorAll('[data-n]').forEach(b => b.addEventListener('click', () => {
    hideToast(el);
    actions[Number(b.dataset.n)].run(); // runs inside the click, so WhatsApp's tab isn't blocked
  }));
  toast.querySelector('.ck-toast-x').addEventListener('click', () => hideToast(el));

  requestAnimationFrame(() => toast.classList.add('show'));
  toastTimer = setTimeout(() => hideToast(el), duration);
}

function hideToast(el) {
  clearTimeout(toastTimer);
  el.querySelector('#ord-toast')?.classList.remove('show');
}

function findItem(objectId) {
  for (const order of allOrders) {
    const found = (order.objects ?? []).find(obj => obj.id === objectId);
    if (found) return found;
  }
  return null;
}

function findOrderOf(objectId) {
  return allOrders.find(o => (o.objects ?? []).some(obj => obj.id === objectId)) ?? null;
}

// ─── WhatsApp ─────────────────────────────────────────────────────────────────

function wireWhatsAppButtons(el) {
  // One message per order, once every piece is ready ("Send again" uses the same button class)
  el.querySelectorAll('.wa-send-order').forEach(btn => {
    btn.addEventListener('click', () => {
      const order = allOrders.find(o => o.id === btn.dataset.orderId);
      if (order) sendWhatsApp(el, order);
    });
  });
  el.querySelectorAll('#orders-body .wa-yes').forEach(btn => btn.addEventListener('click', () => confirmSent(el, btn.dataset.orderId)));
  el.querySelectorAll('#orders-body .wa-no').forEach(btn => btn.addEventListener('click', () => openWhyDialog(el, btn.dataset.orderId)));
  el.querySelectorAll('#orders-body .wa-check').forEach(btn => btn.addEventListener('click', () => checkChat(el, btn.dataset.orderId)));
}

// Opens the customer's WhatsApp chat with the message for the whole order typed in, then records
// notified_at on the pieces waiting for pickup. Only allowed once no piece is still being fired.
// Runs synchronously up to openWhatsApp() so the browser allows the new tab.
function sendWhatsApp(el, order) {
  const all   = order.objects ?? [];
  const items = all.filter(i => i.status === 'ready');
  if (!items.length || all.some(i => i.status === 'received')) return;
  const customer = order.customers;
  const text = buildReadyMessage(settings().messageTemplate, customer?.name, order.order_number, items.map(i => i.object_types?.name ?? 'piece'));
  if (!openWhatsApp(customer?.phone, text)) {
    recordNotSent(el, order.id, "Phone number can't be used for WhatsApp");
    showToast(el, { html: `${escHtml(customer?.name ?? 'This customer')}'s phone number can't be used for WhatsApp — fix it in Supabase.`, tone: 'error' });
    return;
  }
  const openedAt = new Date().toISOString();
  if (!settings().confirmSent) {
    // Confirmation turned off in Settings: opening the chat counts as telling the customer
    markTold(el, order, items, openedAt);
    return;
  }
  // Nothing is saved yet — the owner confirms "sent" (or says why not) when back from WhatsApp
  pendingWa.set(order.id, {
    openedAt,
    orderNumber: order.order_number,
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    itemIds: items.map(i => i.id),
  });
  renderOrders(el, allOrders);
  logEvent('info', `WhatsApp opened — order ${fmtNum(order.order_number)} (${customer?.name ?? ''})`,
    { kind: 'wa_opened', order_id: order.id, order_number: order.order_number, opened_at: openedAt });
}

// Saves notified_at straight away (used when "Confirm sent messages" is off).
async function markTold(el, order, items, at) {
  const prev = items.map(i => i.notified_at);
  items.forEach(i => { i.notified_at = at; });
  renderOrders(el, allOrders);
  const { error } = await supabase.from('objects').update({ notified_at: at }).in('id', items.map(i => i.id));
  if (error) {
    items.forEach((i, k) => { i.notified_at = prev[k]; });
    if (!pageSignal?.aborted) renderOrders(el, allOrders);
    logEvent('error', `WhatsApp opened but marking order ${fmtNum(order.order_number)} as told failed: ${error.message}`);
    showToast(el, { html: `WhatsApp opened, but saving failed — ${escHtml(error.message)}`, tone: 'error' });
  }
}

// Opens the customer's chat with nothing typed, so the owner can see whether the message is there.
function checkChat(el, orderId) {
  const p = pendingWa.get(orderId);
  const phone = p?.phone ?? allOrders.find(o => o.id === orderId)?.customers?.phone;
  if (!openWhatsApp(phone)) showToast(el, { html: "This customer's phone number can't be used for WhatsApp.", tone: 'error' });
}

// "today 14:05" / "yesterday 18:40" / "12 Oct 18:40"
function fmtWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((startOfToday - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
  if (diffDays === 0) return `today ${time}`;
  if (diffDays === 1) return `yesterday ${time}`;
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${time}`;
}

// Brings back chats that were opened but never answered (✓ or ✕), from any earlier visit.
// An opening counts as unanswered when it's the order's latest WhatsApp event, the order still has
// pieces waiting for pickup, and none of them was marked as told at or after that moment.
async function loadPendingWa(el) {
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const { data: events, error } = await supabase
    .from('activity_log')
    .select('created_at, details')
    .eq('source', 'app')
    .in('details->>kind', ['wa_opened', 'wa_not_sent'])
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error || pageSignal?.aborted) return; // no log table → only this visit's chats are remembered

  const latest = new Map(); // orderId → newest event
  for (const e of events ?? []) {
    const id = e.details?.order_id;
    if (id && !latest.has(id)) latest.set(id, e);
  }
  const opened = [...latest].filter(([, e]) => e.details.kind === 'wa_opened');
  if (!opened.length) return;

  const { data: pieces } = await supabase
    .from('objects')
    .select('id, order_id, status, notified_at, orders(order_number, customers(name, phone))')
    .in('order_id', opened.map(([id]) => id));
  if (pageSignal?.aborted) return;

  for (const [orderId, e] of opened) {
    if (pendingWa.has(orderId)) continue;
    const openedAt = e.details.opened_at ?? e.created_at;
    const mine  = (pieces ?? []).filter(x => x.order_id === orderId);
    const ready = mine.filter(x => x.status === 'ready');
    if (!ready.length || mine.some(x => x.status === 'received')) continue;
    if (ready.some(x => x.notified_at && x.notified_at >= openedAt)) continue; // answered ✓ already
    const o = mine[0].orders;
    pendingWa.set(orderId, {
      openedAt,
      orderNumber: o?.order_number,
      name: o?.customers?.name ?? '',
      phone: o?.customers?.phone ?? '',
      itemIds: ready.map(x => x.id),
    });
  }
  renderOrders(el, allOrders);
}

// Owner confirmed the message went out: notified_at = when the chat was opened.
async function confirmSent(el, orderId) {
  const p = pendingWa.get(orderId);
  if (!p) return;
  pendingWa.delete(orderId);
  const local = p.itemIds.map(findItem).filter(Boolean);
  const prev  = local.map(i => i.notified_at);
  local.forEach(i => { i.notified_at = p.openedAt; });
  renderOrders(el, allOrders);

  const { error } = await supabase.from('objects').update({ notified_at: p.openedAt }).in('id', p.itemIds);
  if (error) {
    pendingWa.set(orderId, p);
    local.forEach((i, k) => { i.notified_at = prev[k]; });
    if (!pageSignal?.aborted) renderOrders(el, allOrders);
    logEvent('error', `Couldn't mark order ${fmtNum(p.orderNumber)} as told: ${error.message}`);
    showToast(el, { html: `Couldn't save — ${escHtml(error.message)}`, tone: 'error' });
  }
}

async function confirmAllSent(el) {
  await Promise.all([...pendingWa.keys()].map(id => confirmSent(el, id)));
}

// Keeps the reason on the order (until a later message goes through) and in the activity log.
function recordNotSent(el, orderId, reason) {
  const p     = pendingWa.get(orderId);
  const order = allOrders.find(o => o.id === orderId);
  const num   = p?.orderNumber ?? order?.order_number;
  const name  = p?.name ?? order?.customers?.name ?? '';
  pendingWa.delete(orderId);
  waIssues.set(orderId, { reason, at: new Date().toISOString() });
  if (!waReasons.includes(reason)) waReasons.push(reason);
  renderOrders(el, allOrders);
  logEvent('warning', `WhatsApp not sent — order ${fmtNum(num)}${name ? ` (${name})` : ''}: ${reason}`,
    { kind: 'wa_not_sent', order_id: orderId, order_number: num, reason });
}

// ─── "Sent?" tray ─────────────────────────────────────────────────────────────

function renderTray(el) {
  const tray = el.querySelector('#wa-tray');
  if (!tray) return;
  const pending = settings().confirmSent ? [...pendingWa] : [];
  tray.hidden = pending.length === 0;
  if (!pending.length) { trayOpen = false; tray.innerHTML = ''; return; }

  const first = n => escHtml(String(n ?? '').split(' ')[0]);
  let head;
  if (pending.length === 1) {
    const [id, p] = pending[0];
    head = `<div class="tray-row">${ICON_WA}
      <span class="tray-text">Order <strong>${escHtml(fmtNum(p.orderNumber))}</strong> · ${first(p.name)} — did it go out?
        <span class="when" style="color:#a08850;font-size:12px;">opened ${escHtml(fmtWhen(p.openedAt))}</span></span>
      <button type="button" class="ask-chip check" data-check="${escHtml(id)}" aria-label="Open the chat to check" title="Open the chat to check">?</button>
      <button type="button" class="ask-btn yes" data-yes="${escHtml(id)}">${ICON_CHECK} Sent</button>
      <button type="button" class="ask-btn" data-no="${escHtml(id)}">Not sent</button></div>`;
  } else {
    head = `<div class="tray-row">${ICON_WA}
      <span class="tray-text"><strong>${pending.length} messages</strong> opened in WhatsApp</span>
      <button type="button" class="ask-btn yes" data-all>${ICON_CHECK} All sent</button>
      <button type="button" class="ask-btn" data-toggle aria-expanded="${trayOpen}">${trayOpen ? 'Close' : 'Review'}</button></div>`;
  }
  const list = pending.length > 1 && trayOpen ? `<div class="tray-list">${pending.map(([id, p]) => `
      <div class="tray-item"><span class="num">${escHtml(fmtNum(p.orderNumber))}</span><span class="who">${escHtml(p.name)}</span>
        <span class="when">${escHtml(fmtWhen(p.openedAt))}</span>
        <button type="button" class="ask-chip check" data-check="${escHtml(id)}" aria-label="Open order ${escHtml(fmtNum(p.orderNumber))}'s chat to check" title="Open the chat to check">?</button>
        <button type="button" class="ask-chip yes" data-yes="${escHtml(id)}" aria-label="Order ${escHtml(fmtNum(p.orderNumber))} sent" title="Sent">✓</button>
        <button type="button" class="ask-chip no" data-no="${escHtml(id)}" aria-label="Order ${escHtml(fmtNum(p.orderNumber))} not sent" title="Not sent">✕</button></div>`).join('')}
    </div>` : '';
  tray.innerHTML = head + list;

  tray.querySelectorAll('[data-yes]').forEach(b => b.addEventListener('click', () => confirmSent(el, b.dataset.yes)));
  tray.querySelectorAll('[data-no]').forEach(b => b.addEventListener('click', () => openWhyDialog(el, b.dataset.no)));
  tray.querySelectorAll('[data-check]').forEach(b => b.addEventListener('click', () => checkChat(el, b.dataset.check)));
  tray.querySelector('[data-all]')?.addEventListener('click', () => confirmAllSent(el));
  tray.querySelector('[data-toggle]')?.addEventListener('click', () => { trayOpen = !trayOpen; renderTray(el); });
}

// ─── "Why didn't it go out?" ──────────────────────────────────────────────────

let whyOrderId = null;

function openWhyDialog(el, orderId) {
  if (!settings().askWhyNotSent) { recordNotSent(el, orderId, 'Not sent'); return; } // turned off in Settings
  const p     = pendingWa.get(orderId);
  const order = allOrders.find(o => o.id === orderId);
  whyOrderId  = orderId;
  el.querySelector('#why-sub').textContent =
    `Order ${fmtNum(p?.orderNumber ?? order?.order_number)} · ${p?.name ?? order?.customers?.name ?? ''}`;
  el.querySelector('#why-chips').innerHTML = waReasons
    .map(r => `<button type="button" class="why-chip" data-reason="${escHtml(r)}">${escHtml(r)}</button>`).join('');
  el.querySelectorAll('.why-chip').forEach(c => c.addEventListener('click', () => saveWhy(el, c.dataset.reason)));
  const input = el.querySelector('#why-input');
  input.value = '';
  el.querySelector('#why-save').disabled = true;
  el.querySelector('#why-backdrop').hidden = false;
  el.querySelector('.why-chip')?.focus();
}

function closeWhyDialog(el) {
  el.querySelector('#why-backdrop').hidden = true;
  whyOrderId = null;
}

function saveWhy(el, reason) {
  const text = String(reason ?? '').trim();
  if (!text || !whyOrderId) return;
  const id = whyOrderId;
  closeWhyDialog(el);
  recordNotSent(el, id, text);
}

function wireWhyDialog(el, signal) {
  const backdrop = el.querySelector('#why-backdrop');
  const input    = el.querySelector('#why-input');
  const save     = el.querySelector('#why-save');
  input.addEventListener('input', () => { save.disabled = !input.value.trim(); });
  el.querySelector('#why-form').addEventListener('submit', e => { e.preventDefault(); saveWhy(el, input.value); });
  el.querySelector('#why-cancel').addEventListener('click', () => closeWhyDialog(el)); // stays "Sent?" for later
  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeWhyDialog(el); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !backdrop.hidden) closeWhyDialog(el); }, { signal });
}

// Latest "not sent" reason per order on this page, from the activity log.
async function loadWaIssues(el) {
  const ids = allOrders.map(o => o.id);
  if (!ids.length) return;
  const { data, error } = await supabase
    .from('activity_log')
    .select('created_at, details')
    .eq('source', 'app')
    .eq('details->>kind', 'wa_not_sent')
    .in('details->>order_id', ids)
    .order('created_at', { ascending: false });
  if (error || pageSignal?.aborted) return; // log table missing → just no reasons shown
  for (const r of data ?? []) {
    const id = r.details?.order_id;
    if (id && !waIssues.has(id)) waIssues.set(id, { reason: r.details.reason, at: r.created_at });
  }
  renderOrders(el, allOrders);
}

// Reasons typed before become quick choices next time.
async function loadWaReasons() {
  const { data } = await supabase
    .from('activity_log')
    .select('details')
    .eq('source', 'app')
    .eq('details->>kind', 'wa_not_sent')
    .order('created_at', { ascending: false })
    .limit(200);
  for (const r of data ?? []) {
    const reason = r.details?.reason;
    if (reason && !waReasons.includes(reason) && waReasons.length < 10) waReasons.push(reason);
  }
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function renderPagination(el) {
  renderPager(el.querySelector('#orders-pagination'), {
    page: currentPage, pageSize, total: totalCount, noun: 'orders',
    onPage: n => { currentPage = n; loadOrders(el); },
    onPageSize: n => { pageSize = n; currentPage = 1; loadOrders(el); },
  });
}

// ─── Filters ──────────────────────────────────────────────────────────────────

function nextDay(ymd) {
  const d = new Date(ymd + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return todayLocal(d);
}

function renderFilters(el, signal) {
  const box = el.querySelector('#ord-filters');
  const typeOptions = [['', 'All types'], ...[...allObjectTypes]
    .sort((a, b) => String(a.code ?? '').localeCompare(String(b.code ?? '')))
    .map(t => [t.code, t.code && t.name && t.name !== t.code ? `${t.code} — ${t.name}` : (t.code || t.name)])];
  box.innerHTML = `
    <div class="fbar-row">
      ${searchBox('ord-search', 'Search by name, phone or order number…', filters.q)}
      ${selectBox('sort', 'Sort', [['newest', 'Newest first'], ['oldest', 'Oldest first']], filters.sort)}
    </div>
    <div class="fbar-row">
      ${chipGroup('stage', 'Status', [['all', 'All'], ['waiting', 'Waiting'], ['ready', 'Ready'], ['open', 'Not collected'], ['collected', 'Collected']], filters.stage)}
      ${chipGroup('wa', 'WhatsApp', [['all', 'Any'], ['to_tell', 'To tell'], ['told', 'Told']], filters.wa)}
    </div>
    <div class="fbar-row">
      ${selectBox('type', 'Object type', typeOptions, filters.type)}
      ${selectBox('container', 'Container', [['', 'Any'], ...(settings().containers ?? SETTING_DEFAULTS.containers).map(c => [c, c])], filters.container)}
      ${dateRange('Date in', filters.from, filters.to)}
      ${clearButton(activeCount(filters, FILTER_DEFAULTS))}
    </div>`;
  const typeSelect = box.querySelector('[data-fselect="type"]');
  // the searchable picker copies the select's inline style, so give it the filter look here
  typeSelect.style.cssText = "padding:6px 30px 6px 10px;border-radius:9px;border:1px solid #e3dad0;background:#fff;" +
    "font-family:'Inter',sans-serif;font-size:12.5px;color:#4a3a2c;min-width:230px;outline:none;";
  initCombobox(typeSelect, { signal }); // searchable — there are hundreds of types

  const reload = () => { currentPage = 1; updateClear(box, activeCount(filters, FILTER_DEFAULTS)); loadOrders(el); };
  box.querySelector('#ord-search').addEventListener('input', debounce(e => { filters.q = e.target.value; reload(); }, 250));
  wireFilterControls(box, (name, value) => { filters[name] = value; reload(); }, () => {
    filters = { ...FILTER_DEFAULTS, sort: filters.sort };
    renderFilters(el, signal);
    currentPage = 1;
    loadOrders(el);
  });
}

// ─── Modal ────────────────────────────────────────────────────────────────────

// Each item entry in the modal is represented by a local array index.
// We re-render the items container whenever the list changes.
let modalItemTypes = [];  // array of object_type_id strings (may be '')

function renderModalItems(form) {
  const container = form.querySelector('#items-container');
  container.innerHTML = modalItemTypes.map((typeId, idx) => {
    const showRemove = modalItemTypes.length > 1;
    const options = allObjectTypes.map(t => {
      const prefix = t.code ? `${t.code} — ` : '';
      const label  = t.raw_stock <= 0 ? `${prefix}${t.name} (out of stock)` : `${prefix}${t.name}`;
      const sel    = t.id === typeId ? 'selected' : '';
      return `<option value="${escHtml(t.id)}" ${sel}>${escHtml(label)}</option>`;
    }).join('');

    return `
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
        <select data-item-idx="${idx}" class="modal-item-type" style="
          flex:1;padding:10px 14px;font-family:'Inter',sans-serif;font-size:14px;
          border:1px solid #e0d8cf;border-radius:10px;outline:none;color:#1a120b;
          transition:border-color 0.15s;
        "
          onfocus="this.style.borderColor='#9C1A4D'"
          onblur="this.style.borderColor='#e0d8cf'"
        >
          <option value="">Select object type…</option>
          ${options}
        </select>
        ${showRemove ? `
          <button type="button" data-item-idx="${idx}" class="remove-item-btn" style="
            flex-shrink:0;width:32px;height:32px;border-radius:6px;
            background:#f5f0eb;border:1px solid #e0d8cf;
            cursor:pointer;color:#8a7560;font-size:16px;line-height:1;
            display:flex;align-items:center;justify-content:center;
            transition:background 0.15s,border-color 0.15s,color 0.15s;
          "
            onmouseover="this.style.background='#fde8ee';this.style.borderColor='#9C1A4D';this.style.color='#9C1A4D'"
            onmouseout="this.style.background='#f5f0eb';this.style.borderColor='#e0d8cf';this.style.color='#8a7560'"
          >×</button>
        ` : ''}
      </div>`;
  }).join('');

  // wire item type selects
  container.querySelectorAll('.modal-item-type').forEach(sel => {
    sel.addEventListener('change', () => {
      modalItemTypes[parseInt(sel.dataset.itemIdx)] = sel.value;
    });
  });

  // wire remove buttons
  container.querySelectorAll('.remove-item-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modalItemTypes.splice(parseInt(btn.dataset.itemIdx), 1);
      renderModalItems(form);
    });
  });
}

function wireModal(el, signal) {
  const backdrop  = el.querySelector('#ord-modal-backdrop');
  const closeBtn  = el.querySelector('#ord-modal-close');
  const addBtn    = el.querySelector('#btn-add-order');
  const form      = el.querySelector('#add-order-form');
  const errorDiv  = el.querySelector('#ord-form-error');
  const submitBtn = el.querySelector('#ord-btn-submit');

  const cbCustomer = initCombobox(form.elements.customer_id, { signal });

  const successPanel = el.querySelector('#ord-success-panel');
  const modalTitle   = el.querySelector('#ord-modal-title');

  function showForm() {
    successPanel.style.display = 'none';
    form.style.display         = 'block';
    modalTitle.style.display   = 'block';
  }

  el.querySelector('#ord-success-close').addEventListener('click', closeModal);
  el.querySelector('#ord-success-another').addEventListener('click', () => {
    showForm();
    openModal();
  });

  function openModal() {
    const customerSel = form.elements.customer_id;
    customerSel.innerHTML = '<option value="">Select customer…</option>';
    allCustomers.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      customerSel.appendChild(opt);
    });

    form.reset();
    form.elements.received_at.value = todayLocal();
    errorDiv.style.display = 'none';
    cbCustomer.refresh(); cbCustomer.clear();

    form.querySelector('#new-cust-section').style.display = 'none';
    form.querySelector('#btn-toggle-new-cust').textContent = '+ New customer';
    form.querySelector('#new-cust-name').value = '';
    form.querySelector('#new-cust-phone').value = '';
    form.querySelector('#new-cust-notes-input').value = '';
    form.querySelector('#new-cust-dupe-notice').style.display = 'none';
    form.querySelector('#new-cust-error').style.display = 'none';

    modalItemTypes = [''];
    renderModalItems(form);

    showForm();
    backdrop.style.display = 'flex';
  }

  function closeModal() {
    backdrop.style.display = 'none';
  }

  addBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });

  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); }, { signal });

  // Add item button
  form.querySelector('#btn-add-item').addEventListener('click', () => {
    modalItemTypes.push('');
    renderModalItems(form);
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();

    const customerId = form.elements.customer_id.value;
    const receivedAt = form.elements.received_at.value;
    const notes      = form.elements.notes.value.trim();

    // Read current item type selections from DOM (in case combobox changed value)
    form.querySelectorAll('.modal-item-type').forEach((sel, i) => {
      modalItemTypes[i] = sel.value;
    });

    const selectedTypes = modalItemTypes.filter(Boolean);

    if (!customerId || !receivedAt) {
      errorDiv.textContent = 'Customer and date are required.';
      errorDiv.style.display = 'block';
      return;
    }
    if (selectedTypes.length === 0) {
      errorDiv.textContent = 'Add at least one object type.';
      errorDiv.style.display = 'block';
      return;
    }

    errorDiv.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating…';

    // 1. Insert order
    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({ customer_id: customerId, received_at: receivedAt, notes: notes || null })
      .select('id, order_number')
      .single();

    if (orderError) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Order';
      logEvent('error', `Couldn't create order: ${orderError.message}`);
      errorDiv.textContent = 'Failed to create order: ' + orderError.message;
      errorDiv.style.display = 'block';
      return;
    }

    // 2. Insert each object
    const objectInserts = selectedTypes.map(typeId => ({
      order_id:       newOrder.id,
      object_type_id: typeId,
      status:         'received',
    }));

    const { error: objError } = await supabase
      .from('objects')
      .insert(objectInserts)
      .select('id');

    if (objError) {
      // Don't leave an empty order behind
      const { error: undoError } = await supabase.from('orders').delete().eq('id', newOrder.id);
      logEvent('error', `Couldn't add pieces to order ${fmtNum(newOrder.order_number)}: ${objError.message}` +
        (undoError ? ` — and removing the empty order failed: ${undoError.message}` : ' — empty order removed'));
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Order';
      errorDiv.textContent = undoError
        ? `Couldn't add the objects (${objError.message}). Order ${fmtNum(newOrder.order_number)} was created empty — delete it in Supabase.`
        : `Couldn't add the objects: ${objError.message}. Nothing was saved.`;
      errorDiv.style.display = 'block';
      return;
    }

    // 3. Lower raw_stock once per type, from the current value in the database
    const stockWarnings = await decrementStock(countBy(selectedTypes, id => id));
    if (stockWarnings.length) logEvent('warning', `Order ${fmtNum(newOrder.order_number)}: ${stockWarnings.join(' ')}`);

    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Order';

    // 4. Show the order number — it's what gets written on every piece
    el.querySelector('#ord-success-numbers').textContent = fmtNum(newOrder.order_number);
    const warnEl = el.querySelector('#ord-success-warning');
    warnEl.textContent = stockWarnings.join(' ');
    warnEl.style.display = stockWarnings.length ? 'block' : 'none';
    form.style.display       = 'none';
    modalTitle.style.display = 'none';
    successPanel.style.display = 'block';

    currentPage = 1;
    loadOrders(el);
  });

  wireNewCustomer(el, form, cbCustomer);
}

// Lowers raw_stock by the number of new objects of each type.
// Returns readable warnings for anything that didn't go cleanly.
async function decrementStock(countsByType) {
  const { data: fresh, error } = await supabase
    .from('object_types')
    .select('id, name, raw_stock')
    .in('id', [...countsByType.keys()]);
  if (error) return [`Stock wasn't updated (${error.message}). Adjust it on the Stock page.`];

  const warnings = [];
  for (const t of fresh) {
    const used = countsByType.get(t.id);
    const next = Math.max(0, t.raw_stock - used);
    if (t.raw_stock < used) warnings.push(`${t.name}: only ${t.raw_stock} in stock but ${used} used, so stock is now 0.`);

    const { error: upError } = await supabase.from('object_types').update({ raw_stock: next }).eq('id', t.id);
    if (upError) {
      warnings.push(`${t.name}: stock wasn't updated (${upError.message}).`);
      continue;
    }
    const local = allObjectTypes.find(x => x.id === t.id);
    if (local) local.raw_stock = next;
  }
  return warnings;
}

// ─── New customer inline form ─────────────────────────────────────────────────

function wireNewCustomer(el, form, cbCustomer) {
  const toggleBtn   = form.querySelector('#btn-toggle-new-cust');
  const section     = form.querySelector('#new-cust-section');
  const nameInput   = form.querySelector('#new-cust-name');
  const phoneInput  = form.querySelector('#new-cust-phone');
  const notesInput  = form.querySelector('#new-cust-notes-input');
  const dupeNotice  = form.querySelector('#new-cust-dupe-notice');
  const dupeText    = form.querySelector('#new-cust-dupe-text');
  const errorDiv    = form.querySelector('#new-cust-error');
  const createBtn   = form.querySelector('#btn-create-customer');
  const customerSel = form.elements.customer_id;

  toggleBtn.addEventListener('click', () => {
    const isOpen = section.style.display !== 'none';
    section.style.display = isOpen ? 'none' : 'block';
    toggleBtn.textContent = isOpen ? '+ New customer' : '— Cancel';
    if (isOpen) {
      nameInput.value = '';
      phoneInput.value = '';
      notesInput.value = '';
      dupeNotice.style.display = 'none';
      errorDiv.style.display = 'none';
    }
  });

  let dupeTimer;
  phoneInput.addEventListener('input', () => {
    clearTimeout(dupeTimer);
    dupeTimer = setTimeout(() => checkDupe(phoneInput.value.trim()), 300);
  });

  function checkDupe(phone) {
    dupeNotice.style.display = 'none';
    if (!phone) return;
    const digits = p => String(p ?? '').replace(/\D/g, '');
    const found = allCustomers.find(c => digits(c.phone) === digits(phone));
    if (!found) return;

    dupeText.innerHTML = `A customer with this number already exists: <strong>${escHtml(found.name)}</strong>.`;
    const selectBtn = document.createElement('button');
    selectBtn.type = 'button';
    selectBtn.textContent = 'Select them instead →';
    selectBtn.style.cssText = `
      display:block;margin-top:6px;background:none;border:none;cursor:pointer;
      font-family:'Inter',sans-serif;font-size:12px;font-weight:600;
      color:#9C1A4D;text-decoration:underline;text-underline-offset:2px;padding:0;
    `;
    selectBtn.addEventListener('click', () => {
      customerSel.value = found.id;
      cbCustomer.setValue(found.id);
      section.style.display = 'none';
      toggleBtn.textContent = '+ New customer';
    });
    dupeText.appendChild(selectBtn);
    dupeNotice.style.display = 'flex';
  }

  createBtn.addEventListener('click', async () => {
    const name  = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const notes = notesInput.value.trim();

    if (!name || !phone) {
      errorDiv.textContent = 'Name and phone are required.';
      errorDiv.style.display = 'block';
      return;
    }

    errorDiv.style.display = 'none';
    createBtn.disabled = true;
    createBtn.textContent = 'Creating…';

    const { data, error } = await supabase
      .from('customers')
      .insert({ name, phone, notes: notes || null })
      .select('id, name, phone')
      .single();

    createBtn.disabled = false;
    createBtn.textContent = 'Create Customer';

    if (error) {
      logEvent('error', `Couldn't create customer ${name}: ${error.message}`);
      errorDiv.textContent = 'Failed to create: ' + error.message;
      errorDiv.style.display = 'block';
      return;
    }

    allCustomers.push(data);
    allCustomers.sort((a, b) => a.name.localeCompare(b.name));

    customerSel.innerHTML = '<option value="">Select customer…</option>';
    allCustomers.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      customerSel.appendChild(opt);
    });
    cbCustomer.refresh();
    cbCustomer.setValue(data.id);

    section.style.display = 'none';
    toggleBtn.textContent = '+ New customer';
  });
}

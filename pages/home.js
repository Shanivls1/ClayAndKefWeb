// Home: the everyday jobs on one screen.
//   • New order — customer (find or add) → pieces (quick picks or search) → create; shows the number to write on the pieces
//   • Customer collecting? — find their open order, mark the ready pieces collected
//   • To do — counts that open the Orders page already filtered

import { supabase } from '../supabase.js';
import { escHtml, fmtNum, todayLocal, fetchAllRows, pgQuote, debounce, countBy } from '../utils.js';
import { logEvent } from '../log.js';
import { loadSettings, settings } from '../settings.js';
import { normalizePhone } from '../whatsapp.js';
import { createOrder } from '../neworder.js';
import { refreshRemindBadge } from '../navbadge.js';

// ─── State ────────────────────────────────────────────────────────────────────

let pageEl = null, pageSignal = null;
let customers = [];          // { id, name, phone, digits } — all of them, for instant search
let types = [];              // object types, sorted by code
let quickTypes = [];         // most used lately
let customer = null;         // chosen: { id?, name, phone, isNew, stats? }
let pieces = [];             // [{ typeId, qty }] in the order added
let custActive = 0, typeActive = 0;
let creating = false;

const digitsOf = p => String(p ?? '').replace(/\D/g, '');
const ICON = paths => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const I_SEARCH = ICON('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>');
const I_PLUS   = ICON('<path d="M12 5v14M5 12h14"/>');
const I_BAG    = ICON('<path d="M6 7h12l1 13H5L6 7z"/><path d="M9 7a3 3 0 0 1 6 0"/>');
const I_CHECK  = ICON('<polyline points="20 6 9 17 4 12"/>');
const I_ARROW  = ICON('<path d="M5 12h14M13 6l6 6-6 6"/>');

// ─── Render ───────────────────────────────────────────────────────────────────

export function render() {
  return `
    <style>
      .hm { padding:40px 40px 56px;position:relative;z-index:1;max-width:1240px;margin:0 auto; }
      @media (max-width: 640px) { .hm { padding:24px 16px 40px; } }
      .hm-head { margin-bottom:28px; }
      .hm-head h1 { font-family:'Caveat',cursive;font-size:40px;font-weight:700;color:#1a120b;line-height:1; }
      .hm-head p { font-family:'Inter',sans-serif;color:#8a7560;font-size:14px;margin-top:8px; }

      .hm-grid { display:grid;grid-template-columns:minmax(0,3fr) minmax(300px,2fr);gap:28px;align-items:start; }
      @media (max-width: 980px) { .hm-grid { grid-template-columns:1fr; } }

      .hm-card { background:#fff;border:1px solid #ece5dc;border-radius:16px;padding:28px;
        box-shadow:0 1px 2px rgba(45,31,20,.04),0 8px 24px rgba(45,31,20,.04); }
      @media (max-width: 640px) { .hm-card { padding:20px; } }
      .hm-card h2 { font-family:'Inter',sans-serif;font-size:17px;font-weight:700;color:#1a120b;letter-spacing:-.01em;margin-bottom:20px; }
      .hm-part + .hm-part { border-top:1px solid #f1ebe4;margin-top:24px;padding-top:24px; }

      .hm-step + .hm-step { margin-top:22px; }
      .hm-label { display:block;font-family:'Inter',sans-serif;font-size:12.5px;font-weight:600;color:#8a7560;margin-bottom:8px; }
      .hm-label span { font-weight:400;color:#b3a595; }

      .hm-search { position:relative; }
      .hm-search svg { position:absolute;left:13px;top:50%;transform:translateY(-50%);color:#b3a595;pointer-events:none; }
      .hm-input { width:100%;box-sizing:border-box;height:44px;padding:0 14px;border:1px solid #e6dfd6;border-radius:10px;outline:none;background:#fff;
        font-family:'Inter',sans-serif;font-size:14.5px;color:#1a120b;transition:border-color .15s ease,box-shadow .15s ease; }
      .hm-search .hm-input { padding-left:38px; }
      .hm-input:focus { border-color:#9C1A4D;box-shadow:0 0 0 3px rgba(156,26,77,.1); }
      .hm-input::placeholder { color:#b8ab9c; }

      .hm-list { margin-top:6px;border:1px solid #ece5dc;border-radius:10px;overflow:hidden;background:#fff;box-shadow:0 6px 18px rgba(45,31,20,.06); }
      .hm-list[hidden] { display:none; }
      .hm-opt { display:flex;align-items:center;gap:10px;width:100%;padding:9px 14px;border:none;background:#fff;cursor:pointer;text-align:start;font-family:'Inter',sans-serif; }
      .hm-opt + .hm-opt { border-top:1px solid #f5f0eb; }
      .hm-opt:hover, .hm-opt.on { background:#faf6f2; }
      .hm-opt:active { background:#f3ece4; }
      .hm-opt:focus-visible { outline:2px solid #9C1A4D;outline-offset:-2px; }
      .hm-opt .who { flex:1;min-width:0;display:flex;align-items:baseline;gap:10px; }
      .hm-opt .nm { font-size:14px;font-weight:600;color:#1a120b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
      .hm-opt .ph { font-size:13px;color:#a09080;direction:ltr;unicode-bidi:isolate;white-space:nowrap; }
      .hm-opt.new { color:#9C1A4D;font-size:14px;font-weight:600; }
      .hm-empty { padding:10px 14px;font-family:'Inter',sans-serif;font-size:13px;color:#8a7560; }

      .hm-chosen { display:flex;align-items:center;gap:12px;height:44px;padding:0 4px 0 14px;border-radius:10px;background:#faf6f2; }
      .hm-chosen .who { flex:1;min-width:0;display:flex;align-items:baseline;gap:10px;font-family:'Inter',sans-serif;white-space:nowrap;overflow:hidden; }
      .hm-chosen .nm { font-size:14.5px;font-weight:600;color:#1a120b; }
      .hm-chosen .ph { font-size:13px;color:#8a7560;direction:ltr;unicode-bidi:isolate; }
      .hm-tag { font-size:12.5px;color:#a09080;font-weight:400;margin-left:2px; }
      .hm-tag.open { color:#2D7CAD; }

      .hm-link { background:none;border:none;padding:6px 8px;border-radius:7px;cursor:pointer;font-family:'Inter',sans-serif;font-size:13px;font-weight:500;color:#9C1A4D; }
      .hm-link:hover { background:rgba(156,26,77,.06); }
      .hm-link:active { transform:scale(.97); }
      .hm-link:focus-visible { outline:2px solid #9C1A4D;outline-offset:1px; }

      .hm-newcust { display:grid;grid-template-columns:1fr 1fr;gap:10px; }
      @media (max-width: 560px) { .hm-newcust { grid-template-columns:1fr; } }
      .hm-field label { display:block;font-family:'Inter',sans-serif;font-size:12px;color:#a09080;margin-bottom:5px; }
      .hm-note { margin-top:10px;font-family:'Inter',sans-serif;font-size:13px;line-height:1.5; }
      .hm-note.warn { color:#8a6200; }
      .hm-note.err { color:#b3261e; }
      .hm-note[hidden] { display:none; }

      .hm-quick { display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px; }
      .hm-quick:empty { display:none; }
      .hm-chip { height:30px;padding:0 11px;border-radius:8px;cursor:pointer;border:1px solid #ebe3d9;background:#fff;
        font-family:'Inter',sans-serif;font-size:12.5px;font-weight:600;letter-spacing:.02em;color:#5a4a3a;
        transition:transform .18s cubic-bezier(.34,1.56,.64,1),background .12s ease; }
      .hm-chip small { font-weight:500;color:#9C1A4D;margin-left:2px; }
      .hm-chip:hover { background:#faf6f2;border-color:#ddd1c4; }
      .hm-chip:active { transform:scale(.94); }
      .hm-chip:focus-visible { outline:2px solid #9C1A4D;outline-offset:2px; }
      .hm-chip.in { border-color:rgba(156,26,77,.4);color:#9C1A4D; }

      .hm-items { margin-top:6px; }
      .hm-item { display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f3eee8; }
      .hm-code { flex-shrink:0;min-width:44px;font-family:'Inter',sans-serif;font-size:12px;font-weight:700;letter-spacing:.04em;color:#9C1A4D; }
      .hm-item .nm { flex:1;min-width:0;font-family:'Inter',sans-serif;font-size:14px;color:#3a2c1f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
      .hm-qty { display:flex;align-items:center;gap:2px; }
      .hm-qty b { min-width:24px;text-align:center;font-family:'Inter',sans-serif;font-size:14px;font-weight:600;color:#1a120b;font-variant-numeric:tabular-nums; }
      .hm-ibtn { width:28px;height:28px;border-radius:7px;border:none;background:#f5f0eb;cursor:pointer;color:#5a4a3a;
        display:inline-flex;align-items:center;justify-content:center;font-size:15px;line-height:1;transition:transform .15s cubic-bezier(.34,1.56,.64,1); }
      .hm-ibtn:hover { background:#ece4da;color:#1a120b; }
      .hm-ibtn:active { transform:scale(.9); }
      .hm-ibtn:focus-visible { outline:2px solid #9C1A4D;outline-offset:1px; }
      .hm-ibtn.x { background:none;color:#c0b2a3;margin-left:2px; }
      .hm-ibtn.x:hover { color:#b3261e;background:rgba(179,38,30,.06); }

      .hm-extra { display:grid;grid-template-columns:minmax(0,2fr) minmax(150px,1fr);gap:10px; }
      @media (max-width: 560px) { .hm-extra { grid-template-columns:1fr; } }

      .hm-create { margin-top:28px; }
      .hm-go { width:100%;height:48px;border:none;border-radius:11px;cursor:pointer;background:#9C1A4D;color:#fff;
        display:inline-flex;align-items:center;justify-content:center;gap:8px;
        font-family:'Inter',sans-serif;font-size:15px;font-weight:600;
        box-shadow:0 1px 2px rgba(156,26,77,.2),0 6px 16px rgba(156,26,77,.16);transition:transform .18s cubic-bezier(.34,1.56,.64,1),background .12s ease; }
      .hm-go:hover:not(:disabled) { background:#86163f; }
      .hm-go:active:not(:disabled) { transform:scale(.99); }
      .hm-go:focus-visible { outline:3px solid rgba(156,26,77,.3);outline-offset:3px; }
      .hm-go:disabled { background:#e7dbe0;color:#a8939b;box-shadow:none;cursor:not-allowed; }
      .hm-missing { display:block;margin-top:8px;text-align:center;font-family:'Inter',sans-serif;font-size:12.5px;color:#b3a595;min-height:18px; }

      /* done: the number goes on every piece */
      .hm-done { text-align:center;padding:24px 0 8px;animation:hm-in .3s cubic-bezier(.34,1.56,.64,1); }
      @keyframes hm-in { from { opacity:0;transform:translateY(-4px); } to { opacity:1;transform:none; } }
      .hm-big { font-family:'Inter',sans-serif;font-size:88px;font-weight:800;letter-spacing:-.04em;line-height:1;color:#9C1A4D;margin:4px 0 12px;font-variant-numeric:tabular-nums; }
      .hm-done .for { font-family:'Inter',sans-serif;font-size:14.5px;color:#5a4a3a; }
      .hm-done .actions { display:flex;justify-content:center;gap:10px;margin-top:26px;flex-wrap:wrap; }
      .hm-done .hm-go { width:auto;padding:0 26px; }
      .hm-sec { height:48px;padding:0 20px;border-radius:11px;border:1px solid #e6dfd6;background:#fff;cursor:pointer;display:inline-flex;align-items:center;gap:8px;
        font-family:'Inter',sans-serif;font-size:14.5px;font-weight:500;color:#5a4a3a;text-decoration:none;transition:transform .18s cubic-bezier(.34,1.56,.64,1); }
      .hm-sec:hover { background:#faf6f2; }
      .hm-sec:active { transform:scale(.98); }
      .hm-sec:focus-visible { outline:2px solid #9C1A4D;outline-offset:2px; }

      /* collecting */
      .hm-pick { margin-top:4px; }
      .hm-ord { display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:2px 10px;align-items:center;padding:12px 0;border-bottom:1px solid #f3eee8; }
      .hm-ord .no { font-family:'Inter',sans-serif;font-size:13.5px;font-weight:700;color:#9C1A4D; }
      .hm-ord .nm { font-family:'Inter',sans-serif;font-size:14px;font-weight:600;color:#1a120b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
      .hm-ord .st { grid-column:2 / 4;font-family:'Inter',sans-serif;font-size:12.5px;color:#a09080; }
      .hm-ord .st b { color:#2f8a4a;font-weight:600; }
      .hm-collect { height:30px;padding:0 12px;border-radius:8px;border:none;background:#eaf5ee;cursor:pointer;display:inline-flex;align-items:center;gap:6px;
        font-family:'Inter',sans-serif;font-size:12.5px;font-weight:600;color:#2f8a4a;white-space:nowrap;transition:transform .15s cubic-bezier(.34,1.56,.64,1); }
      .hm-collect:hover { background:#2f8a4a;color:#fff; }
      .hm-collect:active { transform:scale(.95); }
      .hm-collect:focus-visible { outline:2px solid #2f8a4a;outline-offset:2px; }
      .hm-collect:disabled { opacity:.5;cursor:default; }
      .hm-ord .wait { font-family:'Inter',sans-serif;font-size:12px;color:#b3a595;white-space:nowrap; }

      /* to do */
      .hm-task { display:flex;align-items:center;gap:14px;padding:11px 8px;margin:0 -8px;border-radius:10px;text-decoration:none;color:inherit;transition:background .12s ease; }
      .hm-task:hover { background:#faf6f2; }
      .hm-task:active { background:#f3ece4; }
      .hm-task:focus-visible { outline:2px solid #9C1A4D;outline-offset:-2px; }
      .hm-task .n { min-width:44px;font-family:'Inter',sans-serif;font-size:20px;font-weight:700;color:#1a120b;font-variant-numeric:tabular-nums; }
      .hm-task .t { flex:1;font-family:'Inter',sans-serif;font-size:14px;color:#3a2c1f; }
      .hm-task .t small { display:none; }
      .hm-task svg { color:#cdbfb1;transition:transform .18s cubic-bezier(.34,1.56,.64,1); }
      .hm-task:hover svg { transform:translateX(3px);color:#9C1A4D; }
      .hm-task.remind .n { color:#2D7CAD; }
      .hm-task.zero .n { color:#d3c7ba; }
      @media (prefers-reduced-motion: reduce) { .hm-done { animation:none; } .hm-chip, .hm-go, .hm-ibtn, .hm-collect, .hm-task svg { transition:none; } }
    </style>

    <svg style="position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;opacity:0.04;" xmlns="http://www.w3.org/2000/svg">
      <filter id="ck-noise-home"><feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
      <rect width="100%" height="100%" filter="url(#ck-noise-home)"/>
    </svg>
    <div style="position:fixed;top:0;right:0;width:600px;height:400px;background:radial-gradient(ellipse farthest-side at top right,rgba(156,26,77,0.08),transparent);pointer-events:none;z-index:0;"></div>

    <div class="hm">
      <div class="hm-head">
        <h1 id="hm-hello">${greeting()}</h1>
        <p id="hm-today">${escHtml(new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }))}</p>
      </div>

      <div class="hm-grid">
        <section class="hm-card" aria-labelledby="hm-new-title">
          <div id="hm-form">
            <h2 id="hm-new-title">New order</h2>

            <div class="hm-step" id="hm-step-cust">
              <span class="hm-label" id="hm-cust-label">Customer</span>
              <div id="hm-cust"></div>
            </div>

            <div class="hm-step" id="hm-step-pieces">
              <span class="hm-label" id="hm-pieces-label">Pieces</span>
              <div class="hm-quick" id="hm-quick" aria-label="Often used"></div>
              <div class="hm-search">
                ${I_SEARCH}
                <input id="hm-type-q" class="hm-input" type="text" autocomplete="off" spellcheck="false"
                  placeholder="Search a type…" aria-labelledby="hm-pieces-label" aria-controls="hm-type-list" />
              </div>
              <div class="hm-list" id="hm-type-list" role="listbox" hidden></div>
              <div class="hm-items" id="hm-items"></div>
            </div>

            <div class="hm-step" id="hm-step-extra">
              <div class="hm-extra">
                <div class="hm-field"><label class="hm-label" for="hm-notes">Note <span>optional</span></label>
                  <input id="hm-notes" class="hm-input" type="text" maxlength="300" /></div>
                <div class="hm-field"><label class="hm-label" for="hm-date">Date</label>
                  <input id="hm-date" class="hm-input" type="date" /></div>
              </div>
            </div>

            <div class="hm-note err" id="hm-error" role="alert" hidden></div>
            <div class="hm-create">
              <button type="button" class="hm-go" id="hm-go" disabled>Create order</button>
              <span class="hm-missing" id="hm-missing" aria-live="polite"></span>
            </div>
          </div>
          <div id="hm-done" hidden></div>
        </section>

        <section class="hm-card">
          <div class="hm-part" aria-labelledby="hm-col-title">
            <h2 id="hm-col-title">Collecting</h2>
            <div class="hm-search">
              ${I_SEARCH}
              <input id="hm-col-q" class="hm-input" type="text" autocomplete="off" spellcheck="false"
                placeholder="Order number, phone or name" aria-labelledby="hm-col-title" />
            </div>
            <div class="hm-pick" id="hm-col-list" aria-live="polite"></div>
          </div>
          <div class="hm-part" aria-labelledby="hm-todo-title">
            <h2 id="hm-todo-title" style="margin-bottom:8px;">To do</h2>
            <nav id="hm-todo" aria-label="To do"></nav>
          </div>
        </section>
      </div>
    </div>`;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

export async function mount(el, signal) {
  pageEl = el; pageSignal = signal;
  customer = null; pieces = []; creating = false;
  el.querySelector('#hm-date').value = todayLocal();
  renderCustomer();
  renderTodo(null);
  wirePieces();
  wireCreate();
  wireCollect();
  el.querySelector('#hm-cust-q')?.focus();

  await loadSettings();
  const [custRes, typeRes] = await Promise.all([
    fetchAllRows(() => supabase.from('customers').select('id, name, phone').order('id')),
    fetchAllRows(() => supabase.from('object_types').select('id, code, name, raw_stock').order('id')),
  ]);
  if (signal.aborted) return;
  if (custRes.error || typeRes.error) {
    const msg = (custRes.error ?? typeRes.error).message;
    logEvent('error', `Home: couldn't load customers or object types: ${msg}`);
    showError(`Couldn't load customers or object types (${msg}). Refresh the page to try again.`);
  }
  customers = (custRes.data ?? []).map(c => ({ ...c, digits: digitsOf(c.phone) }));
  types = (typeRes.data ?? []).sort((a, b) => String(a.code ?? a.name).localeCompare(String(b.code ?? b.name), undefined, { numeric: true }));
  renderCustomer(true);
  loadQuickTypes();
  loadTodo();
}

// ─── Step 1: customer ─────────────────────────────────────────────────────────

// Matches by name (start of a word first) or phone digits ("050-111…", "972 50 111…" and "0501…" all match).
function findCustomers(q) {
  const text = q.trim().toLowerCase();
  if (!text) return [];
  const d = digitsOf(q);
  const isPhone = d.length >= 3 && d.length >= text.replace(/[\s()+-]/g, '').length - 1;
  const local = d.startsWith('0') ? d.slice(1) : d;
  const scored = [];
  for (const c of customers) {
    let score = 0;
    if (isPhone) {
      if (c.digits.includes(d) || (local.length >= 3 && c.digits.includes(local))) score = 3;
    } else {
      const name = String(c.name ?? '').toLowerCase();
      if (name.startsWith(text)) score = 4;
      else if (name.split(/\s+/).some(w => w.startsWith(text))) score = 3;
      else if (name.includes(text)) score = 2;
    }
    if (score) scored.push([score, c]);
  }
  return scored.sort((a, b) => b[0] - a[0] || String(a[1].name).localeCompare(String(b[1].name))).slice(0, 6).map(x => x[1]);
}

// Shows either the search (no customer yet), the new-customer fields, or the chosen customer.
function renderCustomer(keepQuery = false) {
  const box = pageEl.querySelector('#hm-cust');
  const step = pageEl.querySelector('#hm-step-cust');
  const ready = customer && (!customer.isNew || (customer.name.trim() && normalizePhone(customer.phone)));
  step.classList.toggle('done', !!ready);

  if (customer && !customer.isNew) {
    const s = customer.stats;
    const tags = s ? [
      `<span class="hm-tag">${s.visits > 0 ? `${s.visits} visit${s.visits === 1 ? '' : 's'}` : 'first visit'}</span>`,
      s.open_orders > 0 ? `<span class="hm-tag open">${s.open_orders} not collected</span>` : '',
    ].join('') : '';
    box.innerHTML = `
      <div class="hm-chosen">
        <div class="who"><span class="nm">${escHtml(customer.name)}</span><span class="ph">${escHtml(customer.phone || 'No phone')}</span>${tags}</div>
        <button type="button" class="hm-link" id="hm-cust-change">Change</button>
      </div>`;
    box.querySelector('#hm-cust-change').addEventListener('click', () => { customer = null; renderCustomer(); updateCreate(); pageEl.querySelector('#hm-cust-q')?.focus(); });
    updateCreate();
    return;
  }

  if (customer?.isNew) {
    box.innerHTML = `
      <div class="hm-newcust">
        <div class="hm-field"><label for="hm-nc-name">Name</label><input id="hm-nc-name" class="hm-input" type="text" autocomplete="off" maxlength="120" /></div>
        <div class="hm-field"><label for="hm-nc-phone">Phone (for WhatsApp)</label><input id="hm-nc-phone" class="hm-input" type="tel" autocomplete="off" maxlength="30" dir="ltr" placeholder="050-123-4567" /></div>
      </div>
      <div class="hm-note warn" id="hm-nc-dupe" hidden></div>
      <div style="margin-top:6px;"><button type="button" class="hm-link" id="hm-nc-cancel">Search existing customers instead</button></div>`;
    const name = box.querySelector('#hm-nc-name'), phone = box.querySelector('#hm-nc-phone');
    name.value = customer.name; phone.value = customer.phone;
    const sync = () => {
      customer.name = name.value; customer.phone = phone.value;
      pageEl.querySelector('#hm-step-cust').classList.toggle('done', !!(name.value.trim() && normalizePhone(phone.value)));
      checkDupe(box);
      updateCreate();
    };
    name.addEventListener('input', sync);
    phone.addEventListener('input', sync);
    box.querySelector('#hm-nc-cancel').addEventListener('click', () => { customer = null; renderCustomer(); pageEl.querySelector('#hm-cust-q')?.focus(); });
    sync();
    (customer.name ? phone : name).focus();
    return;
  }

  const prev = keepQuery ? pageEl.querySelector('#hm-cust-q')?.value ?? '' : '';
  const hadFocus = document.activeElement?.id === 'hm-cust-q';
  box.innerHTML = `
    <div class="hm-search">
      ${I_SEARCH}
      <input id="hm-cust-q" class="hm-input" type="text" autocomplete="off" spellcheck="false" role="combobox"
        aria-expanded="false" aria-controls="hm-cust-list" aria-labelledby="hm-cust-label" placeholder="Name or phone…" />
    </div>
    <div class="hm-list" id="hm-cust-list" role="listbox" hidden></div>`;
  const input = box.querySelector('#hm-cust-q');
  input.value = prev;
  if (hadFocus || keepQuery) { input.focus(); input.setSelectionRange(prev.length, prev.length); }
  const list = box.querySelector('#hm-cust-list');
  const show = () => { custActive = 0; drawCustomerList(input, list); };
  input.addEventListener('input', show);
  input.addEventListener('keydown', e => {
    const opts = [...list.querySelectorAll('.hm-opt')];
    if (!opts.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      custActive = (custActive + (e.key === 'ArrowDown' ? 1 : opts.length - 1)) % opts.length;
      opts.forEach((o, i) => o.classList.toggle('on', i === custActive));
      input.setAttribute('aria-activedescendant', opts[custActive].id);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      opts[custActive]?.click();
    } else if (e.key === 'Escape') {
      input.value = ''; show();
    }
  });
  updateCreate();
  if (prev) show();
}

function drawCustomerList(input, list) {
  const q = input.value;
  if (!q.trim()) { list.hidden = true; input.setAttribute('aria-expanded', 'false'); return; }
  const found = findCustomers(q);
  const looksPhone = digitsOf(q).length >= 3 && !/[a-zא-ת]/i.test(q);
  list.innerHTML = found.map((c, i) => `
      <button type="button" role="option" id="hm-co-${i}" class="hm-opt${i === custActive ? ' on' : ''}" data-id="${escHtml(c.id)}">
        <span class="who"><span class="nm">${escHtml(c.name)}</span><span class="ph">${escHtml(c.phone || 'No phone')}</span></span>
      </button>`).join('') +
    `<button type="button" role="option" id="hm-co-${found.length}" class="hm-opt new${found.length === custActive ? ' on' : ''}" data-new="1">
       ${I_PLUS}<span>New customer</span></button>`;
  list.hidden = false;
  input.setAttribute('aria-expanded', 'true');
  list.querySelectorAll('.hm-opt').forEach(o => o.addEventListener('click', () => {
    if (o.dataset.new) {
      customer = { isNew: true, name: looksPhone ? '' : q.trim(), phone: looksPhone ? q.trim() : '' };
    } else {
      const c = customers.find(x => x.id === o.dataset.id);
      customer = { id: c.id, name: c.name, phone: c.phone, isNew: false };
      loadCustomerStats(c.id);
    }
    renderCustomer();
    if (!customer.isNew) pageEl.querySelector('#hm-type-q').focus();
  }));
}

async function loadCustomerStats(id) {
  const { data } = await supabase.from('customer_list').select('visits, open_orders').eq('id', id).maybeSingle();
  if (pageSignal?.aborted || customer?.id !== id || !data) return;
  customer.stats = { visits: Number(data.visits ?? 0), open_orders: Number(data.open_orders ?? 0) };
  renderCustomer();
}

// A new customer whose number is already in the list → offer to use that customer.
function checkDupe(box) {
  const note = box.querySelector('#hm-nc-dupe');
  const n = normalizePhone(customer.phone);
  const found = n && customers.find(c => normalizePhone(c.phone) === n);
  note.hidden = !found;
  if (!found) return;
  note.innerHTML = `This number already belongs to <strong>${escHtml(found.name)}</strong>.
    <button type="button" class="hm-link" id="hm-nc-use">Use ${escHtml(found.name.split(' ')[0])} instead</button>`;
  note.querySelector('#hm-nc-use').addEventListener('click', () => {
    customer = { id: found.id, name: found.name, phone: found.phone, isNew: false };
    loadCustomerStats(found.id);
    renderCustomer();
    pageEl.querySelector('#hm-type-q').focus();
  });
}

// ─── Step 2: pieces ───────────────────────────────────────────────────────────

const typeLabel = t => t.code && t.name && t.name !== t.code ? t.name : '';

// The types used most in the latest 300 orders — one click adds one.
async function loadQuickTypes() {
  const { data, error } = await supabase.from('orders').select('objects(object_type_id)')
    .order('received_at', { ascending: false }).order('created_at', { ascending: false }).limit(300);
  if (pageSignal?.aborted || error) return;
  const counts = countBy((data ?? []).flatMap(o => o.objects ?? []), x => x.object_type_id);
  quickTypes = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id]) => types.find(t => t.id === id)).filter(Boolean);
  renderQuick();
}

function renderQuick() {
  const box = pageEl.querySelector('#hm-quick');
  box.innerHTML = quickTypes.map(t => {
    const n = pieces.find(p => p.typeId === t.id)?.qty ?? 0;
    return `<button type="button" class="hm-chip${n ? ' in' : ''}" data-id="${escHtml(t.id)}" title="${escHtml(t.name)} — click to add one">
      ${escHtml(t.code || t.name)}${n ? ` <small>×${n}</small>` : ''}</button>`;
  }).join('');
  box.querySelectorAll('.hm-chip').forEach(b => b.addEventListener('click', () => addPiece(b.dataset.id)));
}

function findTypes(q) {
  const text = q.trim().toLowerCase();
  if (!text) return [];
  const score = t => {
    const code = String(t.code ?? '').toLowerCase(), name = String(t.name ?? '').toLowerCase();
    if (code === text) return 5;
    if (code.startsWith(text)) return 4;
    if (name.startsWith(text)) return 3;
    if (code.includes(text) || name.includes(text)) return 2;
    return 0;
  };
  return types.map(t => [score(t), t]).filter(x => x[0]).sort((a, b) => b[0] - a[0]).slice(0, 8).map(x => x[1]);
}

function wirePieces() {
  const input = pageEl.querySelector('#hm-type-q');
  const list  = pageEl.querySelector('#hm-type-list');
  const draw = () => {
    const found = findTypes(input.value);
    if (!input.value.trim()) { list.hidden = true; return; }
    list.innerHTML = found.length ? found.map((t, i) => `
      <button type="button" role="option" class="hm-opt${i === typeActive ? ' on' : ''}" data-id="${escHtml(t.id)}">
        <span class="hm-code">${escHtml(t.code || '—')}</span><span class="who"><span class="nm" style="font-weight:400;">${escHtml(typeLabel(t) || t.name)}</span></span>
      </button>`).join('') : `<div class="hm-empty">No object type matches “${escHtml(input.value.trim())}”. Add new types on the Stock page.</div>`;
    list.hidden = false;
    list.querySelectorAll('.hm-opt').forEach(o => o.addEventListener('click', () => { addPiece(o.dataset.id); input.value = ''; draw(); input.focus(); }));
  };
  input.addEventListener('input', () => { typeActive = 0; draw(); });
  input.addEventListener('keydown', e => {
    const opts = [...list.querySelectorAll('.hm-opt')];
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && opts.length) {
      e.preventDefault();
      typeActive = (typeActive + (e.key === 'ArrowDown' ? 1 : opts.length - 1)) % opts.length;
      opts.forEach((o, i) => o.classList.toggle('on', i === typeActive));
    } else if (e.key === 'Enter' && opts.length) {
      e.preventDefault();
      opts[typeActive].click();
    } else if (e.key === 'Escape') {
      input.value = ''; draw();
    }
  });
  pageEl.querySelector('#hm-items').addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const p = pieces.find(x => x.typeId === b.dataset.id);
    if (!p) return;
    if (b.dataset.act === 'plus') p.qty++;
    if (b.dataset.act === 'minus') p.qty--;
    if (b.dataset.act === 'remove' || p.qty <= 0) pieces = pieces.filter(x => x !== p);
    renderPieces(b.dataset.act !== 'remove' && p.qty > 0 ? `[data-act="${b.dataset.act}"][data-id="${b.dataset.id}"]` : '#hm-type-q');
  });
}

function addPiece(typeId) {
  const p = pieces.find(x => x.typeId === typeId);
  if (p) p.qty++;
  else pieces.push({ typeId, qty: 1 });
  renderPieces();
}

function renderPieces(focusSel) {
  const box = pageEl.querySelector('#hm-items');
  box.innerHTML = pieces.map(p => {
    const t = types.find(x => x.id === p.typeId);
    const id = escHtml(p.typeId);
    return `<div class="hm-item">
      <span class="hm-code">${escHtml(t?.code || '—')}</span>
      <span class="nm">${escHtml(typeLabel(t ?? {}) || t?.name || '')}</span>
      <span class="hm-qty">
        <button type="button" class="hm-ibtn" data-act="minus" data-id="${id}" aria-label="One fewer ${escHtml(t?.code ?? '')}">−</button>
        <b aria-label="${p.qty} pieces">${p.qty}</b>
        <button type="button" class="hm-ibtn" data-act="plus" data-id="${id}" aria-label="One more ${escHtml(t?.code ?? '')}">+</button>
      </span>
      <button type="button" class="hm-ibtn x" data-act="remove" data-id="${id}" aria-label="Remove ${escHtml(t?.code ?? '')}">×</button>
    </div>`;
  }).join('');
  pageEl.querySelector('#hm-step-pieces').classList.toggle('done', pieces.length > 0);
  renderQuick();
  updateCreate();
  if (focusSel) pageEl.querySelector(focusSel)?.focus();
}

// ─── Create ───────────────────────────────────────────────────────────────────

const pieceCount = () => pieces.reduce((n, p) => n + p.qty, 0);

function updateCreate() {
  const go = pageEl.querySelector('#hm-go');
  const missing = pageEl.querySelector('#hm-missing');
  if (!go) return;
  const custOk = customer && (!customer.isNew || (customer.name.trim() && normalizePhone(customer.phone)));
  const n = pieceCount();
  go.disabled = creating || !custOk || !n;
  go.textContent = creating ? 'Creating…' : n ? `Create order · ${n} piece${n === 1 ? '' : 's'}` : 'Create order';
  missing.textContent = creating ? '' : !customer ? 'Choose the customer first.'
    : customer.isNew && !customer.name.trim() ? 'Type the customer’s name.'
    : customer.isNew && !normalizePhone(customer.phone) ? 'Add a phone number WhatsApp can use.'
    : !n ? 'Add at least one piece.' : '';
}

function showError(text) {
  const box = pageEl.querySelector('#hm-error');
  box.textContent = text;
  box.hidden = !text;
}

function wireCreate() {
  pageEl.querySelector('#hm-go').addEventListener('click', submit);
}

async function submit() {
  if (creating || !customer || !pieceCount()) return;
  creating = true;
  showError('');
  updateCreate();

  // a new customer is saved first; if the order then fails, they stay chosen so nothing is created twice
  if (customer.isNew) {
    const name = customer.name.trim(), phone = customer.phone.trim();
    const { data, error } = await supabase.from('customers').insert({ name, phone }).select('id, name, phone').single();
    if (pageSignal?.aborted) return;
    if (error) {
      creating = false;
      logEvent('error', `Couldn't create customer ${name}: ${error.message}`);
      showError(`Couldn't save the new customer: ${error.message}`);
      updateCreate();
      return;
    }
    customers.push({ ...data, digits: digitsOf(data.phone) });
    customer = { id: data.id, name: data.name, phone: data.phone, isNew: false, stats: { visits: 0, open_orders: 0 } };
    renderCustomer();
  }

  const typeIds = pieces.flatMap(p => Array(p.qty).fill(p.typeId));
  const result = await createOrder({
    customerId: customer.id,
    receivedAt: pageEl.querySelector('#hm-date').value || todayLocal(),
    notes: pageEl.querySelector('#hm-notes').value.trim(),
    typeIds,
  });
  if (pageSignal?.aborted) return;
  creating = false;
  if (result.error) {
    showError(result.error);
    updateCreate();
    return;
  }
  result.stock.forEach((next, id) => { const t = types.find(x => x.id === id); if (t) t.raw_stock = next; });
  showDone(result.order, result.warnings);
  loadTodo();
}

function showDone(order, warnings) {
  const num = fmtNum(order.order_number);
  const summary = pieces.map(p => {
    const t = types.find(x => x.id === p.typeId);
    return `${t?.code || t?.name || '?'}${p.qty > 1 ? ` ×${p.qty}` : ''}`;
  }).join(', ');
  const n = pieceCount();
  const done = pageEl.querySelector('#hm-done');
  done.innerHTML = `
    <div class="hm-done" role="status">
      <div class="hm-big" id="hm-done-num">${escHtml(num)}</div>
      <div class="for"><strong>${escHtml(customer.name)}</strong> · ${n} piece${n === 1 ? '' : 's'}: ${escHtml(summary)}</div>
      ${warnings.length ? `<div class="hm-note warn" style="max-width:520px;margin:14px auto 0;">${escHtml(warnings.join(' '))}</div>` : ''}
      <div class="actions">
        <button type="button" class="hm-go" id="hm-again">${I_PLUS} Next order</button>
        <a class="hm-sec" href="#/orders?q=${encodeURIComponent(String(order.order_number))}">View order ${I_ARROW}</a>
      </div>
    </div>`;
  pageEl.querySelector('#hm-form').hidden = true;
  done.hidden = false;
  done.querySelector('#hm-again').addEventListener('click', resetForm);
  done.querySelector('#hm-again').focus();
}

function resetForm() {
  customer = null; pieces = []; creating = false;
  pageEl.querySelector('#hm-notes').value = '';
  pageEl.querySelector('#hm-date').value = todayLocal();
  pageEl.querySelector('#hm-type-q').value = '';
  pageEl.querySelector('#hm-type-list').hidden = true;
  showError('');
  renderPieces();
  renderCustomer();
  pageEl.querySelector('#hm-done').hidden = true;
  pageEl.querySelector('#hm-form').hidden = false;
  pageEl.querySelector('#hm-cust-q').focus();
}

// ─── Customer collecting ──────────────────────────────────────────────────────

let colSeq = 0;
const collected = new Map(); // orderId → piece ids just collected (for Undo)

function wireCollect() {
  const input = pageEl.querySelector('#hm-col-q');
  input.addEventListener('input', debounce(() => searchCollect(input.value), 250));
  pageEl.querySelector('#hm-col-list').addEventListener('click', e => {
    const b = e.target.closest('[data-collect], [data-undo]');
    if (b?.dataset.collect) collectOrder(b.dataset.collect);
    if (b?.dataset.undo) undoCollect(b.dataset.undo);
  });
}

let colRows = [];

async function searchCollect(raw) {
  const list = pageEl.querySelector('#hm-col-list');
  const q = raw.trim();
  const seq = ++colSeq;
  if (!q) { list.innerHTML = ''; colRows = []; return; }
  let query = supabase.from('order_list')
    .select('id, order_number, customer_name, customer_phone, received_at, ready, waiting, containers, stage')
    .in('stage', ['ready', 'waiting']);
  const num = q.replace(/^#/, '');
  if (/^\d{1,4}$/.test(num))      query = query.eq('order_number', Number(num));
  else if (/^[\d\s+-]+$/.test(q)) query = query.ilike('customer_phone', `%${q.replace(/\D/g, '').replace(/^0/, '')}%`);
  else                            query = query.or(`customer_name.ilike.${pgQuote(`%${q}%`)},customer_phone.ilike.${pgQuote(`%${q}%`)}`);
  const { data, error } = await query.order('received_at', { ascending: false }).limit(6);
  if (seq !== colSeq || pageSignal?.aborted) return;
  if (error) {
    logEvent('error', `Home: couldn't search orders to collect: ${error.message}`);
    list.innerHTML = `<div class="hm-empty">Couldn't search — ${escHtml(error.message)}</div>`;
    return;
  }
  colRows = data ?? [];
  drawCollect();
}

function drawCollect() {
  const list = pageEl.querySelector('#hm-col-list');
  if (!colRows.length) {
    list.innerHTML = `<div class="hm-empty">No open order matches.</div>`;
    return;
  }
  list.innerHTML = colRows.map(o => {
    const id = escHtml(o.id);
    const ready = Number(o.ready ?? 0), waiting = Number(o.waiting ?? 0);
    const boxes = String(o.containers ?? '').trim().split(/\s+/).filter(Boolean);
    if (collected.has(o.id)) {
      const n = collected.get(o.id).length;
      return `<div class="hm-ord collected">
        <span class="no">${escHtml(fmtNum(o.order_number))}</span><span class="nm">${escHtml(o.customer_name)}</span>
        <button type="button" class="hm-link" data-undo="${id}">Undo</button>
        <span class="st">${I_CHECK} <b>${n} piece${n === 1 ? '' : 's'} collected</b></span></div>`;
    }
    const parts = [];
    if (ready) parts.push(`<b>${ready} ready</b>${boxes.length ? ` in ${escHtml(boxes.join(', '))}` : ''}`);
    if (waiting) parts.push(`${waiting} still being fired`);
    return `<div class="hm-ord">
      <span class="no">${escHtml(fmtNum(o.order_number))}</span><span class="nm">${escHtml(o.customer_name)}</span>
      ${ready ? `<button type="button" class="hm-collect" data-collect="${id}">${I_BAG} Collect ${ready > 1 ? `all ${ready}` : ''}</button>` : '<span class="wait">Not ready yet</span>'}
      <span class="st">${parts.join(' · ')} · came in ${escHtml(new Date(o.received_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }))}</span></div>`;
  }).join('');
}

async function collectOrder(orderId) {
  const btn = pageEl.querySelector(`[data-collect="${CSS.escape(orderId)}"]`);
  if (btn) btn.disabled = true;
  const at = new Date().toISOString();
  const { data, error } = await supabase.from('objects')
    .update({ status: 'picked_up', picked_up_at: at })
    .eq('order_id', orderId).eq('status', 'ready')
    .select('id');
  if (pageSignal?.aborted) return;
  const o = colRows.find(r => r.id === orderId);
  if (error) {
    if (btn) btn.disabled = false;
    logEvent('error', `Home: couldn't mark order ${fmtNum(o?.order_number)} collected: ${error.message}`);
    showColError(`Couldn't save — ${error.message}`);
    return;
  }
  collected.set(orderId, (data ?? []).map(x => x.id));
  drawCollect();
  loadTodo();
  refreshRemindBadge();
}

async function undoCollect(orderId) {
  const ids = collected.get(orderId) ?? [];
  if (!ids.length) return;
  const { error } = await supabase.from('objects').update({ status: 'ready', picked_up_at: null }).in('id', ids);
  if (pageSignal?.aborted) return;
  if (error) {
    logEvent('error', `Home: couldn't undo collecting: ${error.message}`);
    showColError(`Couldn't undo — ${error.message}`);
    return;
  }
  collected.delete(orderId);
  drawCollect();
  loadTodo();
  refreshRemindBadge();
}

function showColError(text) {
  const list = pageEl.querySelector('#hm-col-list');
  const note = document.createElement('div');
  note.className = 'hm-note err';
  note.setAttribute('role', 'alert');
  note.textContent = text;
  list.prepend(note);
}

// ─── To do ────────────────────────────────────────────────────────────────────

async function loadTodo() {
  const head = q => q.select('id', { count: 'exact', head: true });
  const today = todayLocal();
  const [waiting, toTell, remind, todayOrders] = await Promise.all([
    head(supabase.from('objects')).eq('status', 'received'),
    head(supabase.from('order_list')).eq('stage', 'ready').gt('ready_untold', 0),
    settings().reminders ? head(supabase.from('order_list')).gt('reminder_due', 0) : Promise.resolve({ count: 0 }),
    head(supabase.from('orders')).gte('received_at', today),
  ]);
  if (pageSignal?.aborted) return;
  renderTodo({ waiting: waiting.count, toTell: toTell.count, remind: remind.count });
  const n = todayOrders.count;
  if (n != null) {
    pageEl.querySelector('#hm-today').textContent =
      `${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · ${n ? `${n} order${n === 1 ? '' : 's'} so far today` : 'no orders yet today'}`;
  }
}

function renderTodo(c) {
  const box = pageEl.querySelector('#hm-todo');
  const task = (n, href, title, cls = '') => `
    <a class="hm-task ${cls}${n === 0 ? ' zero' : ''}" href="${href}">
      <span class="n">${n == null ? '…' : n}</span><span class="t">${title}</span>${I_ARROW}</a>`;
  box.innerHTML =
    task(c?.waiting, '#/orders?stage=waiting', 'Pieces to fire') +
    task(c?.toTell, '#/orders?wa=to_tell', 'WhatsApp to send') +
    (settings().reminders ? task(c?.remind, '#/orders?wa=remind', 'Pickup reminders', 'remind') : '');
}

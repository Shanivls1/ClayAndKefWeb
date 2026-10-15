// Shared list controls: the filter bar (chips, selects, dates) and the pager, styled the same on every page.
import { escHtml } from './utils.js';

export const PAGE_SIZES = [10, 25, 50, 100];

export const LIST_CSS = `
  <style>
    .fbar { display:flex;flex-direction:column;gap:12px;margin-bottom:16px; }
    .fbar-row { display:flex;flex-wrap:wrap;align-items:center;gap:10px 18px; }
    .fsearch { position:relative;flex:1;min-width:260px; }
    .fsearch input {
      width:100%;box-sizing:border-box;padding:10px 16px 10px 42px;font-family:'Inter',sans-serif;font-size:14px;color:#1a120b;
      background:#fff;border:1px solid #e0d8cf;border-radius:99px;outline:none;box-shadow:0 1px 3px rgba(45,31,20,.05);
    }
    .fsearch input:focus { border-color:#9C1A4D;box-shadow:0 0 0 3px rgba(156,26,77,.13); }
    .fsearch svg { position:absolute;left:16px;top:50%;transform:translateY(-50%);width:16px;height:16px;stroke:#8a7560;fill:none;stroke-width:2;stroke-linecap:round;pointer-events:none; }
    .fgroup { display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap; }
    .flabel { font-family:'Inter',sans-serif;font-size:12px;font-weight:600;color:#8a7560;margin-right:2px; }
    .fchip {
      padding:6px 12px;border-radius:999px;border:1px solid #e3dad0;background:#fff;cursor:pointer;
      font-family:'Inter',sans-serif;font-size:12.5px;font-weight:500;color:#5a4a3a;
      transition:transform .18s cubic-bezier(.34,1.56,.64,1);
    }
    .fchip:hover:not(.on) { background:#f7f2ec;border-color:#d4c5b2; }
    .fchip:active { transform:scale(.95); }
    .fchip:focus-visible, .fselect:focus-visible, .fdate:focus-visible, .fclear:focus-visible, .pg-btn:focus-visible { outline:2px solid #9C1A4D;outline-offset:2px; }
    .fchip.on { background:#9C1A4D;border-color:#9C1A4D;color:#fff;box-shadow:0 2px 8px rgba(156,26,77,.28); }
    .fselect, .fdate {
      padding:6px 10px;border-radius:9px;border:1px solid #e3dad0;background:#fff;
      font-family:'Inter',sans-serif;font-size:12.5px;color:#4a3a2c;cursor:pointer;max-width:240px;
    }
    .fdate { cursor:text; }
    .fclear { background:none;border:none;padding:4px 2px;cursor:pointer;font-family:'Inter',sans-serif;font-size:12.5px;font-weight:600;color:#9C1A4D;text-decoration:underline;text-underline-offset:2px; }
    .fclear[hidden] { display:none; }
    .ftoggle {
      display:inline-flex;align-items:center;gap:7px;padding:9px 14px;border-radius:99px;cursor:pointer;
      border:1px solid #e0d8cf;background:#fff;font-family:'Inter',sans-serif;font-size:13px;font-weight:600;color:#4a3a2c;
      box-shadow:0 1px 3px rgba(45,31,20,.05);transition:transform .18s cubic-bezier(.34,1.56,.64,1);
    }
    .ftoggle:hover { background:#f7f2ec;border-color:#d4c5b2; }
    .ftoggle:active { transform:scale(.96); }
    .ftoggle:focus-visible { outline:2px solid #9C1A4D;outline-offset:2px; }
    .ftoggle[aria-expanded="true"] { border-color:#9C1A4D;color:#9C1A4D; }
    .ftoggle svg { width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round; }
    .ftoggle-count { min-width:20px;height:20px;padding:0 6px;border-radius:99px;background:#9C1A4D;color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center; }
    .ftoggle-count[hidden] { display:none; }
    .fbar-more { display:flex;flex-direction:column;gap:12px;padding:14px 16px;border-radius:14px;background:#fff;border:1px solid #ece4da; }
    .fbar-more[hidden] { display:none; }

    .pager { display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px 16px;margin-top:14px;font-family:'Inter',sans-serif; }
    .pg-info { font-size:12.5px;color:#8a7560; }
    .pg-info strong { color:#4a3a2c;font-weight:600; }
    .pg-nav { display:flex;align-items:center;gap:4px; }
    .pg-btn {
      min-width:32px;height:32px;padding:0 9px;border-radius:8px;border:1px solid #e3dad0;background:#fff;cursor:pointer;
      font-family:'Inter',sans-serif;font-size:12.5px;font-weight:500;color:#5a4a3a;
      transition:transform .18s cubic-bezier(.34,1.56,.64,1);
    }
    .pg-btn:hover:not(:disabled):not(.on) { background:#f7f2ec;border-color:#d4c5b2; }
    .pg-btn:active:not(:disabled) { transform:scale(.94); }
    .pg-btn.on { background:#9C1A4D;border-color:#9C1A4D;color:#fff;font-weight:700; }
    .pg-btn:disabled { opacity:.35;cursor:not-allowed; }
    .pg-gap { padding:0 4px;color:#b0a090;font-size:12px; }
    .pg-size { font-size:12.5px;color:#8a7560;display:flex;align-items:center;gap:6px; }
    @media (prefers-reduced-motion: reduce) { .fchip, .pg-btn, .ftoggle { transition:none; } }
  </style>`;

const SEARCH_ICON = `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`;

export function searchBox(id, placeholder, value = '') {
  return `<div class="fsearch">${SEARCH_ICON}<input id="${id}" type="search" placeholder="${escHtml(placeholder)}" value="${escHtml(value)}" autocomplete="off" /></div>`;
}

// Single-choice chips. options: [[value, label], …]
export function chipGroup(name, label, options, value) {
  return `<div class="fgroup" role="group" aria-label="${escHtml(label)}">
    <span class="flabel">${escHtml(label)}</span>
    ${options.map(([v, l]) => `<button type="button" class="fchip${v === value ? ' on' : ''}" data-fgroup="${name}" data-value="${escHtml(v)}" aria-pressed="${v === value}">${escHtml(l)}</button>`).join('')}
  </div>`;
}

export function selectBox(name, label, options, value) {
  return `<label class="fgroup"><span class="flabel">${escHtml(label)}</span>
    <select class="fselect" data-fselect="${name}">
      ${options.map(([v, l]) => `<option value="${escHtml(v)}"${v === value ? ' selected' : ''}>${escHtml(l)}</option>`).join('')}
    </select></label>`;
}

export function dateRange(label, from, to) {
  return `<div class="fgroup"><span class="flabel">${escHtml(label)}</span>
    <input type="date" class="fdate" data-fdate="from" value="${escHtml(from)}" aria-label="${escHtml(label)} from" />
    <span class="flabel" style="margin:0;">–</span>
    <input type="date" class="fdate" data-fdate="to" value="${escHtml(to)}" aria-label="${escHtml(label)} to" /></div>`;
}

// "Filters" button that shows/hides the filter rows; the badge counts filters that are on.
export function filterToggle(count, open) {
  return `<button type="button" class="ftoggle" data-ftoggle aria-expanded="${open}" aria-controls="fbar-more">
    <svg viewBox="0 0 24 24"><path d="M3 5h18l-7 8.5V19l-4 2v-7.5z"/></svg>Filters
    <span class="ftoggle-count" ${count ? '' : 'hidden'}>${count}</span></button>`;
}

export function updateToggle(root, count) {
  const badge = root.querySelector('[data-ftoggle] .ftoggle-count');
  if (!badge) return;
  badge.hidden = !count;
  badge.textContent = count;
}

export function clearButton(activeCount) {
  return `<button type="button" class="fclear" data-fclear ${activeCount ? '' : 'hidden'}>Clear filters (${activeCount})</button>`;
}

// Wires chips / selects / dates inside `root`. onChange(name, value) — dates use names 'from' / 'to'.
export function wireFilters(root, onChange, onClear) {
  root.querySelectorAll('[data-fgroup]').forEach(b => b.addEventListener('click', () => {
    root.querySelectorAll(`[data-fgroup="${b.dataset.fgroup}"]`).forEach(x => {
      x.classList.toggle('on', x === b);
      x.setAttribute('aria-pressed', x === b);
    });
    onChange(b.dataset.fgroup, b.dataset.value);
  }));
  root.querySelectorAll('[data-fselect]').forEach(s => s.addEventListener('change', () => onChange(s.dataset.fselect, s.value)));
  root.querySelectorAll('[data-fdate]').forEach(d => d.addEventListener('change', () => onChange(d.dataset.fdate, d.value)));
  root.querySelector('[data-fclear]')?.addEventListener('click', onClear);
}

// How many filters differ from their defaults (search counts too).
export function activeCount(filters, defaults) {
  return Object.keys(defaults).filter(k => k !== 'sort' && String(filters[k] ?? '') !== String(defaults[k] ?? '')).length;
}

export function updateClear(root, count) {
  const b = root.querySelector('[data-fclear]');
  if (!b) return;
  b.hidden = !count;
  b.textContent = `Clear filters (${count})`;
}

// Pager: "1–25 of 4,016 orders", page buttons with gaps, page-size choice.
export function renderPager(container, { page, pageSize, total, noun, onPage, onPageSize }) {
  if (!container) return;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from  = total ? (page - 1) * pageSize + 1 : 0;
  const to    = Math.min(page * pageSize, total);
  const fmt   = n => n.toLocaleString('en-US');

  const nums = new Set([1, pages, page - 2, page - 1, page, page + 1, page + 2].filter(n => n >= 1 && n <= pages));
  const seq = [...nums].sort((a, b) => a - b);
  const buttons = [];
  seq.forEach((n, i) => {
    if (i && n - seq[i - 1] > 1) buttons.push('<span class="pg-gap">…</span>');
    buttons.push(`<button type="button" class="pg-btn${n === page ? ' on' : ''}" data-page="${n}" ${n === page ? 'aria-current="page"' : ''}>${n}</button>`);
  });

  container.innerHTML = `
    <span class="pg-info">${total ? `<strong>${fmt(from)}–${fmt(to)}</strong> of ${fmt(total)} ${escHtml(noun)}` : `No ${escHtml(noun)}`}</span>
    ${pages > 1 ? `<nav class="pg-nav" aria-label="Pages">
      <button type="button" class="pg-btn" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''} aria-label="Previous page">‹</button>
      ${buttons.join('')}
      <button type="button" class="pg-btn" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''} aria-label="Next page">›</button>
    </nav>` : ''}
    <label class="pg-size">Show
      <select class="fselect" data-pagesize>${PAGE_SIZES.map(n => `<option value="${n}"${n === pageSize ? ' selected' : ''}>${n}</option>`).join('')}</select>
    </label>`;
  container.className = 'pager';
  container.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => onPage(Number(b.dataset.page))));
  container.querySelector('[data-pagesize]').addEventListener('change', e => onPageSize(Number(e.target.value)));
}

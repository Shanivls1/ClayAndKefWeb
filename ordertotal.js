// "Total to pay" for a new order, with a Details list of each piece — used on Home and in the Orders page's New order.
//
//   orderLines(typeIds, types)  → [{ code, name, price, qty }] grouped by type, in the order first added
//   totalHtml(lines, { done, open })  → the block's HTML (done: the order was just created; open: Details expanded)
//   isOpen(container)            → whether the Details inside it are expanded, to keep them so after a re-render
//
// Prices are the customer price (object_types.price). A type without a price counts as ₪0 and is pointed out.

const CSS = `
  .ot { margin-top:14px;border-top:1px solid #f1ebe4;padding-top:12px;font-family:'Inter',sans-serif; }
  .ot-row { display:flex;align-items:baseline;justify-content:space-between;gap:12px; }
  .ot-label { font-size:14px;font-weight:600;color:#3a2c1f; }
  .ot-sum { font-size:22px;font-weight:700;color:#1a120b;letter-spacing:-.01em;font-variant-numeric:tabular-nums; }
  .ot.done { border-top:none;margin-top:6px;padding-top:0;max-width:420px;margin-left:auto;margin-right:auto;text-align:start; }
  .ot.done .ot-row { justify-content:center;gap:12px; }
  .ot.done .ot-sum { font-size:26px; }
  .ot details { margin-top:6px; }
  .ot summary { display:inline-flex;align-items:center;gap:6px;cursor:pointer;list-style:none;font-size:13px;font-weight:600;color:#9C1A4D;
    padding:4px 6px;margin-left:-6px;border-radius:7px; }
  .ot summary::-webkit-details-marker { display:none; }
  .ot summary::before { content:'';width:6px;height:6px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;
    transform:rotate(-45deg);transition:transform .18s cubic-bezier(.34,1.56,.64,1);margin-right:2px; }
  .ot details[open] summary::before { transform:rotate(45deg); }
  .ot summary:hover { background:rgba(156,26,77,.06); }
  .ot summary:focus-visible { outline:2px solid #9C1A4D;outline-offset:1px; }
  .ot.done details { text-align:center; }
  .ot table { width:100%;border-collapse:collapse;margin-top:6px;font-size:13.5px;color:#3a2c1f;text-align:start; }
  .ot td { padding:6px 0;border-bottom:1px solid #f5f0eb;vertical-align:baseline; }
  .ot td.code { width:1%;white-space:nowrap;padding-right:10px;font-size:12px;font-weight:700;letter-spacing:.04em;color:#9C1A4D; }
  .ot td.calc { white-space:nowrap;color:#8a7560;text-align:right;padding-left:10px; }
  .ot td.sub { width:1%;white-space:nowrap;text-align:right;padding-left:14px;font-weight:600;font-variant-numeric:tabular-nums; }
  .ot td.none { color:#b45309;font-weight:500; }
  .ot .ot-warn { margin-top:8px;font-size:12.5px;color:#b45309; }
  @media (prefers-reduced-motion: reduce) { .ot summary::before { transition:none; } }
`;

function ensureStyles() {
  if (document.getElementById('ot-styles')) return;
  const s = document.createElement('style');
  s.id = 'ot-styles';
  s.textContent = CSS;
  document.head.appendChild(s);
}

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const shekels = n => `₪${Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const priced = p => p != null && p !== '' && Number(p) > 0;

export function orderLines(typeIds, types) {
  const lines = new Map();
  for (const id of typeIds) {
    if (!id) continue;
    const t = types.find(x => x.id === id);
    const line = lines.get(id) ?? { code: t?.code ?? '', name: t?.name ?? 'Piece', price: t?.price ?? null, qty: 0 };
    line.qty++;
    lines.set(id, line);
  }
  return [...lines.values()];
}

export const isOpen = box => !!box?.querySelector('.ot details')?.open;

export function totalHtml(lines, { done = false, open = false } = {}) {
  ensureStyles();
  if (!lines.length) return '';
  const total = lines.reduce((n, l) => n + (priced(l.price) ? Number(l.price) * l.qty : 0), 0);
  const pieces = lines.reduce((n, l) => n + l.qty, 0);
  const missing = lines.filter(l => !priced(l.price));
  const rows = lines.map(l => {
    const has = priced(l.price);
    const name = l.name && l.name !== l.code ? esc(l.name) : '';
    return `<tr>
      <td class="code">${esc(l.code || '—')}</td>
      <td>${name}</td>
      <td class="calc">${has ? `${l.qty} × ${shekels(l.price)}` : `${l.qty} ×`}</td>
      <td class="sub${has ? '' : ' none'}">${has ? shekels(Number(l.price) * l.qty) : 'No price'}</td>
    </tr>`;
  }).join('');
  return `
    <div class="ot${done ? ' done' : ''}" data-total="${total}">
      <div class="ot-row"><span class="ot-label">Total to pay</span><span class="ot-sum">${shekels(total)}</span></div>
      ${missing.length ? `<div class="ot-warn">${missing.map(l => esc(l.code || l.name)).join(', ')} ${missing.length === 1 ? 'has' : 'have'} no price yet, so ${missing.length === 1 ? 'it isn’t' : 'they aren’t'} in the total. Set the price on the Stock page.</div>` : ''}
      <details${open ? ' open' : ''}>
        <summary>Details · ${pieces} piece${pieces === 1 ? '' : 's'}</summary>
        <table><tbody>${rows}</tbody></table>
      </details>
    </div>`;
}

// A confirmation dialog for permanent actions (deleting an order, customer or object type).
//
//   const done = await confirmDanger({
//     title: 'Delete order #012?',
//     body:  'Its 3 pieces are deleted too. This can’t be undone.',      // HTML — escape anything from the database
//     check: { label: 'Put 2 waiting blanks back in stock', checked: true },          // optional checkbox
//     confirmLabel: 'Delete order',
//     run: async checked => errorMessage | null,   // runs while the dialog shows "Deleting…"; an error keeps it open
//   });
//
// With `required: true` on the checkbox, the confirm button stays disabled until it's ticked.
// Without `run`/`confirmLabel`, the dialog only explains (one "OK" button) — e.g. why something can't be deleted.
// Cancel is focused first, so Enter never deletes by accident. Resolves true once `run` succeeded.

export const ICON_TRASH = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/></svg>`;

const CSS = `
  .cd-backdrop { position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;
    background:rgba(26,18,11,0.42);opacity:0;transition:opacity .16s ease; }
  .cd-backdrop.show { opacity:1; }
  .cd-box { background:#fff;border-radius:14px;width:100%;max-width:420px;margin:16px;padding:24px 24px 20px;
    box-shadow:0 2px 6px rgba(45,31,20,0.1),0 18px 48px rgba(45,31,20,0.22);
    transform:translateY(8px) scale(.98);transition:transform .22s cubic-bezier(.2,.9,.3,1.2); }
  .cd-backdrop.show .cd-box { transform:none; }
  .cd-title { font-family:'Inter',sans-serif;font-size:18px;font-weight:700;color:#1a120b;margin:0 0 8px;letter-spacing:-0.01em; }
  .cd-body { font-family:'Inter',sans-serif;font-size:14px;line-height:1.6;color:#5a4a3a; }
  .cd-body b { color:#1a120b; }
  .cd-check { display:flex;gap:10px;align-items:flex-start;margin-top:14px;padding:10px 12px;border-radius:10px;
    background:#faf7f4;border:1px solid #ece4da;font-family:'Inter',sans-serif;font-size:13px;color:#3a2c1f;cursor:pointer;line-height:1.5; }
  .cd-check input { margin-top:3px;accent-color:#b3261e;width:15px;height:15px;flex-shrink:0;cursor:pointer; }
  .cd-error { font-family:'Inter',sans-serif;font-size:13px;color:#b3261e;margin-top:12px; }
  .cd-actions { display:flex;justify-content:flex-end;gap:10px;margin-top:20px; }
  .cd-btn { border-radius:9px;padding:9px 16px;font-family:'Inter',sans-serif;font-size:14px;font-weight:600;cursor:pointer;
    transition:background .12s ease,transform .12s ease; }
  .cd-btn:active:not(:disabled) { transform:scale(.97); }
  .cd-btn:focus-visible { outline:2px solid #9C1A4D;outline-offset:2px; }
  .cd-cancel { background:#fff;border:1px solid #e0d8cf;color:#5a4a3a;font-weight:500; }
  .cd-cancel:hover { background:#f7f2ec; }
  .cd-go { background:#b3261e;border:1px solid #b3261e;color:#fff;box-shadow:0 2px 8px rgba(179,38,30,.25); }
  .cd-go:hover:not(:disabled) { background:#93201a; }
  .cd-go:disabled { opacity:.45;cursor:not-allowed;box-shadow:none; }
  .cd-go:focus-visible { outline-color:#b3261e; }
  @media (prefers-reduced-motion: reduce) { .cd-backdrop, .cd-box { transition:none; } }

  /* the small trash button pages put next to an item */
  .del-btn { display:inline-flex;align-items:center;justify-content:center;gap:6px;background:none;border:1px solid transparent;
    border-radius:8px;padding:6px;color:#b0a090;cursor:pointer;font-family:'Inter',sans-serif;font-size:13px;font-weight:500;
    transition:background .12s ease,color .12s ease; }
  .del-btn:hover { background:rgba(179,38,30,.08);color:#b3261e; }
  .del-btn:active { transform:scale(.95); }
  .del-btn:focus-visible { outline:2px solid #b3261e;outline-offset:1px;color:#b3261e; }
  .del-btn.text { padding:6px 10px; }
`;

function ensureStyles() {
  if (document.getElementById('cd-styles')) return;
  const s = document.createElement('style');
  s.id = 'cd-styles';
  s.textContent = CSS;
  document.head.appendChild(s);
}

export function deleteStyles() {
  ensureStyles();
}

export function confirmDanger({ title, body, check, confirmLabel, run }) {
  ensureStyles();
  const explainOnly = !run;
  const back = document.createElement('div');
  back.className = 'cd-backdrop';
  back.innerHTML = `
    <div class="cd-box" role="${explainOnly ? 'dialog' : 'alertdialog'}" aria-modal="true" aria-labelledby="cd-title" aria-describedby="cd-body">
      <h2 class="cd-title" id="cd-title"></h2>
      <div class="cd-body" id="cd-body">${body}</div>
      ${check ? `<label class="cd-check"><input type="checkbox" ${check.checked ? 'checked' : ''}><span></span></label>` : ''}
      <div class="cd-error" role="alert" hidden></div>
      <div class="cd-actions">
        <button type="button" class="cd-btn cd-cancel">${explainOnly ? 'OK' : 'Cancel'}</button>
        ${explainOnly ? '' : '<button type="button" class="cd-btn cd-go"></button>'}
      </div>
    </div>`;
  back.querySelector('.cd-title').textContent = title;
  if (check) back.querySelector('.cd-check span').textContent = check.label;
  const go = back.querySelector('.cd-go');
  const cancel = back.querySelector('.cd-cancel');
  const box = back.querySelector('input[type=checkbox]');
  const err = back.querySelector('.cd-error');
  const opener = document.activeElement;
  if (go) go.textContent = confirmLabel;
  const sync = () => { if (go) go.disabled = !!(check?.required && !box.checked); };
  sync();
  box?.addEventListener('change', sync);

  document.body.appendChild(back);
  requestAnimationFrame(() => back.classList.add('show'));
  cancel.focus();

  return new Promise(resolve => {
    let busy = false;
    const close = result => {
      document.removeEventListener('keydown', onKey, true);
      back.remove();
      if (opener?.isConnected) opener.focus();
      resolve(result);
    };
    const onKey = e => {
      if (e.key === 'Escape' && !busy) { e.stopPropagation(); close(false); }
      if (e.key === 'Tab') {           // keep focus inside the dialog
        const f = [...back.querySelectorAll('input, button:not(:disabled)')];
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f.at(-1).focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    cancel.addEventListener('click', () => { if (!busy) close(false); });
    back.addEventListener('click', e => { if (e.target === back && !busy) close(false); });
    go?.addEventListener('click', async () => {
      busy = true;
      go.disabled = cancel.disabled = true;
      go.textContent = 'Deleting…';
      err.hidden = true;
      const problem = await run(box ? box.checked : undefined);
      if (!problem) return close(true);
      busy = false;
      cancel.disabled = false;
      go.textContent = confirmLabel;
      sync();
      err.textContent = problem;
      err.hidden = false;
    });
  });
}

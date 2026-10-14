import { escHtml } from '../utils.js';
import { logEvent } from '../log.js';
import { loadSettings, saveSettings, settings, settingsProblem, DEFAULTS } from '../settings.js';
import { buildReadyMessage, DEFAULT_MESSAGE, PLACEHOLDERS } from '../whatsapp.js';

// Sample order used for the message preview
const SAMPLE = { name: 'Dana Cohen', order: 12, pieces: ['Medium Cup', 'Medium Cup', 'Bowl'] };

const TOGGLES = [
  {
    key: 'confirmSent',
    title: 'Confirm sent messages',
    on:  'After opening WhatsApp, the order asks “Sent? ✓ ✕” until you answer. Only ✓ counts as telling the customer.',
    off: 'Opening WhatsApp counts as telling the customer straight away.',
  },
  {
    key: 'askWhyNotSent',
    title: 'Ask why a message wasn’t sent',
    on:  'Choosing ✕ asks for a reason, shown on the order and in the Logs.',
    off: 'Choosing ✕ just records “Not sent”.',
    needs: 'confirmSent',
  },
  {
    key: 'undoBar',
    title: 'Undo bar after changes',
    on:  'Marking pieces ready or picked up shows a bar with Undo (and Send WhatsApp when an order is all ready).',
    off: 'Changes happen quietly. Errors still show.',
  },
];

// ─── Render ───────────────────────────────────────────────────────────────────

export function render() {
  return `
    <style>
      .set-wrap { max-width:880px;margin:0 auto; }
      .set-card {
        background:#fff;border-radius:16px;border:1px solid #e8e1d8;padding:26px 28px;margin-bottom:20px;
        box-shadow:0 2px 6px rgba(45,31,20,0.07),0 8px 24px rgba(45,31,20,0.04);
      }
      .set-card h2 { font-family:'Inter',sans-serif;font-size:17px;font-weight:700;color:#1a120b;margin:0 0 4px;letter-spacing:-.01em; }
      .set-card .lead { font-family:'Inter',sans-serif;font-size:13px;color:#8a7560;margin:0 0 20px;line-height:1.6; }
      .set-banner {
        display:none;margin-bottom:20px;padding:14px 18px;border-radius:12px;background:#fff8e8;border:1px solid #f0d9a4;
        font-family:'Inter',sans-serif;font-size:13px;color:#6b4e12;line-height:1.6;
      }
      .set-banner code { background:#fff;padding:1px 6px;border-radius:4px;font-size:12px; }

      /* Message editor */
      .msg-grid { display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:22px; }
      @media (max-width: 860px) { .msg-grid { grid-template-columns:1fr; } }
      .msg-label { display:block;font-family:'Inter',sans-serif;font-size:12px;font-weight:600;color:#5a4a3a;margin-bottom:8px; }
      #msg-input {
        width:100%;box-sizing:border-box;min-height:132px;padding:12px 14px;border:1px solid #e0d8cf;border-radius:12px;
        font-family:'Inter',sans-serif;font-size:14px;line-height:1.7;color:#1a120b;resize:vertical;outline:none;background:#fff;
      }
      #msg-input:focus { border-color:#9C1A4D;box-shadow:0 0 0 3px rgba(156,26,77,.12); }
      .ph-row { display:flex;flex-wrap:wrap;gap:6px;margin-top:10px; }
      .ph-chip {
        display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;cursor:pointer;
        border:1px solid #e0d6ca;background:#faf7f4;font-family:'Inter',sans-serif;font-size:12px;color:#5a4a3a;
        transition:transform .18s cubic-bezier(.34,1.56,.64,1);
      }
      .ph-chip code { font-family:inherit;font-weight:700;color:#9C1A4D; }
      .ph-chip:hover { border-color:#9C1A4D;background:#fff; }
      .ph-chip:active { transform:scale(.95); }
      .ph-chip:focus-visible { outline:2px solid #9C1A4D;outline-offset:2px; }
      .msg-hint { margin-top:10px;font-family:'Inter',sans-serif;font-size:12px;color:#b45309;display:none; }

      /* WhatsApp-style preview */
      .wa-phone { background:#efe7dd;border-radius:14px;padding:18px 16px;min-height:132px;
        background-image:radial-gradient(rgba(120,100,80,.08) 1px, transparent 1px);background-size:14px 14px; }
      .wa-bubble {
        position:relative;margin-left:auto;max-width:92%;width:fit-content;background:#d9fdd3;color:#111b21;
        border-radius:10px 0 10px 10px;padding:8px 10px 18px;font-family:'Inter',sans-serif;font-size:14px;line-height:1.55;
        box-shadow:0 1px 1px rgba(0,0,0,.12);white-space:pre-wrap;overflow-wrap:anywhere;
      }
      .wa-bubble::after { content:'';position:absolute;top:0;right:-7px;border-width:0 0 9px 8px;border-style:solid;border-color:transparent transparent transparent #d9fdd3; }
      .wa-time { position:absolute;right:8px;bottom:3px;font-size:10px;color:#667781; }

      .msg-actions { display:flex;align-items:center;gap:12px;margin-top:20px;flex-wrap:wrap; }
      .btn-primary {
        padding:10px 20px;border-radius:10px;border:none;background:#9C1A4D;color:#fff;cursor:pointer;
        font-family:'Inter',sans-serif;font-size:14px;font-weight:600;box-shadow:0 2px 8px rgba(156,26,77,.28);
        transition:transform .18s cubic-bezier(.34,1.56,.64,1);
      }
      .btn-primary:hover:not(:disabled) { background:#7D1540; }
      .btn-primary:active:not(:disabled) { transform:scale(.97); }
      .btn-primary:disabled { opacity:.4;cursor:not-allowed;box-shadow:none; }
      .btn-primary:focus-visible, .btn-text:focus-visible { outline:2px solid #9C1A4D;outline-offset:2px; }
      .btn-text { background:none;border:none;padding:4px;cursor:pointer;font-family:'Inter',sans-serif;font-size:13px;color:#8a7560;text-decoration:underline;text-underline-offset:2px;border-radius:4px; }
      .btn-text:hover { color:#1a120b; }
      .set-status { font-family:'Inter',sans-serif;font-size:13px; }
      .set-status.ok, .tg-status.ok { color:#2f8a4a; }
      .set-status.err, .tg-status.err { color:#b94040; }

      /* Containers */
      .cont-list { display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px; }
      .cont-item {
        display:inline-flex;align-items:center;gap:4px;padding:6px 6px 6px 12px;border-radius:10px;
        background:#fbf3e2;border:1px solid #ecd9ad;font-family:'Inter',sans-serif;font-size:14px;font-weight:700;color:#6b4e12;
      }
      .cont-item button { background:none;border:none;cursor:pointer;color:#a08850;font-size:16px;line-height:1;padding:0 4px;border-radius:5px; }
      .cont-item button:hover { color:#9C1A4D;background:#fff; }
      .cont-item button:focus-visible { outline:2px solid #9C1A4D;outline-offset:1px; }
      .cont-add { display:flex;align-items:center;gap:10px;flex-wrap:wrap; }
      .cont-add input {
        flex:1;min-width:200px;padding:10px 14px;border:1px solid #e0d8cf;border-radius:10px;
        font-family:'Inter',sans-serif;font-size:14px;color:#1a120b;outline:none;
      }
      .cont-add input:focus { border-color:#9C1A4D;box-shadow:0 0 0 3px rgba(156,26,77,.12); }

      /* Feature switches */
      .tg-row { display:flex;align-items:flex-start;gap:16px;padding:16px 0;border-top:1px solid #f3eee8; }
      .tg-row:first-of-type { border-top:none;padding-top:4px; }
      .tg-row.sub { padding-left:22px; }
      .tg-row.disabled { opacity:.45; }
      .tg-text { flex:1; }
      .tg-title { font-family:'Inter',sans-serif;font-size:14px;font-weight:600;color:#1a120b; }
      .tg-desc { font-family:'Inter',sans-serif;font-size:13px;color:#8a7560;margin-top:3px;line-height:1.55; }
      .tg-status { font-family:'Inter',sans-serif;font-size:12px;margin-top:4px;min-height:16px; }
      .switch { position:relative;flex-shrink:0;width:44px;height:26px;margin-top:2px; }
      .switch input { position:absolute;inset:0;opacity:0;margin:0;cursor:pointer;z-index:1; }
      .switch input:disabled { cursor:not-allowed; }
      .switch .track { position:absolute;inset:0;border-radius:999px;background:#ddd3c7; }
      .switch .knob {
        position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;
        box-shadow:0 1px 3px rgba(45,31,20,.3);transition:transform .25s cubic-bezier(.34,1.56,.64,1);
      }
      .switch input:checked ~ .track { background:#2f8a4a; }
      .switch input:checked ~ .knob { transform:translateX(18px); }
      .switch input:focus-visible ~ .track { outline:2px solid #9C1A4D;outline-offset:2px; }
      @media (prefers-reduced-motion: reduce) { .switch .knob, .ph-chip, .btn-primary { transition:none; } }
    </style>

    <svg style="position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;opacity:0.04;" xmlns="http://www.w3.org/2000/svg">
      <filter id="ck-noise-settings">
        <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch"/>
        <feColorMatrix type="saturate" values="0"/>
      </filter>
      <rect width="100%" height="100%" filter="url(#ck-noise-settings)"/>
    </svg>
    <div style="position:fixed;top:0;right:0;width:600px;height:400px;background:radial-gradient(ellipse at top right,rgba(156,26,77,0.08),transparent);pointer-events:none;z-index:0;"></div>

    <div style="padding:40px;position:relative;z-index:1;">
      <div class="set-wrap">
        <div style="margin-bottom:28px;">
          <h1 style="font-family:'Caveat',cursive;font-size:42px;font-weight:700;letter-spacing:-0.01em;color:#1a120b;margin-bottom:4px;">Settings</h1>
          <p style="font-family:'Inter',sans-serif;color:#8a7560;font-size:15px;line-height:1.7;">The WhatsApp message customers get, and which helpers the Orders page uses.</p>
        </div>

        <div class="set-banner" id="set-banner">
          Settings can’t be saved yet — the app is using the defaults. In Supabase, open <strong>SQL Editor</strong>,
          paste <code>supabase/migrations/20261014_settings.sql</code> and run it, then reload this page.
        </div>

        <section class="set-card" aria-labelledby="msg-title">
          <h2 id="msg-title">WhatsApp message</h2>
          <p class="lead">Sent when every piece of an order is ready. Click a field to insert it where your cursor is.</p>
          <div class="msg-grid">
            <div>
              <label class="msg-label" for="msg-input">Message</label>
              <textarea id="msg-input" dir="auto" spellcheck="false"></textarea>
              <div class="ph-row">
                ${PLACEHOLDERS.map(p => `<button type="button" class="ph-chip" data-ph="${escHtml(p.key)}" title="${escHtml(p.label)}"><code>${escHtml(p.key)}</code>${escHtml(p.label.split(',')[0])}</button>`).join('')}
              </div>
              <div class="msg-hint" id="msg-hint">Tip: include <strong>{order}</strong> — it’s the number written on the pieces.</div>
            </div>
            <div>
              <span class="msg-label">Preview <span style="font-weight:400;color:#a09080;">· sample order for Dana</span></span>
              <div class="wa-phone"><div class="wa-bubble" id="msg-preview" dir="auto"></div></div>
            </div>
          </div>
          <div class="msg-actions">
            <button type="button" class="btn-primary" id="msg-save" disabled>Save message</button>
            <button type="button" class="btn-text" id="msg-reset">Reset to default</button>
            <span class="set-status" id="msg-status" role="status"></span>
          </div>
        </section>

        <section class="set-card" aria-labelledby="cont-title">
          <h2 id="cont-title">Containers</h2>
          <p class="lead">Where ready pieces are kept. You choose one each time you mark pieces ready — single letters can be picked with the keyboard.</p>
          <div class="cont-list" id="cont-list"></div>
          <form class="cont-add" id="cont-add">
            <input id="cont-input" type="text" maxlength="30" placeholder="New container, e.g. K or מדף עליון" aria-label="New container" autocomplete="off" />
            <button type="submit" class="btn-primary" id="cont-add-btn" disabled>Add</button>
            <button type="button" class="btn-text" id="cont-reset">Reset to default</button>
            <span class="set-status" id="cont-status" role="status"></span>
          </form>
        </section>

        <section class="set-card" aria-labelledby="feat-title">
          <h2 id="feat-title">Orders page helpers</h2>
          <p class="lead">Turn off what you don’t need. Changes save right away.</p>
          <div id="toggles"></div>
        </section>
      </div>
    </div>
  `;
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

export async function mount(el, signal) {
  await loadSettings({ fresh: true });
  if (signal.aborted) return;
  el.querySelector('#set-banner').style.display = settingsProblem() ? 'block' : 'none';
  wireMessage(el);
  wireContainers(el);
  renderToggles(el);
}

// ─── Containers ───────────────────────────────────────────────────────────────

function wireContainers(el) {
  const list   = el.querySelector('#cont-list');
  const input  = el.querySelector('#cont-input');
  const add    = el.querySelector('#cont-add-btn');
  const status = el.querySelector('#cont-status');

  const save = async (next, message) => {
    const { error } = await saveSettings({ containers: next });
    if (error) {
      setStatus(status, `Couldn’t save — ${error.message}`, 'err');
      logEvent('error', `Couldn't save containers: ${error.message}`);
      return false;
    }
    render();
    setStatus(status, `✓ ${message}`, 'ok');
    logEvent('info', `Settings: containers — ${message}`, { kind: 'settings', containers: next });
    return true;
  };
  const render = () => {
    const items = settings().containers;
    list.innerHTML = items.length
      ? items.map((c, n) => `<span class="cont-item">${escHtml(c)}<button type="button" data-n="${n}" aria-label="Remove ${escHtml(c)}">×</button></span>`).join('')
      : '<span style="font-family:Inter,sans-serif;font-size:13px;color:#8a7560;">No containers — add at least one.</span>';
    list.querySelectorAll('[data-n]').forEach(b => b.addEventListener('click', () => {
      const items = settings().containers;
      const gone = items[Number(b.dataset.n)];
      save(items.filter((_, n) => n !== Number(b.dataset.n)), `Removed ${gone}`);
    }));
  };

  input.addEventListener('input', () => { add.disabled = !input.value.trim(); setStatus(status, ''); });
  el.querySelector('#cont-add').addEventListener('submit', async e => {
    e.preventDefault();
    const name = input.value.trim();
    if (!name) return;
    if (settings().containers.some(c => c.toLowerCase() === name.toLowerCase())) {
      setStatus(status, `${name} is already in the list`, 'err');
      return;
    }
    add.disabled = true;
    if (await save([...settings().containers, name], `Added ${name}`)) input.value = '';
    else add.disabled = false;
    input.focus();
  });
  el.querySelector('#cont-reset').addEventListener('click', () => save([...DEFAULTS.containers], 'Back to the default list'));
  render();
}

// ─── Message ──────────────────────────────────────────────────────────────────

function wireMessage(el) {
  const input   = el.querySelector('#msg-input');
  const save    = el.querySelector('#msg-save');
  const status  = el.querySelector('#msg-status');
  const preview = el.querySelector('#msg-preview');
  const hint    = el.querySelector('#msg-hint');
  input.value = settings().messageTemplate;

  const refresh = () => {
    const text = buildReadyMessage(input.value, SAMPLE.name, SAMPLE.order, SAMPLE.pieces);
    preview.innerHTML = `${escHtml(text)}<span class="wa-time">10:42</span>`;
    save.disabled = input.value.trim() === '' || input.value === settings().messageTemplate;
    hint.style.display = input.value.includes('{order}') ? 'none' : 'block';
    if (!save.disabled) setStatus(status, '');
  };
  input.addEventListener('input', refresh);

  el.querySelectorAll('.ph-chip').forEach(chip => chip.addEventListener('click', () => {
    const { selectionStart: a, selectionEnd: b, value } = input;
    input.value = value.slice(0, a) + chip.dataset.ph + value.slice(b);
    input.focus();
    input.setSelectionRange(a + chip.dataset.ph.length, a + chip.dataset.ph.length);
    refresh();
  }));

  el.querySelector('#msg-reset').addEventListener('click', () => {
    input.value = DEFAULT_MESSAGE;
    refresh();
    input.focus();
  });

  save.addEventListener('click', async () => {
    save.disabled = true;
    save.textContent = 'Saving…';
    const { error } = await saveSettings({ messageTemplate: input.value.trim() });
    save.textContent = 'Save message';
    if (error) {
      save.disabled = false;
      setStatus(status, `Couldn’t save — ${error.message}`, 'err');
      logEvent('error', `Couldn't save the WhatsApp message: ${error.message}`);
      return;
    }
    input.value = settings().messageTemplate;
    refresh();
    setStatus(status, '✓ Saved', 'ok');
    logEvent('info', 'Settings: WhatsApp message changed', { kind: 'settings', message: settings().messageTemplate });
  });

  refresh();
}

// ─── Feature switches ─────────────────────────────────────────────────────────

function renderToggles(el) {
  const s = settings();
  const box = el.querySelector('#toggles');
  box.innerHTML = TOGGLES.map(t => {
    const blocked = t.needs && !s[t.needs];
    return `
      <div class="tg-row${t.needs ? ' sub' : ''}${blocked ? ' disabled' : ''}">
        <div class="tg-text">
          <div class="tg-title" id="tg-${t.key}-label">${escHtml(t.title)}</div>
          <div class="tg-desc">${escHtml(s[t.key] ? t.on : t.off)}${blocked ? ' (needs “Confirm sent messages”)' : ''}</div>
          <div class="tg-status" id="tg-${t.key}-status" role="status"></div>
        </div>
        <label class="switch">
          <input type="checkbox" role="switch" data-key="${t.key}" aria-labelledby="tg-${t.key}-label"
            ${s[t.key] ? 'checked' : ''} ${blocked ? 'disabled' : ''} />
          <span class="track"></span><span class="knob"></span>
        </label>
      </div>`;
  }).join('');

  box.querySelectorAll('input[data-key]').forEach(input => input.addEventListener('change', async () => {
    const key = input.dataset.key;
    const value = input.checked;
    input.disabled = true;
    const { error } = await saveSettings({ [key]: value });
    renderToggles(el); // shows the saved state (or the old one if saving failed)
    const status = el.querySelector(`#tg-${key}-status`);
    if (error) {
      setStatus(status, `Couldn’t save — ${error.message}`, 'err');
      logEvent('error', `Couldn't save setting ${key}: ${error.message}`);
    } else {
      setStatus(status, value ? '✓ Turned on' : '✓ Turned off', 'ok');
      const title = TOGGLES.find(t => t.key === key).title;
      logEvent('info', `Settings: “${title}” turned ${value ? 'on' : 'off'}`, { kind: 'settings', key, value });
    }
  }));
}

function setStatus(node, text, tone = '') {
  if (!node) return;
  node.textContent = text;
  node.className = node.className.replace(/\b(ok|err)\b/g, '').trim() + (tone ? ` ${tone}` : '');
}

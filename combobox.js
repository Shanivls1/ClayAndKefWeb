/**
 * Converts a <select> element into a searchable combobox.
 * The original <select> stays hidden in the DOM so form.elements.* still works.
 *
 * Pass the page's AbortSignal so the document listener is removed on navigation.
 * Returns { clear(), refresh(), setValue(value) }
 */
export function initCombobox(selectEl, { signal } = {}) {
  const isFullWidth = selectEl.style.width === '100%';

  // ── Wrapper ────────────────────────────────────────────────────────────────
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `position:relative;display:${isFullWidth ? 'block' : 'inline-block'};`;
  selectEl.parentNode.insertBefore(wrapper, selectEl);
  wrapper.appendChild(selectEl);
  selectEl.style.display = 'none';

  // ── Input ──────────────────────────────────────────────────────────────────
  const input = document.createElement('input');
  input.type = 'text';
  input.autocomplete = 'off';
  input.spellcheck = false;
  // Inherit the original select's inline style, then patch a few props
  input.style.cssText = selectEl.getAttribute('style') ?? '';
  input.style.display = '';
  input.style.cursor = 'text';
  input.style.paddingRight = '32px';
  input.style.boxSizing = 'border-box';
  if (!isFullWidth) input.style.minWidth = '140px';
  wrapper.appendChild(input);

  // ── Chevron ────────────────────────────────────────────────────────────────
  const chevron = document.createElement('span');
  chevron.style.cssText = `
    position:absolute;right:10px;top:50%;transform:translateY(-50%);
    pointer-events:none;color:#8a7560;line-height:0;
    transition:transform 0.15s ease;
  `;
  chevron.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="6 9 12 15 18 9"/></svg>`;
  wrapper.appendChild(chevron);

  // ── Dropdown ───────────────────────────────────────────────────────────────
  const list = document.createElement('ul');
  list.style.cssText = `
    display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:9999;
    background:#fff;border:1px solid #e0d8cf;border-radius:10px;
    box-shadow:0 4px 20px rgba(45,31,20,0.14);
    list-style:none;padding:4px 0;margin:0;
    max-height:220px;overflow-y:auto;min-width:180px;
  `;
  wrapper.appendChild(list);

  // ── State ──────────────────────────────────────────────────────────────────
  let selectedValue = null;
  let focusedIdx    = -1;
  let open          = false;

  // ── Helpers ────────────────────────────────────────────────────────────────
  function getOptions() {
    return Array.from(selectEl.options)
      .filter(o => o.value !== '')
      .map(o => ({ value: o.value, label: o.text }));
  }

  function placeholder() {
    return selectEl.options[0]?.text ?? '';
  }

  function rebuildList(q) {
    const opts = getOptions();
    const hits = q ? opts.filter(o => o.label.toLowerCase().includes(q.toLowerCase())) : opts;
    list.innerHTML = '';
    focusedIdx = -1;

    if (hits.length === 0) {
      const li = document.createElement('li');
      li.style.cssText = 'padding:10px 14px;font-family:Inter,sans-serif;font-size:13px;color:#b0a090;font-style:italic;';
      li.textContent = q ? 'No matches' : 'No options';
      list.appendChild(li);
      return;
    }

    hits.forEach((opt, i) => {
      const li = document.createElement('li');
      li.dataset.value  = opt.value;
      li.dataset.label  = opt.label;
      li.textContent    = opt.label;
      const isSel = opt.value === selectedValue;
      li.style.cssText = `
        padding:9px 14px;cursor:pointer;
        font-family:'Inter',sans-serif;font-size:14px;
        color:${isSel ? '#9C1A4D' : '#1a120b'};
        font-weight:${isSel ? '600' : '400'};
        background:${isSel ? 'rgba(156,26,77,0.07)' : 'transparent'};
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
        transition:background 0.08s;
      `;
      li.addEventListener('mouseenter', () => { clearHighlights(); li.style.background = 'rgba(156,26,77,0.07)'; focusedIdx = i; });
      li.addEventListener('mousedown',  e => { e.preventDefault(); pick(opt.value, opt.label); });
      list.appendChild(li);
    });
  }

  function clearHighlights() {
    list.querySelectorAll('li[data-value]').forEach(li => {
      if (li.dataset.value !== selectedValue) li.style.background = 'transparent';
    });
  }

  function openDropdown() {
    rebuildList(selectedValue ? '' : input.value);
    list.style.display = 'block';
    chevron.style.transform = 'translateY(-50%) rotate(180deg)';
    open = true;
  }

  function closeDropdown() {
    list.style.display = 'none';
    chevron.style.transform = 'translateY(-50%) rotate(0deg)';
    focusedIdx = -1;
    open = false;
  }

  function pick(value, label) {
    selectedValue = value;
    selectEl.value = value;
    input.value    = label;
    closeDropdown();
    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function clear() {
    selectedValue = null;
    selectEl.value = '';
    input.value    = '';
    input.placeholder = placeholder();
  }

  // ── Events ─────────────────────────────────────────────────────────────────
  input.addEventListener('focus', () => {
    input.select();
    openDropdown();
    input.style.borderColor = '#9C1A4D';
    input.style.boxShadow   = '0 0 0 3px rgba(156,26,77,0.15)';
  });

  input.addEventListener('blur', () => {
    setTimeout(() => {
      if (!open) return;
      closeDropdown();
      if (selectedValue) {
        const opt = getOptions().find(o => o.value === selectedValue);
        if (opt) input.value = opt.label;
      } else {
        input.value = '';
        input.placeholder = placeholder();
      }
      input.style.borderColor = '#e0d8cf';
      input.style.boxShadow   = '';
    }, 160);
  });

  input.addEventListener('input', () => {
    if (selectedValue) {
      selectedValue  = null;
      selectEl.value = '';
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
    rebuildList(input.value);
    if (!open) { list.style.display = 'block'; open = true; }
  });

  input.addEventListener('keydown', e => {
    const items = Array.from(list.querySelectorAll('li[data-value]'));
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(focusedIdx + 1, items.length - 1);
      if (items[next]) { clearHighlights(); items[next].style.background = 'rgba(156,26,77,0.07)'; focusedIdx = next; items[next].scrollIntoView({ block: 'nearest' }); }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = Math.max(focusedIdx - 1, 0);
      if (items[prev]) { clearHighlights(); items[prev].style.background = 'rgba(156,26,77,0.07)'; focusedIdx = prev; items[prev].scrollIntoView({ block: 'nearest' }); }
    } else if (e.key === 'Enter' && focusedIdx >= 0) {
      e.preventDefault();
      const li = items[focusedIdx];
      if (li) pick(li.dataset.value, li.dataset.label);
    } else if (e.key === 'Escape') {
      closeDropdown();
      input.blur();
    }
  });

  // Close when clicking outside
  document.addEventListener('mousedown', e => {
    if (!wrapper.contains(e.target)) {
      if (open) {
        closeDropdown();
        if (!selectedValue) { input.value = ''; input.placeholder = placeholder(); }
        input.style.borderColor = '#e0d8cf';
        input.style.boxShadow   = '';
      }
    }
  }, { signal });

  input.placeholder = placeholder();

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    clear,
    refresh() {
      input.placeholder = placeholder();
      if (selectedValue && !getOptions().find(o => o.value === selectedValue)) clear();
      if (open) rebuildList(selectedValue ? '' : input.value);
    },
    setValue(value) {
      const opt = getOptions().find(o => o.value === value);
      if (opt) pick(opt.value, opt.label);
      else clear();
    },
  };
}

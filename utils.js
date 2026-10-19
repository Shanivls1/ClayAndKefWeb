// Shared helpers used by every page.

export function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// "#007" style label for order / object numbers.
export function fmtNum(n) {
  return n != null ? `#${String(n).padStart(3, '0')}` : '—';
}

// "12 Oct 2026"
export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// A date (default: today) as YYYY-MM-DD in the local timezone (toISOString() would give the UTC date).
export function todayLocal(d = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Map of key → number of items with that key.
export function countBy(items, keyFn) {
  const m = new Map();
  for (const item of items) {
    const k = keyFn(item);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

// Supabase returns at most 1000 rows per request. Pages through `makeQuery()`
// (a function returning a fresh query builder, with a stable .order()) until every row is fetched,
// asking for `parallel` pages at a time.
export async function fetchAllRows(makeQuery, pageSize = 1000, parallel = 4) {
  const rows = [];
  for (let start = 0; ; start += pageSize * parallel) {
    const pages = await Promise.all(Array.from({ length: parallel }, (_, n) => {
      const from = start + n * pageSize;
      return makeQuery().range(from, from + pageSize - 1);
    }));
    for (const { data, error } of pages) {
      if (error) return { data: null, error };
      rows.push(...(data ?? []));
      if (!data || data.length < pageSize) return { data: rows, error: null };
    }
  }
}

// Value for a PostgREST `.or()` filter: quoted so commas, dots and parens in
// user input can't break the filter syntax.
export function pgQuote(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

// Phones are stored as typed ("052-1000932", "+972 52-100-0932", "0521000932"…). For a search like "0521000932",
// a regex for PostgREST's `match` operator that finds the digits whatever is written between them.
// The leading 0 / 972 is dropped so the local and international ways of writing both match. null if no digits.
export function phonePattern(query) {
  let d = String(query ?? '').replace(/\D/g, '');
  if (d.startsWith('972')) d = d.slice(3);
  d = d.replace(/^0+/, '');
  return d ? d.split('').join('\\D*') : null;
}

// True when a search looks like (part of) a phone number rather than a name.
export const looksLikePhone = q => /^[\d\s()+-]+$/.test(String(q ?? '').trim()) && /\d/.test(q);

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

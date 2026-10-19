// Owner's settings (Settings page), stored in the single app_settings row — see
// supabase/migrations/20261014_settings.sql. Until that table exists, the defaults apply.

import { supabase } from './supabase.js';
import { DEFAULT_MESSAGE, DEFAULT_REMINDER1, DEFAULT_REMINDER2 } from './whatsapp.js';

export const DEFAULTS = {
  confirmSent:     true,  // ask "Sent? ✓ ✕" after opening WhatsApp, instead of counting it as told right away
  askWhyNotSent:   true,  // ✕ asks for a reason
  undoBar:         true,  // show the bar with Undo after a status change
  messageTemplate: DEFAULT_MESSAGE,
  reminders:       true,  // offer pickup reminders to customers who were told but haven't come
  reminderDays:    14,    // days after the "ready" message for reminder 1, and after reminder 1 for reminder 2
  reminder1Template: DEFAULT_REMINDER1,
  reminder2Template: DEFAULT_REMINDER2,
  // where ready pieces are kept — chosen when a piece is marked ready
  containers:      ['A', 'B', 'C', 'Cbis', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'מחסן שחור', 'מחסן שקוף', 'מדף', 'שקית בקופה', 'תרומה'],
};

let cache = null;
let problem = null; // why settings can't be loaded/saved, or null
let loadedAt = 0;

export async function loadSettings({ fresh = false } = {}) {
  if (cache && !fresh) return cache;
  const { data, error } = await supabase.from('app_settings').select('data').eq('id', 1).maybeSingle();
  problem = error ? error.message : data ? null : 'The settings row is missing.';
  // A failed load keeps what was loaded before — never fall back to the default message just because of a network blip
  if (error && cache) return cache;
  cache = { ...DEFAULTS, ...pick(data?.data ?? {}) };
  if (!error) loadedAt = Date.now();
  return cache;
}

// Keep every open page current: a save in one tab tells the others (same browser) straight away, and a tab or
// device re-reads the settings whenever she comes back to it — so a message changed elsewhere is always the one sent.
const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('ck-settings') : null;
channel?.addEventListener('message', () => loadSettings({ fresh: true }));
const refreshIfOld = () => { if (Date.now() - loadedAt > 15_000) loadSettings({ fresh: true }); };
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshIfOld(); });
window.addEventListener('focus', refreshIfOld);

// Current settings (defaults until loadSettings() has run).
export function settings() {
  return cache ?? { ...DEFAULTS };
}

export function settingsProblem() {
  return problem;
}

// Saves a partial change. Returns { error } — the cache only changes when the save worked.
export async function saveSettings(patch) {
  // Start from what's saved right now, so this tab can't put back an older message or list changed elsewhere
  const { data: current, error: readError } = await supabase.from('app_settings').select('data').eq('id', 1).maybeSingle();
  const base = readError ? settings() : { ...DEFAULTS, ...pick(current?.data ?? {}) };
  const next = { ...base, ...pick(patch) };
  const { data, error } = await supabase
    .from('app_settings')
    .update({ data: next, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select('id');
  const notSetUp = { message: 'settings aren’t set up yet — see the note at the top of this page.' };
  if (error) return { error: error.code === 'PGRST205' || error.code === '42P01' ? notSetUp : error };
  if (!data?.length) return { error: notSetUp };
  cache = next;
  problem = null;
  loadedAt = Date.now();
  channel?.postMessage('changed');
  return { error: null };
}

function pick(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => k in DEFAULTS));
}

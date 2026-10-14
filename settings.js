// Owner's settings (Settings page), stored in the single app_settings row — see
// supabase/migrations/20261014_settings.sql. Until that table exists, the defaults apply.

import { supabase } from './supabase.js';
import { DEFAULT_MESSAGE } from './whatsapp.js';

export const DEFAULTS = {
  confirmSent:     true,  // ask "Sent? ✓ ✕" after opening WhatsApp, instead of counting it as told right away
  askWhyNotSent:   true,  // ✕ asks for a reason
  undoBar:         true,  // show the bar with Undo after a status change
  messageTemplate: DEFAULT_MESSAGE,
  // where ready pieces are kept — chosen when a piece is marked ready
  containers:      ['A', 'B', 'C', 'Cbis', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'מחסן שחור', 'מחסן שקוף', 'מדף', 'שקית בקופה'],
};

let cache = null;
let problem = null; // why settings can't be loaded/saved, or null

export async function loadSettings({ fresh = false } = {}) {
  if (cache && !fresh) return cache;
  const { data, error } = await supabase.from('app_settings').select('data').eq('id', 1).maybeSingle();
  problem = error ? error.message : data ? null : 'The settings row is missing.';
  cache = { ...DEFAULTS, ...pick(data?.data ?? {}) };
  return cache;
}

// Current settings (defaults until loadSettings() has run).
export function settings() {
  return cache ?? { ...DEFAULTS };
}

export function settingsProblem() {
  return problem;
}

// Saves a partial change. Returns { error } — the cache only changes when the save worked.
export async function saveSettings(patch) {
  const next = { ...settings(), ...pick(patch) };
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
  return { error: null };
}

function pick(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => k in DEFAULTS));
}

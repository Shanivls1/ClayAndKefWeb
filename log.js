// Saves dashboard errors and warnings to the activity_log table (source = 'app'),
// so they can be read later on the Logs page instead of vanishing with the alert.
// Database changes are logged separately by a trigger — see supabase/migrations/*_activity_log.sql.

import { supabase } from './supabase.js';

let lastKey = '';
let lastAt  = 0;

// level: 'error' | 'warning' | 'info'. Returns a promise of { error } once saved.
export function logEvent(level, message, details = {}) {
  const text = String(message ?? '').slice(0, 500);
  (level === 'error' ? console.error : console.warn)(`[log] ${text}`, details);

  // Skip the same message repeated within 5 seconds (e.g. an error inside a render loop)
  const key = level + text;
  const now = Date.now();
  if (key === lastKey && now - lastAt < 5000) return Promise.resolve({ error: null });
  lastKey = key;
  lastAt  = now;

  return supabase
    .from('activity_log')
    .insert({ source: 'app', action: level, message: text, details: { ...details, page: location.hash || '#/' } })
    .then(({ error }) => {
      if (error) console.warn('[log] could not save to activity_log:', error.message);
      return { error };
    });
}

// Catches anything the pages don't handle themselves.
export function installErrorLogging() {
  window.addEventListener('error', e => {
    logEvent('error', e.error?.message ?? e.message, { file: e.filename, line: e.lineno, column: e.colno, stack: e.error?.stack });
  });
  window.addEventListener('unhandledrejection', e => {
    const reason = e.reason;
    logEvent('error', reason?.message ?? String(reason), { stack: reason?.stack });
  });
}

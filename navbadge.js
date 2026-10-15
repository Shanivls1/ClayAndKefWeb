// The blue number on "Orders" in the sidebar: how many orders have a pickup reminder due (order_list.reminder_due).
// Loaded when the app starts, refreshed on every page change, when the tab comes back into view and every
// 10 minutes. The Orders page passes its own count straight in (setRemindBadge) so the two never disagree.

import { supabase } from './supabase.js';

const REFRESH_MS = 10 * 60 * 1000;
let seq = 0;

export function setRemindBadge(n) {
  const link = document.querySelector('#sidebar a[data-route="/orders"]');
  if (!link) return;
  let badge = link.querySelector('.nav-badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'nav-badge';
    badge.setAttribute('aria-hidden', 'true'); // the link's label says it in words
    link.appendChild(badge);
  }
  const count = Math.max(0, Number(n) || 0);
  badge.hidden = count === 0;
  badge.textContent = count > 99 ? '99+' : String(count);
  const words = `${count} order${count === 1 ? '' : 's'} need${count === 1 ? 's' : ''} a pickup reminder`;
  link.title = count ? words : '';
  link.setAttribute('aria-label', count ? `Orders — ${words}` : 'Orders');
}

export async function refreshRemindBadge() {
  const mine = ++seq;
  const { count, error } = await supabase.from('order_list').select('id', { count: 'exact', head: true }).gt('reminder_due', 0);
  if (mine !== seq || error) return; // older answer, or the view isn't there yet → leave the badge as it is
  setRemindBadge(count ?? 0);
}

export function installRemindBadge() {
  refreshRemindBadge();
  window.addEventListener('hashchange', () => refreshRemindBadge());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshRemindBadge(); });
  setInterval(() => { if (document.visibilityState === 'visible') refreshRemindBadge(); }, REFRESH_MS);
}

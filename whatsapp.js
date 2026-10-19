// Customer notifications via WhatsApp Web click-to-chat links.
// Opens the customer's chat with the message typed in — the owner presses Enter to send.
// Everything WhatsApp-specific lives here, so switching to an automated sender later
// only means replacing this file.

const DEFAULT_COUNTRY_CODE = '972';
const WINDOW_NAME = 'ck-whatsapp'; // every message reuses the same tab

// "050-123-4567" / "+972 50 123 4567" / "+972 050-123-4567" → "972501234567". Returns null if it can't be a valid number.
export function normalizePhone(phone) {
  let digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = DEFAULT_COUNTRY_CODE + digits.slice(1);
  // "+972 050-…" (country code and the leading 0) — WhatsApp needs it without the 0
  if (digits.startsWith(DEFAULT_COUNTRY_CODE + '0')) digits = DEFAULT_COUNTRY_CODE + digits.slice(DEFAULT_COUNTRY_CODE.length + 1);
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

// The message the owner sends when an order is ready — editable on the Settings page.
// Placeholders are filled in per order.
export const DEFAULT_MESSAGE = 'היי {name}! 🎨 ההזמנה שלך ({order}) מוכנה לאיסוף ב-Clay & Kef: {pieces}. נתראה!';

// Pickup reminders, offered when the customer was told but hasn't come (Settings → reminderDays apart)
export const DEFAULT_REMINDER1 = 'היי {name} 😊 רק מזכירים — ההזמנה שלך ({order}) מחכה לך ב-Clay & Kef: {pieces}. נשמח לראות אותך!';
export const DEFAULT_REMINDER2 = 'היי {name}, ההזמנה שלך ({order}) עדיין מחכה לאיסוף ב-Clay & Kef: {pieces}. נשמח אם תעבור/י לאסוף אותה בהקדם 🙏';

export const PLACEHOLDERS = [
  { key: '{name}',   label: "Customer's first name" },
  { key: '{order}',  label: 'Order number' },
  { key: '{pieces}', label: 'The pieces, e.g. Medium Cup ×2, Bowl' },
  { key: '{count}',  label: 'How many pieces' },
];

// pieceNames: the type name of each piece, e.g. ['Medium Cup', 'Medium Cup', 'Bowl'] → "Medium Cup ×2, Bowl".
export function buildReadyMessage(template, customerName, orderNumber, pieceNames) {
  const counts = new Map();
  for (const name of pieceNames) counts.set(name, (counts.get(name) ?? 0) + 1);
  const values = {
    '{name}':   String(customerName ?? '').trim().split(/\s+/)[0] || '',
    '{order}':  orderNumber != null ? String(orderNumber).padStart(3, '0') : '', // "012", no # (as written on the pieces)
    '{pieces}': [...counts].map(([name, n]) => (n > 1 ? `${name} ×${n}` : name)).join(', '),
    '{count}':  String(pieceNames.length),
  };
  return String(template || DEFAULT_MESSAGE).replace(/\{(name|order|pieces|count)\}/g, m => values[m]);
}

// Must be called directly from a click handler (before any await), or the browser blocks the tab.
// Without text it just opens the chat — used to check whether a message was really sent.
// Returns false if the phone number is unusable.
export function openWhatsApp(phone, text = '') {
  const number = normalizePhone(phone);
  if (!number) return false;
  const url = `https://web.whatsapp.com/send?phone=${number}${text ? `&text=${encodeURIComponent(text)}` : ''}`;
  const win = window.open(url, WINDOW_NAME);
  if (win) win.opener = null; // WhatsApp's page gets no handle back to the dashboard
  return true;
}

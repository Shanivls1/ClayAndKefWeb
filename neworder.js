// Creating an order — shared by the Home page and the Orders page's "New order" dialog.

import { supabase } from './supabase.js';
import { countBy, fmtNum } from './utils.js';
import { logEvent } from './log.js';

// Creates the order and one piece per entry in typeIds (repeat an id for several of the same type),
// then lowers stock. Returns { order: { id, order_number }, stock: Map(typeId → new raw_stock), warnings: [...] }
// or { error: 'readable message' } — in which case nothing is left behind.
export async function createOrder({ customerId, receivedAt, notes, typeIds }) {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({ customer_id: customerId, received_at: receivedAt, notes: notes || null })
    .select('id, order_number')
    .single();
  if (orderError) {
    logEvent('error', `Couldn't create order: ${orderError.message}`);
    return { error: `Couldn't create the order: ${orderError.message}` };
  }

  const { error: objError } = await supabase
    .from('objects')
    .insert(typeIds.map(typeId => ({ order_id: order.id, object_type_id: typeId, status: 'received' })))
    .select('id');
  if (objError) {
    // Don't leave an empty order behind
    const { error: undoError } = await supabase.from('orders').delete().eq('id', order.id);
    logEvent('error', `Couldn't add pieces to order ${fmtNum(order.order_number)}: ${objError.message}` +
      (undoError ? ` — and removing the empty order failed: ${undoError.message}` : ' — empty order removed'));
    return { error: undoError
      ? `Couldn't add the pieces (${objError.message}). Order ${fmtNum(order.order_number)} was created empty — delete it on the Orders page.`
      : `Couldn't add the pieces: ${objError.message}. Nothing was saved.` };
  }

  const { stock, warnings } = await decrementStock(countBy(typeIds, id => id));
  if (warnings.length) logEvent('warning', `Order ${fmtNum(order.order_number)}: ${warnings.join(' ')}`);
  return { order, stock, warnings };
}

// Lowers raw_stock by the number of new pieces of each type, from the current value in the database.
async function decrementStock(countsByType) {
  const stock = new Map();
  const { data: fresh, error } = await supabase
    .from('object_types')
    .select('id, name, raw_stock')
    .in('id', [...countsByType.keys()]);
  if (error) return { stock, warnings: [`Stock wasn't updated (${error.message}). Adjust it on the Stock page.`] };

  const warnings = [];
  for (const t of fresh) {
    const used = countsByType.get(t.id);
    const have = t.raw_stock ?? 0;
    const next = Math.max(0, have - used);
    if (have < used) warnings.push(`${t.name}: only ${have} in stock but ${used} used, so stock is now 0.`);
    const { error: upError } = await supabase.from('object_types').update({ raw_stock: next }).eq('id', t.id);
    if (upError) warnings.push(`${t.name}: stock wasn't updated (${upError.message}).`);
    else stock.set(t.id, next);
  }
  return { stock, warnings };
}

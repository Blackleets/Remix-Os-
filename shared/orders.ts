// Shared order helpers — single source of truth for total/items access.
// Reused in backend (createApp.ts) and frontend (Dashboard, Orders, POS).
// Reason: bulk-imported orders may set `totalAmount` only; POS-created orders set both
// `total` and `totalAmount`. Reading `order.total` alone produces $0 metrics and
// `total.toFixed()` TypeErrors when only `totalAmount` exists.

export interface OrderLike {
  total?: number;
  totalAmount?: number;
  items?: unknown[];
  itemsSnapshot?: unknown[];
}

export function getOrderTotal(order: OrderLike | null | undefined): number {
  if (!order) return 0;
  const value = order.totalAmount ?? order.total ?? 0;
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function getOrderItems(order: OrderLike | null | undefined): unknown[] {
  if (!order) return [];
  if (Array.isArray(order.itemsSnapshot)) return order.itemsSnapshot;
  if (Array.isArray(order.items)) return order.items;
  return [];
}

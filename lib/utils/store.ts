import type { CartItem, OrderStatus, Product, StoreSettings } from "../data";

/** Prices a cart against the product catalog → line count and money subtotal. */
export function summarizeCart(
  cart: CartItem[],
  products: Product[]
): { count: number; subtotal: number; hasGrocery: boolean } {
  let count = 0;
  let subtotal = 0;
  let hasGrocery = false;
  for (const c of cart) {
    const p = products.find((pr) => pr.id === c.productId);
    if (!p) continue;
    count += c.qty;
    subtotal += p.price * c.qty;
    if (p.kind === "grocery") hasGrocery = true;
  }
  return { count, subtotal, hasGrocery };
}

/** The live delivery fee for a cart — shared by the checkout preview (client)
 * and orders.place() (server, authoritative) so the two can never disagree.
 * Free when the fee is switched off, the cart has no grocery item, or the
 * subtotal already clears the configured free-delivery threshold. */
export function deliveryFeeFor(hasGrocery: boolean, subtotal: number, settings: StoreSettings): number {
  if (!settings.deliveryFeeEnabled || !hasGrocery) return 0;
  if (settings.freeDeliveryMinAmount && subtotal >= settings.freeDeliveryMinAmount) return 0;
  return settings.deliveryFee;
}

/** The full delivery pipeline, in order. A Service Manager can only ever
 * advance to the NEXT step (or jump to "cancelled" from anywhere before
 * "delivered") — never skip ahead or go backward. Shared by the server
 * (authoritative) and every status-picker in the UI. */
export const ORDER_STATUS_FLOW: OrderStatus[] = [
  "placed",
  "confirmed",
  "preparing",
  "picked_up",
  "on_the_way",
  "delivered",
];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  placed: "Placed",
  confirmed: "Confirmed",
  preparing: "Preparing",
  picked_up: "Picked up",
  on_the_way: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const ORDER_STATUS_TONE: Record<OrderStatus, string> = {
  placed: "bg-blue-soft text-blue",
  confirmed: "bg-orange-soft text-orange",
  preparing: "bg-orange-soft text-orange",
  picked_up: "bg-[#7C6CF6]/10 text-[#7C6CF6]",
  on_the_way: "bg-[#7C6CF6]/10 text-[#7C6CF6]",
  delivered: "bg-primary-soft text-primary",
  cancelled: "bg-danger-soft text-danger",
};

/** The step after `status`, or undefined once delivered/cancelled. */
export function nextOrderStatus(status: OrderStatus): OrderStatus | undefined {
  const idx = ORDER_STATUS_FLOW.indexOf(status);
  if (idx === -1 || idx === ORDER_STATUS_FLOW.length - 1) return undefined;
  return ORDER_STATUS_FLOW[idx + 1];
}

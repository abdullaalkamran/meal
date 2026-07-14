import type { CartItem, Product } from "../data";

/** Flat delivery fee applied to any order containing a grocery item; books-only
 * orders ship free. Shared by the checkout page (preview) and the order repo
 * (authoritative) so the two can never disagree. */
export const DELIVERY_FEE = 30;

export function deliveryFeeFor(hasGrocery: boolean): number {
  return hasGrocery ? DELIVERY_FEE : 0;
}

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

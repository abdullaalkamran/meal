import type { Payment } from "@/lib/data";

export function generatePaymentReference(method: Payment["method"]): string {
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return method === "Cash" ? `Receipt #${random}` : `TXN ${random}`;
}

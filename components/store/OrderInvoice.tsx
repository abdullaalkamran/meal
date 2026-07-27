"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { Order } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";
import { formatShortDate } from "@/lib/utils/date";
import { ORDER_STATUS_FLOW, ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/utils/store";

/** Shared order detail + printable invoice — used by both the buyer's own
 * order page and the Service Manager's order management page. `window.print()`
 * gives a one-click "Save as PDF" via the browser's own print dialog, so
 * there's no PDF-generation library to add (this app deliberately avoids
 * native/heavy client deps — see DEPLOY.md). AppShell hides the app chrome
 * (nav/header) on print already; this component hides its own buttons too. */
export function OrderInvoice({
  order,
  buyerName,
  buyerPhone,
  hostelName,
}: {
  order: Order;
  buyerName: string;
  buyerPhone?: string;
  hostelName?: string;
}) {
  const stepIndex = ORDER_STATUS_FLOW.indexOf(order.status);

  return (
    <div className="invoice-print-area flex flex-col gap-4">
      {order.status === "cancelled" ? (
        <div className="rounded-card bg-danger-soft px-4 py-3 text-center text-[12px] font-extrabold text-danger print:hidden">
          This order was cancelled
        </div>
      ) : (
        <div className="flex items-start print:hidden">
          {ORDER_STATUS_FLOW.map((step, i) => (
            <div key={step} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-extrabold ${
                    i <= stepIndex ? "bg-primary text-white" : "bg-bg text-text-secondary"
                  }`}
                >
                  {i + 1}
                </div>
                <div
                  className={`text-center text-[7.5px] font-bold leading-tight ${
                    i <= stepIndex ? "text-text" : "text-text-secondary"
                  }`}
                >
                  {ORDER_STATUS_LABEL[step]}
                </div>
              </div>
              {i < ORDER_STATUS_FLOW.length - 1 && (
                <div className={`mx-0.5 h-0.5 flex-1 self-start mt-3 ${i < stepIndex ? "bg-primary" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-card border border-border bg-card p-5 print:border-0 print:p-0">
        <div className="mb-4 flex items-start justify-between border-b border-border pb-4">
          <div>
            <div className="text-[16px] font-extrabold text-primary">MyDorm</div>
            <div className="text-[9.5px] font-semibold text-text-secondary">Hostel platform store</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-extrabold">Invoice</div>
            <div className="text-[9.5px] font-semibold text-text-secondary">
              #{order.id.slice(-10).toUpperCase()}
            </div>
            <div className="text-[9.5px] font-semibold text-text-secondary">
              {formatShortDate(order.createdAt.slice(0, 10))}
            </div>
          </div>
        </div>

        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[9px] font-extrabold uppercase tracking-wide text-text-secondary">Bill to</div>
            <div className="truncate text-[12px] font-extrabold">{buyerName}</div>
            {buyerPhone && <div className="text-[10px] font-semibold text-text-secondary">{buyerPhone}</div>}
            {hostelName && <div className="text-[10px] font-semibold text-text-secondary">{hostelName}</div>}
            {order.note && <div className="text-[10px] font-semibold text-text-secondary">{order.note}</div>}
          </div>
          <span className={`shrink-0 rounded-pill px-2.5 py-1 text-[9.5px] font-extrabold ${ORDER_STATUS_TONE[order.status]}`}>
            {ORDER_STATUS_LABEL[order.status]}
          </span>
        </div>

        <div className="mb-4 flex flex-col gap-0.5 rounded-btn bg-bg p-3 print:bg-transparent print:p-0">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 pb-2 text-[9px] font-extrabold uppercase tracking-wide text-text-secondary">
            <div>Item</div>
            <div className="text-center">Qty</div>
            <div className="text-right">Price</div>
            <div className="text-right">Total</div>
          </div>
          {order.items.map((item, i) => (
            <div
              key={`${item.productId}-${i}`}
              className="grid grid-cols-[1fr_auto_auto_auto] gap-2 border-t border-border py-1.5 text-[11px]"
            >
              <div className="min-w-0 truncate font-bold">{item.name}</div>
              <div className="text-center font-semibold text-text-secondary">×{item.qty}</div>
              <div className="text-right font-semibold text-text-secondary">{formatBDT(item.price)}</div>
              <div className="text-right font-extrabold">{formatBDT(item.price * item.qty)}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1.5 border-t border-border pt-3">
          <div className="flex justify-between text-[11px] font-semibold text-text-secondary">
            <span>Subtotal</span>
            <span>{formatBDT(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-[11px] font-semibold text-text-secondary">
            <span>Delivery fee</span>
            <span>{order.deliveryFee === 0 ? "Free" : formatBDT(order.deliveryFee)}</span>
          </div>
          {!!order.discount && (
            <div className="flex justify-between text-[11px] font-semibold text-primary">
              <span>Coupon {order.couponCode ? `(${order.couponCode})` : ""}</span>
              <span>−{formatBDT(order.discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-[14px] font-extrabold">
            <span>Total</span>
            <span className="text-primary">{formatBDT(order.total)}</span>
          </div>
          <div className="mt-1 text-[10px] font-semibold text-text-secondary">
            Payment method: {order.paymentMethod}
          </div>
        </div>
      </div>

      <Button fullWidth variant="secondary" onClick={() => window.print()} className="print:hidden">
        <Icon icon={Printer} size={15} /> Print / Save as PDF
      </Button>
    </div>
  );
}

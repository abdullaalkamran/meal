"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { formatBDT } from "@/lib/utils/currency";

/** Sticky bottom bar summarising the cart, shown on store pages when it's
 * non-empty. Links to the shared checkout at /explore/cart. */
export function CartBar({ count, subtotal }: { count: number; subtotal: number }) {
  if (count === 0) return null;
  return (
    <div className="sticky bottom-3 z-20 mt-2">
      <Link
        href="/explore/cart"
        className="flex items-center justify-between gap-3 rounded-card px-4 py-3 text-white shadow-soft"
        style={{ background: "linear-gradient(135deg, var(--gradient-accent-from), var(--gradient-accent-to))" }}
      >
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
            <Icon icon={ShoppingCart} size={16} />
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[9px] font-extrabold text-primary">
              {count}
            </span>
          </div>
          <span className="text-[12px] font-extrabold">View cart</span>
        </div>
        <span className="text-[13px] font-extrabold">{formatBDT(subtotal)}</span>
      </Link>
    </div>
  );
}

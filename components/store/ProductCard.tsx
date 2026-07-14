"use client";

import { Minus, Plus } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { ProductImage } from "@/components/store/ProductImage";
import { formatBDT } from "@/lib/utils/currency";
import type { Product } from "@/lib/data";

/** A store product tile with an Add button that becomes a −/qty/+ stepper once
 * the item is in the cart. Presentational — the parent wires the cart calls. */
export function ProductCard({
  product,
  qty,
  onAdd,
  onSetQty,
}: {
  product: Product;
  qty: number;
  onAdd: () => void;
  onSetQty: (qty: number) => void;
}) {
  const secondary = product.kind === "grocery" ? product.unit : product.author;

  return (
    <div className="flex flex-col rounded-card border border-border bg-card p-3 shadow-chip">
      <ProductImage
        image={product.image}
        kind={product.kind}
        alt={product.name}
        className="mb-2 h-20 w-full rounded-btn"
        iconSize={26}
      />
      <div className="line-clamp-2 min-h-[30px] text-[11.5px] font-extrabold leading-tight">
        {product.name}
      </div>
      {secondary && (
        <div className="mt-0.5 truncate text-[9.5px] font-semibold text-text-secondary">{secondary}</div>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="text-[12.5px] font-extrabold text-primary">{formatBDT(product.price)}</div>
        {qty === 0 ? (
          <button
            type="button"
            onClick={onAdd}
            className="flex h-8 items-center gap-1 rounded-btn bg-primary-soft px-3 text-[10.5px] font-extrabold text-primary"
          >
            <Icon icon={Plus} size={13} /> Add
          </button>
        ) : (
          <div className="flex h-8 items-center gap-2 rounded-btn bg-primary px-1.5 text-white">
            <button type="button" onClick={() => onSetQty(qty - 1)} aria-label="Decrease" className="flex h-6 w-6 items-center justify-center">
              <Icon icon={Minus} size={13} />
            </button>
            <span className="min-w-4 text-center text-[11.5px] font-extrabold">{qty}</span>
            <button type="button" onClick={() => onSetQty(qty + 1)} aria-label="Increase" className="flex h-6 w-6 items-center justify-center">
              <Icon icon={Plus} size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

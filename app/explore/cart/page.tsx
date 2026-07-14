"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { ExploreHeader } from "@/components/explore/ExploreHeader";
import { ProductImage } from "@/components/store/ProductImage";
import { useAllProducts } from "@/hooks/useProducts";
import { useCart } from "@/hooks/useCart";
import { repo, type PaymentMethod } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";
import { deliveryFeeFor, summarizeCart } from "@/lib/utils/store";

const METHODS: PaymentMethod[] = ["bKash", "Nagad", "Card", "Cash"];

export default function CartPage() {
  const { user, hostel } = useSession();
  const products = useAllProducts();
  const cart = useCart(user?.id);
  const { toast } = useToast();
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod>("bKash");
  const [note, setNote] = useState("");
  const [placing, setPlacing] = useState(false);

  const lines = cart
    .map((c) => ({ item: c, product: products.find((p) => p.id === c.productId) }))
    .filter((l): l is { item: typeof l.item; product: NonNullable<typeof l.product> } => !!l.product);

  const { subtotal, hasGrocery } = summarizeCart(cart, products);
  const deliveryFee = deliveryFeeFor(hasGrocery);
  const total = subtotal + deliveryFee;

  const setQty = (id: string, qty: number) => user && repo.cart.setQty(user.id, id, qty);
  const remove = (id: string) => user && repo.cart.remove(user.id, id);

  const placeOrder = async () => {
    if (!user || lines.length === 0) return;
    setPlacing(true);
    await repo.orders.place(user.id, {
      paymentMethod: method,
      note: note.trim() || (hostel ? `Deliver to ${hostel.name}` : undefined),
    });
    toast("Order placed");
    router.push("/explore/orders");
  };

  if (lines.length === 0) {
    return (
      <div className="flex flex-col gap-5 pb-4">
        <ExploreHeader title="Cart" />
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-bg text-text-secondary">
            <Icon icon={ShoppingCart} size={24} />
          </div>
          <div className="text-[12.5px] font-extrabold">Your cart is empty</div>
          <div className="flex gap-2">
            <Link href="/explore/grocery">
              <Button variant="secondary">Grocery</Button>
            </Link>
            <Link href="/explore/books">
              <Button variant="secondary">Books</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <ExploreHeader title="Cart" subtitle={`${lines.length} item${lines.length > 1 ? "s" : ""}`} />

      <div className="flex flex-col gap-2">
        {lines.map(({ item, product }) => (
          <Card key={item.id} className="flex items-center gap-3">
            <ProductImage
              image={product.image}
              kind={product.kind}
              alt={product.name}
              className="h-11 w-11 shrink-0 rounded-btn"
              iconSize={17}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11.5px] font-extrabold">{product.name}</div>
              <div className="text-[10px] font-semibold text-text-secondary">
                {formatBDT(product.price)}
                {product.kind === "grocery" && product.unit ? ` · ${product.unit}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 items-center gap-2 rounded-btn bg-bg px-1.5">
                <button type="button" onClick={() => setQty(product.id, item.qty - 1)} aria-label="Decrease" className="flex h-6 w-6 items-center justify-center">
                  <Icon icon={Minus} size={13} />
                </button>
                <span className="min-w-4 text-center text-[11.5px] font-extrabold">{item.qty}</span>
                <button type="button" onClick={() => setQty(product.id, item.qty + 1)} aria-label="Increase" className="flex h-6 w-6 items-center justify-center">
                  <Icon icon={Plus} size={13} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => remove(product.id)}
                aria-label="Remove"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-danger-soft text-danger"
              >
                <Icon icon={Trash2} size={14} />
              </button>
            </div>
          </Card>
        ))}
      </div>

      <Card className="flex flex-col gap-2">
        <div className="flex justify-between text-[11.5px] font-semibold text-text-secondary">
          <span>Subtotal</span>
          <span>{formatBDT(subtotal)}</span>
        </div>
        <div className="flex justify-between text-[11.5px] font-semibold text-text-secondary">
          <span>Delivery fee</span>
          <span>{deliveryFee === 0 ? "Free" : formatBDT(deliveryFee)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-border pt-2 text-[13.5px] font-extrabold">
          <span>Total</span>
          <span className="text-primary">{formatBDT(total)}</span>
        </div>
      </Card>

      <div>
        <div className="mb-2 text-[13.5px] font-extrabold">Payment method</div>
        <div className="grid grid-cols-4 gap-2">
          {METHODS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={`min-h-10 rounded-btn text-[10.5px] font-extrabold ${
                method === m ? "bg-primary text-white" : "bg-bg text-text-secondary"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-[10.5px] font-bold text-text-secondary">Delivery note (optional)</div>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={hostel ? `Deliver to ${hostel.name}` : "Delivery address / note"}
          className="w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
        />
      </div>

      <Button fullWidth onClick={placeOrder} disabled={placing}>
        Place order · {formatBDT(total)}
      </Button>
    </div>
  );
}

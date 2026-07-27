"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart, Tag, Trash2, X } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { ExploreHeader } from "@/components/explore/ExploreHeader";
import { ProductImage } from "@/components/store/ProductImage";
import { useAllProducts } from "@/hooks/useProducts";
import { useCart } from "@/hooks/useCart";
import { useRooms } from "@/hooks/useRooms";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { repo, type Coupon, type PaymentMethod } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";
import { deliveryFeeFor, summarizeCart } from "@/lib/utils/store";

const METHODS: PaymentMethod[] = ["bKash", "Nagad", "Card", "Cash"];

export default function CartPage() {
  const { user, hostel } = useSession();
  const products = useAllProducts();
  const cart = useCart(user?.id);
  const rooms = useRooms(user?.hostelId);
  const storeSettings = useStoreSettings();
  const { toast } = useToast();
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod>("bKash");
  const [note, setNote] = useState("");
  const [placing, setPlacing] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState("");
  const [checkingCoupon, setCheckingCoupon] = useState(false);

  const lines = cart
    .map((c) => ({ item: c, product: products.find((p) => p.id === c.productId) }))
    .filter((l): l is { item: typeof l.item; product: NonNullable<typeof l.product> } => !!l.product);

  const { subtotal, hasGrocery } = summarizeCart(cart, products);
  const deliveryFee = deliveryFeeFor(hasGrocery, subtotal, storeSettings);
  const discount = coupon
    ? Math.min(coupon.kind === "percent" ? (subtotal * coupon.value) / 100 : coupon.value, subtotal)
    : 0;
  const total = Math.max(0, subtotal + deliveryFee - discount);

  // Prefill the delivery address with the member's own room once it's known,
  // but never overwrite something they've already started typing.
  const myRoom = rooms.find((r) => r.id === user?.roomId);
  useEffect(() => {
    if (note || !hostel) return;
    queueMicrotask(() => setNote(myRoom ? `${hostel.name}, Room ${myRoom.number}` : hostel.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostel, myRoom]);

  const setQty = (id: string, qty: number) => user && repo.cart.setQty(user.id, id, qty);
  const remove = (id: string) => user && repo.cart.remove(user.id, id);

  const applyCoupon = async () => {
    if (!couponInput.trim() || checkingCoupon) return;
    setCheckingCoupon(true);
    setCouponError("");
    try {
      const result = await repo.coupons.validate(couponInput.trim(), subtotal);
      setCoupon(result);
      toast(`Coupon ${result.code} applied`);
    } catch (err) {
      setCoupon(null);
      setCouponError(err instanceof Error ? err.message : "Could not apply this coupon.");
    } finally {
      setCheckingCoupon(false);
    }
  };
  const removeCoupon = () => {
    setCoupon(null);
    setCouponInput("");
    setCouponError("");
  };

  const placeOrder = async () => {
    if (!user || lines.length === 0 || !note.trim()) return;
    setPlacing(true);
    try {
      await repo.orders.place(user.id, {
        paymentMethod: method,
        note: note.trim(),
        couponCode: coupon?.code,
      });
      toast("Order placed");
      router.push("/explore/orders");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not place the order.");
    } finally {
      setPlacing(false);
    }
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
        {!!discount && (
          <div className="flex justify-between text-[11.5px] font-semibold text-primary">
            <span>Coupon ({coupon!.code})</span>
            <span>−{formatBDT(discount)}</span>
          </div>
        )}
        <div className="mt-1 flex justify-between border-t border-border pt-2 text-[13.5px] font-extrabold">
          <span>Total</span>
          <span className="text-primary">{formatBDT(total)}</span>
        </div>
      </Card>

      <div>
        <div className="mb-1.5 text-[10.5px] font-bold text-text-secondary">Coupon code</div>
        {coupon ? (
          <div className="flex items-center justify-between rounded-btn border border-primary bg-primary-soft px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[12px] font-extrabold text-primary">
              <Icon icon={Tag} size={14} />
              {coupon.code}
            </div>
            <button type="button" onClick={removeCoupon} aria-label="Remove coupon">
              <Icon icon={X} size={15} className="text-primary" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={couponInput}
              onChange={(e) => {
                setCouponInput(e.target.value);
                setCouponError("");
              }}
              placeholder="Enter code"
              className="w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold uppercase"
            />
            <button
              type="button"
              onClick={applyCoupon}
              disabled={!couponInput.trim() || checkingCoupon}
              className="shrink-0 rounded-btn bg-bg px-4 text-[11px] font-extrabold text-primary disabled:opacity-50"
            >
              {checkingCoupon ? "…" : "Apply"}
            </button>
          </div>
        )}
        {couponError && <div className="mt-1.5 text-[10px] font-bold text-danger">{couponError}</div>}
      </div>

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
        <div className="mb-1.5 text-[10.5px] font-bold text-text-secondary">Delivery address</div>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Hostel name, room number"
          className="w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
        />
        <div className="mt-1 text-[9.5px] font-semibold text-text-secondary">
          Shown to the Service Manager with your phone number so your order can actually be delivered.
        </div>
      </div>

      <Button fullWidth onClick={placeOrder} disabled={placing || !note.trim()}>
        Place order · {formatBDT(total)}
      </Button>
    </div>
  );
}

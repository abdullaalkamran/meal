"use client";

import { useState } from "react";
import Link from "next/link";
import { Receipt, Search } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { ExploreHeader } from "@/components/explore/ExploreHeader";
import { ProductCard } from "@/components/store/ProductCard";
import { CartBar } from "@/components/store/CartBar";
import { useAllProducts, useProducts } from "@/hooks/useProducts";
import { useCart } from "@/hooks/useCart";
import { useMemberArea } from "@/hooks/useMemberArea";
import { isAvailableAt } from "@/lib/geo/bangladesh";
import { repo } from "@/lib/data";
import { GROCERY_CATEGORIES } from "@/lib/explore/content";

export default function GroceryPage() {
  const { user } = useSession();
  const memberArea = useMemberArea();
  const products = useProducts("grocery").filter(
    (p) => p.active && isAvailableAt(p.areas, memberArea)
  );
  const allProducts = useAllProducts();
  const cart = useCart(user?.id);
  const [cat, setCat] = useState<string>("All");
  const [query, setQuery] = useState("");

  const qtyOf = (id: string) => cart.find((c) => c.productId === id)?.qty ?? 0;
  const count = cart.reduce((sum, c) => sum + c.qty, 0);
  const subtotal = cart.reduce((sum, c) => {
    const p = allProducts.find((pr) => pr.id === c.productId);
    return sum + (p ? p.price * c.qty : 0);
  }, 0);

  const results = products.filter(
    (p) => (cat === "All" || p.category === cat) && p.name.toLowerCase().includes(query.toLowerCase())
  );

  const add = (id: string) => user && repo.cart.add(user.id, id);
  const setQty = (id: string, qty: number) => user && repo.cart.setQty(user.id, id, qty);

  return (
    <div className="flex flex-col gap-4 pb-4">
      <ExploreHeader
        title="Grocery"
        subtitle="Delivered to your hostel"
        right={
          <Link href="/explore/orders" aria-label="My orders" className="flex h-9 w-9 items-center justify-center rounded-full bg-bg">
            <Icon icon={Receipt} size={17} />
          </Link>
        }
      />

      <div className="relative">
        <Icon icon={Search} size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products"
          className="w-full rounded-btn border border-border bg-transparent py-2.5 pl-9 pr-3 text-[12px] font-bold"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {["All", ...GROCERY_CATEGORIES].map((c) => (
          <button key={c} type="button" onClick={() => setCat(c)}>
            <Chip tone="primary" active={cat === c}>
              {c}
            </Chip>
          </button>
        ))}
      </div>

      {results.length === 0 ? (
        <Card className="text-center text-[11.5px] font-semibold text-text-secondary">No products here yet.</Card>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {results.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              qty={qtyOf(p.id)}
              onAdd={() => add(p.id)}
              onSetQty={(qty) => setQty(p.id, qty)}
            />
          ))}
        </div>
      )}

      <CartBar count={count} subtotal={subtotal} />
    </div>
  );
}

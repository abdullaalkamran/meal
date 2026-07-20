"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Heart, Phone, Plus, Receipt, Search, Trash2 } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useExploreInteractions } from "@/hooks/useExploreInteractions";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { ExploreHeader } from "@/components/explore/ExploreHeader";
import { ProductCard } from "@/components/store/ProductCard";
import { ProductImage } from "@/components/store/ProductImage";
import { CartBar } from "@/components/store/CartBar";
import { SellBookSheet } from "@/components/store/SellBookSheet";
import { useAllProducts, useProducts } from "@/hooks/useProducts";
import { useCart } from "@/hooks/useCart";
import { useUsedBooks } from "@/hooks/useUsedBooks";
import { useMemberArea } from "@/hooks/useMemberArea";
import { isAvailableAt } from "@/lib/geo/bangladesh";
import { repo } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";

type Tab = "new" | "old";

export default function BooksPage() {
  const { user } = useSession();
  const interactions = useExploreInteractions(user?.id);
  const { toast } = useToast();
  const memberArea = useMemberArea();
  const newBooks = useProducts("book").filter(
    (p) => p.active && isAvailableAt(p.areas, memberArea)
  );
  const allProducts = useAllProducts();
  const usedBooks = useUsedBooks();
  const cart = useCart(user?.id);
  const [tab, setTab] = useState<Tab>("new");
  const [query, setQuery] = useState("");
  const [sellOpen, setSellOpen] = useState(false);

  const qtyOf = (id: string) => cart.find((c) => c.productId === id)?.qty ?? 0;
  const count = cart.reduce((sum, c) => sum + c.qty, 0);
  const subtotal = cart.reduce((sum, c) => {
    const p = allProducts.find((pr) => pr.id === c.productId);
    return sum + (p ? p.price * c.qty : 0);
  }, 0);
  const add = (id: string) => user && repo.cart.add(user.id, id);
  const setQty = (id: string, qty: number) => user && repo.cart.setQty(user.id, id, qty);

  const saved = new Set(
    interactions.filter((i) => i.feature === "books" && i.kind === "saved").map((i) => i.itemId)
  );
  const save = async (id: string, title: string) => {
    if (!user) return;
    const was = saved.has(id);
    await repo.exploreInteractions.toggle(user.id, "books", id, "saved");
    toast(was ? "Removed from wishlist" : `Saved "${title}"`);
  };

  const q = query.toLowerCase();
  const newResults = newBooks.filter((b) => `${b.name} ${b.author ?? ""}`.toLowerCase().includes(q));
  const oldResults = usedBooks.filter((b) => `${b.title} ${b.author}`.toLowerCase().includes(q));

  return (
    <div className="flex flex-col gap-4 pb-4">
      <ExploreHeader
        title="Buy Books"
        subtitle={`${saved.size} in wishlist`}
        right={
          <Link href="/explore/orders" aria-label="My orders" className="flex h-9 w-9 items-center justify-center rounded-full bg-bg">
            <Icon icon={Receipt} size={17} />
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-2">
        {(["new", "old"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`min-h-9 rounded-btn text-[11.5px] font-extrabold ${
              tab === t ? "bg-primary text-white" : "bg-bg text-text-secondary"
            }`}
          >
            {t === "new" ? "New books" : "Old books"}
          </button>
        ))}
      </div>

      <div className="relative">
        <Icon icon={Search} size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title or author"
          className="w-full rounded-btn border border-border bg-transparent py-2.5 pl-9 pr-3 text-[12px] font-bold"
        />
      </div>

      {tab === "new" ? (
        newResults.length === 0 ? (
          <Card className="text-center text-[11.5px] font-semibold text-text-secondary">No new books here yet.</Card>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {newResults.map((p) => (
              <ProductCard key={p.id} product={p} qty={qtyOf(p.id)} onAdd={() => add(p.id)} onSetQty={(qty) => setQty(p.id, qty)} />
            ))}
          </div>
        )
      ) : (
        <>
          <button
            type="button"
            onClick={() => setSellOpen(true)}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-btn bg-primary-soft text-[12px] font-extrabold text-primary"
          >
            <Icon icon={Plus} size={15} /> Sell a book
          </button>

          {oldResults.length === 0 ? (
            <Card className="text-center text-[11.5px] font-semibold text-text-secondary">No old books listed yet.</Card>
          ) : (
            <div className="flex flex-col gap-2.5">
              {oldResults.map((b) => {
                const isSaved = saved.has(b.id);
                const isMine = b.sellerId === user?.id;
                return (
                  <Card key={b.id} className="flex items-center gap-3">
                    {b.image ? (
                      <ProductImage image={b.image} kind="book" alt={b.title} className="h-11 w-11 shrink-0 rounded-btn" />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn bg-orange-soft text-orange">
                        <Icon icon={BookOpen} size={18} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-extrabold">{b.title}</div>
                      <div className="text-[10px] font-semibold text-text-secondary">{b.author}</div>
                      <div className="truncate text-[9.5px] font-semibold text-text-secondary">
                        {b.academicClass} · {b.condition} · {isMine ? "You" : b.sellerName}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <div className={`text-[12.5px] font-extrabold ${b.free ? "text-primary" : "text-primary"}`}>
                        {b.free ? "Free" : formatBDT(b.price)}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isMine ? (
                          <button
                            type="button"
                            onClick={async () => {
                              await repo.usedBooks.remove(b.id);
                              toast("Listing removed");
                            }}
                            aria-label="Delist book"
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-danger-soft text-danger"
                          >
                            <Icon icon={Trash2} size={13} />
                          </button>
                        ) : (
                          <a
                            href={`tel:${b.phone}`}
                            aria-label={`Call ${b.sellerName}`}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft text-primary"
                          >
                            <Icon icon={Phone} size={13} />
                          </a>
                        )}
                        <button type="button" onClick={() => save(b.id, b.title)} aria-label="Save book">
                          <Chip tone="primary" active={isSaved}>
                            <Icon icon={Heart} size={12} />
                          </Chip>
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === "new" && <CartBar count={count} subtotal={subtotal} />}

      <SellBookSheet open={sellOpen} onClose={() => setSellOpen(false)} user={user} />
    </div>
  );
}

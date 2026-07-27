"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronRight, Package, Plus, Search, Settings, ShoppingBag, Tag, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Switch } from "@/components/ui/Switch";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/Toast";
import { AddProductSheet } from "@/components/store/AddProductSheet";
import { ProductImage } from "@/components/store/ProductImage";
import { DeliverySettingsSheet } from "@/components/store/DeliverySettingsSheet";
import { CouponFormSheet } from "@/components/store/CouponFormSheet";
import { useAllProducts } from "@/hooks/useProducts";
import { useAllOrders } from "@/hooks/useOrders";
import { useUsedBooks } from "@/hooks/useUsedBooks";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { useCoupons } from "@/hooks/useCoupons";
import { repo, type Coupon, type Product } from "@/lib/data";
import { BOOK_CATEGORIES, GROCERY_CATEGORIES } from "@/lib/explore/content";
import { formatBDT } from "@/lib/utils/currency";

type Tab = "grocery" | "book" | "old" | "coupons";

export default function ServiceStorePage() {
  const all = useAllProducts();
  const orders = useAllOrders();
  const usedBooks = useUsedBooks();
  const storeSettings = useStoreSettings();
  const coupons = useCoupons();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("grocery");
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("All");
  // null = closed; { product: null } = add; { product } = edit.
  const [sheet, setSheet] = useState<{ product: Product | null } | null>(null);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  // null = closed; { coupon: null } = add; { coupon } = edit.
  const [couponSheet, setCouponSheet] = useState<{ coupon: Coupon | null } | null>(null);

  const live = all.filter((p) => p.active).length;
  const openOrders = orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled").length;

  const switchTab = (t: Tab) => {
    setTab(t);
    setCat("All");
    setQuery("");
  };

  const q = query.toLowerCase();
  const categories = tab === "grocery" ? GROCERY_CATEGORIES : BOOK_CATEGORIES;
  const products = all.filter(
    (p) =>
      p.kind === (tab === "grocery" ? "grocery" : "book") &&
      (cat === "All" || p.category === cat) &&
      `${p.name} ${p.author ?? ""}`.toLowerCase().includes(q)
  );
  const oldResults = usedBooks.filter(
    (b) =>
      (cat === "All" || b.category === cat) &&
      `${b.title} ${b.author} ${b.sellerName}`.toLowerCase().includes(q)
  );

  return (
    <div className="flex flex-col gap-4 pt-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[17.5px] font-extrabold tracking-tight">Store manager</div>
          <div className="text-[10.5px] font-semibold text-text-secondary">
            Platform e-commerce · grocery &amp; books
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setDeliveryOpen(true)}
            aria-label="Delivery & fees"
            className="flex h-10 w-10 items-center justify-center rounded-btn bg-bg text-text-secondary shadow-chip"
          >
            <Icon icon={Settings} size={16} />
          </button>
          <button
            type="button"
            onClick={() => setSheet({ product: null })}
            className="flex min-h-10 items-center gap-1.5 rounded-btn bg-primary px-3.5 text-[11.5px] font-extrabold text-white shadow-chip"
          >
            <Icon icon={Plus} size={15} /> Add product
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2.5">
        <Card className="flex flex-col items-center gap-1 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Icon icon={ShoppingBag} size={15} />
          </div>
          <div className="text-[15px] font-extrabold leading-none">{all.length}</div>
          <div className="text-[9px] font-bold text-text-secondary">Products</div>
        </Card>
        <Card className="flex flex-col items-center gap-1 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-soft text-blue">
            <Icon icon={BookOpen} size={15} />
          </div>
          <div className="text-[15px] font-extrabold leading-none">{live}</div>
          <div className="text-[9px] font-bold text-text-secondary">Live in store</div>
        </Card>
        <Link href="/service/orders">
          <Card className="flex flex-col items-center gap-1 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-soft text-orange">
              <Icon icon={Package} size={15} />
            </div>
            <div className="text-[15px] font-extrabold leading-none">{openOrders}</div>
            <div className="flex items-center gap-0.5 text-[9px] font-bold text-text-secondary">
              Open orders <Icon icon={ChevronRight} size={9} />
            </div>
          </Card>
        </Link>
      </div>

      {/* Inventory tabs */}
      <SegmentedControl<Tab>
        className="w-full [&>button]:flex-1"
        value={tab}
        onChange={switchTab}
        options={[
          { value: "grocery", label: "Grocery" },
          { value: "book", label: "New books" },
          { value: "old", label: "Old books" },
          { value: "coupons", label: "Coupons" },
        ]}
      />

      {tab === "coupons" && (
        <button
          type="button"
          onClick={() => setCouponSheet({ coupon: null })}
          className="flex min-h-10 items-center justify-center gap-1.5 rounded-btn bg-primary text-[11.5px] font-extrabold text-white shadow-chip"
        >
          <Icon icon={Plus} size={15} /> New coupon
        </button>
      )}

      {/* Search + category filter */}
      {tab !== "coupons" && (
        <>
          <div className="relative">
            <Icon icon={Search} size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === "old" ? "Search title, author or seller" : "Search products"}
              className="w-full rounded-btn border border-border bg-card py-2.5 pl-9 pr-3 text-[12px] font-bold shadow-chip"
            />
          </div>
          <div className="-mt-1 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
            {["All", ...categories].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCat(c)}
                className={`shrink-0 rounded-pill px-3 py-1.5 text-[10px] font-extrabold ${
                  cat === c ? "bg-primary text-white" : "bg-card text-text-secondary shadow-chip"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </>
      )}

      {tab === "grocery" || tab === "book" ? (
        products.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 py-10 text-center">
            <Icon icon={ShoppingBag} size={26} className="text-text-secondary" />
            <div className="text-[12px] font-extrabold">No products found</div>
            <div className="text-[10.5px] font-semibold text-text-secondary">
              Adjust the filters or add a new product.
            </div>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1 text-[10px] font-extrabold uppercase tracking-wide text-text-secondary">
              <span>{products.length} item{products.length > 1 ? "s" : ""}</span>
              <span>Tap a product to edit</span>
            </div>
            {products.map((p) => (
              <Card key={p.id} className={`flex items-center gap-3 ${p.active ? "" : "opacity-55"}`}>
                <button
                  type="button"
                  onClick={() => setSheet({ product: p })}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                >
                  <ProductImage
                    image={p.image}
                    kind={p.kind}
                    alt={p.name}
                    className="h-12 w-12 shrink-0 rounded-btn"
                    iconSize={18}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-extrabold">{p.name}</div>
                    <div className="mt-0.5 truncate text-[9.5px] font-semibold text-text-secondary">
                      {p.category}
                      {p.kind === "book" && p.academicClass ? ` · ${p.academicClass}` : ""}
                    </div>
                    <div className="mt-0.5 text-[11.5px] font-extrabold text-primary">
                      {formatBDT(p.price)}
                      {p.kind === "grocery" && p.unit && (
                        <span className="text-[9px] font-bold text-text-secondary"> / {p.unit}</span>
                      )}
                    </div>
                  </div>
                </button>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Switch checked={p.active} onChange={() => repo.products.toggleActive(p.id)} />
                  <span className={`text-[8.5px] font-extrabold ${p.active ? "text-primary" : "text-text-secondary"}`}>
                    {p.active ? "LIVE" : "HIDDEN"}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : tab === "old" ? (
        oldResults.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 py-10 text-center">
            <Icon icon={BookOpen} size={26} className="text-text-secondary" />
            <div className="text-[12px] font-extrabold">No member listings</div>
            <div className="text-[10.5px] font-semibold text-text-secondary">
              Old books members list for sale appear here for moderation.
            </div>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="px-1 text-[10px] font-extrabold uppercase tracking-wide text-text-secondary">
              {oldResults.length} member listing{oldResults.length > 1 ? "s" : ""} · sold member-to-member
            </div>
            {oldResults.map((b) => (
              <Card key={b.id} className="flex items-center gap-3">
                {b.image ? (
                  <ProductImage image={b.image} kind="book" alt={b.title} className="h-12 w-12 shrink-0 rounded-btn" />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-btn bg-orange-soft text-orange">
                    <Icon icon={BookOpen} size={18} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-extrabold">{b.title}</div>
                  <div className="mt-0.5 truncate text-[9.5px] font-semibold text-text-secondary">
                    {b.academicClass} · {b.condition} · by {b.sellerName}
                  </div>
                  <div className="mt-0.5 text-[11.5px] font-extrabold text-primary">
                    {b.free ? "Free" : formatBDT(b.price)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await repo.usedBooks.remove(b.id);
                    toast("Listing removed");
                  }}
                  aria-label="Remove listing"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger"
                >
                  <Icon icon={Trash2} size={15} />
                </button>
              </Card>
            ))}
          </div>
        )
      ) : coupons.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-10 text-center">
          <Icon icon={Tag} size={26} className="text-text-secondary" />
          <div className="text-[12px] font-extrabold">No coupons yet</div>
          <div className="text-[10.5px] font-semibold text-text-secondary">
            Create a code members can enter at checkout for a discount.
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {coupons.map((c) => (
            <Card key={c.id} className={`flex items-center gap-3 ${c.active ? "" : "opacity-55"}`}>
              <button
                type="button"
                onClick={() => setCouponSheet({ coupon: c })}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn bg-primary-soft text-primary">
                  <Icon icon={Tag} size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-extrabold">{c.code}</div>
                  <div className="mt-0.5 truncate text-[9.5px] font-semibold text-text-secondary">
                    {c.kind === "percent" ? `${c.value}% off` : `${formatBDT(c.value)} off`}
                    {c.minOrderAmount ? ` · min ${formatBDT(c.minOrderAmount)}` : ""}
                  </div>
                  <div className="mt-0.5 text-[9.5px] font-semibold text-text-secondary">
                    {c.usedCount} used{c.maxUses ? ` / ${c.maxUses}` : ""}
                    {c.expiresAt ? ` · expires ${c.expiresAt}` : ""}
                  </div>
                </div>
              </button>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <Switch checked={c.active} onChange={() => repo.coupons.update(c.id, { active: !c.active })} />
                <button
                  type="button"
                  onClick={async () => {
                    await repo.coupons.remove(c.id);
                    toast("Coupon removed");
                  }}
                  aria-label="Remove coupon"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-danger-soft text-danger"
                >
                  <Icon icon={Trash2} size={13} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AddProductSheet open={!!sheet} onClose={() => setSheet(null)} product={sheet?.product} />
      <DeliverySettingsSheet
        open={deliveryOpen}
        onClose={() => setDeliveryOpen(false)}
        settings={storeSettings}
        onSaved={() => toast("Delivery settings saved")}
      />
      <CouponFormSheet
        open={!!couponSheet}
        onClose={() => setCouponSheet(null)}
        coupon={couponSheet?.coupon ?? null}
        onSaved={() => toast(couponSheet?.coupon ? "Coupon updated" : "Coupon created")}
      />
    </div>
  );
}

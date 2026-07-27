"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { useAllOrders } from "@/hooks/useOrders";
import { repo, type Order, type OrderStatus, type User } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";
import { formatShortDate } from "@/lib/utils/date";
import { ORDER_STATUS_FLOW, ORDER_STATUS_LABEL, ORDER_STATUS_TONE, nextOrderStatus } from "@/lib/utils/store";

const FILTERS: ("all" | OrderStatus)[] = ["all", ...ORDER_STATUS_FLOW, "cancelled"];

export default function ServiceOrdersPage() {
  const orders = useAllOrders();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    repo.users.listAll().then(setUsers);
  }, []);

  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? "Member";

  const open = orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled").length;
  const revenue = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + o.total, 0);
  const q = query.trim().toLowerCase();
  const results = orders.filter(
    (o) =>
      (filter === "all" || o.status === filter) &&
      (!q || nameOf(o.userId).toLowerCase().includes(q) || o.id.toLowerCase().includes(q))
  );

  const setStatus = async (o: Order, status: Order["status"]) => {
    await repo.orders.updateStatus(o.id, status);
    toast(status === "cancelled" ? "Order cancelled" : `Order ${ORDER_STATUS_LABEL[status].toLowerCase()}`);
  };

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div>
        <div className="text-[17.5px] font-extrabold tracking-tight">Store orders</div>
        <div className="text-[10.5px] font-semibold text-text-secondary">
          Grocery &amp; book orders placed by members
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <Card className="py-3 text-center">
          <div className="text-[16px] font-extrabold">{orders.length}</div>
          <div className="text-[9.5px] font-bold text-text-secondary">Total orders</div>
        </Card>
        <Card className="py-3 text-center">
          <div className="text-[16px] font-extrabold text-orange">{open}</div>
          <div className="text-[9.5px] font-bold text-text-secondary">Open</div>
        </Card>
        <Card className="py-3 text-center">
          <div className="text-[16px] font-extrabold text-primary">{formatBDT(revenue)}</div>
          <div className="text-[9.5px] font-bold text-text-secondary">Revenue</div>
        </Card>
      </div>

      <div className="relative">
        <Icon icon={Search} size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search buyer name or order id"
          className="w-full rounded-btn border border-border bg-card py-2.5 pl-9 pr-3 text-[12px] font-bold shadow-chip"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-pill px-3 py-1.5 text-[10.5px] font-extrabold ${
              filter === f ? "bg-primary text-white" : "bg-bg text-text-secondary"
            }`}
          >
            {f === "all" ? "All" : ORDER_STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {results.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-bg text-text-secondary">
            <Icon icon={Package} size={24} />
          </div>
          <div className="text-[12.5px] font-extrabold">No orders here</div>
          <div className="text-[10.5px] font-semibold text-text-secondary">
            Member orders will appear as they come in.
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {results.map((o) => (
            <Card key={o.id} className="flex flex-col gap-2">
              <Link href={`/service/orders/${o.id}`} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-extrabold">{nameOf(o.userId)}</div>
                    <div className="text-[10px] font-semibold text-text-secondary">
                      {formatShortDate(o.createdAt.slice(0, 10))} · {o.paymentMethod}
                      {o.note ? ` · ${o.note}` : ""}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-pill px-2.5 py-1 text-[9.5px] font-extrabold ${ORDER_STATUS_TONE[o.status]}`}>
                    {ORDER_STATUS_LABEL[o.status]}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {o.items.map((i) => (
                    <span key={i.productId} className="rounded-pill bg-bg px-2 py-1 text-[10px] font-bold text-text-secondary">
                      {i.name} ×{i.qty}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t border-border pt-2">
                  <span className="text-[10.5px] font-semibold text-text-secondary">
                    {o.items.reduce((n, i) => n + i.qty, 0)} items · delivery {o.deliveryFee === 0 ? "free" : formatBDT(o.deliveryFee)}
                  </span>
                  <span className="text-[13px] font-extrabold text-primary">{formatBDT(o.total)}</span>
                </div>
              </Link>

              {o.status !== "delivered" && o.status !== "cancelled" && (
                <div className="flex gap-2">
                  {nextOrderStatus(o.status) && (
                    <button
                      type="button"
                      onClick={() => setStatus(o, nextOrderStatus(o.status)!)}
                      className="min-h-9 flex-1 rounded-btn bg-primary text-[11.5px] font-extrabold text-white"
                    >
                      {o.status === "placed" ? "Confirm order" : `Mark ${ORDER_STATUS_LABEL[nextOrderStatus(o.status)!].toLowerCase()}`}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setStatus(o, "cancelled")}
                    className="min-h-9 flex-1 rounded-btn bg-danger-soft text-[11.5px] font-extrabold text-danger"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Package } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { useAllOrders } from "@/hooks/useOrders";
import { repo, type Order, type User } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";
import { formatShortDate } from "@/lib/utils/date";

const STATUS_TONE: Record<Order["status"], string> = {
  placed: "bg-blue-soft text-blue",
  confirmed: "bg-orange-soft text-orange",
  delivered: "bg-primary-soft text-primary",
  cancelled: "bg-danger-soft text-danger",
};

const FILTERS: ("all" | Order["status"])[] = ["all", "placed", "confirmed", "delivered", "cancelled"];

export default function ServiceOrdersPage() {
  const orders = useAllOrders();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");

  useEffect(() => {
    repo.users.listAll().then(setUsers);
  }, []);

  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? "Member";

  const open = orders.filter((o) => o.status === "placed" || o.status === "confirmed").length;
  const revenue = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + o.total, 0);
  const results = orders.filter((o) => filter === "all" || o.status === filter);

  const setStatus = async (o: Order, status: Order["status"]) => {
    await repo.orders.updateStatus(o.id, status);
    toast(
      status === "confirmed"
        ? "Order confirmed"
        : status === "delivered"
          ? "Order marked delivered"
          : "Order cancelled"
    );
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

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-pill px-3 py-1.5 text-[10.5px] font-extrabold capitalize ${
              filter === f ? "bg-primary text-white" : "bg-bg text-text-secondary"
            }`}
          >
            {f}
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
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-extrabold">{nameOf(o.userId)}</div>
                  <div className="text-[10px] font-semibold text-text-secondary">
                    {formatShortDate(o.createdAt.slice(0, 10))} · {o.paymentMethod}
                    {o.note ? ` · ${o.note}` : ""}
                  </div>
                </div>
                <span className={`shrink-0 rounded-pill px-2.5 py-1 text-[9.5px] font-extrabold capitalize ${STATUS_TONE[o.status]}`}>
                  {o.status}
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

              {(o.status === "placed" || o.status === "confirmed") && (
                <div className="flex gap-2">
                  {o.status === "placed" ? (
                    <button
                      type="button"
                      onClick={() => setStatus(o, "confirmed")}
                      className="min-h-9 flex-1 rounded-btn bg-primary text-[11.5px] font-extrabold text-white"
                    >
                      Confirm order
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setStatus(o, "delivered")}
                      className="min-h-9 flex-1 rounded-btn bg-primary text-[11.5px] font-extrabold text-white"
                    >
                      Mark delivered
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

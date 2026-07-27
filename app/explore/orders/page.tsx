"use client";

import Link from "next/link";
import { Package } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ExploreHeader } from "@/components/explore/ExploreHeader";
import { useOrders } from "@/hooks/useOrders";
import { formatBDT } from "@/lib/utils/currency";
import { formatShortDate } from "@/lib/utils/date";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/utils/store";

export default function OrdersPage() {
  const { user } = useSession();
  const orders = useOrders(user?.id);

  return (
    <div className="flex flex-col gap-4 pb-4">
      <ExploreHeader title="My orders" subtitle={`${orders.length} order${orders.length === 1 ? "" : "s"}`} />

      {orders.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-bg text-text-secondary">
            <Icon icon={Package} size={24} />
          </div>
          <div className="text-[12.5px] font-extrabold">No orders yet</div>
          <Link href="/explore/grocery">
            <Button variant="secondary">Start shopping</Button>
          </Link>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {orders.map((o) => (
            <Link key={o.id} href={`/explore/orders/${o.id}`}>
              <Card className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold text-text-secondary">
                    {formatShortDate(o.createdAt.slice(0, 10))} · {o.paymentMethod}
                  </div>
                  <span className={`rounded-pill px-2.5 py-1 text-[9.5px] font-extrabold ${ORDER_STATUS_TONE[o.status]}`}>
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
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useOrders } from "@/hooks/useOrders";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { OrderInvoice } from "@/components/store/OrderInvoice";
import { repo } from "@/lib/data";

export default function BuyerOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, hostel } = useSession();
  const orders = useOrders(user?.id);
  const { toast } = useToast();
  const [cancelling, setCancelling] = useState(false);

  const order = orders.find((o) => o.id === id);

  const cancel = async () => {
    if (!order || cancelling) return;
    setCancelling(true);
    try {
      await repo.orders.cancel(order.id);
      toast("Order cancelled");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not cancel this order.");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex items-center gap-3 pt-2 print:hidden">
        <button
          type="button"
          onClick={() => router.push("/explore/orders")}
          aria-label="Back to my orders"
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-bg"
        >
          <Icon icon={ChevronLeft} size={18} />
        </button>
        <div className="text-[17.5px] font-extrabold tracking-tight">Order details</div>
      </div>

      {!order ? (
        <Card className="text-center text-[11.5px] font-semibold text-text-secondary">Order not found.</Card>
      ) : (
        <>
          <OrderInvoice order={order} buyerName={user?.name ?? "You"} buyerPhone={user?.phone} hostelName={hostel?.name} />
          {order.status === "placed" && (
            <Button fullWidth variant="secondary" onClick={cancel} disabled={cancelling} className="print:hidden">
              {cancelling ? "Cancelling…" : "Cancel order"}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

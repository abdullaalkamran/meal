"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Phone } from "lucide-react";
import { useAllOrders } from "@/hooks/useOrders";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { OrderInvoice } from "@/components/store/OrderInvoice";
import { repo, type Hostel, type Order, type User } from "@/lib/data";
import { ORDER_STATUS_LABEL, nextOrderStatus } from "@/lib/utils/store";

export default function ServiceOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const orders = useAllOrders();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    repo.users.listAll().then(setUsers);
    repo.hostels.listAll().then(setHostels);
  }, []);

  const order = orders.find((o) => o.id === id);
  const buyer = order ? users.find((u) => u.id === order.userId) : undefined;
  const buyerHostel = buyer?.hostelId ? hostels.find((h) => h.id === buyer.hostelId) : undefined;

  const setStatus = async (status: Order["status"]) => {
    if (!order || updating) return;
    setUpdating(true);
    try {
      await repo.orders.updateStatus(order.id, status);
      toast(status === "cancelled" ? "Order cancelled" : `Order ${ORDER_STATUS_LABEL[status].toLowerCase()}`);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 pt-2 pb-4">
      <div className="flex items-center gap-3 print:hidden">
        <button
          type="button"
          onClick={() => router.push("/service/orders")}
          aria-label="Back to orders"
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
          {buyer?.phone && (
            <a
              href={`tel:${buyer.phone}`}
              className="flex items-center justify-between rounded-btn bg-bg px-3 py-2.5 print:hidden"
            >
              <div className="min-w-0">
                <div className="text-[9px] font-bold text-text-secondary">CONTACT BUYER</div>
                <div className="truncate text-[11.5px] font-extrabold">{buyer.phone}</div>
              </div>
              <Icon icon={Phone} size={16} className="shrink-0 text-primary" />
            </a>
          )}

          <OrderInvoice
            order={order}
            buyerName={buyer?.name ?? "Member"}
            buyerPhone={buyer?.phone ?? order.buyerPhone}
            hostelName={buyerHostel?.name}
          />

          {order.status !== "delivered" && order.status !== "cancelled" && (
            <div className="flex gap-2 print:hidden">
              {nextOrderStatus(order.status) && (
                <button
                  type="button"
                  onClick={() => setStatus(nextOrderStatus(order.status)!)}
                  disabled={updating}
                  className="min-h-11 flex-1 rounded-btn bg-primary text-[12px] font-extrabold text-white disabled:opacity-50"
                >
                  {order.status === "placed" ? "Confirm order" : `Mark ${ORDER_STATUS_LABEL[nextOrderStatus(order.status)!].toLowerCase()}`}
                </button>
              )}
              <button
                type="button"
                onClick={() => setStatus("cancelled")}
                disabled={updating}
                className="min-h-11 flex-1 rounded-btn bg-danger-soft text-[12px] font-extrabold text-danger disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

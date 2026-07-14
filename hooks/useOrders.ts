"use client";

import { useEffect, useState } from "react";
import { repo, type Order } from "@/lib/data";

/** The current user's orders, newest first. */
export function useOrders(userId: string | undefined): Order[] {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!userId) return;
    return repo.orders.subscribe(userId, setOrders);
  }, [userId]);

  return orders;
}

/** Every order across the platform, newest first — Service Manager order management. */
export function useAllOrders(): Order[] {
  const [orders, setOrders] = useState<Order[]>([]);
  useEffect(() => repo.orders.subscribeAll(setOrders), []);
  return orders;
}

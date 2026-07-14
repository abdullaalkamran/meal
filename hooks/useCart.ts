"use client";

import { useEffect, useState } from "react";
import { repo, type CartItem } from "@/lib/data";

/** The current user's persisted cart lines (empty until a userId is known). */
export function useCart(userId: string | undefined): CartItem[] {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    if (!userId) return;
    return repo.cart.subscribe(userId, setItems);
  }, [userId]);

  return items;
}

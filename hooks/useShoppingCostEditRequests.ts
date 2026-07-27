"use client";

import { useEffect, useState } from "react";
import { repo, type ShoppingCostEditRequest } from "@/lib/data";

export function useShoppingCostEditRequests(hostelId: string | undefined) {
  const [requests, setRequests] = useState<ShoppingCostEditRequest[]>([]);

  useEffect(() => {
    if (!hostelId) return;
    return repo.shoppingCostEdits.subscribe(hostelId, setRequests);
  }, [hostelId]);

  return requests;
}

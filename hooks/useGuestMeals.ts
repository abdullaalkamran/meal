"use client";

import { useEffect, useState } from "react";
import { repo, type GuestMealRequest } from "@/lib/data";

export function useGuestMeals(hostelId: string | undefined) {
  const [requests, setRequests] = useState<GuestMealRequest[]>([]);

  useEffect(() => {
    if (!hostelId) return;
    return repo.guestMeals.subscribe(hostelId, setRequests);
  }, [hostelId]);

  return requests;
}

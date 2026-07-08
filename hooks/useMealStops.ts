"use client";

import { useEffect, useState } from "react";
import { repo, type MealStopRequest } from "@/lib/data";

export function useMealStops(hostelId: string | undefined) {
  const [requests, setRequests] = useState<MealStopRequest[]>([]);

  useEffect(() => {
    if (!hostelId) return;
    return repo.mealStops.subscribe(hostelId, setRequests);
  }, [hostelId]);

  return requests;
}

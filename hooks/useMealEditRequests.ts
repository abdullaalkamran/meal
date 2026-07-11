"use client";

import { useEffect, useState } from "react";
import { repo, type MealEditRequest } from "@/lib/data";

export function useMealEditRequests(hostelId: string | undefined) {
  const [requests, setRequests] = useState<MealEditRequest[]>([]);

  useEffect(() => {
    if (!hostelId) return;
    return repo.mealEdits.subscribe(hostelId, setRequests);
  }, [hostelId]);

  return requests;
}

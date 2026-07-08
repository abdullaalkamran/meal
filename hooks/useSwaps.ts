"use client";

import { useEffect, useState } from "react";
import { repo, type SwapRequest } from "@/lib/data";

export function useSwaps(hostelId: string | undefined) {
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);

  useEffect(() => {
    if (!hostelId) return;
    return repo.swaps.subscribe(hostelId, setSwaps);
  }, [hostelId]);

  return swaps;
}

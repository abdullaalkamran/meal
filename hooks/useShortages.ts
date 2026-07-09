"use client";

import { useEffect, useState } from "react";
import { repo, type ShortageRequest } from "@/lib/data";

export function useShortages(hostelId: string | undefined) {
  const [list, setList] = useState<ShortageRequest[]>([]);

  useEffect(() => {
    if (!hostelId) return;
    return repo.shortages.subscribe(hostelId, setList);
  }, [hostelId]);

  return list;
}

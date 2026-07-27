"use client";

import { useEffect, useState } from "react";
import { repo, type Promotion } from "@/lib/data";

/** All promotions (for the Service dashboard). */
export function usePromotions() {
  const [list, setList] = useState<Promotion[]>([]);
  useEffect(() => repo.promotions.subscribe(setList), []);
  return list;
}

/** Active promotions for one placement (home hero or login popup). */
export function useActivePromotions(placement: Promotion["placement"]) {
  const all = usePromotions();
  return all.filter((p) => p.placement === placement && p.active);
}

"use client";

import { useEffect, useState } from "react";
import { repo, type Promotion } from "@/lib/data";
import { isAvailableAt } from "@/lib/geo/bangladesh";
import { useMemberArea } from "./useMemberArea";

/** All promotions (for the Service dashboard — unfiltered, incl. inactive and
 * every region, so managers can see and edit everything they've uploaded). */
export function usePromotions() {
  const [list, setList] = useState<Promotion[]>([]);
  useEffect(() => repo.promotions.subscribe(setList), []);
  return list;
}

/** Active promotions for one placement (home hero or login popup), gated to
 * the signed-in member's own region. */
export function useActivePromotions(placement: Promotion["placement"]) {
  const all = usePromotions();
  const area = useMemberArea();
  return all.filter((p) => p.placement === placement && p.active && isAvailableAt(p.areas, area));
}

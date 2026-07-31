"use client";

import { useEffect, useState } from "react";
import { repo } from "@/lib/data";
import { currentMonth } from "@/lib/utils/date";

/** A member's own meals this month, live — so they see them without waiting
 * for a generated bill. Re-fetched on any meal change (incl. the manager
 * confirming cooking, which moves meals from "on" into "billed"). */
export function useMemberMealSummary(hostelId: string | undefined, userId: string | undefined, month?: string) {
  const [summary, setSummary] = useState<{ mealsOn: number; billedMeals: number; cost: number } | null>(null);

  useEffect(() => {
    if (!hostelId || !userId) return;
    let cancelled = false;
    const m = month ?? currentMonth();
    const load = () =>
      repo.meals.getMemberMealSummary(hostelId, userId, m).then((r) => {
        if (!cancelled) setSummary(r);
      });
    load();
    const unsub = repo.meals.subscribe(hostelId, load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [hostelId, userId, month]);

  return summary;
}

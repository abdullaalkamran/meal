"use client";

import { useEffect, useState } from "react";
import { repo } from "@/lib/data";
import { currentMonth } from "@/lib/utils/date";

/** The automatic per-meal cost of a month (shopping ÷ meals, member+guest) —
 * live against meal-day changes. Zero until the month has shopping + meals. */
export function useActualMealRate(hostelId: string | undefined, month?: string) {
  const [info, setInfo] = useState({ rate: 0, totalShopping: 0, totalMeals: 0 });

  useEffect(() => {
    if (!hostelId) return;
    let cancelled = false;
    const m = month ?? currentMonth();
    const load = () =>
      repo.meals.getActualMealRate(hostelId, m).then((r) => {
        if (!cancelled) setInfo(r);
      });
    load();
    const unsub = repo.meals.subscribe(hostelId, load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [hostelId, month]);

  return info;
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { repo, type MealDay, type MealSlot } from "@/lib/data";

export function useMealDay(hostelId: string | undefined, date: string | undefined) {
  const [day, setDay] = useState<MealDay | undefined>(undefined);

  useEffect(() => {
    if (!hostelId || !date) return;
    let cancelled = false;
    const load = () =>
      repo.meals.getMealDay(hostelId, date).then((d) => {
        if (!cancelled) setDay(d);
      });
    load();
    const unsub = repo.meals.subscribe(hostelId, (d) => {
      if (d.date === date) setDay(d);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [hostelId, date]);

  const setToggle = useCallback(
    (userId: string, meal: MealSlot, on: boolean) => {
      if (!hostelId || !date) return;
      return repo.meals.setMemberMealToggle(hostelId, userId, date, meal, on);
    },
    [hostelId, date]
  );

  const addGuest = useCallback(
    (userId: string, meal: MealSlot, count: number) => {
      if (!hostelId || !date) return;
      return repo.meals.addGuestMeal(hostelId, userId, date, meal, count);
    },
    [hostelId, date]
  );

  return { day, setToggle, addGuest };
}

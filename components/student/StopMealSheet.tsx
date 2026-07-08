"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { repo, type MealSlot } from "@/lib/data";
import { today, addDays } from "@/lib/utils/date";

const MEALS: MealSlot[] = ["breakfast", "lunch", "dinner"];
const MEAL_LABEL: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

export function StopMealSheet({
  open,
  onClose,
  hostelId,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  hostelId: string | undefined;
  userId: string | undefined;
}) {
  const { toast } = useToast();
  const [meals, setMeals] = useState<MealSlot[]>(["lunch", "dinner"]);
  const [dateFrom, setDateFrom] = useState(addDays(today(), 1));
  const [dateTo, setDateTo] = useState(addDays(today(), 2));
  const [reason, setReason] = useState("");

  const toggleMeal = (meal: MealSlot) => {
    setMeals((prev) =>
      prev.includes(meal) ? prev.filter((m) => m !== meal) : [...prev, meal]
    );
  };

  const submit = async () => {
    if (!hostelId || !userId || meals.length === 0) return;
    await repo.mealStops.request({ hostelId, userId, meals, dateFrom, dateTo, reason });
    toast("Meal stop request sent for approval");
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Stop meal">
      <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
        Select meals
      </div>
      <div className="mb-4 flex gap-2">
        {MEALS.map((meal) => (
          <button key={meal} type="button" onClick={() => toggleMeal(meal)}>
            <Chip tone="primary" active={meals.includes(meal)}>
              {MEAL_LABEL[meal]} {meals.includes(meal) ? "✓" : ""}
            </Chip>
          </button>
        ))}
      </div>

      <div className="mb-4 flex gap-3">
        <label className="min-w-0 flex-1">
          <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">FROM</div>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
          />
        </label>
        <label className="min-w-0 flex-1">
          <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">TO</div>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
          />
        </label>
      </div>

      <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">
        REASON (OPTIONAL)
      </div>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Going home for the weekend"
        className="mb-4 h-20 w-full resize-none rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-semibold"
      />

      <Button fullWidth onClick={submit} disabled={meals.length === 0}>
        Submit
      </Button>
    </Sheet>
  );
}

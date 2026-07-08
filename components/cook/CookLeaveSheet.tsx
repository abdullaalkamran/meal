"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { repo, type MealSlot } from "@/lib/data";
import { addDays, today } from "@/lib/utils/date";

const MEALS: MealSlot[] = ["breakfast", "lunch", "dinner"];
const MEAL_LABEL: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

export function CookLeaveSheet({
  open,
  onClose,
  hostelId,
  cookId,
  onToast,
}: {
  open: boolean;
  onClose: () => void;
  hostelId: string | undefined;
  cookId: string | undefined;
  onToast: (message: string) => void;
}) {
  const [scope, setScope] = useState<"full-day" | "partial">("full-day");
  const [meals, setMeals] = useState<MealSlot[]>(["lunch", "dinner"]);
  const [dateFrom, setDateFrom] = useState(today());
  const [dateTo, setDateTo] = useState(addDays(today(), 1));
  const [reason, setReason] = useState("");

  const toggleMeal = (meal: MealSlot) => {
    setMeals((prev) => (prev.includes(meal) ? prev.filter((m) => m !== meal) : [...prev, meal]));
  };

  const submit = async () => {
    if (!hostelId || !cookId || !reason.trim()) return;
    await repo.cookLeave.request({
      hostelId,
      cookId,
      dateFrom,
      dateTo,
      scope,
      meals: scope === "partial" ? meals : undefined,
      reason: reason.trim(),
    });
    onToast("Leave request sent to manager");
    setReason("");
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Request leave">
      <div className="mb-2 text-[10.5px] font-extrabold text-text-secondary">SCOPE</div>
      <div className="mb-4 flex gap-2">
        <button type="button" onClick={() => setScope("full-day")}>
          <Chip tone="primary" active={scope === "full-day"}>
            Full day
          </Chip>
        </button>
        <button type="button" onClick={() => setScope("partial")}>
          <Chip tone="primary" active={scope === "partial"}>
            Specific meals
          </Chip>
        </button>
      </div>

      {scope === "partial" && (
        <div className="mb-4 flex gap-2">
          {MEALS.map((meal) => (
            <button key={meal} type="button" onClick={() => toggleMeal(meal)}>
              <Chip tone="orange" active={meals.includes(meal)}>
                {MEAL_LABEL[meal]}
              </Chip>
            </button>
          ))}
        </div>
      )}

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

      <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">REASON</div>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Doctor visit in the morning"
        className="mb-4 h-20 w-full resize-none rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-semibold"
      />

      <Button fullWidth onClick={submit} disabled={!reason.trim()}>
        Send to manager
      </Button>
    </Sheet>
  );
}

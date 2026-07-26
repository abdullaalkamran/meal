"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/Toast";
import { repo, type MealSlot } from "@/lib/data";
import { today, addDays } from "@/lib/utils/date";

const MEALS: MealSlot[] = ["breakfast", "lunch", "dinner"];
const MEAL_LABEL: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

/** A member's request to the manager to turn their meals ON or OFF for a date
 * range whose cutoff has already passed (today, or a locked future day) — the
 * only way to change a locked date. `defaultOn` and `defaultMeals` let the
 * caller pre-set it (e.g. "request to turn on" straight from a locked slot). */
export function MealRequestSheet({
  open,
  onClose,
  hostelId,
  userId,
  defaultOn = false,
  defaultMeals,
}: {
  open: boolean;
  onClose: () => void;
  hostelId: string | undefined;
  userId: string | undefined;
  defaultOn?: boolean;
  defaultMeals?: MealSlot[];
}) {
  const { toast } = useToast();
  const [desiredOn, setDesiredOn] = useState(defaultOn);
  const [meals, setMeals] = useState<MealSlot[]>(defaultMeals ?? ["lunch", "dinner"]);
  const [dateFrom, setDateFrom] = useState(addDays(today(), 1));
  const [dateTo, setDateTo] = useState(addDays(today(), 2));
  const [reason, setReason] = useState("");

  // Re-seed from the caller's presets each time the sheet opens.
  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setDesiredOn(defaultOn);
      setMeals(defaultMeals ?? ["lunch", "dinner"]);
      setDateFrom(addDays(today(), 1));
      setDateTo(addDays(today(), 2));
      setReason("");
    });
  }, [open, defaultOn, defaultMeals]);

  const toggleMeal = (meal: MealSlot) => {
    setMeals((prev) => (prev.includes(meal) ? prev.filter((m) => m !== meal) : [...prev, meal]));
  };

  const submit = async () => {
    if (!hostelId || !userId || meals.length === 0) return;
    await repo.mealStops.request({ hostelId, userId, meals, dateFrom, dateTo, reason, desiredOn });
    toast(desiredOn ? "Request to turn meals on sent for approval" : "Request to turn meals off sent for approval");
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Meal request">
      <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
        I want to
      </div>
      <div className="mb-4">
        <SegmentedControl
          value={desiredOn ? "on" : "off"}
          onChange={(v) => setDesiredOn(v === "on")}
          options={[
            { value: "off", label: "Turn meals off" },
            { value: "on", label: "Turn meals on" },
          ]}
        />
      </div>

      <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
        Which meals
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

      <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">REASON (OPTIONAL)</div>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={desiredOn ? "I'll be back — please turn my meals on" : "Going home for the weekend"}
        className="mb-4 h-20 w-full resize-none rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-semibold"
      />

      <Button fullWidth onClick={submit} disabled={meals.length === 0}>
        Send request
      </Button>
    </Sheet>
  );
}

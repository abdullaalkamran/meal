"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/Toast";
import { repo, type MealSlot } from "@/lib/data";
import { formatShortDate, today } from "@/lib/utils/date";

const MEALS: MealSlot[] = ["breakfast", "lunch", "dinner"];
const MEAL_LABEL: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

/** A member's request to the manager to turn their meals ON or OFF for a
 * single day whose cutoff has already passed — the only way to change a
 * locked date. It's always for the day the member is viewing (`date`); once
 * a day is still editable they toggle it themselves instead. `defaultOn` and
 * `defaultMeals` let a locked slot pre-set it (e.g. "request to turn on"). */
export function MealRequestSheet({
  open,
  onClose,
  hostelId,
  userId,
  date,
  defaultOn = false,
  defaultMeals,
  currentOn,
}: {
  open: boolean;
  onClose: () => void;
  hostelId: string | undefined;
  userId: string | undefined;
  date?: string;
  defaultOn?: boolean;
  defaultMeals?: MealSlot[];
  /** The member's actual current on/off state per meal for `date` — a meal
   * already in the direction being requested is redundant and can't be
   * selected (turning "on" something that's already on does nothing). */
  currentOn?: Partial<Record<MealSlot, boolean>>;
}) {
  const { toast } = useToast();
  const forDay = date ?? today();
  const [desiredOn, setDesiredOn] = useState(defaultOn);
  const [meals, setMeals] = useState<MealSlot[]>(defaultMeals ?? ["lunch", "dinner"]);
  const [reason, setReason] = useState("");
  const isRedundant = (meal: MealSlot) => currentOn?.[meal] === desiredOn;

  // Re-seed from the caller's presets each time the sheet opens, dropping any
  // preset meal that's already in the requested direction.
  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setDesiredOn(defaultOn);
      setMeals((defaultMeals ?? ["lunch", "dinner"]).filter((m) => currentOn?.[m] !== defaultOn));
      setReason("");
    });
  }, [open, defaultOn, defaultMeals, currentOn]);

  // Flipping the requested direction can turn a selected meal redundant —
  // drop it rather than let it sit selected but useless.
  const setDirection = (next: boolean) => {
    setDesiredOn(next);
    setMeals((prev) => prev.filter((m) => currentOn?.[m] !== next));
  };

  const toggleMeal = (meal: MealSlot) => {
    if (isRedundant(meal)) return;
    setMeals((prev) => (prev.includes(meal) ? prev.filter((m) => m !== meal) : [...prev, meal]));
  };

  const changingMeals = meals.filter((m) => currentOn?.[m] !== desiredOn);

  const submit = async () => {
    if (!hostelId || !userId || changingMeals.length === 0) return;
    await repo.mealStops.request({
      hostelId,
      userId,
      meals: changingMeals,
      dateFrom: forDay,
      dateTo: forDay,
      reason,
      desiredOn,
    });
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
          onChange={(v) => setDirection(v === "on")}
          options={[
            { value: "off", label: "Turn meals off" },
            { value: "on", label: "Turn meals on" },
          ]}
        />
      </div>

      <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
        Which meals
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {MEALS.map((meal) => {
          const redundant = isRedundant(meal);
          return (
            <button
              key={meal}
              type="button"
              onClick={() => toggleMeal(meal)}
              disabled={redundant}
              className={redundant ? "cursor-not-allowed opacity-40" : undefined}
            >
              <Chip tone="primary" active={meals.includes(meal)}>
                {MEAL_LABEL[meal]}{" "}
                {redundant ? `(already ${desiredOn ? "on" : "off"})` : meals.includes(meal) ? "✓" : ""}
              </Chip>
            </button>
          );
        })}
      </div>

      <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
        For
      </div>
      <div className="mb-4 rounded-btn bg-bg px-3 py-2.5 text-[12px] font-extrabold">
        {formatShortDate(forDay)}
        {forDay === today() ? " · today" : ""}
      </div>

      <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">REASON (OPTIONAL)</div>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={desiredOn ? "I'll be back — please turn my meals on" : "Going home for the weekend"}
        className="mb-4 h-20 w-full resize-none rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-semibold"
      />

      <Button fullWidth onClick={submit} disabled={changingMeals.length === 0}>
        Send request
      </Button>
    </Sheet>
  );
}

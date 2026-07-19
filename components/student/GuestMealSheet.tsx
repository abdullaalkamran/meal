"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useActualMealRate } from "@/hooks/useActualMealRate";
import { repo, type MealSlot } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";
import { addDays, today } from "@/lib/utils/date";

const MEALS: MealSlot[] = ["breakfast", "lunch", "dinner"];
const MEAL_LABEL: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

export function GuestMealSheet({
  open,
  onClose,
  hostelId,
  userId,
  defaultDate,
}: {
  open: boolean;
  onClose: () => void;
  hostelId: string | undefined;
  userId: string | undefined;
  defaultDate?: string;
}) {
  const { toast } = useToast();
  const [meal, setMeal] = useState<MealSlot>("lunch");
  // Defaults to TOMORROW — guest meals need approval before the cutoff, so
  // booking for the future is the normal case (a passed defaultDate wins).
  const [date, setDate] = useState(defaultDate ?? addDays(today(), 1));
  const [guestName, setGuestName] = useState("");
  const [qty, setQty] = useState(1);

  // Guest meals cost the SAME as a member meal: the month's ACTUAL per-meal
  // cost (shopping ÷ meals), so the sheet quotes the running actual rate of
  // the booked month as an estimate.
  const actual = useActualMealRate(hostelId, date.slice(0, 7));
  const price = actual.rate;
  const total = price * qty;

  const submit = async () => {
    if (!hostelId || !userId || !guestName.trim()) return;
    await repo.guestMeals.request({ hostelId, userId, meal, date, guestName, qty });
    toast("Guest meal sent for approval");
    onClose();
    setGuestName("");
    setQty(1);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Guest meal">
      <div className="mb-4 flex gap-2">
        {MEALS.map((m) => (
          <button key={m} type="button" onClick={() => setMeal(m)}>
            <Chip tone="primary" active={meal === m}>
              {MEAL_LABEL[m]}
            </Chip>
          </button>
        ))}
      </div>

      <div className="mb-4 flex gap-3">
        <label className="min-w-0 flex-1">
          <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">DATE</div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
          />
        </label>
      </div>

      <div className="mb-4 flex gap-3">
        <label className="flex-[2]">
          <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">
            GUEST NAME
          </div>
          <input
            type="text"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="Karim Rahman"
            className="w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
          />
        </label>
        <label className="min-w-0 flex-1">
          <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">QTY</div>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
            className="w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-center text-[12px] font-extrabold"
          />
        </label>
      </div>

      <div className="mb-4 rounded-btn bg-bg px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="text-[11.5px] font-bold text-text-secondary">
            {qty} × {formatBDT(price)} <span className="font-semibold">est.</span>
          </div>
          <div className="text-[13.5px] font-extrabold">Total ~{formatBDT(total)}</div>
        </div>
        <div className="mt-1 text-[9.5px] font-semibold text-text-secondary">
          Guests pay the same as members: the month&rsquo;s actual per-meal cost
          (total shopping ÷ total meals) — final on the monthly bill.
        </div>
      </div>

      <Button fullWidth onClick={submit} disabled={!guestName.trim()}>
        Book &amp; send for approval
      </Button>
    </Sheet>
  );
}

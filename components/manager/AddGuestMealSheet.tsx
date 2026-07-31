"use client";

import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { useActualMealRate } from "@/hooks/useActualMealRate";
import { repo, type MealSlot, type User } from "@/lib/data";
import { MEAL_LABEL } from "@/lib/mealColors";
import { formatBDT } from "@/lib/utils/currency";
import { formatShortDate } from "@/lib/utils/date";

/** Manager adds a guest meal directly onto a member's day — no approval
 * needed (unlike a member's own GuestMealSheet request), since the manager
 * is already the one who'd approve it. */
export function AddGuestMealSheet({
  open,
  onClose,
  hostelId,
  date,
  member,
  offeredMeals,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  hostelId: string | undefined;
  date: string;
  member: User | null;
  offeredMeals: MealSlot[];
  onAdded?: () => void;
}) {
  const { toast } = useToast();
  const [meal, setMeal] = useState<MealSlot>("lunch");
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        setMeal(offeredMeals[0] ?? "lunch");
        setQty(1);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, member?.id]);

  const actual = useActualMealRate(hostelId, date.slice(0, 7));
  const total = actual.rate * qty;

  if (!member) return null;

  const submit = async () => {
    if (!hostelId || saving) return;
    setSaving(true);
    try {
      await repo.meals.addGuestMeal(hostelId, member.id, date, meal, qty);
      toast(`${qty} guest meal${qty === 1 ? "" : "s"} added for ${member.name.split(" ")[0]}`);
      onAdded?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Guest meal · ${member.name}`}>
      <div className="mb-4 text-[11px] font-semibold text-text-secondary">
        Adds directly to {formatShortDate(date)} — no approval needed, this counts immediately.
      </div>

      <div className="mb-4 flex gap-2">
        {offeredMeals.map((m) => (
          <button key={m} type="button" onClick={() => setMeal(m)}>
            <Chip tone="primary" active={meal === m}>
              {MEAL_LABEL[m]}
            </Chip>
          </button>
        ))}
      </div>

      <div className="mb-4">
        <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">GUESTS</div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-btn border border-border"
          >
            <Icon icon={Minus} size={15} />
          </button>
          <div className="flex-1 text-center text-[16px] font-extrabold">{qty}</div>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(20, q + 1))}
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-btn border border-border"
          >
            <Icon icon={Plus} size={15} />
          </button>
        </div>
      </div>

      <div className="mb-4 rounded-btn bg-bg px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="text-[11.5px] font-bold text-text-secondary">
            {qty} × {formatBDT(actual.rate)} <span className="font-semibold">est.</span>
          </div>
          <div className="text-[13.5px] font-extrabold">Total ~{formatBDT(total)}</div>
        </div>
        <div className="mt-1 text-[9.5px] font-semibold text-text-secondary">
          Billed the same as a member meal: the month&rsquo;s actual per-meal cost.
        </div>
      </div>

      <Button fullWidth onClick={submit} disabled={saving}>
        {saving ? "Adding…" : `Add ${qty} guest meal${qty === 1 ? "" : "s"}`}
      </Button>
    </Sheet>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { useActualMealRate } from "@/hooks/useActualMealRate";
import { repo, type MealDay, type MealSlot, type User } from "@/lib/data";
import { MEAL_LABEL } from "@/lib/mealColors";
import { formatBDT } from "@/lib/utils/currency";
import { formatShortDate } from "@/lib/utils/date";

/** Manager adds or removes a guest meal directly on a member's day — no
 * approval needed (unlike a member's own GuestMealSheet request), since the
 * manager is already the one who'd approve it. */
export function AddGuestMealSheet({
  open,
  onClose,
  hostelId,
  date,
  member,
  offeredMeals,
  day,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  hostelId: string | undefined;
  date: string;
  member: User | null;
  offeredMeals: MealSlot[];
  /** The selected date's MealDay, already loaded by the caller — used to
   * read the member's current guest count so "Remove" can be disabled when
   * there's nothing to remove. */
  day: MealDay | undefined;
  onAdded?: () => void;
}) {
  const { toast } = useToast();
  const [action, setAction] = useState<"add" | "remove">("add");
  const [meal, setMeal] = useState<MealSlot>("lunch");
  const [rawQty, setRawQty] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        setAction("add");
        setMeal(offeredMeals[0] ?? "lunch");
        setRawQty(1);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, member?.id]);

  const actual = useActualMealRate(hostelId, date.slice(0, 7));

  if (!member) return null;

  const currentGuests = day?.entries[member.id]?.[meal]?.guestCount ?? 0;
  const canRemove = currentGuests > 0;
  const effectiveAction = action === "remove" && !canRemove ? "add" : action;
  // Can never remove more guests than actually exist for this date+meal —
  // derived from the raw stepper value rather than synced back into it, so
  // switching meals/modes can't leave a stale, too-high qty sitting in state.
  const maxQty = effectiveAction === "remove" ? currentGuests : 20;
  const qty = Math.min(rawQty, Math.max(1, maxQty));
  const total = actual.rate * qty;

  const submit = async () => {
    if (!hostelId || saving) return;
    setSaving(true);
    try {
      const delta = effectiveAction === "add" ? qty : -qty;
      await repo.meals.addGuestMeal(hostelId, member.id, date, meal, delta);
      toast(
        `${qty} guest meal${qty === 1 ? "" : "s"} ${effectiveAction === "add" ? "added for" : "removed for"} ${member.name.split(" ")[0]}`
      );
      onAdded?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Guest meal · ${member.name}`}>
      <div className="mb-4 text-[11px] font-semibold text-text-secondary">
        Applies directly to {formatShortDate(date)} — no approval needed, this counts immediately.
      </div>

      <div className="mb-4 inline-flex w-full gap-1 rounded-pill border border-border bg-card p-1 shadow-chip">
        <button
          type="button"
          onClick={() => setAction("add")}
          className={`min-h-9 flex-1 cursor-pointer rounded-pill px-4 font-sans text-[11.5px] font-extrabold transition-colors ${
            effectiveAction === "add" ? "bg-primary text-white" : "bg-transparent text-text"
          }`}
        >
          Add guests
        </button>
        <button
          type="button"
          onClick={() => canRemove && setAction("remove")}
          disabled={!canRemove}
          title={canRemove ? undefined : `No guests added yet for ${MEAL_LABEL[meal]} to remove`}
          className={`min-h-9 flex-1 rounded-pill px-4 font-sans text-[11.5px] font-extrabold transition-colors ${
            effectiveAction === "remove" ? "bg-primary text-white" : "bg-transparent text-text"
          } ${canRemove ? "cursor-pointer" : "cursor-not-allowed opacity-40"}`}
        >
          Remove guests
        </button>
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
        <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">
          {effectiveAction === "add" ? "GUESTS" : "GUESTS TO REMOVE"}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setRawQty((q) => Math.max(1, q - 1))}
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-btn border border-border"
          >
            <Icon icon={Minus} size={15} />
          </button>
          <div className="flex-1 text-center text-[16px] font-extrabold">{qty}</div>
          <button
            type="button"
            onClick={() => setRawQty((q) => Math.min(maxQty, q + 1))}
            disabled={qty >= maxQty}
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-btn border border-border disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon icon={Plus} size={15} />
          </button>
        </div>
        {effectiveAction === "remove" && (
          <div className="mt-1.5 text-[9.5px] font-semibold text-text-secondary">
            Only {currentGuests} guest{currentGuests === 1 ? "" : "s"} added for {MEAL_LABEL[meal]} — can&rsquo;t remove more than that.
          </div>
        )}
      </div>

      <div className="mb-4 rounded-btn bg-bg px-4 py-3">
        {effectiveAction === "add" ? (
          <>
            <div className="flex items-center justify-between">
              <div className="text-[11.5px] font-bold text-text-secondary">
                {qty} × {formatBDT(actual.rate)} <span className="font-semibold">est.</span>
              </div>
              <div className="text-[13.5px] font-extrabold">Total ~{formatBDT(total)}</div>
            </div>
            <div className="mt-1 text-[9.5px] font-semibold text-text-secondary">
              Billed the same as a member meal: the month&rsquo;s actual per-meal cost.
            </div>
          </>
        ) : (
          <div className="text-[9.5px] font-semibold text-text-secondary">
            {currentGuests} guest{currentGuests === 1 ? "" : "s"} currently added for {MEAL_LABEL[meal]}.
          </div>
        )}
      </div>

      <Button fullWidth onClick={submit} disabled={saving}>
        {saving
          ? "Saving…"
          : effectiveAction === "add"
            ? `Add ${qty} guest meal${qty === 1 ? "" : "s"}`
            : `Remove ${qty} guest meal${qty === 1 ? "" : "s"}`}
      </Button>
    </Sheet>
  );
}

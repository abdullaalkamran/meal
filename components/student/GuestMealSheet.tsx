"use client";

import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { useSession } from "@/lib/auth/SessionProvider";
import { useActualMealRate } from "@/hooks/useActualMealRate";
import { repo, type MealDay, type MealSlot } from "@/lib/data";
import { MEAL_LABEL } from "@/lib/mealColors";
import { formatBDT } from "@/lib/utils/currency";
import { addDays, today } from "@/lib/utils/date";
import { canToggleMeal } from "@/lib/utils/mealPolicy";

const ALL_MEALS: MealSlot[] = ["breakfast", "lunch", "dinner"];

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
  const { hostel } = useSession();
  const offeredMeals = ALL_MEALS.filter((m) => hostel?.settings.mealsOffered?.[m] ?? true);

  const [action, setAction] = useState<"add" | "remove">("add");
  const [meals, setMeals] = useState<MealSlot[]>([]);
  // Defaults to TOMORROW — same-day guest changes always need manager
  // approval (the toggle cutoff already passed by definition), so booking
  // ahead is the normal case.
  const [fromDate, setFromDate] = useState(defaultDate ?? addDays(today(), 1));
  const [toDate, setToDate] = useState(defaultDate ?? addDays(today(), 1));
  const [guestName, setGuestName] = useState("");
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const [rangeDays, setRangeDays] = useState<MealDay[]>([]);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      const d = defaultDate ?? addDays(today(), 1);
      setAction("add");
      setMeals(offeredMeals.slice(0, 1));
      setFromDate(d);
      setToDate(d);
      setGuestName("");
      setQty(1);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultDate]);

  // So "Remove guests" can be disabled unless there's actually something to
  // remove in the selected range — re-fetched whenever the date range moves.
  useEffect(() => {
    if (!open || !hostelId) return;
    let cancelled = false;
    repo.meals.listMealDays(hostelId, { from: fromDate, to: toDate }).then((days) => {
      if (!cancelled) setRangeDays(days);
    });
    return () => {
      cancelled = true;
    };
  }, [open, hostelId, fromDate, toDate]);

  const toggleMeal = (m: MealSlot) =>
    setMeals((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));

  // Guest meals cost the SAME as a member meal: the month's ACTUAL per-meal
  // cost (shopping ÷ meals), so the sheet quotes the running actual rate of
  // the FROM month as an estimate.
  const actual = useActualMealRate(hostelId, fromDate.slice(0, 7));
  const price = actual.rate;

  const dateList = (): string[] => {
    const out: string[] = [];
    let d = fromDate;
    let guard = 0;
    while (d <= toDate && guard < 366) {
      out.push(d);
      d = addDays(d, 1);
      guard += 1;
    }
    return out;
  };

  const dates = dateList();
  // Whether the CURRENTLY selected dates/meals have any guest already added —
  // "Remove guests" only makes sense, and is only enabled, when this is true.
  const existingGuestCount = dates.reduce(
    (sum, d) =>
      sum +
      meals.reduce((s, m) => s + (rangeDays.find((day) => day.date === d)?.entries[userId ?? ""]?.[m]?.guestCount ?? 0), 0),
    0
  );
  const canRemove = existingGuestCount > 0;
  // Falls back to "add" for rendering/submission the moment the selection no
  // longer has anything to remove, without a setState-in-effect round trip.
  const effectiveAction = action === "remove" && !canRemove ? "add" : action;
  const cellCount = dates.length * meals.length;
  const total = price * qty * cellCount;
  const directCount = dates.filter((d) => canToggleMeal(d, hostel?.settings.mealToggleCutoff).allowed).length * meals.length;
  const requestCount = cellCount - directCount;

  const canSubmit = !!hostelId && !!userId && meals.length > 0 && fromDate <= toDate && !saving;

  const submit = async () => {
    if (!canSubmit || !hostelId || !userId) return;
    setSaving(true);
    try {
      const delta = effectiveAction === "add" ? qty : -qty;
      let direct = 0;
      let requested = 0;
      for (const date of dates) {
        const allowed = canToggleMeal(date, hostel?.settings.mealToggleCutoff).allowed;
        for (const meal of meals) {
          if (allowed) {
            await repo.meals.addGuestMeal(hostelId, userId, date, meal, delta);
            direct += 1;
          } else {
            await repo.guestMeals.request({
              hostelId,
              userId,
              meal,
              date,
              guestName: guestName.trim() || "Guest",
              qty: delta,
            });
            requested += 1;
          }
        }
      }
      if (direct > 0 && requested > 0) {
        toast(`${direct} updated directly, ${requested} sent for manager approval`);
      } else if (requested > 0) {
        toast(`${requested} sent for manager approval`);
      } else {
        toast(`${direct} guest meal${direct === 1 ? "" : "s"} updated`);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Guest meal">
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
          title={canRemove ? undefined : "No guests added yet for this date/meal to remove"}
          className={`min-h-9 flex-1 rounded-pill px-4 font-sans text-[11.5px] font-extrabold transition-colors ${
            effectiveAction === "remove" ? "bg-primary text-white" : "bg-transparent text-text"
          } ${canRemove ? "cursor-pointer" : "cursor-not-allowed opacity-40"}`}
        >
          Remove guests
        </button>
      </div>

      <div className="mb-4">
        <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">MEALS</div>
        <div className="flex gap-2">
          {offeredMeals.map((m) => (
            <button key={m} type="button" onClick={() => toggleMeal(m)}>
              <Chip tone="primary" active={meals.includes(m)}>
                {MEAL_LABEL[m]}
              </Chip>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex gap-3">
        <label className="min-w-0 flex-1">
          <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">FROM DATE</div>
          <input
            type="date"
            min={today()}
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              if (e.target.value > toDate) setToDate(e.target.value);
            }}
            className="w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
          />
        </label>
        <label className="min-w-0 flex-1">
          <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">TO DATE</div>
          <input
            type="date"
            min={fromDate}
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
          />
        </label>
      </div>

      {effectiveAction === "add" && (
        <div className="mb-4">
          <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">
            GUEST NAME <span className="font-semibold normal-case">· optional</span>
          </div>
          <input
            type="text"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="Karim Rahman"
            className="w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
          />
        </div>
      )}

      <div className="mb-4">
        <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">
          {effectiveAction === "add" ? "GUESTS PER MEAL" : "GUESTS TO REMOVE, PER MEAL"}
        </div>
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
        {effectiveAction === "add" ? (
          <>
            <div className="flex items-center justify-between">
              <div className="text-[11.5px] font-bold text-text-secondary">
                {qty} × {cellCount} slot{cellCount === 1 ? "" : "s"} × {formatBDT(price)}{" "}
                <span className="font-semibold">est.</span>
              </div>
              <div className="text-[13.5px] font-extrabold">Total ~{formatBDT(total)}</div>
            </div>
            <div className="mt-1 text-[9.5px] font-semibold text-text-secondary">
              Guests pay the same as members: the month&rsquo;s actual per-meal cost — final on the
              monthly bill.
            </div>
          </>
        ) : (
          <div className="text-[9.5px] font-semibold text-text-secondary">
            {existingGuestCount} guest{existingGuestCount === 1 ? "" : "s"} currently added across the
            selected date(s)/meal(s) — a slot already at 0 is left as is.
          </div>
        )}
        {cellCount > 0 && (
          <div className="mt-2 border-t border-border pt-2 text-[9.5px] font-semibold text-text-secondary">
            {directCount > 0 && (
              <div>
                {directCount} slot{directCount === 1 ? "" : "s"} — before cutoff, applies immediately.
              </div>
            )}
            {requestCount > 0 && (
              <div>
                {requestCount} slot{requestCount === 1 ? "" : "s"} — same-day/past cutoff, needs manager
                approval.
              </div>
            )}
          </div>
        )}
      </div>

      <Button fullWidth onClick={submit} disabled={!canSubmit}>
        {saving
          ? "Saving…"
          : effectiveAction === "add"
            ? `Add ${qty} guest meal${qty * cellCount === 1 ? "" : "s"}`
            : `Remove ${qty} guest meal${qty * cellCount === 1 ? "" : "s"}`}
      </Button>
    </Sheet>
  );
}

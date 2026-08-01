"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useMenu } from "@/hooks/useMenu";
import { repo, type Menu, type MealSlot } from "@/lib/data";
import { formatShortDate, today } from "@/lib/utils/date";

const MEAL_LABEL: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

/** Lets today's shopping-duty member set the menu themselves — they're the
 * one who bought the food, so they know what's actually being cooked.
 * Server-side, saveMenu only allows this for their OWN duty date; this sheet
 * is only ever opened for today, matching that. */
export function MenuEditSheet({
  open,
  onClose,
  hostelId,
}: {
  open: boolean;
  onClose: () => void;
  hostelId: string | undefined;
}) {
  const date = today();
  const menu = useMenu(hostelId, date);
  const { toast } = useToast();
  const [text, setText] = useState<Record<MealSlot, string>>({ breakfast: "", lunch: "", dinner: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && menu) {
      queueMicrotask(() =>
        setText({
          breakfast: menu.dishes.breakfast.join(", "),
          lunch: menu.dishes.lunch.join(", "),
          dinner: menu.dishes.dinner.join(", "),
        })
      );
    }
  }, [open, menu]);

  const setMealText = (meal: MealSlot, value: string) => setText((prev) => ({ ...prev, [meal]: value }));

  const save = async () => {
    if (!hostelId || saving) return;
    setSaving(true);
    try {
      const dishes: Menu["dishes"] = {
        breakfast: text.breakfast.split(",").map((d) => d.trim()).filter(Boolean),
        lunch: text.lunch.split(",").map((d) => d.trim()).filter(Boolean),
        dinner: text.dinner.split(",").map((d) => d.trim()).filter(Boolean),
      };
      await repo.menus.saveMenu(hostelId, date, dishes);
      toast("Menu updated");
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Edit menu · ${formatShortDate(date)}`}>
      <div className="mb-3 text-[10.5px] font-semibold text-text-secondary">
        You&rsquo;re on shopping duty today, so you can set what&rsquo;s being cooked.
      </div>
      {(["breakfast", "lunch", "dinner"] as MealSlot[]).map((meal) => (
        <div key={meal} className="mb-3">
          <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
            {MEAL_LABEL[meal]}
          </div>
          <textarea
            value={text[meal]}
            onChange={(e) => setMealText(meal, e.target.value)}
            placeholder="Rice, Fish curry, Lentil soup"
            className="h-16 w-full resize-none rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-semibold"
          />
        </div>
      ))}
      <Button fullWidth onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save menu"}
      </Button>
    </Sheet>
  );
}

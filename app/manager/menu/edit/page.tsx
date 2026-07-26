"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useMenu } from "@/hooks/useMenu";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { repo, type Menu, type MealSlot } from "@/lib/data";
import { today } from "@/lib/utils/date";
import { PermissionGate } from "@/components/manager/PermissionGate";

const MEAL_LABEL: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

function ManagerEditMenuPage() {
  const { activeHostelId } = useSession();
  const date = today();
  const menu = useMenu(activeHostelId, date);
  const { toast } = useToast();
  // Hold the raw text the manager is typing, one string per meal. Parsing into
  // the dishes array only at save time keeps spaces (and multi-word Bangla dish
  // names) intact — deriving the value from a trimmed array on every keystroke
  // would strip a trailing space the moment it's typed, blocking spaces.
  const [text, setText] = useState<Record<MealSlot, string>>({
    breakfast: "",
    lunch: "",
    dinner: "",
  });

  useEffect(() => {
    if (menu)
      queueMicrotask(() =>
        setText({
          breakfast: menu.dishes.breakfast.join(", "),
          lunch: menu.dishes.lunch.join(", "),
          dinner: menu.dishes.dinner.join(", "),
        })
      );
  }, [menu]);

  const setMealText = (meal: MealSlot, value: string) => {
    setText((prev) => ({ ...prev, [meal]: value }));
  };

  const save = async () => {
    if (!activeHostelId) return;
    const dishes: Menu["dishes"] = {
      breakfast: text.breakfast.split(",").map((d) => d.trim()).filter(Boolean),
      lunch: text.lunch.split(",").map((d) => d.trim()).filter(Boolean),
      dinner: text.dinner.split(",").map((d) => d.trim()).filter(Boolean),
    };
    await repo.menus.saveMenu(activeHostelId, date, dishes);
    toast("Menu updated for today");
  };

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="text-[17.5px] font-extrabold tracking-tight">Edit today&rsquo;s menu</div>

      {(["breakfast", "lunch", "dinner"] as MealSlot[]).map((meal) => (
        <Card key={meal}>
          <div className="mb-2 text-[11.5px] font-extrabold text-text-secondary uppercase tracking-wide">
            {MEAL_LABEL[meal]}
          </div>
          <textarea
            value={text[meal]}
            onChange={(e) => setMealText(meal, e.target.value)}
            placeholder="Rice, Fish curry, Lentil soup"
            className="h-16 w-full resize-none rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-semibold"
          />
        </Card>
      ))}

      <Button fullWidth onClick={save}>
        Save menu
      </Button>
    </div>
  );
}

// Owner-configured permission gate: real managers need the "menu" flag.
export default function GatedManagerEditMenuPage() {
  return (
    <PermissionGate permission="menu" label="Menu editing">
      <ManagerEditMenuPage />
    </PermissionGate>
  );
}

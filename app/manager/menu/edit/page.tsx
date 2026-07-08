"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useMenu } from "@/hooks/useMenu";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { repo, type Menu, type MealSlot } from "@/lib/data";
import { today } from "@/lib/utils/date";

const MEAL_LABEL: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

export default function ManagerEditMenuPage() {
  const { activeHostelId } = useSession();
  const date = today();
  const menu = useMenu(activeHostelId, date);
  const { toast } = useToast();
  const [dishes, setDishes] = useState<Menu["dishes"]>({
    breakfast: [],
    lunch: [],
    dinner: [],
  });

  useEffect(() => {
    if (menu) queueMicrotask(() => setDishes(menu.dishes));
  }, [menu]);

  const setMealText = (meal: MealSlot, text: string) => {
    setDishes((prev) => ({
      ...prev,
      [meal]: text.split(",").map((d) => d.trim()).filter(Boolean),
    }));
  };

  const save = async () => {
    if (!activeHostelId) return;
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
            value={dishes[meal].join(", ")}
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

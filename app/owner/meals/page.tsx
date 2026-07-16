"use client";

import { useSession } from "@/lib/auth/SessionProvider";
import { useMenu } from "@/hooks/useMenu";
import { HostelPicker } from "@/components/hostel/HostelPicker";
import { MealsScreen } from "@/components/hostel/MealsScreen";
import { Card } from "@/components/ui/Card";
import { MEAL_COLORS, MEAL_LABEL } from "@/lib/mealColors";
import type { MealSlot } from "@/lib/data";
import { today } from "@/lib/utils/date";

/** Owner's meal visibility — everything the manager sees, strictly read-only:
 * no toggle edits, no menu edits, no meal deletions. */
export default function OwnerMealsPage() {
  const { activeHostelId } = useSession();
  const menu = useMenu(activeHostelId, today());

  return (
    <div className="flex flex-col gap-4 pt-2">
      <HostelPicker />

      {menu && (
        <Card>
          <div className="mb-3 text-[13.5px] font-extrabold">Today&rsquo;s menu</div>
          <div className="flex flex-col gap-2">
            {(["breakfast", "lunch", "dinner"] as MealSlot[]).map((meal) => {
              const c = MEAL_COLORS[meal];
              const dishes = menu.dishes[meal] ?? [];
              return (
                <div key={meal} className="flex items-center gap-3 rounded-btn bg-bg px-3 py-2.5">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${c.dot}`} />
                  <div className="w-20 shrink-0 text-[11px] font-extrabold">{MEAL_LABEL[meal]}</div>
                  <div className="min-w-0 text-[11px] font-semibold text-text-secondary">
                    {dishes.length > 0 ? dishes.join(", ") : "Not set"}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <MealsScreen readOnly cookingCountHref="/owner/cooking-count" />
    </div>
  );
}

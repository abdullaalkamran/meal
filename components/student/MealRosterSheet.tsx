"use client";

import { useSession } from "@/lib/auth/SessionProvider";
import { useUsers } from "@/hooks/useUsers";
import { useMealDay } from "@/hooks/useMealDay";
import { Sheet } from "@/components/ui/Sheet";
import { Avatar } from "@/components/ui/Avatar";
import { MEAL_LABEL } from "@/lib/mealColors";
import type { MealSlot } from "@/lib/data";

interface MealRosterSheetProps {
  open: boolean;
  onClose: () => void;
  hostelId: string | undefined;
  date: string;
  meal: MealSlot | null;
}

/** Who's eating a specific meal, today — tap a meal tile on the home page to
 * see this. Same on/off resolution as the manager's roster (MealsScreen), so
 * the count here always matches what's shown elsewhere. */
export function MealRosterSheet({ open, onClose, hostelId, date, meal }: MealRosterSheetProps) {
  const { hostel } = useSession();
  const users = useUsers(hostelId).filter((u) => u.role !== "cook" && u.role !== "owner");
  const { day } = useMealDay(hostelId, date);

  if (!meal) return null;

  const rows = users
    .map((m) => {
      const joinedDay = m.joinedAt?.slice(0, 10);
      const boarderThatDay = !joinedDay || joinedDay <= date;
      if (!boarderThatDay || (day?.sealed && !day.entries[m.id])) return null;
      const entry = day?.entries[m.id];
      const offeredThatDay = day?.mealsOffered?.[meal] ?? hostel?.settings.mealsOffered?.[meal] ?? true;
      const on = entry?.[meal]?.on ?? (m.futureMealsOff?.[meal] ? false : offeredThatDay);
      const guests = entry?.[meal]?.guestCount ?? 0;
      return { id: m.id, name: m.name, avatarSeed: m.avatarSeed, on, guests };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => Number(b.on) - Number(a.on) || a.name.localeCompare(b.name));

  const onCount = rows.filter((r) => r.on).reduce((sum, r) => sum + 1 + r.guests, 0);

  return (
    <Sheet open={open} onClose={onClose} title={`${MEAL_LABEL[meal]} — ${onCount} eating`}>
      <div className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-2.5 rounded-btn bg-bg px-3 py-2">
            <Avatar name={r.name} seed={r.avatarSeed} size={30} />
            <div className="min-w-0 flex-1 text-[12px] font-bold">{r.name}</div>
            <div className={`text-[10px] font-extrabold uppercase tracking-wide ${r.on ? "text-primary" : "text-text-secondary"}`}>
              {r.on ? "On" : "Off"}
              {r.guests > 0 && <span className="text-orange"> +{r.guests}</span>}
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="py-4 text-center text-[11px] font-semibold text-text-secondary">No members yet.</div>
        )}
      </div>
    </Sheet>
  );
}

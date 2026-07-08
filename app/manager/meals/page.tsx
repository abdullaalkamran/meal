"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, ChevronUp, Phone } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useUsers } from "@/hooks/useUsers";
import { useMealDay } from "@/hooks/useMealDay";
import { useDutyPlans } from "@/hooks/useDutyPlans";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Calendar } from "@/components/ui/Calendar";
import { MEAL_COLORS, MEAL_LABEL } from "@/lib/mealColors";
import { repo, type MealDay, type MealSlot, type User } from "@/lib/data";
import { today } from "@/lib/utils/date";

export default function ManagerMealsPage() {
  const { hostel, activeHostelId } = useSession();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState(today());
  const [membersOpen, setMembersOpen] = useState(true);
  const [monthDays, setMonthDays] = useState<MealDay[]>([]);

  // Cook is staff, not a boarder — excluded from meal-toggle rosters.
  const users = useUsers(activeHostelId).filter((u) => u.role !== "cook");
  const { day } = useMealDay(activeHostelId, selectedDate);
  const plans = useDutyPlans(activeHostelId);
  const [shopper, setShopper] = useState<User | undefined>(undefined);

  useEffect(() => {
    if (!activeHostelId) return;
    const from = `${year}-${String(month).padStart(2, "0")}-01`;
    const to = `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`;
    const load = () => repo.meals.listMealDays(activeHostelId, { from, to }).then(setMonthDays);
    load();
    return repo.meals.subscribe(activeHostelId, load);
  }, [activeHostelId, year, month]);

  useEffect(() => {
    if (!day?.shoppingUserId) {
      queueMicrotask(() => setShopper(undefined));
      return;
    }
    repo.users.getUser(day.shoppingUserId).then(setShopper);
  }, [day?.shoppingUserId]);

  const shoppingPlan = plans.find((p) => p.type === "shopping");
  const mealCounts = (["breakfast", "lunch", "dinner"] as MealSlot[]).map((meal) => {
    const entries = day ? Object.values(day.entries) : [];
    const count = entries.reduce((sum, e) => sum + (e[meal].on ? 1 + e[meal].guestCount : 0), 0);
    return { meal, count };
  });
  const dayTotal = mealCounts.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div>
        <div className="text-[17.5px] font-extrabold tracking-tight">Meals</div>
        <div className="text-[10.5px] font-semibold text-text-secondary">{hostel?.name}</div>
      </div>

      <Link href="/manager/cooking-count">
        <div
          className="flex items-center justify-between rounded-card p-4 text-white"
          style={{ background: "linear-gradient(135deg, var(--color-primary), #0a8f86)" }}
        >
          <div>
            <div className="text-[11.5px] font-bold">Today&rsquo;s cooking</div>
            <div className="text-[10px] font-semibold text-white/70">{dayTotal} meals to cook</div>
          </div>
          <Icon icon={ChevronRight} size={18} />
        </div>
      </Link>

      <Card>
        <Calendar
          year={year}
          month={month}
          onMonthChange={(y, m) => {
            setYear(y);
            setMonth(m);
          }}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          renderDots={(date) => {
            const d = monthDays.find((x) => x.date === date);
            if (!d) return null;
            const anyOn = Object.values(d.entries).some((e) => e.breakfast.on || e.lunch.on || e.dinner.on);
            return anyOn ? <span className="mt-0.5 h-1 w-1 rounded-full bg-primary" /> : null;
          }}
        />
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[13.5px] font-extrabold">Boarder meals — {selectedDate}</div>
          <div className="rounded-pill bg-primary px-2.5 py-1 text-[9.5px] font-extrabold text-white">
            {dayTotal} meals on
          </div>
        </div>
        {shopper && (
          <div className="mb-3 flex items-center justify-between rounded-btn bg-bg p-2.5">
            <div>
              <div className="text-[9px] font-bold text-text-secondary">SHOPPING DUTY</div>
              <div className="text-[11px] font-extrabold">{shopper.name}</div>
            </div>
            <a href={`tel:${shopper.phone}`} className="text-primary">
              <Icon icon={Phone} size={14} />
            </a>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          {mealCounts.map((c) => {
            const meta = MEAL_COLORS[c.meal];
            return (
              <div key={c.meal} className={`rounded-btn ${meta.bg} p-2.5 text-center`}>
                <div className={`text-[14px] font-extrabold ${meta.text}`}>{c.count}</div>
                <div className="text-[9px] font-bold text-text-secondary">{MEAL_LABEL[c.meal]}</div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <button
          type="button"
          onClick={() => setMembersOpen((v) => !v)}
          className="flex w-full cursor-pointer items-center justify-between"
        >
          <div className="text-[13.5px] font-extrabold">All members</div>
          <Icon icon={membersOpen ? ChevronUp : ChevronDown} size={18} />
        </button>
        {membersOpen && (
          <div className="mt-3 flex flex-col gap-2">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-1 text-[9px] font-extrabold uppercase tracking-wide text-text-secondary">
              <div>Member</div>
              <div className="w-6 text-center">B</div>
              <div className="w-6 text-center">L</div>
              <div className="w-6 text-center">D</div>
            </div>
            {users.map((m) => {
              const entry = day?.entries[m.id];
              return (
                <div
                  key={m.id}
                  className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 rounded-btn bg-bg px-2 py-2"
                >
                  <div className="min-w-0 text-[11px] font-bold">{m.name}</div>
                  {(["breakfast", "lunch", "dinner"] as MealSlot[]).map((meal) => {
                    const on = entry?.[meal]?.on ?? true;
                    const guests = entry?.[meal]?.guestCount ?? 0;
                    return (
                      <div
                        key={meal}
                        className={`w-6 text-center text-[9.5px] font-extrabold ${
                          on ? "text-primary" : "text-text-secondary"
                        }`}
                      >
                        {on ? "On" : "Off"}
                        {guests > 0 && <span className="text-orange"> +{guests}</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {shoppingPlan && (
        <Card>
          <div className="mb-3 text-[13.5px] font-extrabold">Duty rotation</div>
          <div className="flex flex-col gap-2">
            {shoppingPlan.blocks.map((b) => {
              const memberName = users.find((u) => u.id === b.userId)?.name ?? b.userId;
              const isToday = b.dates.includes(today());
              return (
                <div key={b.userId} className="flex items-center justify-between rounded-btn bg-bg px-3 py-2.5">
                  <div>
                    <div className="text-[10.5px] font-semibold text-text-secondary">{b.dates[0]}</div>
                    <div className="text-[11.5px] font-extrabold">{memberName}</div>
                  </div>
                  {isToday && (
                    <div className="rounded-pill bg-orange-soft px-2.5 py-1 text-[9.5px] font-extrabold text-orange">
                      Today
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

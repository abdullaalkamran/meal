"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Phone, Receipt, ShoppingBag, Wallet } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useUsers } from "@/hooks/useUsers";
import { useMealDay } from "@/hooks/useMealDay";
import { useMealStops } from "@/hooks/useMealStops";
import { useMenu } from "@/hooks/useMenu";
import { useBill } from "@/hooks/useBill";
import { useDutyPlans } from "@/hooks/useDutyPlans";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { Switch } from "@/components/ui/Switch";
import { Calendar } from "@/components/ui/Calendar";
import { GuestMealSheet } from "@/components/student/GuestMealSheet";
import { StopMealSheet } from "@/components/student/StopMealSheet";
import { MEAL_COLORS, MEAL_LABEL } from "@/lib/mealColors";
import { repo, type MealDay, type MealSlot, type User } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";
import { currentMonth, today } from "@/lib/utils/date";

export default function StudentMealsPage() {
  const { user, hostel, activeHostelId } = useSession();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState(today());
  const [membersOpen, setMembersOpen] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(true);
  const [guestSheetOpen, setGuestSheetOpen] = useState(false);
  const [stopSheetOpen, setStopSheetOpen] = useState(false);
  const [monthDays, setMonthDays] = useState<MealDay[]>([]);
  const [totalShopping, setTotalShopping] = useState(0);

  // Cook is staff, not a boarder — excluded from meal-toggle rosters.
  const users = useUsers(activeHostelId).filter((u) => u.role !== "cook");
  const { day, setToggle } = useMealDay(activeHostelId, selectedDate);
  const menu = useMenu(activeHostelId, selectedDate);
  const myStops = useMealStops(activeHostelId);
  const { bill } = useBill(activeHostelId, user?.id, currentMonth());
  const plans = useDutyPlans(activeHostelId);
  const [manager, setManager] = useState<User | undefined>(undefined);
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
    if (!hostel) return;
    repo.users.getUser(hostel.managerId).then(setManager);
  }, [hostel]);

  useEffect(() => {
    if (!activeHostelId) return;
    repo.shoppingCosts
      .listByHostel(activeHostelId)
      .then((costs) => setTotalShopping(costs.reduce((sum, c) => sum + c.amount, 0)));
  }, [activeHostelId]);

  useEffect(() => {
    if (!activeHostelId || !day?.shoppingUserId) {
      queueMicrotask(() => setShopper(undefined));
      return;
    }
    repo.users.getUser(day.shoppingUserId).then(setShopper);
  }, [activeHostelId, day?.shoppingUserId]);

  const myRequests = myStops.filter((r) => r.userId === user?.id);
  const shoppingPlan = plans.find((p) => p.type === "shopping");
  const due = bill ? bill.grandTotal - bill.paid : 0;

  const dayTotal = day
    ? Object.values(day.entries).reduce(
        (sum, e) =>
          sum +
          (e.breakfast.on ? 1 + e.breakfast.guestCount : 0) +
          (e.lunch.on ? 1 + e.lunch.guestCount : 0) +
          (e.dinner.on ? 1 + e.dinner.guestCount : 0),
        0
      )
    : 0;
  const mealCounts = (["breakfast", "lunch", "dinner"] as MealSlot[]).map((meal) => {
    const entries = day ? Object.values(day.entries) : [];
    const count = entries.reduce((sum, e) => sum + (e[meal].on ? 1 + e[meal].guestCount : 0), 0);
    return { meal, count };
  });

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div>
        <div className="text-[17.5px] font-extrabold tracking-tight">Meals</div>
        <div className="text-[10.5px] font-semibold text-text-secondary">
          Tap a date to filter everything below
        </div>
      </div>

      {/* My meals stat strip */}
      <div className="grid grid-cols-3 gap-2 rounded-card bg-primary-soft p-4">
        <div className="text-center">
          <div className="text-[16.5px] font-extrabold text-primary">{bill?.mealsCount ?? 0}</div>
          <div className="text-[9.5px] font-bold text-text-secondary">My meals</div>
        </div>
        <div className="text-center">
          <div className="text-[16.5px] font-extrabold text-primary">
            {formatBDT(bill?.sections.find((s) => s.label === "mealCost")?.total ?? 0)}
          </div>
          <div className="text-[9.5px] font-bold text-text-secondary">Meal cost</div>
        </div>
        <div className="text-center">
          <div className="text-[16.5px] font-extrabold text-danger">{formatBDT(due)}</div>
          <div className="text-[9.5px] font-bold text-text-secondary">Due</div>
        </div>
      </div>

      {/* My meal toggles for selected date */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[11.5px] font-extrabold uppercase tracking-wide text-text-secondary">
            {selectedDate === today() ? "Today" : selectedDate} &middot; my meals
          </div>
          <button
            type="button"
            onClick={() => setGuestSheetOpen(true)}
            className="text-[11px] font-extrabold text-primary"
          >
            + Guest meal
          </button>
        </div>
        <div className="flex flex-col divide-y divide-border">
          {(["breakfast", "lunch", "dinner"] as MealSlot[]).map((meal) => {
            const entry = user && day?.entries[user.id]?.[meal];
            const on = entry?.on ?? true;
            const c = MEAL_COLORS[meal];
            return (
              <div key={meal} className="flex items-center gap-3 py-2.5">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${c.bg}`}>
                  <Icon icon={c.icon} size={16} className={c.text} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-extrabold">{MEAL_LABEL[meal]}</div>
                  <div className="truncate text-[10px] font-semibold text-text-secondary">
                    {menu?.dishes[meal]?.join(" · ") || "Menu not set yet"}
                  </div>
                </div>
                {!!entry?.guestCount && (
                  <Chip tone="blue">+{entry.guestCount} guest</Chip>
                )}
                <Switch checked={on} onChange={(v) => user && setToggle(user.id, meal, v)} />
              </div>
            );
          })}
        </div>
        <div className="mt-2 text-[9.5px] font-semibold text-text-secondary">
          Cutoff: 9:00 PM the night before &middot; after cutoff, request manager approval
        </div>
      </Card>

      {/* My requests */}
      <Card>
        <button
          type="button"
          onClick={() => setRequestsOpen((v) => !v)}
          className="flex w-full cursor-pointer items-center justify-between"
        >
          <div className="text-[13.5px] font-extrabold">My requests</div>
          <div className="flex items-center gap-2">
            <span
              onClick={(e) => {
                e.stopPropagation();
                setStopSheetOpen(true);
              }}
              className="text-[11px] font-extrabold text-primary"
            >
              + Stop meal
            </span>
            <Icon icon={requestsOpen ? ChevronUp : ChevronDown} size={16} />
          </div>
        </button>
        {requestsOpen && (
          <div className="mt-3 flex flex-col gap-2">
            {myRequests.length === 0 && (
              <div className="text-[11.5px] font-semibold text-text-secondary">No requests yet.</div>
            )}
            {myRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-btn bg-bg px-3 py-2.5">
                <div>
                  <div className="text-[11.5px] font-bold">
                    {r.meals.map((m) => MEAL_LABEL[m]).join(" + ")} &middot; {r.dateFrom} - {r.dateTo}
                  </div>
                  <div className="text-[10px] font-semibold text-text-secondary">
                    {r.reason || "No reason given"}
                  </div>
                </div>
                <div
                  className={`rounded-pill px-2.5 py-1 text-[9.5px] font-extrabold ${
                    r.status === "approved"
                      ? "bg-primary-soft text-primary"
                      : r.status === "denied"
                        ? "bg-danger-soft text-danger"
                        : "bg-orange-soft text-orange"
                  }`}
                >
                  {r.status}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Calendar */}
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
            const mine = user && d?.entries[user.id];
            if (!mine) return null;
            return (
              <div className="mt-0.5 flex gap-0.5">
                {(["breakfast", "lunch", "dinner"] as MealSlot[]).map((m) => (
                  <span
                    key={m}
                    className={`h-1 w-1 rounded-full ${mine[m].on ? MEAL_COLORS[m].dot : "bg-border"}`}
                  />
                ))}
              </div>
            );
          }}
        />
        <div className="mt-2 flex items-center justify-center gap-3 text-[9.5px] font-semibold text-text-secondary">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Meal on
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-border" /> Meal off
          </span>
          <span>B &middot; L &middot; D</span>
        </div>
      </Card>

      {/* Hostel stats for the month */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="text-center" padded>
          <div className="mb-1 flex justify-center text-text-secondary">
            <Icon icon={Receipt} size={14} />
          </div>
          <div className="text-[13.5px] font-extrabold">
            {monthDays.reduce(
              (sum, d) =>
                sum +
                Object.values(d.entries).reduce(
                  (s, e) =>
                    s +
                    (e.breakfast.on ? 1 : 0) +
                    (e.lunch.on ? 1 : 0) +
                    (e.dinner.on ? 1 : 0),
                  0
                ),
              0
            )}
          </div>
          <div className="text-[9px] font-bold text-text-secondary">Total meals</div>
        </Card>
        <Card className="text-center" padded>
          <div className="mb-1 flex justify-center text-text-secondary">
            <Icon icon={ShoppingBag} size={14} />
          </div>
          <div className="text-[13.5px] font-extrabold">{formatBDT(totalShopping)}</div>
          <div className="text-[9px] font-bold text-text-secondary">Total shopping</div>
        </Card>
        <Card className="text-center" padded>
          <div className="mb-1 flex justify-center text-text-secondary">
            <Icon icon={Wallet} size={14} />
          </div>
          <div className="text-[13.5px] font-extrabold">{formatBDT(hostel?.mealRate ?? 0)}</div>
          <div className="text-[9px] font-bold text-text-secondary">Avg meal rate</div>
        </Card>
      </div>

      {/* Boarder meals for selected date */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[13.5px] font-extrabold">Boarder meals</div>
          <div className="rounded-pill bg-primary px-2.5 py-1 text-[9.5px] font-extrabold text-white">
            {dayTotal} meals on
          </div>
        </div>
        <div className="mb-3 flex gap-2">
          {shopper && (
            <div className="flex-1 rounded-btn bg-bg p-2.5">
              <div className="text-[9px] font-bold text-text-secondary">SHOPPING DUTY</div>
              <div className="flex items-center justify-between gap-1">
                <div className="min-w-0 truncate text-[11px] font-extrabold">{shopper.name}</div>
                <a href={`tel:${shopper.phone}`} className="text-primary">
                  <Icon icon={Phone} size={13} />
                </a>
              </div>
            </div>
          )}
          {manager && (
            <div className="flex-1 rounded-btn bg-bg p-2.5">
              <div className="text-[9px] font-bold text-text-secondary">MANAGER</div>
              <div className="flex items-center justify-between gap-1">
                <div className="min-w-0 truncate text-[11px] font-extrabold">{manager.name}</div>
                <a href={`tel:${manager.phone}`} className="text-primary">
                  <Icon icon={Phone} size={13} />
                </a>
              </div>
            </div>
          )}
        </div>
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

      {/* All members */}
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
                    return (
                      <div
                        key={meal}
                        className={`w-6 text-center text-[9.5px] font-extrabold ${
                          on ? "text-primary" : "text-text-secondary"
                        }`}
                      >
                        {on ? "On" : "Off"}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Shopping duty rotation */}
      {shoppingPlan && (
        <Card>
          <div className="mb-3 text-[13.5px] font-extrabold">Shopping responsible</div>
          <div className="flex flex-col gap-2">
            {shoppingPlan.blocks.map((b) => {
              const isMe = b.userId === user?.id;
              const isToday = b.dates.includes(today());
              const isDone = b.dates.at(-1)! < today();
              const memberName = users.find((u) => u.id === b.userId)?.name ?? b.userId;
              const status = isMe ? "You" : isToday ? "Today" : isDone ? "Done" : "Next";
              return (
                <div
                  key={b.userId}
                  className={`flex items-center justify-between rounded-btn px-3 py-2.5 ${
                    isMe ? "bg-primary-soft" : "bg-bg"
                  }`}
                >
                  <div>
                    <div className="text-[10.5px] font-semibold text-text-secondary">
                      {b.dates[0]}
                    </div>
                    <div className="text-[11.5px] font-extrabold">{memberName}</div>
                  </div>
                  <div
                    className={`rounded-pill px-2.5 py-1 text-[9.5px] font-extrabold ${
                      isMe
                        ? "bg-primary text-white"
                        : isToday
                          ? "bg-orange-soft text-orange"
                          : "bg-card text-text-secondary"
                    }`}
                  >
                    {status}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <GuestMealSheet
        open={guestSheetOpen}
        onClose={() => setGuestSheetOpen(false)}
        hostelId={activeHostelId}
        userId={user?.id}
        defaultDate={selectedDate}
      />
      <StopMealSheet
        open={stopSheetOpen}
        onClose={() => setStopSheetOpen(false)}
        hostelId={activeHostelId}
        userId={user?.id}
      />
    </div>
  );
}

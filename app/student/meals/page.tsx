"use client";

import { useEffect, useState } from "react";
import { Ban, ChevronDown, ChevronUp, Phone, Trophy } from "lucide-react";
import Link from "next/link";
import { useSession } from "@/lib/auth/SessionProvider";
import { useUsers } from "@/hooks/useUsers";
import { useMealDay } from "@/hooks/useMealDay";
import { useMealStops } from "@/hooks/useMealStops";
import { useGuestMeals } from "@/hooks/useGuestMeals";
import { useMenu } from "@/hooks/useMenu";
import { useBill } from "@/hooks/useBill";
import { useDutyPlans } from "@/hooks/useDutyPlans";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { Switch } from "@/components/ui/Switch";
import { Calendar } from "@/components/ui/Calendar";
import { StarRating } from "@/components/ui/StarRating";
import { GuestMealSheet } from "@/components/student/GuestMealSheet";
import { MealRequestSheet } from "@/components/student/MealRequestSheet";
import { MEAL_COLORS, MEAL_LABEL } from "@/lib/mealColors";
import { repo, type MealDay, type MealSlot, type Rating, type ShoppingCost, type User } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";
import { addDays, currentMonth, formatMonthLabel, today } from "@/lib/utils/date";
import { canToggleMeal, cutoffLabel } from "@/lib/utils/mealPolicy";
import { useToast } from "@/components/ui/Toast";
import { useActualMealRate } from "@/hooks/useActualMealRate";
import { useMemberMealSummary } from "@/hooks/useMemberMealSummary";

export default function StudentMealsPage() {
  const { user, hostel, activeHostelId } = useSession();
  // Members plan TOMORROW's meals — today's are already past their cutoffs
  // (breakfast locks at 21:00 the night before), so the page opens on
  // tomorrow; the calendar can still navigate to any date.
  const tomorrow = addDays(today(), 1);
  const [year, setYear] = useState(Number(tomorrow.slice(0, 4)));
  const [month, setMonth] = useState(Number(tomorrow.slice(5, 7)));
  const [selectedDate, setSelectedDate] = useState(tomorrow);
  const [membersOpen, setMembersOpen] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(true);
  const [guestSheetOpen, setGuestSheetOpen] = useState(false);
  const [reqSheet, setReqSheet] = useState<{ on: boolean; meals?: MealSlot[] } | null>(null);
  const [monthDays, setMonthDays] = useState<MealDay[]>([]);
  const [allCosts, setAllCosts] = useState<ShoppingCost[]>([]);
  const [allRatings, setAllRatings] = useState<Rating[]>([]);

  // Cook is staff and owner is cross-hostel management — neither is a boarder,
  // so both are excluded from meal-toggle rosters.
  const users = useUsers(activeHostelId).filter((u) => u.role !== "cook" && u.role !== "owner");
  // The SAME approved-shopping / confirmed-cooked gate the actual bill uses
  // (see billing's mealRateFor) — matches what the manager's Meals page
  // shows, and tracks whichever month is selected, not just the current one.
  const actualRate = useActualMealRate(activeHostelId, `${year}-${String(month).padStart(2, "0")}`);
  const { day, setToggle } = useMealDay(activeHostelId, selectedDate);
  const { toast } = useToast();
  // Whether the member may still change this date themselves — the same rule
  // the server enforces, so the UI can never offer something that will fail.
  const lock = canToggleMeal(selectedDate, hostel?.settings.mealToggleCutoff);
  // Before their join date the member wasn't boarding, so a slot has no real
  // value to show or toggle — never a default "on".
  const joinedDay = user?.joinedAt?.slice(0, 10);
  const notYetJoined = !!joinedDay && joinedDay > selectedDate;
  // The member's own per-meal "future X off" switches — mirrored optimistically
  // so the UI flips immediately rather than waiting for the next session poll.
  const [futureOff, setFutureOff] = useState<Partial<Record<MealSlot, boolean>>>(user?.futureMealsOff ?? {});
  useEffect(() => {
    queueMicrotask(() => setFutureOff(user?.futureMealsOff ?? {}));
  }, [user?.futureMealsOff]);
  const toggleFutureMeals = async (meal: MealSlot, next: boolean) => {
    if (!activeHostelId || !user) return;
    setFutureOff((prev) => ({ ...prev, [meal]: next }));
    await repo.meals.setMemberFutureMeals(activeHostelId, user.id, meal, next);
    toast(
      next
        ? `Future ${MEAL_LABEL[meal].toLowerCase()} turned off — turn any day back on before its cutoff`
        : `Future ${MEAL_LABEL[meal].toLowerCase()} turned back on`
    );
  };
  // A day with no stored entry yet defaults OFF for a slot whose future
  // switch is on.
  const defaultOn = (meal: MealSlot) => !futureOff[meal];

  // Is THIS member's whole day off? Used to colour-fill the calendar so they
  // can see which days their meals are stopped (and from when). A sealed/
  // stored day reads its rows; an unsealed future day is off only if EVERY
  // slot's future-meals switch is on. Days before they joined aren't marked.
  const myDayOff = (date: string): boolean => {
    if (!user) return false;
    const jd = user.joinedAt?.slice(0, 10);
    if (jd && jd > date) return false;
    const e = monthDays.find((x) => x.date === date)?.entries[user.id];
    if (e) return !e.breakfast.on && !e.lunch.on && !e.dinner.on;
    return !!futureOff.breakfast && !!futureOff.lunch && !!futureOff.dinner;
  };
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

  // The member's own meals this month, live — so they see them without waiting
  // for a generated bill. Re-fetched on any meal change (incl. the manager
  // confirming cooking, which moves meals from "on" into "billed").
  const summary = useMemberMealSummary(activeHostelId, user?.id);

  useEffect(() => {
    if (!hostel) return;
    repo.users.getUser(hostel.managerId).then(setManager);
  }, [hostel]);

  useEffect(() => {
    if (!activeHostelId) return;
    repo.shoppingCosts.listByHostel(activeHostelId).then(setAllCosts);
    repo.ratings.listByHostel(activeHostelId).then(setAllRatings);
  }, [activeHostelId]);

  useEffect(() => {
    if (!activeHostelId || !day?.shoppingUserId) {
      queueMicrotask(() => setShopper(undefined));
      return;
    }
    repo.users.getUser(day.shoppingUserId).then(setShopper);
  }, [activeHostelId, day?.shoppingUserId]);

  const myRequests = myStops.filter((r) => r.userId === user?.id);
  const myGuestRequests = useGuestMeals(activeHostelId).filter((r) => r.userId === user?.id);
  const shoppingPlan = plans.find((p) => p.type === "shopping");
  const due = bill ? bill.grandTotal - bill.paid : 0;
  const mealsSuspended = user?.mealsSuspended ?? false;

  // One member's effective meal for a slot on the selected day, matching the
  // "All members" roster exactly (their stored row, or the day's offer /
  // future-off default) — so the counts always equal what the list shows,
  // even on a day whose rows aren't sealed yet.
  const memberOn = (m: User, meal: MealSlot): { on: boolean; guests: number } | null => {
    const entry = day?.entries[m.id];
    const jd = m.joinedAt?.slice(0, 10);
    const boarder = !jd || jd <= selectedDate;
    if (!boarder || (day?.sealed && !entry)) return null;
    const offered = day?.mealsOffered?.[meal] ?? hostel?.settings.mealsOffered?.[meal] ?? true;
    const on = entry?.[meal]?.on ?? (m.futureMealsOff?.[meal] ? false : offered);
    return { on, guests: entry?.[meal]?.guestCount ?? 0 };
  };
  const mealCounts = (["breakfast", "lunch", "dinner"] as MealSlot[]).map((meal) => ({
    meal,
    count: users.reduce((sum, m) => {
      const r = memberOn(m, meal);
      return r ? sum + (r.on ? 1 : 0) + r.guests : sum;
    }, 0),
  }));
  const dayTotal = mealCounts.reduce((sum, c) => sum + c.count, 0);

  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
  const inSelectedMonth = (date: string) => date.startsWith(monthPrefix);
  const monthCosts = allCosts.filter((c) => c.dates.some(inSelectedMonth));
  const blocksInMonth = shoppingPlan?.blocks.filter((b) => b.dates.some(inSelectedMonth)) ?? [];

  // Per-person cost/rate/quality for the selected month, used by both the
  // shopping-responsible rotation list and the leaderboard below it.
  const mealsServedOn = (date: string) => {
    const d = monthDays.find((x) => x.date === date);
    if (!d) return 0;
    return Object.values(d.entries).reduce(
      (sum, e) =>
        sum +
        ((e.breakfast.on ? 1 : 0) + e.breakfast.guestCount) +
        ((e.lunch.on ? 1 : 0) + e.lunch.guestCount) +
        ((e.dinner.on ? 1 : 0) + e.dinner.guestCount),
      0
    );
  };
  const statsByUser = new Map<
    string,
    { cost: number; meals: number; ratingSum: number; ratingCount: number }
  >();
  for (const c of monthCosts) {
    const entry = statsByUser.get(c.userId) ?? { cost: 0, meals: 0, ratingSum: 0, ratingCount: 0 };
    entry.cost += c.amount;
    entry.meals += c.dates.reduce((sum, d) => sum + mealsServedOn(d), 0);
    for (const r of allRatings) {
      if (r.target === "menu" && c.dates.includes(r.date)) {
        entry.ratingSum += r.stars;
        entry.ratingCount += 1;
      }
    }
    statsByUser.set(c.userId, entry);
  }

  const leaderboard = [...statsByUser.entries()]
    .map(([userId, s]) => ({
      userId,
      name: users.find((u) => u.id === userId)?.name ?? userId,
      cost: s.cost,
      rate: s.meals > 0 ? s.cost / s.meals : 0,
      quality: s.ratingCount > 0 ? s.ratingSum / s.ratingCount : 0,
    }))
    .filter((row) => row.rate > 0)
    .sort((a, b) => a.rate - b.rate);
  const bestRateId = leaderboard[0]?.userId;
  const bestQualityId = leaderboard.reduce<{ id?: string; quality: number }>(
    (best, row) => (row.quality > best.quality ? { id: row.userId, quality: row.quality } : best),
    { id: undefined, quality: 0 }
  ).id;

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div>
        <div className="text-[17.5px] font-extrabold tracking-tight">Meals</div>
        <div className="text-[10.5px] font-semibold text-text-secondary">
          Tap a date to filter everything below
        </div>
      </div>

      {/* My meals stat strip — live from the member's own meals this month, so
          it shows before any bill is generated. Meal cost counts only what the
          manager has confirmed cooked (what will be billed). */}
      <div className="grid grid-cols-3 gap-2 rounded-card bg-primary-soft p-4">
        <div className="text-center">
          <div className="text-[16.5px] font-extrabold text-primary">
            {summary?.mealsOn ?? bill?.mealsCount ?? 0}
          </div>
          <div className="text-[9.5px] font-bold text-text-secondary">My meals</div>
        </div>
        <div className="text-center">
          <div className="text-[16.5px] font-extrabold text-primary">
            {formatBDT(summary?.cost ?? bill?.sections.find((s) => s.label === "mealCost")?.total ?? 0)}
          </div>
          <div className="text-[9.5px] font-bold text-text-secondary">Meal cost</div>
        </div>
        <div className="text-center">
          <div className="text-[16.5px] font-extrabold text-danger">{formatBDT(due)}</div>
          <div className="text-[9.5px] font-bold text-text-secondary">Due</div>
        </div>
      </div>
      {summary && summary.mealsOn > summary.billedMeals && (
        <div className="-mt-3 text-center text-[9.5px] font-semibold text-text-secondary">
          {summary.billedMeals} of {summary.mealsOn} meals confirmed cooked so far — meal cost is
          billed only once the manager confirms cooking.
        </div>
      )}

      {/* The member's own per-meal future-default switches. Off (for a slot) =
          every future day defaults THAT meal to off until they turn a specific
          day's slot back on (cutoff still applies to today/tomorrow). Only
          meals the hostel actually offers are shown. Hidden while the manager
          has force-off. */}
      {!mealsSuspended && (
        <Card>
          <div className="mb-1 text-[12.5px] font-extrabold">My future meals</div>
          <div className="mb-3 text-[10px] font-semibold text-text-secondary">
            Set a standing default for each meal — off means every future day starts off until
            you turn a specific day back on.
          </div>
          <div className="flex flex-col divide-y divide-border">
            {(["breakfast", "lunch", "dinner"] as MealSlot[])
              .filter((meal) => hostel?.settings.mealsOffered?.[meal] ?? true)
              .map((meal) => {
                const c = MEAL_COLORS[meal];
                const off = !!futureOff[meal];
                return (
                  <div key={meal} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${c.bg}`}>
                      <Icon icon={c.icon} size={16} className={c.text} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11.5px] font-extrabold">{MEAL_LABEL[meal]}</div>
                      <div className="truncate text-[9.5px] font-semibold text-text-secondary">
                        {off ? "Off by default — turn a day back on before its cutoff" : "On by default"}
                      </div>
                    </div>
                    <Switch checked={!off} onChange={(v) => toggleFutureMeals(meal, !v)} />
                  </div>
                );
              })}
          </div>
        </Card>
      )}

      {/* Manager has switched this member's meals off for an unpaid bill */}
      {mealsSuspended && (
        <Card className="border border-danger/30 bg-danger-soft">
          <div className="mb-1 flex items-center gap-2">
            <Icon icon={Ban} size={16} className="text-danger" />
            <div className="text-[12.5px] font-extrabold text-danger">Your meals are turned off</div>
          </div>
          <div className="mb-3 text-[11px] font-semibold text-text-secondary">
            The manager turned off your meals because your bill is unpaid. Pay your bill to resume —
            you can&rsquo;t turn your own meals back on until then.
          </div>
          <Link
            href="/student/bill"
            className="flex min-h-10 w-full items-center justify-center rounded-btn bg-danger text-[12px] font-extrabold text-white"
          >
            View my bill
          </Link>
        </Card>
      )}

      {/* My meal toggles for selected date */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[11.5px] font-extrabold uppercase tracking-wide text-text-secondary">
            {selectedDate === today()
              ? "Today"
              : selectedDate === addDays(today(), 1)
                ? "Tomorrow"
                : selectedDate}{" "}
            &middot; my meals
          </div>
          <button
            type="button"
            onClick={() => setGuestSheetOpen(true)}
            disabled={mealsSuspended}
            className="text-[11px] font-extrabold text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Guest meal
          </button>
        </div>
        <div className="flex flex-col divide-y divide-border">
          {(["breakfast", "lunch", "dinner"] as MealSlot[]).map((meal) => {
            const entry = user && day?.entries[user.id]?.[meal];
            const c = MEAL_COLORS[meal];
            // Whether this slot was cooked is a property of THE DAY, pinned
            // when the day was sealed — not of the hostel's current setting,
            // so past days keep showing what actually happened.
            const closed = !((day?.mealsOffered ?? hostel?.settings.mealsOffered)?.[meal] ?? true);
            const on = !closed && !notYetJoined && (entry?.on ?? defaultOn(meal));
            return (
              <div key={meal} className="flex items-center gap-3 py-2.5">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${closed ? "bg-bg" : c.bg}`}>
                  <Icon icon={c.icon} size={16} className={closed ? "text-text-secondary" : c.text} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-extrabold">{MEAL_LABEL[meal]}</div>
                  <div className="truncate text-[10px] font-semibold text-text-secondary">
                    {closed
                      ? "This hostel doesn't offer this meal"
                      : menu?.dishes[meal]?.join(" · ") || "Menu not set yet"}
                  </div>
                </div>
                {notYetJoined ? (
                  <Chip>Not a boarder yet</Chip>
                ) : closed ? (
                  <Chip tone="danger" active>
                    Always closed
                  </Chip>
                ) : (
                  <>
                    {!!entry?.guestCount && (
                      <Chip tone="blue">+{entry.guestCount} guest</Chip>
                    )}
                    {lock.allowed ? (
                      <Switch
                        checked={on}
                        disabled={mealsSuspended}
                        onChange={(v) => {
                          if (!user) return;
                          void Promise.resolve(setToggle(user.id, meal, v)).catch((err) =>
                            toast(err instanceof Error ? err.message : "Could not change this meal")
                          );
                        }}
                      />
                    ) : mealsSuspended ? (
                      <Switch checked={on} disabled onChange={() => {}} />
                    ) : (
                      // Cutoff has passed — turning this meal on or off now needs
                      // the manager's approval, so offer the request directly
                      // (turn it on if it's off, off if it's on).
                      <button
                        type="button"
                        onClick={() => setReqSheet({ on: !on, meals: [meal] })}
                        className="shrink-0 rounded-pill bg-primary-soft px-2.5 py-1 text-[10px] font-extrabold text-primary"
                      >
                        {on ? "Request off" : "Request on"}
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-2 text-[9.5px] font-semibold text-text-secondary">
          {lock.allowed
            ? `You can change this day until ${cutoffLabel(hostel?.settings.mealToggleCutoff)} the evening before.`
            : lock.message}
        </div>
        {!lock.allowed && !mealsSuspended && (
          <button
            type="button"
            onClick={() => setReqSheet({ on: false })}
            className="mt-2 min-h-10 w-full rounded-btn bg-primary-soft text-[11.5px] font-extrabold text-primary"
          >
            Request a change from the manager
          </button>
        )}
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
                setReqSheet({ on: false });
              }}
              className="text-[11px] font-extrabold text-primary"
            >
              + Meal request
            </span>
            <Icon icon={requestsOpen ? ChevronUp : ChevronDown} size={16} />
          </div>
        </button>
        {requestsOpen && (
          <div className="mt-3 flex flex-col gap-2">
            {myRequests.length === 0 && myGuestRequests.length === 0 && (
              <div className="text-[11.5px] font-semibold text-text-secondary">No requests yet.</div>
            )}
            {myRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-btn bg-bg px-3 py-2.5">
                <div>
                  <div className="text-[11.5px] font-bold">
                    <span className={r.desiredOn ? "text-primary" : "text-danger"}>
                      Turn {r.desiredOn ? "on" : "off"}
                    </span>{" "}
                    {r.meals.map((m) => MEAL_LABEL[m]).join(" + ")} &middot; {r.dateFrom}
                    {r.dateTo !== r.dateFrom ? ` – ${r.dateTo}` : ""}
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
            {myGuestRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-btn bg-bg px-3 py-2.5">
                <div>
                  <div className="text-[11.5px] font-bold">
                    <span className={r.qty < 0 ? "text-danger" : "text-primary"}>
                      {r.qty < 0 ? "Remove" : "Add"} {Math.abs(r.qty)} guest{Math.abs(r.qty) === 1 ? "" : "s"}
                    </span>{" "}
                    {MEAL_LABEL[r.meal]} &middot; {r.date}
                  </div>
                  <div className="text-[10px] font-semibold text-text-secondary">{r.guestName}</div>
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
          dayClass={(date) => (myDayOff(date) ? "bg-danger-soft text-danger" : undefined)}
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
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[9.5px] font-semibold text-text-secondary">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Meal on
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-border" /> Meal off
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-danger-soft" /> No meals that day
          </span>
          <span>B &middot; L &middot; D</span>
        </div>
      </Card>

      {/* Shopping cost for the month — same layout as the manager's meals page */}
      <Card>
        <div className="mb-3 text-[13.5px] font-extrabold">
          Shopping cost &middot; {formatMonthLabel(monthPrefix)}
        </div>
        <div className="mb-3 rounded-btn bg-primary-soft p-3">
          <div className="text-[9px] font-bold text-text-secondary">TOTAL SHOPPING COST</div>
          <div className="text-[20px] font-extrabold text-primary">{formatBDT(actualRate.totalShopping)}</div>
          <div className="text-[10px] font-semibold text-text-secondary">
            Approved grocery spend recorded this month
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-btn bg-bg p-2.5 text-center">
            <div className="text-[15px] font-extrabold">{actualRate.totalMeals}</div>
            <div className="text-[9px] font-bold text-text-secondary">Total meals</div>
          </div>
          <div className="rounded-btn bg-bg p-2.5 text-center">
            <div className="text-[15px] font-extrabold text-orange">{formatBDT(actualRate.rate)}</div>
            <div className="text-[9px] font-bold text-text-secondary">Avg cost / meal</div>
          </div>
        </div>
        {actualRate.totalShopping === 0 && monthCosts.length > 0 && (
          <div className="mt-2.5 rounded-btn bg-orange-soft px-3 py-2 text-[9.5px] font-bold text-orange">
            Shopping was recorded this month but isn&rsquo;t approved yet — ask your manager to approve it so it
            counts toward the meal rate and your bill.
          </div>
        )}
      </Card>

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
              // Same accuracy as the manager roster: only members boarding on
              // this date count; a sealed day's stored rows are the truth, and
              // a missing row falls back to the day's offer — never a phantom
              // default "On".
              const joinedDay = m.joinedAt?.slice(0, 10);
              const boarderThatDay = !joinedDay || joinedDay <= selectedDate;
              const counted = boarderThatDay && (!!entry || !day?.sealed);
              return (
                <div
                  key={m.id}
                  className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 rounded-btn bg-bg px-2 py-2"
                >
                  <div className="min-w-0 text-[11px] font-bold">
                    {m.name}
                    {!boarderThatDay && (
                      <span className="ml-1 text-[8.5px] font-semibold text-text-secondary">not joined yet</span>
                    )}
                  </div>
                  {(["breakfast", "lunch", "dinner"] as MealSlot[]).map((meal) => {
                    if (!counted) {
                      return (
                        <div key={meal} className="w-6 text-center text-[9.5px] font-extrabold text-text-secondary">
                          —
                        </div>
                      );
                    }
                    const offeredThatDay =
                      day?.mealsOffered?.[meal] ?? hostel?.settings.mealsOffered?.[meal] ?? true;
                    // A member who turned their future meals off shows off on
                    // days not yet materialised, not the offered default.
                    const on = entry?.[meal]?.on ?? (m.futureMealsOff?.[meal] ? false : offeredThatDay);
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

      {/* Shopping duty rotation — only blocks whose duty dates fall in the selected month */}
      {shoppingPlan && blocksInMonth.length > 0 && (
        <Card>
          <div className="mb-3 text-[13.5px] font-extrabold">Shopping responsible</div>
          <div className="flex flex-col gap-2">
            {blocksInMonth.map((b) => {
              const isMe = b.userIds.includes(user?.id ?? "");
              const isToday = b.dates.includes(today());
              const isDone = b.dates.at(-1)! < today();
              const memberName = b.userIds
                .map((id) => users.find((u) => u.id === id)?.name ?? id)
                .join(" + ");
              const status = isMe ? "You" : isToday ? "Today" : isDone ? "Done" : "Next";
              const combined = b.userIds.reduce(
                (acc, id) => {
                  const s = statsByUser.get(id);
                  if (!s) return acc;
                  return { cost: acc.cost + s.cost, meals: acc.meals + s.meals };
                },
                { cost: 0, meals: 0 }
              );
              const blockRate = combined.meals > 0 ? combined.cost / combined.meals : 0;
              return (
                <div
                  key={b.userIds.join("-")}
                  className={`flex items-center justify-between rounded-btn px-3 py-2.5 ${
                    isMe ? "bg-primary-soft" : "bg-bg"
                  }`}
                >
                  <div>
                    <div className="text-[10.5px] font-semibold text-text-secondary">
                      {b.dates[0]}
                    </div>
                    <div className="text-[11.5px] font-extrabold">{memberName}</div>
                    <div className="text-[9.5px] font-semibold text-text-secondary">
                      {combined.cost > 0
                        ? `${formatBDT(combined.cost)} this month · ${formatBDT(blockRate)}/meal avg`
                        : "No shopping recorded this month yet"}
                    </div>
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

      {/* Shopping leaderboard — best rate (cost/meal) vs best food quality for the month */}
      {leaderboard.length > 0 && (
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Icon icon={Trophy} size={16} className="text-orange" />
            <div className="text-[13.5px] font-extrabold">Shopping leaderboard</div>
          </div>
          <div className="flex flex-col gap-2">
            {leaderboard.map((row, i) => (
              <div
                key={row.userId}
                className="flex items-center gap-3 rounded-btn bg-bg px-3 py-2.5"
              >
                <div className="w-5 shrink-0 text-center text-[11.5px] font-extrabold text-text-secondary">
                  #{i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11.5px] font-extrabold">{row.name}</div>
                  <div className="flex items-center gap-1.5">
                    <StarRating value={row.quality} readOnly size={11} />
                    <span className="text-[9.5px] font-semibold text-text-secondary">
                      {row.quality > 0 ? row.quality.toFixed(1) : "No ratings"}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[12px] font-extrabold">{formatBDT(row.rate)}/meal</div>
                  <div className="flex justify-end gap-1">
                    {row.userId === bestRateId && (
                      <span className="rounded-pill bg-primary-soft px-1.5 py-0.5 text-[8px] font-extrabold text-primary">
                        Best rate
                      </span>
                    )}
                    {row.userId === bestQualityId && (
                      <span className="rounded-pill bg-orange-soft px-1.5 py-0.5 text-[8px] font-extrabold text-orange">
                        Best quality
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
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
      <MealRequestSheet
        open={!!reqSheet}
        onClose={() => setReqSheet(null)}
        hostelId={activeHostelId}
        userId={user?.id}
        date={selectedDate}
        defaultOn={reqSheet?.on ?? false}
        defaultMeals={reqSheet?.meals}
      />
    </div>
  );
}

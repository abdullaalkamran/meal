"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, ChevronUp, Clock, PencilLine, Phone, Trophy } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useUsers } from "@/hooks/useUsers";
import { useMealDay } from "@/hooks/useMealDay";
import { useDutyPlans } from "@/hooks/useDutyPlans";
import { useMealEditRequests } from "@/hooks/useMealEditRequests";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { Calendar } from "@/components/ui/Calendar";
import { StarRating } from "@/components/ui/StarRating";
import { useToast } from "@/components/ui/Toast";
import { RequestMealEditSheet } from "@/components/manager/RequestMealEditSheet";
import { MEAL_COLORS, MEAL_LABEL } from "@/lib/mealColors";
import { repo, type MealDay, type MealSlot, type Rating, type ShoppingCost, type User } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";
import { formatMonthLabel, today } from "@/lib/utils/date";

/** Master meal on/off — which slots this hostel cooks at all. Available to
 * BOTH the manager and the owner (even on the owner's otherwise read-only
 * meals page). Every flip asks for confirmation: closing applies to all
 * future days (members see the slot as always closed, it stops counting),
 * past days keep their data so accounts stay correct. */
function MealsOfferedCard() {
  const { hostel, activeHostelId } = useSession();
  const [pending, setPending] = useState<{ meal: MealSlot; next: boolean } | null>(null);

  if (!hostel) return null;
  const offered = (meal: MealSlot) => hostel.settings.mealsOffered?.[meal] ?? true;

  const confirm = async () => {
    if (!pending || !activeHostelId) return;
    await repo.hostels.setMealOffered(activeHostelId, pending.meal, pending.next);
    setPending(null);
  };

  return (
    <Card>
      <div className="mb-1 text-[13.5px] font-extrabold">Meals we offer</div>
      <div className="mb-3 text-[10px] font-semibold text-text-secondary">
        Master switch per meal — a closed meal shows as &ldquo;always closed&rdquo; to every
        member and isn&rsquo;t counted. Changes apply from today onward; past days keep
        their records so accounts stay correct.
      </div>
      <div className="flex flex-col divide-y divide-border">
        {(["breakfast", "lunch", "dinner"] as MealSlot[]).map((meal) => {
          const c = MEAL_COLORS[meal];
          const isOn = offered(meal);
          return (
            <div key={meal} className="py-2.5">
              <div className="flex items-center gap-3">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${c.bg}`}>
                  <Icon icon={c.icon} size={14} className={c.text} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11.5px] font-extrabold">{MEAL_LABEL[meal]}</div>
                  <div className={`text-[9.5px] font-bold ${isOn ? "text-primary" : "text-danger"}`}>
                    {isOn ? "Offered daily" : "Always closed"}
                  </div>
                </div>
                <Switch
                  checked={isOn}
                  onChange={(next) => setPending({ meal, next })}
                />
              </div>
              {pending?.meal === meal && (
                <div className="mt-2.5 rounded-btn bg-bg p-3">
                  <div className="mb-2.5 text-[10.5px] font-bold">
                    {pending.next
                      ? `Offer ${MEAL_LABEL[meal].toLowerCase()} again from today onward? New days will default to on, and members can turn it on themselves.`
                      : `Close ${MEAL_LABEL[meal].toLowerCase()} from today onward? Members will see it as always closed and it won't be counted in meals or bills. Past days are not changed.`}
                  </div>
                  <div className="flex gap-2">
                    <Button fullWidth onClick={confirm}>
                      {pending.next ? "Yes, offer it" : "Yes, close it"}
                    </Button>
                    <Button fullWidth variant="secondary" onClick={() => setPending(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/** The meals overview screen, shared by the manager page (full control) and
 * the owner's native meals page (`readOnly` — everything visible, no meal can
 * be edited: no toggle edits, no edit requests, no submit). */
export function MealsScreen({
  readOnly,
  cookingCountHref,
}: {
  readOnly?: boolean;
  cookingCountHref: string;
}) {
  const { user, hostel, activeHostelId } = useSession();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState(today());
  const [membersOpen, setMembersOpen] = useState(true);
  const [monthDays, setMonthDays] = useState<MealDay[]>([]);
  const [allCosts, setAllCosts] = useState<ShoppingCost[]>([]);
  const [allRatings, setAllRatings] = useState<Rating[]>([]);
  const [editRequestTarget, setEditRequestTarget] = useState<User | null>(null);
  const { toast } = useToast();

  // Cook is staff and owner is cross-hostel management — neither is a boarder,
  // so both are excluded from meal-toggle rosters.
  const users = useUsers(activeHostelId).filter((u) => u.role !== "cook" && u.role !== "owner");
  const { day } = useMealDay(activeHostelId, selectedDate);
  const plans = useDutyPlans(activeHostelId);
  const editRequests = useMealEditRequests(activeHostelId);
  const [shopper, setShopper] = useState<User | undefined>(undefined);

  const requestFor = (userId: string) =>
    editRequests.find(
      (r) => r.targetUserId === userId && r.date === selectedDate && r.status !== "denied"
    );

  // Edits are staged locally and only written to the meal day (and the
  // approval consumed) once the manager taps Submit — editing again after
  // that requires sending a fresh request.
  const [drafts, setDrafts] = useState<Record<string, Partial<Record<MealSlot, boolean>>>>({});
  const draftFor = (userId: string, meal: MealSlot, actualOn: boolean) =>
    drafts[userId]?.[meal] ?? actualOn;
  const setDraft = (userId: string, meal: MealSlot, on: boolean) => {
    setDrafts((prev) => ({ ...prev, [userId]: { ...prev[userId], [meal]: on } }));
  };
  const submitEdit = async (userId: string, requestId: string) => {
    if (!activeHostelId) return;
    try {
      const memberDraft = drafts[userId];
      if (memberDraft) {
        // setMemberMealApproved, NOT setMemberMealToggle: a meal-edit request
        // only ever exists for an already-locked (past-cutoff) date — that's
        // the whole reason it needed a vote — so the member's own cutoff-
        // checked path would always reject it. This is the manager-approved
        // bypass built for exactly this.
        await Promise.all(
          (Object.entries(memberDraft) as [MealSlot, boolean][]).map(([meal, on]) =>
            repo.meals.setMemberMealApproved(activeHostelId, userId, selectedDate, meal, on)
          )
        );
      }
      await repo.mealEdits.withdraw(requestId);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      toast("Meal edit submitted — request again to edit further");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not submit the meal edit.");
    }
  };

  useEffect(() => {
    if (!activeHostelId) return;
    const from = `${year}-${String(month).padStart(2, "0")}-01`;
    const to = `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`;
    const load = () => repo.meals.listMealDays(activeHostelId, { from, to }).then(setMonthDays);
    load();
    return repo.meals.subscribe(activeHostelId, load);
  }, [activeHostelId, year, month]);

  useEffect(() => {
    if (!activeHostelId) return;
    repo.shoppingCosts.listByHostel(activeHostelId).then(setAllCosts);
    repo.ratings.listByHostel(activeHostelId).then(setAllRatings);
  }, [activeHostelId]);

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
    const count = entries.reduce((sum, e) => sum + ((e[meal].on ? 1 : 0) + e[meal].guestCount), 0);
    return { meal, count };
  });
  const dayTotal = mealCounts.reduce((sum, c) => sum + c.count, 0);

  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const mealsOnDay = (d: MealDay) =>
    Object.values(d.entries).reduce(
      (s, e) =>
        s +
        (["breakfast", "lunch", "dinner"] as MealSlot[]).reduce(
          (ss, meal) => ss + ((e[meal].on ? 1 : 0) + e[meal].guestCount),
          0
        ),
      0
    );
  const monthMealCount = monthDays.reduce((sum, d) => sum + mealsOnDay(d), 0);

  // Actual shopping-based economics for the selected month: what was really
  // spent on groceries, versus how many meals it served — a truer "meal cost"
  // than the billed rate. Powers the summary card and the leaderboard below.
  const monthPrefix = monthKey;
  const inSelectedMonth = (date: string) => date.startsWith(monthPrefix);
  const monthCosts = allCosts.filter((c) => c.dates.some(inSelectedMonth));
  const totalShopping = monthCosts.reduce((sum, c) => sum + c.amount, 0);
  const avgCostPerMeal = monthMealCount > 0 ? totalShopping / monthMealCount : 0;
  const blocksInMonth = shoppingPlan?.blocks.filter((b) => b.dates.some(inSelectedMonth)) ?? [];

  const mealsServedOn = (date: string) => {
    const d = monthDays.find((x) => x.date === date);
    return d ? mealsOnDay(d) : 0;
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

  const rosterCols = readOnly ? "grid-cols-[1fr_auto_auto_auto]" : "grid-cols-[1fr_auto_auto_auto_auto]";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="text-[17.5px] font-extrabold tracking-tight">Meals</div>
        <div className="text-[10.5px] font-semibold text-text-secondary">
          {hostel?.name}
          {readOnly ? " · view only" : ""}
        </div>
      </div>

      <MealsOfferedCard />

      <Link href={cookingCountHref}>
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
        <div className="mb-3 text-[13.5px] font-extrabold">Shopping cost &middot; {formatMonthLabel(monthKey)}</div>
        <div className="mb-3 rounded-btn bg-primary-soft p-3">
          <div className="text-[9px] font-bold text-text-secondary">TOTAL SHOPPING COST</div>
          <div className="text-[20px] font-extrabold text-primary">{formatBDT(totalShopping)}</div>
          <div className="text-[10px] font-semibold text-text-secondary">
            Actual grocery spend recorded this month
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-btn bg-bg p-2.5 text-center">
            <div className="text-[15px] font-extrabold">{monthMealCount}</div>
            <div className="text-[9px] font-bold text-text-secondary">Total meals</div>
          </div>
          <div className="rounded-btn bg-bg p-2.5 text-center">
            <div className="text-[15px] font-extrabold text-orange">{formatBDT(avgCostPerMeal)}</div>
            <div className="text-[9px] font-bold text-text-secondary">Avg cost / meal</div>
          </div>
        </div>
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
            // The day's pinned offer, so a just-closed slot and the roster agree.
            const closed = !(day?.mealsOffered?.[c.meal] ?? hostel?.settings.mealsOffered?.[c.meal] ?? true);
            return (
              <div key={c.meal} className={`rounded-btn ${closed ? "bg-bg" : meta.bg} p-2.5 text-center`}>
                <div className={`text-[14px] font-extrabold ${closed ? "text-text-secondary" : meta.text}`}>
                  {closed ? "—" : c.count}
                </div>
                <div className="text-[9px] font-bold text-text-secondary">
                  {MEAL_LABEL[c.meal]}
                  {closed ? " · closed" : ""}
                </div>
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
            <div className={`grid ${rosterCols} gap-2 px-1 text-[9px] font-extrabold uppercase tracking-wide text-text-secondary`}>
              <div>Member</div>
              <div className="w-6 text-center">B</div>
              <div className="w-6 text-center">L</div>
              <div className="w-6 text-center">D</div>
              {!readOnly && <div className="w-16 text-center">Edit</div>}
            </div>
            {users.map((m) => {
              const entry = day?.entries[m.id];
              const request = requestFor(m.id);
              // A member only boards from their join date on. Before it they
              // weren't here, so we show "—" (not a default "On") and offer no
              // edit. On a sealed day the stored rows ARE the truth: a member
              // with no row wasn't counted (e.g. joined later that day), so we
              // also show "—" — keeping the roster identical to the totals.
              const joinedDay = m.joinedAt?.slice(0, 10);
              const boarderThatDay = !joinedDay || joinedDay <= selectedDate;
              const counted = boarderThatDay && (!!entry || !day?.sealed);
              return (
                <div
                  key={m.id}
                  className={`grid ${rosterCols} items-center gap-2 rounded-btn bg-bg px-2 py-2`}
                >
                  <div className="min-w-0 text-[11px] font-bold">
                    {m.name}
                    {!boarderThatDay && (
                      <span className="ml-1 text-[8.5px] font-semibold text-text-secondary">
                        not joined yet
                      </span>
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
                    // Boarding that day but no explicit row yet (e.g. a future
                    // day not sealed): fall back to what the day offers.
                    const offeredThatDay =
                      day?.mealsOffered?.[meal] ?? hostel?.settings.mealsOffered?.[meal] ?? true;
                    const on = entry?.[meal]?.on ?? offeredThatDay;
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
                  {!readOnly && (
                    <div className="flex w-16 justify-center">
                      {!counted ? null : request?.status === "approved" ? (
                        <span className="text-[9px] font-extrabold text-primary">Unlocked</span>
                      ) : request?.status === "pending" ? (
                        <button
                          type="button"
                          onClick={() => {
                            repo.mealEdits.withdraw(request.id);
                            toast("Edit request withdrawn");
                          }}
                          className="flex cursor-pointer items-center gap-0.5 text-[9px] font-extrabold text-orange"
                        >
                          <Icon icon={Clock} size={11} />
                          Pending
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditRequestTarget(m)}
                          aria-label={`Request edit for ${m.name}`}
                          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-text-secondary"
                        >
                          <Icon icon={PencilLine} size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {!readOnly && users.some((m) => requestFor(m.id)?.status === "approved") && (
        <Card>
          <div className="mb-1 text-[13.5px] font-extrabold">Editable meals — {selectedDate}</div>
          <div className="mb-3 text-[10px] font-semibold text-text-secondary">
            Members approved manual edits for these meals on this date.
          </div>
          <div className="flex flex-col divide-y divide-border">
            {users
              .filter((m) => requestFor(m.id)?.status === "approved")
              .map((m) => {
                const entry = day?.entries[m.id];
                const request = requestFor(m.id)!;
                return (
                  <div key={m.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="mb-2 text-[11.5px] font-extrabold">{m.name}</div>
                    <div className="mb-3 flex flex-col gap-2">
                      {(["breakfast", "lunch", "dinner"] as MealSlot[]).map((meal) => {
                        const on = draftFor(m.id, meal, entry?.[meal]?.on ?? true);
                        const c = MEAL_COLORS[meal];
                        return (
                          <div key={meal} className="flex items-center gap-3">
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${c.bg}`}
                            >
                              <Icon icon={c.icon} size={14} className={c.text} />
                            </div>
                            <div className="min-w-0 flex-1 text-[11px] font-bold">{MEAL_LABEL[meal]}</div>
                            <Switch checked={on} onChange={(v) => setDraft(m.id, meal, v)} />
                          </div>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => submitEdit(m.id, request.id)}
                      className="min-h-10 w-full cursor-pointer rounded-btn bg-primary text-[12px] font-extrabold text-white"
                    >
                      Submit
                    </button>
                  </div>
                );
              })}
          </div>
        </Card>
      )}

      {/* Shopping responsible — duty blocks in the selected month, with the
          spend + ৳/meal each pair/person actually achieved. */}
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
                    <div className="text-[10.5px] font-semibold text-text-secondary">{b.dates[0]}</div>
                    <div className="text-[11.5px] font-extrabold">{memberName}</div>
                    <div className="text-[9.5px] font-semibold text-text-secondary">
                      {combined.cost > 0
                        ? `${formatBDT(combined.cost)} this month · ${formatBDT(blockRate)}/meal avg`
                        : "No shopping recorded this month yet"}
                    </div>
                  </div>
                  <div
                    className={`shrink-0 rounded-pill px-2.5 py-1 text-[9.5px] font-extrabold ${
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

      {/* Shopping leaderboard — best rate (cost/meal) vs best food quality. */}
      {leaderboard.length > 0 && (
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Icon icon={Trophy} size={16} className="text-orange" />
            <div className="text-[13.5px] font-extrabold">Shopping leaderboard</div>
          </div>
          <div className="flex flex-col gap-2">
            {leaderboard.map((row, i) => (
              <div key={row.userId} className="flex items-center gap-3 rounded-btn bg-bg px-3 py-2.5">
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

      {!readOnly && (
        <RequestMealEditSheet
          open={!!editRequestTarget}
          onClose={() => setEditRequestTarget(null)}
          hostelId={activeHostelId}
          managerId={user?.id}
          targetUserId={editRequestTarget?.id}
          targetUserName={editRequestTarget?.name ?? ""}
          date={selectedDate}
        />
      )}
    </div>
  );
}

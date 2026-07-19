"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeftRight, Building2, ChefHat, ClipboardCheck, DoorOpen, UtensilsCrossed, Users } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useHostelsByOwner } from "@/hooks/useHostel";
import {
  repo,
  type Announcement,
  type Bill,
  type Expense,
  type HostelTransferRequest,
  type User,
} from "@/lib/data";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { formatBDT } from "@/lib/utils/currency";
import { currentMonth, today } from "@/lib/utils/date";

export default function OwnerDashboardPage() {
  const { user } = useSession();
  const hostels = useHostelsByOwner(user?.id);
  const [usersByHostel, setUsersByHostel] = useState<Record<string, User[]>>({});
  const [expensesByHostel, setExpensesByHostel] = useState<Record<string, Expense[]>>({});
  const [billsByHostel, setBillsByHostel] = useState<Record<string, Bill[]>>({});
  const [transfers, setTransfers] = useState<HostelTransferRequest[]>([]);
  const [joinRequestCount, setJoinRequestCount] = useState(0);
  const [announcements, setAnnouncements] = useState<(Announcement & { hostelName: string })[]>([]);
  const [mealsToday, setMealsToday] = useState(0);
  const [totalShoppingMonth, setTotalShoppingMonth] = useState(0);
  const [totalMealsMonth, setTotalMealsMonth] = useState(0);

  useEffect(() => {
    if (hostels.length === 0) return;
    let cancelled = false;

    (async () => {
      const [usersLists, expenseLists, billLists, transferLists, joinLists, announcementLists, mealDayLists] =
        await Promise.all([
          Promise.all(hostels.map((h) => repo.users.listByHostel(h.id))),
          Promise.all(hostels.map((h) => repo.expenses.listByHostel(h.id))),
          Promise.all(hostels.map((h) => repo.bills.listByHostel(h.id, currentMonth()))),
          Promise.all(hostels.map((h) => repo.transfers.listByHostel(h.id))),
          Promise.all(hostels.map((h) => repo.joinRequests.listByHostel(h.id))),
          Promise.all(hostels.map((h) => repo.announcements.listByHostel(h.id))),
          Promise.all(hostels.map((h) => repo.meals.getMealDay(h.id, today()))),
        ]);
      if (cancelled) return;

      setUsersByHostel(Object.fromEntries(hostels.map((h, i) => [h.id, usersLists[i]])));
      setExpensesByHostel(Object.fromEntries(hostels.map((h, i) => [h.id, expenseLists[i]])));
      setBillsByHostel(Object.fromEntries(hostels.map((h, i) => [h.id, billLists[i]])));
      setJoinRequestCount(
        joinLists.flat().filter((r) => r.status === "pending").length
      );

      const dedupedTransfers = new Map<string, HostelTransferRequest>();
      transferLists.flat().forEach((t) => dedupedTransfers.set(t.id, t));
      setTransfers([...dedupedTransfers.values()]);

      const combinedAnnouncements = hostels
        .flatMap((h, i) => announcementLists[i].map((a) => ({ ...a, hostelName: h.name })))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 6);
      setAnnouncements(combinedAnnouncements);

      const meals = mealDayLists.reduce(
        (sum, day) =>
          sum +
          Object.values(day.entries).reduce(
            (s, e) =>
              s +
              ((e.breakfast.on ? 1 : 0) + e.breakfast.guestCount) +
              ((e.lunch.on ? 1 : 0) + e.lunch.guestCount) +
              ((e.dinner.on ? 1 : 0) + e.dinner.guestCount),
            0
          ),
        0
      );
      setMealsToday(meals);

      // Actual monthly rate inputs, summed across the portfolio.
      const rateInfos = await Promise.all(
        hostels.map((h) => repo.meals.getActualMealRate(h.id, currentMonth()))
      );
      if (cancelled) return;
      setTotalShoppingMonth(rateInfos.reduce((sum, r) => sum + r.totalShopping, 0));
      setTotalMealsMonth(rateInfos.reduce((sum, r) => sum + r.totalMeals, 0));
    })();

    return () => {
      cancelled = true;
    };
  }, [hostels]);

  const allUsers = Object.values(usersByHostel).flat();
  const studentCount = allUsers.filter((u) => u.role === "student").length;
  const managerCount = allUsers.filter((u) => u.role === "manager").length;
  const cookCount = allUsers.filter((u) => u.role === "cook").length;
  // Actual per-meal cost across all hostels this month: Σ shopping ÷ Σ meals.
  const avgMealRate = totalMealsMonth > 0 ? totalShoppingMonth / totalMealsMonth : 0;
  // "Fixed per person" expenses charge e.amount to EACH selected member, so
  // the real total spent is e.amount × member count, not e.amount itself.
  const expenseImpact = (e: Expense) => (e.splitMode === "fixed" ? e.amount * e.memberIds.length : e.amount);
  const totalExpense = Object.values(expensesByHostel).flat().reduce((sum, e) => sum + expenseImpact(e), 0);
  const totalIncome = Object.values(billsByHostel)
    .flat()
    .reduce((sum, b) => sum + b.paid, 0);
  const totalOutstanding = Object.values(billsByHostel)
    .flat()
    .reduce((sum, b) => sum + (b.grandTotal - b.paid), 0);
  const pendingTransfers = transfers.filter((t) => t.stage !== "approved" && t.stage !== "denied");

  const perHostel = hostels.map((h) => ({
    name: h.name,
    income: (billsByHostel[h.id] ?? []).reduce((sum, b) => sum + b.paid, 0),
    expense: (expensesByHostel[h.id] ?? []).reduce((sum, e) => sum + expenseImpact(e), 0),
  }));
  const maxAmount = Math.max(1, ...perHostel.flatMap((h) => [h.income, h.expense]));

  const stats = [
    {
      label: "Students",
      value: studentCount,
      icon: Users,
      sub: joinRequestCount > 0 ? `${joinRequestCount} pending join requests` : undefined,
    },
    {
      label: "Hostels",
      value: hostels.length,
      sub: `${managerCount} managers · ${cookCount} cooks`,
      icon: Building2,
    },
    { label: "Meals today", value: mealsToday, icon: UtensilsCrossed, sub: `across ${hostels.length} hostels` },
    { label: "Actual rate/meal", value: formatBDT(avgMealRate), icon: ArrowLeftRight },
  ];

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div>
        <div className="text-[17.5px] font-extrabold tracking-tight">Overview</div>
        <div className="text-[11px] font-semibold text-text-secondary">
          All hostels · {new Date().toLocaleString("en", { month: "long", year: "numeric" })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <div className="text-[10px] font-bold text-text-secondary">{s.label}</div>
            <div className="mt-1 text-[19px] font-extrabold leading-none">{s.value}</div>
            {s.sub && (
              <div className="mt-1 text-[9.5px] font-semibold text-primary">{s.sub}</div>
            )}
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[
          { href: "/owner/rooms", label: "Rooms", icon: DoorOpen },
          { href: "/owner/members", label: "Members", icon: Users },
          { href: "/owner/meals", label: "Meals", icon: UtensilsCrossed },
          { href: "/owner/staff", label: "Staff", icon: ChefHat },
        ].map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex flex-col items-center gap-1.5 rounded-card border border-border bg-card py-3 shadow-chip"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Icon icon={a.icon} size={16} />
            </div>
            <div className="text-[10px] font-extrabold">{a.label}</div>
          </Link>
        ))}
      </div>

      {perHostel.length > 0 && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[11.5px] font-extrabold uppercase tracking-wide text-text-secondary">
              Income vs expense
            </div>
            <div className="flex items-center gap-3 text-[9.5px] font-bold">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-primary" /> Income
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-orange" /> Expense
              </span>
            </div>
          </div>
          <div className="flex items-end justify-around gap-4" style={{ height: 120 }}>
            {perHostel.map((h) => (
              <div key={h.name} className="flex items-end gap-1">
                <div
                  className="w-5 rounded-t-md bg-primary"
                  style={{ height: `${Math.max(4, (h.income / maxAmount) * 100)}px` }}
                />
                <div
                  className="w-5 rounded-t-md bg-orange"
                  style={{ height: `${Math.max(4, (h.expense / maxAmount) * 100)}px` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-around">
            {perHostel.map((h) => (
              <div key={h.name} className="w-12 text-center text-[9px] font-bold text-text-secondary">
                {h.name}
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3">
            <div>
              <div className="text-[9.5px] font-bold text-text-secondary">Income</div>
              <div className="text-[12.5px] font-extrabold text-primary">{formatBDT(totalIncome)}</div>
            </div>
            <div>
              <div className="text-[9.5px] font-bold text-text-secondary">Expense</div>
              <div className="text-[12.5px] font-extrabold text-orange">{formatBDT(totalExpense)}</div>
            </div>
            <div>
              <div className="text-[9.5px] font-bold text-text-secondary">Outstanding</div>
              <div className="text-[12.5px] font-extrabold text-danger">{formatBDT(totalOutstanding)}</div>
            </div>
          </div>
        </Card>
      )}

      {pendingTransfers.length > 0 && (
        <Link href="/owner/more">
          <Card className="flex items-center justify-between bg-[#7C6CF6]/10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7C6CF6]/20 text-[#7C6CF6]">
                <Icon icon={ClipboardCheck} size={18} />
              </div>
              <div>
                <div className="text-[12.5px] font-extrabold text-[#7C6CF6]">
                  {pendingTransfers.length} transfer request{pendingTransfers.length > 1 ? "s" : ""} pending
                </div>
                <div className="text-[10px] font-semibold text-[#7C6CF6]/80">Requires your approval</div>
              </div>
            </div>
            <Chip tone="danger" active>
              {pendingTransfers.length}
            </Chip>
          </Card>
        </Link>
      )}

      <Card>
        <div className="mb-3 text-[13.5px] font-extrabold">Recent activity</div>
        <div className="flex flex-col gap-2.5">
          {announcements.length === 0 && (
            <div className="text-[11.5px] font-semibold text-text-secondary">No recent activity.</div>
          )}
          {announcements.map((a) => (
            <div key={a.id} className="rounded-btn bg-bg p-3">
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-extrabold">{a.title}</div>
                <Chip>{a.hostelName}</Chip>
              </div>
              <div className="mt-0.5 text-[11px] font-semibold text-text-secondary">{a.body}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

"use client";

import { CalendarClock, Users, Wallet } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useMealDay } from "@/hooks/useMealDay";
import { useExpenses } from "@/hooks/useExpenses";
import { useCookLeaveRequests } from "@/hooks/useCookLeaveRequests";
import { useUsers } from "@/hooks/useUsers";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { formatBDT } from "@/lib/utils/currency";
import { currentMonth, formatShortDate, today } from "@/lib/utils/date";

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`);
  const b = new Date(`${to}T00:00:00Z`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
}

export default function CookSalaryPage() {
  const { user, hostel, activeHostelId } = useSession();
  const { day } = useMealDay(activeHostelId, today());
  const expenses = useExpenses(activeHostelId);
  const leaveRequests = useCookLeaveRequests(activeHostelId);
  const boarders = useUsers(activeHostelId).filter((u) => u.role !== "cook" && u.role !== "owner");

  const monthlySalary = hostel?.cookMonthlySalary ?? 0;
  const paidThisMonth = expenses
    .filter((e) => e.category === "Salary" && e.billingMonth === currentMonth())
    .reduce((sum, e) => sum + e.amount, 0);
  const due = Math.max(monthlySalary - paidThisMonth, 0);

  const myLeave = leaveRequests.filter((r) => r.cookId === user?.id);
  const approvedLeave = myLeave.filter((r) => r.status === "approved");
  const pendingLeave = myLeave.filter((r) => r.status === "pending");
  const totalLeaveDays = approvedLeave.reduce((sum, r) => sum + daysBetween(r.dateFrom, r.dateTo), 0);

  const eatingToday = day
    ? Object.values(day.entries).reduce(
        (sum, e) => sum + (e.breakfast.on || e.lunch.on || e.dinner.on ? 1 : 0),
        0
      )
    : 0;

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div>
        <div className="text-[17.5px] font-extrabold tracking-tight">My Salary</div>
        <div className="text-[11px] font-semibold text-text-secondary">
          {hostel?.name} · {user?.name}
        </div>
      </div>

      <div
        className="rounded-card p-5 text-white"
        style={{ background: "linear-gradient(135deg, var(--color-primary), #0a8f86)" }}
      >
        <div className="text-[11px] font-bold text-white/80">Monthly salary</div>
        <div className="mt-1 mb-3 text-[22px] font-extrabold">{formatBDT(monthlySalary)}</div>
        <div className="flex gap-2">
          <div className="min-w-0 flex-1 rounded-btn bg-white/15 px-3 py-2">
            <div className="text-[9.5px] font-bold text-white/70">Paid this month</div>
            <div className="text-[13px] font-extrabold">{formatBDT(paidThisMonth)}</div>
          </div>
          <div className="min-w-0 flex-1 rounded-btn bg-white/15 px-3 py-2">
            <div className="text-[9.5px] font-bold text-white/70">Due</div>
            <div className="text-[13px] font-extrabold">{formatBDT(due)}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center" padded>
          <div className="mb-1 flex justify-center text-text-secondary">
            <Icon icon={Users} size={16} />
          </div>
          <div className="text-[16.5px] font-extrabold">{eatingToday}</div>
          <div className="text-[9.5px] font-bold text-text-secondary">Eating today</div>
        </Card>
        <Card className="text-center" padded>
          <div className="mb-1 flex justify-center text-text-secondary">
            <Icon icon={Users} size={16} />
          </div>
          <div className="text-[16.5px] font-extrabold">{boarders.length}</div>
          <div className="text-[9.5px] font-bold text-text-secondary">Total boarders</div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center" padded>
          <div className="mb-1 flex justify-center text-text-secondary">
            <Icon icon={CalendarClock} size={16} />
          </div>
          <div className="text-[16.5px] font-extrabold">{totalLeaveDays}</div>
          <div className="text-[9.5px] font-bold text-text-secondary">Total leave days</div>
        </Card>
        <Card className="text-center" padded>
          <div className="mb-1 flex justify-center text-text-secondary">
            <Icon icon={Wallet} size={16} />
          </div>
          <div className="text-[16.5px] font-extrabold text-orange">{pendingLeave.length}</div>
          <div className="text-[9.5px] font-bold text-text-secondary">Pending requests</div>
        </Card>
      </div>

      <div>
        <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
          Leave history
        </div>
        <div className="flex flex-col gap-2">
          {myLeave.length === 0 && (
            <Card className="text-center text-[11.5px] font-semibold text-text-secondary">
              No leave taken yet.
            </Card>
          )}
          {[...myLeave]
            .sort((a, b) => b.dateFrom.localeCompare(a.dateFrom))
            .map((r) => (
              <Card key={r.id} className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-[12px] font-bold">
                    {formatShortDate(r.dateFrom)}
                    {r.dateTo !== r.dateFrom ? ` – ${formatShortDate(r.dateTo)}` : ""}
                    {r.scope === "partial" && r.meals ? ` · ${r.meals.join(", ")}` : ""}
                  </div>
                  <div className="truncate text-[10px] font-semibold text-text-secondary">{r.reason}</div>
                </div>
                <Chip
                  tone={r.status === "approved" ? "primary" : r.status === "denied" ? "danger" : "orange"}
                  active
                >
                  {r.status}
                </Chip>
              </Card>
            ))}
        </div>
      </div>
    </div>
  );
}

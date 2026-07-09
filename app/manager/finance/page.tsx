"use client";

import { useEffect, useState } from "react";
import {
  Ban,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Flame,
  Package,
  ShoppingCart,
  Trash2,
  Utensils,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useExpenses } from "@/hooks/useExpenses";
import { useUsers } from "@/hooks/useUsers";
import { useRooms } from "@/hooks/useRooms";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { AddExpenseSheet } from "@/components/manager/AddExpenseSheet";
import { GenerateBillsSheet } from "@/components/manager/GenerateBillsSheet";
import { repo, type Bill, type BillSection } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";
import { formatMonthLabel, lastDayOfMonth, today } from "@/lib/utils/date";

const CATEGORY_META: Record<string, { icon: LucideIcon; bar: string; tone: string }> = {
  Grocery: { icon: ShoppingCart, bar: "bg-primary", tone: "bg-primary-soft text-primary" },
  Utilities: { icon: Zap, bar: "bg-orange", tone: "bg-orange-soft text-orange" },
  Salary: { icon: Users, bar: "bg-blue", tone: "bg-blue-soft text-blue" },
  Others: { icon: Package, bar: "bg-[#7C6CF6]", tone: "bg-[#7C6CF6]/10 text-[#7C6CF6]" },
};
const DEFAULT_META = { icon: Flame, bar: "bg-text-secondary", tone: "bg-bg text-text-secondary" };

const SECTION_LABEL: Record<BillSection["label"], string> = {
  mealCost: "Meal cost",
  roomRent: "Room rent",
  serviceCharge: "Service charge",
  cookSalary: "Cook salary",
};

export default function ManagerFinancePage() {
  const { hostel, activeHostelId } = useSession();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const allExpenses = useExpenses(activeHostelId);
  const boarders = useUsers(activeHostelId).filter((u) => u.role !== "cook" && u.role !== "owner");
  const rooms = useRooms(activeHostelId);
  const { toast } = useToast();
  const [bills, setBills] = useState<Bill[]>([]);
  const [expenseSheetOpen, setExpenseSheetOpen] = useState(false);
  const [generateSheetOpen, setGenerateSheetOpen] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const monthStr = `${year}-${String(month).padStart(2, "0")}`;
  const expenses = allExpenses.filter((e) => e.date.startsWith(monthStr));
  const monthEnd = lastDayOfMonth(monthStr);
  const canSuspendMeals = monthEnd >= today();

  useEffect(() => {
    if (!activeHostelId) return;
    repo.bills.listByHostel(activeHostelId, monthStr).then(setBills);
  }, [activeHostelId, monthStr, allExpenses]);

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  const refreshBills = () => {
    if (!activeHostelId) return;
    repo.bills.listByHostel(activeHostelId, monthStr).then(setBills);
  };

  const income = bills.reduce((sum, b) => sum + b.paid, 0);
  const outstanding = bills.reduce((sum, b) => sum + (b.grandTotal - b.paid), 0);
  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
  const net = income - totalExpense;
  const monthShort = formatMonthLabel(monthStr).split(" ")[0].slice(0, 3);

  const byCategory = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount;
    return acc;
  }, {});
  const totalForPct = Object.values(byCategory).reduce((a, b) => a + b, 0) || 1;

  const tiles = [
    { label: `Income · ${monthShort}`, value: income, color: "text-primary" },
    { label: `Expense · ${monthShort}`, value: totalExpense, color: "text-orange" },
    { label: "Outstanding", value: outstanding, color: "text-danger" },
    { label: "Net balance", value: net, color: "" },
  ];

  const nameOf = (id: string) => boarders.find((u) => u.id === id)?.name ?? id;
  const roomOf = (id: string) => rooms.find((r) => r.occupantIds.includes(id));

  const isSuspended = (userId: string) => boarders.find((u) => u.id === userId)?.mealsSuspended ?? false;

  const toggleSuspend = async (userId: string) => {
    if (!activeHostelId) return;
    const suspended = isSuspended(userId);
    const monthStart = `${monthStr}-01`;
    const from = monthStart > today() ? monthStart : today();
    await repo.meals.setMemberMealsForRange(activeHostelId, userId, from, monthEnd, suspended);
    toast(suspended ? `${nameOf(userId)}'s meals resumed` : `${nameOf(userId)}'s meals turned off until paid`);
  };

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="flex items-center justify-between">
        <div className="text-[17.5px] font-extrabold tracking-tight">Finance</div>
        <button
          type="button"
          onClick={() => setExpenseSheetOpen(true)}
          className="min-h-10 cursor-pointer rounded-pill bg-primary px-4 text-[11.5px] font-extrabold text-white"
        >
          + Expense
        </button>
      </div>

      <Card className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label="Previous month"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-bg"
        >
          <Icon icon={ChevronLeft} size={16} />
        </button>
        <div className="text-[13px] font-extrabold">{formatMonthLabel(monthStr)}</div>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label="Next month"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-bg"
        >
          <Icon icon={ChevronRight} size={16} />
        </button>
      </Card>

      <button
        type="button"
        onClick={() => setGenerateSheetOpen(true)}
        disabled={!activeHostelId}
        className="min-h-11 w-full cursor-pointer rounded-btn font-extrabold text-white disabled:opacity-50"
        style={{ background: "linear-gradient(135deg, var(--gradient-accent-from), var(--gradient-accent-to))" }}
      >
        Generate bills · {formatMonthLabel(monthStr)}
      </button>

      <div className="grid grid-cols-2 gap-3">
        {tiles.map((t) => (
          <Card key={t.label}>
            <div className="text-[9.5px] font-bold text-text-secondary">{t.label}</div>
            <div className={`mt-1 text-[16px] font-extrabold ${t.color}`}>{formatBDT(t.value)}</div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="mb-3 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
          Expense breakdown · {formatMonthLabel(monthStr)}
        </div>
        <div className="flex flex-col gap-3">
          {Object.entries(byCategory).length === 0 && (
            <div className="text-[11.5px] font-semibold text-text-secondary">No expenses this month.</div>
          )}
          {Object.entries(byCategory)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, amount]) => {
              const meta = CATEGORY_META[cat] ?? DEFAULT_META;
              const pct = Math.round((amount / totalForPct) * 100);
              return (
                <div key={cat}>
                  <div className="mb-1 flex items-center justify-between text-[11px] font-bold">
                    <div>{cat}</div>
                    <div>
                      {formatBDT(amount)} · {pct}%
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-pill bg-bg">
                    <div className={`h-2 rounded-pill ${meta.bar}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
        </div>
      </Card>

      <div>
        <div className="mb-2 text-[13.5px] font-extrabold">
          All members · {formatMonthLabel(monthStr)}
        </div>
        <div className="flex flex-col gap-2">
          {bills.length === 0 && (
            <Card className="text-center text-[11.5px] font-semibold text-text-secondary">
              No bills generated for this month yet.
            </Card>
          )}
          {[...bills]
            .sort((a, b) => nameOf(a.userId).localeCompare(nameOf(b.userId)))
            .map((b) => {
              const room = roomOf(b.userId);
              const due = b.grandTotal - b.paid;
              const open = expandedUserId === b.userId;
              return (
                <Card key={b.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedUserId(open ? null : b.userId)}
                    className="flex w-full cursor-pointer items-center gap-3 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-extrabold">{nameOf(b.userId)}</div>
                      <div className="text-[10px] font-semibold text-text-secondary">
                        {formatMonthLabel(b.month)} · {room ? `Room ${room.number}` : "Unassigned"} ·{" "}
                        {b.mealsCount} meals
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[12.5px] font-extrabold">{formatBDT(b.grandTotal)}</div>
                      <div className={`text-[9.5px] font-bold ${due > 0 ? "text-danger" : "text-primary"}`}>
                        {due > 0 ? `Due ${formatBDT(due)}` : "Paid in full"}
                      </div>
                    </div>
                    <Icon icon={open ? ChevronUp : ChevronDown} size={16} className="shrink-0 text-text-secondary" />
                  </button>

                  {open && (
                    <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                      {b.dueDate && (
                        <div className="flex items-center justify-between text-[11px] font-bold text-text-secondary">
                          <div>Last day of payment</div>
                          <div>{b.dueDate}</div>
                        </div>
                      )}
                      {b.previousBalance > 0 && (
                        <div className="flex items-center justify-between text-[11px] font-bold text-orange">
                          <div>Previous balance</div>
                          <div>{formatBDT(b.previousBalance)}</div>
                        </div>
                      )}
                      {b.sections.map((s) => (
                        <div key={s.label}>
                          <div className="flex items-center justify-between text-[11px] font-bold">
                            <div>{SECTION_LABEL[s.label]}</div>
                            <div>{formatBDT(s.total)}</div>
                          </div>
                          {s.items.map((item, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between pl-2 text-[10px] font-semibold text-text-secondary"
                            >
                              <div>{item.label}</div>
                              <div>{formatBDT(item.amount)}</div>
                            </div>
                          ))}
                        </div>
                      ))}

                      {due > 0 && canSuspendMeals && (
                        <button
                          type="button"
                          onClick={() => toggleSuspend(b.userId)}
                          className={`mt-1 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-btn text-[12px] font-extrabold ${
                            isSuspended(b.userId)
                              ? "bg-primary-soft text-primary"
                              : "bg-danger-soft text-danger"
                          }`}
                        >
                          <Icon icon={isSuspended(b.userId) ? Utensils : Ban} size={15} />
                          {isSuspended(b.userId) ? "Resume meals" : "Turn off meals until paid"}
                        </button>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
        </div>
      </div>

      <div>
        <div className="mb-2 text-[13.5px] font-extrabold">Recent expenses</div>
        <div className="flex flex-col gap-2">
          {expenses.length === 0 && (
            <Card className="text-[11.5px] font-semibold text-text-secondary">No expenses recorded.</Card>
          )}
          {[...expenses]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((e) => {
              const meta = CATEGORY_META[e.category] ?? DEFAULT_META;
              return (
                <Card key={e.id} className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.tone}`}>
                    <Icon icon={meta.icon} size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-extrabold">
                      {e.category}
                      {e.note ? ` — ${e.note}` : ""}
                    </div>
                    <div className="text-[10px] font-semibold text-text-secondary">{e.date}</div>
                  </div>
                  <div className="text-[12px] font-extrabold">{formatBDT(e.amount)}</div>
                  <button
                    type="button"
                    onClick={async () => {
                      await repo.expenses.remove(e.id);
                      toast("Expense deleted");
                    }}
                    aria-label="Delete expense"
                    className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-danger-soft text-danger"
                  >
                    <Icon icon={Trash2} size={14} />
                  </button>
                </Card>
              );
            })}
        </div>
      </div>

      <AddExpenseSheet
        open={expenseSheetOpen}
        onClose={() => setExpenseSheetOpen(false)}
        hostelId={activeHostelId}
      />
      <GenerateBillsSheet
        open={generateSheetOpen}
        onClose={() => setGenerateSheetOpen(false)}
        hostelId={activeHostelId}
        month={monthStr}
        boarders={boarders}
        cookMonthlySalary={hostel?.cookMonthlySalary}
        onGenerated={(count) => {
          refreshBills();
          toast(`Bills generated for ${count} member${count === 1 ? "" : "s"}`);
        }}
      />
    </div>
  );
}

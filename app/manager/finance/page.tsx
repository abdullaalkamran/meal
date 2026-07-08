"use client";

import { useEffect, useState } from "react";
import { Flame, Package, ShoppingCart, Users, Zap, type LucideIcon } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useExpenses } from "@/hooks/useExpenses";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { AddExpenseSheet } from "@/components/manager/AddExpenseSheet";
import { repo, type Bill } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";
import { currentMonth, formatMonthLabel } from "@/lib/utils/date";

const CATEGORY_META: Record<string, { icon: LucideIcon; bar: string; tone: string }> = {
  Grocery: { icon: ShoppingCart, bar: "bg-primary", tone: "bg-primary-soft text-primary" },
  Utilities: { icon: Zap, bar: "bg-orange", tone: "bg-orange-soft text-orange" },
  Salary: { icon: Users, bar: "bg-blue", tone: "bg-blue-soft text-blue" },
  Others: { icon: Package, bar: "bg-[#7C6CF6]", tone: "bg-[#7C6CF6]/10 text-[#7C6CF6]" },
};
const DEFAULT_META = { icon: Flame, bar: "bg-text-secondary", tone: "bg-bg text-text-secondary" };

export default function ManagerFinancePage() {
  const { activeHostelId } = useSession();
  const expenses = useExpenses(activeHostelId);
  const [bills, setBills] = useState<Bill[]>([]);
  const [expenseSheetOpen, setExpenseSheetOpen] = useState(false);

  useEffect(() => {
    if (!activeHostelId) return;
    repo.bills.listByHostel(activeHostelId, currentMonth()).then(setBills);
  }, [activeHostelId, expenses]);

  const income = bills.reduce((sum, b) => sum + b.paid, 0);
  const outstanding = bills.reduce((sum, b) => sum + (b.grandTotal - b.paid), 0);
  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
  const net = income - totalExpense;
  const monthShort = formatMonthLabel(currentMonth()).split(" ")[0].slice(0, 3);

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
          Expense breakdown · {formatMonthLabel(currentMonth())}
        </div>
        <div className="flex flex-col gap-3">
          {Object.entries(byCategory).length === 0 && (
            <div className="text-[11.5px] font-semibold text-text-secondary">No expenses yet.</div>
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
    </div>
  );
}

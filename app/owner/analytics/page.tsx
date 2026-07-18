"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useHostelsByOwner } from "@/hooks/useHostel";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { DonutChart } from "@/components/ui/DonutChart";
import { MonthNav } from "@/components/ui/MonthNav";
import {
  repo,
  type Bill,
  type Expense,
  type MealDay,
  type Payment,
  type Room,
  type ShoppingCost,
  type User,
} from "@/lib/data";
import { currentMonth, lastDayOfMonth, today } from "@/lib/utils/date";
import { buildReport, REPORT_TYPES, type ReportInputs, type ReportType } from "@/lib/reports/ownerReports";
import { downloadReportCsv, printReport } from "@/lib/reports/export";

export default function OwnerAnalyticsPage() {
  const { user } = useSession();
  const hostels = useHostelsByOwner(user?.id);
  const { toast } = useToast();
  const [month, setMonth] = useState(currentMonth());
  const [hostelFilter, setHostelFilter] = useState<string | "all">("all");
  const [openReport, setOpenReport] = useState<ReportType | null>(null);
  const [inputs, setInputs] = useState<ReportInputs | null>(null);

  const selectedHostels = useMemo(
    () => (hostelFilter === "all" ? hostels : hostels.filter((h) => h.id === hostelFilter)),
    [hostels, hostelFilter]
  );

  // One data sweep per month/selection — every report table is derived from
  // this bundle by the pure builders in lib/reports/ownerReports.
  useEffect(() => {
    if (selectedHostels.length === 0) return;
    let cancelled = false;

    (async () => {
      const from = `${month}-01`;
      const to = lastDayOfMonth(month);
      const [users, rooms, mealDays, expenses, shopping, bills] = await Promise.all([
        Promise.all(selectedHostels.map((h) => repo.users.listByHostel(h.id))),
        Promise.all(selectedHostels.map((h) => repo.rooms.listByHostel(h.id))),
        Promise.all(selectedHostels.map((h) => repo.meals.listMealDays(h.id, { from, to }))),
        Promise.all(selectedHostels.map((h) => repo.expenses.listByHostel(h.id))),
        Promise.all(selectedHostels.map((h) => repo.shoppingCosts.listByHostel(h.id))),
        Promise.all(selectedHostels.map((h) => repo.bills.listByHostel(h.id, month))),
      ]);
      const allBills = bills.flat();
      const paymentEntries = await Promise.all(
        allBills.map(async (b) => [b.id, await repo.bills.listPayments(b.id)] as const)
      );
      if (cancelled) return;

      const byHostel = <T,>(lists: T[][]) =>
        Object.fromEntries(selectedHostels.map((h, i) => [h.id, lists[i]]));

      setInputs({
        month,
        date: today(),
        hostels: selectedHostels,
        usersByHostel: byHostel<User>(users),
        roomsByHostel: byHostel<Room>(rooms),
        mealDaysByHostel: byHostel<MealDay>(mealDays),
        expensesByHostel: Object.fromEntries(
          selectedHostels.map((h, i) => [h.id, expenses[i].filter((e: Expense) => e.billingMonth === month)])
        ),
        shoppingByHostel: byHostel<ShoppingCost>(shopping),
        billsByHostel: byHostel<Bill>(bills),
        paymentsByBill: Object.fromEntries(paymentEntries) as Record<string, Payment[]>,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedHostels, month]);

  // "Fixed per person" expenses charge e.amount to EACH selected member, so
  // the real total spent is e.amount × member count, not e.amount itself.
  const monthExpenses = inputs ? Object.values(inputs.expensesByHostel).flat() : [];
  const byCategory = monthExpenses.reduce<Record<string, number>>((acc, e) => {
    const impact = e.splitMode === "fixed" ? e.amount * e.memberIds.length : e.amount;
    acc[e.category] = (acc[e.category] ?? 0) + impact;
    return acc;
  }, {});
  const segments = Object.entries(byCategory).map(([label, value]) => ({ label, value }));

  const activeTable = inputs && openReport ? buildReport(openReport, inputs) : null;

  const exportCsv = () => {
    if (!activeTable) {
      toast("Open a report first, then export it");
      return;
    }
    downloadReportCsv(activeTable, `${openReport}-${month}`);
  };
  const exportPdf = () => {
    if (!activeTable) {
      toast("Open a report first, then export it");
      return;
    }
    printReport();
  };

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div>
        <div className="text-[17.5px] font-extrabold tracking-tight">Analytics</div>
        <div className="text-[10.5px] font-semibold text-text-secondary">
          Daily, shopping, expense, payment &amp; roster breakdowns
        </div>
      </div>

      <MonthNav value={month} onChange={setMonth} />

      {hostels.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          {[{ id: "all" as const, name: "All hostels" }, ...hostels].map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => setHostelFilter(h.id)}
              className={`shrink-0 rounded-pill px-3.5 py-2 text-[11px] font-extrabold ${
                h.id === hostelFilter ? "bg-primary text-white" : "bg-card text-text-secondary shadow-chip"
              }`}
            >
              {h.name}
            </button>
          ))}
        </div>
      )}

      <Card>
        <div className="mb-3 text-[13.5px] font-extrabold">
          Expense mix · {hostelFilter === "all" ? "all hostels" : selectedHostels[0]?.name}
        </div>
        {segments.length === 0 ? (
          <div className="text-[11.5px] font-semibold text-text-secondary">
            No expenses recorded for this month.
          </div>
        ) : (
          <DonutChart segments={segments} />
        )}
      </Card>

      <Card>
        <div className="mb-1 text-[13.5px] font-extrabold">Report types</div>
        <div className="flex flex-col">
          {REPORT_TYPES.map((r) => {
            const isOpen = openReport === r;
            const table = isOpen && inputs ? buildReport(r, inputs) : null;
            return (
              <div key={r} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  onClick={() => setOpenReport(isOpen ? null : r)}
                  className="flex min-h-12 w-full cursor-pointer items-center justify-between text-left text-[12px] font-bold"
                >
                  {r}
                  <Icon icon={isOpen ? ChevronUp : ChevronDown} size={15} className="text-text-secondary" />
                </button>
                {table && (
                  <div className="report-print-area mb-3">
                    <div className="mb-2 hidden text-[13px] font-extrabold print:block">
                      {table.title} · {month}
                    </div>
                    {table.rows.length === 0 ? (
                      <div className="rounded-btn bg-bg px-3 py-2.5 text-[11px] font-semibold text-text-secondary">
                        Nothing to report for this month.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-btn border border-border">
                        <table className="w-full min-w-max border-collapse text-left">
                          <thead>
                            <tr className="bg-bg">
                              {table.columns.map((c) => (
                                <th key={c} className="px-2.5 py-2 text-[9.5px] font-extrabold uppercase tracking-wide text-text-secondary">
                                  {c}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {table.rows.map((row, i) => (
                              <tr key={i} className="border-t border-border">
                                {row.map((cell, j) => (
                                  <td key={j} className="px-2.5 py-2 text-[10.5px] font-bold">
                                    {typeof cell === "number" ? Math.round(cell * 100) / 100 : cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="flex gap-2.5">
        <Button fullWidth variant="secondary" onClick={exportPdf}>
          Export PDF
        </Button>
        <Button fullWidth variant="secondary" onClick={exportCsv}>
          Export Excel
        </Button>
      </div>
      <div className="-mt-3 text-center text-[9.5px] font-semibold text-text-secondary">
        Exports the report that&rsquo;s currently open, for the selected month
        {hostels.length > 1 ? " and hostel filter" : ""}.
      </div>
    </div>
  );
}

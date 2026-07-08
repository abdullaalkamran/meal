"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useHostelsByOwner } from "@/hooks/useHostel";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DonutChart } from "@/components/ui/DonutChart";
import { repo, type Expense } from "@/lib/data";

const REPORT_TYPES = [
  "Daily report",
  "Meal report",
  "Shopping report",
  "Expense report",
  "Payment report",
  "Outstanding report",
  "Student report",
];

export default function OwnerReportsPage() {
  const { user } = useSession();
  const hostels = useHostelsByOwner(user?.id);
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    if (hostels.length === 0) return;
    Promise.all(hostels.map((h) => repo.expenses.listByHostel(h.id))).then((lists) =>
      setExpenses(lists.flat())
    );
  }, [hostels]);

  const byCategory = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount;
    return acc;
  }, {});
  const segments = Object.entries(byCategory).map(([label, value]) => ({ label, value }));

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="text-[17.5px] font-extrabold tracking-tight">Reports</div>

      <Card>
        <div className="mb-3 text-[13.5px] font-extrabold">Expense mix (all hostels)</div>
        {segments.length === 0 ? (
          <div className="text-[11.5px] font-semibold text-text-secondary">No expenses recorded yet.</div>
        ) : (
          <DonutChart segments={segments} />
        )}
      </Card>

      <Card>
        <div className="mb-1 text-[13.5px] font-extrabold">Report types</div>
        <div className="flex flex-col">
          {REPORT_TYPES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => toast(`${r} — coming in a later build phase`)}
              className="flex min-h-12 cursor-pointer items-center border-b border-border text-left text-[12px] font-bold last:border-b-0"
            >
              {r}
            </button>
          ))}
        </div>
      </Card>

      <div className="flex gap-2.5">
        <Button fullWidth variant="secondary" onClick={() => toast("Export PDF — coming in a later build phase")}>
          Export PDF
        </Button>
        <Button fullWidth variant="secondary" onClick={() => toast("Export Excel — coming in a later build phase")}>
          Export Excel
        </Button>
      </div>
    </div>
  );
}

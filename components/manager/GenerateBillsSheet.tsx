"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { repo, type Expense, type User } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";
import { formatMonthLabel, lastDayOfMonth } from "@/lib/utils/date";

export function GenerateBillsSheet({
  open,
  onClose,
  hostelId,
  month,
  boarders,
  cookMonthlySalary,
  onGenerated,
}: {
  open: boolean;
  onClose: () => void;
  hostelId: string | undefined;
  month: string;
  boarders: User[];
  cookMonthlySalary: number | undefined;
  onGenerated: (count: number) => void;
}) {
  const [utilityExpenses, setUtilityExpenses] = useState<Expense[]>([]);
  const [includedIds, setIncludedIds] = useState<Set<string>>(new Set());
  const [cookSalaryMode, setCookSalaryMode] = useState<"fixed" | "expense">(
    cookMonthlySalary ? "fixed" : "expense"
  );
  const [fixedAmount, setFixedAmount] = useState(String(cookMonthlySalary ?? ""));
  const [dueDate, setDueDate] = useState(lastDayOfMonth(month));
  const [scope, setScope] = useState<"all" | "individual">("all");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!open || !hostelId) return;
    repo.expenses.listByHostel(hostelId).then((list) => {
      const utils = list.filter((e) => e.category === "Utilities" && e.date.startsWith(month));
      setUtilityExpenses(utils);
      setIncludedIds(new Set(utils.map((e) => e.id)));
    });
    queueMicrotask(() => {
      setCookSalaryMode(cookMonthlySalary ? "fixed" : "expense");
      setFixedAmount(String(cookMonthlySalary ?? ""));
      setDueDate(lastDayOfMonth(month));
      setScope("all");
      setSelectedUserIds(new Set());
    });
  }, [open, hostelId, month, cookMonthlySalary]);

  const toggleExpense = (id: string) => {
    setIncludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleUser = (id: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const serviceTotal = utilityExpenses
    .filter((e) => includedIds.has(e.id))
    .reduce((sum, e) => sum + e.amount, 0);

  const submit = async () => {
    if (!hostelId) return;
    if (scope === "individual" && selectedUserIds.size === 0) return;
    setGenerating(true);
    const created = await repo.bills.generateBills(hostelId, month, {
      includeServiceExpenseIds: [...includedIds],
      cookSalaryMode,
      fixedCookSalaryAmount: Number(fixedAmount) || 0,
      userIds: scope === "individual" ? [...selectedUserIds] : undefined,
      dueDate: dueDate || undefined,
    });
    setGenerating(false);
    onGenerated(created.length);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Generate bills · ${formatMonthLabel(month)}`}>
      <div className="mb-4 text-[11px] font-semibold text-text-secondary">
        Meal cost is calculated automatically from each member&rsquo;s own meals and guest meals —
        nothing to set there.
      </div>

      <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
        Service charges this month
      </div>
      <div className="mb-4 flex flex-col gap-2">
        {utilityExpenses.length === 0 && (
          <div className="rounded-btn bg-bg px-3 py-2.5 text-[11px] font-semibold text-text-secondary">
            No utility expenses recorded for this month yet.
          </div>
        )}
        {utilityExpenses.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => toggleExpense(e.id)}
            className="flex items-center justify-between rounded-btn bg-bg px-3 py-2.5"
          >
            <div className="min-w-0 truncate text-[11.5px] font-bold">{e.note ?? e.category}</div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="text-[11.5px] font-extrabold">{formatBDT(e.amount)}</div>
              <Chip tone="primary" active={includedIds.has(e.id)}>
                {includedIds.has(e.id) ? "Included" : "Excluded"}
              </Chip>
            </div>
          </button>
        ))}
        {utilityExpenses.length > 0 && (
          <div className="flex items-center justify-between px-1 text-[11px] font-bold">
            <div>Total (split equally per member)</div>
            <div>{formatBDT(serviceTotal)}</div>
          </div>
        )}
      </div>

      <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
        Cook salary
      </div>
      <SegmentedControl
        value={cookSalaryMode}
        onChange={setCookSalaryMode}
        className="mb-3"
        options={[
          { value: "fixed", label: "Fixed amount" },
          { value: "expense", label: "From expenses" },
        ]}
      />
      {cookSalaryMode === "fixed" ? (
        <div className="mb-4 flex items-center gap-2 rounded-btn bg-bg px-3 py-2.5">
          <span className="text-[12px] font-extrabold text-text-secondary">৳</span>
          <input
            type="number"
            value={fixedAmount}
            onChange={(e) => setFixedAmount(e.target.value)}
            placeholder="e.g. 12000"
            className="w-full bg-transparent text-[12px] font-bold outline-none"
          />
          <span className="shrink-0 text-[10px] font-semibold text-text-secondary">per month</span>
        </div>
      ) : (
        <div className="mb-4 text-[10.5px] font-semibold text-text-secondary">
          Uses the sum of this month&rsquo;s &ldquo;Salary&rdquo;-category expenses.
        </div>
      )}

      <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
        Last day of payment
      </div>
      <input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="mb-4 w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
      />

      <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
        Apply to
      </div>
      <div className="mb-3 flex gap-2">
        <button type="button" onClick={() => setScope("all")}>
          <Chip tone="primary" active={scope === "all"}>
            All members ({boarders.length})
          </Chip>
        </button>
        <button type="button" onClick={() => setScope("individual")}>
          <Chip tone="primary" active={scope === "individual"}>
            Specific members
          </Chip>
        </button>
      </div>

      {scope === "individual" && (
        <div className="mb-4 flex flex-col gap-2">
          {boarders.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => toggleUser(u.id)}
              className="flex items-center justify-between rounded-btn bg-bg px-3 py-2.5"
            >
              <div className="text-[11.5px] font-bold">{u.name}</div>
              <Chip tone="primary" active={selectedUserIds.has(u.id)}>
                {selectedUserIds.has(u.id) ? "Selected" : "Select"}
              </Chip>
            </button>
          ))}
        </div>
      )}

      <Button
        fullWidth
        onClick={submit}
        disabled={generating || (scope === "individual" && selectedUserIds.size === 0)}
      >
        {generating
          ? "Generating…"
          : scope === "all"
            ? `Generate for all ${boarders.length} members`
            : `Generate for ${selectedUserIds.size} member${selectedUserIds.size === 1 ? "" : "s"}`}
      </Button>
    </Sheet>
  );
}

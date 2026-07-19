"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { repo, type Expense } from "@/lib/data";
import { useHostel } from "@/hooks/useHostel";
import { formatBDT } from "@/lib/utils/currency";
import { formatMonthLabel, lastDayOfMonth } from "@/lib/utils/date";
import { isServiceChargeCategory } from "@/lib/utils/expenseCategories";

// For "Fixed per person" expenses, e.amount is charged to EACH selected
// member, so the real total impact is e.amount × member count — not e.amount
// itself. This applies identically to Utilities (service charge) and Salary
// (cook salary) expenses — cook salary used to ignore memberIds/splitMode
// entirely (pooling every Salary expense and dividing equally across every
// boarder), which silently overrode whatever the manager set when adding
// the expense.
const totalImpact = (e: Expense) => (e.splitMode === "fixed" ? e.amount * e.memberIds.length : e.amount);

function ExpenseToggleList({
  title,
  newExpenses,
  billedExpenses,
  includedIds,
  onToggle,
  emptyText,
  newEmptyText,
}: {
  title: string;
  newExpenses: Expense[];
  billedExpenses: Expense[];
  includedIds: Set<string>;
  onToggle: (id: string) => void;
  emptyText: string;
  newEmptyText: string;
}) {
  const total =
    billedExpenses.reduce((sum, e) => sum + totalImpact(e), 0) +
    newExpenses.filter((e) => includedIds.has(e.id)).reduce((sum, e) => sum + totalImpact(e), 0);

  return (
    <>
      <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
        New {title}
      </div>
      <div className="mb-4 flex flex-col gap-2">
        {newExpenses.length === 0 && (
          <div className="rounded-btn bg-bg px-3 py-2.5 text-[11px] font-semibold text-text-secondary">
            {billedExpenses.length > 0 ? newEmptyText : emptyText}
          </div>
        )}
        {newExpenses.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => onToggle(e.id)}
            className="flex items-center justify-between rounded-btn bg-bg px-3 py-2.5"
          >
            <div className="min-w-0 text-left">
              <div className="truncate text-[11.5px] font-bold">
                {e.category}
                {e.note ? ` — ${e.note}` : ""}
              </div>
              <div className="text-[9.5px] font-semibold text-text-secondary">
                {e.splitMode === "fixed" ? "Fixed per person" : "Split equally"} · {e.memberIds.length}{" "}
                member{e.memberIds.length === 1 ? "" : "s"}
              </div>
              {!e.dateFrom.startsWith(e.billingMonth) && (
                <div className="text-[9px] font-bold text-orange">
                  Covers {e.dateFrom} → {e.dateTo}
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="text-right">
                <div className="text-[11.5px] font-extrabold">{formatBDT(totalImpact(e))}</div>
                {e.splitMode === "fixed" && e.memberIds.length > 1 && (
                  <div className="text-[9px] font-semibold text-text-secondary">
                    {formatBDT(e.amount)} × {e.memberIds.length}
                  </div>
                )}
              </div>
              <Chip tone="primary" active={includedIds.has(e.id)}>
                {includedIds.has(e.id) ? "Included" : "Excluded"}
              </Chip>
            </div>
          </button>
        ))}
      </div>

      {billedExpenses.length > 0 && (
        <>
          <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
            Already included in current bills
          </div>
          <div className="mb-4 flex flex-col gap-2">
            {billedExpenses.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-btn bg-bg px-3 py-2.5">
                <div className="min-w-0 text-left">
                  <div className="truncate text-[11.5px] font-bold">
                {e.category}
                {e.note ? ` — ${e.note}` : ""}
              </div>
                  <div className="text-[9.5px] font-semibold text-text-secondary">
                    {e.splitMode === "fixed" ? "Fixed per person" : "Split equally"} · {e.memberIds.length}{" "}
                    member{e.memberIds.length === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="text-right">
                    <div className="text-[11.5px] font-extrabold">{formatBDT(totalImpact(e))}</div>
                    {e.splitMode === "fixed" && e.memberIds.length > 1 && (
                      <div className="text-[9px] font-semibold text-text-secondary">
                        {formatBDT(e.amount)} × {e.memberIds.length}
                      </div>
                    )}
                  </div>
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-card text-text-secondary">
                    <Icon icon={Lock} size={12} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {(newExpenses.length > 0 || billedExpenses.length > 0) && (
        <div className="mb-4 flex items-center justify-between px-1 text-[11px] font-bold">
          <div>Total {title} (each split per its own settings)</div>
          <div>{formatBDT(total)}</div>
        </div>
      )}
    </>
  );
}

export function GenerateBillsSheet({
  open,
  onClose,
  hostelId,
  month,
  onGenerated,
}: {
  open: boolean;
  onClose: () => void;
  hostelId: string | undefined;
  month: string;
  onGenerated: (count: number) => void;
}) {
  const hostel = useHostel(hostelId);
  const ownerServiceCharge = hostel?.settings.serviceChargeMonthly ?? 0;
  const [newUtilities, setNewUtilities] = useState<Expense[]>([]);
  const [billedUtilities, setBilledUtilities] = useState<Expense[]>([]);
  const [includedUtilityIds, setIncludedUtilityIds] = useState<Set<string>>(new Set());
  const [newSalary, setNewSalary] = useState<Expense[]>([]);
  const [billedSalary, setBilledSalary] = useState<Expense[]>([]);
  const [includedSalaryIds, setIncludedSalaryIds] = useState<Set<string>>(new Set());
  const [otherExpenseCount, setOtherExpenseCount] = useState(0);
  const [dueDate, setDueDate] = useState(lastDayOfMonth(month));
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!open || !hostelId) return;
    repo.expenses.listByHostel(hostelId).then((list) => {
      const monthExpenses = list.filter((e) => e.billingMonth === month);

      // Once an expense has already been folded into a generated bill it's
      // locked in — no longer offered as a togglable choice, so regenerating
      // never looks like "the same bill generating again." Only genuinely
      // new expenses added since the last generation show up as choices.
      const utils = monthExpenses.filter((e) => isServiceChargeCategory(e.category));
      setNewUtilities(utils.filter((e) => !e.billedAt));
      setBilledUtilities(utils.filter((e) => e.billedAt));
      setIncludedUtilityIds(new Set(utils.filter((e) => !e.billedAt).map((e) => e.id)));

      const salary = monthExpenses.filter((e) => e.category === "Salary");
      setNewSalary(salary.filter((e) => !e.billedAt));
      setBilledSalary(salary.filter((e) => e.billedAt));
      setIncludedSalaryIds(new Set(salary.filter((e) => !e.billedAt).map((e) => e.id)));

      // Grocery expenses aren't billed to members at all — surfaced here so
      // a manager who added one doesn't wonder why it's "missing".
      setOtherExpenseCount(
        monthExpenses.filter((e) => !isServiceChargeCategory(e.category) && e.category !== "Salary").length
      );
    });
    queueMicrotask(() => {
      setDueDate(lastDayOfMonth(month));
    });
  }, [open, hostelId, month]);

  const toggle = (setter: React.Dispatch<React.SetStateAction<Set<string>>>) => (id: string) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (!hostelId) return;
    setGenerating(true);
    const created = await repo.bills.generateBills(hostelId, month, {
      includeServiceExpenseIds: [...billedUtilities.map((e) => e.id), ...includedUtilityIds],
      includeSalaryExpenseIds: [...billedSalary.map((e) => e.id), ...includedSalaryIds],
      dueDate: dueDate || undefined,
    });
    setGenerating(false);
    onGenerated(created.length);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Generate bills · ${formatMonthLabel(month)}`}>
      <div className="mb-4 text-[11px] font-semibold text-text-secondary">
        Meal cost is fully automatic: this month&rsquo;s total shopping cost ÷ total meals
        (members + guests) = the actual per-meal rate, charged for each member&rsquo;s own
        and guest meals.
      </div>

      {ownerServiceCharge > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-btn bg-bg px-3 py-2.5">
          <div className="min-w-0">
            <div className="text-[11.5px] font-bold">Monthly service charge</div>
            <div className="text-[9.5px] font-semibold text-text-secondary">
              Set by the owner — always included, per boarder
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="text-[11.5px] font-extrabold">{formatBDT(ownerServiceCharge)}</div>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-card text-text-secondary">
              <Icon icon={Lock} size={12} />
            </div>
          </div>
        </div>
      )}

      <ExpenseToggleList
        title="service charges this month"
        newExpenses={newUtilities}
        billedExpenses={billedUtilities}
        includedIds={includedUtilityIds}
        onToggle={toggle(setIncludedUtilityIds)}
        emptyText="No utility expenses recorded for this month yet."
        newEmptyText="No new utility expenses since bills were last generated."
      />

      <ExpenseToggleList
        title="cook salary this month"
        newExpenses={newSalary}
        billedExpenses={billedSalary}
        includedIds={includedSalaryIds}
        onToggle={toggle(setIncludedSalaryIds)}
        emptyText="No salary expenses recorded for this month yet."
        newEmptyText="No new salary expenses since bills were last generated."
      />

      {otherExpenseCount > 0 && (
        <div className="mb-4 text-[10px] font-semibold text-text-secondary">
          {otherExpenseCount} Grocery expense{otherExpenseCount === 1 ? "" : "s"} this month aren&rsquo;t
          billed to members — visible in Recent expenses only.
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

      <Button fullWidth onClick={submit} disabled={generating}>
        {generating ? "Generating…" : "Generate"}
      </Button>
    </Sheet>
  );
}

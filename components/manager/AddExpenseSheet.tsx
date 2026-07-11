"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/Toast";
import { useUsers } from "@/hooks/useUsers";
import { repo } from "@/lib/data";
import { today } from "@/lib/utils/date";
import { EXPENSE_CATEGORIES } from "@/lib/utils/expenseCategories";

const CATEGORIES = EXPENSE_CATEGORIES;

export function AddExpenseSheet({
  open,
  onClose,
  hostelId,
  month,
}: {
  open: boolean;
  onClose: () => void;
  hostelId: string | undefined;
  /** The month (YYYY-MM) currently being viewed on the Finance page — the new
   * expense's billing month defaults to this, so it always shows up right
   * where the manager is looking instead of silently landing on today's
   * real-world month. */
  month: string;
}) {
  const { toast } = useToast();
  const boarders = useUsers(hostelId).filter((u) => u.role !== "cook" && u.role !== "owner");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [dateFrom, setDateFrom] = useState(today());
  const [dateTo, setDateTo] = useState(today());
  const [billingMonth, setBillingMonth] = useState(month);
  const [note, setNote] = useState("");
  const [splitMode, setSplitMode] = useState<"equal" | "fixed">("equal");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Reset every field when the sheet opens, not on every boarder list
    // update (which would reset the manager's in-progress choices) —
    // `boarders` is deliberately excluded from the dependency array. Without
    // this, category/dates/split mode silently carried over from whatever
    // was last entered, so a manager adding a Grocery expense right after a
    // Utilities one could end up saving it as Utilities by mistake.
    if (open) {
      queueMicrotask(() => {
        setCategory(CATEGORIES[0]);
        setAmount("");
        setDateFrom(today());
        setDateTo(today());
        setBillingMonth(month);
        setNote("");
        setSplitMode("equal");
        setSelected(new Set(boarders.map((u) => u.id)));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hostelId, month]);

  const toggleMember = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(selected.size === boarders.length ? new Set() : new Set(boarders.map((u) => u.id)));
  };

  const submit = async () => {
    if (!hostelId || !amount || selected.size === 0 || dateFrom > dateTo || !billingMonth) return;
    await repo.expenses.add({
      hostelId,
      category,
      amount: Number(amount),
      dateFrom,
      dateTo,
      note,
      memberIds: [...selected],
      splitMode,
      billingMonth,
    });
    toast("Expense recorded");
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Record expense">
      <div className="mb-2 text-[10.5px] font-extrabold text-text-secondary">CATEGORY</div>
      <div className="mb-4 grid grid-cols-3 gap-2">
        {CATEGORIES.map((c) => (
          <button key={c} type="button" onClick={() => setCategory(c)}>
            <Chip tone="primary" active={category === c} className="w-full justify-center">
              {c}
            </Chip>
          </button>
        ))}
      </div>

      <div className="mb-2 text-[10.5px] font-extrabold text-text-secondary">BILL IN MONTH</div>
      <input
        type="month"
        value={billingMonth}
        onChange={(e) => setBillingMonth(e.target.value)}
        className="mb-1 w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
      />
      <div className="mb-4 text-[10px] font-semibold text-text-secondary">
        This is the month this expense shows up on the finance page and gets charged in — pick a later
        month if the bill arrived late.
      </div>

      <div className="mb-2 text-[10.5px] font-extrabold text-text-secondary">SERVICE PERIOD</div>
      <div className="mb-1 flex gap-3">
        <label className="min-w-0 flex-1">
          <div className="mb-1.5 text-[9.5px] font-bold text-text-secondary">FROM</div>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
          />
        </label>
        <label className="min-w-0 flex-1">
          <div className="mb-1.5 text-[9.5px] font-bold text-text-secondary">TO</div>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
          />
        </label>
      </div>
      <div className="mb-4 text-[10px] font-semibold text-text-secondary">
        The actual usage dates this bill covers — shown to members for transparency, even if it&rsquo;s
        charged in a different month above.
      </div>

      <div className="mb-2 text-[10.5px] font-extrabold text-text-secondary">SPLIT</div>
      <SegmentedControl
        value={splitMode}
        onChange={setSplitMode}
        className="mb-1"
        options={[
          { value: "equal", label: "Equal split" },
          { value: "fixed", label: "Fixed per person" },
        ]}
      />
      <div className="mb-4 text-[10px] font-semibold text-text-secondary">
        {splitMode === "equal"
          ? "The amount below is the TOTAL, divided equally across selected members."
          : "The amount below is charged to EACH selected member."}
      </div>

      <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">
        {splitMode === "equal" ? "TOTAL AMOUNT" : "AMOUNT PER PERSON"}
      </div>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="mb-4 w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
      />

      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10.5px] font-extrabold text-text-secondary">
          MEMBERS ({selected.size}/{boarders.length})
        </div>
        <button type="button" onClick={selectAll} className="text-[11px] font-extrabold text-primary">
          {selected.size === boarders.length ? "Deselect all" : "Select all"}
        </button>
      </div>
      <div className="mb-4 flex flex-col gap-2">
        {boarders.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => toggleMember(u.id)}
            className="flex items-center justify-between rounded-btn bg-bg px-3 py-2.5"
          >
            <div className="text-[12px] font-bold">{u.name}</div>
            <Chip tone="primary" active={selected.has(u.id)}>
              {selected.has(u.id) ? "Selected" : "Select"}
            </Chip>
          </button>
        ))}
      </div>

      <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">NOTES</div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="mb-4 h-16 w-full resize-none rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-semibold"
      />
      <Button
        fullWidth
        onClick={submit}
        disabled={!amount || selected.size === 0 || dateFrom > dateTo || !billingMonth}
      >
        Save expense
      </Button>
    </Sheet>
  );
}

"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { repo } from "@/lib/data";
import { today } from "@/lib/utils/date";

const CATEGORIES = ["Grocery", "Utilities", "Salary", "Others"];

export function AddExpenseSheet({
  open,
  onClose,
  hostelId,
}: {
  open: boolean;
  onClose: () => void;
  hostelId: string | undefined;
}) {
  const { toast } = useToast();
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");

  const submit = async () => {
    if (!hostelId || !amount) return;
    await repo.expenses.add({ hostelId, category, amount: Number(amount), date, note });
    toast("Expense recorded");
    setAmount("");
    setNote("");
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Record expense">
      <div className="mb-2 text-[10.5px] font-extrabold text-text-secondary">CATEGORY</div>
      <div className="mb-4 grid grid-cols-4 gap-2">
        {CATEGORIES.map((c) => (
          <button key={c} type="button" onClick={() => setCategory(c)}>
            <Chip tone="primary" active={category === c} className="w-full justify-center">
              {c}
            </Chip>
          </button>
        ))}
      </div>
      <div className="mb-4 flex gap-3">
        <label className="min-w-0 flex-1">
          <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">AMOUNT</div>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
          />
        </label>
        <label className="min-w-0 flex-1">
          <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">DATE</div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
          />
        </label>
      </div>
      <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">NOTES</div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="mb-4 h-16 w-full resize-none rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-semibold"
      />
      <Button fullWidth onClick={submit} disabled={!amount}>
        Save expense
      </Button>
    </Sheet>
  );
}

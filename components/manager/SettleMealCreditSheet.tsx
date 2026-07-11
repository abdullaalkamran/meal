"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { repo, type Bill, type BillTarget } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";

const TARGET_LABEL: Record<BillTarget, string> = {
  previousBalance: "Previous balance",
  mealCost: "Meal cost",
  roomRent: "Room rent",
  serviceCharge: "Service charge",
  cookSalary: "Cook salary",
};

export function SettleMealCreditSheet({
  open,
  onClose,
  bill,
  memberName,
  onSettled,
}: {
  open: boolean;
  onClose: () => void;
  bill: Bill | undefined;
  memberName: string;
  onSettled: () => void;
}) {
  const { toast } = useToast();
  const meal = bill?.sections.find((s) => s.label === "mealCost");
  const credit = meal ? meal.paid - meal.total : 0;

  // Only offer categories that actually still have something due on this
  // bill — no point "adjusting" meal credit toward rent that's already paid.
  const adjustOptions: { destination: BillTarget; due: number }[] = bill
    ? [
        ...(bill.previousBalance - bill.previousBalancePaid > 0
          ? [{ destination: "previousBalance" as const, due: bill.previousBalance - bill.previousBalancePaid }]
          : []),
        ...bill.sections
          .filter((s) => s.label !== "mealCost" && s.total - s.paid > 0)
          .map((s) => ({ destination: s.label, due: s.total - s.paid })),
      ]
    : [];

  const [destination, setDestination] = useState<BillTarget | "refund">("refund");
  const [amount, setAmount] = useState("0");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        setDestination("refund");
        setAmount(String(Math.max(credit, 0)));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bill?.id]);

  const selectDestination = (d: BillTarget | "refund") => {
    setDestination(d);
    if (d === "refund") {
      setAmount(String(Math.max(credit, 0)));
    } else {
      const opt = adjustOptions.find((o) => o.destination === d);
      setAmount(String(Math.max(Math.min(credit, opt?.due ?? 0), 0)));
    }
  };

  const submit = async () => {
    if (!bill || !amount || Number(amount) <= 0) return;
    setSubmitting(true);
    await repo.bills.settleMealCredit(bill.id, Number(amount), destination);
    setSubmitting(false);
    toast(
      destination === "refund"
        ? `Refunded ${formatBDT(Number(amount))} to ${memberName}`
        : `Adjusted ${formatBDT(Number(amount))} of meal credit to ${TARGET_LABEL[destination]}`
    );
    onSettled();
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Settle meal credit">
      <div className="mb-4 rounded-btn bg-bg px-3 py-2.5">
        <div className="text-[11px] font-semibold text-text-secondary">{memberName}&rsquo;s meal credit</div>
        <div className="text-[16px] font-extrabold text-primary">{formatBDT(Math.max(credit, 0))}</div>
      </div>

      <div className="mb-2 text-[10.5px] font-extrabold text-text-secondary">HOW TO SETTLE</div>
      <div className="mb-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => selectDestination("refund")}
          className="flex items-center justify-between rounded-btn bg-bg px-3 py-2.5"
        >
          <div className="text-left">
            <div className="text-[12px] font-bold">Refund in cash</div>
            <div className="text-[9.5px] font-semibold text-text-secondary">Pay it back to the member</div>
          </div>
          <Chip tone="primary" active={destination === "refund"}>
            {destination === "refund" ? "Selected" : "Select"}
          </Chip>
        </button>
        {adjustOptions.map((o) => (
          <button
            key={o.destination}
            type="button"
            onClick={() => selectDestination(o.destination)}
            className="flex items-center justify-between rounded-btn bg-bg px-3 py-2.5"
          >
            <div className="text-left">
              <div className="text-[12px] font-bold">Adjust to {TARGET_LABEL[o.destination]}</div>
              <div className="text-[9.5px] font-semibold text-text-secondary">Due {formatBDT(o.due)}</div>
            </div>
            <Chip tone="primary" active={destination === o.destination}>
              {destination === o.destination ? "Selected" : "Select"}
            </Chip>
          </button>
        ))}
        {adjustOptions.length === 0 && (
          <div className="rounded-btn bg-bg px-3 py-2.5 text-[10.5px] font-semibold text-text-secondary">
            No other category is due on this bill right now — only refund is available.
          </div>
        )}
      </div>

      <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">AMOUNT</div>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="mb-4 w-full rounded-btn border border-primary px-3 py-3 text-[16.5px] font-extrabold"
      />

      <Button fullWidth onClick={submit} disabled={submitting || !amount || Number(amount) <= 0}>
        {destination === "refund" ? "Refund" : "Adjust"} · {formatBDT(Number(amount) || 0)}
      </Button>
    </Sheet>
  );
}

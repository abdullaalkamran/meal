"use client";

import { useEffect, useMemo, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { repo, type Bill, type BillTarget, type Payment } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";
import { generatePaymentReference } from "@/lib/utils/paymentReference";

const METHODS: Payment["method"][] = ["bKash", "Nagad", "Card", "Cash"];

const SENDER_LABEL: Record<Payment["method"], string> = {
  bKash: "Your bKash number",
  Nagad: "Your Nagad number",
  Card: "Account / card number used",
  Cash: "",
};

const TARGET_LABEL: Record<BillTarget, string> = {
  previousBalance: "Previous balance",
  mealCost: "Meal cost",
  roomRent: "Room rent",
  serviceCharge: "Service charge",
  cookSalary: "Cook salary",
};

export function PayBillSheet({
  open,
  onClose,
  bill,
}: {
  open: boolean;
  onClose: () => void;
  bill: Bill | undefined;
}) {
  const { toast } = useToast();

  // Meal cost, room rent, service charge, and cook salary are billed for
  // different reasons — letting a member pick any combination of them (not
  // just one at a time, or literally everything) means a category they've
  // overpaid (e.g. meal cost, if their shopping-duty spend ran over their
  // share) can stay untouched as its own credit while they settle the rest.
  const rows = useMemo(() => {
    if (!bill) return [];
    const list: { target: BillTarget; due: number }[] = [];
    if (bill.previousBalance > 0) {
      list.push({ target: "previousBalance", due: bill.previousBalance - bill.previousBalancePaid });
    }
    for (const s of bill.sections) {
      list.push({ target: s.label, due: s.total - s.paid });
    }
    return list;
  }, [bill]);

  const [selected, setSelected] = useState<Set<BillTarget>>(new Set());
  const [amount, setAmount] = useState("0");
  const [method, setMethod] = useState<Payment["method"]>("bKash");
  const [senderNumber, setSenderNumber] = useState("");
  const requiresSender = method !== "Cash";

  const dueOfSelected = (targets: Set<BillTarget>) =>
    rows.filter((r) => targets.has(r.target)).reduce((sum, r) => sum + r.due, 0);

  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        // Default to whatever's actually due, not every row — selecting
        // "all" indiscriminately (including a row that's in credit) can sum
        // to zero or negative when one category's credit outweighs another's
        // due, which silently produced a ৳0 amount and a disabled submit
        // button even though the member clearly still owed money overall.
        const dueOnly = new Set(rows.filter((r) => r.due > 0).map((r) => r.target));
        const preselect = dueOnly.size > 0 ? dueOnly : new Set(rows.map((r) => r.target));
        setSelected(preselect);
        setAmount(String(Math.max(dueOfSelected(preselect), 0)));
        setSenderNumber("");
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bill?.id]);

  const toggleTarget = (t: BillTarget) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      setAmount(String(Math.max(dueOfSelected(next), 0)));
      return next;
    });
  };

  const selectAll = () => {
    const next = selected.size === rows.length ? new Set<BillTarget>() : new Set(rows.map((r) => r.target));
    setSelected(next);
    setAmount(String(Math.max(dueOfSelected(next), 0)));
  };

  const submit = async () => {
    if (!bill || !amount || selected.size === 0) return;
    if (requiresSender && !senderNumber.trim()) return;
    await repo.bills.pay({
      billId: bill.id,
      amount: Number(amount),
      paidAt: new Date().toISOString(),
      method,
      reference: generatePaymentReference(method),
      senderNumber: requiresSender ? senderNumber.trim() : undefined,
      verified: false,
      targets: [...selected],
    });
    toast("Payment submitted — pending verification");
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Pay bill">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10.5px] font-extrabold text-text-secondary">
          WHAT TO PAY ({selected.size}/{rows.length})
        </div>
        <button type="button" onClick={selectAll} className="text-[11px] font-extrabold text-primary">
          {selected.size === rows.length ? "Deselect all" : "Select all"}
        </button>
      </div>
      <div className="mb-4 flex flex-col gap-2">
        {rows.map(({ target: t, due: d }) => (
          <button
            key={t}
            type="button"
            onClick={() => toggleTarget(t)}
            className="flex items-center justify-between rounded-btn bg-bg px-3 py-2.5"
          >
            <div className="text-[12px] font-bold">{TARGET_LABEL[t]}</div>
            <div className="flex items-center gap-2">
              <div className={`text-[11px] font-extrabold ${d < 0 ? "text-primary" : "text-text-secondary"}`}>
                {d < 0 ? `Credit ${formatBDT(-d)}` : `Due ${formatBDT(d)}`}
              </div>
              <Chip tone="primary" active={selected.has(t)}>
                {selected.has(t) ? "Selected" : "Select"}
              </Chip>
            </div>
          </button>
        ))}
      </div>

      <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">AMOUNT</div>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="mb-4 w-full rounded-btn border border-primary px-3 py-3 text-[16.5px] font-extrabold"
      />
      <div className="mb-2 text-[10.5px] font-extrabold text-text-secondary">METHOD</div>
      <div className="mb-4 grid grid-cols-4 gap-2">
        {METHODS.map((m) => (
          <button key={m} type="button" onClick={() => setMethod(m)}>
            <Chip tone="primary" active={method === m} className="w-full justify-center">
              {m}
            </Chip>
          </button>
        ))}
      </div>
      {requiresSender && (
        <>
          <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">
            {SENDER_LABEL[method].toUpperCase()}
          </div>
          <input
            type="text"
            value={senderNumber}
            onChange={(e) => setSenderNumber(e.target.value)}
            placeholder={method === "Card" ? "e.g. Account ending 4821" : "e.g. 01711-000000"}
            className="mb-4 w-full rounded-btn border border-border px-3 py-2.5 text-[12px] font-bold"
          />
        </>
      )}
      <Button
        fullWidth
        onClick={submit}
        disabled={
          !amount || Number(amount) <= 0 || selected.size === 0 || (requiresSender && !senderNumber.trim())
        }
      >
        Pay now · {formatBDT(Number(amount) || 0)}
      </Button>
      <div className="mt-3 text-center text-[10px] font-semibold text-text-secondary">
        Partial payment allowed · Verified manually by the manager
      </div>
    </Sheet>
  );
}

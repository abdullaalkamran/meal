"use client";

import { useEffect, useMemo, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { repo, type Bill, type BillTarget, type Payment } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";
import { generatePaymentReference } from "@/lib/utils/paymentReference";

const METHODS: Payment["method"][] = ["Cash", "bKash", "Nagad", "Card"];

const SENDER_LABEL: Record<Payment["method"], string> = {
  bKash: "Their bKash number",
  Nagad: "Their Nagad number",
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

/** Manager logs a payment a member handed over OUTSIDE the app — cash, or a
 * bKash/bank transfer confirmed by phone — so it's not left untracked just
 * because it didn't go through Pay bill. Applies immediately, no separate
 * verification step (the manager recording it IS the verification), unlike
 * a member's own PayBillSheet submission. */
export function RecordPaymentSheet({
  open,
  onClose,
  bill,
  memberName,
}: {
  open: boolean;
  onClose: () => void;
  bill: Bill | undefined;
  memberName?: string;
}) {
  const { toast } = useToast();

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
  const [method, setMethod] = useState<Payment["method"]>("Cash");
  const [senderNumber, setSenderNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const requiresSender = method !== "Cash";

  const dueOfSelected = (targets: Set<BillTarget>) =>
    rows.filter((r) => targets.has(r.target)).reduce((sum, r) => sum + r.due, 0);

  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        const dueOnly = new Set(rows.filter((r) => r.due > 0).map((r) => r.target));
        const preselect = dueOnly.size > 0 ? dueOnly : new Set(rows.map((r) => r.target));
        setSelected(preselect);
        setAmount(String(Math.max(dueOfSelected(preselect), 0)));
        setMethod("Cash");
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
    if (!bill || !amount || selected.size === 0 || saving) return;
    if (requiresSender && !senderNumber.trim()) return;
    setSaving(true);
    try {
      await repo.bills.recordPayment({
        billId: bill.id,
        amount: Number(amount),
        paidAt: new Date().toISOString(),
        method,
        reference: generatePaymentReference(method),
        senderNumber: requiresSender ? senderNumber.trim() : undefined,
        targets: [...selected],
      });
      toast(`${formatBDT(Number(amount))} recorded`);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={memberName ? `Record payment · ${memberName}` : "Record payment"}>
      <div className="mb-3 rounded-btn bg-primary-soft px-3 py-2.5 text-[10.5px] font-semibold text-primary">
        For a payment received outside the app — applies immediately, no separate verification step.
      </div>

      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10.5px] font-extrabold text-text-secondary">
          WHAT IT COVERS ({selected.size}/{rows.length})
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

      <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">AMOUNT RECEIVED</div>
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
            {SENDER_LABEL[method].toUpperCase()} <span className="font-semibold normal-case">· optional</span>
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
        disabled={saving || !amount || Number(amount) <= 0 || selected.size === 0}
      >
        {saving ? "Recording…" : `Record ${formatBDT(Number(amount) || 0)}`}
      </Button>
    </Sheet>
  );
}

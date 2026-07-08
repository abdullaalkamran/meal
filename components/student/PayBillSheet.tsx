"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { repo, type Bill, type Payment } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";
import { generatePaymentReference } from "@/lib/utils/paymentReference";

const METHODS: Payment["method"][] = ["bKash", "Nagad", "Card", "Cash"];

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
  const due = bill ? bill.grandTotal - bill.paid : 0;
  const [amount, setAmount] = useState(String(due));
  const [method, setMethod] = useState<Payment["method"]>("bKash");

  useEffect(() => {
    if (open) queueMicrotask(() => setAmount(String(due)));
  }, [open, due]);

  const submit = async () => {
    if (!bill || !amount) return;
    await repo.bills.pay({
      billId: bill.id,
      amount: Number(amount),
      paidAt: new Date().toISOString(),
      method,
      reference: generatePaymentReference(method),
      verified: false,
    });
    toast("Payment submitted — pending verification");
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Pay bill">
      <div className="mb-4 text-[11px] font-semibold text-text-secondary">
        Outstanding: {formatBDT(due)}
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
      <Button fullWidth onClick={submit} disabled={!amount || Number(amount) <= 0}>
        Pay now · {formatBDT(Number(amount) || 0)}
      </Button>
      <div className="mt-3 text-center text-[10px] font-semibold text-text-secondary">
        Partial payment allowed · Verified manually by the manager
      </div>
    </Sheet>
  );
}

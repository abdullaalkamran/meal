"use client";

import { useEffect, useState } from "react";
import { repo, type Bill, type Payment } from "@/lib/data";

export function useBill(
  hostelId: string | undefined,
  userId: string | undefined,
  month: string | undefined
) {
  const [bill, setBill] = useState<Bill | undefined>(undefined);
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    if (!hostelId || !userId || !month) return;
    let cancelled = false;
    const load = () =>
      repo.bills.getBill(hostelId, userId, month).then((b) => {
        if (cancelled) return;
        setBill(b);
        if (b) repo.bills.listPayments(b.id).then((p) => !cancelled && setPayments(p));
      });
    load();
    const unsub = repo.bills.subscribe(userId, load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [hostelId, userId, month]);

  return { bill, payments };
}

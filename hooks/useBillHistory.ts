"use client";

import { useEffect, useState } from "react";
import { repo, type Bill } from "@/lib/data";

/** Every bill a member has ever had at this hostel, newest first — the
 * at-a-glance month-by-month billing history. */
export function useBillHistory(hostelId: string | undefined, userId: string | undefined) {
  const [bills, setBills] = useState<Bill[]>([]);

  useEffect(() => {
    if (!hostelId || !userId) return;
    let cancelled = false;
    const load = () =>
      repo.bills.listByUser(hostelId, userId).then((list) => {
        if (!cancelled) setBills(list);
      });
    load();
    const unsub = repo.bills.subscribe(userId, load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [hostelId, userId]);

  return bills;
}

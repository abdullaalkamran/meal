"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { repo } from "@/lib/data";
import { addDays, currentMonth, today } from "@/lib/utils/date";

const inputClass = "w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold";
const labelClass = "mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary";

const yesterday = () => addDays(today(), -1);

/** Confirms every offered, not-yet-decided meal in a date range as cooked in
 * one action — for catching up a backlog instead of tapping through each day
 * one meal at a time. Capped at yesterday: today's meals stay on the normal
 * per-meal flow since they may not have happened yet. */
export function BulkConfirmCookedSheet({
  open,
  onClose,
  hostelId,
  onConfirmed,
}: {
  open: boolean;
  onClose: () => void;
  hostelId: string | undefined;
  onConfirmed: (count: number) => void;
}) {
  const [from, setFrom] = useState(`${currentMonth()}-01`);
  const [to, setTo] = useState(yesterday());
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setFrom(`${currentMonth()}-01`);
      setTo(yesterday());
    });
  }, [open]);

  const valid = !!hostelId && from <= to;

  const submit = async () => {
    if (!valid || confirming) return;
    setConfirming(true);
    try {
      const { confirmed } = await repo.cookAttendance.markCookedRange(hostelId!, from, to);
      onConfirmed(confirmed);
      onClose();
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Confirm cooking in bulk">
      <div className="mb-4 rounded-btn bg-bg px-3 py-2.5 text-[10px] font-semibold text-text-secondary">
        Marks every offered meal in this range as cooked — so it counts toward the cooking
        count, the meal rate, and bills. Never touches a day you&rsquo;ve already confirmed,
        marked the cook absent, or that&rsquo;s still under dispute.
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <div>
          <div className={labelClass}>From</div>
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <div className={labelClass}>To</div>
          <input
            type="date"
            value={to}
            min={from}
            max={yesterday()}
            onChange={(e) => setTo(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>
      <Button fullWidth onClick={submit} disabled={!valid || confirming}>
        {confirming ? "Confirming…" : "Confirm all cooked"}
      </Button>
    </Sheet>
  );
}

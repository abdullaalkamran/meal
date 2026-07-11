"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { repo } from "@/lib/data";
import { formatShortDate } from "@/lib/utils/date";

export function RequestMealEditSheet({
  open,
  onClose,
  hostelId,
  managerId,
  targetUserId,
  targetUserName,
  date,
}: {
  open: boolean;
  onClose: () => void;
  hostelId: string | undefined;
  managerId: string | undefined;
  targetUserId: string | undefined;
  targetUserName: string;
  date: string;
}) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) queueMicrotask(() => setReason(""));
  }, [open]);

  const submit = async () => {
    if (!hostelId || !managerId || !targetUserId || !reason.trim()) return;
    await repo.mealEdits.request({
      hostelId,
      targetUserId,
      date,
      reason: reason.trim(),
      requestedBy: managerId,
    });
    toast("Edit request sent to all members for a vote");
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Request meal edit">
      <div className="mb-4 text-[11px] font-semibold text-text-secondary">
        This sends a vote to every member. If at least half approve, you&rsquo;ll be able to manually
        edit <strong className="text-text">{targetUserName}</strong>&rsquo;s meal for{" "}
        <strong className="text-text">{formatShortDate(date)}</strong>.
      </div>
      <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">REASON</div>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. Toggled off by mistake before the cutoff"
        className="mb-4 h-20 w-full resize-none rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-semibold"
      />
      <Button fullWidth onClick={submit} disabled={!reason.trim()}>
        Send request to all members
      </Button>
    </Sheet>
  );
}

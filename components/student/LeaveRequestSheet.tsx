"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useLeaveRequests } from "@/hooks/useLeaveRequests";
import { repo } from "@/lib/data";
import { addDays, formatShortDate, today } from "@/lib/utils/date";

// Leave requests need at least this much notice — matches the server-side
// check in both backends (lib/data/mock/mockRepositories.ts,
// lib/data/server/mysql/requests.ts).
const MIN_LEAVE_NOTICE_DAYS = 30;

/** A member's formal notice to leave the hostel for good. Unlike a meal
 * request, this can't be resubmitted while one is pending/approved — it
 * shows that request's status instead, with a way to withdraw a still-
 * pending one. Approving it doesn't remove the member immediately: they're
 * auto-banned once the leave date itself arrives, and their advance rent can
 * only be credited to their final bill after approval (see MemberDetailScreen
 * and GenerateBillsSheet). */
export function LeaveRequestSheet({
  open,
  onClose,
  hostelId,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  hostelId: string | undefined;
  userId: string | undefined;
}) {
  const { toast } = useToast();
  const myRequests = useLeaveRequests(hostelId).filter((r) => r.userId === userId);
  const active = myRequests.find((r) => r.status === "pending" || r.status === "approved");
  const minDate = addDays(today(), MIN_LEAVE_NOTICE_DAYS);
  const [leaveDate, setLeaveDate] = useState(minDate);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const submit = async () => {
    if (!hostelId || !userId || leaveDate < minDate || submitting) return;
    setSubmitting(true);
    try {
      await repo.leaveRequests.request({ hostelId, userId, leaveDate, reason: reason.trim() || undefined });
      toast("Leave request sent — the manager will review it");
      setReason("");
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not send the leave request.");
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async () => {
    if (!active || cancelling) return;
    setCancelling(true);
    try {
      await repo.leaveRequests.cancel(active.id);
      toast("Leave request withdrawn");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Leave hostel">
      {active ? (
        <>
          <div className="mb-4 rounded-btn bg-bg px-3 py-2.5">
            <div className="mb-1 flex items-center justify-between">
              <div className="text-[12px] font-extrabold">Leaving on {formatShortDate(active.leaveDate)}</div>
              <Chip tone={active.status === "approved" ? "primary" : "orange"} active>
                {active.status === "approved" ? "Approved" : "Pending"}
              </Chip>
            </div>
            {active.reason && (
              <div className="text-[10.5px] font-semibold italic text-text-secondary">
                &ldquo;{active.reason}&rdquo;
              </div>
            )}
            <div className="mt-1.5 text-[9.5px] font-semibold text-text-secondary">
              {active.status === "approved"
                ? "You'll be marked as left once this date arrives. Your advance rent (if any) is credited to your final bill."
                : "Waiting for the manager to review this request."}
            </div>
          </div>
          {active.status === "pending" && (
            <Button fullWidth variant="secondary" onClick={cancel} disabled={cancelling}>
              {cancelling ? "Withdrawing…" : "Withdraw request"}
            </Button>
          )}
        </>
      ) : (
        <>
          <div className="mb-4 text-[11px] font-semibold text-text-secondary">
            {`Give at least ${MIN_LEAVE_NOTICE_DAYS} days’ notice. Your manager/owner will review this before you’re marked as left.`}
          </div>

          <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
            Leave date
          </div>
          <input
            type="date"
            value={leaveDate}
            min={minDate}
            onChange={(e) => setLeaveDate(e.target.value)}
            className="mb-1 w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
          />
          <div className="mb-4 text-[9.5px] font-semibold text-text-secondary">
            Earliest allowed: {formatShortDate(minDate)}
          </div>

          <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">REASON (OPTIONAL)</div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Graduating, moving out, changing hostels…"
            className="mb-4 h-20 w-full resize-none rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-semibold"
          />

          <Button fullWidth onClick={submit} disabled={leaveDate < minDate || submitting}>
            {submitting ? "Sending…" : "Send leave request"}
          </Button>
        </>
      )}
    </Sheet>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { repo, type ShoppingCost } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";

/**
 * Manager deletes a recorded shopping cost outright — a duplicate, wrong
 * member, or other mistake. Takes effect immediately (no vote, unlike
 * proposing an amount change), but requires a reason: every boarder is
 * notified with it, and it's logged to the shopping activity feed.
 */
export function DeleteShoppingCostSheet({
  open,
  onClose,
  cost,
  memberName,
}: {
  open: boolean;
  onClose: () => void;
  cost: ShoppingCost | undefined;
  memberName: string;
}) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        setReason("");
        setBusy(false);
      });
    }
  }, [open]);

  const canSubmit = !!cost && reason.trim().length > 0 && !busy;

  const submit = async () => {
    if (!canSubmit || !cost) return;
    setBusy(true);
    try {
      await repo.shoppingCosts.delete(cost.id, reason.trim());
      toast("Shopping cost deleted");
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Delete shopping cost">
      <div className="mb-3 rounded-btn bg-danger-soft px-3 py-2.5 text-[10.5px] font-semibold text-danger">
        This removes the cost right away and can&rsquo;t be undone. Every boarder is notified, along
        with the reason you give below.
      </div>

      <div className="mb-4 rounded-btn bg-bg px-3 py-2.5">
        <div className="text-[10px] font-bold text-text-secondary">DELETING</div>
        <div className="text-[12.5px] font-extrabold">{memberName}</div>
        <div className="text-[10.5px] font-semibold text-text-secondary">
          {cost ? formatBDT(cost.amount) : "—"}
          {cost?.items ? ` · ${cost.items}` : ""}
          {cost?.dates[0] ? ` · ${cost.dates[0]}` : ""}
        </div>
      </div>

      <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">
        REASON FOR DELETING
      </div>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. Duplicate entry, wrong member selected"
        className="mb-4 h-16 w-full resize-none rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-semibold"
      />

      <Button fullWidth variant="danger" onClick={submit} disabled={!canSubmit}>
        {busy ? "Deleting…" : "Delete shopping cost"}
      </Button>
    </Sheet>
  );
}

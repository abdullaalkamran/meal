"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { repo, type ShoppingCost } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";

/**
 * Manager proposes a change to a member's recorded shopping cost. It doesn't
 * apply immediately — it opens a hostel-wide vote (same 50%-of-boarders gate
 * as meal edits), and the amount/items change only once members approve.
 */
export function EditShoppingCostSheet({
  open,
  onClose,
  hostelId,
  requestedBy,
  cost,
  memberName,
}: {
  open: boolean;
  onClose: () => void;
  hostelId: string | undefined;
  /** The manager making the request (for the audit trail). */
  requestedBy: string | undefined;
  cost: ShoppingCost | undefined;
  memberName: string;
}) {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [items, setItems] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && cost) {
      queueMicrotask(() => {
        setAmount(String(cost.amount));
        setItems(cost.items ?? "");
        setReason("");
        setBusy(false);
      });
    }
  }, [open, cost]);

  const changed = !!cost && (Number(amount) !== cost.amount || items !== (cost.items ?? ""));
  const canSubmit =
    !!hostelId && !!cost && !!requestedBy && !!amount && Number(amount) > 0 && changed && !busy;

  const submit = async () => {
    if (!canSubmit || !cost) return;
    setBusy(true);
    try {
      await repo.shoppingCostEdits.request({
        hostelId: hostelId!,
        costId: cost.id,
        targetUserId: cost.userId,
        currentAmount: cost.amount,
        newAmount: Number(amount),
        newItems: items,
        reason,
        requestedBy: requestedBy!,
      });
      toast("Change sent to members for a vote");
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Propose a shopping cost change">
      <div className="mb-3 rounded-btn bg-orange-soft px-3 py-2.5 text-[10.5px] font-semibold text-orange">
        This doesn&rsquo;t change the cost right away. Members vote, and it only takes effect once at
        least half of them approve — so no one&rsquo;s meal rate moves without the hostel&rsquo;s say-so.
      </div>

      <div className="mb-4 rounded-btn bg-bg px-3 py-2.5">
        <div className="text-[10px] font-bold text-text-secondary">EDITING</div>
        <div className="text-[12.5px] font-extrabold">{memberName}</div>
        <div className="text-[10.5px] font-semibold text-text-secondary">
          Currently {cost ? formatBDT(cost.amount) : "—"}
          {cost?.items ? ` · ${cost.items}` : ""}
        </div>
      </div>

      <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">NEW AMOUNT</div>
      <div className="relative mb-4">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-extrabold text-primary">
          ৳
        </span>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-full rounded-btn border border-border bg-transparent py-2.5 pl-7 pr-3 text-[12px] font-bold"
        />
      </div>

      <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">ITEMS / NOTE</div>
      <textarea
        value={items}
        onChange={(e) => setItems(e.target.value)}
        placeholder="e.g. Rice, oil, vegetables"
        className="mb-4 h-14 w-full resize-none rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-semibold"
      />

      <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">
        REASON FOR THE CHANGE
      </div>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Members see this in the vote — explain why it needs correcting"
        className="mb-4 h-16 w-full resize-none rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-semibold"
      />

      <Button fullWidth onClick={submit} disabled={!canSubmit}>
        {busy ? "Sending…" : "Send to members for a vote"}
      </Button>
      {!changed && !!cost && (
        <div className="mt-2 text-center text-[10px] font-semibold text-text-secondary">
          Change the amount or items to propose an edit.
        </div>
      )}
    </Sheet>
  );
}

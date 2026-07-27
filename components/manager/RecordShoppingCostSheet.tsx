"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useUsers } from "@/hooks/useUsers";
import { repo } from "@/lib/data";
import { today } from "@/lib/utils/date";

/**
 * Manager records a shopping cost on a member's behalf — for when the manager
 * (or cook) did the shopping instead of the duty member, or a member couldn't
 * submit it themselves. It counts as the selected member's shopping cost,
 * is approved on entry, and is flagged so every member can see the manager
 * entered it (not the member).
 */
export function RecordShoppingCostSheet({
  open,
  onClose,
  hostelId,
}: {
  open: boolean;
  onClose: () => void;
  hostelId: string | undefined;
}) {
  const { toast } = useToast();
  const boarders = useUsers(hostelId).filter((u) => u.role !== "cook" && u.role !== "owner");
  const [userId, setUserId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [items, setItems] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        setUserId("");
        setAmount("");
        setDate(today());
        setItems("");
        setBusy(false);
      });
    }
  }, [open, hostelId]);

  const canSubmit = !!hostelId && !!userId && !!amount && Number(amount) > 0 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await repo.shoppingCosts.recordForMember({
        hostelId: hostelId!,
        userId,
        dates: [date],
        amount: Number(amount),
        items,
      });
      const name = boarders.find((u) => u.id === userId)?.name ?? "the member";
      toast(`Recorded as ${name}'s shopping cost`);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Record shopping cost">
      <div className="mb-3 rounded-btn bg-primary-soft px-3 py-2.5 text-[10.5px] font-semibold text-primary">
        This counts as the selected member&rsquo;s shopping cost toward this month&rsquo;s meal rate.
        Everyone will see it was recorded by you (the manager) on their behalf.
      </div>

      <div className="mb-2 text-[10.5px] font-extrabold text-text-secondary">
        WHOSE COST IS THIS?
      </div>
      <div className="mb-4 flex flex-col gap-2">
        {boarders.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => setUserId(u.id)}
            className="flex items-center justify-between rounded-btn bg-bg px-3 py-2.5"
          >
            <div className="text-[12px] font-bold">{u.name}</div>
            <Chip tone="primary" active={userId === u.id}>
              {userId === u.id ? "Selected" : "Select"}
            </Chip>
          </button>
        ))}
        {boarders.length === 0 && (
          <div className="text-[11px] font-semibold text-text-secondary">No members yet.</div>
        )}
      </div>

      <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">AMOUNT SPENT</div>
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

      <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">SHOPPING DATE</div>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="mb-4 w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
      />

      <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">
        ITEMS / NOTE (OPTIONAL)
      </div>
      <textarea
        value={items}
        onChange={(e) => setItems(e.target.value)}
        placeholder="e.g. Rice, oil, vegetables"
        className="mb-4 h-16 w-full resize-none rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-semibold"
      />

      <Button fullWidth onClick={submit} disabled={!canSubmit}>
        {busy ? "Recording…" : "Record cost"}
      </Button>
    </Sheet>
  );
}

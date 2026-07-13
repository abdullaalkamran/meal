"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { repo } from "@/lib/data";
import { today } from "@/lib/utils/date";

export function CampaignSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("");
  const [budget, setBudget] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        setName("");
        setChannel("");
        setBudget("");
        setNote("");
      });
    }
  }, [open]);

  const submit = async () => {
    if (!name.trim() || !channel.trim()) return;
    await repo.campaigns.create({
      name: name.trim(),
      channel: channel.trim(),
      status: "planned",
      startDate: today(),
      budget: Number(budget) || 0,
      note: note.trim() || undefined,
    });
    toast("Campaign created");
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="New campaign">
      <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">NAME</div>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Winter signup drive"
        className="mb-3 w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
      />
      <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">CHANNEL</div>
      <input
        type="text"
        value={channel}
        onChange={(e) => setChannel(e.target.value)}
        placeholder="e.g. Facebook + SMS"
        className="mb-3 w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
      />
      <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">BUDGET (৳)</div>
      <input
        type="number"
        value={budget}
        onChange={(e) => setBudget(e.target.value)}
        placeholder="e.g. 15000"
        className="mb-3 w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
      />
      <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">NOTE (OPTIONAL)</div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="mb-4 h-16 w-full resize-none rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-semibold"
      />
      <Button fullWidth onClick={submit} disabled={!name.trim() || !channel.trim()}>
        Create campaign
      </Button>
    </Sheet>
  );
}

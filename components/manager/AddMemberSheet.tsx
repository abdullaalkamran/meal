"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { repo } from "@/lib/data";

export function AddMemberSheet({
  open,
  onClose,
  hostelId,
}: {
  open: boolean;
  onClose: () => void;
  hostelId: string | undefined;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const submitInvite = async () => {
    if (!hostelId || !name.trim() || !phone.trim()) return;
    await repo.joinRequests.create({ hostelId, name: name.trim(), phone: phone.trim() });
    toast("Join request created — approve it from the requests list");
    setName("");
    setPhone("");
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Add member">
      <Button
        variant="secondary"
        fullWidth
        onClick={() => toast("QR scan — coming in a later build phase")}
      >
        Scan QR code
      </Button>

      <div className="my-4 text-center text-[9.5px] font-bold uppercase tracking-wide text-text-secondary">
        or add manually
      </div>

      <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">NAME</div>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mb-3 w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
      />
      <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">PHONE</div>
      <input
        type="text"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="mb-4 w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
      />
      <Button fullWidth onClick={submitInvite} disabled={!name.trim() || !phone.trim()}>
        Create join request
      </Button>
    </Sheet>
  );
}

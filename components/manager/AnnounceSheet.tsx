"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { repo } from "@/lib/data";

export function AnnounceSheet({
  open,
  onClose,
  hostelId,
}: {
  open: boolean;
  onClose: () => void;
  hostelId: string | undefined;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const submit = async () => {
    if (!hostelId || !title.trim()) return;
    await repo.announcements.post({ hostelId, kind: "general", title: title.trim(), body: body.trim() });
    toast("Announcement posted");
    setTitle("");
    setBody("");
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Post announcement">
      <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">TITLE</div>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Water supply maintenance tomorrow"
        className="mb-4 w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
      />
      <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">DETAILS</div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="mb-4 h-24 w-full resize-none rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-semibold"
      />
      <Button fullWidth onClick={submit} disabled={!title.trim()}>
        Post to all members
      </Button>
    </Sheet>
  );
}

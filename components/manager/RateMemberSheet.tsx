"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { StarRating } from "@/components/ui/StarRating";
import { useToast } from "@/components/ui/Toast";
import { repo, type Stars, type User } from "@/lib/data";

export function RateMemberSheet({
  open,
  onClose,
  member,
}: {
  open: boolean;
  onClose: () => void;
  member: User | undefined;
}) {
  const { toast } = useToast();
  const [stars, setStars] = useState<Stars>(member?.managerRating ?? 5);
  const [note, setNote] = useState(member?.managerRatingNote ?? "");

  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        setStars(member?.managerRating ?? 5);
        setNote(member?.managerRatingNote ?? "");
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, member?.id]);

  const submit = async () => {
    if (!member) return;
    await repo.users.rate(member.id, stars, note.trim() || undefined);
    toast("Rating saved");
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={member ? `Rate ${member.name.split(" ")[0]}` : "Rate member"}>
      <div className="mb-2 text-[10.5px] font-extrabold text-text-secondary">CONDUCT RATING</div>
      <div className="mb-4">
        <StarRating value={stars} onChange={setStars} size={30} />
      </div>
      <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">NOTE (OPTIONAL)</div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. Pays on time, keeps the room tidy"
        className="mb-4 h-20 w-full resize-none rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-semibold"
      />
      <Button fullWidth onClick={submit}>
        Save rating
      </Button>
    </Sheet>
  );
}

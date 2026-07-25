"use client";

import { useEffect, useRef, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { useHostel } from "@/hooks/useHostel";
import { repo } from "@/lib/data";

/** Owner-only rename. Members see the new name everywhere immediately
 * (join screens, bills, notifications) — nothing else about the hostel
 * changes. */
export function EditHostelNameSheet({
  open,
  onClose,
  hostelId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  hostelId: string | null;
  onSaved?: () => void;
}) {
  const hostel = useHostel(hostelId ?? undefined);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const prefilled = useRef(false);
  useEffect(() => {
    if (!open) {
      prefilled.current = false;
      queueMicrotask(() => setError(""));
      return;
    }
    if (!hostel || prefilled.current) return;
    prefilled.current = true;
    queueMicrotask(() => setName(hostel.name));
  }, [open, hostel]);

  if (!hostelId || !hostel) return null;

  const trimmed = name.trim();
  const valid = trimmed.length > 0 && trimmed !== hostel.name;

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    try {
      await repo.hostels.update(hostel.id, { name: trimmed });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename the hostel.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Edit hostel name">
      <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
        Hostel name
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        className="mb-1 w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
      />
      <div className="mb-4 text-[9.5px] font-semibold text-text-secondary">
        Members, bills, and invite links all switch to the new name right away.
      </div>

      {error && (
        <div className="mb-4 rounded-btn bg-danger/10 px-3 py-2.5 text-[10.5px] font-bold text-danger">
          {error}
        </div>
      )}

      <Button fullWidth onClick={save} disabled={!valid || saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </Sheet>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { useHostel } from "@/hooks/useHostel";
import { repo } from "@/lib/data";

/** Owner/manager editor for the hostel's house rules — one rule per line. What
 * they save shows on the hostel detail sheet and the public door-QR page, so
 * prospective boarders see the rules before requesting to join. */
export function EditHostelRulesSheet({
  open,
  onClose,
  hostelId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  hostelId: string | null | undefined;
  onSaved?: () => void;
}) {
  const hostel = useHostel(hostelId ?? undefined);
  const [rules, setRules] = useState("");
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
    queueMicrotask(() => setRules(hostel.rules ?? ""));
  }, [open, hostel]);

  if (!hostelId || !hostel) return null;

  // Normalise to trimmed, non-empty lines so the display renders cleanly and a
  // rules-of-only-whitespace saves as "none".
  const cleaned = rules
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
  const current = hostel.rules ?? "";
  const valid = cleaned !== current;
  const count = cleaned ? cleaned.split("\n").length : 0;

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    try {
      await repo.hostels.update(hostel.id, { rules: cleaned || undefined });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the rules.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Hostel rules">
      <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
        House rules · one per line
      </div>
      <textarea
        value={rules}
        onChange={(e) => setRules(e.target.value)}
        rows={9}
        placeholder={"No smoking inside the rooms\nGuests must leave by 10 PM\nKeep the kitchen clean after use\nPay rent by the 10th of each month"}
        className="w-full resize-y rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-semibold leading-relaxed"
      />
      <div className="mb-4 mt-1 text-[9.5px] font-semibold text-text-secondary">
        {count > 0 ? `${count} rule${count === 1 ? "" : "s"} · ` : ""}Shown on the hostel details page and
        the door-QR page everyone sees when they scan.
      </div>

      {error && (
        <div className="mb-4 rounded-btn bg-danger/10 px-3 py-2.5 text-[10.5px] font-bold text-danger">
          {error}
        </div>
      )}

      <Button fullWidth onClick={save} disabled={!valid || saving}>
        {saving ? "Saving…" : "Save rules"}
      </Button>
    </Sheet>
  );
}

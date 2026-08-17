"use client";

import { useState } from "react";
import { Sheet } from "./Sheet";
import { Button } from "./Button";

/** A "are you sure?" step in front of an action that's hard to walk back —
 * asks once, then runs `onConfirm` and closes itself. */
export function ConfirmSheet({
  open,
  onClose,
  title,
  message,
  confirmLabel = "Confirm",
  tone = "primary",
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: "primary" | "danger";
  onConfirm: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="mb-5 text-[12.5px] font-semibold text-text-secondary">{message}</div>
      <div className="flex gap-2">
        <Button fullWidth variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button fullWidth variant={tone === "danger" ? "danger" : "primary"} onClick={handleConfirm} disabled={busy}>
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}

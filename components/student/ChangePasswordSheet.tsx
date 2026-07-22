"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { changePassword } from "@/lib/auth/session";

const inputClass =
  "w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold";
const labelClass =
  "mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary";

/** Lets the signed-in user change their own password (needs the current one). */
export function ChangePasswordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open)
      queueMicrotask(() => {
        setCurrent("");
        setNext("");
        setConfirm("");
        setError("");
      });
  }, [open]);

  const submit = async () => {
    if (saving) return;
    if (next.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (next !== confirm) {
      setError("The new passwords don't match.");
      return;
    }
    setError("");
    setSaving(true);
    const res = await changePassword(current, next);
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "Could not change password.");
      return;
    }
    toast("Password changed");
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Change password">
      <div className="mb-3">
        <div className={labelClass}>Current password</div>
        <input
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="mb-3">
        <div className={labelClass}>New password</div>
        <input
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="mb-3">
        <div className={labelClass}>Confirm new password</div>
        <input
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className={inputClass}
        />
      </div>
      {error && (
        <div className="mb-3 rounded-btn bg-danger-soft px-3 py-2 text-[10.5px] font-bold text-danger">
          {error}
        </div>
      )}
      <Button fullWidth onClick={submit} disabled={saving}>
        {saving ? "Saving…" : "Change password"}
      </Button>
    </Sheet>
  );
}

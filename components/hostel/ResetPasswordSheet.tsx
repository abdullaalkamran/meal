"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { adminResetPassword } from "@/lib/auth/session";

const inputClass =
  "w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold";

/** A random, readable temporary password an admin can hand to the member. */
function tempPassword(): string {
  return `hostel${Math.floor(1000 + Math.random() * 9000)}`;
}

/** Owner/superadmin resets a member's password when they've forgotten it. The
 * new password is shown so it can be relayed; the member should then change
 * it themselves. */
export function ResetPasswordSheet({
  open,
  onClose,
  userId,
  name,
}: {
  open: boolean;
  onClose: () => void;
  userId: string | undefined;
  name: string;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open)
      queueMicrotask(() => {
        setPassword(tempPassword());
        setError("");
        setDone(false);
      });
  }, [open]);

  const submit = async () => {
    if (saving || !userId) return;
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setError("");
    setSaving(true);
    const res = await adminResetPassword(userId, password);
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "Could not reset the password.");
      return;
    }
    setDone(true);
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Reset password · ${name}`}>
      {done ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-card bg-primary-soft p-3 text-center">
            <div className="text-[10.5px] font-bold text-text-secondary">
              {name}&rsquo;s new password
            </div>
            <div className="mt-1 select-all text-[18px] font-extrabold text-primary">{password}</div>
          </div>
          <div className="text-[10.5px] font-semibold text-text-secondary">
            Share this with {name.split(" ")[0]} privately. Ask them to sign in with it and then
            change it from Profile → Change password.
          </div>
          <Button fullWidth onClick={onClose}>
            Done
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-3 rounded-btn bg-bg px-3 py-2 text-[10px] font-semibold text-text-secondary">
            Set a temporary password for {name} and tell them privately. They can change it
            themselves afterwards.
          </div>
          <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
            New password
          </div>
          <div className="mb-3 flex gap-2">
            <input value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
            <button
              type="button"
              onClick={() => setPassword(tempPassword())}
              className="shrink-0 rounded-btn bg-bg px-3 text-[10.5px] font-extrabold text-primary"
            >
              Generate
            </button>
          </div>
          {error && (
            <div className="mb-3 rounded-btn bg-danger-soft px-3 py-2 text-[10.5px] font-bold text-danger">
              {error}
            </div>
          )}
          <Button fullWidth onClick={submit} disabled={saving}>
            {saving ? "Resetting…" : "Reset password"}
          </Button>
        </>
      )}
    </Sheet>
  );
}

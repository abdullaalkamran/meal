"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { requestPasswordReset, submitPasswordReset } from "@/lib/auth/session";

const inputClass =
  "w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold";
const labelClass =
  "mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary";

/** Two-step forgot-password: enter phone → a code is emailed → enter code +
 * new password. Accounts with no email on file are told to ask their manager
 * or owner (who can reset it directly). */
export function ForgotPasswordSheet({
  open,
  onClose,
  initialPhone,
}: {
  open: boolean;
  onClose: () => void;
  initialPhone?: string;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [info, setInfo] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open)
      queueMicrotask(() => {
        setStep("phone");
        setPhone(initialPhone ?? "");
        setInfo("");
        setCode("");
        setNewPassword("");
        setConfirm("");
        setError("");
      });
  }, [open, initialPhone]);

  const requestCode = async () => {
    if (busy || !phone.trim()) return;
    setBusy(true);
    setError("");
    const res = await requestPasswordReset(phone.trim());
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Could not send a code.");
      return;
    }
    if (res.noEmail) {
      // No email on file — can't self-serve; the admin reset covers this.
      setError(res.message ?? "This account has no email on file.");
      return;
    }
    // In dev (no SMTP), the API returns the code so the flow is testable.
    if (res.devCode) setCode(res.devCode);
    setInfo(res.message ?? "A reset code has been sent.");
    setStep("code");
  };

  const submitReset = async () => {
    if (busy) return;
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setError("The new passwords don't match.");
      return;
    }
    setBusy(true);
    setError("");
    const res = await submitPasswordReset(phone.trim(), code.trim(), newPassword);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Could not reset the password.");
      return;
    }
    toast("Password reset — sign in with your new password");
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Reset password">
      {step === "phone" ? (
        <>
          <div className="mb-3 text-[11px] font-semibold text-text-secondary">
            Enter your phone number and we&rsquo;ll email a reset code to the address on your
            account.
          </div>
          <div className={labelClass}>Phone number</div>
          <input
            value={phone}
            inputMode="tel"
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && requestCode()}
            placeholder="01711-000006"
            className={`${inputClass} mb-3`}
          />
          {error && (
            <div className="mb-3 rounded-btn bg-danger-soft px-3 py-2 text-[10.5px] font-bold text-danger">
              {error}
            </div>
          )}
          <Button fullWidth onClick={requestCode} disabled={busy || !phone.trim()}>
            {busy ? "Sending…" : "Send reset code"}
          </Button>
        </>
      ) : (
        <>
          {info && (
            <div className="mb-3 rounded-btn bg-primary-soft px-3 py-2 text-[10.5px] font-bold text-primary">
              {info}
            </div>
          )}
          <div className={labelClass}>Reset code</div>
          <input
            value={code}
            inputMode="numeric"
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
            className={`${inputClass} mb-3`}
          />
          <div className={labelClass}>New password</div>
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={`${inputClass} mb-3`}
          />
          <div className={labelClass}>Confirm new password</div>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitReset()}
            className={`${inputClass} mb-3`}
          />
          {error && (
            <div className="mb-3 rounded-btn bg-danger-soft px-3 py-2 text-[10.5px] font-bold text-danger">
              {error}
            </div>
          )}
          <Button fullWidth onClick={submitReset} disabled={busy}>
            {busy ? "Saving…" : "Reset password"}
          </Button>
          <button
            type="button"
            onClick={() => setStep("phone")}
            className="mt-2 min-h-10 w-full text-[10.5px] font-extrabold text-text-secondary"
          >
            Use a different number
          </button>
        </>
      )}
    </Sheet>
  );
}

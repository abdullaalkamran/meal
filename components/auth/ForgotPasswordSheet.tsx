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

/** Two-step forgot-password: enter email → a code is emailed → enter code +
 * new password. */
export function ForgotPasswordSheet({
  open,
  onClose,
  initialEmail,
}: {
  open: boolean;
  onClose: () => void;
  initialEmail?: string;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [info, setInfo] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open)
      queueMicrotask(() => {
        setStep("email");
        setEmail(initialEmail ?? "");
        setInfo("");
        setCode("");
        setNewPassword("");
        setConfirm("");
        setError("");
      });
  }, [open, initialEmail]);

  const requestCode = async () => {
    if (busy || !email.trim()) return;
    setBusy(true);
    setError("");
    const res = await requestPasswordReset(email.trim());
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Could not send a code.");
      return;
    }
    if (res.noEmail) {
      // Email isn't set up for the app yet — point them at an admin reset.
      setError(res.message ?? "Email isn't set up yet — ask your manager or owner.");
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
    const res = await submitPasswordReset(email.trim(), code.trim(), newPassword);
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
      {step === "email" ? (
        <>
          <div className="mb-3 text-[11px] font-semibold text-text-secondary">
            Enter the email on your account and we&rsquo;ll send a reset code to it.
          </div>
          <div className={labelClass}>Email address</div>
          <input
            value={email}
            inputMode="email"
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && requestCode()}
            placeholder="you@example.com"
            className={`${inputClass} mb-3`}
          />
          {error && (
            <div className="mb-3 rounded-btn bg-danger-soft px-3 py-2 text-[10.5px] font-bold text-danger">
              {error}
            </div>
          )}
          <Button fullWidth onClick={requestCode} disabled={busy || !email.trim()}>
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
            onClick={() => setStep("email")}
            className="mt-2 min-h-10 w-full text-[10.5px] font-extrabold text-text-secondary"
          >
            Use a different email
          </button>
        </>
      )}
    </Sheet>
  );
}

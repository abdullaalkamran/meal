"use client";

import Link from "next/link";
import { useState } from "react";
import { Download, Lock, Phone } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { ForgotPasswordSheet } from "@/components/auth/ForgotPasswordSheet";

/** Sign-in for hostel people (members, managers, owners, cooks) — by phone
 * number + password, verified server-side. Platform-team operators use
 * /platform-login. */
export default function LoginPage() {
  const { login } = useSession();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  const submit = async () => {
    if (busy) return;
    if (!phone.trim() || !password) {
      setError("Enter your phone number and password.");
      return;
    }
    setError("");
    setBusy(true);
    const res = await login(phone.trim(), password);
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Sign-in failed.");
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-5 px-5 py-10">
      <div className="text-center">
        <div className="mb-1 text-[19px] font-extrabold tracking-tight">MyDorm</div>
        <div className="text-[11.5px] font-semibold text-text-secondary">
          Sign in to your hostel account
        </div>
      </div>

      <Card>
        <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
          Phone number
        </div>
        <div className="mb-3 flex items-center gap-2 rounded-btn border border-border px-3">
          <Icon icon={Phone} size={14} className="shrink-0 text-text-secondary" />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="01711-000006"
            inputMode="tel"
            className="min-h-11 w-full bg-transparent text-[13px] font-bold outline-none"
          />
        </div>
        <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
          Password
        </div>
        <div className="mb-3 flex items-center gap-2 rounded-btn border border-border px-3">
          <Icon icon={Lock} size={14} className="shrink-0 text-text-secondary" />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Your password"
            type="password"
            className="min-h-11 w-full bg-transparent text-[13px] font-bold outline-none"
          />
        </div>
        {error && (
          <div className="mb-3 rounded-btn bg-danger-soft px-3 py-2 text-[10.5px] font-bold text-danger">
            {error}
          </div>
        )}
        <Button fullWidth onClick={submit} disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
        <button
          type="button"
          onClick={() => setForgotOpen(true)}
          className="mt-2.5 w-full text-center text-[10.5px] font-extrabold text-primary"
        >
          Forgot password?
        </button>
        <div className="mt-2 text-center text-[9.5px] font-semibold text-text-secondary">
          Existing account, first time with a password? Your phone number is
          your password.
        </div>
      </Card>

      <Link
        href="/signup"
        className="flex min-h-12 items-center justify-center rounded-card border border-dashed border-border text-[12px] font-extrabold text-primary"
      >
        New here? Create an account
      </Link>

      <a
        href="/downloads/mydorm.apk"
        download
        className="flex min-h-11 items-center justify-center gap-2 rounded-card text-[11px] font-extrabold text-text-secondary"
      >
        <Icon icon={Download} size={13} className="shrink-0" />
        Download the Android app (APK)
      </a>

      <ForgotPasswordSheet open={forgotOpen} onClose={() => setForgotOpen(false)} />
    </div>
  );
}

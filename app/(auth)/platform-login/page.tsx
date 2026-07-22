"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, Lock, Phone, ShieldCheck } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";

/** Separate sign-in for the MyDorm PLATFORM TEAM (Super Admin, Marketing,
 * Service) — hostel members/managers/owners use /login. Verified server-side
 * with the "platform" scope, so only platform-role accounts can sign in here.
 * There is no public sign-up: platform accounts are provisioned internally. */
export default function PlatformLoginPage() {
  const { login } = useSession();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    if (!phone.trim() || !password) {
      setError("Enter your team phone number and password.");
      return;
    }
    setError("");
    setBusy(true);
    const res = await login(phone.trim(), password, "platform");
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Sign-in failed.");
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-5 px-5 py-10">
      <div>
        <Link
          href="/login"
          className="mb-3 flex items-center gap-1 text-[12px] font-extrabold text-text-secondary"
        >
          <Icon icon={ChevronLeft} size={16} /> Hostel sign-in
        </Link>
        <div className="text-center">
          <div className="mb-1 flex items-center justify-center gap-2 text-[19px] font-extrabold tracking-tight">
            <Icon icon={ShieldCheck} size={20} className="text-primary" />
            Platform team
          </div>
          <div className="text-[11.5px] font-semibold text-text-secondary">
            MyDorm staff sign-in — Super Admin, Marketing &amp; Service
          </div>
        </div>
      </div>

      <Card>
        <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
          Team phone number
        </div>
        <div className="mb-3 flex items-center gap-2 rounded-btn border border-border px-3">
          <Icon icon={Phone} size={14} className="shrink-0 text-text-secondary" />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="01700-000010"
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
      </Card>
    </div>
  );
}

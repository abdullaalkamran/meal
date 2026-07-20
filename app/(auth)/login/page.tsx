"use client";

import Link from "next/link";
import { useState } from "react";
import { Phone } from "lucide-react";
import { loadDemoData, repo } from "@/lib/data";
import { useSession } from "@/lib/auth/SessionProvider";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";

/** Sign-in for hostel people (members, managers, owners, cooks) — by phone
 * number, verified server-side. Platform-team operators use /platform-login. */
export default function LoginPage() {
  const { login } = useSession();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    if (!phone.trim()) {
      setError("Enter your phone number to sign in.");
      return;
    }
    setError("");
    setBusy(true);
    const res = await login(phone.trim());
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Sign-in failed.");
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-5 px-5 py-10">
      <div className="text-center">
        <div className="mb-1 text-[19px] font-extrabold tracking-tight">Hostel ERP</div>
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
        {error && (
          <div className="mb-3 rounded-btn bg-danger-soft px-3 py-2 text-[10.5px] font-bold text-danger">
            {error}
          </div>
        )}
        <Button fullWidth onClick={submit} disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
        <div className="mt-2 text-center text-[9.5px] font-semibold text-text-secondary">
          Demo build — your phone number is your sign-in, no password needed.
        </div>
      </Card>

      <Link
        href="/signup"
        className="flex min-h-12 items-center justify-center rounded-card border border-dashed border-border text-[12px] font-extrabold text-primary"
      >
        New here? Create an account
      </Link>

      <Link
        href="/platform-login"
        className="text-center text-[10.5px] font-bold text-text-secondary underline-offset-2 hover:underline"
      >
        Hostel ERP platform team? Sign in here
      </Link>

      <button
        type="button"
        onClick={async () => {
          await loadDemoData();
          await repo.hostels.listAll();
        }}
        className="mx-auto text-[9.5px] font-semibold text-text-secondary underline-offset-2 hover:underline"
      >
        Load demo dataset
      </button>
    </div>
  );
}

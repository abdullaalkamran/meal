"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Phone } from "lucide-react";
import { loadDemoData, repo, type Hostel, type User } from "@/lib/data";
import { useSession } from "@/lib/auth/SessionProvider";
import { normalizePhone } from "@/lib/utils/phone";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";

const ROLE_LABEL: Record<User["role"], string> = {
  student: "Member",
  manager: "Manager",
  owner: "Owner",
  cook: "Cook",
  superadmin: "Super Admin",
  marketing: "Marketing",
  service: "Service",
};

const PLATFORM_ROLES: User["role"][] = ["superadmin", "marketing", "service"];

/** Sign-in for hostel people (members, managers, owners, cooks) — by phone
 * number. Platform-team operators use their own page (/platform-login). */
export default function LoginPage() {
  const { login } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [demoOpen, setDemoOpen] = useState(false);

  useEffect(() => {
    repo.users.listAll().then(setUsers);
    repo.hostels.listAll().then(setHostels);
  }, []);

  const hostelUsers = users.filter((u) => !PLATFORM_ROLES.includes(u.role));
  const hostelName = (hostelId: string) =>
    hostels.find((h) => h.id === hostelId)?.name ?? "";

  const submit = () => {
    const entered = normalizePhone(phone);
    if (!entered) {
      setError("Enter your phone number to sign in.");
      return;
    }
    const match = hostelUsers.find((u) => normalizePhone(u.phone) === entered);
    if (!match) {
      setError("No account found with this phone number — check the number or create an account.");
      return;
    }
    setError("");
    login(match.id);
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
        <Button fullWidth onClick={submit}>
          Sign in
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

      <Card>
        <button
          type="button"
          onClick={() => setDemoOpen((v) => !v)}
          className="flex w-full cursor-pointer items-center justify-between"
        >
          <div className="text-[11px] font-extrabold text-text-secondary">
            Quick demo sign-in
          </div>
          <Icon icon={demoOpen ? ChevronUp : ChevronDown} size={16} className="text-text-secondary" />
        </button>
        {demoOpen && (
          <div className="mt-3 flex flex-col gap-2">
            {hostelUsers.length === 0 && (
              <div className="rounded-btn bg-bg px-3 py-2.5 text-center text-[10.5px] font-semibold text-text-secondary">
                No hostel accounts yet — create one, or load the demo dataset below.
              </div>
            )}
            {hostelUsers.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => login(u.id)}
                className="flex min-h-14 cursor-pointer items-center gap-3 rounded-btn border border-border bg-bg px-3 text-left transition-opacity active:opacity-70"
              >
                <Avatar name={u.name} seed={u.avatarSeed} />
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-bold">{u.name}</div>
                  <div className="text-[10.5px] font-semibold text-text-secondary">
                    {u.role === "owner" ? "All hostels" : hostelName(u.hostelId)} · {u.phone}
                  </div>
                </div>
                <Chip tone="primary" active>
                  {ROLE_LABEL[u.role]}
                </Chip>
              </button>
            ))}
            <button
              type="button"
              onClick={async () => {
                await loadDemoData();
                repo.users.listAll().then(setUsers);
                repo.hostels.listAll().then(setHostels);
              }}
              className="mt-1 min-h-10 rounded-btn border border-dashed border-border text-[10.5px] font-extrabold text-text-secondary"
            >
              Load demo dataset (2 hostels, sample members &amp; data)
            </button>
          </div>
        )}
      </Card>

      <Link
        href="/platform-login"
        className="text-center text-[10.5px] font-bold text-text-secondary underline-offset-2 hover:underline"
      >
        Hostel ERP platform team? Sign in here
      </Link>
    </div>
  );
}

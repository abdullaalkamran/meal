"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, Phone, ShieldCheck } from "lucide-react";
import { repo, type User } from "@/lib/data";
import { useSession } from "@/lib/auth/SessionProvider";
import { normalizePhone } from "@/lib/utils/phone";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";

const PLATFORM_ROLES: User["role"][] = ["superadmin", "marketing", "service"];

const ROLE_LABEL: Partial<Record<User["role"], string>> = {
  superadmin: "Super Admin",
  marketing: "Marketing",
  service: "Service",
};

/** Separate sign-in for the Hostel ERP PLATFORM TEAM (Super Admin, Marketing,
 * Service) — hostel members/managers/owners use /login. There is no public
 * sign-up here: platform accounts are provisioned internally. */
export default function PlatformLoginPage() {
  const { login } = useSession();
  const [team, setTeam] = useState<User[]>([]);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    repo.users.listAll().then((all) => setTeam(all.filter((u) => PLATFORM_ROLES.includes(u.role))));
  }, []);

  const submit = () => {
    const entered = normalizePhone(phone);
    if (!entered) {
      setError("Enter your team phone number.");
      return;
    }
    const match = team.find((u) => normalizePhone(u.phone) === entered);
    if (!match) {
      setError("No platform-team account with this number. Hostel accounts sign in on the main page.");
      return;
    }
    setError("");
    login(match.id);
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
            Hostel ERP staff sign-in — Super Admin, Marketing &amp; Service
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
        {error && (
          <div className="mb-3 rounded-btn bg-danger-soft px-3 py-2 text-[10.5px] font-bold text-danger">
            {error}
          </div>
        )}
        <Button fullWidth onClick={submit}>
          Sign in
        </Button>
      </Card>

      <Card>
        <div className="mb-3 text-[11px] font-extrabold text-text-secondary">Team accounts (demo)</div>
        <div className="flex flex-col gap-2">
          {team.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => login(u.id)}
              className="flex min-h-14 cursor-pointer items-center gap-3 rounded-btn border border-border bg-bg px-3 text-left transition-opacity active:opacity-70"
            >
              <Avatar name={u.name} seed={u.avatarSeed} />
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-bold">{u.name}</div>
                <div className="text-[10.5px] font-semibold text-text-secondary">{u.phone}</div>
              </div>
              <Chip tone="primary" active>
                {ROLE_LABEL[u.role]}
              </Chip>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

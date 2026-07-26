"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ServiceKindPicker } from "@/components/ui/ServiceKindPicker";
import { ServiceAreaPicker } from "@/components/ui/ServiceAreaPicker";
import { repo, type GeoArea, type Role, type ServiceKind } from "@/lib/data";
import { adminResetPassword } from "@/lib/auth/session";

const inputClass = "w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold";
const labelClass = "mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary";

function tempPassword(): string {
  return `mydorm${Math.floor(1000 + Math.random() * 9000)}`;
}

function avatarSeed(role: Role, name: string): string {
  return `${role}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "team"}`;
}

/** Super Admin creates a new Marketing or Service Manager account, with a
 * password chosen right away (rather than the default phone-as-password every
 * other staff-creation flow uses) — these are platform-wide roles with no
 * hostel owner around to hand them a temporary one later. */
export function CreatePlatformAccountSheet({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (name: string) => void;
}) {
  const [role, setRole] = useState<"marketing" | "service">("marketing");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [kinds, setKinds] = useState<ServiceKind[]>([]);
  const [areas, setAreas] = useState<GeoArea[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setRole("marketing");
      setName("");
      setPhone("");
      setPassword(tempPassword());
      setKinds([]);
      setAreas([]);
      setError("");
    });
  }, [open]);

  const valid = name.trim().length > 0 && phone.trim().length > 0 && password.length >= 6;

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    try {
      const created = await repo.users.create({
        name: name.trim(),
        phone: phone.trim(),
        role,
        hostelId: "",
        avatarSeed: avatarSeed(role, name.trim()),
        banned: false,
      });
      // users.create always starts the account on phone-as-password — swap in
      // the password chosen here via the same admin reset path used elsewhere.
      const res = await adminResetPassword(created.id, password);
      if (!res.ok) throw new Error(res.error ?? "Account created, but the password couldn't be set.");
      if (role === "service" && (kinds.length > 0 || areas.length > 0)) {
        await repo.users.setServicePermissions(created.id, { kinds, areas });
      }
      onCreated(created.name);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the account.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Create platform account">
      <div className="mb-4">
        <div className={labelClass}>Role</div>
        <SegmentedControl
          options={[
            { value: "marketing", label: "Marketing Manager" },
            { value: "service", label: "Service Manager" },
          ]}
          value={role}
          onChange={(v) => setRole(v as "marketing" | "service")}
        />
      </div>

      <div className={labelClass}>Name</div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={`${inputClass} mb-3`} />

      <div className={labelClass}>Phone</div>
      <input
        value={phone}
        inputMode="tel"
        onChange={(e) => setPhone(e.target.value)}
        placeholder="01711-000000"
        className={`${inputClass} mb-3`}
      />

      <div className={labelClass}>Password</div>
      <div className="mb-1 flex gap-2">
        <input value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        <button
          type="button"
          onClick={() => setPassword(tempPassword())}
          className="shrink-0 rounded-btn bg-bg px-3 text-[10.5px] font-extrabold text-primary"
        >
          Generate
        </button>
      </div>
      <div className="mb-4 text-[9.5px] font-semibold text-text-secondary">
        At least 6 characters. Share it with them privately — they can change it themselves afterwards.
      </div>

      {role === "service" && (
        <>
          <div className="mb-4">
            <ServiceKindPicker value={kinds} onChange={setKinds} />
          </div>
          <div className="mb-4">
            <ServiceAreaPicker value={areas} onChange={setAreas} />
          </div>
        </>
      )}

      {error && (
        <div className="mb-3 rounded-btn bg-danger-soft px-3 py-2 text-[10.5px] font-bold text-danger">
          {error}
        </div>
      )}

      <Button fullWidth onClick={submit} disabled={!valid || saving}>
        {saving ? "Creating…" : "Create account"}
      </Button>
    </Sheet>
  );
}

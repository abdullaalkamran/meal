"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { repo, type User } from "@/lib/data";
import { DEFAULT_MANAGER_PERMISSIONS } from "@/lib/auth/permissions";

const slug = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "user";

function Field({
  label,
  optional,
  ...input
}: { label: string; optional?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="mb-3">
      <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
        {label}
        {optional && <span className="font-semibold normal-case"> · optional</span>}
      </div>
      <input
        {...input}
        className="w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
      />
    </div>
  );
}

/** Owner creates a new hostel. A hostel can't exist without a manager, so the
 * form also creates its manager (and optionally a cook) as fresh users — they
 * appear on the login roster immediately. */
export function AddHostelSheet({
  open,
  onClose,
  owner,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  owner: User;
  onCreated: (hostelName: string) => void;
}) {
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [mealRate, setMealRate] = useState("95");
  const [kitchenLocation, setKitchenLocation] = useState("");
  const [managerName, setManagerName] = useState("");
  const [managerPhone, setManagerPhone] = useState("");
  const [cookName, setCookName] = useState("");
  const [cookPhone, setCookPhone] = useState("");
  const [cookSalary, setCookSalary] = useState("");
  const [saving, setSaving] = useState(false);

  const valid =
    name.trim() && area.trim() && managerName.trim() && managerPhone.trim() && Number(mealRate) > 0;

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);

    const hostel = await repo.hostels.create({
      name: name.trim(),
      area: area.trim(),
      ownerId: owner.id,
      managerId: "", // patched right after the manager user exists
      mealRate: Number(mealRate),
      kitchenLocation: kitchenLocation.trim() || undefined,
      cookMonthlySalary: cookName.trim() && Number(cookSalary) > 0 ? Number(cookSalary) : undefined,
      settings: {
        mealCutoff: [
          { meal: "breakfast", time: "21:00" },
          { meal: "lunch", time: "09:00" },
          { meal: "dinner", time: "15:00" },
        ],
        // Guest meals are billed at the member meal rate — kept equal here so
        // any legacy display of this setting can never contradict the bill.
        guestMealPrice: Number(mealRate),
        mealStopRequiresApproval: true,
        shoppingRotationPolicy: "spin-wheel",
        managerPermissions: { ...DEFAULT_MANAGER_PERMISSIONS },
        serviceChargeMonthly: 0,
      },
    });

    const manager = await repo.users.create({
      hostelId: hostel.id,
      name: managerName.trim(),
      phone: managerPhone.trim(),
      role: "manager",
      avatarSeed: `manager-${slug(managerName)}`,
    });
    let cookId: string | undefined;
    if (cookName.trim()) {
      const cook = await repo.users.create({
        hostelId: hostel.id,
        name: cookName.trim(),
        phone: cookPhone.trim() || "—",
        role: "cook",
        avatarSeed: `cook-${slug(cookName)}`,
      });
      cookId = cook.id;
    }
    await repo.hostels.update(hostel.id, { managerId: manager.id, cookId });
    await repo.users.updateUser(owner.id, {
      ownedHostelIds: [...(owner.ownedHostelIds ?? []), hostel.id],
    });

    setSaving(false);
    onCreated(hostel.name);
    onClose();
    setName("");
    setArea("");
    setKitchenLocation("");
    setManagerName("");
    setManagerPhone("");
    setCookName("");
    setCookPhone("");
    setCookSalary("");
  };

  return (
    <Sheet open={open} onClose={onClose} title="Add hostel">
      <Field label="Hostel name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Blue Sky Hostel" />
      <Field label="Area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Uttara, Dhaka" />
      <Field label="Meal rate (৳) — members & guests pay the same" type="number" min={1} inputMode="numeric" value={mealRate} onChange={(e) => setMealRate(e.target.value)} />
      <Field label="Kitchen location" optional value={kitchenLocation} onChange={(e) => setKitchenLocation(e.target.value)} placeholder="e.g. Room 101 · GF" />

      <div className="mb-3 mt-1 rounded-btn bg-bg px-3 py-2.5 text-[10.5px] font-bold text-text-secondary">
        Every hostel needs a manager — this creates their account so they can log in right away.
      </div>
      <Field label="Manager name" value={managerName} onChange={(e) => setManagerName(e.target.value)} placeholder="Full name" />
      <Field label="Manager phone" value={managerPhone} onChange={(e) => setManagerPhone(e.target.value)} placeholder="01711-000000" />

      <Field label="Cook name" optional value={cookName} onChange={(e) => setCookName(e.target.value)} placeholder="Full name" />
      {cookName.trim() && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Cook phone" optional value={cookPhone} onChange={(e) => setCookPhone(e.target.value)} placeholder="01711-000000" />
          <Field label="Cook salary (৳/mo)" optional type="number" min={0} inputMode="numeric" value={cookSalary} onChange={(e) => setCookSalary(e.target.value)} />
        </div>
      )}

      <Button fullWidth onClick={submit} disabled={!valid || saving}>
        {saving ? "Creating…" : "Create hostel"}
      </Button>
    </Sheet>
  );
}

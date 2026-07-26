"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { GeoSelect, isCompleteAddress } from "@/components/ui/GeoSelect";
import { repo, type GeoAddress, type Hostel, type User } from "@/lib/data";
import { formatAddress } from "@/lib/geo/bangladesh";
import { DEFAULT_MANAGER_PERMISSIONS } from "@/lib/auth/permissions";

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

/** Step 1 of setting up a hostel: just the hostel itself. It's created with
 * NO manager and NO cook — the owner adds rooms, then a manager, then a cook
 * as the next steps (see HostelSetupSheet). The owner can run the hostel via
 * manage mode until a manager is assigned. */
export function AddHostelSheet({
  open,
  onClose,
  owner,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  owner: User;
  onCreated: (hostel: Hostel) => void;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState<Partial<GeoAddress>>({});
  const [house, setHouse] = useState("");
  const [road, setRoad] = useState("");
  const [block, setBlock] = useState("");
  const [level, setLevel] = useState("");
  const [kitchenLocation, setKitchenLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const buildStreet = () =>
    [
      house.trim() && `House ${house.trim()}`,
      road.trim() && `Road ${road.trim()}`,
      block.trim() && `Block ${block.trim()}`,
      level.trim() && `Level/Apt ${level.trim()}`,
    ]
      .filter(Boolean)
      .join(", ");

  const valid = name.trim() && isCompleteAddress(address);

  const submit = async () => {
    if (!valid || saving || !isCompleteAddress(address)) return;
    setSaving(true);
    setError("");

    try {
      const hostel = await repo.hostels.create({
        name: name.trim(),
        // Short display form ("Mirpur, Dhaka") derived from the dropdowns.
        area: formatAddress(address),
        address,
        street: buildStreet() || undefined,
        ownerId: owner.id,
        managerId: "", // manager-less; assigned as the next step
        // DEPRECATED nominal value — the real per-meal cost is computed every
        // month as shopping spend ÷ meals eaten; nothing bills from this field.
        mealRate: 0,
        kitchenLocation: kitchenLocation.trim() || undefined,
        settings: {
          mealCutoff: [
            { meal: "breakfast", time: "21:00" },
            { meal: "lunch", time: "09:00" },
            { meal: "dinner", time: "15:00" },
          ],
          // DEPRECATED — meals (member & guest) bill at the automatic monthly
          // actual rate; kept at 0 so nothing can display a contradicting price.
          guestMealPrice: 0,
          mealStopRequiresApproval: true,
          shoppingRotationPolicy: "spin-wheel",
          managerPermissions: { ...DEFAULT_MANAGER_PERMISSIONS },
          serviceChargeMonthly: 0,
        },
      });

      // hostels.create attaches the new hostel to the owner's ownedHostelIds
      // itself now (mirrors MySQL, where it's always derived) — no separate
      // client call needed.
      setSaving(false);
      onCreated(hostel);
      onClose();
      setName("");
      setAddress({});
      setHouse("");
      setRoad("");
      setBlock("");
      setLevel("");
      setKitchenLocation("");
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Could not create the hostel.");
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Add hostel">
      <Field label="Hostel name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Blue Sky Hostel" />
      <GeoSelect label="Hostel address" value={address} onChange={setAddress} />

      <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
        Street address <span className="font-semibold normal-case"> · optional</span>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <input
          value={house}
          onChange={(e) => setHouse(e.target.value)}
          placeholder="House / Holding no."
          className="w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
        />
        <input
          value={road}
          onChange={(e) => setRoad(e.target.value)}
          placeholder="Road no. / name"
          className="w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
        />
        <input
          value={block}
          onChange={(e) => setBlock(e.target.value)}
          placeholder="Block / sector"
          className="w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
        />
        <input
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          placeholder="Level / apartment"
          className="w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
        />
      </div>

      <Field label="Kitchen location" optional value={kitchenLocation} onChange={(e) => setKitchenLocation(e.target.value)} placeholder="e.g. Room 101 · GF" />

      <div className="mb-4 rounded-btn bg-bg px-3 py-2.5 text-[10px] font-semibold text-text-secondary">
        Next you&rsquo;ll add rooms, then assign a manager and a cook. You can run the hostel
        yourself until a manager is assigned.
      </div>

      {error && (
        <div className="mb-3 rounded-btn bg-danger-soft px-3 py-2 text-[10.5px] font-bold text-danger">
          {error}
        </div>
      )}

      <Button fullWidth onClick={submit} disabled={!valid || saving}>
        {saving ? "Creating…" : "Create hostel"}
      </Button>
    </Sheet>
  );
}

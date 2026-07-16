"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { repo, type Hostel, type Role, type User } from "@/lib/data";

const slug = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "user";

/** Owner replaces a hostel's manager or cook — either promote an existing
 * person with that role from anywhere on the platform, or create a brand-new
 * account. The displaced person keeps their account; they're just no longer
 * referenced by the hostel. */
export function AssignStaffSheet({
  open,
  onClose,
  hostel,
  role,
  onAssigned,
}: {
  open: boolean;
  onClose: () => void;
  hostel: Hostel | null;
  role: "manager" | "cook";
  onAssigned: (name: string) => void;
}) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [candidates, setCandidates] = useState<User[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newSalary, setNewSalary] = useState("");
  const [saving, setSaving] = useState(false);

  const currentId = role === "manager" ? hostel?.managerId : hostel?.cookId;

  useEffect(() => {
    if (!open || !hostel) return;
    repo.users.listAll().then((all) =>
      setCandidates(all.filter((u) => u.role === (role as Role) && u.id !== currentId))
    );
    queueMicrotask(() => {
      setSelectedId(null);
      setNewName("");
      setNewPhone("");
      setNewSalary("");
      setMode("existing");
    });
  }, [open, hostel, role, currentId]);

  if (!hostel) return null;

  const valid = mode === "existing" ? !!selectedId : !!(newName.trim() && newPhone.trim());

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    let staff: User;
    if (mode === "existing") {
      staff = candidates.find((u) => u.id === selectedId)!;
      await repo.users.updateUser(staff.id, { hostelId: hostel.id });
    } else {
      staff = await repo.users.create({
        hostelId: hostel.id,
        name: newName.trim(),
        phone: newPhone.trim(),
        role,
        avatarSeed: `${role}-${slug(newName)}`,
      });
    }
    await repo.hostels.update(hostel.id, {
      ...(role === "manager" ? { managerId: staff.id } : { cookId: staff.id }),
      ...(role === "cook" && Number(newSalary) > 0 ? { cookMonthlySalary: Number(newSalary) } : {}),
    });
    setSaving(false);
    onAssigned(staff.name);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`${role === "manager" ? "Assign manager" : "Assign cook"} · ${hostel.name}`}
    >
      <div className="mb-3">
        <SegmentedControl
          options={[
            { value: "existing", label: "Existing person" },
            { value: "new", label: "Create new" },
          ]}
          value={mode}
          onChange={(v) => setMode(v as "existing" | "new")}
        />
      </div>

      {mode === "existing" ? (
        <div className="mb-4 flex flex-col gap-2">
          {candidates.length === 0 && (
            <div className="rounded-btn bg-bg px-3 py-2.5 text-[11px] font-semibold text-text-secondary">
              No other {role}s on the platform — create a new one instead.
            </div>
          )}
          {candidates.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => setSelectedId(u.id)}
              className={`flex items-center gap-3 rounded-btn border px-3 py-2.5 text-left ${
                selectedId === u.id ? "border-primary bg-primary-soft" : "border-border"
              }`}
            >
              <Avatar name={u.name} seed={u.avatarSeed} size={34} />
              <div className="min-w-0">
                <div className="text-[11.5px] font-extrabold">{u.name}</div>
                <div className="text-[9.5px] font-semibold text-text-secondary">{u.phone}</div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="mb-4">
          <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
            Name
          </div>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Full name"
            className="mb-3 w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
          />
          <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
            Phone
          </div>
          <input
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="01711-000000"
            className="mb-3 w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
          />
          {role === "cook" && (
            <>
              <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
                Monthly salary (৳) · optional
              </div>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={newSalary}
                onChange={(e) => setNewSalary(e.target.value)}
                className="w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
              />
            </>
          )}
        </div>
      )}

      <Button fullWidth onClick={submit} disabled={!valid || saving}>
        {saving ? "Assigning…" : "Assign"}
      </Button>
    </Sheet>
  );
}

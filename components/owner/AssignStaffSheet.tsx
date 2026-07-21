"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { repo, type Hostel, type User } from "@/lib/data";

/**
 * Assigns this hostel's manager or cook.
 *
 * Manager: only an EXISTING, non-banned boarder of THIS hostel can become
 * manager (`hostels.changeManager` enforces this and correctly demotes the
 * outgoing manager back to a regular boarder in the same step) — there's no
 * "create a brand-new manager" option here because a manager has to already
 * be a member to promote.
 *
 * Cook: either an existing "cook"-role account that isn't currently
 * staffing a different hostel, or a brand-new account — both go through
 * `hostels.assignCook`, which detaches whoever was the previous cook
 * (keeping their account, just no longer referencing them from this
 * hostel) before attaching the new one.
 */
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
  const [error, setError] = useState("");

  const currentId = role === "manager" ? hostel?.managerId : hostel?.cookId;

  useEffect(() => {
    if (!open || !hostel) return;
    if (role === "manager") {
      repo.users
        .listByHostel(hostel.id)
        .then((all) => setCandidates(all.filter((u) => u.role === "student" && !u.banned)));
    } else {
      repo.users
        .listAll()
        .then((all) =>
          setCandidates(all.filter((u) => u.role === "cook" && u.id !== currentId && !u.hostelId))
        );
    }
    queueMicrotask(() => {
      setSelectedId(null);
      setNewName("");
      setNewPhone("");
      setNewSalary("");
      setMode("existing");
      setError("");
    });
  }, [open, hostel, role, currentId]);

  if (!hostel) return null;

  const valid = mode === "existing" ? !!selectedId : !!(newName.trim() && newPhone.trim());

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    try {
      let staffName: string;
      if (role === "manager") {
        const staff = candidates.find((u) => u.id === selectedId)!;
        await repo.hostels.changeManager(hostel.id, staff.id);
        staffName = staff.name;
      } else if (mode === "existing") {
        const staff = candidates.find((u) => u.id === selectedId)!;
        await repo.hostels.assignCook(hostel.id, {
          mode: "existing",
          userId: staff.id,
          salary: Number(newSalary) > 0 ? Number(newSalary) : undefined,
        });
        staffName = staff.name;
      } else {
        staffName = newName.trim();
        await repo.hostels.assignCook(hostel.id, {
          mode: "new",
          name: staffName,
          phone: newPhone.trim(),
          salary: Number(newSalary) > 0 ? Number(newSalary) : undefined,
        });
      }
      setSaving(false);
      onAssigned(staffName);
      onClose();
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Could not assign the staff member.");
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`${role === "manager" ? "Assign manager" : "Assign cook"} · ${hostel.name}`}
    >
      {role === "cook" && (
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
      )}

      {mode === "existing" ? (
        <div className="mb-4 flex flex-col gap-2">
          {candidates.length === 0 && (
            <div className="rounded-btn bg-bg px-3 py-2.5 text-[11px] font-semibold text-text-secondary">
              {role === "manager"
                ? "No other boarders to promote yet — add members to this hostel first."
                : "No unassigned cook accounts on the platform — create a new one instead."}
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
        </div>
      )}

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
            className="mb-4 w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
          />
        </>
      )}

      {error && (
        <div className="mb-3 rounded-btn bg-danger-soft px-3 py-2 text-[10.5px] font-bold text-danger">
          {error}
        </div>
      )}

      <Button fullWidth onClick={submit} disabled={!valid || saving}>
        {saving ? "Assigning…" : "Assign"}
      </Button>
    </Sheet>
  );
}

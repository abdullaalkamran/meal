"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { repo, type Hostel, type User } from "@/lib/data";
import { normalizePhone } from "@/lib/utils/phone";

/**
 * Assigns this hostel's manager or cook, each two ways:
 *
 * Manager (`hostels.assignManager`):
 *   - "existing" — look up any platform account by phone and make them the
 *     manager (a current boarder here, or an account with no hostel yet).
 *   - "new" — create a brand-new manager account.
 *
 * Cook (`hostels.assignCook`):
 *   - "existing" — pick an unassigned "cook"-role account.
 *   - "new" — create a brand-new cook account.
 *
 * Whichever manager/cook was there before is stepped down in the same action.
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
  // Cook "existing" is a candidate list; manager "existing" is a phone lookup.
  const [candidates, setCandidates] = useState<User[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lookupPhone, setLookupPhone] = useState("");
  const [found, setFound] = useState<User | null>(null);
  const [looking, setLooking] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newSalary, setNewSalary] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const currentId = role === "manager" ? hostel?.managerId : hostel?.cookId;

  useEffect(() => {
    if (!open || !hostel) return;
    if (role === "cook") {
      repo.users
        .listAll()
        .then((all) => setCandidates(all.filter((u) => u.role === "cook" && u.id !== currentId && !u.hostelId)));
    }
    queueMicrotask(() => {
      setSelectedId(null);
      setLookupPhone("");
      setFound(null);
      setNewName("");
      setNewPhone("");
      setNewSalary("");
      setMode("existing");
      setError("");
    });
  }, [open, hostel, role, currentId]);

  if (!hostel) return null;

  const lookup = async () => {
    if (!lookupPhone.trim() || looking) return;
    setLooking(true);
    setError("");
    setFound(null);
    const target = normalizePhone(lookupPhone);
    const match = (await repo.users.listAll()).find((u) => normalizePhone(u.phone) === target);
    setLooking(false);
    if (!match) {
      setError("No platform account with this number — create a new manager instead.");
      return;
    }
    setFound(match);
  };

  const valid =
    mode === "new"
      ? !!(newName.trim() && newPhone.trim())
      : role === "manager"
        ? !!found
        : !!selectedId;

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    try {
      let staffName: string;
      if (role === "manager") {
        if (mode === "new") {
          staffName = newName.trim();
          await repo.hostels.assignManager(hostel.id, { mode: "new", name: staffName, phone: newPhone.trim() });
        } else {
          staffName = found!.name;
          await repo.hostels.assignManager(hostel.id, { mode: "existing", userId: found!.id });
        }
      } else if (mode === "existing") {
        const staff = candidates.find((u) => u.id === selectedId)!;
        staffName = staff.name;
        await repo.hostels.assignCook(hostel.id, {
          mode: "existing",
          userId: staff.id,
          salary: Number(newSalary) > 0 ? Number(newSalary) : undefined,
        });
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

  const inputClass = "w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold";
  const labelClass = "mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary";

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`${role === "manager" ? "Assign manager" : "Assign cook"} · ${hostel.name}`}
    >
      <div className="mb-3">
        <SegmentedControl
          options={[
            { value: "existing", label: "Existing account" },
            { value: "new", label: "Create new" },
          ]}
          value={mode}
          onChange={(v) => setMode(v as "existing" | "new")}
        />
      </div>

      {mode === "existing" ? (
        role === "manager" ? (
          // Manager: find any platform account by phone.
          <div className="mb-4">
            <div className={labelClass}>Their phone number</div>
            <div className="mb-2 flex gap-2">
              <input
                value={lookupPhone}
                inputMode="tel"
                onChange={(e) => setLookupPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && lookup()}
                placeholder="01711-000000"
                className={inputClass}
              />
              <button
                type="button"
                onClick={lookup}
                disabled={!lookupPhone.trim() || looking}
                className="shrink-0 rounded-btn bg-bg px-3 text-[11px] font-extrabold text-primary disabled:opacity-50"
              >
                {looking ? "…" : "Find"}
              </button>
            </div>
            {found && (
              <div className="flex items-center gap-3 rounded-btn border border-primary bg-primary-soft px-3 py-2.5">
                <Avatar name={found.name} seed={found.avatarSeed} photo={found.avatarImage} size={34} />
                <div className="min-w-0">
                  <div className="text-[11.5px] font-extrabold">{found.name}</div>
                  <div className="text-[9.5px] font-semibold text-text-secondary">{found.phone}</div>
                </div>
              </div>
            )}
          </div>
        ) : (
          // Cook: pick from unassigned cook accounts.
          <div className="mb-4 flex flex-col gap-2">
            {candidates.length === 0 && (
              <div className="rounded-btn bg-bg px-3 py-2.5 text-[11px] font-semibold text-text-secondary">
                No unassigned cook accounts on the platform — create a new one instead.
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
                <Avatar name={u.name} seed={u.avatarSeed} photo={u.avatarImage} size={34} />
                <div className="min-w-0">
                  <div className="text-[11.5px] font-extrabold">{u.name}</div>
                  <div className="text-[9.5px] font-semibold text-text-secondary">{u.phone}</div>
                </div>
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="mb-4">
          <div className={labelClass}>Name</div>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name" className={`${inputClass} mb-3`} />
          <div className={labelClass}>Phone</div>
          <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="01711-000000" className={`${inputClass} mb-1`} />
          <div className="mb-2 text-[9.5px] font-semibold text-text-secondary">
            They sign in with this number; their password starts as the number itself.
          </div>
        </div>
      )}

      {role === "cook" && (
        <>
          <div className={labelClass}>Monthly salary (৳) · optional</div>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={newSalary}
            onChange={(e) => setNewSalary(e.target.value)}
            className={`${inputClass} mb-4`}
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

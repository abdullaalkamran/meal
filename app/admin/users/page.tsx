"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { repo, type Hostel, type Role, type User } from "@/lib/data";

const ROLE_LABEL: Record<Role, string> = {
  superadmin: "Super Admin",
  marketing: "Marketing",
  service: "Service",
  owner: "Owner",
  manager: "Manager",
  cook: "Cook",
  student: "Student",
};

const ROLE_ORDER: Role[] = ["superadmin", "marketing", "service", "owner", "manager", "cook", "student"];

const ROLE_TONE: Record<Role, string> = {
  superadmin: "bg-[#7C6CF6]/10 text-[#7C6CF6]",
  marketing: "bg-blue-soft text-blue",
  service: "bg-orange-soft text-orange",
  owner: "bg-primary-soft text-primary",
  manager: "bg-blue-soft text-blue",
  cook: "bg-orange-soft text-orange",
  student: "bg-bg text-text-secondary",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const { toast } = useToast();

  const load = () => {
    repo.users.listAll().then(setUsers);
    repo.hostels.listAll().then(setHostels);
  };
  useEffect(load, []);

  const hostelName = (id: string) => hostels.find((h) => h.id === id)?.name ?? "";
  const isPlatform = (r: Role) => ["superadmin", "marketing", "service", "owner"].includes(r);
  // Removing an owner/manager/cook still referenced by a hostel would orphan
  // it (dangling ownerId/managerId) — those must be reassigned first.
  const referencedBy = (userId: string) =>
    hostels.find((h) => h.ownerId === userId || h.managerId === userId || h.cookId === userId);

  const unban = async (u: User) => {
    await repo.users.setBanned(u.id, false);
    toast(`${u.name.split(" ")[0]} un-banned`);
    load();
  };
  const remove = async (u: User) => {
    await repo.users.remove(u.id);
    toast(`${u.name}'s account removed`);
    setConfirmRemoveId(null);
    load();
  };

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div>
        <div className="text-[17.5px] font-extrabold tracking-tight">All users</div>
        <div className="text-[10.5px] font-semibold text-text-secondary">{users.length} accounts</div>
      </div>

      {ROLE_ORDER.map((role) => {
        const list = users.filter((u) => u.role === role);
        if (list.length === 0) return null;
        return (
          <div key={role}>
            <div className="mb-2 flex items-center justify-between text-[13.5px] font-extrabold">
              {ROLE_LABEL[role]}
              <span className="text-[10.5px] font-semibold text-text-secondary">{list.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {list.map((u) => (
                <Card key={u.id}>
                  <div className="flex items-center gap-3">
                    <Avatar name={u.name} seed={u.avatarSeed} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[11.5px] font-extrabold">
                        {u.name}
                        {u.banned && (
                          <span className="rounded-pill bg-danger-soft px-1.5 py-0.5 text-[8.5px] font-extrabold text-danger">
                            Banned
                          </span>
                        )}
                      </div>
                      <div className="text-[9.5px] font-semibold text-text-secondary">
                        {u.phone}
                        {!isPlatform(u.role) && u.hostelId ? ` · ${hostelName(u.hostelId)}` : ""}
                      </div>
                    </div>
                    <span className={`rounded-pill px-2.5 py-1 text-[9px] font-extrabold ${ROLE_TONE[u.role]}`}>
                      {ROLE_LABEL[u.role]}
                    </span>
                  </div>
                  {/* Platform accounts are provisioned, not managed here. */}
                  {u.role !== "superadmin" && u.role !== "marketing" && u.role !== "service" && (
                    <div className="mt-2.5 flex gap-2 border-t border-border pt-2.5">
                      {u.banned && (
                        <button
                          type="button"
                          onClick={() => unban(u)}
                          className="flex-1 rounded-pill bg-primary-soft py-1.5 text-[10px] font-extrabold text-primary"
                        >
                          Un-ban
                        </button>
                      )}
                      {referencedBy(u.id) ? (
                        <div className="flex-1 rounded-pill bg-bg py-1.5 text-center text-[9.5px] font-bold text-text-secondary">
                          Runs {referencedBy(u.id)!.name} — reassign before removing
                        </div>
                      ) : confirmRemoveId === u.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => remove(u)}
                            className="flex-1 rounded-pill bg-danger py-1.5 text-[10px] font-extrabold text-white"
                          >
                            Confirm remove
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmRemoveId(null)}
                            className="flex-1 rounded-pill border border-border py-1.5 text-[10px] font-extrabold"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveId(u.id)}
                          className="flex-1 rounded-pill bg-danger-soft py-1.5 text-[10px] font-extrabold text-danger"
                        >
                          Remove account
                        </button>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

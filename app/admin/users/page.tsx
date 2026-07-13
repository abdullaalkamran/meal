"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
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

  useEffect(() => {
    repo.users.listAll().then(setUsers);
    repo.hostels.listAll().then(setHostels);
  }, []);

  const hostelName = (id: string) => hostels.find((h) => h.id === id)?.name ?? "";
  const isPlatform = (r: Role) => ["superadmin", "marketing", "service", "owner"].includes(r);

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
                <Card key={u.id} className="flex items-center gap-3">
                  <Avatar name={u.name} seed={u.avatarSeed} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11.5px] font-extrabold">{u.name}</div>
                    <div className="text-[9.5px] font-semibold text-text-secondary">
                      {u.phone}
                      {!isPlatform(u.role) ? ` · ${hostelName(u.hostelId)}` : ""}
                    </div>
                  </div>
                  <span className={`rounded-pill px-2.5 py-1 text-[9px] font-extrabold ${ROLE_TONE[u.role]}`}>
                    {ROLE_LABEL[u.role]}
                  </span>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

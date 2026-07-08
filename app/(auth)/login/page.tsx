"use client";

import { useEffect, useState } from "react";
import { repo, type Hostel, type User } from "@/lib/data";
import { useSession } from "@/lib/auth/SessionProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";

const ROLE_LABEL: Record<User["role"], string> = {
  student: "Student",
  manager: "Manager",
  owner: "Owner",
  cook: "Cook",
};

export default function LoginPage() {
  const { login } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);

  useEffect(() => {
    repo.users.listAll().then(setUsers);
    repo.hostels.listAll().then(setHostels);
  }, []);

  const hostelName = (hostelId: string) =>
    hostels.find((h) => h.id === hostelId)?.name ?? hostelId;

  const grouped = hostels.map((hostel) => ({
    hostel,
    members: users.filter((u) => u.hostelId === hostel.id),
  }));
  const owners = users.filter((u) => u.role === "owner");

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-5 py-10">
      <div className="text-center">
        <div className="mb-1 text-[19px] font-extrabold tracking-tight">Hostel ERP</div>
        <div className="text-[11.5px] font-semibold text-text-secondary">
          Choose an account to continue (dev sign-in)
        </div>
      </div>

      {owners.length > 0 && (
        <Card>
          <div className="mb-3 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
            Owner
          </div>
          <div className="flex flex-col gap-2">
            {owners.map((u) => (
              <AccountRow key={u.id} user={u} subtitle="All hostels" onSelect={login} />
            ))}
          </div>
        </Card>
      )}

      {grouped.map(({ hostel, members }) => (
        <Card key={hostel.id}>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
              {hostel.name}
            </div>
            <Chip>{hostel.area}</Chip>
          </div>
          <div className="flex flex-col gap-2">
            {members
              .filter((u) => u.role !== "owner")
              .map((u) => (
                <AccountRow
                  key={u.id}
                  user={u}
                  subtitle={`${ROLE_LABEL[u.role]} · ${hostelName(u.hostelId)}`}
                  onSelect={login}
                />
              ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function AccountRow({
  user,
  subtitle,
  onSelect,
}: {
  user: User;
  subtitle: string;
  onSelect: (userId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(user.id)}
      className="flex min-h-14 cursor-pointer items-center gap-3 rounded-btn border border-border bg-bg px-3 text-left transition-opacity active:opacity-70"
    >
      <Avatar name={user.name} seed={user.avatarSeed} />
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-bold">{user.name}</div>
        <div className="text-[10.5px] font-semibold text-text-secondary">{subtitle}</div>
      </div>
      <Chip tone="primary" active>
        {ROLE_LABEL[user.role]}
      </Chip>
    </button>
  );
}

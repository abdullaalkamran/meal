"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Wrench } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useHostelsByOwner } from "@/hooks/useHostel";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { ManagerPermissionsSheet } from "@/components/owner/ManagerPermissionsSheet";
import { repo, type Hostel, type User } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";
import { currentMonth } from "@/lib/utils/date";

interface HostelStats {
  managerName: string;
  studentCount: number;
  due: number;
}

export default function OwnerHostelsPage() {
  const router = useRouter();
  const { user, activeHostelId, switchHostel, setViewRole } = useSession();
  const hostels = useHostelsByOwner(user?.id);
  const { toast } = useToast();
  const [stats, setStats] = useState<Record<string, HostelStats>>({});
  const [permsHostelId, setPermsHostelId] = useState<string | null>(null);

  const manageHostel = (hostelId: string) => {
    switchHostel(hostelId);
    setViewRole("manager");
    router.push("/manager");
  };

  useEffect(() => {
    if (hostels.length === 0) return;
    Promise.all(
      hostels.map(async (h) => {
        const [manager, members, bills] = await Promise.all([
          repo.users.getUser(h.managerId),
          repo.users.listByHostel(h.id),
          repo.bills.listByHostel(h.id, currentMonth()),
        ]);
        const due = bills.reduce((sum, b) => sum + (b.grandTotal - b.paid), 0);
        const studentCount = members.filter((m: User) => m.role === "student").length;
        return [h.id, { managerName: manager?.name ?? "—", studentCount, due }] as const;
      })
    ).then((entries) => setStats(Object.fromEntries(entries)));
  }, [hostels]);

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="flex items-center justify-between">
        <div className="text-[17.5px] font-extrabold tracking-tight">Hostels</div>
        <button
          type="button"
          onClick={() => toast("Add hostel — coming in a later build phase")}
          className="text-[11.5px] font-extrabold text-primary"
        >
          + Add
        </button>
      </div>

      {hostels.map((h: Hostel) => {
        const s = stats[h.id];
        const isActive = h.id === activeHostelId;
        return (
          <Card key={h.id}>
            <button
              type="button"
              onClick={() => switchHostel(h.id)}
              className="mb-3 flex w-full cursor-pointer items-center justify-between text-left"
            >
              <div>
                <div className="flex items-center gap-2 text-[14px] font-extrabold">
                  {h.name}
                  {isActive && (
                    <Chip tone="primary" active>
                      Active
                    </Chip>
                  )}
                </div>
                <div className="text-[10.5px] font-semibold text-text-secondary">{h.area}</div>
              </div>
            </button>

            <div className="mb-3 grid grid-cols-3 gap-2">
              <div>
                <div className="text-[9.5px] font-bold text-text-secondary">Manager</div>
                <div className="text-[11px] font-extrabold">{s?.managerName ?? "…"}</div>
              </div>
              <div>
                <div className="text-[9.5px] font-bold text-text-secondary">Students</div>
                <div className="text-[11px] font-extrabold">{s?.studentCount ?? "…"}</div>
              </div>
              <div>
                <div className="text-[9.5px] font-bold text-text-secondary">Meal rate</div>
                <div className="text-[11px] font-extrabold">{formatBDT(h.mealRate)}</div>
              </div>
            </div>

            <div className="mb-3 flex items-center justify-between rounded-btn bg-bg px-3 py-2">
              <div className="text-[10px] font-bold text-text-secondary">Outstanding dues</div>
              <div className="text-[11.5px] font-extrabold">{formatBDT(s?.due ?? 0)}</div>
            </div>

            <div className="mb-3 flex flex-wrap gap-1.5">
              <Chip>
                Guest meal {formatBDT(h.settings.guestMealPrice)}
              </Chip>
              <Chip>
                {h.settings.mealStopRequiresApproval ? "Meal stop needs approval" : "Meal stop auto"}
              </Chip>
              <Chip>
                {h.settings.shoppingRotationPolicy === "spin-wheel" ? "Spin-wheel rotation" : "Manual rotation"}
              </Chip>
              {h.settings.mealCutoff.map((c) => (
                <Chip key={c.meal}>
                  {c.meal} cutoff {c.time}
                </Chip>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => manageHostel(h.id)}
                className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-btn bg-primary text-[11.5px] font-extrabold text-white"
              >
                <Icon icon={Wrench} size={14} /> Manage hostel
              </button>
              <button
                type="button"
                onClick={() => setPermsHostelId(h.id)}
                className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-btn bg-[#7C6CF6]/10 text-[11.5px] font-extrabold text-[#7C6CF6]"
              >
                <Icon icon={ShieldCheck} size={14} /> Manager permissions
              </button>
            </div>
          </Card>
        );
      })}

      <ManagerPermissionsSheet
        open={!!permsHostelId}
        onClose={() => setPermsHostelId(null)}
        hostelId={permsHostelId}
        managerName={permsHostelId ? stats[permsHostelId]?.managerName : undefined}
      />
    </div>
  );
}

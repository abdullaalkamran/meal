"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, PencilLine, QrCode, ShieldCheck, Wrench } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useHostelsByOwner } from "@/hooks/useHostel";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { ManagerPermissionsSheet } from "@/components/owner/ManagerPermissionsSheet";
import { AddHostelSheet } from "@/components/owner/AddHostelSheet";
import { HostelSetupSheet } from "@/components/owner/HostelSetupSheet";
import { FinanceSettingsSheet } from "@/components/owner/FinanceSettingsSheet";
import { EditHostelNameSheet } from "@/components/owner/EditHostelNameSheet";
import { JoinQrSheet } from "@/components/hostel/JoinQrSheet";
import { repo, type Hostel, type User } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";
import { currentMonth } from "@/lib/utils/date";

interface HostelStats {
  managerName: string;
  studentCount: number;
  due: number;
  actualRate: number;
}

export default function OwnerHostelsPage() {
  const router = useRouter();
  const { user, activeHostelId, switchHostel } = useSession();
  const hostels = useHostelsByOwner(user?.id);
  const { toast } = useToast();
  const [stats, setStats] = useState<Record<string, HostelStats>>({});
  const [permsHostelId, setPermsHostelId] = useState<string | null>(null);
  const [financeHostelId, setFinanceHostelId] = useState<string | null>(null);
  const [editNameHostelId, setEditNameHostelId] = useState<string | null>(null);
  const [qrHostel, setQrHostel] = useState<Hostel | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [setupHostel, setSetupHostel] = useState<Hostel | null>(null);

  // Owners manage from their OWN native screens (hostel-scoped), not by
  // impersonating the manager — so they see the owner view, not the manager's.
  const manageHostel = (hostelId: string) => {
    switchHostel(hostelId);
    router.push("/owner/members");
  };

  useEffect(() => {
    if (hostels.length === 0) return;
    Promise.all(
      hostels.map(async (h) => {
        const [manager, members, bills, rateInfo] = await Promise.all([
          repo.users.getUser(h.managerId),
          repo.users.listByHostel(h.id),
          repo.bills.listByHostel(h.id, currentMonth()),
          repo.meals.getActualMealRate(h.id, currentMonth()),
        ]);
        const due = bills.reduce((sum, b) => sum + (b.grandTotal - b.paid), 0);
        const studentCount = members.filter((m: User) => m.role === "student").length;
        return [
          h.id,
          { managerName: manager?.name ?? "—", studentCount, due, actualRate: rateInfo.rate },
        ] as const;
      })
    ).then((entries) => setStats(Object.fromEntries(entries)));
  }, [hostels]);

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="flex items-center justify-between">
        <div className="text-[17.5px] font-extrabold tracking-tight">Hostels</div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
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
            <div className="mb-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => switchHostel(h.id)}
                className="min-w-0 flex-1 cursor-pointer text-left"
              >
                <div className="flex items-center gap-2 text-[14px] font-extrabold">
                  <span className="truncate">{h.name}</span>
                  {isActive && (
                    <Chip tone="primary" active>
                      Active
                    </Chip>
                  )}
                </div>
                <div className="text-[10.5px] font-semibold text-text-secondary">{h.area}</div>
              </button>
              <button
                type="button"
                onClick={() => setEditNameHostelId(h.id)}
                aria-label="Edit hostel name"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg text-text-secondary"
              >
                <Icon icon={PencilLine} size={13} />
              </button>
            </div>

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
                <div className="text-[9.5px] font-bold text-text-secondary">Actual rate/meal</div>
                <div className="text-[11px] font-extrabold">{formatBDT(stats[h.id]?.actualRate ?? 0)}</div>
              </div>
            </div>

            <div className="mb-3 flex items-center justify-between rounded-btn bg-bg px-3 py-2">
              <div className="text-[10px] font-bold text-text-secondary">Outstanding dues</div>
              <div className="text-[11.5px] font-extrabold">{formatBDT(s?.due ?? 0)}</div>
            </div>

            <div className="mb-3 flex flex-wrap gap-1.5">
              <Chip>
                Guests pay the actual rate, same as members
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

            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setFinanceHostelId(h.id)}
                className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-btn bg-bg text-[11.5px] font-extrabold text-text-secondary"
              >
                <Icon icon={Banknote} size={14} /> Finance settings
                {h.settings.serviceChargeMonthly ? (
                  <span className="font-bold">· {formatBDT(h.settings.serviceChargeMonthly)}/mo</span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => setQrHostel(h)}
                className="flex min-h-10 items-center justify-center gap-1.5 rounded-btn bg-bg px-3 text-[11.5px] font-extrabold text-primary"
              >
                <Icon icon={QrCode} size={14} /> QR invite
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

      <FinanceSettingsSheet
        open={!!financeHostelId}
        onClose={() => setFinanceHostelId(null)}
        hostelId={financeHostelId}
        onSaved={() => toast("Finance settings saved")}
      />

      <EditHostelNameSheet
        open={!!editNameHostelId}
        onClose={() => setEditNameHostelId(null)}
        hostelId={editNameHostelId}
        onSaved={() => toast("Hostel name updated")}
      />

      <JoinQrSheet
        open={!!qrHostel}
        onClose={() => setQrHostel(null)}
        hostelId={qrHostel?.id}
        hostelName={qrHostel?.name}
      />

      {user && (
        <AddHostelSheet
          open={addOpen}
          onClose={() => setAddOpen(false)}
          owner={user}
          onCreated={(hostel) => {
            toast(`${hostel.name} created`);
            setSetupHostel(hostel);
          }}
        />
      )}
      <HostelSetupSheet
        open={!!setupHostel}
        onClose={() => setSetupHostel(null)}
        hostel={setupHostel}
      />
    </div>
  );
}

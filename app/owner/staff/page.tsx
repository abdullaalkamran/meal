"use client";

import { useEffect, useState } from "react";
import { Phone, RefreshCw, UserPlus } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useHostelsByOwner } from "@/hooks/useHostel";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { StarRating } from "@/components/ui/StarRating";
import { AssignStaffSheet } from "@/components/owner/AssignStaffSheet";
import { repo, type Hostel, type Rating, type User } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";

interface StaffInfo {
  manager?: User;
  cook?: User;
  managerRating: { avg: number; count: number };
  cookRating: { avg: number; count: number };
}

const aggregate = (ratings: Rating[], target: Rating["target"]) => {
  const rows = ratings.filter((r) => r.target === target);
  return {
    avg: rows.length > 0 ? rows.reduce((sum, r) => sum + r.stars, 0) / rows.length : 0,
    count: rows.length,
  };
};

export default function OwnerStaffPage() {
  const { user } = useSession();
  const hostels = useHostelsByOwner(user?.id);
  const { toast } = useToast();
  const [info, setInfo] = useState<Record<string, StaffInfo>>({});
  const [assigning, setAssigning] = useState<{ hostel: Hostel; role: "manager" | "cook" } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (hostels.length === 0) return;
    Promise.all(
      hostels.map(async (h) => {
        const [manager, cook, ratings] = await Promise.all([
          repo.users.getUser(h.managerId),
          h.cookId ? repo.users.getUser(h.cookId) : Promise.resolve(undefined),
          repo.ratings.listByHostel(h.id),
        ]);
        return [
          h.id,
          {
            manager,
            cook,
            managerRating: aggregate(ratings, "manager"),
            cookRating: aggregate(ratings, "cook"),
          },
        ] as const;
      })
    ).then((entries) => setInfo(Object.fromEntries(entries)));
  }, [hostels, refreshKey]);

  const staffCard = (
    hostel: Hostel,
    role: "manager" | "cook",
    person: User | undefined,
    rating: { avg: number; count: number },
    extra?: string
  ) => (
    <div className="rounded-btn bg-bg p-3">
      <div className="flex items-center gap-3">
        {person ? (
          <Avatar name={person.name} seed={person.avatarSeed} size={40} />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-text-secondary">
            <Icon icon={UserPlus} size={16} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[9.5px] font-bold uppercase tracking-wide text-text-secondary">
            {role}
          </div>
          <div className="text-[12px] font-extrabold">{person?.name ?? "Not assigned"}</div>
          <div className="text-[10px] font-semibold text-text-secondary">
            {person?.phone ?? "—"}
            {extra ? ` · ${extra}` : ""}
          </div>
        </div>
        {person && (
          <a
            href={`tel:${person.phone}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"
          >
            <Icon icon={Phone} size={15} />
          </a>
        )}
      </div>
      <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2.5">
        <div className="flex items-center gap-2">
          <StarRating value={Math.round(rating.avg)} readOnly size={13} />
          <span className="text-[10px] font-bold text-text-secondary">
            {rating.count > 0
              ? `${rating.avg.toFixed(1)} · ${rating.count} rating${rating.count === 1 ? "" : "s"}`
              : "No ratings yet"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setAssigning({ hostel, role })}
          className="flex items-center gap-1 rounded-pill bg-card px-2.5 py-1.5 text-[10px] font-extrabold text-primary shadow-chip"
        >
          <Icon icon={RefreshCw} size={11} /> {person ? "Replace" : "Assign"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div>
        <div className="text-[17.5px] font-extrabold tracking-tight">Managers &amp; cooks</div>
        <div className="text-[10.5px] font-semibold text-text-secondary">
          Your staff across every hostel — ratings come from boarders
        </div>
      </div>

      {hostels.map((h) => {
        const s = info[h.id];
        return (
          <Card key={h.id}>
            <div className="mb-3 text-[13.5px] font-extrabold">{h.name}</div>
            <div className="flex flex-col gap-2">
              {staffCard(h, "manager", s?.manager, s?.managerRating ?? { avg: 0, count: 0 })}
              {staffCard(
                h,
                "cook",
                s?.cook,
                s?.cookRating ?? { avg: 0, count: 0 },
                h.cookMonthlySalary ? `${formatBDT(h.cookMonthlySalary)}/mo` : undefined
              )}
            </div>
          </Card>
        );
      })}

      <AssignStaffSheet
        open={!!assigning}
        onClose={() => setAssigning(null)}
        hostel={assigning?.hostel ?? null}
        role={assigning?.role ?? "manager"}
        onAssigned={(name) => {
          toast(`${name} assigned`);
          setRefreshKey((k) => k + 1);
        }}
      />
    </div>
  );
}

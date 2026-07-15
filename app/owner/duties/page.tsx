"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { ShoppingCart, Sparkles, ShoppingBag } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useHostelsByOwner } from "@/hooks/useHostel";
import { useDutyPlans } from "@/hooks/useDutyPlans";
import { useUsers } from "@/hooks/useUsers";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { repo, type DutyPlan, type ShoppingCost } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";
import { formatShortDate, today } from "@/lib/utils/date";

/** Read-only view of every member's duty rotations across the owner's
 * hostels — no creation or editing here (that stays with the manager,
 * or the owner via manage mode). */
export default function OwnerDutiesPage() {
  const { user, activeHostelId, switchHostel } = useSession();
  const hostels = useHostelsByOwner(user?.id);
  const plans = useDutyPlans(activeHostelId);
  const users = useUsers(activeHostelId);
  const [history, setHistory] = useState<ShoppingCost[]>([]);

  useEffect(() => {
    if (!activeHostelId) return;
    repo.shoppingCosts.listByHostel(activeHostelId).then((list) =>
      setHistory([...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5))
    );
  }, [activeHostelId]);

  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? id;
  const activePlan = (type: DutyPlan["type"]) =>
    plans.find((p) => p.type === type && p.endDate >= today());

  const renderPlan = (plan: DutyPlan | undefined, label: string, icon: typeof ShoppingCart, tone: string) => (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13.5px] font-extrabold">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full ${tone}`}>
            <Icon icon={icon} size={15} />
          </div>
          {label}
        </div>
        {plan?.budgetPerDay && (
          <span className="text-[10.5px] font-extrabold text-text-secondary">
            {formatBDT(plan.budgetPerDay)}/day
          </span>
        )}
      </div>
      {!plan ? (
        <Card className="text-center text-[11.5px] font-semibold text-text-secondary">
          No active {label.toLowerCase()} rotation.
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {plan.blocks.map((b) => {
            const isToday = b.dates.includes(today());
            const isDone = b.dates[b.dates.length - 1] < today();
            const status = isToday ? "Today" : isDone ? "Done" : "Upcoming";
            const spun = plan.requiresSpin
              ? b.userIds.every((id) => plan.spun[id])
                ? "Spun"
                : "Pending spin"
              : null;
            return (
              <Card key={b.userIds.join("-")} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-bold">{b.userIds.map(nameOf).join(" + ")}</div>
                  <div className="text-[10.5px] font-semibold text-text-secondary">
                    {formatShortDate(b.dates[0])}
                    {b.dates.length > 1 ? ` – ${formatShortDate(b.dates[b.dates.length - 1])}` : ""}
                    {spun ? ` · ${spun}` : ""}
                  </div>
                </div>
                <span
                  className={clsx(
                    "shrink-0 rounded-pill px-2.5 py-1 text-[9.5px] font-extrabold",
                    status === "Today"
                      ? "bg-orange-soft text-orange"
                      : status === "Done"
                        ? "bg-bg text-text-secondary"
                        : "bg-primary-soft text-primary"
                  )}
                >
                  {status}
                </span>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div>
        <div className="text-[17.5px] font-extrabold tracking-tight">Duty rotations</div>
        <div className="text-[10.5px] font-semibold text-text-secondary">
          Who does what, across your hostels — view only
        </div>
      </div>

      {/* Hostel picker */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        {hostels.map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => switchHostel(h.id)}
            className={`shrink-0 rounded-pill px-3.5 py-2 text-[11px] font-extrabold ${
              h.id === activeHostelId ? "bg-primary text-white" : "bg-card text-text-secondary shadow-chip"
            }`}
          >
            {h.name}
          </button>
        ))}
      </div>

      {renderPlan(activePlan("shopping"), "Shopping duty", ShoppingCart, "bg-orange-soft text-orange")}
      {renderPlan(activePlan("cleaning"), "Cleaning duty", Sparkles, "bg-blue-soft text-blue")}

      {history.length > 0 && (
        <div>
          <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
            Recent shopping
          </div>
          <div className="flex flex-col gap-2">
            {history.map((h) => (
              <Card key={h.id} className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-soft text-blue">
                  <Icon icon={ShoppingBag} size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11.5px] font-extrabold">{nameOf(h.userId)}</div>
                  <div className="text-[10px] font-semibold text-text-secondary">
                    {formatShortDate(h.dates[0])}
                    {h.items ? ` · ${h.items} items` : ""}
                  </div>
                </div>
                <div className="text-[12px] font-extrabold">{formatBDT(h.amount)}</div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

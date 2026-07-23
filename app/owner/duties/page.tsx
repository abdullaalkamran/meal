"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { ShoppingCart, Sparkles, ShoppingBag } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { HostelPicker } from "@/components/hostel/HostelPicker";
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
  const { activeHostelId } = useSession();
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
          {plan.blocks.map((b, i) => {
            const claimed = b.userIds.length > 0;
            const isToday = b.dates.includes(today());
            const isDone = b.dates[b.dates.length - 1] < today();
            const status = isToday ? "Today" : isDone ? "Done" : "Upcoming";
            // For a spin rotation an unclaimed slot has no one yet.
            const note = plan.requiresSpin && !claimed ? "Not claimed yet" : null;
            return (
              <Card key={i} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-bold">
                    {claimed ? b.userIds.map(nameOf).join(" + ") : "Open slot"}
                  </div>
                  <div className="text-[10.5px] font-semibold text-text-secondary">
                    {formatShortDate(b.dates[0])}
                    {b.dates.length > 1 ? ` – ${formatShortDate(b.dates[b.dates.length - 1])}` : ""}
                    {note ? ` · ${note}` : ""}
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

      <HostelPicker />

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

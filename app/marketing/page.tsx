"use client";

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { useMarketingTargets } from "@/hooks/useMarketingTargets";
import { useCommunityPosts } from "@/hooks/useCommunityPosts";
import { TargetEditSheet } from "@/components/marketing/TargetEditSheet";
import { repo, type Bill, type Hostel, type User } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";
import { currentMonth, formatMonthLabel } from "@/lib/utils/date";

type MetricRow = { key: string; label: string; actual: number; money?: boolean };

export default function MarketingKpiPage() {
  const month = currentMonth();
  const targets = useMarketingTargets(month);
  const posts = useCommunityPosts();
  const [users, setUsers] = useState<User[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [exploreCount, setExploreCount] = useState(0);
  const [edit, setEdit] = useState<MetricRow | null>(null);

  useEffect(() => {
    (async () => {
      const [us, hs] = await Promise.all([repo.users.listAll(), repo.hostels.listAll()]);
      setUsers(us);
      setHostels(hs);
      const billLists = await Promise.all(hs.map((h) => repo.bills.listByHostel(h.id, month)));
      setBills(billLists.flat());
      const interactionLists = await Promise.all(us.map((u) => repo.exploreInteractions.listByUser(u.id)));
      setExploreCount(interactionLists.flat().length);
    })();
  }, [month]);

  const engagement = posts.reduce((sum, p) => sum + 1 + p.likeUserIds.length, 0);
  const metrics: MetricRow[] = [
    { key: "users", label: "Total users", actual: users.length },
    { key: "signups", label: "New signups", actual: users.filter((u) => u.joinedAt?.startsWith(month)).length },
    { key: "hostels", label: "Active hostels", actual: hostels.filter((h) => !h.suspended).length },
    { key: "engagement", label: "Community engagement", actual: engagement },
    { key: "explore", label: "Explore actions", actual: exploreCount },
    { key: "revenue", label: "Revenue collected", actual: bills.reduce((s, b) => s + b.paid, 0), money: true },
  ];

  const targetOf = (key: string) => targets.find((t) => t.metric === key)?.target ?? 0;

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div>
        <div className="text-[17.5px] font-extrabold tracking-tight">Marketing KPIs</div>
        <div className="text-[10.5px] font-semibold text-text-secondary">{formatMonthLabel(month)} · tap a card to set its target</div>
      </div>

      <div className="flex flex-col gap-2.5">
        {metrics.map((m) => {
          const target = targetOf(m.key);
          const pct = target > 0 ? Math.min(100, Math.round((m.actual / target) * 100)) : 0;
          const fmt = (n: number) => (m.money ? formatBDT(n) : String(n));
          return (
            <Card key={m.key}>
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <div className="text-[11px] font-bold text-text-secondary">{m.label}</div>
                  <div className="text-[18px] font-extrabold">
                    {fmt(m.actual)}
                    <span className="text-[11px] font-bold text-text-secondary">
                      {" "}/ {target > 0 ? fmt(target) : "no target"}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEdit(m)}
                  aria-label={`Set ${m.label} target`}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-bg text-text-secondary"
                >
                  <Icon icon={Pencil} size={13} />
                </button>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-pill bg-bg">
                <div
                  className={`h-2 rounded-pill ${pct >= 100 ? "bg-primary" : pct >= 60 ? "bg-blue" : "bg-orange"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-1 text-right text-[9.5px] font-extrabold text-text-secondary">
                {target > 0 ? `${pct}% of target` : "Set a target to track progress"}
              </div>
            </Card>
          );
        })}
      </div>

      <TargetEditSheet
        open={!!edit}
        onClose={() => setEdit(null)}
        metricKey={edit?.key ?? ""}
        metricLabel={edit?.label ?? ""}
        month={month}
        current={edit ? targetOf(edit.key) : 0}
      />
    </div>
  );
}

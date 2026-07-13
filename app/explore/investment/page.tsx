"use client";

import { useState } from "react";
import { Bookmark, TrendingUp } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useExploreInteractions } from "@/hooks/useExploreInteractions";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { ExploreHeader } from "@/components/explore/ExploreHeader";
import { repo } from "@/lib/data";
import { INVESTMENTS } from "@/lib/explore/content";
import { formatBDT } from "@/lib/utils/currency";

const RISK_TONE: Record<string, string> = {
  Low: "bg-primary-soft text-primary",
  Medium: "bg-orange-soft text-orange",
  High: "bg-danger-soft text-danger",
};

export default function InvestmentPage() {
  const { user } = useSession();
  const interactions = useExploreInteractions(user?.id);
  const { toast } = useToast();
  const [monthly, setMonthly] = useState("2000");
  const [years, setYears] = useState("5");
  const [rate, setRate] = useState("12");

  const saved = new Set(
    interactions.filter((i) => i.feature === "investment" && i.kind === "saved").map((i) => i.itemId)
  );

  // Future value of a monthly SIP: FV = P × [((1+i)^n − 1) / i], i = monthly rate.
  const P = Number(monthly) || 0;
  const n = (Number(years) || 0) * 12;
  const i = (Number(rate) || 0) / 100 / 12;
  const futureValue = i > 0 ? P * ((Math.pow(1 + i, n) - 1) / i) : P * n;
  const invested = P * n;
  const profit = futureValue - invested;

  const save = async (id: string, name: string) => {
    if (!user) return;
    const was = saved.has(id);
    await repo.exploreInteractions.toggle(user.id, "investment", id, "saved");
    toast(was ? "Removed from saved" : `Saved ${name}`);
  };

  return (
    <div className="flex flex-col gap-5 pb-4">
      <ExploreHeader title="Investment" subtitle="Grow your savings" />

      {/* Live returns calculator */}
      <Card>
        <div className="mb-3 flex items-center gap-2 text-[13.5px] font-extrabold">
          <Icon icon={TrendingUp} size={16} className="text-primary" /> Returns calculator
        </div>
        <div className="mb-3 grid grid-cols-3 gap-2.5">
          {[
            { label: "৳ / month", value: monthly, set: setMonthly },
            { label: "Years", value: years, set: setYears },
            { label: "Return %", value: rate, set: setRate },
          ].map((f) => (
            <label key={f.label} className="min-w-0">
              <div className="mb-1 text-[9px] font-bold text-text-secondary">{f.label.toUpperCase()}</div>
              <input
                type="number"
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                className="w-full rounded-btn border border-border bg-transparent px-2.5 py-2 text-[12px] font-extrabold"
              />
            </label>
          ))}
        </div>
        <div className="rounded-btn bg-primary-soft p-3">
          <div className="text-[9px] font-bold text-text-secondary">FUTURE VALUE</div>
          <div className="text-[20px] font-extrabold text-primary">{formatBDT(futureValue)}</div>
          <div className="text-[10px] font-semibold text-text-secondary">
            Invested {formatBDT(invested)} · Profit {formatBDT(profit)}
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-2.5">
        {INVESTMENTS.map((inv) => {
          const isSaved = saved.has(inv.id);
          return (
            <Card key={inv.id} className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[12.5px] font-extrabold">{inv.name}</div>
                  <div className="text-[10.5px] font-semibold text-text-secondary">{inv.provider}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[13px] font-extrabold text-primary">
                    {(inv.annualReturn * 100).toFixed(0)}%
                  </div>
                  <div className="text-[8.5px] font-bold text-text-secondary">/ year</div>
                </div>
              </div>
              <div className="text-[10px] font-semibold text-text-secondary">{inv.note}</div>
              <div className="flex items-center gap-2">
                <span className={`rounded-pill px-2 py-0.5 text-[9px] font-extrabold ${RISK_TONE[inv.risk]}`}>
                  {inv.risk} risk
                </span>
                <span className="text-[9.5px] font-semibold text-text-secondary">
                  Min {formatBDT(inv.minAmount)}
                </span>
                <button type="button" onClick={() => save(inv.id, inv.name)} className="ml-auto">
                  <Chip tone="primary" active={isSaved}>
                    <span className="flex items-center gap-1">
                      <Icon icon={Bookmark} size={11} /> {isSaved ? "Saved" : "Save"}
                    </span>
                  </Chip>
                </button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

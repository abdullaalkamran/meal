"use client";

import { useState } from "react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useUsers } from "@/hooks/useUsers";
import { useDutyPlans } from "@/hooks/useDutyPlans";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { Calendar } from "@/components/ui/Calendar";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { repo } from "@/lib/data";
import { buildOpenBlocks } from "@/lib/duty";
import { today } from "@/lib/utils/date";
import { PermissionGate } from "@/components/manager/PermissionGate";
import { ActivityTimeline } from "@/components/hostel/ActivityTimeline";

function ManagerShoppingDutyPage() {
  const { activeHostelId } = useSession();
  const users = useUsers(activeHostelId);
  const plans = useDutyPlans(activeHostelId);
  const { toast } = useToast();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rangeStart, setRangeStart] = useState<string | undefined>(undefined);
  const [rangeEnd, setRangeEnd] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [budgetPerDay, setBudgetPerDay] = useState("2500");
  const [mode, setMode] = useState<"individual" | "companion">("companion");

  const eligible = users.filter((u) => u.role !== "cook" && u.role !== "owner");
  const activePlan = plans.find((p) => p.type === "shopping" && p.endDate >= today());

  const onSelectDate = (date: string) => {
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(date);
      setRangeEnd(undefined);
    } else if (date < rangeStart) {
      setRangeStart(date);
    } else {
      setRangeEnd(date);
    }
  };

  const toggleMember = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(
      selected.size === eligible.length ? new Set() : new Set(eligible.map((u) => u.id))
    );
  };

  const create = async () => {
    if (!activeHostelId || !rangeStart || !rangeEnd || selected.size < 2) return;
    const memberIds = [...selected];
    const groupSize = mode === "companion" ? 2 : 1;
    // Empty date slots — members claim one by spinning. One slot per member
    // (individual) or per pair (companion).
    const blockCount = groupSize === 2 ? Math.ceil(memberIds.length / 2) : memberIds.length;
    const blocks = buildOpenBlocks(rangeStart, rangeEnd, blockCount);
    await repo.duties.createPlan({
      hostelId: activeHostelId,
      type: "shopping",
      requiresSpin: true,
      startDate: rangeStart,
      endDate: rangeEnd,
      memberIds,
      blocks,
      groupSize,
      budgetPerDay: Number(budgetPerDay) || undefined,
    });
    toast("Shopping duty rotation created — spin-the-wheel announcement sent");
    setRangeStart(undefined);
    setRangeEnd(undefined);
    setSelected(new Set());
  };

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="text-[17.5px] font-extrabold tracking-tight">Set Shopping Duty</div>

      <Card>
        <div className="mb-3 text-[11.5px] font-extrabold text-text-secondary uppercase tracking-wide">
          Duty mode
        </div>
        <SegmentedControl
          value={mode}
          onChange={setMode}
          options={[
            { value: "individual", label: "Individual" },
            { value: "companion", label: "Companion (2)" },
          ]}
        />
        <div className="mt-2 text-[10.5px] font-semibold text-text-secondary">
          {mode === "companion"
            ? "Members are paired up — each pair shares a duty block together."
            : "Each member gets their own duty block, solo."}
        </div>
      </Card>

      <Card>
        <div className="mb-3 text-[11.5px] font-extrabold text-text-secondary uppercase tracking-wide">
          Date range
        </div>
        <Calendar
          year={year}
          month={month}
          onMonthChange={(y, m) => {
            setYear(y);
            setMonth(m);
          }}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          onSelectDate={onSelectDate}
        />
      </Card>

      <Card className="flex items-center justify-between">
        <div className="text-[12px] font-bold">Budget per day</div>
        <div className="flex items-center gap-1">
          <span className="text-[12px] font-extrabold text-text-secondary">৳</span>
          <input
            type="number"
            value={budgetPerDay}
            onChange={(e) => setBudgetPerDay(e.target.value)}
            className="w-20 rounded-btn border border-border bg-transparent px-2 py-1.5 text-right text-[12px] font-extrabold"
          />
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[11.5px] font-extrabold text-text-secondary uppercase tracking-wide">
            Members
          </div>
          <button type="button" onClick={selectAll} className="text-[11px] font-extrabold text-primary">
            {selected.size === eligible.length ? "Deselect all" : "Select all"}
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {eligible.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => toggleMember(u.id)}
              className="flex items-center justify-between rounded-btn bg-bg px-3 py-2.5"
            >
              <div className="text-[12px] font-bold">{u.name}</div>
              <Chip tone="primary" active={selected.has(u.id)}>
                {selected.has(u.id) ? "Selected" : "Select"}
              </Chip>
            </button>
          ))}
        </div>
      </Card>

      <Button
        fullWidth
        onClick={create}
        disabled={!rangeStart || !rangeEnd || selected.size < 2}
      >
        Create rotation & notify members
      </Button>

      {activePlan && (
        <Card>
          <div className="mb-1 text-[13.5px] font-extrabold">Rotation slots</div>
          <div className="mb-3 text-[10px] font-semibold text-text-secondary">
            Members claim a slot by spinning the wheel — nobody&rsquo;s dates are set until they spin.
          </div>
          <div className="flex flex-col gap-2">
            {activePlan.blocks.map((b, i) => {
              const claimed = b.userIds.length > 0;
              const names = b.userIds
                .map((id) => users.find((u) => u.id === id)?.name ?? id)
                .join(" + ");
              return (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-btn bg-bg px-3 py-2.5"
                >
                  <div>
                    <div className="text-[12px] font-bold">{claimed ? names : "Not claimed yet"}</div>
                    <div className="text-[10.5px] font-semibold text-text-secondary">
                      {b.dates[0]} → {b.dates[b.dates.length - 1]}
                    </div>
                  </div>
                  <Chip tone={claimed ? "primary" : "orange"} active>
                    {claimed ? "Claimed" : "Open"}
                  </Chip>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <ActivityTimeline hostelId={activeHostelId} category="shopping" title="Shopping activity" />
    </div>
  );
}

// Owner-configured permission gate: real managers need the "duties" flag.
export default function GatedManagerShoppingDutyPage() {
  return (
    <PermissionGate permission="duties" label="Duty rotation setup">
      <ManagerShoppingDutyPage />
    </PermissionGate>
  );
}

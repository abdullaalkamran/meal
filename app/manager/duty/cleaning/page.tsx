"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useUsers } from "@/hooks/useUsers";
import { useDutyPlans } from "@/hooks/useDutyPlans";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { Calendar } from "@/components/ui/Calendar";
import { Icon } from "@/components/ui/Icon";
import { repo } from "@/lib/data";
import { buildFixedBlocks } from "@/lib/duty";
import { today } from "@/lib/utils/date";

export default function ManagerCleaningDutyPage() {
  const { activeHostelId } = useSession();
  const users = useUsers(activeHostelId);
  const plans = useDutyPlans(activeHostelId);
  const { toast } = useToast();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [startDate, setStartDate] = useState(today());
  const [daysPerMember, setDaysPerMember] = useState(3);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const eligible = users.filter((u) => u.role !== "cook");
  const activePlan = plans.find((p) => p.type === "cleaning" && p.endDate >= today());

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
    if (!activeHostelId || selected.size < 2) return;
    const memberIds = [...selected];
    const blocks = buildFixedBlocks(startDate, daysPerMember, memberIds);
    const endDate = blocks[blocks.length - 1].dates.at(-1) ?? startDate;
    await repo.duties.createPlan({
      hostelId: activeHostelId,
      type: "cleaning",
      requiresSpin: false,
      startDate,
      endDate,
      memberIds,
      blocks,
    });
    toast("Cleaning duty rotation created");
    setSelected(new Set());
  };

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="text-[17.5px] font-extrabold tracking-tight">Set Cleaning Duty</div>

      <Card>
        <div className="mb-3 text-[11.5px] font-extrabold text-text-secondary uppercase tracking-wide">
          Start date
        </div>
        <Calendar
          year={year}
          month={month}
          onMonthChange={(y, m) => {
            setYear(y);
            setMonth(m);
          }}
          selectedDate={startDate}
          onSelectDate={setStartDate}
        />
      </Card>

      <Card className="flex items-center justify-between">
        <div className="text-[12px] font-bold">Days per member</div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDaysPerMember((d) => Math.max(1, d - 1))}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-border"
          >
            <Icon icon={Minus} size={14} />
          </button>
          <div className="w-6 text-center text-[13.5px] font-extrabold">{daysPerMember}</div>
          <button
            type="button"
            onClick={() => setDaysPerMember((d) => Math.min(15, d + 1))}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-border"
          >
            <Icon icon={Plus} size={14} />
          </button>
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

      <Button fullWidth onClick={create} disabled={selected.size < 2}>
        Create rotation
      </Button>

      {activePlan && (
        <Card>
          <div className="mb-3 text-[13.5px] font-extrabold">Rotation preview</div>
          <div className="flex flex-col gap-2">
            {activePlan.blocks.map((b) => {
              const member = users.find((u) => u.id === b.userId);
              return (
                <div
                  key={b.userId}
                  className="flex items-center justify-between rounded-btn bg-bg px-3 py-2.5"
                >
                  <div className="text-[12px] font-bold">{member?.name ?? b.userId}</div>
                  <div className="text-[10.5px] font-semibold text-text-secondary">
                    {b.dates[0]} → {b.dates[b.dates.length - 1]}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

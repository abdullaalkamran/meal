"use client";

import { useState } from "react";
import { ChevronDown, History } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { useActivity } from "@/hooks/useActivity";
import { formatMonthLabel, formatRelativeTime } from "@/lib/utils/date";
import type { ActivityCategory } from "@/lib/data";

/** A click-to-expand "who did what, when" trail for one section of the app
 * (meals / bill / shopping). Since the manager role can change hands, this keeps
 * everyone accountable — every member can see who made each change and when.
 * When `month` (YYYY-MM) is given, it tracks that page's month filter and shows
 * only actions logged in that month. */
export function ActivityTimeline({
  hostelId,
  category,
  title = "Activity history",
  month,
}: {
  hostelId: string | undefined;
  category: ActivityCategory;
  title?: string;
  month?: string;
}) {
  const [open, setOpen] = useState(false);
  const logs = useActivity(hostelId).filter(
    (l) => l.category === category && (!month || l.createdAt.slice(0, 7) === month)
  );

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-bg text-text-secondary">
            <Icon icon={History} size={15} />
          </div>
          <div className="text-left">
            <div className="text-[13px] font-extrabold">{title}</div>
            <div className="text-[9.5px] font-semibold text-text-secondary">
              Who changed what, and when{month ? ` · ${formatMonthLabel(month)}` : ""}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {logs.length > 0 && (
            <span className="rounded-pill bg-bg px-2 py-0.5 text-[9.5px] font-extrabold text-text-secondary">
              {logs.length}
            </span>
          )}
          <Icon
            icon={ChevronDown}
            size={16}
            className={`text-text-secondary transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {open && (
        <div className="mt-3 border-t border-border pt-3">
          {logs.length === 0 ? (
            <div className="py-2 text-center text-[10.5px] font-semibold text-text-secondary">
              {month ? `No activity in ${formatMonthLabel(month)}.` : "No activity recorded yet."}
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {logs.slice(0, 60).map((l) => (
                <div key={l.id} className="flex items-start gap-2.5">
                  <Avatar name={l.actorName} size={26} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11.5px] font-extrabold leading-tight">{l.action}</div>
                    {l.detail && (
                      <div className="text-[10px] font-semibold text-text-secondary">{l.detail}</div>
                    )}
                    <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-text-secondary">
                      {l.actorName} · {formatRelativeTime(l.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

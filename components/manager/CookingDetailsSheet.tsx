"use client";

import { Sheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import { MEAL_LABEL } from "@/lib/mealColors";
import type { CookAttendanceReport, MealSlot } from "@/lib/data";
import { formatDayMonth } from "@/lib/utils/date";

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/** Per-meal drill-down for the Cooking Count page — the live dispute vote
 * tally when a meal's still being argued over, or a plain resolved/awaiting
 * summary otherwise. Read-only; no actions live here. */
export function CookingDetailsSheet({
  open,
  onClose,
  meal,
  date,
  offered,
  report,
  votes,
  count,
  totalBoarders,
}: {
  open: boolean;
  onClose: () => void;
  meal: MealSlot;
  date: string;
  offered: boolean;
  report: CookAttendanceReport | undefined;
  votes: { yes: number; no: number; dk: number };
  count: number;
  totalBoarders: number;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={`${MEAL_LABEL[meal]} · ${formatDayMonth(date)}`}>
      <div className="flex flex-col gap-3">
        {!offered && <Chip>Not offered — doesn&rsquo;t count</Chip>}

        {offered && !report && (
          <Chip tone="orange" active>
            Awaiting confirmation — not counted yet
          </Chip>
        )}

        {report?.status === "reported" && (
          <div>
            <div className="mb-2 text-[11px] font-bold text-text-secondary">
              Was it cooked? — live tally
            </div>
            <div className="flex gap-2">
              <Chip tone="primary" active>
                Yes {votes.yes}
              </Chip>
              <Chip tone="danger" active>
                No {votes.no}
              </Chip>
              <Chip>Don&rsquo;t know {votes.dk}</Chip>
            </div>
          </div>
        )}

        {report?.status === "confirmed_absent" && (
          <div>
            <Chip tone="danger" active>
              Cancelled — cook absent
            </Chip>
            {report.resolvedAt && (
              <div className="mt-2 text-[10.5px] font-semibold text-text-secondary">
                Confirmed at {formatTime(report.resolvedAt)}
              </div>
            )}
          </div>
        )}

        {report?.status === "resolved_cooked" && (
          <div>
            <Chip tone="primary" active>
              Cooked ✓
            </Chip>
            {report.resolvedAt && (
              <div className="mt-2 text-[10.5px] font-semibold text-text-secondary">
                Completed at {formatTime(report.resolvedAt)}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border pt-3 text-[11.5px] font-bold">
          <div className="text-text-secondary">Heads to cook for</div>
          <div>
            {count} of {totalBoarders} boarders{count > totalBoarders ? " (incl. guests)" : ""}
          </div>
        </div>
      </div>
    </Sheet>
  );
}

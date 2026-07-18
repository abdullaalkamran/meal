"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useMealDay } from "@/hooks/useMealDay";
import { useCookAttendanceForDate } from "@/hooks/useCookAttendance";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { repo, type CookAttendanceReport, type CookAttendanceVote, type MealDay, type MealSlot } from "@/lib/data";
import { addDays, formatShortDate, today } from "@/lib/utils/date";

const MEAL_LABEL: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

const HISTORY_DAYS = 14;
const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];

interface HistoryRow {
  date: string;
  total: number;
  cancelledMeals: MealSlot[];
}

function buildHistory(days: MealDay[], reports: CookAttendanceReport[]): HistoryRow[] {
  return days
    .map((d) => {
      const entries = Object.values(d.entries);
      const total = MEAL_SLOTS.reduce(
        (sum, meal) => sum + entries.reduce((s, e) => s + ((e[meal].on ? 1 : 0) + e[meal].guestCount), 0),
        0
      );
      const cancelledMeals = MEAL_SLOTS.filter((meal) =>
        reports.some((r) => r.date === d.date && r.meal === meal && r.status === "confirmed_absent")
      );
      return { date: d.date, total, cancelledMeals };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Today's cooking counts + attendance flow + 14-day history, shared by the
 * manager page and the owner's read-only view (`readOnly` hides the mark-
 * cooked / report / confirm actions but keeps counts and tallies visible). */
export function CookingCountScreen({ readOnly }: { readOnly?: boolean }) {
  const { user, activeHostelId } = useSession();
  const date = today();
  const { day } = useMealDay(activeHostelId, date);
  const reports = useCookAttendanceForDate(activeHostelId, date);
  const [votesByReport, setVotesByReport] = useState<Record<string, CookAttendanceVote[]>>({});
  const [history, setHistory] = useState<HistoryRow[]>([]);

  useEffect(() => {
    const reported = reports.filter((r) => r.status === "reported");
    Promise.all(
      reported.map(async (r) => [r.id, await repo.cookAttendance.listVotes(r.id)] as const)
    ).then((entries) => setVotesByReport(Object.fromEntries(entries)));
  }, [reports]);

  useEffect(() => {
    if (!activeHostelId) return;
    const from = addDays(date, -HISTORY_DAYS);
    const to = addDays(date, -1);
    Promise.all([
      repo.meals.listMealDays(activeHostelId, { from, to }),
      repo.cookAttendance.listByHostel(activeHostelId),
    ]).then(([days, allReports]) => setHistory(buildHistory(days, allReports)));
  }, [activeHostelId, date]);

  const mealCounts = (["breakfast", "lunch", "dinner"] as MealSlot[]).map((meal) => {
    const entries = day ? Object.values(day.entries) : [];
    const totalBoarders = entries.length;
    const boardersOn = entries.filter((e) => e[meal].on).length;
    // "count" is heads to actually cook for (boarders + their guests) — can
    // exceed totalBoarders, so the percentage is based on boarders-on only.
    const count = entries.reduce((sum, e) => sum + ((e[meal].on ? 1 : 0) + e[meal].guestCount), 0);
    const pct = totalBoarders > 0 ? Math.round((boardersOn / totalBoarders) * 100) : 0;
    return { meal, count, pct };
  });
  const totalToCook = mealCounts.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="text-[17.5px] font-extrabold tracking-tight">
        Cooking Count
        {readOnly && (
          <span className="ml-2 align-middle text-[10.5px] font-semibold text-text-secondary">
            view only
          </span>
        )}
      </div>

      <Card className="flex items-center justify-between">
        <div className="text-[11.5px] font-bold text-text-secondary">Total to cook today</div>
        <div className="text-[20.5px] font-extrabold">{totalToCook}</div>
      </Card>

      {mealCounts.map(({ meal, count, pct }) => {
        const report = reports.find((r) => r.meal === meal);
        const votes = report ? votesByReport[report.id] ?? [] : [];
        const yes = votes.filter((v) => v.choice === "yes").length;
        const no = votes.filter((v) => v.choice === "no").length;
        const dk = votes.filter((v) => v.choice === "dk").length;

        return (
          <Card key={meal}>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[13.5px] font-extrabold">{MEAL_LABEL[meal]}</div>
              <div className="text-[11.5px] font-bold text-text-secondary">{count} · {pct}%</div>
            </div>
            <div className="mb-3 h-2 w-full rounded-pill bg-bg">
              <div className="h-2 rounded-pill bg-primary" style={{ width: `${pct}%` }} />
            </div>

            {!report && !readOnly && (
              <div className="flex gap-2">
                <Button
                  fullWidth
                  onClick={() => activeHostelId && repo.cookAttendance.markCooked(activeHostelId, date, meal)}
                >
                  Cooked
                </Button>
                <Button
                  fullWidth
                  variant="secondary"
                  onClick={() =>
                    activeHostelId &&
                    user &&
                    repo.cookAttendance.report({
                      hostelId: activeHostelId,
                      date,
                      meal,
                      status: "reported",
                      reportedBy: user.id,
                    })
                  }
                >
                  Reported not cooked
                </Button>
              </div>
            )}

            {report?.status === "reported" && (
              <div>
                <div className="mb-2 text-[11px] font-bold text-text-secondary">
                  Was it cooked? — live tally
                </div>
                <div className={`flex gap-2 ${readOnly ? "" : "mb-3"}`}>
                  <Chip tone="primary" active>
                    Yes {yes}
                  </Chip>
                  <Chip tone="danger" active>
                    No {no}
                  </Chip>
                  <Chip>Don&rsquo;t know {dk}</Chip>
                </div>
                {!readOnly && (
                  <div className="flex gap-2">
                    <Button
                      fullWidth
                      onClick={() => activeHostelId && repo.cookAttendance.markCooked(activeHostelId, date, meal)}
                    >
                      Confirm cooked
                    </Button>
                    <Button
                      fullWidth
                      variant="danger"
                      onClick={() => repo.cookAttendance.confirmAbsent(report.id)}
                    >
                      Confirm cook absent
                    </Button>
                  </div>
                )}
              </div>
            )}

            {report?.status === "confirmed_absent" && (
              <Chip tone="danger" active>
                Cancelled — cook absent
              </Chip>
            )}
            {report?.status === "resolved_cooked" && (
              <Chip tone="primary" active>
                Cooked ✓
              </Chip>
            )}
          </Card>
        );
      })}

      <div>
        <div className="mb-2 text-[13.5px] font-extrabold">Cooking history</div>
        <div className="flex flex-col gap-2">
          {history.length === 0 && (
            <Card className="text-center text-[11.5px] font-semibold text-text-secondary">
              No past records yet.
            </Card>
          )}
          {history.map((h) => (
            <Card key={h.date} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[12px] font-bold">{formatShortDate(h.date)}</div>
                {h.cancelledMeals.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {h.cancelledMeals.map((m) => (
                      <Chip key={m} tone="danger" active>
                        {MEAL_LABEL[m]} cancelled
                      </Chip>
                    ))}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-[12px] font-extrabold">{h.total} meals</div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

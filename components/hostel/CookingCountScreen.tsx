"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useMealDay } from "@/hooks/useMealDay";
import { useCookAttendanceForDate } from "@/hooks/useCookAttendance";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { BulkConfirmCookedSheet } from "@/components/manager/BulkConfirmCookedSheet";
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
  // Offered that day but never confirmed cooked, marked absent, or disputed —
  // still zero everywhere (cooking count, meal rate, bills) until decided.
  unconfirmedMeals: MealSlot[];
}

function buildHistory(days: MealDay[], reports: CookAttendanceReport[]): HistoryRow[] {
  return days
    .map((d) => {
      const entries = Object.values(d.entries);
      // Same gate as the live count and billing: a slot nobody confirmed
      // cooked contributes nothing to the history total either, so this
      // number always matches what actually got billed.
      const total = MEAL_SLOTS.reduce((sum, meal) => {
        const confirmed = reports.some(
          (r) => r.date === d.date && r.meal === meal && r.status === "resolved_cooked"
        );
        if (!confirmed) return sum;
        return sum + entries.reduce((s, e) => s + ((e[meal].on ? 1 : 0) + e[meal].guestCount), 0);
      }, 0);
      const cancelledMeals = MEAL_SLOTS.filter((meal) =>
        reports.some((r) => r.date === d.date && r.meal === meal && r.status === "confirmed_absent")
      );
      const unconfirmedMeals = MEAL_SLOTS.filter((meal) => {
        const offered = d.mealsOffered?.[meal] ?? true;
        if (!offered) return false;
        return !reports.some((r) => r.date === d.date && r.meal === meal);
      });
      return { date: d.date, total, cancelledMeals, unconfirmedMeals };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Today's cooking counts + attendance flow + 14-day history, shared by the
 * manager page and the owner's read-only view (`readOnly` hides the mark-
 * cooked / report / confirm actions but keeps counts and tallies visible). */
export function CookingCountScreen({ readOnly }: { readOnly?: boolean }) {
  const { user, activeHostelId } = useSession();
  // Defaults to today, but any earlier date can be opened so a day whose
  // cooking was never confirmed isn't lost when the date rolls over.
  const [date, setDate] = useState(today());
  const isToday = date === today();
  const { day } = useMealDay(activeHostelId, date);
  const reports = useCookAttendanceForDate(activeHostelId, date);
  const [votesByReport, setVotesByReport] = useState<Record<string, CookAttendanceVote[]>>({});
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyKey, setHistoryKey] = useState(0);
  const [bulkOpen, setBulkOpen] = useState(false);
  const { toast } = useToast();

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
  }, [activeHostelId, date, historyKey]);

  const unconfirmedDayCount = history.filter((h) => h.unconfirmedMeals.length > 0).length;

  const mealCounts = (["breakfast", "lunch", "dinner"] as MealSlot[]).map((meal) => {
    const entries = day ? Object.values(day.entries) : [];
    // A slot the hostel didn't offer THAT DAY is cooked for nobody.
    const offered = day?.mealsOffered?.[meal] ?? true;
    // Nothing counts — for cooking count OR billing — until a manager has
    // confirmed this exact slot was actually cooked. A member's own on/off
    // toggle only decides who's IN the count once it's confirmed; it never
    // counts on its own.
    const confirmed = reports.some((r) => r.meal === meal && r.status === "resolved_cooked");
    const totalBoarders = entries.length;
    const boardersOn = offered && confirmed ? entries.filter((e) => e[meal].on).length : 0;
    // "count" is heads to actually cook for (boarders + their guests) — can
    // exceed totalBoarders, so the percentage is based on boarders-on only.
    const count = offered && confirmed
      ? entries.reduce((sum, e) => sum + ((e[meal].on ? 1 : 0) + e[meal].guestCount), 0)
      : 0;
    const pct = totalBoarders > 0 ? Math.round((boardersOn / totalBoarders) * 100) : 0;
    return { meal, count, pct, offered, confirmed };
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

      {/* Any past day can be opened to review or confirm cooking that was
          missed; you can't look ahead past today. */}
      <Card className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setDate(addDays(date, -1))}
          className="min-h-9 rounded-btn bg-bg px-3 text-[11px] font-extrabold text-text-secondary"
        >
          ‹ Prev
        </button>
        <div className="text-center">
          <div className="text-[12.5px] font-extrabold">
            {isToday ? "Today" : formatShortDate(date)}
          </div>
          {!isToday && (
            <button
              type="button"
              onClick={() => setDate(today())}
              className="text-[9.5px] font-bold text-primary"
            >
              Back to today
            </button>
          )}
        </div>
        <button
          type="button"
          disabled={isToday}
          onClick={() => setDate(addDays(date, 1))}
          className="min-h-9 rounded-btn bg-bg px-3 text-[11px] font-extrabold text-text-secondary disabled:opacity-40"
        >
          Next ›
        </button>
      </Card>

      {!readOnly && unconfirmedDayCount > 0 && (
        <Card className="flex items-center gap-3 border border-orange/30 bg-orange-soft">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-orange">
            <Icon icon={AlertTriangle} size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-extrabold text-orange">
              {unconfirmedDayCount} day{unconfirmedDayCount === 1 ? "" : "s"} in the last {HISTORY_DAYS} need
              confirmation
            </div>
            <div className="text-[9.5px] font-semibold text-orange/80">
              Unconfirmed meals count as zero everywhere — cooking count, meal rate, and bills.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setBulkOpen(true)}
            className="shrink-0 rounded-btn bg-orange px-3 py-2 text-[10.5px] font-extrabold text-white"
          >
            Bulk confirm
          </button>
        </Card>
      )}

      <Card className="flex items-center justify-between">
        <div className="text-[11.5px] font-bold text-text-secondary">
          Total to cook {isToday ? "today" : `on ${formatShortDate(date)}`}
        </div>
        <div className="text-[20.5px] font-extrabold">{totalToCook}</div>
      </Card>

      {mealCounts.map(({ meal, count, pct, offered }) => {
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

            {!offered && (
              <Chip>Not offered — doesn&rsquo;t count</Chip>
            )}

            {offered && !report && (
              <div className="mb-2">
                <Chip tone="orange" active>
                  Awaiting confirmation — not counted yet
                </Chip>
              </div>
            )}

            {offered && !report && !readOnly && (
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
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[13.5px] font-extrabold">Cooking history</div>
          {!readOnly && (
            <button
              type="button"
              onClick={() => setBulkOpen(true)}
              className="text-[11px] font-extrabold text-primary"
            >
              Bulk confirm
            </button>
          )}
        </div>
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
                {(h.cancelledMeals.length > 0 || h.unconfirmedMeals.length > 0) && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {h.cancelledMeals.map((m) => (
                      <Chip key={m} tone="danger" active>
                        {MEAL_LABEL[m]} cancelled
                      </Chip>
                    ))}
                    {h.unconfirmedMeals.map((m) => (
                      <Chip key={m} tone="orange" active>
                        {MEAL_LABEL[m]} unconfirmed
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

      {!readOnly && (
        <BulkConfirmCookedSheet
          open={bulkOpen}
          onClose={() => setBulkOpen(false)}
          hostelId={activeHostelId}
          onConfirmed={(count) => {
            toast(count > 0 ? `${count} meal${count === 1 ? "" : "s"} confirmed cooked` : "Nothing new to confirm");
            setHistoryKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

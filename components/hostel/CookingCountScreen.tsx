"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Calendar, ChevronDown, FileText, SlidersHorizontal } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useMealDay } from "@/hooks/useMealDay";
import { useCookAttendanceForDate } from "@/hooks/useCookAttendance";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { useToast } from "@/components/ui/Toast";
import { BulkConfirmCookedSheet } from "@/components/manager/BulkConfirmCookedSheet";
import { CookingDetailsSheet } from "@/components/manager/CookingDetailsSheet";
import { CookingPotIllustration } from "@/components/hostel/CookingPotIllustration";
import { MEAL_COLORS, MEAL_LABEL } from "@/lib/mealColors";
import { repo, type CookAttendanceReport, type CookAttendanceVote, type MealDay, type MealSlot } from "@/lib/data";
import { addDays, formatShortDate, today } from "@/lib/utils/date";

const HISTORY_DAYS = 14;
const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];

// Meal-branded colors for the ring/pill/border accents — same hues as
// MEAL_COLORS elsewhere in the app, just as raw CSS colors (an SVG stroke/
// inline style can't consume a Tailwind text-color class).
const MEAL_ACCENT: Record<MealSlot, string> = {
  breakfast: "#16A34A",
  lunch: "var(--color-orange)",
  dinner: "#7C6CF6",
};

const formatFullDate = (dateStr: string) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
};
const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

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
      // Same gate as billing: a slot nobody confirmed cooked contributes
      // nothing to the history total either, so this number always matches
      // what actually got billed.
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
  const [detailsMeal, setDetailsMeal] = useState<MealSlot | null>(null);
  // Locks a report's row while its confirmAbsent() call is in flight —
  // without this, a double-click could re-apply the effect twice.
  const [confirmingAbsentId, setConfirmingAbsentId] = useState<string | null>(null);
  // Same in-flight lock for undoDecision().
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const { toast } = useToast();
  const historyRef = useRef<HTMLDivElement>(null);

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

  // Live head-count per slot — how many to actually cook for, right now,
  // independent of confirmation status (confirmation is a separate,
  // after-the-fact "yes this really happened" step used for billing). A
  // manager needs the live number BEFORE cooking, not just after confirming.
  const mealCounts = MEAL_SLOTS.map((meal) => {
    const entries = day ? Object.values(day.entries) : [];
    const offered = day?.mealsOffered?.[meal] ?? true;
    const totalBoarders = entries.length;
    const boardersOn = offered ? entries.filter((e) => e[meal].on).length : 0;
    const count = offered
      ? entries.reduce((sum, e) => sum + ((e[meal].on ? 1 : 0) + e[meal].guestCount), 0)
      : 0;
    const pct = totalBoarders > 0 ? Math.round((boardersOn / totalBoarders) * 100) : 0;
    return { meal, count, pct, offered, totalBoarders };
  });
  const totalToCook = mealCounts.reduce((sum, c) => sum + c.count, 0);

  const yesterdayTotal = history.find((h) => h.date === addDays(date, -1))?.total;
  const vsYesterdayPct =
    yesterdayTotal != null && yesterdayTotal > 0
      ? Math.round(((totalToCook - yesterdayTotal) / yesterdayTotal) * 100)
      : null;

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

      {/* Date picker pill (native date input overlaid, invisible, so any
          past/future-up-to-today date can be jumped to directly) + a shortcut
          to the history list below. */}
      <div className="flex items-center gap-2.5">
        <div className="relative flex flex-1 items-center gap-2 rounded-pill border border-border bg-card px-4 py-3 shadow-chip">
          <Icon icon={Calendar} size={15} className="shrink-0 text-text-secondary" />
          <span className="flex-1 truncate text-[12.5px] font-extrabold">{formatFullDate(date)}</span>
          <Icon icon={ChevronDown} size={14} className="shrink-0 text-text-secondary" />
          <input
            type="date"
            value={date}
            max={today()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            aria-label="Pick a date"
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </div>
        <button
          type="button"
          onClick={() => historyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          title="Jump to cooking history"
          className="flex h-[46px] w-[46px] shrink-0 cursor-pointer items-center justify-center rounded-btn border border-border bg-card text-text-secondary shadow-chip"
        >
          <Icon icon={SlidersHorizontal} size={16} />
        </button>
      </div>

      {!isToday && (
        <button
          type="button"
          onClick={() => setDate(today())}
          className="-mt-3 self-start text-[10.5px] font-bold text-primary"
        >
          Back to today
        </button>
      )}

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

      {/* Hero: total to cook + per-meal breakdown */}
      <Card
        className="overflow-hidden"
        style={{ background: "linear-gradient(135deg, var(--color-primary-soft), var(--color-bg) 70%)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold text-text-secondary">
              Total to cook {isToday ? "today" : `on ${formatShortDate(date)}`}
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-[30px] font-extrabold leading-none">{totalToCook}</span>
              <span className="text-[13px] font-bold text-text-secondary">Meals</span>
            </div>
            {vsYesterdayPct !== null && vsYesterdayPct !== 0 && (
              <div className={`mt-1 text-[10.5px] font-extrabold ${vsYesterdayPct > 0 ? "text-primary" : "text-danger"}`}>
                {vsYesterdayPct > 0 ? "↑" : "↓"} {Math.abs(vsYesterdayPct)}% {vsYesterdayPct > 0 ? "more" : "less"} than
                yesterday
              </div>
            )}
          </div>
          <CookingPotIllustration size={80} />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/70 pt-3">
          {mealCounts.map(({ meal, count }) => {
            const c = MEAL_COLORS[meal];
            const ofTotal = totalToCook > 0 ? Math.round((count / totalToCook) * 100) : 0;
            return (
              <div key={meal} className="flex flex-col items-center gap-1 text-center">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${c.bg}`}>
                  <Icon icon={c.icon} size={15} className={c.text} />
                </div>
                <div className="text-[9.5px] font-bold text-text-secondary">{MEAL_LABEL[meal]}</div>
                <div className="text-[14px] font-extrabold leading-none">{count} Meals</div>
                <div className={`text-[9px] font-bold ${c.text}`}>{ofTotal}% of total</div>
              </div>
            );
          })}
        </div>
      </Card>

      {mealCounts.map(({ meal, count, pct, offered, totalBoarders }) => {
        const report = reports.find((r) => r.meal === meal);
        const votes = report ? votesByReport[report.id] ?? [] : [];
        const yes = votes.filter((v) => v.choice === "yes").length;
        const no = votes.filter((v) => v.choice === "no").length;
        const dk = votes.filter((v) => v.choice === "dk").length;
        const accent = report?.status === "confirmed_absent" ? "var(--color-danger)" : MEAL_ACCENT[meal];
        const completed = report?.status === "resolved_cooked";

        return (
          <Card key={meal} className="border-l-4" style={{ borderLeftColor: accent }}>
            <div className="flex items-start gap-3">
              <ProgressRing percent={offered ? pct : 0} size={64} strokeWidth={6} color={accent}>
                <span className="text-[12px] font-extrabold">{offered ? `${pct}%` : "—"}</span>
              </ProgressRing>

              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <div className="text-[13.5px] font-extrabold">{MEAL_LABEL[meal]}</div>
                  <StatusPill report={report} offered={offered} accent={accent} />
                </div>
                <div className="text-[11.5px] font-bold text-text-secondary">
                  {count} / {totalBoarders} Meals
                </div>

                {!offered && <div className="mt-1 text-[10px] font-semibold text-text-secondary">Doesn&rsquo;t count</div>}
                {offered && !report && (
                  <div className="mt-1 text-[10px] font-semibold text-text-secondary">Not counted yet</div>
                )}
                {report?.status === "reported" && (
                  <div className="mt-1 text-[10px] font-semibold text-text-secondary">
                    {yes} yes · {no} no · {dk} unsure
                  </div>
                )}
                {completed && report?.resolvedAt && (
                  <div className="mt-1 text-[10px] font-semibold text-text-secondary">All meals counted</div>
                )}
                {report?.status === "confirmed_absent" && (
                  <div className="mt-1 text-[10px] font-semibold text-text-secondary">Not counted — nothing cooked</div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setDetailsMeal(meal)}
                className="flex shrink-0 cursor-pointer items-center gap-1 rounded-btn border border-border px-2.5 py-2 text-[10px] font-extrabold text-text-secondary"
              >
                <Icon icon={FileText} size={13} />
                Details
              </button>
            </div>

            {offered && !report && !readOnly && (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => activeHostelId && repo.cookAttendance.markCooked(activeHostelId, date, meal)}
                  className="min-h-11 flex-1 cursor-pointer rounded-btn text-[12.5px] font-extrabold text-white"
                  style={{ background: accent }}
                >
                  Mark as Cooked
                </button>
                <button
                  type="button"
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
                  className="min-h-11 flex-1 cursor-pointer rounded-btn border text-[12.5px] font-extrabold"
                  style={{ borderColor: accent, color: accent }}
                >
                  Report Not Cooked
                </button>
              </div>
            )}

            {report?.status === "reported" && !readOnly && (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => activeHostelId && repo.cookAttendance.markCooked(activeHostelId, date, meal)}
                  className="min-h-11 flex-1 cursor-pointer rounded-btn text-[12.5px] font-extrabold text-white"
                  style={{ background: accent }}
                >
                  Confirm Cooked
                </button>
                <button
                  type="button"
                  disabled={confirmingAbsentId === report.id}
                  onClick={async () => {
                    setConfirmingAbsentId(report.id);
                    try {
                      await repo.cookAttendance.confirmAbsent(report.id);
                    } finally {
                      setConfirmingAbsentId(null);
                    }
                  }}
                  className="min-h-11 flex-1 cursor-pointer rounded-btn bg-danger text-[12.5px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Confirm Absent
                </button>
              </div>
            )}

            {report && (report.status === "resolved_cooked" || report.status === "confirmed_absent") && !readOnly && (
              <div className="mt-3">
                <button
                  type="button"
                  disabled={undoingId === report.id}
                  onClick={async () => {
                    const wasAbsent = report.status === "confirmed_absent";
                    setUndoingId(report.id);
                    try {
                      await repo.cookAttendance.undoDecision(report.id);
                      toast(
                        wasAbsent
                          ? "Undone — reopened for a decision. Members' meal toggles were turned off and won't be restored automatically."
                          : "Undone — reopened for a decision."
                      );
                    } finally {
                      setUndoingId(null);
                    }
                  }}
                  className="min-h-10 w-full cursor-pointer rounded-btn border border-border text-[11.5px] font-extrabold text-text-secondary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Undo
                </button>
              </div>
            )}
          </Card>
        );
      })}

      <div ref={historyRef}>
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

      {detailsMeal &&
        (() => {
          const m = mealCounts.find((mc) => mc.meal === detailsMeal)!;
          const report = reports.find((r) => r.meal === detailsMeal);
          const votes = report ? votesByReport[report.id] ?? [] : [];
          return (
            <CookingDetailsSheet
              open
              onClose={() => setDetailsMeal(null)}
              meal={detailsMeal}
              date={date}
              offered={m.offered}
              report={report}
              votes={{
                yes: votes.filter((v) => v.choice === "yes").length,
                no: votes.filter((v) => v.choice === "no").length,
                dk: votes.filter((v) => v.choice === "dk").length,
              }}
              count={m.count}
              totalBoarders={m.totalBoarders}
            />
          );
        })()}
    </div>
  );
}

function StatusPill({
  report,
  offered,
  accent,
}: {
  report: CookAttendanceReport | undefined;
  offered: boolean;
  accent: string;
}) {
  if (!offered) return <Chip>Not offered</Chip>;
  if (!report) {
    return (
      <span
        className="rounded-pill px-2 py-0.5 text-[9.5px] font-extrabold"
        style={{ background: "var(--color-orange-soft)", color: "var(--color-orange)" }}
      >
        Pending
      </span>
    );
  }
  if (report.status === "resolved_cooked") {
    return (
      <span
        className="rounded-pill px-2 py-0.5 text-[9.5px] font-extrabold"
        style={{ background: `color-mix(in srgb, ${accent} 15%, transparent)`, color: accent }}
      >
        Completed{report.resolvedAt ? ` at ${formatTime(report.resolvedAt)}` : ""}
      </span>
    );
  }
  if (report.status === "confirmed_absent") {
    return (
      <Chip tone="danger" active>
        Cancelled
      </Chip>
    );
  }
  // status === "reported" — still being disputed/voted on.
  return (
    <span
      className="rounded-pill px-2 py-0.5 text-[9.5px] font-extrabold"
      style={{ background: "var(--color-orange-soft)", color: "var(--color-orange)" }}
    >
      Pending
    </span>
  );
}

"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useMealDay } from "@/hooks/useMealDay";
import { useCookAttendanceForDate } from "@/hooks/useCookAttendance";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Sheet } from "@/components/ui/Sheet";
import { MonthNav } from "@/components/ui/MonthNav";
import { useToast } from "@/components/ui/Toast";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { CookingPotIllustration } from "@/components/hostel/CookingPotIllustration";
import { MEAL_COLORS, MEAL_LABEL } from "@/lib/mealColors";
import {
  repo,
  type CookAttendanceReport,
  type CookAttendanceVote,
  type MealDay,
  type MealSlot,
  type User,
} from "@/lib/data";
import { currentMonth, formatDayMonth, formatMonthLabel, formatShortDate, lastDayOfMonth, today } from "@/lib/utils/date";

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

/** Every meal-count decision opens a confirm popup before it actually
 * applies — mistakes here affect billing/what everyone eats. */
type PendingAction =
  | { type: "markAbsent"; date: string; meal: MealSlot }
  | { type: "undoAbsent"; date: string; meal: MealSlot }
  | { type: "reportNotCooked"; meal: MealSlot }
  | { type: "confirmCooked"; meal: MealSlot }
  | { type: "confirmAbsent"; meal: MealSlot; reportId: string };

interface MonthHistoryRow {
  date: string;
  perMeal: Record<MealSlot, { offered: boolean; counted: boolean; count: number }>;
  total: number;
}

/** Every offered meal counts by default now — only an explicit "cook absent"
 * zeroes a slot out. This always matches what actually gets billed. */
function buildMonthHistory(days: MealDay[], reports: CookAttendanceReport[], month: string): MonthHistoryRow[] {
  return days
    .filter((d) => d.date.startsWith(month))
    .map((d) => {
      const entries = Object.values(d.entries);
      const perMeal = {} as MonthHistoryRow["perMeal"];
      let total = 0;
      for (const meal of MEAL_SLOTS) {
        const offered = d.mealsOffered?.[meal] ?? true;
        const absent = reports.some((r) => r.date === d.date && r.meal === meal && r.status === "confirmed_absent");
        const counted = offered && !absent;
        const count = counted ? entries.reduce((s, e) => s + ((e[meal].on ? 1 : 0) + e[meal].guestCount), 0) : 0;
        perMeal[meal] = { offered, counted, count };
        total += count;
      }
      return { date: d.date, perMeal, total };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** One date's full breakdown — every meal, who was counted in it by name,
 * and (unless read-only) a way to mark/undo "cook absent" for that specific
 * past day without digging through a separate flow. */
function HistoryDetailsSheet({
  open,
  onClose,
  date,
  day,
  reports,
  users,
  readOnly,
  onMarkAbsent,
  onUndoAbsent,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  day: MealDay | undefined;
  reports: CookAttendanceReport[];
  users: User[];
  readOnly?: boolean;
  onMarkAbsent: (meal: MealSlot) => void;
  onUndoAbsent: (meal: MealSlot) => void;
}) {
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  return (
    <Sheet open={open} onClose={onClose} title={formatFullDate(date)}>
      <div className="flex flex-col gap-4">
        {MEAL_SLOTS.map((meal) => {
          const offered = day?.mealsOffered?.[meal] ?? true;
          const report = reports.find((r) => r.date === date && r.meal === meal);
          const absent = report?.status === "confirmed_absent";
          const entries = day ? Object.entries(day.entries) : [];
          const onMembers = entries
            .filter(([, e]) => e[meal].on)
            .map(([userId, e]) => ({ name: nameById.get(userId) ?? "Member", guestCount: e[meal].guestCount }))
            .sort((a, b) => a.name.localeCompare(b.name));
          const c = MEAL_COLORS[meal];

          return (
            <div key={meal} className="rounded-btn border border-border p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full ${c.bg}`}>
                    <Icon icon={c.icon} size={13} className={c.text} />
                  </div>
                  <div className="text-[12.5px] font-extrabold">{MEAL_LABEL[meal]}</div>
                </div>
                {!offered ? (
                  <Chip>Not offered</Chip>
                ) : absent ? (
                  <Chip tone="danger" active>
                    Cook absent
                  </Chip>
                ) : (
                  <Chip tone="primary" active>
                    Counted
                  </Chip>
                )}
              </div>

              {offered && !absent && (
                <div className="flex flex-col gap-1 pl-9">
                  {onMembers.length === 0 ? (
                    <div className="text-[10.5px] font-semibold text-text-secondary">
                      No one had this meal on.
                    </div>
                  ) : (
                    onMembers.map((m, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px] font-semibold">
                        <div>{m.name}</div>
                        {m.guestCount > 0 && (
                          <div className="text-text-secondary">
                            +{m.guestCount} guest{m.guestCount > 1 ? "s" : ""}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {!readOnly && offered && (
                <div className="mt-2 pl-9">
                  {absent ? (
                    <button
                      type="button"
                      onClick={() => onUndoAbsent(meal)}
                      className="text-[10.5px] font-extrabold text-primary"
                    >
                      Undo — count this meal
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onMarkAbsent(meal)}
                      className="text-[10.5px] font-extrabold text-danger"
                    >
                      Cook absent
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

/** Today's live cooking counts + a month-browsable history. Every offered
 * meal counts toward billing by default — no daily confirmation needed; the
 * only decision a manager makes is "cook absent" for the rare day nothing
 * was cooked (shared by the manager page and the owner's read-only view,
 * which hides every action but keeps counts/history visible). */
export function CookingCountScreen({ readOnly }: { readOnly?: boolean }) {
  const { user, activeHostelId } = useSession();
  const todayDate = today();
  const { day } = useMealDay(activeHostelId, todayDate);
  const reports = useCookAttendanceForDate(activeHostelId, todayDate);
  const [votesByReport, setVotesByReport] = useState<Record<string, CookAttendanceVote[]>>({});
  const [detailsMeal, setDetailsMeal] = useState<MealSlot | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const { toast } = useToast();

  const [historyMonth, setHistoryMonth] = useState(currentMonth());
  const [monthDays, setMonthDays] = useState<MealDay[]>([]);
  const [monthReports, setMonthReports] = useState<CookAttendanceReport[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [detailsDate, setDetailsDate] = useState<string | null>(null);

  useEffect(() => {
    const reported = reports.filter((r) => r.status === "reported");
    Promise.all(
      reported.map(async (r) => [r.id, await repo.cookAttendance.listVotes(r.id)] as const)
    ).then((entries) => setVotesByReport(Object.fromEntries(entries)));
  }, [reports]);

  useEffect(() => {
    if (!activeHostelId) return;
    const from = `${historyMonth}-01`;
    const to = lastDayOfMonth(historyMonth);
    Promise.all([
      repo.meals.listMealDays(activeHostelId, { from, to }),
      repo.cookAttendance.listByHostel(activeHostelId),
      repo.users.listByHostel(activeHostelId),
    ]).then(([days, allReports, allUsers]) => {
      setMonthDays(days);
      setMonthReports(allReports);
      setUsers(allUsers);
    });
  }, [activeHostelId, historyMonth]);

  const history = buildMonthHistory(monthDays, monthReports, historyMonth);

  // Live head-count per slot — how many to actually cook for, right now.
  // Meals count toward billing by default, so this already matches the
  // billed count unless the slot's marked cook-absent.
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

      {/* Hero: total to cook today + per-meal breakdown */}
      <Card
        className="overflow-hidden"
        style={{ background: "linear-gradient(135deg, var(--color-primary-soft), var(--color-bg) 70%)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold text-text-secondary">Total to cook today</div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-[30px] font-extrabold leading-none">{totalToCook}</span>
              <span className="text-[13px] font-bold text-text-secondary">Meals</span>
            </div>
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
        const absent = report?.status === "confirmed_absent";
        const accent = absent ? "var(--color-danger)" : MEAL_ACCENT[meal];

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
                {report?.status === "reported" && (
                  <div className="mt-1 text-[10px] font-semibold text-text-secondary">
                    Still counts while under review — {yes} yes · {no} no · {dk} unsure
                  </div>
                )}
                {absent && (
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

            {offered && !readOnly && !absent && report?.status !== "reported" && (
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPendingAction({ type: "markAbsent", date: todayDate, meal })}
                  className="min-h-11 flex-1 cursor-pointer rounded-btn bg-danger text-[12.5px] font-extrabold text-white"
                >
                  Cook absent
                </button>
                <button
                  type="button"
                  onClick={() => setPendingAction({ type: "reportNotCooked", meal })}
                  className="shrink-0 text-[10.5px] font-bold text-text-secondary underline"
                >
                  Report for a vote instead
                </button>
              </div>
            )}

            {report?.status === "reported" && !readOnly && (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPendingAction({ type: "confirmCooked", meal })}
                  className="min-h-11 flex-1 cursor-pointer rounded-btn text-[12.5px] font-extrabold text-white"
                  style={{ background: accent }}
                >
                  Confirm Cooked
                </button>
                <button
                  type="button"
                  onClick={() => setPendingAction({ type: "confirmAbsent", meal, reportId: report.id })}
                  className="min-h-11 flex-1 cursor-pointer rounded-btn bg-danger text-[12.5px] font-extrabold text-white"
                >
                  Confirm Absent
                </button>
              </div>
            )}

            {offered && absent && !readOnly && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setPendingAction({ type: "undoAbsent", date: todayDate, meal })}
                  className="min-h-11 w-full cursor-pointer rounded-btn border border-border text-[12.5px] font-extrabold text-primary"
                >
                  Undo — count this meal after all
                </button>
              </div>
            )}
          </Card>
        );
      })}

      <div>
        <div className="mb-2 text-[13.5px] font-extrabold">Cooking history</div>
        <MonthNav value={historyMonth} onChange={setHistoryMonth} />
        <div className="mt-2 flex flex-col gap-2">
          {history.length === 0 && (
            <Card className="text-center text-[11.5px] font-semibold text-text-secondary">
              No records for {formatMonthLabel(historyMonth)} yet.
            </Card>
          )}
          {history.map((h) => {
            const absentMeals = MEAL_SLOTS.filter((m) => h.perMeal[m].offered && !h.perMeal[m].counted);
            return (
              <button
                key={h.date}
                type="button"
                onClick={() => setDetailsDate(h.date)}
                className="w-full cursor-pointer text-left"
              >
                <Card className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[12px] font-bold">{formatShortDate(h.date)}</div>
                    {absentMeals.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {absentMeals.map((m) => (
                          <Chip key={m} tone="danger" active>
                            {MEAL_LABEL[m]} absent
                          </Chip>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-[12px] font-extrabold">{h.total} meals</div>
                </Card>
              </button>
            );
          })}
        </div>
      </div>

      {detailsMeal &&
        (() => {
          const m = mealCounts.find((mc) => mc.meal === detailsMeal)!;
          const report = reports.find((r) => r.meal === detailsMeal);
          const votes = report ? votesByReport[report.id] ?? [] : [];
          return (
            <CookingDetailsVoteSheet
              open
              onClose={() => setDetailsMeal(null)}
              meal={detailsMeal}
              date={todayDate}
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

      {detailsDate && (
        <HistoryDetailsSheet
          open
          onClose={() => setDetailsDate(null)}
          date={detailsDate}
          day={monthDays.find((d) => d.date === detailsDate)}
          reports={monthReports.filter((r) => r.date === detailsDate)}
          users={users}
          readOnly={readOnly}
          onMarkAbsent={(meal) => setPendingAction({ type: "markAbsent", date: detailsDate, meal })}
          onUndoAbsent={(meal) => setPendingAction({ type: "undoAbsent", date: detailsDate, meal })}
        />
      )}

      {pendingAction && (
        <ConfirmSheet
          open
          onClose={() => setPendingAction(null)}
          tone={pendingAction.type === "markAbsent" || pendingAction.type === "confirmAbsent" ? "danger" : "primary"}
          title={
            pendingAction.type === "markAbsent"
              ? "Cook absent?"
              : pendingAction.type === "undoAbsent"
                ? "Undo cook absent?"
                : pendingAction.type === "reportNotCooked"
                  ? "Report not cooked?"
                  : pendingAction.type === "confirmCooked"
                    ? "Confirm cooked?"
                    : "Confirm cook absent?"
          }
          message={
            pendingAction.type === "markAbsent"
              ? `Mark ${MEAL_LABEL[pendingAction.meal]} on ${formatFullDate(pendingAction.date)} as cook absent? This cancels the meal for everyone — guest counts are cleared and it won't count toward the meal rate.`
              : pendingAction.type === "undoAbsent"
                ? `Count ${MEAL_LABEL[pendingAction.meal]} on ${formatFullDate(pendingAction.date)} after all? It'll count toward the meal rate and bills again.`
                : pendingAction.type === "reportNotCooked"
                  ? `Flag ${MEAL_LABEL[pendingAction.meal]} today as not yet cooked? Members will be asked to vote so you can decide.`
                  : pendingAction.type === "confirmCooked"
                    ? `Confirm ${MEAL_LABEL[pendingAction.meal]} today was cooked? It stays counted.`
                    : `Confirm the cook was absent for ${MEAL_LABEL[pendingAction.meal]} today? This cancels the meal for everyone — guest counts are cleared and it won't count toward the meal rate.`
          }
          confirmLabel={
            pendingAction.type === "markAbsent"
              ? "Cook absent"
              : pendingAction.type === "undoAbsent"
                ? "Count it"
                : pendingAction.type === "reportNotCooked"
                  ? "Report"
                  : pendingAction.type === "confirmCooked"
                    ? "Confirm cooked"
                    : "Confirm absent"
          }
          onConfirm={async () => {
            if (!activeHostelId) return;
            if (pendingAction.type === "markAbsent") {
              await repo.cookAttendance.markAbsent(activeHostelId, pendingAction.date, pendingAction.meal);
              toast(`${MEAL_LABEL[pendingAction.meal]} marked cook absent.`);
            } else if (pendingAction.type === "undoAbsent") {
              await repo.cookAttendance.markCooked(activeHostelId, pendingAction.date, pendingAction.meal);
              toast(`${MEAL_LABEL[pendingAction.meal]} counted again.`);
            } else if (pendingAction.type === "reportNotCooked") {
              if (!user) return;
              await repo.cookAttendance.report({
                hostelId: activeHostelId,
                date: todayDate,
                meal: pendingAction.meal,
                status: "reported",
                reportedBy: user.id,
              });
              toast(`${MEAL_LABEL[pendingAction.meal]} reported — members can vote now.`);
            } else if (pendingAction.type === "confirmCooked") {
              await repo.cookAttendance.markCooked(activeHostelId, todayDate, pendingAction.meal);
              toast(`${MEAL_LABEL[pendingAction.meal]} confirmed cooked.`);
            } else {
              await repo.cookAttendance.confirmAbsent(pendingAction.reportId);
              toast(`${MEAL_LABEL[pendingAction.meal]} confirmed absent — cancelled for everyone.`);
            }
          }}
        />
      )}
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
  if (report?.status === "confirmed_absent") {
    return (
      <Chip tone="danger" active>
        Cook absent
      </Chip>
    );
  }
  if (report?.status === "reported") {
    return (
      <span
        className="rounded-pill px-2 py-0.5 text-[9.5px] font-extrabold"
        style={{ background: "var(--color-orange-soft)", color: "var(--color-orange)" }}
      >
        Under review
      </span>
    );
  }
  return (
    <span
      className="rounded-pill px-2 py-0.5 text-[9.5px] font-extrabold"
      style={{ background: `color-mix(in srgb, ${accent} 15%, transparent)`, color: accent }}
    >
      Counted{report?.resolvedAt ? ` · confirmed ${formatTime(report.resolvedAt)}` : ""}
    </span>
  );
}

/** Per-meal drill-down for TODAY's dispute vote tally — read-only. */
function CookingDetailsVoteSheet({
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
          <Chip tone="primary" active>
            Counted — no confirmation needed
          </Chip>
        )}

        {report?.status === "reported" && (
          <div>
            <div className="mb-2 text-[11px] font-bold text-text-secondary">
              Was it cooked? — live tally (still counts while under review)
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
                Confirmed at {formatTime(report.resolvedAt)}
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

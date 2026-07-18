// Month-end report reminder: during the last two days of each month, every
// boarder, manager, and owner gets one notification telling them to generate
// their monthly meal report and keep a printed copy for data security.
//
// The mock app has no server cron, so this runs client-side whenever a
// session loads inside the window; the per-user/per-month dedupe makes it
// idempotent no matter how many tabs or logins fire it.

import { repo } from "@/lib/data";
import { formatMonthLabel, lastDayOfMonth, today, currentMonth } from "@/lib/utils/date";

const NOTIFY_ROLES = ["student", "manager", "owner"] as const;

const noticeTitle = (month: string) => `Monthly report · ${formatMonthLabel(month)}`;

// Re-entrancy guard: overlapping runs (effect re-fires, multiple tabs') would
// both pass the read-then-create dedupe and double-notify.
let inFlight = false;

export async function ensureMonthEndReportNotices(): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  try {
    await runMonthEndNotices();
  } finally {
    inFlight = false;
  }
}

async function runMonthEndNotices(): Promise<void> {
  const date = today();
  const month = currentMonth();
  const lastDay = lastDayOfMonth(month);
  const dayNum = Number(date.slice(8, 10));
  const lastDayNum = Number(lastDay.slice(8, 10));
  // Only inside the month-end window (last two days).
  if (dayNum < lastDayNum - 1) return;

  const users = await repo.users.listAll();
  const title = noticeTitle(month);
  for (const u of users) {
    if (!NOTIFY_ROLES.includes(u.role as (typeof NOTIFY_ROLES)[number])) continue;
    // Respect the user's opt-out, and skip people with no hostel to report
    // on: members who haven't joined one, owners who haven't created one.
    if (u.notificationPrefs?.monthlyReport === false) continue;
    if (u.role === "student" && !u.hostelId) continue;
    if (u.role === "owner" && !(u.ownedHostelIds?.length)) continue;
    const existing = await repo.notifications.listByUser(u.id);
    if (existing.some((n) => n.title === title)) continue;
    await repo.notifications.create({
      userId: u.id,
      title,
      body:
        u.role === "student"
          ? `The month is closing — generate your monthly meal report (More → Monthly report) and keep a printed copy for data security.`
          : `The month is closing — generate the monthly meal report for your hostel and ask every member to keep a printed copy for data security.`,
    });
  }
}

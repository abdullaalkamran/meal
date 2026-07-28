// The hostel's civil timezone. Everything date-shaped in this app — which day
// a meal belongs to, when a toggle locks, which day the cook is cooking for —
// is a CIVIL date in the hostel's timezone, not a UTC instant.
//
// Asia/Dhaka is UTC+6 year-round (no DST), so a fixed offset is exact.
// Previously `today()` used the UTC date, which meant that between midnight
// and 6 AM local time the app was still reporting yesterday — meals toggled
// in that window landed on the wrong day.
export const HOSTEL_TZ_OFFSET_MINUTES = 6 * 60;

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** "Now", shifted so its UTC fields read as hostel-local wall-clock time. */
export function hostelNow(): Date {
  return new Date(Date.now() + HOSTEL_TZ_OFFSET_MINUTES * 60_000);
}

/** Today's civil date in the hostel's timezone (YYYY-MM-DD). */
export function today(): string {
  return toISODate(hostelNow());
}

/** Minutes since midnight, hostel-local. */
export function hostelMinutesNow(): number {
  const d = hostelNow();
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** "22:00" → 1320. Tolerates "22:00:00" (MySQL TIME) and bad input. */
export function parseHHMM(time: string | undefined, fallbackMinutes: number): number {
  if (!time) return fallbackMinutes;
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return fallbackMinutes;
  return h * 60 + m;
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

export function currentMonth(): string {
  return today().slice(0, 7); // YYYY-MM
}

export function previousMonth(monthStr: string): string {
  return addMonths(monthStr, -1);
}

/** Shift a YYYY-MM string by `delta` months (negative = earlier). */
export function addMonths(monthStr: string, delta: number): string {
  const [year, month] = monthStr.split("-").map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function lastDayOfMonth(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number);
  const last = new Date(year, month, 0).getDate();
  return `${monthStr}-${String(last).padStart(2, "0")}`;
}

/** [inclusive first day, EXCLUSIVE first-of-next-month] for a YYYY-MM month.
 * Use for index-friendly SQL date ranges — `day >= from AND day < to` lets
 * MySQL use the (hostel_id, day) index, unlike DATE_FORMAT(day,'%Y-%m') = ?
 * which is a function on the column and forces a full scan. */
export function monthRange(monthStr: string): [string, string] {
  return [`${monthStr}-01`, `${addMonths(monthStr, 1)}-01`];
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatDateLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return `${WEEKDAY[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatShortDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return `${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`;
}

export function formatDayMonth(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return `${WEEKDAY[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`;
}

const FULL_MONTH = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function formatMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number);
  return `${FULL_MONTH[month - 1]} ${year}`;
}

export function formatRelativeTime(isoString: string): string {
  const d = new Date(isoString);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  if (isToday) {
    const hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const period = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes} ${period}`;
  }
  if (isYesterday) return "Yesterday";
  return `${d.getDate()} ${MONTH[d.getMonth()]}`;
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

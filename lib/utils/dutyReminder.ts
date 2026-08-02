// Builds an .ics calendar event for a shopping-duty block and triggers a
// download, so a member can add it to their phone's calendar — which is how a
// web app "sets an alarm on the phone": the event carries VALARM reminders (the
// day before + the morning of), and the OS calendar fires them as alarms.

import { addDays } from "./date";

const icsDate = (d: string) => d.replace(/-/g, "");

/** Download an all-day duty event (spanning `dates`) with day-before + morning
 * reminders. No-op when there are no dates or when run on the server. */
export function downloadDutyReminder(dates: string[], hostelName?: string): void {
  if (typeof document === "undefined" || dates.length === 0) return;
  const start = dates[0];
  const endExclusive = addDays(dates[dates.length - 1], 1); // DTEND is exclusive
  const dtstamp = `${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
  const uid = `duty-${start}-${Math.random().toString(36).slice(2)}@mydorm`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MyDorm//Shopping Duty//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${icsDate(start)}`,
    `DTEND;VALUE=DATE:${icsDate(endExclusive)}`,
    `SUMMARY:Shopping duty${hostelName ? ` — ${hostelName}` : ""}`,
    "DESCRIPTION:Your shopping duty. Buy the groceries and record the cost in MyDorm.",
    // The evening before.
    "BEGIN:VALARM",
    "TRIGGER:-PT6H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Tomorrow is your shopping duty",
    "END:VALARM",
    // 9am on the duty day itself.
    "BEGIN:VALARM",
    "TRIGGER:PT9H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Shopping duty today",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `shopping-duty-${start}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

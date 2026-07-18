"use client";

import { Sheet } from "@/components/ui/Sheet";
import { Switch } from "@/components/ui/Switch";
import { repo, type User } from "@/lib/data";

const OPTIONS: { key: "announcements" | "bills" | "monthlyReport"; label: string; hint: string }[] = [
  { key: "announcements", label: "Announcements", hint: "Hostel-wide announcements and polls" },
  { key: "bills", label: "Bill reminders", hint: "New bills and payment updates" },
  { key: "monthlyReport", label: "Monthly report reminder", hint: "Month-end nudge to generate & print your report" },
];

/** Per-user notification opt-outs — saved on the user record; the reminder
 * generators check these flags before creating notifications. */
export function NotificationPrefsSheet({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: User | undefined;
}) {
  if (!user) return null;
  const prefs = user.notificationPrefs ?? {};

  const setPref = (key: (typeof OPTIONS)[number]["key"], value: boolean) =>
    repo.users.updateUser(user.id, {
      notificationPrefs: { ...prefs, [key]: value },
    });

  return (
    <Sheet open={open} onClose={onClose} title="Notification preferences">
      <div className="flex flex-col gap-2">
        {OPTIONS.map((opt) => (
          <div
            key={opt.key}
            className="flex items-center justify-between gap-3 rounded-btn border border-border px-3 py-2.5"
          >
            <div className="min-w-0">
              <div className="text-[11.5px] font-extrabold">{opt.label}</div>
              <div className="text-[9.5px] font-semibold text-text-secondary">{opt.hint}</div>
            </div>
            <Switch checked={prefs[opt.key] ?? true} onChange={(v) => setPref(opt.key, v)} />
          </div>
        ))}
      </div>
    </Sheet>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Switch } from "@/components/ui/Switch";
import { repo, type User } from "@/lib/data";
import { disablePush, enablePush, pushState, type PushState } from "@/lib/push/client";

const OPTIONS: { key: "announcements" | "bills" | "monthlyReport"; label: string; hint: string }[] = [
  { key: "announcements", label: "Announcements", hint: "Hostel-wide announcements and polls" },
  { key: "bills", label: "Bill reminders", hint: "New bills and payment updates" },
  { key: "monthlyReport", label: "Monthly report reminder", hint: "Month-end nudge to generate & print your report" },
];

/** Per-user notification opt-outs — saved on the user record; the reminder
 * generators check these flags before creating notifications. Also the entry
 * point for turning browser (push) notifications on or off. */
export function NotificationPrefsSheet({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: User | undefined;
}) {
  const [push, setPush] = useState<PushState>("off");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) void pushState().then(setPush);
  }, [open]);

  if (!user) return null;
  const prefs = user.notificationPrefs ?? {};

  const setPref = (key: (typeof OPTIONS)[number]["key"], value: boolean) =>
    repo.users.updateUser(user.id, {
      notificationPrefs: { ...prefs, [key]: value },
    });

  const togglePush = async (on: boolean) => {
    setBusy(true);
    setPush(on ? await enablePush() : (await disablePush(), "off"));
    setBusy(false);
  };

  const pushHint: Record<PushState, string> = {
    on: "On — you'll get notifications even when the app is closed.",
    off: "Get notifications even when the app is closed.",
    denied: "Blocked in your browser settings — allow notifications for this site to enable.",
    unsupported: "This browser doesn't support push notifications.",
    unconfigured: "Push isn't set up on the server yet.",
  };
  const pushDisabled = busy || push === "unsupported" || push === "denied" || push === "unconfigured";

  return (
    <Sheet open={open} onClose={onClose} title="Notification preferences">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3 rounded-btn border border-primary/30 bg-primary-soft px-3 py-2.5">
          <div className="min-w-0">
            <div className="text-[11.5px] font-extrabold text-primary">Browser notifications</div>
            <div className="text-[9.5px] font-semibold text-text-secondary">{pushHint[push]}</div>
          </div>
          <Switch checked={push === "on"} disabled={pushDisabled} onChange={(v) => togglePush(v)} />
        </div>

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

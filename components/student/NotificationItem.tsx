"use client";

import { Bell } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { Chip } from "@/components/ui/Chip";
import { repo, type Notification } from "@/lib/data";
import { formatRelativeTime } from "@/lib/utils/date";

/** One personal notification card — stays highlighted (and pinned into the
 * home announcements section) until clicked, which marks it read. */
export function NotificationItem({ notification: n }: { notification: Notification }) {
  return (
    <button
      type="button"
      onClick={() => repo.notifications.markRead(n.id)}
      className="w-full text-left"
    >
      <div
        className={`flex items-start gap-3 rounded-card border bg-card p-3 shadow-chip ${
          n.read ? "border-border opacity-70" : "border-primary/40"
        }`}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Icon icon={Bell} size={15} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-extrabold">{n.title}</div>
          <div className="mt-0.5 text-[10.5px] font-semibold text-text-secondary">{n.body}</div>
          <div className="mt-1 text-[9.5px] font-semibold text-text-secondary">
            {formatRelativeTime(n.createdAt)}
          </div>
        </div>
        {!n.read && (
          <Chip tone="primary" active>
            New
          </Chip>
        )}
      </div>
    </button>
  );
}

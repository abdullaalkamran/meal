"use client";

import { useSession } from "@/lib/auth/SessionProvider";
import { useNotifications } from "@/hooks/useNotifications";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { repo } from "@/lib/data";

export default function StudentNotificationsPage() {
  const { user } = useSession();
  const notifications = useNotifications(user?.id);

  return (
    <div className="flex flex-col gap-3 pt-2">
      <div className="text-[17.5px] font-extrabold tracking-tight">Notifications</div>

      {notifications.length === 0 && (
        <Card className="text-center text-[11.5px] font-semibold text-text-secondary">
          No notifications yet.
        </Card>
      )}

      {notifications.map((n) => (
        <button
          key={n.id}
          type="button"
          onClick={() => repo.notifications.markRead(n.id)}
          className="text-left"
        >
          <Card className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[12px] font-extrabold">{n.title}</div>
              <div className="mt-0.5 text-[11px] font-semibold text-text-secondary">
                {n.body}
              </div>
              <div className="mt-1 text-[9.5px] font-semibold text-text-secondary">
                {new Date(n.createdAt).toLocaleString()}
              </div>
            </div>
            {!n.read && <Chip tone="primary" active>New</Chip>}
          </Card>
        </button>
      ))}
    </div>
  );
}

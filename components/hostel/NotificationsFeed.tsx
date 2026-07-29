"use client";

import { useSession } from "@/lib/auth/SessionProvider";
import { useNotifications } from "@/hooks/useNotifications";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { Card } from "@/components/ui/Card";
import { AnnouncementItem } from "@/components/student/AnnouncementItem";
import { NotificationItem } from "@/components/student/NotificationItem";
import type { Announcement, Notification } from "@/lib/data";

type FeedRow =
  | { kind: "notification"; at: string; notification: Notification }
  | { kind: "announcement"; at: string; announcement: Announcement };

/** The COMPLETE notification timeline, shared by student, manager, and owner
 * pages: personal notifications (click to mark read) merged with the active
 * hostel's announcements — including vote polls, votable right here. */
export function NotificationsFeed() {
  const { user, activeHostelId } = useSession();
  const notifications = useNotifications(user?.id);
  const announcements = useAnnouncements(activeHostelId);

  // A general announcement is delivered to each member as a linked notification;
  // show that personal (readable) copy and drop the announcement row so it never
  // appears twice.
  const linkedAnnouncementIds = new Set(
    notifications.map((n) => n.announcementId).filter(Boolean)
  );

  const rows: FeedRow[] = [
    ...notifications.map((n): FeedRow => ({ kind: "notification", at: n.createdAt, notification: n })),
    ...announcements
      .filter((a) => !linkedAnnouncementIds.has(a.id))
      .map((a): FeedRow => ({ kind: "announcement", at: a.createdAt, announcement: a })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 && (
        <Card className="text-center text-[11.5px] font-semibold text-text-secondary">
          Nothing here yet — personal notifications and hostel announcements (including
          polls) will appear together.
        </Card>
      )}
      {rows.map((row) =>
        row.kind === "notification" ? (
          <NotificationItem key={`n-${row.notification.id}`} notification={row.notification} />
        ) : (
          <AnnouncementItem
            key={`a-${row.announcement.id}`}
            announcement={row.announcement}
            userId={user?.id}
          />
        )
      )}
    </div>
  );
}

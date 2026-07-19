"use client";

import { NotificationsFeed } from "@/components/hostel/NotificationsFeed";

export default function ManagerNotificationsPage() {
  return (
    <div className="flex flex-col gap-3 pt-2">
      <div>
        <div className="text-[17.5px] font-extrabold tracking-tight">Notifications</div>
        <div className="text-[10.5px] font-semibold text-text-secondary">
          Personal alerts + hostel announcements — vote on polls right here
        </div>
      </div>
      <NotificationsFeed />
    </div>
  );
}

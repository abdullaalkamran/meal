"use client";

import { HostelPicker } from "@/components/hostel/HostelPicker";
import { NotificationsFeed } from "@/components/hostel/NotificationsFeed";

export default function OwnerNotificationsPage() {
  return (
    <div className="flex flex-col gap-3 pt-2">
      <div>
        <div className="text-[17.5px] font-extrabold tracking-tight">Notifications</div>
        <div className="text-[10.5px] font-semibold text-text-secondary">
          Personal alerts + the selected hostel&rsquo;s announcements
        </div>
      </div>
      <HostelPicker />
      <NotificationsFeed />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { repo, type Notification } from "@/lib/data";

export function useNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!userId) return;
    return repo.notifications.subscribe(userId, setNotifications);
  }, [userId]);

  return notifications;
}

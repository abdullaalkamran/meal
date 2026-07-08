"use client";

import { useEffect, useState } from "react";
import { repo, type Announcement } from "@/lib/data";

export function useAnnouncements(hostelId: string | undefined) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    if (!hostelId) return;
    return repo.announcements.subscribe(hostelId, setAnnouncements);
  }, [hostelId]);

  return announcements;
}

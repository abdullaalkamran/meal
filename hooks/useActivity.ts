"use client";

import { useEffect, useState } from "react";
import { repo, type ActivityLog } from "@/lib/data";

/** The hostel's audit log (who did what, when), newest first — live. Every
 * member can read it; only staff can write to it (see policy.ts). */
export function useActivity(hostelId: string | undefined) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    if (!hostelId) return;
    return repo.activity.subscribe(hostelId, setLogs);
  }, [hostelId]);

  return logs;
}

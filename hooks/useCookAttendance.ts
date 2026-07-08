"use client";

import { useEffect, useState } from "react";
import { repo, type CookAttendanceReport } from "@/lib/data";

export function useCookAttendanceForDate(
  hostelId: string | undefined,
  date: string | undefined
) {
  const [reports, setReports] = useState<CookAttendanceReport[]>([]);

  useEffect(() => {
    if (!hostelId || !date) return;
    let cancelled = false;
    const load = () =>
      repo.cookAttendance.listForDate(hostelId, date).then((list) => {
        if (!cancelled) setReports(list);
      });
    load();
    const unsub = repo.cookAttendance.subscribe(hostelId, load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [hostelId, date]);

  return reports;
}

"use client";

import { useEffect } from "react";
import { setClockSelectedDate } from "@/lib/clock/selectedDate";

/** Tells the global sticky clock (StickyFlipClock) to show this date — e.g.
 * a calendar's currently-selected day — alongside today's real date, for as
 * long as this page stays mounted. Clears itself on unmount/navigation. */
export function useAnnounceClockDate(date: string | undefined) {
  useEffect(() => {
    setClockSelectedDate(date ?? null);
    return () => setClockSelectedDate(null);
  }, [date]);
}

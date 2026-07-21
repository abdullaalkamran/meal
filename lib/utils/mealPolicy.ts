// When a member may change their own meal for a given date.
//
// ONE rule covers the whole spec:
//
//   A member may directly toggle date D only while it is still before
//   CUTOFF on the day before D (hostel-local time).
//
// Which yields exactly the required behaviour:
//   * tomorrow      — toggleable until 22:00 today, then locked
//   * today         — its cutoff was 22:00 yesterday, so always locked
//   * past dates    — locked
//   * further ahead — freely toggleable until their own eve
//
// Anything locked goes through a manager-approved request instead.
//
// This module is imported by BOTH the UI (to disable the switch and explain
// why) and the server (to enforce it), so the two can't drift apart — the
// client check is only ever a convenience, never the guarantee.

import { addDays, hostelMinutesNow, parseHHMM, today } from "./date";

/** Default lock time: 10:00 PM the evening before. */
export const DEFAULT_MEAL_CUTOFF = "22:00";
const DEFAULT_CUTOFF_MINUTES = 22 * 60;

export type MealLockReason = "past" | "today" | "cutoff-passed";

export interface MealToggleDecision {
  allowed: boolean;
  reason?: MealLockReason;
  /** Ready-to-show explanation for the locked cases. */
  message?: string;
}

/**
 * @param date    the meal date being changed (YYYY-MM-DD, hostel-local)
 * @param cutoff  hostel's cutoff as "HH:MM" (defaults to 22:00)
 */
export function canToggleMeal(date: string, cutoff?: string): MealToggleDecision {
  const cutoffMinutes = parseHHMM(cutoff, DEFAULT_CUTOFF_MINUTES);
  const cutoffLabel = formatCutoff(cutoffMinutes);
  const now = today();

  if (date < now) {
    return {
      allowed: false,
      reason: "past",
      message: "This day has already passed — ask the manager to correct it.",
    };
  }
  if (date === now) {
    return {
      allowed: false,
      reason: "today",
      message: `Today's meal can't be changed directly — send the manager a request.`,
    };
  }
  // The eve of `date` is the last day it can be toggled, until the cutoff.
  const eve = addDays(date, -1);
  if (now < eve) return { allowed: true }; // still more than a day out
  // now === eve: allowed only before the cutoff time.
  return hostelMinutesNow() < cutoffMinutes
    ? { allowed: true }
    : {
        allowed: false,
        reason: "cutoff-passed",
        message: `The ${cutoffLabel} cutoff has passed — send the manager a request.`,
      };
}

function formatCutoff(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Human label for the hostel's cutoff, e.g. "10:00 PM". */
export function cutoffLabel(cutoff?: string): string {
  return formatCutoff(parseHHMM(cutoff, DEFAULT_CUTOFF_MINUTES));
}

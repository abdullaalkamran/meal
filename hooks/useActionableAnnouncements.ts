"use client";

import { useEffect, useState } from "react";
import { repo, type Announcement, type AnnouncementKind } from "@/lib/data";
import { today } from "@/lib/utils/date";
import { useAnnouncements } from "./useAnnouncements";
import { useShortages } from "./useShortages";
import { useSwaps } from "./useSwaps";
import { useDutyPlans } from "./useDutyPlans";

type Payload = {
  reportId?: string;
  requestId?: string;
  shortageId?: string;
  swapId?: string;
  planId?: string;
};

const payloadOf = (a: Announcement) => a.payload as Payload | undefined;

/** Kinds where SURVIVING the actionable filter below means there's still a
 * real, unfinished action pending (an unvoted poll, an unresolved shortage
 * or swap). Everything else that shows up here (general notices, and the
 * terminal "-resolved"/"-completed"/"-denied"/"cook-leave-approved" kinds) is
 * a plain notice with nothing left to do — safe to swipe-dismiss. */
const ACTION_REQUIRED_KINDS = new Set<AnnouncementKind>([
  "cook-absence-poll",
  "meal-edit-poll",
  "shopping-cost-edit-poll",
  "shortage-alert",
  "swap-request",
  "spin-wheel-cta",
]);

export function canDismissAnnouncement(a: Announcement): boolean {
  return !ACTION_REQUIRED_KINDS.has(a.kind);
}

/**
 * Announcements this user still needs to look at: an unvoted
 * cook-absence-poll/meal-edit-poll, or an unresolved shortage-alert/
 * swap-request. Once they vote — or the shortage/swap gets resolved (those
 * two aren't per-voter, so any resolution clears it for everyone, the same
 * way a poll's result already collapses it to a single "-resolved" kind) —
 * it drops out of this list. Every other kind (general notices, already-
 * resolved polls, …) has nothing to act on and always stays.
 *
 * This is only for the home-page "needs your attention" banner. The full
 * history — acted-on or not — stays visible on the notifications page via
 * the unfiltered useAnnouncements/NotificationsFeed.
 */
export function useActionableAnnouncements(
  hostelId: string | undefined,
  userId: string | undefined
): { announcements: Announcement[]; dismiss: (announcementId: string) => void } {
  const announcements = useAnnouncements(hostelId);
  const shortages = useShortages(hostelId);
  const swaps = useSwaps(hostelId);
  const plans = useDutyPlans(hostelId);
  const [votedReportIds, setVotedReportIds] = useState<Set<string>>(new Set());
  const [votedRequestIds, setVotedRequestIds] = useState<Set<string>>(new Set());
  const [votedCostEditIds, setVotedCostEditIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [tick, setTick] = useState(0);

  // Signal-only channels — bump `tick` so the vote fetches below re-run
  // whenever anyone (including this user) casts a vote in the hostel.
  useEffect(() => {
    if (!hostelId) return;
    const unsubReports = repo.cookAttendance.subscribe(hostelId, () => setTick((t) => t + 1));
    const unsubEdits = repo.mealEdits.subscribe(hostelId, () => setTick((t) => t + 1));
    const unsubCostEdits = repo.shoppingCostEdits.subscribe(hostelId, () => setTick((t) => t + 1));
    return () => {
      unsubReports();
      unsubEdits();
      unsubCostEdits();
    };
  }, [hostelId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    repo.announcements.listDismissedIds(userId).then((ids) => {
      if (!cancelled) setDismissedIds(new Set(ids));
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const dismiss = (announcementId: string) => {
    if (!userId) return;
    setDismissedIds((prev) => new Set(prev).add(announcementId));
    repo.announcements.dismiss(userId, announcementId);
  };

  const reportIds = [
    ...new Set(
      announcements
        .filter((a) => a.kind === "cook-absence-poll")
        .map((a) => payloadOf(a)?.reportId)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const requestIds = [
    ...new Set(
      announcements
        .filter((a) => a.kind === "meal-edit-poll")
        .map((a) => payloadOf(a)?.requestId)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const costEditIds = [
    ...new Set(
      announcements
        .filter((a) => a.kind === "shopping-cost-edit-poll")
        .map((a) => payloadOf(a)?.requestId)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const reportKey = reportIds.join(",");
  const requestKey = requestIds.join(",");
  const costEditKey = costEditIds.join(",");

  useEffect(() => {
    // No reset-to-empty here when reportIds is empty: with nothing to look
    // up, any stale ids left in state simply never match a rendered
    // cook-absence-poll announcement again, so it's harmless — and avoids
    // calling setState synchronously from the effect body.
    if (!userId || reportIds.length === 0) return;
    let cancelled = false;
    Promise.all(reportIds.map((id) => repo.cookAttendance.listVotes(id))).then((results) => {
      if (cancelled) return;
      const voted = new Set<string>();
      results.forEach((votes, i) => {
        if (votes.some((v) => v.userId === userId)) voted.add(reportIds[i]);
      });
      setVotedReportIds(voted);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, reportKey, tick]);

  useEffect(() => {
    // Same reasoning as the report-votes effect above — no eager reset.
    if (!userId || requestIds.length === 0) return;
    let cancelled = false;
    Promise.all(requestIds.map((id) => repo.mealEdits.listVotes(id))).then((results) => {
      if (cancelled) return;
      const voted = new Set<string>();
      results.forEach((votes, i) => {
        if (votes.some((v) => v.userId === userId)) voted.add(requestIds[i]);
      });
      setVotedRequestIds(voted);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, requestKey, tick]);

  useEffect(() => {
    // Same reasoning again — shopping-cost-edit-poll was previously missing
    // its own case entirely (fell through to `default: return true`), so it
    // never dropped off this list even after everyone had voted.
    if (!userId || costEditIds.length === 0) return;
    let cancelled = false;
    Promise.all(costEditIds.map((id) => repo.shoppingCostEdits.listVotes(id))).then((results) => {
      if (cancelled) return;
      const voted = new Set<string>();
      results.forEach((votes, i) => {
        if (votes.some((v) => v.userId === userId)) voted.add(costEditIds[i]);
      });
      setVotedCostEditIds(voted);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, costEditKey, tick]);

  const filtered = announcements.filter((a) => {
    if (dismissedIds.has(a.id)) return false;
    const payload = payloadOf(a);
    switch (a.kind) {
      case "cook-absence-poll":
        return !(payload?.reportId && votedReportIds.has(payload.reportId));
      case "meal-edit-poll":
        return !(payload?.requestId && votedRequestIds.has(payload.requestId));
      case "shopping-cost-edit-poll":
        return !(payload?.requestId && votedCostEditIds.has(payload.requestId));
      case "shortage-alert": {
        const s = shortages.find((x) => x.id === payload?.shortageId);
        return !(s && s.status === "resolved");
      }
      case "swap-request": {
        // Only while the swap is still pending. Cancelled/denied/accepted — or
        // a swap whose plan was replaced (so the row is gone) — all drop it,
        // instead of lingering because the resolved/missing swap wasn't "found".
        const s = swaps.find((x) => x.id === payload?.swapId);
        return s?.status === "pending";
      }
      case "spin-wheel-cta": {
        // Drop once this member has spun that rotation — or if the rotation is
        // gone (replaced) or already over, so a stale "spin now" never lingers.
        const plan = plans.find((p) => p.id === payload?.planId);
        if (!plan || plan.endDate < today()) return false;
        return !(userId && plan.spun?.[userId]);
      }
      default:
        return true;
    }
  });

  return { announcements: filtered, dismiss };
}

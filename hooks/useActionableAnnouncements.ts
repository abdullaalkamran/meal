"use client";

import { useEffect, useState } from "react";
import { repo, type Announcement } from "@/lib/data";
import { useAnnouncements } from "./useAnnouncements";
import { useShortages } from "./useShortages";
import { useSwaps } from "./useSwaps";

type Payload = { reportId?: string; requestId?: string; shortageId?: string; swapId?: string };

const payloadOf = (a: Announcement) => a.payload as Payload | undefined;

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
): Announcement[] {
  const announcements = useAnnouncements(hostelId);
  const shortages = useShortages(hostelId);
  const swaps = useSwaps(hostelId);
  const [votedReportIds, setVotedReportIds] = useState<Set<string>>(new Set());
  const [votedRequestIds, setVotedRequestIds] = useState<Set<string>>(new Set());
  const [tick, setTick] = useState(0);

  // Signal-only channels — bump `tick` so the vote fetches below re-run
  // whenever anyone (including this user) casts a vote in the hostel.
  useEffect(() => {
    if (!hostelId) return;
    const unsubReports = repo.cookAttendance.subscribe(hostelId, () => setTick((t) => t + 1));
    const unsubEdits = repo.mealEdits.subscribe(hostelId, () => setTick((t) => t + 1));
    return () => {
      unsubReports();
      unsubEdits();
    };
  }, [hostelId]);

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
  const reportKey = reportIds.join(",");
  const requestKey = requestIds.join(",");

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

  return announcements.filter((a) => {
    const payload = payloadOf(a);
    switch (a.kind) {
      case "cook-absence-poll":
        return !(payload?.reportId && votedReportIds.has(payload.reportId));
      case "meal-edit-poll":
        return !(payload?.requestId && votedRequestIds.has(payload.requestId));
      case "shortage-alert": {
        const s = shortages.find((x) => x.id === payload?.shortageId);
        return !(s && s.status === "resolved");
      }
      case "swap-request": {
        const s = swaps.find((x) => x.id === payload?.swapId);
        return !(s && s.status !== "pending");
      }
      default:
        return true;
    }
  });
}

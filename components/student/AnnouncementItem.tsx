"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  Clock,
  HelpCircle,
  Megaphone,
  PieChart,
  Soup,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { repo, type Announcement, type AnnouncementKind, type CookAttendanceVote } from "@/lib/data";
import { formatRelativeTime } from "@/lib/utils/date";

interface CategoryMeta {
  tag: string;
  icon: LucideIcon;
  color: string; // hex, used for the left border + icon + tag text
  soft: string; // tailwind bg class for tinted backgrounds
}

const CATEGORY: Record<AnnouncementKind, CategoryMeta> = {
  "cook-absence-poll": { tag: "Vote", icon: Soup, color: "#7C6CF6", soft: "bg-[#7C6CF6]/10" },
  "spin-wheel-cta": { tag: "Activity", icon: PieChart, color: "#10BFB4", soft: "bg-primary-soft" },
  "swap-request": { tag: "Request", icon: ArrowLeftRight, color: "#F59E0B", soft: "bg-orange-soft" },
  "swap-completed": { tag: "Activity", icon: CheckCircle2, color: "#10BFB4", soft: "bg-primary-soft" },
  "swap-denied": { tag: "Request", icon: ArrowLeftRight, color: "#F59E0B", soft: "bg-orange-soft" },
  "cook-leave-approved": { tag: "Notice", icon: Megaphone, color: "#4C7DF0", soft: "bg-blue-soft" },
  "cook-absence-resolved": { tag: "Notice", icon: Megaphone, color: "#EF4444", soft: "bg-danger-soft" },
  general: { tag: "Notice", icon: Megaphone, color: "#4C7DF0", soft: "bg-blue-soft" },
};

export function AnnouncementItem({
  announcement,
  userId,
}: {
  announcement: Announcement;
  userId: string | undefined;
}) {
  const [votes, setVotes] = useState<CookAttendanceVote[]>([]);
  const reportId = (announcement.payload as { reportId?: string } | undefined)?.reportId;
  const meta = CATEGORY[announcement.kind];

  useEffect(() => {
    if (announcement.kind !== "cook-absence-poll" || !reportId) return;
    let cancelled = false;
    const load = () =>
      repo.cookAttendance.listVotes(reportId).then((v) => {
        if (!cancelled) setVotes(v);
      });
    load();
    const unsub = announcement.hostelId
      ? repo.cookAttendance.subscribe(announcement.hostelId, load)
      : undefined;
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [announcement.kind, announcement.hostelId, reportId]);

  const myVote = votes.find((v) => v.userId === userId)?.choice;
  const vote = (choice: "yes" | "no" | "dk") => {
    if (reportId && userId) repo.cookAttendance.vote(reportId, userId, choice);
  };

  return (
    <div
      className="flex gap-3 rounded-card bg-card p-4 shadow-chip"
      style={{ borderLeft: `4px solid ${meta.color}` }}
    >
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-btn ${meta.soft}`}
        style={{ color: meta.color }}
      >
        <Icon icon={meta.icon} size={20} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <div
            className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide ${meta.soft}`}
            style={{ color: meta.color }}
          >
            {meta.tag}
          </div>
          <div className="flex shrink-0 items-center gap-1 text-[9.5px] font-medium text-text-secondary">
            <Icon icon={Clock} size={11} />
            {formatRelativeTime(announcement.createdAt)}
          </div>
        </div>

        <div className="text-[13.5px] font-bold">{announcement.title}</div>
        <div className="mt-0.5 text-[11.5px] font-normal text-text-secondary">
          {announcement.body}
        </div>

        {announcement.kind === "cook-absence-poll" && reportId && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => vote("yes")}
              className={`flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[11px] font-semibold ${
                myVote === "yes" ? "border-primary bg-primary-soft text-primary" : "border-border text-text-secondary"
              }`}
            >
              <CheckCircle2
                size={15}
                className={myVote === "yes" ? "fill-primary text-white" : "text-text-secondary"}
              />
              Yes &middot; Cooked
            </button>
            <button
              type="button"
              onClick={() => vote("no")}
              className={`flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[11px] font-semibold ${
                myVote === "no" ? "border-danger bg-danger-soft text-danger" : "border-border text-text-secondary"
              }`}
            >
              <XCircle size={15} className={myVote === "no" ? "fill-danger text-white" : "text-text-secondary"} />
              No &middot; Not cooked
            </button>
            <button
              type="button"
              onClick={() => vote("dk")}
              className={`flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[11px] font-semibold ${
                myVote === "dk" ? "border-text-secondary bg-bg text-text" : "border-border text-text-secondary"
              }`}
            >
              <HelpCircle size={15} />
              Don&rsquo;t know
            </button>
          </div>
        )}

        {(announcement.kind === "spin-wheel-cta" ||
          announcement.kind === "swap-request" ||
          announcement.kind === "swap-completed") && (
          <Link
            href="/student/shopping"
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold"
            style={{ color: meta.color }}
          >
            Open Shopping
            <Icon icon={ArrowRight} size={14} />
          </Link>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Megaphone } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { MonthNav } from "@/components/ui/MonthNav";
import { useToast } from "@/components/ui/Toast";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { repo } from "@/lib/data";
import { currentMonth, formatMonthLabel, formatShortDate } from "@/lib/utils/date";

export function AnnounceSheet({
  open,
  onClose,
  hostelId,
}: {
  open: boolean;
  onClose: () => void;
  hostelId: string | undefined;
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState<"new" | "history">("new");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [month, setMonth] = useState(currentMonth());

  const allAnnouncements = useAnnouncements(hostelId);
  // "What was said before" — general is the only kind a manager writes by
  // hand; every other kind (polls, resolved items, shortage alerts, …) is
  // generated automatically by some other flow, not an announcement someone
  // composed.
  const posted = allAnnouncements
    .filter((a) => a.kind === "general" && a.createdAt.slice(0, 7) === month)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const submit = async () => {
    if (!hostelId || !title.trim()) return;
    await repo.announcements.post({ hostelId, kind: "general", title: title.trim(), body: body.trim() });
    toast("Announcement posted");
    setTitle("");
    setBody("");
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={tab === "new" ? "Post announcement" : "Announcement history"}>
      <div className="mb-4 inline-flex w-full gap-1 rounded-pill border border-border bg-card p-1 shadow-chip">
        <button
          type="button"
          onClick={() => setTab("new")}
          className={`min-h-9 flex-1 cursor-pointer rounded-pill px-4 font-sans text-[11.5px] font-extrabold transition-colors ${
            tab === "new" ? "bg-primary text-white" : "bg-transparent text-text"
          }`}
        >
          New
        </button>
        <button
          type="button"
          onClick={() => setTab("history")}
          className={`min-h-9 flex-1 cursor-pointer rounded-pill px-4 font-sans text-[11.5px] font-extrabold transition-colors ${
            tab === "history" ? "bg-primary text-white" : "bg-transparent text-text"
          }`}
        >
          History
        </button>
      </div>

      {tab === "new" ? (
        <>
          <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">TITLE</div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Water supply maintenance tomorrow"
            className="mb-4 w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
          />
          <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">DETAILS</div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="mb-4 h-24 w-full resize-none rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-semibold"
          />
          <Button fullWidth onClick={submit} disabled={!title.trim()}>
            Post to all members
          </Button>
        </>
      ) : (
        <>
          <div className="mb-4">
            <MonthNav value={month} onChange={setMonth} />
          </div>
          <div className="flex flex-col gap-2.5">
            {posted.length === 0 ? (
              <Card className="text-center text-[11.5px] font-semibold text-text-secondary">
                No announcements posted in {formatMonthLabel(month)}.
              </Card>
            ) : (
              posted.map((a) => (
                <Card key={a.id}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <Icon icon={Megaphone} size={14} className="shrink-0 text-primary" />
                      <div className="truncate text-[12px] font-extrabold">{a.title}</div>
                    </div>
                    <div className="shrink-0 text-[9.5px] font-bold text-text-secondary">
                      {formatShortDate(a.createdAt.slice(0, 10))}
                    </div>
                  </div>
                  {a.body && (
                    <div className="text-[10.5px] font-semibold text-text-secondary">{a.body}</div>
                  )}
                </Card>
              ))
            )}
          </div>
        </>
      )}
    </Sheet>
  );
}

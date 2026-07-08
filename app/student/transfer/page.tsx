"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useTransfers } from "@/hooks/useTransfers";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { repo, type Hostel } from "@/lib/data";
import { formatShortDate } from "@/lib/utils/date";

const STAGES: { key: string; label: string }[] = [
  { key: "requested", label: "Request submitted" },
  { key: "manager_review", label: "Manager approval" },
  { key: "owner_review", label: "Owner approval" },
  { key: "approved", label: "Migration & new room" },
];

const STAGE_SUBTEXT: Record<string, string> = {
  approved: "Bills close at your old hostel, open at the new one",
};

export default function StudentTransferPage() {
  const { user, hostel, activeHostelId } = useSession();
  const transfers = useTransfers(activeHostelId);
  const { toast } = useToast();
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [toHostelId, setToHostelId] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    repo.hostels.listAll().then(setHostels);
  }, []);

  const myActive = transfers.find(
    (t) => t.userId === user?.id && t.stage !== "approved" && t.stage !== "denied"
  );
  const targetHostels = hostels.filter((h) => h.id !== activeHostelId);
  const toHostel = hostels.find((h) => h.id === myActive?.toHostelId);

  const submit = async () => {
    if (!user || !activeHostelId || !toHostelId || !reason.trim()) return;
    await repo.transfers.request({
      userId: user.id,
      fromHostelId: activeHostelId,
      toHostelId,
      reason: reason.trim(),
    });
    toast("Transfer request submitted");
    setReason("");
    setToHostelId("");
  };

  const cancel = async () => {
    if (!myActive) return;
    await repo.transfers.cancel(myActive.id);
    toast("Transfer request cancelled");
  };

  const stageIndex = myActive ? STAGES.findIndex((s) => s.key === myActive.stage) : -1;

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="text-[17.5px] font-extrabold tracking-tight">Hostel transfer</div>

      {myActive ? (
        <>
          <Card>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1 rounded-btn bg-bg p-3 text-center">
                <div className="text-[9.5px] font-bold text-text-secondary">From</div>
                <div className="truncate text-[12px] font-extrabold">{hostel?.name}</div>
              </div>
              <Icon icon={ArrowRight} size={16} className="shrink-0 text-text-secondary" />
              <div className="min-w-0 flex-1 rounded-btn bg-primary-soft p-3 text-center">
                <div className="text-[9.5px] font-bold text-primary">To</div>
                <div className="truncate text-[12px] font-extrabold text-primary">{toHostel?.name}</div>
              </div>
            </div>
            <div className="mt-3 text-[11px] font-semibold text-text-secondary">
              Reason: {myActive.reason}
            </div>
          </Card>

          <Card>
            <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
              Timeline
            </div>
            <div className="flex flex-col">
              {STAGES.map((s, i) => {
                const done = i < stageIndex || myActive.stage === s.key;
                const isPast = i < stageIndex;
                const timelineEntry = myActive.timeline.find((t) => t.stage === s.key);
                const isLast = i === STAGES.length - 1;
                return (
                  <div key={s.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9.5px] font-extrabold ${
                          isPast
                            ? "bg-primary text-white"
                            : done
                              ? "bg-orange-soft text-orange"
                              : "border border-border text-text-secondary"
                        }`}
                      >
                        {isPast ? <Icon icon={Check} size={14} /> : i + 1}
                      </div>
                      {!isLast && <div className={`w-px flex-1 ${isPast ? "bg-primary" : "bg-border"}`} />}
                    </div>
                    <div className="pb-5">
                      <div className={`text-[12px] font-extrabold ${done || isPast ? "" : "text-text-secondary"}`}>
                        {s.label}
                      </div>
                      <div className="text-[10.5px] font-semibold text-text-secondary">
                        {timelineEntry
                          ? `${formatShortDate(timelineEntry.at.slice(0, 10))}${
                              timelineEntry.by === user?.id ? " · by you" : ""
                            }`
                          : done && s.key === "owner_review"
                            ? "Pending review"
                            : STAGE_SUBTEXT[s.key] ?? ""}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <button
            type="button"
            onClick={cancel}
            className="min-h-12 cursor-pointer rounded-btn bg-danger-soft text-[12.5px] font-extrabold text-danger"
          >
            Cancel request
          </button>
        </>
      ) : (
        <Card>
          <div className="mb-3 text-[13.5px] font-extrabold">Request a transfer</div>
          <div className="mb-2 text-[10.5px] font-extrabold text-text-secondary">TO HOSTEL</div>
          <div className="mb-4 flex flex-wrap gap-2">
            {targetHostels.map((h) => (
              <button key={h.id} type="button" onClick={() => setToHostelId(h.id)}>
                <Chip tone="primary" active={toHostelId === h.id}>
                  {h.name}
                </Chip>
              </button>
            ))}
          </div>
          <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">REASON</div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Closer to campus"
            className="mb-4 h-20 w-full resize-none rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-semibold"
          />
          <Button fullWidth onClick={submit} disabled={!toHostelId || !reason.trim()}>
            Submit request
          </Button>
        </Card>
      )}
    </div>
  );
}

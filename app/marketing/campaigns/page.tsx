"use client";

import { useState } from "react";
import { Megaphone, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { useCampaigns } from "@/hooks/useCampaigns";
import { CampaignSheet } from "@/components/marketing/CampaignSheet";
import { repo, type Campaign } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";
import { formatShortDate } from "@/lib/utils/date";

const NEXT_STATUS: Record<Campaign["status"], Campaign["status"] | null> = {
  planned: "running",
  running: "done",
  done: null,
};
const STATUS_TONE: Record<Campaign["status"], string> = {
  planned: "bg-bg text-text-secondary",
  running: "bg-primary-soft text-primary",
  done: "bg-blue-soft text-blue",
};

export default function CampaignsPage() {
  const campaigns = useCampaigns();
  const { toast } = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);

  const advance = async (c: Campaign) => {
    const next = NEXT_STATUS[c.status];
    if (!next) return;
    await repo.campaigns.updateStatus(c.id, next);
    toast(`${c.name} → ${next}`);
  };

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[17.5px] font-extrabold tracking-tight">Campaigns</div>
          <div className="text-[10.5px] font-semibold text-text-secondary">{campaigns.length} total</div>
        </div>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="min-h-10 cursor-pointer rounded-pill px-4 text-[11.5px] font-extrabold text-white"
          style={{ background: "linear-gradient(135deg, var(--gradient-accent-from), var(--gradient-accent-to))" }}
        >
          + Campaign
        </button>
      </div>

      <div className="flex flex-col gap-2.5">
        {campaigns.length === 0 && (
          <Card className="text-center text-[11.5px] font-semibold text-text-secondary">No campaigns yet.</Card>
        )}
        {campaigns.map((c) => (
          <Card key={c.id} className="flex flex-col gap-2.5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn bg-blue-soft text-blue">
                <Icon icon={Megaphone} size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-extrabold">{c.name}</div>
                <div className="text-[10.5px] font-semibold text-text-secondary">{c.channel}</div>
                <div className="text-[9.5px] font-semibold text-text-secondary">
                  From {formatShortDate(c.startDate)} · {formatBDT(c.budget)} budget
                </div>
                {c.note && <div className="mt-0.5 text-[9.5px] font-semibold text-text-secondary">{c.note}</div>}
              </div>
              <span className={`shrink-0 rounded-pill px-2.5 py-1 text-[9px] font-extrabold capitalize ${STATUS_TONE[c.status]}`}>
                {c.status}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {NEXT_STATUS[c.status] && (
                <button type="button" onClick={() => advance(c)}>
                  <Chip tone="primary" active>
                    Mark {NEXT_STATUS[c.status]}
                  </Chip>
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  await repo.campaigns.remove(c.id);
                  toast("Campaign removed");
                }}
                aria-label="Remove campaign"
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-danger-soft text-danger"
              >
                <Icon icon={Trash2} size={14} />
              </button>
            </div>
          </Card>
        ))}
      </div>

      <CampaignSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  );
}

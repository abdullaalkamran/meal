"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { HostelPicker } from "@/components/hostel/HostelPicker";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { repo, type ActivityLog } from "@/lib/data";
import { formatRelativeTime } from "@/lib/utils/date";

/** The owner's audit trail: every recorded hostel action (expenses, bills,
 * bans, rooms, settings, master meal switches, staff changes) with who did
 * it and when. */
export default function OwnerActivityPage() {
  const { activeHostelId } = useSession();
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    if (!activeHostelId) return;
    return repo.activity.subscribe(activeHostelId, setLogs);
  }, [activeHostelId]);

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div>
        <div className="text-[17.5px] font-extrabold tracking-tight">Activity log</div>
        <div className="text-[10.5px] font-semibold text-text-secondary">
          Who did what in your hostel — newest first
        </div>
      </div>

      <HostelPicker />

      <div className="flex flex-col gap-2">
        {logs.length === 0 && (
          <Card className="text-center text-[11.5px] font-semibold text-text-secondary">
            No recorded activity yet — actions like recording expenses, generating bills,
            and changing settings will appear here.
          </Card>
        )}
        {logs.map((log) => (
          <Card key={log.id} className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Icon icon={History} size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11.5px] font-extrabold">{log.action}</div>
              {log.detail && (
                <div className="text-[10px] font-semibold text-text-secondary">{log.detail}</div>
              )}
              <div className="mt-0.5 text-[9.5px] font-semibold text-text-secondary">
                {log.actorName} · {formatRelativeTime(log.createdAt)}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useHostelsByOwner } from "@/hooks/useHostel";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { repo, type HostelTransferRequest, type User } from "@/lib/data";

const OWNER_ROWS = [
  "Managers & cooks",
  "Roles & permissions",
  "Hostel settings",
  "Finance settings",
  "Monthly closing",
  "Backup & activity logs",
];

export default function OwnerMorePage() {
  const { user } = useSession();
  const hostels = useHostelsByOwner(user?.id);
  const { toast } = useToast();
  const [transfers, setTransfers] = useState<HostelTransferRequest[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    if (hostels.length === 0) return;
    Promise.all(hostels.map((h) => repo.transfers.listByHostel(h.id))).then((lists) => {
      const map = new Map<string, HostelTransferRequest>();
      lists.flat().forEach((t) => map.set(t.id, t));
      setTransfers([...map.values()]);
    });
    Promise.all(hostels.map((h) => repo.users.listByHostel(h.id))).then((lists) =>
      setUsers(lists.flat())
    );
  }, [hostels]);

  const pending = transfers.filter((t) => t.stage === "owner_review");
  const hostelName = (id: string) => hostels.find((h) => h.id === id)?.name ?? id;
  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? id;

  const decide = async (id: string, approve: boolean) => {
    if (!user) return;
    await repo.transfers.advance(id, user.id, approve);
    setTransfers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, stage: approve ? "approved" : "denied" } : t))
    );
    toast(approve ? "Transfer approved — migration complete" : "Transfer rejected");
  };

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="text-[17.5px] font-extrabold tracking-tight">Approvals &amp; Settings</div>

      <Card>
        <div className="mb-3 text-[13.5px] font-extrabold">Hostel transfer approvals</div>
        <div className="flex flex-col gap-2">
          {pending.length === 0 && (
            <div className="text-[11.5px] font-semibold text-text-secondary">
              No transfers pending owner approval.
            </div>
          )}
          {pending.map((t) => (
            <div key={t.id} className="rounded-btn bg-bg p-3">
              <div className="mb-1 text-[12px] font-bold">
                {userName(t.userId)}: {hostelName(t.fromHostelId)} → {hostelName(t.toHostelId)}
              </div>
              <div className="mb-2 text-[11px] font-semibold text-text-secondary">
                {t.reason}
              </div>
              <div className="flex gap-2">
                <Button fullWidth onClick={() => decide(t.id, true)}>
                  Approve &amp; migrate
                </Button>
                <Button fullWidth variant="secondary" onClick={() => decide(t.id, false)}>
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-1 text-[13.5px] font-extrabold">Owner settings</div>
        <div className="flex flex-col">
          {OWNER_ROWS.map((row) => (
            <button
              key={row}
              type="button"
              onClick={() => toast(`${row} — coming in a later build phase`)}
              className="flex min-h-12 cursor-pointer items-center border-b border-border text-left text-[12px] font-bold last:border-b-0"
            >
              {row}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Building2, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { repo, type Hostel, type Room, type User } from "@/lib/data";

/** Service Manager verifies that a hostel's listed details are genuine — the
 * "Verified" badge people browsing hostels to join can trust. */
export default function ServiceHostelsPage() {
  const { toast } = useToast();
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [roomsByHostel, setRoomsByHostel] = useState<Record<string, Room[]>>({});
  const [ownerById, setOwnerById] = useState<Record<string, User | undefined>>({});
  const [query, setQuery] = useState("");

  const load = async () => {
    const all = await repo.hostels.listAll();
    setHostels(all);
    const [rooms, owners] = await Promise.all([
      Promise.all(all.map((h) => repo.rooms.listByHostel(h.id))),
      Promise.all(all.map((h) => repo.users.getUser(h.ownerId))),
    ]);
    setRoomsByHostel(Object.fromEntries(all.map((h, i) => [h.id, rooms[i]])));
    setOwnerById(Object.fromEntries(all.map((h, i) => [h.id, owners[i]])));
  };

  useEffect(() => {
    queueMicrotask(() => void load());
  }, []);

  const toggle = async (h: Hostel) => {
    await repo.hostels.setVerified(h.id, !h.verified);
    toast(h.verified ? `Verification removed from ${h.name}` : `${h.name} verified`);
    await load();
  };

  const seatsOf = (id: string) =>
    (roomsByHostel[id] ?? []).reduce((sum, r) => sum + r.capacity, 0);

  const q = query.toLowerCase();
  const shown = hostels.filter(
    (h) => !q || h.name.toLowerCase().includes(q) || h.area.toLowerCase().includes(q)
  );
  const verifiedCount = hostels.filter((h) => h.verified).length;

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div>
        <div className="text-[17.5px] font-extrabold tracking-tight">Hostel verification</div>
        <div className="text-[10.5px] font-semibold text-text-secondary">
          {verifiedCount} of {hostels.length} verified · a verified badge shows to people browsing to join
        </div>
      </div>

      <div className="relative">
        <Icon icon={Search} size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or area"
          className="w-full rounded-btn border border-border bg-card py-2.5 pl-9 pr-3 text-[12px] font-bold shadow-chip"
        />
      </div>

      {shown.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-10 text-center">
          <Icon icon={Building2} size={26} className="text-text-secondary" />
          <div className="text-[12px] font-extrabold">No hostels found</div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {shown.map((h) => {
            const owner = ownerById[h.id];
            return (
              <Card key={h.id} className="flex items-center gap-3">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-btn ${
                    h.verified ? "bg-primary-soft text-primary" : "bg-bg text-text-secondary"
                  }`}
                >
                  <Icon icon={h.verified ? BadgeCheck : Building2} size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <div className="truncate text-[12.5px] font-extrabold">{h.name}</div>
                    {h.suspended && (
                      <span className="rounded-pill bg-danger-soft px-1.5 py-0.5 text-[8px] font-extrabold text-danger">
                        Suspended
                      </span>
                    )}
                  </div>
                  <div className="truncate text-[9.5px] font-semibold text-text-secondary">
                    {h.area} · {seatsOf(h.id)} seats{owner ? ` · owner ${owner.name}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Switch checked={!!h.verified} onChange={() => toggle(h)} />
                  <span className={`text-[8.5px] font-extrabold ${h.verified ? "text-primary" : "text-text-secondary"}`}>
                    {h.verified ? "VERIFIED" : "UNVERIFIED"}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

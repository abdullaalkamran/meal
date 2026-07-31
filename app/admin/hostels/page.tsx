"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, BedDouble, ChevronRight, MapPin, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { repo, type Hostel, type Room, type User } from "@/lib/data";

type StatusFilter = "all" | "active" | "suspended";

export default function AdminHostelsPage() {
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [roomsByHostel, setRoomsByHostel] = useState<Record<string, Room[]>>({});
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  useEffect(() => {
    (async () => {
      const [hs, us] = await Promise.all([repo.hostels.listAll(), repo.users.listAll()]);
      setHostels(hs);
      setUsers(us);
      const rooms = await Promise.all(hs.map((h) => repo.rooms.listByHostel(h.id)));
      setRoomsByHostel(Object.fromEntries(hs.map((h, i) => [h.id, rooms[i]])));
    })();
  }, []);

  const managerName = (h: Hostel) => users.find((u) => u.id === h.managerId)?.name ?? "—";
  const seatsOf = (id: string) => (roomsByHostel[id] ?? []).reduce((sum, r) => sum + r.capacity, 0);

  const q = query.trim().toLowerCase();
  const shown = hostels.filter((h) => {
    if (status === "active" && h.suspended) return false;
    if (status === "suspended" && !h.suspended) return false;
    if (verifiedOnly && !h.verified) return false;
    if (!q) return true;
    return (
      h.name.toLowerCase().includes(q) ||
      h.area.toLowerCase().includes(q) ||
      managerName(h).toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div>
        <div className="text-[17.5px] font-extrabold tracking-tight">Hostels</div>
        <div className="text-[10.5px] font-semibold text-text-secondary">
          {hostels.filter((h) => !h.suspended).length} active · {hostels.length} total
        </div>
      </div>

      <div className="relative">
        <Icon icon={Search} size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, area or manager…"
          className="w-full rounded-btn border border-border bg-card py-2.5 pl-9 pr-3 text-[12px] font-bold shadow-chip"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          options={[
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
            { value: "suspended", label: "Suspended" },
          ]}
          value={status}
          onChange={setStatus}
        />
        <button type="button" onClick={() => setVerifiedOnly((v) => !v)}>
          <Chip tone="primary" active={verifiedOnly}>
            Verified only
          </Chip>
        </button>
      </div>

      {shown.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-10 text-center">
          <Icon icon={BedDouble} size={26} className="text-text-secondary" />
          <div className="text-[12px] font-extrabold">No hostels match</div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {shown.map((h) => (
            <Link key={h.id} href={`/admin/hostels/${h.id}`}>
              <Card className={`flex items-center gap-3 ${h.suspended ? "opacity-70" : ""}`}>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn bg-primary-soft text-primary">
                  <Icon icon={h.verified ? BadgeCheck : BedDouble} size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <div className="truncate text-[12.5px] font-extrabold">{h.name}</div>
                    {h.suspended && (
                      <span className="shrink-0 rounded-pill bg-danger-soft px-1.5 py-0.5 text-[8.5px] font-extrabold text-danger">
                        Suspended
                      </span>
                    )}
                    {h.verified && (
                      <span className="shrink-0 rounded-pill bg-primary-soft px-1.5 py-0.5 text-[8.5px] font-extrabold text-primary">
                        Verified
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-text-secondary">
                    <Icon icon={MapPin} size={11} /> {h.area}
                  </div>
                  <div className="truncate text-[9.5px] font-semibold text-text-secondary">
                    Manager {managerName(h)} · {seatsOf(h.id)} seats
                  </div>
                </div>
                <Icon icon={ChevronRight} size={16} className="shrink-0 text-text-secondary" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

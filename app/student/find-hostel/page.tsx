"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Building2, Clock, Search } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { repo, type Hostel, type JoinRequest, type Room } from "@/lib/data";

function FindHostelInner() {
  const { user } = useSession();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const invitedHostelId = searchParams.get("hostel");

  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [roomsByHostel, setRoomsByHostel] = useState<Record<string, Room[]>>({});
  const [myRequests, setMyRequests] = useState<JoinRequest[]>([]);
  const [query, setQuery] = useState("");

  const load = async () => {
    const all = (await repo.hostels.listAll()).filter((h) => !h.suspended);
    setHostels(all);
    const rooms = await Promise.all(all.map((h) => repo.rooms.listByHostel(h.id)));
    setRoomsByHostel(Object.fromEntries(all.map((h, i) => [h.id, rooms[i]])));
    if (user) setMyRequests(await repo.joinRequests.listByUser(user.id));
  };

  useEffect(() => {
    queueMicrotask(() => void load());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const freeSeats = (hostelId: string) =>
    (roomsByHostel[hostelId] ?? []).reduce(
      (sum, r) => sum + Math.max(r.capacity - r.occupantIds.length, 0),
      0
    );

  const requestFor = (hostelId: string) =>
    myRequests.find((r) => r.hostelId === hostelId && r.status === "pending");
  const hasPendingAnywhere = myRequests.some((r) => r.status === "pending");

  const sendRequest = async (h: Hostel) => {
    if (!user) return;
    await repo.joinRequests.create({
      hostelId: h.id,
      userId: user.id,
      name: user.name,
      phone: user.phone,
    });
    toast(`Join request sent to ${h.name}`);
    await load();
  };

  const shown = hostels
    .filter(
      (h) =>
        !query.trim() ||
        h.name.toLowerCase().includes(query.toLowerCase()) ||
        h.area.toLowerCase().includes(query.toLowerCase())
    )
    // The QR-invited hostel floats to the top.
    .sort((a, b) => Number(b.id === invitedHostelId) - Number(a.id === invitedHostelId));

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div>
        <div className="text-[17.5px] font-extrabold tracking-tight">Find your hostel</div>
        <div className="text-[10.5px] font-semibold text-text-secondary">
          Send a join request — you become a member once the manager approves and assigns
          your room
        </div>
      </div>

      {hasPendingAnywhere && (
        <Card className="flex items-center gap-3 border border-orange/30 bg-orange-soft">
          <Icon icon={Clock} size={16} className="shrink-0 text-orange" />
          <div className="text-[11px] font-bold text-orange">
            Your join request is pending — the manager will review it and assign your room.
          </div>
        </Card>
      )}

      <div className="flex items-center gap-2 rounded-card border border-border bg-card px-3 shadow-chip">
        <Icon icon={Search} size={14} className="shrink-0 text-text-secondary" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or area…"
          className="min-h-11 w-full bg-transparent text-[12px] font-bold outline-none"
        />
      </div>

      <div className="flex flex-col gap-2.5">
        {shown.length === 0 && (
          <Card className="text-center text-[11.5px] font-semibold text-text-secondary">
            No hostels on the platform yet — ask your hostel owner to register, or check
            back soon.
          </Card>
        )}
        {shown.map((h) => {
          const pending = requestFor(h.id);
          const seats = freeSeats(h.id);
          const invited = h.id === invitedHostelId;
          return (
            <Card key={h.id} className={invited ? "border border-primary" : undefined}>
              <div className="mb-2.5 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Icon icon={Building2} size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[12.5px] font-extrabold">
                    {h.name}
                    {invited && (
                      <span className="rounded-pill bg-primary-soft px-2 py-0.5 text-[8.5px] font-extrabold text-primary">
                        Invited
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] font-semibold text-text-secondary">
                    {h.area} · {seats} free seat{seats === 1 ? "" : "s"} · meals at actual
                    monthly cost
                  </div>
                </div>
              </div>
              {pending ? (
                <div className="rounded-btn bg-bg px-3 py-2.5 text-center text-[11px] font-extrabold text-text-secondary">
                  Request pending…
                </div>
              ) : (
                <Button fullWidth onClick={() => sendRequest(h)}>
                  Send join request
                </Button>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/** A signed-up member without a hostel lands here (also the target of the
 * manager/owner QR invite: /student/find-hostel?hostel=<id>). */
export default function FindHostelPage() {
  return (
    <Suspense fallback={null}>
      <FindHostelInner />
    </Suspense>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, Building2, DoorOpen, MapPin, Phone } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { JoinRequestSheet } from "@/components/student/JoinRequestSheet";
import { formatBDT } from "@/lib/utils/currency";
import { formatShortDate } from "@/lib/utils/date";
import type { PublicHostelView } from "@/lib/types/publicHostel";

/** Public, no-login landing page a visitor reaches by scanning the hostel's
 * door QR. Shows the hostel + room availability; sending a join request needs
 * a signed-in, member-less account. */
export default function PublicHostelPage() {
  const { hostelId } = useParams<{ hostelId: string }>();
  const { user } = useSession();
  const [view, setView] = useState<PublicHostelView | null | undefined>(undefined);
  const [joinOpen, setJoinOpen] = useState(false);

  useEffect(() => {
    if (!hostelId) return;
    let cancelled = false;
    fetch(`/api/public/hostel/${hostelId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => !cancelled && setView(data))
      .catch(() => !cancelled && setView(null));
    return () => {
      cancelled = true;
    };
  }, [hostelId]);

  if (view === undefined) {
    return <div className="mx-auto max-w-md px-5 py-16 text-center text-[12px] font-semibold text-text-secondary">Loading…</div>;
  }
  if (view === null) {
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center">
        <div className="text-[15px] font-extrabold">Hostel not found</div>
        <div className="mt-1 text-[11.5px] font-semibold text-text-secondary">
          This QR may be out of date — ask the hostel for a fresh one.
        </div>
      </div>
    );
  }

  const totalFree = view.rooms.reduce((s, r) => s + r.freeNow, 0);
  const totalUpcoming = view.rooms.reduce((s, r) => s + r.upcoming.length, 0);
  // A member-less signed-in account can request; a member cannot (transfer instead).
  const isMember = !!user && !!user.hostelId && (user.role === "student" || user.role === "manager");

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-5 py-8">
      <div className="text-center text-[13px] font-extrabold tracking-tight text-primary">MyDorm</div>

      {/* Hostel header */}
      <Card>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Icon icon={view.verified ? BadgeCheck : Building2} size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <div className="truncate text-[16px] font-extrabold">{view.name}</div>
              {view.verified && (
                <span className="flex shrink-0 items-center gap-0.5 rounded-pill bg-primary-soft px-1.5 py-0.5 text-[8px] font-extrabold text-primary">
                  <Icon icon={BadgeCheck} size={9} /> Verified
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-[10.5px] font-semibold text-text-secondary">
              <Icon icon={MapPin} size={11} /> {view.area}
            </div>
            {view.street && <div className="mt-0.5 text-[10px] font-semibold text-text-secondary">{view.street}</div>}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold">
          {view.gender && (
            <span className={`rounded-pill px-2.5 py-1 ${view.gender === "girls" ? "bg-[#7C6CF6]/10 text-[#7C6CF6]" : "bg-blue-soft text-blue"}`}>
              {view.gender === "girls" ? "Girls' hostel" : "Boys' hostel"}
            </span>
          )}
          <span className="rounded-pill bg-primary-soft px-2.5 py-1 text-primary">{totalFree} seat{totalFree === 1 ? "" : "s"} free now</span>
          {totalUpcoming > 0 && (
            <span className="rounded-pill bg-orange-soft px-2.5 py-1 text-orange">{totalUpcoming} opening soon</span>
          )}
          {view.seatRentFrom != null && (
            <span className="rounded-pill bg-bg px-2.5 py-1 text-text-secondary">Rent from {formatBDT(view.seatRentFrom)}/seat</span>
          )}
        </div>
      </Card>

      {view.facilities.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {view.facilities.map((f) => (
            <Chip key={f} tone="primary">{f}</Chip>
          ))}
        </div>
      )}

      {/* Rooms */}
      <div>
        <div className="mb-2 text-[13px] font-extrabold">Rooms</div>
        <div className="flex flex-col gap-2">
          {view.rooms.map((r) => (
            <Card key={r.roomId} className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg text-text-secondary">
                <Icon icon={DoorOpen} size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-extrabold">Room {r.number}</div>
                <div className="text-[10px] font-semibold text-text-secondary">
                  {formatBDT(r.seatRent)}/seat
                  {r.facilities?.length ? ` · ${r.facilities.join(", ")}` : ""}
                </div>
              </div>
              <div className="shrink-0 text-right">
                {r.freeNow > 0 ? (
                  <div className="text-[11px] font-extrabold text-primary">{r.freeNow} free</div>
                ) : r.upcoming.length > 0 ? (
                  <div className="text-[10px] font-extrabold text-orange">
                    free {formatShortDate(r.upcoming[0].freeFrom)}
                  </div>
                ) : (
                  <div className="text-[10px] font-bold text-text-secondary">Full</div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* House rules */}
      {view.rules?.trim() && (
        <div>
          <div className="mb-2 text-[13px] font-extrabold">House rules</div>
          <Card className="flex flex-col gap-2">
            {view.rules
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean)
              .map((rule, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-[11.5px] font-extrabold text-primary">{i + 1}.</span>
                  <span className="text-[11.5px] font-semibold text-text">{rule}</span>
                </div>
              ))}
          </Card>
        </div>
      )}

      {/* Contacts */}
      {(view.manager || view.owner) && (
        <Card className="flex flex-col gap-2">
          <div className="text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">Contact</div>
          {view.manager && <ContactRow role="Manager" name={view.manager.name} phone={view.manager.phone} />}
          {view.owner && <ContactRow role="Owner" name={view.owner.name} phone={view.owner.phone} />}
        </Card>
      )}

      {/* Join CTA */}
      {!user ? (
        <Card className="text-center">
          <div className="mb-2 text-[11.5px] font-semibold text-text-secondary">
            Sign in or create an account to send a join request.
          </div>
          <div className="flex gap-2">
            <Link href="/signup" className="flex min-h-11 flex-1 items-center justify-center rounded-btn bg-primary text-[12px] font-extrabold text-white">
              Create account
            </Link>
            <Link href="/login" className="flex min-h-11 flex-1 items-center justify-center rounded-btn border border-border text-[12px] font-extrabold">
              Log in
            </Link>
          </div>
          <div className="mt-2 text-[9.5px] font-semibold text-text-secondary">
            After signing in, scan this QR again to send your request.
          </div>
        </Card>
      ) : isMember ? (
        <Card className="text-center text-[11.5px] font-semibold text-text-secondary">
          You&rsquo;re already a member of a hostel. Use a hostel transfer to move.
        </Card>
      ) : (
        <Button fullWidth onClick={() => setJoinOpen(true)}>
          Send join request
        </Button>
      )}

      <JoinRequestSheet
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        hostelId={view.id}
        hostelName={view.name}
        rooms={view.rooms}
      />
    </div>
  );
}

function ContactRow({ role, name, phone }: { role: string; name: string; phone: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="min-w-0">
        <div className="text-[9px] font-bold uppercase tracking-wide text-text-secondary">{role}</div>
        <div className="truncate text-[12px] font-extrabold">{name}</div>
      </div>
      <a href={`tel:${phone}`} className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon icon={Phone} size={15} />
      </a>
    </div>
  );
}

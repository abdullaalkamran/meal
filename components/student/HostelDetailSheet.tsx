"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, DoorOpen, Phone, UtensilsCrossed, Wallet } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { repo, type Hostel, type Room, type User } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";
import { currentMonth } from "@/lib/utils/date";

const freeSeats = (r: Room) => Math.max(r.capacity - r.occupantIds.length, 0);

function DetailRow({ icon, label, value }: { icon: typeof Wallet; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-btn bg-bg px-3 py-2.5">
      <Icon icon={icon} size={15} className="shrink-0 text-primary" />
      <div className="min-w-0 flex-1 text-[11px] font-bold text-text-secondary">{label}</div>
      <div className="shrink-0 text-[11.5px] font-extrabold">{value}</div>
    </div>
  );
}

/** Full detail for a hostel someone is considering joining: verification, all
 * rooms with seats/rent/facilities, the actual meal rate, other charges, and
 * the manager's and owner's phone numbers — everything to decide before
 * sending a join request. */
export function HostelDetailSheet({
  open,
  onClose,
  hostel,
  pending,
  ownHostel,
  onSendRequest,
}: {
  open: boolean;
  onClose: () => void;
  hostel: Hostel | null;
  pending: boolean;
  /** The viewer is already a member of this hostel — show that instead of a join button. */
  ownHostel?: boolean;
  onSendRequest: (h: Hostel) => void;
}) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [manager, setManager] = useState<User | undefined>(undefined);
  const [owner, setOwner] = useState<User | undefined>(undefined);
  const [mealRate, setMealRate] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !hostel) return;
    let cancelled = false;
    (async () => {
      const [rms, mgr, own, rate] = await Promise.all([
        repo.rooms.listByHostel(hostel.id),
        hostel.managerId ? repo.users.getUser(hostel.managerId) : Promise.resolve(undefined),
        repo.users.getUser(hostel.ownerId),
        repo.meals.getActualMealRate(hostel.id, currentMonth()),
      ]);
      if (cancelled) return;
      setRooms(rms);
      setManager(mgr);
      setOwner(own);
      setMealRate(rate.rate);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, hostel]);

  if (!hostel) return null;

  const totalFree = rooms.reduce((s, r) => s + freeSeats(r), 0);
  const rents = rooms.map((r) => r.seatRent).filter((n) => n > 0);
  const rentFrom = rents.length ? Math.min(...rents) : 0;
  const serviceCharge = hostel.settings.serviceChargeMonthly ?? 0;
  const advance = hostel.settings.advanceRentRequired;

  return (
    <Sheet open={open} onClose={onClose} title={hostel.name}>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <div className="text-[11px] font-semibold text-text-secondary">{hostel.area}</div>
        {hostel.gender && (
          <span className={`rounded-pill px-2 py-0.5 text-[9px] font-extrabold ${hostel.gender === "girls" ? "bg-[#7C6CF6]/10 text-[#7C6CF6]" : "bg-blue-soft text-blue"}`}>
            {hostel.gender === "girls" ? "Girls' hostel" : "Boys' hostel"}
          </span>
        )}
        {hostel.verified ? (
          <span className="flex items-center gap-1 rounded-pill bg-primary-soft px-2 py-0.5 text-[9px] font-extrabold text-primary">
            <Icon icon={BadgeCheck} size={11} /> Verified
          </span>
        ) : (
          <span className="rounded-pill bg-bg px-2 py-0.5 text-[9px] font-extrabold text-text-secondary">
            Not verified yet
          </span>
        )}
      </div>
      {hostel.street && (
        <div className="mb-3 text-[10.5px] font-semibold text-text">{hostel.street}</div>
      )}

      {/* Money at a glance */}
      <div className="mb-4 flex flex-col gap-2">
        <DetailRow
          icon={UtensilsCrossed}
          label="Meal rate (actual, this month)"
          value={mealRate === null ? "…" : mealRate > 0 ? `${formatBDT(mealRate)}/meal` : "No meals yet"}
        />
        <DetailRow icon={DoorOpen} label="Seat rent from" value={rentFrom > 0 ? `${formatBDT(rentFrom)}/mo` : "—"} />
        <DetailRow icon={Wallet} label="Monthly service charge" value={serviceCharge > 0 ? `${formatBDT(serviceCharge)}/mo` : "None"} />
        {advance && (
          <DetailRow icon={Wallet} label="Advance rent on joining" value="1 month (held, refunded on leaving)" />
        )}
      </div>
      <div className="mb-4 text-[9.5px] font-semibold text-text-secondary">
        Meals are billed at the hostel&rsquo;s actual monthly cost (total grocery spend ÷ meals
        eaten), not a fixed rate.
      </div>

      {/* Rooms */}
      <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
        Rooms · {totalFree} seat{totalFree === 1 ? "" : "s"} free
      </div>
      <div className="mb-4 flex flex-col gap-2">
        {rooms.length === 0 && (
          <div className="rounded-btn bg-bg px-3 py-2.5 text-[11px] font-semibold text-text-secondary">
            No rooms listed yet.
          </div>
        )}
        {rooms.map((r) => {
          const free = freeSeats(r);
          return (
            <div key={r.id} className="rounded-btn bg-bg px-3 py-2.5">
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-extrabold">Room {r.number}</div>
                <div className="text-[11.5px] font-extrabold text-primary">{formatBDT(r.seatRent)}/seat</div>
              </div>
              <div className="mt-0.5 text-[9.5px] font-semibold text-text-secondary">
                {free} of {r.capacity} seat{r.capacity === 1 ? "" : "s"} free
              </div>
              {r.facilities && r.facilities.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {r.facilities.map((f) => (
                    <span key={f} className="rounded-pill bg-card px-2 py-0.5 text-[8.5px] font-bold text-text-secondary">
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Contacts */}
      <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
        Contacts
      </div>
      <div className="mb-4 flex flex-col gap-2">
        {manager && (
          <a href={`tel:${manager.phone}`} className="flex items-center gap-2.5 rounded-btn bg-bg px-3 py-2.5">
            <Icon icon={Phone} size={15} className="shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="text-[9px] font-bold text-text-secondary">MANAGER</div>
              <div className="truncate text-[11.5px] font-extrabold">{manager.name}</div>
            </div>
            <div className="shrink-0 text-[11px] font-extrabold text-primary">{manager.phone}</div>
          </a>
        )}
        <a href={`tel:${owner?.phone ?? ""}`} className="flex items-center gap-2.5 rounded-btn bg-bg px-3 py-2.5">
          <Icon icon={Phone} size={15} className="shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-bold text-text-secondary">OWNER</div>
            <div className="truncate text-[11.5px] font-extrabold">{owner?.name ?? "—"}</div>
          </div>
          <div className="shrink-0 text-[11px] font-extrabold text-primary">{owner?.phone ?? "—"}</div>
        </a>
      </div>

      {/* House rules */}
      {hostel.rules?.trim() && (
        <>
          <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
            House rules
          </div>
          <div className="mb-4 flex flex-col gap-1.5">
            {hostel.rules
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean)
              .map((rule, i) => (
                <div key={i} className="flex gap-2 rounded-btn bg-bg px-3 py-2">
                  <span className="text-[11px] font-extrabold text-primary">{i + 1}.</span>
                  <span className="text-[11px] font-semibold text-text">{rule}</span>
                </div>
              ))}
          </div>
        </>
      )}

      {ownHostel ? (
        <div className="rounded-btn bg-primary-soft px-3 py-2.5 text-center text-[11px] font-extrabold text-primary">
          You&rsquo;re a member of this hostel
        </div>
      ) : pending ? (
        <div className="rounded-btn bg-bg px-3 py-2.5 text-center text-[11px] font-extrabold text-text-secondary">
          Join request pending…
        </div>
      ) : (
        <Button fullWidth onClick={() => onSendRequest(hostel)}>
          Send join request
        </Button>
      )}
    </Sheet>
  );
}

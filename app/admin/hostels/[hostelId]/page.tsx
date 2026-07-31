"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BadgeCheck, Building2, ChevronLeft, MapPin, Phone } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Chip } from "@/components/ui/Chip";
import { useToast } from "@/components/ui/Toast";
import { repo, type Hostel, type MealSlot, type Room, type User } from "@/lib/data";
import { formatArea } from "@/lib/geo/bangladesh";
import { formatBDT } from "@/lib/utils/currency";
import { MEAL_LABEL } from "@/lib/mealColors";

const MEALS: MealSlot[] = ["breakfast", "lunch", "dinner"];

function ContactRow({ label, user }: { label: string; user: User | undefined }) {
  return (
    <div className="flex items-center justify-between rounded-btn bg-bg px-3 py-2.5">
      <div className="min-w-0">
        <div className="text-[9px] font-bold text-text-secondary">{label}</div>
        <div className="truncate text-[11.5px] font-extrabold">{user?.name ?? "Not assigned"}</div>
      </div>
      {user?.phone && (
        <a href={`tel:${user.phone}`} className="flex shrink-0 items-center gap-1.5 text-[11px] font-extrabold text-primary">
          <Icon icon={Phone} size={13} />
          {user.phone}
        </a>
      )}
    </div>
  );
}

export default function AdminHostelDetailPage() {
  const { hostelId } = useParams<{ hostelId: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [hostel, setHostel] = useState<Hostel | null | undefined>(undefined);
  const [owner, setOwner] = useState<User | undefined>(undefined);
  const [manager, setManager] = useState<User | undefined>(undefined);
  const [cook, setCook] = useState<User | undefined>(undefined);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!hostelId) return;
    const h = await repo.hostels.getHostel(hostelId);
    setHostel(h ?? null);
    if (!h) return;
    const [ow, mg, ck, rm, members] = await Promise.all([
      repo.users.getUser(h.ownerId),
      repo.users.getUser(h.managerId),
      h.cookId ? repo.users.getUser(h.cookId) : Promise.resolve(undefined),
      repo.rooms.listByHostel(h.id),
      repo.users.listByHostel(h.id),
    ]);
    setOwner(ow);
    setManager(mg);
    setCook(ck);
    setRooms(rm);
    setMemberCount(members.filter((u) => !u.banned).length);
  };

  useEffect(() => {
    queueMicrotask(() => void load());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostelId]);

  const toggleSuspend = async () => {
    if (!hostel || busy) return;
    setBusy(true);
    try {
      await repo.hostels.setSuspended(hostel.id, !hostel.suspended);
      toast(hostel.suspended ? `${hostel.name} reactivated` : `${hostel.name} suspended`);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const toggleVerified = async () => {
    if (!hostel || busy) return;
    setBusy(true);
    try {
      await repo.hostels.setVerified(hostel.id, !hostel.verified);
      toast(hostel.verified ? "Verification removed" : `${hostel.name} verified`);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const totalSeats = rooms.reduce((sum, r) => sum + r.capacity, 0);
  const occupiedSeats = rooms.reduce((sum, r) => sum + r.occupantIds.length, 0);

  return (
    <div className="flex flex-col gap-4 pt-2 pb-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/admin/hostels")}
          aria-label="Back to hostels"
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-bg"
        >
          <Icon icon={ChevronLeft} size={18} />
        </button>
        <div className="text-[17.5px] font-extrabold tracking-tight">Hostel details</div>
      </div>

      {hostel === undefined ? (
        <Card className="text-center text-[11.5px] font-semibold text-text-secondary">Loading…</Card>
      ) : hostel === null ? (
        <Card className="text-center text-[11.5px] font-semibold text-text-secondary">Hostel not found.</Card>
      ) : (
        <>
          <Card>
            <div className="flex items-center gap-3">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                  hostel.verified ? "bg-primary-soft text-primary" : "bg-bg text-text-secondary"
                }`}
              >
                <Icon icon={hostel.verified ? BadgeCheck : Building2} size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="truncate text-[15px] font-extrabold">{hostel.name}</div>
                  {hostel.suspended && (
                    <span className="rounded-pill bg-danger-soft px-1.5 py-0.5 text-[8.5px] font-extrabold text-danger">
                      Suspended
                    </span>
                  )}
                  {hostel.verified && (
                    <span className="rounded-pill bg-primary-soft px-1.5 py-0.5 text-[8.5px] font-extrabold text-primary">
                      Verified
                    </span>
                  )}
                  {hostel.gender && (
                    <span className="rounded-pill bg-bg px-1.5 py-0.5 text-[8.5px] font-extrabold capitalize text-text-secondary">
                      {hostel.gender}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[10.5px] font-semibold text-text-secondary">
                  <Icon icon={MapPin} size={11} /> {hostel.address ? formatArea(hostel.address) : hostel.area}
                </div>
                {hostel.street && (
                  <div className="mt-0.5 text-[10px] font-semibold text-text-secondary">{hostel.street}</div>
                )}
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-3 gap-2.5">
            <Card className="text-center">
              <div className="text-[15px] font-extrabold">{rooms.length}</div>
              <div className="text-[9px] font-bold text-text-secondary">Rooms</div>
            </Card>
            <Card className="text-center">
              <div className="text-[15px] font-extrabold">
                {occupiedSeats}/{totalSeats}
              </div>
              <div className="text-[9px] font-bold text-text-secondary">Seats filled</div>
            </Card>
            <Card className="text-center">
              <div className="text-[15px] font-extrabold">{memberCount}</div>
              <div className="text-[9px] font-bold text-text-secondary">Members</div>
            </Card>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-[13px] font-extrabold">Contacts</div>
            <ContactRow label="OWNER" user={owner} />
            <ContactRow label="MANAGER" user={manager} />
            <ContactRow label="COOK" user={cook} />
          </div>

          <div>
            <div className="mb-2 text-[13px] font-extrabold">Settings</div>
            <Card className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-[11px] font-semibold">
                <span className="text-text-secondary">Advance rent required</span>
                <span className="font-extrabold">{hostel.settings.advanceRentRequired ? "Yes" : "No"}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-semibold">
                <span className="text-text-secondary">Service charge / month</span>
                <span className="font-extrabold">{formatBDT(hostel.settings.serviceChargeMonthly ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-semibold">
                <span className="text-text-secondary">Meal toggle cutoff</span>
                <span className="font-extrabold">{hostel.settings.mealToggleCutoff ?? "22:00"}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-semibold">
                <span className="text-text-secondary">Meals offered</span>
                <div className="flex gap-1">
                  {MEALS.map((m) => {
                    const on = hostel.settings.mealsOffered?.[m] ?? true;
                    return (
                      <Chip key={m} tone={on ? "primary" : "neutral"} active={on}>
                        {MEAL_LABEL[m]}
                      </Chip>
                    );
                  })}
                </div>
              </div>
            </Card>
          </div>

          {hostel.rules && (
            <div>
              <div className="mb-2 text-[13px] font-extrabold">House rules</div>
              <Card className="whitespace-pre-line text-[11px] font-semibold text-text-secondary">
                {hostel.rules}
              </Card>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={toggleVerified}
              disabled={busy}
              className="min-h-11 cursor-pointer rounded-btn border border-border text-[12px] font-extrabold disabled:opacity-50"
            >
              {hostel.verified ? "Remove verification" : "Mark as verified"}
            </button>
            <button
              type="button"
              onClick={toggleSuspend}
              disabled={busy}
              className={`min-h-11 cursor-pointer rounded-btn text-[12px] font-extrabold disabled:opacity-50 ${
                hostel.suspended ? "bg-primary-soft text-primary" : "bg-danger-soft text-danger"
              }`}
            >
              {hostel.suspended ? "Reactivate hostel" : "Suspend hostel"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

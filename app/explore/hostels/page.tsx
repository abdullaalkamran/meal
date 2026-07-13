"use client";

import { useEffect, useState } from "react";
import { BedDouble, MapPin, Phone, Star } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { ExploreHeader } from "@/components/explore/ExploreHeader";
import { repo, type Hostel } from "@/lib/data";
import { EXTRA_HOSTELS } from "@/lib/explore/content";
import { formatBDT } from "@/lib/utils/currency";

export default function HostelsPage() {
  const { user } = useSession();
  const { toast } = useToast();
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [requested, setRequested] = useState<Set<string>>(new Set());

  useEffect(() => {
    repo.hostels.listAll().then(setHostels);
  }, []);

  const requestJoin = async (hostelId: string, name: string) => {
    if (!user) return;
    await repo.joinRequests.create({ hostelId, name: user.name, phone: user.phone });
    setRequested((prev) => new Set(prev).add(hostelId));
    toast(`Join request sent to ${name}`);
  };

  return (
    <div className="flex flex-col gap-5 pb-4">
      <ExploreHeader title="Find Hostel" subtitle="Browse & request to join" />

      <div>
        <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
          On Hostel ERP
        </div>
        <div className="flex flex-col gap-2.5">
          {hostels.map((h) => {
            const isMine = h.id === user?.hostelId;
            const isRequested = requested.has(h.id);
            return (
              <Card key={h.id} className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn bg-primary-soft text-primary">
                  <Icon icon={BedDouble} size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-extrabold">{h.name}</div>
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-text-secondary">
                    <Icon icon={MapPin} size={11} /> {h.area}
                  </div>
                  <div className="text-[9.5px] font-semibold text-text-secondary">
                    Meal rate {formatBDT(h.mealRate)}/meal
                  </div>
                </div>
                {isMine ? (
                  <span className="rounded-pill bg-bg px-2.5 py-1 text-[9.5px] font-extrabold text-text-secondary">
                    Your hostel
                  </span>
                ) : (
                  <button type="button" onClick={() => requestJoin(h.id, h.name)} disabled={isRequested}>
                    <Chip tone="primary" active={isRequested}>
                      {isRequested ? "Requested ✓" : "Request to join"}
                    </Chip>
                  </button>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
          Nearby listings
        </div>
        <div className="flex flex-col gap-2.5">
          {EXTRA_HOSTELS.map((h) => (
            <Card key={h.id} className="flex flex-col gap-2.5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn bg-blue-soft text-blue">
                  <Icon icon={BedDouble} size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-extrabold">{h.name}</div>
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-text-secondary">
                    <Icon icon={MapPin} size={11} /> {h.area}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] font-semibold text-text-secondary">
                    <span className="flex items-center gap-0.5 text-orange">
                      <Icon icon={Star} size={11} className="fill-orange" /> {h.rating}
                    </span>
                    <span>{h.seatsAvailable} seats free</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[11.5px] font-extrabold text-primary">{formatBDT(h.seatRentFrom)}</div>
                  <div className="text-[8.5px] font-bold text-text-secondary">/ seat from</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {h.amenities.map((a) => (
                  <span key={a} className="rounded-pill bg-bg px-2 py-0.5 text-[9.5px] font-bold text-text-secondary">
                    {a}
                  </span>
                ))}
              </div>
              <a
                href={`tel:${h.phone}`}
                className="flex min-h-9 items-center justify-center gap-1.5 rounded-btn bg-primary-soft text-[11.5px] font-extrabold text-primary"
              >
                <Icon icon={Phone} size={13} /> Contact hostel
              </a>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

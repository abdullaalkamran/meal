"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, BedDouble, ChevronRight, MapPin, Phone, Search, Star, X } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { ExploreHeader } from "@/components/explore/ExploreHeader";
import { HostelDetailSheet } from "@/components/student/HostelDetailSheet";
import { useServiceListings } from "@/hooks/useServiceListings";
import { DIVISIONS, districtsOf, thanasOf } from "@/lib/geo/bangladesh";
import { repo, type Hostel } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";

const selectClass =
  "min-h-9 w-full rounded-btn border border-border bg-card px-2.5 text-[11px] font-bold shadow-chip";

export default function HostelsPage() {
  const { user } = useSession();
  const { toast } = useToast();
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const [detailHostel, setDetailHostel] = useState<Hostel | null>(null);
  const [query, setQuery] = useState("");
  const [division, setDivision] = useState("");
  const [district, setDistrict] = useState("");
  const [thana, setThana] = useState("");
  const allListings = useServiceListings("hostel").filter((l) => l.active);

  useEffect(() => {
    repo.hostels.listAll().then(setHostels);
  }, []);

  // Location + name/area search. A hostel matches a chosen division/district by
  // its structured address when it has one, else by its display area text (so
  // legacy hostels without a structured address still filter sensibly).
  const q = query.trim().toLowerCase();
  const matchesText = (name: string, area: string) =>
    !q || name.toLowerCase().includes(q) || area.toLowerCase().includes(q);
  const matchesLoc = (area: string, addr?: { division?: string; district?: string; thana?: string }) => {
    const a = area.toLowerCase();
    if (division && addr?.division !== division && !a.includes(division.toLowerCase())) return false;
    if (district && addr?.district !== district && !a.includes(district.toLowerCase())) return false;
    if (thana && addr?.thana !== thana && !a.includes(thana.toLowerCase())) return false;
    return true;
  };
  const filtersActive = !!q || !!division || !!district || !!thana;
  const clearFilters = () => {
    setQuery("");
    setDivision("");
    setDistrict("");
    setThana("");
  };

  const shownHostels = hostels.filter(
    (h) => matchesText(h.name, h.area) && matchesLoc(h.area, h.address)
  );
  const shownListings = allListings.filter((l) => matchesText(l.name, l.area) && matchesLoc(l.area));

  const requestJoin = async (hostelId: string, name: string) => {
    if (!user) return;
    try {
      await repo.joinRequests.create({
        hostelId,
        userId: user.id,
        name: user.name,
        phone: user.phone,
      });
      setRequested((prev) => new Set(prev).add(hostelId));
      toast(`Join request sent to ${name}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not send the request");
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-4">
      <ExploreHeader title="Find Hostel" subtitle="Browse & request to join" />

      {/* Search + location filter */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 rounded-btn border border-border bg-card px-3 shadow-chip">
          <Icon icon={Search} size={14} className="shrink-0 text-text-secondary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by hostel name or area…"
            className="min-h-10 w-full bg-transparent text-[12px] font-bold outline-none"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <select
            value={division}
            onChange={(e) => {
              setDivision(e.target.value);
              setDistrict("");
              setThana("");
            }}
            className={selectClass}
          >
            <option value="">Any division</option>
            {DIVISIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select
            value={district}
            onChange={(e) => {
              setDistrict(e.target.value);
              setThana("");
            }}
            disabled={!division}
            className={`${selectClass} disabled:opacity-50`}
          >
            <option value="">Any district</option>
            {(division ? districtsOf(division) : []).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select
            value={thana}
            onChange={(e) => setThana(e.target.value)}
            disabled={!division || !district}
            className={`${selectClass} disabled:opacity-50`}
          >
            <option value="">Any thana</option>
            {(division && district ? thanasOf(division, district) : []).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        {filtersActive && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center gap-1 self-start text-[10.5px] font-extrabold text-primary"
          >
            <Icon icon={X} size={12} /> Clear filters
          </button>
        )}
      </div>

      <div>
        <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
          On MyDorm
        </div>
        <div className="flex flex-col gap-2.5">
          {shownHostels.length === 0 && (
            <Card className="text-center text-[11px] font-semibold text-text-secondary">
              No hostels match your search.
            </Card>
          )}
          {shownHostels.map((h) => {
            const isMine = h.id === user?.hostelId;
            const isRequested = requested.has(h.id);
            return (
              <Card key={h.id} className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDetailHostel(h)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-btn ${
                      h.verified ? "bg-primary-soft text-primary" : "bg-primary-soft text-primary"
                    }`}
                  >
                    <Icon icon={h.verified ? BadgeCheck : BedDouble} size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[12px] font-extrabold">{h.name}</span>
                      {h.verified && (
                        <span className="flex shrink-0 items-center gap-0.5 rounded-pill bg-primary-soft px-1.5 py-0.5 text-[8px] font-extrabold text-primary">
                          <Icon icon={BadgeCheck} size={9} /> Verified
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-semibold text-text-secondary">
                      <Icon icon={MapPin} size={11} /> {h.area}
                    </div>
                    <div className="text-[9.5px] font-semibold text-primary">Tap for rooms, rent &amp; contacts</div>
                  </div>
                  <Icon icon={ChevronRight} size={16} className="shrink-0 text-text-secondary" />
                </button>
                {isMine ? (
                  <span className="shrink-0 rounded-pill bg-bg px-2.5 py-1 text-[9.5px] font-extrabold text-text-secondary">
                    Your hostel
                  </span>
                ) : (
                  <button type="button" onClick={() => requestJoin(h.id, h.name)} disabled={isRequested} className="shrink-0">
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
          {shownListings.map((h) => (
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

      <HostelDetailSheet
        open={!!detailHostel}
        onClose={() => setDetailHostel(null)}
        hostel={detailHostel}
        pending={!!(detailHostel && requested.has(detailHostel.id))}
        ownHostel={!!detailHostel && detailHostel.id === user?.hostelId}
        onSendRequest={(h) => {
          void requestJoin(h.id, h.name);
          setDetailHostel(null);
        }}
      />
    </div>
  );
}

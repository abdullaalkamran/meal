"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BedDouble,
  BookOpen,
  Briefcase,
  ChefHat,
  ChevronRight,
  Layers,
  MessagesSquare,
  Plus,
  Radio,
  Search,
  Tag,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Switch } from "@/components/ui/Switch";
import { useAllServiceListings } from "@/hooks/useServiceListings";
import { useCommunityPosts } from "@/hooks/useCommunityPosts";
import { ListingFormSheet } from "@/components/service/ListingFormSheet";
import { repo, type ServiceKind, type ServiceListing } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";

const KINDS: { kind: ServiceKind; label: string; add: string; icon: typeof ChefHat; tone: string }[] = [
  { kind: "cook", label: "Cooks", add: "Add cook", icon: ChefHat, tone: "bg-orange-soft text-orange" },
  { kind: "job", label: "Jobs", add: "Post job", icon: Briefcase, tone: "bg-primary-soft text-primary" },
  { kind: "course", label: "Courses", add: "Add course", icon: BookOpen, tone: "bg-blue-soft text-blue" },
  { kind: "offer", label: "Offers", add: "Add offer", icon: Tag, tone: "bg-blue-soft text-blue" },
  { kind: "hostel", label: "Hostels", add: "Add hostel", icon: BedDouble, tone: "bg-[#7C6CF6]/10 text-[#7C6CF6]" },
];

function title(l: ServiceListing): string {
  switch (l.kind) {
    case "cook":
      return l.name;
    case "job":
      return l.title;
    case "course":
      return l.title;
    case "offer":
      return `${l.shop} — ${l.title}`;
    case "hostel":
      return l.name;
  }
}
function subtitle(l: ServiceListing): string {
  switch (l.kind) {
    case "cook":
      return `${l.cuisine} · ${formatBDT(l.monthlyRate)}/mo`;
    case "job":
      return `${l.company} · ${l.pay}`;
    case "course":
      return `${l.provider} · ${l.price}`;
    case "offer":
      return `${l.discount} · code ${l.code}`;
    case "hostel":
      return `${l.area} · ${formatBDT(l.seatRentFrom)}/seat`;
  }
}

export default function ServiceCatalogPage() {
  const all = useAllServiceListings();
  const posts = useCommunityPosts();
  const [tab, setTab] = useState<ServiceKind>("cook");
  const [query, setQuery] = useState("");
  // null = closed; { listing: null } = add for active tab; { listing } = edit.
  const [sheet, setSheet] = useState<{ listing: ServiceListing | null } | null>(null);

  const live = all.filter((l) => l.active).length;
  const active = KINDS.find((k) => k.kind === tab)!;
  const q = query.toLowerCase();
  const results = all.filter(
    (l) => l.kind === tab && `${title(l)} ${subtitle(l)}`.toLowerCase().includes(q)
  );

  return (
    <div className="flex flex-col gap-4 pt-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[17.5px] font-extrabold tracking-tight">Catalog manager</div>
          <div className="text-[10.5px] font-semibold text-text-secondary">
            Services shown to hostels in Explore
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSheet({ listing: null })}
          className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-btn bg-primary px-3.5 text-[11.5px] font-extrabold text-white shadow-chip"
        >
          <Icon icon={Plus} size={15} /> {active.add}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2.5">
        <Card className="flex flex-col items-center gap-1 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Icon icon={Layers} size={15} />
          </div>
          <div className="text-[15px] font-extrabold leading-none">{all.length}</div>
          <div className="text-[9px] font-bold text-text-secondary">Listings</div>
        </Card>
        <Card className="flex flex-col items-center gap-1 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-soft text-blue">
            <Icon icon={Radio} size={15} />
          </div>
          <div className="text-[15px] font-extrabold leading-none">{live}</div>
          <div className="text-[9px] font-bold text-text-secondary">Live in Explore</div>
        </Card>
        <Link href="/service/community">
          <Card className="flex flex-col items-center gap-1 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-soft text-orange">
              <Icon icon={MessagesSquare} size={15} />
            </div>
            <div className="text-[15px] font-extrabold leading-none">{posts.length}</div>
            <div className="flex items-center gap-0.5 text-[9px] font-bold text-text-secondary">
              Community <Icon icon={ChevronRight} size={9} />
            </div>
          </Card>
        </Link>
      </div>

      {/* Kind tabs */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {KINDS.map((k) => {
          const count = all.filter((l) => l.kind === k.kind).length;
          const isActive = tab === k.kind;
          return (
            <button
              key={k.kind}
              type="button"
              onClick={() => {
                setTab(k.kind);
                setQuery("");
              }}
              className={`flex shrink-0 items-center gap-1.5 rounded-pill px-3 py-2 text-[10.5px] font-extrabold ${
                isActive ? "bg-primary text-white" : "bg-card text-text-secondary shadow-chip"
              }`}
            >
              <Icon icon={k.icon} size={13} />
              {k.label}
              <span
                className={`rounded-pill px-1.5 py-0.5 text-[8.5px] ${
                  isActive ? "bg-white/25" : "bg-bg"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Icon icon={Search} size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${active.label.toLowerCase()}`}
          className="w-full rounded-btn border border-border bg-card py-2.5 pl-9 pr-3 text-[12px] font-bold shadow-chip"
        />
      </div>

      {results.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-10 text-center">
          <Icon icon={active.icon} size={26} className="text-text-secondary" />
          <div className="text-[12px] font-extrabold">No {active.label.toLowerCase()} found</div>
          <div className="text-[10.5px] font-semibold text-text-secondary">
            Adjust the search or add a new listing.
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1 text-[10px] font-extrabold uppercase tracking-wide text-text-secondary">
            <span>{results.length} listing{results.length > 1 ? "s" : ""}</span>
            <span>Tap a listing to edit</span>
          </div>
          {results.map((l) => (
            <Card key={l.id} className={`flex items-center gap-3 ${l.active ? "" : "opacity-55"}`}>
              <button
                type="button"
                onClick={() => setSheet({ listing: l })}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
              >
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-btn ${active.tone}`}>
                  <Icon icon={active.icon} size={19} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-extrabold">{title(l)}</div>
                  <div className="mt-0.5 truncate text-[9.5px] font-semibold text-text-secondary">
                    {subtitle(l)}
                  </div>
                </div>
              </button>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Switch checked={l.active} onChange={() => repo.serviceCatalog.toggleActive(l.id)} />
                <span className={`text-[8.5px] font-extrabold ${l.active ? "text-primary" : "text-text-secondary"}`}>
                  {l.active ? "LIVE" : "HIDDEN"}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ListingFormSheet
        open={!!sheet}
        onClose={() => setSheet(null)}
        kind={sheet?.listing ? sheet.listing.kind : tab}
        listing={sheet?.listing}
      />
    </div>
  );
}

"use client";

import { useState } from "react";
import { BedDouble, BookOpen, Briefcase, ChefHat, Tag, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { useAllServiceListings } from "@/hooks/useServiceListings";
import { ListingFormSheet } from "@/components/service/ListingFormSheet";
import { repo, type ServiceKind, type ServiceListing } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";

const KINDS: { kind: ServiceKind; label: string; add: string; icon: typeof ChefHat }[] = [
  { kind: "cook", label: "Cooks", add: "Add cook", icon: ChefHat },
  { kind: "job", label: "Jobs", add: "Post job", icon: Briefcase },
  { kind: "course", label: "Courses", add: "Add course", icon: BookOpen },
  { kind: "offer", label: "Offers", add: "Add offer", icon: Tag },
  { kind: "hostel", label: "Partner hostels", add: "Add hostel", icon: BedDouble },
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
  const { toast } = useToast();
  const [addKind, setAddKind] = useState<ServiceKind | null>(null);

  const activeCount = all.filter((l) => l.active).length;

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div>
        <div className="text-[17.5px] font-extrabold tracking-tight">Service catalog</div>
        <div className="text-[10.5px] font-semibold text-text-secondary">
          {activeCount} live · {all.length} total · shown to hostels in Explore
        </div>
      </div>

      <div>
        <div className="mb-2 text-[13.5px] font-extrabold">Quick actions</div>
        <div className="grid grid-cols-3 gap-2.5">
          {KINDS.map((k) => (
            <button key={k.kind} type="button" onClick={() => setAddKind(k.kind)} className="cursor-pointer">
              <Card className="flex flex-col items-center gap-1.5 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Icon icon={k.icon} size={17} />
                </div>
                <div className="text-center text-[9.5px] font-bold leading-tight">{k.add}</div>
              </Card>
            </button>
          ))}
        </div>
      </div>

      {KINDS.map(({ kind, label, icon }) => {
        const list = all.filter((l) => l.kind === kind);
        if (list.length === 0) return null;
        return (
          <div key={kind}>
            <div className="mb-2 flex items-center justify-between text-[13.5px] font-extrabold">
              {label}
              <span className="text-[10.5px] font-semibold text-text-secondary">{list.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {list.map((l) => (
                <Card key={l.id} className={`flex items-center gap-3 ${l.active ? "" : "opacity-60"}`}>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg text-text-secondary">
                    <Icon icon={icon} size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11.5px] font-extrabold">{title(l)}</div>
                    <div className="truncate text-[9.5px] font-semibold text-text-secondary">{subtitle(l)}</div>
                  </div>
                  <button type="button" onClick={() => repo.serviceCatalog.toggleActive(l.id)}>
                    <Chip tone="primary" active={l.active}>
                      {l.active ? "Live" : "Hidden"}
                    </Chip>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await repo.serviceCatalog.remove(l.id);
                      toast("Listing removed");
                    }}
                    aria-label="Remove listing"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger"
                  >
                    <Icon icon={Trash2} size={14} />
                  </button>
                </Card>
              ))}
            </div>
          </div>
        );
      })}

      {addKind && <ListingFormSheet open={!!addKind} onClose={() => setAddKind(null)} kind={addKind} />}
    </div>
  );
}

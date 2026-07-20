"use client";

import { ChefHat, Phone, Star } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useExploreInteractions } from "@/hooks/useExploreInteractions";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { ExploreHeader } from "@/components/explore/ExploreHeader";
import { useServiceListings } from "@/hooks/useServiceListings";
import { useMemberArea } from "@/hooks/useMemberArea";
import { isAvailableAt } from "@/lib/geo/bangladesh";
import { repo } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";

export default function CooksPage() {
  const { user } = useSession();
  const interactions = useExploreInteractions(user?.id);
  const { toast } = useToast();
  const memberArea = useMemberArea();
  const COOKS = useServiceListings("cook").filter(
    (l) => l.active && isAvailableAt(l.areas, memberArea)
  );

  const shortlisted = new Set(
    interactions.filter((i) => i.feature === "cooks" && i.kind === "saved").map((i) => i.itemId)
  );

  const shortlist = async (id: string, name: string) => {
    if (!user) return;
    const was = shortlisted.has(id);
    await repo.exploreInteractions.toggle(user.id, "cooks", id, "saved");
    toast(was ? "Removed from shortlist" : `Shortlisted ${name}`);
  };

  return (
    <div className="flex flex-col gap-5 pb-4">
      <ExploreHeader title="Find Cook" subtitle={`${shortlisted.size} shortlisted`} />

      <div className="flex flex-col gap-2.5">
        {COOKS.map((c) => {
          const isSaved = shortlisted.has(c.id);
          return (
            <Card key={c.id} className="flex flex-col gap-2.5">
              <div className="flex items-center gap-3">
                <Avatar name={c.name} size={42} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <div className="truncate text-[12.5px] font-extrabold">{c.name}</div>
                    <span className="flex items-center gap-0.5 text-[9.5px] font-extrabold text-orange">
                      <Icon icon={Star} size={10} className="fill-orange" /> {c.rating}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[10.5px] font-semibold text-text-secondary">
                    <Icon icon={ChefHat} size={11} /> {c.cuisine}
                  </div>
                  <div className="text-[9.5px] font-semibold text-text-secondary">
                    {c.experienceYears} yrs experience
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[12px] font-extrabold text-primary">{formatBDT(c.monthlyRate)}</div>
                  <div className="text-[8.5px] font-bold text-text-secondary">/ month</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`tel:${c.phone}`}
                  className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-btn bg-primary-soft text-[11.5px] font-extrabold text-primary"
                >
                  <Icon icon={Phone} size={13} /> Contact
                </a>
                <button type="button" onClick={() => shortlist(c.id, c.name)}>
                  <Chip tone="primary" active={isSaved}>
                    {isSaved ? "Shortlisted ✓" : "Shortlist"}
                  </Chip>
                </button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

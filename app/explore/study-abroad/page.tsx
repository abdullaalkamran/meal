"use client";

import { CalendarDays, GraduationCap, MapPin, Phone, Star } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useExploreInteractions } from "@/hooks/useExploreInteractions";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { ExploreHeader } from "@/components/explore/ExploreHeader";
import { useServiceListings } from "@/hooks/useServiceListings";
import { repo } from "@/lib/data";

export default function StudyAbroadPage() {
  const { user } = useSession();
  const interactions = useExploreInteractions(user?.id);
  const { toast } = useToast();
  const AGENCIES = useServiceListings("studyabroad").filter((l) => l.active);

  const shortlisted = new Set(
    interactions.filter((i) => i.feature === "studyabroad" && i.kind === "saved").map((i) => i.itemId)
  );

  const shortlist = async (id: string, agency: string) => {
    if (!user) return;
    const was = shortlisted.has(id);
    await repo.exploreInteractions.toggle(user.id, "studyabroad", id, "saved");
    toast(was ? "Removed from shortlist" : `Shortlisted ${agency}`);
  };

  return (
    <div className="flex flex-col gap-5 pb-4">
      <ExploreHeader title="Study Abroad" subtitle={`${shortlisted.size} shortlisted`} />

      <div className="flex flex-col gap-2.5">
        {AGENCIES.map((a) => {
          const isSaved = shortlisted.has(a.id);
          return (
            <Card key={a.id} className="flex flex-col gap-2.5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn bg-blue-soft text-blue">
                  <Icon icon={GraduationCap} size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <div className="truncate text-[12.5px] font-extrabold">{a.agency}</div>
                    <span className="flex items-center gap-0.5 text-[9.5px] font-extrabold text-orange">
                      <Icon icon={Star} size={10} className="fill-orange" /> {a.rating}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[10.5px] font-semibold text-text-secondary">
                    <Icon icon={MapPin} size={11} /> {a.country}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-text-secondary">
                    <Icon icon={CalendarDays} size={11} /> {a.intake}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className={`text-[11px] font-extrabold ${a.consultationFee.toLowerCase().includes("free") ? "text-primary" : ""}`}>
                    {a.consultationFee}
                  </div>
                </div>
              </div>

              <div className="text-[10.5px] font-semibold text-text-secondary">{a.services}</div>

              <div className="flex items-center gap-2">
                <a
                  href={`tel:${a.phone}`}
                  className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-btn bg-primary-soft text-[11.5px] font-extrabold text-primary"
                >
                  <Icon icon={Phone} size={13} /> Contact
                </a>
                <button type="button" onClick={() => shortlist(a.id, a.agency)}>
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

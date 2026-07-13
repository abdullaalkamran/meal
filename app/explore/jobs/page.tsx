"use client";

import { useState } from "react";
import { Briefcase, MapPin, Search } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useExploreInteractions } from "@/hooks/useExploreInteractions";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { ExploreHeader } from "@/components/explore/ExploreHeader";
import { useServiceListings } from "@/hooks/useServiceListings";
import { repo } from "@/lib/data";

export default function JobsPage() {
  const { user } = useSession();
  const interactions = useExploreInteractions(user?.id);
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const jobs = useServiceListings("job").filter((l) => l.active);

  const applied = new Set(
    interactions.filter((i) => i.feature === "jobs" && i.kind === "applied").map((i) => i.itemId)
  );

  const results = jobs.filter((j) =>
    `${j.title} ${j.company} ${j.location} ${j.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase())
  );

  const apply = async (id: string, title: string) => {
    if (!user) return;
    const wasApplied = applied.has(id);
    await repo.exploreInteractions.toggle(user.id, "jobs", id, "applied");
    toast(wasApplied ? "Application withdrawn" : `Applied to ${title}`);
  };

  return (
    <div className="flex flex-col gap-5 pb-4">
      <ExploreHeader title="Find Job" subtitle={`${applied.size} applied`} />

      <div className="relative">
        <Icon icon={Search} size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search jobs, companies, skills"
          className="w-full rounded-btn border border-border bg-transparent py-2.5 pl-9 pr-3 text-[12px] font-bold"
        />
      </div>

      <div className="flex flex-col gap-2.5">
        {results.length === 0 && (
          <Card className="text-center text-[11.5px] font-semibold text-text-secondary">No jobs match.</Card>
        )}
        {results.map((j) => {
          const isApplied = applied.has(j.id);
          return (
            <Card key={j.id} className="flex flex-col gap-2.5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn bg-primary-soft text-primary">
                  <Icon icon={Briefcase} size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-extrabold">{j.title}</div>
                  <div className="text-[10.5px] font-semibold text-text-secondary">{j.company}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-text-secondary">
                    <Icon icon={MapPin} size={11} /> {j.location} · {j.jobType}
                  </div>
                </div>
                <div className="shrink-0 text-right text-[11px] font-extrabold text-primary">{j.pay}</div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {j.tags.map((t) => (
                  <span key={t} className="rounded-pill bg-bg px-2 py-0.5 text-[9.5px] font-bold text-text-secondary">
                    {t}
                  </span>
                ))}
              </div>
              <button type="button" onClick={() => apply(j.id, j.title)} className="self-start">
                <Chip tone="primary" active={isApplied}>
                  {isApplied ? "Applied ✓ · tap to withdraw" : "Apply now"}
                </Chip>
              </button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

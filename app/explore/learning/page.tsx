"use client";

import { useState } from "react";
import { Clock, GraduationCap } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useExploreInteractions } from "@/hooks/useExploreInteractions";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { ExploreHeader } from "@/components/explore/ExploreHeader";
import { repo } from "@/lib/data";
import { COURSES, type Course } from "@/lib/explore/content";

const CATEGORIES: (Course["category"] | "All")[] = ["All", "Programming", "Business", "Design", "Language", "Career"];

export default function LearningPage() {
  const { user } = useSession();
  const interactions = useExploreInteractions(user?.id);
  const { toast } = useToast();
  const [cat, setCat] = useState<Course["category"] | "All">("All");

  const enrolled = new Set(
    interactions.filter((i) => i.feature === "learning" && i.kind === "enrolled").map((i) => i.itemId)
  );
  const results = COURSES.filter((c) => cat === "All" || c.category === cat);

  const enroll = async (id: string, title: string) => {
    if (!user) return;
    const was = enrolled.has(id);
    await repo.exploreInteractions.toggle(user.id, "learning", id, "enrolled");
    toast(was ? "Unenrolled" : `Enrolled in ${title}`);
  };

  return (
    <div className="flex flex-col gap-5 pb-4">
      <ExploreHeader title="Learning" subtitle={`${enrolled.size} enrolled`} />

      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <button key={c} type="button" onClick={() => setCat(c)}>
            <Chip tone="primary" active={cat === c}>
              {c}
            </Chip>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        {results.map((c) => {
          const isEnrolled = enrolled.has(c.id);
          return (
            <Card key={c.id} className="flex flex-col gap-2.5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn bg-blue-soft text-blue">
                  <Icon icon={GraduationCap} size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-extrabold">{c.title}</div>
                  <div className="text-[10.5px] font-semibold text-text-secondary">{c.provider} · {c.level}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-text-secondary">
                    <Icon icon={Clock} size={11} /> {c.duration}
                  </div>
                </div>
                <div className={`shrink-0 text-[11px] font-extrabold ${c.price === "Free" ? "text-primary" : ""}`}>
                  {c.price}
                </div>
              </div>
              <button type="button" onClick={() => enroll(c.id, c.title)} className="self-start">
                <Chip tone="primary" active={isEnrolled}>
                  {isEnrolled ? "Enrolled ✓" : "Enroll"}
                </Chip>
              </button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

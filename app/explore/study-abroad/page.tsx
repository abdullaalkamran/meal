"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Award,
  Banknote,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  Globe2,
  GraduationCap,
  Headset,
  Newspaper,
  Phone,
  Wallet,
} from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useExploreInteractions } from "@/hooks/useExploreInteractions";
import { useStudyAbroadItems } from "@/hooks/useStudyAbroad";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/Toast";
import { ExploreHeader } from "@/components/explore/ExploreHeader";
import { PromoSlider } from "@/components/explore/PromoSlider";
import { Avatar } from "@/components/ui/Avatar";
import { repo, type StudyAbroadItem, type StudyAbroadKind } from "@/lib/data";

type Tab = "countries" | "scholarships" | "counsellors";
type OfKind<K extends StudyAbroadKind> = Extract<StudyAbroadItem, { kind: K }>;

export default function StudyAbroadPage() {
  const { user } = useSession();
  const interactions = useExploreInteractions(user?.id);
  const { toast } = useToast();
  const all = useStudyAbroadItems();
  const [tab, setTab] = useState<Tab>("countries");

  const promos = all.filter((i): i is OfKind<"promo"> => i.kind === "promo" && i.active);
  const countries = all.filter((i): i is OfKind<"country"> => i.kind === "country" && i.active);
  const scholarships = all.filter((i): i is OfKind<"scholarship"> => i.kind === "scholarship" && i.active);
  const counsellors = all.filter((i): i is OfKind<"counsellor"> => i.kind === "counsellor" && i.active);
  const blogs = all.filter((i): i is OfKind<"blog"> => i.kind === "blog" && i.active);

  const saved = new Set(
    interactions.filter((i) => i.feature === "studyabroad" && i.kind === "saved").map((i) => i.itemId)
  );
  const save = async (id: string, name: string) => {
    if (!user) return;
    const was = saved.has(id);
    await repo.exploreInteractions.toggle(user.id, "studyabroad", id, "saved");
    toast(was ? "Removed from saved" : `Saved ${name}`);
  };

  return (
    <div className="flex flex-col gap-4 pb-4">
      <ExploreHeader title="Study Abroad" subtitle="Countries · scholarships · free counselling" />

      {/* Promo photo cards from the platform — swipeable slider */}
      <PromoSlider promos={promos} />

      <SegmentedControl<Tab>
        className="w-full [&>button]:flex-1 [&>button]:px-2"
        value={tab}
        onChange={setTab}
        options={[
          { value: "countries", label: "Countries" },
          { value: "scholarships", label: "Scholarships" },
          { value: "counsellors", label: "Counsellors" },
        ]}
      />

      {tab === "countries" && (
        <div className="flex flex-col gap-2.5">
          {countries.map((c) => {
            const guideCount = blogs.filter((b) => b.country === c.name).length;
            return (
              <Link key={c.id} href={`/explore/study-abroad/country?id=${c.id}`}>
                <Card className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn bg-blue-soft text-[20px]">
                      <span aria-hidden>{c.flag}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-extrabold">{c.name}</div>
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-text-secondary">
                        <Icon icon={CalendarDays} size={11} /> Intakes: {c.intakes}
                        {guideCount > 0 && (
                          <>
                            <span>·</span>
                            <Icon icon={Newspaper} size={11} /> {guideCount} guide{guideCount > 1 ? "s" : ""}
                          </>
                        )}
                      </div>
                    </div>
                    <Icon icon={ChevronRight} size={16} className="shrink-0 text-text-secondary" />
                  </div>
                  <div className="text-[11px] font-semibold leading-relaxed text-text-secondary">{c.overview}</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-btn bg-bg px-2.5 py-2">
                      <div className="flex items-center gap-1 text-[8.5px] font-extrabold uppercase text-text-secondary">
                        <Icon icon={GraduationCap} size={10} /> Tuition
                      </div>
                      <div className="mt-0.5 text-[9.5px] font-extrabold leading-tight">{c.tuition}</div>
                    </div>
                    <div className="rounded-btn bg-bg px-2.5 py-2">
                      <div className="flex items-center gap-1 text-[8.5px] font-extrabold uppercase text-text-secondary">
                        <Icon icon={Wallet} size={10} /> Living
                      </div>
                      <div className="mt-0.5 text-[9.5px] font-extrabold leading-tight">{c.livingCost}</div>
                    </div>
                    <div className="rounded-btn bg-bg px-2.5 py-2">
                      <div className="flex items-center gap-1 text-[8.5px] font-extrabold uppercase text-text-secondary">
                        <Icon icon={BriefcaseBusiness} size={10} /> Work
                      </div>
                      <div className="mt-0.5 text-[9.5px] font-extrabold leading-tight">{c.workRights}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-1 rounded-btn bg-primary-soft py-2 text-[10.5px] font-extrabold text-primary">
                    Full guide — visa, universities, articles
                    <Icon icon={ChevronRight} size={13} />
                  </div>
                </Card>
              </Link>
            );
          })}
          {countries.length === 0 && (
            <Card className="flex flex-col items-center gap-2 py-8 text-center">
              <Icon icon={Globe2} size={24} className="text-text-secondary" />
              <div className="text-[11.5px] font-semibold text-text-secondary">Country guides coming soon.</div>
            </Card>
          )}
        </div>
      )}

      {tab === "scholarships" && (
        <div className="flex flex-col gap-2.5">
          {scholarships.map((s) => {
            const isSaved = saved.has(s.id);
            return (
              <Card key={s.id} className="flex flex-col gap-2">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn bg-orange-soft text-orange">
                    <Icon icon={Award} size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-extrabold">{s.name}</div>
                    <div className="text-[10px] font-semibold text-text-secondary">{s.country}</div>
                  </div>
                  <div className="shrink-0 rounded-pill bg-danger-soft px-2.5 py-1 text-[9px] font-extrabold text-danger">
                    Due {s.deadline}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-primary">
                  <Icon icon={Banknote} size={12} /> {s.coverage}
                </div>
                <div className="text-[10px] font-semibold text-text-secondary">Eligibility: {s.eligibility}</div>
                <button type="button" onClick={() => save(s.id, s.name)} className="self-start">
                  <Chip tone="primary" active={isSaved}>
                    {isSaved ? "Saved ✓" : "Save for later"}
                  </Chip>
                </button>
              </Card>
            );
          })}
          {scholarships.length === 0 && (
            <Card className="flex flex-col items-center gap-2 py-8 text-center">
              <Icon icon={Award} size={24} className="text-text-secondary" />
              <div className="text-[11.5px] font-semibold text-text-secondary">Scholarships coming soon.</div>
            </Card>
          )}
        </div>
      )}

      {tab === "counsellors" && (
        <div className="flex flex-col gap-2.5">
          <div className="rounded-btn bg-primary-soft px-3 py-2.5 text-[10.5px] font-bold text-primary">
            Call a counsellor directly for a free study-abroad consultation.
          </div>
          {counsellors.map((c) => (
            <Card key={c.id} className="flex items-center gap-3">
              {c.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.image} alt={c.name} className="h-11 w-11 shrink-0 rounded-full object-cover" />
              ) : (
                <Avatar name={c.name} size={44} />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-extrabold">{c.name}</div>
                <div className="truncate text-[10px] font-semibold text-text-secondary">
                  {c.countries} · {c.experienceYears} yrs experience
                </div>
              </div>
              <a
                href={`tel:${c.phone}`}
                className="flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-btn bg-primary px-3.5 text-[11px] font-extrabold text-white"
              >
                <Icon icon={Phone} size={13} /> Call
              </a>
            </Card>
          ))}
          {counsellors.length === 0 && (
            <Card className="flex flex-col items-center gap-2 py-8 text-center">
              <Icon icon={Headset} size={24} className="text-text-secondary" />
              <div className="text-[11.5px] font-semibold text-text-secondary">Counsellors coming soon.</div>
            </Card>
          )}
        </div>
      )}

    </div>
  );
}

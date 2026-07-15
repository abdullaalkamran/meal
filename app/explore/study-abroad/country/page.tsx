"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Award,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  GraduationCap,
  Languages,
  Newspaper,
  School,
  Wallet,
} from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { EligibilityFormSheet } from "@/components/explore/EligibilityFormSheet";
import { useStudyAbroadItems } from "@/hooks/useStudyAbroad";
import type { StudyAbroadItem, StudyAbroadKind } from "@/lib/data";

type OfKind<K extends StudyAbroadKind> = Extract<StudyAbroadItem, { kind: K }>;

function CountryDetail() {
  const router = useRouter();
  const { user } = useSession();
  const id = useSearchParams().get("id");
  const all = useStudyAbroadItems();
  const [eligOpen, setEligOpen] = useState(false);

  const country = all.find(
    (i): i is OfKind<"country"> => i.kind === "country" && i.id === id
  );
  const scholarships = all.filter(
    (i): i is OfKind<"scholarship"> =>
      i.kind === "scholarship" && i.active && i.country === country?.name
  );
  const blogs = all.filter(
    (i): i is OfKind<"blog"> => i.kind === "blog" && i.active && i.country === country?.name
  );

  if (!country) {
    return (
      <div className="flex flex-col gap-5 pb-4 pt-2">
        <Card className="text-center text-[11.5px] font-semibold text-text-secondary">
          Loading country guide…
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.push("/explore/study-abroad")}
          aria-label="Back to study abroad"
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-bg"
        >
          <Icon icon={ChevronLeft} size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-[17.5px] font-extrabold tracking-tight">
            {country.flag} Study in {country.name}
          </div>
          <div className="text-[10.5px] font-semibold text-text-secondary">
            Intakes: {country.intakes}
          </div>
        </div>
      </div>

      {country.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={country.image} alt={country.name} className="h-40 w-full rounded-card object-cover" />
      )}

      <div className="text-[11.5px] font-semibold leading-relaxed text-text-secondary">
        {country.overview}
      </div>

      <button
        type="button"
        onClick={() => setEligOpen(true)}
        className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-btn text-[13px] font-extrabold text-white shadow-soft"
        style={{ background: "linear-gradient(135deg, var(--gradient-accent-from), var(--gradient-accent-to))" }}
      >
        <Icon icon={CheckCircle2} size={16} />
        Check your eligibility — free
      </button>

      <div className="grid grid-cols-2 gap-2">
        {[
          { icon: GraduationCap, label: "Tuition", value: country.tuition },
          { icon: Wallet, label: "Living cost", value: country.livingCost },
          { icon: BriefcaseBusiness, label: "Work rights", value: country.workRights },
          { icon: CalendarDays, label: "Intakes", value: country.intakes },
        ].map((m) => (
          <Card key={m.label} className="px-3 py-2.5">
            <div className="flex items-center gap-1 text-[8.5px] font-extrabold uppercase text-text-secondary">
              <Icon icon={m.icon} size={10} /> {m.label}
            </div>
            <div className="mt-0.5 text-[10.5px] font-extrabold leading-tight">{m.value}</div>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        <Card className="flex items-start gap-2.5">
          <Icon icon={School} size={15} className="mt-0.5 shrink-0 text-blue" />
          <div>
            <div className="text-[9.5px] font-extrabold uppercase text-text-secondary">Popular universities</div>
            <div className="mt-0.5 text-[11px] font-bold leading-relaxed">{country.universities}</div>
          </div>
        </Card>
        <Card className="flex items-start gap-2.5">
          <Icon icon={FileCheck2} size={15} className="mt-0.5 shrink-0 text-primary" />
          <div>
            <div className="text-[9.5px] font-extrabold uppercase text-text-secondary">Visa requirements</div>
            <div className="mt-0.5 text-[11px] font-bold leading-relaxed">{country.visa}</div>
          </div>
        </Card>
        <Card className="flex items-start gap-2.5">
          <Icon icon={Languages} size={15} className="mt-0.5 shrink-0 text-orange" />
          <div>
            <div className="text-[9.5px] font-extrabold uppercase text-text-secondary">Language / IELTS</div>
            <div className="mt-0.5 text-[11px] font-bold leading-relaxed">{country.ielts}</div>
          </div>
        </Card>
      </div>

      {scholarships.length > 0 && (
        <div>
          <div className="mb-2 text-[13px] font-extrabold">Scholarships for {country.name}</div>
          <div className="flex flex-col gap-2">
            {scholarships.map((s) => (
              <Card key={s.id} className="flex items-center gap-2.5">
                <Icon icon={Award} size={15} className="shrink-0 text-orange" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-extrabold">{s.name}</div>
                  <div className="text-[9.5px] font-semibold text-text-secondary">{s.coverage}</div>
                </div>
                <span className="shrink-0 rounded-pill bg-danger-soft px-2 py-0.5 text-[8.5px] font-extrabold text-danger">
                  {s.deadline}
                </span>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 text-[13px] font-extrabold">Guides &amp; articles</div>
        {blogs.length === 0 ? (
          <Card className="text-center text-[10.5px] font-semibold text-text-secondary">
            No articles for {country.name} yet.
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {blogs.map((b) => (
              <Link key={b.id} href={`/explore/study-abroad/article?id=${b.id}`}>
                <Card className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-soft text-blue">
                    <Icon icon={Newspaper} size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-extrabold leading-tight">{b.title}</div>
                    <div className="mt-0.5 truncate text-[9.5px] font-semibold text-text-secondary">{b.excerpt}</div>
                  </div>
                  <Icon icon={ChevronRight} size={14} className="shrink-0 text-text-secondary" />
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <EligibilityFormSheet
        open={eligOpen}
        onClose={() => setEligOpen(false)}
        countryName={country.name}
        user={user}
      />
    </div>
  );
}

export default function CountryDetailPage() {
  // useSearchParams requires a Suspense boundary during prerender.
  return (
    <Suspense fallback={null}>
      <CountryDetail />
    </Suspense>
  );
}

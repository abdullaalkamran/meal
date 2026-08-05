"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronRight, GraduationCap, Megaphone, Receipt, ShoppingBasket, Sparkles, Tag } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { useServiceListings } from "@/hooks/useServiceListings";
import { useStudyAbroadItems } from "@/hooks/useStudyAbroad";
import { usePromoSettings } from "@/hooks/usePromoSettings";
import { useActivePromotions } from "@/hooks/usePromotions";
import { formatBDT } from "@/lib/utils/currency";
import { currentMonth, formatMonthLabel } from "@/lib/utils/date";
import type { Bill } from "@/lib/data";

interface Slide {
  id: string;
  tag: string;
  icon: typeof Tag;
  title: string;
  tagline: string;
  href: string;
  image?: string;
}

const GRADIENTS = [
  "linear-gradient(135deg, var(--gradient-accent-from), var(--gradient-accent-to))",
  "linear-gradient(135deg, #F59E0B, #B45309)",
  "linear-gradient(135deg, #7C6CF6, #4C3ED9)",
  "linear-gradient(135deg, #3B82F6, #1D4ED8)",
];

/** Homepage hero: an auto-advancing slider of platform promotions (study
 * abroad, offers, grocery, books) with a toggle to flip the same section to
 * the member's current bill & credit. */
/** How long the bill peek stays before sliding back to the carousel. */
const BILL_PEEK_MS = 8000;

export function HomeHero({
  bill,
  mealRate,
  mealSummary,
  myShoppingCost,
}: {
  bill: Bill | undefined;
  mealRate: number;
  /** This month's own meals + live billed cost — updates as soon as the
   * manager confirms cooking, without waiting for a bill to be (re)generated. */
  mealSummary: { mealsOn: number; billedMeals: number; cost: number } | null;
  /** What I've personally spent on approved shopping this month — credited
   * against my own meal cost, same as a generated bill would. */
  myShoppingCost: number;
}) {
  // Open on the bill card first; after a peek it flips to the promo carousel,
  // which then auto-advances one card at a time. Tapping "My bill & credit"
  // returns to the bill and repeats the same flip-out.
  const [mode, setMode] = useState<"promos" | "bill">("bill");
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedUntil = useRef(0);
  const [index, setIndex] = useState(0);
  const settings = usePromoSettings();

  const offers = useServiceListings("offer")
    .filter((l) => l.active)
    .slice(0, 3);
  const studyPromos = useStudyAbroadItems()
    .filter((i) => i.kind === "promo" && i.active)
    .slice(0, 2);
  // Service-Manager-uploaded home banners lead the carousel.
  const banners = useActivePromotions("hero");

  const slides: Slide[] = [
    ...(settings.sources.banners !== false
      ? banners.map((b) => ({
          id: b.id,
          tag: "Featured",
          icon: Megaphone,
          title: b.title ?? "",
          tagline: b.tagline ?? "",
          href: b.linkUrl || "#",
          image: b.image,
        }))
      : []),
    ...(settings.sources.study
      ? studyPromos.map((p) => ({
          id: p.id,
          tag: "Study abroad",
          icon: GraduationCap,
          title: p.kind === "promo" ? p.title : "",
          tagline: p.kind === "promo" ? p.tagline : "",
          href: "/explore/study-abroad",
          image: p.kind === "promo" ? p.image : undefined,
        }))
      : []),
    ...(settings.sources.offers
      ? offers.map((o) => ({
          id: o.id,
          tag: "Shop offer",
          icon: Tag,
          title: `${o.shop} · ${o.discount}`,
          tagline: `${o.title} — code ${o.code}, till ${o.expires}`,
          href: "/explore/offers",
        }))
      : []),
    ...(settings.sources.grocery
      ? [
          {
            id: "slide_grocery",
            tag: "Grocery store",
            icon: ShoppingBasket,
            title: "Groceries to your hostel door",
            tagline: "Rice, eggs, oil & more at member prices — order in the app.",
            href: "/explore/grocery",
          },
        ]
      : []),
    ...(settings.sources.books
      ? [
          {
            id: "slide_books",
            tag: "Buy books",
            icon: BookOpen,
            title: "New & old books, one place",
            tagline: "Platform books with delivery · used books from members.",
            href: "/explore/books",
          },
        ]
      : []),
  ];

  useEffect(() => {
    if (mode !== "promos" || slides.length < 2) return;
    const timer = setInterval(() => {
      if (Date.now() < pausedUntil.current) return;
      const track = trackRef.current;
      if (!track) return;
      const current = Math.round(track.scrollLeft / track.clientWidth);
      track.scrollTo({ left: ((current + 1) % slides.length) * track.clientWidth, behavior: "smooth" });
    }, settings.intervalSec * 1000);
    return () => clearInterval(timer);
  }, [mode, slides.length, settings.intervalSec]);

  // The bill peek is temporary: after a few seconds the section slides back
  // to the promo carousel on its own (the shrinking bar shows the countdown).
  useEffect(() => {
    if (mode !== "bill") return;
    const timer = setTimeout(() => setMode("promos"), BILL_PEEK_MS);
    return () => clearTimeout(timer);
  }, [mode]);

  // Meal cost is computed live (this month's billed meals × rate, minus my
  // own approved shopping spend — same credit a generated bill would give)
  // rather than read from the bill row, so it moves the moment the manager
  // confirms cooking instead of waiting for the next "Generate bills" run.
  // Whatever's already been paid against a generated bill's meal-cost
  // section is still honoured.
  const mealCostPaid = bill?.sections.find((s) => s.label === "mealCost")?.paid ?? 0;
  const mealCostSoFar = (mealSummary?.cost ?? 0) - myShoppingCost;
  const mealDue = mealCostSoFar - mealCostPaid;

  // Rent + everything else stays tied to the last generated bill — there's
  // no live-computable equivalent (it depends on room assignment and
  // manager-entered expenses, not on meals/cooking).
  const roomRent = bill?.sections.find((s) => s.label === "roomRent");
  const otherSections = bill?.sections.filter((s) => s.label === "serviceCharge" || s.label === "cookSalary") ?? [];
  const rentDue = (roomRent?.total ?? 0) - (roomRent?.paid ?? 0);
  const otherTotal = otherSections.reduce((sum, s) => sum + s.total, 0);
  const otherDue = otherTotal - otherSections.reduce((sum, s) => sum + s.paid, 0);

  const previousDue = (bill?.previousBalance ?? 0) - (bill?.previousBalancePaid ?? 0);
  // A meal-cost credit (shopping spend exceeding what's owed for meals) must
  // never silently reduce what's shown as owed for rent/other bills here —
  // that's an explicit manager decision (settleMealCredit), not something
  // this headline figure does automatically. Only positive dues contribute;
  // the true (possibly negative) mealDue is still shown in its own section
  // above so the student can see the credit exists.
  const grandTotal = Math.max(mealCostSoFar, 0) + (roomRent?.total ?? 0) + otherTotal + (bill?.previousBalance ?? 0);
  const due = Math.max(mealDue, 0) + rentDue + otherDue + previousDue;

  return (
    <div>
      {/* Section header + toggle */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[13.5px] font-extrabold">
          <Icon icon={mode === "promos" ? Sparkles : Receipt} size={15} className="text-primary" />
          {mode === "promos" ? "For you" : `Current bill · ${formatMonthLabel(currentMonth()).split(" ")[0]}`}
        </div>
        <button
          type="button"
          onClick={() => setMode(mode === "promos" ? "bill" : "promos")}
          className="flex items-center gap-1 rounded-pill bg-primary-soft px-3 py-1.5 text-[10.5px] font-extrabold text-primary"
        >
          {mode === "promos" ? "My bill & credit" : "Offers for you"}
          <Icon icon={ChevronRight} size={12} />
        </button>
      </div>

      {/* key={mode} re-mounts on toggle so each switch slides the new card in */}
      <div key={mode} style={{ animation: "heroMove 0.4s ease" }}>
      {mode === "promos" ? (
        <div>
          <div
            ref={trackRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              setIndex(Math.round(el.scrollLeft / el.clientWidth));
            }}
            onPointerDown={() => {
              pausedUntil.current = Date.now() + 8000;
            }}
            className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {slides.map((s, i) => (
              <div key={s.id} className="w-full shrink-0 snap-center">
                <Link href={s.href}>
                  <div
                    className="relative overflow-hidden rounded-card"
                    style={{ height: settings.photoHeightPx }}
                  >
                    {s.image ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s.image} alt={s.title} className="h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
                      </>
                    ) : (
                      <div className="h-full w-full" style={{ background: GRADIENTS[i % GRADIENTS.length] }} />
                    )}
                    <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                      <div className="mb-1 flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-wide text-white/80">
                        <Icon icon={s.icon} size={11} /> {s.tag}
                      </div>
                      <div className="text-[15px] font-extrabold leading-tight">{s.title}</div>
                      <div className="mt-0.5 line-clamp-2 text-[10.5px] font-semibold text-white/85">{s.tagline}</div>
                    </div>
                    <div className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white">
                      <Icon icon={ChevronRight} size={14} />
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
          {slides.length > 1 && (
            <div className="mt-2 flex items-center justify-center gap-1.5">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Go to slide ${i + 1}`}
                  onClick={() => {
                    pausedUntil.current = Date.now() + 8000;
                    trackRef.current?.scrollTo({ left: i * trackRef.current.clientWidth, behavior: "smooth" });
                  }}
                  className={`h-1.5 rounded-pill transition-all ${i === index ? "w-5 bg-primary" : "w-1.5 bg-border"}`}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <Link href="/student/bill">
          <div
            className="relative overflow-hidden rounded-card p-5 text-white"
            style={{ background: "linear-gradient(135deg, var(--gradient-accent-from), var(--gradient-accent-to))" }}
          >
            {/* Countdown bar — shrinks over the peek window, then the section
                returns to the carousel automatically. */}
            <div className="absolute inset-x-0 top-0 h-[3px] bg-white/20">
              <div
                className="h-full bg-white/80"
                style={{ animation: `heroCountdown ${BILL_PEEK_MS}ms linear forwards` }}
              />
            </div>
            <div className="mb-1 flex items-center justify-between">
              <div className="text-[11.5px] font-bold text-white/80">
                Current bill · {formatMonthLabel(currentMonth()).split(" ")[0]}
              </div>
              <Icon icon={ChevronRight} size={18} />
            </div>
            <div className="mb-3 flex items-center gap-2.5">
              <div className="text-[22px] font-extrabold">{formatBDT(grandTotal)}</div>
              {due > 0 && (
                <div className="rounded-pill bg-danger px-2.5 py-1 text-[10px] font-extrabold">
                  {formatBDT(due)} Outstanding
                </div>
              )}
              {due < 0 && (
                <div className="rounded-pill bg-white/25 px-2.5 py-1 text-[10px] font-extrabold">
                  {formatBDT(-due)} Credit
                </div>
              )}
            </div>
            <div className="flex gap-4 border-t border-white/20 pt-3">
              {/* Meal cost — live, moves as soon as the manager confirms cooking */}
              <div className="flex-1">
                <div className="mb-1.5 text-[9px] font-extrabold uppercase tracking-wide text-white/50">
                  Meal cost
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  <div>
                    <div className="text-[9px] font-bold text-white/60">Meals eaten</div>
                    <div className="text-[12px] font-extrabold">{mealSummary?.mealsOn ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold text-white/60">Avg /meal</div>
                    <div className="text-[12px] font-extrabold">{formatBDT(mealRate)}</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold text-white/60">My shopping</div>
                    <div className="text-[12px] font-extrabold">{formatBDT(myShoppingCost)}</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold text-white/60">{mealDue < 0 ? "Credit" : "Due"}</div>
                    <div className="text-[12px] font-extrabold">{formatBDT(Math.abs(mealDue))}</div>
                  </div>
                </div>
              </div>

              <div className="w-px shrink-0 bg-white/20" />

              {/* Rent & other bills — from the last generated bill */}
              <div className="flex-1">
                <div className="mb-1.5 text-[9px] font-extrabold uppercase tracking-wide text-white/50">
                  Rent &amp; bills
                </div>
                {bill ? (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[10px] font-bold text-white/70">Seat rent</div>
                      <div className="text-[12px] font-extrabold">
                        {rentDue > 0 ? formatBDT(rentDue) : "Paid"}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[10px] font-bold text-white/70">Other bills</div>
                      <div className="text-[12px] font-extrabold">
                        {otherDue > 0 ? formatBDT(otherDue) : "Paid"}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] font-semibold text-white/60">Not generated yet</div>
                )}
              </div>
            </div>
          </div>
        </Link>
      )}
      </div>
    </div>
  );
}

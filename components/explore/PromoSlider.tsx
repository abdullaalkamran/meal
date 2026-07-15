"use client";

import { useEffect, useRef, useState } from "react";
import { GraduationCap } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import type { StudyAbroadItem } from "@/lib/data";

type Promo = Extract<StudyAbroadItem, { kind: "promo" }>;

/** Horizontal snap-scroll slider for promo photo cards: swipe between cards,
 * dots to jump, and a gentle auto-advance that pauses while the user drags. */
export function PromoSlider({ promos }: { promos: Promo[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedUntil = useRef(0);
  const [index, setIndex] = useState(0);

  const scrollTo = (i: number) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: i * track.clientWidth, behavior: "smooth" });
  };

  useEffect(() => {
    if (promos.length < 2) return;
    const timer = setInterval(() => {
      if (Date.now() < pausedUntil.current) return;
      const track = trackRef.current;
      if (!track) return;
      const current = Math.round(track.scrollLeft / track.clientWidth);
      const next = (current + 1) % promos.length;
      track.scrollTo({ left: next * track.clientWidth, behavior: "smooth" });
    }, 4500);
    return () => clearInterval(timer);
  }, [promos.length]);

  if (promos.length === 0) return null;

  return (
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
        {promos.map((p) => (
          <div key={p.id} className="w-full shrink-0 snap-center pr-0">
            <div className="relative overflow-hidden rounded-card shadow-soft">
              {p.image ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image} alt={p.title} className="h-40 w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                </>
              ) : (
                <div
                  className="h-40 w-full"
                  style={{ background: "linear-gradient(135deg, var(--gradient-accent-from), var(--gradient-accent-to))" }}
                />
              )}
              <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                <div className="mb-0.5 flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-wide text-white/75">
                  <Icon icon={GraduationCap} size={11} /> Platform offer
                </div>
                <div className="text-[14.5px] font-extrabold leading-tight">{p.title}</div>
                <div className="mt-0.5 text-[10.5px] font-semibold text-white/85">{p.tagline}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {promos.length > 1 && (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {promos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              aria-label={`Go to promo ${i + 1}`}
              onClick={() => {
                pausedUntil.current = Date.now() + 8000;
                scrollTo(i);
              }}
              className={`h-1.5 rounded-pill transition-all ${
                i === index ? "w-5 bg-primary" : "w-1.5 bg-border"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

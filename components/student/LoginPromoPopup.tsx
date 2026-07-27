"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { useActivePromotions } from "@/hooks/usePromotions";

// One dismissal per popup per browser session — so a member sees it once after
// signing in, not on every page they open.
const seenKey = (id: string) => `promo-popup-seen:${id}`;

/** A square promotional card that pops up once after sign-in. The Service
 * Manager uploads these under Home page promotions. */
export function LoginPromoPopup() {
  const popups = useActivePromotions("popup");
  const [shownId, setShownId] = useState<string | null>(null);

  useEffect(() => {
    if (shownId) return;
    const next = popups.find((p) => {
      try {
        return sessionStorage.getItem(seenKey(p.id)) !== "1";
      } catch {
        return true;
      }
    });
    // sessionStorage is client-only, so this decision can't be made during
    // render (SSR) — it must live in an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (next) setShownId(next.id);
  }, [popups, shownId]);

  const promo = popups.find((p) => p.id === shownId);
  if (!promo) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(seenKey(promo.id), "1");
    } catch {
      // ignore storage failures — worst case it shows again next mount
    }
    setShownId(null);
  };

  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={promo.image} alt={promo.title ?? "promotion"} className="aspect-square w-full object-cover" />
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-5"
      style={{ animation: "fadeIn 0.2s ease" }}
      onClick={dismiss}
    >
      <div
        className="relative w-[min(86vw,360px)] overflow-hidden rounded-card bg-card shadow-soft"
        style={{ animation: "sheetUp 0.25s ease" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white"
        >
          <Icon icon={X} size={16} />
        </button>
        {promo.linkUrl ? (
          <a href={promo.linkUrl} target="_blank" rel="noreferrer" onClick={dismiss}>
            {image}
          </a>
        ) : (
          image
        )}
        {(promo.title || promo.tagline) && (
          <div className="p-4">
            {promo.title && <div className="text-[14px] font-extrabold">{promo.title}</div>}
            {promo.tagline && (
              <div className="mt-0.5 text-[11px] font-semibold text-text-secondary">{promo.tagline}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

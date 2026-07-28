"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { repo, type Promotion } from "@/lib/data";

// Shown at most once per browser session. A single flag (not one per id) also
// lets us SKIP the fetch entirely once dismissed — important because this lives
// in AppShell, so a live subscription here would re-pull promo images on every
// data change, on every page.
const SESSION_FLAG = "promo-popup-done";

/** A square promotional card that pops up once after sign-in. The Service
 * Manager uploads these under Home page promotions. */
export function LoginPromoPopup() {
  const [promo, setPromo] = useState<Promotion | null>(null);

  useEffect(() => {
    let done = false;
    try {
      done = sessionStorage.getItem(SESSION_FLAG) === "1";
    } catch {
      // sessionStorage unavailable — just proceed to fetch once.
    }
    if (done) return;
    let cancelled = false;
    // One-time fetch (not a subscription): only pull the popup image when we
    // might actually show it, never on every page/render.
    repo.promotions
      .listActive("popup")
      .then((list) => {
        if (!cancelled && list.length > 0) setPromo(list[0]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!promo) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(SESSION_FLAG, "1");
    } catch {
      // ignore storage failures — worst case it shows again next session mount
    }
    setPromo(null);
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

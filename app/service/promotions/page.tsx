"use client";

import { useState } from "react";
import { ImageIcon, Pencil, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { usePromotions } from "@/hooks/usePromotions";
import { usePromoSettings } from "@/hooks/usePromoSettings";
import { PromotionFormSheet } from "@/components/service/PromotionFormSheet";
import { repo, type HeroPromoSettings, type Promotion } from "@/lib/data";

// Everything the home carousel can show, toggled in one place. "banners" are
// the uploaded ones below; the rest are built-in app sections.
const SOURCE_OPTIONS: { key: keyof HeroPromoSettings["sources"]; label: string }[] = [
  { key: "banners", label: "Uploaded home banners" },
  { key: "study", label: "Study abroad promo cards" },
  { key: "offers", label: "Shop offers" },
  { key: "grocery", label: "Grocery store slide" },
  { key: "books", label: "Buy / old books slide" },
];

const SECTIONS: { placement: Promotion["placement"]; title: string; hint: string }[] = [
  {
    placement: "hero",
    title: "Home banners",
    hint: "Wide photo slides in the home page carousel. Best ≈ 1200 × 600 px.",
  },
  {
    placement: "popup",
    title: "Login popups",
    hint: "Square cards that pop up once after a member signs in. Best ≈ 1080 × 1080 px.",
  },
];

export default function ServicePromotionsPage() {
  const promos = usePromotions();
  const promoSettings = usePromoSettings();
  const { toast } = useToast();
  const [sheet, setSheet] = useState<{ placement: Promotion["placement"]; editing?: Promotion } | null>(null);

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div>
        <div className="text-[17.5px] font-extrabold tracking-tight">Home page promotions</div>
        <div className="text-[10.5px] font-semibold text-text-secondary">
          Everything on the members&rsquo; home carousel &amp; login popup, in one place.
        </div>
      </div>

      {/* One place to turn every home-carousel source on/off, plus its timing */}
      <Card className="flex flex-col gap-3">
        <div>
          <div className="text-[12.5px] font-extrabold">Home carousel</div>
          <div className="text-[9.5px] font-semibold text-text-secondary">
            What rotates on every member&rsquo;s home screen
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {SOURCE_OPTIONS.map((s) => (
            <div key={s.key} className="flex items-center justify-between rounded-btn bg-bg px-3 py-2">
              <span className="text-[11px] font-bold">{s.label}</span>
              <Switch
                checked={promoSettings.sources[s.key] ?? true}
                onChange={(checked) =>
                  repo.promoSettings.update({
                    sources: { ...promoSettings.sources, [s.key]: checked },
                  })
                }
              />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="rounded-btn bg-bg px-3 py-2">
            <div className="text-[9px] font-extrabold uppercase text-text-secondary">Slide duration (sec)</div>
            <input
              type="number"
              min={2}
              max={15}
              value={promoSettings.intervalSec}
              onChange={(e) => {
                const v = Math.min(15, Math.max(2, Number(e.target.value) || 4));
                repo.promoSettings.update({ intervalSec: v });
              }}
              className="mt-0.5 w-full bg-transparent text-[13px] font-extrabold outline-none"
            />
          </label>
          <label className="rounded-btn bg-bg px-3 py-2">
            <div className="text-[9px] font-extrabold uppercase text-text-secondary">Photo height (px)</div>
            <input
              type="number"
              min={120}
              max={240}
              step={10}
              value={promoSettings.photoHeightPx}
              onChange={(e) => {
                const v = Math.min(240, Math.max(120, Number(e.target.value) || 150));
                repo.promoSettings.update({ photoHeightPx: v });
              }}
              className="mt-0.5 w-full bg-transparent text-[13px] font-extrabold outline-none"
            />
          </label>
        </div>
      </Card>

      {SECTIONS.map((s) => {
        const items = promos.filter((p) => p.placement === s.placement);
        return (
          <div key={s.placement}>
            <div className="mb-1 flex items-center justify-between">
              <div className="text-[13.5px] font-extrabold">{s.title}</div>
              <button
                type="button"
                onClick={() => setSheet({ placement: s.placement })}
                className="flex items-center gap-1 rounded-pill bg-primary px-3 py-1.5 text-[10.5px] font-extrabold text-white"
              >
                <Icon icon={Plus} size={13} /> Add
              </button>
            </div>
            <div className="mb-2 text-[10px] font-semibold text-text-secondary">{s.hint}</div>

            {items.length === 0 ? (
              <Card className="flex items-center gap-2 text-[11px] font-semibold text-text-secondary">
                <Icon icon={ImageIcon} size={15} /> None yet — tap Add to upload one.
              </Card>
            ) : (
              <div className="flex flex-col gap-2">
                {items.map((p) => (
                  <Card key={p.id} className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.image}
                      alt={p.title ?? "promotion"}
                      className={`shrink-0 rounded-btn object-cover ${
                        p.placement === "popup" ? "h-12 w-12" : "h-10 w-16"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-extrabold">{p.title || "Untitled"}</div>
                      <div className="truncate text-[10px] font-semibold text-text-secondary">
                        {p.tagline || (p.active ? "Showing to members" : "Hidden")}
                      </div>
                    </div>
                    <Switch
                      checked={p.active}
                      onChange={(v) => repo.promotions.toggleActive(p.id, v)}
                    />
                    <button
                      type="button"
                      onClick={() => setSheet({ placement: p.placement, editing: p })}
                      aria-label="Edit"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg text-text-secondary"
                    >
                      <Icon icon={Pencil} size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await repo.promotions.remove(p.id);
                        toast("Promotion deleted");
                      }}
                      aria-label="Delete"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger"
                    >
                      <Icon icon={Trash2} size={14} />
                    </button>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <PromotionFormSheet
        open={!!sheet}
        onClose={() => setSheet(null)}
        placement={sheet?.placement ?? "hero"}
        editing={sheet?.editing}
      />
    </div>
  );
}

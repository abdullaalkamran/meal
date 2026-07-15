"use client";

import { useEffect, useState } from "react";
import { repo, type HeroPromoSettings } from "@/lib/data";

const DEFAULTS: HeroPromoSettings = {
  sources: { study: true, offers: true, grocery: true, books: true },
  intervalSec: 4,
  photoHeightPx: 150,
};

/** The homepage promo-carousel settings the Service Manager controls. */
export function usePromoSettings(): HeroPromoSettings {
  const [settings, setSettings] = useState<HeroPromoSettings>(DEFAULTS);
  useEffect(() => repo.promoSettings.subscribe(setSettings), []);
  return settings;
}

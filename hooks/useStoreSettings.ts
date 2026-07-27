"use client";

import { useEffect, useState } from "react";
import { repo, type StoreSettings } from "@/lib/data";

const DEFAULTS: StoreSettings = { deliveryFeeEnabled: true, deliveryFee: 30 };

/** The store's delivery-fee policy — Service Manager controlled. */
export function useStoreSettings(): StoreSettings {
  const [settings, setSettings] = useState<StoreSettings>(DEFAULTS);
  useEffect(() => repo.storeSettings.subscribe(setSettings), []);
  return settings;
}

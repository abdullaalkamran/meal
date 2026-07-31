"use client";

import { useEffect, useState } from "react";
import { repo, type QuickServiceSettings } from "@/lib/data";

/** Super Admin's per-quick-action enable/disable + location settings. */
export function useQuickServices(): QuickServiceSettings {
  const [settings, setSettings] = useState<QuickServiceSettings>({});
  useEffect(() => repo.quickServices.subscribe(setSettings), []);
  return settings;
}

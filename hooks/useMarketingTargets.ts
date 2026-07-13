"use client";

import { useEffect, useState } from "react";
import { repo, type MarketingTarget } from "@/lib/data";

export function useMarketingTargets(month: string) {
  const [targets, setTargets] = useState<MarketingTarget[]>([]);
  useEffect(() => {
    const load = () => repo.marketing.listTargets(month).then(setTargets);
    load();
    return repo.marketing.subscribe(load);
  }, [month]);
  return targets;
}

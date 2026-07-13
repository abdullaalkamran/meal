"use client";

import { useEffect, useState } from "react";
import { repo, type Campaign } from "@/lib/data";

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  useEffect(() => repo.campaigns.subscribe(setCampaigns), []);
  return campaigns;
}

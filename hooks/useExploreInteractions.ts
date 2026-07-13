"use client";

import { useEffect, useState } from "react";
import { repo, type ExploreInteraction } from "@/lib/data";

export function useExploreInteractions(userId: string | undefined) {
  const [interactions, setInteractions] = useState<ExploreInteraction[]>([]);

  useEffect(() => {
    if (!userId) return;
    return repo.exploreInteractions.subscribe(userId, setInteractions);
  }, [userId]);

  return interactions;
}

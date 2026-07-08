"use client";

import { useEffect, useState } from "react";
import { repo, type DutyPlan } from "@/lib/data";

export function useDutyPlans(hostelId: string | undefined) {
  const [plans, setPlans] = useState<DutyPlan[]>([]);

  useEffect(() => {
    if (!hostelId) return;
    return repo.duties.subscribe(hostelId, setPlans);
  }, [hostelId]);

  return plans;
}

"use client";

import { useEffect, useState } from "react";
import { repo, type CookLeaveRequest } from "@/lib/data";

export function useCookLeaveRequests(hostelId: string | undefined) {
  const [requests, setRequests] = useState<CookLeaveRequest[]>([]);

  useEffect(() => {
    if (!hostelId) return;
    return repo.cookLeave.subscribe(hostelId, setRequests);
  }, [hostelId]);

  return requests;
}

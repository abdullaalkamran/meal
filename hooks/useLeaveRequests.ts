"use client";

import { useEffect, useState } from "react";
import { repo, type LeaveRequest } from "@/lib/data";

export function useLeaveRequests(hostelId: string | undefined) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);

  useEffect(() => {
    if (!hostelId) return;
    return repo.leaveRequests.subscribe(hostelId, setRequests);
  }, [hostelId]);

  return requests;
}

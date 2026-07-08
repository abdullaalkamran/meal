"use client";

import { useEffect, useState } from "react";
import { repo, type JoinRequest } from "@/lib/data";

export function useJoinRequests(hostelId: string | undefined) {
  const [requests, setRequests] = useState<JoinRequest[]>([]);

  useEffect(() => {
    if (!hostelId) return;
    return repo.joinRequests.subscribe(hostelId, setRequests);
  }, [hostelId]);

  return requests;
}

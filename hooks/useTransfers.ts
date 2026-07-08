"use client";

import { useEffect, useState } from "react";
import { repo, type HostelTransferRequest } from "@/lib/data";

export function useTransfers(hostelId: string | undefined) {
  const [transfers, setTransfers] = useState<HostelTransferRequest[]>([]);

  useEffect(() => {
    if (!hostelId) return;
    return repo.transfers.subscribe(hostelId, setTransfers);
  }, [hostelId]);

  return transfers;
}

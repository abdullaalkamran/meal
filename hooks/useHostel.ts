"use client";

import { useEffect, useState } from "react";
import { repo, type Hostel } from "@/lib/data";

export function useHostel(hostelId: string | undefined) {
  const [hostel, setHostel] = useState<Hostel | undefined>(undefined);

  useEffect(() => {
    if (!hostelId) return;
    return repo.hostels.subscribe(hostelId, setHostel);
  }, [hostelId]);

  return hostel;
}

export function useHostelsByOwner(ownerId: string | undefined) {
  const [hostels, setHostels] = useState<Hostel[]>([]);

  useEffect(() => {
    if (!ownerId) return;
    let cancelled = false;
    repo.hostels.listByOwner(ownerId).then((list) => {
      if (!cancelled) setHostels(list);
    });
    return () => {
      cancelled = true;
    };
  }, [ownerId]);

  return hostels;
}

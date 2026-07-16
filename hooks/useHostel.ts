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
    // Live subscription (not a one-shot fetch) so a hostel the owner just
    // created shows up immediately on every owner page.
    return repo.hostels.subscribeAll((all) =>
      setHostels(all.filter((h) => h.ownerId === ownerId))
    );
  }, [ownerId]);

  return hostels;
}

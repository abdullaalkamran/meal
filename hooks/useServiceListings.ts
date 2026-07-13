"use client";

import { useEffect, useState } from "react";
import { repo, type ServiceKind, type ServiceListing } from "@/lib/data";

type OfKind<K extends ServiceKind> = Extract<ServiceListing, { kind: K }>;

/** All catalog listings of one kind, correctly narrowed to that kind's shape
 * (subscribes to the shared catalog and filters). */
export function useServiceListings<K extends ServiceKind>(kind: K): OfKind<K>[] {
  const [listings, setListings] = useState<OfKind<K>[]>([]);

  useEffect(() => {
    return repo.serviceCatalog.subscribe((all) =>
      setListings(all.filter((l): l is OfKind<K> => l.kind === kind))
    );
  }, [kind]);

  return listings;
}

/** The whole catalog across every kind — used by the Service Manager screen. */
export function useAllServiceListings(): ServiceListing[] {
  const [listings, setListings] = useState<ServiceListing[]>([]);
  useEffect(() => repo.serviceCatalog.subscribe(setListings), []);
  return listings;
}

"use client";

import { useEffect, useState } from "react";
import { repo, type Coupon } from "@/lib/data";

/** Every coupon (incl. inactive/expired) — Service Manager management. */
export function useCoupons(): Coupon[] {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  useEffect(() => repo.coupons.subscribe(setCoupons), []);
  return coupons;
}

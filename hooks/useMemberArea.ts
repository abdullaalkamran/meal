"use client";

import { useSession } from "@/lib/auth/SessionProvider";
import type { GeoAddress } from "@/lib/data";

/** The location that area-restricted platform services (jobs, offers,
 * e-commerce…) filter against for the signed-in member: their own address if
 * they set one, otherwise their hostel's address. Undefined (nothing set)
 * means no filtering — they see everything. */
export function useMemberArea(): GeoAddress | undefined {
  const { user, hostel } = useSession();
  return user?.address ?? hostel?.address;
}

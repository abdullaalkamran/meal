"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth/SessionProvider";

const FIND_HOSTEL = "/student/find-hostel";

/** A member who hasn't joined a hostel yet can only use the find-hostel page —
 * every other student screen assumes a hostel and gets redirected there. */
export function RequireHostel({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const needsHostel = !isLoading && user?.role === "student" && !user.hostelId;
  const misplaced = needsHostel && pathname !== FIND_HOSTEL;

  useEffect(() => {
    if (misplaced) router.replace(FIND_HOSTEL);
  }, [misplaced, router]);

  if (misplaced) return null;
  return <>{children}</>;
}

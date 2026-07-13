"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/lib/auth/SessionProvider";

/**
 * A relaxed guard for shared pages (like /explore/*) that any logged-in user
 * may view regardless of role — unlike RoleGuard, it only checks that someone
 * is signed in.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isLoading, user } = useSession();

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, user, router]);

  if (isLoading || !user) return null;
  return <>{children}</>;
}

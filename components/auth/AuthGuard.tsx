"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/lib/auth/SessionProvider";
import { MealSplash } from "@/components/ui/MealSplash";

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

  // While the session resolves, show the splash rather than a blank screen.
  // Once loaded-but-unauthenticated, stay blank — the effect above is
  // redirecting to /login.
  if (isLoading) return <MealSplash />;
  if (!user) return null;
  return <>{children}</>;
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ROLE_HOME, useSession } from "@/lib/auth/SessionProvider";
import { MealSplash } from "@/components/ui/MealSplash";
import type { Role } from "@/lib/data";

export function RoleGuard({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isLoading, user, viewRole } = useSession();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (viewRole !== role) {
      // Redirect to wherever the *current* view role belongs — not the
      // account's base role — so a manager using "switch to my boarder
      // view" lands on /student instead of bouncing back to /manager.
      router.replace(ROLE_HOME[viewRole ?? user.role]);
    }
  }, [isLoading, user, viewRole, role, router]);

  // Show the splash while the session resolves, then keep blank during the
  // redirect the effect above kicks off for the wrong role / no user.
  if (isLoading) return <MealSplash />;
  if (!user || viewRole !== role) return null;

  return <>{children}</>;
}

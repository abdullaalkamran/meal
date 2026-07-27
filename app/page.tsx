"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ROLE_HOME, useSession } from "@/lib/auth/SessionProvider";
import { MealSplash } from "@/components/ui/MealSplash";

export default function RootPage() {
  const router = useRouter();
  const { isLoading, user } = useSession();

  useEffect(() => {
    if (isLoading) return;
    router.replace(user ? ROLE_HOME[user.role] : "/login");
  }, [isLoading, user, router]);

  // This page only ever redirects, so the splash covers the whole time it's
  // mounted — the app's first paint on a cold load.
  return <MealSplash />;
}

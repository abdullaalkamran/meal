"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ROLE_HOME, useSession } from "@/lib/auth/SessionProvider";

export default function RootPage() {
  const router = useRouter();
  const { isLoading, user } = useSession();

  useEffect(() => {
    if (isLoading) return;
    router.replace(user ? ROLE_HOME[user.role] : "/login");
  }, [isLoading, user, router]);

  return null;
}

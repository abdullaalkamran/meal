"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ROLE_HOME, useSession } from "@/lib/auth/SessionProvider";
import { Icon } from "@/components/ui/Icon";

export function ExploreHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const router = useRouter();
  const { viewRole, user } = useSession();
  const home = ROLE_HOME[viewRole ?? user?.role ?? "student"];

  return (
    <div className="flex items-center gap-3 pt-2">
      <button
        type="button"
        onClick={() => router.push(home)}
        aria-label="Back to home"
        className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-bg"
      >
        <Icon icon={ChevronLeft} size={18} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="text-[17.5px] font-extrabold tracking-tight">{title}</div>
        {subtitle && <div className="text-[10.5px] font-semibold text-text-secondary">{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

"use client";

import { ArrowLeft } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { useSession } from "@/lib/auth/SessionProvider";

/** Shown only when a manager is using "switch to my boarder view". */
export function BoarderViewBanner() {
  const { user, viewRole, setViewRole } = useSession();

  if (!user || user.role !== "manager" || viewRole !== "student") return null;

  return (
    <button
      type="button"
      onClick={() => setViewRole("manager")}
      className="mb-3 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-btn bg-blue-soft px-4 text-[11.5px] font-extrabold text-blue"
    >
      <Icon icon={ArrowLeft} size={16} />
      Viewing as boarder — back to manager view
    </button>
  );
}

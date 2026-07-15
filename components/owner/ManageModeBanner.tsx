"use client";

import { ArrowLeft, Crown } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { useSession } from "@/lib/auth/SessionProvider";

/** Shown only when an OWNER is managing one of their hostels through the
 * manager screens ("manage mode"). */
export function ManageModeBanner() {
  const { user, hostel, viewRole, setViewRole } = useSession();

  if (!user || user.role !== "owner" || viewRole !== "manager") return null;

  return (
    <button
      type="button"
      // Flipping viewRole back is enough — RoleGuard on the current manager
      // page redirects to the owner home itself (pushing a route here too
      // would race that redirect).
      onClick={() => setViewRole("owner")}
      className="mb-3 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-btn bg-[#7C6CF6]/10 px-4 text-[11.5px] font-extrabold text-[#7C6CF6]"
    >
      <Icon icon={Crown} size={15} />
      Managing {hostel?.name ?? "hostel"} as owner
      <span className="flex items-center gap-1 rounded-pill bg-[#7C6CF6] px-2.5 py-1 text-[10px] text-white">
        <Icon icon={ArrowLeft} size={12} /> Exit
      </span>
    </button>
  );
}

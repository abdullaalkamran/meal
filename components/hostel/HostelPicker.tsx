"use client";

import { useSession } from "@/lib/auth/SessionProvider";
import { useHostelsByOwner } from "@/hooks/useHostel";

/** Chip row for the OWNER's native pages: switches the active hostel while
 * staying in owner view (no manage mode). Renders nothing for single-hostel
 * owners only when `hideIfSingle` is set. */
export function HostelPicker({ hideIfSingle }: { hideIfSingle?: boolean }) {
  const { user, activeHostelId, switchHostel } = useSession();
  const hostels = useHostelsByOwner(user?.id);

  if (hideIfSingle && hostels.length <= 1) return null;

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
      {hostels.map((h) => (
        <button
          key={h.id}
          type="button"
          onClick={() => switchHostel(h.id)}
          className={`shrink-0 rounded-pill px-3.5 py-2 text-[11px] font-extrabold ${
            h.id === activeHostelId ? "bg-primary text-white" : "bg-card text-text-secondary shadow-chip"
          }`}
        >
          {h.name}
        </button>
      ))}
    </div>
  );
}

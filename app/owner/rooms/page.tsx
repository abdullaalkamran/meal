"use client";

import { HostelPicker } from "@/components/hostel/HostelPicker";
import { RoomsScreen } from "@/components/hostel/RoomsScreen";

/** Owner's native room management — full edit, no manage mode needed. */
export default function OwnerRoomsPage() {
  return (
    <div className="flex flex-col gap-4 pt-2">
      <HostelPicker />
      <RoomsScreen memberHref={(id) => `/owner/members/${id}`} />
    </div>
  );
}

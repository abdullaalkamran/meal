"use client";

import { HostelPicker } from "@/components/hostel/HostelPicker";
import { MembersScreen } from "@/components/hostel/MembersScreen";

/** Owner's native member management — full edit, no manage mode needed. */
export default function OwnerMembersPage() {
  return (
    <div className="flex flex-col gap-4 pt-2">
      <HostelPicker />
      <MembersScreen memberHref={(id) => `/owner/members/${id}`} />
    </div>
  );
}

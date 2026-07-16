"use client";

import { MembersScreen } from "@/components/hostel/MembersScreen";
import { PermissionGate } from "@/components/manager/PermissionGate";

// Owner-configured permission gate: real managers need the "members" flag.
export default function GatedManagerMembersPage() {
  return (
    <PermissionGate permission="members" label="Member management">
      <div className="pt-2">
        <MembersScreen memberHref={(id) => `/manager/members/${id}`} />
      </div>
    </PermissionGate>
  );
}

"use client";

import { MemberDetailScreen } from "@/components/hostel/MemberDetailScreen";
import { PermissionGate } from "@/components/manager/PermissionGate";

// Owner-configured permission gate: real managers need the "members" flag.
export default function GatedMemberProfilePage() {
  return (
    <PermissionGate permission="members" label="Member management">
      <div className="pt-2">
        <MemberDetailScreen listHref="/manager/members" />
      </div>
    </PermissionGate>
  );
}

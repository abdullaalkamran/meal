"use client";

import { MemberDetailScreen } from "@/components/hostel/MemberDetailScreen";

export default function OwnerMemberProfilePage() {
  return (
    <div className="pt-2">
      <MemberDetailScreen listHref="/owner/members" />
    </div>
  );
}

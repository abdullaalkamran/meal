"use client";

import { RoomsScreen } from "@/components/hostel/RoomsScreen";
import { PermissionGate } from "@/components/manager/PermissionGate";

// Owner-configured permission gate: real managers need the "rooms" flag.
export default function GatedManagerRoomsPage() {
  return (
    <PermissionGate permission="rooms" label="Room management">
      <div className="pt-2">
        <RoomsScreen memberHref={(id) => `/manager/members/${id}`} />
      </div>
    </PermissionGate>
  );
}

"use client";

import { PermissionGate } from "@/components/manager/PermissionGate";
import { FinanceScreen } from "@/components/hostel/FinanceScreen";

// Owner-configured permission gate: real managers need the "finance" flag.
export default function GatedManagerFinancePage() {
  return (
    <PermissionGate permission="finance" label="Finance">
      <FinanceScreen role="manager" />
    </PermissionGate>
  );
}

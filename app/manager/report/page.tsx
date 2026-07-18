"use client";

import { MealReportScreen } from "@/components/hostel/MealReportScreen";
import { PermissionGate } from "@/components/manager/PermissionGate";

// Full-roster financial data, so real managers need the owner-granted
// "finance" flag to see it.
export default function ManagerReportPage() {
  return (
    <PermissionGate permission="finance" label="Monthly report">
      <div className="pt-2">
        <MealReportScreen scope="all" />
      </div>
    </PermissionGate>
  );
}

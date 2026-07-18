"use client";

import { MealReportScreen } from "@/components/hostel/MealReportScreen";

/** A member sees only their own monthly settlement (plus the hostel-level
 * totals their numbers derive from). */
export default function StudentReportPage() {
  return (
    <div className="pt-2">
      <MealReportScreen scope="own" />
    </div>
  );
}

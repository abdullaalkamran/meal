"use client";

import { CookingCountScreen } from "@/components/hostel/CookingCountScreen";

export default function OwnerCookingCountPage() {
  return (
    <div className="pt-2">
      <CookingCountScreen readOnly />
    </div>
  );
}

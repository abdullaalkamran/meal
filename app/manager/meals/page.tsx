"use client";

import { MealsScreen } from "@/components/hostel/MealsScreen";

export default function ManagerMealsPage() {
  return (
    <div className="pt-2">
      <MealsScreen cookingCountHref="/manager/cooking-count" />
    </div>
  );
}

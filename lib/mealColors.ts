import { Moon, Sun, Sunrise, type LucideIcon } from "lucide-react";
import type { MealSlot } from "./data";

interface MealColor {
  icon: LucideIcon;
  text: string;
  bg: string;
  dot: string;
}

// Matches the prototype's consistent per-meal color coding: breakfast green,
// lunch orange, dinner purple — used across Home, Meals, and Menu screens.
export const MEAL_COLORS: Record<MealSlot, MealColor> = {
  breakfast: { icon: Sunrise, text: "text-[#16A34A]", bg: "bg-[#16A34A]/10", dot: "bg-[#16A34A]" },
  lunch: { icon: Sun, text: "text-orange", bg: "bg-orange-soft", dot: "bg-orange" },
  dinner: { icon: Moon, text: "text-[#7C6CF6]", bg: "bg-[#7C6CF6]/10", dot: "bg-[#7C6CF6]" },
};

export const MEAL_LABEL: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

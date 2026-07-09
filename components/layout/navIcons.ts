import {
  BarChart3,
  Building2,
  CheckCircle2,
  ChefHat,
  LayoutDashboard,
  Receipt,
  ShoppingCart,
  User,
  Users,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { IconKey } from "./navItems";

export const NAV_ICONS: Record<IconKey, LucideIcon> = {
  home: LayoutDashboard,
  meals: UtensilsCrossed,
  bill: Receipt,
  more: User,
  shopping: ShoppingCart,
  dashboard: LayoutDashboard,
  approvals: CheckCircle2,
  finance: Wallet,
  students: Users,
  overview: LayoutDashboard,
  hostels: Building2,
  reports: BarChart3,
  cook: ChefHat,
  salary: Wallet,
};

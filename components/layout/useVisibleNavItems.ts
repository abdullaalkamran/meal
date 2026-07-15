"use client";

import { useSession } from "@/lib/auth/SessionProvider";
import { hasManagerPermission, NAV_PERMISSION_BY_HREF } from "@/lib/auth/permissions";
import type { NavItem } from "./navItems";

/** Filters nav items per the session: manager tabs the owner has disabled
 * disappear for real managers, and the Meals tab is hidden from an owner in
 * manage mode (owners don't run day-to-day meal toggles). */
export function useVisibleNavItems(items: NavItem[]): NavItem[] {
  const { user, hostel } = useSession();

  return items.filter((item) => {
    if (item.href === "/manager/meals" && user?.role === "owner") return false;
    const permission = NAV_PERMISSION_BY_HREF[item.href];
    if (permission && !hasManagerPermission(user, hostel, permission)) return false;
    return true;
  });
}

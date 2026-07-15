// Manager-permission helpers — what a hostel's MANAGER may do, as configured
// by the owner in Hostel.settings.managerPermissions. Owners (including the
// owner using manage mode) always bypass these flags.

import type { Hostel, ManagerPermissions, User } from "@/lib/data";

export type ManagerPermissionKey = keyof ManagerPermissions;

export const DEFAULT_MANAGER_PERMISSIONS: ManagerPermissions = {
  rooms: true,
  members: true,
  approvals: true,
  finance: true,
  billing: true,
  menu: true,
  duties: true,
  announcements: true,
};

/** Labels + descriptions for the owner's permission sheet. */
export const PERMISSION_OPTIONS: { key: ManagerPermissionKey; label: string; hint: string }[] = [
  { key: "rooms", label: "Room management", hint: "Add/edit rooms, move & vacate members" },
  { key: "members", label: "Member management", hint: "Join requests, ban/remove, member details" },
  { key: "approvals", label: "Approvals inbox", hint: "Meal stops, guest meals, leave, payments" },
  { key: "finance", label: "Record expenses", hint: "Add and remove hostel expenses" },
  { key: "billing", label: "Generate bills", hint: "Create the monthly bills for boarders" },
  { key: "menu", label: "Edit menu", hint: "Change the day's dishes" },
  { key: "duties", label: "Create duty rotations", hint: "Shopping & cleaning rotations" },
  { key: "announcements", label: "Post announcements", hint: "Hostel-wide announcements" },
];

/** True when this user may use the capability in this hostel. Only actual
 * managers are restricted — owners and everyone else pass through (their
 * access is controlled by RoleGuard, not these flags). Missing flags mean
 * allowed, so older data stays permissive. */
export function hasManagerPermission(
  user: User | undefined,
  hostel: Hostel | undefined,
  key: ManagerPermissionKey
): boolean {
  if (!user || user.role !== "manager") return true;
  return hostel?.settings.managerPermissions?.[key] ?? true;
}

/** Nav hrefs that require a permission when the viewer is a real manager. */
export const NAV_PERMISSION_BY_HREF: Record<string, ManagerPermissionKey> = {
  "/manager/rooms": "rooms",
  "/manager/members": "members",
  "/manager/approvals": "approvals",
  "/manager/finance": "finance",
};

import type { Role } from "@/lib/data";

export type IconKey =
  | "home"
  | "meals"
  | "bill"
  | "more"
  | "dashboard"
  | "approvals"
  | "finance"
  | "students"
  | "overview"
  | "hostels"
  | "reports"
  | "cook";

export interface NavItem {
  href: string;
  label: string;
  iconKey: IconKey;
  badge?: number;
}

// Server Components (role layout.tsx files) hold this data, so icons are
// referenced by name here — the actual lucide-react component references
// only get resolved inside the client nav components (BottomNav/SideNav),
// since function values can't cross the server/client boundary as props.
export const NAV_ITEMS: Record<Role, NavItem[]> = {
  student: [
    { href: "/student", label: "Home", iconKey: "home" },
    { href: "/student/meals", label: "Meals", iconKey: "meals" },
    { href: "/student/bill", label: "Bill", iconKey: "bill" },
    { href: "/student/more", label: "More", iconKey: "more" },
  ],
  manager: [
    { href: "/manager", label: "Dashboard", iconKey: "dashboard" },
    { href: "/manager/meals", label: "Meals", iconKey: "meals" },
    { href: "/manager/approvals", label: "Approvals", iconKey: "approvals" },
    { href: "/manager/finance", label: "Finance", iconKey: "finance" },
    { href: "/manager/students", label: "Students", iconKey: "students" },
  ],
  owner: [
    { href: "/owner", label: "Overview", iconKey: "overview" },
    { href: "/owner/hostels", label: "Hostels", iconKey: "hostels" },
    { href: "/owner/reports", label: "Reports", iconKey: "reports" },
    { href: "/owner/more", label: "More", iconKey: "more" },
  ],
  cook: [{ href: "/cook", label: "Dashboard", iconKey: "cook" }],
};

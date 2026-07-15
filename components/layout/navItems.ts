import type { Role } from "@/lib/data";

export type IconKey =
  | "home"
  | "meals"
  | "bill"
  | "more"
  | "shopping"
  | "dashboard"
  | "approvals"
  | "finance"
  | "students"
  | "members"
  | "rooms"
  | "overview"
  | "hostels"
  | "reports"
  | "cook"
  | "salary"
  | "kpi"
  | "campaigns"
  | "catalog"
  | "community"
  | "store"
  | "studyabroad"
  | "duties"
  | "settings";

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
    { href: "/student/shopping", label: "Shopping", iconKey: "shopping" },
    { href: "/student/bill", label: "Bill", iconKey: "bill" },
    { href: "/student/more", label: "More", iconKey: "more" },
  ],
  manager: [
    { href: "/manager", label: "Dashboard", iconKey: "dashboard" },
    { href: "/manager/meals", label: "Meals", iconKey: "meals" },
    { href: "/manager/approvals", label: "Approvals", iconKey: "approvals" },
    { href: "/manager/finance", label: "Finance", iconKey: "finance" },
    { href: "/manager/members", label: "Members", iconKey: "members" },
    { href: "/manager/rooms", label: "Rooms", iconKey: "rooms" },
  ],
  owner: [
    { href: "/owner", label: "Overview", iconKey: "overview" },
    { href: "/owner/hostels", label: "Hostels", iconKey: "hostels" },
    { href: "/owner/duties", label: "Duties", iconKey: "duties" },
    { href: "/owner/reports", label: "Reports", iconKey: "reports" },
    { href: "/owner/more", label: "More", iconKey: "more" },
  ],
  cook: [
    { href: "/cook", label: "Dashboard", iconKey: "cook" },
    { href: "/cook/salary", label: "Salary", iconKey: "salary" },
  ],
  superadmin: [
    { href: "/admin", label: "Dashboard", iconKey: "dashboard" },
    { href: "/admin/hostels", label: "Hostels", iconKey: "hostels" },
    { href: "/admin/users", label: "Users", iconKey: "students" },
  ],
  marketing: [
    { href: "/marketing", label: "KPIs", iconKey: "kpi" },
    { href: "/marketing/campaigns", label: "Campaigns", iconKey: "campaigns" },
  ],
  service: [
    { href: "/service", label: "Catalog", iconKey: "catalog" },
    { href: "/service/store", label: "Store", iconKey: "store" },
    { href: "/service/orders", label: "Orders", iconKey: "bill" },
    { href: "/service/study-abroad", label: "Study", iconKey: "studyabroad" },
    { href: "/service/community", label: "Community", iconKey: "community" },
  ],
};

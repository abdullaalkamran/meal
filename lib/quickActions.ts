import {
  Ban,
  BedDouble,
  BookOpen,
  Briefcase,
  ChefHat,
  CreditCard,
  DoorOpen,
  GraduationCap,
  MessagesSquare,
  Plane,
  ShoppingBasket,
  ShoppingCart,
  Tag,
  TrendingUp,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

export type QuickActionTone = "danger" | "orange" | "primary" | "blue" | "violet";

interface QuickActionBase {
  key: string;
  label: string;
  icon: LucideIcon;
  tone: QuickActionTone;
}

interface QuickActionSheet extends QuickActionBase {
  href?: undefined;
  /** Marketplace/explore tile the Super Admin can enable/disable per
   * location (see app/admin/services/page.tsx). Core hostel actions
   * (meal request, pay bill, …) are never gated this way. */
  quickService?: false;
}

interface QuickActionLink extends QuickActionBase {
  href: string;
  quickService?: boolean;
}

export type QuickAction = QuickActionSheet | QuickActionLink;

/** The member home page's "Quick actions" grid. Kept in one shared place so
 * the Super Admin's per-location enable/disable screen (app/admin/services)
 * always lists exactly what members see — never a drifted duplicate. */
export const QUICK_ACTIONS: QuickAction[] = [
  { key: "stop", label: "Meal request", icon: Ban, tone: "danger" },
  { key: "guest", label: "Guest meal", icon: UserPlus, tone: "orange" },
  { key: "leave", label: "Leave hostel", icon: DoorOpen, tone: "orange" },
  { key: "pay", label: "Pay bill", icon: CreditCard, tone: "primary", href: "/student/bill" },
  { key: "shopping", label: "Shopping", icon: ShoppingCart, tone: "blue", href: "/student/shopping" },
  { key: "grocery", label: "Grocery", icon: ShoppingBasket, tone: "primary", href: "/explore/grocery", quickService: true },
  { key: "jobs", label: "Find Job", icon: Briefcase, tone: "primary", href: "/explore/jobs", quickService: true },
  { key: "learning", label: "Learning", icon: GraduationCap, tone: "blue", href: "/explore/learning", quickService: true },
  { key: "studyAbroad", label: "Study abroad", icon: Plane, tone: "violet", href: "/explore/study-abroad", quickService: true },
  { key: "investment", label: "Investment", icon: TrendingUp, tone: "primary", href: "/explore/investment", quickService: true },
  { key: "books", label: "Buy Books", icon: BookOpen, tone: "orange", href: "/explore/books", quickService: true },
  { key: "findHostel", label: "Find Hostel", icon: BedDouble, tone: "violet", href: "/explore/hostels", quickService: true },
  { key: "findCook", label: "Find Cook", icon: ChefHat, tone: "orange", href: "/explore/cooks", quickService: true },
  { key: "offers", label: "Shop offer", icon: Tag, tone: "blue", href: "/explore/offers", quickService: true },
  { key: "community", label: "Community", icon: MessagesSquare, tone: "primary", href: "/explore/community", quickService: true },
];

/** The subset the Super Admin can toggle/restrict by location. */
export const QUICK_SERVICE_ACTIONS = QUICK_ACTIONS.filter((a) => a.quickService);

export const QUICK_ACTION_TONE_CLASSES: Record<QuickActionTone, string> = {
  danger: "bg-danger-soft text-danger",
  orange: "bg-orange-soft text-orange",
  primary: "bg-primary-soft text-primary",
  blue: "bg-blue-soft text-blue",
  violet: "bg-[#7C6CF6]/10 text-[#7C6CF6]",
};

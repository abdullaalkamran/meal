"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BedDouble,
  Bell,
  BookOpen,
  Briefcase,
  ChevronRight,
  ChefHat,
  Coffee,
  FileText,
  GraduationCap,
  Maximize2,
  Megaphone,
  MessagesSquare,
  Plane,
  Receipt,
  ShoppingBasket,
  ShoppingCart,
  Sparkles,
  Tag,
  TrendingUp,
  User as UserIcon,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { hasManagerPermission, type ManagerPermissionKey } from "@/lib/auth/permissions";
import { useMealDay } from "@/hooks/useMealDay";
import { useCookLeaveRequests } from "@/hooks/useCookLeaveRequests";
import { useMealStops } from "@/hooks/useMealStops";
import { useGuestMeals } from "@/hooks/useGuestMeals";
import { useRooms } from "@/hooks/useRooms";
import { useBill } from "@/hooks/useBill";
import { useShortages } from "@/hooks/useShortages";
import { usePendingApprovalsCount } from "@/hooks/usePendingApprovalsCount";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { AddExpenseSheet } from "@/components/manager/AddExpenseSheet";
import { AnnounceSheet } from "@/components/manager/AnnounceSheet";
import { repo, type MealSlot, type ShoppingCost, type User } from "@/lib/data";
import { MEAL_LABEL } from "@/lib/mealColors";
import { formatBDT } from "@/lib/utils/currency";
import { currentMonth, formatMonthLabel, greeting, today } from "@/lib/utils/date";
import { useActualMealRate } from "@/hooks/useActualMealRate";
import { useMemberMealSummary } from "@/hooks/useMemberMealSummary";
import { useNotifications } from "@/hooks/useNotifications";
import { useQuickServices } from "@/hooks/useQuickServices";
import { isAvailableAt } from "@/lib/geo/bangladesh";

const QUICK_ACTIONS = [
  { key: "expense", label: "Record expense", icon: Wallet, tone: "bg-primary-soft text-primary" },
  { key: "announce", label: "Announce", icon: Megaphone, tone: "bg-blue-soft text-blue" },
  {
    key: "menu",
    label: "Update menu",
    icon: UtensilsCrossed,
    tone: "bg-orange-soft text-orange",
    href: "/manager/menu/edit",
  },
  {
    key: "bills",
    label: "Generate bills",
    icon: Receipt,
    tone: "bg-[#7C6CF6]/10 text-[#7C6CF6]",
    href: "/manager/finance",
  },
  {
    key: "report",
    label: "Monthly report",
    icon: FileText,
    tone: "bg-primary-soft text-primary",
    href: "/manager/report",
  },
  {
    key: "shopDuty",
    label: "Shopping duty",
    icon: ShoppingCart,
    tone: "bg-orange-soft text-orange",
    href: "/manager/duty/shopping",
  },
  {
    key: "cleanDuty",
    label: "Cleaning duty",
    icon: Sparkles,
    tone: "bg-blue-soft text-blue",
    href: "/manager/duty/cleaning",
  },
  { key: "grocery", label: "Grocery", icon: ShoppingBasket, tone: "bg-primary-soft text-primary", href: "/explore/grocery", quickService: true },
  { key: "jobs", label: "Find Job", icon: Briefcase, tone: "bg-primary-soft text-primary", href: "/explore/jobs", quickService: true },
  { key: "learning", label: "Learning", icon: GraduationCap, tone: "bg-blue-soft text-blue", href: "/explore/learning", quickService: true },
  { key: "studyAbroad", label: "Study abroad", icon: Plane, tone: "bg-[#7C6CF6]/10 text-[#7C6CF6]", href: "/explore/study-abroad", quickService: true },
  { key: "investment", label: "Investment", icon: TrendingUp, tone: "bg-primary-soft text-primary", href: "/explore/investment", quickService: true },
  { key: "books", label: "Buy Books", icon: BookOpen, tone: "bg-orange-soft text-orange", href: "/explore/books", quickService: true },
  { key: "findHostel", label: "Find Hostel", icon: BedDouble, tone: "bg-[#7C6CF6]/10 text-[#7C6CF6]", href: "/explore/hostels", quickService: true },
  { key: "findCook", label: "Find Cook", icon: ChefHat, tone: "bg-orange-soft text-orange", href: "/explore/cooks", quickService: true },
  { key: "offers", label: "Shopping offer", icon: Tag, tone: "bg-blue-soft text-blue", href: "/explore/offers", quickService: true },
  { key: "community", label: "Hostel community", icon: MessagesSquare, tone: "bg-primary-soft text-primary", href: "/explore/community", quickService: true },
] as const;

// Quick actions that need an owner-granted permission when the viewer is a
// real manager (owners in manage mode always see everything).
const ACTION_PERMISSION: Partial<Record<(typeof QUICK_ACTIONS)[number]["key"], ManagerPermissionKey>> = {
  expense: "finance",
  report: "finance",
  announce: "announcements",
  menu: "menu",
  bills: "billing",
  shopDuty: "duties",
  cleanDuty: "duties",
};

export default function ManagerDashboardPage() {
  const { user, hostel, activeHostelId, setViewRole } = useSession();
  const actualRate = useActualMealRate(activeHostelId);
  const myNotifications = useNotifications(user?.id);
  const hasUnread = myNotifications.some((n) => !n.read);
  // Super Admin's per-quick-action enable/disable + location restriction —
  // "restrictions only ever narrow": a key missing from settings, or with no
  // areas set, stays visible everywhere. Same rule the student home page
  // applies; this dashboard just never checked it before.
  const quickServiceSettings = useQuickServices();
  const visibleActions = QUICK_ACTIONS.filter((a) => {
    const permission = ACTION_PERMISSION[a.key];
    if (permission && !hasManagerPermission(user, hostel, permission)) return false;
    if ("quickService" in a && a.quickService) {
      const s = quickServiceSettings[a.key];
      return (s?.enabled ?? true) && isAvailableAt(s?.areas, hostel?.address);
    }
    return true;
  });
  const { day } = useMealDay(activeHostelId, today());
  const cookLeaveRequests = useCookLeaveRequests(activeHostelId);
  const mealStops = useMealStops(activeHostelId);
  const guestMeals = useGuestMeals(activeHostelId);
  const shortages = useShortages(activeHostelId);
  const rooms = useRooms(activeHostelId);
  const { bill } = useBill(activeHostelId, user?.id, currentMonth());
  const myMealSummary = useMemberMealSummary(activeHostelId, user?.id);
  const [expenseSheetOpen, setExpenseSheetOpen] = useState(false);
  const [announceSheetOpen, setAnnounceSheetOpen] = useState(false);
  const [pendingPayments, setPendingPayments] = useState(0);
  const [shopper, setShopper] = useState<User | undefined>(undefined);
  const [todaysShoppingCost, setTodaysShoppingCost] = useState<ShoppingCost | undefined>(undefined);
  // Locks the cook-leave card while its decide() call is in flight — without
  // this, a double-click could re-apply an already-decided request.
  const [decidingCookLeave, setDecidingCookLeave] = useState(false);

  const myEntry = user && day?.entries[user.id];
  const myMealsOnCount = myEntry
    ? [myEntry.breakfast.on, myEntry.lunch.on, myEntry.dinner.on].filter(Boolean).length
    : 0;
  const myRoom = rooms.find((r) => r.id === user?.roomId);
  const myDue = bill ? bill.grandTotal - bill.paid : 0;

  const pendingCookLeave = cookLeaveRequests.find((r) => r.status === "pending");
  const pendingShortages = shortages.filter((s) => s.status === "pending");
  const pendingStops = mealStops.filter((r) => r.status === "pending").length;
  const pendingGuests = guestMeals.filter((r) => r.status === "pending").length;
  // The true total across every approval category (same count the
  // Approvals page and nav badge show) — not just the 3 highlighted below.
  const pendingTotal = usePendingApprovalsCount(activeHostelId);

  useEffect(() => {
    if (!activeHostelId) return;
    repo.bills
      .listPendingVerification(activeHostelId, currentMonth())
      .then((list) => setPendingPayments(list.length));
  }, [activeHostelId]);

  useEffect(() => {
    if (!day?.shoppingUserId) {
      queueMicrotask(() => setShopper(undefined));
      return;
    }
    repo.users.getUser(day.shoppingUserId).then(setShopper);
  }, [day?.shoppingUserId]);

  useEffect(() => {
    if (!activeHostelId) return;
    repo.shoppingCosts
      .listByHostel(activeHostelId)
      .then((list) => setTodaysShoppingCost(list.find((c) => c.dates.includes(today()))));
  }, [activeHostelId]);

  const cookingCounts = (["breakfast", "lunch", "dinner"] as MealSlot[]).map((meal) => {
    const entries = day ? Object.values(day.entries) : [];
    const count = entries.reduce((sum, e) => sum + ((e[meal].on ? 1 : 0) + e[meal].guestCount), 0);
    const guestCount = entries.reduce((sum, e) => sum + e[meal].guestCount, 0);
    return { meal, count, guestCount };
  });
  const totalToCook = cookingCounts.reduce((sum, c) => sum + c.count, 0);
  const totalGuests = cookingCounts.reduce((sum, c) => sum + c.guestCount, 0);

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold text-text-secondary">{greeting()}</div>
          <div className="flex items-center gap-2">
            <div className="text-[17.5px] font-extrabold tracking-tight">{user?.name}</div>
            <Chip tone="blue" active>
              Manager
            </Chip>
            {myRoom && (
              <Chip tone="primary" active>
                Boarder · Room {myRoom.number}
              </Chip>
            )}
          </div>
          <div className="text-[10.5px] font-semibold text-text-secondary">
            Managing {hostel?.name}
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/manager/notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card shadow-chip"
          >
            <Icon icon={Bell} size={18} />
            {hasUnread && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger" />}
          </Link>
          <Avatar name={user?.name ?? ""} seed={user?.avatarSeed} photo={user?.avatarImage} size={40} />
        </div>
      </div>

      {/* Today's cooking hero */}
      <div
        className="rounded-card p-5 text-white"
        style={{ background: "linear-gradient(135deg, var(--color-primary), #0a8f86)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[12.5px] font-extrabold">Today&rsquo;s cooking</div>
            <div className="text-[10px] font-semibold text-white/70">
              Send final count to the cook
            </div>
          </div>
          <Link
            href="/manager/cooking-count"
            className="flex items-center gap-1 rounded-pill bg-white/15 px-3 py-1.5 text-[10.5px] font-extrabold"
          >
            Adjust
            <Icon icon={ChevronRight} size={14} />
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {cookingCounts.map((c) => (
            <div key={c.meal} className="rounded-btn bg-white/15 p-2.5 text-center">
              <div className="text-[16.5px] font-extrabold leading-none">{c.count}</div>
              <div className="mt-1 text-[9.5px] font-bold text-white/75">{MEAL_LABEL[c.meal]}</div>
            </div>
          ))}
          <div className="rounded-btn bg-white/25 p-2.5 text-center">
            <div className="text-[16.5px] font-extrabold leading-none">{totalToCook}</div>
            <div className="mt-1 text-[9.5px] font-bold text-white/85">Total</div>
          </div>
        </div>
        {totalGuests > 0 && (
          <div className="mt-2 text-[9.5px] font-semibold text-white/70">
            Incl. {totalGuests} guest meal{totalGuests > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Shortage alerts from the cook */}
      {pendingShortages.length > 0 && (
        <div className="flex flex-col gap-2">
          {pendingShortages.map((s) => (
            <div
              key={s.id}
              className="rounded-card border border-danger/30 bg-danger-soft p-4"
            >
              <div className="mb-1 flex items-center gap-2">
                <Icon icon={AlertTriangle} size={16} className="text-danger" />
                <div className="text-[12.5px] font-extrabold text-danger">Shopping shortage reported</div>
              </div>
              <div className="text-[11.5px] font-semibold text-text">{s.items}</div>
            </div>
          ))}
        </div>
      )}

      {/* Cook leave request */}
      {pendingCookLeave && (
        <Card>
          <div className="mb-2 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-soft text-orange">
              <Icon icon={Coffee} size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-extrabold">Cook leave request</div>
            </div>
            <Chip tone="orange" active>
              Pending
            </Chip>
          </div>
          <div className="mb-2 rounded-btn bg-bg p-3">
            <div className="text-[11.5px] font-extrabold">
              {pendingCookLeave.scope === "full-day" ? "Full day" : pendingCookLeave.meals?.map((m) => MEAL_LABEL[m]).join(" & ")}
            </div>
            <div className="text-[10px] font-semibold text-text-secondary">
              {pendingCookLeave.dateFrom} → {pendingCookLeave.dateTo} · {pendingCookLeave.reason}
            </div>
          </div>
          <div className="mb-3 text-[9.5px] font-semibold text-text-secondary">
            {pendingCookLeave.scope === "full-day"
              ? "Approving turns off all meals for all boarders."
              : "Approving turns off the selected meals for all boarders."}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={decidingCookLeave}
              onClick={async () => {
                if (!user) return;
                setDecidingCookLeave(true);
                try {
                  await repo.cookLeave.decide(pendingCookLeave.id, "approved", user.id);
                } finally {
                  setDecidingCookLeave(false);
                }
              }}
              className="min-h-11 flex-1 cursor-pointer rounded-btn bg-primary text-[12.5px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Approve leave
            </button>
            <button
              type="button"
              disabled={decidingCookLeave}
              onClick={async () => {
                if (!user) return;
                setDecidingCookLeave(true);
                try {
                  await repo.cookLeave.decide(pendingCookLeave.id, "denied", user.id);
                } finally {
                  setDecidingCookLeave(false);
                }
              }}
              className="min-h-11 flex-1 cursor-pointer rounded-btn border border-border text-[12.5px] font-extrabold disabled:cursor-not-allowed disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </Card>
      )}

      {/* Pending Approvals */}
      <Link href="/manager/approvals">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[13.5px] font-extrabold">Pending approvals</div>
            <div className="rounded-pill bg-danger-soft px-2.5 py-1 text-[9.5px] font-extrabold text-danger">
              {pendingTotal} pending
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-btn bg-bg p-2.5 text-center">
              <div className="text-[16px] font-extrabold">{pendingStops}</div>
              <div className="text-[9px] font-bold text-text-secondary">Meal stops</div>
            </div>
            <div className="rounded-btn bg-bg p-2.5 text-center">
              <div className="text-[16px] font-extrabold">{pendingGuests}</div>
              <div className="text-[9px] font-bold text-text-secondary">Guest meals</div>
            </div>
            <div className="rounded-btn bg-bg p-2.5 text-center">
              <div className="text-[16px] font-extrabold">{pendingPayments}</div>
              <div className="text-[9px] font-bold text-text-secondary">Payments</div>
            </div>
          </div>
        </Card>
      </Link>

      {/* My boarder account */}
      <Card>
        <div className="mb-3 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-bg text-text-secondary">
            <Icon icon={UserIcon} size={15} />
          </div>
          <div>
            <div className="text-[12.5px] font-extrabold">My boarder account</div>
            <div className="text-[10px] font-semibold text-text-secondary">
              {myRoom ? `Room ${myRoom.number}` : "Unassigned"} · you eat here too
            </div>
          </div>
        </div>
        <div className="mb-3 grid grid-cols-3 gap-2">
          <div className="rounded-btn bg-bg p-2.5 text-center">
            <div className="text-[9px] font-bold text-text-secondary">TODAY</div>
            <div className="text-[12.5px] font-extrabold">{myMealsOnCount} of 3 on</div>
          </div>
          <div className="rounded-btn bg-bg p-2.5 text-center">
            <div className="text-[9px] font-bold text-text-secondary">MY MEALS</div>
            <div className="text-[12.5px] font-extrabold">{myMealSummary?.mealsOn ?? bill?.mealsCount ?? 0}</div>
          </div>
          <div className="rounded-btn bg-bg p-2.5 text-center">
            <div className="text-[9px] font-bold text-text-secondary">MY DUE</div>
            <div className="text-[12.5px] font-extrabold text-danger">{formatBDT(myDue)}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setViewRole("student")}
          className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-btn border border-border text-[12px] font-extrabold"
        >
          <Icon icon={Maximize2} size={14} />
          Switch to my boarder view
        </button>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <div className="text-[9.5px] font-bold text-text-secondary">Today&rsquo;s shopping</div>
          <div className="mt-1 text-[15px] font-extrabold">
            {todaysShoppingCost ? formatBDT(todaysShoppingCost.amount) : "—"}
          </div>
          <div className="text-[9.5px] font-semibold text-text-secondary">
            {shopper ? `by ${shopper.name.split(" ")[0]}` : "Not assigned"}
          </div>
        </Card>
        <Card>
          <div className="text-[9.5px] font-bold text-text-secondary">
            Actual rate/meal ({formatMonthLabel(currentMonth()).split(" ")[0].slice(0, 3)})
          </div>
          <div className="mt-1 text-[15px] font-extrabold">{formatBDT(actualRate.rate)}</div>
        </Card>
      </div>

      {/* Quick actions */}
      <div>
        <div className="mb-2 text-[13.5px] font-extrabold">Quick actions</div>
        <div className="grid grid-cols-2 gap-2.5">
          {visibleActions.map((action) => {
            const content = (
              <div className="flex items-center gap-3 rounded-card border border-border bg-card px-4 py-3.5 shadow-chip">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${action.tone}`}>
                  <Icon icon={action.icon} size={17} />
                </div>
                <div className="text-[11.5px] font-extrabold leading-tight">{action.label}</div>
              </div>
            );
            if ("href" in action) {
              return (
                <Link key={action.key} href={action.href}>
                  {content}
                </Link>
              );
            }
            return (
              <button
                key={action.key}
                type="button"
                onClick={() => {
                  if (action.key === "expense") {
                    setExpenseSheetOpen(true);
                  } else {
                    setAnnounceSheetOpen(true);
                  }
                }}
                className="cursor-pointer text-left"
              >
                {content}
              </button>
            );
          })}
        </div>
      </div>

      <AddExpenseSheet
        open={expenseSheetOpen}
        onClose={() => setExpenseSheetOpen(false)}
        hostelId={activeHostelId}
        month={currentMonth()}
      />
      <AnnounceSheet
        open={announceSheetOpen}
        onClose={() => setAnnounceSheetOpen(false)}
        hostelId={activeHostelId}
      />
    </div>
  );
}

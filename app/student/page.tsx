"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Ban,
  BedDouble,
  Bell,
  BookOpen,
  Briefcase,
  ChefHat,
  ChevronRight,
  CreditCard,
  GraduationCap,
  Megaphone,
  MessagesSquare,
  Plane,
  ShoppingBasket,
  ShoppingCart,
  Tag,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useMealDay } from "@/hooks/useMealDay";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { useDutyPlans } from "@/hooks/useDutyPlans";
import { useBill } from "@/hooks/useBill";
import { useMenu } from "@/hooks/useMenu";
import { useRooms } from "@/hooks/useRooms";
import { useNotifications } from "@/hooks/useNotifications";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { StopMealSheet } from "@/components/student/StopMealSheet";
import { GuestMealSheet } from "@/components/student/GuestMealSheet";
import { AnnouncementItem } from "@/components/student/AnnouncementItem";
import { MEAL_COLORS, MEAL_LABEL } from "@/lib/mealColors";
import { formatBDT } from "@/lib/utils/currency";
import { today, currentMonth, greeting, formatDayMonth, formatMonthLabel } from "@/lib/utils/date";
import type { MealSlot } from "@/lib/data";

const QUICK_ACTIONS = [
  { key: "stop", label: "Stop meal", icon: Ban, tone: "danger" as const },
  { key: "guest", label: "Guest meal", icon: UserPlus, tone: "orange" as const },
  { key: "pay", label: "Pay bill", icon: CreditCard, tone: "primary" as const, href: "/student/bill" },
  { key: "shopping", label: "Shopping", icon: ShoppingCart, tone: "blue" as const, href: "/student/shopping" },
  { key: "grocery", label: "Grocery", icon: ShoppingBasket, tone: "primary" as const, href: "/explore/grocery" },
  { key: "jobs", label: "Find Job", icon: Briefcase, tone: "primary" as const, href: "/explore/jobs" },
  { key: "learning", label: "Learning", icon: GraduationCap, tone: "blue" as const, href: "/explore/learning" },
  { key: "studyAbroad", label: "Study abroad", icon: Plane, tone: "violet" as const, href: "/explore/study-abroad" },
  { key: "investment", label: "Investment", icon: TrendingUp, tone: "primary" as const, href: "/explore/investment" },
  { key: "books", label: "Buy Books", icon: BookOpen, tone: "orange" as const, href: "/explore/books" },
  { key: "findHostel", label: "Find Hostel", icon: BedDouble, tone: "violet" as const, href: "/explore/hostels" },
  { key: "findCook", label: "Find Cook", icon: ChefHat, tone: "orange" as const, href: "/explore/cooks" },
  { key: "offers", label: "Shop offer", icon: Tag, tone: "blue" as const, href: "/explore/offers" },
  { key: "community", label: "Community", icon: MessagesSquare, tone: "primary" as const, href: "/explore/community" },
] as const;

const TONE_CLASSES = {
  danger: "bg-danger-soft text-danger",
  orange: "bg-orange-soft text-orange",
  primary: "bg-primary-soft text-primary",
  blue: "bg-blue-soft text-blue",
  violet: "bg-[#7C6CF6]/10 text-[#7C6CF6]",
};

export default function StudentHomePage() {
  const { user, hostel, activeHostelId } = useSession();
  const { day } = useMealDay(activeHostelId, today());
  const announcements = useAnnouncements(activeHostelId);
  const plans = useDutyPlans(activeHostelId);
  const { bill } = useBill(activeHostelId, user?.id, currentMonth());
  const menu = useMenu(activeHostelId, today());
  const rooms = useRooms(activeHostelId);
  const notifications = useNotifications(user?.id);
  const [sheet, setSheet] = useState<"stop" | "guest" | null>(null);
  const { toast } = useToast();

  const myEntry = user && day?.entries[user.id];
  const myRoom = rooms.find((r) => r.id === user?.roomId);
  const unread = notifications.some((n) => !n.read);
  const due = bill ? bill.grandTotal - bill.paid : 0;

  const myPlan = plans.find((p) => p.type === "shopping" && p.memberIds.includes(user?.id ?? ""));
  const myBlock = myPlan?.blocks.find((b) => b.userIds.includes(user?.id ?? ""));

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold text-text-secondary">{greeting()}</div>
          <div className="text-[19px] font-extrabold tracking-tight">{user?.name.split(" ")[0]}</div>
          <div className="text-[10.5px] font-semibold text-text-secondary">
            {hostel?.name} · {myRoom ? `Room ${myRoom.number}` : "Unassigned"}
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/student/notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card shadow-chip"
          >
            <Icon icon={Bell} size={18} />
            {unread && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger" />
            )}
          </Link>
          <Avatar name={user?.name ?? ""} seed={user?.avatarSeed} size={40} />
        </div>
      </div>

      {/* Hero: current bill summary */}
      <Link href="/student/bill">
        <div
          className="rounded-card p-5 text-white"
          style={{
            background:
              "linear-gradient(135deg, var(--gradient-accent-from), var(--gradient-accent-to))",
          }}
        >
          <div className="mb-1 flex items-center justify-between">
            <div className="text-[11.5px] font-bold text-white/80">
              Current bill · {formatMonthLabel(currentMonth()).split(" ")[0]}
            </div>
            <Icon icon={ChevronRight} size={18} />
          </div>
          <div className="mb-3 flex items-center gap-2.5">
            <div className="text-[22px] font-extrabold">{formatBDT(bill?.grandTotal ?? 0)}</div>
            {due > 0 && (
              <div className="rounded-pill bg-danger px-2.5 py-1 text-[10px] font-extrabold">
                {formatBDT(due)} Outstanding
              </div>
            )}
          </div>
          <div className="flex gap-6 border-t border-white/20 pt-3">
            <div>
              <div className="text-[9.5px] font-bold text-white/60">Meals</div>
              <div className="text-[12.5px] font-extrabold">{bill?.mealsCount ?? "—"}</div>
            </div>
            <div>
              <div className="text-[9.5px] font-bold text-white/60">Meal rate</div>
              <div className="text-[12.5px] font-extrabold">{formatBDT(hostel?.mealRate ?? 0)}</div>
            </div>
            <div>
              <div className="text-[9.5px] font-bold text-white/60">Paid</div>
              <div className="text-[12.5px] font-extrabold">{formatBDT(bill?.paid ?? 0)}</div>
            </div>
          </div>
        </div>
      </Link>

      {/* Announcements */}
      {announcements.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn bg-[#7C6CF6]/10 text-[#7C6CF6]">
                <Icon icon={Megaphone} size={20} />
              </div>
              <div>
                <div className="text-[16px] font-extrabold leading-tight">Announcements</div>
                <div className="text-[10.5px] font-semibold text-text-secondary">
                  Stay updated with important hostel news
                </div>
              </div>
            </div>
            <Link
              href="/student/notifications"
              className="flex shrink-0 items-center gap-0.5 text-[11.5px] font-extrabold text-[#7C6CF6]"
            >
              View all
              <Icon icon={ChevronRight} size={15} />
            </Link>
          </div>

          <div className="flex flex-col gap-3">
            {announcements.slice(0, 3).map((a) => (
              <AnnouncementItem key={a.id} announcement={a} userId={user?.id} />
            ))}
          </div>

          <button
            type="button"
            onClick={() => toast("Notification preferences — coming in a later build phase")}
            className="mt-3 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-pill bg-[#7C6CF6]/10 text-[11.5px] font-extrabold text-[#7C6CF6]"
          >
            <Icon icon={Bell} size={15} />
            Manage notification preferences
          </button>
        </div>
      )}

      {/* Today's meals + menu */}
      <Card>
        <div className="mb-0.5 flex items-center justify-between">
          <div className="text-[13.5px] font-extrabold">Today&rsquo;s meals</div>
          <Link href="/student/meals" className="flex items-center gap-0.5 text-[11px] font-extrabold text-primary">
            Calendar
            <Icon icon={ChevronRight} size={14} />
          </Link>
        </div>
        <div className="mb-3 text-[10.5px] font-semibold text-text-secondary">
          {formatDayMonth(today())}
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          {(["breakfast", "lunch", "dinner"] as MealSlot[]).map((meal) => {
            const on = myEntry?.[meal].on ?? true;
            const c = MEAL_COLORS[meal];
            return (
              <div key={meal} className="flex flex-col items-center gap-1.5 rounded-btn bg-bg py-3">
                <Icon icon={c.icon} size={18} className={c.text} />
                <div className="text-[10.5px] font-extrabold">{MEAL_LABEL[meal]}</div>
                <div className="flex items-center gap-1">
                  <span className={`h-1.5 w-1.5 rounded-full ${on ? c.dot : "bg-border"}`} />
                  <span className="text-[9.5px] font-bold text-text-secondary">
                    {on ? "On" : "Off"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mb-2 flex items-center justify-between border-t border-border pt-3">
          <div className="text-[10px] font-bold text-text-secondary">Menu</div>
          <Link href="/student/menu" className="text-[11px] font-extrabold text-primary">
            View Menu
          </Link>
        </div>
        <div className="flex flex-col gap-1">
          {(["breakfast", "lunch", "dinner"] as MealSlot[]).map((meal) => (
            <div key={meal} className="flex gap-2 text-[11px]">
              <div className={`w-16 shrink-0 font-extrabold ${MEAL_COLORS[meal].text}`}>
                {MEAL_LABEL[meal]}
              </div>
              <div className="font-semibold text-text-secondary">
                {menu?.dishes[meal]?.join(" · ") || "—"}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Quick actions */}
      <div>
        <div className="mb-2 text-[13.5px] font-extrabold">Quick actions</div>
        <div className="grid grid-cols-4 gap-2.5">
          {QUICK_ACTIONS.map((action) => {
            const content = (
              <div className="flex flex-col items-center gap-2 rounded-card border border-border bg-card py-3.5 shadow-chip">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full ${TONE_CLASSES[action.tone]}`}>
                  <Icon icon={action.icon} size={17} />
                </div>
                <div className="text-center text-[9.5px] font-bold leading-tight">{action.label}</div>
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
              <button key={action.key} type="button" onClick={() => setSheet(action.key)} className="cursor-pointer">
                {content}
              </button>
            );
          })}
        </div>
      </div>

      {/* Shopping duty teaser */}
      {myPlan && (
        <Link href="/student/shopping">
          <Card className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-soft text-orange">
              <Icon icon={ShoppingCart} size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-extrabold">Your shopping duty</div>
              <div className="text-[10.5px] font-semibold text-text-secondary">
                {myPlan.spun[user?.id ?? ""] && myBlock
                  ? `${myBlock.dates[0]}${myBlock.dates.length > 1 ? ` → ${myBlock.dates.at(-1)}` : ""}`
                  : "Spin the wheel to reveal your dates"}
              </div>
            </div>
            <Icon icon={ChevronRight} size={16} className="text-text-secondary" />
          </Card>
        </Link>
      )}

      <StopMealSheet open={sheet === "stop"} onClose={() => setSheet(null)} hostelId={activeHostelId} userId={user?.id} />
      <GuestMealSheet open={sheet === "guest"} onClose={() => setSheet(null)} hostelId={activeHostelId} userId={user?.id} />
    </div>
  );
}

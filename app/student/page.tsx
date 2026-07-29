"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Ban,
  BarChart3,
  BedDouble,
  Bell,
  BookOpen,
  Briefcase,
  CalendarDays,
  ChefHat,
  ChevronRight,
  CreditCard,
  DoorOpen,
  GraduationCap,
  Leaf,
  Megaphone,
  MessagesSquare,
  Plane,
  ShoppingBasket,
  ShoppingCart,
  Tag,
  TrendingUp,
  UserPlus,
  Users,
  Utensils,
} from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useMealDay } from "@/hooks/useMealDay";
import { useActionableAnnouncements } from "@/hooks/useActionableAnnouncements";
import { useDutyPlans } from "@/hooks/useDutyPlans";
import { useBill } from "@/hooks/useBill";
import { useMenu } from "@/hooks/useMenu";
import { useRooms } from "@/hooks/useRooms";
import { useNotifications } from "@/hooks/useNotifications";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { MealRequestSheet } from "@/components/student/MealRequestSheet";
import { GuestMealSheet } from "@/components/student/GuestMealSheet";
import { LeaveRequestSheet } from "@/components/student/LeaveRequestSheet";
import { AnnouncementItem } from "@/components/student/AnnouncementItem";
import { NotificationItem } from "@/components/student/NotificationItem";
import { NotificationPrefsSheet } from "@/components/student/NotificationPrefsSheet";
import { HomeHero } from "@/components/student/HomeHero";
import { MEAL_COLORS, MEAL_LABEL } from "@/lib/mealColors";
import { today, currentMonth, greeting, formatDayMonth } from "@/lib/utils/date";
import { formatBDT } from "@/lib/utils/currency";
import { repo, type MealSlot } from "@/lib/data";
import { useActualMealRate } from "@/hooks/useActualMealRate";

const QUICK_ACTIONS = [
  { key: "stop", label: "Meal request", icon: Ban, tone: "danger" as const },
  { key: "guest", label: "Guest meal", icon: UserPlus, tone: "orange" as const },
  { key: "leave", label: "Leave hostel", icon: DoorOpen, tone: "orange" as const },
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
  const actualRate = useActualMealRate(activeHostelId);
  const { day } = useMealDay(activeHostelId, today());
  // Only what still needs THIS user's attention — voted polls and
  // resolved shortages/swaps drop out here but stay visible in the full
  // history on the notifications page.
  const announcements = useActionableAnnouncements(activeHostelId, user?.id);
  const plans = useDutyPlans(activeHostelId);
  const { bill } = useBill(activeHostelId, user?.id, currentMonth());
  // This month's own meal count, live — so the hero shows it before any bill
  // is generated (the bill's mealsCount is 0 until then).
  const [mealsOn, setMealsOn] = useState<number | null>(null);
  useEffect(() => {
    if (!activeHostelId || !user) return;
    const load = () =>
      repo.meals.getMemberMealSummary(activeHostelId, user.id, currentMonth()).then((s) => setMealsOn(s.mealsOn));
    load();
    return repo.meals.subscribe(activeHostelId, load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHostelId, user?.id]);
  const menu = useMenu(activeHostelId, today());
  const rooms = useRooms(activeHostelId);
  const notifications = useNotifications(user?.id);
  const [sheet, setSheet] = useState<"stop" | "guest" | "leave" | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);

  const myEntry = user && day?.entries[user.id];
  const myRoom = rooms.find((r) => r.id === user?.roomId);
  const unreadNotifications = notifications.filter((n) => !n.read);
  const unread = unreadNotifications.length > 0;

  const myPlan = plans.find((p) => p.type === "shopping" && p.memberIds.includes(user?.id ?? ""));
  const myBlock = myPlan?.blocks.find((b) => b.userIds.includes(user?.id ?? ""));

  // Display-only stats for the Today's-meals strip — all derived from data
  // already loaded above (no extra fetches, no rule changes).
  const mealSlots: MealSlot[] = ["breakfast", "lunch", "dinner"];
  const anyMealOn = mealSlots.some((m) => myEntry?.[m].on ?? true);
  const totalMealsToday = day
    ? Object.values(day.entries).reduce(
        (sum, e) =>
          sum +
          mealSlots.reduce((s, m) => s + (e[m].on ? 1 : 0) + e[m].guestCount, 0),
        0
      )
    : 0;
  const memberCount = rooms.reduce((s, r) => s + r.occupantIds.length, 0);

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

      {/* Hero: promo slider ⇄ current bill & credit (toggle in the header) */}
      <HomeHero bill={bill ?? undefined} mealRate={actualRate.rate} mealsOn={mealsOn} />

      {/* Announcements + unread personal notifications (pinned until clicked) */}
      {(announcements.length > 0 || unreadNotifications.length > 0) && (
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn bg-[#7C6CF6]/10 text-[#7C6CF6]">
                <Icon icon={Megaphone} size={20} />
              </div>
              <div>
                <div className="text-[16px] font-extrabold leading-tight">Announcements</div>
                <div className="text-[10.5px] font-semibold text-text-secondary">
                  Hostel news + your unread notifications
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
            {/* Unread personal notifications stay here until clicked (read). */}
            {unreadNotifications.slice(0, 3).map((n) => (
              <NotificationItem key={n.id} notification={n} />
            ))}
            {announcements.slice(0, 3).map((a) => (
              <AnnouncementItem key={a.id} announcement={a} userId={user?.id} />
            ))}
          </div>

          <button
            type="button"
            onClick={() => setPrefsOpen(true)}
            className="mt-3 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-pill bg-[#7C6CF6]/10 text-[11.5px] font-extrabold text-[#7C6CF6]"
          >
            <Icon icon={Bell} size={15} />
            Manage notification preferences
          </button>
        </div>
      )}

      {/* Today's meals — redesigned */}
      <div>
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[19px] font-extrabold tracking-tight">Today&rsquo;s meals</div>
            <div className="text-[10.5px] font-semibold text-text-secondary">{formatDayMonth(today())}</div>
          </div>
          <Link
            href="/student/meals"
            className="flex items-center gap-1.5 rounded-pill bg-card px-3.5 py-2.5 text-[11.5px] font-extrabold text-primary shadow-soft"
          >
            <Icon icon={CalendarDays} size={15} />
            Calendar
            <Icon icon={ChevronRight} size={14} className="text-text-secondary" />
          </Link>
        </div>

        {/* Meal cards */}
        <div className="grid grid-cols-3 gap-2.5">
          {mealSlots.map((meal) => {
            const on = myEntry?.[meal].on ?? true;
            const items = menu?.dishes[meal]?.length ?? 0;
            // The design keeps breakfast/dinner in the teal accent and lunch in
            // amber; the ON meal gets a solid teal icon + highlighted card.
            const soft = meal === "lunch" ? "bg-orange-soft text-orange" : "bg-primary-soft text-primary";
            const Ic = MEAL_COLORS[meal].icon;
            return (
              <Link
                key={meal}
                href="/student/meals"
                className={`flex flex-col rounded-card border p-3.5 shadow-soft ${
                  on ? "border-2 border-primary bg-primary-soft" : "border border-border bg-card"
                }`}
              >
                <div
                  className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full ${
                    on ? "bg-primary text-white" : soft
                  }`}
                >
                  <Icon icon={Ic} size={22} />
                </div>
                <div className="text-[15px] font-extrabold">{MEAL_LABEL[meal]}</div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${on ? "bg-[#16A34A]" : "bg-text-secondary/40"}`} />
                  <span
                    className={`text-[10px] font-extrabold uppercase tracking-wide ${
                      on ? "text-[#16A34A]" : "text-text-secondary"
                    }`}
                  >
                    {on ? "On" : "Off"}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-black/[0.06] pt-2.5">
                  <span className="text-[10.5px] font-semibold text-text-secondary">
                    {items} item{items === 1 ? "" : "s"}
                  </span>
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full ${
                      on ? "bg-primary text-white" : "bg-bg text-text-secondary"
                    }`}
                  >
                    <Icon icon={ChevronRight} size={14} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Menu overview */}
        <Card className="mt-3">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[13px] font-extrabold">Menu overview</div>
            <Link href="/student/menu" className="flex items-center gap-0.5 text-[11.5px] font-extrabold text-primary">
              View menu
              <Icon icon={ChevronRight} size={13} />
            </Link>
          </div>
          <div className="flex flex-col gap-3.5">
            {mealSlots.map((meal) => {
              const dishes = menu?.dishes[meal] ?? [];
              const c = MEAL_COLORS[meal];
              return (
                <Link key={meal} href="/student/menu" className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-btn ${c.bg} ${c.text}`}>
                    <Icon icon={Utensils} size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-extrabold">{MEAL_LABEL[meal]}</div>
                    <div className="text-[9.5px] font-semibold text-text-secondary">
                      {dishes.length ? `${dishes.length} item${dishes.length === 1 ? "" : "s"} planned` : "No menu planned"}
                    </div>
                  </div>
                  {dishes.length === 0 ? (
                    <span className="text-[14px] font-bold text-text-secondary">&mdash;</span>
                  ) : (
                    <div className="flex items-center -space-x-1.5">
                      {dishes.slice(0, 3).map((_, i) => (
                        <span key={i} className={`h-6 w-6 rounded-full border-2 border-card ${c.dot}`} />
                      ))}
                      {dishes.length > 3 && (
                        <span className="flex h-6 items-center rounded-pill bg-bg px-1.5 text-[9px] font-extrabold text-text-secondary">
                          +{dishes.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                  <span className="flex shrink-0 items-center gap-1 rounded-pill bg-bg px-2.5 py-1.5 text-[10px] font-extrabold text-text-secondary">
                    {dishes.length} items
                    <Icon icon={ChevronRight} size={12} />
                  </span>
                </Link>
              );
            })}
          </div>
        </Card>

        {/* Stat strip */}
        <Card className="mt-3">
          <div className="grid grid-cols-4">
            {[
              { icon: Utensils, label: "Total meals today", value: String(totalMealsToday), tone: "text-primary" },
              { icon: Users, label: "Total members", value: String(memberCount), tone: "text-[#7C6CF6]" },
              { icon: BarChart3, label: "Avg. cost per meal", value: formatBDT(actualRate.rate), tone: "text-orange" },
              {
                icon: Leaf,
                label: "Meals status",
                value: anyMealOn ? "Healthy" : "All off",
                tone: "text-[#16A34A]",
                valueGreen: anyMealOn,
              },
            ].map((s, i) => (
              <div key={s.label} className={`flex items-center gap-2 px-2 ${i > 0 ? "border-l border-border" : ""}`}>
                <Icon icon={s.icon} size={17} className={`shrink-0 ${s.tone}`} />
                <div className="min-w-0">
                  <div className="truncate text-[8.5px] font-bold text-text-secondary">{s.label}</div>
                  <div className={`text-[13.5px] font-extrabold ${s.valueGreen ? "text-[#16A34A]" : ""}`}>
                    {s.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

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

      <MealRequestSheet open={sheet === "stop"} onClose={() => setSheet(null)} hostelId={activeHostelId} userId={user?.id} />
      <GuestMealSheet open={sheet === "guest"} onClose={() => setSheet(null)} hostelId={activeHostelId} userId={user?.id} />
      <LeaveRequestSheet open={sheet === "leave"} onClose={() => setSheet(null)} hostelId={activeHostelId} userId={user?.id} />
      <NotificationPrefsSheet open={prefsOpen} onClose={() => setPrefsOpen(false)} user={user} />
    </div>
  );
}

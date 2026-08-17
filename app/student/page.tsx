"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, Bell, ChevronRight, Megaphone, ShoppingCart } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useMealDay } from "@/hooks/useMealDay";
import { useCookAttendanceForDate } from "@/hooks/useCookAttendance";
import { useActionableAnnouncements, canDismissAnnouncement } from "@/hooks/useActionableAnnouncements";
import { useDutyPlans } from "@/hooks/useDutyPlans";
import { useBill } from "@/hooks/useBill";
import { useMenu } from "@/hooks/useMenu";
import { useRooms } from "@/hooks/useRooms";
import { useUsers } from "@/hooks/useUsers";
import { useNotifications } from "@/hooks/useNotifications";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { MealRequestSheet } from "@/components/student/MealRequestSheet";
import { GuestMealSheet } from "@/components/student/GuestMealSheet";
import { LeaveRequestSheet } from "@/components/student/LeaveRequestSheet";
import { AnnouncementItem } from "@/components/student/AnnouncementItem";
import { SwipeToDismiss } from "@/components/ui/SwipeToDismiss";
import { NotificationItem } from "@/components/student/NotificationItem";
import { NotificationPrefsSheet } from "@/components/student/NotificationPrefsSheet";
import { HomeHero } from "@/components/student/HomeHero";
import { MealRosterSheet } from "@/components/student/MealRosterSheet";
import { MEAL_COLORS, MEAL_LABEL } from "@/lib/mealColors";
import { today, currentMonth, greeting, formatDayMonth } from "@/lib/utils/date";
import { repo, type MealSlot, type ShoppingCost } from "@/lib/data";
import { useActualMealRate } from "@/hooks/useActualMealRate";
import { useMemberMealSummary } from "@/hooks/useMemberMealSummary";
import { useQuickServices } from "@/hooks/useQuickServices";
import { QUICK_ACTIONS, QUICK_ACTION_TONE_CLASSES as TONE_CLASSES } from "@/lib/quickActions";
import { isAvailableAt } from "@/lib/geo/bangladesh";

export default function StudentHomePage() {
  const { user, hostel, activeHostelId } = useSession();
  const { toast } = useToast();
  const actualRate = useActualMealRate(activeHostelId);
  const { day } = useMealDay(activeHostelId, today());
  // Meals offered today that the manager hasn't confirmed cooked or not yet —
  // live, so the banner clears the moment the manager decides.
  const todayReports = useCookAttendanceForDate(activeHostelId, today());
  const unconfirmedMeals = (["breakfast", "lunch", "dinner"] as MealSlot[]).filter((meal) => {
    const offered = day?.mealsOffered?.[meal] ?? hostel?.settings.mealsOffered?.[meal] ?? true;
    if (!offered) return false;
    const report = todayReports.find((r) => r.meal === meal);
    return report?.status !== "resolved_cooked" && report?.status !== "confirmed_absent";
  });
  const [askedToday, setAskedToday] = useState(false);
  const askManagerToConfirmToday = async () => {
    if (!activeHostelId) return;
    setAskedToday(true);
    await Promise.all(
      unconfirmedMeals.map((meal) => repo.cookAttendance.askToConfirm(activeHostelId, today(), meal))
    );
    toast("Asked the manager to confirm today's meals.");
  };
  // Only what still needs THIS user's attention — voted polls and
  // resolved shortages/swaps drop out here but stay visible in the full
  // history on the notifications page.
  const { announcements, dismiss: dismissAnnouncement } = useActionableAnnouncements(activeHostelId, user?.id);
  const plans = useDutyPlans(activeHostelId);
  const { bill } = useBill(activeHostelId, user?.id, currentMonth());
  // This month's own meals + billed cost, live — so the hero's meal-cost
  // section updates the moment the manager confirms cooking, rather than
  // waiting for a bill to be (re)generated.
  const mealSummary = useMemberMealSummary(activeHostelId, user?.id);
  const [allCosts, setAllCosts] = useState<ShoppingCost[]>([]);
  useEffect(() => {
    if (!activeHostelId) return;
    repo.shoppingCosts.listByHostel(activeHostelId).then(setAllCosts);
  }, [activeHostelId]);
  // What I've personally spent on approved shopping this month — credited
  // against my own meal cost below, same as a generated bill would.
  const myShoppingThisMonth = allCosts
    .filter(
      (c) => c.userId === user?.id && c.status === "approved" && c.dates.some((d) => d.startsWith(currentMonth()))
    )
    .reduce((sum, c) => sum + c.amount, 0);
  const menu = useMenu(activeHostelId, today());
  const rooms = useRooms(activeHostelId);
  const boarders = useUsers(activeHostelId).filter((u) => u.role !== "cook" && u.role !== "owner");
  const notifications = useNotifications(user?.id);
  const [sheet, setSheet] = useState<string | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [rosterMeal, setRosterMeal] = useState<MealSlot | null>(null);
  // Super Admin's per-quick-action enable/disable + location restriction —
  // "restrictions only ever narrow": a key missing from settings, or with no
  // areas set, stays visible everywhere.
  const quickServiceSettings = useQuickServices();
  const visibleQuickActions = QUICK_ACTIONS.filter((a) => {
    if (!a.quickService) return true;
    const s = quickServiceSettings[a.key];
    return (s?.enabled ?? true) && isAvailableAt(s?.areas, hostel?.address);
  });

  const myEntry = user && day?.entries[user.id];
  // How many are eating each meal today, hostel-wide — same on/off resolution
  // as the manager's roster (MealsScreen), so it always matches what a
  // manager sees when deciding how much to cook.
  const todaysEatingCount = (meal: MealSlot) =>
    boarders.reduce((sum, m) => {
      const joinedDay = m.joinedAt?.slice(0, 10);
      const boarderThatDay = !joinedDay || joinedDay <= today();
      if (!boarderThatDay || (day?.sealed && !day.entries[m.id])) return sum;
      const entry = day?.entries[m.id];
      const offeredThatDay = day?.mealsOffered?.[meal] ?? hostel?.settings.mealsOffered?.[meal] ?? true;
      const on = entry?.[meal]?.on ?? (m.futureMealsOff?.[meal] ? false : offeredThatDay);
      return sum + (on ? 1 : 0) + (entry?.[meal]?.guestCount ?? 0);
    }, 0);
  const myRoom = rooms.find((r) => r.id === user?.roomId);
  const unreadNotifications = notifications.filter((n) => !n.read);
  const unread = unreadNotifications.length > 0;
  // General announcements arrive as linked personal notifications; while that
  // notification is still UNREAD, drop the announcement copy here so home
  // doesn't show it twice. Only unread ones count — this section only ever
  // renders unread notifications (below), so once the notification is read
  // and drops out of that list, the announcement must reappear on its own
  // (properly styled) rather than vanish from Home entirely.
  const linkedAnnouncementIds = new Set(unreadNotifications.map((n) => n.announcementId).filter(Boolean));
  const visibleAnnouncements = announcements.filter((a) => !linkedAnnouncementIds.has(a.id));

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
          <Avatar name={user?.name ?? ""} seed={user?.avatarSeed} photo={user?.avatarImage} size={40} />
        </div>
      </div>

      {/* Hero: promo slider ⇄ current bill & credit (toggle in the header) */}
      <HomeHero
        bill={bill ?? undefined}
        mealRate={actualRate.rate}
        mealSummary={mealSummary}
        myShoppingCost={myShoppingThisMonth}
      />

      {/* Announcements + unread personal notifications (pinned until clicked) */}
      {(visibleAnnouncements.length > 0 || unreadNotifications.length > 0) && (
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
            {visibleAnnouncements.slice(0, 3).map((a) => (
              <SwipeToDismiss
                key={a.id}
                disabled={!canDismissAnnouncement(a)}
                onDismiss={() => dismissAnnouncement(a.id)}
              >
                <AnnouncementItem announcement={a} userId={user?.id} />
              </SwipeToDismiss>
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

      {/* Manager hasn't confirmed whether today's meal(s) were cooked yet */}
      {unconfirmedMeals.length > 0 && (
        <Card className="border border-orange/30 bg-orange-soft">
          <div className="mb-1 flex items-center gap-2">
            <Icon icon={AlertTriangle} size={16} className="text-orange" />
            <div className="text-[12.5px] font-extrabold text-orange">
              {unconfirmedMeals.length === 1
                ? `${MEAL_LABEL[unconfirmedMeals[0]]} not confirmed yet`
                : "Today's meals not confirmed yet"}
            </div>
          </div>
          <div className="mb-3 text-[11px] font-semibold text-text-secondary">
            The manager hasn&rsquo;t confirmed whether {unconfirmedMeals.map((m) => MEAL_LABEL[m].toLowerCase()).join(", ")}{" "}
            {unconfirmedMeals.length === 1 ? "was" : "were"}{" "}
            actually cooked yet — unconfirmed meals don&rsquo;t count toward the meal rate or bills.
          </div>
          <button
            type="button"
            disabled={askedToday}
            onClick={askManagerToConfirmToday}
            className="flex min-h-10 w-full items-center justify-center rounded-btn bg-orange text-[12px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {askedToday ? "Manager asked" : "Ask manager to confirm"}
          </button>
        </Card>
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
              <button
                key={meal}
                type="button"
                onClick={() => setRosterMeal(meal)}
                className={`flex cursor-pointer flex-col items-center gap-2 rounded-btn py-3.5 ${
                  on ? "bg-bg" : "bg-bg/50"
                }`}
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    on ? "bg-text" : "border border-border bg-card"
                  }`}
                >
                  <Icon icon={c.icon} size={18} className={on ? "text-card" : "text-text-secondary"} />
                </div>
                <div className="text-[10.5px] font-extrabold">{MEAL_LABEL[meal]}</div>
                <div
                  className={`text-[9px] font-extrabold uppercase tracking-wide ${
                    on ? "text-text" : "text-text-secondary"
                  }`}
                >
                  {on ? "On" : "Off"}
                </div>
                <div className="text-[9px] font-bold text-text-secondary">{todaysEatingCount(meal)} eating</div>
              </button>
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
          {visibleQuickActions.map((action) => {
            const content = (
              <div className="flex flex-col items-center gap-2 rounded-card border border-border bg-card py-3.5 shadow-chip">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full ${TONE_CLASSES[action.tone]}`}>
                  <Icon icon={action.icon} size={17} />
                </div>
                <div className="text-center text-[9.5px] font-bold leading-tight">{action.label}</div>
              </div>
            );
            if (action.href) {
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
      <MealRosterSheet
        open={rosterMeal !== null}
        onClose={() => setRosterMeal(null)}
        hostelId={activeHostelId}
        date={today()}
        meal={rosterMeal}
      />
    </div>
  );
}

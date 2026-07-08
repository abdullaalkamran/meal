"use client";

import { useEffect, useState } from "react";
import { Phone } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useMealDay } from "@/hooks/useMealDay";
import { useCookAttendanceForDate } from "@/hooks/useCookAttendance";
import { useCookLeaveRequests } from "@/hooks/useCookLeaveRequests";
import { useDutyPlans } from "@/hooks/useDutyPlans";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { CookLeaveSheet } from "@/components/cook/CookLeaveSheet";
import { MEAL_COLORS, MEAL_LABEL } from "@/lib/mealColors";
import { repo, type Menu, type MealSlot, type User } from "@/lib/data";
import { formatDateLabel, today } from "@/lib/utils/date";

const SERVE_TIME: Record<MealSlot, string> = {
  breakfast: "7:30 AM",
  lunch: "1:00 PM",
  dinner: "8:00 PM",
};

export default function CookDashboardPage() {
  const { user, hostel, activeHostelId } = useSession();
  const { day } = useMealDay(activeHostelId, today());
  const reports = useCookAttendanceForDate(activeHostelId, today());
  const leaveRequests = useCookLeaveRequests(activeHostelId);
  const plans = useDutyPlans(activeHostelId);
  const { toast } = useToast();
  const [menu, setMenu] = useState<Menu | undefined>(undefined);
  const [manager, setManager] = useState<User | undefined>(undefined);
  const [leaveSheetOpen, setLeaveSheetOpen] = useState(false);

  useEffect(() => {
    if (!activeHostelId) return;
    repo.menus.getMenu(activeHostelId, today()).then(setMenu);
  }, [activeHostelId]);

  useEffect(() => {
    if (!hostel) return;
    repo.users.getUser(hostel.managerId).then(setManager);
  }, [hostel]);

  const myPendingLeave = leaveRequests.find((r) => r.cookId === user?.id && r.status === "pending");
  const shoppingPlan = plans.find((p) => p.type === "shopping" && p.endDate >= today());
  const todaysShopper = shoppingPlan?.blocks.find((b) => b.dates.includes(today()));

  const mealCounts = (["breakfast", "lunch", "dinner"] as MealSlot[]).map((meal) => {
    const entries = day ? Object.values(day.entries) : [];
    const count = entries.reduce((sum, e) => sum + (e[meal].on ? 1 + e[meal].guestCount : 0), 0);
    const guestCount = entries.reduce((sum, e) => sum + (e[meal].on ? e[meal].guestCount : 0), 0);
    return { meal, count, guestCount };
  });

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div>
        <div className="text-[17.5px] font-extrabold tracking-tight">Today&rsquo;s cooking</div>
        <div className="text-[11px] font-semibold text-text-secondary">
          {hostel?.name} · {formatDateLabel(today())} · {user?.name}
        </div>
      </div>

      {manager && (
        <Card className="flex items-center justify-between">
          <div>
            <div className="text-[9.5px] font-bold uppercase tracking-wide text-text-secondary">
              Responsible manager
            </div>
            <div className="text-[13px] font-extrabold">{manager.name}</div>
            <div className="text-[10px] font-semibold text-text-secondary">{manager.phone}</div>
          </div>
          <a
            href={`tel:${manager.phone}`}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary"
          >
            <Icon icon={Phone} size={17} />
          </a>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <div className="text-[9.5px] font-bold text-text-secondary">Kitchen</div>
          <div className="text-[12px] font-extrabold">{hostel?.kitchenLocation ?? "—"}</div>
        </Card>
        <Card>
          <div className="text-[9.5px] font-bold text-text-secondary">Today&rsquo;s shopping</div>
          <div className="text-[12px] font-extrabold">
            {todaysShopper
              ? "Assigned"
              : "—"}
          </div>
        </Card>
      </div>

      {(["breakfast", "lunch", "dinner"] as MealSlot[]).map((meal) => {
        const report = reports.find((r) => r.meal === meal);
        const stats = mealCounts.find((c) => c.meal === meal)!;
        const dishes = menu?.dishes[meal] ?? [];
        const c = MEAL_COLORS[meal];
        const cancelled = report?.status === "confirmed_absent";

        return (
          <Card key={meal} className={cancelled ? "opacity-60" : undefined}>
            <div className="flex gap-3">
              <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-btn ${c.bg}`}>
                <div className={`text-[16.5px] font-extrabold leading-none ${c.text}`}>{stats.count}</div>
                <div className="text-[9px] font-bold text-text-secondary">MEALS</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-extrabold">
                  {MEAL_LABEL[meal]}{" "}
                  <span className="text-[10px] font-semibold text-text-secondary">
                    Serve {SERVE_TIME[meal]}
                  </span>
                </div>
                <div className="text-[10.5px] font-semibold text-text-secondary">
                  {dishes.length > 0 ? dishes.join(" · ") : "Menu not set yet"}
                </div>
                {stats.guestCount > 0 && (
                  <div className="mt-1 text-[9.5px] font-bold text-orange">
                    ⚠ {stats.guestCount} guest meal{stats.guestCount > 1 ? "s" : ""}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3">
              {cancelled ? (
                <Chip tone="danger" active>
                  Cancelled — cook absent
                </Chip>
              ) : report?.status === "reported" ? (
                <Button
                  fullWidth
                  onClick={() => activeHostelId && repo.cookAttendance.markCooked(activeHostelId, today(), meal)}
                >
                  Confirm cooked
                </Button>
              ) : report?.status === "resolved_cooked" ? (
                <div className="flex min-h-11 w-full items-center justify-center rounded-btn bg-primary-soft text-[12px] font-extrabold text-primary">
                  ✓ Cooking completed
                </div>
              ) : (
                <Button
                  fullWidth
                  variant="secondary"
                  onClick={() => activeHostelId && repo.cookAttendance.markCooked(activeHostelId, today(), meal)}
                >
                  Mark as cooked
                </Button>
              )}
            </div>
          </Card>
        );
      })}

      <Card className="flex items-center justify-between">
        <div>
          <div className="text-[12px] font-extrabold">Leave request</div>
          <div className="text-[10px] font-semibold text-text-secondary">
            Need days off? Ask your manager
          </div>
        </div>
        {myPendingLeave ? (
          <Chip tone="orange" active>
            Pending
          </Chip>
        ) : (
          <button
            type="button"
            onClick={() => setLeaveSheetOpen(true)}
            className="rounded-pill bg-primary-soft px-3 py-2 text-[11px] font-extrabold text-primary"
          >
            Request leave
          </button>
        )}
      </Card>

      <CookLeaveSheet
        open={leaveSheetOpen}
        onClose={() => setLeaveSheetOpen(false)}
        hostelId={activeHostelId}
        cookId={user?.id}
        onToast={toast}
      />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, HelpCircle, Mic, Phone, Square, Volume2 } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useMealDay } from "@/hooks/useMealDay";
import { useCookAttendanceForDate } from "@/hooks/useCookAttendance";
import { useCookLeaveRequests } from "@/hooks/useCookLeaveRequests";
import { useDutyPlans } from "@/hooks/useDutyPlans";
import { useShortages } from "@/hooks/useShortages";
import { useBanglaVoiceInput } from "@/hooks/useBanglaVoiceInput";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { CookLeaveSheet } from "@/components/cook/CookLeaveSheet";
import { BanglaVoiceHelpSheet } from "@/components/cook/BanglaVoiceHelpSheet";
import { MEAL_COLORS, MEAL_LABEL } from "@/lib/mealColors";
import { repo, type Menu, type MealSlot, type User } from "@/lib/data";
import { formatDateLabel, today } from "@/lib/utils/date";
import { speakBangla } from "@/lib/utils/speech";

const SERVE_TIME: Record<MealSlot, string> = {
  breakfast: "7:30 AM",
  lunch: "1:00 PM",
  dinner: "8:00 PM",
};

const MEAL_LABEL_BN: Record<MealSlot, string> = {
  breakfast: "সকালের নাস্তা",
  lunch: "দুপুরের খাবার",
  dinner: "রাতের খাবার",
};

export default function CookDashboardPage() {
  const { user, hostel, activeHostelId } = useSession();
  const { day } = useMealDay(activeHostelId, today());
  const reports = useCookAttendanceForDate(activeHostelId, today());
  const leaveRequests = useCookLeaveRequests(activeHostelId);
  const plans = useDutyPlans(activeHostelId);
  const shortages = useShortages(activeHostelId);
  const { toast } = useToast();
  const [menu, setMenu] = useState<Menu | undefined>(undefined);
  const [manager, setManager] = useState<User | undefined>(undefined);
  const [leaveSheetOpen, setLeaveSheetOpen] = useState(false);
  const [voiceHelpOpen, setVoiceHelpOpen] = useState(false);
  const [shortageItems, setShortageItems] = useState("");

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

  const onNoVoice = () => {
    toast("No Bangla voice found on this device");
    setVoiceHelpOpen(true);
  };

  const speakMealCount = (meal: MealSlot) => {
    const stats = mealCounts.find((c) => c.meal === meal)!;
    speakBangla(`${MEAL_LABEL_BN[meal]}-এ আজকে ${stats.count} জনের জন্য রান্না করতে হবে।`, onNoVoice);
  };

  const speakAllCounts = () => {
    const parts = mealCounts.map((c) => `${MEAL_LABEL_BN[c.meal]}-এ ${c.count} জন`);
    speakBangla(`আজকের রান্নার হিসাব। ${parts.join("। ")}।`, onNoVoice);
  };

  const myShortages = shortages.filter((s) => s.cookId === user?.id);
  const myPendingShortages = myShortages.filter((s) => s.status === "pending");

  const { listening, start: startVoiceInput, stop: stopVoiceInput } = useBanglaVoiceInput(
    (transcript) => {
      setShortageItems((prev) => {
        const next = prev.trim() ? `${prev.trim()} ${transcript}` : transcript;
        speakBangla(`আপনি বলেছেন: ${transcript}`, onNoVoice);
        return next;
      });
    },
    () => toast("এই ব্রাউজারে ভয়েসে বলা সমর্থিত নয় — টাইপ করে লিখুন"),
    (error) =>
      toast(
        error === "not-allowed"
          ? "মাইক্রোফোন ব্যবহারের অনুমতি দিন"
          : "শোনা যায়নি — আবার চেষ্টা করুন"
      )
  );

  const reportShortage = async () => {
    if (!activeHostelId || !user || !shortageItems.trim()) return;
    await repo.shortages.report({
      hostelId: activeHostelId,
      cookId: user.id,
      items: shortageItems.trim(),
    });
    toast("Shortage reported — manager and shopper notified");
    setShortageItems("");
  };

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[17.5px] font-extrabold tracking-tight">Today&rsquo;s cooking</div>
          <div className="truncate text-[11px] font-semibold text-text-secondary">
            {hostel?.name} · {formatDateLabel(today())} · {user?.name}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={speakAllCounts}
            className="flex items-center gap-1.5 rounded-pill bg-primary-soft px-3 py-2 text-[11px] font-extrabold text-primary"
          >
            <Icon icon={Volume2} size={15} />
            বাংলায় শুনুন
          </button>
          <button
            type="button"
            onClick={() => setVoiceHelpOpen(true)}
            aria-label="Bangla voice setup help"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-bg text-text-secondary"
          >
            <Icon icon={HelpCircle} size={15} />
          </button>
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
                <div className="flex items-center gap-1.5 text-[13px] font-extrabold">
                  {MEAL_LABEL[meal]}{" "}
                  <span className="text-[10px] font-semibold text-text-secondary">
                    Serve {SERVE_TIME[meal]}
                  </span>
                  <button
                    type="button"
                    onClick={() => speakMealCount(meal)}
                    className="ml-auto flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-bg text-text-secondary"
                    aria-label={`Listen: ${MEAL_LABEL[meal]} count in Bangla`}
                  >
                    <Icon icon={Volume2} size={13} />
                  </button>
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

            {(cancelled || report?.status === "reported" || report?.status === "resolved_cooked") && (
              <div className="mt-3">
                {cancelled ? (
                  <Chip tone="danger" active>
                    Cancelled — cook absent
                  </Chip>
                ) : report?.status === "reported" ? (
                  <Chip tone="orange" active>
                    Reported — awaiting manager confirmation
                  </Chip>
                ) : (
                  <div className="flex min-h-11 w-full items-center justify-center rounded-btn bg-primary-soft text-[12px] font-extrabold text-primary">
                    ✓ Cooking completed
                  </div>
                )}
              </div>
            )}
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

      <Card>
        <div className="mb-2 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-danger-soft text-danger">
            <Icon icon={AlertTriangle} size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-extrabold">Report a shortage</div>
            <div className="text-[10px] font-semibold text-text-secondary">
              Ran out of an ingredient? Let the manager and shopper know.
            </div>
          </div>
        </div>
        <textarea
          value={shortageItems}
          onChange={(e) => setShortageItems(e.target.value)}
          placeholder="e.g. Salt, cooking oil, onions"
          className="mb-3 h-16 w-full resize-none rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-semibold"
        />
        <button
          type="button"
          onClick={listening ? stopVoiceInput : startVoiceInput}
          className={`mb-3 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-btn text-[12px] font-extrabold ${
            listening ? "bg-danger text-white" : "bg-primary-soft text-primary"
          }`}
        >
          <Icon icon={listening ? Square : Mic} size={16} />
          {listening ? "শুনছি… (থামাতে চাপুন)" : "বলে রেকর্ড করুন"}
        </button>
        <Button fullWidth variant="secondary" onClick={reportShortage} disabled={!shortageItems.trim()}>
          Send shortage alert
        </Button>
        {shortageItems.trim() && (
          <button
            type="button"
            onClick={() => speakBangla(`আপনি লিখেছেন: ${shortageItems}`, onNoVoice)}
            className="mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 text-[10.5px] font-extrabold text-text-secondary"
          >
            <Icon icon={Volume2} size={13} />
            শুনে যাচাই করুন
          </button>
        )}

        {myPendingShortages.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {myPendingShortages.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-2 rounded-btn bg-danger-soft px-3 py-2.5"
              >
                <div className="min-w-0 text-[11px] font-bold text-danger">{s.items}</div>
                <Chip tone="danger" active>
                  Pending
                </Chip>
              </div>
            ))}
          </div>
        )}
      </Card>

      <CookLeaveSheet
        open={leaveSheetOpen}
        onClose={() => setLeaveSheetOpen(false)}
        hostelId={activeHostelId}
        cookId={user?.id}
        onToast={toast}
      />
      <BanglaVoiceHelpSheet open={voiceHelpOpen} onClose={() => setVoiceHelpOpen(false)} />
    </div>
  );
}

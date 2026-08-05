"use client";

import { useEffect, useState } from "react";
import {
  Ban,
  ChevronDown,
  ChevronUp,
  Droplet,
  Flame,
  HelpCircle,
  Lock,
  MessageCircle,
  Package,
  ShoppingCart,
  Sparkles,
  Trash2,
  Utensils,
  Users,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useExpenses } from "@/hooks/useExpenses";
import { useUsers } from "@/hooks/useUsers";
import { useRooms } from "@/hooks/useRooms";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { MonthNav } from "@/components/ui/MonthNav";
import { AddExpenseSheet } from "@/components/manager/AddExpenseSheet";
import { RecordShoppingCostSheet } from "@/components/manager/RecordShoppingCostSheet";
import { EditShoppingCostSheet } from "@/components/manager/EditShoppingCostSheet";
import { GenerateBillsSheet } from "@/components/manager/GenerateBillsSheet";
import { BillingInstructionsSheet } from "@/components/manager/BillingInstructionsSheet";
import { BillHistorySheet } from "@/components/hostel/BillHistorySheet";
import { RecordPaymentSheet } from "@/components/manager/RecordPaymentSheet";
import { SettleMealCreditSheet } from "@/components/manager/SettleMealCreditSheet";
import { PayBillSheet } from "@/components/student/PayBillSheet";
import { useShoppingCostEditRequests } from "@/hooks/useShoppingCostEditRequests";
import { repo, type Bill, type BillSection, type ShoppingCost } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";
import { currentMonth, formatMonthLabel, lastDayOfMonth, previousMonth, today } from "@/lib/utils/date";
import { toWhatsAppNumber } from "@/lib/utils/phone";
import { PermissionGate } from "@/components/manager/PermissionGate";
import { hasManagerPermission } from "@/lib/auth/permissions";

const CATEGORY_META: Record<string, { icon: LucideIcon; bar: string; tone: string }> = {
  Grocery: { icon: ShoppingCart, bar: "bg-primary", tone: "bg-primary-soft text-primary" },
  Electricity: { icon: Zap, bar: "bg-orange", tone: "bg-orange-soft text-orange" },
  Water: { icon: Droplet, bar: "bg-[#0EA5E9]", tone: "bg-[#0EA5E9]/10 text-[#0EA5E9]" },
  WiFi: { icon: Wifi, bar: "bg-[#06B6D4]", tone: "bg-[#06B6D4]/10 text-[#06B6D4]" },
  Gas: { icon: Flame, bar: "bg-danger", tone: "bg-danger-soft text-danger" },
  Cleaning: { icon: Sparkles, bar: "bg-[#EC4899]", tone: "bg-[#EC4899]/10 text-[#EC4899]" },
  Utilities: { icon: Zap, bar: "bg-orange", tone: "bg-orange-soft text-orange" },
  Salary: { icon: Users, bar: "bg-blue", tone: "bg-blue-soft text-blue" },
  Others: { icon: Package, bar: "bg-[#7C6CF6]", tone: "bg-[#7C6CF6]/10 text-[#7C6CF6]" },
};
const DEFAULT_META = { icon: Flame, bar: "bg-text-secondary", tone: "bg-bg text-text-secondary" };

const SECTION_LABEL: Record<BillSection["label"], string> = {
  mealCost: "Meal cost",
  roomRent: "Room rent",
  serviceCharge: "Service charge",
  cookSalary: "Cook salary",
};

const SECTION_ORDER: BillSection["label"][] = ["mealCost", "roomRent", "serviceCharge", "cookSalary"];

// Meal cost is money collected purely on members' behalf — the hostel/owner
// never keeps a share of it, so any credit there has to be refunded or
// adjusted against that member's other dues. Rent, service, and cook salary
// are pass-through collections owed to the owner, utility providers, or the
// cook, so a credit there just means they were paid ahead.
const SECTION_NOTE: Record<BillSection["label"], string> = {
  mealCost: "Belongs entirely to members — refund or adjust any credit here; the hostel keeps no share.",
  roomRent: "Collected on behalf of the hostel owner.",
  serviceCharge: "Collected on behalf of utility & service providers.",
  cookSalary: "Collected on behalf of the cook.",
};

function ManagerFinancePage() {
  const { user, hostel, activeHostelId } = useSession();
  const canGenerateBills = hasManagerPermission(user, hostel, "billing");
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const allExpenses = useExpenses(activeHostelId);
  const allHostelUsers = useUsers(activeHostelId).filter((u) => u.role !== "cook" && u.role !== "owner");
  const boarders = allHostelUsers.filter((u) => !u.banned);
  // Members who have left (banned) still carry a final bill to settle.
  const formerMembers = allHostelUsers.filter((u) => u.banned);
  const rooms = useRooms(activeHostelId);
  const { toast } = useToast();
  const [bills, setBills] = useState<Bill[]>([]);
  const [expenseSheetOpen, setExpenseSheetOpen] = useState(false);
  const [shoppingCostSheetOpen, setShoppingCostSheetOpen] = useState(false);
  const [shoppingCosts, setShoppingCosts] = useState<ShoppingCost[]>([]);
  const [editCost, setEditCost] = useState<ShoppingCost | null>(null);
  const [formerBills, setFormerBills] = useState<Record<string, Bill>>({});
  const [settleFormer, setSettleFormer] = useState<{ bill: Bill; name: string } | null>(null);
  const [payFormer, setPayFormer] = useState<Bill | null>(null);
  const [generateSheetOpen, setGenerateSheetOpen] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [historyTarget, setHistoryTarget] = useState<{ userId: string; name: string } | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<Bill | null>(null);
  const [settleUserId, setSettleUserId] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<BillSection["label"] | null>(null);

  const monthStr = `${year}-${String(month).padStart(2, "0")}`;
  // Bills can only be generated for the current or a past month — a future
  // month has no meals/expenses to bill yet.
  const isFutureMonth = monthStr > currentMonth();
  const expenses = allExpenses.filter((e) => e.billingMonth === monthStr);
  const monthEnd = lastDayOfMonth(monthStr);
  const canSuspendMeals = monthEnd >= today();

  const costEdits = useShoppingCostEditRequests(activeHostelId);

  useEffect(() => {
    if (!activeHostelId) return;
    repo.bills.listByHostel(activeHostelId, monthStr).then(setBills);
  }, [activeHostelId, monthStr, allExpenses]);

  // This month's shopping costs — the manager can propose an edit on any of
  // them (gated behind a member vote). costEdits is in the deps so an approved
  // vote (which changes an amount) re-fetches the updated figure.
  useEffect(() => {
    if (!activeHostelId) return;
    repo.shoppingCosts
      .listByHostel(activeHostelId)
      .then((list) => setShoppingCosts(list.filter((c) => c.dates.some((d) => d.startsWith(monthStr)))));
  }, [activeHostelId, monthStr, costEdits]);


  const refreshBills = () => {
    if (!activeHostelId) return;
    repo.bills.listByHostel(activeHostelId, monthStr).then(setBills);
  };

  // Each former member's most recent bill (their final one, often a past
  // month), so their closing balance can be settled here. Re-fetched when the
  // set of former members changes or a settlement resolves.
  const formerIdsKey = formerMembers.map((u) => u.id).join(",");
  const loadFormerBills = () => {
    if (!activeHostelId) return;
    // Promise.all([]) covers "no former members" without a synchronous setState.
    Promise.all(
      formerMembers.map((u) =>
        repo.bills.getLatestForUser(activeHostelId, u.id).then((b) => [u.id, b] as const)
      )
    ).then((entries) => {
      const map: Record<string, Bill> = {};
      for (const [id, b] of entries) if (b) map[id] = b;
      setFormerBills(map);
    });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadFormerBills, [activeHostelId, formerIdsKey, bills]);

  const nameOf = (id: string) => allHostelUsers.find((u) => u.id === id)?.name ?? id;
  const phoneOf = (id: string) => allHostelUsers.find((u) => u.id === id)?.phone;

  // Formal text-message summary of a member's bill, ready to open pre-filled
  // in WhatsApp — no PDF, this app has no PDF-generation library and one
  // isn't needed for a message the member reads on their phone.
  const shareOnWhatsApp = (b: Bill) => {
    const memberName = nameOf(b.userId).split(" ")[0];
    const due = b.grandTotal - b.paid;
    const previousDue = b.previousBalance - b.previousBalancePaid;
    const lines = [
      `Assalamu Alaikum, ${memberName},`,
      "",
      `Here is your bill summary for ${hostel?.name ?? "the hostel"} — ${formatMonthLabel(b.month)}:`,
      "",
      ...b.sections.map((s) => `${SECTION_LABEL[s.label]}: ${formatBDT(s.total)}`),
      ...(previousDue !== 0
        ? [previousDue > 0 ? `Previous balance: ${formatBDT(previousDue)}` : `Previous credit: ${formatBDT(-previousDue)}`]
        : []),
      "",
      `Total: ${formatBDT(b.grandTotal)}`,
      `Paid: ${formatBDT(b.paid)}`,
      due > 0 ? `Due: ${formatBDT(due)}` : due < 0 ? `Credit: ${formatBDT(-due)}` : "Status: Fully paid",
      "",
      due > 0 ? "Please settle the due amount at your earliest convenience. Thank you." : "Thank you.",
      "",
      `— ${hostel?.name ?? "Hostel"} Management`,
    ];
    const phone = phoneOf(b.userId);
    const waNumber = phone ? toWhatsAppNumber(phone) : "";
    const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank");
  };

  const sectionSummaries = SECTION_ORDER.map((label) => {
    let receivable = 0;
    let received = 0;
    let due = 0;
    let credit = 0;
    const members: { userId: string; status: "paid" | "due" | "credit"; amount: number }[] = [];
    for (const b of bills) {
      const s = b.sections.find((sec) => sec.label === label);
      if (!s) continue;
      receivable += s.total;
      received += s.paid;
      const remaining = s.total - s.paid;
      if (remaining > 0) {
        due += remaining;
        members.push({ userId: b.userId, status: "due", amount: remaining });
      } else if (remaining < 0) {
        credit += -remaining;
        members.push({ userId: b.userId, status: "credit", amount: -remaining });
      } else {
        members.push({ userId: b.userId, status: "paid", amount: 0 });
      }
    }
    // Members still owed money surface first, then credits, then fully paid.
    const order = { due: 0, credit: 1, paid: 2 };
    members.sort((a, b) => order[a.status] - order[b.status] || nameOf(a.userId).localeCompare(nameOf(b.userId)));
    return { label, receivable, received, due, credit, members };
  });

  const roomOf = (id: string) => rooms.find((r) => r.occupantIds.includes(id));

  const isSuspended = (userId: string) => boarders.find((u) => u.id === userId)?.mealsSuspended ?? false;

  const toggleSuspend = async (userId: string) => {
    if (!activeHostelId) return;
    const suspended = isSuspended(userId);
    const monthStart = `${monthStr}-01`;
    const from = monthStart > today() ? monthStart : today();
    await repo.meals.setMemberMealsForRange(activeHostelId, userId, from, monthEnd, suspended);
    toast(suspended ? `${nameOf(userId)}'s meals resumed` : `${nameOf(userId)}'s meals turned off until paid`);
  };

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[17.5px] font-extrabold tracking-tight">Finance</div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setInstructionsOpen(true)}
            aria-label="Billing instructions"
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-bg text-text-secondary"
          >
            <Icon icon={HelpCircle} size={17} />
          </button>
          <button
            type="button"
            onClick={() => setShoppingCostSheetOpen(true)}
            className="min-h-10 cursor-pointer rounded-pill bg-primary-soft px-3.5 text-[11.5px] font-extrabold text-primary"
          >
            + Shopping
          </button>
          <button
            type="button"
            onClick={() => setExpenseSheetOpen(true)}
            className="min-h-10 cursor-pointer rounded-pill bg-primary px-4 text-[11.5px] font-extrabold text-white"
          >
            + Expense
          </button>
        </div>
      </div>

      <MonthNav
        value={monthStr}
        onChange={(ms) => {
          const [y, m] = ms.split("-").map(Number);
          setYear(y);
          setMonth(m);
        }}
      />

      {!canGenerateBills ? (
        <div className="rounded-btn bg-bg px-4 py-3 text-center text-[11px] font-semibold text-text-secondary">
          Bill generation is turned off for managers — the hostel owner handles it.
        </div>
      ) : isFutureMonth ? (
        <div className="rounded-btn bg-bg px-4 py-3 text-center text-[11px] font-semibold text-text-secondary">
          Bills for {formatMonthLabel(monthStr)} can&rsquo;t be generated yet — pick the current or a past month.
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setGenerateSheetOpen(true)}
          disabled={!activeHostelId}
          className="min-h-11 w-full cursor-pointer rounded-btn font-extrabold text-white disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, var(--gradient-accent-from), var(--gradient-accent-to))" }}
        >
          Generate bills · {formatMonthLabel(monthStr)}
        </button>
      )}

      <Card>
        <div className="mb-3 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
          Bill breakdown · {formatMonthLabel(monthStr)}
        </div>
        <div className="flex flex-col gap-3.5">
          {bills.length === 0 && (
            <div className="text-[11.5px] font-semibold text-text-secondary">
              No bills generated for this month yet.
            </div>
          )}
          {bills.length > 0 &&
            sectionSummaries.map((s, i) => {
              const open = expandedSection === s.label;
              return (
                <div key={s.label} className={i > 0 ? "border-t border-border pt-3.5" : ""}>
                  <button
                    type="button"
                    onClick={() => setExpandedSection(open ? null : s.label)}
                    className="mb-1.5 flex w-full cursor-pointer items-center justify-between text-left"
                  >
                    <div className="text-[12px] font-extrabold">{SECTION_LABEL[s.label]}</div>
                    <Icon icon={open ? ChevronUp : ChevronDown} size={15} className="text-text-secondary" />
                  </button>
                  <div className="mb-1 flex flex-wrap items-center gap-4">
                    <div>
                      <div className="text-[9px] font-bold text-text-secondary">TOTAL RECEIVABLE</div>
                      <div className="text-[13px] font-extrabold">{formatBDT(s.receivable)}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold text-text-secondary">TOTAL RECEIVED</div>
                      <div className="text-[13px] font-extrabold text-primary">{formatBDT(s.received)}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold text-text-secondary">TOTAL DUE</div>
                      <div className="text-[13px] font-extrabold text-danger">{formatBDT(s.due)}</div>
                    </div>
                    {s.credit > 0 && (
                      <div>
                        <div className="text-[9px] font-bold text-text-secondary">TOTAL CREDIT</div>
                        <div className="text-[13px] font-extrabold text-blue">{formatBDT(s.credit)}</div>
                      </div>
                    )}
                  </div>
                  <div className="text-[9.5px] font-semibold text-text-secondary">{SECTION_NOTE[s.label]}</div>
                  {open && (
                    <div className="mt-2 flex flex-col gap-1.5 rounded-btn bg-bg p-2.5">
                      {s.members.map((m) => (
                        <div key={m.userId} className="flex items-center justify-between text-[11px] font-bold">
                          <div>{nameOf(m.userId)}</div>
                          <div className="flex items-center gap-2">
                            <div
                              className={
                                m.status === "due"
                                  ? "text-danger"
                                  : m.status === "credit"
                                    ? "text-blue"
                                    : "text-primary"
                              }
                            >
                              {m.status === "due"
                                ? `Due ${formatBDT(m.amount)}`
                                : m.status === "credit"
                                  ? `Credit ${formatBDT(m.amount)}`
                                  : "Paid"}
                            </div>
                            {s.label === "mealCost" && m.status === "credit" && (
                              <button
                                type="button"
                                onClick={() => setSettleUserId(m.userId)}
                                className="cursor-pointer rounded-pill bg-primary px-2.5 py-1 text-[10px] font-extrabold text-white"
                              >
                                Settle
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </Card>

      <div>
        <div className="mb-2 text-[13.5px] font-extrabold">
          All members · {formatMonthLabel(monthStr)}
        </div>
        <div className="flex flex-col gap-2">
          {bills.length === 0 && (
            <Card className="text-center text-[11.5px] font-semibold text-text-secondary">
              No bills generated for this month yet.
            </Card>
          )}
          {[...bills]
            .sort((a, b) => nameOf(a.userId).localeCompare(nameOf(b.userId)))
            .map((b) => {
              const room = roomOf(b.userId);
              const due = b.grandTotal - b.paid;
              const previousDue = b.previousBalance - b.previousBalancePaid;
              // A credit on one section (e.g. meal cost) can offset a due on another
              // (e.g. rent) in the aggregate total — check per-category so "Paid in
              // full" isn't shown while a specific part of the bill is still owed.
              const anyCategoryDue = previousDue > 0 || b.sections.some((s) => s.total - s.paid > 0);
              const open = expandedUserId === b.userId;
              return (
                <Card key={b.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedUserId(open ? null : b.userId)}
                    className="flex w-full cursor-pointer items-center gap-3 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-extrabold">{nameOf(b.userId)}</div>
                      <div className="text-[10px] font-semibold text-text-secondary">
                        {room ? `Room ${room.number}` : "Unassigned"} · {b.mealsCount} meals
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[9.5px] font-bold text-text-secondary">{formatMonthLabel(b.month)}</div>
                      <div className="text-[12.5px] font-extrabold">{formatBDT(b.grandTotal)}</div>
                      <div className={`text-[9.5px] font-bold ${due > 0 || anyCategoryDue ? "text-danger" : "text-primary"}`}>
                        {due > 0
                          ? `Due ${formatBDT(due)}`
                          : anyCategoryDue
                            ? "Due on some categories"
                            : "Paid in full"}
                      </div>
                    </div>
                    <Icon icon={open ? ChevronUp : ChevronDown} size={16} className="shrink-0 text-text-secondary" />
                  </button>

                  {open && (
                    <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                      {b.dueDate && (
                        <div className="flex items-center justify-between text-[11px] font-bold text-text-secondary">
                          <div>Last day of payment</div>
                          <div>{b.dueDate}</div>
                        </div>
                      )}
                      {previousDue > 0 && (
                        <div className="flex items-center justify-between text-[11px] font-bold text-orange">
                          <div>Previous balance ({formatMonthLabel(previousMonth(b.month))})</div>
                          <div>{formatBDT(previousDue)}</div>
                        </div>
                      )}
                      {previousDue < 0 && (
                        <div className="flex items-center justify-between text-[11px] font-bold text-primary">
                          <div>Previous credit (carried forward)</div>
                          <div>{formatBDT(-previousDue)}</div>
                        </div>
                      )}
                      {b.sections.map((s) => {
                        const sectionDue = s.total - s.paid;
                        return (
                          <div key={s.label}>
                            <div className="flex items-center justify-between text-[11px] font-bold">
                              <div>
                                {SECTION_LABEL[s.label]}{" "}
                                <span className="font-semibold text-text-secondary">
                                  · {formatMonthLabel(b.month)}
                                </span>
                              </div>
                              <div className="text-right">
                                <div>{formatBDT(s.total)}</div>
                                <div
                                  className={`text-[9px] font-bold ${
                                    sectionDue < 0
                                      ? "text-primary"
                                      : sectionDue > 0
                                        ? "text-danger"
                                        : "text-text-secondary"
                                  }`}
                                >
                                  {sectionDue < 0
                                    ? `Credit ${formatBDT(-sectionDue)}`
                                    : sectionDue > 0
                                      ? `Due ${formatBDT(sectionDue)}`
                                      : "Paid"}
                                </div>
                              </div>
                            </div>
                            {s.items.map((item, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between pl-2 text-[10px] font-semibold text-text-secondary"
                              >
                                <div>{item.label}</div>
                                <div>{formatBDT(item.amount)}</div>
                              </div>
                            ))}
                            {s.label === "mealCost" && previousDue > 0 && (
                              <div className="flex items-center justify-between pl-2 text-[10px] font-semibold text-orange">
                                <div>Previous month due ({formatMonthLabel(previousMonth(b.month))})</div>
                                <div>{formatBDT(previousDue)}</div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {(due > 0 || anyCategoryDue) && (
                        <button
                          type="button"
                          onClick={() => setPaymentTarget(b)}
                          className="mt-1 flex min-h-10 w-full cursor-pointer items-center justify-center rounded-btn bg-primary-soft text-[11.5px] font-extrabold text-primary"
                        >
                          Record a payment received
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setHistoryTarget({ userId: b.userId, name: nameOf(b.userId) })}
                        className="mt-1 flex min-h-10 w-full cursor-pointer items-center justify-center rounded-btn border border-border text-[11.5px] font-extrabold text-text-secondary"
                      >
                        Bill history — all months
                      </button>

                      <button
                        type="button"
                        onClick={() => shareOnWhatsApp(b)}
                        className="mt-1 flex min-h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-btn border border-border text-[11.5px] font-extrabold text-text-secondary"
                      >
                        <Icon icon={MessageCircle} size={14} /> Share on WhatsApp
                      </button>

                      {(due > 0 || anyCategoryDue) && canSuspendMeals && (
                        <button
                          type="button"
                          onClick={() => toggleSuspend(b.userId)}
                          className={`mt-1 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-btn text-[12px] font-extrabold ${
                            isSuspended(b.userId)
                              ? "bg-primary-soft text-primary"
                              : "bg-danger-soft text-danger"
                          }`}
                        >
                          <Icon icon={isSuspended(b.userId) ? Utensils : Ban} size={15} />
                          {isSuspended(b.userId) ? "Resume meals" : "Turn off meals until paid"}
                        </button>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
        </div>
      </div>

      <div>
        <div className="mb-2 text-[13.5px] font-extrabold">
          Shopping costs · {formatMonthLabel(monthStr)}
        </div>
        {shoppingCosts.length === 0 ? (
          <Card className="text-[11.5px] font-semibold text-text-secondary">
            No shopping costs recorded for this month.
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {[...shoppingCosts]
              .sort((a, b) => (a.dates[0] ?? "").localeCompare(b.dates[0] ?? ""))
              .map((c) => {
                const pendingEdit = costEdits.find(
                  (e) => e.costId === c.id && e.status === "pending"
                );
                return (
                  <Card key={c.id} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <div className="truncate text-[12px] font-extrabold">{nameOf(c.userId)}</div>
                        {c.addedByManager && (
                          <span className="rounded-pill bg-orange-soft px-1.5 py-0.5 text-[8px] font-extrabold text-orange">
                            Added by you
                          </span>
                        )}
                        {c.status === "pending" && (
                          <span className="rounded-pill bg-bg px-1.5 py-0.5 text-[8px] font-extrabold text-text-secondary">
                            Awaiting approval
                          </span>
                        )}
                      </div>
                      <div className="truncate text-[10px] font-semibold text-text-secondary">
                        {c.dates[0]}
                        {c.items ? ` · ${c.items}` : ""}
                      </div>
                      {pendingEdit && (
                        <div className="mt-0.5 text-[9.5px] font-bold text-orange">
                          Change to {formatBDT(pendingEdit.newAmount)} — members voting
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[12.5px] font-extrabold">{formatBDT(c.amount)}</div>
                      {pendingEdit ? (
                        <button
                          type="button"
                          onClick={() => {
                            repo.shoppingCostEdits.withdraw(pendingEdit.id);
                            toast("Edit request withdrawn");
                          }}
                          className="text-[10px] font-extrabold text-danger"
                        >
                          Withdraw
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditCost(c)}
                          className="text-[10px] font-extrabold text-primary"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </Card>
                );
              })}
          </div>
        )}
      </div>

      {formerMembers.length > 0 && (
        <div>
          <div className="mb-2 text-[13.5px] font-extrabold">Former members &mdash; settlements</div>
          <div className="flex flex-col gap-2">
            {formerMembers.map((u) => {
              const bill = formerBills[u.id];
              const balance = bill ? bill.grandTotal - bill.paid : 0;
              return (
                <Card key={u.id} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-extrabold">{u.name}</div>
                    <div className="text-[10px] font-semibold text-text-secondary">
                      {!bill
                        ? "No final bill yet"
                        : balance > 0
                          ? `Owes ${formatBDT(balance)}`
                          : balance < 0
                            ? `Hostel owes ${formatBDT(-balance)}`
                            : "Settled"}
                    </div>
                  </div>
                  {bill && balance > 0 && (
                    <button
                      type="button"
                      onClick={() => setPayFormer(bill)}
                      className="shrink-0 rounded-pill bg-primary px-3 py-1.5 text-[10.5px] font-extrabold text-white"
                    >
                      Record payment
                    </button>
                  )}
                  {bill && balance < 0 && (
                    <button
                      type="button"
                      onClick={() => setSettleFormer({ bill, name: u.name })}
                      className="shrink-0 rounded-pill bg-primary-soft px-3 py-1.5 text-[10.5px] font-extrabold text-primary"
                    >
                      Refund
                    </button>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 text-[13.5px] font-extrabold">Recent expenses</div>
        {expenses.length === 0 ? (
          <Card className="text-[11.5px] font-semibold text-text-secondary">No expenses recorded.</Card>
        ) : (
          <Card padded={false}>
            {[...expenses]
              .sort((a, b) => b.dateFrom.localeCompare(a.dateFrom))
              .map((e, i) => {
                const meta = CATEGORY_META[e.category] ?? DEFAULT_META;
                // Once this specific expense has been folded into a generated
                // bill (Utilities included as a service charge, or any Salary
                // expense), its amount is already baked into everyone's bill —
                // deleting it afterward would silently desync the two. Add a
                // new expense instead and regenerate bills to pick it up.
                // Expenses never used in a bill (Grocery, Others) stay
                // deletable even after bills exist for the month.
                const locked = !!e.billedAt;
                return (
                  <div
                    key={e.id}
                    className={`flex items-center gap-3 p-3 ${i > 0 ? "border-t border-border" : ""}`}
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.tone}`}>
                      <Icon icon={meta.icon} size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-extrabold">
                        {e.category}
                        {e.note ? ` — ${e.note}` : ""}
                      </div>
                      <div className="text-[10px] font-semibold text-text-secondary">
                        {e.dateFrom === e.dateTo ? e.dateFrom : `${e.dateFrom} → ${e.dateTo}`} ·{" "}
                        {e.splitMode === "fixed" ? "Fixed" : "Split equally"} · {e.memberIds.length} member
                        {e.memberIds.length === 1 ? "" : "s"}
                      </div>
                      {!e.dateFrom.startsWith(e.billingMonth) && (
                        <div className="text-[9.5px] font-bold text-orange">
                          Covers {formatMonthLabel(e.dateFrom.slice(0, 7))} · billed in{" "}
                          {formatMonthLabel(e.billingMonth)}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-[12px] font-extrabold">
                        {formatBDT(e.splitMode === "fixed" ? e.amount * e.memberIds.length : e.amount)}
                      </div>
                      {e.splitMode === "fixed" && e.memberIds.length > 1 && (
                        <div className="text-[9px] font-semibold text-text-secondary">
                          {formatBDT(e.amount)} × {e.memberIds.length}
                        </div>
                      )}
                    </div>
                    {locked ? (
                      <div
                        title="Already included in a generated bill — add a new expense and regenerate bills instead of deleting this one"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg text-text-secondary"
                      >
                        <Icon icon={Lock} size={13} />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          await repo.expenses.remove(e.id);
                          toast("Expense deleted");
                        }}
                        aria-label="Delete expense"
                        className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-danger-soft text-danger"
                      >
                        <Icon icon={Trash2} size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
          </Card>
        )}
      </div>

      <BillingInstructionsSheet open={instructionsOpen} onClose={() => setInstructionsOpen(false)} />
      <BillHistorySheet
        open={!!historyTarget}
        onClose={() => setHistoryTarget(null)}
        hostelId={activeHostelId}
        userId={historyTarget?.userId}
        name={historyTarget?.name}
      />
      <RecordPaymentSheet
        open={!!paymentTarget}
        onClose={() => setPaymentTarget(null)}
        bill={paymentTarget ?? undefined}
        memberName={paymentTarget ? nameOf(paymentTarget.userId) : undefined}
      />
      <AddExpenseSheet
        open={expenseSheetOpen}
        onClose={() => setExpenseSheetOpen(false)}
        hostelId={activeHostelId}
        month={monthStr}
      />
      <RecordShoppingCostSheet
        open={shoppingCostSheetOpen}
        onClose={() => setShoppingCostSheetOpen(false)}
        hostelId={activeHostelId}
      />
      <EditShoppingCostSheet
        open={!!editCost}
        onClose={() => setEditCost(null)}
        hostelId={activeHostelId}
        requestedBy={user?.id}
        cost={editCost ?? undefined}
        memberName={editCost ? nameOf(editCost.userId) : ""}
      />
      <GenerateBillsSheet
        open={generateSheetOpen}
        onClose={() => setGenerateSheetOpen(false)}
        hostelId={activeHostelId}
        month={monthStr}
        onGenerated={(count) => {
          refreshBills();
          toast(`Bills generated for ${count} member${count === 1 ? "" : "s"}`);
        }}
      />
      <SettleMealCreditSheet
        open={!!settleUserId}
        onClose={() => setSettleUserId(null)}
        bill={bills.find((b) => b.userId === settleUserId)}
        memberName={settleUserId ? nameOf(settleUserId) : ""}
        onSettled={refreshBills}
      />
      <SettleMealCreditSheet
        open={!!settleFormer}
        onClose={() => setSettleFormer(null)}
        bill={settleFormer?.bill}
        memberName={settleFormer?.name ?? ""}
        onSettled={loadFormerBills}
      />
      <PayBillSheet open={!!payFormer} onClose={() => setPayFormer(null)} bill={payFormer ?? undefined} />
    </div>
  );
}

// Owner-configured permission gate: real managers need the "finance" flag.
export default function GatedManagerFinancePage() {
  return (
    <PermissionGate permission="finance" label="Finance">
      <ManagerFinancePage />
    </PermissionGate>
  );
}

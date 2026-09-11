"use client";

import { useState } from "react";
import { ChefHat, Home, Sun, Wrench } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useBill } from "@/hooks/useBill";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { MonthNav } from "@/components/ui/MonthNav";
import { PayBillSheet } from "@/components/student/PayBillSheet";
import { BillHistorySheet } from "@/components/hostel/BillHistorySheet";
import { ActivityTimeline } from "@/components/hostel/ActivityTimeline";
import { PrintLetterhead } from "@/components/hostel/PrintLetterhead";
import { formatBDT } from "@/lib/utils/currency";
import { formatMonthLabel, formatShortDate, previousMonth } from "@/lib/utils/date";
import { printReport } from "@/lib/reports/export";
import type { BillSection, BillTarget } from "@/lib/data";

const SECTION_META: Record<BillSection["label"], { label: string; icon: typeof Sun; tone: string }> = {
  mealCost: { label: "Meal cost", icon: Sun, tone: "bg-orange-soft text-orange" },
  serviceCharge: { label: "Service charge", icon: Wrench, tone: "bg-blue-soft text-blue" },
  roomRent: { label: "Room rent", icon: Home, tone: "bg-[#7C6CF6]/10 text-[#7C6CF6]" },
  cookSalary: { label: "Cook salary", icon: ChefHat, tone: "bg-primary-soft text-primary" },
};

const TARGET_LABEL: Record<BillTarget, string> = {
  previousBalance: "Previous balance",
  previousMealBalance: "Previous meal balance",
  mealCost: "Meal cost",
  roomRent: "Room rent",
  serviceCharge: "Service charge",
  cookSalary: "Cook salary",
};

const METHOD_TONE: Record<string, string> = {
  bKash: "bg-primary-soft text-primary",
  Nagad: "bg-orange-soft text-orange",
  Card: "bg-blue-soft text-blue",
  Cash: "bg-bg text-text-secondary",
};

export default function StudentBillPage() {
  const { user, hostel, activeHostelId } = useSession();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const monthStr = `${year}-${String(month).padStart(2, "0")}`;
  const { bill, payments, adjustments } = useBill(activeHostelId, user?.id, monthStr);
  const [payOpen, setPayOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const monthNav = (
    <MonthNav
      value={monthStr}
      onChange={(ms) => {
        const [y, m] = ms.split("-").map(Number);
        setYear(y);
        setMonth(m);
      }}
    />
  );

  if (!bill) {
    return (
      <div className="flex flex-col gap-5 pt-2">
        <div className="text-[17.5px] font-extrabold tracking-tight">Bill</div>
        {monthNav}
        <Card className="text-center text-[11.5px] font-semibold text-text-secondary">
          No bill generated for {formatMonthLabel(monthStr)} yet.
        </Card>
        <ActivityTimeline hostelId={activeHostelId} category="bill" title="Bill activity" month={monthStr} />
      </div>
    );
  }

  const due = bill.grandTotal - bill.paid;
  const previousDue = bill.previousBalance - bill.previousBalancePaid;

  // Meal cost is its own account — members settle it live among themselves,
  // the hostel keeps no share — so it gets its own total, separate from
  // everything owed to the owner/utilities/cook (which also carries last
  // month's leftover balance, since that's a genuine cash position, not a
  // meal one). Two totals instead of one combined number that blurred the
  // two together.
  const mealSection = bill.sections.find((s) => s.label === "mealCost");
  const otherSections = bill.sections.filter((s) => s.label !== "mealCost");
  const mealThisMonthDue = (mealSection?.total ?? 0) - (mealSection?.paid ?? 0);
  // Nullish-guarded: a bill generated before this field existed won't have it
  // yet, until its month is regenerated.
  const previousMealDue = (bill.previousMealBalance ?? 0) - (bill.previousMealBalancePaid ?? 0);
  const finalMealDue = mealThisMonthDue + previousMealDue;
  // A category can still be owed even when the aggregate nets to a credit —
  // e.g. a big meal credit (once its carried balance is folded in) offsetting
  // rent that's still unpaid — so the pay button stays enabled whenever ANY
  // specific part of the bill is due, not just when the bill-wide total is.
  // Meal is checked by its FINAL balance, not just this month's raw section.
  const anyCategoryDue =
    previousDue > 0 || finalMealDue > 0 || otherSections.some((s) => s.total - s.paid > 0);
  const otherBillsTotal =
    otherSections.reduce((sum, s) => sum + Math.max(s.total, 0), 0) + bill.previousBalance;
  const otherBillsDue =
    otherBillsTotal - (otherSections.reduce((sum, s) => sum + s.paid, 0) + bill.previousBalancePaid);

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="text-[17.5px] font-extrabold tracking-tight">{formatMonthLabel(bill.month)} Bill</div>

      {monthNav}

      <div className="invoice-print-area flex flex-col gap-5">
      {/* Print-only payslip — a clean document instead of the app's own
          colorful cards, so "Print / Save as PDF" produces something that
          reads as a real financial record. */}
      <div className="hidden rounded-card border border-border bg-card p-5 print:block print:border-0 print:p-0">
        <PrintLetterhead
          hostelName={hostel?.name}
          title="Payslip"
          meta={[`Bill #${bill.id.slice(-10).toUpperCase()}`, formatMonthLabel(bill.month), user?.name ?? ""]}
        />
        <div className="mb-4 flex flex-col gap-0.5">
          <div className="grid grid-cols-[1fr_auto] gap-2 border-b border-border pb-2 text-[9px] font-extrabold uppercase tracking-wide text-text-secondary">
            <div>Description</div>
            <div className="text-right">Amount</div>
          </div>
          {bill.sections.map((section) => (
            <div key={section.label} className="border-b border-border py-1.5">
              <div className="flex items-center justify-between text-[10.5px] font-extrabold">
                <span>{SECTION_META[section.label].label}</span>
                <span>{formatBDT(Math.abs(section.total))}</span>
              </div>
              {section.items.map((item, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_auto] gap-2 pl-2 text-[10px] text-text-secondary"
                >
                  <div>{item.label}</div>
                  <div className="text-right">
                    {item.amount < 0 ? "−" : ""}
                    {formatBDT(Math.abs(item.amount))}
                  </div>
                </div>
              ))}
            </div>
          ))}
          {previousDue !== 0 && (
            <div className="flex items-center justify-between border-b border-border py-1.5 text-[10.5px] font-extrabold">
              <span>{previousDue > 0 ? "Previous balance" : "Previous credit"}</span>
              <span>{formatBDT(Math.abs(previousDue))}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5 border-t border-border pt-3">
          <div className="flex justify-between text-[14px] font-extrabold">
            <span>{bill.grandTotal < 0 ? "Total credit" : "Total"}</span>
            <span>{formatBDT(Math.abs(bill.grandTotal))}</span>
          </div>
          <div className="flex justify-between text-[11px] font-semibold text-text-secondary">
            <span>Paid</span>
            <span>{formatBDT(bill.paid)}</span>
          </div>
          <div className="flex justify-between text-[12px] font-extrabold">
            <span>{due < 0 ? "Credit" : "Due"}</span>
            <span>{formatBDT(Math.abs(due))}</span>
          </div>
        </div>
        <div className="mt-4 text-[9px] font-semibold text-text-secondary">
          Generated {new Date().toLocaleDateString()} · MyDorm
        </div>
      </div>

      {/* On-screen app UI — hidden when printing */}
      <div className="flex flex-col gap-5 print:hidden">
      <div
        className="rounded-card p-5 text-white"
        style={{
          background: "linear-gradient(135deg, var(--gradient-accent-from), var(--gradient-accent-to))",
        }}
      >
        <div className="text-[11.5px] font-bold text-white/70">
          {bill.grandTotal < 0 ? "Total credit" : "Total payable"}
        </div>
        <div className="mt-1 text-[22px] font-extrabold">{formatBDT(Math.abs(bill.grandTotal))}</div>
        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          <div className="text-[11.5px] font-bold text-white/80">Paid {formatBDT(bill.paid)}</div>
          {due > 0 && (
            <div className="rounded-pill bg-white/20 px-2.5 py-1 text-[10px] font-extrabold">
              Due {formatBDT(due)}
            </div>
          )}
          {bill.dueDate && due > 0 && (
            <div className="rounded-pill bg-white/20 px-2.5 py-1 text-[10px] font-extrabold">
              Pay by {formatShortDate(bill.dueDate)}
            </div>
          )}
        </div>
      </div>

      {/* MEAL — its own account, settled live among members; the hostel
          keeps no share of it. */}
      <Card>
        <div className="mb-2 flex items-center gap-2.5">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full ${SECTION_META.mealCost.tone}`}>
            <Icon icon={SECTION_META.mealCost.icon} size={15} />
          </div>
          <div className="text-[13.5px] font-extrabold">Meal</div>
        </div>
        <div className="flex flex-col gap-1.5 pl-[42px]">
          {mealSection?.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-[11px] font-semibold text-text-secondary">
              <div>{item.label}</div>
              <div>
                {item.amount < 0 ? "−" : ""}
                {formatBDT(Math.abs(item.amount))}
              </div>
            </div>
          ))}
          <div className="mt-1 flex items-center justify-between border-t border-border pt-1.5 text-[12px] font-extrabold">
            <div>{formatMonthLabel(bill.month)} meal balance</div>
            <div className={mealThisMonthDue > 0 ? "text-danger" : "text-primary"}>
              {mealThisMonthDue > 0
                ? `Due ${formatBDT(mealThisMonthDue)}`
                : `Credit ${formatBDT(-mealThisMonthDue)}`}
            </div>
          </div>
          {previousMealDue !== 0 && (
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <div className="text-text-secondary">
                Previous month ({formatMonthLabel(previousMonth(bill.month))})
              </div>
              <div className={previousMealDue > 0 ? "text-danger" : "text-primary"}>
                {previousMealDue > 0
                  ? `Due ${formatBDT(previousMealDue)}`
                  : `Credit ${formatBDT(-previousMealDue)}`}
              </div>
            </div>
          )}
          <div className="mt-1 flex items-center justify-between border-t border-border pt-1.5 text-[13px] font-extrabold">
            <div>Final meal balance</div>
            <div className={finalMealDue > 0 ? "text-danger" : "text-primary"}>
              {finalMealDue > 0 ? `Due ${formatBDT(finalMealDue)}` : `Credit ${formatBDT(-finalMealDue)}`}
            </div>
          </div>
        </div>
      </Card>

      {/* SERVICE, RENT & SALARY — owed to the owner/utilities/cook, kept in
          its own bucket so a meal credit/due can never silently offset it,
          or vice versa. */}
      <Card>
        <div className="mb-2 text-[13.5px] font-extrabold">Service, Rent &amp; Salary</div>
        <div className="flex flex-col gap-3">
          {otherSections.map((section) => {
            const meta = SECTION_META[section.label];
            const sectionDue = section.total - section.paid;
            return (
              <div key={section.label} className="flex items-start gap-2.5">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.tone}`}>
                  <Icon icon={meta.icon} size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-[12px] font-extrabold">
                    <div>{meta.label}</div>
                    <div
                      className={
                        sectionDue < 0 ? "text-primary" : sectionDue > 0 ? "text-danger" : "text-text-secondary"
                      }
                    >
                      {formatBDT(Math.abs(section.total))}
                    </div>
                  </div>
                  {section.items.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-[10.5px] font-semibold text-text-secondary"
                    >
                      <div>{item.label}</div>
                      <div>
                        {item.amount < 0 ? "−" : ""}
                        {formatBDT(Math.abs(item.amount))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {previousDue !== 0 && (
            <div className="flex items-center justify-between text-[11.5px] font-semibold">
              <div className="text-text-secondary">
                Previous {previousDue > 0 ? "balance" : "credit"} ({formatMonthLabel(previousMonth(bill.month))})
              </div>
              <div className={previousDue > 0 ? "text-danger" : "text-primary"}>
                {formatBDT(Math.abs(previousDue))}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border pt-2 text-[13px] font-extrabold">
            <div>Total</div>
            <div>{formatBDT(Math.abs(otherBillsTotal))}</div>
          </div>
          <div className={`text-[11px] font-bold ${otherBillsDue > 0 ? "text-danger" : "text-primary"}`}>
            {otherBillsDue > 0
              ? `Due ${formatBDT(otherBillsDue)}`
              : otherBillsDue < 0
                ? `Credit ${formatBDT(-otherBillsDue)}`
                : "Paid in full"}
          </div>
        </div>
      </Card>

      <Card className="flex items-center justify-between bg-primary-soft">
        <div className="text-[13.5px] font-extrabold text-primary">Grand total</div>
        <div className="text-[15px] font-extrabold text-primary">{formatBDT(Math.abs(bill.grandTotal))}</div>
      </Card>
      </div>
      </div>

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={() => setPayOpen(true)}
          disabled={due <= 0 && !anyCategoryDue}
          className="min-h-11 flex-1 cursor-pointer rounded-btn font-extrabold text-white disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, var(--gradient-accent-from), var(--gradient-accent-to))" }}
        >
          Pay now
        </button>
        <button
          type="button"
          onClick={() => printReport()}
          className="min-h-11 cursor-pointer rounded-btn border border-border px-6 font-extrabold"
        >
          PDF
        </button>
      </div>

      <button
        type="button"
        onClick={() => setHistoryOpen(true)}
        className="min-h-11 w-full cursor-pointer rounded-btn border border-border text-[12px] font-extrabold text-text-secondary"
      >
        Bill history — all months
      </button>

      <div>
        <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
          Payment history
        </div>
        <div className="flex flex-col gap-2">
          {payments.length === 0 && (
            <Card className="text-[11.5px] font-semibold text-text-secondary">No payments yet.</Card>
          )}
          {payments.map((p) => (
            <Card key={p.id} className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[9.5px] font-extrabold ${METHOD_TONE[p.method]}`}
              >
                {p.method.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-extrabold">{formatBDT(p.amount)}</div>
                <div className="text-[10px] font-semibold text-text-secondary">
                  For {p.targets.map((t) => TARGET_LABEL[t]).join(", ")} ·{" "}
                  {new Date(p.paidAt).toLocaleDateString()}
                  {p.reference ? ` · ${p.reference}` : ""}
                  {p.senderNumber ? ` · ${p.senderNumber}` : ""}
                </div>
              </div>
              <div
                className={`rounded-pill px-2.5 py-1 text-[9.5px] font-extrabold ${
                  p.verified ? "bg-primary-soft text-primary" : "bg-orange-soft text-orange"
                }`}
              >
                {p.verified ? "Verified" : "Pending"}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {adjustments.length > 0 && (
        <div>
          <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
            Meal credit settlements
          </div>
          <div className="flex flex-col gap-2">
            {adjustments.map((a) => (
              <Card key={a.id} className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Icon icon={a.kind === "refund" ? Home : Wrench} size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-extrabold">{formatBDT(a.amount)}</div>
                  <div className="text-[10px] font-semibold text-text-secondary">
                    {a.kind === "refund"
                      ? "Refunded in cash"
                      : `Adjusted to ${TARGET_LABEL[a.to ?? "mealCost"]}`}{" "}
                    · {new Date(a.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Who recorded/verified payments & bill changes, and when */}
      <ActivityTimeline hostelId={activeHostelId} category="bill" title="Bill activity" month={monthStr} />

      <PayBillSheet open={payOpen} onClose={() => setPayOpen(false)} bill={bill} />
      <BillHistorySheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        hostelId={activeHostelId}
        userId={user?.id}
      />
    </div>
  );
}

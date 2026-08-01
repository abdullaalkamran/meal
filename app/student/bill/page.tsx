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
  const { user, activeHostelId } = useSession();
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
      </div>
    );
  }

  const due = bill.grandTotal - bill.paid;
  const previousDue = bill.previousBalance - bill.previousBalancePaid;
  // A category can still be owed even when the aggregate nets to a credit —
  // e.g. a big meal-cost credit offsetting rent that's still unpaid — so the
  // pay button stays enabled whenever ANY specific part of the bill is due,
  // not just when the bill-wide total is.
  const anyCategoryDue = previousDue > 0 || bill.sections.some((s) => s.total - s.paid > 0);

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="text-[17.5px] font-extrabold tracking-tight">{formatMonthLabel(bill.month)} Bill</div>

      {monthNav}

      <div className="report-print-area flex flex-col gap-5">
      <div className="hidden text-[13px] font-extrabold print:block">
        {formatMonthLabel(bill.month)} Bill · {user?.name}
      </div>

      <div
        className="rounded-card p-5 text-white"
        style={{
          background: "linear-gradient(135deg, var(--gradient-accent-from), var(--gradient-accent-to))",
        }}
      >
        <div className="text-[11.5px] font-bold text-white/70">Total payable</div>
        <div className="mt-1 text-[22px] font-extrabold">{formatBDT(bill.grandTotal)}</div>
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

      {previousDue > 0 && (
        <Card className="flex items-center justify-between border border-orange/30 bg-orange-soft">
          <div>
            <div className="text-[12.5px] font-extrabold text-orange">Previous balance</div>
            <div className="text-[10px] font-semibold text-text-secondary">
              Unpaid amount carried over from {formatMonthLabel(previousMonth(bill.month))}
            </div>
          </div>
          <div className="text-[13.5px] font-extrabold text-orange">{formatBDT(previousDue)}</div>
        </Card>
      )}

      {previousDue < 0 && (
        <Card className="flex items-center justify-between border border-primary/30 bg-primary-soft">
          <div>
            <div className="text-[12.5px] font-extrabold text-primary">Previous credit</div>
            <div className="text-[10px] font-semibold text-text-secondary">
              Carried over from an earlier month — it reduces this bill
            </div>
          </div>
          <div className="text-[13.5px] font-extrabold text-primary">{formatBDT(-previousDue)}</div>
        </Card>
      )}

      {bill.sections.map((section) => {
        const meta = SECTION_META[section.label];
        const sectionDue = section.total - section.paid;
        return (
          <Card key={section.label}>
            <div className="mb-2 flex items-center gap-2.5">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${meta.tone}`}>
                <Icon icon={meta.icon} size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-extrabold">{meta.label}</div>
                <div className="text-[9.5px] font-bold text-text-secondary">{formatMonthLabel(bill.month)}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[13.5px] font-extrabold">{formatBDT(section.total)}</div>
                <div
                  className={`text-[9.5px] font-bold ${
                    sectionDue < 0 ? "text-primary" : sectionDue > 0 ? "text-danger" : "text-text-secondary"
                  }`}
                >
                  {sectionDue < 0
                    ? `Credit ${formatBDT(-sectionDue)}`
                    : sectionDue > 0
                      ? `Due ${formatBDT(sectionDue)}`
                      : "Paid in full"}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 pl-[42px]">
              {section.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-[11px] font-semibold text-text-secondary">
                  <div>{item.label}</div>
                  <div>{formatBDT(item.amount)}</div>
                </div>
              ))}
              {section.label === "mealCost" && previousDue > 0 && (
                <div className="flex items-center justify-between text-[11px] font-semibold text-orange">
                  <div>Previous month due ({formatMonthLabel(previousMonth(bill.month))})</div>
                  <div>{formatBDT(previousDue)}</div>
                </div>
              )}
            </div>
          </Card>
        );
      })}

      <Card className="flex items-center justify-between">
        <div className="text-[13.5px] font-extrabold">Total</div>
        <div className="text-[15px] font-extrabold">{formatBDT(bill.grandTotal)}</div>
      </Card>
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

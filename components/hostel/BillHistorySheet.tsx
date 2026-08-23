"use client";

import { Sheet } from "@/components/ui/Sheet";
import { useBillHistory } from "@/hooks/useBillHistory";
import type { BillSection } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";
import { formatMonthLabel, previousMonth } from "@/lib/utils/date";

const SECTION_LABEL: Record<BillSection["label"], string> = {
  mealCost: "Meal cost",
  roomRent: "Room rent",
  serviceCharge: "Service charge",
  cookSalary: "Cook salary",
};

const SECTION_ORDER: BillSection["label"][] = ["mealCost", "roomRent", "serviceCharge", "cookSalary"];

/** Every past month's bill for one member, at a glance — rent, meal cost, and
 * every other section's paid/due status, so nobody has to page back through
 * MonthNav one month at a time to see how a member's billing history looks. */
export function BillHistorySheet({
  open,
  onClose,
  hostelId,
  userId,
  name,
}: {
  open: boolean;
  onClose: () => void;
  hostelId: string | undefined;
  userId: string | undefined;
  name?: string;
}) {
  const history = useBillHistory(hostelId, userId);

  return (
    <Sheet open={open} onClose={onClose} title={name ? `Bill history · ${name}` : "Bill history"}>
      {history.length === 0 ? (
        <div className="py-6 text-center text-[11.5px] font-semibold text-text-secondary">
          No bills generated yet.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {history.map((b) => {
            const due = b.grandTotal - b.paid;
            const previousDue = b.previousBalance - b.previousBalancePaid;
            const anyCategoryDue = previousDue > 0 || b.sections.some((s) => s.total - s.paid > 0);
            return (
              <div key={b.id} className="rounded-btn border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[12.5px] font-extrabold">{formatMonthLabel(b.month)}</div>
                  <div
                    className={`rounded-pill px-2.5 py-1 text-[9.5px] font-extrabold ${
                      due > 0 || anyCategoryDue
                        ? "bg-danger-soft text-danger"
                        : due < 0
                          ? "bg-primary-soft text-primary"
                          : "bg-bg text-text-secondary"
                    }`}
                  >
                    {due > 0
                      ? `Due ${formatBDT(due)}`
                      : due < 0
                        ? `Credit ${formatBDT(-due)}`
                        : anyCategoryDue
                          ? "Due on some categories"
                          : "Paid in full"}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  {SECTION_ORDER.map((label) => {
                    const s = b.sections.find((x) => x.label === label);
                    if (!s) return null;
                    const sectionDue = s.total - s.paid;
                    return (
                      <div key={label} className="flex items-center justify-between text-[10.5px] font-semibold">
                        <div className="text-text-secondary">{SECTION_LABEL[label]}</div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-text">{formatBDT(Math.abs(s.total))}</span>
                          <span
                            className={
                              sectionDue > 0 ? "text-danger" : sectionDue < 0 ? "text-primary" : "text-text-secondary"
                            }
                          >
                            {sectionDue > 0 ? `(due ${formatBDT(sectionDue)})` : sectionDue < 0 ? "(credit)" : "(paid)"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {b.previousBalance !== 0 && (
                    <div className="flex items-center justify-between text-[10.5px] font-semibold">
                      <div className="text-text-secondary">Previous balance ({formatMonthLabel(previousMonth(b.month))})</div>
                      <div className={`font-extrabold ${previousDue > 0 ? "text-danger" : previousDue < 0 ? "text-primary" : ""}`}>
                        {formatBDT(b.previousBalance)}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-[11px] font-bold">
                  <div>Total {formatBDT(b.grandTotal)}</div>
                  <div className="text-text-secondary">Paid {formatBDT(b.paid)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}

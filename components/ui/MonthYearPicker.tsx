"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Sheet } from "./Sheet";
import { Icon } from "./Icon";
import { currentMonth } from "@/lib/utils/date";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Mobile-friendly month/year picker rendered as a bottom sheet (modal on
 * desktop). A year stepper plus a 12-month grid — future months beyond
 * `maxMonth` are disabled so you can only browse the current and past months.
 */
export function MonthYearPicker({
  open,
  onClose,
  value,
  onChange,
  maxMonth = currentMonth(),
  minYear,
}: {
  open: boolean;
  onClose: () => void;
  value: string; // YYYY-MM
  onChange: (monthStr: string) => void;
  /** Latest selectable month (YYYY-MM); later months are disabled. */
  maxMonth?: string;
  /** Earliest year the stepper can go back to. Defaults to 5 years back. */
  minYear?: number;
}) {
  const [selYear, selMonth] = value.split("-").map(Number);
  const [maxYear, maxMon] = maxMonth.split("-").map(Number);
  const floorYear = minYear ?? maxYear - 5;
  const [viewYear, setViewYear] = useState(selYear);

  useEffect(() => {
    if (open) queueMicrotask(() => setViewYear(selYear));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value]);

  const pick = (monthIndex: number) => {
    const ms = `${viewYear}-${String(monthIndex + 1).padStart(2, "0")}`;
    if (ms > maxMonth) return;
    onChange(ms);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Select month">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setViewYear((y) => Math.max(floorYear, y - 1))}
          disabled={viewYear <= floorYear}
          aria-label="Previous year"
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-bg text-text-secondary disabled:opacity-40"
        >
          <Icon icon={ChevronLeft} size={18} />
        </button>
        <div className="text-[16px] font-extrabold">{viewYear}</div>
        <button
          type="button"
          onClick={() => setViewYear((y) => Math.min(maxYear, y + 1))}
          disabled={viewYear >= maxYear}
          aria-label="Next year"
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-bg text-text-secondary disabled:opacity-40"
        >
          <Icon icon={ChevronRight} size={18} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {MONTH_ABBR.map((label, i) => {
          const disabled = viewYear > maxYear || (viewYear === maxYear && i + 1 > maxMon);
          const selected = viewYear === selYear && i + 1 === selMonth;
          return (
            <button
              key={label}
              type="button"
              disabled={disabled}
              onClick={() => pick(i)}
              className={`min-h-11 rounded-btn text-[12.5px] font-extrabold transition-colors ${
                selected
                  ? "bg-primary text-white"
                  : disabled
                    ? "bg-bg text-text-secondary opacity-40"
                    : "bg-bg text-text hover:bg-primary-soft"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

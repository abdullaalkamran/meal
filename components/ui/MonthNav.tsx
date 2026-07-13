"use client";

import { useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "./Card";
import { Icon } from "./Icon";
import { MonthYearPicker } from "./MonthYearPicker";
import { addMonths, currentMonth, formatMonthLabel } from "@/lib/utils/date";

/**
 * The standard month filter: ‹ prev, a tappable month label that opens a
 * calendar month/year picker, and next › (disabled once at `maxMonth`).
 * Used across the finance, bill, and member-profile detail screens.
 */
export function MonthNav({
  value,
  onChange,
  maxMonth = currentMonth(),
}: {
  value: string; // YYYY-MM
  onChange: (monthStr: string) => void;
  maxMonth?: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const atMax = value >= maxMonth;

  return (
    <Card className="flex items-center justify-between">
      <button
        type="button"
        onClick={() => onChange(addMonths(value, -1))}
        aria-label="Previous month"
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-bg"
      >
        <Icon icon={ChevronLeft} size={16} />
      </button>
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="flex cursor-pointer items-center gap-1.5"
        aria-label="Pick month"
      >
        <Icon icon={Calendar} size={13} className="text-text-secondary" />
        <span className="text-[13px] font-extrabold">{formatMonthLabel(value)}</span>
      </button>
      <button
        type="button"
        onClick={() => !atMax && onChange(addMonths(value, 1))}
        disabled={atMax}
        aria-label="Next month"
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-bg disabled:opacity-40"
      >
        <Icon icon={ChevronRight} size={16} />
      </button>
      <MonthYearPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        value={value}
        onChange={onChange}
        maxMonth={maxMonth}
      />
    </Card>
  );
}

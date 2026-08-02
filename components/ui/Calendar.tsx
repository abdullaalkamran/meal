"use client";

import { useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { clsx } from "clsx";
import { Icon } from "./Icon";
import { today } from "@/lib/utils/date";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const MONTHS_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

interface CalendarProps {
  year: number;
  month: number; // 1-12
  onMonthChange: (year: number, month: number) => void;
  selectedDate?: string;
  rangeStart?: string;
  rangeEnd?: string;
  onSelectDate: (date: string) => void;
  renderDots?: (date: string) => React.ReactNode;
  /** Extra classes for a specific date's cell (e.g. a fill colour for days a
   * member's meals are off) — applied only when the cell isn't selected/in a
   * range, so those states still win. */
  dayClass?: (date: string) => string | undefined;
}

export function Calendar({
  year,
  month,
  onMonthChange,
  selectedDate,
  rangeStart,
  rangeEnd,
  onSelectDate,
  renderDots,
  dayClass,
}: CalendarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const todayStr = today();

  // Step by one month, rolling the year over at the ends — so the arrows read
  // as "previous month / next month", the pattern people expect from a
  // calendar (the old arrows stepped the YEAR, which was the confusing part).
  const stepMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    onMonthChange(y, m);
  };

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div>
      {/* Month + year with previous/next-month arrows; tap the label to jump */}
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => stepMonth(-1)}
          aria-label="Previous month"
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-border"
        >
          <Icon icon={ChevronLeft} size={16} />
        </button>
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          className="flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-[14px] font-extrabold"
        >
          {MONTHS_FULL[month - 1]} {year}
          <Icon
            icon={ChevronDown}
            size={15}
            className={clsx("text-text-secondary transition-transform", pickerOpen && "rotate-180")}
          />
        </button>
        <button
          type="button"
          onClick={() => stepMonth(1)}
          aria-label="Next month"
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-border"
        >
          <Icon icon={ChevronRight} size={16} />
        </button>
      </div>

      {/* Tap-to-open jump panel: pick a year, then any month — all 12 visible */}
      {pickerOpen && (
        <div className="mb-3 rounded-card border border-border bg-bg/60 p-3">
          <div className="mb-2.5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => onMonthChange(year - 1, month)}
              aria-label="Previous year"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-border bg-card"
            >
              <Icon icon={ChevronLeft} size={14} />
            </button>
            <div className="text-[13px] font-extrabold">{year}</div>
            <button
              type="button"
              onClick={() => onMonthChange(year + 1, month)}
              aria-label="Next year"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-border bg-card"
            >
              <Icon icon={ChevronRight} size={14} />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {MONTHS.map((m, i) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  onMonthChange(year, i + 1);
                  setPickerOpen(false);
                }}
                className={clsx(
                  "cursor-pointer rounded-pill py-2 text-[11px] font-extrabold transition-colors",
                  month === i + 1 ? "bg-primary text-white" : "bg-card text-text-secondary"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-1.5 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w, i) => (
          <div
            key={i}
            className="text-center text-[9.5px] font-extrabold text-text-secondary"
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`blank-${i}`} />;
          const dateStr = toDateStr(year, month, day);
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const inRange =
            rangeStart && rangeEnd && dateStr >= rangeStart && dateStr <= rangeEnd;
          const isRangeEdge = dateStr === rangeStart || dateStr === rangeEnd;
          const tone = dayClass?.(dateStr);

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onSelectDate(dateStr)}
              className={clsx(
                "flex h-11 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-btn text-[11px] font-bold",
                isSelected || isRangeEdge
                  ? "bg-primary text-white"
                  : inRange
                    ? "bg-primary-soft text-primary"
                    : tone
                      ? clsx(tone, isToday && "border border-primary")
                      : isToday
                        ? "border border-primary text-primary"
                        : "text-text"
              )}
            >
              {day}
              {renderDots?.(dateStr)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

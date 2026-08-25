"use client";

import { useEffect, useState } from "react";

const DAY_NAMES = [
  "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY",
  "THURSDAY", "FRIDAY", "SATURDAY",
];
const MONTH_NAMES = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

const ACCENT = "#a78bfa"; // violet — day name / month, matching the dial's hue
const HAND_BLUE = "#60a5fa";
const HAND_VIOLET = "#a78bfa";

/** One split-flap digit — keyed by its own value so React remounts (and so
 * replays the CSS flip-in animation) every time it actually changes. */
function FlipDigit({ value }: { value: string }) {
  return (
    <span
      key={value}
      className="flip-digit inline-flex h-7 w-[19px] items-center justify-center rounded-[4px] font-mono text-[22px] font-extrabold leading-none tabular-nums text-white [transform-style:preserve-3d]"
      style={{ animation: "flipDigit 0.35s ease-out" }}
    >
      {value}
    </span>
  );
}

/** Small glowing analog dial — hour/minute hands driven by the same clock,
 * a thin second hand for a bit of continuous motion. */
function AnalogDial({ now }: { now: Date }) {
  const hours = now.getHours() % 12;
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const hourAngle = (hours + minutes / 60) * 30;
  const minuteAngle = (minutes + seconds / 60) * 6;
  const secondAngle = seconds * 6;
  const point = (angle: number, r: number) => {
    const rad = (angle * Math.PI) / 180;
    return [50 + r * Math.sin(rad), 50 - r * Math.cos(rad)] as const;
  };
  const [hx, hy] = point(hourAngle, 20);
  const [mx, my] = point(minuteAngle, 30);
  const [sx, sy] = point(secondAngle, 33);

  return (
    <svg width="52" height="52" viewBox="0 0 100 100" className="shrink-0">
      <defs>
        <linearGradient id="dialGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={HAND_VIOLET} />
          <stop offset="100%" stopColor={HAND_BLUE} />
        </linearGradient>
        <filter id="dialGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="50" cy="50" r="47" fill="#050714" fillOpacity="0.7" stroke="url(#dialGrad)" strokeOpacity="0.55" strokeWidth="1.8" />
      {Array.from({ length: 12 }).map((_, i) => {
        const major = i % 3 === 0;
        const [x1, y1] = point(i * 30, 38);
        const [x2, y2] = point(i * 30, major ? 44 : 42);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="url(#dialGrad)"
            strokeWidth={major ? 2.6 : 1.4}
            strokeLinecap="round"
            opacity={major ? 1 : 0.6}
          />
        );
      })}
      <line x1="50" y1="50" x2={hx} y2={hy} stroke={HAND_BLUE} strokeWidth="4" strokeLinecap="round" filter="url(#dialGlow)" />
      <line x1="50" y1="50" x2={mx} y2={my} stroke={HAND_VIOLET} strokeWidth="3" strokeLinecap="round" filter="url(#dialGlow)" />
      <line x1="50" y1="50" x2={sx} y2={sy} stroke="#e0e7ff" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
      <circle cx="50" cy="50" r="3.2" fill={HAND_BLUE} filter="url(#dialGlow)" />
    </svg>
  );
}

/** Sticky dashboard-style clock — day/time on the left, date on the right of
 * a divider, a glowing analog dial furthest right. Pinned under the header
 * on every authenticated screen. */
export function StickyFlipClock() {
  // Renders nothing until mounted client-side, so the server-rendered HTML
  // (which has no "now") never mismatches the browser's actual clock.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    queueMicrotask(() => setNow(new Date()));
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!now) return null;

  const hours24 = now.getHours();
  const hh = String(hours24 % 12 || 12).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ampm = hours24 >= 12 ? "PM" : "AM";
  const dayName = DAY_NAMES[now.getDay()];
  const date = String(now.getDate()).padStart(2, "0");
  const month = MONTH_NAMES[now.getMonth()];
  const year = now.getFullYear();

  return (
    <div
      className="sticky top-0 z-40 flex items-center justify-between gap-4 px-5 py-2.5 shadow-md print:hidden md:px-8"
      style={{
        background:
          "radial-gradient(circle at 92% 8%, rgba(139,92,246,0.28), transparent 60%), linear-gradient(135deg, #05060f, #131a3e)",
      }}
    >
      <div className="flex items-center gap-4">
        <div>
          <div
            className="text-[9px] font-extrabold uppercase tracking-[0.15em]"
            style={{ color: ACCENT }}
          >
            {dayName}
          </div>
          <div className="flex items-baseline gap-1">
            <FlipDigit value={hh[0]} />
            <FlipDigit value={hh[1]} />
            <span className="text-[22px] font-extrabold leading-none text-white">:</span>
            <FlipDigit value={mm[0]} />
            <FlipDigit value={mm[1]} />
            <span className="ml-0.5 text-[10px] font-extrabold text-white/60">{ampm}</span>
          </div>
        </div>

        <div className="h-9 w-px bg-white/15" />

        <div>
          <div className="text-[20px] font-extrabold leading-none text-white">{date}</div>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className="text-[9px] font-extrabold uppercase tracking-wide" style={{ color: ACCENT }}>
              {month}
            </span>
            <span className="text-[8.5px] font-bold text-white/50">{year}</span>
          </div>
        </div>
      </div>

      <AnalogDial now={now} />
    </div>
  );
}

"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { hostelNow, toISODate } from "@/lib/utils/date";
import { subscribe, getSnapshot, getServerSnapshot } from "@/lib/clock/selectedDate";

const DAY_NAMES = [
  "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY",
  "THURSDAY", "FRIDAY", "SATURDAY",
];
const MONTH_NAMES = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

const ACCENT = "#a78bfa"; // violet — day name / month, matching the dial's hue
const VIEWING_ACCENT = "#2dd4bf"; // teal — the announced "selected date" block
const HAND_BLUE = "#60a5fa";
const HAND_VIOLET = "#a78bfa";

/** One split-flap digit — keyed by its own value so React remounts (and so
 * replays the CSS flip-in animation) every time it actually changes. */
function FlipDigit({ value }: { value: string }) {
  return (
    <span
      key={value}
      className="flip-digit inline-flex h-7 w-[15px] items-center justify-center text-[24px] font-black leading-none tabular-nums text-white [transform-style:preserve-3d]"
      style={{ animation: "flipDigit 0.35s ease-out" }}
    >
      {value}
    </span>
  );
}

/** Small glowing analog dial — hour/minute hands driven by the same clock,
 * a thin second hand for a bit of continuous motion. */
function AnalogDial({ now }: { now: Date }) {
  // `now` is hostelNow()-shifted (see the component below) — its UTC fields
  // read as hostel-local wall time, so every extraction here uses getUTC*,
  // never the browser's own local getters.
  const hours = now.getUTCHours() % 12;
  const minutes = now.getUTCMinutes();
  const seconds = now.getUTCSeconds();
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
  // A page (e.g. the meals calendar) can announce which date it's showing —
  // see hooks/useAnnounceClockDate. null when no page has announced one.
  const selectedIso = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    // hostelNow(), not new Date() — this clock is a shared, hostel-wide
    // display, so it shows the hostel's own wall time/date regardless of
    // which timezone the viewer's device happens to be set to (the same
    // reasoning `today()`/`hostelNow()` already apply everywhere else that
    // decides "what day is it" for meal cutoffs/sealing).
    queueMicrotask(() => setNow(hostelNow()));
    const timer = setInterval(() => setNow(hostelNow()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!now) return null;

  // hostelNow() shifts the timestamp so its UTC fields read as hostel-local
  // wall time — every read below uses getUTC*, never the browser's own
  // local getters (mixing the two would double-apply an offset).
  const hours24 = now.getUTCHours();
  const hh = String(hours24 % 12 || 12).padStart(2, "0");
  const mm = String(now.getUTCMinutes()).padStart(2, "0");
  const ampm = hours24 >= 12 ? "PM" : "AM";
  const dayName = DAY_NAMES[now.getUTCDay()];
  const date = String(now.getUTCDate()).padStart(2, "0");
  const month = MONTH_NAMES[now.getUTCMonth()];
  const year = now.getUTCFullYear();
  const todayIso = toISODate(now);

  // Only worth showing when it actually differs from today — otherwise the
  // "today" block on the left already says the same thing.
  const viewing =
    selectedIso && selectedIso !== todayIso
      ? (() => {
          const d = new Date(`${selectedIso}T00:00:00Z`);
          return {
            dayName: DAY_NAMES[d.getUTCDay()].slice(0, 3),
            date: String(d.getUTCDate()).padStart(2, "0"),
            month: MONTH_NAMES[d.getUTCMonth()],
          };
        })()
      : null;

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
            Today
          </div>
          <div className="flex items-baseline gap-px">
            <FlipDigit value={hh[0]} />
            <FlipDigit value={hh[1]} />
            <span className="text-[24px] font-black leading-none text-white">:</span>
            <FlipDigit value={mm[0]} />
            <FlipDigit value={mm[1]} />
            <span className="ml-1 text-[10px] font-extrabold text-white/60">{ampm}</span>
          </div>
        </div>

        <div className="h-9 w-px bg-white/15" />

        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-[10px] font-extrabold uppercase text-white/60">{dayName.slice(0, 3)}</span>
            <span className="text-[20px] font-extrabold leading-none text-white">{date}</span>
          </div>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className="text-[9px] font-extrabold uppercase tracking-wide" style={{ color: ACCENT }}>
              {month}
            </span>
            <span className="text-[8.5px] font-bold text-white/50">{year}</span>
          </div>
        </div>

        {viewing && (
          <>
            <div className="h-9 w-px bg-white/15" />
            <div>
              <div
                className="text-[9px] font-extrabold uppercase tracking-[0.15em]"
                style={{ color: VIEWING_ACCENT }}
              >
                Viewing
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-[10px] font-extrabold uppercase text-white/60">{viewing.dayName}</span>
                <span className="text-[16px] font-extrabold leading-none text-white">{viewing.date}</span>
                <span className="text-[9px] font-extrabold uppercase" style={{ color: VIEWING_ACCENT }}>
                  {viewing.month}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      <AnalogDial now={now} />
    </div>
  );
}

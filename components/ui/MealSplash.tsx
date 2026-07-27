"use client";

import { useEffect, useState } from "react";

/** Playful lines that rotate while the app boots — all meal-themed, since
 * meals are the heart of MyDorm. */
const LINES = [
  "Warming up tonight's meals…",
  "Counting who's eating…",
  "Setting the table…",
  "Checking today's menu…",
  "Waking the cook…",
];

/**
 * Full-screen branded loading splash shown while the session (or a guarded
 * page) is still resolving — a steaming bowl with a breathing teal→cyan glow
 * and a rotating meal-themed line, instead of a blank white screen.
 */
export function MealSplash() {
  const [line, setLine] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setLine((i) => (i + 1) % LINES.length), 1400);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-bg"
      style={{ animation: "fadeIn 0.3s ease" }}
    >
      <div className="text-[20px] font-extrabold tracking-tight">MyDorm</div>

      <div
        className="relative flex h-32 w-32 items-center justify-center"
        style={{ animation: "splashIn 0.4s ease" }}
      >
        {/* Breathing glow behind the bowl */}
        <div
          className="splash-glow absolute h-24 w-24 rounded-full blur-2xl"
          style={{
            background: "linear-gradient(135deg, var(--gradient-accent-from), var(--gradient-accent-to))",
            animation: "splashGlow 2.4s ease-in-out infinite",
          }}
        />

        <svg viewBox="0 0 100 100" className="relative h-28 w-28" aria-hidden="true">
          <defs>
            <linearGradient id="splashBowl" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" style={{ stopColor: "var(--color-primary)" }} />
              <stop offset="1" style={{ stopColor: "var(--gradient-accent-to)" }} />
            </linearGradient>
          </defs>

          {/* Steam wisps, staggered so they rise in a loose rhythm */}
          <g
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.7"
          >
            {[38, 50, 62].map((x, i) => (
              <path
                key={x}
                className="splash-steam"
                d={`M${x} 46 c -5 -5 5 -10 0 -15 c -5 -5 5 -10 0 -15`}
                style={{
                  transformOrigin: `${x}px 46px`,
                  animation: "steamRise 2s ease-in-out infinite",
                  animationDelay: `${i * 0.45}s`,
                }}
              />
            ))}
          </g>

          {/* Bowl: bobs gently as if simmering */}
          <g className="splash-bowl" style={{ animation: "bowlBob 2.4s ease-in-out infinite" }}>
            {/* Contents peeking over the rim */}
            <ellipse cx="50" cy="55" rx="27" ry="6" fill="var(--gradient-accent-to)" opacity="0.5" />
            {/* Bowl body */}
            <path d="M21 56 Q50 92 79 56 Z" fill="url(#splashBowl)" />
            {/* Rim highlight */}
            <ellipse cx="50" cy="56" rx="29" ry="6.5" fill="none" stroke="url(#splashBowl)" strokeWidth="3" />
          </g>
        </svg>
      </div>

      {/* Rotating meal-themed line */}
      <div
        key={line}
        className="text-[12px] font-semibold text-text-secondary"
        style={{ animation: "fadeIn 0.4s ease" }}
      >
        {LINES[line]}
      </div>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";

const PALETTE = [
  "#7C6CF6",
  "#4CC9F0",
  "#34D399",
  "#FBBF24",
  "#F472B6",
  "#60A5FA",
  "#F87171",
  "#2DD4BF",
];

const SIZE = 240;
const CENTER = SIZE / 2;
const OUTER_R = 108;
const INNER_R = 58;
const LABEL_R = (OUTER_R + INNER_R) / 2;
const GAP_DEG = 3;

function polar(angleDeg: number, r: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CENTER + r * Math.sin(rad), y: CENTER - r * Math.cos(rad) };
}

function segmentPath(startDeg: number, endDeg: number): string {
  const outerStart = polar(startDeg, OUTER_R);
  const outerEnd = polar(endDeg, OUTER_R);
  const innerEnd = polar(endDeg, INNER_R);
  const innerStart = polar(startDeg, INNER_R);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${OUTER_R} ${OUTER_R} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${INNER_R} ${INNER_R} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

interface SpinWheelProps {
  segments: { id: string; label: string }[];
  targetIndex: number;
  disabled?: boolean;
  onSpinEnd?: () => void;
}

export function SpinWheel({ segments, targetIndex, disabled, onSpinEnd }: SpinWheelProps) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const n = segments.length || 1;
  const segAngle = 360 / n;

  const handleTap = () => {
    if (disabled || spinning || n === 0) return;
    const midAngle = targetIndex * segAngle + segAngle / 2;
    const targetFinalMod = (360 - midAngle + 360) % 360;
    const delta = ((targetFinalMod - (rotation % 360)) + 360) % 360;
    const next = rotation + 360 * 6 + delta;
    setSpinning(true);
    setRotation(next);
  };

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleTransitionEnd = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSpinning(false);
    onSpinEnd?.();
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        {/* Needle */}
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="absolute inset-0 z-10"
        >
          <path
            d={`M ${CENTER - 9} 8 L ${CENTER + 9} 8 L ${CENTER} 26 Z`}
            fill="#ffffff"
            stroke="#1a1d26"
            strokeWidth={1.5}
          />
        </svg>

        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? "transform 3.3s cubic-bezier(.15,.68,.14,1)" : undefined,
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          {segments.map((seg, i) => {
            const start = i * segAngle + GAP_DEG / 2;
            const end = (i + 1) * segAngle - GAP_DEG / 2;
            const mid = i * segAngle + segAngle / 2;
            const labelPos = polar(mid, LABEL_R);
            return (
              <g key={seg.id}>
                <path d={segmentPath(start, end)} fill={PALETTE[i % PALETTE.length]} />
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={11}
                  fontWeight={800}
                  fill="#ffffff"
                >
                  {seg.label}
                </text>
              </g>
            );
          })}
          <circle cx={CENTER} cy={CENTER} r={INNER_R} fill="#181c2e" />
        </svg>

        <button
          type="button"
          onClick={handleTap}
          disabled={disabled || spinning}
          className="absolute z-20 flex cursor-pointer items-center justify-center rounded-full bg-transparent text-[11.5px] font-extrabold text-white disabled:cursor-not-allowed"
          style={{
            left: CENTER - INNER_R,
            top: CENTER - INNER_R,
            width: INNER_R * 2,
            height: INNER_R * 2,
          }}
        >
          {spinning ? "..." : disabled ? "Spun" : "Tap to spin"}
        </button>
      </div>
    </div>
  );
}

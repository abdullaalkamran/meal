/** A circular percentage indicator — an SVG ring that fills clockwise from
 * 12 o'clock, with arbitrary center content (a percentage, an icon, …). */
export function ProgressRing({
  percent,
  size = 72,
  strokeWidth = 7,
  color,
  trackColor = "var(--color-border)",
  children,
}: {
  /** 0-100. Values outside that range are clamped. */
  percent: number;
  size?: number;
  strokeWidth?: number;
  /** Any valid CSS color (hex, var(--...), etc.) for the filled arc. */
  color: string;
  trackColor?: string;
  children?: React.ReactNode;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      )}
    </div>
  );
}

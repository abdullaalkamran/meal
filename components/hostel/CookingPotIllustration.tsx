/** Small steaming-pot illustration for the Cooking Count hero card — reuses
 * the same brand gradient and steam-rise/bob keyframes as the app's splash
 * screen (`components/ui/MealSplash.tsx`, keyframes defined in
 * app/globals.css) so it reads as the same illustration family, just a pot
 * instead of a bowl. */
export function CookingPotIllustration({ size = 88 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id="cookingPot" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--color-primary)" }} />
          <stop offset="1" style={{ stopColor: "var(--gradient-accent-to)" }} />
        </linearGradient>
      </defs>

      {/* Steam wisps, staggered so they rise in a loose rhythm */}
      <g fill="none" stroke="var(--color-primary)" strokeWidth="3" strokeLinecap="round" opacity="0.6">
        {[38, 50, 62].map((x, i) => (
          <path
            key={x}
            d={`M${x} 38 c -5 -5 5 -10 0 -15 c -5 -5 5 -10 0 -15`}
            style={{
              transformOrigin: `${x}px 38px`,
              animation: "steamRise 2s ease-in-out infinite",
              animationDelay: `${i * 0.45}s`,
            }}
          />
        ))}
      </g>

      {/* Pot: bobs gently as if simmering */}
      <g style={{ animation: "bowlBob 2.4s ease-in-out infinite" }}>
        {/* Handles */}
        <rect x="10" y="55" width="12" height="8" rx="4" fill="url(#cookingPot)" />
        <rect x="78" y="55" width="12" height="8" rx="4" fill="url(#cookingPot)" />
        {/* Lid */}
        <ellipse cx="50" cy="46" rx="24" ry="7" fill="url(#cookingPot)" />
        <rect x="46" y="36" width="8" height="7" rx="2" fill="url(#cookingPot)" />
        {/* Body */}
        <path d="M23 52 Q23 88 50 88 Q77 88 77 52 Z" fill="url(#cookingPot)" />
        {/* Rim highlight */}
        <ellipse cx="50" cy="52" rx="27" ry="6" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="2" />
      </g>
    </svg>
  );
}

import { clsx } from "clsx";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

// Deterministic, pleasant hue from a seed string, so the same person always
// gets the same accent color without storing anything extra.
function hueFromSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  }
  return hash;
}

interface AvatarProps {
  name: string;
  seed?: string;
  size?: number;
  className?: string;
}

export function Avatar({ name, seed, size = 40, className }: AvatarProps) {
  const hue = hueFromSeed(seed ?? name);
  return (
    <div
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-full font-extrabold text-white",
        className
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 40) % 360} 70% 45%))`,
      }}
    >
      {initialsOf(name)}
    </div>
  );
}

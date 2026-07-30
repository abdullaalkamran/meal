/** A single shimmering placeholder block. Compose several to sketch a screen's
 * layout while its data loads, so a tap shows structure immediately instead of a
 * blank pause. Colour adapts to light/dark via the text-secondary token. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-btn bg-text-secondary/15 ${className}`} />;
}

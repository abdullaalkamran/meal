import { Skeleton } from "./Skeleton";

/** A generic screen placeholder — a header line, a hero block, and a few card
 * rows — shown the instant a nav tap happens while the real screen streams in.
 * Deliberately layout-shaped (not pixel-exact per screen) so one component
 * covers every route in a section and taps feel instant, like a native app. */
export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>

      <Skeleton className="h-36 w-full rounded-card" />

      <div className="flex flex-col gap-3">
        <Skeleton className="h-20 w-full rounded-card" />
        <Skeleton className="h-20 w-full rounded-card" />
        <Skeleton className="h-20 w-full rounded-card" />
      </div>
    </div>
  );
}

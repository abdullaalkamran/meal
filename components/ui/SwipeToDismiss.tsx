"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { Icon } from "./Icon";

const THRESHOLD = 88;
const MAX_DRAG = 160;
// A slight overshoot-then-settle on the spring-back, so "not far enough, snap
// back" reads as a distinct bounce rather than a flat linear slide.
const SPRING_BACK = "transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1)";
const LEAVE = "transform 0.22s ease-in, opacity 0.22s ease-in";

/** Swipe-left-to-remove wrapper. Only ever hides the wrapped card from THIS
 * device's next render (the caller decides what "remove" actually means —
 * e.g. a per-user dismiss that keeps it visible to everyone else). Disabled
 * entirely (renders children plain, no gesture) for cards that still need an
 * action — those must stay until resolved, not be swiped away. */
export function SwipeToDismiss({
  children,
  onDismiss,
  disabled,
}: {
  children: React.ReactNode;
  onDismiss: () => void;
  disabled?: boolean;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const startX = useRef(0);

  if (disabled) return <>{children}</>;

  const onPointerDown = (e: React.PointerEvent) => {
    if (leaving) return;
    startX.current = e.clientX;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const delta = e.clientX - startX.current;
    // Left only — swiping right has no meaning here.
    setDx(Math.max(-MAX_DRAG, Math.min(0, delta)));
  };
  const finishDrag = () => {
    if (!dragging) return;
    setDragging(false);
    if (dx <= -THRESHOLD) {
      setLeaving(true);
      setDx(-400);
      setTimeout(onDismiss, 220);
    } else {
      // Snap back — the card wasn't pulled far enough to count as a remove.
      setDx(0);
    }
  };

  const revealed = Math.min(1, -dx / THRESHOLD);
  const willRemove = -dx >= THRESHOLD;

  return (
    <div className="relative overflow-hidden rounded-card">
      <div
        className="absolute inset-0 flex items-center justify-end gap-2 bg-danger px-5"
        style={{ opacity: revealed }}
      >
        <span
          className="text-[11.5px] font-extrabold uppercase tracking-wide text-white"
          style={{ transform: `scale(${willRemove ? 1.08 : 1})`, transition: "transform 0.15s ease" }}
        >
          Remove
        </span>
        <Icon icon={X} size={16} className="text-white" />
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        style={{
          transform: `translateX(${dx}px)`,
          transition: dragging ? "none" : leaving ? LEAVE : SPRING_BACK,
          opacity: leaving ? 0 : 1,
          touchAction: "pan-y",
        }}
        className="relative cursor-grab active:cursor-grabbing"
      >
        {children}
      </div>
    </div>
  );
}

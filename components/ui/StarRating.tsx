"use client";

import { Star } from "lucide-react";
import { clsx } from "clsx";
import type { Stars } from "@/lib/data";

interface StarRatingProps {
  value: number;
  onChange?: (value: Stars) => void;
  size?: number;
  readOnly?: boolean;
}

export function StarRating({ value, onChange, size = 18, readOnly }: StarRatingProps) {
  const interactive = !readOnly && !!onChange;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!interactive}
          onClick={() => onChange?.(n as Stars)}
          className={clsx(
            "flex items-center justify-center",
            interactive ? "cursor-pointer" : "cursor-default"
          )}
        >
          <Star
            size={size}
            strokeWidth={2}
            className={n <= value ? "fill-orange text-orange" : "fill-transparent text-border"}
          />
        </button>
      ))}
    </div>
  );
}

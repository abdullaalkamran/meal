"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { Icon } from "./Icon";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

// Renders as a bottom sheet on mobile and a centered modal on desktop —
// callers never need to branch on viewport.
export function Sheet({ open, onClose, title, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <div
        className="absolute inset-0 bg-black/45"
        style={{ animation: "fadeIn 0.2s" }}
        onClick={onClose}
      />
      <div
        className="relative z-10 max-h-[88vh] w-full overflow-y-auto rounded-t-[28px] bg-card p-5 pb-10 shadow-soft md:max-w-md md:rounded-card md:pb-6"
        style={{ animation: "sheetUp 0.28s ease" }}
      >
        <div className="mb-3 flex items-center justify-between md:mb-4">
          <div className="mx-auto h-[4.5px] w-10 rounded-pill bg-border md:hidden" />
          {title && <div className="hidden text-[15px] font-extrabold md:block">{title}</div>}
          <button
            type="button"
            onClick={onClose}
            className="hidden h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-bg md:flex"
          >
            <Icon icon={X} size={16} />
          </button>
        </div>
        {title && <div className="mb-4 text-[16px] font-extrabold md:hidden">{title}</div>}
        {children}
      </div>
    </div>
  );
}

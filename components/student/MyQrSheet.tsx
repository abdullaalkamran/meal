"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Copy } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { memberQrLink } from "@/lib/utils/qr";
import type { User } from "@/lib/data";

/** A member's personal QR code. A manager/owner scans it (with the in-app
 * scanner) and gets the member's name straight away to assign a room — no
 * typing, no separate scanner hardware. */
export function MyQrSheet({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: User | undefined;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [link, setLink] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (!open || !user) return;
    const url = memberQrLink(window.location.origin, user.id);
    queueMicrotask(() => setLink(url));
    // Same retry-until-canvas-mounts pattern as JoinQrSheet — the canvas can
    // appear a few frames after the sheet's open animation starts.
    let tries = 0;
    const t = setInterval(() => {
      tries += 1;
      if (canvasRef.current) {
        void QRCode.toCanvas(canvasRef.current, url, { width: 240, margin: 2 });
        clearInterval(t);
      } else if (tries > 20) {
        clearInterval(t);
      }
    }, 100);
    return () => clearInterval(t);
  }, [open, user]);

  return (
    <Sheet open={open} onClose={onClose} title="My QR code">
      <div className="mb-3 flex items-center justify-center gap-2.5">
        <Avatar name={user?.name ?? ""} seed={user?.avatarSeed} photo={user?.avatarImage} size={34} />
        <div>
          <div className="text-[12.5px] font-extrabold">{user?.name}</div>
          <div className="text-[10px] font-semibold text-text-secondary">{user?.phone}</div>
        </div>
      </div>
      <div className="mb-3 flex justify-center rounded-card bg-white p-3">
        <canvas ref={canvasRef} />
      </div>
      <div className="mb-3 text-center text-[11px] font-semibold text-text-secondary">
        Show this to your hostel manager or owner — scanning it brings up your
        name so they can assign your room instantly.
      </div>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(link).then(
            () => toast("Code link copied"),
            () => toast(link)
          );
        }}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-btn bg-bg px-3 text-[10.5px] font-bold text-text-secondary"
      >
        <Icon icon={Copy} size={13} />
        <span className="truncate">{link}</span>
      </button>
    </Sheet>
  );
}

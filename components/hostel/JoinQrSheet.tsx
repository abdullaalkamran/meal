"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Copy } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";

/** QR invite for adding members: encodes the find-hostel deep link for this
 * hostel. A member scans it (or opens the link), signs up if needed, and the
 * hostel appears pre-selected to send a join request to. */
export function JoinQrSheet({
  open,
  onClose,
  hostelId,
  hostelName,
}: {
  open: boolean;
  onClose: () => void;
  hostelId: string | undefined;
  hostelName?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [url, setUrl] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (!open || !hostelId) return;
    const link = `${window.location.origin}/student/find-hostel?hostel=${hostelId}`;
    queueMicrotask(() => setUrl(link));
    // The canvas may mount several frames after the sheet opens (animation,
    // slow devices) — retry until it exists instead of a single one-shot timer.
    let tries = 0;
    const t = setInterval(() => {
      tries += 1;
      if (canvasRef.current) {
        void QRCode.toCanvas(canvasRef.current, link, { width: 240, margin: 2 });
        clearInterval(t);
      } else if (tries > 20) {
        clearInterval(t);
      }
    }, 100);
    return () => clearInterval(t);
  }, [open, hostelId]);

  return (
    <Sheet open={open} onClose={onClose} title={`Invite members · ${hostelName ?? ""}`}>
      <div className="mb-3 text-center text-[11px] font-semibold text-text-secondary">
        Ask the new member to scan this QR (or open the link). They sign up, send a join
        request to {hostelName ?? "your hostel"}, and become a member once you approve and
        assign a room.
      </div>
      <div className="mb-3 flex justify-center rounded-card bg-white p-3">
        <canvas ref={canvasRef} />
      </div>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(url).then(
            () => toast("Invite link copied"),
            () => toast(url)
          );
        }}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-btn bg-bg px-3 text-[10.5px] font-bold text-text-secondary"
      >
        <Icon icon={Copy} size={13} />
        <span className="truncate">{url}</span>
      </button>
    </Sheet>
  );
}

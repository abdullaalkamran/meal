"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Copy, Printer } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";

/** Door QR for a hostel: encodes the PUBLIC landing page (/h/<id>). Anyone can
 * scan it to see the hostel's rooms & availability; signing in lets them send a
 * join request with a preferred room and move-in month. Includes a printable
 * poster to hang on the door. */
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
    const link = `${window.location.origin}/h/${hostelId}`;
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

  // Opens a print-ready poster (big QR + hostel name + instructions) in a new
  // window and triggers the browser print dialog — hang it on the door.
  const printPoster = async () => {
    if (!url) return;
    // Open the window SYNCHRONOUSLY, inside the click, so the browser doesn't
    // block it as a pop-up — generating the QR (async) first would break the
    // user-gesture chain. Fill it in once the QR data URL is ready.
    const w = window.open("", "_blank", "width=720,height=900");
    if (!w) {
      toast("Allow pop-ups for this site to print the poster");
      return;
    }
    w.document.write("<!doctype html><title>Preparing poster…</title><body style='font-family:sans-serif;padding:40px'>Preparing poster…</body>");
    const name = hostelName ?? "our hostel";
    let dataUrl: string;
    try {
      dataUrl = await QRCode.toDataURL(url, { width: 900, margin: 2 });
    } catch {
      w.close();
      toast("Could not generate the QR");
      return;
    }
    w.document.open();
    // Print fires from the poster window itself once the QR image has loaded,
    // so it's never blank.
    w.document.write(`<!doctype html><html><head><title>${name} — join QR</title>
      <style>
        *{margin:0;box-sizing:border-box;font-family:system-ui,Segoe UI,Roboto,sans-serif}
        body{padding:48px;text-align:center;color:#1a1d26}
        .brand{color:#10bfb4;font-weight:800;font-size:20px;letter-spacing:-.02em}
        h1{font-size:34px;font-weight:800;margin:16px 0 6px}
        p{font-size:16px;color:#5b6172;font-weight:600}
        img{width:min(78vw,460px);height:auto;margin:28px auto 8px}
        .cta{font-size:22px;font-weight:800;margin-top:8px}
        .sub{font-size:14px;color:#7a8194;margin-top:6px}
      </style></head><body>
        <div class="brand">MyDorm</div>
        <h1>${name}</h1>
        <p>Looking for a seat? Scan to see rooms &amp; join.</p>
        <img src="${dataUrl}" alt="Join QR" onload="setTimeout(function(){window.focus();window.print();},200)" />
        <div class="cta">Scan to view &amp; request to join</div>
        <div class="sub">See free seats, rent &amp; rooms, then send a join request.</div>
      </body></html>`);
    w.document.close();
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Door QR · ${hostelName ?? ""}`}>
      <div className="mb-3 text-center text-[11px] font-semibold text-text-secondary">
        Print this and hang it on the door. Anyone can scan it to see {hostelName ?? "your hostel"}&rsquo;s
        rooms and free seats; after signing in they can send a join request with a preferred room.
      </div>
      <div className="mb-3 flex justify-center rounded-card bg-white p-3">
        <canvas ref={canvasRef} />
      </div>
      <button
        type="button"
        onClick={() => void printPoster()}
        className="mb-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-btn bg-primary text-[12px] font-extrabold text-white"
      >
        <Icon icon={Printer} size={15} />
        Print door poster
      </button>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(url).then(
            () => toast("Link copied"),
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

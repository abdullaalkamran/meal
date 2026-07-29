"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Copy, Printer } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import type { PublicHostelView } from "@/lib/types/publicHostel";

/** "YYYY-MM" for the month after the current one — the poster's default
 * move-in month, which the owner/manager can change. */
function nextMonthValue(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** "August 2026" for a "YYYY-MM" value. */
function monthLabel(value: string): string {
  const [y, m] = value.split("-").map(Number);
  if (!y || !m) return "";
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

const genderLabel = (g?: "boys" | "girls") =>
  g === "girls" ? "Girls' Hostel" : g === "boys" ? "Boys' Hostel" : "";

/** Door QR for a hostel: encodes the PUBLIC landing page (/h/<id>). Anyone can
 * scan it to see the hostel's rooms & availability; signing in lets them send a
 * join request with a preferred room and move-in month. Includes a printable,
 * minimal black-and-white "TO-LET" poster to hang on the door. */
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
  const [view, setView] = useState<PublicHostelView | null>(null);
  // The move-in month printed on the poster — defaults to next month, and the
  // owner/manager can pick any other month.
  const [moveMonth, setMoveMonth] = useState<string>(nextMonthValue());
  const { toast } = useToast();

  useEffect(() => {
    if (!open || !hostelId) return;
    const link = `${window.location.origin}/h/${hostelId}`;
    queueMicrotask(() => setUrl(link));
    // Pull gender + address from the same public endpoint the door page uses,
    // so the poster can print "Boys/Girls hostel" and the full address.
    let cancelled = false;
    fetch(`/api/public/hostel/${hostelId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => !cancelled && setView(data))
      .catch(() => !cancelled && setView(null));
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
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [open, hostelId]);

  const gender = genderLabel(view?.gender);
  const fullAddress = [view?.street, view?.area].filter(Boolean).join(", ");

  // Opens a print-ready, minimal black-and-white TO-LET poster in a new window
  // and triggers the browser print dialog.
  const printPoster = async () => {
    if (!url) return;
    // Open the window SYNCHRONOUSLY, inside the click, so the browser doesn't
    // block it as a pop-up — generating the QR (async) first would break the
    // user-gesture chain. Fill it in once the QR data URL is ready.
    const w = window.open("", "_blank", "width=800,height=1040");
    if (!w) {
      toast("Allow pop-ups for this site to print the poster");
      return;
    }
    w.document.write("<!doctype html><title>Preparing poster…</title><body style='font-family:sans-serif;padding:40px'>Preparing poster…</body>");
    const name = hostelName ?? view?.name ?? "Our Hostel";
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
    let dataUrl: string;
    try {
      dataUrl = await QRCode.toDataURL(url, { width: 1000, margin: 1 });
    } catch {
      w.close();
      toast("Could not generate the QR");
      return;
    }

    const monthText = monthLabel(moveMonth);
    const host = (() => {
      try {
        return new URL(url).host;
      } catch {
        return "MyDorm.xyz";
      }
    })();

    w.document.open();
    // Print fires from the poster window itself once the QR image has loaded,
    // so it's never blank. Deliberately monochrome — cheap to print, minimal.
    w.document.write(`<!doctype html><html><head><title>${esc(name)} — To-Let</title>
      <style>
        @page { size: A4; margin: 0; }
        * { margin:0; padding:0; box-sizing:border-box; font-family:'Segoe UI',system-ui,Roboto,Helvetica,Arial,sans-serif;
            -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        body { color:#111; background:#fff; }
        .sheet { width:210mm; min-height:297mm; margin:0 auto; padding:12mm 12mm 11mm;
                 display:flex; flex-direction:column; align-items:center; }
        .top { width:100%; display:flex; align-items:center; justify-content:space-between;
               padding-bottom:16px; border-bottom:2px solid #111; }
        .brand { font-size:23px; font-weight:800; letter-spacing:-.02em; color:#111; }
        .reg-tag { font-size:10px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:#555;
                   border:1.5px solid #111; border-radius:999px; padding:6px 12px; }
        .tolet { margin:26px 0 0; font-size:120px; line-height:1; font-weight:800; letter-spacing:.04em;
                 color:#111; text-align:center; white-space:nowrap; }
        .tolet small { display:block; font-size:16px; font-weight:700; letter-spacing:.52em; color:#777;
                       margin-top:14px; text-transform:uppercase; }
        .name { margin-top:26px; font-size:40px; font-weight:800; text-align:center; letter-spacing:-.02em; }
        .addr { margin-top:9px; font-size:15px; font-weight:600; color:#555; text-align:center; max-width:165mm; line-height:1.4; }
        .badge { margin-top:15px; font-size:13px; font-weight:800; letter-spacing:.08em; text-transform:uppercase;
                 color:#111; border:1.5px solid #111; border-radius:999px; padding:7px 18px; }
        .avail { margin-top:22px; font-size:18px; font-weight:600; color:#111; border:2px solid #111;
                 border-radius:5px; padding:14px 30px; text-align:center; }
        .avail b { font-weight:800; }
        .qrwrap { margin-top:26px; padding:16px; background:#fff; border:2px solid #111; border-radius:10px; }
        .qrwrap img { width:290px; height:290px; display:block; }
        .scan { margin-top:16px; font-size:25px; font-weight:800; color:#111; text-align:center; }
        .steps { margin-top:22px; width:100%; max-width:170mm; display:flex; flex-direction:column; gap:7px; }
        .step { display:flex; align-items:center; gap:11px; font-size:12.5px; font-weight:600; color:#555; }
        .step .n { flex:0 0 auto; width:20px; height:20px; border-radius:999px; border:1.5px solid #111; color:#111;
                   font-weight:800; font-size:11px; display:flex; align-items:center; justify-content:center; }
        .spacer { flex:1 1 auto; min-height:10px; }
        .footer { width:100%; margin-top:22px; padding-top:15px; border-top:2px solid #111; text-align:center; }
        .footer .line1 { font-size:14px; font-weight:800; color:#111; }
        .footer .line2 { margin-top:4px; font-size:12px; font-weight:600; color:#777; }
      </style></head><body>
      <div class="sheet">
        <div class="top">
          <div class="brand">MyDorm</div>
          <div class="reg-tag">Registered Hostel</div>
        </div>

        <div class="tolet">TO-LET<small>Seat Available</small></div>

        <div class="name">${esc(name)}</div>
        ${fullAddress ? `<div class="addr">${esc(fullAddress)}</div>` : ""}
        ${gender ? `<div class="badge">${esc(gender)}</div>` : ""}
        <div class="avail">Seats available from <b>${esc(monthText)}</b></div>

        <div class="qrwrap"><img src="${dataUrl}" alt="Scan to see hostel details" onload="setTimeout(function(){window.focus();window.print();},250)" /></div>
        <div class="scan">Scan to See Details</div>

        <div class="steps">
          <div class="step"><span class="n">1</span> Point your phone camera at the QR code above.</div>
          <div class="step"><span class="n">2</span> Tap the link to open this hostel&rsquo;s page.</div>
          <div class="step"><span class="n">3</span> See rooms, seat rent, free seats &amp; upcoming vacancies.</div>
          <div class="step"><span class="n">4</span> Sign in to send a join request for your preferred room.</div>
        </div>

        <div class="spacer"></div>

        <div class="footer">
          <div class="line1">This hostel is registered on ${esc(host)}</div>
          <div class="line2">MyDorm — Bangladesh&rsquo;s smart student-hostel management platform</div>
        </div>
      </div>
      </body></html>`);
    w.document.close();
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Door QR · ${hostelName ?? ""}`}>
      <div className="mb-3 text-center text-[11px] font-semibold text-text-secondary">
        Print this <b>TO-LET</b> poster and hang it on the door. Anyone can scan it to see{" "}
        {hostelName ?? "your hostel"}&rsquo;s rooms, seat rent and free seats; after signing in they can
        send a join request with a preferred room and move-in month.
      </div>

      <div className="mb-3">
        <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-text-secondary">
          Seats available from
        </div>
        <input
          type="month"
          value={moveMonth}
          onChange={(e) => setMoveMonth(e.target.value || nextMonthValue())}
          className="w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
        />
        <div className="mt-1 text-[9.5px] font-semibold text-text-secondary">
          Defaults to next month — pick any month you want printed on the poster.
        </div>
      </div>

      {gender && (
        <div className="mb-3 flex justify-center">
          <span className={`rounded-pill px-2.5 py-1 text-[10px] font-extrabold ${view?.gender === "girls" ? "bg-[#7C6CF6]/10 text-[#7C6CF6]" : "bg-blue-soft text-blue"}`}>
            {gender}
          </span>
        </div>
      )}

      <div className="mb-3 flex justify-center rounded-card bg-white p-3">
        <canvas ref={canvasRef} />
      </div>
      <button
        type="button"
        onClick={() => void printPoster()}
        className="mb-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-btn bg-primary text-[12px] font-extrabold text-white"
      >
        <Icon icon={Printer} size={15} />
        Print TO-LET poster
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

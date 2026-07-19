"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { ClipboardPaste } from "lucide-react";
import { Sheet } from "./Sheet";
import { Icon } from "./Icon";
import { Button } from "./Button";

/** Minimal typing for the native BarcodeDetector (not in TS's DOM lib yet). */
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
type BarcodeDetectorCtor = new (options?: { formats: string[] }) => BarcodeDetectorLike;

/** In-app QR scanner: neither members nor managers have scanner hardware, so
 * the phone camera IS the scanner. Uses the native BarcodeDetector where the
 * browser has one, falling back to jsQR frame-decoding; a paste-the-link box
 * covers devices with no usable camera (denied permission, plain http). */
export function QrScannerSheet({
  open,
  onClose,
  title = "Scan QR code",
  hint,
  onScan,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  hint?: string;
  /** Called once per open with the decoded text; the parent closes the sheet. */
  onScan: (text: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onScanRef = useRef(onScan);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  useEffect(() => {
    onScanRef.current = onScan;
  });

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setCameraError(null);
      setManual("");
    });

    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let done = false;

    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
    };

    const deliver = (text: string) => {
      if (done || !text) return;
      done = true;
      stop();
      onScanRef.current(text);
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          "Camera not available on this device/connection — paste the link or code below instead."
        );
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
      } catch {
        setCameraError(
          "Camera blocked — allow camera access, or paste the link or code below instead."
        );
        return;
      }
      const video = videoRef.current;
      if (!video || done) {
        stop();
        return;
      }
      video.srcObject = stream;
      await video.play().catch(() => {});

      const BD = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
      let detector: BarcodeDetectorLike | null = null;
      if (BD) {
        try {
          detector = new BD({ formats: ["qr_code"] });
        } catch {
          detector = null;
        }
      }
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      timer = setInterval(async () => {
        if (done || !video.videoWidth) return;
        if (detector) {
          try {
            const codes = await detector.detect(video);
            if (codes[0]?.rawValue) deliver(codes[0].rawValue);
            return;
          } catch {
            detector = null; // fall through to jsQR from now on
          }
        }
        if (!ctx) return;
        // Downscale before decoding — jsQR on full HD frames janks phones.
        const scale = Math.min(1, 480 / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(image.data, image.width, image.height);
        if (code?.data) deliver(code.data);
      }, 220);
    };

    void start();
    return () => {
      done = true;
      stop();
    };
  }, [open]);

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {hint && (
        <div className="mb-3 text-center text-[11px] font-semibold text-text-secondary">
          {hint}
        </div>
      )}

      {cameraError ? (
        <div className="mb-3 rounded-card bg-danger-soft px-3 py-3 text-[11px] font-bold text-danger">
          {cameraError}
        </div>
      ) : (
        <div className="relative mb-3 overflow-hidden rounded-card bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="aspect-square w-full object-cover"
          />
          {/* Aiming frame */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-3/5 w-3/5 rounded-2xl border-2 border-white/80" />
          </div>
        </div>
      )}

      <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
        Or paste the link / code
      </div>
      <div className="flex gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-btn border border-border px-3">
          <Icon icon={ClipboardPaste} size={14} className="shrink-0 text-text-secondary" />
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && manual.trim() && onScan(manual.trim())}
            placeholder="https://… or code"
            className="min-h-11 w-full bg-transparent text-[12px] font-bold outline-none"
          />
        </div>
        <Button onClick={() => manual.trim() && onScan(manual.trim())} disabled={!manual.trim()}>
          Use
        </Button>
      </div>
    </Sheet>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { enablePush, pushState } from "@/lib/push/client";

// Dismissed once per browser session — so a user who hasn't decided sees one
// gentle nudge, not on every page.
const DISMISS_KEY = "push-nudge-dismissed";

/**
 * A small, dismissible "turn on notifications" banner shown only when push is
 * supported + configured on the server but this browser hasn't subscribed yet.
 * One cheap `pushState()` check on mount (no polling) — invisible otherwise, so
 * it adds no ongoing cost.
 */
export function PushNudge() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      // sessionStorage unavailable — proceed to check
    }
    if (dismissed) return;
    let cancelled = false;
    // "off" = supported + server-configured + permission not denied + not yet
    // subscribed → the only state worth nudging.
    pushState()
      .then((s) => {
        if (!cancelled && s === "off") setShow(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  const close = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setShow(false);
  };

  const turnOn = async () => {
    setBusy(true);
    const s = await enablePush();
    setBusy(false);
    if (s === "on" || s === "denied") close();
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 px-4 md:bottom-6 print:hidden">
      <div className="pointer-events-auto mx-auto flex max-w-md items-center gap-3 rounded-card border border-primary/30 bg-card px-3 py-2.5 shadow-chip">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Icon icon={Bell} size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11.5px] font-extrabold">Turn on notifications</div>
          <div className="text-[9.5px] font-semibold text-text-secondary">
            Get bills, approvals &amp; alerts even when the app is closed.
          </div>
        </div>
        <button
          type="button"
          onClick={turnOn}
          disabled={busy}
          className="shrink-0 rounded-pill bg-primary px-3 py-1.5 text-[10.5px] font-extrabold text-white disabled:opacity-60"
        >
          {busy ? "…" : "Turn on"}
        </button>
        <button
          type="button"
          onClick={close}
          aria-label="Dismiss"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg text-text-secondary"
        >
          <Icon icon={X} size={13} />
        </button>
      </div>
    </div>
  );
}

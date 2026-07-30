"use client";

import { useEffect } from "react";

/**
 * Registers the app's service worker on every page load — not just when a user
 * turns on push. That's what lets the SW cache the UI shell (see public/sw.js),
 * so opening the app and moving between screens is instant instead of
 * re-downloading everything from the server each time. Registration is
 * idempotent, so the push flow re-registering the same /sw.js is harmless.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    // Wait for load so registration never competes with first paint.
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    };
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}

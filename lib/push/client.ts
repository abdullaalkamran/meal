// Browser-side Web Push helpers: register the service worker, ask permission,
// create a PushManager subscription, and hand it to the server. All calls are
// safe no-ops when the browser lacks support or push isn't configured.

import { repo } from "@/lib/data";

export type PushState = "unsupported" | "denied" | "unconfigured" | "off" | "on";

function supported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// VAPID public key is base64url; PushManager needs it as a Uint8Array.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function ready(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready.then(() => reg);
}

/** Current push state for the UI toggle, without prompting. */
export async function pushState(): Promise<PushState> {
  if (!supported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const key = await repo.pushSubscriptions.getPublicKey().catch(() => "");
  if (!key) return "unconfigured";
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    return sub ? "on" : "off";
  } catch {
    return "off";
  }
}

/**
 * Requests permission (if needed), subscribes this browser, and saves the
 * subscription server-side. Returns the resulting state. Never throws.
 */
export async function enablePush(): Promise<PushState> {
  if (!supported()) return "unsupported";
  try {
    const key = await repo.pushSubscriptions.getPublicKey();
    if (!key) return "unconfigured";
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return permission === "denied" ? "denied" : "off";
    const reg = await ready();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      });
    }
    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return "off";
    await repo.pushSubscriptions.save({
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    });
    return "on";
  } catch {
    return "off";
  }
}

/** Unsubscribes this browser and drops it server-side. */
export async function disablePush(): Promise<void> {
  if (!supported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe().catch(() => {});
      await repo.pushSubscriptions.unsubscribe(endpoint).catch(() => {});
    }
  } catch {
    // best-effort
  }
}

/**
 * One-time gentle opt-in used right after login: if push is available and the
 * user hasn't decided yet, prompt and subscribe. Does nothing if already
 * granted/denied, unsupported, or unconfigured.
 */
export async function maybePromptOnLogin(): Promise<void> {
  if (!supported() || Notification.permission !== "default") return;
  const key = await repo.pushSubscriptions.getPublicKey().catch(() => "");
  if (!key) return;
  await enablePush();
}

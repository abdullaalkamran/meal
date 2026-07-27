// Server-side Web Push sender. Imported ONLY from server code (the data-layer
// backends) so `web-push` never ends up in the client bundle.
//
// Keys come from env, never the repo — the private key is a secret:
//   VAPID_PUBLIC_KEY   (also handed to the browser to subscribe)
//   VAPID_PRIVATE_KEY  (secret — never commit)
//   VAPID_SUBJECT      (mailto:… or https URL; defaults to a mailto)
// When the keys aren't set, every send is a graceful no-op (like SMTP when
// unconfigured), so the app runs fine without push.

import webpush from "web-push";

let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:notifications@mydorm.xyz";
  if (publicKey && privateKey) {
    try {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      configured = true;
    } catch {
      // Malformed keys — treat as unconfigured rather than crash every send.
      configured = false;
    }
  } else {
    configured = false;
  }
  return configured;
}

export function isPushConfigured(): boolean {
  return ensureConfigured();
}

/** The VAPID public key handed to the browser so it can create a subscription.
 * Safe to expose — it's not secret. Empty string when push isn't configured. */
export function getVapidPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY?.trim() ?? "";
}

export interface PushPayload {
  title: string;
  body: string;
  /** Where notificationclick should take the user (defaults to the app root). */
  url?: string;
}

export interface StoredSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Sends one push. `gone` is true when the push service reports the subscription
 * is dead (HTTP 404/410) so the caller can prune it. Never throws.
 */
export async function sendToSubscription(
  sub: StoredSubscription,
  payload: PushPayload
): Promise<{ ok: boolean; gone: boolean }> {
  if (!ensureConfigured()) return { ok: false, gone: false };
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload)
    );
    return { ok: true, gone: false };
  } catch (err) {
    const status = (err as { statusCode?: number })?.statusCode;
    return { ok: false, gone: status === 404 || status === 410 };
  }
}

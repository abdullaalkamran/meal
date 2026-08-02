// Request-scoped acting user, for the activity log.
//
// The JSON backend could keep the actor in a module-level variable because
// every repository call ran to completion synchronously. MySQL calls await,
// so two overlapping requests would interleave and a module-level variable
// would attribute one user's actions to another. AsyncLocalStorage keeps the
// actor bound to the request that set it, however the awaits interleave.

import { AsyncLocalStorage } from "node:async_hooks";
import type { ActivityCategory } from "../../types";
import type { Queryable } from "./connection";
import { all, fromIso, run } from "./connection";
import { newId } from "./ids";
import { sendToSubscription } from "../../../push/webpush";

export interface Actor {
  id: string;
  name: string;
}

const storage = new AsyncLocalStorage<Actor | null>();

/** Runs `fn` with `actor` as the audit-log actor for everything it awaits. */
export function runWithActor<T>(actor: Actor | null, fn: () => Promise<T>): Promise<T> {
  return storage.run(actor, fn);
}

export function currentActor(): Actor | null {
  return storage.getStore() ?? null;
}

/** Records one audited hostel action. Pass the transaction connection so the
 * log entry commits or rolls back with the change it describes. */
export async function logActivity(
  hostelId: string | null | undefined,
  action: string,
  detail?: string,
  on?: Queryable,
  category?: ActivityCategory
): Promise<void> {
  if (!hostelId) return;
  const actor = currentActor();
  await run(
    "INSERT INTO activity_logs (id, hostel_id, actor_id, actor_name, action, detail, category, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      newId("act"),
      hostelId,
      actor?.id ?? "system",
      actor?.name ?? "System",
      action,
      detail ?? null,
      category ?? null,
      fromIso(new Date().toISOString()),
    ],
    on
  );
}

/** Queues a notification for one user, and — best-effort, outside any
 * transaction — pushes it to that user's browsers so it arrives even when the
 * app is closed. The push send is fire-and-forget: it must never slow the
 * request or fail the surrounding write. */
export async function notify(
  userId: string,
  title: string,
  body: string,
  on?: Queryable
): Promise<void> {
  await run(
    "INSERT INTO notifications (id, user_id, title, body, is_read, created_at) VALUES (?, ?, ?, ?, 0, ?)",
    [newId("notif"), userId, title, body, fromIso(new Date().toISOString())],
    on
  );
  setImmediate(() => {
    void sendPushToUser(userId, { title, body }).catch(() => {});
  });
}

/** Like notify(), but links the notification to an announcement so the feed can
 * show it once (as the personal, pushable notification) instead of twice. Used
 * to fan a general hostel announcement out to every member. */
export async function notifyAnnouncement(
  userId: string,
  announcementId: string,
  title: string,
  body: string,
  on?: Queryable
): Promise<void> {
  await run(
    "INSERT INTO notifications (id, user_id, announcement_id, title, body, is_read, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)",
    [newId("notif"), userId, announcementId, title, body, fromIso(new Date().toISOString())],
    on
  );
  setImmediate(() => {
    void sendPushToUser(userId, { title, body }).catch(() => {});
  });
}

/** Delivers a Web Push to every browser the user has subscribed, pruning any
 * subscription the push service reports as dead. Uses the pool (never a caller's
 * transaction connection) and never throws. */
export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string }
): Promise<void> {
  const subs = await all<{ endpoint: string; p256dh: string; auth: string }>(
    "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?",
    [userId]
  );
  for (const sub of subs) {
    const { gone } = await sendToSubscription(sub, payload);
    if (gone) await run("DELETE FROM push_subscriptions WHERE endpoint = ?", [sub.endpoint]);
  }
}

/** Notifies the people who approve things for a hostel — its manager, and the
 * owner too (they run the hostel and may need to act when there's no manager).
 * Skips whoever performed the action, so a self-triggered request never
 * notifies its own author. Used for every request that needs staff approval. */
export async function notifyHostelStaff(
  hostelId: string,
  title: string,
  body: string,
  on?: Queryable
): Promise<void> {
  const [hostel] = await all<{ manager_id: string | null; owner_id: string | null }>(
    "SELECT manager_id, owner_id FROM hostels WHERE id = ?",
    [hostelId],
    on
  );
  if (!hostel) return;
  const actorId = currentActor()?.id;
  const targets = new Set<string>();
  if (hostel.manager_id) targets.add(hostel.manager_id);
  if (hostel.owner_id) targets.add(hostel.owner_id);
  for (const uid of targets) {
    if (uid && uid !== actorId) await notify(uid, title, body, on);
  }
}

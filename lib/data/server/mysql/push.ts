// MySQL implementation of browser push subscriptions. The actual send lives in
// context.ts (sendPushToUser), called from notify(); this module is just the
// client-facing repo: hand the browser the VAPID public key, and store/drop a
// subscription bound to the SESSION user (never a passed id).

import type { PushSubscriptionRepository } from "../../repository";
import { fromIso, run } from "./connection";
import { currentActor } from "./context";
import { newId } from "./ids";
import { getVapidPublicKey } from "../../../push/webpush";

export const pushSubscriptions: PushSubscriptionRepository = {
  async getPublicKey() {
    return getVapidPublicKey();
  },

  async save(sub) {
    const userId = currentActor()?.id;
    if (!userId || !sub?.endpoint) return;
    // Upsert by endpoint: the same browser re-subscribing (or moving accounts)
    // updates the row rather than piling up duplicates.
    await run(
      `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth)`,
      [newId("push"), userId, sub.endpoint, sub.p256dh, sub.auth, fromIso(new Date().toISOString())]
    );
  },

  async unsubscribe(endpoint) {
    if (!endpoint) return;
    await run("DELETE FROM push_subscriptions WHERE endpoint = ?", [endpoint]);
  },
};

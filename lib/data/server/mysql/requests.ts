// MySQL implementations of the request/approval flows plus announcements,
// notifications and the activity log.
//
// The approval paths are the ones that move people between hostels and rooms,
// so each runs in a transaction: a half-applied approval (member moved but old
// seat still occupied, or notified but not attached) is exactly what the JSON
// store could leave behind.

import type {
  ActivityLog,
  Announcement,
  GuestMealRequest,
  HostelTransferRequest,
  JoinRequest,
  MealSlot,
  MealStopRequest,
  Notification,
} from "../../types";
import type {
  ActivityRepository,
  AnnouncementRepository,
  GuestMealRepository,
  JoinRequestRepository,
  MealStopRepository,
  NotificationRepository,
  TransferRepository,
} from "../../repository";
import { normalizePhone } from "../../../utils/phone";
import { addDays, today } from "../../../utils/date";
import { all, fromIso, one, run, toBool, toDay, toIso, transaction, type Queryable } from "./connection";
import { logActivity, notify, notifyHostelStaff } from "./context";
import { ensureEntries, offeredOnDay } from "./meals";
import { newId } from "./ids";

const serverOnly = (): never => {
  throw new Error("subscribe() is a client-side concern; the server never dispatches it.");
};

const now = () => fromIso(new Date().toISOString());

// ── Join requests ──────────────────────────────────────────────────────────

interface JoinRow {
  id: string; hostel_id: string; user_id: string | null; name: string;
  phone: string; status: JoinRequest["status"]; created_at: string;
}

const toJoin = (r: JoinRow): JoinRequest => ({
  id: r.id,
  hostelId: r.hostel_id,
  name: r.name,
  phone: r.phone,
  ...(r.user_id ? { userId: r.user_id } : {}),
  status: r.status,
  createdAt: toIso(r.created_at),
});

const JOIN_COLS = "id, hostel_id, user_id, name, phone, status, created_at";

export const joinRequests: JoinRequestRepository = {
  async listByHostel(hostelId) {
    return (await all<JoinRow>(`SELECT ${JOIN_COLS} FROM join_requests WHERE hostel_id = ?`, [hostelId])).map(toJoin);
  },

  async listByUser(userId) {
    return (await all<JoinRow>(`SELECT ${JOIN_COLS} FROM join_requests WHERE user_id = ?`, [userId])).map(toJoin);
  },

  async create(req) {
    await transaction(async (tx) => {
      // Platform-account-only: a join request must come from a signed-up
      // account. Walk-ins typed by hand are not allowed.
      if (!req.userId) {
        throw new Error(
          "Only people with a platform account can join — ask them to create an account and scan the hostel's QR."
        );
      }
      const requester = await one<{ id: string; hostel_id: string | null; role: string }>(
        "SELECT id, hostel_id, role FROM users WHERE id = ?",
        [req.userId],
        tx
      );
      if (!requester) throw new Error("No platform account found for this request.");
      // One-hostel rule: already a member somewhere → transfer, not join.
      if (requester.hostel_id && !["owner", "superadmin", "marketing", "service"].includes(requester.role)) {
        const current = await one<{ name: string }>("SELECT name FROM hostels WHERE id = ?", [requester.hostel_id], tx);
        throw new Error(
          `You're already a member of ${current?.name ?? "a hostel"} — use a hostel transfer to move.`
        );
      }
      await run(
        "INSERT INTO join_requests (id, hostel_id, user_id, name, phone, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)",
        [newId("join"), req.hostelId, req.userId, req.name, req.phone, now()],
        tx
      );
      await notifyHostelStaff(
        req.hostelId,
        "New join request",
        `${req.name} has requested to join your hostel. Review it in Approvals.`,
        tx
      );
    });
  },

  async decide(id, status, roomId) {
    await transaction(async (tx) => {
      const req = await one<JoinRow>(`SELECT ${JOIN_COLS} FROM join_requests WHERE id = ? FOR UPDATE`, [id], tx);
      if (!req) return;
      await run("UPDATE join_requests SET status = ? WHERE id = ?", [status, id], tx);

      if (status === "approved" && roomId) {
        const room = await one<{ id: string; hostel_id: string; number: string; capacity: number }>(
          "SELECT id, hostel_id, number, capacity FROM rooms WHERE id = ? FOR UPDATE",
          [roomId],
          tx
        );
        if (!room) return;

        // The request's own account, or (legacy walk-ins) an existing account
        // matching its phone. No account behind it → can't add a
        // non-account-holder, so deny instead.
        let linkedId = req.user_id ?? undefined;
        if (!linkedId) {
          const candidates = await all<{ id: string; phone: string; role: string }>(
            "SELECT id, phone, role FROM users WHERE role NOT IN ('owner','superadmin','marketing','service')",
            [],
            tx
          );
          linkedId = candidates.find((c) => normalizePhone(c.phone) === normalizePhone(req.phone))?.id;
        }
        if (!linkedId) {
          await run("UPDATE join_requests SET status = 'denied' WHERE id = ?", [id], tx);
          return;
        }

        const target = await one<{ id: string; hostel_id: string | null; name: string }>(
          "SELECT id, hostel_id, name FROM users WHERE id = ?",
          [linkedId],
          tx
        );
        if (!target) return;
        // Became a member elsewhere while this sat pending → deny.
        if (target.hostel_id && target.hostel_id !== req.hostel_id) {
          await run("UPDATE join_requests SET status = 'denied' WHERE id = ?", [id], tx);
          await notify(
            linkedId,
            "Join request declined",
            "You're already a member of another hostel — a member can only belong to one hostel at a time.",
            tx
          );
          return;
        }

        await run(
          "UPDATE users SET hostel_id = ?, room_id = ?, joined_at = ? WHERE id = ?",
          [req.hostel_id, roomId, today(), linkedId],
          tx
        );
        // A second hostel must not also be able to approve them.
        await run(
          "UPDATE join_requests SET status = 'denied' WHERE user_id = ? AND id <> ? AND status = 'pending'",
          [linkedId, id],
          tx
        );
        await notify(
          linkedId,
          "Join request approved",
          "Welcome! Your join request was approved and a room seat is assigned — your hostel dashboard is ready.",
          tx
        );
      } else if (status === "denied" && req.user_id) {
        await notify(
          req.user_id,
          "Join request declined",
          "Your join request was declined by the hostel manager. You can request a different hostel.",
          tx
        );
      }
    });
  },

  subscribe: serverOnly,
};

// ── Hostel transfers ───────────────────────────────────────────────────────

interface TransferRow {
  id: string; user_id: string; from_hostel_id: string; to_hostel_id: string;
  reason: string; stage: HostelTransferRequest["stage"];
}

async function loadTransfers(where: string, params: unknown[], on?: Queryable): Promise<HostelTransferRequest[]> {
  const rows = await all<TransferRow>(
    `SELECT id, user_id, from_hostel_id, to_hostel_id, reason, stage FROM transfer_requests WHERE ${where}`,
    params,
    on
  );
  if (!rows.length) return [];
  const timeline = await all<{ transfer_id: string; stage: string; at: string; by_user_id: string | null; position: number }>(
    `SELECT transfer_id, stage, at, by_user_id, position FROM transfer_timeline
      WHERE transfer_id IN (${rows.map(() => "?").join(",")}) ORDER BY position`,
    rows.map((r) => r.id),
    on
  );
  const byId = new Map<string, HostelTransferRequest["timeline"]>();
  for (const t of timeline) {
    const list = byId.get(t.transfer_id) ?? [];
    list.push({ stage: t.stage, at: toIso(t.at), ...(t.by_user_id ? { by: t.by_user_id } : {}) });
    byId.set(t.transfer_id, list);
  }
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    fromHostelId: r.from_hostel_id,
    toHostelId: r.to_hostel_id,
    reason: r.reason,
    stage: r.stage,
    timeline: byId.get(r.id) ?? [],
  }));
}

export const transfers: TransferRepository = {
  async listByHostel(hostelId) {
    return loadTransfers("from_hostel_id = ? OR to_hostel_id = ?", [hostelId, hostelId]);
  },

  async request(req) {
    await transaction(async (tx) => {
      const id = newId("transfer");
      await run(
        "INSERT INTO transfer_requests (id, user_id, from_hostel_id, to_hostel_id, reason, stage) VALUES (?, ?, ?, ?, ?, 'requested')",
        [id, req.userId, req.fromHostelId, req.toHostelId, req.reason],
        tx
      );
      await run(
        "INSERT INTO transfer_timeline (id, transfer_id, position, stage, at) VALUES (?, ?, 0, 'requested', ?)",
        [newId("tl"), id, now()],
        tx
      );
      // The member's CURRENT hostel reviews the transfer-out first.
      await notifyHostelStaff(
        req.fromHostelId,
        "Hostel transfer request",
        "A member has requested to transfer out of your hostel. Review it in Approvals.",
        tx
      );
    });
  },

  async advance(id, decidedBy, approve) {
    await transaction(async (tx) => {
      const [t] = await loadTransfers("id = ?", [id], tx);
      if (!t) return;
      const next: Record<string, string> = {
        requested: approve ? "manager_review" : "denied",
        manager_review: approve ? "owner_review" : "denied",
        owner_review: approve ? "approved" : "denied",
      };
      const nextStage = next[t.stage] ?? t.stage;
      await run("UPDATE transfer_requests SET stage = ? WHERE id = ?", [nextStage, id], tx);
      await run(
        "INSERT INTO transfer_timeline (id, transfer_id, position, stage, at, by_user_id) VALUES (?, ?, ?, ?, ?, ?)",
        [newId("tl"), id, t.timeline.length, nextStage, now(), decidedBy],
        tx
      );
      if (nextStage === "approved") {
        // Final approval migrates the student: they move hostel and lose the
        // old room; the new hostel's manager assigns a seat.
        await run("UPDATE users SET hostel_id = ?, room_id = NULL WHERE id = ?", [t.toHostelId, t.userId], tx);
      }
    });
  },

  async cancel(id) {
    await run("DELETE FROM transfer_requests WHERE id = ?", [id]);
  },

  subscribe: serverOnly,
};

// ── Meal stop requests ─────────────────────────────────────────────────────

export const mealStops: MealStopRepository = {
  async listByHostel(hostelId) {
    const rows = await all<{
      id: string; hostel_id: string; user_id: string; date_from: string; date_to: string;
      reason: string | null; desired_on: number; status: MealStopRequest["status"];
    }>(
      "SELECT id, hostel_id, user_id, date_from, date_to, reason, desired_on, status FROM meal_stop_requests WHERE hostel_id = ?",
      [hostelId]
    );
    if (!rows.length) return [];
    const meals = await all<{ request_id: string; meal: MealSlot }>(
      `SELECT request_id, meal FROM meal_stop_meals WHERE request_id IN (${rows.map(() => "?").join(",")})`,
      rows.map((r) => r.id)
    );
    const byReq = new Map<string, MealSlot[]>();
    for (const m of meals) {
      const list = byReq.get(m.request_id) ?? [];
      list.push(m.meal);
      byReq.set(m.request_id, list);
    }
    return rows.map<MealStopRequest>((r) => ({
      id: r.id,
      hostelId: r.hostel_id,
      userId: r.user_id,
      meals: byReq.get(r.id) ?? [],
      dateFrom: toDay(r.date_from),
      dateTo: toDay(r.date_to),
      reason: r.reason ?? undefined,
      desiredOn: toBool(r.desired_on),
      status: r.status,
    }));
  },

  async request(req) {
    await transaction(async (tx) => {
      const id = newId("stop");
      await run(
        "INSERT INTO meal_stop_requests (id, hostel_id, user_id, date_from, date_to, reason, desired_on, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')",
        [id, req.hostelId, req.userId, req.dateFrom, req.dateTo, req.reason ?? null, req.desiredOn ? 1 : 0],
        tx
      );
      for (const m of req.meals ?? []) {
        await run("INSERT IGNORE INTO meal_stop_meals (request_id, meal) VALUES (?, ?)", [id, m], tx);
      }
      await notifyHostelStaff(
        req.hostelId,
        req.desiredOn ? "Meal resume request" : "Meal stop request",
        `A member has requested a meal change for ${req.dateFrom}${req.dateTo !== req.dateFrom ? ` – ${req.dateTo}` : ""}. Review it in Approvals.`,
        tx
      );
    });
  },

  /** Approving writes the decided status straight onto every date in the
   * range — including future dates, which then already hold the right value
   * when they arrive, and today, which members can't change themselves. */
  async decide(id, status) {
    await transaction(async (tx) => {
      const req = await one<{
        id: string; hostel_id: string; user_id: string;
        date_from: string; date_to: string; desired_on: number;
      }>(
        "SELECT id, hostel_id, user_id, date_from, date_to, desired_on FROM meal_stop_requests WHERE id = ?",
        [id],
        tx
      );
      if (!req) return;
      await run("UPDATE meal_stop_requests SET status = ? WHERE id = ?", [status, id], tx);
      if (status !== "approved") return;

      const wantOn = toBool(req.desired_on);
      const slots = (
        await all<{ meal: MealSlot }>("SELECT meal FROM meal_stop_meals WHERE request_id = ?", [id], tx)
      ).map((m) => m.meal);
      let day = toDay(req.date_from);
      const last = toDay(req.date_to);
      while (day <= last) {
        // Past days are history and are never rewritten by an approval.
        if (day >= today()) {
          await ensureEntries(req.hostel_id, day, req.user_id, tx);
          const offered = await offeredOnDay(req.hostel_id, day, tx);
          for (const slot of slots) {
            // Can't switch on a slot the day never offered.
            if (wantOn && !offered[slot]) continue;
            await run(
              "UPDATE meal_entries SET is_on = ? WHERE hostel_id = ? AND day = ? AND user_id = ? AND meal = ?",
              [wantOn ? 1 : 0, req.hostel_id, day, req.user_id, slot],
              tx
            );
          }
        }
        day = addDays(day, 1);
      }
      await notify(
        req.user_id,
        wantOn ? "Meal request approved" : "Meal stop approved",
        `Your request for ${toDay(req.date_from)}${last !== toDay(req.date_from) ? ` – ${last}` : ""} was approved.`,
        tx
      );
    });
  },

  subscribe: serverOnly,
};

// ── Guest meal requests ────────────────────────────────────────────────────

export const guestMeals: GuestMealRepository = {
  async listByHostel(hostelId) {
    const rows = await all<{
      id: string; hostel_id: string; user_id: string; meal: MealSlot; day: string;
      guest_name: string; qty: number; status: GuestMealRequest["status"];
    }>(
      "SELECT id, hostel_id, user_id, meal, day, guest_name, qty, status FROM guest_meal_requests WHERE hostel_id = ?",
      [hostelId]
    );
    return rows.map<GuestMealRequest>((r) => ({
      id: r.id,
      hostelId: r.hostel_id,
      userId: r.user_id,
      meal: r.meal,
      date: toDay(r.day),
      guestName: r.guest_name,
      qty: r.qty,
      status: r.status,
    }));
  },

  async request(req) {
    await run(
      "INSERT INTO guest_meal_requests (id, hostel_id, user_id, meal, day, guest_name, qty, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')",
      [newId("guest"), req.hostelId, req.userId, req.meal, req.date, req.guestName, req.qty]
    );
    await notifyHostelStaff(
      req.hostelId,
      "Guest meal request",
      `A member has requested ${req.qty} guest meal${req.qty > 1 ? "s" : ""} (${req.meal}) for ${req.date}. Review it in Approvals.`,
      undefined
    );
  },

  async decide(id, status) {
    await transaction(async (tx) => {
      const req = await one<{ hostel_id: string; user_id: string; meal: MealSlot; day: string; qty: number }>(
        "SELECT hostel_id, user_id, meal, day, qty FROM guest_meal_requests WHERE id = ?",
        [id],
        tx
      );
      if (!req) return;
      await run("UPDATE guest_meal_requests SET status = ? WHERE id = ?", [status, id], tx);
      if (status !== "approved") return;
      const day = toDay(req.day);
      await ensureEntries(req.hostel_id, day, req.user_id, tx);
      await run(
        "UPDATE meal_entries SET guest_count = guest_count + ? WHERE hostel_id = ? AND day = ? AND user_id = ? AND meal = ?",
        [req.qty, req.hostel_id, day, req.user_id, req.meal],
        tx
      );
    });
  },

  subscribe: serverOnly,
};

// ── Announcements ──────────────────────────────────────────────────────────

interface AnnouncementRow {
  id: string; hostel_id: string; kind: Announcement["kind"]; title: string;
  body: string; payload: unknown; created_at: string;
}

const toAnnouncement = (r: AnnouncementRow): Announcement => ({
  id: r.id,
  hostelId: r.hostel_id,
  kind: r.kind,
  title: r.title,
  body: r.body,
  ...(r.payload ? { payload: (typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload) as Record<string, unknown> } : {}),
  createdAt: toIso(r.created_at),
});

export const announcements: AnnouncementRepository = {
  async listByHostel(hostelId) {
    const rows = await all<AnnouncementRow>(
      "SELECT id, hostel_id, kind, title, body, payload, created_at FROM announcements WHERE hostel_id = ? ORDER BY created_at DESC",
      [hostelId]
    );
    return rows.map(toAnnouncement);
  },

  async post(a) {
    const id = newId("ann");
    const createdAt = new Date().toISOString();
    await run(
      "INSERT INTO announcements (id, hostel_id, kind, title, body, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, a.hostelId, a.kind ?? "general", a.title, a.body, a.payload ? JSON.stringify(a.payload) : null, fromIso(createdAt)]
    );
    return { ...a, id, createdAt };
  },

  async update(id, patch) {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (patch.kind !== undefined) { sets.push("kind = ?"); params.push(patch.kind); }
    if (patch.title !== undefined) { sets.push("title = ?"); params.push(patch.title); }
    if (patch.body !== undefined) { sets.push("body = ?"); params.push(patch.body); }
    if (patch.payload !== undefined) { sets.push("payload = ?"); params.push(JSON.stringify(patch.payload)); }
    if (!sets.length) return;
    params.push(id);
    await run(`UPDATE announcements SET ${sets.join(", ")} WHERE id = ?`, params);
  },

  subscribe: serverOnly,
};

// ── Notifications ──────────────────────────────────────────────────────────

export const notifications: NotificationRepository = {
  async listByUser(userId) {
    const rows = await all<{
      id: string; user_id: string; announcement_id: string | null;
      title: string; body: string; is_read: number; created_at: string;
    }>(
      "SELECT id, user_id, announcement_id, title, body, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );
    return rows.map<Notification>((r) => ({
      id: r.id,
      userId: r.user_id,
      ...(r.announcement_id ? { announcementId: r.announcement_id } : {}),
      title: r.title,
      body: r.body,
      read: toBool(r.is_read),
      createdAt: toIso(r.created_at),
    }));
  },

  async create(n) {
    await run(
      "INSERT INTO notifications (id, user_id, announcement_id, title, body, is_read, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)",
      [newId("notif"), n.userId, n.announcementId ?? null, n.title, n.body, now()]
    );
  },

  async markRead(id) {
    await run("UPDATE notifications SET is_read = 1 WHERE id = ?", [id]);
  },

  subscribe: serverOnly,
};

// ── Activity log ───────────────────────────────────────────────────────────

export const activity: ActivityRepository = {
  async listByHostel(hostelId) {
    const rows = await all<{
      id: string; hostel_id: string; actor_id: string; actor_name: string;
      action: string; detail: string | null; created_at: string;
    }>(
      "SELECT id, hostel_id, actor_id, actor_name, action, detail, created_at FROM activity_logs WHERE hostel_id = ? ORDER BY created_at DESC",
      [hostelId]
    );
    return rows.map<ActivityLog>((r) => ({
      id: r.id,
      hostelId: r.hostel_id,
      actorId: r.actor_id,
      actorName: r.actor_name,
      action: r.action,
      detail: r.detail ?? undefined,
      createdAt: toIso(r.created_at),
    }));
  },

  async log(entry) {
    await logActivity(entry.hostelId, entry.action, entry.detail);
  },

  subscribe: serverOnly,
};

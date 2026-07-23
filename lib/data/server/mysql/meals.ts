// MySQL implementations of the meal-day, menu, rating and comment
// repositories.
//
// Every date carries its own complete meal history:
//
//  * meal_days pins what the hostel OFFERED that day. Changing the hostel's
//    current setting therefore never rewrites a past day's counts.
//  * Once a day arrives it is SEALED: every member who was an active boarder
//    then gets an explicit row (defaulting to that day's offer). Counting
//    reads only stored rows, so a member who never opens the app is still
//    counted, and later bans/removals can't alter a past day.
//  * A slot the day didn't offer can never be switched on, and its entries
//    are stored as off — so an offer-off day counts zero.

import type {
  Comment,
  MealDay,
  MealSlot,
  Menu,
  Rating,
  Reaction,
} from "../../types";
import type {
  CommentRepository,
  MealRepository,
  MenuRepository,
  RatingRepository,
} from "../../repository";
import { addDays, today } from "../../../utils/date";
import { canToggleMeal } from "../../../utils/mealPolicy";
import { all, fromIso, one, run, toBool, toDay, toIso, transaction, type Queryable } from "./connection";
import { notify } from "./context";
import { newId } from "./ids";

const serverOnly = (): never => {
  throw new Error("subscribe() is a client-side concern; the server never dispatches it.");
};

const MEALS: MealSlot[] = ["breakfast", "lunch", "dinner"];

/** The hostel's CURRENT offer setting (the template for new days). */
export async function offeredSlots(hostelId: string, on?: Queryable): Promise<Record<MealSlot, boolean>> {
  const row = await one<{ offers_breakfast: number; offers_lunch: number; offers_dinner: number }>(
    "SELECT offers_breakfast, offers_lunch, offers_dinner FROM hostels WHERE id = ?",
    [hostelId],
    on
  );
  return {
    breakfast: row ? toBool(row.offers_breakfast) : true,
    lunch: row ? toBool(row.offers_lunch) : true,
    dinner: row ? toBool(row.offers_dinner) : true,
  };
}

/** What was offered ON a specific day. Falls back to the hostel's current
 * setting only for a day that doesn't exist yet (i.e. a future day being
 * created now). */
export async function offeredOnDay(
  hostelId: string,
  day: string,
  on?: Queryable
): Promise<Record<MealSlot, boolean>> {
  const row = await one<{ offers_breakfast: number; offers_lunch: number; offers_dinner: number }>(
    "SELECT offers_breakfast, offers_lunch, offers_dinner FROM meal_days WHERE hostel_id = ? AND day = ?",
    [hostelId, day],
    on
  );
  if (!row) return offeredSlots(hostelId, on);
  return {
    breakfast: toBool(row.offers_breakfast),
    lunch: toBool(row.offers_lunch),
    dinner: toBool(row.offers_dinner),
  };
}

/** Creates the day row if absent, pinning the hostel's offer onto it. */
async function ensureMealDay(hostelId: string, day: string, on: Queryable): Promise<void> {
  const offered = await offeredSlots(hostelId, on);
  await run(
    `INSERT IGNORE INTO meal_days (hostel_id, day, offers_breakfast, offers_lunch, offers_dinner)
     VALUES (?, ?, ?, ?, ?)`,
    [hostelId, day, offered.breakfast ? 1 : 0, offered.lunch ? 1 : 0, offered.dinner ? 1 : 0],
    on
  );
}

/** Materialises one member's three slots for a day, defaulting to THAT DAY's
 * offer (never the hostel's current setting, for a day already pinned). */
export async function ensureEntries(hostelId: string, day: string, userId: string, on: Queryable): Promise<void> {
  await ensureMealDay(hostelId, day, on);
  const offered = await offeredOnDay(hostelId, day, on);
  for (const slot of MEALS) {
    await run(
      "INSERT IGNORE INTO meal_entries (hostel_id, day, user_id, meal, is_on, guest_count) VALUES (?, ?, ?, ?, ?, 0)",
      [hostelId, day, userId, slot, offered[slot] ? 1 : 0],
      on
    );
  }
}

/**
 * Seals every unsealed day in [from, min(to, today)]: pins the day's offer and
 * gives every currently-active boarder an explicit row (without touching rows
 * that already exist, so members' own choices win).
 *
 * This is what makes a member who never opens the app still count, and what
 * freezes a day so later bans/removals/setting changes can't rewrite it.
 * Idempotent, so it's safe to call before any read or count.
 */
export async function sealDays(hostelId: string, from: string, to: string): Promise<void> {
  const last = to < today() ? to : today();
  if (from > last) return;
  await transaction(async (tx) => {
    const unsealed = await all<{ day: string }>(
      `SELECT d.day FROM meal_days d
        WHERE d.hostel_id = ? AND d.day BETWEEN ? AND ? AND d.sealed_at IS NULL`,
      [hostelId, from, last],
      tx
    );
    // Days nobody ever touched have no row yet — they still need sealing.
    const existing = new Set(unsealed.map((d) => toDay(d.day)));
    const known = await all<{ day: string }>(
      "SELECT day FROM meal_days WHERE hostel_id = ? AND day BETWEEN ? AND ?",
      [hostelId, from, last],
      tx
    );
    const knownSet = new Set(known.map((d) => toDay(d.day)));
    for (let day = from; day <= last; day = addDays(day, 1)) {
      if (knownSet.has(day) && !existing.has(day)) continue; // already sealed
      await ensureMealDay(hostelId, day, tx);
      const offered = await offeredOnDay(hostelId, day, tx);
      // Everyone who is an active boarder at sealing time AND had already
      // joined by this day — a member who joined later was not here to eat, so
      // they get no row (and thus never count) for days before their join.
      const boarders = await all<{ id: string }>(
        `SELECT id FROM users
          WHERE hostel_id = ? AND banned = 0
            AND role NOT IN ('cook','owner','superadmin','marketing','service')
            AND (joined_at IS NULL OR joined_at <= ?)`,
        [hostelId, day],
        tx
      );
      for (const b of boarders) {
        for (const slot of MEALS) {
          await run(
            "INSERT IGNORE INTO meal_entries (hostel_id, day, user_id, meal, is_on, guest_count) VALUES (?, ?, ?, ?, ?, 0)",
            [hostelId, day, b.id, slot, offered[slot] ? 1 : 0],
            tx
          );
        }
      }
      await run(
        "UPDATE meal_days SET sealed_at = ? WHERE hostel_id = ? AND day = ? AND sealed_at IS NULL",
        [fromIso(new Date().toISOString()), hostelId, day],
        tx
      );
    }
  });
}

interface EntryRow {
  day: string; user_id: string; meal: MealSlot; is_on: number; guest_count: number;
}

interface DayRow {
  day: string;
  shopping_user_id: string | null;
  offers_breakfast: number;
  offers_lunch: number;
  offers_dinner: number;
  sealed_at: string | null;
}

const DAY_COLS = "day, shopping_user_id, offers_breakfast, offers_lunch, offers_dinner, sealed_at";

function buildDays(hostelId: string, dayRows: DayRow[], entries: EntryRow[]): MealDay[] {
  const byDay = new Map<string, MealDay>();
  for (const d of dayRows) {
    const key = toDay(d.day);
    byDay.set(key, {
      hostelId,
      date: key,
      entries: {},
      ...(d.shopping_user_id ? { shoppingUserId: d.shopping_user_id } : {}),
      mealsOffered: {
        breakfast: toBool(d.offers_breakfast),
        lunch: toBool(d.offers_lunch),
        dinner: toBool(d.offers_dinner),
      },
      sealed: Boolean(d.sealed_at),
    });
  }
  for (const e of entries) {
    const key = toDay(e.day);
    let day = byDay.get(key);
    if (!day) {
      day = { hostelId, date: key, entries: {} };
      byDay.set(key, day);
    }
    const entry = (day.entries[e.user_id] ??= {
      breakfast: { on: false, guestCount: 0 },
      lunch: { on: false, guestCount: 0 },
      dinner: { on: false, guestCount: 0 },
    });
    entry[e.meal] = { on: toBool(e.is_on), guestCount: Number(e.guest_count) };
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export const meals: MealRepository = {
  /** The AUTOMATIC per-meal cost: this month's shopping spend ÷ meals eaten
   * (member + guest) by CURRENT boarders. Bills charge this, nothing manual. */
  async getActualMealRate(hostelId, month) {
    // Seal the month first so days nobody touched still contribute the meals
    // that were actually eaten.
    await sealDays(hostelId, `${month}-01`, `${month}-31`);
    // Only APPROVED shopping counts — the same condition generateBills uses
    // (billing.ts mealRateFor), so the rate members see matches the rate they
    // are billed. Pending/denied costs are excluded until a manager approves.
    const spend = await one<{ total: number | null }>(
      `SELECT SUM(c.amount) AS total FROM shopping_costs c
        WHERE c.hostel_id = ? AND c.status = 'approved'
          AND EXISTS (SELECT 1 FROM shopping_cost_dates d
                       WHERE d.cost_id = c.id AND DATE_FORMAT(d.day, '%Y-%m') = ?)`,
      [hostelId, month]
    );
    const totalShopping = Number(spend?.total ?? 0);

    // Only current, non-banned boarders count (cooks and platform roles never
    // do) — AND only a (day, meal) the manager has confirmed was actually
    // cooked. An unconfirmed or confirmed-absent slot contributes zero,
    // regardless of any member's own on/off toggle.
    const meals = await one<{ own: number | null; guests: number | null }>(
      `SELECT SUM(e.is_on) AS own, SUM(e.guest_count) AS guests
         FROM meal_entries e
         JOIN users u ON u.id = e.user_id
        WHERE e.hostel_id = ?
          AND DATE_FORMAT(e.day, '%Y-%m') = ?
          AND u.hostel_id = ?
          AND u.banned = 0
          AND u.role NOT IN ('cook','owner','superadmin','marketing','service')
          AND (u.joined_at IS NULL OR u.joined_at <= e.day)
          AND EXISTS (
            SELECT 1 FROM cook_attendance_reports r
             WHERE r.hostel_id = e.hostel_id AND r.day = e.day AND r.meal = e.meal
               AND r.status = 'resolved_cooked'
          )`,
      [hostelId, month, hostelId]
    );
    const totalMeals = Number(meals?.own ?? 0) + Number(meals?.guests ?? 0);
    return { rate: totalMeals > 0 ? totalShopping / totalMeals : 0, totalShopping, totalMeals };
  },

  async getMealDay(hostelId, date) {
    await sealDays(hostelId, date, date);
    const dayRows = await all<DayRow>(
      `SELECT ${DAY_COLS} FROM meal_days WHERE hostel_id = ? AND day = ?`,
      [hostelId, date]
    );
    const entries = await all<EntryRow>(
      "SELECT day, user_id, meal, is_on, guest_count FROM meal_entries WHERE hostel_id = ? AND day = ?",
      [hostelId, date]
    );
    const days = buildDays(hostelId, dayRows, entries);
    if (days[0]) return days[0];
    // A future day nobody has touched: report what it WOULD offer.
    return { hostelId, date, entries: {}, mealsOffered: await offeredSlots(hostelId), sealed: false };
  },

  async listMealDays(hostelId, range) {
    await sealDays(hostelId, range.from, range.to);
    const dayRows = await all<DayRow>(
      `SELECT ${DAY_COLS} FROM meal_days WHERE hostel_id = ? AND day BETWEEN ? AND ?`,
      [hostelId, range.from, range.to]
    );
    const entries = await all<EntryRow>(
      "SELECT day, user_id, meal, is_on, guest_count FROM meal_entries WHERE hostel_id = ? AND day BETWEEN ? AND ?",
      [hostelId, range.from, range.to]
    );
    return buildDays(hostelId, dayRows, entries);
  },

  /** A member changing their own meal. Only dates still before their cutoff
   * are editable directly — today and anything past its cutoff must go
   * through a manager-approved request instead (see mealStops). */
  async setMemberMealToggle(hostelId, userId, date, meal, on) {
    await transaction(async (tx) => {
      const cutoff = await one<{ meal_toggle_cutoff: string }>(
        "SELECT meal_toggle_cutoff FROM hostels WHERE id = ?",
        [hostelId],
        tx
      );
      const decision = canToggleMeal(date, cutoff?.meal_toggle_cutoff);
      if (!decision.allowed) throw new Error(decision.message ?? "This meal can no longer be changed.");

      // A slot the day doesn't offer can never be turned on.
      if (on && !(await offeredOnDay(hostelId, date, tx))[meal]) return;
      await ensureEntries(hostelId, date, userId, tx);
      await run(
        "UPDATE meal_entries SET is_on = ? WHERE hostel_id = ? AND day = ? AND user_id = ? AND meal = ?",
        [on ? 1 : 0, hostelId, date, userId, meal],
        tx
      );
    });
  },

  /** Manager/owner applying an APPROVED change, bypassing the member cutoff —
   * this is the path a locked date goes through. */
  async setMemberMealApproved(hostelId, userId, date, meal, on) {
    await transaction(async (tx) => {
      if (on && !(await offeredOnDay(hostelId, date, tx))[meal]) return;
      await ensureEntries(hostelId, date, userId, tx);
      await run(
        "UPDATE meal_entries SET is_on = ? WHERE hostel_id = ? AND day = ? AND user_id = ? AND meal = ?",
        [on ? 1 : 0, hostelId, date, userId, meal],
        tx
      );
    });
  },

  async addGuestMeal(hostelId, userId, date, meal, count) {
    await transaction(async (tx) => {
      if (!(await offeredSlots(hostelId, tx))[meal]) return;
      await ensureEntries(hostelId, date, userId, tx);
      await run(
        "UPDATE meal_entries SET guest_count = guest_count + ? WHERE hostel_id = ? AND day = ? AND user_id = ? AND meal = ?",
        [count, hostelId, date, userId, meal],
        tx
      );
    });
  },

  /** Turns every slot on/off for one member across a date range — the
   * manager suspending meals for an unpaid bill (and resuming them). */
  async setMemberMealsForRange(hostelId, userId, from, to, on) {
    await transaction(async (tx) => {
      const offered = await offeredSlots(hostelId, tx);
      let day = from;
      while (day <= to) {
        await ensureEntries(hostelId, day, userId, tx);
        for (const slot of MEALS) {
          // Resuming must not switch on slots the hostel has closed.
          await run(
            "UPDATE meal_entries SET is_on = ? WHERE hostel_id = ? AND day = ? AND user_id = ? AND meal = ?",
            [on && offered[slot] ? 1 : 0, hostelId, day, userId, slot],
            tx
          );
        }
        const next = new Date(`${day}T00:00:00Z`);
        next.setUTCDate(next.getUTCDate() + 1);
        day = next.toISOString().slice(0, 10);
      }
      await run("UPDATE users SET meals_suspended = ? WHERE id = ?", [on ? 0 : 1, userId], tx);
      await notify(
        userId,
        on ? "Meals resumed" : "Meals turned off",
        on
          ? "Your meals have been turned back on by the manager."
          : "Your meals have been turned off by the manager because your bill is unpaid. Pay your bill to resume your meals.",
        tx
      );
    });
  },

  subscribe: serverOnly,
};

// ── Menus ──────────────────────────────────────────────────────────────────

export const menus: MenuRepository = {
  async getMenu(hostelId, date) {
    const exists = await one<{ day: string }>(
      "SELECT day FROM menus WHERE hostel_id = ? AND day = ?",
      [hostelId, date]
    );
    if (!exists) return undefined;
    const rows = await all<{ meal: MealSlot; dish: string }>(
      "SELECT meal, dish FROM menu_dishes WHERE hostel_id = ? AND day = ? ORDER BY meal, position",
      [hostelId, date]
    );
    const dishes: Menu["dishes"] = { breakfast: [], lunch: [], dinner: [] };
    for (const r of rows) dishes[r.meal].push(r.dish);
    return { hostelId, date, dishes };
  },

  async saveMenu(hostelId, date, dishes) {
    await transaction(async (tx) => {
      await run("INSERT IGNORE INTO menus (hostel_id, day) VALUES (?, ?)", [hostelId, date], tx);
      await run("DELETE FROM menu_dishes WHERE hostel_id = ? AND day = ?", [hostelId, date], tx);
      for (const slot of MEALS) {
        const list = dishes[slot] ?? [];
        for (let i = 0; i < list.length; i += 1) {
          await run(
            "INSERT INTO menu_dishes (hostel_id, day, meal, position, dish) VALUES (?, ?, ?, ?, ?)",
            [hostelId, date, slot, i, list[i]],
            tx
          );
        }
      }
    });
  },

  subscribe: serverOnly,
};

// ── Ratings ────────────────────────────────────────────────────────────────

interface RatingRow {
  id: string; hostel_id: string; user_id: string; day: string;
  meal: MealSlot; target: Rating["target"]; stars: number;
}

const toRating = (r: RatingRow): Rating => ({
  id: r.id,
  hostelId: r.hostel_id,
  userId: r.user_id,
  date: toDay(r.day),
  meal: r.meal,
  target: r.target,
  stars: r.stars as Rating["stars"],
});

export const ratings: RatingRepository = {
  async listForDate(hostelId, date) {
    const rows = await all<RatingRow>(
      "SELECT id, hostel_id, user_id, day, meal, target, stars FROM ratings WHERE hostel_id = ? AND day = ?",
      [hostelId, date]
    );
    return rows.map(toRating);
  },

  async listByHostel(hostelId) {
    const rows = await all<RatingRow>(
      "SELECT id, hostel_id, user_id, day, meal, target, stars FROM ratings WHERE hostel_id = ?",
      [hostelId]
    );
    return rows.map(toRating);
  },

  /** One rating per user per meal/target/day — re-rating updates in place. */
  async rate(rating) {
    await run(
      `INSERT INTO ratings (id, hostel_id, user_id, day, meal, target, stars) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE stars = VALUES(stars)`,
      [newId("rating"), rating.hostelId, rating.userId, rating.date, rating.meal, rating.target, rating.stars]
    );
  },

  subscribe: serverOnly,
};

// ── Comments & reactions ───────────────────────────────────────────────────

interface CommentRow {
  id: string; hostel_id: string; day: string; user_id: string; body: string; created_at: string;
}

export const comments: CommentRepository = {
  async listForDate(hostelId, date) {
    const rows = await all<CommentRow>(
      "SELECT id, hostel_id, day, user_id, body, created_at FROM comments WHERE hostel_id = ? AND day = ? ORDER BY created_at",
      [hostelId, date]
    );
    return rows.map<Comment>((r) => ({
      id: r.id,
      hostelId: r.hostel_id,
      date: toDay(r.day),
      userId: r.user_id,
      text: r.body,
      createdAt: toIso(r.created_at),
    }));
  },

  async addComment(comment) {
    await run(
      "INSERT INTO comments (id, hostel_id, day, user_id, body, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [newId("comment"), comment.hostelId, comment.date, comment.userId, comment.text, fromIso(new Date().toISOString())]
    );
  },

  async listReactions(commentId) {
    const rows = await all<{ id: string; comment_id: string; user_id: string; emoji: string }>(
      "SELECT id, comment_id, user_id, emoji FROM comment_reactions WHERE comment_id = ?",
      [commentId]
    );
    return rows.map<Reaction>((r) => ({
      id: r.id,
      commentId: r.comment_id,
      userId: r.user_id,
      emoji: r.emoji,
    }));
  },

  async toggleReaction(commentId, userId, emoji) {
    const existing = await one<{ id: string }>(
      "SELECT id FROM comment_reactions WHERE comment_id = ? AND user_id = ? AND emoji = ?",
      [commentId, userId, emoji]
    );
    if (existing) {
      await run("DELETE FROM comment_reactions WHERE id = ?", [existing.id]);
    } else {
      await run(
        "INSERT INTO comment_reactions (id, comment_id, user_id, emoji) VALUES (?, ?, ?, ?)",
        [newId("reaction"), commentId, userId, emoji]
      );
    }
  },

  subscribe: serverOnly,
};

// The MySQL backend, assembled into the same Repositories interface the JSON
// backend implements — so the server can run on either without the UI, the
// RPC layer, or the authorization policy knowing which is active.

import type { Bill, Menu, SwapRequest } from "../../types";
import type { Repositories } from "../../repository";
import { all, one, run, toDay } from "./connection";
import { hostels, rooms, users, verifyUserPassword, verifyUserPasswordById, setUserPassword } from "./core";
import { comments, meals, menus, ratings } from "./meals";
import { bills, expenses, shoppingCosts, shortages } from "./billing";
import {
  activity,
  announcements,
  guestMeals,
  joinRequests,
  leaveRequests,
  mealStops,
  notifications,
  transfers,
} from "./requests";
import { cookAttendance, cookLeave, duties, mealEdits, swaps } from "./duties";
import {
  campaigns,
  cart,
  community,
  coupons,
  exploreInteractions,
  marketing,
  orders,
  products,
  promoSettings,
  serviceCatalog,
  storeSettings,
  studyAbroad,
  studyLeads,
  usedBooks,
} from "./catalogs";

export { ensureReady } from "./bootstrap";
export { closePool } from "./connection";
export { runWithActor } from "./context";
export { verifyUserPassword, verifyUserPasswordById, setUserPassword };
export {
  otpInsert,
  otpLatestActive,
  otpCountSince,
  otpBumpAttempts,
  otpConsume,
  loadSmtp,
  saveSmtp,
} from "./email";

// ── Change counter + extra read queries the RPC layer needs ────────────────

/** Bumped after every mutating call; clients poll it to know when to refetch. */
export async function bumpRevision(): Promise<number> {
  await run("UPDATE data_revision SET rev = rev + 1 WHERE id = 1");
  return getRevision();
}

export async function getRevision(): Promise<number> {
  const row = await one<{ rev: number }>("SELECT rev FROM data_revision WHERE id = 1");
  return Number(row?.rev ?? 0);
}

/** Queries the client's polling subscriptions need but the repository
 * interfaces don't expose (the JSON backend read its store directly). */
export const mysqlSystemQueries = {
  async menusByHostel(hostelId: string): Promise<Menu[]> {
    const days = await all<{ day: string }>("SELECT day FROM menus WHERE hostel_id = ?", [hostelId]);
    const out: Menu[] = [];
    for (const d of days) {
      const menu = await menus.getMenu(hostelId, toDay(d.day));
      if (menu) out.push(menu);
    }
    return out;
  },
  async swapsByHostel(hostelId: string): Promise<SwapRequest[]> {
    const planIds = await all<{ plan_id: string }>(
      "SELECT DISTINCT plan_id FROM swap_requests WHERE hostel_id = ?",
      [hostelId]
    );
    const out: SwapRequest[] = [];
    for (const p of planIds) out.push(...(await swaps.listByPlan(p.plan_id)));
    return out;
  },
  async billByUser(userId: string): Promise<Bill | null> {
    const row = await one<{ hostel_id: string; month: string }>(
      "SELECT hostel_id, month FROM bills WHERE user_id = ? ORDER BY month DESC LIMIT 1",
      [userId]
    );
    if (!row) return null;
    return (await bills.getBill(row.hostel_id, userId, row.month)) ?? null;
  },
};

export const mysqlRepositories: Repositories = {
  users,
  activity,
  rooms,
  hostels,
  meals,
  menus,
  ratings,
  comments,
  duties,
  swaps,
  shoppingCosts,
  shortages,
  bills,
  cookLeave,
  cookAttendance,
  mealEdits,
  announcements,
  notifications,
  expenses,
  transfers,
  joinRequests,
  leaveRequests,
  mealStops,
  guestMeals,
  exploreInteractions,
  community,
  serviceCatalog,
  campaigns,
  marketing,
  products,
  cart,
  orders,
  storeSettings,
  coupons,
  usedBooks,
  studyAbroad,
  studyLeads,
  promoSettings,
};

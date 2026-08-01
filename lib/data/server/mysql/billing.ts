// MySQL implementations of expenses, shopping costs, shortages and bills.
//
// The bill arithmetic is ported from the JSON backend unchanged — same
// ordering, same rounding, same carry-forward rules — because it decides what
// people actually owe. The only difference is where the numbers come from:
// rows are loaded, the identical computation runs, and the result is written
// back inside one transaction.
//
// Regeneration keeps each bill's existing id so payment history (which
// references bill_id) survives, and carries each section's `paid` forward.

import type {
  Bill,
  BillSection,
  BillTarget,
  Expense,
  Payment,
  ShoppingCost,
  ShortageRequest,
} from "../../types";
import type {
  BillRepository,
  ExpenseRepository,
  ShoppingCostRepository,
  ShortageRepository,
} from "../../repository";
import { currentMonth, formatMonthLabel, formatShortDate, monthRange } from "../../../utils/date";
import { isServiceChargeCategory } from "../../../utils/expenseCategories";
import { all, fromIso, one, run, toBool, toDay, toIso, transaction, type Queryable } from "./connection";
import { logActivity, notify, notifyHostelStaff } from "./context";
import { newId } from "./ids";

const serverOnly = (): never => {
  throw new Error("subscribe() is a client-side concern; the server never dispatches it.");
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const SECTION_ORDER: BillSection["label"][] = ["mealCost", "roomRent", "serviceCharge", "cookSalary"];

// ── Expenses ───────────────────────────────────────────────────────────────

interface ExpenseRow {
  id: string; hostel_id: string; category: string; amount: number;
  split_mode: "fixed" | "equal"; date_from: string; date_to: string;
  note: string | null; billing_month: string; billed_at: string | null;
}

async function loadExpenses(hostelId: string, on?: Queryable, month?: string): Promise<Expense[]> {
  const rows = await all<ExpenseRow>(
    `SELECT id, hostel_id, category, amount, split_mode, date_from, date_to, note, billing_month, billed_at
       FROM expenses WHERE hostel_id = ?${month ? " AND billing_month = ?" : ""}`,
    month ? [hostelId, month] : [hostelId],
    on
  );
  if (!rows.length) return [];
  const members = await all<{ expense_id: string; user_id: string }>(
    `SELECT expense_id, user_id FROM expense_members WHERE expense_id IN (${rows.map(() => "?").join(",")})`,
    rows.map((r) => r.id),
    on
  );
  const byExpense = new Map<string, string[]>();
  for (const m of members) {
    const list = byExpense.get(m.expense_id) ?? [];
    list.push(m.user_id);
    byExpense.set(m.expense_id, list);
  }
  return rows.map((r) => ({
    id: r.id,
    hostelId: r.hostel_id,
    category: r.category,
    amount: Number(r.amount),
    splitMode: r.split_mode,
    dateFrom: toDay(r.date_from),
    dateTo: toDay(r.date_to),
    note: r.note ?? undefined,
    memberIds: byExpense.get(r.id) ?? [],
    billingMonth: r.billing_month,
    billedAt: r.billed_at ? toIso(r.billed_at) : undefined,
  }));
}

export const expenses: ExpenseRepository = {
  async listByHostel(hostelId) {
    return loadExpenses(hostelId);
  },

  async add(expense) {
    await transaction(async (tx) => {
      const id = newId("exp");
      await run(
        `INSERT INTO expenses (id, hostel_id, category, amount, split_mode, date_from, date_to, note, billing_month, billed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, expense.hostelId, expense.category, expense.amount, expense.splitMode,
          expense.dateFrom, expense.dateTo, expense.note ?? null, expense.billingMonth,
          expense.billedAt ? fromIso(expense.billedAt) : null,
        ],
        tx
      );
      for (const uid of expense.memberIds ?? []) {
        await run("INSERT INTO expense_members (expense_id, user_id) VALUES (?, ?)", [id, uid], tx);
      }
      await logActivity(
        expense.hostelId,
        "Expense recorded",
        `${expense.category} · ৳${expense.amount}${expense.note ? ` — ${expense.note}` : ""}`,
        tx
      );
    });
  },

  async remove(id) {
    await transaction(async (tx) => {
      const row = await one<ExpenseRow>(
        "SELECT id, hostel_id, category, amount FROM expenses WHERE id = ?",
        [id],
        tx
      );
      if (!row) return;
      await run("DELETE FROM expenses WHERE id = ?", [id], tx);
      await logActivity(row.hostel_id, "Expense removed", `${row.category} · ৳${Number(row.amount)}`, tx);
    });
  },

  subscribe: serverOnly,
};

// ── Shopping costs ─────────────────────────────────────────────────────────

export const shoppingCosts: ShoppingCostRepository = {
  async listByHostel(hostelId) {
    const rows = await all<{
      id: string; hostel_id: string; user_id: string; amount: number; items: string | null;
      status: "pending" | "approved" | "denied"; added_by_manager: number; created_at: string;
    }>(
      "SELECT id, hostel_id, user_id, amount, items, status, added_by_manager, created_at FROM shopping_costs WHERE hostel_id = ?",
      [hostelId]
    );
    if (!rows.length) return [];
    const dates = await all<{ cost_id: string; day: string }>(
      `SELECT cost_id, day FROM shopping_cost_dates WHERE cost_id IN (${rows.map(() => "?").join(",")})`,
      rows.map((r) => r.id)
    );
    const byCost = new Map<string, string[]>();
    for (const d of dates) {
      const list = byCost.get(d.cost_id) ?? [];
      list.push(toDay(d.day));
      byCost.set(d.cost_id, list);
    }
    return rows.map<ShoppingCost>((r) => ({
      id: r.id,
      hostelId: r.hostel_id,
      userId: r.user_id,
      dates: byCost.get(r.id) ?? [],
      amount: Number(r.amount),
      items: r.items ?? undefined,
      status: r.status,
      addedByManager: !!r.added_by_manager,
      createdAt: toIso(r.created_at),
    }));
  },

  async submit(cost) {
    await transaction(async (tx) => {
      const id = newId("shopcost");
      await run(
        "INSERT INTO shopping_costs (id, hostel_id, user_id, amount, items, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)",
        [id, cost.hostelId, cost.userId, cost.amount, cost.items ?? null, fromIso(new Date().toISOString())],
        tx
      );
      for (const day of cost.dates ?? []) {
        await run("INSERT IGNORE INTO shopping_cost_dates (cost_id, day) VALUES (?, ?)", [id, day], tx);
      }
      await notifyHostelStaff(
        cost.hostelId,
        "Shopping cost to approve",
        `A member submitted a ৳${cost.amount} shopping cost for approval. Review it in Finance.`,
        tx
      );
    });
  },

  async recordForMember(cost) {
    // Manager entered it — approved on entry, flagged as manager-added, and the
    // member is told so they (and everyone reading the shopping list) know.
    await transaction(async (tx) => {
      const id = newId("shopcost");
      await run(
        "INSERT INTO shopping_costs (id, hostel_id, user_id, amount, items, status, added_by_manager, created_at) VALUES (?, ?, ?, ?, ?, 'approved', 1, ?)",
        [id, cost.hostelId, cost.userId, cost.amount, cost.items ?? null, fromIso(new Date().toISOString())],
        tx
      );
      for (const day of cost.dates ?? []) {
        await run("INSERT IGNORE INTO shopping_cost_dates (cost_id, day) VALUES (?, ?)", [id, day], tx);
      }
      await notify(
        cost.userId,
        "Shopping cost recorded for you",
        `The manager recorded a ৳${cost.amount} shopping cost as yours. It counts toward this month's meal rate.`,
        tx
      );
    });
  },

  async decide(id, status) {
    await run("UPDATE shopping_costs SET status = ? WHERE id = ?", [status, id]);
  },
};

// ── Shortages ──────────────────────────────────────────────────────────────

export const shortages: ShortageRepository = {
  async listByHostel(hostelId) {
    const rows = await all<{
      id: string; hostel_id: string; cook_id: string; items: string;
      status: "pending" | "resolved"; resolved_by: string | null; resolved_at: string | null; created_at: string;
    }>(
      "SELECT id, hostel_id, cook_id, items, status, resolved_by, resolved_at, created_at FROM shortage_requests WHERE hostel_id = ?",
      [hostelId]
    );
    return rows.map<ShortageRequest>((r) => ({
      id: r.id,
      hostelId: r.hostel_id,
      cookId: r.cook_id,
      items: r.items,
      status: r.status,
      resolvedBy: r.resolved_by ?? undefined,
      resolvedAt: r.resolved_at ? toIso(r.resolved_at) : undefined,
      createdAt: toIso(r.created_at),
    }));
  },

  async report(req) {
    await transaction(async (tx) => {
      const id = newId("shortage");
      const now = fromIso(new Date().toISOString());
      await run(
        "INSERT INTO shortage_requests (id, hostel_id, cook_id, items, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)",
        [id, req.hostelId, req.cookId, req.items, now],
        tx
      );
      // Red-alert announcement so the manager and shopping-duty members see it.
      await run(
        "INSERT INTO announcements (id, hostel_id, kind, title, body, payload, created_at) VALUES (?, ?, 'shortage-alert', ?, ?, ?, ?)",
        [
          newId("ann"), req.hostelId, "Shopping shortage reported",
          `The cook reported missing items: ${req.items}`,
          JSON.stringify({ shortageId: id }), now,
        ],
        tx
      );
    });
  },

  async resolve(id, resolvedBy) {
    await run(
      "UPDATE shortage_requests SET status = 'resolved', resolved_by = ?, resolved_at = ? WHERE id = ?",
      [resolvedBy, fromIso(new Date().toISOString()), id]
    );
  },

  subscribe: serverOnly,
};

// ── Bills ──────────────────────────────────────────────────────────────────

interface BillRow {
  id: string; hostel_id: string; user_id: string; month: string; meals_count: number;
  previous_balance: number; previous_balance_paid: number; grand_total: number;
  paid: number; due_date: string | null;
}

async function loadBills(where: string, params: unknown[], on?: Queryable): Promise<Bill[]> {
  const rows = await all<BillRow>(
    `SELECT id, hostel_id, user_id, month, meals_count, previous_balance, previous_balance_paid,
            grand_total, paid, due_date FROM bills WHERE ${where}`,
    params,
    on
  );
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => "?").join(",");
  const sections = await all<{ id: string; bill_id: string; label: BillSection["label"]; total: number; paid: number }>(
    `SELECT id, bill_id, label, total, paid FROM bill_sections WHERE bill_id IN (${placeholders})`,
    ids,
    on
  );
  const items = sections.length
    ? await all<{ section_id: string; label: string; amount: number; position: number }>(
        `SELECT section_id, label, amount, position FROM bill_line_items WHERE section_id IN (${sections
          .map(() => "?")
          .join(",")}) ORDER BY position`,
        sections.map((s) => s.id),
        on
      )
    : [];
  const itemsBySection = new Map<string, { label: string; amount: number }[]>();
  for (const i of items) {
    const list = itemsBySection.get(i.section_id) ?? [];
    list.push({ label: i.label, amount: Number(i.amount) });
    itemsBySection.set(i.section_id, list);
  }
  const sectionsByBill = new Map<string, BillSection[]>();
  for (const s of sections) {
    const list = sectionsByBill.get(s.bill_id) ?? [];
    list.push({
      label: s.label,
      items: itemsBySection.get(s.id) ?? [],
      total: Number(s.total),
      paid: Number(s.paid),
    });
    sectionsByBill.set(s.bill_id, list);
  }
  return rows.map<Bill>((r) => ({
    id: r.id,
    hostelId: r.hostel_id,
    userId: r.user_id,
    month: r.month,
    mealsCount: r.meals_count,
    sections: (sectionsByBill.get(r.id) ?? []).sort(
      (a, b) => SECTION_ORDER.indexOf(a.label) - SECTION_ORDER.indexOf(b.label)
    ),
    previousBalance: Number(r.previous_balance),
    previousBalancePaid: Number(r.previous_balance_paid),
    grandTotal: Number(r.grand_total),
    paid: Number(r.paid),
    ...(r.due_date ? { dueDate: toDay(r.due_date) } : {}),
  }));
}

/** Rewrites a bill's sections + line items (payments reference the bill, not
 * the sections, so replacing them never touches payment history). */
async function writeSections(billId: string, sections: BillSection[], tx: Queryable) {
  await run("DELETE FROM bill_sections WHERE bill_id = ?", [billId], tx);
  for (const s of sections) {
    const sectionId = newId("sec");
    await run(
      "INSERT INTO bill_sections (id, bill_id, label, total, paid) VALUES (?, ?, ?, ?, ?)",
      [sectionId, billId, s.label, round2(s.total), round2(s.paid)],
      tx
    );
    for (let i = 0; i < s.items.length; i += 1) {
      await run(
        "INSERT INTO bill_line_items (id, section_id, position, label, amount) VALUES (?, ?, ?, ?, ?)",
        [newId("li"), sectionId, i, s.items[i].label, round2(s.items[i].amount)],
        tx
      );
    }
  }
}

async function applySectionPaid(billId: string, label: BillTarget, delta: number, tx: Queryable) {
  if (label === "previousBalance") {
    await run("UPDATE bills SET previous_balance_paid = previous_balance_paid + ? WHERE id = ?", [delta, billId], tx);
  } else {
    await run("UPDATE bill_sections SET paid = paid + ? WHERE bill_id = ? AND label = ?", [delta, billId, label], tx);
  }
}

/** How a payment amount settles the chosen targets — previous balance first,
 * then sections in a fixed order, each capped at its own due; any leftover
 * past every selected target's due becomes credit on the first target. Pure
 * computation, no side effects. */
function computePaymentBreakdown(bill: Bill, targets: BillTarget[], amount: number): Partial<Record<BillTarget, number>> {
  const breakdown: Partial<Record<BillTarget, number>> = {};
  let remaining = amount;
  if (targets.includes("previousBalance")) {
    const due = bill.previousBalance - bill.previousBalancePaid;
    if (due > 0 && remaining > 0) {
      const applied = Math.min(remaining, due);
      breakdown.previousBalance = applied;
      remaining -= applied;
    }
  }
  for (const label of SECTION_ORDER) {
    if (remaining <= 0) break;
    if (!targets.includes(label)) continue;
    const section = bill.sections.find((s) => s.label === label);
    if (!section) continue;
    const due = section.total - section.paid;
    if (due > 0) {
      const applied = Math.min(remaining, due);
      breakdown[label] = (breakdown[label] ?? 0) + applied;
      remaining -= applied;
    }
  }
  if (remaining > 0) {
    const fallback = targets[0];
    if (fallback) breakdown[fallback] = (breakdown[fallback] ?? 0) + remaining;
  }
  return breakdown;
}

export const bills: BillRepository = {
  async getBill(hostelId, userId, month) {
    const found = await loadBills("hostel_id = ? AND user_id = ? AND month = ?", [hostelId, userId, month]);
    return found[0];
  },

  async getLatestForUser(hostelId, userId) {
    const found = await loadBills(
      "hostel_id = ? AND user_id = ? ORDER BY month DESC LIMIT 1",
      [hostelId, userId]
    );
    return found[0];
  },

  async listByHostel(hostelId, month) {
    return loadBills("hostel_id = ? AND month = ?", [hostelId, month]);
  },

  async listByUser(hostelId, userId) {
    return loadBills("hostel_id = ? AND user_id = ? ORDER BY month DESC", [hostelId, userId]);
  },

  async listPayments(billId) {
    return loadPayments("p.bill_id = ?", [billId]);
  },

  async listPendingVerification(hostelId, month) {
    return loadPayments(
      "p.verified = 0 AND b.hostel_id = ? AND b.month = ?",
      [hostelId, month]
    );
  },

  /**
   * Records the payment claim and computes how it WOULD settle the chosen
   * targets — previous balance first, then sections in a fixed order — but
   * does not touch the bill yet. Nothing is actually owed-down until a
   * manager verifies it (decidePayment); a member merely claiming to have
   * paid must never move the balance on its own, or "pending" verification
   * would be theater while the money already counted.
   */
  async pay(payment) {
    await transaction(async (tx) => {
      const [bill] = await loadBills("id = ?", [payment.billId], tx);
      const breakdown = bill ? computePaymentBreakdown(bill, payment.targets, payment.amount) : {};

      const paymentId = newId("pay");
      await run(
        `INSERT INTO payments (id, bill_id, amount, paid_at, method, reference, sender_number, verified)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          paymentId, payment.billId, payment.amount, fromIso(payment.paidAt), payment.method,
          payment.reference ?? null, payment.senderNumber ?? null, 0,
        ],
        tx
      );
      for (const t of payment.targets) {
        await run("INSERT IGNORE INTO payment_targets (payment_id, target) VALUES (?, ?)", [paymentId, t], tx);
      }
      for (const [target, amount] of Object.entries(breakdown)) {
        await run(
          "INSERT INTO payment_breakdown (payment_id, target, amount) VALUES (?, ?, ?)",
          [paymentId, target, amount],
          tx
        );
      }
    });
  },

  /** Manager logs a payment received OUTSIDE the app (cash handed over in
   * person, etc.) — applied immediately, no separate verification step,
   * since the manager recording it IS the verification. */
  async recordPayment(payment) {
    await transaction(async (tx) => {
      const [bill] = await loadBills("id = ?", [payment.billId], tx);
      if (!bill) return;
      const breakdown = computePaymentBreakdown(bill, payment.targets, payment.amount);

      const paymentId = newId("pay");
      await run(
        `INSERT INTO payments (id, bill_id, amount, paid_at, method, reference, sender_number, verified)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          paymentId, payment.billId, payment.amount, fromIso(payment.paidAt), payment.method,
          payment.reference ?? null, payment.senderNumber ?? null,
        ],
        tx
      );
      for (const t of payment.targets) {
        await run("INSERT IGNORE INTO payment_targets (payment_id, target) VALUES (?, ?)", [paymentId, t], tx);
      }
      for (const [target, amount] of Object.entries(breakdown)) {
        await run(
          "INSERT INTO payment_breakdown (payment_id, target, amount) VALUES (?, ?, ?)",
          [paymentId, target, amount],
          tx
        );
        await applySectionPaid(bill.id, target as BillTarget, amount as number, tx);
      }
      await run("UPDATE bills SET paid = paid + ? WHERE id = ?", [payment.amount, bill.id], tx);
    });
  },

  async decidePayment(paymentId, status) {
    await transaction(async (tx) => {
      const payment = await one<{ id: string; bill_id: string; amount: number; verified: number }>(
        "SELECT id, bill_id, amount, verified FROM payments WHERE id = ?",
        [paymentId],
        tx
      );
      if (!payment || payment.verified) return; // already decided (or gone) — nothing to do.
      if (status === "verified") {
        // Apply the exact split computed at submission time — the balance
        // moves for the first time right here, not when the member submitted.
        const breakdown = await all<{ target: BillTarget; amount: number }>(
          "SELECT target, amount FROM payment_breakdown WHERE payment_id = ?",
          [paymentId],
          tx
        );
        for (const b of breakdown) {
          await applySectionPaid(payment.bill_id, b.target, Number(b.amount), tx);
        }
        await run("UPDATE bills SET paid = paid + ? WHERE id = ?", [Number(payment.amount), payment.bill_id], tx);
        await run("UPDATE payments SET verified = 1 WHERE id = ?", [paymentId], tx);
        return;
      }
      // Declined: nothing was ever applied to the bill, so just drop the claim.
      await run("DELETE FROM payments WHERE id = ?", [paymentId], tx);
    });
  },

  /** Meal cost belongs entirely to members, so credit on it must be settled:
   * refunded in cash, or moved to cover another due on the same bill. */
  async settleMealCredit(billId, amount, destination) {
    await transaction(async (tx) => {
      const [bill] = await loadBills("id = ?", [billId], tx);
      if (!bill) return;
      const meal = bill.sections.find((s) => s.label === "mealCost");
      if (!meal) return;
      const credit = meal.paid - meal.total;
      const applied = Math.min(amount, Math.max(credit, 0));
      if (applied <= 0) return;

      await applySectionPaid(billId, "mealCost", -applied, tx);
      if (destination === "refund") {
        // The money leaves the hostel back to the member, so it stops counting
        // as received.
        await run("UPDATE bills SET paid = paid - ? WHERE id = ?", [applied, billId], tx);
      } else {
        await applySectionPaid(billId, destination, applied, tx);
      }
      await run(
        `INSERT INTO bill_adjustments (id, bill_id, user_id, amount, kind, from_target, to_target, created_at)
         VALUES (?, ?, ?, ?, ?, 'mealCost', ?, ?)`,
        [
          newId("adj"), billId, bill.userId, applied,
          destination === "refund" ? "refund" : "transfer",
          destination === "refund" ? null : destination,
          fromIso(new Date().toISOString()),
        ],
        tx
      );
    });
  },

  async listAdjustments(billId) {
    const rows = await all<{
      id: string; bill_id: string; user_id: string; amount: number;
      kind: "refund" | "transfer"; from_target: BillTarget; to_target: BillTarget | null;
      note: string | null; created_at: string;
    }>(
      "SELECT id, bill_id, user_id, amount, kind, from_target, to_target, note, created_at FROM bill_adjustments WHERE bill_id = ?",
      [billId]
    );
    return rows.map((r) => ({
      id: r.id,
      billId: r.bill_id,
      userId: r.user_id,
      amount: Number(r.amount),
      createdAt: toIso(r.created_at),
      kind: r.kind,
      from: r.from_target,
      to: r.to_target ?? undefined,
      note: r.note ?? undefined,
    }));
  },

  /** Credits a leaving member's held advance rent against their latest bill's
   * room-rent (a negative line) and releases the hold — so the advance covers
   * their last month's rent, and any excess reduces the rest of the bill. */
  async applyAdvanceOnLeave(hostelId, userId) {
    await transaction(async (tx) => {
      const approvedLeave = await one<{ id: string }>(
        "SELECT id FROM leave_requests WHERE hostel_id = ? AND user_id = ? AND status = 'approved' LIMIT 1",
        [hostelId, userId],
        tx
      );
      if (!approvedLeave) {
        throw new Error("This member doesn't have an approved leave request yet — approve one first.");
      }
      const u = await one<{ advance_held: number }>(
        "SELECT advance_held FROM users WHERE id = ? AND hostel_id = ?",
        [userId, hostelId],
        tx
      );
      const held = Number(u?.advance_held ?? 0);
      if (held <= 0) return;
      const [bill] = await loadBills(
        "hostel_id = ? AND user_id = ? ORDER BY month DESC LIMIT 1",
        [hostelId, userId],
        tx
      );
      if (bill) {
        const sections = bill.sections.map((s) =>
          s.label === "roomRent"
            ? {
                ...s,
                items: [...s.items, { label: "Advance rent applied (leaving)", amount: -held }],
                total: round2(s.total - held),
              }
            : s
        );
        const grandTotal = round2(sections.reduce((sum, x) => sum + x.total, 0) + bill.previousBalance);
        await writeSections(bill.id, sections, tx);
        await run("UPDATE bills SET grand_total = ? WHERE id = ?", [grandTotal, bill.id], tx);
      }
      await run("UPDATE users SET advance_held = 0 WHERE id = ?", [userId], tx);
      await logActivity(hostelId, "Advance rent applied on leaving", `৳${held}`, tx);
    });
  },

  async generateBills(hostelId, month, options) {
    // Never bill a future month — no meals or expenses to charge yet.
    if (month > currentMonth()) return [];

    return transaction(async (tx) => {
      const hostel = await one<{ id: string; service_charge_monthly: number; advance_rent_required: number }>(
        "SELECT id, service_charge_monthly, advance_rent_required FROM hostels WHERE id = ?",
        [hostelId],
        tx
      );
      if (!hostel) return [];
      const advanceRequired = toBool(hostel.advance_rent_required);

      // Boarders only: cooks are staff, and owner/platform accounts merely
      // carry a nominal hostelId.
      const boarders = await all<{ id: string; room_id: string | null; advance_held: number }>(
        `SELECT id, room_id, advance_held FROM users
          WHERE hostel_id = ? AND banned = 0
            AND role NOT IN ('cook','owner','superadmin','marketing','service')`,
        [hostelId],
        tx
      );

      // Advance rent belongs on a member's FIRST-month bill. earliestByUser is
      // their earliest existing bill month, so the advance line is kept there
      // across regenerations (it's added whenever no EARLIER bill exists), but
      // everBilled gates the one-time HOLD so regenerating never re-collects it.
      const earliestByUser = new Map(
        (await all<{ user_id: string; m: string }>(
          "SELECT user_id, MIN(month) AS m FROM bills WHERE hostel_id = ? GROUP BY user_id",
          [hostelId],
          tx
        )).map((r) => [r.user_id, r.m])
      );
      const everBilled = new Set(earliestByUser.keys());
      const roomRows = await all<{ id: string; number: string; seat_rent: number }>(
        "SELECT id, number, seat_rent FROM rooms WHERE hostel_id = ?",
        [hostelId],
        tx
      );
      const roomById = new Map(roomRows.map((r) => [r.id, r]));

      const [year, mon] = month.split("-").map(Number);
      const daysInMonth = new Date(year, mon, 0).getDate();
      const from = `${month}-01`;
      const to = `${month}-${String(daysInMonth).padStart(2, "0")}`;

      // Meal totals per member: stored rows only, matching the JSON backend —
      // and only for a (day, meal) the manager has actually confirmed was
      // cooked. An unconfirmed or confirmed-absent slot bills nobody for it,
      // no matter what any member's own toggle says.
      const mealTotals = await all<{ user_id: string; own: number | null; guests: number | null }>(
        `SELECT e.user_id, SUM(e.is_on) AS own, SUM(e.guest_count) AS guests
           FROM meal_entries e JOIN users u ON u.id = e.user_id
          WHERE e.hostel_id = ? AND e.day BETWEEN ? AND ?
            AND (u.joined_at IS NULL OR u.joined_at <= e.day)
            AND EXISTS (
              SELECT 1 FROM cook_attendance_reports r
               WHERE r.hostel_id = e.hostel_id AND r.day = e.day AND r.meal = e.meal
                 AND r.status = 'resolved_cooked'
            )
          GROUP BY e.user_id`,
        [hostelId, from, to],
        tx
      );
      const mealsByUser = new Map(
        mealTotals.map((m) => [m.user_id, { own: Number(m.own ?? 0), guests: Number(m.guests ?? 0) }])
      );

      // What each member personally spent on approved shopping this month —
      // credited against their own meal cost below, so a member who shopped
      // more than they ate ends up with a meal-cost credit instead of a charge.
      const shopTotals = await all<{ user_id: string; spent: number | null }>(
        `SELECT c.user_id, SUM(c.amount) AS spent
           FROM shopping_costs c
          WHERE c.hostel_id = ? AND c.status = 'approved'
            AND EXISTS (SELECT 1 FROM shopping_cost_dates d
                         WHERE d.cost_id = c.id AND d.day >= ? AND d.day <= ?)
          GROUP BY c.user_id`,
        [hostelId, from, to],
        tx
      );
      const shoppingByUser = new Map(shopTotals.map((s) => [s.user_id, Number(s.spent ?? 0)]));

      const monthExpenses = await loadExpenses(hostelId, tx, month);
      const utilityExpenses = monthExpenses
        .filter((e) => isServiceChargeCategory(e.category))
        .filter((e) => !options?.includeServiceExpenseIds || options.includeServiceExpenseIds.includes(e.id));
      const salaryExpenses = monthExpenses
        .filter((e) => e.category === "Salary")
        .filter((e) => !options?.includeSalaryExpenseIds || options.includeSalaryExpenseIds.includes(e.id));

      // An expense's per-member amount follows its own memberIds/splitMode:
      // "fixed" charges the amount to EACH selected member, "equal" divides it.
      const expenseItemsFor = (list: Expense[], userId: string) =>
        list
          .filter((e) => e.memberIds.includes(userId))
          .map((e) => {
            const coversOtherPeriod = !e.dateFrom.startsWith(e.billingMonth);
            const label = `${e.category}${e.note ? ` — ${e.note}` : ""}${e.splitMode === "fixed" ? "" : " share"}`;
            return {
              label: coversOtherPeriod
                ? `${label} (for ${formatShortDate(e.dateFrom)}${e.dateTo !== e.dateFrom ? ` – ${formatShortDate(e.dateTo)}` : ""})`
                : label,
              amount: e.splitMode === "fixed" ? e.amount : e.amount / (e.memberIds.length || 1),
            };
          });

      // Carry the member's running balance from their MOST RECENT prior bill
      // (not strictly last calendar month) so a skipped month never drops it —
      // and it carries BOTH signs: a due (+) to collect and a credit (−) that
      // reduces this bill.
      const priorBills = await loadBills("hostel_id = ? AND month < ?", [hostelId, month], tx);
      const prevByUser = new Map<string, (typeof priorBills)[number]>();
      for (const b of priorBills) {
        const cur = prevByUser.get(b.userId);
        if (!cur || b.month > cur.month) prevByUser.set(b.userId, b);
      }

      const existingBills = await loadBills("hostel_id = ? AND month = ?", [hostelId, month], tx);
      const existingByUser = new Map(existingBills.map((b) => [b.userId, b]));

      const { rate: mealRate } = await mealRateFor(hostelId, month, tx);
      const ownerCharge = Number(hostel.service_charge_monthly ?? 0);
      // Which month the rent line is FOR (default: the bill's own month).
      const rentMonthLabel = formatMonthLabel(options?.rentMonth ?? month);
      // Members charged advance rent this run — their advance_held is set after.
      const advanceCharged: { id: string; amount: number }[] = [];

      const out: Bill[] = [];
      for (const u of boarders) {
        const room = u.room_id ? roomById.get(u.room_id) : undefined;
        const seatRent = room ? Number(room.seat_rent) : 0;
        const counts = mealsByUser.get(u.id) ?? { own: 0, guests: 0 };
        const ownMeals = counts.own;
        const guestMeals = counts.guests;

        const rateLabel = `@ ৳${round2(mealRate)} actual`;
        const mealCostItems = [
          { label: `${ownMeals} own meals ${rateLabel}`, amount: round2(ownMeals * mealRate) },
        ];
        if (guestMeals > 0) {
          mealCostItems.push({
            label: `${guestMeals} guest meal${guestMeals > 1 ? "s" : ""} ${rateLabel}`,
            amount: round2(guestMeals * mealRate),
          });
        }
        // Credit the member for what they personally spent on shopping this
        // month — so the bill nets to (meals − their spend), matching the
        // monthly report. A heavy shopper's meal cost can go negative (a credit
        // the hostel owes them), which then carries forward like any balance.
        const shoppingSpent = shoppingByUser.get(u.id) ?? 0;
        if (shoppingSpent > 0) {
          mealCostItems.push({ label: "Your shopping this month (credit)", amount: -round2(shoppingSpent) });
        }
        const mealCostTotal = round2((ownMeals + guestMeals) * mealRate - shoppingSpent);

        const serviceItems = expenseItemsFor(utilityExpenses, u.id);
        if (ownerCharge > 0) {
          serviceItems.unshift({ label: "Monthly service charge (set by owner)", amount: ownerCharge });
        }
        const serviceTotal = serviceItems.reduce((s, i) => s + i.amount, 0);
        const salaryItems = expenseItemsFor(salaryExpenses, u.id);
        const salaryTotal = salaryItems.reduce((s, i) => s + i.amount, 0);

        // Regeneration must not erase what's already paid per section.
        const existing = existingByUser.get(u.id);
        const paidFor = (label: BillSection["label"]) =>
          existing?.sections.find((s) => s.label === label)?.paid ?? 0;

        // Room rent, labelled with the month it covers. On a member's FIRST
        // bill, if the hostel requires advance rent, add one month's advance —
        // so the first bill is two months of rent — held until they leave.
        const roomRentItems = [
          { label: room ? `Room ${room.number} (seat) · ${rentMonthLabel}` : `Unassigned · ${rentMonthLabel}`, amount: seatRent },
        ];
        // The advance line lives on the first-month bill: shown whenever no
        // earlier bill exists (so it survives regenerating that same month).
        const earliest = earliestByUser.get(u.id);
        const isFirstBillMonth = !earliest || month <= earliest;
        if (advanceRequired && isFirstBillMonth && seatRent > 0) {
          roomRentItems.push({ label: "Advance rent (1 month, held for your last month)", amount: seatRent });
          // Collect the HOLD only on the member's very first generation, so
          // regenerating the same bill never re-collects it.
          if (!everBilled.has(u.id) && Number(u.advance_held) === 0) {
            advanceCharged.push({ id: u.id, amount: seatRent });
          }
        }
        const roomRentTotal = roomRentItems.reduce((s, i) => s + i.amount, 0);

        const sections: BillSection[] = [
          { label: "mealCost", items: mealCostItems, total: mealCostTotal, paid: paidFor("mealCost") },
          {
            label: "roomRent",
            items: roomRentItems,
            total: roomRentTotal,
            paid: paidFor("roomRent"),
          },
          { label: "serviceCharge", items: serviceItems, total: serviceTotal, paid: paidFor("serviceCharge") },
          { label: "cookSalary", items: salaryItems, total: salaryTotal, paid: paidFor("cookSalary") },
        ];
        const prevBill = prevByUser.get(u.id);
        // Carry the full remaining, both signs: a due (+) or a credit (−).
        const previousBalance = prevBill ? round2(prevBill.grandTotal - prevBill.paid) : 0;
        const grandTotal = round2(sections.reduce((s, x) => s + x.total, 0) + previousBalance);

        const billId = existing?.id ?? newId("bill");
        const dueDate = options?.dueDate ?? existing?.dueDate;
        if (existing) {
          await run(
            "UPDATE bills SET meals_count = ?, previous_balance = ?, grand_total = ?, due_date = ? WHERE id = ?",
            [ownMeals, round2(previousBalance), round2(grandTotal), dueDate ?? null, billId],
            tx
          );
        } else {
          await run(
            `INSERT INTO bills (id, hostel_id, user_id, month, meals_count, previous_balance, previous_balance_paid, grand_total, paid, due_date)
             VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0, ?)`,
            [billId, hostelId, u.id, month, ownMeals, round2(previousBalance), round2(grandTotal), dueDate ?? null],
            tx
          );
        }
        await writeSections(billId, sections, tx);

        out.push({
          id: billId, hostelId, userId: u.id, month, mealsCount: ownMeals, sections,
          previousBalance: round2(previousBalance),
          previousBalancePaid: existing?.previousBalancePaid ?? 0,
          grandTotal: round2(grandTotal),
          paid: existing?.paid ?? 0,
          ...(dueDate ? { dueDate } : {}),
        });
      }

      // Drop bills for people who are no longer boarders of this hostel.
      const keep = new Set(out.map((b) => b.id));
      for (const stale of existingBills) {
        if (!keep.has(stale.id)) await run("DELETE FROM bills WHERE id = ?", [stale.id], tx);
      }

      // Lock the expenses that fed this run so they aren't re-offered or
      // deleted next time bills are generated for the month.
      const billedIds = [...utilityExpenses, ...salaryExpenses].map((e) => e.id);
      if (billedIds.length) {
        await run(
          `UPDATE expenses SET billed_at = ? WHERE billed_at IS NULL AND id IN (${billedIds.map(() => "?").join(",")})`,
          [fromIso(new Date().toISOString()), ...billedIds],
          tx
        );
      }
      // Record the advance now held for members it was charged to this run.
      for (const a of advanceCharged) {
        await run("UPDATE users SET advance_held = ? WHERE id = ?", [a.amount, a.id], tx);
      }
      await logActivity(hostelId, "Bills generated", `${month} · ${out.length} member bills`, tx);
      return out;
    });
  },

  subscribe: serverOnly,
};

/** Same computation as meals.getActualMealRate, usable inside a transaction. */
async function mealRateFor(hostelId: string, month: string, tx: Queryable) {
  const [mFrom, mTo] = monthRange(month);
  const spend = await one<{ total: number | null }>(
    `SELECT SUM(c.amount) AS total FROM shopping_costs c
      WHERE c.hostel_id = ? AND c.status = 'approved'
        AND EXISTS (SELECT 1 FROM shopping_cost_dates d
                     WHERE d.cost_id = c.id AND d.day >= ? AND d.day < ?)`,
    [hostelId, mFrom, mTo],
    tx
  );
  const totalShopping = Number(spend?.total ?? 0);
  // Only a (day, meal) the manager has confirmed was actually cooked counts
  // — an unconfirmed or confirmed-absent slot contributes zero, regardless
  // of any member's own on/off toggle.
  const totals = await one<{ own: number | null; guests: number | null }>(
    `SELECT SUM(e.is_on) AS own, SUM(e.guest_count) AS guests
       FROM meal_entries e JOIN users u ON u.id = e.user_id
      WHERE e.hostel_id = ? AND e.day >= ? AND e.day < ?
        AND u.hostel_id = ? AND u.banned = 0
        AND u.role NOT IN ('cook','owner','superadmin','marketing','service')
        AND (u.joined_at IS NULL OR u.joined_at <= e.day)
        AND EXISTS (
          SELECT 1 FROM cook_attendance_reports r
           WHERE r.hostel_id = e.hostel_id AND r.day = e.day AND r.meal = e.meal
             AND r.status = 'resolved_cooked'
        )`,
    [hostelId, mFrom, mTo, hostelId],
    tx
  );
  const totalMeals = Number(totals?.own ?? 0) + Number(totals?.guests ?? 0);
  return { rate: totalMeals > 0 ? totalShopping / totalMeals : 0, totalShopping, totalMeals };
}

async function loadPayments(where: string, params: unknown[]): Promise<Payment[]> {
  const rows = await all<{
    id: string; bill_id: string; amount: number; paid_at: string;
    method: Payment["method"]; reference: string | null; sender_number: string | null; verified: number;
  }>(
    `SELECT p.id, p.bill_id, p.amount, p.paid_at, p.method, p.reference, p.sender_number, p.verified
       FROM payments p JOIN bills b ON b.id = p.bill_id WHERE ${where}`,
    params
  );
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const ph = ids.map(() => "?").join(",");
  const [targets, breakdown] = await Promise.all([
    all<{ payment_id: string; target: BillTarget }>(
      `SELECT payment_id, target FROM payment_targets WHERE payment_id IN (${ph})`,
      ids
    ),
    all<{ payment_id: string; target: BillTarget; amount: number }>(
      `SELECT payment_id, target, amount FROM payment_breakdown WHERE payment_id IN (${ph})`,
      ids
    ),
  ]);
  const targetsBy = new Map<string, BillTarget[]>();
  for (const t of targets) {
    const list = targetsBy.get(t.payment_id) ?? [];
    list.push(t.target);
    targetsBy.set(t.payment_id, list);
  }
  const breakdownBy = new Map<string, Partial<Record<BillTarget, number>>>();
  for (const b of breakdown) {
    const obj = breakdownBy.get(b.payment_id) ?? {};
    obj[b.target] = Number(b.amount);
    breakdownBy.set(b.payment_id, obj);
  }
  return rows.map<Payment>((r) => ({
    id: r.id,
    billId: r.bill_id,
    amount: Number(r.amount),
    paidAt: toIso(r.paid_at),
    method: r.method,
    reference: r.reference ?? undefined,
    senderNumber: r.sender_number ?? undefined,
    verified: toBool(r.verified),
    targets: targetsBy.get(r.id) ?? [],
    breakdown: breakdownBy.get(r.id),
  }));
}

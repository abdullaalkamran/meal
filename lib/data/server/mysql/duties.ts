// MySQL implementations of duty rotations, swaps, cook leave/attendance and
// meal-edit votes — the flows that hang off announcements and member voting.

import type {
  CookAttendanceReport,
  CookAttendanceVote,
  CookLeaveRequest,
  DutyPlan,
  MealEditRequest,
  MealEditVote,
  MealSlot,
  SwapRequest,
} from "../../types";
import type {
  CookAttendanceRepository,
  CookLeaveRepository,
  DutyRepository,
  MealEditRepository,
  SwapRepository,
} from "../../repository";
import { all, fromIso, one, run, toDay, toIso, transaction, type Queryable } from "./connection";
import { newId } from "./ids";

const serverOnly = (): never => {
  throw new Error("subscribe() is a client-side concern; the server never dispatches it.");
};

const now = () => fromIso(new Date().toISOString());

async function postAnnouncement(
  hostelId: string,
  kind: string,
  title: string,
  body: string,
  payload: Record<string, unknown> | null,
  tx: Queryable
) {
  await run(
    "INSERT INTO announcements (id, hostel_id, kind, title, body, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [newId("ann"), hostelId, kind, title, body, payload ? JSON.stringify(payload) : null, now()],
    tx
  );
}

// ── Duty plans ─────────────────────────────────────────────────────────────

async function loadPlans(where: string, params: unknown[], on?: Queryable): Promise<DutyPlan[]> {
  const rows = await all<{
    id: string; hostel_id: string; type: DutyPlan["type"]; requires_spin: number;
    start_date: string; end_date: string; budget_per_day: number | null; created_at: string;
  }>(
    `SELECT id, hostel_id, type, requires_spin, start_date, end_date, budget_per_day, created_at
       FROM duty_plans WHERE ${where}`,
    params,
    on
  );
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const ph = ids.map(() => "?").join(",");
  const [members, blocks] = await Promise.all([
    all<{ plan_id: string; user_id: string; spun: number }>(
      `SELECT plan_id, user_id, spun FROM duty_plan_members WHERE plan_id IN (${ph})`, ids, on
    ),
    all<{ id: string; plan_id: string; position: number }>(
      `SELECT id, plan_id, position FROM duty_blocks WHERE plan_id IN (${ph}) ORDER BY position`, ids, on
    ),
  ]);
  const blockIds = blocks.map((b) => b.id);
  const bph = blockIds.map(() => "?").join(",");
  const [blockMembers, blockDates] = blockIds.length
    ? await Promise.all([
        all<{ block_id: string; user_id: string }>(
          `SELECT block_id, user_id FROM duty_block_members WHERE block_id IN (${bph})`, blockIds, on
        ),
        all<{ block_id: string; day: string }>(
          `SELECT block_id, day FROM duty_block_dates WHERE block_id IN (${bph}) ORDER BY day`, blockIds, on
        ),
      ])
    : [[], []];

  const push = <T,>(map: Map<string, T[]>, key: string, value: T) => {
    const list = map.get(key) ?? [];
    list.push(value);
    map.set(key, list);
  };
  const membersByPlan = new Map<string, string[]>();
  const spunByPlan = new Map<string, Record<string, boolean>>();
  for (const m of members) {
    push(membersByPlan, m.plan_id, m.user_id);
    const spun = spunByPlan.get(m.plan_id) ?? {};
    spun[m.user_id] = m.spun === 1;
    spunByPlan.set(m.plan_id, spun);
  }
  const membersByBlock = new Map<string, string[]>();
  for (const bm of blockMembers) push(membersByBlock, bm.block_id, bm.user_id);
  const datesByBlock = new Map<string, string[]>();
  for (const bd of blockDates) push(datesByBlock, bd.block_id, toDay(bd.day));
  const blocksByPlan = new Map<string, DutyPlan["blocks"]>();
  for (const b of blocks) {
    push(blocksByPlan, b.plan_id, {
      userIds: membersByBlock.get(b.id) ?? [],
      dates: datesByBlock.get(b.id) ?? [],
    });
  }

  return rows.map<DutyPlan>((r) => ({
    id: r.id,
    hostelId: r.hostel_id,
    type: r.type,
    requiresSpin: r.requires_spin === 1,
    startDate: toDay(r.start_date),
    endDate: toDay(r.end_date),
    memberIds: membersByPlan.get(r.id) ?? [],
    blocks: blocksByPlan.get(r.id) ?? [],
    spun: spunByPlan.get(r.id) ?? {},
    ...(r.budget_per_day == null ? {} : { budgetPerDay: Number(r.budget_per_day) }),
    createdAt: toIso(r.created_at),
  }));
}

export const duties: DutyRepository = {
  async listByHostel(hostelId) {
    return loadPlans("hostel_id = ?", [hostelId]);
  },

  async createPlan(plan) {
    const id = newId("duty");
    await transaction(async (tx) => {
      await run(
        `INSERT INTO duty_plans (id, hostel_id, type, requires_spin, start_date, end_date, budget_per_day, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, plan.hostelId, plan.type, plan.requiresSpin ? 1 : 0,
          plan.startDate, plan.endDate, plan.budgetPerDay ?? null, now(),
        ],
        tx
      );
      for (const uid of plan.memberIds ?? []) {
        await run("INSERT INTO duty_plan_members (plan_id, user_id, spun) VALUES (?, ?, 0)", [id, uid], tx);
      }
      for (let i = 0; i < (plan.blocks ?? []).length; i += 1) {
        const block = plan.blocks[i];
        const blockId = newId("block");
        await run("INSERT INTO duty_blocks (id, plan_id, position) VALUES (?, ?, ?)", [blockId, id, i], tx);
        for (const uid of block.userIds) {
          await run("INSERT IGNORE INTO duty_block_members (block_id, user_id) VALUES (?, ?)", [blockId, uid], tx);
        }
        for (const day of block.dates) {
          await run("INSERT IGNORE INTO duty_block_dates (block_id, day) VALUES (?, ?)", [blockId, day], tx);
        }
      }
      if (plan.requiresSpin) {
        await postAnnouncement(
          plan.hostelId, "spin-wheel-cta", "Spin the wheel — shopping duty",
          "A new shopping duty rotation is ready. Spin to reveal your dates.",
          { planId: id }, tx
        );
      }
    });
    return (await loadPlans("id = ?", [id]))[0];
  },

  async spin(planId, userId) {
    await run("UPDATE duty_plan_members SET spun = 1 WHERE plan_id = ? AND user_id = ?", [planId, userId]);
  },

  subscribe: serverOnly,
};

// ── Swap requests ──────────────────────────────────────────────────────────

export const swaps: SwapRepository = {
  async listByPlan(planId) {
    const rows = await all<{
      id: string; hostel_id: string; plan_id: string; from_user_id: string;
      to_user_id: string; status: SwapRequest["status"]; created_at: string;
    }>(
      "SELECT id, hostel_id, plan_id, from_user_id, to_user_id, status, created_at FROM swap_requests WHERE plan_id = ?",
      [planId]
    );
    return rows.map<SwapRequest>((r) => ({
      id: r.id,
      hostelId: r.hostel_id,
      planId: r.plan_id,
      fromUserId: r.from_user_id,
      toUserId: r.to_user_id,
      status: r.status,
      createdAt: toIso(r.created_at),
    }));
  },

  async request(swap) {
    const id = newId("swap");
    await transaction(async (tx) => {
      await run(
        "INSERT INTO swap_requests (id, hostel_id, plan_id, from_user_id, to_user_id, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)",
        [id, swap.hostelId, swap.planId, swap.fromUserId, swap.toUserId, now()],
        tx
      );
      await postAnnouncement(
        swap.hostelId, "swap-request", "Shopping duty swap requested",
        "A member wants to swap shopping duty dates with you.",
        // swapId lets the recipient's home banner drop this once it's
        // resolved — see hooks/useActionableAnnouncements.ts.
        { swapId: id, fromUserId: swap.fromUserId, toUserId: swap.toUserId }, tx
      );
    });
  },

  async resolve(swapId, status) {
    await transaction(async (tx) => {
      const swap = await one<{ id: string; plan_id: string; from_user_id: string; to_user_id: string }>(
        "SELECT id, plan_id, from_user_id, to_user_id FROM swap_requests WHERE id = ?",
        [swapId],
        tx
      );
      if (!swap) return;
      await run("UPDATE swap_requests SET status = ? WHERE id = ?", [status, swapId], tx);
      if (status !== "accepted") return;

      // Accepting exchanges the two members' duty dates.
      const blockOf = async (userId: string) =>
        one<{ block_id: string }>(
          `SELECT bm.block_id FROM duty_block_members bm
             JOIN duty_blocks b ON b.id = bm.block_id
            WHERE b.plan_id = ? AND bm.user_id = ? LIMIT 1`,
          [swap.plan_id, userId],
          tx
        );
      const fromBlock = await blockOf(swap.from_user_id);
      const toBlock = await blockOf(swap.to_user_id);
      if (!fromBlock || !toBlock || fromBlock.block_id === toBlock.block_id) return;

      const datesOf = async (blockId: string) =>
        (await all<{ day: string }>("SELECT day FROM duty_block_dates WHERE block_id = ?", [blockId], tx)).map((d) =>
          toDay(d.day)
        );
      const fromDates = await datesOf(fromBlock.block_id);
      const toDates = await datesOf(toBlock.block_id);
      await run("DELETE FROM duty_block_dates WHERE block_id IN (?, ?)", [fromBlock.block_id, toBlock.block_id], tx);
      for (const d of toDates) {
        await run("INSERT IGNORE INTO duty_block_dates (block_id, day) VALUES (?, ?)", [fromBlock.block_id, d], tx);
      }
      for (const d of fromDates) {
        await run("INSERT IGNORE INTO duty_block_dates (block_id, day) VALUES (?, ?)", [toBlock.block_id, d], tx);
      }
    });
  },

  subscribe: serverOnly,
};

// ── Cook leave ─────────────────────────────────────────────────────────────

export const cookLeave: CookLeaveRepository = {
  async listByHostel(hostelId) {
    const rows = await all<{
      id: string; hostel_id: string; cook_id: string; date_from: string; date_to: string;
      scope: CookLeaveRequest["scope"]; reason: string; status: CookLeaveRequest["status"];
      decided_by: string | null; decided_at: string | null; created_at: string;
    }>(
      `SELECT id, hostel_id, cook_id, date_from, date_to, scope, reason, status, decided_by, decided_at, created_at
         FROM cook_leave_requests WHERE hostel_id = ?`,
      [hostelId]
    );
    if (!rows.length) return [];
    const meals = await all<{ request_id: string; meal: MealSlot }>(
      `SELECT request_id, meal FROM cook_leave_meals WHERE request_id IN (${rows.map(() => "?").join(",")})`,
      rows.map((r) => r.id)
    );
    const byReq = new Map<string, MealSlot[]>();
    for (const m of meals) {
      const list = byReq.get(m.request_id) ?? [];
      list.push(m.meal);
      byReq.set(m.request_id, list);
    }
    return rows.map<CookLeaveRequest>((r) => ({
      id: r.id,
      hostelId: r.hostel_id,
      cookId: r.cook_id,
      dateFrom: toDay(r.date_from),
      dateTo: toDay(r.date_to),
      scope: r.scope,
      ...(byReq.has(r.id) ? { meals: byReq.get(r.id) } : {}),
      reason: r.reason,
      status: r.status,
      decidedBy: r.decided_by ?? undefined,
      decidedAt: r.decided_at ? toIso(r.decided_at) : undefined,
      createdAt: toIso(r.created_at),
    }));
  },

  async request(req) {
    await transaction(async (tx) => {
      const id = newId("cookleave");
      await run(
        `INSERT INTO cook_leave_requests (id, hostel_id, cook_id, date_from, date_to, scope, reason, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [id, req.hostelId, req.cookId, req.dateFrom, req.dateTo, req.scope, req.reason, now()],
        tx
      );
      for (const m of req.meals ?? []) {
        await run("INSERT IGNORE INTO cook_leave_meals (request_id, meal) VALUES (?, ?)", [id, m], tx);
      }
    });
  },

  async decide(id, status, decidedBy) {
    await transaction(async (tx) => {
      const req = await one<{ hostel_id: string; date_from: string; date_to: string }>(
        "SELECT hostel_id, date_from, date_to FROM cook_leave_requests WHERE id = ?",
        [id],
        tx
      );
      if (!req) return;
      await run(
        "UPDATE cook_leave_requests SET status = ?, decided_by = ?, decided_at = ? WHERE id = ?",
        [status, decidedBy, now(), id],
        tx
      );
      if (status === "approved") {
        await postAnnouncement(
          req.hostel_id, "cook-leave-approved", "Cook on leave",
          `The cook will be on leave from ${toDay(req.date_from)} to ${toDay(req.date_to)}.`,
          null, tx
        );
      }
    });
  },

  subscribe: serverOnly,
};

// ── Cook attendance ────────────────────────────────────────────────────────

interface AttendanceRow {
  id: string; hostel_id: string; day: string; meal: MealSlot;
  status: CookAttendanceReport["status"]; reported_by: string; created_at: string;
}

const toReport = (r: AttendanceRow): CookAttendanceReport => ({
  id: r.id,
  hostelId: r.hostel_id,
  date: toDay(r.day),
  meal: r.meal,
  status: r.status,
  reportedBy: r.reported_by,
  createdAt: toIso(r.created_at),
});

const ATT_COLS = "id, hostel_id, day, meal, status, reported_by, created_at";

export const cookAttendance: CookAttendanceRepository = {
  async listForDate(hostelId, date) {
    return (
      await all<AttendanceRow>(`SELECT ${ATT_COLS} FROM cook_attendance_reports WHERE hostel_id = ? AND day = ?`, [
        hostelId, date,
      ])
    ).map(toReport);
  },

  async listByHostel(hostelId) {
    return (
      await all<AttendanceRow>(`SELECT ${ATT_COLS} FROM cook_attendance_reports WHERE hostel_id = ?`, [hostelId])
    ).map(toReport);
  },

  async report(req) {
    const id = newId("cookattend");
    await transaction(async (tx) => {
      // One canonical status per meal per day (schema enforces the uniqueness).
      await run(
        `INSERT INTO cook_attendance_reports (id, hostel_id, day, meal, status, reported_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status), reported_by = VALUES(reported_by)`,
        [id, req.hostelId, req.date, req.meal, req.status ?? "reported", req.reportedBy, now()],
        tx
      );
      const row = await one<AttendanceRow>(
        `SELECT ${ATT_COLS} FROM cook_attendance_reports WHERE hostel_id = ? AND day = ? AND meal = ?`,
        [req.hostelId, req.date, req.meal],
        tx
      );
      await postAnnouncement(
        req.hostelId, "cook-absence-poll", `Was ${req.meal} cooked today?`,
        "The cook hasn't confirmed this meal. Please vote so the manager can decide.",
        { reportId: row?.id ?? id, meal: req.meal, date: req.date }, tx
      );
    });
    const row = await one<AttendanceRow>(
      `SELECT ${ATT_COLS} FROM cook_attendance_reports WHERE hostel_id = ? AND day = ? AND meal = ?`,
      [req.hostelId, req.date, req.meal]
    );
    return toReport(row!);
  },

  async markCooked(hostelId, date, meal) {
    await run(
      `INSERT INTO cook_attendance_reports (id, hostel_id, day, meal, status, reported_by, created_at)
       VALUES (?, ?, ?, ?, 'resolved_cooked', 'cook', ?)
       ON DUPLICATE KEY UPDATE status = 'resolved_cooked'`,
      [newId("cookattend"), hostelId, date, meal, now()]
    );
  },

  async vote(reportId, userId, choice) {
    await run(
      `INSERT INTO cook_attendance_votes (report_id, user_id, choice, voted_at) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE choice = VALUES(choice), voted_at = VALUES(voted_at)`,
      [reportId, userId, choice, now()]
    );
  },

  async listVotes(reportId) {
    const rows = await all<{ report_id: string; user_id: string; choice: CookAttendanceVote["choice"]; voted_at: string }>(
      "SELECT report_id, user_id, choice, voted_at FROM cook_attendance_votes WHERE report_id = ?",
      [reportId]
    );
    return rows.map<CookAttendanceVote>((r) => ({
      reportId: r.report_id,
      userId: r.user_id,
      choice: r.choice,
      votedAt: toIso(r.voted_at),
    }));
  },

  async confirmAbsent(reportId) {
    await transaction(async (tx) => {
      const report = await one<AttendanceRow>(`SELECT ${ATT_COLS} FROM cook_attendance_reports WHERE id = ?`, [reportId], tx);
      if (!report) return;
      await run("UPDATE cook_attendance_reports SET status = 'confirmed_absent' WHERE id = ?", [reportId], tx);
      // The meal is cancelled for everyone that day.
      await run(
        "UPDATE meal_entries SET is_on = 0 WHERE hostel_id = ? AND day = ? AND meal = ?",
        [report.hostel_id, toDay(report.day), report.meal],
        tx
      );
      const meal = report.meal;
      await run(
        `UPDATE announcements
            SET kind = 'cook-absence-resolved', title = 'Meal cancelled — cook absent', body = ?
          WHERE kind = 'cook-absence-poll' AND JSON_UNQUOTE(JSON_EXTRACT(payload, '$.reportId')) = ?`,
        [
          `${meal[0].toUpperCase()}${meal.slice(1)} on ${toDay(report.day)} is cancelled for everyone.`,
          reportId,
        ],
        tx
      );
    });
  },

  subscribe: serverOnly,
};

// ── Meal edit requests (member-voted) ──────────────────────────────────────

interface MealEditRow {
  id: string; hostel_id: string; target_user_id: string; day: string;
  reason: string; requested_by: string; status: MealEditRequest["status"]; created_at: string;
}

const toMealEdit = (r: MealEditRow): MealEditRequest => ({
  id: r.id,
  hostelId: r.hostel_id,
  targetUserId: r.target_user_id,
  date: toDay(r.day),
  reason: r.reason,
  requestedBy: r.requested_by,
  status: r.status,
  createdAt: toIso(r.created_at),
});

export const mealEdits: MealEditRepository = {
  async listByHostel(hostelId) {
    const rows = await all<MealEditRow>(
      "SELECT id, hostel_id, target_user_id, day, reason, requested_by, status, created_at FROM meal_edit_requests WHERE hostel_id = ?",
      [hostelId]
    );
    return rows.map(toMealEdit);
  },

  async request(req) {
    await transaction(async (tx) => {
      const id = newId("mealedit");
      await run(
        `INSERT INTO meal_edit_requests (id, hostel_id, target_user_id, day, reason, requested_by, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [id, req.hostelId, req.targetUserId, req.date, req.reason ?? "", req.requestedBy, now()],
        tx
      );
      const target = await one<{ name: string }>("SELECT name FROM users WHERE id = ?", [req.targetUserId], tx);
      const name = target?.name ?? "a member";
      await postAnnouncement(
        req.hostelId, "meal-edit-poll", `Allow editing ${name}’s meal on ${req.date}?`,
        req.reason
          ? `The manager wants to manually correct ${name}’s meal for ${req.date}. Reason: ${req.reason}. Vote yes to allow.`
          : `The manager wants to manually correct ${name}’s meal for ${req.date}. Vote yes to allow.`,
        { requestId: id, targetUserId: req.targetUserId, date: req.date }, tx
      );
    });
  },

  /** Records the vote and auto-approves once yes votes reach half the
   * hostel's boarders (cook and owner excluded). */
  async vote(requestId, userId, choice) {
    await transaction(async (tx) => {
      await run(
        `INSERT INTO meal_edit_votes (request_id, user_id, choice, voted_at) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE choice = VALUES(choice), voted_at = VALUES(voted_at)`,
        [requestId, userId, choice, now()],
        tx
      );
      const req = await one<MealEditRow>(
        "SELECT id, hostel_id, status FROM meal_edit_requests WHERE id = ?",
        [requestId],
        tx
      );
      if (!req || req.status !== "pending") return;

      const boarders = await one<{ n: number }>(
        "SELECT COUNT(*) AS n FROM users WHERE hostel_id = ? AND role NOT IN ('cook','owner')",
        [req.hostel_id],
        tx
      );
      const yes = await one<{ n: number }>(
        "SELECT COUNT(*) AS n FROM meal_edit_votes WHERE request_id = ? AND choice = 'yes'",
        [requestId],
        tx
      );
      const total = boarders?.n ?? 0;
      if (total > 0 && (yes?.n ?? 0) / total >= 0.5) {
        await run("UPDATE meal_edit_requests SET status = 'approved' WHERE id = ?", [requestId], tx);
        await run(
          `UPDATE announcements
              SET kind = 'meal-edit-resolved', title = 'Meal edit approved',
                  body = 'Members approved the request — the manager can now edit that meal.'
            WHERE kind = 'meal-edit-poll' AND JSON_UNQUOTE(JSON_EXTRACT(payload, '$.requestId')) = ?`,
          [requestId],
          tx
        );
      }
    });
  },

  async listVotes(requestId) {
    const rows = await all<{ request_id: string; user_id: string; choice: MealEditVote["choice"]; voted_at: string }>(
      "SELECT request_id, user_id, choice, voted_at FROM meal_edit_votes WHERE request_id = ?",
      [requestId]
    );
    return rows.map<MealEditVote>((r) => ({
      requestId: r.request_id,
      userId: r.user_id,
      choice: r.choice,
      votedAt: toIso(r.voted_at),
    }));
  },

  async withdraw(requestId) {
    await run("DELETE FROM meal_edit_requests WHERE id = ?", [requestId]);
  },

  subscribe: serverOnly,
};

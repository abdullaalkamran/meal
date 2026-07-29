// MySQL implementations of the core repositories: users, hostels, rooms.
//
// Every multi-step change runs inside a transaction, so a partial change can
// never be left behind (the JSON store had no such guarantee across the
// concurrent Passenger processes shared hosting can spawn).
//
// The `subscribe*` methods are client-side only — the RPC layer never
// dispatches them — so they throw if ever reached on the server.

import type {
  Hostel,
  HostelGender,
  HostelSettings,
  ManagerPermissions,
  MealSlot,
  NewHostel,
  PersonGender,
  Role,
  Room,
  ServiceKind,
  Stars,
  User,
} from "../../types";
import type { HostelRepository, RoomRepository, UserRepository } from "../../repository";
import { normalizePhone } from "../../../utils/phone";
import { today } from "../../../utils/date";
import { hashPassword, verifyPassword } from "../password";
import {
  all,
  omitUndefined,
  one,
  run,
  toBool,
  toDay,
  transaction,
  type Queryable,
} from "./connection";
import { currentActor, logActivity, notify } from "./context";
import { invalidateSealCache } from "./meals";
import { newId } from "./ids";
import { loadAreas, writeAreas } from "./catalogs";

const serverOnly = (): never => {
  throw new Error("subscribe() is a client-side concern; the server never dispatches it.");
};

const PHONE_TAKEN_MESSAGE = "An account with this phone number already exists — sign in instead.";

/** MySQL's duplicate-key errno — the DB-level backstop behind the
 * pre-check, so two requests racing past phoneAvailable() at the same time
 * still can't both create an account for the same number (see
 * uq_users_phone_normalized in db/schema.mysql.sql). */
function isDuplicateEntry(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { errno?: number }).errno === 1062;
}

// Roles that aren't boarders of a single hostel — excluded from per-hostel
// member listings (mirrors isHostelMember in the JSON backend).
const NON_HOSTEL_ROLES: Role[] = ["owner", "superadmin", "marketing", "service"];
const isHostelMember = (role: Role) => !NON_HOSTEL_ROLES.includes(role);

const MEALS: MealSlot[] = ["breakfast", "lunch", "dinner"];

// ── Row shapes ─────────────────────────────────────────────────────────────

interface UserRow {
  id: string; role: Role; name: string; phone: string; email: string | null;
  gender: string | null;
  avatar_seed: string; hostel_id: string | null; room_id: string | null;
  student_id: string | null; department: string | null;
  division: string | null; district: string | null; thana: string | null;
  meals_suspended: number;
  future_breakfast_off: number; future_lunch_off: number; future_dinner_off: number;
  banned: number;
  manager_rating: number | null; manager_rating_note: string | null;
  joined_at: string | null; advance_held: number;
  notify_announcements: number; notify_bills: number; notify_monthly_report: number;
  service_kinds: string | null;
}

interface HostelRow {
  id: string; name: string; area: string; gender: string | null;
  division: string | null; district: string | null; thana: string | null;
  owner_id: string; manager_id: string | null; cook_id: string | null;
  meal_rate: number; kitchen_location: string | null; cook_monthly_salary: number | null;
  suspended: number; guest_meal_price: number; meal_stop_requires_approval: number;
  shopping_rotation_policy: "spin-wheel" | "manual"; service_charge_monthly: number;
  street: string | null; advance_rent_required: number;
  offers_breakfast: number; offers_lunch: number; offers_dinner: number;
  meal_toggle_cutoff: string; verified: number;
}

interface RoomRow {
  id: string; hostel_id: string; number: string; capacity: number; seat_rent: number;
}

// ── Mappers ────────────────────────────────────────────────────────────────

function toUser(r: UserRow): User {
  return omitUndefined({
    id: r.id,
    hostelId: r.hostel_id ?? "",
    name: r.name,
    phone: r.phone,
    email: r.email ?? undefined,
    role: r.role,
    gender: (r.gender as PersonGender | null) ?? undefined,
    roomId: r.room_id ?? undefined,
    avatarSeed: r.avatar_seed,
    studentId: r.student_id ?? undefined,
    department: r.department ?? undefined,
    address: r.division && r.district && r.thana
      ? { division: r.division, district: r.district, thana: r.thana }
      : undefined,
    mealsSuspended: toBool(r.meals_suspended) || undefined,
    futureMealsOff:
      toBool(r.future_breakfast_off) || toBool(r.future_lunch_off) || toBool(r.future_dinner_off)
        ? {
            ...(toBool(r.future_breakfast_off) ? { breakfast: true } : {}),
            ...(toBool(r.future_lunch_off) ? { lunch: true } : {}),
            ...(toBool(r.future_dinner_off) ? { dinner: true } : {}),
          }
        : undefined,
    banned: toBool(r.banned) || undefined,
    managerRating: (r.manager_rating as Stars | null) ?? undefined,
    managerRatingNote: r.manager_rating_note ?? undefined,
    joinedAt: r.joined_at ? toDay(r.joined_at) : undefined,
    advanceHeld: Number(r.advance_held) || undefined,
    notificationPrefs: {
      announcements: toBool(r.notify_announcements),
      bills: toBool(r.notify_bills),
      monthlyReport: toBool(r.notify_monthly_report),
    },
    serviceKinds: r.service_kinds
      ? (r.service_kinds.split(",").filter(Boolean) as ServiceKind[])
      : undefined,
  }) as User;
}

/** Owners carry their hostels as an array on the user record. */
async function withOwnedHostels(user: User, on?: Queryable): Promise<User> {
  if (user.role !== "owner") return user;
  const rows = await all<{ id: string }>("SELECT id FROM hostels WHERE owner_id = ?", [user.id], on);
  return { ...user, ownedHostelIds: rows.map((r) => r.id) };
}

/** Service Managers carry their assigned regions as an array — everyone else
 * skips the extra query entirely. */
async function withServiceAreas(user: User, on?: Queryable): Promise<User> {
  if (user.role !== "service") return user;
  const areas = await loadAreas("user", [user.id], on);
  const list = areas.get(user.id);
  return list && list.length ? { ...user, serviceAreas: list } : user;
}

async function toHostel(r: HostelRow, on?: Queryable): Promise<Hostel> {
  const cutoffs = await all<{ meal: MealSlot; cutoff_time: string }>(
    "SELECT meal, cutoff_time FROM hostel_meal_cutoffs WHERE hostel_id = ?",
    [r.id],
    on
  );
  const perms = await one<Record<string, number>>(
    "SELECT rooms, members, approvals, finance, billing, menu, duties, announcements, assign_manager FROM manager_permissions WHERE hostel_id = ?",
    [r.id],
    on
  );
  const settings: HostelSettings = {
    mealCutoff: cutoffs.map((c) => ({ meal: c.meal, time: String(c.cutoff_time).slice(0, 5) })),
    guestMealPrice: Number(r.guest_meal_price),
    mealStopRequiresApproval: toBool(r.meal_stop_requires_approval),
    shoppingRotationPolicy: r.shopping_rotation_policy,
    serviceChargeMonthly: Number(r.service_charge_monthly),
    advanceRentRequired: toBool(r.advance_rent_required) || undefined,
    mealsOffered: {
      breakfast: toBool(r.offers_breakfast),
      lunch: toBool(r.offers_lunch),
      dinner: toBool(r.offers_dinner),
    },
    mealToggleCutoff: String(r.meal_toggle_cutoff ?? "22:00:00").slice(0, 5),
    ...(perms
      ? {
          managerPermissions: {
            rooms: toBool(perms.rooms), members: toBool(perms.members),
            approvals: toBool(perms.approvals), finance: toBool(perms.finance),
            billing: toBool(perms.billing), menu: toBool(perms.menu),
            duties: toBool(perms.duties), announcements: toBool(perms.announcements),
            assignManager: toBool(perms.assign_manager),
          } as ManagerPermissions,
        }
      : {}),
  };
  return omitUndefined({
    id: r.id,
    name: r.name,
    area: r.area,
    gender: (r.gender as HostelGender | null) ?? undefined,
    address: r.division && r.district && r.thana
      ? { division: r.division, district: r.district, thana: r.thana }
      : undefined,
    street: r.street ?? undefined,
    ownerId: r.owner_id,
    managerId: r.manager_id ?? "",
    cookId: r.cook_id ?? undefined,
    mealRate: Number(r.meal_rate),
    kitchenLocation: r.kitchen_location ?? undefined,
    cookMonthlySalary: r.cook_monthly_salary == null ? undefined : Number(r.cook_monthly_salary),
    settings,
    suspended: toBool(r.suspended) || undefined,
    verified: toBool(r.verified) || undefined,
  }) as Hostel;
}

async function toRoom(r: RoomRow, on?: Queryable): Promise<Room> {
  const [occupants, facilities] = await Promise.all([
    all<{ id: string }>("SELECT id FROM users WHERE room_id = ?", [r.id], on),
    all<{ facility: string }>("SELECT facility FROM room_facilities WHERE room_id = ?", [r.id], on),
  ]);
  return omitUndefined({
    id: r.id,
    hostelId: r.hostel_id,
    number: r.number,
    capacity: r.capacity,
    occupantIds: occupants.map((o) => o.id),
    seatRent: Number(r.seat_rent),
    facilities: facilities.length ? facilities.map((f) => f.facility) : undefined,
  }) as Room;
}

const USER_COLS =
  "id, role, name, phone, email, gender, avatar_seed, hostel_id, room_id, student_id, department, division, district, thana, meals_suspended, future_breakfast_off, future_lunch_off, future_dinner_off, banned, manager_rating, manager_rating_note, joined_at, advance_held, notify_announcements, notify_bills, notify_monthly_report, service_kinds";

async function loadUser(id: string, on?: Queryable): Promise<User | undefined> {
  const row = await one<UserRow>(`SELECT ${USER_COLS} FROM users WHERE id = ?`, [id], on);
  if (!row) return undefined;
  return withServiceAreas(await withOwnedHostels(toUser(row), on), on);
}

// ── Users ──────────────────────────────────────────────────────────────────

export const users: UserRepository = {
  async getUser(userId) {
    return loadUser(userId);
  },

  async listByHostel(hostelId) {
    const rows = await all<UserRow>(
      `SELECT ${USER_COLS} FROM users WHERE hostel_id = ? AND role NOT IN (?, ?, ?, ?) ORDER BY name`,
      [hostelId, ...NON_HOSTEL_ROLES]
    );
    return rows.map(toUser);
  },

  async listAll() {
    const rows = await all<UserRow>(`SELECT ${USER_COLS} FROM users ORDER BY name`);
    return Promise.all(rows.map(async (r) => withServiceAreas(await withOwnedHostels(toUser(r)))));
  },

  async phoneAvailable(phone) {
    const target = normalizePhone(phone);
    if (!target) return false;
    // Indexed lookup on the normalised column — "01711-1" and "017111"
    // collide here exactly like they do in every other phone comparison.
    const row = await one<{ id: string }>("SELECT id FROM users WHERE phone_normalized = ? LIMIT 1", [target]);
    return !row;
  },

  async signup(input) {
    const name = (input.name ?? "").trim();
    const phone = (input.phone ?? "").trim();
    const password = input.password ?? "";
    if (!name || !phone) throw new Error("Name and phone number are required.");
    if (password.length < 6) throw new Error("Password must be at least 6 characters.");
    if (input.gender !== "male" && input.gender !== "female") {
      throw new Error("Please select your gender.");
    }
    const normalized = normalizePhone(phone);
    if (!(await users.phoneAvailable(phone))) throw new Error(PHONE_TAKEN_MESSAGE);
    // Whitelisted: this runs unauthenticated, so it may only ever produce a
    // hostel-less student or owner.
    const role: Role = input.role === "owner" ? "owner" : "student";
    const id = newId("user");
    try {
      await run(
        `INSERT INTO users (id, role, name, phone, phone_normalized, password_hash, email, gender, avatar_seed, student_id, department, division, district, thana)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, role, name, phone, normalized, hashPassword(password), input.email?.trim() || null,
          input.gender,
          input.avatarSeed || name,
          role === "student" ? input.studentId?.trim() || null : null,
          role === "student" ? input.department?.trim() || null : null,
          input.address?.division ?? null, input.address?.district ?? null, input.address?.thana ?? null,
        ]
      );
    } catch (err) {
      // Closes the race between the phoneAvailable() check above and this
      // insert — two concurrent signups for the same number (e.g. a
      // double-tapped submit button) can both pass the check, but only one
      // wins the DB's unique index; the loser gets the same friendly error.
      if (isDuplicateEntry(err)) throw new Error(PHONE_TAKEN_MESSAGE);
      throw err;
    }
    return (await loadUser(id))!;
  },

  async create(user) {
    const normalized = normalizePhone(user.phone);
    if (!(await users.phoneAvailable(user.phone))) throw new Error(PHONE_TAKEN_MESSAGE);
    const id = newId("user");
    try {
      await run(
        `INSERT INTO users (id, role, name, phone, phone_normalized, password_hash, email, gender, avatar_seed, hostel_id, room_id, student_id, department,
                            division, district, thana, meals_suspended, banned, joined_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          // Staff-created accounts (owner adding a manager/cook) start with
          // their own phone number as their password — the same rule an
          // account migrated from before passwords existed gets.
          id, user.role, user.name, user.phone, normalized, hashPassword(normalized), user.email ?? null,
          user.gender ?? null,
          user.avatarSeed ?? user.name,
          user.hostelId || null, user.roomId ?? null, user.studentId ?? null, user.department ?? null,
          user.address?.division ?? null, user.address?.district ?? null, user.address?.thana ?? null,
          user.mealsSuspended ? 1 : 0, user.banned ? 1 : 0, user.joinedAt ?? null,
        ]
      );
    } catch (err) {
      if (isDuplicateEntry(err)) throw new Error(PHONE_TAKEN_MESSAGE);
      throw err;
    }
    return (await loadUser(id))!;
  },

  async updateUser(userId, patch) {
    // Self-service profile edit ONLY — never another account's, and never a
    // sensitive field (role, banned, hostelId, roomId, advanceHeld,
    // managerRating, …). Those go through their own dedicated, properly-
    // authorized methods (setBanned, remove, rate, setServicePermissions,
    // hostels.assignManager, …). Reachable by ANY signed-in user (no
    // policy.ts entry needed) precisely because it's this narrow — every
    // role legitimately edits its own profile.
    if (currentActor()?.id !== userId) {
      throw new Error("You can only edit your own account.");
    }
    const sets: string[] = [];
    const params: unknown[] = [];
    const put = (col: string, val: unknown) => { sets.push(`${col} = ?`); params.push(val); };

    if (patch.name !== undefined) put("name", patch.name);
    if (patch.phone !== undefined) {
      const normalized = normalizePhone(patch.phone);
      const existing = await one<{ id: string }>(
        "SELECT id FROM users WHERE phone_normalized = ? AND id <> ? LIMIT 1",
        [normalized, userId]
      );
      if (existing) throw new Error("Another account already uses this phone number.");
      put("phone", patch.phone);
      put("phone_normalized", normalized);
    }
    if (patch.email !== undefined) put("email", patch.email ?? null);
    if (patch.gender !== undefined) put("gender", patch.gender ?? null);
    if (patch.avatarSeed !== undefined) put("avatar_seed", patch.avatarSeed);
    if (patch.studentId !== undefined) put("student_id", patch.studentId ?? null);
    if (patch.department !== undefined) put("department", patch.department ?? null);
    if ("address" in patch) {
      put("division", patch.address?.division ?? null);
      put("district", patch.address?.district ?? null);
      put("thana", patch.address?.thana ?? null);
    }
    if (patch.notificationPrefs !== undefined) {
      const p = patch.notificationPrefs ?? {};
      if (p.announcements !== undefined) put("notify_announcements", p.announcements ? 1 : 0);
      if (p.bills !== undefined) put("notify_bills", p.bills ? 1 : 0);
      if (p.monthlyReport !== undefined) put("notify_monthly_report", p.monthlyReport ? 1 : 0);
    }
    if (!sets.length) return;
    params.push(userId);
    try {
      await run(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, params);
    } catch (err) {
      if (isDuplicateEntry(err)) throw new Error("Another account already uses this phone number.");
      throw err;
    }
  },

  async setBanned(userId, banned) {
    await transaction(async (tx) => {
      const user = await loadUser(userId, tx);
      if (!user) return;
      if (banned) {
        // Evict from the room seat and stop meals, but keep the record so they
        // can still transfer to another hostel.
        await run("UPDATE users SET banned = 1, meals_suspended = 1, room_id = NULL WHERE id = ?", [userId], tx);
      } else {
        await run("UPDATE users SET banned = 0 WHERE id = ?", [userId], tx);
      }
      await logActivity(user.hostelId, banned ? "Member banned" : "Member un-banned", user.name, tx);
    });
  },

  async remove(userId) {
    await transaction(async (tx) => {
      const user = await loadUser(userId, tx);
      if (!user) return;
      await logActivity(user.hostelId, "Member removed", user.name, tx);
      // room_id is on this row, so deleting frees the seat automatically.
      await run("DELETE FROM users WHERE id = ?", [userId], tx);
    });
  },

  async rate(userId, stars, note) {
    await run("UPDATE users SET manager_rating = ?, manager_rating_note = ? WHERE id = ?", [
      stars, note ?? null, userId,
    ]);
  },

  async attachToHostel(userId, hostelId, roomId) {
    await transaction(async (tx) => {
      const user = await loadUser(userId, tx);
      if (!user) throw new Error("No member account found for this code.");
      if (!isHostelMember(user.role) || user.role === "cook") {
        throw new Error(`${user.name} is ${user.role} staff, not a boarder account.`);
      }
      // THE one-hostel rule.
      if (user.hostelId && user.hostelId !== hostelId) {
        const other = await one<{ name: string }>("SELECT name FROM hostels WHERE id = ?", [user.hostelId], tx);
        throw new Error(
          `${user.name} is already a member of ${other?.name ?? "another hostel"} — a member can only belong to one hostel. Use a hostel transfer instead.`
        );
      }
      const room = await one<RoomRow>(
        "SELECT id, hostel_id, number, capacity, seat_rent FROM rooms WHERE id = ? AND hostel_id = ? FOR UPDATE",
        [roomId, hostelId],
        tx
      );
      if (!room) throw new Error("Room not found in this hostel.");
      const occupied = await one<{ n: number }>(
        "SELECT COUNT(*) AS n FROM users WHERE room_id = ? AND id <> ?",
        [roomId, userId],
        tx
      );
      if ((occupied?.n ?? 0) >= room.capacity) throw new Error(`Room ${room.number} is full.`);

      const alreadyMember = user.hostelId === hostelId;
      await run(
        "UPDATE users SET hostel_id = ?, room_id = ?, joined_at = COALESCE(joined_at, ?) WHERE id = ?",
        [hostelId, roomId, alreadyMember ? user.joinedAt ?? today() : today(), userId],
        tx
      );
      // This attachment settles their pending requests: approved here, denied elsewhere.
      await run(
        "UPDATE join_requests SET status = IF(hostel_id = ?, 'approved', 'denied') WHERE user_id = ? AND status = 'pending'",
        [hostelId, userId],
        tx
      );
      await notify(
        userId,
        alreadyMember ? "Room changed" : "Welcome to your hostel",
        alreadyMember
          ? `You've been moved to Room ${room.number}.`
          : `You're now a member — Room ${room.number} is yours. Your hostel dashboard is ready.`,
        tx
      );
      await logActivity(
        hostelId,
        alreadyMember ? "Member room changed" : "Member added (QR scan)",
        `${user.name} → Room ${room.number}`,
        tx
      );
    });
    // A new boarder invalidates the "nothing to seal" cache so their meal rows
    // (join day off, then on) materialise on the very next read.
    invalidateSealCache(hostelId);
  },

  async setServicePermissions(userId, permissions) {
    await transaction(async (tx) => {
      await run(
        "UPDATE users SET service_kinds = ? WHERE id = ?",
        [permissions.kinds.length ? permissions.kinds.join(",") : null, userId],
        tx
      );
      await writeAreas("user", userId, permissions.areas, tx);
    });
  },

  subscribe: serverOnly,
  subscribeUser: serverOnly,
};

/**
 * Verifies a phone+password login. Deliberately NOT a method on `users`
 * (UserRepository) — that object is reachable by name over /api/rpc for any
 * signed-in session (see lib/data/server/policy.ts), and a password check
 * callable that way would let one logged-in account brute-force another's
 * password over the API. This is imported directly by the /api/auth route
 * only, the same way getUserById/getUserByPhone are.
 */
export async function verifyUserPassword(phone: string, password: string): Promise<User | undefined> {
  const target = normalizePhone(phone);
  if (!target || !password) return undefined;
  const row = await one<{ id: string; password_hash: string | null }>(
    "SELECT id, password_hash FROM users WHERE phone_normalized = ? LIMIT 1",
    [target]
  );
  if (!row || !row.password_hash || !verifyPassword(password, row.password_hash)) return undefined;
  return loadUser(row.id);
}

/** Verifies a password against ONE known account id — used by the
 * change-own-password flow, where the session already fixes whose password
 * it is. Kept off UserRepository for the same reason as verifyUserPassword. */
export async function verifyUserPasswordById(userId: string, password: string): Promise<boolean> {
  if (!password) return false;
  const row = await one<{ password_hash: string | null }>(
    "SELECT password_hash FROM users WHERE id = ?",
    [userId]
  );
  return !!(row?.password_hash && verifyPassword(password, row.password_hash));
}

/** Sets a new password hash for an account. Authorization (self, or an owner/
 * superadmin resetting a member) is enforced by the /api/auth routes that
 * call this — it is never reachable over /api/rpc. */
export async function setUserPassword(userId: string, newPassword: string): Promise<boolean> {
  const row = await one<{ id: string }>("SELECT id FROM users WHERE id = ?", [userId]);
  if (!row) return false;
  await run("UPDATE users SET password_hash = ? WHERE id = ?", [hashPassword(newPassword), userId]);
  return true;
}

// ── Rooms ──────────────────────────────────────────────────────────────────

export const rooms: RoomRepository = {
  async listByHostel(hostelId) {
    const rows = await all<RoomRow>(
      "SELECT id, hostel_id, number, capacity, seat_rent FROM rooms WHERE hostel_id = ? ORDER BY number",
      [hostelId]
    );
    return Promise.all(rows.map((r) => toRoom(r)));
  },

  async assignMember(roomId, userId) {
    await transaction(async (tx) => {
      const room = await one<RoomRow>(
        "SELECT id, hostel_id, number, capacity, seat_rent FROM rooms WHERE id = ? FOR UPDATE",
        [roomId],
        tx
      );
      if (!room) return;
      // Doubles as a room-to-room move: the seat is a column on the user, so
      // setting it vacates whatever room they were in.
      await run("UPDATE users SET room_id = ?, hostel_id = ? WHERE id = ?", [roomId, room.hostel_id, userId], tx);
    });
  },

  async vacate(userId) {
    await run("UPDATE users SET room_id = NULL WHERE id = ?", [userId]);
  },

  async create(room) {
    await transaction(async (tx) => {
      const id = newId("room");
      await run(
        "INSERT INTO rooms (id, hostel_id, number, capacity, seat_rent) VALUES (?, ?, ?, ?, ?)",
        [id, room.hostelId, room.number, room.capacity, room.seatRent ?? 0],
        tx
      );
      for (const f of room.facilities ?? []) {
        await run("INSERT INTO room_facilities (room_id, facility) VALUES (?, ?)", [id, f], tx);
      }
      await logActivity(room.hostelId, "Room added", `Room ${room.number} · ${room.capacity} seats`, tx);
    });
  },

  async update(roomId, patch) {
    await transaction(async (tx) => {
      const room = await one<RoomRow>("SELECT id, hostel_id, number, capacity, seat_rent FROM rooms WHERE id = ?", [roomId], tx);
      if (!room) return;
      const sets: string[] = [];
      const params: unknown[] = [];
      if (patch.number !== undefined) { sets.push("number = ?"); params.push(patch.number); }
      if (patch.capacity !== undefined) { sets.push("capacity = ?"); params.push(patch.capacity); }
      if (patch.seatRent !== undefined) { sets.push("seat_rent = ?"); params.push(patch.seatRent); }
      if (sets.length) {
        params.push(roomId);
        await run(`UPDATE rooms SET ${sets.join(", ")} WHERE id = ?`, params, tx);
      }
      if (patch.facilities !== undefined) {
        await run("DELETE FROM room_facilities WHERE room_id = ?", [roomId], tx);
        for (const f of patch.facilities) {
          await run("INSERT INTO room_facilities (room_id, facility) VALUES (?, ?)", [roomId, f], tx);
        }
      }
      await logActivity(room.hostel_id, "Room updated", `Room ${patch.number ?? room.number}`, tx);
    });
  },

  subscribe: serverOnly,
};

// ── Hostels ────────────────────────────────────────────────────────────────

const HOSTEL_COLS =
  "id, name, area, gender, division, district, thana, street, owner_id, manager_id, cook_id, meal_rate, kitchen_location, cook_monthly_salary, suspended, guest_meal_price, meal_stop_requires_approval, shopping_rotation_policy, service_charge_monthly, advance_rent_required, offers_breakfast, offers_lunch, offers_dinner, meal_toggle_cutoff, verified";

async function writeSettings(hostelId: string, settings: Partial<HostelSettings>, tx: Queryable) {
  if (settings.mealCutoff) {
    await run("DELETE FROM hostel_meal_cutoffs WHERE hostel_id = ?", [hostelId], tx);
    for (const c of settings.mealCutoff) {
      await run(
        "INSERT INTO hostel_meal_cutoffs (hostel_id, meal, cutoff_time) VALUES (?, ?, ?)",
        [hostelId, c.meal, c.time.length === 5 ? `${c.time}:00` : c.time],
        tx
      );
    }
  }
  if (settings.managerPermissions) {
    const p = settings.managerPermissions;
    await run(
      `INSERT INTO manager_permissions (hostel_id, rooms, members, approvals, finance, billing, menu, duties, announcements, assign_manager)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE rooms=VALUES(rooms), members=VALUES(members), approvals=VALUES(approvals),
         finance=VALUES(finance), billing=VALUES(billing), menu=VALUES(menu), duties=VALUES(duties),
         announcements=VALUES(announcements), assign_manager=VALUES(assign_manager)`,
      [
        hostelId, p.rooms ? 1 : 0, p.members ? 1 : 0, p.approvals ? 1 : 0, p.finance ? 1 : 0,
        p.billing ? 1 : 0, p.menu ? 1 : 0, p.duties ? 1 : 0, p.announcements ? 1 : 0,
        p.assignManager ? 1 : 0,
      ],
      tx
    );
  }
  const sets: string[] = [];
  const params: unknown[] = [];
  if (settings.guestMealPrice !== undefined) { sets.push("guest_meal_price = ?"); params.push(settings.guestMealPrice); }
  if (settings.mealStopRequiresApproval !== undefined) { sets.push("meal_stop_requires_approval = ?"); params.push(settings.mealStopRequiresApproval ? 1 : 0); }
  if (settings.shoppingRotationPolicy !== undefined) { sets.push("shopping_rotation_policy = ?"); params.push(settings.shoppingRotationPolicy); }
  if (settings.serviceChargeMonthly !== undefined) { sets.push("service_charge_monthly = ?"); params.push(settings.serviceChargeMonthly); }
  if (settings.advanceRentRequired !== undefined) { sets.push("advance_rent_required = ?"); params.push(settings.advanceRentRequired ? 1 : 0); }
  if (settings.mealToggleCutoff !== undefined) {
    const t = settings.mealToggleCutoff;
    sets.push("meal_toggle_cutoff = ?");
    params.push(t.length === 5 ? `${t}:00` : t);
  }
  if (settings.mealsOffered) {
    for (const slot of MEALS) {
      const v = settings.mealsOffered[slot];
      if (v !== undefined) { sets.push(`offers_${slot} = ?`); params.push(v ? 1 : 0); }
    }
  }
  if (sets.length) {
    params.push(hostelId);
    await run(`UPDATE hostels SET ${sets.join(", ")} WHERE id = ?`, params, tx);
  }
}

export const hostels: HostelRepository = {
  async getHostel(hostelId) {
    const row = await one<HostelRow>(`SELECT ${HOSTEL_COLS} FROM hostels WHERE id = ?`, [hostelId]);
    return row ? toHostel(row) : undefined;
  },

  async listByOwner(ownerId) {
    const rows = await all<HostelRow>(`SELECT ${HOSTEL_COLS} FROM hostels WHERE owner_id = ? ORDER BY name`, [ownerId]);
    return Promise.all(rows.map((r) => toHostel(r)));
  },

  async listAll() {
    const rows = await all<HostelRow>(`SELECT ${HOSTEL_COLS} FROM hostels ORDER BY name`);
    return Promise.all(rows.map((r) => toHostel(r)));
  },

  async create(hostel: NewHostel) {
    const id = newId("hostel");
    await transaction(async (tx) => {
      await run(
        `INSERT INTO hostels (id, name, area, gender, division, district, thana, street, owner_id, manager_id, cook_id,
                              meal_rate, kitchen_location, cook_monthly_salary, suspended)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, hostel.name, hostel.area ?? "", hostel.gender ?? null,
          hostel.address?.division ?? null, hostel.address?.district ?? null, hostel.address?.thana ?? null,
          hostel.street ?? null,
          hostel.ownerId, hostel.managerId || null, hostel.cookId ?? null,
          hostel.mealRate ?? 0, hostel.kitchenLocation ?? null, hostel.cookMonthlySalary ?? null,
          hostel.suspended ? 1 : 0,
        ],
        tx
      );
      await writeSettings(id, hostel.settings ?? {}, tx);
    });
    return (await hostels.getHostel(id))!;
  },

  async update(hostelId, patch) {
    await transaction(async (tx) => {
      const sets: string[] = [];
      const params: unknown[] = [];
      const put = (col: string, v: unknown) => { sets.push(`${col} = ?`); params.push(v); };
      if (patch.name !== undefined) put("name", patch.name);
      if (patch.area !== undefined) put("area", patch.area);
      if (patch.gender !== undefined) put("gender", patch.gender ?? null);
      if (patch.ownerId !== undefined) put("owner_id", patch.ownerId);
      if (patch.managerId !== undefined) put("manager_id", patch.managerId || null);
      if (patch.cookId !== undefined) put("cook_id", patch.cookId ?? null);
      if (patch.mealRate !== undefined) put("meal_rate", patch.mealRate);
      if (patch.kitchenLocation !== undefined) put("kitchen_location", patch.kitchenLocation ?? null);
      if (patch.cookMonthlySalary !== undefined) put("cook_monthly_salary", patch.cookMonthlySalary ?? null);
      if (patch.suspended !== undefined) put("suspended", patch.suspended ? 1 : 0);
      if ("address" in patch) {
        put("division", patch.address?.division ?? null);
        put("district", patch.address?.district ?? null);
        put("thana", patch.address?.thana ?? null);
      }
      if (patch.street !== undefined) put("street", patch.street ?? null);
      if (sets.length) {
        params.push(hostelId);
        await run(`UPDATE hostels SET ${sets.join(", ")} WHERE id = ?`, params, tx);
      }
      if ("managerId" in patch || "cookId" in patch) await logActivity(hostelId, "Staff assignment changed", undefined, tx);
      if ("mealRate" in patch) await logActivity(hostelId, "Meal rate updated", `৳${patch.mealRate}/meal`, tx);
    });
  },

  async changeManager(hostelId, newManagerId) {
    await transaction(async (tx) => {
      const hostel = await one<HostelRow>(`SELECT ${HOSTEL_COLS} FROM hostels WHERE id = ? FOR UPDATE`, [hostelId], tx);
      if (!hostel) throw new Error("Hostel not found.");
      const next = await loadUser(newManagerId, tx);
      if (!next) throw new Error("Member not found.");
      if (next.hostelId !== hostelId || !isHostelMember(next.role)) {
        throw new Error(`${next.name} isn't a member of this hostel.`);
      }
      if (next.role === "cook") throw new Error("The cook can't be made manager.");
      if (next.banned) throw new Error(`${next.name} is banned — un-ban them first.`);
      if (hostel.manager_id === newManagerId) return;

      // Demote the outgoing manager to a regular boarder — they keep their
      // room seat and meals, just lose manager access.
      if (hostel.manager_id) {
        const prev = await loadUser(hostel.manager_id, tx);
        if (prev?.role === "manager") {
          await run("UPDATE users SET role = 'student' WHERE id = ?", [prev.id], tx);
          await notify(
            prev.id,
            "Manager role handed over",
            `You're now a regular boarder of ${hostel.name}. ${next.name} is the new manager.`,
            tx
          );
        }
      }
      await run("UPDATE users SET role = 'manager' WHERE id = ?", [newManagerId], tx);
      await run("UPDATE hostels SET manager_id = ? WHERE id = ?", [newManagerId, hostelId], tx);
      await notify(newManagerId, "You're the hostel manager", `You've been made the manager of ${hostel.name}.`, tx);
      // Keep the owner in the loop — a manager can hand the role over with the
      // assignManager permission, and the owner would otherwise learn nothing.
      // (No self-notification when the owner made the change themselves.)
      const actor = currentActor();
      if (actor?.id !== hostel.owner_id) {
        await notify(
          hostel.owner_id,
          "Hostel manager changed",
          `${next.name} is now the manager of ${hostel.name}${actor ? ` (changed by ${actor.name})` : ""}.`,
          tx
        );
      }
      await logActivity(hostelId, "Manager changed", next.name, tx);
    });
  },

  async assignManager(hostelId, manager) {
    await transaction(async (tx) => {
      const hostel = await one<HostelRow>(`SELECT ${HOSTEL_COLS} FROM hostels WHERE id = ? FOR UPDATE`, [hostelId], tx);
      if (!hostel) throw new Error("Hostel not found.");

      let newManagerId: string;
      let newManagerName: string;
      if (manager.mode === "new") {
        const name = manager.name.trim();
        const phone = manager.phone.trim();
        if (!name || !phone) throw new Error("Name and phone number are required.");
        const normalized = normalizePhone(phone);
        const existing = await one<{ id: string }>(
          "SELECT id FROM users WHERE phone_normalized = ? LIMIT 1",
          [normalized],
          tx
        );
        if (existing) throw new Error(PHONE_TAKEN_MESSAGE);
        newManagerId = newId("user");
        newManagerName = name;
        try {
          await run(
            `INSERT INTO users (id, role, name, phone, phone_normalized, password_hash, avatar_seed, hostel_id, joined_at)
             VALUES (?, 'manager', ?, ?, ?, ?, ?, ?, ?)`,
            [
              newManagerId, name, phone, normalized, hashPassword(normalized),
              `manager-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, hostelId, today(),
            ],
            tx
          );
        } catch (err) {
          if (isDuplicateEntry(err)) throw new Error(PHONE_TAKEN_MESSAGE);
          throw err;
        }
      } else {
        const target = await loadUser(manager.userId, tx);
        if (!target) throw new Error("Account not found.");
        if (target.banned) throw new Error(`${target.name} is banned — un-ban them first.`);
        if (!isHostelMember(target.role) || target.role === "cook") {
          throw new Error(`${target.name} can't be made manager (they're ${target.role}).`);
        }
        // One-hostel rule: an account tied to another hostel can't be pulled in.
        if (target.hostelId && target.hostelId !== hostelId) {
          const other = await one<{ name: string }>("SELECT name FROM hostels WHERE id = ?", [target.hostelId], tx);
          throw new Error(
            `${target.name} is already a member of ${other?.name ?? "another hostel"} — a member can only belong to one hostel.`
          );
        }
        newManagerId = target.id;
        newManagerName = target.name;
        // Attach here (if they had no hostel) and promote.
        await run(
          "UPDATE users SET role = 'manager', hostel_id = ?, joined_at = COALESCE(joined_at, ?) WHERE id = ?",
          [hostelId, today(), newManagerId],
          tx
        );
      }

      if (hostel.manager_id === newManagerId) return; // already the manager

      // Demote the outgoing manager to a regular boarder.
      if (hostel.manager_id) {
        const prev = await loadUser(hostel.manager_id, tx);
        if (prev?.role === "manager") {
          await run("UPDATE users SET role = 'student' WHERE id = ?", [prev.id], tx);
          await notify(
            prev.id,
            "Manager role handed over",
            `You're now a regular boarder of ${hostel.name}. ${newManagerName} is the new manager.`,
            tx
          );
        }
      }
      await run("UPDATE hostels SET manager_id = ? WHERE id = ?", [newManagerId, hostelId], tx);
      await notify(newManagerId, "You're the hostel manager", `You've been made the manager of ${hostel.name}.`, tx);
      const actor = currentActor();
      if (actor?.id !== hostel.owner_id) {
        await notify(
          hostel.owner_id,
          "Hostel manager changed",
          `${newManagerName} is now the manager of ${hostel.name}${actor ? ` (changed by ${actor.name})` : ""}.`,
          tx
        );
      }
      await logActivity(
        hostelId,
        manager.mode === "new" ? "Manager account created" : "Manager assigned",
        newManagerName,
        tx
      );
    });
  },

  async demoteManager(hostelId) {
    await transaction(async (tx) => {
      const hostel = await one<HostelRow>(`SELECT ${HOSTEL_COLS} FROM hostels WHERE id = ? FOR UPDATE`, [hostelId], tx);
      if (!hostel) throw new Error("Hostel not found.");
      if (!hostel.manager_id) return; // already manager-less
      const prev = await loadUser(hostel.manager_id, tx);
      // Only touch the role if they're actually a manager; either way clear the
      // hostel's manager pointer so it never references a demoted user.
      if (prev?.role === "manager") {
        await run("UPDATE users SET role = 'student' WHERE id = ?", [prev.id], tx);
        await notify(
          prev.id,
          "Manager role removed",
          `The owner has removed your manager role at ${hostel.name}. You're now a regular boarder (your room and meals are unchanged).`,
          tx
        );
      }
      await run("UPDATE hostels SET manager_id = NULL WHERE id = ?", [hostelId], tx);
      const actor = currentActor();
      if (actor?.id !== hostel.owner_id) {
        await notify(
          hostel.owner_id,
          "Hostel manager removed",
          `${prev?.name ?? "The manager"} is no longer the manager of ${hostel.name}${actor ? ` (removed by ${actor.name})` : ""}.`,
          tx
        );
      }
      await logActivity(hostelId, "Manager removed", prev?.name, tx);
    });
  },

  async assignCook(hostelId, cook) {
    await transaction(async (tx) => {
      const hostel = await one<HostelRow>(`SELECT ${HOSTEL_COLS} FROM hostels WHERE id = ? FOR UPDATE`, [hostelId], tx);
      if (!hostel) throw new Error("Hostel not found.");

      // Detach whoever's currently the cook — their account and "cook" role
      // are kept (so they can be reassigned elsewhere), just no longer
      // referenced by this hostel.
      let prevCookId: string | null = null;
      if (hostel.cook_id) {
        prevCookId = hostel.cook_id;
        await run("UPDATE users SET hostel_id = NULL, room_id = NULL WHERE id = ?", [prevCookId], tx);
      }

      let newCookId: string | null = null;
      let newCookName = "";
      if (cook.mode === "new") {
        const name = cook.name.trim();
        const phone = cook.phone.trim();
        if (!name || !phone) throw new Error("Name and phone number are required.");
        const normalized = normalizePhone(phone);
        const existing = await one<{ id: string }>(
          "SELECT id FROM users WHERE phone_normalized = ? LIMIT 1",
          [normalized],
          tx
        );
        if (existing) throw new Error(PHONE_TAKEN_MESSAGE);
        newCookId = newId("user");
        newCookName = name;
        try {
          await run(
            `INSERT INTO users (id, role, name, phone, phone_normalized, password_hash, avatar_seed, hostel_id)
             VALUES (?, 'cook', ?, ?, ?, ?, ?, ?)`,
            [
              newCookId, name, phone, normalized, hashPassword(normalized),
              `cook-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, hostelId,
            ],
            tx
          );
        } catch (err) {
          if (isDuplicateEntry(err)) throw new Error(PHONE_TAKEN_MESSAGE);
          throw err;
        }
      } else if (cook.mode === "existing") {
        const target = await loadUser(cook.userId, tx);
        if (!target) throw new Error("Member not found.");
        if (target.role !== "cook") throw new Error(`${target.name} isn't a cook account.`);
        if (target.hostelId && target.hostelId !== hostelId) {
          throw new Error(`${target.name} is already staffing another hostel — remove them there first.`);
        }
        newCookId = target.id;
        newCookName = target.name;
        await run("UPDATE users SET hostel_id = ? WHERE id = ?", [hostelId, newCookId], tx);
      }
      // mode "remove": newCookId stays null.

      await run("UPDATE hostels SET cook_id = ? WHERE id = ?", [newCookId, hostelId], tx);
      if (cook.mode === "remove") {
        await run("UPDATE hostels SET cook_monthly_salary = NULL WHERE id = ?", [hostelId], tx);
      } else if (cook.salary !== undefined && cook.salary > 0) {
        await run("UPDATE hostels SET cook_monthly_salary = ? WHERE id = ?", [cook.salary, hostelId], tx);
      }

      if (prevCookId && prevCookId !== newCookId) {
        await notify(prevCookId, "No longer the hostel cook", `You've been removed as ${hostel.name}'s cook.`, tx);
      }
      if (newCookId && newCookId !== prevCookId) {
        await notify(newCookId, "You're the hostel cook", `You've been made the cook of ${hostel.name}.`, tx);
      }
      await logActivity(
        hostelId,
        cook.mode === "remove" ? "Cook removed" : "Cook changed",
        newCookName || undefined,
        tx
      );
    });
  },

  async updateSettings(hostelId, patch) {
    await transaction(async (tx) => {
      await writeSettings(hostelId, patch, tx);
      if ("managerPermissions" in patch) await logActivity(hostelId, "Manager permissions changed", undefined, tx);
      if ("serviceChargeMonthly" in patch) {
        await logActivity(hostelId, "Service charge updated", `৳${patch.serviceChargeMonthly}/month per boarder`, tx);
      }
    });
  },

  /** Master meal on/off. Takes effect from TODAY onward: today's count becomes
   * zero for that slot, and every past day keeps exactly the count it had —
   * their offer is pinned on meal_days and is never recalculated. */
  async setMealOffered(hostelId, meal, offered) {
    await transaction(async (tx) => {
      const from = today();
      await run(`UPDATE hostels SET offers_${meal} = ? WHERE id = ?`, [offered ? 1 : 0, hostelId], tx);
      // Re-pin the offer on today and every future day already on record.
      await run(
        `UPDATE meal_days SET offers_${meal} = ? WHERE hostel_id = ? AND day >= ?`,
        [offered ? 1 : 0, hostelId, from],
        tx
      );
      if (!offered) {
        // Closing zeroes today onward — including guests, since nothing is
        // cooked. History is untouched.
        await run(
          "UPDATE meal_entries SET is_on = 0, guest_count = 0 WHERE hostel_id = ? AND meal = ? AND day >= ?",
          [hostelId, meal, from],
          tx
        );
      }
      await logActivity(hostelId, offered ? "Meal opened (master)" : "Meal closed (master)", meal, tx);
    });
  },

  async setSuspended(hostelId, suspended) {
    await run("UPDATE hostels SET suspended = ? WHERE id = ?", [suspended ? 1 : 0, hostelId]);
  },

  async setVerified(hostelId, verified) {
    await run("UPDATE hostels SET verified = ? WHERE id = ?", [verified ? 1 : 0, hostelId]);
    await logActivity(hostelId, verified ? "Hostel verified" : "Hostel verification removed");
  },

  subscribe: serverOnly,
  subscribeAll: serverOnly,
};

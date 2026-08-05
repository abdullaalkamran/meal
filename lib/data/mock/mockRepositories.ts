import type {
  ActivityRepository,
  AnnouncementRepository,
  BillRepository,
  CampaignRepository,
  CommentRepository,
  CommunityRepository,
  CookAttendanceRepository,
  CookLeaveRepository,
  CouponRepository,
  DutyRepository,
  ExpenseRepository,
  ExploreInteractionRepository,
  GuestMealRepository,
  HostelRepository,
  JoinRequestRepository,
  LeaveRequestRepository,
  MarketingRepository,
  MealEditRepository,
  MealRepository,
  MealStopRepository,
  MenuRepository,
  NotificationRepository,
  PushSubscriptionRepository,
  OrderRepository,
  CartRepository,
  ProductRepository,
  PromoSettingsRepository,
  QuickServicesRepository,
  RatingRepository,
  Repositories,
  RoomRepository,
  ServiceCatalogRepository,
  ShoppingCostRepository,
  ShoppingCostEditRepository,
  ShortageRepository,
  StoreSettingsRepository,
  StudyAbroadRepository,
  StudyLeadRepository,
  SwapRepository,
  TransferRepository,
  UsedBookRepository,
  PromotionRepository,
  UserRepository,
} from "../repository";
import type { ActivityCategory, Bill, BillSection, BillTarget, Coupon, Expense, MealDay, MealEditRequest, MealSlot, Order, OrderItem, PasswordResetOtp, Payment, Product, Role, ServiceListing, ShoppingCostEditRequest, SmtpSettings, StudyAbroadItem, User } from "../types";
import { getVapidPublicKey, sendToSubscription } from "../../push/webpush";
import { addDays, currentMonth, formatMonthLabel, formatShortDate, today } from "../../utils/date";
import { canToggleMeal } from "../../utils/mealPolicy";
import { normalizePhone } from "../../utils/phone";
import { isServiceChargeCategory } from "../../utils/expenseCategories";
import { deliveryFeeFor } from "../../utils/store";
import { formatBDT } from "../../utils/currency";
import { hashPassword, verifyPassword as verifyPasswordHash } from "../server/password";
import { nextId, store } from "./store";

// Roles that aren't boarders of any single hostel — excluded from per-hostel
// member/boarder listings (owner + platform-team operators).
const NON_HOSTEL_ROLES: Role[] = ["owner", "superadmin", "marketing", "service"];
const isHostelMember = (role: Role) => !NON_HOSTEL_ROLES.includes(role);

const PHONE_TAKEN_MESSAGE = "An account with this phone number already exists — sign in instead.";


/** Per-user record channel — fired on ANY mutation of one user so the session
 * mirror works even for users with no hostel (new signups). */
const emitUser = (userId: string) => store.emit(`user-rec:${userId}`);

function emptyMealDay(hostelId: string, date: string): MealDay {
  return { hostelId, date, entries: {} };
}

function ensureMealDay(hostelId: string, date: string): MealDay {
  const idx = store.data.mealDays.findIndex((d) => d.hostelId === hostelId && d.date === date);
  if (idx === -1) {
    const day = emptyMealDay(hostelId, date);
    store.data.mealDays.push(day);
    return day;
  }
  // Replace with a shallow clone so subscribers keyed on object-reference
  // equality (useMealDay's per-date subscription) see a real change once the
  // caller mutates the returned entry and emits — mutating in place would
  // leave the array holding the exact same reference React already has,
  // which React's setState bails out on.
  const cloned: MealDay = { ...store.data.mealDays[idx], entries: { ...store.data.mealDays[idx].entries } };
  store.data.mealDays[idx] = cloned;
  return cloned;
}

/** Materialises meal rows for every date up to today, mirroring the MySQL
 * backend's sealing: each day pins the hostel's offer, and every current
 * boarder who had already joined by that day gets an explicit entry
 * (defaulting to that day's offer). Counting then reads real rows, so the
 * roster, the day totals and billing always agree — a member who never
 * opened the app is still counted, a closed slot is off for everyone, and a
 * member is never counted for a day before they joined.
 *
 * The per-boarder top-up runs even for already-sealed days (existing rows are
 * never overwritten), so a member who joins AFTER a day was first sealed is
 * still counted for every day since they joined — adding a member mid-day
 * still cooks for them today. */
// This runs on every getMealDay/listMealDays/getActualMealRate call, and
// getActualMealRate reseals the WHOLE MONTH every time — polled every 2.5s
// by every active viewer (lib/data/remote/remoteRepositories.ts). Without a
// cache, every single poll re-scans the ENTIRE mealDays array (a linear
// findIndex, across every hostel this process has ever touched, once per
// day in range) plus the full users array — synchronously, with no `await`
// yield point, so it blocks Node's single-threaded event loop for its
// whole duration. As mealDays only grows over a long-running dev server,
// each call gets slower, and enough concurrent pollers can make the whole
// process unresponsive. Mirrors the MySQL backend's sealDays cache
// (lib/data/server/mysql/meals.ts) — same TTL approach, shorter here since
// local dev expects fresher feedback and everything's in-process anyway.
const MOCK_SEAL_CACHE_TTL_MS = 5_000;
const sealedMockRangeCache = new Map<string, number>(); // `${hostelId}:${from}:${last}` -> expires-at (ms)

function sealMockDays(hostelId: string, from: string, to: string) {
  const last = to < today() ? to : today();
  if (from > last) return;

  // Same floor as the MySQL backend's sealDays (lib/data/server/mysql/
  // meals.ts): a caller can request an effectively unbounded range (e.g.
  // meals.subscribe's "0000-01-01", used purely as a change-notification
  // trigger — see remoteRepositories.ts) which without this clamp turns
  // every poll into a ~740,000-day walk over the whole mealDays array,
  // synchronously, with no yield point — this is what hung the dev server
  // at 100% CPU for minutes at a time.
  const HISTORY_FLOOR_DAYS = 366;
  const floor = addDays(last, -HISTORY_FLOOR_DAYS);
  if (from < floor) from = floor;

  const cacheKey = `${hostelId}:${from}:${last}`;
  const cachedUntil = sealedMockRangeCache.get(cacheKey);
  if (cachedUntil !== undefined && cachedUntil > Date.now()) return;
  const hostel = store.data.hostels.find((h) => h.id === hostelId);
  const offer = {
    breakfast: hostel?.settings.mealsOffered?.breakfast ?? true,
    lunch: hostel?.settings.mealsOffered?.lunch ?? true,
    dinner: hostel?.settings.mealsOffered?.dinner ?? true,
  };
  const boarders = store.data.users.filter(
    (u) => u.hostelId === hostelId && !u.banned && u.role !== "cook" && isHostelMember(u.role)
  );
  let changed = false;
  for (let day = from; day <= last; day = addDays(day, 1)) {
    const idx = store.data.mealDays.findIndex((d) => d.hostelId === hostelId && d.date === day);
    const existing = idx === -1 ? undefined : store.data.mealDays[idx];
    const mo = existing?.mealsOffered;
    const mealsOffered = {
      breakfast: mo?.breakfast ?? offer.breakfast,
      lunch: mo?.lunch ?? offer.lunch,
      dinner: mo?.dinner ?? offer.dinner,
    };
    const entries = { ...(existing?.entries ?? {}) };
    let added = !existing || !existing.sealed;
    for (const b of boarders) {
      const joined = b.joinedAt?.slice(0, 10);
      if (joined && joined > day) continue; // not a boarder yet
      if (!entries[b.id]) {
        // Default off when the member's "future meals off" switch is on, or on
        // their JOIN day — joining today means today's cutoff (the evening
        // before) already passed, so they're not in today's planned meal.
        const joinedThisDay = b.joinedAt?.slice(0, 10) === day;
        const on = (meal: MealSlot, slot: boolean) =>
          b.futureMealsOff?.[meal] || joinedThisDay ? false : slot;
        entries[b.id] = {
          breakfast: { on: on("breakfast", mealsOffered.breakfast), guestCount: 0 },
          lunch: { on: on("lunch", mealsOffered.lunch), guestCount: 0 },
          dinner: { on: on("dinner", mealsOffered.dinner), guestCount: 0 },
        };
        added = true;
      }
    }
    if (!added) continue; // already sealed and no new members to top up
    const record: MealDay = {
      hostelId,
      date: day,
      entries,
      mealsOffered,
      sealed: true,
      ...(existing?.shoppingUserId ? { shoppingUserId: existing.shoppingUserId } : {}),
    };
    if (idx === -1) store.data.mealDays.push(record);
    else store.data.mealDays[idx] = record;
    changed = true;
  }
  if (changed) store.emit(`mealDay:${hostelId}`);
  // Fully processed as of now — the next call within MOCK_SEAL_CACHE_TTL_MS
  // skips straight past without touching mealDays/users at all.
  sealedMockRangeCache.set(cacheKey, Date.now() + MOCK_SEAL_CACHE_TTL_MS);
}

// ── Activity log ────────────────────────────────────────────────────────────
// The mock layer records who performed each audited action. The session
// provider registers the signed-in user here; a real backend would derive
// the actor from the auth token instead.
let actingUser: { id: string; name: string } | null = null;
export function setActingUser(user: { id: string; name: string } | undefined) {
  actingUser = user ?? null;
}

function logActivity(hostelId: string, action: string, detail?: string, category?: ActivityCategory) {
  if (!hostelId) return;
  store.data.activityLogs.push({
    id: nextId("act"),
    hostelId,
    actorId: actingUser?.id ?? "system",
    actorName: actingUser?.name ?? "System",
    action,
    detail,
    ...(category ? { category } : {}),
    createdAt: new Date().toISOString(),
  });
  store.emit(`activity:${hostelId}`);
}

/** Best-effort browser push to every device the user subscribed, pruning dead
 * subscriptions. Fire-and-forget from notifyUser — never blocks or throws. */
async function sendPushToUserMock(userId: string, payload: { title: string; body: string; url?: string }) {
  const subs = store.data.pushSubscriptions.filter((s) => s.userId === userId);
  for (const sub of subs) {
    const { gone } = await sendToSubscription(sub, payload);
    if (gone) {
      store.data.pushSubscriptions = store.data.pushSubscriptions.filter((s) => s.endpoint !== sub.endpoint);
    }
  }
}

function notifyUser(userId: string, title: string, body: string, announcementId?: string) {
  store.data.notifications.push({
    id: nextId("notif"),
    userId,
    ...(announcementId ? { announcementId } : {}),
    title,
    body,
    read: false,
    createdAt: new Date().toISOString(),
  });
  store.emit(`notifications:${userId}`);
  // Push it to the browser too, so it arrives even when the app is closed.
  setImmediate(() => {
    void sendPushToUserMock(userId, { title, body }).catch(() => {});
  });
}

/** Notifies a hostel's manager and owner (the people who approve things),
 * skipping whoever performed the action. Used for every request that needs
 * staff approval, so incoming requests never go unseen. */
function notifyHostelStaff(hostelId: string, title: string, body: string) {
  const hostel = store.data.hostels.find((h) => h.id === hostelId);
  if (!hostel) return;
  const actorId = actingUser?.id;
  const targets = new Set<string>();
  if (hostel.managerId) targets.add(hostel.managerId);
  if (hostel.ownerId) targets.add(hostel.ownerId);
  for (const uid of targets) {
    if (uid && uid !== actorId) notifyUser(uid, title, body);
  }
}

/** True when the hostel currently cooks this meal slot at all (master meal
 * on/off, set by the manager/owner). Missing settings mean offered. */
function isMealOffered(hostelId: string, meal: MealSlot): boolean {
  const hostel = store.data.hostels.find((h) => h.id === hostelId);
  return hostel?.settings.mealsOffered?.[meal] ?? true;
}

/** True only once a manager/owner has confirmed this exact (hostel, date,
 * meal) was actually cooked (cookAttendance.markCooked). Gates both the
 * cooking count and everything meal-rate/billing derives from it — a slot
 * nobody confirmed, or one confirmed as the cook being absent, contributes
 * zero no matter what any member's own on/off toggle says. */
function isMealConfirmedCooked(hostelId: string, date: string, meal: MealSlot): boolean {
  return store.data.cookAttendanceReports.some(
    (r) => r.hostelId === hostelId && r.date === date && r.meal === meal && r.status === "resolved_cooked"
  );
}

/** The automatic per-meal cost of a month: actual shopping spend ÷ meals
 * eaten (member + guest) by current boarders. THE meal rate — bills, guest
 * quotes, and reports all derive from this; no one sets it by hand. */
function actualMealRateFor(hostelId: string, month: string) {
  const totalShopping = store.data.shoppingCosts
    .filter((c) => c.hostelId === hostelId && c.status === "approved" && c.dates.some((d) => d.startsWith(month)))
    .reduce((sum, c) => sum + c.amount, 0);
  const boarders = store.data.users.filter(
    (u) => u.hostelId === hostelId && u.role !== "cook" && isHostelMember(u.role) && !u.banned
  );
  const boarderIds = new Set(boarders.map((u) => u.id));
  // A member only counts from their join date on — before it they weren't
  // here to eat, so a day earlier than their join never bills to them.
  const joinedById = new Map(boarders.map((u) => [u.id, u.joinedAt?.slice(0, 10)]));
  let totalMeals = 0;
  for (const day of store.data.mealDays) {
    if (day.hostelId !== hostelId || !day.date.startsWith(month)) continue;
    for (const slot of ["breakfast", "lunch", "dinner"] as const) {
      if (!isMealConfirmedCooked(hostelId, day.date, slot)) continue;
      for (const [userId, entry] of Object.entries(day.entries)) {
        if (!boarderIds.has(userId)) continue;
        const joined = joinedById.get(userId);
        if (joined && joined > day.date) continue;
        totalMeals += (entry[slot].on ? 1 : 0) + entry[slot].guestCount;
      }
    }
  }
  return {
    rate: totalMeals > 0 ? totalShopping / totalMeals : 0,
    totalShopping,
    totalMeals,
  };
}

function ensureMealEntry(day: MealDay, userId: string) {
  if (!day.entries[userId]) {
    // New entries default on only for slots the hostel actually offers —
    // a closed slot never silently accrues meals.
    day.entries[userId] = {
      breakfast: { on: isMealOffered(day.hostelId, "breakfast"), guestCount: 0 },
      lunch: { on: isMealOffered(day.hostelId, "lunch"), guestCount: 0 },
      dinner: { on: isMealOffered(day.hostelId, "dinner"), guestCount: 0 },
    };
  }
  return day.entries[userId];
}

const users: UserRepository = {
  async getUser(userId) {
    return store.data.users.find((u) => u.id === userId);
  },
  async listByHostel(hostelId) {
    // Owners aren't boarders of any single hostel — their `hostelId` is only
    // a fallback/display value, not real membership — so they're excluded
    // from per-hostel member/boarder listings.
    return store.data.users.filter((u) => u.hostelId === hostelId && isHostelMember(u.role));
  },
  async listAll() {
    return store.data.users;
  },
  async create(user) {
    const target = normalizePhone(user.phone);
    if (store.data.users.some((u) => normalizePhone(u.phone) === target)) {
      throw new Error(PHONE_TAKEN_MESSAGE);
    }
    const created = { ...user, id: nextId("user") };
    store.data.users.push(created);
    // Staff-created accounts (owner adding a manager/cook) start with their
    // own phone number as their password — same default a pre-existing
    // account gets, and what a fresh signup would type to sign back in.
    store.data.passwordHashes[created.id] = hashPassword(target);
    store.emit(`users:${created.hostelId}`);
    return created;
  },
  async phoneAvailable(phone) {
    const target = normalizePhone(phone);
    if (!target) return false;
    return !store.data.users.some((u) => normalizePhone(u.phone) === target);
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
    const target = normalizePhone(phone);
    if (store.data.users.some((u) => normalizePhone(u.phone) === target)) {
      throw new Error(PHONE_TAKEN_MESSAGE);
    }
    // Whitelist every field: this path is reachable without a session, so it
    // must never be able to set role, hostelId, ownedHostelIds, banned, …
    // beyond a fresh, hostel-less student or owner.
    const role = input.role === "owner" ? ("owner" as const) : ("student" as const);
    const created: User = {
      id: nextId("user"),
      hostelId: "",
      name,
      phone,
      email: input.email?.trim() || undefined,
      role,
      gender: input.gender,
      avatarSeed: input.avatarSeed || name,
      address: input.address,
      ...(role === "student"
        ? {
            studentId: input.studentId?.trim() || undefined,
            department: input.department?.trim() || undefined,
          }
        : { ownedHostelIds: [] }),
    };
    store.data.users.push(created);
    store.data.passwordHashes[created.id] = hashPassword(password);
    store.emit("users:");
    emitUser(created.id);
    return created;
  },
  async updateUser(userId, patch) {
    // Self-service profile edit ONLY — never another account's, and never a
    // sensitive field (role, banned, hostelId, ownedHostelIds, advanceHeld,
    // …). Those go through their own dedicated, properly-authorized methods
    // (setBanned, remove, rate, setServicePermissions, hostels.assignManager,
    // hostels.create's automatic ownedHostelIds update, …). Reachable by ANY
    // signed-in user (no policy.ts entry needed) precisely because it's
    // this narrow — every role legitimately edits its own profile.
    if (actingUser?.id !== userId) {
      throw new Error("You can only edit your own account.");
    }
    const ALLOWED_KEYS = [
      "name", "phone", "email", "address", "studentId", "department",
      "notificationPrefs", "avatarSeed", "avatarImage", "gender",
    ] as const;
    const safePatch: Partial<User> = {};
    for (const key of ALLOWED_KEYS) {
      if (key in patch) (safePatch as Record<string, unknown>)[key] = patch[key];
    }
    if (safePatch.phone !== undefined) {
      const target = normalizePhone(safePatch.phone);
      if (store.data.users.some((u) => u.id !== userId && normalizePhone(u.phone) === target)) {
        throw new Error("Another account already uses this phone number.");
      }
    }
    const idx = store.data.users.findIndex((x) => x.id === userId);
    if (idx === -1) return;
    // Replace with a new object (not Object.assign-in-place) so subscribers
    // keyed on reference equality — e.g. SessionProvider mirroring the
    // logged-in user's own record — actually see the change.
    const updated = { ...store.data.users[idx], ...safePatch };
    store.data.users[idx] = updated;
    store.emit(`users:${updated.hostelId}`);
    emitUser(userId);
  },
  async setServicePermissions(userId, permissions) {
    const idx = store.data.users.findIndex((u) => u.id === userId);
    if (idx === -1) return;
    store.data.users[idx] = {
      ...store.data.users[idx],
      serviceKinds: permissions.kinds,
      serviceAreas: permissions.areas,
    };
    emitUser(userId);
  },
  async setBanned(userId, banned) {
    const idx = store.data.users.findIndex((x) => x.id === userId);
    if (idx === -1) return;
    const user = store.data.users[idx];
    if (banned) {
      // Evict from their room seat and turn meals off, but keep the record so
      // the member can still transfer to another hostel.
      store.data.rooms.forEach((r) => {
        if (r.occupantIds.includes(userId)) {
          r.occupantIds = r.occupantIds.filter((id) => id !== userId);
        }
      });
      store.data.users[idx] = { ...user, banned: true, mealsSuspended: true, roomId: undefined };
    } else {
      store.data.users[idx] = { ...user, banned: false };
    }
    logActivity(user.hostelId, banned ? "Member banned" : "Member un-banned", user.name);
    store.emit(`users:${user.hostelId}`);
    store.emit(`rooms:${user.hostelId}`);
    emitUser(userId);
  },
  async remove(userId) {
    const user = store.data.users.find((u) => u.id === userId);
    if (!user) return;
    store.data.rooms.forEach((r) => {
      if (r.occupantIds.includes(userId)) {
        r.occupantIds = r.occupantIds.filter((id) => id !== userId);
      }
    });
    store.data.users = store.data.users.filter((u) => u.id !== userId);
    delete store.data.passwordHashes[userId];
    logActivity(user.hostelId, "Member removed", user.name);
    store.emit(`users:${user.hostelId}`);
    store.emit(`rooms:${user.hostelId}`);
  },
  async rate(userId, stars, note) {
    const idx = store.data.users.findIndex((x) => x.id === userId);
    if (idx === -1) return;
    store.data.users[idx] = {
      ...store.data.users[idx],
      managerRating: stars,
      managerRatingNote: note,
    };
    store.emit(`users:${store.data.users[idx].hostelId}`);
  },
  async attachToHostel(userId, hostelId, roomId) {
    const idx = store.data.users.findIndex((u) => u.id === userId);
    if (idx === -1) throw new Error("No member account found for this code.");
    const user = store.data.users[idx];
    if (!isHostelMember(user.role) || user.role === "cook") {
      throw new Error(`${user.name} is ${user.role} staff, not a boarder account.`);
    }
    // THE one-hostel rule: an account that already belongs to a different
    // hostel can never be attached here — moving goes through transfers.
    if (user.hostelId && user.hostelId !== hostelId) {
      const other = store.data.hostels.find((h) => h.id === user.hostelId);
      throw new Error(
        `${user.name} is already a member of ${other?.name ?? "another hostel"} — a member can only belong to one hostel. Use a hostel transfer instead.`
      );
    }
    const room = store.data.rooms.find((r) => r.id === roomId && r.hostelId === hostelId);
    if (!room) throw new Error("Room not found in this hostel.");
    if (!room.occupantIds.includes(userId) && room.occupantIds.length >= room.capacity) {
      throw new Error(`Room ${room.number} is full.`);
    }

    const alreadyMember = user.hostelId === hostelId;
    store.data.rooms.forEach((r) => {
      if (r.occupantIds.includes(userId)) {
        r.occupantIds = r.occupantIds.filter((x) => x !== userId);
        store.emit(`rooms:${r.hostelId}`);
      }
    });
    room.occupantIds.push(userId);
    store.data.users[idx] = {
      ...user,
      hostelId,
      roomId,
      joinedAt: alreadyMember ? user.joinedAt : new Date().toISOString().slice(0, 10),
    };
    // Any pending join requests are settled by this attachment: this
    // hostel's approved, every other hostel's denied.
    store.data.joinRequests.forEach((r) => {
      if (r.userId === userId && r.status === "pending") {
        r.status = r.hostelId === hostelId ? "approved" : "denied";
        store.emit(`joinRequests:${r.hostelId}`);
      }
    });
    store.data.notifications.push({
      id: nextId("notif"),
      userId,
      title: alreadyMember ? "Room changed" : "Welcome to your hostel",
      body: alreadyMember
        ? `You've been moved to Room ${room.number}.`
        : `You're now a member — Room ${room.number} is yours. Your hostel dashboard is ready.`,
      read: false,
      createdAt: new Date().toISOString(),
    });
    store.emit(`notifications:${userId}`);
    logActivity(
      hostelId,
      alreadyMember ? "Member room changed" : "Member added (QR scan)",
      `${user.name} → Room ${room.number}`
    );
    store.emit(`users:${hostelId}`);
    store.emit(`rooms:${hostelId}`);
    emitUser(userId);
  },
  subscribe(hostelId, cb) {
    const fire = () =>
      cb(store.data.users.filter((u) => u.hostelId === hostelId && isHostelMember(u.role)));
    fire();
    return store.on(`users:${hostelId}`, fire);
  },
  subscribeUser(userId, cb) {
    const fire = () => {
      const u = store.data.users.find((x) => x.id === userId);
      if (u) cb(u);
    };
    fire();
    return store.on(`user-rec:${userId}`, fire);
  },
};

/**
 * Verifies a phone+password login. Deliberately NOT a method on `users`
 * (UserRepository) — that object is dispatchable by name over /api/rpc for
 * any signed-in session, and a password check reachable that way would let
 * one logged-in account brute-force another's password over the API. This
 * is imported directly by the /api/auth route only, the same way the
 * MySQL backend's equivalent (mysql/core.ts verifyUserPassword) is.
 */
export function verifyPassword(phone: string, password: string): User | undefined {
  const target = normalizePhone(phone);
  if (!target || !password) return undefined;
  const user = store.data.users.find((u) => normalizePhone(u.phone) === target);
  if (!user) return undefined;
  const hash = store.data.passwordHashes[user.id];
  if (!hash || !verifyPasswordHash(password, hash)) return undefined;
  return user;
}

/** Verifies a password against ONE known account id (change-own-password). */
export function verifyPasswordById(userId: string, password: string): boolean {
  if (!password) return false;
  const hash = store.data.passwordHashes[userId];
  return !!(hash && verifyPasswordHash(password, hash));
}

/** Sets a new password hash — authorization enforced by the /api/auth routes. */
export function setUserPassword(userId: string, newPassword: string): boolean {
  if (!store.data.users.some((u) => u.id === userId)) return false;
  store.data.passwordHashes[userId] = hashPassword(newPassword);
  store.emit(`user-rec:${userId}`);
  return true;
}

// ── Password-reset OTPs + SMTP settings (JSON backend storage) ─────────────
// Same primitives the MySQL backend exposes; db.ts holds the shared logic.

export function otpInsert(o: PasswordResetOtp): void {
  store.data.passwordResetOtps.push(o);
}
export function otpLatestActive(userId: string): PasswordResetOtp | undefined {
  return [...store.data.passwordResetOtps]
    .filter((o) => o.userId === userId && !o.consumedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}
export function otpCountSince(userId: string, sinceIso: string): number {
  return store.data.passwordResetOtps.filter((o) => o.userId === userId && o.createdAt >= sinceIso).length;
}
export function otpBumpAttempts(id: string): void {
  const o = store.data.passwordResetOtps.find((x) => x.id === id);
  if (o) o.attempts += 1;
}
export function otpConsume(id: string): void {
  const o = store.data.passwordResetOtps.find((x) => x.id === id);
  if (o) o.consumedAt = new Date().toISOString();
}
export function loadSmtp(): SmtpSettings | null {
  return store.data.smtpSettings;
}
export function saveSmtp(s: {
  host: string; port: number; secure: boolean; username: string;
  passwordEnc: string | null; fromEmail: string; fromName: string;
}): void {
  const prev = store.data.smtpSettings;
  store.data.smtpSettings = {
    host: s.host,
    port: s.port,
    secure: s.secure,
    username: s.username,
    password: s.passwordEnc === null ? prev?.password ?? "" : s.passwordEnc,
    fromEmail: s.fromEmail,
    fromName: s.fromName,
  };
}

const rooms: RoomRepository = {
  async listByHostel(hostelId) {
    return store.data.rooms.filter((r) => r.hostelId === hostelId);
  },
  async assignMember(roomId, userId) {
    const room = store.data.rooms.find((r) => r.id === roomId);
    if (!room) return;
    store.data.rooms.forEach((r) => {
      r.occupantIds = r.occupantIds.filter((id) => id !== userId);
    });
    room.occupantIds.push(userId);
    const uidx = store.data.users.findIndex((u) => u.id === userId);
    if (uidx !== -1) {
      store.data.users[uidx] = { ...store.data.users[uidx], roomId };
    }
    store.emit(`rooms:${room.hostelId}`);
    store.emit(`users:${room.hostelId}`);
    emitUser(userId);
  },
  async vacate(userId) {
    const user = store.data.users.find((u) => u.id === userId);
    if (!user) return;
    store.data.rooms.forEach((r) => {
      if (r.occupantIds.includes(userId)) {
        r.occupantIds = r.occupantIds.filter((id) => id !== userId);
      }
    });
    const uidx = store.data.users.findIndex((u) => u.id === userId);
    if (uidx !== -1) {
      store.data.users[uidx] = { ...store.data.users[uidx], roomId: undefined };
    }
    store.emit(`rooms:${user.hostelId}`);
    store.emit(`users:${user.hostelId}`);
    emitUser(userId);
  },
  async create(room) {
    store.data.rooms.push({ ...room, id: nextId("room"), occupantIds: [] });
    logActivity(room.hostelId, "Room added", `Room ${room.number} · ${room.capacity} seats`);
    store.emit(`rooms:${room.hostelId}`);
  },
  async update(roomId, patch) {
    const idx = store.data.rooms.findIndex((r) => r.id === roomId);
    if (idx === -1) return;
    const updated = { ...store.data.rooms[idx], ...patch };
    store.data.rooms[idx] = updated;
    logActivity(updated.hostelId, "Room updated", `Room ${updated.number}`);
    store.emit(`rooms:${updated.hostelId}`);
  },
  subscribe(hostelId, cb) {
    const fire = () => cb(store.data.rooms.filter((r) => r.hostelId === hostelId));
    fire();
    return store.on(`rooms:${hostelId}`, fire);
  },
};

const hostels: HostelRepository = {
  async getHostel(hostelId) {
    return store.data.hostels.find((h) => h.id === hostelId);
  },
  async listByOwner(ownerId) {
    return store.data.hostels.filter((h) => h.ownerId === ownerId);
  },
  async listAll() {
    return store.data.hostels;
  },
  async create(hostel) {
    const created = { ...hostel, id: nextId("hostel") };
    store.data.hostels.push(created);
    // Mirrors the MySQL backend, where ownedHostelIds is always DERIVED from
    // hostels.owner_id — the owner sees their new hostel immediately, with no
    // separate client-side users.updateUser call needed (that method is now
    // self-service-fields-only and wouldn't accept ownedHostelIds anyway).
    const ownerIdx = store.data.users.findIndex((u) => u.id === hostel.ownerId);
    if (ownerIdx !== -1) {
      const owner = store.data.users[ownerIdx];
      if (!(owner.ownedHostelIds ?? []).includes(created.id)) {
        store.data.users[ownerIdx] = {
          ...owner,
          ownedHostelIds: [...(owner.ownedHostelIds ?? []), created.id],
        };
        emitUser(owner.id);
      }
    }
    store.emit("hostels");
    return created;
  },
  async update(hostelId, patch) {
    const idx = store.data.hostels.findIndex((x) => x.id === hostelId);
    if (idx === -1) return;
    store.data.hostels[idx] = { ...store.data.hostels[idx], ...patch };
    if ("managerId" in patch || "cookId" in patch) {
      logActivity(hostelId, "Staff assignment changed");
    }
    if ("mealRate" in patch) {
      logActivity(hostelId, "Meal rate updated", `৳${patch.mealRate}/meal`);
    }
    store.emit(`hostel:${hostelId}`);
    store.emit("hostels");
  },
  async changeManager(hostelId, newManagerId) {
    const hIdx = store.data.hostels.findIndex((h) => h.id === hostelId);
    if (hIdx === -1) throw new Error("Hostel not found.");
    const hostel = store.data.hostels[hIdx];
    const next = store.data.users.find((u) => u.id === newManagerId);
    if (!next) throw new Error("Member not found.");
    if (next.hostelId !== hostelId || !isHostelMember(next.role)) {
      throw new Error(`${next.name} isn't a member of this hostel.`);
    }
    if (next.role === "cook") throw new Error("The cook can't be made manager.");
    if (next.banned) throw new Error(`${next.name} is banned — un-ban them first.`);
    if (hostel.managerId === newManagerId) return;

    const prevManagerId = hostel.managerId;
    // Demote the outgoing manager to a regular boarder — they keep their room
    // seat and meals, just lose manager access.
    const prevIdx = store.data.users.findIndex((u) => u.id === prevManagerId);
    if (prevIdx !== -1 && store.data.users[prevIdx].role === "manager") {
      store.data.users[prevIdx] = { ...store.data.users[prevIdx], role: "student" };
      store.data.notifications.push({
        id: nextId("notif"),
        userId: prevManagerId,
        title: "Manager role handed over",
        body: `You're now a regular boarder of ${hostel.name}. ${next.name} is the new manager.`,
        read: false,
        createdAt: new Date().toISOString(),
      });
      store.emit(`notifications:${prevManagerId}`);
      emitUser(prevManagerId);
    }

    // Promote the new manager.
    const nextIdx = store.data.users.findIndex((u) => u.id === newManagerId);
    store.data.users[nextIdx] = { ...store.data.users[nextIdx], role: "manager" };
    store.data.hostels[hIdx] = { ...hostel, managerId: newManagerId };
    store.data.notifications.push({
      id: nextId("notif"),
      userId: newManagerId,
      title: "You're the hostel manager",
      body: `You've been made the manager of ${hostel.name}.`,
      read: false,
      createdAt: new Date().toISOString(),
    });

    // Keep the owner informed — a manager can hand the role over with the
    // assignManager permission, and the owner would otherwise learn nothing.
    if (actingUser?.id !== hostel.ownerId) {
      store.data.notifications.push({
        id: nextId("notif"),
        userId: hostel.ownerId,
        title: "Hostel manager changed",
        body: `${next.name} is now the manager of ${hostel.name}${actingUser ? ` (changed by ${actingUser.name})` : ""}.`,
        read: false,
        createdAt: new Date().toISOString(),
      });
      store.emit(`notifications:${hostel.ownerId}`);
      emitUser(hostel.ownerId);
    }
    logActivity(hostelId, "Manager changed", next.name);
    store.emit(`notifications:${newManagerId}`);
    store.emit(`users:${hostelId}`);
    store.emit(`hostel:${hostelId}`);
    store.emit("hostels");
    emitUser(newManagerId);
  },
  async demoteManager(hostelId) {
    const hIdx = store.data.hostels.findIndex((h) => h.id === hostelId);
    if (hIdx === -1) throw new Error("Hostel not found.");
    const hostel = store.data.hostels[hIdx];
    const prevManagerId = hostel.managerId;
    if (!prevManagerId) return; // already manager-less
    const prevIdx = store.data.users.findIndex((u) => u.id === prevManagerId);
    const prevName = prevIdx !== -1 ? store.data.users[prevIdx].name : undefined;
    if (prevIdx !== -1 && store.data.users[prevIdx].role === "manager") {
      store.data.users[prevIdx] = { ...store.data.users[prevIdx], role: "student" };
      store.data.notifications.push({
        id: nextId("notif"),
        userId: prevManagerId,
        title: "Manager role removed",
        body: `The owner has removed your manager role at ${hostel.name}. You're now a regular boarder (your room and meals are unchanged).`,
        read: false,
        createdAt: new Date().toISOString(),
      });
      store.emit(`notifications:${prevManagerId}`);
      emitUser(prevManagerId);
    }
    store.data.hostels[hIdx] = { ...hostel, managerId: "" };
    if (actingUser?.id !== hostel.ownerId) {
      store.data.notifications.push({
        id: nextId("notif"),
        userId: hostel.ownerId,
        title: "Hostel manager removed",
        body: `${prevName ?? "The manager"} is no longer the manager of ${hostel.name}${actingUser ? ` (removed by ${actingUser.name})` : ""}.`,
        read: false,
        createdAt: new Date().toISOString(),
      });
      store.emit(`notifications:${hostel.ownerId}`);
      emitUser(hostel.ownerId);
    }
    logActivity(hostelId, "Manager removed", prevName);
    store.emit(`users:${hostelId}`);
    store.emit(`hostel:${hostelId}`);
    store.emit("hostels");
  },
  async assignManager(hostelId, manager) {
    const hIdx = store.data.hostels.findIndex((h) => h.id === hostelId);
    if (hIdx === -1) throw new Error("Hostel not found.");
    const hostel = store.data.hostels[hIdx];

    let newManagerId: string;
    let newManagerName: string;
    if (manager.mode === "new") {
      const name = manager.name.trim();
      const phone = manager.phone.trim();
      if (!name || !phone) throw new Error("Name and phone number are required.");
      const target = normalizePhone(phone);
      if (store.data.users.some((u) => normalizePhone(u.phone) === target)) {
        throw new Error(PHONE_TAKEN_MESSAGE);
      }
      const created: User = {
        id: nextId("user"),
        hostelId,
        name,
        phone,
        role: "manager",
        avatarSeed: `manager-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        joinedAt: today(),
      };
      store.data.users.push(created);
      store.data.passwordHashes[created.id] = hashPassword(target);
      newManagerId = created.id;
      newManagerName = name;
    } else {
      const target = store.data.users.find((u) => u.id === manager.userId);
      if (!target) throw new Error("Account not found.");
      if (target.banned) throw new Error(`${target.name} is banned — un-ban them first.`);
      if (!isHostelMember(target.role) || target.role === "cook") {
        throw new Error(`${target.name} can't be made manager (they're ${target.role}).`);
      }
      if (target.hostelId && target.hostelId !== hostelId) {
        const other = store.data.hostels.find((h) => h.id === target.hostelId);
        throw new Error(
          `${target.name} is already a member of ${other?.name ?? "another hostel"} — a member can only belong to one hostel.`
        );
      }
      const idx = store.data.users.findIndex((u) => u.id === target.id);
      store.data.users[idx] = {
        ...store.data.users[idx],
        role: "manager",
        hostelId,
        joinedAt: store.data.users[idx].joinedAt ?? today(),
      };
      newManagerId = target.id;
      newManagerName = target.name;
      emitUser(newManagerId);
    }

    if (hostel.managerId === newManagerId) return;

    // Demote the outgoing manager.
    if (hostel.managerId) {
      const prevIdx = store.data.users.findIndex((u) => u.id === hostel.managerId);
      if (prevIdx !== -1 && store.data.users[prevIdx].role === "manager") {
        const prevId = store.data.users[prevIdx].id;
        store.data.users[prevIdx] = { ...store.data.users[prevIdx], role: "student" };
        store.data.notifications.push({
          id: nextId("notif"),
          userId: prevId,
          title: "Manager role handed over",
          body: `You're now a regular boarder of ${hostel.name}. ${newManagerName} is the new manager.`,
          read: false,
          createdAt: new Date().toISOString(),
        });
        store.emit(`notifications:${prevId}`);
        emitUser(prevId);
      }
    }
    store.data.hostels[hIdx] = { ...store.data.hostels[hIdx], managerId: newManagerId };
    store.data.notifications.push({
      id: nextId("notif"),
      userId: newManagerId,
      title: "You're the hostel manager",
      body: `You've been made the manager of ${hostel.name}.`,
      read: false,
      createdAt: new Date().toISOString(),
    });
    store.emit(`notifications:${newManagerId}`);
    if (actingUser?.id !== hostel.ownerId) {
      store.data.notifications.push({
        id: nextId("notif"),
        userId: hostel.ownerId,
        title: "Hostel manager changed",
        body: `${newManagerName} is now the manager of ${hostel.name}${actingUser ? ` (changed by ${actingUser.name})` : ""}.`,
        read: false,
        createdAt: new Date().toISOString(),
      });
      store.emit(`notifications:${hostel.ownerId}`);
      emitUser(hostel.ownerId);
    }
    logActivity(hostelId, manager.mode === "new" ? "Manager account created" : "Manager assigned", newManagerName);
    store.emit(`users:${hostelId}`);
    store.emit(`hostel:${hostelId}`);
    store.emit("hostels");
    emitUser(newManagerId);
  },
  async assignCook(hostelId, cook) {
    const hIdx = store.data.hostels.findIndex((h) => h.id === hostelId);
    if (hIdx === -1) throw new Error("Hostel not found.");
    const hostel = store.data.hostels[hIdx];

    // Detach whoever's currently the cook — their account and "cook" role
    // are kept (so they can be reassigned elsewhere), just no longer
    // referenced by this hostel.
    const prevCookId = hostel.cookId || null;
    if (prevCookId) {
      const idx = store.data.users.findIndex((u) => u.id === prevCookId);
      if (idx !== -1) {
        store.data.users[idx] = { ...store.data.users[idx], hostelId: "", roomId: undefined };
        emitUser(prevCookId);
      }
    }

    let newCookId: string | undefined;
    let newCookName = "";
    if (cook.mode === "new") {
      const name = cook.name.trim();
      const phone = cook.phone.trim();
      if (!name || !phone) throw new Error("Name and phone number are required.");
      const target = normalizePhone(phone);
      if (store.data.users.some((u) => normalizePhone(u.phone) === target)) {
        throw new Error(PHONE_TAKEN_MESSAGE);
      }
      const created: User = {
        id: nextId("user"),
        hostelId,
        name,
        phone,
        role: "cook",
        avatarSeed: `cook-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      };
      store.data.users.push(created);
      store.data.passwordHashes[created.id] = hashPassword(target);
      newCookId = created.id;
      newCookName = name;
    } else if (cook.mode === "existing") {
      const target = store.data.users.find((u) => u.id === cook.userId);
      if (!target) throw new Error("Member not found.");
      if (target.role !== "cook") throw new Error(`${target.name} isn't a cook account.`);
      if (target.hostelId && target.hostelId !== hostelId) {
        throw new Error(`${target.name} is already staffing another hostel — remove them there first.`);
      }
      const idx = store.data.users.findIndex((u) => u.id === target.id);
      store.data.users[idx] = { ...store.data.users[idx], hostelId };
      newCookId = target.id;
      newCookName = target.name;
    }
    // mode "remove": newCookId stays undefined.

    store.data.hostels[hIdx] = {
      ...store.data.hostels[hIdx],
      cookId: newCookId,
      cookMonthlySalary:
        cook.mode === "remove"
          ? undefined
          : cook.salary !== undefined && cook.salary > 0
            ? cook.salary
            : store.data.hostels[hIdx].cookMonthlySalary,
    };

    if (prevCookId && prevCookId !== newCookId) {
      store.data.notifications.push({
        id: nextId("notif"),
        userId: prevCookId,
        title: "No longer the hostel cook",
        body: `You've been removed as ${hostel.name}'s cook.`,
        read: false,
        createdAt: new Date().toISOString(),
      });
      store.emit(`notifications:${prevCookId}`);
    }
    if (newCookId && newCookId !== prevCookId) {
      store.data.notifications.push({
        id: nextId("notif"),
        userId: newCookId,
        title: "You're the hostel cook",
        body: `You've been made the cook of ${hostel.name}.`,
        read: false,
        createdAt: new Date().toISOString(),
      });
      store.emit(`notifications:${newCookId}`);
      emitUser(newCookId);
    }

    logActivity(hostelId, cook.mode === "remove" ? "Cook removed" : "Cook changed", newCookName || undefined);
    store.emit(`users:${hostelId}`);
    store.emit(`hostel:${hostelId}`);
    store.emit("hostels");
  },
  async updateSettings(hostelId, patch) {
    const idx = store.data.hostels.findIndex((x) => x.id === hostelId);
    if (idx === -1) return;
    // Replace the hostel object (not mutate in place) — subscribers hand the
    // record straight to React setState, which bails out on identical refs.
    const h = store.data.hostels[idx];
    store.data.hostels[idx] = { ...h, settings: { ...h.settings, ...patch } };
    if ("managerPermissions" in patch) {
      logActivity(hostelId, "Manager permissions changed");
    }
    if ("serviceChargeMonthly" in patch) {
      logActivity(hostelId, "Service charge updated", `৳${patch.serviceChargeMonthly}/month per boarder`);
    }
    store.emit(`hostel:${hostelId}`);
  },
  async setMealOffered(hostelId, meal, offered) {
    const idx = store.data.hostels.findIndex((x) => x.id === hostelId);
    if (idx === -1) return;
    const h = store.data.hostels[idx];
    store.data.hostels[idx] = {
      ...h,
      settings: {
        ...h.settings,
        mealsOffered: { ...h.settings.mealsOffered, [meal]: offered },
      },
    };
    // Takes effect from TODAY onward, matching the MySQL backend: the offer is
    // re-pinned on today and every future day on record, and closing zeroes
    // today's count for the slot (incl. guests — nothing is cooked). Past days
    // are never touched, so their accounts stay correct.
    const from = today();
    store.data.mealDays = store.data.mealDays.map((d) => {
      if (d.hostelId !== hostelId || d.date < from) return d;
      const base = d.mealsOffered ?? {
        breakfast: h.settings.mealsOffered?.breakfast ?? true,
        lunch: h.settings.mealsOffered?.lunch ?? true,
        dinner: h.settings.mealsOffered?.dinner ?? true,
      };
      const mealsOffered = { ...base, [meal]: offered };
      if (offered) return { ...d, mealsOffered };
      const entries = Object.fromEntries(
        Object.entries(d.entries).map(([uid, e]) => [
          uid,
          { ...e, [meal]: { on: false, guestCount: 0 } },
        ])
      );
      return { ...d, mealsOffered, entries };
    });
    // Reopening re-pins the offer only — future days default on again for new
    // entries, and members switch existing days back on themselves.
    logActivity(hostelId, offered ? "Meal opened (master)" : "Meal closed (master)", meal);
    store.emit(`hostel:${hostelId}`);
    store.emit("hostels");
    store.emit(`mealDay:${hostelId}`);
  },
  async setSuspended(hostelId, suspended) {
    const idx = store.data.hostels.findIndex((x) => x.id === hostelId);
    if (idx === -1) return;
    store.data.hostels[idx] = { ...store.data.hostels[idx], suspended };
    store.emit(`hostel:${hostelId}`);
    store.emit("hostels");
  },
  async setVerified(hostelId, verified) {
    const idx = store.data.hostels.findIndex((x) => x.id === hostelId);
    if (idx === -1) return;
    store.data.hostels[idx] = { ...store.data.hostels[idx], verified };
    logActivity(hostelId, verified ? "Hostel verified" : "Hostel verification removed");
    store.emit(`hostel:${hostelId}`);
    store.emit("hostels");
  },
  subscribe(hostelId, cb) {
    const fire = () => {
      const h = store.data.hostels.find((x) => x.id === hostelId);
      if (h) cb(h);
    };
    fire();
    return store.on(`hostel:${hostelId}`, fire);
  },
  subscribeAll(cb) {
    const fire = () => cb(store.data.hostels);
    fire();
    return store.on("hostels", fire);
  },
};

const meals: MealRepository = {
  async getActualMealRate(hostelId, month) {
    sealMockDays(hostelId, `${month}-01`, `${month}-31`);
    return actualMealRateFor(hostelId, month);
  },
  async getMemberMealSummary(hostelId, userId, month) {
    sealMockDays(hostelId, `${month}-01`, `${month}-31`);
    const joinedDay = store.data.users.find((u) => u.id === userId)?.joinedAt?.slice(0, 10);
    const to = today();
    let mealsOn = 0;
    let billedMeals = 0;
    for (const day of store.data.mealDays) {
      if (day.hostelId !== hostelId || !day.date.startsWith(month)) continue;
      if (joinedDay && joinedDay > day.date) continue; // before they joined
      if (day.date > to) continue; // future days haven't happened / been cooked
      const entry = day.entries[userId];
      if (!entry) continue;
      for (const slot of ["breakfast", "lunch", "dinner"] as const) {
        const count = (entry[slot].on ? 1 : 0) + entry[slot].guestCount;
        mealsOn += count;
        if (isMealConfirmedCooked(hostelId, day.date, slot)) billedMeals += count;
      }
    }
    const { rate } = actualMealRateFor(hostelId, month);
    return { mealsOn, billedMeals, cost: Math.round(billedMeals * rate * 100) / 100 };
  },
  async getMealDay(hostelId, date) {
    sealMockDays(hostelId, date, date);
    return store.data.mealDays.find((d) => d.hostelId === hostelId && d.date === date) ?? emptyMealDay(hostelId, date);
  },
  async listMealDays(hostelId, range) {
    sealMockDays(hostelId, range.from, range.to);
    return store.data.mealDays.filter(
      (d) => d.hostelId === hostelId && d.date >= range.from && d.date <= range.to
    );
  },
  async setMemberMealToggle(hostelId, userId, date, meal, on) {
    // Same cutoff rule the server and UI use: today and anything past its
    // cutoff needs an approved request, not a direct toggle.
    const hostel = store.data.hostels.find((h) => h.id === hostelId);
    const decision = canToggleMeal(date, hostel?.settings.mealToggleCutoff);
    if (!decision.allowed) throw new Error(decision.message ?? "This meal can no longer be changed.");
    // A slot the hostel doesn't offer can never be turned on.
    if (on && !isMealOffered(hostelId, meal)) return;
    const day = ensureMealDay(hostelId, date);
    const entry = ensureMealEntry(day, userId);
    entry[meal].on = on;
    store.emit(`mealDay:${hostelId}`);
  },
  /** Approved change applied by a manager/owner — bypasses the member cutoff. */
  async setMemberMealApproved(hostelId, userId, date, meal, on) {
    if (on && !isMealOffered(hostelId, meal)) return;
    const day = ensureMealDay(hostelId, date);
    const entry = ensureMealEntry(day, userId);
    entry[meal].on = on;
    store.emit(`mealDay:${hostelId}`);
  },
  /** Staff can add/reduce any member's guest meals on any date. A member can
   * do the same for THEMSELVES, but only while it's still before their own
   * meal-toggle cutoff (see setMemberMealToggle) — the same cutoff rule
   * that gates their own on/off toggles, since a guest meal has the same
   * billing impact. Past the cutoff, self-service is blocked; they go
   * through guestMeals.request for manager approval instead. */
  async addGuestMeal(hostelId, userId, date, meal, count) {
    const actor = store.data.users.find((u) => u.id === actingUser?.id);
    const isStaff = actor && (["manager", "owner", "superadmin"] as Role[]).includes(actor.role);
    if (!isStaff) {
      if (actingUser?.id !== userId) throw new Error("You can only add guest meals for yourself.");
      const hostel = store.data.hostels.find((h) => h.id === hostelId);
      const decision = canToggleMeal(date, hostel?.settings.mealToggleCutoff);
      if (!decision.allowed) {
        throw new Error(decision.message ?? "This date can no longer be changed directly — send the manager a request.");
      }
    }
    if (!isMealOffered(hostelId, meal)) return;
    const day = ensureMealDay(hostelId, date);
    const entry = ensureMealEntry(day, userId);
    entry[meal].guestCount = Math.max(0, entry[meal].guestCount + count);
    const gname = store.data.users.find((u) => u.id === userId)?.name ?? "member";
    logActivity(
      hostelId,
      count >= 0 ? "Guest meal added" : "Guest meal removed",
      `${Math.abs(count)} × ${meal} · ${date} · ${gname}`,
      "meal"
    );
    store.emit(`mealDay:${hostelId}`);
  },
  async setMemberMealsForRange(hostelId, userId, from, to, on) {
    const slots: MealSlot[] = ["breakfast", "lunch", "dinner"];
    let d = from;
    while (d <= to) {
      const day = ensureMealDay(hostelId, d);
      const entry = ensureMealEntry(day, userId);
      // Resuming meals must not switch on slots the hostel has closed.
      for (const slot of slots) entry[slot].on = on && isMealOffered(hostelId, slot);
      const next = new Date(`${d}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      d = next.toISOString().slice(0, 10);
    }

    const idx = store.data.users.findIndex((u) => u.id === userId);
    if (idx !== -1) {
      const updated = { ...store.data.users[idx], mealsSuspended: !on };
      store.data.users[idx] = updated;
      store.data.notifications.push({
        id: nextId("notif"),
        userId,
        title: on ? "Meals resumed" : "Meals turned off",
        body: on
          ? "Your meals have been turned back on by the manager."
          : "Your meals have been turned off by the manager because your bill is unpaid. Pay your bill to resume your meals.",
        read: false,
        createdAt: new Date().toISOString(),
      });
      store.emit(`users:${updated.hostelId}`);
      store.emit(`notifications:${userId}`);
      emitUser(userId);
    }
    const mmName = store.data.users.find((u) => u.id === userId)?.name ?? "member";
    logActivity(
      hostelId,
      on ? "Meals resumed for member" : "Meals turned off for member",
      `${mmName} · ${from} → ${to}`,
      "meal"
    );
    store.emit(`mealDay:${hostelId}`);
  },
  async setMemberFutureMeals(hostelId, userId, meal, off) {
    const idx = store.data.users.findIndex((u) => u.id === userId);
    if (idx !== -1) {
      store.data.users[idx] = {
        ...store.data.users[idx],
        futureMealsOff: { ...store.data.users[idx].futureMealsOff, [meal]: off },
      };
      emitUser(userId);
      store.emit(`users:${hostelId}`);
    }
    // Apply now to every future day the member can still change: tomorrow if
    // it's still before tonight's cutoff, otherwise the day after. Today is
    // never touched; unmaterialised days inherit the new default when sealed.
    // Only THIS slot is touched — the other two keep whatever they already had.
    const cutoff = store.data.hostels.find((h) => h.id === hostelId)?.settings.mealToggleCutoff;
    const tomorrow = addDays(today(), 1);
    const fromDay = canToggleMeal(tomorrow, cutoff).allowed ? tomorrow : addDays(today(), 2);
    store.data.mealDays = store.data.mealDays.map((d) => {
      if (d.hostelId !== hostelId || d.date < fromDay || !d.entries[userId]) return d;
      const e = d.entries[userId];
      const offered = d.mealsOffered?.[meal] ?? isMealOffered(hostelId, meal);
      return {
        ...d,
        entries: {
          ...d.entries,
          [userId]: {
            ...e,
            // Turning future meals off also cancels any guest meals already
            // booked on those days — a member with no meal of their own has
            // no one there to cover a guest either.
            [meal]: { ...e[meal], on: off ? false : offered, guestCount: off ? 0 : e[meal].guestCount },
          },
        },
      };
    });
    store.emit(`mealDay:${hostelId}`);
  },
  subscribe(hostelId, cb) {
    // One hostel-wide topic (not per-date) so newly-created days are covered
    // too; the caller (hook) filters by date itself.
    const fire = () => {
      store.data.mealDays
        .filter((d) => d.hostelId === hostelId)
        .forEach((d) => cb(d));
    };
    fire();
    return store.on(`mealDay:${hostelId}`, fire);
  },
};

const menus: MenuRepository = {
  async getMenu(hostelId, date) {
    return store.data.menus.find((m) => m.hostelId === hostelId && m.date === date);
  },
  /** Staff can edit any day's menu. A member can too, but ONLY for a date
   * they're the assigned shopping-duty member for (per the live DutyPlan
   * rotation, not the day/anyone) — they're the one who bought the food, so
   * they know what's actually being cooked. */
  async saveMenu(hostelId, date, dishes) {
    const actorUser = store.data.users.find((u) => u.id === actingUser?.id);
    const isStaff = actorUser && (["manager", "owner", "superadmin"] as Role[]).includes(actorUser.role);
    if (!isStaff) {
      const onDuty = store.data.dutyPlans.some(
        (p) =>
          p.hostelId === hostelId &&
          p.type === "shopping" &&
          p.blocks.some((b) => b.userIds.includes(actingUser?.id ?? "") && b.dates.includes(date))
      );
      if (!onDuty) throw new Error("Only the manager or that day's shopping-duty member can edit the menu.");
    }
    let menu = store.data.menus.find((m) => m.hostelId === hostelId && m.date === date);
    if (!menu) {
      menu = { hostelId, date, dishes };
      store.data.menus.push(menu);
    } else {
      menu.dishes = dishes;
    }
    store.emit(`menu:${hostelId}`);
  },
  subscribe(hostelId, cb) {
    const fire = () =>
      store.data.menus.filter((m) => m.hostelId === hostelId).forEach((m) => cb(m));
    fire();
    return store.on(`menu:${hostelId}`, fire);
  },
};

const ratings: RatingRepository = {
  async listForDate(hostelId, date) {
    return store.data.ratings.filter((r) => r.hostelId === hostelId && r.date === date);
  },
  async listByHostel(hostelId) {
    return store.data.ratings.filter((r) => r.hostelId === hostelId);
  },
  async rate(rating) {
    const existing = store.data.ratings.find(
      (r) =>
        r.hostelId === rating.hostelId &&
        r.date === rating.date &&
        r.meal === rating.meal &&
        r.target === rating.target &&
        r.userId === rating.userId
    );
    if (existing) {
      existing.stars = rating.stars;
    } else {
      store.data.ratings.push({ ...rating, id: nextId("rating") });
    }
    store.emit(`ratings:${rating.hostelId}`);
  },
  subscribe(hostelId, cb) {
    const fire = () => cb(store.data.ratings.filter((r) => r.hostelId === hostelId));
    fire();
    return store.on(`ratings:${hostelId}`, fire);
  },
};

const comments: CommentRepository = {
  async listForDate(hostelId, date) {
    return store.data.comments.filter((c) => c.hostelId === hostelId && c.date === date);
  },
  async addComment(comment) {
    store.data.comments.push({
      ...comment,
      id: nextId("comment"),
      createdAt: new Date().toISOString(),
    });
    store.emit(`comments:${comment.hostelId}`);
  },
  async listReactions(commentId) {
    return store.data.reactions.filter((r) => r.commentId === commentId);
  },
  async toggleReaction(commentId, userId, emoji) {
    const existing = store.data.reactions.find(
      (r) => r.commentId === commentId && r.userId === userId && r.emoji === emoji
    );
    if (existing) {
      store.data.reactions = store.data.reactions.filter((r) => r !== existing);
    } else {
      store.data.reactions.push({ id: nextId("reaction"), commentId, userId, emoji });
    }
    const comment = store.data.comments.find((c) => c.id === commentId);
    if (comment) store.emit(`comments:${comment.hostelId}`);
  },
  subscribe(hostelId, cb) {
    return store.on(`comments:${hostelId}`, cb);
  },
};

const duties: DutyRepository = {
  async listByHostel(hostelId) {
    return store.data.dutyPlans.filter((p) => p.hostelId === hostelId);
  },
  async createPlan(plan) {
    // A new rotation of the same type REPLACES any still-active one for this
    // hostel, so members never see a stale rotation and are re-prompted cleanly.
    store.data.dutyPlans = store.data.dutyPlans.filter(
      (p) => !(p.hostelId === plan.hostelId && p.type === plan.type && p.endDate >= plan.startDate)
    );
    const created = {
      ...plan,
      id: nextId("duty"),
      // Spin blocks start empty (members claim by spinning); keep any userIds
      // for pre-assigned cleaning duty.
      blocks: plan.blocks.map((b) => ({ ...b, userIds: [...b.userIds] })),
      spun: Object.fromEntries(plan.memberIds.map((id) => [id, false])),
      done: {},
      createdAt: new Date().toISOString(),
    };
    store.data.dutyPlans.push(created);
    if (created.requiresSpin) {
      store.data.announcements.push({
        id: nextId("ann"),
        hostelId: plan.hostelId,
        kind: "spin-wheel-cta",
        title: "Spin the wheel — shopping duty",
        body: "A new shopping duty rotation is ready. Spin to claim your dates.",
        payload: { planId: created.id },
        createdAt: new Date().toISOString(),
      });
      store.emit(`announcements:${plan.hostelId}`);
    }
    store.emit(`duties:${plan.hostelId}`);
    return created;
  },
  async spin(planId, userId) {
    const plan = store.data.dutyPlans.find((p) => p.id === planId);
    if (!plan) return -1;
    const groupSize = plan.groupSize ?? 1;
    const existingIdx = plan.blocks.findIndex((b) => b.userIds.includes(userId));
    if (existingIdx >= 0) {
      plan.spun[userId] = true;
      store.emit(`duties:${plan.hostelId}`);
      return existingIdx;
    }
    const openIdxs = plan.blocks
      .map((b, i) => (b.userIds.length < groupSize ? i : -1))
      .filter((i) => i >= 0);
    if (openIdxs.length === 0) return -1;
    const pick = openIdxs[Math.floor(Math.random() * openIdxs.length)];
    plan.blocks[pick].userIds.push(userId);
    plan.spun[userId] = true;
    store.emit(`duties:${plan.hostelId}`);
    return pick;
  },
  async markDone(planId, userId) {
    if (actingUser && actingUser.id !== userId) {
      throw new Error("You can only mark your own duty as done.");
    }
    const plan = store.data.dutyPlans.find((p) => p.id === planId);
    if (!plan) return;
    plan.done = { ...(plan.done ?? {}), [userId]: true };
    if (plan.type === "shopping") {
      logActivity(
        plan.hostelId,
        "Shopping duty completed",
        store.data.users.find((u) => u.id === userId)?.name ?? "member",
        "shopping"
      );
    }
    store.emit(`duties:${plan.hostelId}`);
  },
  subscribe(hostelId, cb) {
    const fire = () => cb(store.data.dutyPlans.filter((p) => p.hostelId === hostelId));
    fire();
    return store.on(`duties:${hostelId}`, fire);
  },
};

const swaps: SwapRepository = {
  async listByPlan(planId) {
    return store.data.swapRequests.filter((s) => s.planId === planId);
  },
  async request(swap) {
    const id = nextId("swap");
    store.data.swapRequests.push({
      ...swap,
      id,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    store.data.announcements.push({
      id: nextId("ann"),
      hostelId: swap.hostelId,
      kind: "swap-request",
      title: "Shopping duty swap requested",
      body: "A member wants to swap shopping duty dates with you.",
      // swapId lets the recipient's home banner drop this once it's
      // resolved — see hooks/useActionableAnnouncements.ts.
      payload: { swapId: id, fromUserId: swap.fromUserId, toUserId: swap.toUserId },
      createdAt: new Date().toISOString(),
    });
    store.emit(`swaps:${swap.hostelId}`);
    store.emit(`announcements:${swap.hostelId}`);
  },
  async resolve(swapId, status) {
    const swap = store.data.swapRequests.find((s) => s.id === swapId);
    if (!swap) return;
    swap.status = status;
    if (status === "accepted") {
      const plan = store.data.dutyPlans.find((p) => p.id === swap.planId);
      if (plan) {
        const fromBlock = plan.blocks.find((b) => b.userIds.includes(swap.fromUserId));
        const toBlock = plan.blocks.find((b) => b.userIds.includes(swap.toUserId));
        if (fromBlock && toBlock) {
          const tmp = fromBlock.dates;
          fromBlock.dates = toBlock.dates;
          toBlock.dates = tmp;
        }
        store.emit(`duties:${plan.hostelId}`);
      }
    }
    store.emit(`swaps:${swap.hostelId}`);
  },
  subscribe(hostelId, cb) {
    const fire = () => cb(store.data.swapRequests.filter((s) => s.hostelId === hostelId));
    fire();
    return store.on(`swaps:${hostelId}`, fire);
  },
};

const shoppingCosts: ShoppingCostRepository = {
  async listByHostel(hostelId) {
    return store.data.shoppingCosts.filter((c) => c.hostelId === hostelId);
  },
  async submit(cost) {
    store.data.shoppingCosts.push({
      ...cost,
      id: nextId("shopcost"),
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    notifyHostelStaff(
      cost.hostelId,
      "Shopping cost to approve",
      `A member submitted a ৳${cost.amount} shopping cost for approval. Review it in Finance.`
    );
    logActivity(
      cost.hostelId,
      "Shopping cost submitted",
      `৳${cost.amount} by ${store.data.users.find((u) => u.id === cost.userId)?.name ?? "member"}`,
      "shopping"
    );
    store.emit(`shoppingCosts:${cost.hostelId}`);
  },
  async recordForMember(cost) {
    // Manager entered it — it's the member's cost, approved on entry, and
    // flagged so everyone can see it was recorded by the manager.
    store.data.shoppingCosts.push({
      ...cost,
      id: nextId("shopcost"),
      status: "approved",
      addedByManager: true,
      createdAt: new Date().toISOString(),
    });
    notifyUser(
      cost.userId,
      "Shopping cost recorded for you",
      `The manager recorded a ৳${cost.amount} shopping cost as yours. It counts toward this month's meal rate.`
    );
    logActivity(
      cost.hostelId,
      "Shopping cost recorded",
      `৳${cost.amount} for ${store.data.users.find((u) => u.id === cost.userId)?.name ?? "member"}`,
      "shopping"
    );
    store.emit(`shoppingCosts:${cost.hostelId}`);
  },
  async decide(id, status) {
    const cost = store.data.shoppingCosts.find((c) => c.id === id);
    if (!cost) return;
    cost.status = status;
    logActivity(
      cost.hostelId,
      status === "approved" ? "Shopping cost approved" : "Shopping cost denied",
      `৳${cost.amount} · ${store.data.users.find((u) => u.id === cost.userId)?.name ?? "member"}`,
      "shopping"
    );
    store.emit(`shoppingCosts:${cost.hostelId}`);
  },
};

const shoppingCostEdits: ShoppingCostEditRepository = {
  async listByHostel(hostelId) {
    return store.data.shoppingCostEditRequests.filter((r) => r.hostelId === hostelId);
  },
  async request(req) {
    const created: ShoppingCostEditRequest = {
      ...req,
      id: nextId("shopedit"),
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    store.data.shoppingCostEditRequests.push(created);
    const targetName = store.data.users.find((u) => u.id === req.targetUserId)?.name ?? "a member";
    store.data.announcements.push({
      id: nextId("ann"),
      hostelId: req.hostelId,
      kind: "shopping-cost-edit-poll",
      title: `Change ${targetName}’s shopping cost to ৳${req.newAmount}?`,
      body:
        `The manager wants to change ${targetName}’s recorded shopping cost from ৳${req.currentAmount} to ৳${req.newAmount}` +
        `${req.reason ? `. Reason: ${req.reason}` : ""}. Vote yes to allow — it changes this month’s meal rate for everyone.`,
      payload: { requestId: created.id, costId: req.costId, targetUserId: req.targetUserId },
      createdAt: new Date().toISOString(),
    });
    store.emit(`shoppingCostEdits:${req.hostelId}`);
    store.emit(`announcements:${req.hostelId}`);
  },
  async vote(requestId, userId, choice) {
    const existing = store.data.shoppingCostEditVotes.find(
      (v) => v.requestId === requestId && v.userId === userId
    );
    if (existing) {
      existing.choice = choice;
      existing.votedAt = new Date().toISOString();
    } else {
      store.data.shoppingCostEditVotes.push({ requestId, userId, choice, votedAt: new Date().toISOString() });
    }

    const request = store.data.shoppingCostEditRequests.find((r) => r.id === requestId);
    if (!request || request.status !== "pending") return;

    const boarders = store.data.users.filter(
      (u) => u.hostelId === request.hostelId && u.role !== "cook" && u.role !== "owner"
    );
    const yesVotes = store.data.shoppingCostEditVotes.filter(
      (v) => v.requestId === requestId && v.choice === "yes"
    ).length;
    if (boarders.length > 0 && yesVotes / boarders.length >= 0.5) {
      request.status = "approved";
      // Apply the approved change to the cost itself.
      const cost = store.data.shoppingCosts.find((c) => c.id === request.costId);
      if (cost) {
        cost.amount = request.newAmount;
        if (request.newItems !== undefined) cost.items = request.newItems;
        store.emit(`shoppingCosts:${request.hostelId}`);
      }
      const ann = store.data.announcements.find(
        (a) =>
          a.kind === "shopping-cost-edit-poll" &&
          (a.payload as { requestId?: string })?.requestId === requestId
      );
      if (ann) {
        ann.kind = "shopping-cost-edit-resolved";
        ann.title = "Shopping cost change approved";
        ann.body = `Members approved the change — the cost is now ৳${request.newAmount}.`;
      }
      notifyUser(
        request.targetUserId,
        "Your shopping cost was changed",
        `Members approved changing your recorded shopping cost to ৳${request.newAmount}.`
      );
    }
    store.emit(`shoppingCostEdits:${request.hostelId}`);
    store.emit(`announcements:${request.hostelId}`);
  },
  async listVotes(requestId) {
    return store.data.shoppingCostEditVotes.filter((v) => v.requestId === requestId);
  },
  async withdraw(requestId) {
    const request = store.data.shoppingCostEditRequests.find((r) => r.id === requestId);
    if (!request) return;
    store.data.shoppingCostEditRequests = store.data.shoppingCostEditRequests.filter(
      (r) => r.id !== requestId
    );
    store.emit(`shoppingCostEdits:${request.hostelId}`);
  },
  subscribe(hostelId, cb) {
    const fire = () => cb(store.data.shoppingCostEditRequests.filter((r) => r.hostelId === hostelId));
    fire();
    return store.on(`shoppingCostEdits:${hostelId}`, fire);
  },
};

const shortages: ShortageRepository = {
  async listByHostel(hostelId) {
    return store.data.shortageRequests.filter((s) => s.hostelId === hostelId);
  },
  async report(req) {
    const created = {
      ...req,
      id: nextId("shortage"),
      status: "pending" as const,
      createdAt: new Date().toISOString(),
    };
    store.data.shortageRequests.push(created);
    store.data.announcements.push({
      id: nextId("ann"),
      hostelId: req.hostelId,
      kind: "shortage-alert",
      title: "Shopping shortage reported",
      body: `The cook reported missing items: ${req.items}`,
      payload: { shortageId: created.id },
      createdAt: new Date().toISOString(),
    });
    store.emit(`shortages:${req.hostelId}`);
    store.emit(`announcements:${req.hostelId}`);
  },
  async resolve(id, resolvedBy) {
    const s = store.data.shortageRequests.find((x) => x.id === id);
    if (!s) return;
    s.status = "resolved";
    s.resolvedBy = resolvedBy;
    s.resolvedAt = new Date().toISOString();
    store.emit(`shortages:${s.hostelId}`);
  },
  subscribe(hostelId, cb) {
    const fire = () => cb(store.data.shortageRequests.filter((s) => s.hostelId === hostelId));
    fire();
    return store.on(`shortages:${hostelId}`, fire);
  },
};

/** How a payment amount settles the chosen targets — previous balance first,
 * then sections in a fixed order, each capped at its own due; any leftover
 * past every selected target's due becomes credit on the first target. Pure
 * computation, no side effects — callers decide when (or whether) to apply
 * it to the bill. */
function computePaymentBreakdown(
  bill: Bill,
  targets: BillTarget[],
  amount: number
): NonNullable<Payment["breakdown"]> {
  const breakdown: NonNullable<Payment["breakdown"]> = {};
  let remaining = amount;
  if (targets.includes("previousBalance")) {
    const due = bill.previousBalance - bill.previousBalancePaid;
    if (due > 0 && remaining > 0) {
      const applied = Math.min(remaining, due);
      breakdown.previousBalance = applied;
      remaining -= applied;
    }
  }
  const order: BillSection["label"][] = ["mealCost", "roomRent", "serviceCharge", "cookSalary"];
  for (const label of order) {
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

/** Applies an already-decided breakdown to a bill's paid amounts — the one
 * place money actually moves, used by both a manager verifying a member's
 * claim and a manager recording a cash payment directly. */
function applyPaymentBreakdown(bill: Bill, breakdown: NonNullable<Payment["breakdown"]>, amount: number): void {
  for (const [key, amt] of Object.entries(breakdown)) {
    if (key === "previousBalance") {
      bill.previousBalancePaid += amt as number;
    } else {
      const section = bill.sections.find((s) => s.label === key);
      if (section) section.paid += amt as number;
    }
  }
  bill.paid += amount;
}

const bills: BillRepository = {
  async getBill(hostelId, userId, month) {
    return store.data.bills.find(
      (b) => b.hostelId === hostelId && b.userId === userId && b.month === month
    );
  },
  async getLatestForUser(hostelId, userId) {
    return store.data.bills
      .filter((b) => b.hostelId === hostelId && b.userId === userId)
      .sort((a, b) => b.month.localeCompare(a.month))[0];
  },
  async listByHostel(hostelId, month) {
    return store.data.bills.filter((b) => b.hostelId === hostelId && b.month === month);
  },
  async listByUser(hostelId, userId) {
    return store.data.bills
      .filter((b) => b.hostelId === hostelId && b.userId === userId)
      .sort((a, b) => b.month.localeCompare(a.month));
  },
  async listPayments(billId) {
    return store.data.payments.filter((p) => p.billId === billId);
  },
  /**
   * Records the payment claim and computes how it WOULD settle the chosen
   * targets — previous balance first, then sections in a fixed order — but
   * does not touch the bill yet. Nothing is actually owed-down until a
   * manager verifies it (decidePayment); a member merely claiming to have
   * paid must never move the balance on its own.
   */
  async pay(payment) {
    const bill = store.data.bills.find((b) => b.id === payment.billId);
    const breakdown = bill ? computePaymentBreakdown(bill, payment.targets, payment.amount) : {};
    store.data.payments.push({ ...payment, id: nextId("pay"), verified: false, breakdown });
    if (bill) store.emit(`bill:${bill.userId}`);
  },
  /** Manager logs a payment received OUTSIDE the app (cash handed over in
   * person, etc.) — applied immediately, no separate verification step,
   * since the manager recording it IS the verification. */
  async recordPayment(payment) {
    const bill = store.data.bills.find((b) => b.id === payment.billId);
    if (!bill) return;
    const breakdown = computePaymentBreakdown(bill, payment.targets, payment.amount);
    applyPaymentBreakdown(bill, breakdown, payment.amount);
    store.data.payments.push({ ...payment, id: nextId("pay"), verified: true, breakdown });
    logActivity(
      bill.hostelId,
      "Payment recorded",
      `৳${payment.amount} ${payment.method} from ${store.data.users.find((u) => u.id === bill.userId)?.name ?? "member"}`,
      "bill"
    );
    store.emit(`bill:${bill.userId}`);
  },
  async listPendingVerification(hostelId, month) {
    const billIds = store.data.bills
      .filter((b) => b.hostelId === hostelId && b.month === month)
      .map((b) => b.id);
    return store.data.payments.filter((p) => billIds.includes(p.billId) && !p.verified);
  },
  async decidePayment(paymentId, status) {
    const payment = store.data.payments.find((p) => p.id === paymentId);
    if (!payment || payment.verified) return; // already decided (or gone) — nothing to do.
    const bill = store.data.bills.find((b) => b.id === payment.billId);
    const memberName = bill ? store.data.users.find((u) => u.id === bill.userId)?.name ?? "member" : "member";
    if (status === "verified") {
      // Apply the exact split computed at submission time — the balance
      // moves for the first time right here, not when the member submitted.
      if (bill) applyPaymentBreakdown(bill, payment.breakdown ?? {}, payment.amount);
      payment.verified = true;
      if (bill) logActivity(bill.hostelId, "Payment verified", `৳${payment.amount} from ${memberName}`, "bill");
    } else {
      // Declined: nothing was ever applied to the bill, so just drop the claim.
      store.data.payments = store.data.payments.filter((p) => p.id !== paymentId);
      if (bill) logActivity(bill.hostelId, "Payment rejected", `৳${payment.amount} from ${memberName}`, "bill");
    }
    if (bill) store.emit(`bill:${bill.userId}`);
  },
  async settleMealCredit(billId, amount, destination) {
    const bill = store.data.bills.find((b) => b.id === billId);
    if (!bill) return;
    const meal = bill.sections.find((s) => s.label === "mealCost");
    if (!meal) return;
    const credit = meal.paid - meal.total;
    const applied = Math.min(amount, Math.max(credit, 0));
    if (applied <= 0) return;

    meal.paid -= applied;
    if (destination === "refund") {
      // The money actually leaves the hostel back to the member, so it no
      // longer counts as received.
      bill.paid -= applied;
    } else if (destination === "previousBalance") {
      bill.previousBalancePaid += applied;
    } else {
      const target = bill.sections.find((s) => s.label === destination);
      if (target) target.paid += applied;
    }

    store.data.billAdjustments.push({
      id: nextId("adj"),
      billId,
      userId: bill.userId,
      amount: applied,
      createdAt: new Date().toISOString(),
      kind: destination === "refund" ? "refund" : "transfer",
      from: "mealCost",
      to: destination === "refund" ? undefined : destination,
    });
    logActivity(
      bill.hostelId,
      destination === "refund" ? "Meal credit refunded" : "Meal credit moved to cover dues",
      `৳${applied} · ${store.data.users.find((u) => u.id === bill.userId)?.name ?? "member"}`,
      "bill"
    );
    store.emit(`bill:${bill.userId}`);
  },
  async listAdjustments(billId) {
    return store.data.billAdjustments.filter((a) => a.billId === billId);
  },
  async applyAdvanceOnLeave(hostelId, userId) {
    const hasApprovedLeave = store.data.leaveRequests.some(
      (r) => r.hostelId === hostelId && r.userId === userId && r.status === "approved"
    );
    if (!hasApprovedLeave) {
      throw new Error("This member doesn't have an approved leave request yet — approve one first.");
    }
    const user = store.data.users.find((u) => u.id === userId && u.hostelId === hostelId);
    const held = user?.advanceHeld ?? 0;
    if (!user || held <= 0) return;
    // Credit it against the member's latest bill's room rent (a negative line).
    const bill = store.data.bills
      .filter((b) => b.hostelId === hostelId && b.userId === userId)
      .sort((a, b) => b.month.localeCompare(a.month))[0];
    if (bill) {
      const round2 = (n: number) => Math.round(n * 100) / 100;
      const sections = bill.sections.map((s) =>
        s.label === "roomRent"
          ? {
              ...s,
              items: [...s.items, { label: "Advance rent applied (leaving)", amount: -held }],
              total: round2(s.total - held),
            }
          : s
      );
      const grandTotal = round2(sections.reduce((sum, s) => sum + s.total, 0) + bill.previousBalance);
      store.data.bills = store.data.bills.map((b) => (b.id === bill.id ? { ...b, sections, grandTotal } : b));
      store.emit(`bills:${hostelId}`);
      store.emit(`bill:${userId}`);
    }
    store.data.users = store.data.users.map((u) => (u.id === userId ? { ...u, advanceHeld: 0 } : u));
    logActivity(hostelId, "Advance rent applied on leaving", `৳${held}`, "bill");
  },
  async generateBills(hostelId, month, options) {
    const hostel = store.data.hostels.find((h) => h.id === hostelId);
    if (!hostel) return [];
    // Never bill a future month — there are no meals/expenses to charge yet.
    if (month > currentMonth()) return [];

    // Boarders only — cooks are staff, and owner/platform-team accounts merely
    // carry a nominal hostelId (isHostelMember), so none of them get billed.
    const allBoarders = store.data.users.filter(
      (u) => u.hostelId === hostelId && u.role !== "cook" && isHostelMember(u.role) && !u.banned
    );
    const rooms = store.data.rooms.filter((r) => r.hostelId === hostelId);
    const [year, mon] = month.split("-").map(Number);
    const daysInMonth = new Date(year, mon, 0).getDate();
    const from = `${month}-01`;
    const to = `${month}-${String(daysInMonth).padStart(2, "0")}`;
    const monthDays = store.data.mealDays.filter(
      (d) => d.hostelId === hostelId && d.date >= from && d.date <= to
    );
    const monthExpenses = store.data.expenses.filter(
      (e) => e.hostelId === hostelId && e.billingMonth === month
    );

    const utilityExpenses = monthExpenses
      .filter((e) => isServiceChargeCategory(e.category))
      .filter((e) => !options?.includeServiceExpenseIds || options.includeServiceExpenseIds.includes(e.id));
    const salaryExpenses = monthExpenses
      .filter((e) => e.category === "Salary")
      .filter((e) => !options?.includeSalaryExpenseIds || options.includeSalaryExpenseIds.includes(e.id));

    // Shared by service charge AND cook salary: an expense's per-member
    // amount follows its own memberIds/splitMode exactly — "fixed" charges
    // e.amount to EACH selected member, "equal" divides e.amount across them.
    // Cook salary used to ignore this entirely (pooling every Salary expense
    // and dividing equally across every boarder) — that silently overrode
    // whatever member selection and fixed/equal split the manager set when
    // adding the expense, so a "Fixed ৳600 per person" salary top-up billed
    // everyone a fraction of ৳600 instead of ৳600 each.
    const expenseItemsFor = (expenses: Expense[], userId: string) =>
      expenses
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

    // The AUTOMATIC meal rate: this month's shopping spend ÷ meals eaten
    // (member + guest). Every member and guest meal is billed at this actual
    // per-meal cost — the sum of all meal charges equals the shopping spend.
    const { rate: mealRate } = actualMealRateFor(hostelId, month);
    const round2 = (n: number) => Math.round(n * 100) / 100;

    // What each member personally spent on approved shopping this month —
    // credited against their own meal cost below (same set that feeds the
    // rate), so a heavy shopper's meal cost nets to a credit.
    const shoppingByUser = new Map<string, number>();
    for (const c of store.data.shoppingCosts) {
      if (c.hostelId !== hostelId || c.status !== "approved") continue;
      if (!c.dates.some((d) => d.startsWith(month))) continue;
      shoppingByUser.set(c.userId, (shoppingByUser.get(c.userId) ?? 0) + c.amount);
    }

    // Which month the rent line covers (default: the bill's own month), and
    // whether the hostel charges a month's advance rent on a member's first bill.
    const rentMonthLabel = formatMonthLabel(options?.rentMonth ?? month);
    const advanceRequired = hostel.settings.advanceRentRequired ?? false;
    // Earliest existing bill month per member: the advance line stays on the
    // first-month bill across regenerations, while everBilled gates the
    // one-time hold so regenerating never re-collects it.
    const earliestByUser = new Map<string, string>();
    for (const bl of store.data.bills) {
      if (bl.hostelId !== hostelId) continue;
      const cur = earliestByUser.get(bl.userId);
      if (!cur || bl.month < cur) earliestByUser.set(bl.userId, bl.month);
    }
    const everBilled = new Set(earliestByUser.keys());
    const advanceCharged: { id: string; amount: number }[] = [];

    const slots: MealSlot[] = ["breakfast", "lunch", "dinner"];
    const bills: Bill[] = allBoarders.map((u) => {
      const room = rooms.find((r) => r.occupantIds.includes(u.id));
      const seatRent = room?.seatRent ?? 0;

      let ownMeals = 0;
      let guestMeals = 0;
      const joinedDay = u.joinedAt?.slice(0, 10);
      for (const day of monthDays) {
        // Never bill a member for a day before they joined the hostel.
        if (joinedDay && joinedDay > day.date) continue;
        const entry = day.entries[u.id];
        if (!entry) continue;
        for (const slot of slots) {
          // Only a (day, meal) the manager confirmed was actually cooked
          // bills anyone for it — matches mealRateFor's denominator so the
          // rate and the sum of everyone's billed meals always reconcile.
          if (!isMealConfirmedCooked(hostelId, day.date, slot)) continue;
          // Guests are billed even when the HOST's own meal is off — an
          // approved guest ate regardless of whether the member did.
          if (entry[slot].on) ownMeals += 1;
          guestMeals += entry[slot].guestCount;
        }
      }

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
      // Credit the member's own shopping spend against their meal cost, so the
      // bill nets to (meals − their spend) and matches the monthly report. Can
      // go negative — a credit the hostel owes, which then carries forward.
      const shoppingSpent = shoppingByUser.get(u.id) ?? 0;
      if (shoppingSpent > 0) {
        mealCostItems.push({ label: "Your shopping this month (credit)", amount: -round2(shoppingSpent) });
      }
      const mealCostTotal = round2((ownMeals + guestMeals) * mealRate - shoppingSpent);

      const serviceItems = expenseItemsFor(utilityExpenses, u.id);
      // Owner-set flat monthly service charge — not expense-backed, so it
      // re-applies idempotently every (re)generation.
      const ownerCharge = hostel.settings.serviceChargeMonthly ?? 0;
      if (ownerCharge > 0) {
        serviceItems.unshift({ label: "Monthly service charge (set by owner)", amount: ownerCharge });
      }
      const serviceTotal = serviceItems.reduce((sum, i) => sum + i.amount, 0);

      const salaryItems = expenseItemsFor(salaryExpenses, u.id);
      const salaryTotal = salaryItems.reduce((sum, i) => sum + i.amount, 0);

      // Regenerating a bill must not erase what's already been paid against
      // each section — carry each section's `paid` forward by label.
      const existing = store.data.bills.find(
        (b) => b.hostelId === hostelId && b.userId === u.id && b.month === month
      );
      const paidFor = (label: BillSection["label"]) =>
        existing?.sections.find((s) => s.label === label)?.paid ?? 0;

      // Room rent, labelled with the month it covers. On a member's FIRST
      // bill, if the hostel requires advance rent, add one month's advance so
      // the first bill is two months — held until they leave.
      const roomRentItems = [
        { label: room ? `Room ${room.number} (seat) · ${rentMonthLabel}` : `Unassigned · ${rentMonthLabel}`, amount: seatRent },
      ];
      const earliest = earliestByUser.get(u.id);
      const isFirstBillMonth = !earliest || month <= earliest;
      if (advanceRequired && isFirstBillMonth && seatRent > 0) {
        roomRentItems.push({ label: "Advance rent (1 month, held for your last month)", amount: seatRent });
        // Collect the hold only on the member's very first generation.
        if (!everBilled.has(u.id) && !(u.advanceHeld && u.advanceHeld > 0)) {
          advanceCharged.push({ id: u.id, amount: seatRent });
        }
      }
      const roomRentTotal = roomRentItems.reduce((sum, i) => sum + i.amount, 0);

      const sections: BillSection[] = [
        { label: "mealCost", items: mealCostItems, total: mealCostTotal, paid: paidFor("mealCost") },
        {
          label: "roomRent",
          items: roomRentItems,
          total: roomRentTotal,
          paid: paidFor("roomRent"),
        },
        { label: "serviceCharge", items: serviceItems, total: serviceTotal, paid: paidFor("serviceCharge") },
        {
          label: "cookSalary",
          items: salaryItems,
          total: salaryTotal,
          paid: paidFor("cookSalary"),
        },
      ];
      // Carry the running balance from the member's MOST RECENT prior bill (not
      // strictly last month, so a skipped month never drops it), keeping BOTH
      // signs: a due (+) to collect or a credit (−) that reduces this bill.
      const prevBill = store.data.bills
        .filter((b) => b.hostelId === hostelId && b.userId === u.id && b.month < month)
        .sort((a, b) => b.month.localeCompare(a.month))[0];
      const previousBalance = prevBill ? round2(prevBill.grandTotal - prevBill.paid) : 0;
      // A credit on one section (typically mealCost) must NOT silently offset a
      // due on another section (rent/service/salary) — that's an explicit
      // manager decision (settleMealCredit), not something generation does on
      // its own. Only each section's own positive due contributes to what's
      // owed; previousBalance (a genuine carried cash position) still applies.
      const grandTotal = round2(sections.reduce((sum, s) => sum + Math.max(s.total, 0), 0) + previousBalance);

      return {
        id: existing?.id ?? nextId("bill"),
        hostelId,
        userId: u.id,
        month,
        mealsCount: ownMeals,
        sections,
        previousBalance,
        previousBalancePaid: existing?.previousBalancePaid ?? 0,
        grandTotal,
        paid: existing?.paid ?? 0,
        dueDate: options?.dueDate ?? existing?.dueDate,
      };
    });

    store.data.bills = store.data.bills
      .filter((b) => !(b.hostelId === hostelId && b.month === month))
      .concat(bills);

    // Record the advance now held for members it was charged to this run.
    if (advanceCharged.length > 0) {
      const byId = new Map(advanceCharged.map((a) => [a.id, a.amount]));
      store.data.users = store.data.users.map((u) =>
        byId.has(u.id) ? { ...u, advanceHeld: byId.get(u.id) } : u
      );
    }

    // Lock in every expense that actually fed this generation — the Utilities
    // and Salary expenses included this run — so they're no longer offered
    // as a togglable choice or deletable the next time bills are (re)generated
    // for this month; only genuinely new expenses added afterward will be.
    const billedIds = new Set([...utilityExpenses.map((e) => e.id), ...salaryExpenses.map((e) => e.id)]);
    if (billedIds.size > 0) {
      const now = new Date().toISOString();
      store.data.expenses = store.data.expenses.map((e) =>
        billedIds.has(e.id) && !e.billedAt ? { ...e, billedAt: now } : e
      );
      store.emit(`expenses:${hostelId}`);
    }

    logActivity(hostelId, "Bills generated", `${month} · ${bills.length} member bills`, "bill");
    store.emit(`bills:${hostelId}`);
    for (const b of bills) store.emit(`bill:${b.userId}`);
    return bills;
  },
  subscribe(userId, cb) {
    return store.on(`bill:${userId}`, () => {
      const bill = store.data.bills.find((b) => b.userId === userId);
      if (bill) cb(bill);
    });
  },
};

const cookLeave: CookLeaveRepository = {
  async listByHostel(hostelId) {
    return store.data.cookLeaveRequests.filter((r) => r.hostelId === hostelId);
  },
  async request(req) {
    store.data.cookLeaveRequests.push({
      ...req,
      id: nextId("cookleave"),
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    notifyHostelStaff(
      req.hostelId,
      "Cook leave request",
      `The cook has requested leave for ${req.dateFrom}${req.dateTo !== req.dateFrom ? ` – ${req.dateTo}` : ""}. Review it in Approvals.`
    );
    store.emit(`cookLeave:${req.hostelId}`);
  },
  async decide(id, status, decidedBy) {
    const req = store.data.cookLeaveRequests.find((r) => r.id === id);
    if (!req) return;
    req.status = status;
    req.decidedBy = decidedBy;
    req.decidedAt = new Date().toISOString();
    if (status === "approved") {
      store.data.announcements.push({
        id: nextId("ann"),
        hostelId: req.hostelId,
        kind: "cook-leave-approved",
        title: "Cook on leave",
        body: `The cook will be on leave from ${req.dateFrom} to ${req.dateTo}.`,
        createdAt: new Date().toISOString(),
      });
      store.emit(`announcements:${req.hostelId}`);
    }
    store.emit(`cookLeave:${req.hostelId}`);
  },
  subscribe(hostelId, cb) {
    const fire = () => cb(store.data.cookLeaveRequests.filter((r) => r.hostelId === hostelId));
    fire();
    return store.on(`cookLeave:${hostelId}`, fire);
  },
};

const cookAttendance: CookAttendanceRepository = {
  async listForDate(hostelId, date) {
    return store.data.cookAttendanceReports.filter(
      (r) => r.hostelId === hostelId && r.date === date
    );
  },
  async listByHostel(hostelId) {
    return store.data.cookAttendanceReports.filter((r) => r.hostelId === hostelId);
  },
  async report(req) {
    const created = { ...req, id: nextId("cookattend"), createdAt: new Date().toISOString() };
    store.data.cookAttendanceReports.push(created);
    store.data.announcements.push({
      id: nextId("ann"),
      hostelId: req.hostelId,
      kind: "cook-absence-poll",
      title: `Was ${req.meal} cooked today?`,
      body: "The cook hasn't confirmed this meal. Please vote so the manager can decide.",
      payload: { reportId: created.id, meal: req.meal, date: req.date },
      createdAt: new Date().toISOString(),
    });
    store.emit(`cookAttendance:${req.hostelId}`);
    store.emit(`announcements:${req.hostelId}`);
    return created;
  },
  async markCooked(hostelId, date, meal) {
    // Manager/owner only (policy.ts) — records who actually confirmed it,
    // since this is now what gates counting and billing, not a courtesy log.
    const confirmedBy = actingUser?.id ?? "manager";
    const report = store.data.cookAttendanceReports.find(
      (r) => r.hostelId === hostelId && r.date === date && r.meal === meal
    );
    if (report) {
      report.status = "resolved_cooked";
      report.reportedBy = confirmedBy;
    } else {
      // Confirming a meal directly (no prior dispute) is recorded the same
      // way — one canonical status per meal per day.
      store.data.cookAttendanceReports.push({
        id: nextId("cookattend"),
        hostelId,
        date,
        meal,
        status: "resolved_cooked",
        reportedBy: confirmedBy,
        createdAt: new Date().toISOString(),
      });
    }
    store.emit(`cookAttendance:${hostelId}`);
  },
  async markCookedRange(hostelId, from, to) {
    const last = to < today() ? to : today();
    if (from > last) return { confirmed: 0 };
    sealMockDays(hostelId, from, last);
    const confirmedBy = actingUser?.id ?? "manager";
    let confirmed = 0;
    for (let d = from; d <= last; d = addDays(d, 1)) {
      const day = store.data.mealDays.find((x) => x.hostelId === hostelId && x.date === d);
      for (const meal of ["breakfast", "lunch", "dinner"] as MealSlot[]) {
        const offered = day?.mealsOffered?.[meal] ?? isMealOffered(hostelId, meal);
        if (!offered) continue;
        // Never touch a slot that's already been explicitly decided (cooked,
        // absent, or disputed) — bulk-confirm only fills genuine gaps.
        const existing = store.data.cookAttendanceReports.some(
          (r) => r.hostelId === hostelId && r.date === d && r.meal === meal
        );
        if (existing) continue;
        store.data.cookAttendanceReports.push({
          id: nextId("cookattend"),
          hostelId,
          date: d,
          meal,
          status: "resolved_cooked",
          reportedBy: confirmedBy,
          createdAt: new Date().toISOString(),
        });
        confirmed += 1;
      }
    }
    if (confirmed > 0) store.emit(`cookAttendance:${hostelId}`);
    return { confirmed };
  },
  async vote(reportId, userId, choice) {
    const existing = store.data.cookAttendanceVotes.find(
      (v) => v.reportId === reportId && v.userId === userId
    );
    if (existing) {
      existing.choice = choice;
      existing.votedAt = new Date().toISOString();
    } else {
      store.data.cookAttendanceVotes.push({
        reportId,
        userId,
        choice,
        votedAt: new Date().toISOString(),
      });
    }
    const report = store.data.cookAttendanceReports.find((r) => r.id === reportId);
    if (report) store.emit(`cookAttendance:${report.hostelId}`);
  },
  async listVotes(reportId) {
    return store.data.cookAttendanceVotes.filter((v) => v.reportId === reportId);
  },
  async confirmAbsent(reportId) {
    const report = store.data.cookAttendanceReports.find((r) => r.id === reportId);
    if (!report) return;
    report.status = "confirmed_absent";
    const day = ensureMealDay(report.hostelId, report.date);
    // Nothing is being cooked — clear guest counts too, or they'd keep
    // showing up in "Today's cooking" even though the meal is cancelled.
    Object.values(day.entries).forEach((entry) => {
      entry[report.meal as MealSlot].on = false;
      entry[report.meal as MealSlot].guestCount = 0;
    });
    const ann = store.data.announcements.find(
      (a) => a.kind === "cook-absence-poll" && (a.payload as { reportId?: string })?.reportId === reportId
    );
    if (ann) {
      ann.kind = "cook-absence-resolved";
      ann.title = "Meal cancelled — cook absent";
      ann.body = `${report.meal[0].toUpperCase()}${report.meal.slice(1)} on ${report.date} is cancelled for everyone.`;
    }
    store.emit(`cookAttendance:${report.hostelId}`);
    store.emit(`mealDay:${report.hostelId}`);
    store.emit(`announcements:${report.hostelId}`);
  },
  subscribe(hostelId, cb) {
    return store.on(`cookAttendance:${hostelId}`, cb);
  },
};

const mealEdits: MealEditRepository = {
  async listByHostel(hostelId) {
    return store.data.mealEditRequests.filter((r) => r.hostelId === hostelId);
  },
  async request(req) {
    // Only one active poll per (member, day): drop any still-pending request
    // (and its poll announcement) for the same member+date, so a second request
    // replaces it instead of piling up a duplicate.
    const dupeIds = new Set(
      store.data.mealEditRequests
        .filter(
          (r) =>
            r.hostelId === req.hostelId &&
            r.targetUserId === req.targetUserId &&
            r.date === req.date &&
            r.status === "pending"
        )
        .map((r) => r.id)
    );
    if (dupeIds.size > 0) {
      store.data.mealEditRequests = store.data.mealEditRequests.filter((r) => !dupeIds.has(r.id));
      store.data.announcements = store.data.announcements.filter(
        (a) =>
          !(a.kind === "meal-edit-poll" && dupeIds.has((a.payload as { requestId?: string })?.requestId ?? ""))
      );
    }
    const created: MealEditRequest = {
      ...req,
      id: nextId("mealedit"),
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    store.data.mealEditRequests.push(created);
    const targetName = store.data.users.find((u) => u.id === req.targetUserId)?.name ?? "a member";
    store.data.announcements.push({
      id: nextId("ann"),
      hostelId: req.hostelId,
      kind: "meal-edit-poll",
      title: `Allow editing ${targetName}’s meal on ${req.date}?`,
      body: req.reason
        ? `The manager wants to manually correct ${targetName}’s meal for ${req.date}. Reason: ${req.reason}. Vote yes to allow.`
        : `The manager wants to manually correct ${targetName}’s meal for ${req.date}. Vote yes to allow.`,
      payload: { requestId: created.id, targetUserId: req.targetUserId, date: req.date },
      createdAt: new Date().toISOString(),
    });
    store.emit(`mealEdits:${req.hostelId}`);
    store.emit(`announcements:${req.hostelId}`);
  },
  async vote(requestId, userId, choice) {
    const existing = store.data.mealEditVotes.find(
      (v) => v.requestId === requestId && v.userId === userId
    );
    if (existing) {
      existing.choice = choice;
      existing.votedAt = new Date().toISOString();
    } else {
      store.data.mealEditVotes.push({ requestId, userId, choice, votedAt: new Date().toISOString() });
    }

    const request = store.data.mealEditRequests.find((r) => r.id === requestId);
    if (!request) return;

    if (request.status === "pending") {
      const boarders = store.data.users.filter(
        (u) => u.hostelId === request.hostelId && u.role !== "cook" && u.role !== "owner"
      );
      const yesVotes = store.data.mealEditVotes.filter(
        (v) => v.requestId === requestId && v.choice === "yes"
      ).length;
      if (boarders.length > 0 && yesVotes / boarders.length >= 0.5) {
        // Approve this request AND any leftover pending duplicate for the same
        // member+day (older data), so no stale poll lingers after approval.
        const toResolve = store.data.mealEditRequests.filter(
          (r) =>
            r.hostelId === request.hostelId &&
            r.targetUserId === request.targetUserId &&
            r.date === request.date &&
            r.status === "pending"
        );
        for (const r of toResolve) {
          r.status = "approved";
          const ann = store.data.announcements.find(
            (a) =>
              a.kind === "meal-edit-poll" &&
              (a.payload as { requestId?: string })?.requestId === r.id
          );
          if (ann) {
            ann.kind = "meal-edit-resolved";
            ann.title = "Meal edit approved";
            ann.body = "Members approved the request — the manager can now edit that meal.";
          }
        }
      }
    }
    store.emit(`mealEdits:${request.hostelId}`);
    store.emit(`announcements:${request.hostelId}`);
  },
  async listVotes(requestId) {
    return store.data.mealEditVotes.filter((v) => v.requestId === requestId);
  },
  async withdraw(requestId) {
    const request = store.data.mealEditRequests.find((r) => r.id === requestId);
    if (!request) return;
    store.data.mealEditRequests = store.data.mealEditRequests.filter((r) => r.id !== requestId);
    store.emit(`mealEdits:${request.hostelId}`);
  },
  subscribe(hostelId, cb) {
    const fire = () => cb(store.data.mealEditRequests.filter((r) => r.hostelId === hostelId));
    fire();
    return store.on(`mealEdits:${hostelId}`, fire);
  },
};

const announcements: AnnouncementRepository = {
  async listByHostel(hostelId) {
    return store.data.announcements
      .filter((a) => a.hostelId === hostelId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async post(a) {
    const created = { ...a, id: nextId("ann"), createdAt: new Date().toISOString() };
    store.data.announcements.push(created);
    store.emit(`announcements:${a.hostelId}`);
    // A general (manager broadcast) announcement becomes a real, pushable
    // notification for every active member — so it pings their device and lights
    // the bell, not just sits in the announcements stream. System kinds already
    // notify the people they concern.
    if ((a.kind ?? "general") === "general") {
      const actorId = actingUser?.id;
      for (const m of store.data.users) {
        if (m.hostelId === a.hostelId && !m.banned && isHostelMember(m.role) && m.id !== actorId) {
          notifyUser(m.id, a.title, a.body, created.id);
        }
      }
    }
    return created;
  },
  async update(id, patch) {
    const a = store.data.announcements.find((x) => x.id === id);
    if (!a) return;
    Object.assign(a, patch);
    store.emit(`announcements:${a.hostelId}`);
  },
  async dismiss(userId, announcementId) {
    if (actingUser?.id !== userId) throw new Error("You can only dismiss announcements for yourself.");
    const list = store.data.announcementDismissals[userId] ?? (store.data.announcementDismissals[userId] = []);
    if (!list.includes(announcementId)) list.push(announcementId);
  },
  async listDismissedIds(userId) {
    if (actingUser?.id !== userId) throw new Error("You can only view your own dismissed announcements.");
    return store.data.announcementDismissals[userId] ?? [];
  },
  subscribe(hostelId, cb) {
    const fire = () =>
      cb(
        store.data.announcements
          .filter((a) => a.hostelId === hostelId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      );
    fire();
    return store.on(`announcements:${hostelId}`, fire);
  },
};

const notifications: NotificationRepository = {
  async listByUser(userId) {
    return store.data.notifications
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async create(n) {
    store.data.notifications.push({
      ...n,
      id: nextId("notif"),
      read: false,
      createdAt: new Date().toISOString(),
    });
    store.emit(`notifications:${n.userId}`);
    setImmediate(() => {
      void sendPushToUserMock(n.userId, { title: n.title, body: n.body }).catch(() => {});
    });
  },
  async markRead(id) {
    const n = store.data.notifications.find((x) => x.id === id);
    if (!n) return;
    n.read = true;
    store.emit(`notifications:${n.userId}`);
  },
  subscribe(userId, cb) {
    const fire = () =>
      cb(
        store.data.notifications
          .filter((n) => n.userId === userId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      );
    fire();
    return store.on(`notifications:${userId}`, fire);
  },
};

const pushSubscriptions: PushSubscriptionRepository = {
  async getPublicKey() {
    return getVapidPublicKey();
  },
  async save(sub) {
    const userId = actingUser?.id;
    if (!userId || !sub?.endpoint) return;
    // Upsert by endpoint so the same browser never piles up duplicate rows.
    const existing = store.data.pushSubscriptions.find((s) => s.endpoint === sub.endpoint);
    if (existing) {
      existing.userId = userId;
      existing.p256dh = sub.p256dh;
      existing.auth = sub.auth;
    } else {
      store.data.pushSubscriptions.push({
        id: nextId("push"),
        userId,
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
        createdAt: new Date().toISOString(),
      });
    }
  },
  async unsubscribe(endpoint) {
    if (!endpoint) return;
    store.data.pushSubscriptions = store.data.pushSubscriptions.filter((s) => s.endpoint !== endpoint);
  },
};

const activity: ActivityRepository = {
  async listByHostel(hostelId) {
    return store.data.activityLogs
      .filter((a) => a.hostelId === hostelId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async log(entry) {
    store.data.activityLogs.push({
      ...entry,
      id: nextId("act"),
      createdAt: new Date().toISOString(),
    });
    store.emit(`activity:${entry.hostelId}`);
  },
  subscribe(hostelId, cb) {
    const fire = () =>
      cb(
        store.data.activityLogs
          .filter((a) => a.hostelId === hostelId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      );
    fire();
    return store.on(`activity:${hostelId}`, fire);
  },
};

const expenses: ExpenseRepository = {
  async listByHostel(hostelId) {
    return store.data.expenses.filter((e) => e.hostelId === hostelId);
  },
  async add(expense) {
    store.data.expenses.push({ ...expense, id: nextId("exp") });
    logActivity(expense.hostelId, "Expense recorded", `${expense.category} · ৳${expense.amount}${expense.note ? ` — ${expense.note}` : ""}`, "bill");
    store.emit(`expenses:${expense.hostelId}`);
  },
  async remove(id) {
    const expense = store.data.expenses.find((e) => e.id === id);
    if (!expense) return;
    store.data.expenses = store.data.expenses.filter((e) => e.id !== id);
    logActivity(expense.hostelId, "Expense removed", `${expense.category} · ৳${expense.amount}`, "bill");
    store.emit(`expenses:${expense.hostelId}`);
  },
  subscribe(hostelId, cb) {
    const fire = () => cb(store.data.expenses.filter((e) => e.hostelId === hostelId));
    fire();
    return store.on(`expenses:${hostelId}`, fire);
  },
};

const transfers: TransferRepository = {
  async listByHostel(hostelId) {
    return store.data.transferRequests.filter(
      (t) => t.fromHostelId === hostelId || t.toHostelId === hostelId
    );
  },
  async request(req) {
    store.data.transferRequests.push({
      ...req,
      id: nextId("transfer"),
      stage: "requested",
      timeline: [{ stage: "requested", at: new Date().toISOString() }],
    });
    notifyHostelStaff(
      req.fromHostelId,
      "Hostel transfer request",
      "A member has requested to transfer out of your hostel. Review it in Approvals."
    );
    store.emit(`transfers:${req.fromHostelId}`);
    store.emit(`transfers:${req.toHostelId}`);
  },
  async advance(id, decidedBy, approve) {
    const t = store.data.transferRequests.find((x) => x.id === id);
    if (!t) return;
    // requested = the member's current hostel (manager) reviews; approving
    // passes it to the owner (owner_review), whose approval finalises the move.
    const next: Record<string, string> = {
      requested: approve ? "owner_review" : "denied",
      manager_review: approve ? "owner_review" : "denied",
      owner_review: approve ? "approved" : "denied",
    };
    const nextStage = next[t.stage] ?? t.stage;
    t.stage = nextStage as typeof t.stage;
    t.timeline.push({ stage: nextStage, at: new Date().toISOString(), by: decidedBy });

    if (nextStage === "approved") {
      // Final owner approval actually migrates the student: they move to
      // the new hostel and lose their old room (the new hostel's manager
      // assigns a room via the same Add Member flow used for new joiners).
      const member = store.data.users.find((u) => u.id === t.userId);
      if (member) {
        const oldRoom = store.data.rooms.find((r) => r.id === member.roomId);
        if (oldRoom) oldRoom.occupantIds = oldRoom.occupantIds.filter((id) => id !== member.id);
        member.hostelId = t.toHostelId;
        member.roomId = undefined;
        store.emit(`users:${t.fromHostelId}`);
        store.emit(`users:${t.toHostelId}`);
        store.emit(`rooms:${t.fromHostelId}`);
      }
    }

    store.emit(`transfers:${t.fromHostelId}`);
    store.emit(`transfers:${t.toHostelId}`);
  },
  async cancel(id) {
    store.data.transferRequests = store.data.transferRequests.filter((t) => t.id !== id);
  },
  subscribe(hostelId, cb) {
    const fire = () =>
      cb(
        store.data.transferRequests.filter(
          (t) => t.fromHostelId === hostelId || t.toHostelId === hostelId
        )
      );
    fire();
    return store.on(`transfers:${hostelId}`, fire);
  },
};

const joinRequests: JoinRequestRepository = {
  async listByHostel(hostelId) {
    return store.data.joinRequests.filter((r) => r.hostelId === hostelId);
  },
  async listByUser(userId) {
    return store.data.joinRequests.filter((r) => r.userId === userId);
  },
  async create(req) {
    // Platform-account-only: a join request must come from a signed-up
    // account (the find-hostel / QR flow always supplies userId). Walk-ins
    // typed in by hand are no longer allowed — the person must have an account.
    if (!req.userId) {
      throw new Error(
        "Only people with a platform account can join — ask them to create an account and scan the hostel's QR."
      );
    }
    const requester = store.data.users.find((x) => x.id === req.userId);
    if (!requester) {
      throw new Error("No platform account found for this request.");
    }
    // One-hostel rule: an account that's already a member somewhere can't
    // request to join another hostel — that's what transfers are for.
    if (requester.hostelId && isHostelMember(requester.role)) {
      const current = store.data.hostels.find((h) => h.id === requester.hostelId);
      throw new Error(
        `You're already a member of ${current?.name ?? "a hostel"} — use a hostel transfer to move.`
      );
    }
    store.data.joinRequests.push({
      ...req,
      id: nextId("join"),
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    notifyHostelStaff(
      req.hostelId,
      "New join request",
      `${req.name} has requested to join your hostel. Review it in Approvals.`
    );
    store.emit(`joinRequests:${req.hostelId}`);
  },
  async decide(id, status, roomId) {
    const req = store.data.joinRequests.find((r) => r.id === id);
    if (!req) return;
    req.status = status;

    const pushNotification = (userId: string, title: string, body: string) => {
      store.data.notifications.push({
        id: nextId("notif"),
        userId,
        title,
        body,
        read: false,
        createdAt: new Date().toISOString(),
      });
      store.emit(`notifications:${userId}`);
    };

    // Attaches an EXISTING account to this hostel/room: frees any previous
    // room seat first (a member can never occupy two seats) and cancels the
    // user's other pending requests so a second hostel can't also approve.
    const attachExisting = (userId: string, room: (typeof store.data.rooms)[number]) => {
      const idx = store.data.users.findIndex((u) => u.id === userId);
      if (idx === -1) return false;
      // One-hostel rule: someone who became a member elsewhere while this
      // request sat pending can't be attached here too — deny instead.
      const existing = store.data.users[idx];
      if (existing.hostelId && existing.hostelId !== req.hostelId) {
        req.status = "denied";
        pushNotification(
          userId,
          "Join request declined",
          "You're already a member of another hostel — a member can only belong to one hostel at a time."
        );
        return false;
      }
      store.data.rooms.forEach((r) => {
        if (r.occupantIds.includes(userId)) {
          r.occupantIds = r.occupantIds.filter((x) => x !== userId);
          store.emit(`rooms:${r.hostelId}`);
        }
      });
      store.data.users[idx] = {
        ...store.data.users[idx],
        hostelId: req.hostelId,
        roomId: room.id,
        joinedAt: new Date().toISOString().slice(0, 10),
      };
      room.occupantIds.push(userId);
      store.data.joinRequests.forEach((r2) => {
        if (r2.userId === userId && r2.id !== req.id && r2.status === "pending") {
          r2.status = "denied";
          store.emit(`joinRequests:${r2.hostelId}`);
        }
      });
      pushNotification(
        userId,
        "Join request approved",
        "Welcome! Your join request was approved and a room seat is assigned — your hostel dashboard is ready."
      );
      emitUser(userId);
      return true;
    };

    if (status === "approved" && roomId) {
      const room = store.data.rooms.find((r) => r.id === roomId);
      if (room) {
        // Platform-account-only: attach the request's own account, or (for
        // legacy walk-in requests) an existing account matching its phone.
        // A request with no account behind it can't be approved — approving
        // it would mean adding a non-account-holder, so it's denied instead.
        const linkedId =
          req.userId ??
          store.data.users.find(
            (u) => isHostelMember(u.role) && normalizePhone(u.phone) === normalizePhone(req.phone)
          )?.id;
        if (linkedId) {
          attachExisting(linkedId, room);
          store.emit(`users:${req.hostelId}`);
          store.emit(`rooms:${req.hostelId}`);
        } else {
          req.status = "denied";
        }
      }
    } else if (status === "denied" && req.userId) {
      pushNotification(
        req.userId,
        "Join request declined",
        "Your join request was declined by the hostel manager. You can request a different hostel."
      );
    }
    store.emit(`joinRequests:${req.hostelId}`);
  },
  subscribe(hostelId, cb) {
    const fire = () => cb(store.data.joinRequests.filter((r) => r.hostelId === hostelId));
    fire();
    return store.on(`joinRequests:${hostelId}`, fire);
  },
};

// ── Leave requests ──────────────────────────────────────────────────────────
const MIN_LEAVE_NOTICE_DAYS = 30;

/** Auto-bans anyone whose approved leave date has arrived. Lazy, like meal
 * sealing: runs on every read rather than needing a background job, and is
 * cheap since a hostel only ever has a handful of leave requests (not an
 * unbounded date range). */
async function processDueLeaveRequests(hostelId: string): Promise<void> {
  const due = store.data.leaveRequests.filter(
    (r) => r.hostelId === hostelId && r.status === "approved" && r.leaveDate <= today()
  );
  for (const r of due) {
    const idx = store.data.users.findIndex((u) => u.id === r.userId);
    if (idx === -1 || store.data.users[idx].banned) continue;
    const user = store.data.users[idx];
    // Generate this member's FINAL bill for their leave month while they're
    // still billable (generateBills skips banned members) and fold in any held
    // advance rent, so their closing balance is captured before they leave the
    // roster. Runs once — the ban below makes them skip this loop afterward.
    try {
      await bills.generateBills(hostelId, r.leaveDate.slice(0, 7));
      await bills.applyAdvanceOnLeave(hostelId, user.id);
    } catch {
      // Never let a settlement hiccup block the ban.
    }
    store.data.rooms.forEach((room) => {
      if (room.occupantIds.includes(user.id)) {
        room.occupantIds = room.occupantIds.filter((id) => id !== user.id);
      }
    });
    store.data.users[idx] = { ...user, banned: true, mealsSuspended: true, roomId: undefined };
    logActivity(hostelId, "Member auto-banned (leave date reached)", user.name);
    store.emit(`users:${hostelId}`);
    store.emit(`rooms:${hostelId}`);
    emitUser(user.id);
  }
}

const leaveRequests: LeaveRequestRepository = {
  async listByHostel(hostelId) {
    await processDueLeaveRequests(hostelId);
    return store.data.leaveRequests.filter((r) => r.hostelId === hostelId);
  },
  async listByUser(userId) {
    const user = store.data.users.find((u) => u.id === userId);
    if (user?.hostelId) await processDueLeaveRequests(user.hostelId);
    return store.data.leaveRequests.filter((r) => r.userId === userId);
  },
  async request(req) {
    if (req.leaveDate < addDays(today(), MIN_LEAVE_NOTICE_DAYS)) {
      throw new Error(`Leave requests need at least ${MIN_LEAVE_NOTICE_DAYS} days' notice.`);
    }
    store.data.leaveRequests.push({
      ...req,
      id: nextId("leave"),
      requestedAt: new Date().toISOString(),
      status: "pending",
    });
    notifyHostelStaff(
      req.hostelId,
      "Leave request",
      `A member has given notice to leave on ${req.leaveDate}. Review it in Approvals.`
    );
    store.emit(`leaveRequests:${req.hostelId}`);
  },
  async decide(id, status, decidedBy) {
    const req = store.data.leaveRequests.find((r) => r.id === id);
    if (!req) return;
    req.status = status;
    req.decidedBy = decidedBy;
    req.decidedAt = new Date().toISOString();
    notifyUser(
      req.userId,
      status === "approved" ? "Leave request approved" : "Leave request declined",
      status === "approved"
        ? `Your leave on ${req.leaveDate} was approved. Your advance rent will be credited to your final bill.`
        : "Your leave request was declined — talk to your manager if you still need to leave."
    );
    store.emit(`leaveRequests:${req.hostelId}`);
  },
  async cancel(id) {
    const req = store.data.leaveRequests.find((r) => r.id === id);
    if (!req || req.status !== "pending") return;
    store.data.leaveRequests = store.data.leaveRequests.filter((r) => r.id !== id);
    store.emit(`leaveRequests:${req.hostelId}`);
  },
  subscribe(hostelId, cb) {
    const fire = () => cb(store.data.leaveRequests.filter((r) => r.hostelId === hostelId));
    fire();
    return store.on(`leaveRequests:${hostelId}`, fire);
  },
};

const mealStops: MealStopRepository = {
  async listByHostel(hostelId) {
    return store.data.mealStopRequests.filter((r) => r.hostelId === hostelId);
  },
  async request(req) {
    store.data.mealStopRequests.push({ ...req, id: nextId("stop"), status: "pending" });
    notifyHostelStaff(
      req.hostelId,
      req.desiredOn ? "Meal resume request" : "Meal stop request",
      `A member has requested a meal change for ${req.dateFrom}${req.dateTo !== req.dateFrom ? ` – ${req.dateTo}` : ""}. Review it in Approvals.`
    );
    store.emit(`mealStops:${req.hostelId}`);
  },
  async decide(id, status) {
    const req = store.data.mealStopRequests.find((r) => r.id === id);
    if (!req) return;
    req.status = status;
    if (status === "approved") {
      // Apply the requested direction (on OR off) — a closed slot can't be
      // switched on.
      const wantOn = !!req.desiredOn;
      let d = req.dateFrom;
      while (d <= req.dateTo) {
        const day = ensureMealDay(req.hostelId, d);
        const entry = ensureMealEntry(day, req.userId);
        req.meals.forEach((m) => {
          if (wantOn && !isMealOffered(req.hostelId, m)) return;
          entry[m].on = wantOn;
        });
        store.emit(`mealDay:${req.hostelId}`);
        const next = new Date(`${d}T00:00:00Z`);
        next.setUTCDate(next.getUTCDate() + 1);
        d = next.toISOString().slice(0, 10);
      }
    }
    // Tell the member the outcome.
    const range = `${req.dateFrom}${req.dateTo !== req.dateFrom ? ` – ${req.dateTo}` : ""}`;
    if (status === "approved") {
      notifyUser(
        req.userId,
        req.desiredOn ? "Meal request approved" : "Meal stop approved",
        `Your request to turn meals ${req.desiredOn ? "on" : "off"} for ${range} was approved.`
      );
    } else if (status === "denied") {
      notifyUser(req.userId, "Meal request declined", `Your meal request for ${range} was declined.`);
    }
    store.emit(`mealStops:${req.hostelId}`);
  },
  subscribe(hostelId, cb) {
    const fire = () => cb(store.data.mealStopRequests.filter((r) => r.hostelId === hostelId));
    fire();
    return store.on(`mealStops:${hostelId}`, fire);
  },
};

const guestMeals: GuestMealRepository = {
  async listByHostel(hostelId) {
    return store.data.guestMealRequests.filter((r) => r.hostelId === hostelId);
  },
  async request(req) {
    store.data.guestMealRequests.push({ ...req, id: nextId("guest"), status: "pending" });
    notifyHostelStaff(
      req.hostelId,
      "Guest meal request",
      `A member has requested ${req.qty} guest meal${req.qty > 1 ? "s" : ""} (${req.meal}) for ${req.date}. Review it in Approvals.`
    );
    logActivity(
      req.hostelId,
      "Guest meal requested",
      `${req.qty} × ${req.meal} · ${req.date} · ${store.data.users.find((u) => u.id === req.userId)?.name ?? "member"}`,
      "meal"
    );
    store.emit(`guestMeals:${req.hostelId}`);
  },
  async decide(id, status) {
    const req = store.data.guestMealRequests.find((r) => r.id === id);
    if (!req) return;
    req.status = status;
    if (status === "approved") {
      const day = ensureMealDay(req.hostelId, req.date);
      const entry = ensureMealEntry(day, req.userId);
      entry[req.meal].guestCount = Math.max(0, entry[req.meal].guestCount + req.qty);
      store.emit(`mealDay:${req.hostelId}`);
    }
    logActivity(
      req.hostelId,
      status === "approved" ? "Guest meal approved" : "Guest meal denied",
      `${req.qty} × ${req.meal} · ${req.date} · ${store.data.users.find((u) => u.id === req.userId)?.name ?? "member"}`,
      "meal"
    );
    store.emit(`guestMeals:${req.hostelId}`);
  },
  subscribe(hostelId, cb) {
    const fire = () => cb(store.data.guestMealRequests.filter((r) => r.hostelId === hostelId));
    fire();
    return store.on(`guestMeals:${hostelId}`, fire);
  },
};

const exploreInteractions: ExploreInteractionRepository = {
  async listByUser(userId) {
    return store.data.exploreInteractions.filter((i) => i.userId === userId);
  },
  async toggle(userId, feature, itemId, kind) {
    const existing = store.data.exploreInteractions.find(
      (i) => i.userId === userId && i.feature === feature && i.itemId === itemId && i.kind === kind
    );
    if (existing) {
      store.data.exploreInteractions = store.data.exploreInteractions.filter((i) => i.id !== existing.id);
    } else {
      store.data.exploreInteractions.push({
        id: nextId("expl"),
        userId,
        feature,
        itemId,
        kind,
        createdAt: new Date().toISOString(),
      });
    }
    store.emit(`explore:${userId}`);
  },
  subscribe(userId, cb) {
    const fire = () => cb(store.data.exploreInteractions.filter((i) => i.userId === userId));
    fire();
    return store.on(`explore:${userId}`, fire);
  },
};

const community: CommunityRepository = {
  async listAll() {
    return [...store.data.communityPosts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async post(post) {
    store.data.communityPosts.push({
      ...post,
      id: nextId("cpost"),
      createdAt: new Date().toISOString(),
      likeUserIds: [],
    });
    store.emit("community");
  },
  async toggleLike(postId, userId) {
    const idx = store.data.communityPosts.findIndex((p) => p.id === postId);
    if (idx === -1) return;
    const p = store.data.communityPosts[idx];
    const liked = p.likeUserIds.includes(userId);
    store.data.communityPosts[idx] = {
      ...p,
      likeUserIds: liked ? p.likeUserIds.filter((id) => id !== userId) : [...p.likeUserIds, userId],
    };
    store.emit("community");
  },
  async remove(postId) {
    store.data.communityPosts = store.data.communityPosts.filter((p) => p.id !== postId);
    store.emit("community");
  },
  subscribe(cb) {
    const fire = () => cb([...store.data.communityPosts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    fire();
    return store.on("community", fire);
  },
};

const serviceCatalog: ServiceCatalogRepository = {
  async listByKind(kind) {
    return store.data.serviceListings.filter((l) => l.kind === kind);
  },
  async listAll() {
    return store.data.serviceListings;
  },
  async add(listing) {
    store.data.serviceListings.push({
      ...listing,
      id: nextId("svc"),
      active: true,
      createdAt: new Date().toISOString(),
    } as ServiceListing);
    store.emit("serviceCatalog");
  },
  async update(id, patch) {
    const idx = store.data.serviceListings.findIndex((l) => l.id === id);
    if (idx === -1) return;
    store.data.serviceListings[idx] = { ...store.data.serviceListings[idx], ...patch } as ServiceListing;
    store.emit("serviceCatalog");
  },
  async toggleActive(id) {
    const idx = store.data.serviceListings.findIndex((l) => l.id === id);
    if (idx === -1) return;
    const l = store.data.serviceListings[idx];
    store.data.serviceListings[idx] = { ...l, active: !l.active };
    store.emit("serviceCatalog");
  },
  async remove(id) {
    store.data.serviceListings = store.data.serviceListings.filter((l) => l.id !== id);
    store.emit("serviceCatalog");
  },
  subscribe(cb) {
    // Fresh array each fire — same React-bailout guard as products.subscribe.
    const fire = () => cb([...store.data.serviceListings]);
    fire();
    return store.on("serviceCatalog", fire);
  },
};

const campaigns: CampaignRepository = {
  async listAll() {
    return [...store.data.campaigns].sort((a, b) => b.startDate.localeCompare(a.startDate));
  },
  async create(campaign) {
    store.data.campaigns.push({ ...campaign, id: nextId("camp") });
    store.emit("campaigns");
  },
  async updateStatus(id, status) {
    const idx = store.data.campaigns.findIndex((c) => c.id === id);
    if (idx === -1) return;
    store.data.campaigns[idx] = { ...store.data.campaigns[idx], status };
    store.emit("campaigns");
  },
  async remove(id) {
    store.data.campaigns = store.data.campaigns.filter((c) => c.id !== id);
    store.emit("campaigns");
  },
  subscribe(cb) {
    const fire = () => cb([...store.data.campaigns].sort((a, b) => b.startDate.localeCompare(a.startDate)));
    fire();
    return store.on("campaigns", fire);
  },
};

const marketing: MarketingRepository = {
  async listTargets(month) {
    return store.data.marketingTargets.filter((t) => t.month === month);
  },
  async setTarget(metric, month, target) {
    const idx = store.data.marketingTargets.findIndex((t) => t.metric === metric && t.month === month);
    if (idx === -1) {
      store.data.marketingTargets.push({ metric, month, target });
    } else {
      store.data.marketingTargets[idx] = { metric, month, target };
    }
    store.emit("marketing");
  },
  subscribe(cb) {
    return store.on("marketing", cb);
  },
};

const products: ProductRepository = {
  async listByKind(kind) {
    return store.data.products.filter((p) => p.kind === kind);
  },
  async listAll() {
    return store.data.products;
  },
  async add(product) {
    store.data.products.push({
      ...product,
      id: nextId("prod"),
      active: true,
      createdAt: new Date().toISOString(),
    } as Product);
    store.emit("products");
  },
  async update(id, patch) {
    const idx = store.data.products.findIndex((p) => p.id === id);
    if (idx === -1) return;
    store.data.products[idx] = { ...store.data.products[idx], ...patch } as Product;
    store.emit("products");
  },
  async toggleActive(id) {
    const idx = store.data.products.findIndex((p) => p.id === id);
    if (idx === -1) return;
    const p = store.data.products[idx];
    store.data.products[idx] = { ...p, active: !p.active };
    store.emit("products");
  },
  async remove(id) {
    store.data.products = store.data.products.filter((p) => p.id !== id);
    store.emit("products");
  },
  subscribe(cb) {
    // Fresh array each fire — in-place element swaps (update/toggleActive)
    // keep the array reference stable, and passing the same reference into
    // React setState makes it bail out and skip the re-render.
    const fire = () => cb([...store.data.products]);
    fire();
    return store.on("products", fire);
  },
};

const cart: CartRepository = {
  async listByUser(userId) {
    return store.data.cartItems.filter((c) => c.userId === userId);
  },
  async add(userId, productId, qty = 1) {
    const existing = store.data.cartItems.find((c) => c.userId === userId && c.productId === productId);
    if (existing) {
      existing.qty += qty;
    } else {
      store.data.cartItems.push({ id: nextId("cart"), userId, productId, qty });
    }
    store.emit(`cart:${userId}`);
  },
  async setQty(userId, productId, qty) {
    if (qty <= 0) {
      store.data.cartItems = store.data.cartItems.filter(
        (c) => !(c.userId === userId && c.productId === productId)
      );
    } else {
      const item = store.data.cartItems.find((c) => c.userId === userId && c.productId === productId);
      if (item) item.qty = qty;
      else store.data.cartItems.push({ id: nextId("cart"), userId, productId, qty });
    }
    store.emit(`cart:${userId}`);
  },
  async remove(userId, productId) {
    store.data.cartItems = store.data.cartItems.filter(
      (c) => !(c.userId === userId && c.productId === productId)
    );
    store.emit(`cart:${userId}`);
  },
  async clear(userId) {
    store.data.cartItems = store.data.cartItems.filter((c) => c.userId !== userId);
    store.emit(`cart:${userId}`);
  },
  subscribe(userId, cb) {
    const fire = () => cb(store.data.cartItems.filter((c) => c.userId === userId));
    fire();
    return store.on(`cart:${userId}`, fire);
  },
};

const ORDER_STATUS_TITLE: Record<Order["status"], string> = {
  placed: "Order placed",
  confirmed: "Order confirmed",
  preparing: "Order is being prepared",
  picked_up: "Order picked up",
  on_the_way: "Order on the way",
  delivered: "Order delivered",
  cancelled: "Order cancelled",
};

function orderStatusBody(status: Order["status"], total: number): string {
  switch (status) {
    case "confirmed":
      return `Your order (${formatBDT(total)}) has been confirmed and is being prepared.`;
    case "preparing":
      return `Your order (${formatBDT(total)}) is being prepared.`;
    case "picked_up":
      return `Your order (${formatBDT(total)}) has been picked up for delivery.`;
    case "on_the_way":
      return `Your order (${formatBDT(total)}) is on the way.`;
    case "delivered":
      return `Your order (${formatBDT(total)}) has been delivered. Thanks for shopping with us!`;
    case "cancelled":
      return `Your order (${formatBDT(total)}) has been cancelled.`;
    default:
      return "";
  }
}

/** Throws with a user-facing reason if `code` can't be applied to a cart of
 * this subtotal right now. Doesn't consume a redemption — callers that go on
 * to actually place the order do that themselves, atomically. */
function checkCoupon(code: string, subtotal: number): Coupon {
  const coupon = store.data.coupons.find((c) => c.code.toUpperCase() === code.trim().toUpperCase());
  if (!coupon) throw new Error("That coupon code doesn't exist.");
  if (!coupon.active) throw new Error("This coupon is no longer active.");
  if (coupon.expiresAt && coupon.expiresAt < today()) throw new Error("This coupon has expired.");
  if (coupon.maxUses !== undefined && coupon.usedCount >= coupon.maxUses) {
    throw new Error("This coupon has reached its usage limit.");
  }
  if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount) {
    throw new Error(`This coupon needs a minimum order of ${formatBDT(coupon.minOrderAmount)}.`);
  }
  return coupon;
}

function discountFor(coupon: Coupon, subtotal: number): number {
  const raw = coupon.kind === "percent" ? (subtotal * coupon.value) / 100 : coupon.value;
  return Math.min(Math.round(raw * 100) / 100, subtotal);
}

const orders: OrderRepository = {
  async listByUser(userId) {
    return [...store.data.orders]
      .filter((o) => o.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async listAll() {
    return [...store.data.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async place(userId, details) {
    const lines = store.data.cartItems.filter((c) => c.userId === userId);
    const items: OrderItem[] = lines.flatMap((c) => {
      const p = store.data.products.find((pr) => pr.id === c.productId);
      if (!p) return [];
      return [{ productId: p.id, kind: p.kind, name: p.name, qty: c.qty, price: p.price }];
    });
    if (items.length === 0) throw new Error("Your cart is empty.");
    if (!details.note?.trim()) throw new Error("A delivery address is required.");
    const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
    const deliveryFee = deliveryFeeFor(
      items.some((i) => i.kind === "grocery"),
      subtotal,
      store.data.storeSettings
    );

    let discount = 0;
    let couponIdx = -1;
    if (details.couponCode?.trim()) {
      const coupon = checkCoupon(details.couponCode, subtotal);
      discount = discountFor(coupon, subtotal);
      couponIdx = store.data.coupons.findIndex((c) => c.id === coupon.id);
    }

    const user = store.data.users.find((u) => u.id === userId);
    const order: Order = {
      id: nextId("order"),
      userId,
      hostelId: user?.hostelId ?? "",
      items,
      subtotal,
      deliveryFee,
      ...(discount > 0 ? { discount, couponCode: details.couponCode!.trim().toUpperCase() } : {}),
      total: Math.max(0, subtotal + deliveryFee - discount),
      paymentMethod: details.paymentMethod,
      status: "placed",
      note: details.note.trim(),
      buyerPhone: user?.phone,
      createdAt: new Date().toISOString(),
    };
    store.data.orders.push(order);
    if (couponIdx !== -1) {
      store.data.coupons[couponIdx] = {
        ...store.data.coupons[couponIdx],
        usedCount: store.data.coupons[couponIdx].usedCount + 1,
      };
      store.emit("coupons");
    }
    store.data.cartItems = store.data.cartItems.filter((c) => c.userId !== userId);
    store.emit(`orders:${userId}`);
    store.emit("orders");
    store.emit(`cart:${userId}`);
    return order;
  },
  async updateStatus(orderId, status) {
    const idx = store.data.orders.findIndex((o) => o.id === orderId);
    if (idx === -1) return;
    const order = store.data.orders[idx];
    store.data.orders[idx] = { ...order, status };
    store.emit(`orders:${order.userId}`);
    store.emit("orders");
    if (status !== order.status && status !== "placed") {
      notifyUser(order.userId, ORDER_STATUS_TITLE[status], orderStatusBody(status, order.total));
    }
  },
  async cancel(orderId) {
    const idx = store.data.orders.findIndex((o) => o.id === orderId);
    if (idx === -1) return;
    const order = store.data.orders[idx];
    if (order.userId !== actingUser?.id) {
      throw new Error("You can only cancel your own orders.");
    }
    if (order.status !== "placed") {
      throw new Error("This order can no longer be cancelled — contact the service team.");
    }
    store.data.orders[idx] = { ...order, status: "cancelled" };
    store.emit(`orders:${order.userId}`);
    store.emit("orders");
  },
  subscribe(userId, cb) {
    const fire = () =>
      cb(
        [...store.data.orders]
          .filter((o) => o.userId === userId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      );
    fire();
    return store.on(`orders:${userId}`, fire);
  },
  subscribeAll(cb) {
    const fire = () =>
      cb([...store.data.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    fire();
    return store.on("orders", fire);
  },
};

const storeSettings: StoreSettingsRepository = {
  async get() {
    return { ...store.data.storeSettings };
  },
  async update(patch) {
    store.data.storeSettings = { ...store.data.storeSettings, ...patch };
    store.emit("storeSettings");
  },
  subscribe(cb) {
    const fire = () => cb({ ...store.data.storeSettings });
    fire();
    return store.on("storeSettings", fire);
  },
};

const coupons: CouponRepository = {
  async listAll() {
    return [...store.data.coupons].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async add(coupon) {
    const code = coupon.code.trim().toUpperCase();
    if (!code) throw new Error("Enter a coupon code.");
    if (store.data.coupons.some((c) => c.code.toUpperCase() === code)) {
      throw new Error("A coupon with this code already exists.");
    }
    store.data.coupons.push({ ...coupon, code, id: nextId("coupon"), usedCount: 0, createdAt: new Date().toISOString() });
    store.emit("coupons");
  },
  async update(id, patch) {
    const idx = store.data.coupons.findIndex((c) => c.id === id);
    if (idx === -1) return;
    const next = { ...store.data.coupons[idx], ...patch };
    if (patch.code) next.code = patch.code.trim().toUpperCase();
    store.data.coupons[idx] = next;
    store.emit("coupons");
  },
  async remove(id) {
    store.data.coupons = store.data.coupons.filter((c) => c.id !== id);
    store.emit("coupons");
  },
  async validate(code, subtotal) {
    return checkCoupon(code, subtotal);
  },
  subscribe(cb) {
    const fire = () => cb([...store.data.coupons].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    fire();
    return store.on("coupons", fire);
  },
};

const studyAbroad: StudyAbroadRepository = {
  async listAll() {
    return [...store.data.studyAbroadItems];
  },
  async add(item) {
    const created = {
      ...item,
      id: nextId("study"),
      active: true,
      createdAt: new Date().toISOString(),
    } as StudyAbroadItem;
    store.data.studyAbroadItems.push(created);
    // Publishing a promo card doubles as a push to members: every hostel
    // member gets a notification pointing them at the study-abroad hub.
    if (created.kind === "promo") {
      const now = new Date().toISOString();
      for (const u of store.data.users) {
        if (!isHostelMember(u.role)) continue;
        store.data.notifications.push({
          id: nextId("notif"),
          userId: u.id,
          title: `Study abroad: ${created.title}`,
          body: `${created.tagline} — see Explore → Study Abroad.`,
          read: false,
          createdAt: now,
        });
        store.emit(`notifications:${u.id}`);
      }
    }
    store.emit("studyAbroad");
  },
  async update(id, patch) {
    const idx = store.data.studyAbroadItems.findIndex((i) => i.id === id);
    if (idx === -1) return;
    store.data.studyAbroadItems[idx] = { ...store.data.studyAbroadItems[idx], ...patch } as StudyAbroadItem;
    store.emit("studyAbroad");
  },
  async toggleActive(id) {
    const idx = store.data.studyAbroadItems.findIndex((i) => i.id === id);
    if (idx === -1) return;
    const item = store.data.studyAbroadItems[idx];
    store.data.studyAbroadItems[idx] = { ...item, active: !item.active };
    store.emit("studyAbroad");
  },
  async remove(id) {
    store.data.studyAbroadItems = store.data.studyAbroadItems.filter((i) => i.id !== id);
    store.emit("studyAbroad");
  },
  subscribe(cb) {
    const fire = () => cb([...store.data.studyAbroadItems]);
    fire();
    return store.on("studyAbroad", fire);
  },
};

const promoSettings: PromoSettingsRepository = {
  async get() {
    return { ...store.data.heroPromoSettings };
  },
  async update(patch) {
    store.data.heroPromoSettings = {
      ...store.data.heroPromoSettings,
      ...patch,
      sources: { ...store.data.heroPromoSettings.sources, ...patch.sources },
    };
    store.emit("promoSettings");
  },
  subscribe(cb) {
    const fire = () => cb({ ...store.data.heroPromoSettings });
    fire();
    return store.on("promoSettings", fire);
  },
};

const quickServices: QuickServicesRepository = {
  async get() {
    return { ...store.data.quickServiceSettings };
  },
  async update(key, patch) {
    const current = store.data.quickServiceSettings[key] ?? { enabled: true, areas: [] };
    store.data.quickServiceSettings = {
      ...store.data.quickServiceSettings,
      [key]: { ...current, ...patch },
    };
    store.emit("quickServices");
  },
  subscribe(cb) {
    const fire = () => cb({ ...store.data.quickServiceSettings });
    fire();
    return store.on("quickServices", fire);
  },
};

const studyLeads: StudyLeadRepository = {
  async listAll() {
    return [...store.data.studyLeads].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async add(lead) {
    store.data.studyLeads.push({
      ...lead,
      id: nextId("lead"),
      contacted: false,
      createdAt: new Date().toISOString(),
    });
    store.emit("studyLeads");
  },
  async setContacted(id, contacted) {
    const idx = store.data.studyLeads.findIndex((l) => l.id === id);
    if (idx === -1) return;
    store.data.studyLeads[idx] = { ...store.data.studyLeads[idx], contacted };
    store.emit("studyLeads");
  },
  async remove(id) {
    store.data.studyLeads = store.data.studyLeads.filter((l) => l.id !== id);
    store.emit("studyLeads");
  },
  subscribe(cb) {
    const fire = () =>
      cb([...store.data.studyLeads].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    fire();
    return store.on("studyLeads", fire);
  },
};

const usedBooks: UsedBookRepository = {
  async listAll() {
    return [...store.data.usedBookListings].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async add(book) {
    store.data.usedBookListings.push({
      ...book,
      id: nextId("ubook"),
      createdAt: new Date().toISOString(),
    });
    store.emit("usedBooks");
  },
  async remove(id) {
    store.data.usedBookListings = store.data.usedBookListings.filter((b) => b.id !== id);
    store.emit("usedBooks");
  },
  subscribe(cb) {
    const fire = () =>
      cb([...store.data.usedBookListings].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    fire();
    return store.on("usedBooks", fire);
  },
};

const promotions: PromotionRepository = {
  async listAll() {
    return [...store.data.promotions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async listActive(placement) {
    return store.data.promotions
      .filter((p) => p.placement === placement && p.active)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async add(promo) {
    store.data.promotions.push({
      ...promo,
      id: nextId("promo"),
      active: true,
      createdAt: new Date().toISOString(),
    });
    store.emit("promotions");
  },
  async update(id, patch) {
    const p = store.data.promotions.find((x) => x.id === id);
    if (!p) return;
    Object.assign(p, patch);
    store.emit("promotions");
  },
  async toggleActive(id, active) {
    const p = store.data.promotions.find((x) => x.id === id);
    if (!p) return;
    p.active = active;
    store.emit("promotions");
  },
  async remove(id) {
    store.data.promotions = store.data.promotions.filter((p) => p.id !== id);
    store.emit("promotions");
  },
  subscribe(cb) {
    const fire = () =>
      cb([...store.data.promotions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    fire();
    return store.on("promotions", fire);
  },
};

export const mockRepositories: Repositories = {
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
  shoppingCostEdits,
  shortages,
  bills,
  cookLeave,
  cookAttendance,
  mealEdits,
  announcements,
  notifications,
  pushSubscriptions,
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
  promotions,
  studyAbroad,
  studyLeads,
  promoSettings,
  quickServices,
};

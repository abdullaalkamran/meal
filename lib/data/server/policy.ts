// Server-side authorization for /api/rpc.
//
// Every repository method is reachable over one public endpoint, so this is
// the ONLY thing standing between the internet and the database — the
// permission checks in the UI are cosmetic and trivially bypassed with curl.
//
// Rules, in order:
//   1. Methods in PUBLIC need no session (the signup flow, and nothing else).
//   2. Everything else requires a valid session cookie  → 401 otherwise.
//   3. Methods listed in ROLE_RULES additionally require one of those roles
//      → 403 otherwise.
// Anything not in ROLE_RULES is allowed to any signed-in user.

import type { Role } from "../types";

export interface SessionUser {
  id: string;
  name: string;
  role: Role;
}

/** Callable with no session at all. Deliberately tiny. */
const PUBLIC: Record<string, ReadonlySet<string>> = {
  // `signup` is the sanitized account-creation path: it can only ever mint a
  // student/owner with no hostel. Raw `users.create` (which can set ANY role,
  // including superadmin) stays behind auth — with phone-only sign-in, a
  // public create would let anyone mint themselves an admin account.
  users: new Set(["signup", "phoneAvailable"]),
};

// Staff who run a hostel. Owners are included everywhere managers are, since
// an owner can act as the manager of their own hostels ("manage mode").
const HOSTEL_STAFF: Role[] = ["manager", "owner"];
const PLATFORM_ADMIN: Role[] = ["superadmin"];
const SERVICE_TEAM: Role[] = ["service", "superadmin"];
const MARKETING_TEAM: Role[] = ["marketing", "superadmin"];

/** repo → method → roles allowed to call it. */
const ROLE_RULES: Record<string, Record<string, Role[]>> = {
  // Writing an audit entry is staff-only so members can't forge history;
  // reading (listByHostel) stays open to any signed-in member of the hostel.
  activity: {
    log: [...HOSTEL_STAFF, "superadmin"],
  },
  users: {
    // Creating arbitrary users (with an arbitrary role) — owners add a
    // hostel's manager/cook this way.
    create: ["owner", "superadmin"],
    setBanned: [...HOSTEL_STAFF, "superadmin"],
    remove: [...HOSTEL_STAFF, "superadmin"],
    rate: HOSTEL_STAFF,
    attachToHostel: HOSTEL_STAFF,
    setServicePermissions: PLATFORM_ADMIN,
  },
  hostels: {
    create: ["owner", "superadmin"],
    update: [...HOSTEL_STAFF, "superadmin"],
    // Was missing entirely, which under the "anything not listed is allowed
    // to any signed-in user" default made it callable by literally any
    // student — closed alongside fixing the owner staff-page bug that made
    // this unreachable through the UI in the first place.
    changeManager: [...HOSTEL_STAFF, "superadmin"],
    // Removing the manager WITHOUT a replacement leaves the hostel
    // manager-less — an owner-level decision, not something a manager should
    // do to themselves (they hand over via changeManager instead).
    demoteManager: ["owner", "superadmin"],
    // Creating a manager account / staffing a manager-less hostel is an
    // owner-level action (a manager hands over via changeManager instead).
    assignManager: ["owner", "superadmin"],
    assignCook: [...HOSTEL_STAFF, "superadmin"],
    updateSettings: [...HOSTEL_STAFF, "superadmin"],
    setMealOffered: HOSTEL_STAFF,
    setSuspended: PLATFORM_ADMIN,
    setVerified: SERVICE_TEAM,
  },
  rooms: {
    create: HOSTEL_STAFF,
    update: HOSTEL_STAFF,
    assignMember: HOSTEL_STAFF,
    vacate: HOSTEL_STAFF,
  },
  bills: {
    generateBills: HOSTEL_STAFF,
    decidePayment: HOSTEL_STAFF,
    // A direct, already-verified write of a payment onto a member's bill —
    // unlike pay() (member-initiated, always pending until decidePayment),
    // this is the manager logging cash/off-app payments themselves.
    recordPayment: HOSTEL_STAFF,
    settleMealCredit: HOSTEL_STAFF,
    applyAdvanceOnLeave: HOSTEL_STAFF,
  },
  expenses: {
    add: HOSTEL_STAFF,
    remove: HOSTEL_STAFF,
  },
  joinRequests: {
    decide: HOSTEL_STAFF,
  },
  leaveRequests: { decide: HOSTEL_STAFF },
  mealStops: { decide: HOSTEL_STAFF },
  guestMeals: { decide: HOSTEL_STAFF },
  shoppingCosts: { decide: HOSTEL_STAFF, recordForMember: HOSTEL_STAFF },
  // Manager requests the change; voting/withdrawing stays open to members.
  shoppingCostEdits: { request: HOSTEL_STAFF },
  // markCooked/confirmAbsent are the gate that decides whether a slot counts
  // toward cooking count AND billing (see mealRateFor/generateBills) —
  // deliberately manager/owner only, never the cook confirming their own
  // work. report/vote/listVotes stay open to any signed-in member.
  cookAttendance: { markCooked: HOSTEL_STAFF, confirmAbsent: HOSTEL_STAFF },
  cookLeave: { decide: HOSTEL_STAFF },
  shortages: { resolve: [...HOSTEL_STAFF, "cook"] },
  transfers: { advance: HOSTEL_STAFF },
  meals: {
    setMemberMealsForRange: HOSTEL_STAFF,
    // NOT role-gated here: addGuestMeal is a direct, unapproved write onto a
    // member's guest count — staff can do it for anyone, anytime, but a
    // member can also do it for THEMSELVES while still before their own
    // meal-toggle cutoff (mirrors setMemberMealToggle, which is open here for
    // the same reason). Both the self-only and cutoff checks live inside the
    // implementation itself (like users.updateUser), since policy.ts can't
    // express "staff, OR self-with-a-condition".
  },
  duties: { createPlan: HOSTEL_STAFF },
  announcements: { post: HOSTEL_STAFF, update: HOSTEL_STAFF },
  mealEdits: { request: HOSTEL_STAFF, withdraw: HOSTEL_STAFF },
  // Platform catalogs — run by the Service / Marketing teams.
  serviceCatalog: { add: SERVICE_TEAM, update: SERVICE_TEAM, toggleActive: SERVICE_TEAM, remove: SERVICE_TEAM },
  products: { add: SERVICE_TEAM, update: SERVICE_TEAM, toggleActive: SERVICE_TEAM, remove: SERVICE_TEAM },
  studyAbroad: { add: SERVICE_TEAM, update: SERVICE_TEAM, toggleActive: SERVICE_TEAM, remove: SERVICE_TEAM },
  studyLeads: { setContacted: SERVICE_TEAM, remove: SERVICE_TEAM },
  promoSettings: { update: SERVICE_TEAM },
  // Which "Quick action" tiles show on the member home page, and where —
  // Super Admin only.
  quickServices: { update: PLATFORM_ADMIN },
  // Home-page banners + login popups: only the service team / super admin
  // may create or change them; listing is open to signed-in members.
  promotions: {
    add: SERVICE_TEAM,
    update: SERVICE_TEAM,
    toggleActive: SERVICE_TEAM,
    remove: SERVICE_TEAM,
  },
  orders: { updateStatus: SERVICE_TEAM },
  storeSettings: { update: SERVICE_TEAM },
  // listAll shows every code incl. inactive/expired — admin-only. validate
  // (checkout) stays open to any signed-in buyer.
  coupons: { listAll: SERVICE_TEAM, add: SERVICE_TEAM, update: SERVICE_TEAM, remove: SERVICE_TEAM },
  community: { remove: SERVICE_TEAM },
  campaigns: { create: MARKETING_TEAM, updateStatus: MARKETING_TEAM, remove: MARKETING_TEAM },
  marketing: { setTarget: MARKETING_TEAM },
};

export interface Denial {
  message: string;
  status: 401 | 403;
}

/** Returns null when the call is allowed, or the denial to send back. */
export function authorize(
  repo: string,
  method: string,
  session: SessionUser | null
): Denial | null {
  if (PUBLIC[repo]?.has(method)) return null;

  if (!session) {
    return { message: "Sign in to continue.", status: 401 };
  }

  const allowed = ROLE_RULES[repo]?.[method];
  if (allowed && !allowed.includes(session.role)) {
    return {
      message: `Your account (${session.role}) isn't allowed to perform this action.`,
      status: 403,
    };
  }
  return null;
}

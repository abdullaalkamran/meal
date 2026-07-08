// Canonical entity types for the Hostel ERP data model.
// These unify several inconsistent mock-data shapes found in the original
// design prototype (see design_handoff_hostel_erp/) into single sources of truth.

export type Role = "student" | "manager" | "owner" | "cook";
export type MealSlot = "breakfast" | "lunch" | "dinner";
export type Stars = 1 | 2 | 3 | 4 | 5;

export interface User {
  id: string;
  hostelId: string;
  name: string;
  phone: string;
  role: Role;
  roomId?: string;
  avatarSeed: string;
  /** Set only for students: institutional ID and department, e.g. "STU2024005", "CSE, BUET". */
  studentId?: string;
  department?: string;
  /** Set only on owners: every hostel they own. */
  ownedHostelIds?: string[];
}

export interface Room {
  id: string;
  hostelId: string;
  number: string;
  capacity: number;
  occupantIds: string[];
}

export interface HostelSettings {
  mealCutoff: { meal: MealSlot; time: string }[];
  guestMealPrice: number;
  mealStopRequiresApproval: boolean;
  shoppingRotationPolicy: "spin-wheel" | "manual";
}

export interface Hostel {
  id: string;
  name: string;
  area: string;
  ownerId: string;
  managerId: string;
  cookId?: string;
  mealRate: number;
  kitchenLocation?: string;
  settings: HostelSettings;
}

export interface MealEntry {
  on: boolean;
  guestCount: number;
}

export interface MealDay {
  hostelId: string;
  date: string; // YYYY-MM-DD
  entries: Record<string, Record<MealSlot, MealEntry>>; // userId -> slot -> entry
  shoppingUserId?: string;
}

export interface Menu {
  hostelId: string;
  date: string;
  dishes: Record<MealSlot, string[]>;
}

export interface Rating {
  id: string;
  hostelId: string;
  userId: string;
  date: string;
  meal: MealSlot;
  target: "menu" | "cook";
  stars: Stars;
}

export interface Comment {
  id: string;
  hostelId: string;
  date: string;
  userId: string;
  text: string;
  createdAt: string;
}

export interface Reaction {
  id: string;
  commentId: string;
  userId: string;
  emoji: string;
}

/**
 * Unifies the prototype's three coexisting duty-rotation models
 * (spin-wheel equal-block, single-member-pick, equal-days-sequential)
 * into one shape. Shopping duty always requires a spin; cleaning duty
 * never does (equal-days-sequential, no wheel). The legacy single-pick
 * model is intentionally dropped.
 */
export interface DutyPlan {
  id: string;
  hostelId: string;
  type: "shopping" | "cleaning";
  requiresSpin: boolean;
  startDate: string;
  endDate: string;
  memberIds: string[];
  blocks: { userId: string; dates: string[] }[];
  spun: Record<string, boolean>;
  /** Daily shopping budget, e.g. 2500 (৳/day) — only meaningful for type 'shopping'. */
  budgetPerDay?: number;
  createdAt: string;
}

export interface SwapRequest {
  id: string;
  hostelId: string;
  planId: string;
  fromUserId: string;
  toUserId: string;
  status: "pending" | "accepted" | "denied" | "cancelled";
  createdAt: string;
}

export interface ShoppingCost {
  id: string;
  hostelId: string;
  userId: string;
  dates: string[];
  amount: number;
  items?: string;
  createdAt: string;
}

export interface BillLineItem {
  label: string;
  amount: number;
}

export interface BillSection {
  label: "mealCost" | "serviceCharge" | "roomRent";
  items: BillLineItem[];
  total: number;
}

export interface Bill {
  id: string;
  hostelId: string;
  userId: string;
  month: string; // e.g. "2026-07"
  mealsCount: number;
  sections: BillSection[];
  grandTotal: number;
  paid: number;
}

export interface Payment {
  id: string;
  billId: string;
  amount: number;
  paidAt: string;
  method: "bKash" | "Nagad" | "Card" | "Cash";
  reference?: string;
  verified: boolean;
}

/**
 * Unifies the prototype's duplicate cook-leave mocks (cook-side `leave`
 * and manager-side `cookReq`/`cookReqScope`) into a single entity.
 */
export interface CookLeaveRequest {
  id: string;
  hostelId: string;
  cookId: string;
  dateFrom: string;
  dateTo: string;
  scope: "full-day" | "partial";
  meals?: MealSlot[]; // present when scope === 'partial'
  reason: string;
  status: "pending" | "approved" | "denied";
  decidedBy?: string;
  decidedAt?: string;
  createdAt: string;
}

/**
 * Unifies the prototype's two cook-attendance flows (vote-tally vs. the
 * dead `cookConfirms` counter) into the single vote-tally + manager-confirm
 * flow, which is the one the design's README documents.
 */
export interface CookAttendanceReport {
  id: string;
  hostelId: string;
  date: string;
  meal: MealSlot;
  status: "reported" | "confirmed_absent" | "resolved_cooked";
  reportedBy: string;
  createdAt: string;
}

export interface CookAttendanceVote {
  reportId: string;
  userId: string;
  choice: "yes" | "no" | "dk";
  votedAt: string;
}

export type AnnouncementKind =
  | "general"
  | "cook-absence-poll"
  | "cook-absence-resolved"
  | "cook-leave-approved"
  | "spin-wheel-cta"
  | "swap-request"
  | "swap-completed"
  | "swap-denied";

export interface Announcement {
  id: string;
  hostelId: string;
  kind: AnnouncementKind;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  announcementId?: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface Expense {
  id: string;
  hostelId: string;
  category: string;
  amount: number;
  date: string;
  note?: string;
}

export interface HostelTransferRequest {
  id: string;
  userId: string;
  fromHostelId: string;
  toHostelId: string;
  reason: string;
  stage: "requested" | "manager_review" | "owner_review" | "approved" | "denied";
  timeline: { stage: string; at: string; by?: string }[];
}

export interface JoinRequest {
  id: string;
  hostelId: string;
  name: string;
  phone: string;
  status: "pending" | "approved" | "denied";
  createdAt: string;
}

export interface MealStopRequest {
  id: string;
  hostelId: string;
  userId: string;
  meals: MealSlot[];
  dateFrom: string;
  dateTo: string;
  reason?: string;
  status: "pending" | "approved" | "denied";
}

export interface GuestMealRequest {
  id: string;
  hostelId: string;
  userId: string;
  meal: MealSlot;
  date: string;
  guestName: string;
  qty: number;
  status: "pending" | "approved" | "denied";
}

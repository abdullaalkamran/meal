// Canonical entity types for the Hostel ERP data model.
// These unify several inconsistent mock-data shapes found in the original
// design prototype (see design_handoff_hostel_erp/) into single sources of truth.

export type Role = "student" | "manager" | "owner" | "cook" | "superadmin" | "marketing" | "service";
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
  /** Manager turned this boarder's meals off for an unpaid bill — they can't
   * re-enable their own toggles until the manager resumes them. */
  mealsSuspended?: boolean;
  /** Manager banned this member from THIS hostel — record is kept (so they can
   * still switch/transfer to another hostel) but they're evicted from their
   * room seat, meals are off, and they're excluded from active roster,
   * billing, and cooking counts until un-banned. */
  banned?: boolean;
  /** Manager's private conduct/reliability rating of this member (1–5). */
  managerRating?: Stars;
  managerRatingNote?: string;
  /** When this member joined the hostel (ISO date) — shown as "member since". */
  joinedAt?: string;
}

export interface Room {
  id: string;
  hostelId: string;
  number: string;
  capacity: number;
  occupantIds: string[];
  /** Monthly rent for one seat in this room (৳) — each occupant pays this directly, not split across capacity. */
  seatRent: number;
  /** Amenities available in this room, e.g. ["Attached bath", "AC", "Balcony"]. */
  facilities?: string[];
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
  /** Fixed monthly salary for the hostel's cook (৳) — used to compute paid vs due. */
  cookMonthlySalary?: number;
  settings: HostelSettings;
  /** Super Admin suspended this hostel from the platform — a soft flag shown in
   * the admin directory; kept out of "active hostels" counts. */
  suspended?: boolean;
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
  /** Each block's userIds has length 1 (individual) or 2 (companion pair) for shopping duty. */
  blocks: { userIds: string[]; dates: string[] }[];
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

/** A cook-reported ingredient shortage — routed to the manager and the
 * current shopping-duty person(s), and posted as a red-alert announcement,
 * until whoever bought the items marks it resolved. */
export interface ShortageRequest {
  id: string;
  hostelId: string;
  cookId: string;
  items: string;
  status: "pending" | "resolved";
  createdAt: string;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface BillLineItem {
  label: string;
  amount: number;
}

export interface BillSection {
  label: "mealCost" | "serviceCharge" | "roomRent" | "cookSalary";
  items: BillLineItem[];
  total: number;
  /** How much of this section has been paid so far — tracked per-section (rather
   * than only as one bill-wide total) so a member who's paid off meal cost but
   * not rent, or overpaid meal cost into credit (e.g. from shopping-duty spend
   * exceeding their share), sees that reflected on the exact category it's for. */
  paid: number;
}

/** A payment can target one or more specific parts of the bill instead of
 * always paying everything at once — meal cost, room rent, service charge,
 * and cook salary are billed for different reasons and a member may want to
 * settle any combination of them together (or run a credit on one while
 * still owing on another). */
export type BillTarget = BillSection["label"] | "previousBalance";

export interface Bill {
  id: string;
  hostelId: string;
  userId: string;
  month: string; // e.g. "2026-07"
  mealsCount: number;
  sections: BillSection[];
  /** Unpaid leftover from this member's immediately preceding month's bill, carried forward on top of this month's fresh charges. */
  previousBalance: number;
  /** How much of `previousBalance` has been paid off — tracked separately from
   * the per-section paid amounts since it isn't tied to any one section. */
  previousBalancePaid: number;
  grandTotal: number;
  paid: number;
  /** Manager-set last day to pay this bill, e.g. "2026-07-15". */
  dueDate?: string;
}

export interface Payment {
  id: string;
  billId: string;
  amount: number;
  paidAt: string;
  method: "bKash" | "Nagad" | "Card" | "Cash";
  reference?: string;
  /** The number/account the money was sent from (bKash/Nagad number, bank account, etc.) — lets the manager match it against their own statement. Not applicable for Cash. */
  senderNumber?: string;
  verified: boolean;
  /** Which part(s) of the bill this payment was meant to cover — a member can
   * settle multiple categories (e.g. room rent + service charge) in one
   * payment instead of only ever paying one category or literally everything. */
  targets: BillTarget[];
  /** The exact split actually applied across those targets at payment time
   * (previous balance first, then each section in a fixed order) — recorded
   * so a later rejection can reverse it precisely instead of re-deriving it
   * from bill state that may have since changed. */
  breakdown?: Partial<Record<BillTarget, number>>;
}

/** Meal cost belongs entirely to members — the hostel keeps no share of it —
 * so a member's meal-cost credit (they paid in more than the meal charge for
 * the month) has to be settled by the manager: either handed back in cash, or
 * used to cover a due they still owe on another part of the same bill (rent,
 * service charge, cook salary, or a previous-month balance). */
export interface BillAdjustment {
  id: string;
  billId: string;
  userId: string;
  amount: number;
  createdAt: string;
  /** "refund" pays the credit back to the member in cash; "transfer" moves it
   * to cover a due on another part of the bill instead. */
  kind: "refund" | "transfer";
  /** Always "mealCost" today — the only section the hostel can't keep a share of. */
  from: BillTarget;
  /** The category the credit was moved to cover — only set for "transfer". */
  to?: BillTarget;
  note?: string;
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

/** Manager's request to hand-edit one member's meal toggles for one past/
 * locked date — gated behind a hostel-wide vote so the manager can't
 * unilaterally change someone's meal record. Auto-approves once yes votes
 * reach half of the hostel's boarders. */
export interface MealEditRequest {
  id: string;
  hostelId: string;
  targetUserId: string;
  date: string;
  reason: string;
  requestedBy: string;
  status: "pending" | "approved" | "denied";
  createdAt: string;
}

export interface MealEditVote {
  requestId: string;
  userId: string;
  choice: "yes" | "no";
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
  | "swap-denied"
  | "shortage-alert"
  | "meal-edit-poll"
  | "meal-edit-resolved";

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
  /** If splitMode is "fixed", this is the amount EACH selected member pays.
   * If "equal", this is the TOTAL, divided equally across memberIds. */
  amount: number;
  /** Service period this expense covers — a single day has dateFrom === dateTo.
   * Purely descriptive (e.g. "electricity for Apr 1-30"); does NOT decide which
   * month's finance page / bill the expense lands on — see billingMonth. */
  dateFrom: string;
  dateTo: string;
  note?: string;
  /** Boarders this expense applies to (drives the service-charge share on their bills). */
  memberIds: string[];
  splitMode: "fixed" | "equal";
  /** The month (YYYY-MM) this expense is charged in — e.g. a late electricity
   * bill covering April can still be recorded against July if that's when it
   * arrived, so it shows up transparently on the running month's finance page
   * and bills instead of silently landing on an already-closed April. */
  billingMonth: string;
  /** Set once this expense has actually been folded into a generated bill —
   * a Utilities expense the manager included when generating, or any Salary
   * expense (cook salary always sums every one for the month). Once billed,
   * it's locked from deletion and won't be re-offered as a togglable choice
   * the next time bills are generated for that month — only genuinely new,
   * not-yet-billed expenses show up as choices then. */
  billedAt?: string;
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

/** A logged-in user's action on a browsable /explore item (job, course, book,
 * offer, cook) — persisted so "Applied"/"Enrolled"/"Saved"/"Grabbed" states
 * survive reloads. `itemId` references a stable id from lib/explore/content.ts. */
export interface ExploreInteraction {
  id: string;
  userId: string;
  feature: "jobs" | "learning" | "books" | "offers" | "cooks" | "investment";
  itemId: string;
  kind: "applied" | "enrolled" | "saved" | "grabbed";
  createdAt: string;
}

/** A post in the cross-hostel community feed (/explore/community). */
export interface CommunityPost {
  id: string;
  hostelId: string;
  userId: string;
  authorName: string;
  body: string;
  createdAt: string;
  likeUserIds: string[];
}

/** A service listing the platform offers hostels, shown in /explore and managed
 * by the Service Manager. One discriminated table across kinds so the catalog
 * has a single source of truth. */
export type ServiceListing =
  | { kind: "cook"; id: string; active: boolean; createdAt: string; name: string; cuisine: string; experienceYears: number; monthlyRate: number; rating: number; phone: string }
  | { kind: "job"; id: string; active: boolean; createdAt: string; title: string; company: string; location: string; jobType: string; pay: string; tags: string[] }
  | { kind: "course"; id: string; active: boolean; createdAt: string; title: string; provider: string; category: string; level: string; duration: string; price: string }
  | { kind: "offer"; id: string; active: boolean; createdAt: string; shop: string; title: string; discount: string; code: string; expires: string; category: string }
  | { kind: "hostel"; id: string; active: boolean; createdAt: string; name: string; area: string; seatRentFrom: number; seatsAvailable: number; rating: number; amenities: string[]; phone: string };

export type ServiceKind = ServiceListing["kind"];

/** A marketing campaign tracked by the Marketing Manager. */
export interface Campaign {
  id: string;
  name: string;
  channel: string;
  status: "planned" | "running" | "done";
  startDate: string;
  budget: number;
  note?: string;
}

/** An editable, persisted target for a marketing KPI in a given month. Actuals
 * are computed live from platform data; only the target is stored here. */
export interface MarketingTarget {
  metric: string;
  month: string;
  target: number;
}

/** Omit that distributes over a union so each ServiceListing variant keeps its
 * own fields (a plain Omit<Union, K> collapses to only the shared keys). */
export type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
export type NewServiceListing = DistributiveOmit<ServiceListing, "id" | "createdAt" | "active">;

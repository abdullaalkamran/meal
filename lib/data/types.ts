// Canonical entity types for the MyDorm data model.
// These unify several inconsistent mock-data shapes found in the original
// design prototype (see design_handoff_hostel_erp/) into single sources of truth.

export type Role = "student" | "manager" | "owner" | "cook" | "superadmin" | "marketing" | "service";
export type MealSlot = "breakfast" | "lunch" | "dinner";
export type Stars = 1 | 2 | 3 | 4 | 5;

/** A structured Bangladesh address, chosen from cascading dropdowns:
 * division → district → thana/upazila (see lib/geo/bangladesh.ts). */
export interface GeoAddress {
  division: string;
  district: string;
  thana: string;
}

/** One availability area for platform services (jobs, offers, e-commerce…).
 * Omitting district covers the whole division; omitting thana covers the
 * whole district. An entity with NO areas is available everywhere. */
export interface GeoArea {
  division: string;
  district?: string;
  thana?: string;
}

export interface User {
  id: string;
  hostelId: string;
  name: string;
  phone: string;
  /** Used to prefill forms (e.g. the study-abroad eligibility check). */
  email?: string;
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
  /** The member's own "turn my future meals off" switch: while on, every new
   * day defaults their meals to OFF until they turn a specific day back on (or
   * flip this off). Their own choice — unrelated to mealsSuspended. */
  futureMealsOff?: boolean;
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
  /** Advance rent (৳) currently held for this member — charged on their first
   * bill when the hostel requires it (HostelSettings.advanceRentRequired), and
   * credited back against their final bill when they leave. 0/undefined = none
   * held. */
  advanceHeld?: number;
  /** Per-user notification opt-outs; missing key/object = enabled. */
  notificationPrefs?: {
    announcements?: boolean;
    bills?: boolean;
    monthlyReport?: boolean;
  };
  /** Member's home address (division/district/thana dropdowns at signup) —
   * also what area-restricted platform services filter against. */
  address?: GeoAddress;
}

/** What public sign-up is allowed to submit. Deliberately narrow: the role is
 * limited to student/owner and no hostel, ban, rating or ownership field can
 * be set, so the open signup endpoint can't mint a privileged account. */
export interface SignupInput {
  name: string;
  phone: string;
  /** Plain text in transit only — hashed (scrypt) before it ever touches
   * storage; never round-trips back to any client. Minimum 6 characters. */
  password: string;
  email?: string;
  role: "student" | "owner";
  avatarSeed: string;
  studentId?: string;
  department?: string;
  address?: GeoAddress;
}

/** Platform email (SMTP) settings — server-managed, editable by the Super
 * Admin. `password` is stored encrypted at rest (see secretbox.ts) and is
 * NEVER sent to any client; the admin UI only ever sees whether it's set. */
export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  /** Encrypted at rest; blank means "unchanged/keep existing" on save. */
  password: string;
  fromEmail: string;
  fromName: string;
}

/** A one-time password-reset code emailed to an account's address. The code
 * itself is only ever stored hashed. */
export interface PasswordResetOtp {
  id: string;
  userId: string;
  codeHash: string;
  expiresAt: string;
  attempts: number;
  consumedAt?: string;
  createdAt: string;
}

/** One audited hostel action (expense recorded, bills generated, member
 * banned, settings changed, …) — the owner's activity log. */
export interface ActivityLog {
  id: string;
  hostelId: string;
  actorId: string;
  actorName: string;
  action: string;
  detail?: string;
  createdAt: string;
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

/** What the hostel's MANAGER is allowed to do — set by the owner per hostel.
 * Missing object or missing key means allowed (defaults are permissive).
 * Owners themselves always bypass these flags. */
export interface ManagerPermissions {
  /** Room management (add/edit rooms, move/vacate members). */
  rooms: boolean;
  /** Member roster: join requests, ban/remove, member detail. */
  members: boolean;
  /** Approvals inbox (meal stops, guest meals, cook leave, transfers, payments). */
  approvals: boolean;
  /** Finance page: recording/removing expenses. */
  finance: boolean;
  /** Generating monthly bills. */
  billing: boolean;
  /** Editing the day's menu. */
  menu: boolean;
  /** Creating shopping/cleaning duty rotations. */
  duties: boolean;
  /** Posting announcements. */
  announcements: boolean;
  /** Handing the manager role to another member (promoting a boarder to
   * manager, which demotes the current manager back to a boarder). Owners
   * can always do this; this flag controls whether the MANAGER may too. */
  assignManager: boolean;
}

export interface HostelSettings {
  mealCutoff: { meal: MealSlot; time: string }[];
  /** DEPRECATED — guest meals are billed at Hostel.mealRate (same as member
   * meals); kept equal to it for legacy data. Do not display separately. */
  guestMealPrice: number;
  mealStopRequiresApproval: boolean;
  shoppingRotationPolicy: "spin-wheel" | "manual";
  managerPermissions?: ManagerPermissions;
  /** Flat monthly service charge (৳) billed to EACH boarder, set by the OWNER
   * only — managers see it on bills but cannot change it. 0/undefined = none. */
  serviceChargeMonthly?: number;
  /** When on, a joining member owes one month's advance rent on top of their
   * first month (so their first bill is two months of rent). The advance is
   * held (User.advanceHeld) and credited back against their final bill when
   * they leave. Off/undefined = no advance. */
  advanceRentRequired?: boolean;
  /** Which meal slots this hostel cooks at all — some hostels don't cook
   * three times a day. Missing key/object = offered. Closing a slot only
   * affects TODAY onward (past days keep their data so accounts stay
   * correct); members see a closed slot as "always closed". */
  mealsOffered?: Partial<Record<MealSlot, boolean>>;
  /** Members may toggle a date directly until this time ("HH:MM") on the
   * PREVIOUS day; after that it takes a manager-approved request. Defaults to
   * "22:00" (see lib/utils/mealPolicy.ts). */
  mealToggleCutoff?: string;
}

export interface Hostel {
  id: string;
  name: string;
  /** Short display location ("Mirpur, Dhaka") — derived from `address` for
   * hostels created via the dropdowns; free text on legacy records. */
  area: string;
  /** Structured location (division/district/thana dropdowns). */
  address?: GeoAddress;
  ownerId: string;
  managerId: string;
  cookId?: string;
  /** DEPRECATED — the real per-meal cost is AUTOMATIC per month (total
   * shopping ÷ total meals, member + guest; see meals.getActualMealRate).
   * Nothing bills from this field; kept for legacy data only. */
  mealRate: number;
  kitchenLocation?: string;
  /** Fixed monthly salary for the hostel's cook (৳) — used to compute paid vs due. */
  cookMonthlySalary?: number;
  settings: HostelSettings;
  /** Super Admin suspended this hostel from the platform — a soft flag shown in
   * the admin directory; kept out of "active hostels" counts. */
  suspended?: boolean;
  /** The platform's Service Manager has verified this hostel (its details are
   * genuine) — shows a "Verified" badge to people browsing hostels to join. */
  verified?: boolean;
}

export type NewHostel = Omit<Hostel, "id">;

export interface MealEntry {
  on: boolean;
  guestCount: number;
}

export interface MealDay {
  hostelId: string;
  date: string; // YYYY-MM-DD
  entries: Record<string, Record<MealSlot, MealEntry>>; // userId -> slot -> entry
  shoppingUserId?: string;
  /** What the hostel offered ON THIS DAY — pinned per day, so changing the
   * hostel's current setting never rewrites a past day's counts. */
  mealsOffered?: Partial<Record<MealSlot, boolean>>;
  /** Set once the day arrived and every active boarder got an explicit row;
   * a sealed day's history is never re-derived. */
  sealed?: boolean;
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
  target: "menu" | "cook" | "manager";
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
  /** Each block is a date slot. For a spin rotation it starts empty and fills
   * as members spin to claim it, up to `groupSize` members (1 = solo, 2 =
   * companion pair). Cleaning duty is pre-assigned, so userIds is set upfront. */
  blocks: { userIds: string[]; dates: string[] }[];
  /** How many members share one block (1 individual, 2 companion) — a block's
   * capacity when members spin to claim it. Defaults to 1. */
  groupSize?: number;
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
  /** Manager must approve before this counts toward the month's actual meal
   * rate (see billing's mealRateFor) — an unreviewed number a member typed
   * in doesn't silently move everyone's bill. */
  status: "pending" | "approved" | "denied";
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
  /** Set when the request came from an existing signed-up account (the
   * find-hostel / QR flow) — approval then attaches THAT user to the hostel
   * instead of creating a new one. Absent for walk-ins the manager adds. */
  userId?: string;
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
  /** What approval sets these meals to. Absent/false = stop them (the
   * original behaviour); true = the member is asking to turn them back ON
   * because the toggle already locked for that date. */
  desiredOn?: boolean;
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
  feature: "jobs" | "learning" | "books" | "offers" | "cooks" | "investment" | "studyabroad";
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
  | { kind: "cook"; id: string; active: boolean; createdAt: string; areas?: GeoArea[]; name: string; cuisine: string; experienceYears: number; monthlyRate: number; rating: number; phone: string }
  | { kind: "job"; id: string; active: boolean; createdAt: string; areas?: GeoArea[]; title: string; company: string; location: string; jobType: string; pay: string; tags: string[] }
  | { kind: "course"; id: string; active: boolean; createdAt: string; areas?: GeoArea[]; title: string; provider: string; category: string; level: string; duration: string; price: string }
  | { kind: "offer"; id: string; active: boolean; createdAt: string; areas?: GeoArea[]; shop: string; title: string; discount: string; code: string; expires: string; category: string }
  | { kind: "hostel"; id: string; active: boolean; createdAt: string; areas?: GeoArea[]; name: string; area: string; seatRentFrom: number; seatsAvailable: number; rating: number; amenities: string[]; phone: string };

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

// ── Platform e-commerce (grocery + books store) ────────────────────────────

export type ProductKind = "grocery" | "book";

/** A platform-stocked item bought through the cart — a grocery product or a
 * NEW book. Managed by the Service Manager. `image` is an uploaded photo,
 * downscaled client-side and stored as a data URL (no external image hosts,
 * keeping the app static-export / CSP friendly); when absent the UI shows a
 * neutral per-kind icon. */
export interface Product {
  id: string;
  kind: ProductKind;
  name: string;
  price: number;
  category: string;
  image?: string;
  active: boolean;
  createdAt: string;
  /** Grocery only, e.g. "1 kg", "500 g", "per pcs". */
  unit?: string;
  /** Book only. */
  author?: string;
  /** Book only — Bangladesh academic class (see BD_ACADEMIC_CLASSES). */
  academicClass?: string;
  /** Where this product can be delivered; missing/empty = all of Bangladesh. */
  areas?: GeoArea[];
}

export type NewProduct = Omit<Product, "id" | "createdAt" | "active">;

/** One line in a user's persisted cart (survives reloads like everything else). */
export interface CartItem {
  id: string;
  userId: string;
  productId: string;
  qty: number;
}

export type PaymentMethod = "bKash" | "Nagad" | "Card" | "Cash";

/** A snapshot line item on a placed order — copied from the product so later
 * catalog edits never rewrite order history (same discipline as Bill sections). */
export interface OrderItem {
  productId: string;
  kind: ProductKind;
  name: string;
  qty: number;
  price: number;
}

export interface Order {
  id: string;
  userId: string;
  hostelId: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: PaymentMethod;
  status: "placed" | "confirmed" | "delivered" | "cancelled";
  /** Delivery address / note (defaults to the buyer's hostel + room). */
  note?: string;
  createdAt: string;
}

/** A member-listed OLD book — sold or given free by a student, bought by
 * contacting the seller directly (not through the cart). */
export interface UsedBookListing {
  id: string;
  hostelId: string;
  sellerId: string;
  sellerName: string;
  title: string;
  author: string;
  category: string;
  academicClass: string;
  condition: "Like new" | "Good" | "Fair";
  /** 0 when given away free. */
  price: number;
  free: boolean;
  phone: string;
  /** Optional seller-uploaded photo (downscaled data URL). */
  image?: string;
  createdAt: string;
}

export type NewUsedBook = Omit<UsedBookListing, "id" | "createdAt">;

// ── Study abroad hub ────────────────────────────────────────────────────────

/** Study-abroad content curated by the Service Manager, one discriminated
 * table across kinds:
 * - country: destination guide (tuition, living cost, work rights, intakes)
 * - scholarship: a scholarship members can aim for
 * - counsellor: a platform counsellor members call directly for consultation
 * - promo: a promotional photo card pushed to members (adding one also sends
 *   every hostel member a notification) */
export type StudyAbroadItem =
  | { kind: "country"; id: string; active: boolean; createdAt: string; name: string; flag: string; overview: string; tuition: string; livingCost: string; workRights: string; intakes: string; universities: string; visa: string; ielts: string; image?: string }
  | { kind: "scholarship"; id: string; active: boolean; createdAt: string; name: string; country: string; coverage: string; deadline: string; eligibility: string }
  | { kind: "counsellor"; id: string; active: boolean; createdAt: string; name: string; countries: string; experienceYears: number; phone: string; image?: string }
  | { kind: "promo"; id: string; active: boolean; createdAt: string; title: string; tagline: string; image?: string }
  /** A country-tagged article members read from that country's detail view. */
  | { kind: "blog"; id: string; active: boolean; createdAt: string; title: string; country: string; excerpt: string; body: string; author: string; image?: string };

export type StudyAbroadKind = StudyAbroadItem["kind"];
export type NewStudyAbroadItem = DistributiveOmit<StudyAbroadItem, "id" | "createdAt" | "active">;

/** A member's "check your eligibility" submission — a study-abroad lead the
 * Service Manager follows up on (and exports to Excel). */
export interface StudyLead {
  id: string;
  userId: string;
  name: string;
  phone: string;
  email: string;
  lastAcademic: string;
  englishTest: string;
  interestedCountry: string;
  subjects: string;
  contacted: boolean;
  createdAt: string;
}

export type NewStudyLead = Omit<StudyLead, "id" | "createdAt" | "contacted">;

/** Service-Manager-controlled settings for the promotional carousel on every
 * member's homepage: which card types appear, how long each slide shows, and
 * the photo card height in px. */
export interface HeroPromoSettings {
  sources: {
    study: boolean;
    offers: boolean;
    grocery: boolean;
    books: boolean;
  };
  /** Seconds each slide stays before auto-advancing (2–15). */
  intervalSec: number;
  /** Rendered height of the photo cards in px (120–240). */
  photoHeightPx: number;
}

// Repository interfaces — the seam between UI/hooks and whichever data
// backend is plugged in. Every method returns a Promise (even though the
// mock implementation resolves synchronously) and every aggregate exposes a
// `subscribe` method modeled loosely on Supabase Realtime / Firestore
// listeners, so swapping the mock for a real backend later only requires a
// new implementation of these same interfaces — nothing else in the app
// should change.

import type {
  ActivityLog,
  Announcement,
  Bill,
  BillAdjustment,
  BillTarget,
  Campaign,
  Comment,
  CommunityPost,
  CookAttendanceReport,
  CookAttendanceVote,
  CookLeaveRequest,
  DutyPlan,
  Expense,
  ExploreInteraction,
  GeoArea,
  GuestMealRequest,
  HeroPromoSettings,
  Hostel,
  HostelTransferRequest,
  JoinRequest,
  LeaveRequest,
  MarketingTarget,
  MealDay,
  MealEditRequest,
  MealEditVote,
  MealSlot,
  MealStopRequest,
  Menu,
  NewHostel,
  NewProduct,
  NewUsedBook,
  Notification,
  Order,
  CartItem,
  PaymentMethod,
  Payment,
  Product,
  ProductKind,
  Rating,
  NewServiceListing,
  Reaction,
  Room,
  ServiceKind,
  ServiceListing,
  ShoppingCost,
  ShortageRequest,
  SignupInput,
  Stars,
  NewStudyAbroadItem,
  NewStudyLead,
  StudyAbroadItem,
  StudyLead,
  SwapRequest,
  UsedBookListing,
  User,
} from "./types";

type Unsubscribe = () => void;

export interface UserRepository {
  getUser(userId: string): Promise<User | undefined>;
  listByHostel(hostelId: string): Promise<User[]>;
  listAll(): Promise<User[]>;
  /** Creates a user record directly — used by the owner when adding a hostel
   * (its manager/cook) or assigning new staff. Boarders still arrive through
   * join requests, not this. Staff-only: it can set ANY role, so it is NOT
   * the public sign-up path — see `signup`. */
  create(user: Omit<User, "id">): Promise<User>;
  /** Public account creation. Accepts only the fields in SignupInput and
   * always produces a hostel-less student/owner, so the unauthenticated
   * signup endpoint can't be used to mint a privileged account. Rejects a
   * phone number that already has an account. */
  signup(input: SignupInput): Promise<User>;
  /** True when no account uses this phone number yet — lets the signup form
   * check availability without pulling down everyone's details. */
  phoneAvailable(phone: string): Promise<boolean>;
  updateUser(userId: string, patch: Partial<User>): Promise<void>;
  /** Ban/un-ban a member from their hostel. Banning evicts them from their
   * room seat and turns meals off; the user record is kept so they can still
   * switch/transfer to another hostel. */
  setBanned(userId: string, banned: boolean): Promise<void>;
  /** Hard-remove a member from the hostel and free their room seat. */
  remove(userId: string): Promise<void>;
  /** Manager's conduct/reliability rating of a member (1–5 + optional note). */
  rate(userId: string, stars: Stars, note?: string): Promise<void>;
  /** Makes an existing account a member of this hostel with a room seat in
   * one step — the manager/owner scanning a member's QR code. Vacates any
   * previous seat, resolves the member's pending join requests, and rejects
   * (throws) if they already belong to a DIFFERENT hostel: a member can only
   * ever be one hostel's member (moving hostels goes through transfers). */
  attachToHostel(userId: string, hostelId: string, roomId: string): Promise<void>;
  /** Super Admin assigns which service-catalog kinds and regions a Service
   * Manager account is responsible for. Informational only for now — not
   * yet enforced in app/service/*, which still shows everything to any
   * Service Manager regardless. Superadmin-only (see policy.ts). */
  setServicePermissions(
    userId: string,
    permissions: { kinds: ServiceKind[]; areas: GeoArea[] }
  ): Promise<void>;
  subscribe(hostelId: string, cb: (users: User[]) => void): Unsubscribe;
  /** Live mirror of ONE user's record — fires on any change to that user
   * (profile edits, join approval, ban, room moves), regardless of which
   * hostel they're in (or none). The session provider uses this. */
  subscribeUser(userId: string, cb: (user: User) => void): Unsubscribe;
}

export interface RoomRepository {
  listByHostel(hostelId: string): Promise<Room[]>;
  /** Assigns a member to a room — also vacates them from any room they were
   * already in, so this doubles as a room-to-room move. */
  assignMember(roomId: string, userId: string): Promise<void>;
  /** Removes a member from whatever room they occupy (clears their seat). */
  vacate(userId: string): Promise<void>;
  create(room: Omit<Room, "id" | "occupantIds">): Promise<void>;
  update(
    roomId: string,
    patch: Partial<Pick<Room, "number" | "capacity" | "seatRent" | "facilities">>
  ): Promise<void>;
  subscribe(hostelId: string, cb: (rooms: Room[]) => void): Unsubscribe;
}

export interface HostelRepository {
  getHostel(hostelId: string): Promise<Hostel | undefined>;
  listByOwner(ownerId: string): Promise<Hostel[]>;
  listAll(): Promise<Hostel[]>;
  /** Owner creates a new hostel. */
  create(hostel: NewHostel): Promise<Hostel>;
  /** Owner edits top-level hostel fields (staff assignment, meal rate, …) —
   * settings changes go through updateSettings instead. */
  update(
    hostelId: string,
    patch: Partial<Omit<Hostel, "id" | "settings">>
  ): Promise<void>;
  /** Hands the manager role to another BOARDER of this hostel: the new
   * manager's account becomes role "manager", and the outgoing manager
   * reverts to a regular boarder (keeps their room and meals). The new
   * manager must currently be a non-banned boarder of THIS hostel — throws
   * otherwise. Owner does this from staff/member screens; a manager may too
   * when granted the `assignManager` permission. */
  changeManager(hostelId: string, newManagerId: string): Promise<void>;
  /** Sets this hostel's manager — the owner's primary way to staff a hostel
   * that was created without one. Either creates a brand-new manager account
   * (`mode: "new"`, default password = their phone number), or promotes an
   * EXISTING platform account (`mode: "existing"`) — a current boarder here,
   * or an account with no hostel yet; rejects an account already tied to a
   * different hostel (one-hostel rule). Whichever manager was there before is
   * demoted to a regular boarder in the same step. Owner/superadmin only. */
  assignManager(
    hostelId: string,
    manager:
      | { mode: "new"; name: string; phone: string }
      | { mode: "existing"; userId: string }
  ): Promise<void>;
  /** Strips the manager role WITHOUT naming a replacement — the outgoing
   * manager reverts to a regular boarder (keeps their room and meals) and the
   * hostel is left with no manager until one is assigned. This is what lets an
   * OWNER remove a manager who has no successor lined up; the manager can then
   * be moved/banned/removed like any other member. Owner/superadmin only — a
   * manager can't demote themselves this way (they'd hand over via
   * changeManager instead). */
  demoteManager(hostelId: string): Promise<void>;
  /** Adds, replaces, or removes this hostel's cook — the one safe, narrow
   * path for it (rather than the raw `users.create`, which can mint ANY
   * role and is owner/superadmin-only). Whatever cook was previously
   * assigned is detached (hostelId/roomId cleared; their account and
   * "cook" role are kept, so they can be reassigned elsewhere later) before
   * the new one (if any) is attached. "existing" only accepts a user who is
   * already role "cook" AND not currently staffing a different hostel —
   * throws otherwise. Owner does this from the staff screen; a manager may
   * too, from the members screen. */
  assignCook(
    hostelId: string,
    cook:
      | { mode: "new"; name: string; phone: string; salary?: number }
      | { mode: "existing"; userId: string; salary?: number }
      | { mode: "remove" }
  ): Promise<void>;
  updateSettings(hostelId: string, patch: Partial<Hostel["settings"]>): Promise<void>;
  /** Master meal on/off (manager or owner): sets whether the hostel offers a
   * meal slot at all. Closing also turns that slot off on every stored day
   * from TODAY onward — past days are untouched so accounts stay correct. */
  setMealOffered(hostelId: string, meal: MealSlot, offered: boolean): Promise<void>;
  /** Super Admin suspend/reactivate a hostel on the platform. */
  setSuspended(hostelId: string, suspended: boolean): Promise<void>;
  /** Service Manager marks a hostel's details as verified (or removes it). */
  setVerified(hostelId: string, verified: boolean): Promise<void>;
  subscribe(hostelId: string, cb: (hostel: Hostel) => void): Unsubscribe;
  /** Fires on any hostel-list change (create/update/suspend). */
  subscribeAll(cb: (hostels: Hostel[]) => void): Unsubscribe;
}

export interface MealRepository {
  /** The AUTOMATIC per-meal cost for a month: total shopping spend ÷ total
   * meals eaten (member + guest, current boarders). This — not any manual
   * setting — is what bills charge per meal. Zero when no meals yet. */
  getActualMealRate(
    hostelId: string,
    month: string
  ): Promise<{ rate: number; totalShopping: number; totalMeals: number }>;
  getMealDay(hostelId: string, date: string): Promise<MealDay>;
  listMealDays(
    hostelId: string,
    range: { from: string; to: string }
  ): Promise<MealDay[]>;
  /** One member's own meals for a month, so they can see them live without a
   * generated bill: `mealsOn` = meals they have on (member + guest) from their
   * join date; `billedMeals` = only those the manager has confirmed cooked
   * (what the bill charges); `cost` = billedMeals × the actual rate. */
  getMemberMealSummary(
    hostelId: string,
    userId: string,
    month: string
  ): Promise<{ mealsOn: number; billedMeals: number; cost: number }>;
  /** A member changing their OWN meal. Rejects dates past their cutoff —
   * today and any locked future date must go through an approved request
   * (see lib/utils/mealPolicy.ts for the rule). */
  setMemberMealToggle(
    hostelId: string,
    userId: string,
    date: string,
    meal: MealSlot,
    on: boolean
  ): Promise<void>;
  /** Manager/owner applying an approved change — bypasses the member cutoff.
   * Still can't switch on a slot the day didn't offer. */
  setMemberMealApproved(
    hostelId: string,
    userId: string,
    date: string,
    meal: MealSlot,
    on: boolean
  ): Promise<void>;
  addGuestMeal(
    hostelId: string,
    userId: string,
    date: string,
    meal: MealSlot,
    count: number
  ): Promise<void>;
  /** Turns all meals on/off for one member across every day from `from`
   * through `to` (inclusive) — used by the manager to suspend a member's
   * meals for an unpaid bill. Also sets `User.mealsSuspended` (locking the
   * member's own toggles while true) and sends them a notification
   * explaining why. */
  setMemberMealsForRange(
    hostelId: string,
    userId: string,
    from: string,
    to: string,
    on: boolean
  ): Promise<void>;
  /** The member's own "turn my future meals off / on" switch (User.
   * futureMealsOff). While off, every future day defaults their meals to OFF
   * until they turn a specific day back on. Applies immediately to the days
   * they can already freely change (day after tomorrow onward); today and
   * tomorrow stay cutoff-gated and still need a request. */
  setMemberFutureMeals(hostelId: string, userId: string, off: boolean): Promise<void>;
  subscribe(hostelId: string, cb: (day: MealDay) => void): Unsubscribe;
}

export interface MenuRepository {
  getMenu(hostelId: string, date: string): Promise<Menu | undefined>;
  saveMenu(hostelId: string, date: string, dishes: Menu["dishes"]): Promise<void>;
  subscribe(hostelId: string, cb: (menu: Menu) => void): Unsubscribe;
}

export interface RatingRepository {
  listForDate(hostelId: string, date: string): Promise<Rating[]>;
  listByHostel(hostelId: string): Promise<Rating[]>;
  rate(rating: Omit<Rating, "id">): Promise<void>;
  subscribe(hostelId: string, cb: (ratings: Rating[]) => void): Unsubscribe;
}

export interface CommentRepository {
  listForDate(hostelId: string, date: string): Promise<Comment[]>;
  addComment(comment: Omit<Comment, "id" | "createdAt">): Promise<void>;
  listReactions(commentId: string): Promise<Reaction[]>;
  toggleReaction(commentId: string, userId: string, emoji: string): Promise<void>;
  subscribe(hostelId: string, cb: () => void): Unsubscribe;
}

export interface DutyRepository {
  listByHostel(hostelId: string): Promise<DutyPlan[]>;
  createPlan(
    plan: Omit<DutyPlan, "id" | "spun" | "createdAt">
  ): Promise<DutyPlan>;
  /** The member claims a still-open block by spinning. Returns the position
   * (index) of the block they landed on, or -1 if the rotation is full. */
  spin(planId: string, userId: string): Promise<number>;
  subscribe(hostelId: string, cb: (plans: DutyPlan[]) => void): Unsubscribe;
}

export interface SwapRepository {
  listByPlan(planId: string): Promise<SwapRequest[]>;
  request(swap: Omit<SwapRequest, "id" | "status" | "createdAt">): Promise<void>;
  resolve(swapId: string, status: "accepted" | "denied" | "cancelled"): Promise<void>;
  subscribe(hostelId: string, cb: (swaps: SwapRequest[]) => void): Unsubscribe;
}

export interface ShoppingCostRepository {
  listByHostel(hostelId: string): Promise<ShoppingCost[]>;
  submit(cost: Omit<ShoppingCost, "id" | "createdAt" | "status">): Promise<void>;
  /** Manager approve/deny — only 'approved' spend counts toward the actual meal rate. */
  decide(id: string, status: "approved" | "denied"): Promise<void>;
}

export interface ShortageRepository {
  listByHostel(hostelId: string): Promise<ShortageRequest[]>;
  report(req: Omit<ShortageRequest, "id" | "status" | "createdAt">): Promise<void>;
  resolve(id: string, resolvedBy: string): Promise<void>;
  subscribe(hostelId: string, cb: (list: ShortageRequest[]) => void): Unsubscribe;
}

export interface BillRepository {
  getBill(hostelId: string, userId: string, month: string): Promise<Bill | undefined>;
  listByHostel(hostelId: string, month: string): Promise<Bill[]>;
  listPayments(billId: string): Promise<Payment[]>;
  pay(payment: Omit<Payment, "id">): Promise<void>;
  listPendingVerification(hostelId: string, month: string): Promise<Payment[]>;
  decidePayment(paymentId: string, status: "verified" | "declined"): Promise<void>;
  /** Computes bills for every boarder in the hostel for hostelId/month from
   * meal attendance, room seat rent, selected Utilities expenses, and
   * selected Salary expenses (cook salary) — each split per its own
   * memberIds/splitMode (see Expense), exactly the same way for both —
   * replacing any existing bills for that month while preserving what's
   * already been paid. Who owes what follows entirely from how each expense
   * was set up when it was added (its own member selection and fixed/equal
   * split), not a separate scope chosen here. Any unpaid balance on a
   * member's immediately preceding month's bill is carried forward as
   * `previousBalance`, added on top of this month's fresh charges. */
  generateBills(
    hostelId: string,
    month: string,
    options?: {
      /** Utilities-category expense ids to include as service charge; omit for all. */
      includeServiceExpenseIds?: string[];
      /** Salary-category expense ids to include as cook salary; omit for all. */
      includeSalaryExpenseIds?: string[];
      /** Last day to pay this batch of bills, e.g. "2026-07-15". */
      dueDate?: string;
      /** Which month the room-rent line covers, e.g. "2026-08" — labels the
       * rent line and defaults to the bill's own month. Lets a hostel that
       * collects rent for a specific (often the next) month say so on the bill. */
      rentMonth?: string;
    }
  ): Promise<Bill[]>;
  /** Credits a leaving member's held advance rent (User.advanceHeld) against
   * their latest bill and clears it — the "adjusted on leave" settlement. */
  applyAdvanceOnLeave(hostelId: string, userId: string): Promise<void>;
  /** Settles some or all of a member's meal-cost credit — money the hostel
   * never keeps a share of. `destination: "refund"` records it as paid back
   * to the member in cash; any other `BillTarget` moves it to cover that
   * category's due on the same bill instead (or the previous-month balance). */
  settleMealCredit(billId: string, amount: number, destination: BillTarget | "refund"): Promise<void>;
  listAdjustments(billId: string): Promise<BillAdjustment[]>;
  subscribe(userId: string, cb: (bill: Bill) => void): Unsubscribe;
}

export interface CookLeaveRepository {
  listByHostel(hostelId: string): Promise<CookLeaveRequest[]>;
  request(
    req: Omit<CookLeaveRequest, "id" | "status" | "createdAt">
  ): Promise<void>;
  decide(id: string, status: "approved" | "denied", decidedBy: string): Promise<void>;
  subscribe(hostelId: string, cb: (reqs: CookLeaveRequest[]) => void): Unsubscribe;
}

export interface CookAttendanceRepository {
  listForDate(hostelId: string, date: string): Promise<CookAttendanceReport[]>;
  listByHostel(hostelId: string): Promise<CookAttendanceReport[]>;
  report(req: Omit<CookAttendanceReport, "id" | "createdAt">): Promise<CookAttendanceReport>;
  markCooked(hostelId: string, date: string, meal: MealSlot): Promise<void>;
  vote(reportId: string, userId: string, choice: CookAttendanceVote["choice"]): Promise<void>;
  listVotes(reportId: string): Promise<CookAttendanceVote[]>;
  confirmAbsent(reportId: string): Promise<void>;
  subscribe(hostelId: string, cb: () => void): Unsubscribe;
}

export interface MealEditRepository {
  listByHostel(hostelId: string): Promise<MealEditRequest[]>;
  /** Creates the request and posts a hostel-wide vote-poll announcement. */
  request(req: Omit<MealEditRequest, "id" | "status" | "createdAt">): Promise<void>;
  /** Records the vote and auto-approves once yes votes reach half the
   * hostel's boarders (excluding cook/owner). */
  vote(requestId: string, userId: string, choice: MealEditVote["choice"]): Promise<void>;
  listVotes(requestId: string): Promise<MealEditVote[]>;
  withdraw(requestId: string): Promise<void>;
  subscribe(hostelId: string, cb: (list: MealEditRequest[]) => void): Unsubscribe;
}

export interface AnnouncementRepository {
  listByHostel(hostelId: string): Promise<Announcement[]>;
  post(a: Omit<Announcement, "id" | "createdAt">): Promise<Announcement>;
  update(id: string, patch: Partial<Announcement>): Promise<void>;
  subscribe(hostelId: string, cb: (list: Announcement[]) => void): Unsubscribe;
}

export interface NotificationRepository {
  listByUser(userId: string): Promise<Notification[]>;
  /** Pushes a notification directly (e.g. the month-end report reminder). */
  create(n: Omit<Notification, "id" | "read" | "createdAt">): Promise<void>;
  markRead(id: string): Promise<void>;
  subscribe(userId: string, cb: (list: Notification[]) => void): Unsubscribe;
}

export interface ExpenseRepository {
  listByHostel(hostelId: string): Promise<Expense[]>;
  add(expense: Omit<Expense, "id">): Promise<void>;
  remove(id: string): Promise<void>;
  subscribe(hostelId: string, cb: (list: Expense[]) => void): Unsubscribe;
}

export interface TransferRepository {
  listByHostel(hostelId: string): Promise<HostelTransferRequest[]>;
  request(req: Omit<HostelTransferRequest, "id" | "stage" | "timeline">): Promise<void>;
  advance(id: string, decidedBy: string, approve: boolean): Promise<void>;
  cancel(id: string): Promise<void>;
  subscribe(hostelId: string, cb: (list: HostelTransferRequest[]) => void): Unsubscribe;
}

export interface LeaveRequestRepository {
  listByHostel(hostelId: string): Promise<LeaveRequest[]>;
  listByUser(userId: string): Promise<LeaveRequest[]>;
  /** Rejects (throws) a leaveDate under 30 days from today. */
  request(req: { hostelId: string; userId: string; leaveDate: string; reason?: string }): Promise<void>;
  decide(id: string, status: "approved" | "denied", decidedBy: string): Promise<void>;
  /** Withdraws a still-pending request; no-ops on an already-decided one. */
  cancel(id: string): Promise<void>;
  subscribe(hostelId: string, cb: (list: LeaveRequest[]) => void): Unsubscribe;
}

export interface JoinRequestRepository {
  listByHostel(hostelId: string): Promise<JoinRequest[]>;
  /** All requests made by one signed-up account (the find-hostel flow). */
  listByUser(userId: string): Promise<JoinRequest[]>;
  create(req: Omit<JoinRequest, "id" | "status" | "createdAt">): Promise<void>;
  decide(id: string, status: "approved" | "denied", roomId?: string): Promise<void>;
  subscribe(hostelId: string, cb: (list: JoinRequest[]) => void): Unsubscribe;
}

export interface MealStopRepository {
  listByHostel(hostelId: string): Promise<MealStopRequest[]>;
  request(req: Omit<MealStopRequest, "id" | "status">): Promise<void>;
  decide(id: string, status: "approved" | "denied"): Promise<void>;
  subscribe(hostelId: string, cb: (list: MealStopRequest[]) => void): Unsubscribe;
}

export interface GuestMealRepository {
  listByHostel(hostelId: string): Promise<GuestMealRequest[]>;
  request(req: Omit<GuestMealRequest, "id" | "status">): Promise<void>;
  decide(id: string, status: "approved" | "denied"): Promise<void>;
  subscribe(hostelId: string, cb: (list: GuestMealRequest[]) => void): Unsubscribe;
}

export interface ExploreInteractionRepository {
  listByUser(userId: string): Promise<ExploreInteraction[]>;
  /** Toggle a user's action on an /explore item — adds it if absent, removes it if present. */
  toggle(userId: string, feature: ExploreInteraction["feature"], itemId: string, kind: ExploreInteraction["kind"]): Promise<void>;
  subscribe(userId: string, cb: (list: ExploreInteraction[]) => void): Unsubscribe;
}

export interface CommunityRepository {
  listAll(): Promise<CommunityPost[]>;
  post(post: Omit<CommunityPost, "id" | "createdAt" | "likeUserIds">): Promise<void>;
  toggleLike(postId: string, userId: string): Promise<void>;
  /** Service Manager moderation — remove a community post. */
  remove(postId: string): Promise<void>;
  subscribe(cb: (list: CommunityPost[]) => void): Unsubscribe;
}

export interface ServiceCatalogRepository {
  listByKind(kind: ServiceKind): Promise<ServiceListing[]>;
  listAll(): Promise<ServiceListing[]>;
  add(listing: NewServiceListing): Promise<void>;
  update(id: string, patch: Partial<ServiceListing>): Promise<void>;
  toggleActive(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  subscribe(cb: (list: ServiceListing[]) => void): Unsubscribe;
}

export interface CampaignRepository {
  listAll(): Promise<Campaign[]>;
  create(campaign: Omit<Campaign, "id">): Promise<void>;
  updateStatus(id: string, status: Campaign["status"]): Promise<void>;
  remove(id: string): Promise<void>;
  subscribe(cb: (list: Campaign[]) => void): Unsubscribe;
}

export interface MarketingRepository {
  listTargets(month: string): Promise<MarketingTarget[]>;
  setTarget(metric: string, month: string, target: number): Promise<void>;
  subscribe(cb: () => void): Unsubscribe;
}

export interface ProductRepository {
  listByKind(kind: ProductKind): Promise<Product[]>;
  listAll(): Promise<Product[]>;
  add(product: NewProduct): Promise<void>;
  update(id: string, patch: Partial<Product>): Promise<void>;
  toggleActive(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  subscribe(cb: (list: Product[]) => void): Unsubscribe;
}

export interface CartRepository {
  listByUser(userId: string): Promise<CartItem[]>;
  /** Adds `qty` of a product (increments the line if it already exists). */
  add(userId: string, productId: string, qty?: number): Promise<void>;
  /** Sets an exact quantity; a qty of 0 removes the line. */
  setQty(userId: string, productId: string, qty: number): Promise<void>;
  remove(userId: string, productId: string): Promise<void>;
  clear(userId: string): Promise<void>;
  subscribe(userId: string, cb: (list: CartItem[]) => void): Unsubscribe;
}

export interface OrderRepository {
  listByUser(userId: string): Promise<Order[]>;
  /** Every order across the platform — Service Manager order management. */
  listAll(): Promise<Order[]>;
  /** Snapshots the user's cart into a new order (computing subtotal, delivery
   * fee, and total), clears the cart, and returns the placed order. */
  place(
    userId: string,
    details: { paymentMethod: PaymentMethod; note?: string }
  ): Promise<Order>;
  /** Service Manager advances/cancels an order (placed → confirmed → delivered,
   * or cancelled) — the buyer sees the change live on their orders page. */
  updateStatus(orderId: string, status: Order["status"]): Promise<void>;
  subscribe(userId: string, cb: (list: Order[]) => void): Unsubscribe;
  subscribeAll(cb: (list: Order[]) => void): Unsubscribe;
}

export interface StudyAbroadRepository {
  listAll(): Promise<StudyAbroadItem[]>;
  /** Adds an item. Adding a PROMO also sends every hostel member a
   * notification — the promotional photo card push. */
  add(item: NewStudyAbroadItem): Promise<void>;
  update(id: string, patch: Partial<StudyAbroadItem>): Promise<void>;
  toggleActive(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  subscribe(cb: (list: StudyAbroadItem[]) => void): Unsubscribe;
}

export interface PromoSettingsRepository {
  get(): Promise<HeroPromoSettings>;
  update(patch: Partial<HeroPromoSettings>): Promise<void>;
  subscribe(cb: (settings: HeroPromoSettings) => void): Unsubscribe;
}

export interface StudyLeadRepository {
  listAll(): Promise<StudyLead[]>;
  /** Member submits the "check your eligibility" form. */
  add(lead: NewStudyLead): Promise<void>;
  setContacted(id: string, contacted: boolean): Promise<void>;
  remove(id: string): Promise<void>;
  subscribe(cb: (list: StudyLead[]) => void): Unsubscribe;
}

export interface UsedBookRepository {
  listAll(): Promise<UsedBookListing[]>;
  add(book: NewUsedBook): Promise<void>;
  /** Seller delists their own book (or Service Manager moderates one). */
  remove(id: string): Promise<void>;
  subscribe(cb: (list: UsedBookListing[]) => void): Unsubscribe;
}

export interface ActivityRepository {
  listByHostel(hostelId: string): Promise<ActivityLog[]>;
  /** Records one audited hostel action for the owner's activity log. */
  log(entry: Omit<ActivityLog, "id" | "createdAt">): Promise<void>;
  subscribe(hostelId: string, cb: (list: ActivityLog[]) => void): Unsubscribe;
}

export interface Repositories {
  users: UserRepository;
  activity: ActivityRepository;
  rooms: RoomRepository;
  hostels: HostelRepository;
  meals: MealRepository;
  menus: MenuRepository;
  ratings: RatingRepository;
  comments: CommentRepository;
  duties: DutyRepository;
  swaps: SwapRepository;
  shoppingCosts: ShoppingCostRepository;
  shortages: ShortageRepository;
  bills: BillRepository;
  cookLeave: CookLeaveRepository;
  cookAttendance: CookAttendanceRepository;
  mealEdits: MealEditRepository;
  announcements: AnnouncementRepository;
  notifications: NotificationRepository;
  expenses: ExpenseRepository;
  transfers: TransferRepository;
  joinRequests: JoinRequestRepository;
  leaveRequests: LeaveRequestRepository;
  mealStops: MealStopRepository;
  guestMeals: GuestMealRepository;
  exploreInteractions: ExploreInteractionRepository;
  community: CommunityRepository;
  serviceCatalog: ServiceCatalogRepository;
  campaigns: CampaignRepository;
  marketing: MarketingRepository;
  products: ProductRepository;
  cart: CartRepository;
  orders: OrderRepository;
  usedBooks: UsedBookRepository;
  studyAbroad: StudyAbroadRepository;
  studyLeads: StudyLeadRepository;
  promoSettings: PromoSettingsRepository;
}

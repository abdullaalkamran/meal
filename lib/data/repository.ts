// Repository interfaces — the seam between UI/hooks and whichever data
// backend is plugged in. Every method returns a Promise (even though the
// mock implementation resolves synchronously) and every aggregate exposes a
// `subscribe` method modeled loosely on Supabase Realtime / Firestore
// listeners, so swapping the mock for a real backend later only requires a
// new implementation of these same interfaces — nothing else in the app
// should change.

import type {
  Announcement,
  Bill,
  BillAdjustment,
  BillTarget,
  Comment,
  CookAttendanceReport,
  CookAttendanceVote,
  CookLeaveRequest,
  DutyPlan,
  Expense,
  GuestMealRequest,
  Hostel,
  HostelTransferRequest,
  JoinRequest,
  MealDay,
  MealEditRequest,
  MealEditVote,
  MealSlot,
  MealStopRequest,
  Menu,
  Notification,
  Payment,
  Rating,
  Reaction,
  Room,
  ShoppingCost,
  ShortageRequest,
  SwapRequest,
  User,
} from "./types";

type Unsubscribe = () => void;

export interface UserRepository {
  getUser(userId: string): Promise<User | undefined>;
  listByHostel(hostelId: string): Promise<User[]>;
  listAll(): Promise<User[]>;
  updateUser(userId: string, patch: Partial<User>): Promise<void>;
  subscribe(hostelId: string, cb: (users: User[]) => void): Unsubscribe;
}

export interface RoomRepository {
  listByHostel(hostelId: string): Promise<Room[]>;
  assignMember(roomId: string, userId: string): Promise<void>;
  subscribe(hostelId: string, cb: (rooms: Room[]) => void): Unsubscribe;
}

export interface HostelRepository {
  getHostel(hostelId: string): Promise<Hostel | undefined>;
  listByOwner(ownerId: string): Promise<Hostel[]>;
  listAll(): Promise<Hostel[]>;
  updateSettings(hostelId: string, patch: Partial<Hostel["settings"]>): Promise<void>;
  subscribe(hostelId: string, cb: (hostel: Hostel) => void): Unsubscribe;
}

export interface MealRepository {
  getMealDay(hostelId: string, date: string): Promise<MealDay>;
  listMealDays(
    hostelId: string,
    range: { from: string; to: string }
  ): Promise<MealDay[]>;
  setMemberMealToggle(
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
  spin(planId: string, userId: string): Promise<void>;
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
  submit(cost: Omit<ShoppingCost, "id" | "createdAt">): Promise<void>;
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
    }
  ): Promise<Bill[]>;
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

export interface JoinRequestRepository {
  listByHostel(hostelId: string): Promise<JoinRequest[]>;
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

export interface Repositories {
  users: UserRepository;
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
  mealStops: MealStopRepository;
  guestMeals: GuestMealRepository;
}

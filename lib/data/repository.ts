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
  MealSlot,
  MealStopRequest,
  Menu,
  Notification,
  Payment,
  Rating,
  Reaction,
  Room,
  ShoppingCost,
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
  subscribe(hostelId: string, cb: (day: MealDay) => void): Unsubscribe;
}

export interface MenuRepository {
  getMenu(hostelId: string, date: string): Promise<Menu | undefined>;
  saveMenu(hostelId: string, date: string, dishes: Menu["dishes"]): Promise<void>;
  subscribe(hostelId: string, cb: (menu: Menu) => void): Unsubscribe;
}

export interface RatingRepository {
  listForDate(hostelId: string, date: string): Promise<Rating[]>;
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

export interface BillRepository {
  getBill(hostelId: string, userId: string, month: string): Promise<Bill | undefined>;
  listByHostel(hostelId: string, month: string): Promise<Bill[]>;
  listPayments(billId: string): Promise<Payment[]>;
  pay(payment: Omit<Payment, "id">): Promise<void>;
  listPendingVerification(hostelId: string, month: string): Promise<Payment[]>;
  decidePayment(paymentId: string, status: "verified" | "declined"): Promise<void>;
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
  report(req: Omit<CookAttendanceReport, "id" | "createdAt">): Promise<CookAttendanceReport>;
  markCooked(hostelId: string, date: string, meal: MealSlot): Promise<void>;
  vote(reportId: string, userId: string, choice: CookAttendanceVote["choice"]): Promise<void>;
  listVotes(reportId: string): Promise<CookAttendanceVote[]>;
  confirmAbsent(reportId: string): Promise<void>;
  subscribe(hostelId: string, cb: () => void): Unsubscribe;
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
  bills: BillRepository;
  cookLeave: CookLeaveRepository;
  cookAttendance: CookAttendanceRepository;
  announcements: AnnouncementRepository;
  notifications: NotificationRepository;
  expenses: ExpenseRepository;
  transfers: TransferRepository;
  joinRequests: JoinRequestRepository;
  mealStops: MealStopRepository;
  guestMeals: GuestMealRepository;
}

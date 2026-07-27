// The mock "backend": in-memory tables + localStorage persistence + a tiny
// pub/sub, standing in for a real database until one is chosen. Nothing
// outside lib/data/ should import this file directly (enforced by an
// eslint no-restricted-imports rule) — always go through `repo` in
// lib/data/index.ts so a real backend can replace this file later without
// touching UI code.

import type {
  ActivityLog,
  Announcement,
  Bill,
  BillAdjustment,
  Campaign,
  Comment,
  CommunityPost,
  CookAttendanceReport,
  CookAttendanceVote,
  CookLeaveRequest,
  Coupon,
  DutyPlan,
  Expense,
  ExploreInteraction,
  GuestMealRequest,
  HeroPromoSettings,
  PasswordResetOtp,
  SmtpSettings,
  Hostel,
  HostelTransferRequest,
  JoinRequest,
  LeaveRequest,
  MarketingTarget,
  MealDay,
  MealEditRequest,
  MealEditVote,
  MealStopRequest,
  Menu,
  Notification,
  Order,
  CartItem,
  Payment,
  Product,
  Promotion,
  Rating,
  Reaction,
  Room,
  ServiceListing,
  ShoppingCost,
  ShoppingCostEditRequest,
  ShoppingCostEditVote,
  ShortageRequest,
  StoreSettings,
  StudyAbroadItem,
  StudyLead,
  SwapRequest,
  UsedBookListing,
  User,
} from "../types";
import { SCHEMA_VERSION, STORAGE_KEY } from "../schema";
import { buildSeed } from "./seed";

export interface Tables {
  users: User[];
  activityLogs: ActivityLog[];
  rooms: Room[];
  hostels: Hostel[];
  mealDays: MealDay[];
  menus: Menu[];
  ratings: Rating[];
  comments: Comment[];
  reactions: Reaction[];
  dutyPlans: DutyPlan[];
  swapRequests: SwapRequest[];
  shoppingCosts: ShoppingCost[];
  shoppingCostEditRequests: ShoppingCostEditRequest[];
  shoppingCostEditVotes: ShoppingCostEditVote[];
  shortageRequests: ShortageRequest[];
  bills: Bill[];
  payments: Payment[];
  billAdjustments: BillAdjustment[];
  cookLeaveRequests: CookLeaveRequest[];
  cookAttendanceReports: CookAttendanceReport[];
  cookAttendanceVotes: CookAttendanceVote[];
  mealEditRequests: MealEditRequest[];
  mealEditVotes: MealEditVote[];
  announcements: Announcement[];
  notifications: Notification[];
  pushSubscriptions: { id: string; userId: string; endpoint: string; p256dh: string; auth: string; createdAt: string }[];
  promotions: Promotion[];
  expenses: Expense[];
  transferRequests: HostelTransferRequest[];
  joinRequests: JoinRequest[];
  leaveRequests: LeaveRequest[];
  mealStopRequests: MealStopRequest[];
  guestMealRequests: GuestMealRequest[];
  exploreInteractions: ExploreInteraction[];
  communityPosts: CommunityPost[];
  serviceListings: ServiceListing[];
  campaigns: Campaign[];
  marketingTargets: MarketingTarget[];
  products: Product[];
  cartItems: CartItem[];
  orders: Order[];
  storeSettings: StoreSettings;
  coupons: Coupon[];
  usedBookListings: UsedBookListing[];
  studyAbroadItems: StudyAbroadItem[];
  studyLeads: StudyLead[];
  heroPromoSettings: HeroPromoSettings;
  /** userId -> scrypt password hash. Kept OUT of the `users` array (and thus
   * the `User` type) so it can never be serialized back to a client — every
   * User-returning read (getUser, listByHostel, subscribeUser, ...) reads
   * straight off `users`, which never carries this field. */
  passwordHashes: Record<string, string>;
  /** One-time password-reset codes (hashed). Server-side only. */
  passwordResetOtps: PasswordResetOtp[];
  /** Platform SMTP settings; null until the Super Admin (or env) configures it. */
  smtpSettings: SmtpSettings | null;
}

interface Persisted {
  version: number;
  data: Tables;
}

let idCounter = 0;
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

type Listener = () => void;

class MockStore {
  data: Tables;
  /** Monotonic change counter — bumped on every mutation. The server layer
   * persists when it moves and clients poll it to know when to re-fetch. */
  rev = 0;
  private listeners = new Map<string, Set<Listener>>();
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.data = this.load();
    if (typeof window !== "undefined") {
      window.addEventListener("storage", (e) => {
        if (e.key !== STORAGE_KEY) return;
        this.data = this.load();
        this.emitAll();
      });
      // The debounced persist loses writes made <150ms before a hard
      // navigation/refresh (e.g. signing up then reloading) — flush
      // synchronously when the page is being left.
      window.addEventListener("beforeunload", () => this.persistNow());
      window.addEventListener("pagehide", () => this.persistNow());
    }
  }

  private persistNow() {
    if (typeof window === "undefined") return;
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    const payload: Persisted = { version: SCHEMA_VERSION, data: this.data };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  private load(): Tables {
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Persisted;
          if (parsed.version === SCHEMA_VERSION) return parsed.data;
        }
      } catch {
        // fall through to reseed
      }
    }
    return buildSeed();
  }

  private schedulePersist() {
    if (typeof window === "undefined") return;
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      const payload: Persisted = { version: SCHEMA_VERSION, data: this.data };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }, 150);
  }

  on(topic: string, fn: Listener): () => void {
    if (!this.listeners.has(topic)) this.listeners.set(topic, new Set());
    this.listeners.get(topic)!.add(fn);
    return () => {
      this.listeners.get(topic)?.delete(fn);
    };
  }

  emit(topic: string) {
    this.rev += 1;
    this.schedulePersist();
    this.listeners.get(topic)?.forEach((fn) => fn());
  }

  private emitAll() {
    this.rev += 1;
    this.listeners.forEach((set) => set.forEach((fn) => fn()));
  }

  reset() {
    this.data = buildSeed();
    this.schedulePersist();
    this.emitAll();
  }

  /** Server-side hydration: adopt tables (and their rev) loaded from the
   * database file without triggering any persistence of our own. */
  replaceData(data: Tables, rev: number) {
    this.data = data;
    this.rev = rev;
  }
}

// Singleton — one store per browser tab.
export const store = new MockStore();

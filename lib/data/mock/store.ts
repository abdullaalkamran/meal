// The mock "backend": in-memory tables + localStorage persistence + a tiny
// pub/sub, standing in for a real database until one is chosen. Nothing
// outside lib/data/ should import this file directly (enforced by an
// eslint no-restricted-imports rule) — always go through `repo` in
// lib/data/index.ts so a real backend can replace this file later without
// touching UI code.

import type {
  Announcement,
  Bill,
  BillAdjustment,
  Campaign,
  Comment,
  CommunityPost,
  CookAttendanceReport,
  CookAttendanceVote,
  CookLeaveRequest,
  DutyPlan,
  Expense,
  ExploreInteraction,
  GuestMealRequest,
  Hostel,
  HostelTransferRequest,
  JoinRequest,
  MarketingTarget,
  MealDay,
  MealEditRequest,
  MealEditVote,
  MealStopRequest,
  Menu,
  Notification,
  Payment,
  Rating,
  Reaction,
  Room,
  ServiceListing,
  ShoppingCost,
  ShortageRequest,
  SwapRequest,
  User,
} from "../types";
import { buildSeed } from "./seed";

export interface Tables {
  users: User[];
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
  expenses: Expense[];
  transferRequests: HostelTransferRequest[];
  joinRequests: JoinRequest[];
  mealStopRequests: MealStopRequest[];
  guestMealRequests: GuestMealRequest[];
  exploreInteractions: ExploreInteraction[];
  communityPosts: CommunityPost[];
  serviceListings: ServiceListing[];
  campaigns: Campaign[];
  marketingTargets: MarketingTarget[];
}

const STORAGE_KEY = "hostel-erp:mock-db:v1";
const SCHEMA_VERSION = 19;

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
    }
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
    this.schedulePersist();
    this.listeners.get(topic)?.forEach((fn) => fn());
  }

  private emitAll() {
    this.listeners.forEach((set) => set.forEach((fn) => fn()));
  }

  reset() {
    this.data = buildSeed();
    this.schedulePersist();
    this.emitAll();
  }
}

// Singleton — one store per browser tab.
export const store = new MockStore();

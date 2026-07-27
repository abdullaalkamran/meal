// The client half of the server-backed data layer. Every repository method
// is proxied over POST /api/rpc to the server store (lib/data/server/db.ts);
// `subscribe*` methods are implemented by polling the server's change
// counter (GET /api/rpc) and re-fetching the subscription's query when it
// moves — loosely the same contract the mock's pub/sub gave the hooks.

import type {
  Bill,
  Hostel,
  MealDay,
  Menu,
  ShoppingCostEditRequest,
  SwapRequest,
  User,
} from "../types";
import type { Repositories, UserRepository, RoomRepository, HostelRepository, MealRepository, MenuRepository, RatingRepository, CommentRepository, DutyRepository, SwapRepository, ShortageRepository, BillRepository, CookLeaveRepository, CookAttendanceRepository, MealEditRepository, AnnouncementRepository, NotificationRepository, ExpenseRepository, TransferRepository, JoinRequestRepository, LeaveRequestRepository, MealStopRepository, GuestMealRepository, ExploreInteractionRepository, CommunityRepository, ServiceCatalogRepository, CampaignRepository, MarketingRepository, ProductRepository, CartRepository, OrderRepository, StudyAbroadRepository, PromoSettingsRepository, StudyLeadRepository, UsedBookRepository, ActivityRepository, ShoppingCostRepository, ShoppingCostEditRepository } from "../repository";
const POLL_INTERVAL_MS = 2500;

// The activity-log actor is derived server-side from the session cookie
// (see app/api/rpc/route.ts) — the client no longer sends it.

// ── One-time init: learn the server's current change counter ───────────────
// (This used to also upload a browser's legacy localStorage dataset via a
// `$system.importLegacy` call. That endpoint replaced the ENTIRE server
// database from an unauthenticated request, so it was removed — the
// migration it existed for is long done.)
let readyPromise: Promise<void> | null = null;

function ensureReady(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!readyPromise) {
    readyPromise = (async () => {
      const res = await fetch("/api/rpc", { cache: "no-store" });
      const status = (await res.json()) as { rev: number };
      lastRev = status.rev;
    })().catch(() => {
      // Server unreachable during init — individual calls will surface it.
    });
  }
  return readyPromise;
}

// ── RPC core ───────────────────────────────────────────────────────────────
async function rawRpc<T>(
  repo: string,
  method: string,
  args: unknown[],
  mutation: boolean
): Promise<T> {
  if (typeof window === "undefined") {
    throw new Error(`repo.${repo}.${method} was called during server rendering — data access happens in effects/handlers on the client.`);
  }
  const res = await fetch("/api/rpc", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ repo, method, args }),
  });
  const json = (await res.json().catch(() => null)) as
    | { result?: T; rev?: number; error?: string }
    | null;
  if (!res.ok) {
    throw new Error(json?.error ?? `${repo}.${method} failed (${res.status})`);
  }
  if (mutation && typeof json?.rev === "number") {
    // Our own write may have changed the data — advance the revision (which
    // clears the query cache) and refresh subscriptions immediately so the UI
    // updates without waiting for the next poll tick.
    setRev(json.rev);
  }
  // `null` stands in for `undefined` over JSON (e.g. getUser misses).
  return (json?.result ?? undefined) as T;
}

const isQueryMethod = (method: string) =>
  method.startsWith("list") || method.startsWith("get");

// ── Query cache + in-flight dedup ──────────────────────────────────────────
// Every hook is its own RPC round-trip and every navigation remounts them, so
// without this a single page can fire dozens of identical requests and refetch
// them all again the moment you come back. We cache each query's result under
// the current server revision and share any in-flight request, so:
//   • duplicate concurrent reads (many hooks want the same list) hit ONE fetch;
//   • revisiting a page within the same revision is served from memory;
//   • any write (or a poll detecting someone else's write) bumps the revision,
//     which drops the whole cache so nothing stale is ever shown.
const queryCache = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();
const cacheKey = (repo: string, method: string, args: unknown[]) =>
  `${repo}.${method}(${JSON.stringify(args)})`;

/** Advances the known server revision, dropping cached queries when it moves. */
function setRev(rev: number) {
  if (rev === lastRev) return;
  lastRev = rev;
  queryCache.clear();
  refreshAllSoon();
}

/** Drops all cached query results — called on login/logout so one account can
 * never be shown another's cached data (keys aren't session-scoped). */
export function clearQueryCache() {
  queryCache.clear();
  inflight.clear();
}

async function rpc<T>(repo: string, method: string, args: unknown[]): Promise<T> {
  await ensureReady();
  if (!isQueryMethod(method)) return rawRpc<T>(repo, method, args, true);

  const key = cacheKey(repo, method, args);
  if (queryCache.has(key)) return queryCache.get(key) as T;
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const p = rawRpc<T>(repo, method, args, false)
    .then((data) => {
      queryCache.set(key, data);
      return data;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p as Promise<T>;
}

// ── Subscriptions: poll the server rev, re-fetch on change ─────────────────
interface Subscription {
  refresh: () => Promise<void>;
}

const subscriptions = new Set<Subscription>();
let lastRev = -1;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let refreshQueued = false;

function refreshAllSoon() {
  if (refreshQueued) return;
  refreshQueued = true;
  setTimeout(() => {
    refreshQueued = false;
    subscriptions.forEach((s) => void s.refresh().catch(() => {}));
  }, 50);
}

async function pollOnce() {
  if (subscriptions.size === 0) return;
  try {
    const res = await fetch("/api/rpc", { cache: "no-store" });
    const { rev } = (await res.json()) as { rev: number };
    setRev(rev);
  } catch {
    // Offline / server restarting — try again next tick.
  }
}

function ensurePolling() {
  if (pollTimer || typeof window === "undefined") return;
  pollTimer = setInterval(() => void pollOnce(), POLL_INTERVAL_MS);
  window.addEventListener("focus", () => void pollOnce());
}

/** Registers a polling subscription: fetches `fetcher` now and again on
 * every server-side change, delivering the result to `deliver`. */
function makeSubscribe<T>(
  fetcher: () => Promise<T>,
  deliver: (data: T) => void,
  { initialFire = true }: { initialFire?: boolean } = {}
): () => void {
  const sub: Subscription = {
    refresh: async () => {
      const data = await fetcher();
      if (subscriptions.has(sub)) deliver(data);
    },
  };
  subscriptions.add(sub);
  ensurePolling();
  if (initialFire) void sub.refresh().catch(() => {});
  return () => {
    subscriptions.delete(sub);
  };
}

/** Signal-only subscription (mock fired these with no payload). */
function makeSignalSubscribe(cb: () => void): () => void {
  return makeSubscribe(async () => undefined, () => cb(), { initialFire: false });
}

// ── Repository proxies ─────────────────────────────────────────────────────
/** Builds a repository whose methods are auto-RPC'd by name; `overrides`
 * supplies the subscribe implementations (and anything else local). */
function remoteRepo<T extends object>(name: string, overrides: Partial<T> = {}): T {
  return new Proxy(overrides as T, {
    get(target, prop) {
      if (typeof prop !== "string") return undefined;
      const local = (target as Record<string, unknown>)[prop];
      if (local !== undefined) return local;
      return (...args: unknown[]) => rpc(name, prop, args);
    },
  });
}

const users = remoteRepo<UserRepository>("users", {
  subscribe: (hostelId, cb) =>
    makeSubscribe(() => rpc<User[]>("users", "listByHostel", [hostelId]), cb),
  subscribeUser: (userId, cb) =>
    makeSubscribe(
      () => rpc<User | undefined>("users", "getUser", [userId]),
      (u) => u && cb(u)
    ),
});

const rooms = remoteRepo<RoomRepository>("rooms", {
  subscribe: (hostelId, cb) =>
    makeSubscribe(() => rpc<Awaited<ReturnType<RoomRepository["listByHostel"]>>>("rooms", "listByHostel", [hostelId]), cb),
});

const hostels = remoteRepo<HostelRepository>("hostels", {
  subscribe: (hostelId, cb) =>
    makeSubscribe(
      () => rpc<Hostel | undefined>("hostels", "getHostel", [hostelId]),
      (h) => h && cb(h)
    ),
  subscribeAll: (cb) =>
    makeSubscribe(() => rpc<Hostel[]>("hostels", "listAll", []), cb),
});

const meals = remoteRepo<MealRepository>("meals", {
  subscribe: (hostelId, cb) =>
    makeSubscribe(
      () =>
        rpc<MealDay[]>("meals", "listMealDays", [
          hostelId,
          { from: "0000-01-01", to: "9999-12-31" },
        ]),
      (days) => days.forEach((d) => cb(d))
    ),
});

const menus = remoteRepo<MenuRepository>("menus", {
  subscribe: (hostelId, cb) =>
    makeSubscribe(
      () => rpc<Menu[]>("$system", "menusByHostel", [hostelId]),
      (list) => list.forEach((m) => cb(m))
    ),
});

const ratings = remoteRepo<RatingRepository>("ratings", {
  subscribe: (hostelId, cb) =>
    makeSubscribe(() => rpc<Awaited<ReturnType<RatingRepository["listByHostel"]>>>("ratings", "listByHostel", [hostelId]), cb),
});

const comments = remoteRepo<CommentRepository>("comments", {
  subscribe: (_hostelId, cb) => makeSignalSubscribe(cb),
});

const duties = remoteRepo<DutyRepository>("duties", {
  subscribe: (hostelId, cb) =>
    makeSubscribe(() => rpc<Awaited<ReturnType<DutyRepository["listByHostel"]>>>("duties", "listByHostel", [hostelId]), cb),
});

const swaps = remoteRepo<SwapRepository>("swaps", {
  subscribe: (hostelId, cb) =>
    makeSubscribe(() => rpc<SwapRequest[]>("$system", "swapsByHostel", [hostelId]), cb),
});

const shoppingCosts = remoteRepo<ShoppingCostRepository>("shoppingCosts");
const shoppingCostEdits = remoteRepo<ShoppingCostEditRepository>("shoppingCostEdits", {
  subscribe: (hostelId, cb) =>
    makeSubscribe(
      () => rpc<ShoppingCostEditRequest[]>("shoppingCostEdits", "listByHostel", [hostelId]),
      cb
    ),
});

const shortages = remoteRepo<ShortageRepository>("shortages", {
  subscribe: (hostelId, cb) =>
    makeSubscribe(() => rpc<Awaited<ReturnType<ShortageRepository["listByHostel"]>>>("shortages", "listByHostel", [hostelId]), cb),
});

const bills = remoteRepo<BillRepository>("bills", {
  subscribe: (userId, cb) =>
    makeSubscribe(
      () => rpc<Bill | null>("$system", "billByUser", [userId]),
      (b) => b && cb(b),
      { initialFire: false }
    ),
});

const cookLeave = remoteRepo<CookLeaveRepository>("cookLeave", {
  subscribe: (hostelId, cb) =>
    makeSubscribe(() => rpc<Awaited<ReturnType<CookLeaveRepository["listByHostel"]>>>("cookLeave", "listByHostel", [hostelId]), cb),
});

const cookAttendance = remoteRepo<CookAttendanceRepository>("cookAttendance", {
  subscribe: (_hostelId, cb) => makeSignalSubscribe(cb),
});

const mealEdits = remoteRepo<MealEditRepository>("mealEdits", {
  subscribe: (hostelId, cb) =>
    makeSubscribe(() => rpc<Awaited<ReturnType<MealEditRepository["listByHostel"]>>>("mealEdits", "listByHostel", [hostelId]), cb),
});

const announcements = remoteRepo<AnnouncementRepository>("announcements", {
  subscribe: (hostelId, cb) =>
    makeSubscribe(() => rpc<Awaited<ReturnType<AnnouncementRepository["listByHostel"]>>>("announcements", "listByHostel", [hostelId]), cb),
});

const notifications = remoteRepo<NotificationRepository>("notifications", {
  subscribe: (userId, cb) =>
    makeSubscribe(() => rpc<Awaited<ReturnType<NotificationRepository["listByUser"]>>>("notifications", "listByUser", [userId]), cb),
});

const expenses = remoteRepo<ExpenseRepository>("expenses", {
  subscribe: (hostelId, cb) =>
    makeSubscribe(() => rpc<Awaited<ReturnType<ExpenseRepository["listByHostel"]>>>("expenses", "listByHostel", [hostelId]), cb),
});

const transfers = remoteRepo<TransferRepository>("transfers", {
  subscribe: (hostelId, cb) =>
    makeSubscribe(() => rpc<Awaited<ReturnType<TransferRepository["listByHostel"]>>>("transfers", "listByHostel", [hostelId]), cb),
});

const joinRequests = remoteRepo<JoinRequestRepository>("joinRequests", {
  subscribe: (hostelId, cb) =>
    makeSubscribe(() => rpc<Awaited<ReturnType<JoinRequestRepository["listByHostel"]>>>("joinRequests", "listByHostel", [hostelId]), cb),
});

const leaveRequests = remoteRepo<LeaveRequestRepository>("leaveRequests", {
  subscribe: (hostelId, cb) =>
    makeSubscribe(() => rpc<Awaited<ReturnType<LeaveRequestRepository["listByHostel"]>>>("leaveRequests", "listByHostel", [hostelId]), cb),
});

const mealStops = remoteRepo<MealStopRepository>("mealStops", {
  subscribe: (hostelId, cb) =>
    makeSubscribe(() => rpc<Awaited<ReturnType<MealStopRepository["listByHostel"]>>>("mealStops", "listByHostel", [hostelId]), cb),
});

const guestMeals = remoteRepo<GuestMealRepository>("guestMeals", {
  subscribe: (hostelId, cb) =>
    makeSubscribe(() => rpc<Awaited<ReturnType<GuestMealRepository["listByHostel"]>>>("guestMeals", "listByHostel", [hostelId]), cb),
});

const exploreInteractions = remoteRepo<ExploreInteractionRepository>("exploreInteractions", {
  subscribe: (userId, cb) =>
    makeSubscribe(() => rpc<Awaited<ReturnType<ExploreInteractionRepository["listByUser"]>>>("exploreInteractions", "listByUser", [userId]), cb),
});

const community = remoteRepo<CommunityRepository>("community", {
  subscribe: (cb) =>
    makeSubscribe(() => rpc<Awaited<ReturnType<CommunityRepository["listAll"]>>>("community", "listAll", []), cb),
});

const serviceCatalog = remoteRepo<ServiceCatalogRepository>("serviceCatalog", {
  subscribe: (cb) =>
    makeSubscribe(() => rpc<Awaited<ReturnType<ServiceCatalogRepository["listAll"]>>>("serviceCatalog", "listAll", []), cb),
});

const campaigns = remoteRepo<CampaignRepository>("campaigns", {
  subscribe: (cb) =>
    makeSubscribe(() => rpc<Awaited<ReturnType<CampaignRepository["listAll"]>>>("campaigns", "listAll", []), cb),
});

const marketing = remoteRepo<MarketingRepository>("marketing", {
  subscribe: (cb) => makeSignalSubscribe(cb),
});

const products = remoteRepo<ProductRepository>("products", {
  subscribe: (cb) =>
    makeSubscribe(() => rpc<Awaited<ReturnType<ProductRepository["listAll"]>>>("products", "listAll", []), cb),
});

const cart = remoteRepo<CartRepository>("cart", {
  subscribe: (userId, cb) =>
    makeSubscribe(() => rpc<Awaited<ReturnType<CartRepository["listByUser"]>>>("cart", "listByUser", [userId]), cb),
});

const orders = remoteRepo<OrderRepository>("orders", {
  subscribe: (userId, cb) =>
    makeSubscribe(() => rpc<Awaited<ReturnType<OrderRepository["listByUser"]>>>("orders", "listByUser", [userId]), cb),
  subscribeAll: (cb) =>
    makeSubscribe(() => rpc<Awaited<ReturnType<OrderRepository["listAll"]>>>("orders", "listAll", []), cb),
});

const studyAbroad = remoteRepo<StudyAbroadRepository>("studyAbroad", {
  subscribe: (cb) =>
    makeSubscribe(() => rpc<Awaited<ReturnType<StudyAbroadRepository["listAll"]>>>("studyAbroad", "listAll", []), cb),
});

const promoSettings = remoteRepo<PromoSettingsRepository>("promoSettings", {
  subscribe: (cb) =>
    makeSubscribe(() => rpc<Awaited<ReturnType<PromoSettingsRepository["get"]>>>("promoSettings", "get", []), cb),
});

const studyLeads = remoteRepo<StudyLeadRepository>("studyLeads", {
  subscribe: (cb) =>
    makeSubscribe(() => rpc<Awaited<ReturnType<StudyLeadRepository["listAll"]>>>("studyLeads", "listAll", []), cb),
});

const usedBooks = remoteRepo<UsedBookRepository>("usedBooks", {
  subscribe: (cb) =>
    makeSubscribe(() => rpc<Awaited<ReturnType<UsedBookRepository["listAll"]>>>("usedBooks", "listAll", []), cb),
});

const activity = remoteRepo<ActivityRepository>("activity", {
  subscribe: (hostelId, cb) =>
    makeSubscribe(() => rpc<Awaited<ReturnType<ActivityRepository["listByHostel"]>>>("activity", "listByHostel", [hostelId]), cb),
});

export const remoteRepositories: Repositories = {
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
  usedBooks,
  studyAbroad,
  studyLeads,
  promoSettings,
};

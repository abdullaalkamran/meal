// MySQL implementations of the platform catalogs: explore interactions,
// community feed, service listings, campaigns, marketing targets, the store
// (products / cart / orders), used books, study abroad and promo settings.
//
// ServiceListing and StudyAbroadItem are discriminated unions whose per-kind
// fields differ, so shared columns (kind, title, active, created_at) are real
// and the variant fields live in an `attrs` JSON column — the shape stays
// queryable where it matters and open where it varies.

import type {
  Campaign,
  CartItem,
  CommunityPost,
  Coupon,
  ExploreInteraction,
  GeoArea,
  HeroPromoSettings,
  MarketingTarget,
  Order,
  OrderItem,
  Product,
  ProductKind,
  Promotion,
  QuickServiceSettings,
  ServiceListing,
  StudyAbroadItem,
  StudyLead,
  UsedBookListing,
} from "../../types";
import type {
  CampaignRepository,
  CartRepository,
  CommunityRepository,
  CouponRepository,
  ExploreInteractionRepository,
  MarketingRepository,
  OrderRepository,
  ProductRepository,
  PromoSettingsRepository,
  PromotionRepository,
  QuickServicesRepository,
  ServiceCatalogRepository,
  StoreSettingsRepository,
  StudyAbroadRepository,
  StudyLeadRepository,
  UsedBookRepository,
} from "../../repository";
import { deliveryFeeFor } from "../../../utils/store";
import { formatBDT } from "../../../utils/currency";
import { today } from "../../../utils/date";
import { all, fromIso, one, run, toBool, toDay, toIso, transaction, type Queryable } from "./connection";
import { currentActor, notify } from "./context";
import { newId } from "./ids";

const serverOnly = (): never => {
  throw new Error("subscribe() is a client-side concern; the server never dispatches it.");
};

const now = () => fromIso(new Date().toISOString());
const parseAttrs = (v: unknown): Record<string, unknown> =>
  !v ? {} : typeof v === "string" ? (JSON.parse(v) as Record<string, unknown>) : (v as Record<string, unknown>);

/** Everything the shared columns already hold — the rest becomes `attrs`. */
const LISTING_SHARED = ["id", "kind", "active", "createdAt", "areas"];
const STUDY_SHARED = ["id", "kind", "active", "createdAt", "image"];

function omitKeys(obj: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (!keys.includes(k)) out[k] = v;
  return out;
}

// ── Availability areas (shared by listings and products) ───────────────────

export type AreaEntity = "service_listing" | "product" | "user" | "promotion";

export async function writeAreas(entity: AreaEntity, entityId: string, areas: GeoArea[] | undefined, tx: Queryable) {
  await run("DELETE FROM availability_areas WHERE entity_type = ? AND entity_id = ?", [entity, entityId], tx);
  for (const a of areas ?? []) {
    await run(
      "INSERT INTO availability_areas (id, entity_type, entity_id, division, district, thana) VALUES (?, ?, ?, ?, ?, ?)",
      [newId("area"), entity, entityId, a.division, a.district ?? null, a.thana ?? null],
      tx
    );
  }
}

export async function loadAreas(entity: AreaEntity, ids: string[], on?: Queryable): Promise<Map<string, GeoArea[]>> {
  const map = new Map<string, GeoArea[]>();
  if (!ids.length) return map;
  const rows = await all<{ entity_id: string; division: string; district: string | null; thana: string | null }>(
    `SELECT entity_id, division, district, thana FROM availability_areas
      WHERE entity_type = ? AND entity_id IN (${ids.map(() => "?").join(",")})`,
    [entity, ...ids],
    on
  );
  for (const r of rows) {
    const list = map.get(r.entity_id) ?? [];
    list.push({
      division: r.division,
      ...(r.district ? { district: r.district } : {}),
      ...(r.thana ? { thana: r.thana } : {}),
    });
    map.set(r.entity_id, list);
  }
  return map;
}

// ── Explore interactions ───────────────────────────────────────────────────

export const exploreInteractions: ExploreInteractionRepository = {
  async listByUser(userId) {
    const rows = await all<{
      id: string; user_id: string; feature: ExploreInteraction["feature"];
      item_id: string; kind: ExploreInteraction["kind"]; created_at: string;
    }>(
      "SELECT id, user_id, feature, item_id, kind, created_at FROM explore_interactions WHERE user_id = ?",
      [userId]
    );
    return rows.map<ExploreInteraction>((r) => ({
      id: r.id,
      userId: r.user_id,
      feature: r.feature,
      itemId: r.item_id,
      kind: r.kind,
      createdAt: toIso(r.created_at),
    }));
  },

  /** Adds the action if absent, removes it if present. */
  async toggle(userId, feature, itemId, kind) {
    const existing = await one<{ id: string }>(
      "SELECT id FROM explore_interactions WHERE user_id = ? AND feature = ? AND item_id = ? AND kind = ?",
      [userId, feature, itemId, kind]
    );
    if (existing) {
      await run("DELETE FROM explore_interactions WHERE id = ?", [existing.id]);
    } else {
      await run(
        "INSERT INTO explore_interactions (id, user_id, feature, item_id, kind, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [newId("expl"), userId, feature, itemId, kind, now()]
      );
    }
  },

  subscribe: serverOnly,
};

// ── Community feed ─────────────────────────────────────────────────────────

export const community: CommunityRepository = {
  async listAll() {
    const rows = await all<{
      id: string; hostel_id: string | null; user_id: string; author_name: string; body: string; created_at: string;
    }>(
      "SELECT id, hostel_id, user_id, author_name, body, created_at FROM community_posts ORDER BY created_at DESC"
    );
    if (!rows.length) return [];
    const likes = await all<{ post_id: string; user_id: string }>(
      `SELECT post_id, user_id FROM community_post_likes WHERE post_id IN (${rows.map(() => "?").join(",")})`,
      rows.map((r) => r.id)
    );
    const byPost = new Map<string, string[]>();
    for (const l of likes) {
      const list = byPost.get(l.post_id) ?? [];
      list.push(l.user_id);
      byPost.set(l.post_id, list);
    }
    return rows.map<CommunityPost>((r) => ({
      id: r.id,
      hostelId: r.hostel_id ?? "",
      userId: r.user_id,
      authorName: r.author_name,
      body: r.body,
      createdAt: toIso(r.created_at),
      likeUserIds: byPost.get(r.id) ?? [],
    }));
  },

  async post(post) {
    await run(
      "INSERT INTO community_posts (id, hostel_id, user_id, author_name, body, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [newId("cpost"), post.hostelId || null, post.userId, post.authorName, post.body, now()]
    );
  },

  async toggleLike(postId, userId) {
    const existing = await one<{ post_id: string }>(
      "SELECT post_id FROM community_post_likes WHERE post_id = ? AND user_id = ?",
      [postId, userId]
    );
    if (existing) {
      await run("DELETE FROM community_post_likes WHERE post_id = ? AND user_id = ?", [postId, userId]);
    } else {
      await run("INSERT INTO community_post_likes (post_id, user_id) VALUES (?, ?)", [postId, userId]);
    }
  },

  async remove(postId) {
    await run("DELETE FROM community_posts WHERE id = ?", [postId]);
  },

  subscribe: serverOnly,
};

// ── Service catalog ────────────────────────────────────────────────────────

interface CatalogRow {
  id: string; kind: string; title: string; active: number; attrs: unknown; created_at: string;
}

/** Rebuilds the union member: shared columns + the kind-specific attrs. */
function toListing(r: CatalogRow, areas?: GeoArea[]): ServiceListing {
  return {
    id: r.id,
    kind: r.kind,
    active: toBool(r.active),
    createdAt: toIso(r.created_at),
    ...parseAttrs(r.attrs),
    ...(areas && areas.length ? { areas } : {}),
  } as ServiceListing;
}

function splitListing(input: Record<string, unknown>) {
  const attrs = omitKeys(input, LISTING_SHARED);
  const title = (attrs.title ?? attrs.name ?? attrs.shop ?? "") as string;
  return {
    kind: input.kind as string,
    title,
    areas: input.areas as GeoArea[] | undefined,
    attrs,
  };
}

export const serviceCatalog: ServiceCatalogRepository = {
  async listByKind(kind) {
    const rows = await all<CatalogRow>(
      "SELECT id, kind, title, active, attrs, created_at FROM service_listings WHERE kind = ? ORDER BY created_at DESC",
      [kind]
    );
    const areas = await loadAreas("service_listing", rows.map((r) => r.id));
    return rows.map((r) => toListing(r, areas.get(r.id)));
  },

  async listAll() {
    const rows = await all<CatalogRow>(
      "SELECT id, kind, title, active, attrs, created_at FROM service_listings ORDER BY created_at DESC"
    );
    const areas = await loadAreas("service_listing", rows.map((r) => r.id));
    return rows.map((r) => toListing(r, areas.get(r.id)));
  },

  async add(listing) {
    await transaction(async (tx) => {
      const id = newId("svc");
      const { kind, title, areas, attrs } = splitListing(listing as unknown as Record<string, unknown>);
      await run(
        "INSERT INTO service_listings (id, kind, title, active, attrs, created_at) VALUES (?, ?, ?, 1, ?, ?)",
        [id, kind, title, JSON.stringify(attrs), now()],
        tx
      );
      await writeAreas("service_listing", id, areas, tx);
    });
  },

  async update(id, patch) {
    await transaction(async (tx) => {
      const row = await one<CatalogRow>("SELECT id, kind, title, active, attrs, created_at FROM service_listings WHERE id = ?", [id], tx);
      if (!row) return;
      const p = patch as unknown as Record<string, unknown>;
      const merged = { ...parseAttrs(row.attrs), ...omitKeys(p, LISTING_SHARED) };
      const title = (merged.title ?? merged.name ?? merged.shop ?? row.title) as string;
      await run(
        "UPDATE service_listings SET title = ?, attrs = ?, active = ? WHERE id = ?",
        [title, JSON.stringify(merged), p.active === undefined ? row.active : p.active ? 1 : 0, id],
        tx
      );
      if ("areas" in p) await writeAreas("service_listing", id, p.areas as GeoArea[] | undefined, tx);
    });
  },

  async toggleActive(id) {
    await run("UPDATE service_listings SET active = NOT active WHERE id = ?", [id]);
  },

  async remove(id) {
    await transaction(async (tx) => {
      await run("DELETE FROM availability_areas WHERE entity_type = 'service_listing' AND entity_id = ?", [id], tx);
      await run("DELETE FROM service_listings WHERE id = ?", [id], tx);
    });
  },

  subscribe: serverOnly,
};

// ── Campaigns & marketing targets ──────────────────────────────────────────

export const campaigns: CampaignRepository = {
  async listAll() {
    const rows = await all<{
      id: string; name: string; channel: string; status: Campaign["status"];
      start_date: string; budget: number; note: string | null;
    }>("SELECT id, name, channel, status, start_date, budget, note FROM campaigns ORDER BY start_date DESC");
    return rows.map<Campaign>((r) => ({
      id: r.id,
      name: r.name,
      channel: r.channel,
      status: r.status,
      startDate: toDay(r.start_date),
      budget: Number(r.budget),
      note: r.note ?? undefined,
    }));
  },

  async create(campaign) {
    await run(
      "INSERT INTO campaigns (id, name, channel, status, start_date, budget, note) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [newId("camp"), campaign.name, campaign.channel, campaign.status, campaign.startDate, campaign.budget, campaign.note ?? null]
    );
  },

  async updateStatus(id, status) {
    await run("UPDATE campaigns SET status = ? WHERE id = ?", [status, id]);
  },

  async remove(id) {
    await run("DELETE FROM campaigns WHERE id = ?", [id]);
  },

  subscribe: serverOnly,
};

export const marketing: MarketingRepository = {
  async listTargets(month) {
    const rows = await all<{ metric: string; month: string; target: number }>(
      "SELECT metric, month, target FROM marketing_targets WHERE month = ?",
      [month]
    );
    return rows.map<MarketingTarget>((r) => ({ metric: r.metric, month: r.month, target: Number(r.target) }));
  },

  async setTarget(metric, month, target) {
    await run(
      "INSERT INTO marketing_targets (metric, month, target) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE target = VALUES(target)",
      [metric, month, target]
    );
  },

  subscribe: serverOnly,
};

// ── Store: products, cart, orders ──────────────────────────────────────────

interface ProductRow {
  id: string; kind: ProductKind; name: string; price: number; category: string;
  image: string | null; active: number; unit: string | null; author: string | null;
  academic_class: string | null; created_at: string;
}

const toProduct = (r: ProductRow, areas?: GeoArea[]): Product => ({
  id: r.id,
  kind: r.kind,
  name: r.name,
  price: Number(r.price),
  category: r.category,
  image: r.image ?? undefined,
  active: toBool(r.active),
  createdAt: toIso(r.created_at),
  unit: r.unit ?? undefined,
  author: r.author ?? undefined,
  academicClass: r.academic_class ?? undefined,
  ...(areas && areas.length ? { areas } : {}),
});

const PRODUCT_COLS = "id, kind, name, price, category, image, active, unit, author, academic_class, created_at";

export const products: ProductRepository = {
  async listByKind(kind) {
    const rows = await all<ProductRow>(`SELECT ${PRODUCT_COLS} FROM products WHERE kind = ? ORDER BY created_at DESC`, [kind]);
    const areas = await loadAreas("product", rows.map((r) => r.id));
    return rows.map((r) => toProduct(r, areas.get(r.id)));
  },

  async listAll() {
    const rows = await all<ProductRow>(`SELECT ${PRODUCT_COLS} FROM products ORDER BY created_at DESC`);
    const areas = await loadAreas("product", rows.map((r) => r.id));
    return rows.map((r) => toProduct(r, areas.get(r.id)));
  },

  async add(product) {
    await transaction(async (tx) => {
      const id = newId("prod");
      await run(
        `INSERT INTO products (id, kind, name, price, category, image, active, unit, author, academic_class, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
        [
          id, product.kind, product.name, product.price, product.category, product.image ?? null,
          product.unit ?? null, product.author ?? null, product.academicClass ?? null, now(),
        ],
        tx
      );
      await writeAreas("product", id, product.areas, tx);
    });
  },

  async update(id, patch) {
    await transaction(async (tx) => {
      const sets: string[] = [];
      const params: unknown[] = [];
      const put = (col: string, v: unknown) => { sets.push(`${col} = ?`); params.push(v); };
      if (patch.name !== undefined) put("name", patch.name);
      if (patch.price !== undefined) put("price", patch.price);
      if (patch.category !== undefined) put("category", patch.category);
      if (patch.image !== undefined) put("image", patch.image ?? null);
      if (patch.active !== undefined) put("active", patch.active ? 1 : 0);
      if (patch.unit !== undefined) put("unit", patch.unit ?? null);
      if (patch.author !== undefined) put("author", patch.author ?? null);
      if (patch.academicClass !== undefined) put("academic_class", patch.academicClass ?? null);
      if (sets.length) {
        params.push(id);
        await run(`UPDATE products SET ${sets.join(", ")} WHERE id = ?`, params, tx);
      }
      if ("areas" in patch) await writeAreas("product", id, patch.areas, tx);
    });
  },

  async toggleActive(id) {
    await run("UPDATE products SET active = NOT active WHERE id = ?", [id]);
  },

  async remove(id) {
    await transaction(async (tx) => {
      await run("DELETE FROM availability_areas WHERE entity_type = 'product' AND entity_id = ?", [id], tx);
      await run("DELETE FROM products WHERE id = ?", [id], tx);
    });
  },

  subscribe: serverOnly,
};

export const cart: CartRepository = {
  async listByUser(userId) {
    const rows = await all<{ id: string; user_id: string; product_id: string; qty: number }>(
      "SELECT id, user_id, product_id, qty FROM cart_items WHERE user_id = ?",
      [userId]
    );
    return rows.map<CartItem>((r) => ({ id: r.id, userId: r.user_id, productId: r.product_id, qty: r.qty }));
  },

  async add(userId, productId, qty = 1) {
    await run(
      "INSERT INTO cart_items (id, user_id, product_id, qty) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE qty = qty + VALUES(qty)",
      [newId("cart"), userId, productId, qty]
    );
  },

  async setQty(userId, productId, qty) {
    if (qty <= 0) {
      await run("DELETE FROM cart_items WHERE user_id = ? AND product_id = ?", [userId, productId]);
      return;
    }
    await run(
      "INSERT INTO cart_items (id, user_id, product_id, qty) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE qty = VALUES(qty)",
      [newId("cart"), userId, productId, qty]
    );
  },

  async remove(userId, productId) {
    await run("DELETE FROM cart_items WHERE user_id = ? AND product_id = ?", [userId, productId]);
  },

  async clear(userId) {
    await run("DELETE FROM cart_items WHERE user_id = ?", [userId]);
  },

  subscribe: serverOnly,
};

async function loadOrders(where: string, params: unknown[]): Promise<Order[]> {
  const rows = await all<{
    id: string; user_id: string; hostel_id: string | null; subtotal: number; delivery_fee: number;
    discount: number; coupon_code: string | null;
    total: number; payment_method: Order["paymentMethod"]; status: Order["status"];
    note: string | null; buyer_phone: string | null; created_at: string;
  }>(
    `SELECT id, user_id, hostel_id, subtotal, delivery_fee, discount, coupon_code, total, payment_method, status, note, buyer_phone, created_at
       FROM orders WHERE ${where} ORDER BY created_at DESC`,
    params
  );
  if (!rows.length) return [];
  const items = await all<{
    order_id: string; product_id: string | null; kind: ProductKind; name: string; qty: number; price: number;
  }>(
    `SELECT order_id, product_id, kind, name, qty, price FROM order_items WHERE order_id IN (${rows
      .map(() => "?")
      .join(",")})`,
    rows.map((r) => r.id)
  );
  const byOrder = new Map<string, OrderItem[]>();
  for (const i of items) {
    const list = byOrder.get(i.order_id) ?? [];
    list.push({ productId: i.product_id ?? "", kind: i.kind, name: i.name, qty: i.qty, price: Number(i.price) });
    byOrder.set(i.order_id, list);
  }
  return rows.map<Order>((r) => ({
    id: r.id,
    userId: r.user_id,
    hostelId: r.hostel_id ?? "",
    items: byOrder.get(r.id) ?? [],
    subtotal: Number(r.subtotal),
    deliveryFee: Number(r.delivery_fee),
    ...(Number(r.discount) > 0 ? { discount: Number(r.discount) } : {}),
    ...(r.coupon_code ? { couponCode: r.coupon_code } : {}),
    total: Number(r.total),
    paymentMethod: r.payment_method,
    status: r.status,
    note: r.note ?? undefined,
    buyerPhone: r.buyer_phone ?? undefined,
    createdAt: toIso(r.created_at),
  }));
}

const ORDER_STATUS_TITLE: Record<Order["status"], string> = {
  placed: "Order placed",
  confirmed: "Order confirmed",
  preparing: "Order is being prepared",
  picked_up: "Order picked up",
  on_the_way: "Order on the way",
  delivered: "Order delivered",
  cancelled: "Order cancelled",
};

function orderStatusBody(status: Order["status"], total: number): string {
  switch (status) {
    case "confirmed":
      return `Your order (${formatBDT(total)}) has been confirmed and is being prepared.`;
    case "preparing":
      return `Your order (${formatBDT(total)}) is being prepared.`;
    case "picked_up":
      return `Your order (${formatBDT(total)}) has been picked up for delivery.`;
    case "on_the_way":
      return `Your order (${formatBDT(total)}) is on the way.`;
    case "delivered":
      return `Your order (${formatBDT(total)}) has been delivered. Thanks for shopping with us!`;
    case "cancelled":
      return `Your order (${formatBDT(total)}) has been cancelled.`;
    default:
      return "";
  }
}

interface StoreSettingsRow {
  delivery_fee_enabled: number;
  delivery_fee: number;
  free_delivery_min_amount: number | null;
}

async function loadStoreSettings(on?: Queryable): Promise<StoreSettingsRow> {
  const row = await one<StoreSettingsRow>(
    "SELECT delivery_fee_enabled, delivery_fee, free_delivery_min_amount FROM store_settings WHERE id = 1",
    [],
    on
  );
  return row ?? { delivery_fee_enabled: 1, delivery_fee: 30, free_delivery_min_amount: null };
}

interface CouponRow {
  id: string; code: string; kind: Coupon["kind"]; value: number; active: number;
  min_order_amount: number | null; max_uses: number | null; used_count: number;
  expires_at: string | null; created_at: string;
}

const toCoupon = (r: CouponRow): Coupon => ({
  id: r.id,
  code: r.code,
  kind: r.kind,
  value: Number(r.value),
  active: toBool(r.active),
  minOrderAmount: r.min_order_amount !== null ? Number(r.min_order_amount) : undefined,
  maxUses: r.max_uses ?? undefined,
  usedCount: r.used_count,
  expiresAt: r.expires_at ? toDay(r.expires_at) : undefined,
  createdAt: toIso(r.created_at),
});

const COUPON_COLS =
  "id, code, kind, value, active, min_order_amount, max_uses, used_count, expires_at, created_at";

/** Throws with a user-facing reason if `code` can't be applied to a cart of
 * this subtotal right now. Doesn't consume a redemption. */
async function checkCoupon(code: string, subtotal: number, on?: Queryable): Promise<Coupon> {
  const row = await one<CouponRow>(
    `SELECT ${COUPON_COLS} FROM coupons WHERE code = ?`,
    [code.trim().toUpperCase()],
    on
  );
  if (!row) throw new Error("That coupon code doesn't exist.");
  const coupon = toCoupon(row);
  if (!coupon.active) throw new Error("This coupon is no longer active.");
  if (coupon.expiresAt && coupon.expiresAt < today()) throw new Error("This coupon has expired.");
  if (coupon.maxUses !== undefined && coupon.usedCount >= coupon.maxUses) {
    throw new Error("This coupon has reached its usage limit.");
  }
  if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount) {
    throw new Error(`This coupon needs a minimum order of ${formatBDT(coupon.minOrderAmount)}.`);
  }
  return coupon;
}

function discountFor(coupon: Coupon, subtotal: number): number {
  const raw = coupon.kind === "percent" ? (subtotal * coupon.value) / 100 : coupon.value;
  return Math.min(Math.round(raw * 100) / 100, subtotal);
}

export const orders: OrderRepository = {
  async listByUser(userId) {
    return loadOrders("user_id = ?", [userId]);
  },

  async listAll() {
    return loadOrders("1 = 1", []);
  },

  /** Snapshots the cart into an order (prices copied so later catalog edits
   * never rewrite history), then clears the cart. Delivery fee and coupon
   * discount are computed/verified here — never trusted from the client. */
  async place(userId, details) {
    const orderId = newId("order");
    await transaction(async (tx) => {
      const lines = await all<{ product_id: string; qty: number; kind: ProductKind; name: string; price: number }>(
        `SELECT c.product_id, c.qty, p.kind, p.name, p.price
           FROM cart_items c JOIN products p ON p.id = c.product_id
          WHERE c.user_id = ?`,
        [userId],
        tx
      );
      if (lines.length === 0) throw new Error("Your cart is empty.");
      if (!details.note?.trim()) throw new Error("A delivery address is required.");
      const subtotal = lines.reduce((s, l) => s + Number(l.price) * l.qty, 0);
      const settingsRow = await loadStoreSettings(tx);
      const deliveryFee = deliveryFeeFor(
        lines.some((l) => l.kind === "grocery"),
        subtotal,
        {
          deliveryFeeEnabled: toBool(settingsRow.delivery_fee_enabled),
          deliveryFee: Number(settingsRow.delivery_fee),
          freeDeliveryMinAmount:
            settingsRow.free_delivery_min_amount !== null ? Number(settingsRow.free_delivery_min_amount) : undefined,
        }
      );

      let discount = 0;
      let couponCode: string | undefined;
      if (details.couponCode?.trim()) {
        const coupon = await checkCoupon(details.couponCode, subtotal, tx);
        discount = discountFor(coupon, subtotal);
        couponCode = coupon.code;
        await run("UPDATE coupons SET used_count = used_count + 1 WHERE id = ?", [coupon.id], tx);
      }

      const user = await one<{ hostel_id: string | null; phone: string }>(
        "SELECT hostel_id, phone FROM users WHERE id = ?",
        [userId],
        tx
      );
      await run(
        `INSERT INTO orders (id, user_id, hostel_id, subtotal, delivery_fee, discount, coupon_code, total, payment_method, status, note, buyer_phone, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'placed', ?, ?, ?)`,
        [
          orderId, userId, user?.hostel_id ?? null, subtotal, deliveryFee, discount, couponCode ?? null,
          Math.max(0, subtotal + deliveryFee - discount),
          details.paymentMethod, details.note.trim(), user?.phone ?? null, now(),
        ],
        tx
      );
      for (const l of lines) {
        await run(
          "INSERT INTO order_items (id, order_id, product_id, kind, name, qty, price) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [newId("oi"), orderId, l.product_id, l.kind, l.name, l.qty, Number(l.price)],
          tx
        );
      }
      await run("DELETE FROM cart_items WHERE user_id = ?", [userId], tx);
    });
    return (await loadOrders("id = ?", [orderId]))[0];
  },

  async updateStatus(orderId, status) {
    await transaction(async (tx) => {
      const order = await one<{ user_id: string; status: Order["status"]; total: number }>(
        "SELECT user_id, status, total FROM orders WHERE id = ?",
        [orderId],
        tx
      );
      if (!order) return;
      await run("UPDATE orders SET status = ? WHERE id = ?", [status, orderId], tx);
      if (status !== order.status && status !== "placed") {
        await notify(order.user_id, ORDER_STATUS_TITLE[status], orderStatusBody(status, Number(order.total)), tx);
      }
    });
  },

  async cancel(orderId) {
    await transaction(async (tx) => {
      const order = await one<{ user_id: string; status: Order["status"] }>(
        "SELECT user_id, status FROM orders WHERE id = ?",
        [orderId],
        tx
      );
      if (!order) return;
      if (order.user_id !== currentActor()?.id) {
        throw new Error("You can only cancel your own orders.");
      }
      if (order.status !== "placed") {
        throw new Error("This order can no longer be cancelled — contact the service team.");
      }
      await run("UPDATE orders SET status = 'cancelled' WHERE id = ?", [orderId], tx);
    });
  },

  subscribe: serverOnly,
  subscribeAll: serverOnly,
};

// ── Store settings (delivery fee, single row) ──────────────────────────────

export const storeSettings: StoreSettingsRepository = {
  async get() {
    const r = await loadStoreSettings();
    return {
      deliveryFeeEnabled: toBool(r.delivery_fee_enabled),
      deliveryFee: Number(r.delivery_fee),
      freeDeliveryMinAmount: r.free_delivery_min_amount !== null ? Number(r.free_delivery_min_amount) : undefined,
    };
  },

  async update(patch) {
    const sets: string[] = [];
    const params: unknown[] = [];
    const put = (col: string, v: unknown) => { sets.push(`${col} = ?`); params.push(v); };
    if (patch.deliveryFeeEnabled !== undefined) put("delivery_fee_enabled", patch.deliveryFeeEnabled ? 1 : 0);
    if (patch.deliveryFee !== undefined) put("delivery_fee", patch.deliveryFee);
    if ("freeDeliveryMinAmount" in patch) put("free_delivery_min_amount", patch.freeDeliveryMinAmount ?? null);
    if (!sets.length) return;
    await run(`UPDATE store_settings SET ${sets.join(", ")} WHERE id = 1`, params);
  },

  subscribe: serverOnly,
};

// ── Coupons ─────────────────────────────────────────────────────────────────

export const coupons: CouponRepository = {
  async listAll() {
    const rows = await all<CouponRow>(`SELECT ${COUPON_COLS} FROM coupons ORDER BY created_at DESC`);
    return rows.map(toCoupon);
  },

  async add(coupon) {
    const code = coupon.code.trim().toUpperCase();
    if (!code) throw new Error("Enter a coupon code.");
    try {
      await run(
        "INSERT INTO coupons (id, code, kind, value, active, min_order_amount, max_uses, used_count, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)",
        [
          newId("coupon"), code, coupon.kind, coupon.value, coupon.active ? 1 : 0,
          coupon.minOrderAmount ?? null, coupon.maxUses ?? null, coupon.expiresAt ?? null, now(),
        ]
      );
    } catch (err) {
      if ((err as { errno?: number }).errno === 1062) throw new Error("A coupon with this code already exists.");
      throw err;
    }
  },

  async update(id, patch) {
    const sets: string[] = [];
    const params: unknown[] = [];
    const put = (col: string, v: unknown) => { sets.push(`${col} = ?`); params.push(v); };
    if (patch.code !== undefined) put("code", patch.code.trim().toUpperCase());
    if (patch.kind !== undefined) put("kind", patch.kind);
    if (patch.value !== undefined) put("value", patch.value);
    if (patch.active !== undefined) put("active", patch.active ? 1 : 0);
    if ("minOrderAmount" in patch) put("min_order_amount", patch.minOrderAmount ?? null);
    if ("maxUses" in patch) put("max_uses", patch.maxUses ?? null);
    if ("expiresAt" in patch) put("expires_at", patch.expiresAt ?? null);
    if (!sets.length) return;
    params.push(id);
    await run(`UPDATE coupons SET ${sets.join(", ")} WHERE id = ?`, params);
  },

  async remove(id) {
    await run("DELETE FROM coupons WHERE id = ?", [id]);
  },

  async validate(code, subtotal) {
    return checkCoupon(code, subtotal);
  },

  subscribe: serverOnly,
};

// ── Used books ─────────────────────────────────────────────────────────────

export const usedBooks: UsedBookRepository = {
  async listAll() {
    const rows = await all<{
      id: string; hostel_id: string | null; seller_id: string; seller_name: string; title: string;
      author: string; category: string; academic_class: string; book_condition: UsedBookListing["condition"];
      price: number; is_free: number; phone: string; image: string | null; created_at: string;
    }>(
      `SELECT id, hostel_id, seller_id, seller_name, title, author, category, academic_class,
              book_condition, price, is_free, phone, image, created_at
         FROM used_book_listings ORDER BY created_at DESC`
    );
    return rows.map<UsedBookListing>((r) => ({
      id: r.id,
      hostelId: r.hostel_id ?? "",
      sellerId: r.seller_id,
      sellerName: r.seller_name,
      title: r.title,
      author: r.author,
      category: r.category,
      academicClass: r.academic_class,
      condition: r.book_condition,
      price: Number(r.price),
      free: toBool(r.is_free),
      phone: r.phone,
      image: r.image ?? undefined,
      createdAt: toIso(r.created_at),
    }));
  },

  async add(book) {
    await run(
      `INSERT INTO used_book_listings (id, hostel_id, seller_id, seller_name, title, author, category,
                                       academic_class, book_condition, price, is_free, phone, image, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId("ubook"), book.hostelId || null, book.sellerId, book.sellerName, book.title, book.author,
        book.category, book.academicClass, book.condition, book.price, book.free ? 1 : 0,
        book.phone, book.image ?? null, now(),
      ]
    );
  },

  async remove(id) {
    await run("DELETE FROM used_book_listings WHERE id = ?", [id]);
  },

  subscribe: serverOnly,
};

// ── Home-page promotions (hero banners + login popups) ──────────────────────

interface PromoRow {
  id: string; placement: Promotion["placement"]; image: string; title: string | null;
  tagline: string | null; link_url: string | null; active: number; created_at: string;
}
const toPromotion = (r: PromoRow, areas?: GeoArea[]): Promotion => ({
  id: r.id,
  placement: r.placement,
  image: r.image,
  title: r.title ?? undefined,
  tagline: r.tagline ?? undefined,
  linkUrl: r.link_url ?? undefined,
  active: toBool(r.active),
  createdAt: toIso(r.created_at),
  ...(areas && areas.length ? { areas } : {}),
});

export const promotions: PromotionRepository = {
  async listAll() {
    const rows = await all<PromoRow>(
      "SELECT id, placement, image, title, tagline, link_url, active, created_at FROM promotions ORDER BY created_at DESC"
    );
    const areas = await loadAreas("promotion", rows.map((r) => r.id));
    return rows.map((r) => toPromotion(r, areas.get(r.id)));
  },
  async listActive(placement) {
    const rows = await all<PromoRow>(
      "SELECT id, placement, image, title, tagline, link_url, active, created_at FROM promotions WHERE placement = ? AND active = 1 ORDER BY created_at DESC",
      [placement]
    );
    const areas = await loadAreas("promotion", rows.map((r) => r.id));
    return rows.map((r) => toPromotion(r, areas.get(r.id)));
  },
  async add(promo) {
    await transaction(async (tx) => {
      const id = newId("promo");
      await run(
        `INSERT INTO promotions (id, placement, image, title, tagline, link_url, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
        [id, promo.placement, promo.image, promo.title ?? null, promo.tagline ?? null, promo.linkUrl ?? null, now()],
        tx
      );
      await writeAreas("promotion", id, promo.areas, tx);
    });
  },
  async update(id, patch) {
    await transaction(async (tx) => {
      const sets: string[] = [];
      const vals: unknown[] = [];
      if (patch.placement !== undefined) { sets.push("placement = ?"); vals.push(patch.placement); }
      if (patch.image !== undefined) { sets.push("image = ?"); vals.push(patch.image); }
      if (patch.title !== undefined) { sets.push("title = ?"); vals.push(patch.title ?? null); }
      if (patch.tagline !== undefined) { sets.push("tagline = ?"); vals.push(patch.tagline ?? null); }
      if (patch.linkUrl !== undefined) { sets.push("link_url = ?"); vals.push(patch.linkUrl ?? null); }
      if (patch.active !== undefined) { sets.push("active = ?"); vals.push(patch.active ? 1 : 0); }
      if (sets.length > 0) {
        vals.push(id);
        await run(`UPDATE promotions SET ${sets.join(", ")} WHERE id = ?`, vals, tx);
      }
      if (patch.areas !== undefined) await writeAreas("promotion", id, patch.areas, tx);
    });
  },
  async toggleActive(id, active) {
    await run("UPDATE promotions SET active = ? WHERE id = ?", [active ? 1 : 0, id]);
  },
  async remove(id) {
    await transaction(async (tx) => {
      await run("DELETE FROM availability_areas WHERE entity_type = 'promotion' AND entity_id = ?", [id], tx);
      await run("DELETE FROM promotions WHERE id = ?", [id], tx);
    });
  },
  subscribe: serverOnly,
};

// ── Study abroad ───────────────────────────────────────────────────────────

interface StudyRow {
  id: string; kind: string; title: string; active: number; image: string | null; attrs: unknown; created_at: string;
}

const toStudyItem = (r: StudyRow): StudyAbroadItem => ({
  id: r.id,
  kind: r.kind,
  active: toBool(r.active),
  createdAt: toIso(r.created_at),
  ...(r.image ? { image: r.image } : {}),
  ...parseAttrs(r.attrs),
} as StudyAbroadItem);

export const studyAbroad: StudyAbroadRepository = {
  async listAll() {
    const rows = await all<StudyRow>(
      "SELECT id, kind, title, active, image, attrs, created_at FROM study_abroad_items ORDER BY created_at DESC"
    );
    return rows.map(toStudyItem);
  },

  /** Publishing a PROMO doubles as a push: every hostel member is notified. */
  async add(item) {
    await transaction(async (tx) => {
      const input = item as unknown as Record<string, unknown>;
      const rest = omitKeys(input, STUDY_SHARED);
      const kind = input.kind as string;
      const title = (rest.title ?? rest.name ?? "") as string;
      const newItemId = newId("study");
      await run(
        "INSERT INTO study_abroad_items (id, kind, title, active, image, attrs, created_at) VALUES (?, ?, ?, 1, ?, ?, ?)",
        [newItemId, kind, title, (input.image as string) ?? null, JSON.stringify(rest), now()],
        tx
      );
      if (kind === "promo") {
        const members = await all<{ id: string }>(
          "SELECT id FROM users WHERE role NOT IN ('owner','superadmin','marketing','service')",
          [],
          tx
        );
        const tagline = (rest.tagline as string) ?? "";
        for (const m of members) {
          await run(
            "INSERT INTO notifications (id, user_id, title, body, is_read, created_at) VALUES (?, ?, ?, ?, 0, ?)",
            [newId("notif"), m.id, `Study abroad: ${title}`, `${tagline} — see Explore → Study Abroad.`, now()],
            tx
          );
        }
      }
    });
  },

  async update(id, patch) {
    await transaction(async (tx) => {
      const row = await one<StudyRow>(
        "SELECT id, kind, title, active, image, attrs, created_at FROM study_abroad_items WHERE id = ?",
        [id],
        tx
      );
      if (!row) return;
      const p = patch as unknown as Record<string, unknown>;
      const merged = { ...parseAttrs(row.attrs), ...omitKeys(p, STUDY_SHARED) };
      const title = (merged.title ?? merged.name ?? row.title) as string;
      await run(
        "UPDATE study_abroad_items SET title = ?, attrs = ?, image = ?, active = ? WHERE id = ?",
        [
          title, JSON.stringify(merged),
          p.image === undefined ? row.image : ((p.image as string) ?? null),
          p.active === undefined ? row.active : p.active ? 1 : 0,
          id,
        ],
        tx
      );
    });
  },

  async toggleActive(id) {
    await run("UPDATE study_abroad_items SET active = NOT active WHERE id = ?", [id]);
  },

  async remove(id) {
    await run("DELETE FROM study_abroad_items WHERE id = ?", [id]);
  },

  subscribe: serverOnly,
};

export const studyLeads: StudyLeadRepository = {
  async listAll() {
    const rows = await all<{
      id: string; user_id: string | null; name: string; phone: string; email: string;
      last_academic: string; english_test: string; interested_country: string; subjects: string;
      contacted: number; created_at: string;
    }>(
      `SELECT id, user_id, name, phone, email, last_academic, english_test, interested_country,
              subjects, contacted, created_at FROM study_leads ORDER BY created_at DESC`
    );
    return rows.map<StudyLead>((r) => ({
      id: r.id,
      userId: r.user_id ?? "",
      name: r.name,
      phone: r.phone,
      email: r.email,
      lastAcademic: r.last_academic,
      englishTest: r.english_test,
      interestedCountry: r.interested_country,
      subjects: r.subjects,
      contacted: toBool(r.contacted),
      createdAt: toIso(r.created_at),
    }));
  },

  async add(lead) {
    await run(
      `INSERT INTO study_leads (id, user_id, name, phone, email, last_academic, english_test,
                                interested_country, subjects, contacted, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        newId("lead"), lead.userId || null, lead.name, lead.phone, lead.email, lead.lastAcademic,
        lead.englishTest, lead.interestedCountry, lead.subjects, now(),
      ]
    );
  },

  async setContacted(id, contacted) {
    await run("UPDATE study_leads SET contacted = ? WHERE id = ?", [contacted ? 1 : 0, id]);
  },

  async remove(id) {
    await run("DELETE FROM study_leads WHERE id = ?", [id]);
  },

  subscribe: serverOnly,
};

// ── Quick service (member home "Quick actions") availability, single row ──

export const quickServices: QuickServicesRepository = {
  async get() {
    const r = await one<{ data: unknown }>("SELECT data FROM quick_service_settings WHERE id = 1");
    return parseAttrs(r?.data) as QuickServiceSettings;
  },

  async update(key, patch) {
    const r = await one<{ data: unknown }>("SELECT data FROM quick_service_settings WHERE id = 1");
    const current = (parseAttrs(r?.data) as QuickServiceSettings)[key] ?? { enabled: true, areas: [] };
    const next = { ...(parseAttrs(r?.data) as QuickServiceSettings), [key]: { ...current, ...patch } };
    await run("UPDATE quick_service_settings SET data = ? WHERE id = 1", [JSON.stringify(next)]);
  },

  subscribe: serverOnly,
};

// ── Hero promo settings (single row) ───────────────────────────────────────

export const promoSettings: PromoSettingsRepository = {
  async get() {
    const r = await one<{
      source_study: number; source_offers: number; source_grocery: number; source_books: number;
      interval_sec: number; photo_height_px: number;
    }>(
      "SELECT source_study, source_offers, source_grocery, source_books, interval_sec, photo_height_px FROM hero_promo_settings WHERE id = 1"
    );
    return {
      sources: {
        study: r ? toBool(r.source_study) : true,
        offers: r ? toBool(r.source_offers) : true,
        grocery: r ? toBool(r.source_grocery) : true,
        books: r ? toBool(r.source_books) : true,
      },
      intervalSec: r?.interval_sec ?? 4,
      photoHeightPx: r?.photo_height_px ?? 150,
    } satisfies HeroPromoSettings;
  },

  async update(patch) {
    const sets: string[] = [];
    const params: unknown[] = [];
    const put = (col: string, v: unknown) => { sets.push(`${col} = ?`); params.push(v); };
    if (patch.sources?.study !== undefined) put("source_study", patch.sources.study ? 1 : 0);
    if (patch.sources?.offers !== undefined) put("source_offers", patch.sources.offers ? 1 : 0);
    if (patch.sources?.grocery !== undefined) put("source_grocery", patch.sources.grocery ? 1 : 0);
    if (patch.sources?.books !== undefined) put("source_books", patch.sources.books ? 1 : 0);
    if (patch.intervalSec !== undefined) put("interval_sec", patch.intervalSec);
    if (patch.photoHeightPx !== undefined) put("photo_height_px", patch.photoHeightPx);
    if (!sets.length) return;
    await run(`UPDATE hero_promo_settings SET ${sets.join(", ")} WHERE id = 1`, params);
  },

  subscribe: serverOnly,
};

// First-run setup: create the tables if they're missing, then make sure the
// platform-team accounts exist. Runs once per process, before the first query.
//
// The admin phone numbers come from environment variables rather than being
// committed — with phone-only sign-in, a number hardcoded in a public repo
// would be a published admin login. Set in the cPanel Node.js App screen:
//   SUPERADMIN_PHONE / SUPERADMIN_NAME   (required for admin access)
//   MARKETING_PHONE  / MARKETING_NAME    (optional)
//   SERVICE_PHONE    / SERVICE_NAME      (optional)

import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import type { Role } from "../../types";
import { normalizePhone } from "../../../utils/phone";
import { hashPassword } from "../password";
import { all, getPool, isMysqlConfigured, one, run } from "./connection";
import { newId } from "./ids";

let readyPromise: Promise<void> | null = null;

async function tablesExist(): Promise<boolean> {
  const row = await one<{ n: number }>(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users'"
  );
  return (row?.n ?? 0) > 0;
}

async function tableExists(table: string): Promise<boolean> {
  const row = await one<{ n: number }>(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
    [table]
  );
  return (row?.n ?? 0) > 0;
}

/** Creates the password-reset + SMTP tables on databases that predate them. */
async function ensureEmailTables(): Promise<void> {
  if (!(await tableExists("password_reset_otps"))) {
    await run(
      `CREATE TABLE password_reset_otps (
         id VARCHAR(64) NOT NULL PRIMARY KEY,
         user_id VARCHAR(64) NOT NULL,
         code_hash VARCHAR(255) NOT NULL,
         expires_at DATETIME(3) NOT NULL,
         attempts INT NOT NULL DEFAULT 0,
         consumed_at DATETIME(3) NULL,
         created_at DATETIME(3) NOT NULL,
         INDEX idx_reset_user (user_id, created_at),
         CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    );
  }
  if (!(await tableExists("smtp_settings"))) {
    await run(
      `CREATE TABLE smtp_settings (
         id TINYINT NOT NULL PRIMARY KEY DEFAULT 1,
         host VARCHAR(191) NOT NULL DEFAULT '',
         port INT NOT NULL DEFAULT 465,
         secure BOOLEAN NOT NULL DEFAULT TRUE,
         username VARCHAR(191) NOT NULL DEFAULT '',
         password_enc TEXT NULL,
         from_email VARCHAR(191) NOT NULL DEFAULT '',
         from_name VARCHAR(191) NOT NULL DEFAULT '',
         configured BOOLEAN NOT NULL DEFAULT FALSE,
         CONSTRAINT ck_smtp_singleton CHECK (id = 1)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    );
  }
  await run("INSERT IGNORE INTO smtp_settings (id) VALUES (1)");
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const row = await one<{ n: number }>(
    "SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?",
    [table, column]
  );
  return (row?.n ?? 0) > 0;
}

async function indexExists(table: string, indexName: string): Promise<boolean> {
  const row = await one<{ n: number }>(
    "SELECT COUNT(*) AS n FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?",
    [table, indexName]
  );
  return (row?.n ?? 0) > 0;
}

/**
 * Migrates databases created before phone_normalized/password_hash were
 * enforced (db/schema.mysql.sql covers fresh installs already). Idempotent —
 * every step checks first, so it's cheap to run on every process start.
 */
async function ensureUserCredentialColumns(): Promise<void> {
  if (!(await columnExists("users", "phone_normalized"))) {
    await run("ALTER TABLE users ADD COLUMN phone_normalized VARCHAR(20) NULL AFTER phone");
  }
  const unnormalized = await all<{ id: string; phone: string }>(
    "SELECT id, phone FROM users WHERE phone_normalized IS NULL"
  );
  for (const u of unnormalized) {
    await run("UPDATE users SET phone_normalized = ? WHERE id = ?", [normalizePhone(u.phone), u.id]);
  }
  if (!(await indexExists("users", "uq_users_phone_normalized"))) {
    try {
      await run("ALTER TABLE users ADD UNIQUE INDEX uq_users_phone_normalized (phone_normalized)");
    } catch (err) {
      // Pre-existing duplicate phone numbers (the exact bug this migration
      // fixes going forward) block the constraint from being added — surface
      // them clearly so an operator can merge/rename the accounts by hand,
      // rather than crashing every request until it's resolved. New signups
      // are still protected: phoneAvailable() and signup() both check
      // phone_normalized regardless of whether the DB-level constraint
      // could be added.
      const dupes = await all<{ phone_normalized: string; n: number; ids: string }>(
        "SELECT phone_normalized, COUNT(*) AS n, GROUP_CONCAT(id) AS ids FROM users " +
          "WHERE phone_normalized IS NOT NULL GROUP BY phone_normalized HAVING n > 1"
      );
      console.warn(
        "[hostel-erp] Could not enforce one-account-per-phone-number at the database level — " +
          "these phone numbers already have more than one account and need manual review:",
        dupes.map((d) => `${d.phone_normalized} (${d.ids})`).join(", "),
        err
      );
    }
  }
  const unhashed = await all<{ id: string; phone: string }>(
    "SELECT id, phone FROM users WHERE password_hash IS NULL"
  );
  for (const u of unhashed) {
    // Every pre-existing account's password becomes its own phone number —
    // the same value a brand-new signup would have to type to sign back in.
    await run("UPDATE users SET password_hash = ? WHERE id = ?", [hashPassword(normalizePhone(u.phone)), u.id]);
  }
}

async function ensureShoppingCostStatusColumn(): Promise<void> {
  if (await columnExists("shopping_costs", "status")) return;
  await run(
    "ALTER TABLE shopping_costs ADD COLUMN status ENUM('pending','approved','denied') NOT NULL DEFAULT 'pending' AFTER items"
  );
  // Pre-existing spend already fed past months' bills as if approved —
  // grandfather it in rather than retroactively shrinking meal-rate history
  // that's already been billed and (possibly) paid.
  await run("UPDATE shopping_costs SET status = 'approved'");
}

async function ensureShoppingCostAddedByManagerColumn(): Promise<void> {
  if (await columnExists("shopping_costs", "added_by_manager")) return;
  await run(
    "ALTER TABLE shopping_costs ADD COLUMN added_by_manager BOOLEAN NOT NULL DEFAULT FALSE AFTER status"
  );
}

/** Adds the shopping-cost-edit announcement kinds to the enum on databases
 * that predate them (new INSERTs with those kinds fail otherwise). */
async function ensureAnnouncementKinds(): Promise<void> {
  const row = await one<{ COLUMN_TYPE: string }>(
    "SELECT COLUMN_TYPE FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'announcements' AND column_name = 'kind'"
  );
  if (row?.COLUMN_TYPE?.includes("shopping-cost-edit-poll")) return;
  await run(
    `ALTER TABLE announcements MODIFY COLUMN kind
       ENUM('general','cook-absence-poll','cook-absence-resolved','cook-leave-approved',
            'spin-wheel-cta','swap-request','swap-completed','swap-denied','shortage-alert',
            'meal-edit-poll','meal-edit-resolved',
            'shopping-cost-edit-poll','shopping-cost-edit-resolved') NOT NULL DEFAULT 'general'`
  );
}

/** Creates the vote-gated shopping-cost-edit tables on databases that predate them. */
async function ensureShoppingCostEditTables(): Promise<void> {
  if (!(await tableExists("shopping_cost_edit_requests"))) {
    await run(
      `CREATE TABLE shopping_cost_edit_requests (
         id             VARCHAR(64) NOT NULL PRIMARY KEY,
         hostel_id      VARCHAR(64) NOT NULL,
         cost_id        VARCHAR(64) NOT NULL,
         target_user_id VARCHAR(64) NOT NULL,
         current_amount DECIMAL(10,2) NOT NULL,
         new_amount     DECIMAL(10,2) NOT NULL,
         new_items      TEXT        NULL,
         reason         TEXT        NOT NULL,
         requested_by   VARCHAR(64) NOT NULL,
         status         ENUM('pending','approved','denied') NOT NULL DEFAULT 'pending',
         created_at     DATETIME(3) NOT NULL,
         INDEX idx_shop_edits_hostel (hostel_id),
         CONSTRAINT fk_shop_edits_hostel FOREIGN KEY (hostel_id)      REFERENCES hostels(id)        ON DELETE CASCADE,
         CONSTRAINT fk_shop_edits_cost   FOREIGN KEY (cost_id)        REFERENCES shopping_costs(id) ON DELETE CASCADE,
         CONSTRAINT fk_shop_edits_target FOREIGN KEY (target_user_id) REFERENCES users(id)          ON DELETE CASCADE
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    );
  }
  if (!(await tableExists("shopping_cost_edit_votes"))) {
    await run(
      `CREATE TABLE shopping_cost_edit_votes (
         request_id VARCHAR(64) NOT NULL,
         user_id    VARCHAR(64) NOT NULL,
         choice     ENUM('yes','no') NOT NULL,
         voted_at   DATETIME(3) NOT NULL,
         PRIMARY KEY (request_id, user_id),
         CONSTRAINT fk_shop_edit_votes_req  FOREIGN KEY (request_id) REFERENCES shopping_cost_edit_requests(id) ON DELETE CASCADE,
         CONSTRAINT fk_shop_edit_votes_user FOREIGN KEY (user_id)    REFERENCES users(id)                       ON DELETE CASCADE
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    );
  }
}

async function ensureDutyGroupSizeColumn(): Promise<void> {
  if (await columnExists("duty_plans", "group_size")) return;
  await run("ALTER TABLE duty_plans ADD COLUMN group_size INT NOT NULL DEFAULT 1 AFTER budget_per_day");
}

async function ensureHostelVerifiedColumn(): Promise<void> {
  if (await columnExists("hostels", "verified")) return;
  await run("ALTER TABLE hostels ADD COLUMN verified BOOLEAN NOT NULL DEFAULT FALSE AFTER meal_toggle_cutoff");
}

async function ensureMealsDefaultOffColumn(): Promise<void> {
  if (await columnExists("users", "meals_default_off")) return;
  await run("ALTER TABLE users ADD COLUMN meals_default_off BOOLEAN NOT NULL DEFAULT FALSE AFTER meals_suspended");
}

async function ensureHostelStreetColumn(): Promise<void> {
  if (await columnExists("hostels", "street")) return;
  await run("ALTER TABLE hostels ADD COLUMN street VARCHAR(255) NULL AFTER service_charge_monthly");
}

/** Service Manager permission assignment (Super Admin → Users). */
async function ensureServicePermissionColumn(): Promise<void> {
  if (await columnExists("users", "service_kinds")) return;
  await run("ALTER TABLE users ADD COLUMN service_kinds VARCHAR(191) NULL AFTER notify_monthly_report");
}

async function ensureAdvanceRentColumns(): Promise<void> {
  if (!(await columnExists("hostels", "advance_rent_required"))) {
    await run(
      "ALTER TABLE hostels ADD COLUMN advance_rent_required BOOLEAN NOT NULL DEFAULT FALSE AFTER service_charge_monthly"
    );
  }
  if (!(await columnExists("users", "advance_held"))) {
    await run(
      "ALTER TABLE users ADD COLUMN advance_held DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER joined_at"
    );
  }
}

async function applySchema(): Promise<void> {
  const file = path.join(process.cwd(), "db", "schema.mysql.sql");
  const sql = fs.readFileSync(file, "utf8");
  // A dedicated connection with multipleStatements — deliberately NOT enabled
  // on the shared pool, so ordinary queries can't be chained into.
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD ?? "",
    database: process.env.MYSQL_DATABASE,
    multipleStatements: true,
    charset: "utf8mb4",
  });
  try {
    await conn.query(sql);
    console.log("[hostel-erp] MySQL schema created.");
  } finally {
    await conn.end();
  }
}

interface SeedAccount {
  role: Role;
  phoneVar: string;
  nameVar: string;
  fallbackName: string;
  required: boolean;
}

const PLATFORM_ACCOUNTS: SeedAccount[] = [
  { role: "superadmin", phoneVar: "SUPERADMIN_PHONE", nameVar: "SUPERADMIN_NAME", fallbackName: "Super Admin", required: true },
  { role: "marketing", phoneVar: "MARKETING_PHONE", nameVar: "MARKETING_NAME", fallbackName: "Marketing Manager", required: false },
  { role: "service", phoneVar: "SERVICE_PHONE", nameVar: "SERVICE_NAME", fallbackName: "Service Manager", required: false },
];

async function seedPlatformTeam(): Promise<void> {
  for (const acct of PLATFORM_ACCOUNTS) {
    const phone = process.env[acct.phoneVar]?.trim();
    if (!phone) {
      if (acct.required) {
        console.warn(
          `[hostel-erp] ${acct.phoneVar} is not set — no ${acct.role} account exists, so the admin screens can't be reached. ` +
            `Set ${acct.phoneVar} (and optionally ${acct.nameVar}) and restart.`
        );
      }
      continue;
    }
    // Already present (by role or by that phone)? Leave it alone.
    const existing = await one<{ id: string }>(
      "SELECT id FROM users WHERE role = ? OR phone = ? LIMIT 1",
      [acct.role, phone]
    );
    if (existing) continue;

    const name = process.env[acct.nameVar]?.trim() || acct.fallbackName;
    await run(
      "INSERT INTO users (id, role, name, phone, phone_normalized, password_hash, avatar_seed) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        newId("user"), acct.role, name, phone, normalizePhone(phone), hashPassword(normalizePhone(phone)),
        `${acct.role}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      ]
    );
    console.log(`[hostel-erp] Created ${acct.role} account for ${phone} (password: the phone number).`);
  }
}

/** Creates promotions (home banners + login popups) on databases that predate it. */
async function ensurePromotionsTable(): Promise<void> {
  if (await tableExists("promotions")) return;
  await run(
    `CREATE TABLE promotions (
       id         VARCHAR(64) NOT NULL PRIMARY KEY,
       placement  ENUM('hero','popup') NOT NULL,
       image      MEDIUMTEXT  NOT NULL,
       title      VARCHAR(191) NULL,
       tagline    VARCHAR(255) NULL,
       link_url   VARCHAR(512) NULL,
       active     BOOLEAN     NOT NULL DEFAULT TRUE,
       created_at DATETIME(3) NOT NULL,
       INDEX idx_promotions_placement (placement, active)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );
}

/** Creates push_subscriptions on databases that predate browser push. */
async function ensurePushSubscriptionsTable(): Promise<void> {
  if (await tableExists("push_subscriptions")) return;
  await run(
    `CREATE TABLE push_subscriptions (
       id         VARCHAR(64)  NOT NULL PRIMARY KEY,
       user_id    VARCHAR(64)  NOT NULL,
       endpoint   VARCHAR(512) NOT NULL,
       p256dh     TEXT         NOT NULL,
       auth       TEXT         NOT NULL,
       created_at DATETIME(3)  NOT NULL,
       UNIQUE KEY uq_push_endpoint (endpoint(191)),
       INDEX idx_push_user (user_id),
       CONSTRAINT fk_push_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );
}

/** Creates leave_requests on databases that predate it. */
async function ensureLeaveRequestsTable(): Promise<void> {
  if (await tableExists("leave_requests")) return;
  await run(
    `CREATE TABLE leave_requests (
       id           VARCHAR(64) NOT NULL PRIMARY KEY,
       hostel_id    VARCHAR(64) NOT NULL,
       user_id      VARCHAR(64) NOT NULL,
       requested_at DATETIME(3) NOT NULL,
       leave_date   DATE        NOT NULL,
       reason       TEXT        NULL,
       status       ENUM('pending','approved','denied') NOT NULL DEFAULT 'pending',
       decided_by   VARCHAR(64) NULL,
       decided_at   DATETIME(3) NULL,
       INDEX idx_leave_requests_hostel (hostel_id),
       INDEX idx_leave_requests_user (user_id),
       CONSTRAINT fk_leave_requests_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE,
       CONSTRAINT fk_leave_requests_user   FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );
}

async function ensurePromoSettings(): Promise<void> {
  const rows = await all<{ id: number }>("SELECT id FROM hero_promo_settings LIMIT 1");
  if (rows.length === 0) await run("INSERT INTO hero_promo_settings (id) VALUES (1)");
}

/** Widens orders.status to the full delivery pipeline, and adds the
 * discount/coupon/buyer-phone columns, on databases that predate them. */
async function ensureOrderPipelineColumns(): Promise<void> {
  const row = await one<{ COLUMN_TYPE: string }>(
    "SELECT COLUMN_TYPE FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'status'"
  );
  if (row && !row.COLUMN_TYPE.includes("preparing")) {
    await run(
      "ALTER TABLE orders MODIFY COLUMN status ENUM('placed','confirmed','preparing','picked_up','on_the_way','delivered','cancelled') NOT NULL DEFAULT 'placed'"
    );
  }
  if (!(await columnExists("orders", "discount"))) {
    await run("ALTER TABLE orders ADD COLUMN discount DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER delivery_fee");
  }
  if (!(await columnExists("orders", "coupon_code"))) {
    await run("ALTER TABLE orders ADD COLUMN coupon_code VARCHAR(32) NULL AFTER discount");
  }
  if (!(await columnExists("orders", "buyer_phone"))) {
    await run("ALTER TABLE orders ADD COLUMN buyer_phone VARCHAR(32) NULL AFTER note");
  }
}

async function ensureCouponsTable(): Promise<void> {
  if (await tableExists("coupons")) return;
  await run(
    `CREATE TABLE coupons (
       id               VARCHAR(64) NOT NULL PRIMARY KEY,
       code             VARCHAR(32) NOT NULL,
       kind             ENUM('percent','flat') NOT NULL,
       value            DECIMAL(10,2) NOT NULL,
       active           BOOLEAN     NOT NULL DEFAULT TRUE,
       min_order_amount DECIMAL(10,2) NULL,
       max_uses         INT         NULL,
       used_count       INT         NOT NULL DEFAULT 0,
       expires_at       DATE        NULL,
       created_at       DATETIME(3) NOT NULL,
       UNIQUE KEY uq_coupons_code (code)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );
}

async function ensureStoreSettingsTable(): Promise<void> {
  if (!(await tableExists("store_settings"))) {
    await run(
      `CREATE TABLE store_settings (
         id                       TINYINT     NOT NULL PRIMARY KEY DEFAULT 1,
         delivery_fee_enabled     BOOLEAN     NOT NULL DEFAULT TRUE,
         delivery_fee             DECIMAL(10,2) NOT NULL DEFAULT 30,
         free_delivery_min_amount DECIMAL(10,2) NULL,
         CONSTRAINT ck_store_settings_singleton CHECK (id = 1)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    );
  }
  const rows = await all<{ id: number }>("SELECT id FROM store_settings LIMIT 1");
  if (rows.length === 0) await run("INSERT INTO store_settings (id) VALUES (1)");
}

/** Idempotent; safe to await before every request. */
export function ensureReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      if (!isMysqlConfigured()) {
        throw new Error(
          "MySQL is not configured — set MYSQL_DATABASE, MYSQL_USER and MYSQL_PASSWORD (see DEPLOY.md)."
        );
      }
      getPool();
      if (!(await tablesExist())) await applySchema();
      await ensureUserCredentialColumns();
      await ensureShoppingCostStatusColumn();
      await ensureShoppingCostAddedByManagerColumn();
      await ensureAnnouncementKinds();
      await ensureShoppingCostEditTables();
      await ensureAdvanceRentColumns();
      await ensureDutyGroupSizeColumn();
      await ensureHostelVerifiedColumn();
      await ensureMealsDefaultOffColumn();
      await ensureHostelStreetColumn();
      await ensureServicePermissionColumn();
      await ensureLeaveRequestsTable();
      await ensureOrderPipelineColumns();
      await ensureCouponsTable();
      await ensureStoreSettingsTable();
      await ensurePushSubscriptionsTable();
      await ensurePromotionsTable();
      await ensureEmailTables();
      await ensurePromoSettings();
      await seedPlatformTeam();
    })().catch((err) => {
      // Let the next request retry rather than caching a failed setup.
      readyPromise = null;
      throw err;
    });
  }
  return readyPromise;
}

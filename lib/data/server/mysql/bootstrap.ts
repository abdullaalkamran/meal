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

async function ensureDutyGroupSizeColumn(): Promise<void> {
  if (await columnExists("duty_plans", "group_size")) return;
  await run("ALTER TABLE duty_plans ADD COLUMN group_size INT NOT NULL DEFAULT 1 AFTER budget_per_day");
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

async function ensurePromoSettings(): Promise<void> {
  const rows = await all<{ id: number }>("SELECT id FROM hero_promo_settings LIMIT 1");
  if (rows.length === 0) await run("INSERT INTO hero_promo_settings (id) VALUES (1)");
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
      await ensureAdvanceRentColumns();
      await ensureDutyGroupSizeColumn();
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

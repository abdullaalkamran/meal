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
import { all, getPool, isMysqlConfigured, one, run } from "./connection";
import { newId } from "./ids";

let readyPromise: Promise<void> | null = null;

async function tablesExist(): Promise<boolean> {
  const row = await one<{ n: number }>(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users'"
  );
  return (row?.n ?? 0) > 0;
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
      "INSERT INTO users (id, role, name, phone, avatar_seed) VALUES (?, ?, ?, ?, ?)",
      [newId("user"), acct.role, name, phone, `${acct.role}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`]
    );
    console.log(`[hostel-erp] Created ${acct.role} account for ${phone}.`);
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

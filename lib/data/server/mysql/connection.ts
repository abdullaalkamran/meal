// MySQL connection pool + query helpers.
//
// Credentials come from the environment ONLY — never commit them, since the
// repo is public. On cPanel set these in the Node.js App screen:
//   MYSQL_HOST      (usually "localhost")
//   MYSQL_DATABASE  e.g. cvqyqwcasg_mydorm
//   MYSQL_USER      e.g. cvqyqwcasg_mydorm
//   MYSQL_PASSWORD  the database user's password
//
// Server-only: imported by route handlers, never by client components.

import mysql from "mysql2/promise";

let pool: mysql.Pool | null = null;

/** True when enough env vars are present to talk to MySQL at all. */
export function isMysqlConfigured(): boolean {
  return Boolean(process.env.MYSQL_DATABASE && process.env.MYSQL_USER);
}

export function getPool(): mysql.Pool {
  if (!pool) {
    if (!isMysqlConfigured()) {
      throw new Error(
        "MySQL is not configured — set MYSQL_DATABASE, MYSQL_USER and MYSQL_PASSWORD (see DEPLOY.md)."
      );
    }
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || "localhost",
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD ?? "",
      database: process.env.MYSQL_DATABASE,
      waitForConnections: true,
      // Shared hosting caps concurrent connections per user — stay modest.
      connectionLimit: Number(process.env.MYSQL_POOL_SIZE || 5),
      charset: "utf8mb4",
      // Hand back DATE/DATETIME as strings so no implicit local-timezone
      // conversion happens; the mappers convert to/from the ISO strings the
      // app's types use.
      dateStrings: true,
      timezone: "Z",
      supportBigNumbers: true,
      decimalNumbers: true,
    });
  }
  return pool;
}

/** Closes the pool (tests; Passenger shutdown). */
export async function closePool(): Promise<void> {
  if (pool) {
    const p = pool;
    pool = null;
    await p.end();
  }
}

type Params = ReadonlyArray<unknown>;
/** Anything that can run a query: the pool, or a connection inside a tx. */
export type Queryable = Pick<mysql.Pool, "query"> | Pick<mysql.PoolConnection, "query">;

/** SELECT helper — returns typed rows. */
export async function all<T>(sql: string, params: Params = [], on: Queryable = getPool()): Promise<T[]> {
  const [rows] = await on.query(sql, params as unknown[]);
  return rows as T[];
}

/** SELECT helper for at most one row. */
export async function one<T>(sql: string, params: Params = [], on: Queryable = getPool()): Promise<T | undefined> {
  const rows = await all<T>(sql, params, on);
  return rows[0];
}

/** INSERT/UPDATE/DELETE helper — returns rows affected. */
export async function run(sql: string, params: Params = [], on: Queryable = getPool()): Promise<number> {
  const [res] = await on.query(sql, params as unknown[]);
  return (res as mysql.ResultSetHeader).affectedRows ?? 0;
}

/**
 * Runs `fn` inside a transaction on a single dedicated connection, rolling
 * back on any error. Every write path uses this so a multi-step change
 * (approve a join request → move the member → free the old seat → notify)
 * either lands completely or not at all — the thing the JSON file store
 * could never guarantee across concurrent Passenger processes.
 */
export async function transaction<T>(
  fn: (conn: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // The connection may already be gone; the original error matters more.
    }
    throw err;
  } finally {
    conn.release();
  }
}

// ── Value conversion between MySQL columns and the app's TS types ──────────

/** MySQL DATETIME(3) ("2026-07-21 09:30:00.123") → ISO ("…T09:30:00.123Z").
 * Stored in UTC, so the calendar/clock parts are simply re-punctuated. */
export function toIso(value: string | Date | null | undefined): string {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  const [d, t = "00:00:00"] = value.split(" ");
  const [hms, ms = "000"] = t.split(".");
  return `${d}T${hms}.${ms.padEnd(3, "0")}Z`;
}

/** ISO string → MySQL DATETIME(3) literal (UTC). */
export function fromIso(iso: string | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  const valid = Number.isNaN(d.getTime()) ? new Date() : d;
  return valid.toISOString().slice(0, 23).replace("T", " ");
}

/** MySQL DATE → "YYYY-MM-DD" (dateStrings already gives this; guards Date). */
export function toDay(value: string | Date | null | undefined): string {
  if (!value) return "";
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

/** TINYINT(1) → boolean. */
export const toBool = (v: unknown): boolean => v === 1 || v === true || v === "1";

/** Drops undefined so optional TS fields stay absent rather than becoming null. */
export function omitUndefined<T extends Record<string, unknown>>(obj: T): T {
  for (const k of Object.keys(obj)) if (obj[k] === undefined) delete obj[k];
  return obj;
}

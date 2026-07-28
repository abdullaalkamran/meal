// The server-side database: the SAME business logic as the mock layer
// (mockRepositories), but running inside Next.js route handlers against a
// JSON file on disk (.data/db.json) instead of browser localStorage. Every
// client goes through /api/rpc, so all users on all devices share one
// authoritative copy of the data.
//
// Consistency notes:
// - Repository methods resolve synchronously (no internal awaits), so each
//   RPC call applies atomically within the Node event loop.
// - Dev-mode module duplication (one instance per compiled route graph) is
//   handled by re-reading the file whenever its mtime moves — every request
//   starts from the newest state on disk.

import fs from "node:fs";
import path from "node:path";
import { SCHEMA_VERSION } from "../schema";
import { normalizePhone } from "../../utils/phone";
import type { User } from "../types";
import { store, type Tables } from "../mock/store";
import { buildSeed } from "../mock/seed";
import {
  mockRepositories,
  setActingUser,
  verifyPassword as mockVerifyPassword,
  verifyPasswordById as mockVerifyPasswordById,
  setUserPassword as mockSetUserPassword,
  otpInsert as mockOtpInsert,
  otpLatestActive as mockOtpLatestActive,
  otpCountSince as mockOtpCountSince,
  otpBumpAttempts as mockOtpBumpAttempts,
  otpConsume as mockOtpConsume,
  loadSmtp as mockLoadSmtp,
  saveSmtp as mockSaveSmtp,
} from "../mock/mockRepositories";
import type { PasswordResetOtp, SmtpSettings } from "../types";
import { hashPassword, verifyPassword as verifyHash } from "./password";
import { decryptSecret, encryptSecret } from "./secretbox";
import { authorize, type SessionUser } from "./policy";
import { isMysqlConfigured } from "./mysql/connection";
import {
  bumpRevision,
  ensureReady as mysqlReady,
  getRevision,
  mysqlRepositories,
  mysqlSystemQueries,
  runWithActor,
  verifyUserPassword,
  verifyUserPasswordById,
  setUserPassword as mysqlSetUserPassword,
  otpInsert as mysqlOtpInsert,
  otpLatestActive as mysqlOtpLatestActive,
  otpCountSince as mysqlOtpCountSince,
  otpBumpAttempts as mysqlOtpBumpAttempts,
  otpConsume as mysqlOtpConsume,
  loadSmtp as mysqlLoadSmtp,
  saveSmtp as mysqlSaveSmtp,
} from "./mysql";
import { newId } from "./mysql/ids";
import { randomInt } from "node:crypto";

export type { SessionUser };

interface DbFile {
  version: number;
  rev: number;
  data: Tables;
}

// Where the JSON database lives. On a host with an EPHEMERAL filesystem
// (Railway, Render, Fly, most containers) the app directory is wiped on every
// redeploy/restart and may be read-only, so persistence there needs a mounted
// persistent volume — point HOSTEL_DATA_DIR at it (e.g. "/data"). Falls back
// to ".data" under the working directory for local dev and disk-backed VPS.
const DATA_DIR = process.env.HOSTEL_DATA_DIR
  ? path.resolve(process.env.HOSTEL_DATA_DIR)
  : path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");

let loadedMtimeMs = -1;
/** True until the first write: the DB is still the untouched seed, so a
 * client may offer its legacy localStorage data as the initial dataset. */
let pristine = !safeExists(DB_FILE);
/** Flips false the first time a disk write fails (read-only/ephemeral FS) so
 * we only warn once; the app keeps working from in-memory state regardless. */
let persistWorks = true;

function safeExists(file: string): boolean {
  try {
    return fs.existsSync(file);
  } catch {
    return false;
  }
}

function ensureFresh() {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(DB_FILE);
  } catch {
    return; // No file yet — keep the in-memory seed.
  }
  if (stat.mtimeMs === loadedMtimeMs) return;
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, "utf8")) as DbFile;
    if (parsed.version === SCHEMA_VERSION) {
      store.replaceData(parsed.data, parsed.rev);
      pristine = false;
    } else if (parsed.data && typeof parsed.data === "object") {
      // A new app release bumped SCHEMA_VERSION. MIGRATE the saved data rather
      // than discard it: merge it over the current seed, so any brand-new
      // tables get their default (empty) value while every existing record is
      // kept. Our schema changes are additive (new optional fields), so old
      // records stay valid. Persist immediately in the new version so this
      // one-time upgrade doesn't rerun. This is what stops a deploy from
      // wiping the JSON-backed database.
      const migrated = { ...buildSeed(), ...parsed.data };
      // v43→: User.futureMealsOff went from a single boolean to a per-meal
      // object ({ breakfast?, lunch?, dinner? }) — a legacy `true` meant "all
      // three off", so it maps to all three switches on.
      migrated.users = migrated.users.map((u) => {
        const legacy = u.futureMealsOff as unknown;
        if (typeof legacy === "boolean") {
          return { ...u, futureMealsOff: legacy ? { breakfast: true, lunch: true, dinner: true } : undefined };
        }
        return u;
      });
      store.replaceData(migrated, parsed.rev ?? 0);
      pristine = false;
      persist();
      return;
    }
  } catch {
    // Corrupt file — keep current state; next write repairs it.
  }
  loadedMtimeMs = stat.mtimeMs;
}

function persist() {
  // The mutation already lives in the in-memory store; the file is just the
  // durable copy. If the filesystem is read-only or ephemeral we must NOT let
  // the write throw — that would turn every data change into a 500 and make
  // the deployed app look broken. Degrade to memory-only instead and warn
  // once so it's visible in the host's logs (fix: mount a writable volume and
  // set HOSTEL_DATA_DIR to it).
  pristine = false;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const payload: DbFile = { version: SCHEMA_VERSION, rev: store.rev, data: store.data };
    fs.writeFileSync(DB_FILE, JSON.stringify(payload));
    loadedMtimeMs = fs.statSync(DB_FILE).mtimeMs;
  } catch (err) {
    if (persistWorks) {
      persistWorks = false;
      console.error(
        `[hostel-erp] Could not write the database to ${DB_FILE} — running from memory only, ` +
          `so data will reset on restart. Mount a writable persistent volume and set ` +
          `HOSTEL_DATA_DIR to its path to make data durable.`,
        err
      );
    }
  }
}

/** Which backend is live. MySQL takes over as soon as it's configured; the
 * JSON file store remains the fallback so an un-configured deploy still runs. */
export const usingMysql = isMysqlConfigured();

export async function getStatus() {
  if (usingMysql) {
    await mysqlReady();
    return {
      rev: await getRevision(),
      version: SCHEMA_VERSION,
      pristine: false,
      persistent: true,
      backend: "mysql" as const,
    };
  }
  ensureFresh();
  return {
    rev: store.rev,
    version: SCHEMA_VERSION,
    pristine,
    persistent: persistWorks,
    backend: "json" as const,
  };
}

// ── Auth lookups (used by /api/auth and the /api/rpc actor derivation) ───────
export async function getUserById(userId: string): Promise<User | undefined> {
  if (usingMysql) {
    await mysqlReady();
    return mysqlRepositories.users.getUser(userId);
  }
  ensureFresh();
  return store.data.users.find((u) => u.id === userId);
}

export async function getUserByPhone(phone: string): Promise<User | undefined> {
  const target = normalizePhone(phone);
  if (usingMysql) {
    await mysqlReady();
    const all = await mysqlRepositories.users.listAll();
    return all.find((u) => normalizePhone(u.phone) === target);
  }
  ensureFresh();
  return store.data.users.find((u) => normalizePhone(u.phone) === target);
}

/** Looks up an account by its email (case-insensitive) — used by the
 * forgot-password flow, which identifies the user by the address the reset
 * code will be sent to. */
export async function getUserByEmail(email: string): Promise<User | undefined> {
  const target = email.trim().toLowerCase();
  if (!target) return undefined;
  const match = (u: User) => (u.email ?? "").trim().toLowerCase() === target;
  if (usingMysql) {
    await mysqlReady();
    const all = await mysqlRepositories.users.listAll();
    return all.find(match);
  }
  ensureFresh();
  return store.data.users.find(match);
}

/** Verifies phone+password for /api/auth. Never exposed over /api/rpc — see
 * the comment on verifyUserPassword/verifyPassword in each backend. */
export async function verifyPassword(phone: string, password: string): Promise<User | undefined> {
  if (usingMysql) {
    await mysqlReady();
    return verifyUserPassword(phone, password);
  }
  ensureFresh();
  return mockVerifyPassword(phone, password);
}

/** Verifies a password for one account id (change-own-password). */
export async function verifyPasswordById(userId: string, password: string): Promise<boolean> {
  if (usingMysql) {
    await mysqlReady();
    return verifyUserPasswordById(userId, password);
  }
  ensureFresh();
  return mockVerifyPasswordById(userId, password);
}

/** Sets a new password for an account; persists on the JSON backend. Callers
 * (the /api/auth password routes) enforce who may do this. */
export async function setUserPassword(userId: string, newPassword: string): Promise<boolean> {
  if (usingMysql) {
    await mysqlReady();
    return mysqlSetUserPassword(userId, newPassword);
  }
  ensureFresh();
  const ok = mockSetUserPassword(userId, newPassword);
  if (ok) persist();
  return ok;
}

// ── Password-reset OTP (email) ──────────────────────────────────────────────
// Backend-agnostic policy over the per-backend storage primitives above.

const OTP_TTL_MS = 10 * 60 * 1000; // codes valid for 10 minutes
const OTP_MAX_PER_HOUR = 5; // requests per account per hour
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // between successive codes
const OTP_MAX_ATTEMPTS = 5; // wrong guesses before a code is dead

const otpStore = () =>
  usingMysql
    ? {
        insert: mysqlOtpInsert,
        latest: mysqlOtpLatestActive,
        countSince: mysqlOtpCountSince,
        bump: mysqlOtpBumpAttempts,
        consume: mysqlOtpConsume,
      }
    : {
        insert: async (o: PasswordResetOtp) => mockOtpInsert(o),
        latest: async (uid: string) => mockOtpLatestActive(uid),
        countSince: async (uid: string, since: string) => mockOtpCountSince(uid, since),
        bump: async (id: string) => mockOtpBumpAttempts(id),
        consume: async (id: string) => mockOtpConsume(id),
      };

/** Creates + stores a reset code, returning the plaintext code for the caller
 * to email (never persisted or returned to a client). Rate-limited. */
export async function createResetOtp(userId: string): Promise<{ code?: string; error?: string }> {
  if (usingMysql) await mysqlReady();
  else ensureFresh();
  const store = otpStore();

  const sinceHour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  if ((await store.countSince(userId, sinceHour)) >= OTP_MAX_PER_HOUR) {
    return { error: "Too many reset requests — please try again later." };
  }
  const last = await store.latest(userId);
  if (last && Date.now() - new Date(last.createdAt).getTime() < OTP_RESEND_COOLDOWN_MS) {
    return { error: "Please wait a minute before requesting another code." };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const now = new Date();
  await store.insert({
    id: newId("otp"),
    userId,
    codeHash: hashPassword(code),
    expiresAt: new Date(now.getTime() + OTP_TTL_MS).toISOString(),
    attempts: 0,
    createdAt: now.toISOString(),
  });
  if (!usingMysql) persist();
  return { code };
}

/** Verifies a code against the account's latest active reset code. */
export async function verifyResetOtp(userId: string, code: string): Promise<{ ok: boolean; error?: string }> {
  if (usingMysql) await mysqlReady();
  else ensureFresh();
  const store = otpStore();

  const otp = await store.latest(userId);
  if (!otp) return { ok: false, error: "No active reset code — request a new one." };
  if (new Date(otp.expiresAt).getTime() < Date.now()) {
    return { ok: false, error: "This code has expired — request a new one." };
  }
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, error: "Too many attempts — request a new code." };
  }
  if (!verifyHash(code, otp.codeHash)) {
    await store.bump(otp.id);
    if (!usingMysql) persist();
    return { ok: false, error: "Incorrect code." };
  }
  await store.consume(otp.id);
  if (!usingMysql) persist();
  return { ok: true };
}

// ── SMTP settings ───────────────────────────────────────────────────────────

export interface SmtpConfig {
  host: string; port: number; secure: boolean; username: string;
  password: string; fromEmail: string; fromName: string;
}

function smtpFromEnv(): SmtpConfig | null {
  const host = process.env.SMTP_HOST;
  const username = process.env.SMTP_USER;
  if (!host || !username) return null;
  return {
    host,
    port: Number(process.env.SMTP_PORT || 465),
    secure: (process.env.SMTP_SECURE ?? "true") !== "false",
    username,
    password: process.env.SMTP_PASS ?? "",
    fromEmail: process.env.MAIL_FROM_EMAIL || username,
    fromName: process.env.MAIL_FROM_NAME || "MyDorm",
  };
}

/** The usable SMTP config (decrypted password) for the mailer — DB first, then
 * env as a fallback. Server-only; never sent to a client. */
export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const stored: SmtpSettings | null = usingMysql
    ? (await (mysqlReady(), mysqlLoadSmtp()))
    : (ensureFresh(), mockLoadSmtp());
  if (stored && stored.host && stored.username) {
    return { ...stored, password: decryptSecret(stored.password) };
  }
  return smtpFromEnv();
}

/** Sanitized view for the Super Admin UI — never includes the password. */
export async function getSmtpConfigPublic(): Promise<{
  configured: boolean; source: "db" | "env" | "none";
  host: string; port: number; secure: boolean; username: string;
  fromEmail: string; fromName: string; hasPassword: boolean;
}> {
  const stored: SmtpSettings | null = usingMysql
    ? (await (mysqlReady(), mysqlLoadSmtp()))
    : (ensureFresh(), mockLoadSmtp());
  if (stored && stored.host && stored.username) {
    return {
      configured: true, source: "db",
      host: stored.host, port: stored.port, secure: stored.secure, username: stored.username,
      fromEmail: stored.fromEmail, fromName: stored.fromName, hasPassword: !!stored.password,
    };
  }
  const env = smtpFromEnv();
  if (env) {
    return {
      configured: true, source: "env",
      host: env.host, port: env.port, secure: env.secure, username: env.username,
      fromEmail: env.fromEmail, fromName: env.fromName, hasPassword: !!env.password,
    };
  }
  return {
    configured: false, source: "none",
    host: "", port: 465, secure: true, username: "", fromEmail: "", fromName: "MyDorm", hasPassword: false,
  };
}

/** Persists SMTP settings (Super Admin). A blank `password` keeps the stored
 * one; otherwise it's encrypted at rest. */
export async function saveSmtpConfig(input: {
  host: string; port: number; secure: boolean; username: string;
  password: string; fromEmail: string; fromName: string;
}): Promise<void> {
  const passwordEnc = input.password ? encryptSecret(input.password) : null;
  const row = {
    host: input.host.trim(),
    port: input.port,
    secure: input.secure,
    username: input.username.trim(),
    passwordEnc,
    fromEmail: (input.fromEmail || input.username).trim(),
    fromName: input.fromName.trim() || "MyDorm",
  };
  if (usingMysql) {
    await mysqlReady();
    await mysqlSaveSmtp(row);
  } else {
    ensureFresh();
    mockSaveSmtp(row);
    persist();
  }
}

export class RpcError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// Extra read queries the client's polling subscriptions need but the
// repository interfaces don't expose (the mock's subscribe callbacks read
// the store directly for these).
const systemQueries = {
  menusByHostel: (hostelId: string) =>
    store.data.menus.filter((m) => m.hostelId === hostelId),
  swapsByHostel: (hostelId: string) =>
    store.data.swapRequests.filter((s) => s.hostelId === hostelId),
  billByUser: (userId: string) =>
    store.data.bills.find((b) => b.userId === userId) ?? null,
};

export interface RpcRequest {
  repo: string;
  method: string;
  args?: unknown[];
}

/** A read-only call needs no revision bump — same naming rule the client uses
 * to decide whether a call can invalidate its subscriptions. */
const isQuery = (method: string) =>
  method.startsWith("list") || method.startsWith("get") || method === "phoneAvailable";

async function handleMysqlRpc(
  body: RpcRequest,
  args: unknown[],
  session: SessionUser | null
): Promise<{ result: unknown; rev: number }> {
  await mysqlReady();
  // The actor is bound to THIS request (AsyncLocalStorage), so concurrent
  // requests can't attribute each other's actions in the activity log.
  return runWithActor(session ? { id: session.id, name: session.name } : null, async () => {
    let result: unknown;
    if (body.repo === "$system") {
      const fn = mysqlSystemQueries[body.method as keyof typeof mysqlSystemQueries];
      if (typeof fn !== "function") throw new RpcError(`Unknown system method: ${body.method}`);
      result = await fn(args[0] as string);
      return { result: result ?? null, rev: await getRevision() };
    }
    const repoObj = Object.prototype.hasOwnProperty.call(mysqlRepositories, body.repo)
      ? mysqlRepositories[body.repo as keyof typeof mysqlRepositories]
      : undefined;
    if (!repoObj) throw new RpcError(`Unknown repository: ${body.repo}`);
    const fn = (repoObj as unknown as Record<string, unknown>)[body.method];
    if (typeof fn !== "function" || body.method.startsWith("subscribe")) {
      throw new RpcError(`Unknown method: ${body.repo}.${body.method}`);
    }
    result = await (fn as (...a: unknown[]) => Promise<unknown>).apply(repoObj, args);
    const rev = isQuery(body.method) ? await getRevision() : await bumpRevision();
    return { result: result ?? null, rev };
  });
}

export async function handleRpc(
  body: RpcRequest,
  session: SessionUser | null
): Promise<{ result: unknown; rev: number }> {
  if (!body || typeof body.repo !== "string" || typeof body.method !== "string") {
    throw new RpcError("Malformed RPC request");
  }
  const args = Array.isArray(body.args) ? body.args : [];

  // Authorization first — this endpoint is the whole attack surface.
  const denied = authorize(body.repo, body.method, session);
  if (denied) throw new RpcError(denied.message, denied.status);

  if (usingMysql) return handleMysqlRpc(body, args, session);

  ensureFresh();
  const revBefore = store.rev;
  // The activity-log actor comes from the verified session, never the body.
  setActingUser(session ? { id: session.id, name: session.name } : undefined);

  try {
    let result: unknown;
    if (body.repo === "$system") {
      // Read-only helpers only. loadDemo / reset / importLegacy used to live
      // here and each REPLACED the entire database; exposed unauthenticated
      // on one public endpoint they were a one-request way to wipe every
      // account, so they are gone. Reseeding is a local-development action.
      if (body.method in systemQueries) {
        const fn = systemQueries[body.method as keyof typeof systemQueries];
        result = fn(args[0] as string);
      } else {
        throw new RpcError(`Unknown system method: ${body.method}`);
      }
    } else {
      const repoObj = Object.prototype.hasOwnProperty.call(mockRepositories, body.repo)
        ? mockRepositories[body.repo as keyof typeof mockRepositories]
        : undefined;
      if (!repoObj) throw new RpcError(`Unknown repository: ${body.repo}`);
      const fn = (repoObj as unknown as Record<string, unknown>)[body.method];
      if (typeof fn !== "function" || body.method.startsWith("subscribe")) {
        throw new RpcError(`Unknown method: ${body.repo}.${body.method}`);
      }
      result = await (fn as (...a: unknown[]) => Promise<unknown>).apply(repoObj, args);
    }

    if (store.rev !== revBefore) persist();
    return { result: result ?? null, rev: store.rev };
  } finally {
    setActingUser(undefined);
  }
}

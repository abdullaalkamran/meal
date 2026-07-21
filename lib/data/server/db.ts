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
import { mockRepositories, setActingUser } from "../mock/mockRepositories";
import { authorize, type SessionUser } from "./policy";
import { isMysqlConfigured } from "./mysql/connection";
import {
  bumpRevision,
  ensureReady as mysqlReady,
  getRevision,
  mysqlRepositories,
  mysqlSystemQueries,
  runWithActor,
} from "./mysql";

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
    }
    // A version-mismatched file is ignored (seed state stays) and will be
    // overwritten in the new format on the next write.
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

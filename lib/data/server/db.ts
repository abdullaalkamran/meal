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
import { store, type Tables } from "../mock/store";
import { mockRepositories, setActingUser } from "../mock/mockRepositories";

interface DbFile {
  version: number;
  rev: number;
  data: Tables;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");

let loadedMtimeMs = -1;
/** True until the first write: the DB is still the untouched seed, so a
 * client may offer its legacy localStorage data as the initial dataset. */
let pristine = !fs.existsSync(DB_FILE);

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
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const payload: DbFile = { version: SCHEMA_VERSION, rev: store.rev, data: store.data };
  fs.writeFileSync(DB_FILE, JSON.stringify(payload));
  loadedMtimeMs = fs.statSync(DB_FILE).mtimeMs;
  pristine = false;
}

export function getStatus() {
  ensureFresh();
  return { rev: store.rev, version: SCHEMA_VERSION, pristine };
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
  actor?: { id: string; name: string } | null;
}

export async function handleRpc(body: RpcRequest): Promise<{ result: unknown; rev: number }> {
  if (!body || typeof body.repo !== "string" || typeof body.method !== "string") {
    throw new RpcError("Malformed RPC request");
  }
  const args = Array.isArray(body.args) ? body.args : [];

  ensureFresh();
  const revBefore = store.rev;
  const actor = body.actor;
  setActingUser(
    actor && typeof actor.id === "string" && typeof actor.name === "string"
      ? { id: actor.id, name: actor.name }
      : undefined
  );

  try {
    let result: unknown;
    if (body.repo === "$system") {
      if (body.method === "loadDemo") {
        store.loadDemo();
      } else if (body.method === "reset") {
        store.reset();
      } else if (body.method === "importLegacy") {
        // One-time migration of a browser's old localStorage dataset — only
        // while the server DB is still the untouched seed, so an already
        // shared database can never be clobbered by a stale client.
        const payload = args[0] as { version?: number; data?: Tables } | undefined;
        if (pristine && payload?.data && payload.version === SCHEMA_VERSION) {
          store.replaceData(payload.data, store.rev + 1);
          result = { imported: true };
        } else {
          result = { imported: false };
        }
      } else if (body.method in systemQueries) {
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

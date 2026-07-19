// The single swap point between the app and whichever data backend is
// active. Everything in components/ and app/ must import `repo` from here
// — never from lib/data/mock/* or lib/data/remote/* directly — so the
// backend can be swapped without touching UI code.
//
// Active backend: the server-side store behind /api/rpc (data lives in
// .data/db.json on the server, shared by every device). The old
// localStorage-only mock lives on in lib/data/mock/ — it now RUNS ON THE
// SERVER inside the RPC route, so all its business logic is unchanged.

import { remoteRepositories } from "./remote/remoteRepositories";
import type { Repositories } from "./repository";

export const repo: Repositories = remoteRepositories;

// setActingUser tags RPC calls with the signed-in user for the activity log;
// loadDemoData swaps the server dataset for the rich demo seed (login page).
export { setActingUser, loadDemoData } from "./remote/remoteRepositories";

export type * from "./types";
export type * from "./repository";

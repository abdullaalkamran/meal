// The single swap point between the app and whichever data backend is
// active. Everything in components/ and app/ must import `repo` from here
// — never from lib/data/mock/* directly — so a future real backend only
// needs to satisfy the Repositories interface and get exported here.

import { mockRepositories } from "./mock/mockRepositories";
import type { Repositories } from "./repository";

export const repo: Repositories = mockRepositories;

export type * from "./types";
export type * from "./repository";

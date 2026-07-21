// Password hashing for phone+password sign-in. Uses Node's built-in scrypt
// (no bcrypt/argon2 dependency) — this app deploys to CloudLinux shared
// hosting where native-addon npm packages are a recurring source of build
// failures (see DEPLOY.md), so anything server-side stays pure Node core.
//
// Server-only: imported by the signup/login paths, never by client code.

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/** `saltHex:hashHex` — salted so identical passwords don't produce identical hashes. */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const hash = scryptSync(password, salt, KEY_LENGTH);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

/** Constant-time compare against a hash produced by `hashPassword`. */
export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

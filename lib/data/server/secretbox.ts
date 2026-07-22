// Reversible encryption for secrets that must be stored AND read back — right
// now just the SMTP password. Uses AES-256-GCM with a key derived from
// AUTH_SECRET, so a leaked database dump doesn't hand over the mail password.
//
// Server-only. Passwords for USER accounts are hashed (one-way) instead — see
// password.ts; this is only for secrets the server itself has to present to a
// third party (the mail server).

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

function key(): Buffer {
  // AUTH_SECRET already gates session cookies; reuse it (a dev fallback keeps
  // local runs working, same as auth.ts).
  const secret = process.env.AUTH_SECRET || "dev-insecure-hostel-erp-auth-secret";
  return scryptSync(secret, "mydorm-secretbox-v1", 32);
}

/** Returns "ivHex:tagHex:cipherHex". */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

/** Reverses encryptSecret; returns "" if the value is malformed or the key
 * changed (e.g. AUTH_SECRET rotated), so callers treat it as "not set". */
export function decryptSecret(stored: string | null | undefined): string {
  if (!stored) return "";
  const [ivHex, tagHex, dataHex] = stored.split(":");
  if (!ivHex || !tagHex || !dataHex) return "";
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

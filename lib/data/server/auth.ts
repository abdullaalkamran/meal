// Server-side session auth. A session is a signed, httpOnly cookie the server
// issues at login and verifies on every request — the client can read the
// user (via /api/auth) but can't forge or tamper with the session, and the
// activity-log actor is derived from it rather than trusted from the client.
//
// Server-only: imported exclusively by route handlers (uses node:crypto).

import crypto from "node:crypto";

export const SESSION_COOKIE = "herp_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

let warned = false;
function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (s && s.length > 0) return s;
  if (!warned) {
    warned = true;
    console.warn(
      "[hostel-erp] AUTH_SECRET is not set — using an insecure development fallback. " +
        "Set AUTH_SECRET to a long random string in production so session cookies can't be forged."
    );
  }
  return "dev-insecure-hostel-erp-auth-secret";
}

function hmac(userId: string): string {
  return crypto.createHmac("sha256", secret()).update(userId).digest("base64url");
}

/** `userId.signature` — the value stored in the session cookie. */
export function signSession(userId: string): string {
  return `${userId}.${hmac(userId)}`;
}

/** Returns the userId if the cookie value carries a valid signature, else null. */
export function verifySession(value: string | undefined): string | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const userId = value.slice(0, dot);
  const provided = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(hmac(userId));
  if (provided.length !== expected.length) return null;
  return crypto.timingSafeEqual(provided, expected) ? userId : null;
}

/** Cookie descriptor for NextResponse.cookies.set(). `secure` is decided per
 * request from the protocol so the app also works over plain HTTP before a
 * domain + HTTPS are attached. */
export function sessionCookie(value: string, maxAge: number, secure: boolean) {
  return {
    name: SESSION_COOKIE,
    value,
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge,
  };
}

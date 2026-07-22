// MySQL storage primitives for password-reset OTPs and SMTP settings. The
// business rules (rate limits, expiry, code generation/hashing, encryption)
// live in db.ts so they're shared with the JSON backend; this file only reads
// and writes rows.

import type { PasswordResetOtp, SmtpSettings } from "../../types";
import { fromIso, one, run, toBool, toIso } from "./connection";

interface OtpRow {
  id: string; user_id: string; code_hash: string; expires_at: string;
  attempts: number; consumed_at: string | null; created_at: string;
}
const toOtp = (r: OtpRow): PasswordResetOtp => ({
  id: r.id,
  userId: r.user_id,
  codeHash: r.code_hash,
  expiresAt: toIso(r.expires_at),
  attempts: r.attempts,
  consumedAt: r.consumed_at ? toIso(r.consumed_at) : undefined,
  createdAt: toIso(r.created_at),
});

export async function otpInsert(o: PasswordResetOtp): Promise<void> {
  await run(
    "INSERT INTO password_reset_otps (id, user_id, code_hash, expires_at, attempts, created_at) VALUES (?, ?, ?, ?, 0, ?)",
    [o.id, o.userId, o.codeHash, fromIso(o.expiresAt), fromIso(o.createdAt)]
  );
}

export async function otpLatestActive(userId: string): Promise<PasswordResetOtp | undefined> {
  const r = await one<OtpRow>(
    "SELECT id, user_id, code_hash, expires_at, attempts, consumed_at, created_at FROM password_reset_otps WHERE user_id = ? AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1",
    [userId]
  );
  return r ? toOtp(r) : undefined;
}

export async function otpCountSince(userId: string, sinceIso: string): Promise<number> {
  const r = await one<{ n: number }>(
    "SELECT COUNT(*) AS n FROM password_reset_otps WHERE user_id = ? AND created_at >= ?",
    [userId, fromIso(sinceIso)]
  );
  return Number(r?.n ?? 0);
}

export async function otpBumpAttempts(id: string): Promise<void> {
  await run("UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = ?", [id]);
}

export async function otpConsume(id: string): Promise<void> {
  await run("UPDATE password_reset_otps SET consumed_at = ? WHERE id = ?", [fromIso(new Date().toISOString()), id]);
}

/** Returns settings with `password` holding the ENCRYPTED value (db.ts
 * decrypts), or null if never configured. */
export async function loadSmtp(): Promise<SmtpSettings | null> {
  const r = await one<{
    host: string; port: number; secure: number; username: string;
    password_enc: string | null; from_email: string; from_name: string; configured: number;
  }>(
    "SELECT host, port, secure, username, password_enc, from_email, from_name, configured FROM smtp_settings WHERE id = 1"
  );
  if (!r || !toBool(r.configured)) return null;
  return {
    host: r.host,
    port: Number(r.port),
    secure: toBool(r.secure),
    username: r.username,
    password: r.password_enc ?? "",
    fromEmail: r.from_email,
    fromName: r.from_name,
  };
}

/** `passwordEnc === null` keeps the stored password unchanged. */
export async function saveSmtp(s: {
  host: string; port: number; secure: boolean; username: string;
  passwordEnc: string | null; fromEmail: string; fromName: string;
}): Promise<void> {
  if (s.passwordEnc === null) {
    await run(
      "UPDATE smtp_settings SET host = ?, port = ?, secure = ?, username = ?, from_email = ?, from_name = ?, configured = 1 WHERE id = 1",
      [s.host, s.port, s.secure ? 1 : 0, s.username, s.fromEmail, s.fromName]
    );
  } else {
    await run(
      "UPDATE smtp_settings SET host = ?, port = ?, secure = ?, username = ?, password_enc = ?, from_email = ?, from_name = ?, configured = 1 WHERE id = 1",
      [s.host, s.port, s.secure ? 1 : 0, s.username, s.passwordEnc, s.fromEmail, s.fromName]
    );
  }
}

// Sends email through the configured SMTP account (nodemailer — pure JS, no
// native addons, so it builds on CloudLinux/Passenger). SMTP config comes from
// the database (Super Admin settings) or env fallback via getSmtpConfig().
//
// Server-only.

import nodemailer from "nodemailer";
import { getSmtpConfig, type SmtpConfig } from "./db";

function transport(cfg: SmtpConfig) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure, // true for 465, false for 587 (STARTTLS)
    auth: { user: cfg.username, pass: cfg.password },
  });
}

const from = (cfg: SmtpConfig) => `"${cfg.fromName}" <${cfg.fromEmail}>`;

/** Emails a password-reset code. When SMTP isn't configured, logs the code
 * instead so the flow is still testable in development. */
export async function sendResetEmail(
  to: string,
  code: string,
  name: string
): Promise<{ sent: boolean; error?: string }> {
  const cfg = await getSmtpConfig();
  if (!cfg) {
    console.log(`[mydorm] (SMTP not configured) password reset code for ${to}: ${code}`);
    return { sent: false, error: "SMTP is not configured." };
  }
  const text =
    `Hi ${name || "there"},\n\n` +
    `Your MyDorm password reset code is: ${code}\n\n` +
    `It expires in 10 minutes. If you didn't request this, you can ignore this email.`;
  try {
    await transport(cfg).sendMail({ from: from(cfg), to, subject: "Your MyDorm password reset code", text });
    return { sent: true };
  } catch (err) {
    console.error("[mydorm] reset email failed:", err);
    return { sent: false, error: err instanceof Error ? err.message : "Could not send the email." };
  }
}

/** Super Admin "send a test email" to confirm the SMTP settings work. */
export async function sendTestEmail(to: string): Promise<{ ok: boolean; error?: string }> {
  const cfg = await getSmtpConfig();
  if (!cfg) return { ok: false, error: "SMTP is not configured yet." };
  try {
    await transport(cfg).sendMail({
      from: from(cfg),
      to,
      subject: "MyDorm test email",
      text: "This is a test email from MyDorm. If you received it, your SMTP settings are working.",
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not send the test email." };
  }
}

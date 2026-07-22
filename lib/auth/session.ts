// Client-side session helpers — thin wrappers over the server /api/auth
// endpoint. The session itself lives in a signed httpOnly cookie the server
// owns; nothing sensitive is kept in localStorage anymore.

import type { User } from "@/lib/data";

export type LoginScope = "hostel" | "platform";

/** The currently signed-in user (from the session cookie), or null. */
export async function fetchSession(): Promise<User | null> {
  try {
    const res = await fetch("/api/auth", { cache: "no-store" });
    if (!res.ok) return null;
    const { user } = (await res.json()) as { user: User | null };
    return user ?? null;
  } catch {
    return null;
  }
}

/** Signs in by phone + password; on success the server sets the session cookie. */
export async function serverLogin(
  phone: string,
  password: string,
  scope: LoginScope = "hostel"
): Promise<{ ok: boolean; user?: User; error?: string }> {
  try {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone, password, scope }),
    });
    const data = (await res.json().catch(() => ({}))) as { user?: User; error?: string };
    if (!res.ok) return { ok: false, error: data.error ?? "Sign-in failed." };
    return { ok: true, user: data.user };
  } catch {
    return { ok: false, error: "Network error — please try again." };
  }
}

/** Clears the server session cookie. */
export async function serverLogout(): Promise<void> {
  try {
    await fetch("/api/auth", { method: "DELETE" });
  } catch {
    // Best-effort — the client clears its own state regardless.
  }
}

/** Changes the signed-in user's OWN password (needs the current one). */
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return res.ok ? { ok: true } : { ok: false, error: data.error ?? "Could not change password." };
  } catch {
    return { ok: false, error: "Network error — please try again." };
  }
}

/** Owner/superadmin resets another account's password (for a forgotten one). */
export async function adminResetPassword(
  userId: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, newPassword }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return res.ok ? { ok: true } : { ok: false, error: data.error ?? "Could not reset password." };
  } catch {
    return { ok: false, error: "Network error — please try again." };
  }
}

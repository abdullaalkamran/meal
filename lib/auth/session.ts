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

/** Forgot-password step 1: request an emailed reset code by phone. */
export async function requestPasswordReset(
  phone: string
): Promise<{ ok: boolean; message?: string; sentTo?: string; noEmail?: boolean; devCode?: string; error?: string }> {
  try {
    const res = await fetch("/api/auth/reset/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return { ok: false, error: (data.error as string) ?? "Could not send a code." };
    return { ok: true, ...data };
  } catch {
    return { ok: false, error: "Network error — please try again." };
  }
}

/** Forgot-password step 2: verify the code and set a new password. */
export async function submitPasswordReset(
  phone: string,
  code: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/auth/reset/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone, code, newPassword }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return res.ok ? { ok: true } : { ok: false, error: data.error ?? "Could not reset the password." };
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

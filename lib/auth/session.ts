// Mock-only session persistence. Not real security — just enough state to
// let the dev-facing account switcher behave like a login system until a
// real backend/auth provider is chosen.

const SESSION_KEY = "hostel-erp:session";
const ROLE_COOKIE = "herp_role";

export interface StoredSession {
  userId: string;
}

export function readSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export function writeSession(session: StoredSession, role: string) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  document.cookie = `${ROLE_COOKIE}=${role}; path=/; max-age=${60 * 60 * 24 * 30}`;
}

export function clearSession() {
  window.localStorage.removeItem(SESSION_KEY);
  document.cookie = `${ROLE_COOKIE}=; path=/; max-age=0`;
}

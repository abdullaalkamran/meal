"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { repo, type Hostel, type Role, type User } from "@/lib/data";
import { ensureMonthEndReportNotices } from "@/lib/reports/monthEndNotice";
import { fetchSession, serverLogin, serverLogout, type LoginScope } from "./session";

export const ROLE_HOME: Record<Role, string> = {
  student: "/student",
  manager: "/manager",
  owner: "/owner",
  cook: "/cook",
  superadmin: "/admin",
  marketing: "/marketing",
  service: "/service",
};

interface SessionContextValue {
  isLoading: boolean;
  user: User | undefined;
  hostel: Hostel | undefined;
  /** The role whose screens are currently being viewed — differs from
   * user.role for a manager using "switch to my boarder view" or an owner
   * managing one of their hostels through the manager screens. */
  viewRole: Role | undefined;
  setViewRole: (role: Role) => void;
  activeHostelId: string | undefined;
  switchHostel: (hostelId: string) => void;
  /** Signs in by phone + password against the server. Returns an error
   * message on failure (wrong credentials, wrong sign-in page) instead of
   * throwing. */
  login: (phone: string, password: string, scope?: LoginScope) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | undefined>(undefined);
  const [hostel, setHostel] = useState<Hostel | undefined>(undefined);
  const [viewRole, setViewRoleState] = useState<Role | undefined>(undefined);
  const [activeHostelId, setActiveHostelId] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    async function loadSession() {
      // The signed-in user comes from the server session cookie, not the
      // client — so a forged/edited cookie can't impersonate anyone.
      const u = (await fetchSession()) ?? undefined;
      if (cancelled) return;
      setUser(u);
      setViewRoleState(u?.role);
      setActiveHostelId(u?.role === "owner" ? u.ownedHostelIds?.[0] : u?.hostelId);
      setIsLoading(false);
    }
    loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeHostelId) {
      const clear = () => setHostel(undefined);
      queueMicrotask(clear);
      return;
    }
    return repo.hostels.subscribe(activeHostelId, setHostel);
  }, [activeHostelId]);

  // Month-end report reminders — fires once per user per month, only inside
  // the last-two-days window (the module dedupes, so calling every session
  // load is safe).
  useEffect(() => {
    if (!user) return;
    void ensureMonthEndReportNotices();
  }, [user]);

  // Mirrors the logged-in user's own record so changes made elsewhere (a
  // manager approving their join request, suspending meals, a profile edit
  // in another tab) reach the session without a re-login. Uses the per-user
  // channel so it works even before the user belongs to any hostel.
  // Tracks the signed-in user's real role across renders so the live mirror
  // below can tell when it actually CHANGES (manager handing off the role,
  // a boarder being promoted) versus any other profile edit.
  const roleRef = useRef<Role | undefined>(user?.role);
  useEffect(() => {
    roleRef.current = user?.role;
  });

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    return repo.users.subscribeUser(userId, (fresh) => {
      setUser(fresh);
      // The user's own role changed (e.g. the manager role was handed to
      // someone else, demoting this account to a boarder — or a boarder was
      // promoted to manager). Snap the viewed role to the new real role so
      // RoleGuard redirects them to the right dashboard instead of leaving
      // them on pages their account no longer has access to.
      if (roleRef.current && fresh.role !== roleRef.current) {
        setViewRoleState(fresh.role);
      }
      roleRef.current = fresh.role;
      // A join approval (or hostel switch) gives the user their hostel —
      // adopt it as the active hostel if none is set yet.
      if (fresh.role === "student" || fresh.role === "manager" || fresh.role === "cook") {
        setActiveHostelId((current) => current || (fresh.hostelId || undefined));
      } else if (fresh.role === "owner") {
        setActiveHostelId((current) => current ?? fresh.ownedHostelIds?.[0]);
      }
    });
  }, [userId]);

  const login = useCallback(
    async (phone: string, password: string, scope: LoginScope = "hostel") => {
      const res = await serverLogin(phone, password, scope);
      if (!res.ok || !res.user) return { ok: false, error: res.error };
      const u = res.user;
      setUser(u);
      setViewRoleState(u.role);
      setActiveHostelId(u.role === "owner" ? u.ownedHostelIds?.[0] : u.hostelId);
      router.push(ROLE_HOME[u.role]);
      return { ok: true };
    },
    [router]
  );

  const logout = useCallback(() => {
    void serverLogout();
    setUser(undefined);
    setHostel(undefined);
    setViewRoleState(undefined);
    setActiveHostelId(undefined);
    router.push("/login");
  }, [router]);

  const setViewRole = useCallback(
    (role: Role) => {
      if (!user) return;
      // Two sanctioned cross-role views: a manager browsing as a boarder of
      // themself, and an owner managing one of their hostels through the
      // manager screens. Any other combination snaps back to the real role.
      if (role === "student" && user.role === "manager") {
        setViewRoleState("student");
      } else if (role === "manager" && user.role === "owner") {
        setViewRoleState("manager");
      } else {
        setViewRoleState(user.role);
      }
    },
    [user]
  );

  const switchHostel = useCallback(
    (hostelId: string) => {
      if (!user || user.role !== "owner") return;
      if (!user.ownedHostelIds?.includes(hostelId)) return;
      setActiveHostelId(hostelId);
    },
    [user]
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      isLoading,
      user,
      hostel,
      viewRole,
      setViewRole,
      activeHostelId,
      switchHostel,
      login,
      logout,
    }),
    [isLoading, user, hostel, viewRole, setViewRole, activeHostelId, switchHostel, login, logout]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

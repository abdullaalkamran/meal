"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { repo, type Hostel, type Role, type User } from "@/lib/data";
import { clearSession, readSession, writeSession } from "./session";

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
  login: (userId: string) => Promise<void>;
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
      const session = readSession();
      const u = session ? await repo.users.getUser(session.userId) : undefined;
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

  // Mirrors the logged-in user's own record so changes made elsewhere (e.g.
  // a manager suspending this student's meals) reach the session without
  // requiring a re-login.
  const userId = user?.id;
  const userHomeHostelId = user?.hostelId;
  useEffect(() => {
    if (!userId || !userHomeHostelId) return;
    return repo.users.subscribe(userHomeHostelId, (list) => {
      const fresh = list.find((u) => u.id === userId);
      if (fresh) setUser(fresh);
    });
  }, [userId, userHomeHostelId]);

  const login = useCallback(
    async (userId: string) => {
      const u = await repo.users.getUser(userId);
      if (!u) return;
      writeSession({ userId }, u.role);
      setUser(u);
      setViewRoleState(u.role);
      const defaultHostelId = u.role === "owner" ? u.ownedHostelIds?.[0] : u.hostelId;
      setActiveHostelId(defaultHostelId);
      router.push(ROLE_HOME[u.role]);
    },
    [router]
  );

  const logout = useCallback(() => {
    clearSession();
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

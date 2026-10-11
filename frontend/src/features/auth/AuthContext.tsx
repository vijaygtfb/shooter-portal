import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { refreshSession, setAccessToken, setAuthFailureHandler } from "@/lib/apiClient";
import { logger } from "@/lib/logger";
import * as authApi from "./authApi";
import type { CurrentUser, Role } from "./schema";

interface AuthState {
  user: CurrentUser | null;
  /** True until the initial session restore (refresh cookie) finishes. */
  restoring: boolean;
  login: (email: string, password: string) => Promise<CurrentUser>;
  startSession: (accessToken: string, user: CurrentUser) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    setAuthFailureHandler(() => setUser(null));
    let cancelled = false;
    (async () => {
      try {
        if (await refreshSession()) {
          const me = await authApi.fetchMe();
          if (!cancelled) setUser(me);
        }
      } catch (err) {
        logger.warn("session restore failed", { error: String(err) });
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
      setAuthFailureHandler(null);
    };
  }, []);

  const startSession = useCallback((token: string, u: CurrentUser) => {
    setAccessToken(token);
    setUser(u);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await authApi.login(email, password);
      startSession(res.access_token, res.user);
      logger.info("logged in", { role: res.user.role });
      return res.user;
    },
    [startSession],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, restoring, login, startSession, logout }), [user, restoring, login, startSession, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** Where each role lands after login. */
export function homePath(role: Role): string {
  switch (role) {
    case "COACH":
      return "/coach";
    case "DISTRICT_SECRETARY":
      return "/district";
    case "SUPER_ADMIN":
      return "/admin";
    default:
      return "/application";
  }
}

"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "./api";
import type { User } from "./types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string, redirectTo?: string | null) => Promise<void>;
  register: (
    username: string,
    password: string,
    inviteCode: string,
    avatar?: File | null,
    redirectTo?: string | null
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

// Only in-app paths after login, to avoid an open redirect.
// Browsers treat "\" like "/", so "/\evil.com" is rejected too.
function safeRedirect(path: string | null | undefined): string {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return "/";
  return path;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchMe = useCallback(async () => {
    try {
      const me = await api.get<User>("/auth/me/");
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-mount to hydrate auth state
    fetchMe();
  }, [fetchMe]);

  const login = useCallback(
    async (username: string, password: string, redirectTo?: string | null) => {
      const me = await api.post<User>("/auth/login/", { username, password });
      setUser(me);
      router.push(safeRedirect(redirectTo));
    },
    [router]
  );

  const register = useCallback(
    async (
      username: string,
      password: string,
      inviteCode: string,
      avatar?: File | null,
      redirectTo?: string | null
    ) => {
      let body: FormData | Record<string, string>;
      if (avatar) {
        body = new FormData();
        body.append("username", username);
        body.append("password", password);
        body.append("invite_code", inviteCode);
        body.append("avatar", avatar);
      } else {
        body = { username, password, invite_code: inviteCode };
      }
      const me = await api.post<User>("/auth/register/", body);
      setUser(me);
      router.push(safeRedirect(redirectTo));
    },
    [router]
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout/");
    } finally {
      setUser(null);
      router.push("/login");
    }
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser: fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// No user after the auth check (e.g. expired refresh cookie): go to /login.
export function useRequireAuth() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  return { user, loading };
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

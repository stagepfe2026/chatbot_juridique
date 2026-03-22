import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  updateCurrentUser as updateCurrentUserRequest,
} from "../services/auth.service";
import type { AuthUser, LoginRequest, LoginResponse, UpdateProfileRequest } from "../models/auth.models";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (payload: LoginRequest) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  updateCurrentUser: (payload: UpdateProfileRequest) => Promise<AuthUser>;
  refreshCurrentUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function bootstrap() {
      try {
        const me = await getCurrentUser();
        setUser(me);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    void bootstrap();
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    const me = await getCurrentUser();
    setUser(me);
  }, []);

  const login = useCallback(async (payload: LoginRequest) => {
    const result = await loginRequest(payload);
    setUser(result.user);
    return result;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setUser(null);
    }
  }, []);

  const updateCurrentUser = useCallback(async (payload: UpdateProfileRequest) => {
    const updated = await updateCurrentUserRequest(payload);
    setUser(updated);
    return updated;
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      updateCurrentUser,
      refreshCurrentUser,
    }),
    [user, loading, login, logout, updateCurrentUser, refreshCurrentUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth doit etre utilise dans AuthProvider.");
  }
  return context;
}

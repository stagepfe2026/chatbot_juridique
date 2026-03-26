import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  updateCurrentUser as updateCurrentUserRequest,
} from "../services/auth.service";
import type { AuthUser, LoginRequest, LoginResponse, UpdateProfileRequest } from "../models/auth.models";
import { subscribeSessionExpired } from "../utils/sessionExpiredBus";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  sessionExpired: boolean;
  sessionExpiredMessage: string;
  login: (payload: LoginRequest) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  updateCurrentUser: (payload: UpdateProfileRequest) => Promise<AuthUser>;
  refreshCurrentUser: () => Promise<void>;
  dismissSessionExpired: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState("Session expiree. Veuillez vous reconnecter pour continuer.");

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

  useEffect(() => {
    return subscribeSessionExpired((message) => {
      setUser(null);
      setSessionExpiredMessage(message || "Session expiree. Veuillez vous reconnecter pour continuer.");
      setSessionExpired(true);
      setLoading(false);
    });
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    const me = await getCurrentUser();
    setUser(me);
    setSessionExpired(false);
  }, []);

  const login = useCallback(async (payload: LoginRequest) => {
    const result = await loginRequest(payload);
    setUser(result.user);
    setSessionExpired(false);
    return result;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setUser(null);
      setSessionExpired(false);
    }
  }, []);

  const updateCurrentUser = useCallback(async (payload: UpdateProfileRequest) => {
    const updated = await updateCurrentUserRequest(payload);
    setUser(updated);
    return updated;
  }, []);

  const dismissSessionExpired = useCallback(() => {
    setSessionExpired(false);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      sessionExpired,
      sessionExpiredMessage,
      login,
      logout,
      updateCurrentUser,
      refreshCurrentUser,
      dismissSessionExpired,
    }),
    [
      user,
      loading,
      sessionExpired,
      sessionExpiredMessage,
      login,
      logout,
      updateCurrentUser,
      refreshCurrentUser,
      dismissSessionExpired,
    ],
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

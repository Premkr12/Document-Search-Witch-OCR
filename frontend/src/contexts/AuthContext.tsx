import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import api from "@/api/api";
import type { User } from "@/types";

interface AuthContextType {
  user: User | null;
  token: string | null;
  /** True until the stored session has been checked — don't redirect while loading. */
  loading: boolean;
  login: (token: string, refreshToken: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [loading, setLoading] = useState(() => !!localStorage.getItem("token"));
  // login() already has the user, so the /auth/me check it triggers can be skipped
  const skipNextCheck = useRef(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    if (skipNextCheck.current) {
      skipNextCheck.current = false;
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    api
      .get("/auth/me")
      .then((response) => {
        if (!cancelled) setUser(response.data.user);
      })
      .catch(() => {
        if (cancelled) return;
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        setToken(null);
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = useCallback((newToken: string, newRefreshToken: string, newUser: User) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("refreshToken", newRefreshToken);
    skipNextCheck.current = true;
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    setToken(null);
    setUser(null);
    // Don't leave the previous user's documents in the cache
    queryClient.clear();
  }, [queryClient]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

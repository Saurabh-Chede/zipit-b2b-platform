import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiClient } from '../services/api.ts';
import type { AuthUser, SellerProfile, Transporter } from '../types/index.ts';

interface AuthContextValue {
  user: AuthUser | null;
  profile: SellerProfile | Transporter | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<SellerProfile | Transporter | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await apiClient.get<{
        success: boolean;
        data: { user: AuthUser; profile: SellerProfile | Transporter | null };
      }>('/auth/me');
      setUser(res.data.data.user);
      setProfile(res.data.data.profile);
    } catch {
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiClient.post<{
      success: boolean;
      data: { user: AuthUser; profile: SellerProfile | Transporter | null };
    }>('/auth/login', { email, password });
    setUser(res.data.data.user);
    setProfile(res.data.data.profile);
    return res.data.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      setUser(null);
      setProfile(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

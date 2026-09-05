'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AuthState, User, UserRole } from '@/types/auth.types';
import { authService, LoginCredentials } from '@/services/auth.service';

interface AuthContextType extends AuthState {
  role: UserRole;
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Real Backend Authentication Provider.
 * Session state is established authoritatively by the backend API via GET /api/auth/me.
 * No localStorage role simulation, no hardcoded default user.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthState['status']>('loading');

  const checkSession = useCallback(async () => {
    try {
      const res = await authService.getCurrentUser();
      if (res.success && res.data) {
        setUser(res.data);
        setStatus('authenticated');
      } else {
        setUser(null);
        setStatus('unauthenticated');
      }
    } catch {
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    authService
      .getCurrentUser()
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          setUser(res.data);
          setStatus('authenticated');
        } else {
          setUser(null);
          setStatus('unauthenticated');
        }
      })
      .catch(() => {
        if (isMounted) {
          setUser(null);
          setStatus('unauthenticated');
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (credentials: LoginCredentials): Promise<{ success: boolean; error?: string }> => {
    setStatus('loading');
    const loginRes = await authService.login(credentials);
    if (!loginRes.success) {
      setStatus('unauthenticated');
      return { success: false, error: loginRes.error || 'Invalid credentials' };
    }

    // Call GET /api/auth/me to establish the authoritative current user
    const meRes = await authService.getCurrentUser();
    if (meRes.success && meRes.data) {
      setUser(meRes.data);
      setStatus('authenticated');
      return { success: true };
    } else if (loginRes.data?.user) {
      setUser(loginRes.data.user);
      setStatus('authenticated');
      return { success: true };
    } else {
      setUser(null);
      setStatus('unauthenticated');
      return { success: false, error: 'Could not establish session user' };
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setStatus('unauthenticated');
    }
  };

  const role: UserRole = user?.role || 'employee';

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        status,
        login,
        logout,
        refreshUser: checkSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

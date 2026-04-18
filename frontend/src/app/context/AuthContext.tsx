import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { Role } from '../api/types';
import * as authApi from '../api/auth';

export interface AuthUser {
  id: number;
  username: string;
  role: Role;
  real_name: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isLoggedIn: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem('tunnel_auth_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const login = useCallback(async (username: string, password: string) => {
    try {
      const tokenRes = await authApi.login(username, password);
      localStorage.setItem('tunnel_auth_token', tokenRes.access_token);

      const me = await authApi.getMe();
      const authUser: AuthUser = {
        id: me.id,
        username: me.username,
        role: me.role as Role,
        real_name: me.real_name,
      };
      setUser(authUser);
      localStorage.setItem('tunnel_auth_user', JSON.stringify(authUser));
      return { success: true };
    } catch (err: any) {
      const msg = err.response?.data?.detail || '登录失败，请检查用户名和密码';
      return { success: false, error: msg };
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('tunnel_auth_token');
    localStorage.removeItem('tunnel_auth_user');
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoggedIn: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

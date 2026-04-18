import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { credentialsMap, Role } from '../data/mockData';

export interface AuthUser {
  id: number;
  username: string;
  role: Role;
  real_name: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isLoggedIn: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const validPasswords: Record<string, string> = {
  admin: 'admin123',
  teacher: 'teacher123',
  student: 'student123',
};

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
    const userData = credentialsMap[username];
    if (!userData || validPasswords[username] !== password) {
      return { success: false, error: '用户名或密码错误' };
    }
    const newUser: AuthUser = {
      id: userData.id,
      username: userData.username,
      role: userData.role,
      real_name: userData.real_name,
    };
    setUser(newUser);
    localStorage.setItem('tunnel_auth_user', JSON.stringify(newUser));
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
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

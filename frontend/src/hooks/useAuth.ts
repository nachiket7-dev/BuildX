import { useState, useEffect, useCallback, createContext, useContext } from 'react';

export interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  authReady: boolean;  // true after /me verification completes
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  error: string | null;
  clearError: () => void;
}

const TOKEN_KEY = 'buildx_token';
const USER_KEY = 'buildx_user';

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function useAuthProvider(): AuthState {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY)
  );

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // authReady = false while verifying stored token; true once /me completes
  const [authReady, setAuthReady] = useState(!localStorage.getItem(TOKEN_KEY));

  const clearError = useCallback(() => setError(null), []);

  // Verify token on mount — also triggers claimUnownedBlueprints on the backend
  useEffect(() => {
    if (!token) {
      setAuthReady(true);
      return;
    }
    const BASE_URL = import.meta.env.VITE_API_URL ?? '';
    fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Invalid token');
        return res.json();
      })
      .then((data) => {
        const u = (data as { user: User }).user;
        setUser(u);
        localStorage.setItem(USER_KEY, JSON.stringify(u));
      })
      .catch(() => {
        // Token expired or invalid
        setUser(null);
        setToken(null);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      })
      .finally(() => {
        setAuthReady(true);
      });
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const BASE_URL = import.meta.env.VITE_API_URL ?? '';
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error: string }).error || 'Login failed');

      const { token: t, user: u } = data as { token: string; user: User };
      setToken(t);
      setUser(u);
      setAuthReady(true);
      localStorage.setItem(TOKEN_KEY, t);
      localStorage.setItem(USER_KEY, JSON.stringify(u));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const BASE_URL = import.meta.env.VITE_API_URL ?? '';
      const res = await fetch(`${BASE_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error: string }).error || 'Signup failed');

      const { token: t, user: u } = data as { token: string; user: User };
      setToken(t);
      setUser(u);
      setAuthReady(true);
      localStorage.setItem(TOKEN_KEY, t);
      localStorage.setItem(USER_KEY, JSON.stringify(u));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  return { user, token, isLoading, authReady, login, signup, logout, error, clearError };
}

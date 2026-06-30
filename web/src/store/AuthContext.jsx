import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { TOKEN_KEY, REFRESH_KEY } from '../api/client';
import { AuthApi } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) {
        try {
          const res = await AuthApi.me();
          setUser(res.user);
        } catch {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(REFRESH_KEY);
        }
      }
      setBooting(false);
    })();
  }, []);

  const saveSession = useCallback(({ user: u, accessToken, refreshToken }) => {
    if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
    setUser(u);
  }, []);

  const login = useCallback(async (mobile, password) => {
    const res = await AuthApi.login(mobile, password);
    saveSession(res);
    return res.user;
  }, [saveSession]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ booting, user, setUser, saveSession, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client, { TOKEN_KEY, REFRESH_KEY, clearTokens } from '../api/client';
import { AuthApi } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [donor, setDonor] = useState(null);

  const isLoggedIn = !!user;
  const profileComplete = !!(user?.name && profile?.city);
  const aadhaarVerified = user?.aadhaar_kyc_status === 'verified';
  const isDriver = user?.role === 'ambulance_driver';

  const loadMe = useCallback(async () => {
    const res = await AuthApi.me();
    setUser(res.user);
    setProfile(res.profile);
    setDonor(res.donor);
    return res;
  }, []);

  // Restore session on app start.
  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem(TOKEN_KEY);
        if (token) await loadMe();
      } catch (e) {
        await clearTokens();
      } finally {
        setBooting(false);
      }
    })();
  }, [loadMe]);

  const completeLogin = useCallback(async ({ user: u, accessToken, refreshToken }) => {
    if (accessToken) await AsyncStorage.setItem(TOKEN_KEY, accessToken);
    if (refreshToken) await AsyncStorage.setItem(REFRESH_KEY, refreshToken);
    // Load the full user + profile together BEFORE entering the app, so we
    // never flash the "complete your profile" screen in the gap between the
    // basic user being set and the profile finishing loading. Only fall back to
    // the basic user if /me fails.
    try {
      await loadMe();
    } catch (e) {
      setUser(u);
    }
  }, [loadMe]);

  // Email + password login.
  const login = useCallback(async (email, password) => {
    const res = await AuthApi.login(email, password);
    await completeLogin(res);
    return res.user;
  }, [completeLogin]);

  // OTP-verified registration (role: user | ambulance_driver).
  const register = useCallback(async (payload) => {
    const res = await AuthApi.register(payload);
    await completeLogin(res);
    return res.user;
  }, [completeLogin]);

  const logout = useCallback(async () => {
    try {
      await clearTokens();
    } catch (e) {
      /* ignore storage errors — still clear in-memory state below */
    }
    setUser(null);
    setProfile(null);
    setDonor(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      await loadMe();
    } catch (e) {
      /* ignore */
    }
  }, [loadMe]);

  const value = {
    booting,
    user,
    profile,
    donor,
    isLoggedIn,
    profileComplete,
    aadhaarVerified,
    isDriver,
    setUser,
    setDonor,
    completeLogin,
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export default AuthContext;

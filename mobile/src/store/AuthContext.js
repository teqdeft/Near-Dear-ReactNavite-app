import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client, { TOKEN_KEY, REFRESH_KEY, clearTokens, setSessionExpiredHandler } from '../api/client';
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

  // When the API layer detects the session is invalid (e.g. the account was
  // deleted by an admin), force a logout and tell the user.
  useEffect(() => {
    setSessionExpiredHandler((message, code) => {
      setUser(null);
      setProfile(null);
      setDonor(null);
      // Resetting the user above sends RootNavigator back to the Login screen;
      // the alert tells the user why they were signed out.
      const deleted = code === 'ACCOUNT_DELETED' || /no longer exists|deleted|not found/i.test(message || '');
      const blocked = code === 'ACCOUNT_BLOCKED';
      if (blocked) {
        Alert.alert('Account blocked', message || 'Your account has been blocked by the administrator. Please contact support.');
      } else if (deleted) {
        Alert.alert('Account deleted', 'Your account has been deleted. You have been logged out.');
      } else {
        Alert.alert('Signed out', 'Your session has ended. Please log in again.');
      }
    });
    return () => setSessionExpiredHandler(null);
  }, []);

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

  // While an Aadhaar KYC is awaiting manual admin approval, poll /me so the
  // "pending" status flips to "verified" on the Home and Profile screens as soon
  // as an admin approves it — without the user having to reopen the app. The
  // poll stops automatically once the status leaves "pending".
  useEffect(() => {
    if (!isLoggedIn || user?.aadhaar_kyc_status !== 'pending') return undefined;
    let timer = null;
    const start = () => { if (!timer) timer = setInterval(refreshUser, 15000); };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    if (AppState.currentState === 'active') start();
    // Refresh immediately when the app comes back to the foreground, then keep polling.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') { refreshUser(); start(); } else stop();
    });
    return () => { stop(); sub.remove(); };
  }, [isLoggedIn, user?.aadhaar_kyc_status, refreshUser]);

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

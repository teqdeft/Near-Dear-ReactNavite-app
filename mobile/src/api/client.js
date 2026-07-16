import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';

export const TOKEN_KEY = 'nd_access_token';
export const REFRESH_KEY = 'nd_refresh_token';

// AsyncStorage v3 removed multiRemove/multiGet/multiSet — use removeItem.
export async function clearTokens() {
  await Promise.all([
    AsyncStorage.removeItem(TOKEN_KEY),
    AsyncStorage.removeItem(REFRESH_KEY),
  ]);
}

// AuthContext registers a handler here so the API layer can force a logout when
// the session becomes invalid (e.g. the account was deleted by an admin).
let onSessionExpired = null;
// One-shot per session: when several requests 401 together (a dashboard firing 3
// calls in parallel), each would otherwise invoke the handler — stacking alerts
// that Android shows by replacing the visible one, which looks like the dialog
// blinking. Fire once, then stay silent until a valid token is seen again.
let sessionExpiredFired = false;
export function setSessionExpiredHandler(fn) {
  onSessionExpired = fn;
  sessionExpiredFired = false;
}

function fireSessionExpired(message, code) {
  if (sessionExpiredFired) return;
  sessionExpiredFired = true;
  if (onSessionExpired) onSessionExpired(message, code);
}

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
});

// Attach the access token to every request.
client.interceptors.request.use(async (cfg) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) {
    cfg.headers.Authorization = `Bearer ${token}`;
    // A token exists again (fresh login) — re-arm the session-expired handler.
    sessionExpiredFired = false;
  }
  return cfg;
});

// A single in-flight refresh shared by all concurrent 401s. Without this, when
// several requests 401 at once (e.g. the driver dashboard fires 3 in parallel),
// only the first would refresh and the rest would be dropped — showing an
// approved driver the "register vehicle" gate until a manual refresh.
let refreshPromise = null;

async function refreshAccessToken() {
  const refreshToken = await AsyncStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;
  const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
  const newToken = data?.data?.accessToken;
  if (newToken) await AsyncStorage.setItem(TOKEN_KEY, newToken);
  return newToken || null;
}

// On 401, try a one-time refresh, then retry the original request. Concurrent
// 401s all await the same refresh and then retry.
client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    // The account itself was terminated by an admin (blocked → 403, deleted →
    // 401). This is not a stale-token case, so skip the refresh dance and log
    // the user out straight away with a reason.
    const code = error.response?.data?.code;
    if (code === 'ACCOUNT_BLOCKED' || code === 'ACCOUNT_DELETED') {
      await clearTokens();
      fireSessionExpired(error.response?.data?.message, code);
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      try {
        // Coalesce concurrent refreshes into one network call.
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null; });
        }
        const newToken = await refreshPromise;
        if (newToken) {
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${newToken}`;
          return client(original);
        }
      } catch (e) {
        // fall through to logout handling below
      }
      await clearTokens();
      // Session is truly invalid — tell AuthContext to log the user out.
      fireSessionExpired(error.response?.data?.message);
    }
    return Promise.reject(error);
  }
);

// Helper to pull a friendly message out of an axios error.
export function errMessage(error, fallback = 'Something went wrong') {
  return (
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

export default client;

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

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
});

// Attach the access token to every request.
client.interceptors.request.use(async (cfg) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

let isRefreshing = false;

// On 401, try a one-time refresh, then retry the original request.
client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && !isRefreshing) {
      original._retry = true;
      isRefreshing = true;
      try {
        const refreshToken = await AsyncStorage.getItem(REFRESH_KEY);
        if (refreshToken) {
          const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
          const newToken = data?.data?.accessToken;
          if (newToken) {
            await AsyncStorage.setItem(TOKEN_KEY, newToken);
            original.headers.Authorization = `Bearer ${newToken}`;
            isRefreshing = false;
            return client(original);
          }
        }
      } catch (e) {
        // fall through to logout handling below
      }
      isRefreshing = false;
      await clearTokens();
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

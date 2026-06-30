import axios from 'axios';
import { API_BASE_URL } from '../config';

export const TOKEN_KEY = 'nd_panel_token';
export const REFRESH_KEY = 'nd_panel_refresh';

const client = axios.create({ baseURL: API_BASE_URL, timeout: 20000 });

client.interceptors.request.use((cfg) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

client.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      // Token invalid/expired — drop it so the app redirects to login.
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
    }
    return Promise.reject(error);
  }
);

export function errMessage(error, fallback = 'Something went wrong') {
  return error?.response?.data?.message || error?.message || fallback;
}

// Private files (prescriptions, pharmacy docs) require a Bearer header, which
// <img>/<a> can't send. Fetch as a blob through axios and return an object URL.
export async function fetchFileObjectUrl(absoluteUrl) {
  const res = await client.get(absoluteUrl, { responseType: 'blob', baseURL: '' });
  return URL.createObjectURL(res.data);
}

export default client;

/**
 * Base URL of the NearDear backend.
 *
 * Release builds (the APK you hand to the client) always talk to the deployed
 * API — the client's phone is nowhere near your LAN. Debug builds keep using
 * your PC so local development is unchanged.
 *
 * Note: Android blocks cleartext HTTP in release builds, so PROD_API_BASE_URL
 * must be https.
 */

// --- Production (used by release builds / the APK) ---
// TODO: replace with your Render URL once the service is live.
const PROD_API_BASE_URL = 'https://neardear-api.onrender.com/api/v1';

// --- Development (used by debug builds) ---
// Your PC's Wi-Fi LAN IP (phone must be on the same network). Find it with
// `ipconfig` (IPv4 Address). Emulator-only alternative: '10.0.2.2'.
const DEV_HOST = '192.168.1.2';
const DEV_PORT = 4000;
const DEV_API_BASE_URL = `http://${DEV_HOST}:${DEV_PORT}/api/v1`;

export const API_BASE_URL = __DEV__ ? DEV_API_BASE_URL : PROD_API_BASE_URL;

export default { API_BASE_URL };

// ---------------------------------------------------------------------------
// Previous LAN-only setup, kept for reference. It pointed every build — debug
// and release alike — at the dev PC, which a client on another network cannot
// reach.
//
// const DEV_PORT = 4000;
//
// // Your PC's Wi-Fi LAN IP (phone must be on the same network).
// const API_HOST = '192.168.1.2';
//
// export const API_BASE_URL = `http://${API_HOST}:${DEV_PORT}/api/v1`;
//
// export default { API_BASE_URL };
// ---------------------------------------------------------------------------

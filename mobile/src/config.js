/**
 * Base URL of the NearDear backend.
 *
 * Using the PC's LAN IP so a physical phone on the SAME Wi-Fi reaches the
 * backend directly — no `adb reverse` tunnel required (that tunnel keeps
 * breaking when the device reconnects or multiple devices are attached).
 *
 * If your PC's IP changes (new network / DHCP), update API_HOST below.
 * Find it with `ipconfig` (IPv4 Address).
 *
 * Emulator-only alternative: set API_HOST to '10.0.2.2'.
 */
const DEV_PORT = 4000;

// Your PC's Wi-Fi LAN IP (phone must be on the same network).
const API_HOST = '192.168.1.2';

export const API_BASE_URL = `http://${API_HOST}:${DEV_PORT}/api/v1`;

export default { API_BASE_URL };

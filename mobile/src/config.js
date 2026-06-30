/**
 * Base URL of the NearDear backend.
 *
 * RECOMMENDED (works on both a USB phone and an emulator):
 *   Run this once while the device is connected so the phone's "localhost"
 *   tunnels to your PC's port 4000 over USB:
 *
 *       adb reverse tcp:4000 tcp:4000
 *
 *   (React Native already does this for Metro's 8081. We add 4000 for the API.)
 *   With that in place, the default below — http://localhost:4000 — just works.
 *
 * ALTERNATIVE (phone on same Wi-Fi as PC, no USB tunnel):
 *   Set API_HOST to your PC's LAN IP, e.g. '192.168.1.20', and make sure your
 *   firewall allows inbound port 4000.
 *
 * Android EMULATOR without adb reverse can instead use '10.0.2.2'.
 */
const DEV_PORT = 4000;

// Change this if you use the Wi-Fi/LAN alternative above.
const API_HOST = 'localhost';

export const API_BASE_URL = `http://${API_HOST}:${DEV_PORT}/api/v1`;

export default { API_BASE_URL };

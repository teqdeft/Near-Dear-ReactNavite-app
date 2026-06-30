# NearDear Mobile (React Native CLI, JavaScript)

The NearDear user app: OTP login, Aadhaar verification, and the Blood / Ambulance / Medicine modules.

## Prerequisites
Set up the React Native CLI environment for **Android** (Windows):
- Node.js 18+
- JDK 17
- Android Studio + Android SDK + an emulator (or a physical device with USB debugging)

Follow https://reactnative.dev/docs/set-up-your-environment (choose **React Native CLI**, Android).

## Run
```bash
npm install
npm start            # starts Metro — keep this running
# new terminal:
npm run android      # builds & launches the app
```

## Pointing the app at the backend
Configured in [`src/config.js`](src/config.js):
- **Android emulator** → `http://10.0.2.2:4000` (already set; `10.0.2.2` = your PC's localhost).
- **Physical device** → uncomment the line and set your PC's LAN IP, e.g. `http://192.168.1.20:4000/api/v1`. Phone and PC must share Wi-Fi.

Make sure the backend (`cd backend && npm run dev`) is running first.

## Try it
1. Launch → **Create an account** → pick a role (**Normal User** or **Ambulance Driver**), enter name/email/password.
2. **Verify mobile via OTP** = `123456` (mock mode; shown on screen during dev).
3. Complete **profile setup** (name + city — city is used to match nearby ambulance drivers).
4. Next time, **Log in with email + password**.
5. **Aadhaar:** enter any 12 digits → OTP `123456` → verified.

## Role-based experience
- **Normal user / donor:** home with the 3 service tiles (Blood / Ambulance / Medicines) + quick actions.
- **Ambulance driver:** a **driver dashboard** — see nearby requests, **Accept**, call the user, and advance status (on the way → picked up → completed).

## Features by module
- **Blood:** become donor (consent), availability toggle, create request (auto-matches donors in the same city + blood group), accept/decline, call after acceptance.
- **Ambulance (driver-direct):** user books → nearby drivers notified → a driver accepts and calls the user; user sees a live status timeline.
- **Medicines:** categories, search, cart (single pharmacy), prescription upload (image picker) for Rx items, checkout (COD/UPI), order timeline.

## Notes
- Icons use emoji to avoid native font setup — swap in `react-native-vector-icons` later if you prefer.
- Prescription/photo upload uses `react-native-image-picker` (system photo picker; no extra permission needed on Android 13+).
- HTTP (cleartext) to `10.0.2.2` works in **debug** builds. For release, use HTTPS.
- This app is JavaScript; the generated `tsconfig.json` is harmless and unused.

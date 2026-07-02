# NearDear — MVP (React Native + Node.js)

NearDear is a healthcare-support app with three modules that open from a themed home screen:

- 🩸 **Blood Donation** — become a donor, toggle availability, create blood requests, auto-match nearby donors, accept/decline, share contact only after acceptance.
- 🚑 **Ambulance** — request transport (pickup → drop), admin assigns a driver/vehicle, live status timeline, and **live map tracking** of the ambulance (REST short-polling) once the driver is on the way.
- 💊 **Medicines** — browse pharmacy listings by category, search, add to cart, upload prescription where required, place & track orders.

Plus: mobile **OTP login**, **Aadhaar KYC verification**, profile & addresses, notifications, and support tickets.

> Built to the *NearDear MVP Developer Blueprint*. Online payments, live GPS tracking, AI, and doctor consultation are intentionally **out of scope** for this MVP.

---

## Tech stack

| Layer | Tech |
|------|------|
| Mobile app | **React Native CLI** (0.86, JavaScript), React Navigation, AsyncStorage, Axios |
| Backend | **Node.js + Express** (JavaScript) |
| Query builder | **Knex.js** (migrations + seeds) |
| Database | **MySQL** |
| Auth | **JWT** (access + refresh) |
| OTP (SMS) | **MSG91** (with dev/mock fallback) |
| Aadhaar KYC | **Surepass** Aadhaar OTP (with dev/mock fallback) |
| File uploads | Local disk (prescriptions & pharmacy docs served via authenticated routes) |

## Who logs in where (important)

| Role | App | How they authenticate |
|------|-----|----------------------|
| **Normal user / donor** | `mobile/` (phone app) | **Register** with name/email/password + **OTP** (pick "Normal User" in the role dropdown). **Login** with **email + password**. A normal user can both *request* blood and *donate* (Become a Donor). |
| **Ambulance driver** | `mobile/` (phone app) | Same register/login, but pick **"Ambulance Driver"** at signup. Gets a **driver dashboard** with nearby requests. |
| **Pharmacy owner** | `web/` (browser panel) | **Signup with a password** at `/signup`, then admin approval. |
| **Admin** | `web/` (browser panel) | **Password** login. |

**Registration uses OTP; login uses email + password.** Role is chosen from a dropdown at signup
(Normal User or Ambulance Driver). Pharmacies & admins live in the web panel.

### Ambulance flow (driver-direct)
A user books an ambulance → **nearby drivers (same city) are notified** → the first driver to **accept**
gets the user's number and **calls to coordinate pickup**, then updates status (on the way → picked up →
completed). *("Nearest" is approximated by city in this MVP; GPS-nearest can be added later.)*

## Repository layout

```
Near-Dear/
├── backend/     Node + Express + Knex (MySQL) API
│   └── src/
│       ├── db/migrations   all 21 blueprint tables + auth tables
│       ├── db/seeds        admin, categories, medicines, demo pharmacy & ambulance
│       ├── controllers     auth, profile, blood, ambulance, pharmacy, catalog, orders, admin…
│       ├── routes          REST routes mounted under /api/v1
│       ├── services         otp (MSG91), aadhaar (Surepass), notifications, audit
│       └── middleware       JWT auth, role guard, uploads, validation, errors
├── mobile/      React Native CLI app (JavaScript) — patient app, OTP login
│   └── src/      screens / navigation / components / store / api / theme
└── web/         React + Vite (JavaScript) — Admin + Pharmacy panels, password login
    └── src/      pages (admin/ + pharmacy/) / components / store / api / hooks
```

---

## Quick start

### 1) Backend
```bash
cd backend
cp .env.example .env          # then edit values (see "Secret keys" below)
# create the database in MySQL first:  CREATE DATABASE neardear;
npm install
npm run db:setup              # runs migrations + seeds
npm run dev                   # API on http://localhost:4000
```
Seeded admin login → mobile **9999900001**, password **Admin@123**.

### 2) Mobile app
```bash
cd mobile
npm install
npm start                     # start Metro (keep running)
# in another terminal:
npm run android               # build & run on emulator/device
```
The app talks to the backend at `http://10.0.2.2:4000` on the Android emulator.
On a **real phone**, set your PC's LAN IP in [`mobile/src/config.js`](mobile/src/config.js).

### 3) Web panel (Admin + Pharmacy)
```bash
cd web
npm install
npm run dev                   # http://localhost:5173
```
- **Admin:** log in with `9999900001` / `Admin@123`.
- **Pharmacy:** click "Register your pharmacy" to sign up with a password, or use `9999900002` / `Pharma@123`.

See [`backend/README.md`](backend/README.md), [`mobile/README.md`](mobile/README.md) and [`web/README.md`](web/README.md) for full details and prerequisites.

---

## 🔑 Secret keys you need to provide

Everything runs in **mock mode out of the box** (no keys needed) so you can demo immediately.
To switch on the real services, fill these into `backend/.env`:

| Service | What it's for | .env keys | Where to get it |
|--------|---------------|-----------|-----------------|
| **MySQL** | Database | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Your local/cloud MySQL |
| **JWT secrets** | Token signing | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| **MSG91** | Real SMS OTP | set `OTP_PROVIDER=msg91`, `MSG91_AUTH_KEY`, `MSG91_OTP_TEMPLATE_ID`, `MSG91_SENDER_ID` | https://msg91.com (OTP product) |
| **Surepass** | Real Aadhaar OTP KYC | set `AADHAAR_PROVIDER=surepass`, `SUREPASS_TOKEN` | https://surepass.io (Aadhaar v2 OTP API) |

**Mock mode (default):**
- OTP login → use code **`123456`** (also shown on the OTP screen during dev).
- Aadhaar verify → enter any 12 digits, then OTP **`123456`**.

> Aadhaar KYC providers are paid/regulated. Until you add `SUREPASS_TOKEN`, leave `AADHAAR_PROVIDER=mock`.
> Same for SMS — until you add MSG91 keys, leave `OTP_PROVIDER=mock`.

### Optional / later phase
- **Firebase Cloud Messaging** (push notifications) — blueprint Phase 7. The backend already records in-app notifications; FCM can be layered on without changing call sites.
- **Google Maps API** — **required for live ambulance tracking** (see the section below) and later for address picker / distance matching.
- **AWS S3** — move private file storage off local disk for production.

---

## 🚑 Live Ambulance Tracking (REST short-polling)

Once a driver marks a trip **"On the way"**, the driver app sends its GPS to the
backend **every 5 seconds**, and the patient's app polls that position **every 5
seconds** and animates the ambulance marker on a Google Map (smooth interpolation
between updates — no laggy jumps). Tracking automatically stops when the trip is
completed or cancelled.

**How it works**
- **Driver side** → `POST /api/v1/ambulance/driver/location` `{ requestId, latitude, longitude, bearing }`
- **User side** → `GET /api/v1/ambulance/requests/:id/track` (returns the latest lat/lng/bearing + status)
- Location is stored on the `ambulance_requests` table (`current_latitude`, `current_longitude`, `bearing`, `location_updated_at`).

### What you need to provide & where

| # | What | Where to put it | Needed for |
|---|------|-----------------|------------|
| 1 | **Google Maps API key** (enable **"Maps SDK for Android"** in Google Cloud) | `mobile/android/gradle.properties` → `GOOGLE_MAPS_API_KEY=YOUR_KEY` | Rendering the map. Without it the map area is gray; everything else still works. |
| 2 | **Database migration** (adds the 4 tracking columns) | run `npm run migrate` in `backend/` | Storing/serving live coordinates. |
| 3 | **Native rebuild** of the Android app | `cd mobile/android && ./gradlew.bat app:installDebug` | New native modules (`react-native-maps`, geolocation) get compiled in — a JS reload is **not** enough. |

> Get the key at <https://console.cloud.google.com/> → APIs & Services → Credentials.
> Enable **Maps SDK for Android** (and **Maps SDK for iOS** if you build iOS).
> The key lives in `android/gradle.properties` and is injected into
> `AndroidManifest.xml` via a Gradle `manifestPlaceholder` — you do **not** edit
> the manifest by hand.

### Step-by-step

```bash
# 1) Paste your key
#    mobile/android/gradle.properties
GOOGLE_MAPS_API_KEY=AIza...your_key...

# 2) Backend: add the tracking columns
cd backend
npm run migrate

# 3) Mobile: install deps (already in package.json) and rebuild natively
cd ../mobile
npm install
cd android && ./gradlew.bat app:installDebug -PreactNativeDevServerPort=8081
```

**Permissions:** the driver app asks for **location permission** the first time a
trip goes "On the way". `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` are
already declared in `AndroidManifest.xml`.

**New dependencies added:** `react-native-maps`, `@react-native-community/geolocation`
(both New-Architecture compatible for RN 0.86).

**MVP limitations**
- **Foreground only** — GPS is shared while the driver app is open. True
  background tracking (screen off) needs an Android foreground service or
  `react-native-background-geolocation`.
- **Pickup/drop pins** show only if the booking has coordinates. The booking form
  currently captures addresses as text, so those pins may be hidden — the live
  ambulance marker (from the driver's GPS) always works. Add a map/geocoding
  picker later to plot pickup & drop.
- **iOS** isn't wired yet: add location usage strings to `Info.plist`, the Maps
  key in `AppDelegate`, then `pod install`.

---

## What's included vs. what's next

**Included (this build):** mobile app (all user modules + Aadhaar KYC), full REST backend, MySQL schema (all blueprint tables), OTP + Aadhaar provider integration, donor matching, prescription upload, order lifecycle, notifications, support, admin & pharmacy APIs.

**Now included:** the Admin and Pharmacy **web dashboards** (`web/`) with password login, pharmacy self-signup, document upload & approval, medicine/order management, ambulance assignment, and driver-account creation.

**Future phases (out of MVP scope):** online payments, live GPS tracking, AI recommendations, doctor consultation — the APIs are structured so these can be added without rewriting the modules.

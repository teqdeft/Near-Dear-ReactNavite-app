# NearDear — MVP (React Native + Node.js)

NearDear is a healthcare-support app with three modules that open from a themed home screen:

- 🩸 **Blood Donation** — become a donor, toggle availability, create blood requests, auto-match nearby donors, accept/decline, share contact only after acceptance.
- 🚑 **Ambulance** — request transport (pickup → drop), admin assigns a driver/vehicle, live status timeline.
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
- **Google Maps API** — address picker / distance matching.
- **AWS S3** — move private file storage off local disk for production.

---

## What's included vs. what's next

**Included (this build):** mobile app (all user modules + Aadhaar KYC), full REST backend, MySQL schema (all blueprint tables), OTP + Aadhaar provider integration, donor matching, prescription upload, order lifecycle, notifications, support, admin & pharmacy APIs.

**Now included:** the Admin and Pharmacy **web dashboards** (`web/`) with password login, pharmacy self-signup, document upload & approval, medicine/order management, ambulance assignment, and driver-account creation.

**Future phases (out of MVP scope):** online payments, live GPS tracking, AI recommendations, doctor consultation — the APIs are structured so these can be added without rewriting the modules.

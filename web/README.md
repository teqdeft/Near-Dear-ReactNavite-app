# NearDear Web Panel (Admin + Pharmacy)

React (Vite, JavaScript) dashboard for the **Admin** and **Pharmacy** roles. These roles use
**email/mobile + password** (not OTP) — this is where pharmacies sign up and where admins approve them.

## Run
```bash
cd web
npm install
npm run dev          # http://localhost:5173
```
The backend must be running (`cd backend && npm run dev`, on port 4000). The panel calls the API at
`http://localhost:4000/api/v1` (override with a `VITE_API_BASE_URL` env var if needed).

## Accounts
| Role | How to get in |
|------|---------------|
| **Admin** | Log in at `/login` with **9999900001 / Admin@123** (seeded) |
| **Pharmacy** | **Sign up** at `/signup` (create account with a password), or use the seeded **9999900002 / Pharma@123** |
| **Driver** | Created by the admin (Ambulance → Fleet & drivers → ＋ Driver); the driver then logs in with that mobile + password |

## Flows it covers
**Pharmacy**
- Sign up (owner account + password) → register pharmacy details → upload license/documents → wait for approval.
- Once approved: dashboard (order counts), add/enable/disable medicines & stock, manage orders (accept / reject / preparing / out for delivery / delivered), view attached prescriptions.

**Admin**
- Dashboard metrics.
- **Pharmacy approvals**: review details + view uploaded documents → approve / reject / suspend.
- Users: search, block / unblock, see Aadhaar KYC status.
- Blood requests: monitor.
- Ambulance: assign a vehicle to a request (driver auto-notified); manage **fleet** — add providers, **create driver login accounts**, add ambulances.
- Medicine orders: monitor all.
- Support: advance tickets (open → in progress → resolved → closed).
- Audit logs: every admin action.

## Notes
- Private files (prescriptions, pharmacy documents) are fetched with the auth token as a blob, so they
  display in-browser without exposing public URLs.
- Auth token is stored in `localStorage`; a 401 clears it and returns you to login.
- This is a single app that routes by role after login (admin → `/admin`, pharmacy → `/pharmacy`).

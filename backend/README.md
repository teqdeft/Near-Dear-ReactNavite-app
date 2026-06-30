# NearDear Backend

Node.js + Express + Knex (MySQL) + JWT. REST API for the NearDear mobile app, plus admin & pharmacy panel APIs.

## Prerequisites
- Node.js 18+
- MySQL 8 (or MariaDB 10.4+) running locally or in the cloud

## Setup
```bash
cp .env.example .env
# edit .env — at minimum set DB_* and the two JWT secrets
```
Create the database (one time):
```sql
CREATE DATABASE neardear CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```
Install + migrate + seed:
```bash
npm install
npm run db:setup      # = npm run migrate && npm run seed
npm run dev           # http://localhost:4000
```

## Seeded accounts
| Role | Mobile | Password | Login type |
|------|--------|----------|-----------|
| Admin | 9999900001 | Admin@123 | `POST /api/v1/auth/admin-login` |
| Pharmacy owner | 9999900002 | Pharma@123 | `POST /api/v1/auth/admin-login` |
| Ambulance driver | 9999900003 | Driver@123 | `POST /api/v1/auth/admin-login` |

Normal users sign in with **mobile OTP** (`/auth/request-otp` → `/auth/verify-otp`).
A demo **approved pharmacy** ("City Care Pharmacy") with 10 medicines is seeded so the medicine store is populated immediately.

## Scripts
| Command | Purpose |
|---------|---------|
| `npm run dev` | Start with nodemon |
| `npm start` | Start (production) |
| `npm run migrate` | Run latest migrations |
| `npm run migrate:rollback` | Roll back last batch |
| `npm run seed` | Run seeds |
| `npm run db:setup` | Migrate + seed |

## API overview (base: `/api/v1`)
- **Auth** — `POST /auth/request-otp`, `/auth/verify-otp`, `/auth/admin-login`, `/auth/refresh`, `GET /auth/me`, `POST /auth/aadhaar/generate-otp`, `/auth/aadhaar/verify`
- **Profile** — `PUT /profile`, `GET/POST /profile/addresses`, `POST /profile/delete-request`
- **Blood** — `POST /blood/donor`, `PUT /blood/donor/availability`, `GET /blood/donor/requests`, `POST /blood/requests`, `GET /blood/requests/mine`, `GET /blood/requests/:id`, `POST /blood/matches/:id/respond`
- **Ambulance** — `POST /ambulance/requests`, `GET /ambulance/requests/mine`, `GET /ambulance/requests/:id`, `PUT /ambulance/requests/:id/status`
- **Catalog** — `GET /catalog/categories`, `GET /catalog/medicines`, `GET /catalog/medicines/:id`
- **Orders** — `POST /orders/prescriptions` (multipart), `POST /orders`, `GET /orders`, `GET /orders/:id`, `POST /orders/:id/cancel`
- **Pharmacy panel** — `POST /pharmacy/register`, `POST /pharmacy/documents`, `GET /pharmacy/dashboard`, medicine CRUD, order management
- **Admin panel** — `GET /admin/dashboard`, users, pharmacy approvals, ambulance assignment, moderation, support, audit logs
- **Misc** — `GET /notifications`, `POST /support/tickets`
- **Files** — `GET /files/*` (authenticated; prescriptions & pharmacy docs are access-controlled)

Every response uses the envelope `{ success, message, data }`.

## Switching on real providers
- **SMS OTP (MSG91):** set `OTP_PROVIDER=msg91` and fill `MSG91_AUTH_KEY`, `MSG91_OTP_TEMPLATE_ID`.
- **Aadhaar KYC (Surepass):** set `AADHAAR_PROVIDER=surepass` and fill `SUREPASS_TOKEN`.

In `mock` mode the dev OTP is `123456` (configurable via `OTP_DEV_CODE` / `AADHAAR_DEV_OTP`).

## Notes
- Uploads are stored under `backend/uploads/` and served only through the authenticated `/files/*` route. For production, swap to S3 and use signed URLs.
- All admin actions are written to `audit_logs`.
- Order item names & prices are snapshotted so historical orders never change.

# Production Notes

Reminder checklist for when the app is deployed to production. Not needed during
local development.

---

## ⏰ Timezone: switch date/time storage to UTC

**Background:** In local dev, the MySQL session timezone is `SYSTEM` (IST on the
dev machine), so `knex.fn.now()` stores timestamps in **local IST time**. The
mobile app currently parses these as **local time** (see `mobile/src/utils/datetime.js`),
which is correct *only because the dev server and phone are both in IST*.

In production the server is usually **UTC**, so this assumption breaks. The
correct, standard setup is: **store everything in UTC, render in the device's
local timezone.**

Production DB is **fresh (empty)**, so there is NO existing IST data to convert —
just make these two changes at deploy time:

### 1. Force the DB session to UTC — `backend/knexfile.js`

Add `afterCreate` inside the `pool` config:

```js
pool: {
  min: config.db.poolMin,
  max: config.db.poolMax,
  afterCreate: (conn, done) => {
    conn.query("SET time_zone = '+00:00'", (err) => done(err, conn));
  },
},
```

> Note: the existing `timezone: '+00:00'` option only affects how the mysql2
> driver converts JS Date objects — it does NOT set the DB session timezone.
> The `afterCreate` `SET time_zone` above is what actually makes `NOW()` /
> timestamps store UTC.

### 2. Parse timestamps as UTC — `mobile/src/utils/datetime.js`

In `toDate()`, append `Z` again so the UTC string is converted to each device's
local timezone:

```js
const iso = typeof value === 'string' && value.includes(' ') && !value.includes('T')
  ? `${value.replace(' ', 'T')}Z`   // <-- add the trailing Z back
  : value;
```

That's it. `toLocaleString` / `toLocaleDateString` will then show the correct
local time on every user's device, anywhere in the world.

### If you ever migrate EXISTING dev (IST) data to a UTC DB

Only needed if you carry old data over (normally you don't). Convert each
timestamp column once:

```sql
UPDATE <table> SET created_at = CONVERT_TZ(created_at, '+05:30', '+00:00');
-- repeat for updated_at, required_at, and any other datetime columns
```

/**
 * Empty every data table so the database starts from a clean slate.
 *
 * Wipes users, pharmacies, ambulances, orders, medicines — everything except
 * the schema itself and knex's own migration bookkeeping. TRUNCATE is used so
 * AUTO_INCREMENT ids restart at 1, which keeps test data predictable.
 *
 * The table list is read from information_schema rather than hardcoded, so new
 * migrations are covered automatically without touching this file.
 *
 * Usage: npm run db:clean         (empty everything)
 *        npm run db:reset         (empty everything, then re-seed demo data)
 *        npm run db:reset:force   (same, allowed when NODE_ENV=production)
 */
const knexLib = require('knex');
const knexConfig = require('../../../knexfile');
const config = require('../../config');

// knex needs these to track which migrations have run; wiping them would make
// the next `npm run migrate` try to re-create tables that already exist.
const PRESERVED = ['knex_migrations', 'knex_migrations_lock'];

async function main() {
  const forced = process.argv.includes('--force');

  // Production data is real, so an accidental `npm run db:reset` on a server
  // must not be enough — the destructive intent has to be stated explicitly.
  if (config.env === 'production' && !forced) {
    console.error('NODE_ENV is production. Re-run with --force if you really mean to wipe it:');
    console.error('  npm run db:reset:force');
    process.exit(1);
  }

  // SET FOREIGN_KEY_CHECKS below is per-session, so every statement has to run
  // on the same connection. The app's pool (2-10) could hand a later TRUNCATE a
  // different connection where the checks are still on, so pin it to one.
  const base = knexConfig[config.env] || knexConfig.development;
  const knex = knexLib({ ...base, pool: { ...base.pool, min: 1, max: 1 } });
  console.log(`Target: ${config.db.user}@${config.db.host}:${config.db.port}/${config.db.name} (env: ${config.env})`);

  try {
    // Restricted to BASE TABLE: information_schema also lists views, and
    // TRUNCATE on a view is an error.
    const [rows] = await knex.raw(
      "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = ? AND table_type = 'BASE TABLE'",
      [config.db.name]
    );
    const tables = rows.map((r) => r.name).filter((n) => !PRESERVED.includes(n));

    if (!tables.length) {
      console.log('No tables found — run `npm run migrate` first.');
      return;
    }

    // TRUNCATE cannot run while other tables hold FKs pointing at the target,
    // so the checks come off for the duration of the wipe.
    await knex.raw('SET FOREIGN_KEY_CHECKS = 0');
    try {
      for (const table of tables) {
        // eslint-disable-next-line no-await-in-loop
        await knex.raw('TRUNCATE TABLE ??', [table]);
      }
    } finally {
      await knex.raw('SET FOREIGN_KEY_CHECKS = 1');
    }

    console.log(`Emptied ${tables.length} tables: ${tables.join(', ')}`);
  } finally {
    await knex.destroy();
  }
}

main().catch((err) => {
  console.error('Reset failed:', err.message);
  process.exit(1);
});

const config = require('./src/config');

// Managed MySQL providers require TLS. When a CA cert is supplied we verify
// against it; otherwise we still encrypt but skip verification, which keeps a
// misconfigured DB_SSL_CA from taking the API down.
function sslOptions() {
  if (!config.db.ssl) return undefined;
  if (config.db.sslCa) return { ca: config.db.sslCa, rejectUnauthorized: true };
  return { rejectUnauthorized: false };
}

/**
 * Knex configuration for NearDear (MySQL).
 * Migrations and seeds live under src/db.
 */
const base = {
  client: 'mysql2',
  connection: {
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.name,
    // Return DATE/DATETIME as plain strings (avoids JS timezone surprises).
    dateStrings: true,
    timezone: '+00:00',
    charset: 'utf8mb4',
    ssl: sslOptions(),
  },
  pool: {
    min: config.db.poolMin,
    max: config.db.poolMax,
    // `timezone` above only tells the mysql2 driver how to convert JS Dates —
    // it does NOT set the session timezone, so NOW() would still return the
    // server's local time. This is what actually makes timestamps store UTC.
    afterCreate: (conn, done) => {
      conn.query("SET time_zone = '+00:00'", (err) => done(err, conn));
    },
  },
  migrations: {
    directory: './src/db/migrations',
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: './src/db/seeds',
  },
};

module.exports = {
  development: base,
  production: base,
};
